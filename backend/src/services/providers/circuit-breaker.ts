/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by tracking provider failures and temporarily
 * stopping requests to failing providers. States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Circuit tripped, requests fail fast without trying provider
 * - HALF_OPEN: Testing state, allows one request to test if provider recovered
 *
 * Feature #1463: Add circuit breaker pattern in service layer
 */

// =============================================================================
// TYPES
// =============================================================================

/** Circuit breaker states */
export type CircuitState = 'closed' | 'open' | 'half_open';

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms to wait before trying half-open state (default: 30000) */
  resetTimeoutMs?: number;
  /** Time in ms for a single request timeout (default: 30000) */
  requestTimeoutMs?: number;
  /** Number of successes in half-open before closing circuit (default: 1) */
  successThreshold?: number;
  /** Whether to enable the circuit breaker (default: true) */
  enabled?: boolean;
}

/** Circuit breaker status for health checks */
export interface CircuitBreakerStatus {
  /** Current state of the circuit */
  state: CircuitState;
  /** Number of consecutive failures */
  failures: number;
  /** Number of consecutive successes (in half-open) */
  successes: number;
  /** When the circuit was last opened */
  lastFailureAt?: string;
  /** When the circuit can be half-opened */
  nextRetryAt?: string;
  /** Whether the circuit breaker is enabled */
  enabled: boolean;
  /** Total number of requests blocked by open circuit */
  blockedRequests: number;
  /** Total state transitions */
  stateTransitions: number;
}

/** Circuit breaker event */
export interface CircuitBreakerEvent {
  timestamp: string;
  provider: string;
  previousState: CircuitState;
  newState: CircuitState;
  reason: string;
}

// =============================================================================
// CIRCUIT BREAKER CLASS
// =============================================================================

