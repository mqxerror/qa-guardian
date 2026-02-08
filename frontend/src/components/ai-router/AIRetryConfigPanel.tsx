// AIRetryConfigPanel - Extracted from AIRouterPage.tsx (Feature #405)
// Retry configuration with exponential backoff (Feature #1331)

import { useState } from 'react';
import type { RetryAttempt, RetryStats } from './types';

// Retry configuration type
export interface RetryConfig {
  enabled: boolean;
  max_retries: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  retry_on_timeout: boolean;
  retry_on_rate_limit: boolean;
  retry_on_error: boolean;
}

interface AIRetryConfigPanelProps {
  retryConfig: RetryConfig;
  setRetryConfig: React.Dispatch<React.SetStateAction<RetryConfig>>;
  retryStats: RetryStats;
  setRetryStats: React.Dispatch<React.SetStateAction<RetryStats>>;
  retryLogs: RetryAttempt[];
  setRetryLogs: React.Dispatch<React.SetStateAction<RetryAttempt[]>>;
  fallbackProvider?: string;
}

export function AIRetryConfigPanel({
  retryConfig,
  setRetryConfig,
  retryStats,
  setRetryStats,
  retryLogs,
  setRetryLogs,
  fallbackProvider,
}: AIRetryConfigPanelProps) {
  const [isSimulatingRetry, setIsSimulatingRetry] = useState(false);

  // Calculate exponential backoff delay for a given attempt
  const calculateBackoffDelay = (attempt: number): number => {
    const delay = retryConfig.initial_delay_ms * Math.pow(retryConfig.backoff_multiplier, attempt - 1);
    return Math.min(delay, retryConfig.max_delay_ms);
  };

  // Feature #1331: Simulate retry with exponential backoff
  const simulateRetry = async (errorType: 'timeout' | 'rate_limit' | 'error') => {
    if (!retryConfig.enabled) return;

    setIsSimulatingRetry(true);
    const requestId = `req-${Date.now().toString(36)}`;
    let attempt = 1;
    let success = false;

    while (attempt <= retryConfig.max_retries && !success) {
      const delay = attempt === 1 ? 0 : calculateBackoffDelay(attempt);

      if (delay > 0) {
        await new Promise(r => setTimeout(r, Math.min(delay, 1000))); // Cap at 1s for demo
      }

      // Simulate success probability increasing with each attempt
      success = Math.random() < (0.3 + (attempt * 0.25));

      const newAttempt: RetryAttempt = {
        request_id: requestId,
        attempt_number: attempt,
        timestamp: new Date().toISOString(),
        delay_ms: delay,
        error_type: errorType,
        error_message: success ? '' : `${errorType.replace('_', ' ')} error - attempt ${attempt}`,
        success,
      };

      setRetryLogs(prev => [newAttempt, ...prev.slice(0, 19)]); // Keep last 20 logs

      if (!success) {
        attempt++;
      }
    }

    // Update stats
    setRetryStats(prev => ({
      ...prev,
      total_retries: prev.total_retries + attempt,
      successful_retries: success ? prev.successful_retries + 1 : prev.successful_retries,
      failed_after_retries: success ? prev.failed_after_retries : prev.failed_after_retries + 1,
      by_error_type: {
        ...prev.by_error_type,
        [errorType]: prev.by_error_type[errorType] + attempt,
      },
    }));

    setIsSimulatingRetry(false);

    // If all retries failed, trigger fallback
    if (!success) {
      alert(`All ${retryConfig.max_retries} retries failed for ${errorType}. Triggering fallback to ${fallbackProvider || 'none'}.`);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-4">Retry Configuration</h2>
      <p className="text-sm text-muted-foreground mb-4">Configure automatic retries with exponential backoff for transient failures</p>

      {/* Retry Enable Toggle */}
      <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
        <div>
          <div className="font-medium">Enable Retries</div>
          <div className="text-xs text-muted-foreground">Automatically retry failed AI requests</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={retryConfig.enabled}
            onChange={(e) => setRetryConfig({ ...retryConfig, enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-card after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {retryConfig.enabled && (
        <>
          {/* Retry Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-primary/5 rounded-lg">
              <label className="block text-sm font-medium text-primary mb-1">Max Retries</label>
              <input
                type="number"
                min="1"
                max="10"
                value={retryConfig.max_retries}
                onChange={(e) => setRetryConfig({ ...retryConfig, max_retries: parseInt(e.target.value) || 3 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-input text-foreground"
              />
              <div className="text-xs text-primary mt-1">Number of retry attempts (1-10)</div>
            </div>

            <div className="p-3 bg-warning/5 rounded-lg">
              <label className="block text-sm font-medium text-warning mb-1">Initial Delay (ms)</label>
              <input
                type="number"
                min="50"
                max="5000"
                value={retryConfig.initial_delay_ms}
                onChange={(e) => setRetryConfig({ ...retryConfig, initial_delay_ms: parseInt(e.target.value) || 100 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-warning focus:border-warning bg-input text-foreground"
              />
              <div className="text-xs text-warning mt-1">Initial backoff delay</div>
            </div>

            <div className="p-3 bg-accent/10 rounded-lg">
              <label className="block text-sm font-medium text-accent mb-1">Max Delay (ms)</label>
              <input
                type="number"
                min="1000"
                max="60000"
                value={retryConfig.max_delay_ms}
                onChange={(e) => setRetryConfig({ ...retryConfig, max_delay_ms: parseInt(e.target.value) || 5000 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent bg-input text-foreground"
              />
              <div className="text-xs text-accent mt-1">Maximum backoff delay cap</div>
            </div>

            <div className="p-3 bg-success/5 rounded-lg">
              <label className="block text-sm font-medium text-success mb-1">Backoff Multiplier</label>
              <input
                type="number"
                min="1.5"
                max="4"
                step="0.5"
                value={retryConfig.backoff_multiplier}
                onChange={(e) => setRetryConfig({ ...retryConfig, backoff_multiplier: parseFloat(e.target.value) || 2 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-success focus:border-success bg-input text-foreground"
              />
              <div className="text-xs text-success mt-1">Exponential multiplier (1.5-4)</div>
            </div>
          </div>

          {/* Retry Conditions */}
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Retry Conditions</h3>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
                <input
                  type="checkbox"
                  checked={retryConfig.retry_on_timeout}
                  onChange={(e) => setRetryConfig({ ...retryConfig, retry_on_timeout: e.target.checked })}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <span className="text-sm">Timeout</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
                <input
                  type="checkbox"
                  checked={retryConfig.retry_on_rate_limit}
                  onChange={(e) => setRetryConfig({ ...retryConfig, retry_on_rate_limit: e.target.checked })}
                  className="w-4 h-4 text-accent rounded focus:ring-accent"
                />
                <span className="text-sm">Rate Limit</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
                <input
                  type="checkbox"
                  checked={retryConfig.retry_on_error}
                  onChange={(e) => setRetryConfig({ ...retryConfig, retry_on_error: e.target.checked })}
                  className="w-4 h-4 text-destructive rounded focus:ring-destructive"
                />
                <span className="text-sm">Server Error</span>
              </label>
            </div>
          </div>

          {/* Backoff Preview */}
          <div className="mb-4 p-3 bg-gradient-to-r from-primary/5 to-accent/10 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Backoff Preview</h3>
            <div className="flex items-end gap-1 h-16">
              {Array.from({ length: retryConfig.max_retries }, (_, i) => {
                const delay = calculateBackoffDelay(i + 1);
                const maxHeight = 64;
                const height = (delay / retryConfig.max_delay_ms) * maxHeight;
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div
                      className="w-8 bg-gradient-to-t from-primary to-accent rounded-t transition-all"
                      style={{ height: `${Math.max(height, 8)}px` }}
                      title={`Attempt ${i + 1}: ${delay}ms`}
                    />
                    <div className="text-xs text-muted-foreground mt-1">#{i + 1}</div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-foreground mt-2">
              Delays: {Array.from({ length: retryConfig.max_retries }, (_, i) => `${calculateBackoffDelay(i + 1)}ms`).join(' -> ')}
            </div>
          </div>

          {/* Retry Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-3 bg-primary/5 rounded-lg">
              <div className="text-2xl font-bold text-primary">{retryStats.total_retries}</div>
              <div className="text-xs text-primary">Total Retries</div>
            </div>
            <div className="text-center p-3 bg-success/5 rounded-lg">
              <div className="text-2xl font-bold text-success">{retryStats.successful_retries}</div>
              <div className="text-xs text-success">Successful</div>
            </div>
            <div className="text-center p-3 bg-destructive/5 rounded-lg">
              <div className="text-2xl font-bold text-destructive">{retryStats.failed_after_retries}</div>
              <div className="text-xs text-destructive">Failed</div>
            </div>
            <div className="text-center p-3 bg-accent/10 rounded-lg">
              <div className="text-2xl font-bold text-accent">{retryStats.avg_retries_before_success.toFixed(1)}</div>
              <div className="text-xs text-accent">Avg Attempts</div>
            </div>
          </div>

          {/* Error Type Breakdown */}
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Retries by Error Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="flex items-center gap-2 p-2 bg-warning/5 rounded">
                <span>Timeout</span>
                <div>
                  <div className="text-sm font-medium">{retryStats.by_error_type.timeout}</div>
                  <div className="text-xs text-muted-foreground">Timeout</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-accent/10 rounded">
                <span>Rate</span>
                <div>
                  <div className="text-sm font-medium">{retryStats.by_error_type.rate_limit}</div>
                  <div className="text-xs text-muted-foreground">Rate Limit</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-destructive/5 rounded">
                <span>Error</span>
                <div>
                  <div className="text-sm font-medium">{retryStats.by_error_type.error}</div>
                  <div className="text-xs text-muted-foreground">Client Error</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <span>Server</span>
                <div>
                  <div className="text-sm font-medium">{retryStats.by_error_type.server_error}</div>
                  <div className="text-xs text-muted-foreground">Server Error</div>
                </div>
              </div>
            </div>
          </div>

          {/* Simulate Retry Buttons */}
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Simulate Retry Scenarios</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => simulateRetry('timeout')}
                disabled={isSimulatingRetry}
                className="px-4 py-2 bg-warning/10 text-warning rounded-lg hover:bg-warning/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSimulatingRetry ? 'Simulating...' : 'Timeout Retry'}
              </button>
              <button
                onClick={() => simulateRetry('rate_limit')}
                disabled={isSimulatingRetry}
                className="px-4 py-2 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSimulatingRetry ? 'Simulating...' : 'Rate Limit Retry'}
              </button>
              <button
                onClick={() => simulateRetry('error')}
                disabled={isSimulatingRetry}
                className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSimulatingRetry ? 'Simulating...' : 'Error Retry'}
              </button>
            </div>
          </div>

          {/* Retry Logs */}
          <div>
            <h3 className="text-sm font-medium mb-2">Retry Event Logs</h3>
            {retryLogs.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground bg-muted/50 rounded-lg">
                <div className="text-2xl mb-2">No logs</div>
                <div className="text-sm">No retry events logged yet</div>
                <div className="text-xs text-muted-foreground mt-1">Simulate a retry scenario to see logs</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {retryLogs.slice().reverse().map((log, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded border text-sm ${
                      log.success ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{log.success ? 'OK' : 'Retry'}</span>
                      <div>
                        <div className="font-medium">
                          {log.request_id} - Attempt #{log.attempt_number}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.error_type.toUpperCase()} - {log.error_message}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium">{log.delay_ms}ms delay</div>
                      <div className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
