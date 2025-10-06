const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiAIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.isAvailable = !!this.apiKey;
    
    if (this.isAvailable) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    } else {
      console.warn('⚠️  Gemini API key not found. Running in fallback mode.');
      this.model = null;
    }
  }

  // Generate a greeting response (simple greeting back)
  async generateGreetingResponse(userName, userMessage) {
    // Fallback response if Gemini is not available
    if (!this.isAvailable) {
      return "Hello!";
    }

    const prompt = `The user "${userName}" sent a greeting message: "${userMessage}".

Respond with a simple, friendly greeting back. Keep it short and casual. Examples:
- "Hello!"
- "Hi there!"
- "Hey!"
- "Hello! How are you?"

Keep it under 20 characters and very simple.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error generating greeting response:', error);
      return "Hello!";
    }
  }

  // Check if message contains keywords and generate "gotcha" response
  async checkForKeywordsAndRespond(userMessage) {
    // Fallback keyword detection if Gemini is not available
    if (!this.isAvailable) {
      return this.fallbackKeywordDetection(userMessage);
    }

    const prompt = `Analyze this message: "${userMessage}"

Check if it contains any of these keywords or patterns:
- "birthday" (with date)
- "phone number" 
- Any date mentioned with details
- Personal information being shared

If the message contains keywords or personal details, respond with:
"gotcha, [repeat the exact information they provided]"

Examples:
- "my birthday is on 26th feb" → "gotcha, your birthday is on 26th feb"
- "my phone number is 123-456-7890" → "gotcha, your phone number is 123-456-7890"
- "I was born on January 15th" → "gotcha, you were born on January 15th"

If NO keywords or personal details are found, respond with: "NO_RESPONSE"

Only respond if keywords/personal details are detected. Be very strict about this.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const resultText = response.text().trim();
      
      // Return null if no response should be given
      if (resultText === "NO_RESPONSE") {
        return null;
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
    
    // Check for birthday patterns
    if (message.includes('birthday') || message.includes('born on')) {
      return `gotcha, ${userMessage}`;
    }
    
    // Check for phone number patterns
    if (message.includes('phone number') || message.includes('phone') || /\d{3}[-.]?\d{3}[-.]?\d{4}/.test(message)) {
      return `gotcha, ${userMessage}`;
    }
    
    // Check for date patterns (basic)
    if (/\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(message)) {
      return `gotcha, ${userMessage}`;
    }
    
    // No keywords detected
    return null;
  }

  // Generate a response for ongoing conversation (now simplified)
  async generateConversationResponse(userName, userMessage, conversationHistory = []) {
    // First check for keywords
    const keywordResponse = await this.checkForKeywordsAndRespond(userMessage);
    
    if (keywordResponse) {
      return keywordResponse;
    }
    
    // If no keywords detected, return null (no response)
    return null;
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

module.exports = OpenAIService;
