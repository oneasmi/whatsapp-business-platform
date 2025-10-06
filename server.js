const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const GeminiAIService = require('./gemini-service');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Store user states (in production, use a database)
const userStates = new Map();
const conversationHistory = new Map(); // Store conversation history for context

// Initialize Gemini AI service
const geminiService = new GeminiAIService();

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
      // User provided their name, respond with personalized greeting
      const name = messageText.trim();
      const response = await geminiService.generateGreetingResponse(name, messageText);
      await sendMessage(phoneNumber, response);
      userStates.set(phoneNumber, 'conversation');
    } else if (userState === 'conversation') {
      // Handle ongoing conversation - check for keywords or greetings
      const history = conversationHistory.get(phoneNumber).slice(-5); // Last 5 messages for context
      const response = await geminiService.generateConversationResponse(userName, messageText, history);
      
      // Only send response if one is generated (not null)
      if (response) {
        await sendMessage(phoneNumber, response);
      }
      // If response is null, no message is sent (as requested)
    }
  } catch (error) {
    console.error('Error generating AI response:', error);
    // No fallback response - only respond when keywords are detected
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

// Start server
app.listen(PORT, () => {
  console.log(`WhatsApp Business Platform server running on port ${PORT}`);
  console.log(`Webhook URL: https://your-render-app.onrender.com/webhook`);
  console.log(`Health check: https://your-render-app.onrender.com/health`);
});

module.exports = app;
