/**
 * Simple script to enable storage quota exceeded simulation
 */

import fetch from 'node-fetch';
import { createLogger } from '../services/logger.js';

const quotaLogger = createLogger('quota-simulation');

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
    quotaLogger.error('Login failed');
    process.exit(1);
  }

  quotaLogger.info('Logged in successfully');

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
  quotaLogger.info({ response: enableData }, 'Enable response');

  if (enableData.simulatedQuotaExceeded === true) {
    quotaLogger.info('Storage quota exceeded simulation ENABLED');
  } else {
    quotaLogger.error('Failed to enable simulation');
  }
}

enableQuotaSimulation().catch((err) => {
  quotaLogger.error({ error: err instanceof Error ? err.message : String(err) }, 'Quota simulation script failed');
});
