const GeminiAIService = require('./gemini-service');
const VectorService = require('./vector-service');

async function testUpdateSystem() {
  console.log('🧪 Testing Data Update Confirmation System\n');

  const geminiService = new GeminiAIService();
  const vectorService = new VectorService();

  // Initialize vector service
  await vectorService.initializeIndex();

  const testPhoneNumber = '1234567890';
  const testUserName = 'TestUser';

  try {
    console.log('1️⃣ Testing initial data storage...');
    
    // Store initial birthday
    await vectorService.storeUserData(testPhoneNumber, testUserName, 'birthday', 'My birthday is on 26th February');
    console.log('✅ Initial birthday stored: 26th February');

    console.log('\n2️⃣ Testing existing data detection...');
    
    // Check for existing data
    const existingData = await vectorService.checkForExistingData(testPhoneNumber, 'birthday', 'My birthday is on 2nd June');
    console.log('🔍 Existing data check:', existingData);

    if (existingData.exists) {
      console.log('✅ Existing data detected correctly');
      console.log(`📅 Current: "${existingData.existingContent}"`);
      console.log(`📅 New: "My birthday is on 2nd June"`);
    } else {
      console.log('❌ Existing data not detected');
    }

    console.log('\n3️⃣ Testing update confirmation generation...');
    
    // Generate confirmation message
    const confirmationMessage = await geminiService.generateUpdateConfirmation(
      'birthday',
      existingData.existingContent,
      'My birthday is on 2nd June'
    );
    console.log('💬 Confirmation message:');
    console.log(confirmationMessage);

    console.log('\n4️⃣ Testing confirmation response detection...');
    
    // Test yes responses
    const yesResponses = ['yes', 'y', 'yeah', 'sure', 'ok', 'okay'];
    for (const response of yesResponses) {
      const result = await geminiService.checkConfirmationResponse(response);
      console.log(`"${response}" → ${result}`);
    }

    // Test no responses
    const noResponses = ['no', 'n', 'nope', 'nah'];
    for (const response of noResponses) {
      const result = await geminiService.checkConfirmationResponse(response);
      console.log(`"${response}" → ${result}`);
    }

    // Test unclear responses
    const unclearResponses = ['maybe', 'I think so', 'not sure', 'hello'];
    for (const response of unclearResponses) {
      const result = await geminiService.checkConfirmationResponse(response);
      console.log(`"${response}" → ${result || 'null (unclear)'}`);
    }

    console.log('\n5️⃣ Testing data update...');
    
    // Simulate update
    if (existingData.exists) {
      await vectorService.updateUserData(
        testPhoneNumber,
        testUserName,
        'birthday',
        'My birthday is on 2nd June',
        existingData.existingId,
        { source: 'test', context: 'update_test' }
      );
      console.log('✅ Data updated successfully');

      // Verify the update
      const updatedData = await vectorService.retrieveUserData(testPhoneNumber);
      const birthdayData = updatedData.find(item => item.dataType === 'birthday');
      console.log('📅 Updated content:', birthdayData?.content);
    }

    console.log('\n6️⃣ Testing data retrieval after update...');
    
    // Test question answering
    const question = "What's my birthday?";
    const answer = await vectorService.answerUserQuestion(testPhoneNumber, question);
    console.log(`❓ Question: ${question}`);
    console.log(`💬 Answer: ${answer}`);

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testUpdateSystem();
