#!/usr/bin/env npx tsx
/**
 * AI Integration Test Script
 *
 * This script verifies that the AI providers are properly configured
 * and can make real API calls. Run this before testing AI features.
 *
 * Usage: npx tsx backend/src/scripts/test-ai-integration.ts
 */

// CRITICAL: Load dotenv FIRST before any imports that use process.env
import dotenv from 'dotenv';
dotenv.config();

import { aiRouter } from '../services/providers/ai-router';

async function testAIIntegration() {
  console.log('\n========================================');
  console.log('  AI Integration Test');
  console.log('========================================\n');

  // Check environment variables
  console.log('1. Checking environment variables...');
  const kieKey = process.env.KIE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  console.log(`   KIE_API_KEY: ${kieKey ? '✅ Set (' + kieKey.substring(0, 8) + '...)' : '❌ Not set'}`);
  console.log(`   ANTHROPIC_API_KEY: ${anthropicKey ? '✅ Set (' + anthropicKey.substring(0, 12) + '...)' : '❌ Not set'}`);

  // Check AI Router initialization
  console.log('\n2. Checking AI Router initialization...');
  const isInitialized = aiRouter.isInitialized();
  console.log(`   AI Router initialized: ${isInitialized ? '✅ Yes' : '❌ No'}`);

  if (!isInitialized) {
    console.log('\n❌ AI Router not initialized. Check your API keys in .env file.');
    console.log('   Required: KIE_API_KEY or ANTHROPIC_API_KEY');
    process.exit(1);
  }

  // Check provider availability
  console.log('\n3. Checking provider availability...');
  const kieAvailable = aiRouter.isProviderAvailable('kie');
  const anthropicAvailable = aiRouter.isProviderAvailable('anthropic');
  console.log(`   Kie.ai available: ${kieAvailable ? '✅ Yes' : '❌ No'}`);
  console.log(`   Anthropic available: ${anthropicAvailable ? '✅ Yes' : '❌ No'}`);

  // Test actual API call
  console.log('\n4. Testing real AI API call...');
  try {
    const startTime = Date.now();
    const response = await aiRouter.sendMessage(
      [{ role: 'user', content: 'Say "AI is working" in exactly 3 words.' }],
      {
        maxTokens: 20,
        temperature: 0,
      }
    );
    const duration = Date.now() - startTime;

    console.log(`   ✅ API call successful!`);
    console.log(`   Response: "${response.content.trim()}"`);
    console.log(`   Provider: ${response.actualProvider || response.provider}`);
    console.log(`   Model: ${response.model}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Tokens: ${response.inputTokens} input, ${response.outputTokens} output`);

  } catch (error) {
    console.log(`   ❌ API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  // Test MCP handler
  console.log('\n5. Testing MCP handler (generate_test)...');
  try {
    const { handlers } = await import('../mcp/handlers/ai-generation');
    const handler = handlers.generate_test;

    if (!handler) {
      console.log('   ❌ generate_test handler not found');
      process.exit(1);
    }

    const context = {
      callApi: async () => ({}),
      callApiPublic: async () => ({}),
      log: (msg: string) => console.log(`   [Handler] ${msg}`),
      apiKey: undefined,
      apiUrl: 'http://localhost:3001',
    };

    const startTime = Date.now();
    const result = await handler(
      {
        description: 'Test that a button click shows a success message',
        target_url: 'https://example.com',
        use_real_ai: true,
      },
      context
    ) as { success: boolean; ai_metadata?: { used_real_ai?: boolean; provider?: string; model?: string }; generated_code?: string };
    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(`   ✅ Handler executed successfully!`);
      console.log(`   Used real AI: ${result.ai_metadata?.used_real_ai ? '✅ Yes' : '❌ No (fallback)'}`);
      console.log(`   Provider: ${result.ai_metadata?.provider || 'unknown'}`);
      console.log(`   Model: ${result.ai_metadata?.model || 'unknown'}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Generated code preview: ${result.generated_code?.substring(0, 100)}...`);
    } else {
      console.log(`   ❌ Handler returned error`);
    }

  } catch (error) {
    console.log(`   ❌ Handler test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('\n========================================');
  console.log('  AI Integration Test Complete');
  console.log('========================================\n');
}

testAIIntegration().catch(console.error);
