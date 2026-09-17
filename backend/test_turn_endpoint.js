const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';
console.log('Testing turn endpoints on BASE_URL:', BASE_URL);

async function test() {
  const client = axios.create({ baseURL: BASE_URL, timeout: 5000 });
  
  try {
    const r1 = await client.get('/v1/calls/turn-credentials');
    console.log('r1 (/v1/calls/turn-credentials):', r1.status);
  } catch (e) {
    console.log('r1 failed:', e.response?.status || e.message);
  }

  try {
    const r2 = await client.get('/api/calls/turn-credentials');
    console.log('r2 (/api/calls/turn-credentials):', r2.status);
  } catch (e) {
    console.log('r2 failed:', e.response?.status || e.message);
  }

  try {
    const r3 = await client.get('/calls/turn-credentials');
    console.log('r3 (/calls/turn-credentials):', r3.status, r3.data);
  } catch (e) {
    console.log('r3 failed:', e.response?.status || e.message);
  }

  process.exit(0);
}

test();
