// Test script for data retrieval functionality
const VectorService = require('./vector-service');
require('dotenv').config();

async function testDataRetrieval() {
  console.log('Testing Data Retrieval Functionality...\n');
  
  const vectorService = new VectorService();
  
  try {
    console.log('1. Initializing vector database...');
    const initialized = await vectorService.initializeIndex();
    console.log(`✅ Vector database initialized: ${initialized}`);
    console.log('');
    
    console.log('2. Setting up test user data...');
    const testPhoneNumber = '919910053492';
    const testUserName = 'Neha';
    
    // Store some test data
    const testData = [
      { type: 'name', content: 'Neha Sharma' },
      { type: 'birthday', content: 'My birthday is on 26th February' },
      { type: 'preference', content: 'I like pineapple' },
      { type: 'preference', content: 'I love pizza' },
      { type: 'identity', content: 'I am a teacher' },
      { type: 'work', content: 'I work at a school' }
    ];
    
    for (const data of testData) {
      await vectorService.storeUserData(testPhoneNumber, testUserName, data.type, data.content);
      console.log(`✅ Stored: ${data.type} - ${data.content}`);
    }
    console.log('');
    
    console.log('3. Testing data retrieval questions...');
    
    const testQuestions = [
      "What's my birthday?",
      "When is my birthday?",
      "What's my name?",
      "What do I like?",
      "What are my preferences?",
      "What do I work as?",
      "What's my job?",
      "Who am I?",
      "Tell me about myself",
      "What's my phone number?", // This should prompt for missing data
      "What's my favorite color?" // This should prompt for missing data
    ];
    
    for (const question of testQuestions) {
      console.log(`\n❓ Question: "${question}"`);
      const answer = await vectorService.answerUserQuestion(testPhoneNumber, question);
      console.log(`💬 Answer: "${answer}"`);
    }
    
    console.log('\n🎉 Data retrieval testing completed!');
    console.log('\nExpected behavior:');
    console.log('- Questions about stored data should return the information');
    console.log('- Questions about missing data should prompt for the information');
    console.log('- The bot should be able to answer questions about user preferences, identity, etc.');
    
  } catch (error) {
    console.error('❌ Error testing data retrieval:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('- Verify your Pinecone API key is correct');
    console.log('- Check your Pinecone environment setting');
    console.log('- Ensure your Pinecone index exists');
    console.log('- App will fallback to local storage if Pinecone fails');
  }
}

// Run the test
testDataRetrieval();
