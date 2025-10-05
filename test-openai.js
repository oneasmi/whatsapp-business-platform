// Test script for OpenAI integration with new behavior
const OpenAIService = require('./openai-service');
require('dotenv').config();

async function testOpenAIService() {
  console.log('Testing OpenAI Service with New Behavior...\n');
  
  // Check if OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY not found in environment variables');
    console.log('Please set your OpenAI API key in the .env file');
    return;
  }
  
  const openaiService = new OpenAIService();
  
  try {
    console.log('1. Testing greeting response...');
    const greetingResponse = await openaiService.generateGreetingResponse('John', 'Hello!');
    console.log('✅ Greeting response:', greetingResponse);
    console.log('');
    
    console.log('2. Testing keyword detection - Birthday...');
    const birthdayResponse = await openaiService.checkForKeywordsAndRespond('my birthday is on 26th feb');
    console.log('✅ Birthday response:', birthdayResponse);
    console.log('');
    
    console.log('3. Testing keyword detection - Phone number...');
    const phoneResponse = await openaiService.checkForKeywordsAndRespond('my phone number is 123-456-7890');
    console.log('✅ Phone response:', phoneResponse);
    console.log('');
    
    console.log('4. Testing keyword detection - Date with details...');
    const dateResponse = await openaiService.checkForKeywordsAndRespond('I was born on January 15th, 1990');
    console.log('✅ Date response:', dateResponse);
    console.log('');
    
    console.log('5. Testing NO response for regular messages...');
    const noResponse = await openaiService.checkForKeywordsAndRespond('How are you doing today?');
    console.log('✅ No response (should be null):', noResponse);
    console.log('');
    
    console.log('6. Testing conversation response with keywords...');
    const conversationResponse = await openaiService.generateConversationResponse('John', 'my birthday is on 26th feb', []);
    console.log('✅ Conversation with keywords:', conversationResponse);
    console.log('');
    
    console.log('7. Testing conversation response without keywords...');
    const noKeywordResponse = await openaiService.generateConversationResponse('John', 'How are you?', []);
    console.log('✅ Conversation without keywords (should be null):', noKeywordResponse);
    console.log('');
    
    console.log('🎉 All tests completed!');
    console.log('\nExpected behavior:');
    console.log('- Greetings get simple greeting responses');
    console.log('- Messages with keywords (birthday, phone, dates) get "gotcha, [info]" responses');
    console.log('- Other messages get no response (null)');
    
  } catch (error) {
    console.error('❌ Error testing OpenAI service:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('- Verify your OpenAI API key is correct');
    console.log('- Check your OpenAI account has sufficient credits');
    console.log('- Ensure you have access to GPT-3.5-turbo model');
  }
}

// Run the test
testOpenAIService();