/**
 * CircuitBreaker - Implements the circuit breaker pattern
 *
 * Tracks failures and temporarily blocks requests to failing providers
 * to prevent cascading failures and allow recovery.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureAt?: Date;
  private lastStateChange: Date = new Date();
  private blockedRequests = 0;
  private stateTransitions = 0;

  private config: Required<CircuitBreakerConfig>;
  private providerName: string;

  // Event callbacks
  private onStateChange?: (event: CircuitBreakerEvent) => void;

  constructor(providerName: string, config: CircuitBreakerConfig = {}) {
    this.providerName = providerName;
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeoutMs: config.resetTimeoutMs ?? 30000,
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
      successThreshold: config.successThreshold ?? 1,
      enabled: config.enabled ?? true,
    };
  }

  /**
   * Set a callback for state change events
   */
  setStateChangeCallback(callback: (event: CircuitBreakerEvent) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Emit a state change event
   */
  private emitStateChange(previousState: CircuitState, newState: CircuitState, reason: string): void {
    this.stateTransitions++;
    const event: CircuitBreakerEvent = {
      timestamp: new Date().toISOString(),
      provider: this.providerName,
      previousState,
      newState,
      reason,
    };
    console.log(`[CircuitBreaker:${this.providerName}] ${previousState} -> ${newState}: ${reason}`);
    this.onStateChange?.(event);
  }

  /**
   * Get current state of the circuit breaker
   */
  getState(): CircuitState {
    // Check if we should transition from open to half-open
    if (this.state === 'open' && this.lastFailureAt) {
      const timeSinceFailure = Date.now() - this.lastFailureAt.getTime();
      if (timeSinceFailure >= this.config.resetTimeoutMs) {
        this.transitionTo('half_open', 'Reset timeout elapsed');
      }
    }
    return this.state;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState, reason: string): void {
    if (this.state !== newState) {
      const previousState = this.state;
      this.state = newState;
      this.lastStateChange = new Date();
      this.emitStateChange(previousState, newState, reason);
    }
  }

  /**
   * Check if the circuit allows a request to pass through
   */
  canRequest(): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const currentState = this.getState();

    switch (currentState) {
      case 'closed':
        return true;

      case 'open':
        this.blockedRequests++;
        return false;

      case 'half_open':
        // Allow one test request
        return true;

      default:
        return true;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (!this.config.enabled) {
      return;
    }

    const currentState = this.getState();

    switch (currentState) {
      case 'closed':
        // Reset failure count on success
        this.failures = 0;
        break;

      case 'half_open':
        this.successes++;
        if (this.successes >= this.config.successThreshold) {
          // Enough successes, close the circuit
          this.transitionTo('closed', `${this.successes} successful requests`);
          this.failures = 0;
          this.successes = 0;
        }
        break;

      case 'open':
        // Shouldn't happen, but handle gracefully
        break;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(error?: Error): void {
    if (!this.config.enabled) {
      return;
    }

    this.failures++;
    this.lastFailureAt = new Date();

    const currentState = this.getState();

    switch (currentState) {
      case 'closed':
        if (this.failures >= this.config.failureThreshold) {
          // Too many failures, open the circuit
          const reason = error
            ? `${this.failures} failures (last: ${error.message.substring(0, 50)})`
            : `${this.failures} consecutive failures`;
          this.transitionTo('open', reason);
        }
        break;

      case 'half_open':
        // Failed during test, go back to open
        this.transitionTo('open', `Test request failed: ${error?.message?.substring(0, 50) || 'unknown error'}`);
        this.successes = 0;
        break;

      case 'open':
        // Already open, just track the failure
        break;
    }
  }

  /**
   * Get circuit breaker status for health checks
   */
  getStatus(): CircuitBreakerStatus {
    const currentState = this.getState();

    let nextRetryAt: string | undefined;
    if (currentState === 'open' && this.lastFailureAt) {
      const nextRetryTime = new Date(this.lastFailureAt.getTime() + this.config.resetTimeoutMs);
      nextRetryAt = nextRetryTime.toISOString();
    }

    return {
      state: currentState,
      failures: this.failures,
      successes: this.successes,
      lastFailureAt: this.lastFailureAt?.toISOString(),
      nextRetryAt,
      enabled: this.config.enabled,
      blockedRequests: this.blockedRequests,
      stateTransitions: this.stateTransitions,
    };
  }

  /**
   * Force the circuit to a specific state (for testing/manual override)
   */
  forceState(state: CircuitState, reason = 'Manual override'): void {
    this.transitionTo(state, reason);
    if (state === 'closed') {
      this.failures = 0;
      this.successes = 0;
    }
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.transitionTo('closed', 'Manual reset');
    this.failures = 0;
    this.successes = 0;
    this.blockedRequests = 0;
  }

  /**
   * Get the configuration
   */
  getConfig(): Readonly<Required<CircuitBreakerConfig>> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    if (config.failureThreshold !== undefined) {
      this.config.failureThreshold = config.failureThreshold;
    }
    if (config.resetTimeoutMs !== undefined) {
      this.config.resetTimeoutMs = config.resetTimeoutMs;
    }
    if (config.requestTimeoutMs !== undefined) {
      this.config.requestTimeoutMs = config.requestTimeoutMs;
    }
    if (config.successThreshold !== undefined) {
      this.config.successThreshold = config.successThreshold;
    }
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canRequest()) {
      const status = this.getStatus();
      throw new CircuitBreakerOpenError(
        `Circuit breaker is open for ${this.providerName}. Next retry at ${status.nextRetryAt || 'unknown'}`,
        this.providerName,
        status.nextRetryAt
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  provider: string;
  nextRetryAt?: string;

  constructor(message: string, provider: string, nextRetryAt?: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
    this.provider = provider;
    this.nextRetryAt = nextRetryAt;
  }
}

// =============================================================================
// CIRCUIT BREAKER REGISTRY
// =============================================================================

/**
 * Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private defaultConfig: CircuitBreakerConfig;

  constructor(defaultConfig: CircuitBreakerConfig = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create a circuit breaker for a provider
   */
  getBreaker(providerName: string, config?: CircuitBreakerConfig): CircuitBreaker {
    let breaker = this.breakers.get(providerName);
    if (!breaker) {
      breaker = new CircuitBreaker(providerName, config || this.defaultConfig);
      this.breakers.set(providerName, breaker);
    }
    return breaker;
  }

  /**
   * Get status of all circuit breakers
   */
  getAllStatus(): Record<string, CircuitBreakerStatus> {
    const result: Record<string, CircuitBreakerStatus> = {};
    for (const [name, breaker] of this.breakers) {
      result[name] = breaker.getStatus();
    }
    return result;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Export singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry({
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  successThreshold: 1,
  enabled: true,
});

// Export default
export default CircuitBreaker;
