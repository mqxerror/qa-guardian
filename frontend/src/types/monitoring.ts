/**
 * Monitoring domain type definitions
 *
 * Types for provider health monitoring, alerts, and health configuration.
 */

// ============================================================================
// Provider Health (Feature #1324)
// ============================================================================

export interface ProviderHealthMetrics {
  provider: 'kie' | 'anthropic';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  availability_percent: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  error_rate_percent: number;
  request_count_1h: number;
  request_count_24h: number;
  last_success: string | null;
  last_failure: string | null;
  last_check: string;
  uptime_percent_24h: number;
  errors_by_type: {
    timeout: number;
    rate_limit: number;
    server_error: number;
    network_error: number;
    auth_error: number;
    other: number;
  };
}

export interface HealthAlert {
  id: string;
  provider: 'kie' | 'anthropic';
  alert_type: 'degradation' | 'outage' | 'recovery' | 'latency_spike' | 'error_rate_high';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_at: string;
  resolved_at: string | null;
  acknowledged: boolean;
  acknowledged_by?: string;
  threshold_value?: number;
  actual_value?: number;
}

export interface HealthAlertConfig {
  org_id: string;
  enabled: boolean;
  thresholds: {
    latency_warning_ms: number;
    latency_critical_ms: number;
    error_rate_warning_percent: number;
    error_rate_critical_percent: number;
    availability_warning_percent: number;
    availability_critical_percent: number;
  };
  notification_channels: {
    email: boolean;
    slack: boolean;
    webhook: boolean;
  };
  cooldown_minutes: number;
}
