const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const GeminiAIService = require('./gemini-service');
const VectorService = require('./vector-service');
const DataExtractionService = require('./data-extraction-service');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Store user states (in production, use a database)
const userStates = new Map();
const conversationHistory = new Map(); // Store conversation history for context
const pendingUpdates = new Map(); // Store pending data updates waiting for confirmation

// Initialize services
const geminiService = new GeminiAIService();
const vectorService = new VectorService();
const dataExtractionService = new DataExtractionService();

// Initialize vector database
vectorService.initializeIndex().then(success => {
  if (success) {
    console.log('✅ Vector database initialized');
  } else {
    console.log('📝 Using local storage fallback');
  }
});

// WhatsApp API configuration
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

// Webhook endpoint for receiving messages
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('📨 Webhook received:', JSON.stringify(body, null, 2));
    
    if (body.object === 'whatsapp_business_account') {
      console.log('✅ Valid WhatsApp Business webhook');
      body.entry.forEach(entry => {
        entry.changes.forEach(change => {
          if (change.field === 'messages') {
            console.log('📱 Messages field detected');
            const messages = change.value.messages;
            if (messages) {
              console.log(`📬 Processing ${messages.length} message(s)`);
              messages.forEach(async (message) => {
                console.log('💬 Message details:', JSON.stringify(message, null, 2));
                await handleIncomingMessage(message, change.value.contacts[0]);
              });
            } else {
              console.log('⚠️ No messages in webhook');
            }
          } else {
            console.log('⚠️ Not a messages field:', change.field);
          }
        });
      });
    } else {
      console.log('❌ Invalid webhook object:', body.object);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle incoming messages
async function handleIncomingMessage(message, contact) {
  const phoneNumber = message.from;
  const messageText = message.text?.body || '';
  const userName = contact.profile?.name || 'User';
  
  console.log(`📞 Received message from ${phoneNumber}: ${messageText}`);
  console.log(`👤 User name: ${userName}`);
  
  // Get user state
  let userState = userStates.get(phoneNumber) || 'waiting_for_name';
  console.log(`🔄 User state: ${userState}`);
  
  // Store conversation history for context
  if (!conversationHistory.has(phoneNumber)) {
    conversationHistory.set(phoneNumber, []);
  }
  conversationHistory.get(phoneNumber).push(messageText);
  
  try {
  if (userState === 'waiting_for_name') {
      // Ask for name using Gemini AI
      const response = await geminiService.generateNameCollectionResponse();
      await sendMessage(phoneNumber, response);
    userStates.set(phoneNumber, 'waiting_for_name_response');
  } else if (userState === 'waiting_for_name_response') {
      // Check if user is responding to a name update confirmation
      if (pendingUpdates.has(phoneNumber)) {
        const pendingUpdate = pendingUpdates.get(phoneNumber);
        const confirmation = await geminiService.checkConfirmationResponse(messageText);
        
        if (confirmation === 'yes') {
          // User confirmed name update
          await vectorService.updateUserData(
            phoneNumber, 
            userName, 
            pendingUpdate.dataType, 
            pendingUpdate.newContent, 
            pendingUpdate.existingId,
            {
              source: 'user_input',
              context: 'name_update',
              confirmed: true
            }
          );
          await sendMessage(phoneNumber, `✅ Updated! Your name has been changed to ${pendingUpdate.newContent}.`);
          pendingUpdates.delete(phoneNumber);
          userStates.set(phoneNumber, 'conversation');
        } else if (confirmation === 'no') {
          // User declined name update, ask for name again
          await sendMessage(phoneNumber, `👍 No problem! Please tell me your name.`);
          pendingUpdates.delete(phoneNumber);
        } else {
          // Unclear response, ask again
          await sendMessage(phoneNumber, `Please reply with "yes" to update your name or "no" to keep your current name.`);
        }
        return;
      }
      
      // Check if user already has a name stored (trying to update)
      const existingNameData = await vectorService.checkForExistingData(phoneNumber, 'name', messageText);
      
      if (existingNameData.exists) {
        // User already has a name, ask for confirmation to update
        const confirmationMessage = await geminiService.generateUpdateConfirmation(
          'name', 
          existingNameData.existingContent, 
          messageText
        );
        await sendMessage(phoneNumber, confirmationMessage);
        
        // Store pending update
        pendingUpdates.set(phoneNumber, {
          dataType: 'name',
          newContent: messageText,
          existingId: existingNameData.existingId,
          existingContent: existingNameData.existingContent
        });
        
        // Stay in waiting_for_name_response state until they confirm
      } else {
        // First time providing name, extract the name properly
        const extractedData = await dataExtractionService.extractStructuredData(messageText, userName);
        const extractedName = extractedData.extractedData;
        
        const response = await geminiService.generateGreetingResponse(extractedName, messageText);
        await sendMessage(phoneNumber, response);
        
        // Store the extracted name in vector database
        await vectorService.storeUserData(phoneNumber, extractedName, 'name', extractedName, {
          source: 'user_input',
          context: 'name_collection'
        });
        
    userStates.set(phoneNumber, 'conversation');
      }
  } else if (userState === 'conversation') {
      // Check if user is responding to an update confirmation
      if (pendingUpdates.has(phoneNumber)) {
        const pendingUpdate = pendingUpdates.get(phoneNumber);
        const confirmation = await geminiService.checkConfirmationResponse(messageText);
        
        if (confirmation === 'yes') {
          // User confirmed update
          await vectorService.updateUserData(
            phoneNumber, 
            userName, 
            pendingUpdate.dataType, 
            pendingUpdate.newContent, 
            pendingUpdate.existingId,
            {
              source: 'user_input',
              context: 'data_update',
              confirmed: true
            }
          );
          await sendMessage(phoneNumber, `✅ Updated! Your ${pendingUpdate.dataType} has been changed.`);
          pendingUpdates.delete(phoneNumber);
        } else if (confirmation === 'no') {
          // User declined update
          await sendMessage(phoneNumber, `👍 No problem! I'll keep your current ${pendingUpdate.dataType} as is.`);
          pendingUpdates.delete(phoneNumber);
        } else {
          // Unclear response, ask again
          await sendMessage(phoneNumber, `Please reply with "yes" to update or "no" to keep your current ${pendingUpdate.dataType}.`);
        }
        return;
      }
      
      // Check for delete data command first
      if (messageText.toLowerCase().includes('delete data') || messageText.toLowerCase().includes('delete all data')) {
        const deleteSuccess = await vectorService.deleteAllUserData(phoneNumber);
        if (deleteSuccess) {
          await sendMessage(phoneNumber, '🗑️ All your data has been deleted successfully!');
        } else {
          await sendMessage(phoneNumber, '❌ Failed to delete data. Please try again.');
        }
        return;
      }
      
      // Handle ongoing conversation - use intelligent data extraction
      const history = conversationHistory.get(phoneNumber).slice(-5); // Last 5 messages for context
      const response = await geminiService.generateConversationResponse(userName, messageText, history);
      
      // Only send response if one is generated (not null)
      if (response) {
        // Handle data retrieval questions
        if (response === "QUESTION_ABOUT_DATA") {
          const dataAnswer = await vectorService.answerUserQuestion(phoneNumber, messageText);
          await sendMessage(phoneNumber, dataAnswer);
        } else {
          await sendMessage(phoneNumber, response);
          
          // If it's a "gotcha" response, extract structured data and store it
          if (response.startsWith('gotcha,')) {
            const extractedData = await dataExtractionService.extractStructuredData(messageText, userName);
            
            // Generate storage key based on subject and person
            const storageKey = dataExtractionService.generateStorageKey(
              phoneNumber, 
              extractedData.dataType, 
              extractedData.subject, 
              extractedData.person
            );
            
            // Check if data already exists for this specific key
            const existingData = await vectorService.checkForExistingData(
              phoneNumber, 
              extractedData.dataType, 
              extractedData.extractedData,
              extractedData.person
            );
            
            if (existingData.exists) {
              // Data exists, ask for confirmation to update
              const confirmationMessage = await geminiService.generateUpdateConfirmation(
                extractedData.dataType, 
                existingData.existingContent, 
                extractedData.extractedData
              );
              await sendMessage(phoneNumber, confirmationMessage);
              
              // Store pending update
              pendingUpdates.set(phoneNumber, {
                dataType: extractedData.dataType,
                newContent: extractedData.extractedData,
                existingId: existingData.existingId,
                existingContent: existingData.existingContent,
                subject: extractedData.subject,
                person: extractedData.person
              });
            } else {
              // No existing data, store the extracted data
              await vectorService.storeUserData(
                phoneNumber, 
                userName, 
                extractedData.dataType, 
                extractedData.extractedData, 
                {
                  source: 'user_input',
                  context: 'personal_information',
                  response: response,
                  subject: extractedData.subject,
                  person: extractedData.person,
                  keywords: extractedData.keywords,
                  date: extractedData.date
                }
              );
            }
          }
        }
      }
      // If response is null, no message is sent (as requested)
    }
  } catch (error) {
    console.error('Error generating AI response:', error);
    // No fallback response - only respond when keywords are detected
  }
}

// Helper function to determine data type from message content
function determineDataType(messageText) {
  const text = messageText.toLowerCase();
  
  if (text.includes('birthday') || text.includes('born')) {
    return 'birthday';
  } else if (text.includes('phone') || text.includes('number')) {
    return 'phone';
  } else if (text.includes('my name is') || text.includes('name is') || 
             (text.includes('i am') && !text.includes('a ') && !text.includes('an ')) ||
             (text.includes('i\'m') && !text.includes('a ') && !text.includes('an '))) {
    return 'name';
  } else if (text.includes('like') || text.includes('love')) {
    return 'preference';
  } else if (text.includes('i am') || text.includes('i\'m')) {
    return 'identity';
  } else if (text.includes('work') || text.includes('job')) {
    return 'work';
  } else if (text.includes('have') || text.includes('own')) {
    return 'possession';
  } else {
    return 'interest';
  }
}

// Send message via WhatsApp API
async function sendMessage(to, text) {
  try {
    console.log(`📤 Sending message to ${to}: ${text}`);
    console.log(`🔑 Using access token: ${ACCESS_TOKEN ? 'Present' : 'Missing'}`);
    console.log(`📱 API URL: ${WHATSAPP_API_URL}`);
    
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: text
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Message sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending message:', error.response?.data || error.message);
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'WhatsApp Business Platform'
  });
});

// Data management endpoints
app.get('/api/user/:phoneNumber/profile', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const profile = await vectorService.getUserProfile(phoneNumber);
    res.json(profile);
  } catch (error) {
    console.error('Error retrieving user profile:', error);
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
});

app.get('/api/user/:phoneNumber/data', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { query, limit = 10 } = req.query;
    const data = await vectorService.retrieveUserData(phoneNumber, query, parseInt(limit));
    res.json(data);
  } catch (error) {
    console.error('Error retrieving user data:', error);
    res.status(500).json({ error: 'Failed to retrieve user data' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { query, limit = 5 } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    const results = await vectorService.searchSimilarData(query, parseInt(limit));
    res.json(results);
  } catch (error) {
    console.error('Error searching data:', error);
    res.status(500).json({ error: 'Failed to search data' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`WhatsApp Business Platform server running on port ${PORT}`);
  console.log(`Webhook URL: https://your-render-app.onrender.com/webhook`);
  console.log(`Health check: https://your-render-app.onrender.com/health`);
});

module.exports = app;
