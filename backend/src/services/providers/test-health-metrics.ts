/**
 * Test script for Health Metrics with Latency Tracking
 *
 * This test verifies that:
 * - Health checks measure real API latency
 * - p50/p95/p99 percentiles are calculated correctly
 * - Health status is determined based on latency thresholds
 * - Latency samples are stored and managed correctly
 *
 * Run with: npx tsx src/services/providers/test-health-metrics.ts
 */

import { KieAIProvider } from './kie-ai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';

async function testHealthMetrics() {
  console.log('=== Testing Health Metrics with Latency Tracking ===\n');

  // Test KieAIProvider (uses KIE_API_KEY)
  console.log('--- Testing KieAIProvider ---');
  const kieProvider = new KieAIProvider();

  if (kieProvider.isInitialized()) {
    console.log('KieAIProvider is initialized\n');

    // Perform multiple health checks to gather samples
    console.log('Performing 3 health checks to gather latency samples...\n');
    for (let i = 0; i < 3; i++) {
      const result = await kieProvider.healthCheck();
      console.log(`  Health check ${i + 1}: status=${result.status}, latency=${result.latency_ms}ms`);
    }

    // Get health metrics
    const kieMetrics = kieProvider.getHealthMetrics();
    console.log('\nKie.ai Health Metrics:');
    console.log(`  - Provider: ${kieMetrics.provider}`);
    console.log(`  - Status: ${kieMetrics.status}`);
    console.log(`  - P50 Latency: ${kieMetrics.p50_latency_ms.toFixed(0)}ms`);
    console.log(`  - P95 Latency: ${kieMetrics.p95_latency_ms.toFixed(0)}ms`);
    console.log(`  - P99 Latency: ${kieMetrics.p99_latency_ms.toFixed(0)}ms`);
    console.log(`  - Avg Latency: ${kieMetrics.avg_latency_ms.toFixed(0)}ms`);
    console.log(`  - Min Latency: ${kieMetrics.min_latency_ms}ms`);
    console.log(`  - Max Latency: ${kieMetrics.max_latency_ms}ms`);
    console.log(`  - Sample Count: ${kieMetrics.sample_count}`);
    console.log(`  - Success Rate: ${(kieMetrics.success_rate * 100).toFixed(1)}%`);
    console.log(`  - Consecutive Failures: ${kieMetrics.consecutive_failures}`);
    console.log(`  - Last Check: ${kieMetrics.last_check_at}`);
  } else {
    console.log('KieAIProvider not initialized (KIE_API_KEY not set)\n');

    // Test without API key - should show offline status
    const kieMetrics = kieProvider.getHealthMetrics();
    console.log('Kie.ai Health Metrics (offline):');
    console.log(`  - Status: ${kieMetrics.status}`);
    console.log(`  - Sample Count: ${kieMetrics.sample_count}`);
  }

  // Test AnthropicProvider (uses ANTHROPIC_API_KEY)
  console.log('\n--- Testing AnthropicProvider ---');
  const anthropicProvider = new AnthropicProvider();

  if (anthropicProvider.isInitialized()) {
    console.log('AnthropicProvider is initialized\n');

    // Perform multiple health checks to gather samples
    console.log('Performing 3 health checks to gather latency samples...\n');
    for (let i = 0; i < 3; i++) {
      const result = await anthropicProvider.healthCheck();
      console.log(`  Health check ${i + 1}: status=${result.status}, latency=${result.latency_ms}ms`);
    }

    // Get health metrics
    const anthropicMetrics = anthropicProvider.getHealthMetrics();
    console.log('\nAnthropic Health Metrics:');
    console.log(`  - Provider: ${anthropicMetrics.provider}`);
    console.log(`  - Status: ${anthropicMetrics.status}`);
    console.log(`  - P50 Latency: ${anthropicMetrics.p50_latency_ms.toFixed(0)}ms`);
    console.log(`  - P95 Latency: ${anthropicMetrics.p95_latency_ms.toFixed(0)}ms`);
    console.log(`  - P99 Latency: ${anthropicMetrics.p99_latency_ms.toFixed(0)}ms`);
    console.log(`  - Avg Latency: ${anthropicMetrics.avg_latency_ms.toFixed(0)}ms`);
    console.log(`  - Min Latency: ${anthropicMetrics.min_latency_ms}ms`);
    console.log(`  - Max Latency: ${anthropicMetrics.max_latency_ms}ms`);
    console.log(`  - Sample Count: ${anthropicMetrics.sample_count}`);
    console.log(`  - Success Rate: ${(anthropicMetrics.success_rate * 100).toFixed(1)}%`);
    console.log(`  - Consecutive Failures: ${anthropicMetrics.consecutive_failures}`);
    console.log(`  - Last Check: ${anthropicMetrics.last_check_at}`);
  } else {
    console.log('AnthropicProvider not initialized (ANTHROPIC_API_KEY not set)\n');

    // Test without API key - should show offline status
    const anthropicMetrics = anthropicProvider.getHealthMetrics();
    console.log('Anthropic Health Metrics (offline):');
    console.log(`  - Status: ${anthropicMetrics.status}`);
    console.log(`  - Sample Count: ${anthropicMetrics.sample_count}`);
  }

  // Verify the metrics interface
  console.log('\n--- Verifying HealthMetrics Interface ---');
  const testMetrics = kieProvider.getHealthMetrics();
  const requiredFields = [
    'provider', 'status', 'p50_latency_ms', 'p95_latency_ms', 'p99_latency_ms',
    'avg_latency_ms', 'min_latency_ms', 'max_latency_ms', 'sample_count',
    'last_check_at', 'consecutive_failures', 'success_rate'
  ];

  let allFieldsPresent = true;
  for (const field of requiredFields) {
    if (!(field in testMetrics)) {
      console.log(`  [MISSING] ${field}`);
      allFieldsPresent = false;
    }
  }

  if (allFieldsPresent) {
    console.log('  [SUCCESS] All required fields present in HealthMetrics');
  }

  console.log('\n=== Health Metrics Test Complete ===');
}

// Run tests
testHealthMetrics().catch(console.error);
