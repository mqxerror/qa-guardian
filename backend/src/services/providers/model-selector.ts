/**
 * Per-Feature Model Selector
 *
 * Allows different AI features to use different models for optimal
 * cost/performance tradeoffs:
 * - Haiku for chat (fast, cheap)
 * - Sonnet for test generation (balanced)
 * - Opus for complex analysis (most capable)
 *
 * Feature #1475: Add per-feature model selection
 */

// =============================================================================
// TYPES
// =============================================================================

/** Feature categories for AI tasks */
export type AIFeatureCategory =
  | 'chat'              // General chat/conversation
  | 'test_generation'   // Generating test code
  | 'analysis'          // Code analysis, root cause analysis
  | 'healing'           // Self-healing test repairs
  | 'summarization'     // Summarizing reports/results
  | 'documentation'     // Generating documentation
  | 'explanation'       // Explaining code/tests
  | 'suggestion'        // Quick suggestions/autocomplete
  | 'default';          // Fallback category

/** Available model tiers */
export type ModelTier = 'fast' | 'balanced' | 'powerful';

/** Model configuration for a feature */
export interface FeatureModelConfig {
  /** The model to use for this feature */
  model: string;
  /** Description of why this model was chosen */
  reason: string;
  /** Model tier classification */
  tier: ModelTier;
  /** Override max tokens for this feature */
  maxTokens?: number;
  /** Override temperature for this feature */
  temperature?: number;
}

/** Model mapping for all features */
export interface FeatureModelMapping {
  [key: string]: FeatureModelConfig;
}

/** Model selector configuration */
export interface ModelSelectorConfig {
  /** Default model when no specific mapping exists */
  defaultModel: string;
  /** Feature to model mapping */
  featureModels: FeatureModelMapping;
  /** Whether to use model selection (if false, always use default) */
  enabled: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Available models by provider */
export const AVAILABLE_MODELS = {
  // Claude models via Kie.ai or direct Anthropic
  claude: [
    'claude-3-haiku-20240307',      // Fast, cheap
    'claude-3-5-sonnet-20241022',   // Balanced
    'claude-sonnet-4-20250514',     // Latest balanced
    'claude-3-opus-20240229',       // Most capable
  ],
  // DeepSeek models via Kie.ai
  deepseek: [
    'deepseek-chat',                // General chat
    'deepseek-coder',               // Code-focused
    'deepseek-reasoner',            // Reasoning tasks
  ],
};

/** Model tier mapping */
export const MODEL_TIERS: Record<string, ModelTier> = {
  'claude-3-haiku-20240307': 'fast',
  'claude-3-5-sonnet-20241022': 'balanced',
  'claude-sonnet-4-20250514': 'balanced',
  'claude-3-opus-20240229': 'powerful',
  'deepseek-chat': 'fast',
  'deepseek-coder': 'balanced',
  'deepseek-reasoner': 'powerful',
};

/** Default feature to model mapping (optimized for cost efficiency) */
export const DEFAULT_FEATURE_MODELS: FeatureModelMapping = {
  // Fast tier - Haiku for quick, simple tasks
  chat: {
    model: 'claude-3-haiku-20240307',
    reason: 'Fast responses for interactive chat',
    tier: 'fast',
    maxTokens: 1024,
    temperature: 0.7,
  },
  suggestion: {
    model: 'claude-3-haiku-20240307',
    reason: 'Quick autocomplete suggestions',
    tier: 'fast',
    maxTokens: 256,
    temperature: 0.3,
  },
  summarization: {
    model: 'claude-3-haiku-20240307',
    reason: 'Cost-effective summarization',
    tier: 'fast',
    maxTokens: 512,
    temperature: 0.3,
  },

  // Balanced tier - Sonnet for medium complexity
  test_generation: {
    model: 'claude-3-5-sonnet-20241022',
    reason: 'Quality test code generation',
    tier: 'balanced',
    maxTokens: 4096,
    temperature: 0.2,
  },
  healing: {
    model: 'claude-3-5-sonnet-20241022',
    reason: 'Accurate test repairs',
    tier: 'balanced',
    maxTokens: 2048,
    temperature: 0.1,
  },
  documentation: {
    model: 'claude-3-5-sonnet-20241022',
    reason: 'Quality documentation',
    tier: 'balanced',
    maxTokens: 4096,
    temperature: 0.4,
  },
  explanation: {
    model: 'claude-3-5-sonnet-20241022',
    reason: 'Clear explanations',
    tier: 'balanced',
    maxTokens: 2048,
    temperature: 0.5,
  },

  // Powerful tier - Opus for complex tasks
  analysis: {
    model: 'claude-3-opus-20240229',
    reason: 'Deep code analysis and root cause detection',
    tier: 'powerful',
    maxTokens: 4096,
    temperature: 0.1,
  },

  // Default fallback
  default: {
    model: 'claude-3-haiku-20240307',
    reason: 'Default to cheapest model',
    tier: 'fast',
    maxTokens: 2048,
    temperature: 0.5,
  },
};

// =============================================================================
// MODEL SELECTOR CLASS
// =============================================================================

/**
 * ModelSelector - Selects the appropriate model for each AI feature
 */
export class ModelSelector {
  private config: ModelSelectorConfig;
  private selectionHistory: Array<{
    timestamp: string;
    feature: AIFeatureCategory | string;
    model: string;
    tier: ModelTier;
  }> = [];

