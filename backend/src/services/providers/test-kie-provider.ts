/**
 * Test script for KieAIProvider
 *
 * Run with: KIE_API_KEY=your-key npx tsx src/services/providers/test-kie-provider.ts
 */

import { KieAIProvider } from './kie-ai-provider.js';

async function test() {
  console.log('=== Testing KieAIProvider ===\n');

  const provider = new KieAIProvider();
  console.log('Initialized:', provider.isInitialized());
  console.log('Config:', provider.getConfig());

  if (!provider.isInitialized()) {
    console.error('ERROR: Provider not initialized. Set KIE_API_KEY.');
    process.exit(1);
  }

  // Test real API call
  console.log('\nTesting sendMessage...');
  try {
    const response = await provider.sendMessage(
      [{ role: 'user', content: 'What is 2+2? Answer in one word.' }],
      { model: 'deepseek-chat', maxTokens: 20 }
    );
    console.log('Response:', response);
    console.log('  - Content:', response.content);
    console.log('  - Provider:', response.provider);
    console.log('  - Model:', response.model);
  } catch (error) {
    console.error('sendMessage error:', error);
    process.exit(1);
  }

  console.log('\nUsage stats:', provider.getUsageStats());
  console.log('\n=== Test passed! ===');
}

test().catch(console.error);
