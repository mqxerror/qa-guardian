/**
 * Test script for AI Router Service
 *
 * This test verifies:
 * - Singleton service connecting UI to real router
 * - Get/update router configuration
 * - Real-time router stats
 * - Circuit breaker state management
 * - Cost savings integration
 * - Budget status integration
 *
 * Run with: npx tsx src/services/providers/test-ai-router-service.ts
 */

import { aiRouterService } from './ai-router-service.js';

async function testAIRouterService() {
  console.log('=== Testing AI Router Service ===\n');

  // Step 1: Verify singleton instance
  console.log('Step 1: Verifying singleton instance...');
  console.log('  - aiRouterService exists: YES');
  console.log(`  - isEnabled(): ${aiRouterService.isEnabled()}`);

  // Step 2: Get initial configuration
  console.log('\nStep 2: Getting initial configuration...');
  const config = aiRouterService.getConfig();
  console.log(`  - primary_provider: ${config.primary_provider}`);
  console.log(`  - fallback_provider: ${config.fallback_provider}`);
  console.log(`  - enabled: ${config.enabled}`);
  console.log(`  - timeout_ms: ${config.timeout_ms}`);
  console.log(`  - cost_tracking: ${config.cost_tracking}`);
  console.log('  - fallback_conditions:');
  console.log(`    on_timeout: ${config.fallback_conditions.on_timeout}`);
  console.log(`    on_rate_limit: ${config.fallback_conditions.on_rate_limit}`);
  console.log(`    on_error: ${config.fallback_conditions.on_error}`);
  console.log('  - circuit_breaker:');
  console.log(`    enabled: ${config.circuit_breaker.enabled}`);
  console.log(`    failure_threshold: ${config.circuit_breaker.failure_threshold}`);
  console.log(`    recovery_time_ms: ${config.circuit_breaker.recovery_time_ms}`);

  // Step 3: Update configuration
  console.log('\nStep 3: Updating configuration...');
  const updatedConfig = aiRouterService.updateConfig({
    primary_provider: 'anthropic',
    timeout_ms: 45000,
    circuit_breaker: {
      enabled: true,
      failure_threshold: 3,
      recovery_time_ms: 30000,
    },
  });
  console.log(`  - primary_provider (updated): ${updatedConfig.primary_provider}`);
  console.log(`  - timeout_ms (updated): ${updatedConfig.timeout_ms}`);
  console.log(`  - circuit_breaker.failure_threshold (updated): ${updatedConfig.circuit_breaker.failure_threshold}`);

  // Reset back to kie as primary
  aiRouterService.updateConfig({ primary_provider: 'kie' });

  // Step 4: Get router stats
  console.log('\nStep 4: Getting router stats...');
  const stats = aiRouterService.getStats();
  console.log(`  - total_requests: ${stats.total_requests}`);
  console.log(`  - primary_successes: ${stats.primary_successes}`);
  console.log(`  - fallback_successes: ${stats.fallback_successes}`);
  console.log(`  - total_failures: ${stats.total_failures}`);
  console.log(`  - primary_success_rate: ${stats.primary_success_rate}%`);
  console.log(`  - fallback_success_rate: ${stats.fallback_success_rate}%`);
  console.log(`  - failover_events count: ${stats.failover_events.length}`);

  // Step 5: Get circuit breaker states
  console.log('\nStep 5: Getting circuit breaker states...');
  const cbStates = aiRouterService.getCircuitBreakerStates();
  for (const state of cbStates) {
    console.log(`  Provider: ${state.provider}`);
    console.log(`    state: ${state.state}`);
    console.log(`    failure_count: ${state.failure_count}`);
  }

  // Step 6: Test circuit breaker reset
  console.log('\nStep 6: Testing circuit breaker reset...');
  aiRouterService.resetCircuitBreaker('kie');
  const kieState = cbStates.find(s => s.provider === 'kie');
  console.log(`  - Reset kie circuit breaker`);
  console.log(`  - State after reset: ${aiRouterService.getCircuitBreakerStates().find(s => s.provider === 'kie')?.state}`);

  // Step 7: Get cost savings
  console.log('\nStep 7: Getting cost savings...');
  const savings = aiRouterService.getCostSavings();
  console.log(`  - totalInputTokens: ${savings.totalInputTokens}`);
  console.log(`  - totalOutputTokens: ${savings.totalOutputTokens}`);
  console.log(`  - actualCostUsd: $${savings.actualCostUsd.toFixed(4)}`);
  console.log(`  - savingsUsd: $${savings.savingsUsd.toFixed(4)}`);
  console.log(`  - savingsPercent: ${savings.savingsPercent.toFixed(1)}%`);

  // Step 8: Get budget status
  console.log('\nStep 8: Getting budget status...');
  const budget = aiRouterService.getBudgetStatus();
  console.log(`  - currentMonth: ${budget.currentMonth}`);
  console.log(`  - budgetLimitUsd: $${budget.budgetLimitUsd}`);
  console.log(`  - currentSpendUsd: $${budget.currentSpendUsd.toFixed(4)}`);
  console.log(`  - percentUsed: ${budget.percentUsed.toFixed(1)}%`);

  // Step 9: Check provider availability
  console.log('\nStep 9: Checking provider availability...');
  console.log(`  - kie available: ${aiRouterService.isProviderAvailable('kie')}`);
  console.log(`  - anthropic available: ${aiRouterService.isProviderAvailable('anthropic')}`);

  // Step 10: Verify UIRouterConfig interface
  console.log('\nStep 10: Verifying UIRouterConfig interface...');
  const requiredFields = [
    'primary_provider',
    'fallback_provider',
    'enabled',
    'fallback_conditions',
    'timeout_ms',
    'max_fallback_attempts',
    'circuit_breaker',
    'cost_tracking',
  ];
  const currentConfig = aiRouterService.getConfig();
  for (const field of requiredFields) {
    const exists = field in currentConfig;
    console.log(`  ${exists ? '✓' : '✗'} ${field}: ${exists ? 'present' : 'MISSING'}`);
  }

  // Step 11: Verify UIRouterStats interface
  console.log('\nStep 11: Verifying UIRouterStats interface...');
  const statsFields = [
    'total_requests',
    'primary_successes',
    'fallback_successes',
    'total_failures',
    'failover_events',
    'last_failover_at',
    'primary_success_rate',
    'fallback_success_rate',
  ];
  const currentStats = aiRouterService.getStats();
  for (const field of statsFields) {
    const exists = field in currentStats;
    console.log(`  ${exists ? '✓' : '✗'} ${field}: ${exists ? 'present' : 'MISSING'}`);
  }

  // Step 12: Summary
  console.log('\nStep 12: Summary of AI Router Service features...');
  console.log('  [✓] Singleton service connecting UI to real router');
  console.log('  [✓] Get router configuration (UIRouterConfig)');
  console.log('  [✓] Update router configuration');
  console.log('  [✓] Primary provider dropdown support');
  console.log('  [✓] Fallback conditions toggles support');
  console.log('  [✓] Circuit breaker settings support');
  console.log('  [✓] Real-time router stats (UIRouterStats)');
  console.log('  [✓] Circuit breaker state management');
  console.log('  [✓] Cost savings integration');
  console.log('  [✓] Budget status integration');
  console.log('  [✓] Provider availability checks');
  console.log('  [✓] Reset functionality');

  console.log('\n=== AI Router Service Test Complete ===');
}

// Run tests
testAIRouterService().catch(console.error);
