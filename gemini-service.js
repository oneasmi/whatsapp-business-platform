const { GoogleGenerativeAI } = require('@google/generative-ai');
const DataExtractionService = require('./data-extraction-service');

class GeminiAIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.isAvailable = !!this.apiKey;
    this.dataExtractionService = new DataExtractionService();
    
    if (this.isAvailable) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    } else {
      console.warn('⚠️  Gemini API key not found. Running in fallback mode.');
      this.model = null;
    }
  }

  // Generate update confirmation prompt
  async generateUpdateConfirmation(dataType, existingContent, newContent) {
    const dataTypeLabels = {
      'birthday': 'birthday',
      'phone': 'phone number',
      'name': 'name',
      'preference': 'preference',
      'work': 'job/profession',
      'identity': 'identity'
    };

    const label = dataTypeLabels[dataType] || dataType;
    
    return `I already have your ${label} stored as: "${existingContent}"

You're trying to update it to: "${newContent}"

Are you sure you want to update your ${label}? Please reply with "yes" to update or "no" to keep the current information.`;
  }

  // Check if user response is a confirmation (yes/no)
  async checkConfirmationResponse(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    if (message === 'yes' || message === 'y' || message === 'yeah' || message === 'sure' || message === 'ok' || message === 'okay') {
      return 'yes';
    } else if (message === 'no' || message === 'n' || message === 'nope' || message === 'nah') {
      return 'no';
    }
    
    return null; // Not a clear yes/no response
  }

  // Generate a greeting response (simple greeting back)
  async generateGreetingResponse(userName, userMessage) {
    // Fallback response if Gemini is not available
    if (!this.isAvailable) {
      return `Hello ${userName}!`;
    }

    const prompt = `The user "${userName}" sent a greeting message: "${userMessage}".

Respond with a simple, friendly greeting back that includes their name. Keep it short and casual. Examples:
- "Hello ${userName}!"
- "Hi ${userName}!"
- "Hey ${userName}!"
- "Hello ${userName}! How are you?"

Keep it under 30 characters and include their name.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error generating greeting response:', error);
      return `Hello ${userName}!`;
    }
  }

  // Check if message contains keywords and generate "gotcha" response
  async checkForKeywordsAndRespond(userMessage) {
    // Fallback keyword detection if Gemini is not available
    if (!this.isAvailable) {
      return this.fallbackKeywordDetection(userMessage);
    }

    const prompt = `Analyze this message: "${userMessage}"

Check if it contains:
1. GREETINGS: "hello", "hi", "hey", "good morning", "good afternoon", "good evening"
2. QUESTIONS about personal information:
   - "what's my birthday?", "when is my birthday?"
   - "what's my phone number?", "what's my name?"
   - "what do I like?", "what are my preferences?"
   - "what do I work as?", "what's my job?"
   - "who am I?", "tell me about myself"
3. PERSONAL INFORMATION:
   - "birthday" (with date)
   - "phone number" 
   - Any date mentioned with details
   - Personal preferences: "I like...", "I love...", "I am...", "I'm..."
   - Interests, hobbies, job, location, etc.

If it's a GREETING, respond with a simple greeting back:
- "Hello!" or "Hi there!" or "Hey!" or "Good morning!"

If it's a QUESTION about personal information, respond with:
"QUESTION_ABOUT_DATA"

If it contains PERSONAL INFORMATION, respond with:
"gotcha, [convert first person to second person]"

Examples:
- "hello" → "Hello!"
- "good morning" → "Good morning!"
- "what's my birthday?" → "QUESTION_ABOUT_DATA"
- "what do I like?" → "QUESTION_ABOUT_DATA"
- "my birthday is on 26th feb" → "gotcha, your birthday is on 26th feb"
- "I like pineapple" → "gotcha, you like pineapple"
- "I'm a teacher" → "gotcha, you're a teacher"

If it's neither a greeting, question, nor personal information, respond with: "NO_RESPONSE"`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const resultText = response.text().trim();
      
      // Return null if no response should be given
      if (resultText === "NO_RESPONSE") {
        return null;
      }
      
      // Return special marker for questions about data
      if (resultText === "QUESTION_ABOUT_DATA") {
        return "QUESTION_ABOUT_DATA";
      }
      
      return resultText;
    } catch (error) {
      console.error('Error checking keywords:', error);
      return this.fallbackKeywordDetection(userMessage);
    }
  }

  // Fallback keyword detection using simple regex patterns
  fallbackKeywordDetection(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Check for greetings first
    if (message.includes('hello') || message.includes('hi') || 
        message.includes('hey') || message.includes('good morning') ||
        message.includes('good afternoon') || message.includes('good evening')) {
      return "Hello!";
    }
    
    // Check for questions about personal data
    if (message.includes('what') && (message.includes('my') || message.includes('i'))) {
      return "QUESTION_ABOUT_DATA";
    }
    
    if (message.includes('when') && message.includes('birthday')) {
      return "QUESTION_ABOUT_DATA";
    }
    
    if (message.includes('who') && message.includes('am')) {
      return "QUESTION_ABOUT_DATA";
    }
    
    // Check for personal information patterns
    if (message.includes('birthday') || message.includes('born on') ||
        message.includes('phone number') || message.includes('phone') ||
        message.includes('like') || message.includes('love') ||
        message.includes('i am') || message.includes('i\'m') ||
        message.includes('i have') || message.includes('i work') ||
        /\d{3}[-.]?\d{3}[-.]?\d{4}/.test(message) ||
        /\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(message)) {
      
      // Convert first person to second person
      let convertedMessage = userMessage
        .replace(/\bI am\b/gi, 'you\'re')
        .replace(/\bI'm\b/gi, 'you\'re')
        .replace(/\bI like\b/gi, 'you like')
        .replace(/\bI love\b/gi, 'you love')
        .replace(/\bI have\b/gi, 'you have')
        .replace(/\bI work\b/gi, 'you work')
        .replace(/\bmy\b/gi, 'your')
        .replace(/\bme\b/gi, 'you');
      
      return `gotcha, ${convertedMessage}`;
    }
    
    // No greeting, question, or personal details detected
    return null;
  }

  // Generate a response for ongoing conversation (now simplified)
  async generateConversationResponse(userName, userMessage, conversationHistory = []) {
    // First, extract structured data to understand what the user is saying
    const extractedData = await this.dataExtractionService.extractStructuredData(userMessage, userName);
    
    // Check if it's a greeting
    if (this.isGreeting(userMessage)) {
      return this.generateGreetingResponse(userName, userMessage);
    }
    
    // Check if it's a question about data
    if (this.isDataQuestion(userMessage)) {
      return "QUESTION_ABOUT_DATA";
    }
    
    // Check if it contains personal information
    if (this.containsPersonalInfo(extractedData)) {
      return this.dataExtractionService.generateResponseMessage(extractedData, userName);
    }
    
    // No response for other messages
    return null;
  }

  isGreeting(message) {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings'];
    const lowerMessage = message.toLowerCase();
    return greetings.some(greeting => lowerMessage.includes(greeting));
  }

  isDataQuestion(message) {
    const questionPatterns = [
      /what'?s?\s+my/i,
      /when\s+is\s+my/i,
      /who\s+am\s+i/i,
      /tell\s+me\s+about\s+myself/i,
      /what\s+do\s+i\s+like/i,
      /what\s+are\s+my/i
    ];
    
    return questionPatterns.some(pattern => pattern.test(message));
  }

  containsPersonalInfo(extractedData) {
    const personalDataTypes = ['birthday', 'phone', 'name', 'preference', 'work', 'identity', 'trip', 'event'];
    return personalDataTypes.includes(extractedData.dataType);
  }

  // Generate a follow-up response
  async generateFollowUpResponse(userName, userMessage) {
    const prompt = `You are a WhatsApp Business assistant. Customer "${userName}" sent: "${userMessage}"

This appears to be a follow-up message. Your role is to:
1. Acknowledge their continued engagement
2. Provide specific, helpful responses
3. If they seem satisfied, offer additional assistance
4. If they have new questions, address them directly
5. Keep responses under 160 characters
6. Be professional and solution-oriented

Respond as a helpful business representative:`;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating follow-up response:', error);
      return `Thank you for your continued interest! Is there anything else I can help you with today?`;
    }
  }

  // Generate a name collection response
  async generateNameCollectionResponse() {
    const prompt = `You are a WhatsApp Business assistant starting a conversation with a new customer.

Your role is to:
1. Welcome them warmly
2. Ask for their name in a friendly way
3. Explain briefly why you need their name (for personalized service)
4. Keep it under 160 characters
5. Be professional but approachable

Generate a welcoming message that asks for their name:`;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.7,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating name collection response:', error);
      return `Hello! Welcome to our WhatsApp Business service. What's your name so I can assist you better?`;
    }
  }
}

module.exports = GeminiAIService;
