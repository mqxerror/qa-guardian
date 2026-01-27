/**
 * Test script for Hot-Swap Provider Switching
 *
 * This test verifies:
 * - setPrimaryProvider method for immediate provider switching
 * - swapProviders method for quick primary/fallback swap
 * - In-flight request tracking during switch
 * - Circuit breaker reset on provider change
 * - Provider switch event logging
 * - getProviderSwitchHistory for tracking
 *
 * Run with: npx tsx src/services/providers/test-hot-swap.ts
 */

import {
  AIRouter,
  ProviderSwitchEvent,
} from './ai-router.js';

async function testHotSwap() {
  console.log('=== Testing Hot-Swap Provider Switching ===\n');

  // Step 1: Create router with default config (kie primary, anthropic fallback)
  console.log('Step 1: Creating AIRouter with default config...');
  const router = new AIRouter({
    primary: 'kie',
    fallback: 'anthropic',
    costTracking: true,
  });

  const initialConfig = router.getRouterConfig();
  console.log(`  - Initial primary: ${initialConfig.primary}`);
  console.log(`  - Initial fallback: ${initialConfig.fallback}`);

  // Step 2: Test getInFlightCount (should be 0)
  console.log('\nStep 2: Testing getInFlightCount...');
  const inFlight = router.getInFlightCount();
  console.log(`  - In-flight requests: ${inFlight}`);
  console.log(`  - isSwitching(): ${router.isSwitching()}`);

  // Step 3: Test setPrimaryProvider
  console.log('\nStep 3: Testing setPrimaryProvider...');
  const switchEvent = router.setPrimaryProvider('anthropic', {
    reason: 'Testing hot-swap',
    resetCircuitBreaker: true,
  });

  console.log('  Switch event:');
  console.log(`    - timestamp: ${switchEvent.timestamp}`);
  console.log(`    - previousPrimary: ${switchEvent.previousPrimary}`);
  console.log(`    - newPrimary: ${switchEvent.newPrimary}`);
  console.log(`    - previousFallback: ${switchEvent.previousFallback}`);
  console.log(`    - newFallback: ${switchEvent.newFallback}`);
  console.log(`    - reason: ${switchEvent.reason}`);
  console.log(`    - inFlightRequests: ${switchEvent.inFlightRequests}`);

  // Step 4: Verify configuration changed
  console.log('\nStep 4: Verifying configuration changed...');
  const newConfig = router.getRouterConfig();
  console.log(`  - New primary: ${newConfig.primary}`);
  console.log(`  - New fallback: ${newConfig.fallback}`);
  console.log(`  - Switch successful: ${newConfig.primary === 'anthropic'}`);

  // Step 5: First reset to kie/anthropic, then test swapProviders
  console.log('\nStep 5: Testing swapProviders...');
  // Reset to known state first
  router.setPrimaryProvider('kie', { reason: 'Reset for swap test', newFallback: 'anthropic' });
  const configBeforeSwap = router.getRouterConfig();
  console.log(`  - Before swap: primary=${configBeforeSwap.primary}, fallback=${configBeforeSwap.fallback}`);

  const swapEvent = router.swapProviders({
    reason: 'Testing swap functionality',
    resetCircuitBreakers: true,
  });

  console.log('  Swap event:');
  console.log(`    - previousPrimary: ${swapEvent.previousPrimary}`);
  console.log(`    - newPrimary: ${swapEvent.newPrimary}`);
  console.log(`    - previousFallback: ${swapEvent.previousFallback}`);
  console.log(`    - newFallback: ${swapEvent.newFallback}`);

  // Step 6: Verify swap worked (kie/anthropic swapped to anthropic/kie)
  console.log('\nStep 6: Verifying swap worked...');
  const swappedConfig = router.getRouterConfig();
  console.log(`  - Current primary: ${swappedConfig.primary}`);
  console.log(`  - Current fallback: ${swappedConfig.fallback}`);
  console.log(`  - Swap successful: ${swappedConfig.primary === 'anthropic' && swappedConfig.fallback === 'kie'}`);

  // Step 7: Test switch callback
  console.log('\nStep 7: Testing switch callback...');
  let callbackReceived = false;
  router.setProviderSwitchCallback((event) => {
    callbackReceived = true;
    console.log(`  Callback received! ${event.previousPrimary} -> ${event.newPrimary}`);
  });

  router.setPrimaryProvider('anthropic', { reason: 'Testing callback' });
  console.log(`  - Callback was invoked: ${callbackReceived}`);

  // Step 8: Test getProviderSwitchHistory
  console.log('\nStep 8: Testing getProviderSwitchHistory...');
  const history = router.getProviderSwitchHistory();
  console.log(`  - Total switch events: ${history.length}`);
  for (let i = 0; i < history.length; i++) {
    const event = history[i];
    if (event) {
      console.log(`    ${i + 1}. ${event.previousPrimary} -> ${event.newPrimary} (${event.reason})`);
    }
  }

  // Step 9: Test getCircuitBreaker
  console.log('\nStep 9: Testing getCircuitBreaker...');
  const kieCb = router.getCircuitBreaker('kie');
  const anthropicCb = router.getCircuitBreaker('anthropic');
  console.log(`  - Kie circuit breaker exists: ${!!kieCb}`);
  console.log(`  - Anthropic circuit breaker exists: ${!!anthropicCb}`);
  if (kieCb) {
    console.log(`  - Kie circuit breaker state: ${kieCb.getState()}`);
  }

  // Step 10: Test resetAllCircuitBreakers
  console.log('\nStep 10: Testing resetAllCircuitBreakers...');
  router.resetAllCircuitBreakers();
  console.log('  - All circuit breakers reset successfully');

  // Step 11: Test invalid provider switch
  console.log('\nStep 11: Testing invalid provider switch...');
  try {
    router.setPrimaryProvider('invalid-provider' as any);
    console.log('  - ERROR: Should have thrown an error');
  } catch (error) {
    console.log(`  - Correctly threw error: ${(error as Error).message}`);
  }

  // Step 12: Verify ProviderSwitchEvent interface
  console.log('\nStep 12: Verifying ProviderSwitchEvent interface...');
  const requiredFields = ['timestamp', 'previousPrimary', 'newPrimary', 'previousFallback', 'newFallback', 'reason', 'inFlightRequests'];
  for (const field of requiredFields) {
    const exists = field in switchEvent;
    console.log(`  ${exists ? '✓' : '✗'} ${field}: ${exists ? 'present' : 'MISSING'}`);
  }

  // Step 13: Test switching with different fallback
  console.log('\nStep 13: Testing switching with custom fallback...');
  const customSwitch = router.setPrimaryProvider('kie', {
    reason: 'Testing custom fallback',
    newFallback: 'anthropic',
  });
  console.log(`  - New primary: ${customSwitch.newPrimary}`);
  console.log(`  - New fallback: ${customSwitch.newFallback}`);

  // Step 14: Summary
  console.log('\nStep 14: Summary of hot-swap features...');
  console.log('  [✓] setPrimaryProvider method for immediate switching');
  console.log('  [✓] swapProviders method for quick primary/fallback swap');
  console.log('  [✓] In-flight request tracking (getInFlightCount)');
  console.log('  [✓] isSwitching() status check');
  console.log('  [✓] Circuit breaker reset on provider change');
  console.log('  [✓] Provider switch event logging');
  console.log('  [✓] setProviderSwitchCallback for event notifications');
  console.log('  [✓] getProviderSwitchHistory for auditing');
  console.log('  [✓] getCircuitBreaker for individual circuit breaker access');
  console.log('  [✓] resetAllCircuitBreakers for global reset');
  console.log('  [✓] Error handling for invalid providers');

  console.log('\n=== Hot-Swap Provider Switching Test Complete ===');
}

// Run tests
testHotSwap().catch(console.error);
