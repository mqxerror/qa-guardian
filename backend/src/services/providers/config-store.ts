/**
 * AI Provider Configuration Store
 *
 * Persists AI provider configuration to a JSON file for cross-restart persistence.
 * Supports organization-level config overrides with environment defaults fallback.
 *
 * Feature #1472: Persist provider configuration to database
 * (Using file-based storage since this project doesn't use a database)
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// TYPES
// =============================================================================

/** AI provider configuration for persistence */
export interface AIProviderConfig {
  /** Organization ID */
  orgId: string;
  /** Primary provider ('kie' | 'anthropic') */
  primaryProvider: string;
  /** Fallback provider ('kie' | 'anthropic' | null) */
  fallbackProvider: string | null;
  /** Whether router is enabled */
  enabled: boolean;
  /** Fallback conditions */
  fallbackConditions: {
    onTimeout: boolean;
    onRateLimit: boolean;
    onError: boolean;
    onServerError: boolean;
  };
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Circuit breaker settings */
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeoutMs: number;
  };
  /** Cost tracking enabled */
  costTracking: boolean;
  /** Monthly budget in USD */
  monthlyBudgetUsd: number;
  /** Budget alert threshold percentage (0-100) */
  budgetAlertThreshold: number;
  /** Block requests when budget exceeded */
  blockOnBudgetExceed: boolean;
  /** Last updated timestamp */
  updatedAt: string;
  /** Created timestamp */
  createdAt: string;
}

/** Full configuration store data */
interface ConfigStoreData {
  version: number;
  configs: Record<string, AIProviderConfig>; // orgId -> config
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Configuration file path
const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'ai-provider-config.json');

// Schema version for migrations
const CURRENT_VERSION = 1;

// Default configuration (from environment)
const DEFAULT_CONFIG: Omit<AIProviderConfig, 'orgId' | 'createdAt' | 'updatedAt'> = {
  primaryProvider: process.env.AI_PRIMARY_PROVIDER || 'kie',
  fallbackProvider: process.env.AI_FALLBACK_PROVIDER || 'anthropic',
  enabled: process.env.AI_ROUTER_ENABLED !== 'false',
  fallbackConditions: {
    onTimeout: process.env.AI_FALLBACK_ON_TIMEOUT !== 'false',
    onRateLimit: process.env.AI_FALLBACK_ON_RATE_LIMIT !== 'false',
    onError: process.env.AI_FALLBACK_ON_ERROR !== 'false',
    onServerError: process.env.AI_FALLBACK_ON_SERVER_ERROR !== 'false',
  },
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000'),
  circuitBreaker: {
    enabled: process.env.AI_CIRCUIT_BREAKER_ENABLED !== 'false',
    failureThreshold: parseInt(process.env.AI_CIRCUIT_BREAKER_THRESHOLD || '5'),
    resetTimeoutMs: parseInt(process.env.AI_CIRCUIT_BREAKER_RESET_MS || '30000'),
  },
  costTracking: process.env.AI_COST_TRACKING !== 'false',
  monthlyBudgetUsd: parseFloat(process.env.AI_MONTHLY_BUDGET_USD || '100'),
  budgetAlertThreshold: parseFloat(process.env.AI_BUDGET_ALERT_THRESHOLD || '80'),
  blockOnBudgetExceed: process.env.AI_BUDGET_BLOCK_ON_EXCEED === 'true',
};

// =============================================================================
// CONFIG STORE CLASS
// =============================================================================

/**
 * AIConfigStore - Persists AI provider configuration
 */
class AIConfigStore {
  private data: ConfigStoreData;
  private loaded = false;

  constructor() {
    this.data = {
      version: CURRENT_VERSION,
      configs: {},
    };
  }

  /**
   * Ensure the data directory exists
   */
  private ensureDataDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  /**
   * Load configuration from file
   */
  load(): void {
    this.ensureDataDir();

    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const fileContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);

