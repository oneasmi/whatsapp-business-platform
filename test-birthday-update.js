const VectorService = require('./vector-service');

async function testBirthdayUpdate() {
  console.log('🧪 Testing Birthday Update Fix\n');

  const vectorService = new VectorService();
  await vectorService.initializeIndex();

  const testPhoneNumber = '1234567890';
  const testUserName = 'TestUser';

  try {
    console.log('1️⃣ Storing initial birthday...');
    await vectorService.storeUserData(testPhoneNumber, testUserName, 'birthday', 'My birthday is on 26th February');
    console.log('✅ Initial birthday stored: 26th February');

    console.log('\n2️⃣ Asking for birthday (should show old date)...');
    let answer = await vectorService.answerUserQuestion(testPhoneNumber, "What's my birthday?");
    console.log(`💬 Answer: ${answer}`);

    console.log('\n3️⃣ Storing new birthday (simulating update)...');
    await vectorService.storeUserData(testPhoneNumber, testUserName, 'birthday', 'My birthday is on 2nd June');
    console.log('✅ New birthday stored: 2nd June');

    console.log('\n4️⃣ Asking for birthday again (should show new date)...');
    answer = await vectorService.answerUserQuestion(testPhoneNumber, "What's my birthday?");
    console.log(`💬 Answer: ${answer}`);

    console.log('\n5️⃣ Checking all stored data...');
    const allData = await vectorService.retrieveUserData(testPhoneNumber);
    const birthdayEntries = allData.filter(item => item.dataType === 'birthday');
    console.log(`📊 Found ${birthdayEntries.length} birthday entries:`);
    birthdayEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.content} (${entry.timestamp})`);
    });

    console.log('\n✅ Birthday update test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBirthdayUpdate();
