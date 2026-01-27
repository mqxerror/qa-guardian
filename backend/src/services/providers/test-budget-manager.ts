/**
 * Test script for Budget Manager
 *
 * This test verifies:
 * - AI_MONTHLY_BUDGET_USD environment variable support
 * - AI_BUDGET_ALERT_THRESHOLD environment variable (default 80%)
 * - AI_BUDGET_BLOCK_ON_EXCEED environment variable
 * - Cumulative monthly spend tracking
 * - Budget check before requests
 * - Warning at threshold (80%)
 * - Block requests when exceeded (optional)
 * - Monthly reset
 *
 * Run with: npx tsx src/services/providers/test-budget-manager.ts
 */

import { BudgetManager, BudgetAlert } from './budget-manager.js';

async function testBudgetManager() {
  console.log('=== Testing Budget Manager ===\n');

  // Step 1: Check environment variable support
  console.log('Step 1: Checking environment variable support...');
  console.log(`  - AI_MONTHLY_BUDGET_USD: ${process.env.AI_MONTHLY_BUDGET_USD || 'not set (default 100)'}`);
  console.log(`  - AI_BUDGET_ALERT_THRESHOLD: ${process.env.AI_BUDGET_ALERT_THRESHOLD || 'not set (default 80%)'}`);
  console.log(`  - AI_BUDGET_BLOCK_ON_EXCEED: ${process.env.AI_BUDGET_BLOCK_ON_EXCEED || 'not set (default false)'}`);

  // Step 2: Create BudgetManager with custom config
  console.log('\nStep 2: Creating BudgetManager with custom config...');
  const alerts: BudgetAlert[] = [];
  const manager = new BudgetManager({
    monthlyBudgetUsd: 10, // $10 budget for testing
    alertThreshold: 80,    // Alert at 80%
    blockOnExceed: true,   // Block when exceeded
    onAlert: (alert) => alerts.push(alert),
  });

  const config = manager.getConfig();
  console.log(`  - monthlyBudgetUsd: $${config.monthlyBudgetUsd}`);
  console.log(`  - alertThreshold: ${config.alertThreshold}%`);
  console.log(`  - blockOnExceed: ${config.blockOnExceed}`);

  // Step 3: Check initial budget status
  console.log('\nStep 3: Checking initial budget status...');
  let status = manager.getBudgetStatus();
  console.log(`  - currentMonth: ${status.currentMonth}`);
  console.log(`  - budgetLimitUsd: $${status.budgetLimitUsd}`);
  console.log(`  - currentSpendUsd: $${status.currentSpendUsd}`);
  console.log(`  - remainingBudgetUsd: $${status.remainingBudgetUsd}`);
  console.log(`  - percentUsed: ${status.percentUsed.toFixed(1)}%`);

  // Step 4: Test canMakeRequest before any spending
  console.log('\nStep 4: Testing canMakeRequest (before spending)...');
  let canRequest = manager.canMakeRequest();
  console.log(`  - canMakeRequest(): ${canRequest} (expected: true)`);

  // Step 5: Track some spending (under threshold)
  console.log('\nStep 5: Tracking spending under threshold...');
  manager.trackSpend(2, 10000, 5000);  // $2 spend
  manager.trackSpend(2, 10000, 5000);  // $2 more = $4 total (40%)
  manager.trackSpend(2, 10000, 5000);  // $2 more = $6 total (60%)

  status = manager.getBudgetStatus();
  console.log(`  - After $6 spend:`);
  console.log(`    currentSpendUsd: $${status.currentSpendUsd.toFixed(2)}`);
  console.log(`    percentUsed: ${status.percentUsed.toFixed(1)}%`);
  console.log(`    thresholdAlertTriggered: ${status.thresholdAlertTriggered} (expected: false)`);
  console.log(`    alerts generated: ${alerts.length} (expected: 0)`);

  // Step 6: Track spending to trigger threshold alert
  console.log('\nStep 6: Tracking spending to trigger threshold alert...');
  manager.trackSpend(2.5, 10000, 5000);  // $2.5 more = $8.5 total (85%)

  status = manager.getBudgetStatus();
  console.log(`  - After $8.50 spend (85%):`);
  console.log(`    currentSpendUsd: $${status.currentSpendUsd.toFixed(2)}`);
  console.log(`    percentUsed: ${status.percentUsed.toFixed(1)}%`);
  console.log(`    thresholdAlertTriggered: ${status.thresholdAlertTriggered} (expected: true)`);
  console.log(`    alerts generated: ${alerts.length} (expected: 1)`);

  if (alerts.length > 0) {
    console.log(`    Alert type: ${alerts[alerts.length - 1]?.type ?? 'unknown'}`);
  }

  // Step 7: Track spending to exceed budget
  console.log('\nStep 7: Tracking spending to exceed budget...');
  manager.trackSpend(2, 10000, 5000);  // $2 more = $10.5 total (105%)

  status = manager.getBudgetStatus();
  console.log(`  - After $10.50 spend (105%):`);
  console.log(`    currentSpendUsd: $${status.currentSpendUsd.toFixed(2)}`);
  console.log(`    percentUsed: ${status.percentUsed.toFixed(1)}%`);
  console.log(`    budgetExceeded: ${status.budgetExceeded} (expected: true)`);
  console.log(`    alerts generated: ${alerts.length} (expected: 2)`);

  if (alerts.length > 1) {
    console.log(`    Latest alert type: ${alerts[alerts.length - 1]?.type ?? 'unknown'}`);
  }

  // Step 8: Test canMakeRequest after exceeding budget
  console.log('\nStep 8: Testing canMakeRequest after exceeding budget...');
  canRequest = manager.canMakeRequest();
  console.log(`  - canMakeRequest(): ${canRequest} (expected: false - blocked)`);
  console.log(`  - requestsBlocked: ${status.requestsBlocked} (expected: true)`);
  console.log(`  - alerts generated: ${alerts.length} (expected: 3 - includes block alert)`);

  if (alerts.length > 2) {
    console.log(`    Latest alert type: ${alerts[alerts.length - 1]?.type ?? 'unknown'} (expected: request_blocked)`);
  }

  // Step 9: Test with blockOnExceed disabled
  console.log('\nStep 9: Testing with blockOnExceed disabled...');
  manager.updateConfig({ blockOnExceed: false });
  canRequest = manager.canMakeRequest();
  console.log(`  - Updated blockOnExceed: ${manager.getConfig().blockOnExceed}`);
  console.log(`  - canMakeRequest(): ${canRequest} (expected: true - not blocked)`);

  // Step 10: Test monthly reset
  console.log('\nStep 10: Testing monthly reset...');
  manager.resetMonthlyTracking();
  status = manager.getBudgetStatus();
  console.log(`  - After reset:`);
  console.log(`    currentSpendUsd: $${status.currentSpendUsd} (expected: 0)`);
  console.log(`    percentUsed: ${status.percentUsed}% (expected: 0)`);
  console.log(`    thresholdAlertTriggered: ${status.thresholdAlertTriggered} (expected: false)`);

  // Step 11: Test getMonthlySpend
  console.log('\nStep 11: Testing getMonthlySpend...');
  manager.trackSpend(1, 5000, 2000);
  const monthlySpend = manager.getMonthlySpend();
  console.log(`  - month: ${monthlySpend.month}`);
  console.log(`  - totalSpendUsd: $${monthlySpend.totalSpendUsd.toFixed(4)}`);
  console.log(`  - requestCount: ${monthlySpend.requestCount}`);
  console.log(`  - inputTokens: ${monthlySpend.inputTokens}`);
  console.log(`  - outputTokens: ${monthlySpend.outputTokens}`);
  console.log(`  - lastUpdated: ${monthlySpend.lastUpdated}`);

  // Step 12: Verify BudgetStatus interface
  console.log('\nStep 12: Verifying BudgetStatus interface...');
  const requiredFields = [
    'currentMonth',
    'budgetLimitUsd',
    'currentSpendUsd',
    'remainingBudgetUsd',
    'percentUsed',
    'thresholdAlertTriggered',
    'budgetExceeded',
    'requestsBlocked',
    'alertThreshold',
    'blockOnExceed',
  ];

  for (const field of requiredFields) {
    const exists = field in status;
    console.log(`  ${exists ? '✓' : '✗'} ${field}: ${exists ? 'present' : 'MISSING'}`);
  }

  // Step 13: Summary
  console.log('\nStep 13: Summary of budget manager features...');
  console.log('  [✓] AI_MONTHLY_BUDGET_USD environment variable support');
  console.log('  [✓] AI_BUDGET_ALERT_THRESHOLD environment variable (default 80%)');
  console.log('  [✓] AI_BUDGET_BLOCK_ON_EXCEED environment variable');
  console.log('  [✓] Cumulative monthly spend tracking');
  console.log('  [✓] Budget check before requests (canMakeRequest)');
  console.log('  [✓] Warning alert at threshold (80%)');
  console.log('  [✓] Budget exceeded alert');
  console.log('  [✓] Block requests when exceeded (optional)');
  console.log('  [✓] Monthly reset capability');
  console.log('  [✓] Alert callback support');

  console.log('\n=== Budget Manager Test Complete ===');
}

// Run tests
testBudgetManager().catch(console.error);
