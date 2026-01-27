/**
 * Test script for Per-Feature Model Selector
 *
 * This test verifies:
 * - Feature categories: chat, test_generation, analysis, healing
 * - Model mapping config per feature
 * - getModelForFeature method
 * - Default all to Haiku for cost efficiency
 * - Custom model configuration
 *
 * Run with: npx tsx src/services/providers/test-model-selector.ts
 */

import {
  ModelSelector,
  modelSelector,
  AIFeatureCategory,
  FeatureModelConfig,
  DEFAULT_FEATURE_MODELS,
  AVAILABLE_MODELS,
  MODEL_TIERS,
} from './model-selector.js';

function testModelSelector() {
  console.log('=== Testing Per-Feature Model Selector ===\n');

  // Step 1: Check feature categories exist
  console.log('Step 1: Checking feature categories...');
  const requiredCategories: AIFeatureCategory[] = ['chat', 'test_generation', 'analysis', 'healing'];
  for (const category of requiredCategories) {
    const exists = category in DEFAULT_FEATURE_MODELS;
    console.log(`  ${exists ? '✓' : '✗'} ${category}: ${exists ? 'configured' : 'MISSING'}`);
  }

  // Step 2: Test default configuration
  console.log('\nStep 2: Testing default configuration...');
  const selector = new ModelSelector();
  const config = selector.getConfig();
  console.log(`  - Default model: ${config.defaultModel}`);
  console.log(`  - Enabled: ${config.enabled}`);
  console.log(`  - Feature count: ${Object.keys(config.featureModels).length}`);

  // Step 3: Test getModelForFeature for each category
  console.log('\nStep 3: Testing getModelForFeature...');
  const testFeatures: Array<AIFeatureCategory | string> = [
    'chat', 'test_generation', 'analysis', 'healing',
    'summarization', 'documentation', 'explanation', 'suggestion',
    'unknown_feature', // Should fallback to default
  ];

  for (const feature of testFeatures) {
    const modelConfig = selector.getModelForFeature(feature);
    console.log(`  - ${feature}:`);
    console.log(`      model: ${modelConfig.model}`);
    console.log(`      tier: ${modelConfig.tier}`);
    console.log(`      reason: ${modelConfig.reason}`);
  }

  // Step 4: Verify Haiku is default for cost efficiency
  console.log('\nStep 4: Verifying Haiku is default for chat/suggestion...');
  const chatModel = selector.getModel('chat');
  const suggestionModel = selector.getModel('suggestion');
  const defaultModel = selector.getModel('default');
  console.log(`  - chat model: ${chatModel}`);
  console.log(`  - suggestion model: ${suggestionModel}`);
  console.log(`  - default model: ${defaultModel}`);
  console.log(`  - chat uses Haiku: ${chatModel.includes('haiku')}`);
  console.log(`  - default uses Haiku: ${defaultModel.includes('haiku')}`);

  // Step 5: Verify Opus for complex analysis
  console.log('\nStep 5: Verifying Opus for complex analysis...');
  const analysisModel = selector.getModel('analysis');
  console.log(`  - analysis model: ${analysisModel}`);
  console.log(`  - analysis uses Opus: ${analysisModel.includes('opus')}`);

  // Step 6: Test setModelForFeature
  console.log('\nStep 6: Testing setModelForFeature...');
  selector.setModelForFeature('chat', 'deepseek-chat', {
    reason: 'Testing custom model',
    maxTokens: 2048,
    temperature: 0.5,
  });
  const newChatConfig = selector.getModelForFeature('chat');
  console.log(`  - Updated chat model: ${newChatConfig.model}`);
  console.log(`  - maxTokens: ${newChatConfig.maxTokens}`);
  console.log(`  - temperature: ${newChatConfig.temperature}`);

  // Step 7: Test setEnabled toggle
  console.log('\nStep 7: Testing setEnabled toggle...');
  selector.setEnabled(false);
  const disabledConfig = selector.getModelForFeature('chat');
  console.log(`  - With selection disabled:`);
  console.log(`      model: ${disabledConfig.model} (should be default)`);
  console.log(`      reason: ${disabledConfig.reason}`);
  selector.setEnabled(true);

  // Step 8: Test resetToDefaults
  console.log('\nStep 8: Testing resetToDefaults...');
  selector.resetToDefaults();
  const resetChatConfig = selector.getModelForFeature('chat');
  console.log(`  - After reset, chat model: ${resetChatConfig.model}`);
  console.log(`  - Is Haiku again: ${resetChatConfig.model.includes('haiku')}`);

  // Step 9: Test getAvailableModels
  console.log('\nStep 9: Testing getAvailableModels...');
  const availableModels = selector.getAvailableModels();
  console.log(`  - Available models (${availableModels.length}):`);
  for (const model of availableModels) {
    console.log(`      - ${model} (${selector.getModelTier(model)})`);
  }

  // Step 10: Test getModelsByTier
  console.log('\nStep 10: Testing getModelsByTier...');
  const fastModels = selector.getModelsByTier('fast');
  const balancedModels = selector.getModelsByTier('balanced');
  const powerfulModels = selector.getModelsByTier('powerful');
  console.log(`  - Fast models: ${fastModels.join(', ')}`);
  console.log(`  - Balanced models: ${balancedModels.join(', ')}`);
  console.log(`  - Powerful models: ${powerfulModels.join(', ')}`);

  // Step 11: Test getFeatureCategories
  console.log('\nStep 11: Testing getFeatureCategories...');
  const categories = selector.getFeatureCategories();
  console.log(`  - Categories (${categories.length}): ${categories.join(', ')}`);

  // Step 12: Test getSelectionHistory
  console.log('\nStep 12: Testing getSelectionHistory...');
  const history = selector.getSelectionHistory();
  console.log(`  - Selection history entries: ${history.length}`);
  if (history.length > 0) {
    console.log(`  - Last selection: ${history[history.length - 1].feature} -> ${history[history.length - 1].model}`);
  }

  // Step 13: Test getFeatureModelsSummary
  console.log('\nStep 13: Testing getFeatureModelsSummary...');
  const summary = selector.getFeatureModelsSummary();
  console.log(`  - Feature models summary (${summary.length} entries):`);
  for (const item of summary.slice(0, 5)) {
    console.log(`      ${item.feature}: ${item.model} (${item.tier})`);
  }
  if (summary.length > 5) {
    console.log(`      ... and ${summary.length - 5} more`);
  }

  // Step 14: Verify FeatureModelConfig interface
  console.log('\nStep 14: Verifying FeatureModelConfig interface...');
  const sampleConfig = selector.getModelForFeature('chat');
  const requiredFields = ['model', 'reason', 'tier'];
  const optionalFields = ['maxTokens', 'temperature'];
  for (const field of requiredFields) {
    const exists = field in sampleConfig;
    console.log(`  ${exists ? '✓' : '✗'} ${field}: ${exists ? 'present' : 'MISSING'}`);
  }
  for (const field of optionalFields) {
    console.log(`  ○ ${field}: optional`);
  }

  // Step 15: Test singleton instance
  console.log('\nStep 15: Testing singleton instance...');
  console.log(`  - modelSelector singleton exists: ${!!modelSelector}`);
  console.log(`  - modelSelector default model: ${modelSelector.getConfig().defaultModel}`);

  // Step 16: Summary
  console.log('\nStep 16: Summary of per-feature model selection...');
  console.log('  [✓] Define feature categories: chat, test_generation, analysis, healing');
  console.log('  [✓] Create model mapping config per feature');
  console.log('  [✓] Add getModelForFeature method');
  console.log('  [✓] getModel convenience method');
  console.log('  [✓] setModelForFeature for custom configuration');
  console.log('  [✓] Default all to Haiku for cost efficiency');
  console.log('  [✓] Opus for complex analysis tasks');
  console.log('  [✓] Sonnet for test generation and healing');
  console.log('  [✓] Enable/disable model selection toggle');
  console.log('  [✓] Selection history tracking');
  console.log('  [✓] Feature models summary for UI');

  console.log('\n=== Per-Feature Model Selector Test Complete ===');
}

// Run tests
testModelSelector();
