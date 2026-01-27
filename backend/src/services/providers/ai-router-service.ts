/**
 * AI Router Service
 *
 * Provides a singleton service that connects API routes to the real AIRouter.
 * This bridges the gap between the mock storage in ai-providers.ts and the
 * actual AIRouter implementation.
 *
 * Feature #1471: Connect AI Router UI to real provider switching
 */

import { AIRouter, FailoverEvent, RouterStats, CostSavings } from './ai-router.js';
import { BudgetManager, BudgetStatus, BudgetAlert } from './budget-manager.js';
import { CircuitBreaker, CircuitState, CircuitBreakerConfig } from './circuit-breaker.js';
import type { ProviderName, AIRouterConfig, HealthMetrics } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

/** UI-friendly router configuration */
export interface UIRouterConfig {
  primary_provider: ProviderName;
  fallback_provider: ProviderName | 'none';
  enabled: boolean;
  fallback_conditions: {
    on_timeout: boolean;
    on_rate_limit: boolean;
    on_error: boolean;
    on_server_error: boolean;
  };
  timeout_ms: number;
  max_fallback_attempts: number;
  circuit_breaker: {
    enabled: boolean;
    failure_threshold: number;
    recovery_time_ms: number;
  };
  cost_tracking: boolean;
}

/** UI-friendly router stats */
export interface UIRouterStats {
  total_requests: number;
  primary_successes: number;
  fallback_successes: number;
  total_failures: number;
  failover_events: FailoverEvent[];
  last_failover_at?: string;
  primary_success_rate: number;
  fallback_success_rate: number;
}

/** Circuit breaker state for UI */
export interface UICircuitBreakerState {
  provider: ProviderName;
  state: CircuitState;
  failure_count: number;
  last_failure_time?: string;
  last_success_time?: string;
  opened_at?: string;
  recovery_at?: string;
}

// =============================================================================
// AI ROUTER SERVICE
// =============================================================================

/**
 * AIRouterService - Singleton service connecting UI to real router
 */
class AIRouterService {
  private router: AIRouter;
  private budgetManager: BudgetManager;
  private circuitBreakers: Map<ProviderName, CircuitBreaker> = new Map();
  private enabled = true;

  // Track circuit breaker history for UI
  private cbHistory: Map<ProviderName, {
    lastFailureTime?: string;
    lastSuccessTime?: string;
    openedAt?: string;
  }> = new Map();

  constructor() {
    // Create the real router
    this.router = new AIRouter({
      primary: 'kie',
      fallback: 'anthropic',
      fallbackOnError: true,
      fallbackOnTimeout: true,
      timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000'),
      costTracking: true,
    });

    // Create budget manager
    this.budgetManager = new BudgetManager();

    // Create circuit breakers for each provider
    this.circuitBreakers.set('kie', new CircuitBreaker('kie'));
    this.circuitBreakers.set('anthropic', new CircuitBreaker('anthropic'));

    // Initialize history tracking
    this.cbHistory.set('kie', {});
    this.cbHistory.set('anthropic', {});

    // Set up failover callback to track events
    this.router.setFailoverCallback((event) => {
      console.log(`[AIRouterService] Failover: ${event.primaryProvider} -> ${event.fallbackProvider} (${event.reason})`);

      // Update circuit breaker history
      const history = this.cbHistory.get(event.primaryProvider as ProviderName);
      if (history) {
        history.lastFailureTime = event.timestamp;
        this.cbHistory.set(event.primaryProvider as ProviderName, history);
      }
    });
  }

  /**
   * Get the underlying router instance
   */
  getRouter(): AIRouter {
    return this.router;
  }

  /**
   * Get the budget manager instance
   */
  getBudgetManager(): BudgetManager {
    return this.budgetManager;
  }

  /**
   * Check if router is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current router configuration in UI-friendly format
   */
  getConfig(): UIRouterConfig {
    const routerConfig = this.router.getRouterConfig();

    return {
      primary_provider: routerConfig.primary,
      fallback_provider: routerConfig.fallback || 'none',
      enabled: this.enabled,
      fallback_conditions: {
        on_timeout: routerConfig.fallbackOnTimeout,
        on_rate_limit: routerConfig.fallbackOnError,
        on_error: routerConfig.fallbackOnError,
        on_server_error: routerConfig.fallbackOnError,
      },
      timeout_ms: routerConfig.timeoutMs,
      max_fallback_attempts: 2, // Default value
      circuit_breaker: {
        enabled: this.circuitBreakers.get('kie')?.getConfig().enabled ?? true,
        failure_threshold: this.circuitBreakers.get('kie')?.getConfig().failureThreshold ?? 5,
        recovery_time_ms: this.circuitBreakers.get('kie')?.getConfig().resetTimeoutMs ?? 60000,
      },
      cost_tracking: routerConfig.costTracking,
    };
  }

