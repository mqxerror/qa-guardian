/**
 * AI Budget Manager
 *
 * Enforces monthly budget limits and sends alerts when thresholds are reached.
 * Integrates with AIRouter to track spending and prevent overspending.
 *
 * Environment variables:
 * - AI_MONTHLY_BUDGET_USD: Maximum monthly spend (default: 100)
 * - AI_BUDGET_ALERT_THRESHOLD: Alert at this percentage (default: 80%)
 * - AI_BUDGET_BLOCK_ON_EXCEED: Block requests when exceeded (default: false)
 *
 * Feature #1468: Implement monthly budget limits with alerts
 */

// =============================================================================
// TYPES
// =============================================================================

/** Budget configuration */
export interface BudgetConfig {
  /** Maximum monthly budget in USD */
  monthlyBudgetUsd: number;
  /** Alert threshold percentage (0-100) */
  alertThreshold: number;
  /** Whether to block requests when budget exceeded */
  blockOnExceed: boolean;
  /** Callback for budget alerts */
  onAlert?: (alert: BudgetAlert) => void;
}

/** Budget alert types */
export type BudgetAlertType = 'threshold_warning' | 'budget_exceeded' | 'request_blocked';

/** Budget alert */
export interface BudgetAlert {
  type: BudgetAlertType;
  timestamp: string;
  message: string;
  currentSpend: number;
  budgetLimit: number;
  percentUsed: number;
  remainingBudget: number;
}

/** Monthly spending record */
export interface MonthlySpend {
  /** Month in YYYY-MM format */
  month: string;
  /** Total spend in USD */
  totalSpendUsd: number;
  /** Number of requests */
  requestCount: number;
  /** Total input tokens */
  inputTokens: number;
  /** Total output tokens */
  outputTokens: number;
  /** Last updated timestamp */
  lastUpdated: string;
}

/** Budget status */
export interface BudgetStatus {
  /** Current month */
  currentMonth: string;
  /** Monthly budget limit */
  budgetLimitUsd: number;
  /** Current spend this month */
  currentSpendUsd: number;
  /** Remaining budget */
  remainingBudgetUsd: number;
  /** Percentage used (0-100) */
  percentUsed: number;
  /** Whether threshold alert has been triggered */
  thresholdAlertTriggered: boolean;
  /** Whether budget is exceeded */
  budgetExceeded: boolean;
  /** Whether requests are being blocked */
  requestsBlocked: boolean;
  /** Alert threshold percentage */
  alertThreshold: number;
  /** Block on exceed setting */
  blockOnExceed: boolean;
}

// =============================================================================
// BUDGET MANAGER CLASS
// =============================================================================

/**
 * BudgetManager - Tracks and enforces AI spending budgets
 */
export class BudgetManager {
  private config: BudgetConfig;
  private monthlySpend: MonthlySpend;
  private thresholdAlertTriggered = false;
  private budgetExceededAlertTriggered = false;
  private alerts: BudgetAlert[] = [];

  constructor(config: Partial<BudgetConfig> = {}) {
    // Read from environment with defaults
    const envBudget = process.env.AI_MONTHLY_BUDGET_USD;
    const envThreshold = process.env.AI_BUDGET_ALERT_THRESHOLD;
    const envBlock = process.env.AI_BUDGET_BLOCK_ON_EXCEED;

    this.config = {
      monthlyBudgetUsd: config.monthlyBudgetUsd ?? (envBudget ? parseFloat(envBudget) : 100),
      alertThreshold: config.alertThreshold ?? (envThreshold ? parseFloat(envThreshold) : 80),
      blockOnExceed: config.blockOnExceed ?? (envBlock === 'true'),
      onAlert: config.onAlert,
    };

    // Initialize monthly spend for current month
    this.monthlySpend = this.createEmptyMonthlySpend();
  }

