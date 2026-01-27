/**
 * API Key Validator
 *
 * Validates API keys for AI providers on startup and provides clear error
 * messages if keys are invalid or missing.
 *
 * Feature #1473: Add API key validation for both providers
 */

// =============================================================================
// TYPES
// =============================================================================

/** Provider name type */
export type ValidatableProvider = 'kie' | 'anthropic';

/** Validation result for a single provider */
export interface KeyValidationResult {
  provider: ValidatableProvider;
  valid: boolean;
  configured: boolean;
  error?: string;
  errorCode?: 'missing_key' | 'invalid_key' | 'invalid_format' | 'api_error' | 'network_error';
  latencyMs?: number;
  checkedAt: string;
}

/** Validation result for all providers */
export interface AllKeysValidationResult {
  timestamp: string;
  results: Record<ValidatableProvider, KeyValidationResult>;
  allValid: boolean;
  anyValid: boolean;
  summary: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Environment variable names for API keys */
const API_KEY_ENV_VARS: Record<ValidatableProvider, string> = {
  kie: 'KIE_AI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

/** API endpoints for validation */
const VALIDATION_ENDPOINTS: Record<ValidatableProvider, string> = {
  kie: 'https://kieai.erweima.ai/api/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
};

/** Expected key format patterns */
const KEY_PATTERNS: Record<ValidatableProvider, RegExp> = {
  kie: /^[a-zA-Z0-9_-]{20,}$/,  // Kie.ai keys are alphanumeric
  anthropic: /^sk-ant-[a-zA-Z0-9_-]{40,}$/, // Anthropic keys start with sk-ant-
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get API key for a provider from environment
 */
function getApiKey(provider: ValidatableProvider): string | undefined {
  return process.env[API_KEY_ENV_VARS[provider]];
}

/**
 * Validate key format
 */
function validateKeyFormat(provider: ValidatableProvider, key: string): boolean {
  // Allow any non-empty key for flexibility
  if (key.length < 10) return false;

  // Check specific patterns if they match typical format
  const pattern = KEY_PATTERNS[provider];
  return pattern.test(key);
}

/**
 * Make a minimal API call to verify the key works
 */
async function testApiKey(provider: ValidatableProvider, apiKey: string): Promise<{ valid: boolean; error?: string; latencyMs: number }> {
  const startTime = Date.now();

  try {
    if (provider === 'kie') {
      const response = await fetch(VALIDATION_ENDPOINTS.kie, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1, // Minimal tokens to test
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key (401 Unauthorized)', latencyMs };
      }
      if (response.status === 403) {
        return { valid: false, error: 'API key forbidden (403)', latencyMs };
      }
      // Success or rate limit (429) means the key is valid
      if (response.ok || response.status === 429) {
        return { valid: true, latencyMs };
      }

      // Check for specific error messages
      try {
        const data = await response.json();
        return {
          valid: false,
          error: data.error?.message || `API error (${response.status})`,
          latencyMs,
        };
      } catch {
        return { valid: false, error: `API error (${response.status})`, latencyMs };
      }
    } else if (provider === 'anthropic') {
      // Anthropic validation - use a minimal message request
      const response = await fetch(VALIDATION_ENDPOINTS.anthropic, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key (401 Unauthorized)', latencyMs };
      }
      if (response.status === 403) {
        return { valid: false, error: 'API key forbidden (403)', latencyMs };
      }
      // Success or rate limit means the key is valid
      if (response.ok || response.status === 429) {
        return { valid: true, latencyMs };
      }

      try {
        const data = await response.json();
        return {
          valid: false,
          error: data.error?.message || `API error (${response.status})`,
          latencyMs,
        };
      } catch {
        return { valid: false, error: `API error (${response.status})`, latencyMs };
      }
    }

    return { valid: false, error: 'Unknown provider', latencyMs: Date.now() - startTime };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return { valid: false, error: 'Network error - could not reach API', latencyMs };
      }
      return { valid: false, error: error.message, latencyMs };
    }
    return { valid: false, error: 'Unknown error occurred', latencyMs };
  }
}

// =============================================================================
// MAIN VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate a single provider's API key
 */
export async function validateApiKey(provider: ValidatableProvider): Promise<KeyValidationResult> {
  const now = new Date().toISOString();
  const apiKey = getApiKey(provider);

  // Check if key is configured
  if (!apiKey) {
    console.log(`[APIKeyValidator] ${provider.toUpperCase()}: No API key configured (${API_KEY_ENV_VARS[provider]})`);
    return {
      provider,
      valid: false,
      configured: false,
      error: `API key not configured. Set ${API_KEY_ENV_VARS[provider]} environment variable.`,
      errorCode: 'missing_key',
      checkedAt: now,
    };
  }

  // Check key format (basic validation)
  if (!validateKeyFormat(provider, apiKey)) {
    console.log(`[APIKeyValidator] ${provider.toUpperCase()}: Invalid key format`);
    return {
      provider,
      valid: false,
      configured: true,
      error: 'API key format appears invalid',
      errorCode: 'invalid_format',
      checkedAt: now,
    };
  }

  // Test the key with an actual API call
  console.log(`[APIKeyValidator] ${provider.toUpperCase()}: Testing API key...`);
  const testResult = await testApiKey(provider, apiKey);

  if (testResult.valid) {
    console.log(`[APIKeyValidator] ${provider.toUpperCase()}: API key is valid (${testResult.latencyMs}ms)`);
    return {
      provider,
      valid: true,
      configured: true,
      latencyMs: testResult.latencyMs,
      checkedAt: now,
    };
  } else {
    console.error(`[APIKeyValidator] ${provider.toUpperCase()}: ${testResult.error}`);
    return {
      provider,
      valid: false,
      configured: true,
      error: testResult.error,
      errorCode: testResult.error?.includes('Network') ? 'network_error' : 'invalid_key',
      latencyMs: testResult.latencyMs,
      checkedAt: now,
    };
  }
}

/**
 * Validate API keys for all providers
 */
export async function validateAllApiKeys(): Promise<AllKeysValidationResult> {
  console.log('[APIKeyValidator] Validating all API keys...');

  const [kieResult, anthropicResult] = await Promise.all([
    validateApiKey('kie'),
    validateApiKey('anthropic'),
  ]);

  const allValid = kieResult.valid && anthropicResult.valid;
  const anyValid = kieResult.valid || anthropicResult.valid;

  let summary: string;
  if (allValid) {
    summary = 'All API keys are valid';
  } else if (anyValid) {
    const validProvider = kieResult.valid ? 'Kie.ai' : 'Anthropic';
    const invalidProvider = kieResult.valid ? 'Anthropic' : 'Kie.ai';
    summary = `${validProvider} key is valid. ${invalidProvider} key has issues.`;
  } else {
    summary = 'No valid API keys found. AI features will be unavailable.';
  }

  console.log(`[APIKeyValidator] Result: ${summary}`);

  return {
    timestamp: new Date().toISOString(),
    results: {
      kie: kieResult,
      anthropic: anthropicResult,
    },
    allValid,
    anyValid,
    summary,
  };
}

/**
 * Quick check if any provider is available (without full validation)
 */
export function hasAnyApiKeyConfigured(): boolean {
  return !!(getApiKey('kie') || getApiKey('anthropic'));
}

/**
 * Get configured providers
 */
export function getConfiguredProviders(): ValidatableProvider[] {
  const providers: ValidatableProvider[] = [];
  if (getApiKey('kie')) providers.push('kie');
  if (getApiKey('anthropic')) providers.push('anthropic');
  return providers;
}

/**
 * Check if a specific provider is configured (key exists)
 */
export function isProviderConfigured(provider: ValidatableProvider): boolean {
  return !!getApiKey(provider);
}

/**
 * Mask an API key for display (show only first/last 4 chars)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}${'*'.repeat(Math.min(20, key.length - 8))}${key.slice(-4)}`;
}

/**
 * Get API key status for display (without exposing the full key)
 */
export function getApiKeyStatus(provider: ValidatableProvider): {
  configured: boolean;
  maskedKey?: string;
  envVar: string;
} {
  const key = getApiKey(provider);
  return {
    configured: !!key,
    maskedKey: key ? maskApiKey(key) : undefined,
    envVar: API_KEY_ENV_VARS[provider],
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  API_KEY_ENV_VARS,
  VALIDATION_ENDPOINTS,
};

// Export default
export default validateAllApiKeys;