  /**
   * Update router configuration from UI
   */
  updateConfig(updates: Partial<UIRouterConfig>): UIRouterConfig {
    // Update enabled status
    if (updates.enabled !== undefined) {
      this.enabled = updates.enabled;
    }

    // Update router config
    this.router.updateRouterConfig({
      primary: updates.primary_provider,
      fallback: updates.fallback_provider === 'none' ? undefined : updates.fallback_provider,
      fallbackOnTimeout: updates.fallback_conditions?.on_timeout,
      fallbackOnError: updates.fallback_conditions?.on_error || updates.fallback_conditions?.on_rate_limit,
      timeoutMs: updates.timeout_ms,
      costTracking: updates.cost_tracking,
    });

    // Update circuit breakers
    if (updates.circuit_breaker) {
      for (const [provider, cb] of this.circuitBreakers) {
        cb.updateConfig({
          enabled: updates.circuit_breaker.enabled,
          failureThreshold: updates.circuit_breaker.failure_threshold,
          resetTimeoutMs: updates.circuit_breaker.recovery_time_ms,
        });
      }
    }

    return this.getConfig();
  }

  /**
   * Get router statistics in UI-friendly format
   */
  getStats(): UIRouterStats {
    const stats = this.router.getRouterStats();

    const totalPrimaryAttempts = stats.primarySuccesses + stats.fallbackSuccesses + stats.totalFailures;
    const primarySuccessRate = totalPrimaryAttempts > 0
      ? (stats.primarySuccesses / totalPrimaryAttempts) * 100
      : 100;

    const fallbackAttempts = stats.fallbackSuccesses + (stats.totalFailures > 0 ? 1 : 0);
    const fallbackSuccessRate = fallbackAttempts > 0
      ? (stats.fallbackSuccesses / fallbackAttempts) * 100
      : 100;

    return {
      total_requests: stats.totalRequests,
      primary_successes: stats.primarySuccesses,
      fallback_successes: stats.fallbackSuccesses,
      total_failures: stats.totalFailures,
      failover_events: stats.failoverEvents,
      last_failover_at: stats.lastFailoverAt,
      primary_success_rate: Math.round(primarySuccessRate * 10) / 10,
      fallback_success_rate: Math.round(fallbackSuccessRate * 10) / 10,
    };
  }

  /**
   * Get circuit breaker states for all providers
   */
  getCircuitBreakerStates(): UICircuitBreakerState[] {
    const states: UICircuitBreakerState[] = [];

    for (const [provider, cb] of this.circuitBreakers) {
      const history = this.cbHistory.get(provider) || {};

      const cbStatus = cb.getStatus();
      states.push({
        provider,
        state: cb.getState(),
        failure_count: cbStatus.failures,
        last_failure_time: cbStatus.lastFailureAt || history.lastFailureTime,
        last_success_time: history.lastSuccessTime,
        opened_at: history.openedAt,
        recovery_at: cbStatus.nextRetryAt,
      });
    }

    return states;
  }

  /**
   * Reset circuit breaker for a specific provider
   */
  resetCircuitBreaker(provider: ProviderName): void {
    const cb = this.circuitBreakers.get(provider);
    if (cb) {
      cb.reset();
      const history = this.cbHistory.get(provider);
      if (history) {
        history.lastSuccessTime = new Date().toISOString();
        history.openedAt = undefined;
        this.cbHistory.set(provider, history);
      }
    }
  }

  /**
   * Get cost savings report
   */
  getCostSavings(): CostSavings {
    return this.router.getCostSavings();
  }

  /**
   * Get budget status
   */
  getBudgetStatus(): BudgetStatus {
    return this.budgetManager.getBudgetStatus();
  }

  /**
   * Get health metrics for a provider
   */
  getHealthMetrics(provider?: ProviderName): HealthMetrics {
    if (provider) {
      const p = this.router.getProvider(provider);
      if (p) {
        return p.getHealthMetrics();
      }
    }
    return this.router.getHealthMetrics();
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: ProviderName): boolean {
    return this.router.isProviderAvailable(provider);
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.router.resetUsageStats();
    this.router.resetCostTracking();
    this.budgetManager.resetMonthlyTracking();

    for (const cb of this.circuitBreakers.values()) {
      cb.reset();
    }

    for (const [provider, history] of this.cbHistory) {
      this.cbHistory.set(provider, {});
    }
  }
}

// Export singleton instance
export const aiRouterService = new AIRouterService();

// Export class for testing
export { AIRouterService };

// Export default
export default aiRouterService;
