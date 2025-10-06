// Test script for Gemini AI integration with new behavior
const GeminiAIService = require('./gemini-service');
require('dotenv').config();

async function testGeminiAIService() {
  console.log('Testing Gemini AI Service with New Behavior...\n');
  
  // Check if Gemini API key is set
  if (!process.env.GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY not found in environment variables');
    console.log('Please set your Gemini API key in the .env file');
    console.log('Get your free API key at: https://makersuite.google.com/app/apikey');
    return;
  }
  
  const geminiService = new GeminiAIService();
  
  try {
    console.log('1. Testing greeting response...');
    const greetingResponse = await geminiService.generateGreetingResponse('John', 'Hello!');
    console.log('✅ Greeting response:', greetingResponse);
    console.log('');
    
    console.log('2. Testing keyword detection - Birthday...');
    const birthdayResponse = await geminiService.checkForKeywordsAndRespond('my birthday is on 26th feb');
    console.log('✅ Birthday response:', birthdayResponse);
    console.log('');
    
    console.log('3. Testing keyword detection - Phone number...');
    const phoneResponse = await geminiService.checkForKeywordsAndRespond('my phone number is 123-456-7890');
    console.log('✅ Phone response:', phoneResponse);
    console.log('');
    
    console.log('4. Testing keyword detection - Date with details...');
    const dateResponse = await geminiService.checkForKeywordsAndRespond('I was born on January 15th, 1990');
    console.log('✅ Date response:', dateResponse);
    console.log('');
    
    console.log('5. Testing NO response for regular messages...');
    const noResponse = await geminiService.checkForKeywordsAndRespond('How are you doing today?');
    console.log('✅ No response (should be null):', noResponse);
    console.log('');
    
    console.log('6. Testing conversation response with keywords...');
    const conversationResponse = await geminiService.generateConversationResponse('John', 'my birthday is on 26th feb', []);
    console.log('✅ Conversation with keywords:', conversationResponse);
    console.log('');
    
    console.log('7. Testing conversation response without keywords...');
    const noKeywordResponse = await geminiService.generateConversationResponse('John', 'How are you?', []);
    console.log('✅ Conversation without keywords (should be null):', noKeywordResponse);
    console.log('');
    
    console.log('🎉 All tests completed!');
    console.log('\nExpected behavior:');
    console.log('- Greetings get simple greeting responses');
    console.log('- Messages with keywords (birthday, phone, dates) get "gotcha, [info]" responses');
    console.log('- Other messages get no response (null)');
    
  } catch (error) {
    console.error('❌ Error testing Gemini AI service:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('- Verify your Gemini API key is correct');
    console.log('- Check your Google AI Studio account');
    console.log('- Ensure you have access to Gemini Pro model');
  }
}

// Run the test
testGeminiAIService();
