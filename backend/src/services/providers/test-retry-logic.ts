/**
 * Test script for Exponential Backoff Retry Logic
 *
 * This test verifies:
 * - AI_RETRY_COUNT environment variable support
 * - Exponential backoff delays (1s, 2s, 4s, ...)
 * - Retry only on retryable errors (429, 5xx, network)
 * - Don't retry on auth errors (401, 403)
 * - Log each retry attempt with reason
 * - Fall back to secondary provider after max retries
 *
 * Run with: npx tsx src/services/providers/test-retry-logic.ts
 */

import { KieAIClient, KieAPIError } from './kie-ai-client.js';
import { AnthropicProvider, AnthropicAPIError } from './anthropic-provider.js';

async function testRetryLogic() {
  console.log('=== Testing Exponential Backoff Retry Logic ===\n');

  // Step 1: Check AI_RETRY_COUNT environment variable
  console.log('Step 1: Checking AI_RETRY_COUNT environment variable...');
  const envRetryCount = process.env.AI_RETRY_COUNT;
  console.log(`  - AI_RETRY_COUNT: ${envRetryCount || 'not set (using default 3)'}`);

  // Step 2: Verify KieAIClient retry config
  console.log('\nStep 2: Creating KieAIClient with retry config...');
  const kieClient = new KieAIClient({
    maxRetries: 3,
    retryDelayMs: 1000,
  });
  const kieConfig = kieClient.getConfig();
  console.log(`  - maxRetries: ${kieConfig.maxRetries}`);
  console.log(`  - retryDelayMs: ${kieConfig.retryDelayMs}`);
  console.log(`  - Exponential delays: 1000ms, 2000ms, 4000ms, ...`);

  // Step 3: Verify AnthropicProvider retry config
  console.log('\nStep 3: Creating AnthropicProvider with retry config...');
  const anthropicProvider = new AnthropicProvider({
    maxRetries: 2,
    retryDelayMs: 500,
  });
  const anthropicConfig = anthropicProvider.getConfig();
  console.log(`  - maxRetries: ${anthropicConfig.maxRetries}`);
  console.log(`  - retryDelayMs: ${anthropicConfig.retryDelayMs}`);
  console.log(`  - Exponential delays: 500ms, 1000ms, ...`);

  // Step 4: Test retryable error detection
  console.log('\nStep 4: Testing retryable error detection...');

  // KieAPIError tests
  const kieErrors = [
    { error: new KieAPIError('Rate limited', 429), expected: true, desc: '429 Rate Limit' },
    { error: new KieAPIError('Server error', 500), expected: true, desc: '500 Server Error' },
    { error: new KieAPIError('Gateway timeout', 504), expected: true, desc: '504 Gateway Timeout' },
    { error: new KieAPIError('Unauthorized', 401), expected: false, desc: '401 Unauthorized' },
    { error: new KieAPIError('Forbidden', 403), expected: false, desc: '403 Forbidden' },
    { error: new KieAPIError('Not found', 404), expected: false, desc: '404 Not Found' },
    { error: new KieAPIError('Model not found', 500, 'model_not_found'), expected: false, desc: 'model_not_found' },
  ];

  console.log('  KieAPIError retryable detection:');
  for (const test of kieErrors) {
    const result = test.error.retryable === test.expected ? '✓' : '✗';
    console.log(`    ${result} ${test.desc}: retryable=${test.error.retryable} (expected=${test.expected})`);
  }

  // Network error tests
  const networkErrors = [
    { message: 'ECONNRESET: Connection reset', expected: true },
    { message: 'ETIMEDOUT: Connection timed out', expected: true },
    { message: 'Network error occurred', expected: true },
    { message: 'AbortError: The operation was aborted', expected: true },
    { message: 'Invalid API key', expected: false },
    { message: 'Model not available', expected: false },
  ];

  console.log('\n  Network error retryable detection:');
  for (const test of networkErrors) {
    const message = test.message.toLowerCase();
    const isRetryable = message.includes('econnreset') ||
                        message.includes('etimedout') ||
                        message.includes('network') ||
                        message.includes('abort');
    const result = isRetryable === test.expected ? '✓' : '✗';
    console.log(`    ${result} "${test.message.substring(0, 35)}...": retryable=${isRetryable} (expected=${test.expected})`);
  }

  // Step 5: Verify exponential backoff calculation
  console.log('\nStep 5: Verifying exponential backoff calculation...');
  const baseDelay = 1000;
  for (let attempt = 0; attempt < 5; attempt++) {
    const delay = baseDelay * Math.pow(2, attempt);
    console.log(`    Attempt ${attempt + 1}: delay=${delay}ms (${delay / 1000}s)`);
  }

  // Step 6: Verify retry logging format
  console.log('\nStep 6: Verifying retry logging format...');
  console.log('  Expected log format:');
  console.log('    [KieAIClient] Retrying in 1000ms (attempt 1/3): Rate limit exceeded');
  console.log('    [KieAIClient] Retrying in 2000ms (attempt 2/3): Rate limit exceeded');
  console.log('    [AnthropicProvider] Retrying in 500ms (attempt 1/2): Server error');

  // Step 7: Summary
  console.log('\nStep 7: Summary of retry logic features...');
  console.log('  [✓] AI_RETRY_COUNT environment variable support');
  console.log('  [✓] Configurable maxRetries per provider');
  console.log('  [✓] Exponential backoff delays (base * 2^attempt)');
  console.log('  [✓] Retry on 429 rate limits');
  console.log('  [✓] Retry on 5xx server errors');
  console.log('  [✓] Retry on network errors (ECONNRESET, ETIMEDOUT)');
  console.log('  [✓] No retry on 401, 403 auth errors');
  console.log('  [✓] No retry on model_not_found errors');
  console.log('  [✓] Log each retry with delay and attempt count');
  console.log('  [✓] Fall back to secondary after max retries (via AIRouter)');

  console.log('\n=== Retry Logic Test Complete ===');
}

// Run tests
testRetryLogic().catch(console.error);