        // Handle version migrations if needed
        if (this.data.version < CURRENT_VERSION) {
          this.migrate();
        }

        console.log(`[AIConfigStore] Loaded ${Object.keys(this.data.configs).length} organization configs`);
      } else {
        console.log('[AIConfigStore] No config file found, using defaults');
      }
    } catch (error) {
      console.error('[AIConfigStore] Error loading config:', error);
      // Continue with empty/default config
    }

    this.loaded = true;
  }

  /**
   * Save configuration to file
   */
  save(): void {
    this.ensureDataDir();

    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
      console.log('[AIConfigStore] Configuration saved');
    } catch (error) {
      console.error('[AIConfigStore] Error saving config:', error);
    }
  }

  /**
   * Migrate older config versions
   */
  private migrate(): void {
    // Handle migrations based on version number
    console.log(`[AIConfigStore] Migrating from version ${this.data.version} to ${CURRENT_VERSION}`);
    this.data.version = CURRENT_VERSION;
    this.save();
  }

  /**
   * Get configuration for an organization
   * Falls back to environment defaults if no org-specific config exists
   */
  getConfig(orgId: string): AIProviderConfig {
    if (!this.loaded) {
      this.load();
    }

    // Return org-specific config if exists
    if (this.data.configs[orgId]) {
      return { ...this.data.configs[orgId] };
    }

    // Return default config
    const now = new Date().toISOString();
    return {
      orgId,
      ...DEFAULT_CONFIG,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Update configuration for an organization
   */
  updateConfig(orgId: string, updates: Partial<Omit<AIProviderConfig, 'orgId' | 'createdAt'>>): AIProviderConfig {
    if (!this.loaded) {
      this.load();
    }

    const now = new Date().toISOString();
    const existing = this.getConfig(orgId);

    // Merge updates
    const updated: AIProviderConfig = {
      ...existing,
      ...updates,
      orgId,
      updatedAt: now,
      // Preserve createdAt
      createdAt: this.data.configs[orgId]?.createdAt || now,
    };

    // Deep merge nested objects
    if (updates.fallbackConditions) {
      updated.fallbackConditions = {
        ...existing.fallbackConditions,
        ...updates.fallbackConditions,
      };
    }
    if (updates.circuitBreaker) {
      updated.circuitBreaker = {
        ...existing.circuitBreaker,
        ...updates.circuitBreaker,
      };
    }

    // Store and save
    this.data.configs[orgId] = updated;
    this.save();

    return { ...updated };
  }

  /**
   * Delete configuration for an organization
   * This resets to environment defaults
   */
  deleteConfig(orgId: string): boolean {
    if (!this.loaded) {
      this.load();
    }

    if (this.data.configs[orgId]) {
      delete this.data.configs[orgId];
      this.save();
      return true;
    }

    return false;
  }

  /**
   * Get all organization configurations
   */
  getAllConfigs(): AIProviderConfig[] {
    if (!this.loaded) {
      this.load();
    }

    return Object.values(this.data.configs);
  }

  /**
   * Check if an organization has a custom config
   */
  hasCustomConfig(orgId: string): boolean {
    if (!this.loaded) {
      this.load();
    }

    return !!this.data.configs[orgId];
  }

  /**
   * Get the default configuration (from environment)
   */
  getDefaultConfig(): Omit<AIProviderConfig, 'orgId' | 'createdAt' | 'updatedAt'> {
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Export all data (for backup)
   */
  exportData(): ConfigStoreData {
    if (!this.loaded) {
      this.load();
    }

    return { ...this.data };
  }

  /**
   * Import data (for restore)
   */
  importData(data: ConfigStoreData): void {
    this.data = data;
    this.save();
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export singleton instance
export const aiConfigStore = new AIConfigStore();

// Export class for testing
export { AIConfigStore };

// Export types
export type { ConfigStoreData };

// Export default
export default aiConfigStore;
