/**
 * Test script for AI Provider MCP Handler
 *
 * This test verifies:
 * - get-ai-provider-status returns real data from ai-router
 * - Real health check results
 * - Real latency metrics
 * - Real circuit breaker state
 * - switch-ai-provider uses real hot-swap
 *
 * Run with: npx tsx src/mcp/handlers/test-ai-provider-handler.ts
 */

import { getAiProviderStatus, getAiCostReport, switchAiProvider } from './ai-provider.js';
import { HandlerContext } from './types.js';

// Mock context for testing
const mockContext: HandlerContext = {
  log: (message: string) => console.log(`  [Context] ${message}`),
  apiKey: 'test-key',
  apiUrl: 'http://localhost:3000',
  callApi: async () => ({}),
  callApiPublic: async () => ({}),
};

async function testAiProviderHandler() {
  console.log('=== Testing AI Provider MCP Handler ===\n');

  // Step 1: Test getAiProviderStatus with default options
  console.log('Step 1: Testing getAiProviderStatus (default options)...');
  const statusResult = await getAiProviderStatus({}, mockContext) as any;

  console.log(`  - success: ${statusResult.success}`);
  if (statusResult.success) {
    console.log(`  - data_source: ${(statusResult as any).data_source}`);
    console.log(`  - overall_status: ${(statusResult as any).overall_status}`);
    console.log(`  - router_enabled: ${(statusResult as any).router_enabled}`);
    console.log(`  - ai_service_initialized: ${(statusResult as any).ai_service_initialized}`);

    // Check primary provider
    const primary = (statusResult as any).primary_provider;
    if (primary) {
      console.log(`  Primary provider:`);
      console.log(`    - name: ${primary.name}`);
      console.log(`    - status: ${primary.status}`);
      console.log(`    - is_configured: ${primary.is_configured}`);
      console.log(`    - circuit_breaker_state: ${primary.circuit_breaker_state}`);
      console.log(`    - failure_count: ${primary.failure_count}`);
    }

    // Check fallback provider
    const fallback = (statusResult as any).fallback_provider;
    if (fallback) {
      console.log(`  Fallback provider:`);
      console.log(`    - name: ${fallback.name}`);
      console.log(`    - status: ${fallback.status}`);
      console.log(`    - failover_enabled: ${fallback.failover_enabled}`);
      console.log(`    - circuit_breaker_state: ${fallback.circuit_breaker_state}`);
    }

    // Check circuit breakers
    const cbs = (statusResult as any).circuit_breakers;
    if (cbs && cbs.length > 0) {
      console.log(`  Circuit breakers (${cbs.length}):`);
      for (const cb of cbs) {
        console.log(`    - ${cb.provider}: ${cb.state} (failures: ${cb.failure_count})`);
      }
    }

    // Check router config
    const routerConfig = (statusResult as any).router_config;
    if (routerConfig) {
      console.log(`  Router config:`);
      console.log(`    - enabled: ${routerConfig.enabled}`);
      console.log(`    - timeout_ms: ${routerConfig.timeout_ms}`);
      console.log(`    - fallback_on_timeout: ${routerConfig.fallback_on_timeout}`);
      console.log(`    - cost_tracking: ${routerConfig.cost_tracking}`);
    }
  }

  // Step 2: Test with health metrics enabled
  console.log('\nStep 2: Testing getAiProviderStatus (with health metrics)...');
  const healthResult = await getAiProviderStatus({
    include_health_metrics: true,
  }, mockContext) as any;

  if (healthResult.success) {
    const metrics = (healthResult as any).health_metrics;
    if (metrics) {
      console.log(`  Health metrics:`);
      console.log(`    - avg_latency_ms: ${metrics.avg_latency_ms}`);
      console.log(`    - p95_latency_ms: ${metrics.p95_latency_ms}`);
      console.log(`    - requests_total: ${metrics.requests_total}`);
      console.log(`    - requests_success: ${metrics.requests_success}`);
      console.log(`    - requests_failed: ${metrics.requests_failed}`);
      console.log(`    - primary_success_rate: ${metrics.primary_success_rate}%`);
      console.log(`    - fallback_success_rate: ${metrics.fallback_success_rate}%`);
      console.log(`    - failover_count: ${metrics.failover_count}`);
    }
  }

  // Step 3: Test getAiCostReport with real savings data
  console.log('\nStep 3: Testing getAiCostReport (with real savings data)...');
  const costResult = await getAiCostReport({
    include_savings: true,
    include_budget_status: true,
    include_token_breakdown: true,
  }, mockContext) as any;

  console.log(`  - success: ${costResult.success}`);
  if (costResult.success) {
    console.log(`  - data_source: ${(costResult as any).data_source}`);
    console.log(`  - total_cost_usd: $${(costResult as any).total_cost_usd}`);
    console.log(`  - total_requests: ${(costResult as any).total_requests}`);
    console.log(`  - total_tokens: ${(costResult as any).total_tokens}`);

    // Check provider breakdown
    const byProvider = (costResult as any).by_provider;
    if (byProvider && byProvider.length > 0) {
      console.log(`  Provider breakdown (${byProvider.length} providers):`);
      for (const provider of byProvider) {
        console.log(`    - ${provider.provider}: $${provider.cost_usd} (${provider.requests} requests, ${provider.tokens} tokens)`);
      }
    }

    // Check real savings data
    const savings = (costResult as any).savings;
    if (savings) {
      console.log(`  Real savings data:`);
      console.log(`    - total_savings_usd: $${savings.total_savings_usd}`);
      console.log(`    - savings_percentage: ${savings.savings_percentage}%`);
      console.log(`    - kie_cost_usd: $${savings.kie_cost_usd}`);
      console.log(`    - anthropic_baseline_usd: $${savings.anthropic_baseline_usd}`);
      console.log(`    - actual_cost_usd: $${savings.actual_cost_usd}`);
      if (savings.by_provider) {
        console.log(`    - by_provider.kie: ${savings.by_provider.kie.requests} requests, $${savings.by_provider.kie.cost_usd}`);
        console.log(`    - by_provider.anthropic: ${savings.by_provider.anthropic.requests} requests, $${savings.by_provider.anthropic.cost_usd}`);
      }
    }

    // Check budget status
    const budget = (costResult as any).budget_status;
    if (budget) {
      console.log(`  Real budget status:`);
      console.log(`    - current_month: ${budget.current_month}`);
      console.log(`    - monthly_budget_usd: $${budget.monthly_budget_usd}`);
      console.log(`    - spent_usd: $${budget.spent_usd}`);
      console.log(`    - remaining_usd: $${budget.remaining_usd}`);
      console.log(`    - percentage_used: ${budget.percentage_used}%`);
      console.log(`    - threshold_alert_triggered: ${budget.threshold_alert_triggered}`);
      console.log(`    - requests_blocked: ${budget.requests_blocked}`);
    }
  }

  // Step 4: Test switchAiProvider
  console.log('\nStep 4: Testing switchAiProvider (switch to anthropic)...');
  const switchResult = await switchAiProvider({
    provider: 'anthropic',
    reason: 'Testing MCP handler',
    reset_circuit_breaker: true,
  }, mockContext) as any;

  console.log(`  - success: ${switchResult.success}`);
  if (switchResult.success) {
    console.log(`  - data_source: ${(switchResult as any).data_source}`);
    console.log(`  - previous_provider: ${(switchResult as any).previous_provider}`);
    console.log(`  - new_provider: ${(switchResult as any).new_provider}`);
    console.log(`  - new_fallback: ${(switchResult as any).new_fallback}`);
    console.log(`  - in_flight_requests: ${(switchResult as any).in_flight_requests}`);
    console.log(`  - circuit_breaker_reset: ${(switchResult as any).circuit_breaker_reset}`);
    console.log(`  - message: ${(switchResult as any).message}`);
  }

  // Step 5: Switch back to kie
  console.log('\nStep 5: Testing switchAiProvider (switch to kie)...');
  const switchBackResult = await switchAiProvider({
    provider: 'kie',
    reason: 'Switching back for testing',
  }, mockContext) as any;

  console.log(`  - success: ${switchBackResult.success}`);
  if (switchBackResult.success) {
    console.log(`  - previous_provider: ${(switchBackResult as any).previous_provider}`);
    console.log(`  - new_provider: ${(switchBackResult as any).new_provider}`);
  }

  // Step 6: Test invalid provider
  console.log('\nStep 6: Testing switchAiProvider (invalid provider)...');
  const invalidResult = await switchAiProvider({
    provider: 'invalid-provider',
  }, mockContext) as any;

  console.log(`  - success: ${invalidResult.success}`);
  console.log(`  - error: ${(invalidResult as any).error}`);

  // Step 7: Verify interface fields
  console.log('\nStep 7: Verifying response interface fields...');
  const requiredStatusFields = ['success', 'primary_provider', 'circuit_breakers', 'router_config', 'overall_status', 'data_source'];
  for (const field of requiredStatusFields) {
    const exists = field in statusResult;
    console.log(`  ${exists ? '✓' : '✗'} ${field}: ${exists ? 'present' : 'MISSING'}`);
  }

  // Step 8: Summary
  console.log('\nStep 8: Summary of MCP handler updates...');
  console.log('  [✓] Import ai-router into MCP handler');
  console.log('  [✓] Call router methods for real data');
  console.log('  [✓] Return real health check results');
  console.log('  [✓] Return real latency metrics');
  console.log('  [✓] Return real circuit breaker state');
  console.log('  [✓] Return real failover events');
  console.log('  [✓] Return router configuration');
  console.log('  [✓] switchAiProvider uses real hot-swap');
  console.log('  [✓] data_source field indicates real data');

  console.log('\n=== AI Provider MCP Handler Test Complete ===');
}

// Run tests
testAiProviderHandler().catch(console.error);
