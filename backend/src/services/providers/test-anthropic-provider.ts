/**
 * Test script for AnthropicProvider
 *
 * Run with: ANTHROPIC_API_KEY=your-key npx tsx src/services/providers/test-anthropic-provider.ts
 */

import { AnthropicProvider, AnthropicAPIError } from './anthropic-provider.js';

async function testAnthropicProvider() {
  console.log('=== Testing AnthropicProvider ===\n');

  // Step 1: Create provider and check initialization
  console.log('Step 1: Creating AnthropicProvider...');
  const provider = new AnthropicProvider();

  const config = provider.getConfig();
  console.log(`  - API URL: ${config.apiUrl}`);
  console.log(`  - Default Model: ${config.defaultModel}`);
  console.log(`  - Initialized: ${provider.isInitialized()}`);
  console.log(`  - Available Models: ${provider.getAvailableModels().join(', ')}`);

  if (!provider.isInitialized()) {
    console.error('ERROR: Provider not initialized. Check ANTHROPIC_API_KEY environment variable.');
    process.exit(1);
  }

  console.log('\nStep 2: Testing real API call with Claude model...');
  try {
    const startTime = Date.now();
    const response = await provider.sendMessage(
      [{ role: 'user', content: 'What is 2 + 2? Answer in one word.' }],
      { model: 'claude-3-haiku-20240307', maxTokens: 50 }
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
    if (error instanceof AnthropicAPIError) {
      console.error(`\n  [ERROR] Anthropic API Error: ${error.message}`);
      console.error(`  - Status: ${error.status}`);
      console.error(`  - Code: ${error.code || 'N/A'}`);
      console.error(`  - Retryable: ${error.retryable}`);
    } else {
      console.error('\n  [ERROR] Unexpected error:', error);
    }
    process.exit(1);
  }

  console.log('\nStep 3: Checking usage statistics...');
  const stats = provider.getUsageStats();
  console.log(`  - Total Requests: ${stats.totalRequests}`);
  console.log(`  - Successful Requests: ${stats.successfulRequests}`);
  console.log(`  - Failed Requests: ${stats.failedRequests}`);
  console.log(`  - Input Tokens: ${stats.totalInputTokens}`);
  console.log(`  - Output Tokens: ${stats.totalOutputTokens}`);
  console.log(`  - Estimated Cost: $${stats.totalCostUsd.toFixed(6)}`);

  console.log('\nStep 4: Testing simple ask() helper...');
  try {
    const answer = await provider.ask(
      'What color is the sky? Answer in one word.',
      { model: 'claude-3-haiku-20240307', maxTokens: 20 }
    );
    console.log(`  - Answer: "${answer.trim()}"`);
    console.log('  [SUCCESS] ask() helper works!');
  } catch (error) {
    console.error('  [ERROR]', error);
  }

  console.log('\nStep 5: Testing token estimation...');
  const testText = 'This is a test sentence for token estimation.';
  const estimatedTokens = provider.estimateTokens(testText);
  console.log(`  - Text: "${testText}"`);
  console.log(`  - Estimated tokens: ${estimatedTokens}`);

  console.log('\nStep 6: Testing cost estimation...');
  const estimatedCost = provider.estimateCost(1000, 500, 'claude-3-haiku-20240307');
  console.log(`  - 1000 input + 500 output tokens with Haiku: $${estimatedCost.toFixed(6)}`);

  console.log('\n=== Final Usage Statistics ===');
  const finalStats = provider.getUsageStats();
  console.log(`  - Total Requests: ${finalStats.totalRequests}`);
  console.log(`  - Successful: ${finalStats.successfulRequests}`);
  console.log(`  - Failed: ${finalStats.failedRequests}`);
  console.log(`  - Total Cost: $${finalStats.totalCostUsd.toFixed(6)}`);
  console.log(`  - Requests by Model:`, finalStats.requestsByModel);

  console.log('\n=== All Tests Completed ===');
}

// Run tests
testAnthropicProvider().catch(console.error);
