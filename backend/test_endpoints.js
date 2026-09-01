const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const testEndpoints = async () => {
  console.log('=== STARTING INTEGRATION TESTS ===');
  
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'testpassword123';
  let jwtToken = '';

  try {
    // 1. Test Register
    console.log('\n[TEST 1] Registering User...');
    const regRes = await fetch(`${BASE_URL}/auth/register-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const regData = await regRes.json();
    console.log('Status:', regRes.status);
    console.log('Response:', regData);
    if (regRes.status !== 201) throw new Error('Registration failed');

    // 2. Test OTP Verification
    console.log('\n[TEST 2] Verifying OTP...');
    const otpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otpCode: '1234' })
    });
    const otpData = await otpRes.json();
    console.log('Status:', otpRes.status);
    console.log('Response:', otpData);
    if (otpRes.status !== 200) throw new Error('OTP Verification failed');
    jwtToken = otpData.token;

    // 3. Test Login
    console.log('\n[TEST 3] Logging In...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const loginData = await loginRes.json();
    console.log('Status:', loginRes.status);
    console.log('Response:', loginData);
    if (loginRes.status !== 200) throw new Error('Login failed');

    // 4. Test Profile Setup
    console.log('\n[TEST 4] Profile Setup...');
    const setupRes = await fetch(`${BASE_URL}/auth/profile-setup`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({
        displayName: 'Test User',
        dateOfBirth: '1995-05-15',
        gender: 'Female',
        interests: ['Travel', 'Music', 'Coffee'],
        bio: 'Hello Rubaru!'
      })
    });
    const setupData = await setupRes.json();
    console.log('Status:', setupRes.status);
    console.log('Response:', setupData);
    if (setupRes.status !== 201) throw new Error('Profile setup failed');

    // 5. Test Get Profile Me
    console.log('\n[TEST 5] Fetching own Profile details...');
    const getMeRes = await fetch(`${BASE_URL}/profiles/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    const getMeData = await getMeRes.json();
    console.log('Status:', getMeRes.status);
    console.log('Response:', getMeData);
    if (getMeRes.status !== 200) throw new Error('Fetching profile failed');

    console.log('\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n!!! TEST FAILED:', error.message);
    process.exit(1);
  }
};

// Wait 1.5 seconds for database connection to be established before executing tests
setTimeout(testEndpoints, 2500);