  constructor(config: Partial<ModelSelectorConfig> = {}) {
    this.config = {
      defaultModel: config.defaultModel || 'claude-3-haiku-20240307',
      featureModels: config.featureModels || { ...DEFAULT_FEATURE_MODELS },
      enabled: config.enabled ?? true,
    };
  }

  /**
   * Get the model configuration for a specific feature
   */
  getModelForFeature(feature: AIFeatureCategory | string): FeatureModelConfig {
    if (!this.config.enabled) {
      return {
        model: this.config.defaultModel,
        reason: 'Model selection disabled',
        tier: MODEL_TIERS[this.config.defaultModel] || 'fast',
      };
    }

    // Look up the feature mapping
    const mapping = this.config.featureModels[feature];
    if (mapping) {
      // Log selection
      this.logSelection(feature, mapping.model, mapping.tier);
      return { ...mapping };
    }

    // Fall back to default
    const defaultMapping = this.config.featureModels['default'] || {
      model: this.config.defaultModel,
      reason: 'Default model',
      tier: MODEL_TIERS[this.config.defaultModel] || 'fast',
    };

    this.logSelection(feature, defaultMapping.model, defaultMapping.tier);
    return { ...defaultMapping };
  }

  /**
   * Get just the model name for a feature (convenience method)
   */
  getModel(feature: AIFeatureCategory | string): string {
    return this.getModelForFeature(feature).model;
  }

  /**
   * Log a model selection for history
   */
  private logSelection(feature: AIFeatureCategory | string, model: string, tier: ModelTier): void {
    this.selectionHistory.push({
      timestamp: new Date().toISOString(),
      feature,
      model,
      tier,
    });

    // Keep only last 100 selections
    if (this.selectionHistory.length > 100) {
      this.selectionHistory = this.selectionHistory.slice(-100);
    }
  }

  /**
   * Set the model for a specific feature
   */
  setModelForFeature(
    feature: AIFeatureCategory | string,
    model: string,
    options: { reason?: string; maxTokens?: number; temperature?: number } = {}
  ): void {
    const tier = MODEL_TIERS[model] || 'fast';
    this.config.featureModels[feature] = {
      model,
      reason: options.reason || `Custom model for ${feature}`,
      tier,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    };
  }

  /**
   * Set the default model
   */
  setDefaultModel(model: string): void {
    this.config.defaultModel = model;
  }

  /**
   * Enable or disable model selection
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<ModelSelectorConfig> {
    return {
      ...this.config,
      featureModels: { ...this.config.featureModels },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ModelSelectorConfig>): void {
    if (config.defaultModel !== undefined) {
      this.config.defaultModel = config.defaultModel;
    }
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
    }
    if (config.featureModels !== undefined) {
      this.config.featureModels = { ...this.config.featureModels, ...config.featureModels };
    }
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    this.config.featureModels = { ...DEFAULT_FEATURE_MODELS };
    this.config.defaultModel = 'claude-3-haiku-20240307';
    this.config.enabled = true;
  }

  /**
   * Get selection history
   */
  getSelectionHistory(): Array<{
    timestamp: string;
    feature: AIFeatureCategory | string;
    model: string;
    tier: ModelTier;
  }> {
    return [...this.selectionHistory];
  }

  /**
   * Get all available models
   */
  getAvailableModels(): string[] {
    return [...AVAILABLE_MODELS.claude, ...AVAILABLE_MODELS.deepseek];
  }

  /**
   * Get models by tier
   */
  getModelsByTier(tier: ModelTier): string[] {
    return Object.entries(MODEL_TIERS)
      .filter(([_, t]) => t === tier)
      .map(([model]) => model);
  }

  /**
   * Get all feature categories
   */
  getFeatureCategories(): string[] {
    return Object.keys(this.config.featureModels);
  }

  /**
   * Get the tier for a model
   */
  getModelTier(model: string): ModelTier {
    return MODEL_TIERS[model] || 'fast';
  }

  /**
   * Get feature models summary for UI
   */
  getFeatureModelsSummary(): Array<{
    feature: string;
    model: string;
    tier: ModelTier;
    reason: string;
  }> {
    return Object.entries(this.config.featureModels).map(([feature, config]) => ({
      feature,
      model: config.model,
      tier: config.tier,
      reason: config.reason,
    }));
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export singleton instance
export const modelSelector = new ModelSelector();

// Export default
export default ModelSelector;