  /**
   * Get current month in YYYY-MM format
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Create empty monthly spend record
   */
  private createEmptyMonthlySpend(): MonthlySpend {
    return {
      month: this.getCurrentMonth(),
      totalSpendUsd: 0,
      requestCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Check if we need to reset for a new month
   */
  private checkMonthReset(): void {
    const currentMonth = this.getCurrentMonth();
    if (this.monthlySpend.month !== currentMonth) {
      console.log(`[BudgetManager] New month detected: ${currentMonth}. Resetting budget tracking.`);
      this.monthlySpend = this.createEmptyMonthlySpend();
      this.thresholdAlertTriggered = false;
      this.budgetExceededAlertTriggered = false;
    }
  }

  /**
   * Create and dispatch a budget alert
   */
  private createAlert(type: BudgetAlertType, message: string): BudgetAlert {
    const alert: BudgetAlert = {
      type,
      timestamp: new Date().toISOString(),
      message,
      currentSpend: this.monthlySpend.totalSpendUsd,
      budgetLimit: this.config.monthlyBudgetUsd,
      percentUsed: this.getPercentUsed(),
      remainingBudget: this.getRemainingBudget(),
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log the alert
    if (type === 'request_blocked') {
      console.error(`[BudgetManager] ${message}`);
    } else if (type === 'budget_exceeded') {
      console.warn(`[BudgetManager] ${message}`);
    } else {
      console.log(`[BudgetManager] ${message}`);
    }

    // Invoke callback if set
    this.config.onAlert?.(alert);

    return alert;
  }

  /**
   * Get percentage of budget used
   */
  private getPercentUsed(): number {
    if (this.config.monthlyBudgetUsd <= 0) return 0;
    return (this.monthlySpend.totalSpendUsd / this.config.monthlyBudgetUsd) * 100;
  }

  /**
   * Get remaining budget
   */
  private getRemainingBudget(): number {
    return Math.max(0, this.config.monthlyBudgetUsd - this.monthlySpend.totalSpendUsd);
  }

  /**
   * Check if request can proceed (not blocked by budget)
   * Call this BEFORE making an AI request
   *
   * @returns true if request can proceed, false if blocked
   */
  canMakeRequest(): boolean {
    this.checkMonthReset();

    // If blockOnExceed is disabled, always allow
    if (!this.config.blockOnExceed) {
      return true;
    }

    // Block if budget exceeded
    const exceeded = this.monthlySpend.totalSpendUsd >= this.config.monthlyBudgetUsd;
    if (exceeded) {
      this.createAlert(
        'request_blocked',
        `Request blocked: Monthly budget of $${this.config.monthlyBudgetUsd.toFixed(2)} exceeded. ` +
        `Current spend: $${this.monthlySpend.totalSpendUsd.toFixed(4)}`
      );
      return false;
    }

    return true;
  }

  /**
   * Track spending after a successful request
   * Call this AFTER a successful AI request
   *
   * @param costUsd - Cost of the request in USD
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   */
  trackSpend(costUsd: number, inputTokens: number, outputTokens: number): void {
    this.checkMonthReset();

    // Update monthly spend
    this.monthlySpend.totalSpendUsd += costUsd;
    this.monthlySpend.requestCount++;
    this.monthlySpend.inputTokens += inputTokens;
    this.monthlySpend.outputTokens += outputTokens;
    this.monthlySpend.lastUpdated = new Date().toISOString();

    const percentUsed = this.getPercentUsed();

    // Check for threshold alert (only once per month)
    if (!this.thresholdAlertTriggered && percentUsed >= this.config.alertThreshold) {
      this.thresholdAlertTriggered = true;
      this.createAlert(
        'threshold_warning',
        `Budget alert: ${percentUsed.toFixed(1)}% of monthly budget used ` +
        `($${this.monthlySpend.totalSpendUsd.toFixed(4)} of $${this.config.monthlyBudgetUsd.toFixed(2)}). ` +
        `Remaining: $${this.getRemainingBudget().toFixed(4)}`
      );
    }

    // Check for budget exceeded alert (only once per month)
    if (!this.budgetExceededAlertTriggered && percentUsed >= 100) {
      this.budgetExceededAlertTriggered = true;
      this.createAlert(
        'budget_exceeded',
        `Budget exceeded: Monthly limit of $${this.config.monthlyBudgetUsd.toFixed(2)} reached. ` +
        `Current spend: $${this.monthlySpend.totalSpendUsd.toFixed(4)}`
      );
    }
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(): BudgetStatus {
    this.checkMonthReset();

    return {
      currentMonth: this.monthlySpend.month,
      budgetLimitUsd: this.config.monthlyBudgetUsd,
      currentSpendUsd: this.monthlySpend.totalSpendUsd,
      remainingBudgetUsd: this.getRemainingBudget(),
      percentUsed: this.getPercentUsed(),
      thresholdAlertTriggered: this.thresholdAlertTriggered,
      budgetExceeded: this.monthlySpend.totalSpendUsd >= this.config.monthlyBudgetUsd,
      requestsBlocked: this.config.blockOnExceed && this.monthlySpend.totalSpendUsd >= this.config.monthlyBudgetUsd,
      alertThreshold: this.config.alertThreshold,
      blockOnExceed: this.config.blockOnExceed,
    };
  }

  /**
   * Get monthly spending details
   */
  getMonthlySpend(): MonthlySpend {
    this.checkMonthReset();
    return { ...this.monthlySpend };
  }

  /**
   * Get recent alerts
   */
  getAlerts(): BudgetAlert[] {
    return [...this.alerts];
  }

  /**
   * Update budget configuration
   */
  updateConfig(config: Partial<BudgetConfig>): void {
    if (config.monthlyBudgetUsd !== undefined) {
      this.config.monthlyBudgetUsd = config.monthlyBudgetUsd;
    }
    if (config.alertThreshold !== undefined) {
      this.config.alertThreshold = config.alertThreshold;
    }
    if (config.blockOnExceed !== undefined) {
      this.config.blockOnExceed = config.blockOnExceed;
    }
    if (config.onAlert !== undefined) {
      this.config.onAlert = config.onAlert;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<BudgetConfig> {
    return { ...this.config };
  }

  /**
   * Manually reset monthly tracking (for testing)
   */
  resetMonthlyTracking(): void {
    this.monthlySpend = this.createEmptyMonthlySpend();
    this.thresholdAlertTriggered = false;
    this.budgetExceededAlertTriggered = false;
    this.alerts = [];
  }

  /**
   * Set monthly spend directly (for testing or loading saved state)
   */
  setMonthlySpend(spend: Partial<MonthlySpend>): void {
    if (spend.month !== undefined) this.monthlySpend.month = spend.month;
    if (spend.totalSpendUsd !== undefined) this.monthlySpend.totalSpendUsd = spend.totalSpendUsd;
    if (spend.requestCount !== undefined) this.monthlySpend.requestCount = spend.requestCount;
    if (spend.inputTokens !== undefined) this.monthlySpend.inputTokens = spend.inputTokens;
    if (spend.outputTokens !== undefined) this.monthlySpend.outputTokens = spend.outputTokens;
    this.monthlySpend.lastUpdated = new Date().toISOString();
  }
}

// Export singleton instance
export const budgetManager = new BudgetManager();

// Export default
export default BudgetManager;
