// Test script for vector database functionality
const VectorService = require('./vector-service');
require('dotenv').config();

async function testVectorService() {
  console.log('Testing Vector Database Service...\n');
  
  // Check if Pinecone API key is set
  if (!process.env.PINECONE_API_KEY) {
    console.log('⚠️  PINECONE_API_KEY not found in environment variables');
    console.log('App will use local storage fallback');
    console.log('Get your free Pinecone API key at: https://app.pinecone.io/');
  }
  
  const vectorService = new VectorService();
  
  try {
    console.log('1. Initializing vector database...');
    const initialized = await vectorService.initializeIndex();
    console.log(`✅ Vector database initialized: ${initialized}`);
    console.log('');
    
    console.log('2. Testing data storage...');
    const testPhoneNumber = '919910053492';
    const testUserName = 'Neha';
    
    // Test storing different types of data
    const testData = [
      { type: 'name', content: 'Neha Sharma' },
      { type: 'preference', content: 'I like pineapple' },
      { type: 'identity', content: 'I am a teacher' },
      { type: 'birthday', content: 'My birthday is on 26th February' },
      { type: 'interest', content: 'I love reading books' }
    ];
    
    for (const data of testData) {
      const vectorId = await vectorService.storeUserData(
        testPhoneNumber, 
        testUserName, 
        data.type, 
        data.content
      );
      console.log(`✅ Stored ${data.type}: ${data.content} (ID: ${vectorId})`);
    }
    console.log('');
    
    console.log('3. Testing data retrieval...');
    const userData = await vectorService.retrieveUserData(testPhoneNumber);
    console.log(`✅ Retrieved ${userData.length} data points:`);
    userData.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.dataType}: ${item.content}`);
    });
    console.log('');
    
    console.log('4. Testing user profile generation...');
    const profile = await vectorService.getUserProfile(testPhoneNumber);
    console.log('✅ User Profile:');
    console.log(`   Name: ${profile.name || 'Not provided'}`);
    console.log(`   Preferences: ${profile.preferences.join(', ') || 'None'}`);
    console.log(`   Interests: ${profile.interests.join(', ') || 'None'}`);
    console.log(`   Personal Info: ${profile.personalInfo.join(', ') || 'None'}`);
    console.log(`   Contact Info: ${profile.contactInfo.join(', ') || 'None'}`);
    console.log('');
    
    console.log('5. Testing search functionality...');
    const searchResults = await vectorService.searchSimilarData('teacher', 3);
    console.log(`✅ Found ${searchResults.length} similar results for "teacher":`);
    searchResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.dataType}: ${result.content} (Score: ${result.score?.toFixed(3)})`);
    });
    console.log('');
    
    console.log('🎉 All vector database tests completed!');
    console.log('\nAPI Endpoints available:');
    console.log('- GET /api/user/{phoneNumber}/profile - Get user profile');
    console.log('- GET /api/user/{phoneNumber}/data - Get user data');
    console.log('- GET /api/search?query=term - Search across all data');
    
  } catch (error) {
    console.error('❌ Error testing vector service:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('- Verify your Pinecone API key is correct');
    console.log('- Check your Pinecone environment setting');
    console.log('- Ensure your Pinecone index exists');
    console.log('- App will fallback to local storage if Pinecone fails');
  }
}

// Run the test
testVectorService();
