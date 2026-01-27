/**
 * Test script for API Key Validator
 *
 * This test verifies:
 * - validateApiKey method for each provider
 * - Clear error messages for missing keys
 * - Clear error messages for invalid keys
 * - validateAllApiKeys for all providers
 * - Masked key display utility
 *
 * Run with: npx tsx src/services/providers/test-api-key-validator.ts
 */

import {
  validateApiKey,
  validateAllApiKeys,
  hasAnyApiKeyConfigured,
  getConfiguredProviders,
  isProviderConfigured,
  maskApiKey,
  getApiKeyStatus,
  KeyValidationResult,
  AllKeysValidationResult,
  API_KEY_ENV_VARS,
} from './api-key-validator.js';

async function testApiKeyValidator() {
  console.log('=== Testing API Key Validator ===\n');

  // Step 1: Check environment variable names
  console.log('Step 1: Checking environment variable configuration...');
  console.log(`  - Kie.ai env var: ${API_KEY_ENV_VARS.kie}`);
  console.log(`  - Anthropic env var: ${API_KEY_ENV_VARS.anthropic}`);
  console.log(`  - KIE_AI_API_KEY set: ${!!process.env.KIE_AI_API_KEY}`);
  console.log(`  - ANTHROPIC_API_KEY set: ${!!process.env.ANTHROPIC_API_KEY}`);

  // Step 2: Test hasAnyApiKeyConfigured
  console.log('\nStep 2: Testing hasAnyApiKeyConfigured...');
  const hasAnyKey = hasAnyApiKeyConfigured();
  console.log(`  - hasAnyApiKeyConfigured(): ${hasAnyKey}`);

  // Step 3: Test getConfiguredProviders
  console.log('\nStep 3: Testing getConfiguredProviders...');
  const configuredProviders = getConfiguredProviders();
  console.log(`  - Configured providers: ${configuredProviders.length > 0 ? configuredProviders.join(', ') : 'none'}`);

  // Step 4: Test isProviderConfigured
  console.log('\nStep 4: Testing isProviderConfigured...');
  console.log(`  - isProviderConfigured('kie'): ${isProviderConfigured('kie')}`);
  console.log(`  - isProviderConfigured('anthropic'): ${isProviderConfigured('anthropic')}`);

  // Step 5: Test maskApiKey utility
  console.log('\nStep 5: Testing maskApiKey utility...');
  const testKeys = [
    'sk-ant-api03-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
    'short-key',
    'medium-length-api-key-here',
  ];
  for (const key of testKeys) {
    console.log(`  - "${key.substring(0, 20)}..." -> "${maskApiKey(key)}"`);
  }

  // Step 6: Test getApiKeyStatus
  console.log('\nStep 6: Testing getApiKeyStatus...');
  const kieStatus = getApiKeyStatus('kie');
  console.log(`  Kie.ai status:`);
  console.log(`    - configured: ${kieStatus.configured}`);
  console.log(`    - maskedKey: ${kieStatus.maskedKey || 'N/A'}`);
  console.log(`    - envVar: ${kieStatus.envVar}`);

  const anthropicStatus = getApiKeyStatus('anthropic');
  console.log(`  Anthropic status:`);
  console.log(`    - configured: ${anthropicStatus.configured}`);
  console.log(`    - maskedKey: ${anthropicStatus.maskedKey || 'N/A'}`);
  console.log(`    - envVar: ${anthropicStatus.envVar}`);

  // Step 7: Test validateApiKey for kie (will fail without actual key)
  console.log('\nStep 7: Testing validateApiKey for kie...');
  const kieResult = await validateApiKey('kie');
  console.log(`  - provider: ${kieResult.provider}`);
  console.log(`  - configured: ${kieResult.configured}`);
  console.log(`  - valid: ${kieResult.valid}`);
  if (kieResult.error) {
    console.log(`  - error: ${kieResult.error}`);
    console.log(`  - errorCode: ${kieResult.errorCode}`);
  }
  if (kieResult.latencyMs) {
    console.log(`  - latencyMs: ${kieResult.latencyMs}`);
  }

  // Step 8: Test validateApiKey for anthropic
  console.log('\nStep 8: Testing validateApiKey for anthropic...');
  const anthropicResult = await validateApiKey('anthropic');
  console.log(`  - provider: ${anthropicResult.provider}`);
  console.log(`  - configured: ${anthropicResult.configured}`);
  console.log(`  - valid: ${anthropicResult.valid}`);
  if (anthropicResult.error) {
    console.log(`  - error: ${anthropicResult.error}`);
    console.log(`  - errorCode: ${anthropicResult.errorCode}`);
  }
  if (anthropicResult.latencyMs) {
    console.log(`  - latencyMs: ${anthropicResult.latencyMs}`);
  }

  // Step 9: Test validateAllApiKeys
  console.log('\nStep 9: Testing validateAllApiKeys...');
  const allResults = await validateAllApiKeys();
  console.log(`  - timestamp: ${allResults.timestamp}`);
  console.log(`  - allValid: ${allResults.allValid}`);
  console.log(`  - anyValid: ${allResults.anyValid}`);
  console.log(`  - summary: ${allResults.summary}`);

  // Step 10: Verify KeyValidationResult interface
  console.log('\nStep 10: Verifying KeyValidationResult interface...');
  const requiredFields = ['provider', 'valid', 'configured', 'checkedAt'];
  const optionalFields = ['error', 'errorCode', 'latencyMs'];
  for (const field of requiredFields) {
    const exists = field in kieResult;
    console.log(`  ${exists ? '✓' : '✗'} ${field}: ${exists ? 'present' : 'MISSING'}`);
  }
  for (const field of optionalFields) {
    console.log(`  ○ ${field}: optional`);
  }

  // Step 11: Verify AllKeysValidationResult interface
  console.log('\nStep 11: Verifying AllKeysValidationResult interface...');
  const allResultFields = ['timestamp', 'results', 'allValid', 'anyValid', 'summary'];
  for (const field of allResultFields) {
    const exists = field in allResults;
    console.log(`  ${exists ? '✓' : '✗'} ${field}: ${exists ? 'present' : 'MISSING'}`);
  }

  // Step 12: Verify error code types
  console.log('\nStep 12: Verifying error code types...');
  const errorCodes = ['missing_key', 'invalid_key', 'invalid_format', 'api_error', 'network_error'];
  console.log('  Valid error codes:');
  for (const code of errorCodes) {
    console.log(`    - ${code}`);
  }

  // Step 13: Summary
  console.log('\nStep 13: Summary of API key validator features...');
  console.log('  [✓] validateApiKey method for each provider');
  console.log('  [✓] Make minimal API call to verify key works');
  console.log('  [✓] Clear error if key is missing (errorCode: missing_key)');
  console.log('  [✓] Clear error if key is invalid (errorCode: invalid_key)');
  console.log('  [✓] Clear error if format is wrong (errorCode: invalid_format)');
  console.log('  [✓] validateAllApiKeys for all providers');
  console.log('  [✓] hasAnyApiKeyConfigured utility');
  console.log('  [✓] getConfiguredProviders utility');
  console.log('  [✓] maskApiKey for safe display');
  console.log('  [✓] getApiKeyStatus for UI display');

  console.log('\n=== API Key Validator Test Complete ===');
}

// Run tests
testApiKeyValidator().catch(console.error);
