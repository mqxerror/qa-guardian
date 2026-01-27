/**
 * Test script for Circuit Breaker Pattern
 *
 * This test verifies:
 * - Circuit breaker states: closed, open, half-open
 * - Failure tracking and threshold triggering
 * - Half-open state allowing test requests
 * - Auto-close after successful test request
 * - Status reporting for health checks
 *
 * Run with: npx tsx src/services/providers/test-circuit-breaker.ts
 */

import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
  CircuitBreakerEvent,
} from './circuit-breaker.js';

async function testCircuitBreaker() {
  console.log('=== Testing Circuit Breaker Pattern ===\n');

  // Step 1: Create circuit breaker
  console.log('Step 1: Creating CircuitBreaker...');
  const breaker = new CircuitBreaker('test-provider', {
    failureThreshold: 3,
    resetTimeoutMs: 2000,  // 2 seconds for testing
    successThreshold: 1,
    enabled: true,
  });

  // Track state changes
  const events: CircuitBreakerEvent[] = [];
  breaker.setStateChangeCallback((event) => {
    events.push(event);
  });

  console.log(`  - Initial state: ${breaker.getState()}`);
  console.log(`  - Config: failureThreshold=${breaker.getConfig().failureThreshold}, resetTimeoutMs=${breaker.getConfig().resetTimeoutMs}`);

  // Step 2: Test closed state - requests allowed
  console.log('\nStep 2: Testing CLOSED state...');
  console.log(`  - Can request: ${breaker.canRequest()}`);
  breaker.recordSuccess();
  console.log(`  - After success: state=${breaker.getState()}, failures=${breaker.getStatus().failures}`);

  // Step 3: Simulate failures to open circuit
  console.log('\nStep 3: Simulating failures to open circuit...');
  for (let i = 1; i <= 3; i++) {
    breaker.recordFailure(new Error(`Test failure ${i}`));
    console.log(`  - After failure ${i}: state=${breaker.getState()}, failures=${breaker.getStatus().failures}`);
  }

  // Step 4: Verify open state - requests blocked
  console.log('\nStep 4: Testing OPEN state...');
  console.log(`  - Current state: ${breaker.getState()}`);
  console.log(`  - Can request: ${breaker.canRequest()}`);
  console.log(`  - Blocked requests: ${breaker.getStatus().blockedRequests}`);

  // Try again
  console.log(`  - Can request (again): ${breaker.canRequest()}`);
  console.log(`  - Blocked requests: ${breaker.getStatus().blockedRequests}`);

  // Step 5: Wait for reset timeout and test half-open
  console.log('\nStep 5: Waiting for reset timeout (2 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 2100));

  console.log(`  - State after timeout: ${breaker.getState()}`);
  console.log(`  - Can request in half-open: ${breaker.canRequest()}`);

  // Step 6: Simulate successful test request
  console.log('\nStep 6: Simulating successful test request in HALF_OPEN state...');
  breaker.recordSuccess();
  console.log(`  - State after success: ${breaker.getState()}`);
  console.log(`  - Successes: ${breaker.getStatus().successes}`);
  console.log(`  - Failures: ${breaker.getStatus().failures}`);

  // Step 7: Test execute wrapper
  console.log('\nStep 7: Testing execute() wrapper...');

  // Create a fresh breaker for execute test
  const execBreaker = new CircuitBreaker('exec-test', {
    failureThreshold: 2,
    resetTimeoutMs: 1000,
  });

  try {
    const result = await execBreaker.execute(async () => 'success');
    console.log(`  - Execute result: ${result}`);
    console.log(`  - State: ${execBreaker.getState()}`);
  } catch (error) {
    console.log(`  - Error: ${error}`);
  }

  // Cause failures to open circuit
  console.log('\n  - Causing failures...');
  for (let i = 0; i < 2; i++) {
    try {
      await execBreaker.execute(async () => {
        throw new Error('Simulated failure');
      });
    } catch {
      // Expected
    }
  }
  console.log(`  - State after failures: ${execBreaker.getState()}`);

  // Try to execute when open
  try {
    await execBreaker.execute(async () => 'should not run');
    console.log('  - [UNEXPECTED] Execute succeeded when circuit is open');
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      console.log(`  - [EXPECTED] CircuitBreakerOpenError: ${error.message.substring(0, 60)}...`);
      console.log(`  - Provider: ${error.provider}`);
      console.log(`  - Next retry at: ${error.nextRetryAt || 'N/A'}`);
    } else {
      console.log(`  - [UNEXPECTED ERROR] ${error}`);
    }
  }

  // Step 8: Test status for health checks
  console.log('\nStep 8: Testing status for health checks...');
  const status = breaker.getStatus();
  console.log('  Circuit Breaker Status:');
  console.log(`    - state: ${status.state}`);
  console.log(`    - failures: ${status.failures}`);
  console.log(`    - successes: ${status.successes}`);
  console.log(`    - enabled: ${status.enabled}`);
  console.log(`    - blockedRequests: ${status.blockedRequests}`);
  console.log(`    - stateTransitions: ${status.stateTransitions}`);
  if (status.lastFailureAt) {
    console.log(`    - lastFailureAt: ${status.lastFailureAt}`);
  }

  // Step 9: Test registry
  console.log('\nStep 9: Testing CircuitBreakerRegistry...');
  const registry = new CircuitBreakerRegistry({
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  });

  const breaker1 = registry.getBreaker('provider-a');
  const breaker2 = registry.getBreaker('provider-b');

  breaker1.recordFailure(new Error('Test'));
  breaker2.recordSuccess();

  const allStatus = registry.getAllStatus();
  console.log('  Registry status:');
  for (const [name, status] of Object.entries(allStatus)) {
    console.log(`    - ${name}: state=${status.state}, failures=${status.failures}`);
  }

  // Step 10: Test singleton registry
  console.log('\nStep 10: Testing singleton registry...');
  const singletonBreaker = circuitBreakerRegistry.getBreaker('singleton-test');
  console.log(`  - Got breaker for 'singleton-test': ${singletonBreaker.getState()}`);

  // Step 11: Verify state change events
  console.log('\nStep 11: Verifying state change events...');
  console.log(`  - Total events captured: ${events.length}`);
  for (const event of events) {
    console.log(`    - ${event.previousState} -> ${event.newState}: ${event.reason.substring(0, 50)}`);
  }

  // Step 12: Test force state and reset
  console.log('\nStep 12: Testing forceState and reset...');
  const forceBreaker = new CircuitBreaker('force-test');

  forceBreaker.forceState('open', 'Manual test');
  console.log(`  - After forceState('open'): ${forceBreaker.getState()}`);

  forceBreaker.reset();
  console.log(`  - After reset(): state=${forceBreaker.getState()}, failures=${forceBreaker.getStatus().failures}`);

  console.log('\n=== Circuit Breaker Test Complete ===');
}

// Run tests
testCircuitBreaker().catch(console.error);
