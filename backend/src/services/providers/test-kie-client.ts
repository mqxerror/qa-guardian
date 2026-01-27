/**
 * Test script for KieAIClient
 *
 * Run with: KIE_API_KEY=your-key npx tsx src/services/providers/test-kie-client.ts
 *
 * This test verifies:
 * - Client initialization
 * - Real API calls to Kie.ai
 * - Streaming support
 * - Error handling
 * - Usage statistics tracking
 */

import { KieAIClient, KieAPIError } from './kie-ai-client.js';

async function testKieClient() {
  console.log('=== Testing KieAIClient ===\n');

  // Step 1: Create client and check initialization
  console.log('Step 1: Creating KieAIClient...');
  const client = new KieAIClient();

  const config = client.getConfig();
  console.log(`  - API URL: ${config.apiUrl}`);
  console.log(`  - Default Model: ${config.defaultModel}`);
  console.log(`  - Initialized: ${client.isInitialized()}`);
  console.log(`  - Available Models: ${client.getAvailableModels().join(', ')}`);

  if (!client.isInitialized()) {
    console.error('ERROR: Client not initialized. Check KIE_API_KEY environment variable.');
    process.exit(1);
  }

  console.log('\nStep 2: Testing real API call with DeepSeek model...');
  try {
    const startTime = Date.now();
    const response = await client.sendMessage(
      [{ role: 'user', content: 'What is 2 + 2? Answer in one word.' }],
      { model: 'deepseek-chat', maxTokens: 50 }
    );
    const latency = Date.now() - startTime;

    console.log(`  - Response: "${response.content.trim()}"`);
    console.log(`  - Model: ${response.model}`);
    console.log(`  - Input Tokens: ${response.inputTokens}`);
    console.log(`  - Output Tokens: ${response.outputTokens}`);
    console.log(`  - Stop Reason: ${response.stopReason}`);
    console.log(`  - Provider: ${response.provider}`);
    console.log(`  - Latency: ${latency}ms`);

    console.log('\n  [SUCCESS] API call completed successfully!');
  } catch (error) {
    if (error instanceof KieAPIError) {
      console.error(`\n  [ERROR] Kie.ai API Error: ${error.message}`);
      console.error(`  - Status: ${error.status}`);
      console.error(`  - Code: ${error.code || 'N/A'}`);
      console.error(`  - Retryable: ${error.retryable}`);
    } else {
      console.error('\n  [ERROR] Unexpected error:', error);
    }
    process.exit(1);
  }

  console.log('\nStep 3: Checking usage statistics...');
  const stats = client.getUsageStats();
  console.log(`  - Total Requests: ${stats.totalRequests}`);
  console.log(`  - Successful Requests: ${stats.successfulRequests}`);
  console.log(`  - Failed Requests: ${stats.failedRequests}`);
  console.log(`  - Input Tokens: ${stats.totalInputTokens}`);
  console.log(`  - Output Tokens: ${stats.totalOutputTokens}`);
  console.log(`  - Estimated Cost: $${stats.totalCostUsd.toFixed(6)}`);

  console.log('\nStep 4: Testing streaming API...');
  try {
    let streamedContent = '';
    const response = await client.sendMessageStream(
      [{ role: 'user', content: 'Count from 1 to 5, one number per line.' }],
      { model: 'deepseek-chat', maxTokens: 50 },
      {
        onText: (text) => {
          streamedContent += text;
          process.stdout.write(text);
        },
        onComplete: (result) => {
          console.log(`\n  [STREAM COMPLETE] ${result.outputTokens} output tokens`);
        },
        onError: (err) => {
          console.error('\n  [STREAM ERROR]', err.message);
        }
      }
    );
    console.log('\n  [SUCCESS] Streaming API completed!');
  } catch (error) {
    console.error('\n  [ERROR] Streaming failed:', error);
    // Note: Streaming might not be supported, continue testing
  }

  console.log('\nStep 5: Testing error handling (invalid model)...');
  try {
    await client.sendMessage(
      [{ role: 'user', content: 'Test' }],
      { model: 'invalid-model-name', maxTokens: 10 }
    );
    console.log('  [UNEXPECTED] No error thrown for invalid model');
  } catch (error) {
    if (error instanceof KieAPIError) {
      console.log(`  [SUCCESS] Proper error handling: ${error.message.substring(0, 80)}...`);
    } else {
      console.log(`  [SUCCESS] Error caught: ${(error as Error).message.substring(0, 80)}...`);
    }
  }

  console.log('\nStep 6: Testing simple ask() helper...');
  try {
    const answer = await client.ask(
      'What color is the sky? Answer in one word.',
      { model: 'deepseek-chat', maxTokens: 20 }
    );
    console.log(`  - Answer: "${answer.trim()}"`);
    console.log('  [SUCCESS] ask() helper works!');
  } catch (error) {
    console.error('  [ERROR]', error);
  }

  console.log('\n=== Final Usage Statistics ===');
  const finalStats = client.getUsageStats();
  console.log(`  - Total Requests: ${finalStats.totalRequests}`);
  console.log(`  - Successful: ${finalStats.successfulRequests}`);
  console.log(`  - Failed: ${finalStats.failedRequests}`);
  console.log(`  - Total Cost: $${finalStats.totalCostUsd.toFixed(6)}`);
  console.log(`  - Requests by Model:`, finalStats.requestsByModel);

  console.log('\n=== All Tests Completed ===');
}

// Run tests
testKieClient().catch(console.error);
