/**
 * Simple script to enable storage quota exceeded simulation
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

async function enableQuotaSimulation() {
  // Login
  const loginResponse = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'developer@example.com',
      password: 'Developer123!',
    }),
  });

  const loginData = await loginResponse.json() as { token?: string };
  if (!loginData.token) {
    console.error('Login failed');
    process.exit(1);
  }

  console.log('Logged in successfully');

  // Enable quota simulation
  const enableResponse = await fetch(`${API_URL}/api/v1/visual/test-storage-quota-exceeded`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`,
    },
    body: JSON.stringify({}),
  });

  const enableData = await enableResponse.json() as { success?: boolean; simulatedQuotaExceeded?: boolean };
  console.log('Enable response:', enableData);

  if (enableData.simulatedQuotaExceeded === true) {
    console.log('✓ Storage quota exceeded simulation ENABLED');
  } else {
    console.error('Failed to enable simulation');
  }
}

enableQuotaSimulation().catch(console.error);
