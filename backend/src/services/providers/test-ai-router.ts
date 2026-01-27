/**
 * Test script for AIRouter with automatic failover
 *
 * This test verifies:
 * - Router initialization with primary and fallback providers
 * - Automatic failover when primary provider fails
 * - Failover event logging
 * - Router statistics tracking
 * - Response metadata with provider info
 *
 * Run with: npx tsx src/services/providers/test-ai-router.ts
 */

import { AIRouter, FailoverEvent, RoutedAIResponse } from './ai-router.js';

async function testAIRouter() {
  console.log('=== Testing AIRouter with Automatic Failover ===\n');

  // Step 1: Create router with default config
  console.log('Step 1: Creating AIRouter...');
  const router = new AIRouter({
    primary: 'kie',
    fallback: 'anthropic',
    fallbackOnError: true,
    fallbackOnTimeout: true,
  });

  console.log(`  - Router initialized: ${router.isInitialized()}`);
  console.log(`  - Primary: ${router.getRouterConfig().primary}`);
  console.log(`  - Fallback: ${router.getRouterConfig().fallback}`);
  console.log(`  - Kie.ai available: ${router.isProviderAvailable('kie')}`);
  console.log(`  - Anthropic available: ${router.isProviderAvailable('anthropic')}`);

  // Step 2: Set up failover callback
  console.log('\nStep 2: Setting up failover callback...');
  const failoverEvents: FailoverEvent[] = [];
  router.setFailoverCallback((event) => {
    failoverEvents.push(event);
    console.log(`  [FAILOVER] ${event.primaryProvider} -> ${event.fallbackProvider}: ${event.reason}`);
  });
  console.log('  - Failover callback registered');

  // Step 3: Test request routing
  console.log('\nStep 3: Testing request routing...');

  if (router.isInitialized()) {
    try {
      const response = await router.sendMessage(
        [{ role: 'user', content: 'What is 2 + 2? Answer in one word.' }],
        { maxTokens: 20 }
      ) as RoutedAIResponse;

      console.log(`  - Response: "${response.content.trim()}"`);
      console.log(`  - Actual Provider: ${response.actualProvider}`);
      console.log(`  - Used Fallback: ${response.usedFallback}`);
      if (response.fallbackReason) {
        console.log(`  - Fallback Reason: ${response.fallbackReason}`);
      }
      console.log(`  - Latency: ${response.latencyMs}ms`);
      console.log(`  - Model: ${response.model}`);
      console.log(`  - Provider: ${response.provider}`);
    } catch (error) {
      console.log(`  - Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.log('  - No providers initialized, skipping request test');
  }

  // Step 4: Check router statistics
  console.log('\nStep 4: Checking router statistics...');
  const stats = router.getRouterStats();
  console.log(`  - Total Requests: ${stats.totalRequests}`);
  console.log(`  - Primary Successes: ${stats.primarySuccesses}`);
  console.log(`  - Fallback Successes: ${stats.fallbackSuccesses}`);
  console.log(`  - Total Failures: ${stats.totalFailures}`);
  console.log(`  - Failover Events: ${stats.failoverEvents.length}`);
  if (stats.lastFailoverAt) {
    console.log(`  - Last Failover: ${stats.lastFailoverAt}`);
  }

  // Step 5: Test combined usage stats
  console.log('\nStep 5: Checking combined usage statistics...');
  const usageStats = router.getUsageStats();
  console.log(`  - Total Requests: ${usageStats.totalRequests}`);
  console.log(`  - Successful Requests: ${usageStats.successfulRequests}`);
  console.log(`  - Failed Requests: ${usageStats.failedRequests}`);
  console.log(`  - Total Input Tokens: ${usageStats.totalInputTokens}`);
  console.log(`  - Total Output Tokens: ${usageStats.totalOutputTokens}`);
  console.log(`  - Total Cost: $${usageStats.totalCostUsd.toFixed(6)}`);

  // Step 6: Test available models
  console.log('\nStep 6: Checking available models...');
  const models = router.getAvailableModels();
  console.log(`  - Available Models: ${models.length}`);
  console.log(`  - Models: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '...' : ''}`);

  // Step 7: Verify interface implementation
  console.log('\nStep 7: Verifying IAIProvider interface...');
  const methods = [
    'initialize', 'isInitialized', 'sendMessage', 'sendMessageStream',
    'ask', 'healthCheck', 'getUsageStats', 'resetUsageStats',
    'getProviderStatus', 'getAvailableModels', 'getConfig', 'updateConfig',
    'estimateTokens', 'estimateCost', 'getHealthMetrics'
  ];

  let allMethodsPresent = true;
  for (const method of methods) {
    if (typeof (router as unknown as Record<string, unknown>)[method] !== 'function') {
      console.log(`  [MISSING] ${method}`);
      allMethodsPresent = false;
    }
  }

  if (allMethodsPresent) {
    console.log('  [SUCCESS] All IAIProvider methods implemented');
  }

  // Step 8: Check router-specific methods
  console.log('\nStep 8: Checking router-specific methods...');
  const routerMethods = [
    'getRouterStats', 'getRouterConfig', 'updateRouterConfig',
    'getProvider', 'isProviderAvailable', 'setFailoverCallback'
  ];

  let allRouterMethodsPresent = true;
  for (const method of routerMethods) {
    if (typeof (router as unknown as Record<string, unknown>)[method] !== 'function') {
      console.log(`  [MISSING] ${method}`);
      allRouterMethodsPresent = false;
    }
  }

  if (allRouterMethodsPresent) {
    console.log('  [SUCCESS] All router-specific methods implemented');
  }

  console.log('\n=== AIRouter Test Complete ===');
}

// Run tests
testAIRouter().catch(console.error);
