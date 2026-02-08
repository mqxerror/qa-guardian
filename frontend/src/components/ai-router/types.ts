// AI Router Types - Extracted from AIRouterPage.tsx (Feature #405)
// Shared type definitions for AI Router components

export interface AIRouterConfig {
  primary_provider: 'kie' | 'anthropic';
  fallback_provider: 'anthropic' | 'kie' | 'none';
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
  logging: {
    log_provider_switches: boolean;
    log_failures: boolean;
    log_latency: boolean;
  };
  retry: {
    enabled: boolean;
    max_retries: number;
    initial_delay_ms: number;
    max_delay_ms: number;
    backoff_multiplier: number;
    retry_on_timeout: boolean;
    retry_on_rate_limit: boolean;
    retry_on_error: boolean;
  };
}

// Feature #1331: Request retry tracking
export interface RetryAttempt {
  request_id: string;
  attempt_number: number;
  timestamp: string;
  delay_ms: number;
  error_type: 'timeout' | 'rate_limit' | 'error' | 'server_error';
  error_message: string;
  success: boolean;
}

export interface RetryStats {
  total_retries: number;
  successful_retries: number;
  failed_after_retries: number;
  avg_retries_before_success: number;
  avg_retry_delay_ms: number;
  by_error_type: {
    timeout: number;
    rate_limit: number;
    error: number;
    server_error: number;
  };
}

// Feature #1334: Per-feature timeout configuration
export type AIFeatureType = 'chat' | 'completion' | 'embedding' | 'analysis' | 'code_review' | 'test_generation';

export interface FeatureTimeout {
  feature: AIFeatureType;
  name: string;
  description: string;
  timeout_ms: number;
  enabled: boolean;
  fallback_on_timeout: boolean;
}

// Feature #1333: Model selection per feature
export type AIModelType = 'claude-opus-4.5-thinking' | 'claude-opus-4.5' | 'claude-sonnet-4' | 'claude-haiku-3.5';

export interface FeatureModelConfig {
  feature: AIFeatureType;
  name: string;
  description: string;
  model: AIModelType;
  enabled: boolean;
  override_org_default: boolean;
  cost_per_1k_tokens: number;
  avg_latency_ms: number;
  quality_tier: 'premium' | 'standard' | 'economy';
}

export interface ModelUsageStats {
  feature: AIFeatureType;
  model: AIModelType;
  request_count: number;
  total_tokens: number;
  total_cost_cents: number;
  avg_latency_ms: number;
  last_used: string;
}

export interface TimeoutEvent {
  id: string;
  timestamp: string;
  feature: AIFeatureType;
  configured_timeout_ms: number;
  actual_duration_ms: number;
  provider: string;
  triggered_fallback: boolean;
  fallback_success?: boolean;
  error_message?: string;
}

export interface TimeoutStats {
  total_timeouts: number;
  timeouts_by_feature: Record<AIFeatureType, number>;
  avg_timeout_duration_ms: number;
  fallback_success_rate: number;
  most_timeout_prone_feature: AIFeatureType | null;
}

// Feature #1335: Provider-specific rate limiting
export type RateLimitStrategy = 'queue' | 'retry' | 'failover' | 'drop';

export interface ProviderRateLimitConfig {
  provider: 'kie' | 'anthropic';
  provider_name: string;
  enabled: boolean;
  requests_per_minute: number;
  requests_per_hour: number;
  tokens_per_minute: number;
  burst_allowance: number;
  queue_max_size: number;
  queue_timeout_ms: number;
  strategy_on_limit: RateLimitStrategy;
  auto_distribute: boolean;
  alert_threshold_percent: number;
}

export interface ProviderRateLimitStatus {
  provider: 'kie' | 'anthropic';
  requests_remaining_minute: number;
  requests_remaining_hour: number;
  tokens_remaining_minute: number;
  reset_at_minute: string;
  reset_at_hour: string;
  current_queue_size: number;
  queued_requests: QueuedRequest[];
  is_rate_limited: boolean;
  time_until_available_ms: number;
  last_rate_limit_hit: string | null;
  rate_limit_hits_1h: number;
  rate_limit_hits_24h: number;
}

export interface QueuedRequest {
  id: string;
  feature: AIFeatureType;
  enqueued_at: string;
  estimated_wait_ms: number;
  priority: 'high' | 'normal' | 'low';
  tokens_estimate: number;
  status: 'queued' | 'processing' | 'completed' | 'dropped';
}

export interface RateLimitEvent {
  id: string;
  timestamp: string;
  provider: 'kie' | 'anthropic';
  feature: AIFeatureType;
  event_type: 'limit_hit' | 'request_queued' | 'request_dropped' | 'failover_triggered' | 'limit_cleared';
  details: string;
  requests_remaining: number;
  queue_position?: number;
  wait_time_ms?: number;
}

export interface RateLimitAlert {
  id: string;
  timestamp: string;
  provider: 'kie' | 'anthropic';
  alert_type: 'sustained_limiting' | 'queue_full' | 'high_wait_time' | 'limit_approaching';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  threshold_value: number;
  actual_value: number;
  acknowledged: boolean;
}

// Feature #1339: Fallback rules configuration
export type FallbackTrigger = 'error' | 'timeout' | 'rate_limit' | 'server_error' | 'network_error';

export interface FallbackRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  triggers: FallbackTrigger[];
  source_provider: 'kie' | 'anthropic' | 'any';
  target_provider: 'kie' | 'anthropic' | 'none';
  retry_before_fallback: number;
  timeout_threshold_ms: number;
  retry_delay_ms: number;
  max_fallback_attempts: number;
  preserve_context: boolean;
  log_fallback: boolean;
  notify_on_fallback: boolean;
  cooldown_after_fallback_ms: number;
}

export interface FallbackTestResult {
  rule_id: string;
  trigger: FallbackTrigger;
  timestamp: string;
  source_provider: string;
  target_provider: string;
  success: boolean;
  fallback_latency_ms: number;
  retries_attempted: number;
  error_message?: string;
}

export interface FallbackStats {
  total_fallbacks_24h: number;
  successful_fallbacks_24h: number;
  failed_fallbacks_24h: number;
  avg_fallback_latency_ms: number;
  by_trigger: Record<FallbackTrigger, number>;
  by_rule: Record<string, { triggered: number; success_rate: number }>;
}

// Feature #1329: Monthly AI Budget Limits
export interface AIBudgetConfig {
  monthly_budget_cents: number;
  soft_limit_percentage: number;
  hard_limit_percentage: number;
  alert_on_soft_limit: boolean;
  block_on_hard_limit: boolean;
  billing_cycle_day: number;
  rollover_enabled: boolean;
  rollover_cap_percentage: number;
}

export interface AISpendingData {
  current_month_spend_cents: number;
  last_month_spend_cents: number;
  daily_spend: { date: string; amount_cents: number }[];
  by_feature: Record<AIFeatureType, number>;
  by_provider: Record<string, number>;
  requests_this_month: number;
  avg_cost_per_request_cents: number;
}

export interface BudgetAlert {
  id: string;
  timestamp: string;
  type: 'soft_limit' | 'hard_limit' | 'approaching' | 'reset';
  percentage: number;
  message: string;
  acknowledged: boolean;
}

// Feature #1330: AI Cost Alert Notifications
export interface CostAlertThreshold {
  percentage: number;
  enabled: boolean;
  email_enabled: boolean;
  slack_enabled: boolean;
  last_triggered?: string;
}

export interface AlertNotificationConfig {
  thresholds: CostAlertThreshold[];
  email_recipients: string[];
  slack_webhook_url: string;
  slack_channel: string;
  slack_enabled: boolean;
  email_enabled: boolean;
  include_breakdown: boolean;
  include_suggestions: boolean;
  cooldown_minutes: number;
}

export interface CostAlertNotification {
  id: string;
  timestamp: string;
  threshold_percentage: number;
  current_percentage: number;
  spend_amount_cents: number;
  budget_amount_cents: number;
  channels_sent: ('email' | 'slack')[];
  recipients: string[];
  breakdown_included: boolean;
  suggestions_included: boolean;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
}

export interface CostReductionSuggestion {
  id: string;
  category: 'caching' | 'batching' | 'model_downgrade' | 'rate_limiting' | 'feature_disable';
  title: string;
  description: string;
  estimated_savings_percent: number;
  priority: 'high' | 'medium' | 'low';
  action_url?: string;
}

// Feature #1332: AI Response Caching
export interface AICacheConfig {
  enabled: boolean;
  default_ttl_seconds: number;
  max_cache_size_mb: number;
  cache_by_feature: Record<AIFeatureType, { enabled: boolean; ttl_seconds: number }>;
  invalidate_on_model_change: boolean;
  invalidate_on_prompt_change: boolean;
  hash_algorithm: 'sha256' | 'md5' | 'xxhash';
}

export interface CacheEntry {
  id: string;
  cache_key: string;
  request_hash: string;
  feature_type: AIFeatureType;
  provider: string;
  model: string;
  created_at: string;
  expires_at: string;
  hit_count: number;
  last_hit_at?: string;
  response_size_bytes: number;
  ttl_seconds: number;
  status: 'active' | 'expired' | 'invalidated';
}

export interface CacheStats {
  total_entries: number;
  active_entries: number;
  total_hits: number;
  total_misses: number;
  hit_rate_percent: number;
  cache_size_mb: number;
  max_size_mb: number;
  estimated_cost_savings_cents: number;
  estimated_latency_savings_ms: number;
  by_feature: Record<AIFeatureType, { hits: number; misses: number; entries: number }>;
}

export interface CacheEvent {
  id: string;
  timestamp: string;
  type: 'hit' | 'miss' | 'store' | 'invalidate' | 'expire' | 'evict';
  cache_key: string;
  feature_type: AIFeatureType;
  latency_saved_ms?: number;
  cost_saved_cents?: number;
  reason?: string;
}

export interface RouterStats {
  total_requests: number;
  primary_requests: number;
  fallback_requests: number;
  fallback_successes: number;
  fallback_failures: number;
  timeouts: number;
  rate_limits: number;
  errors: number;
  avg_latency_ms: number;
  primary_success_rate: number;
  fallback_success_rate: number;
  circuit_breaker_trips: number;
}

export interface CircuitBreakerState {
  provider: string;
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  last_failure_time?: string;
  last_success_time?: string;
  recovery_at?: string;
}

export interface ProviderSwitchLog {
  id: string;
  timestamp: string;
  from_provider: string;
  to_provider: string;
  reason: string;
  success: boolean;
  latency_ms?: number;
  error_message?: string;
}

// Feature #1327: Provider Switching Without Restart
export interface ActiveProviderState {
  org_id: string;
  current_provider: 'kie' | 'anthropic';
  switching: boolean;
  switch_started_at?: string;
  pending_requests: number;
  last_switch?: {
    id: string;
    from: string;
    to: string;
    reason: string;
    switched_at: string;
    switched_by: string;
  };
  available_providers: Array<{
    id: string;
    name: string;
    enabled: boolean;
    configured: boolean;
    description: string;
  }>;
  router_enabled: boolean;
}

export interface ProviderChangeLog {
  id: string;
  timestamp: string;
  from_provider: string;
  to_provider: string;
  reason: string;
  switched_by: string;
  switch_type: 'manual' | 'automatic';
  graceful: boolean;
  requests_drained: number;
  switch_duration_ms: number;
  service_interruption_ms: number;
  success: boolean;
  error_message?: string;
}

export interface ProviderSwitchResult {
  success: boolean;
  previous_provider?: string;
  new_provider?: string;
  switch_id?: string;
  switched_at?: string;
  reason?: string;
  requests_drained?: number;
  switch_duration_ms?: number;
  service_interruption_ms?: number;
  message?: string;
  error?: string;
}

// Feature #1337: AI API Key Management
// Feature #1328: AI API Key Rotation Support (Zero-Downtime)
export interface APIKeyConfig {
  id: string;
  provider: 'kie' | 'anthropic';
  name: string;
  key_prefix: string;
  key_suffix: string;
  created_at: string;
  last_used_at: string | null;
  last_rotated_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  permissions: string[];
  usage_count: number;
  rate_limit_remaining: number | null;
  version: number;
  role: 'primary' | 'standby' | 'retiring';
  traffic_percentage: number;
  rotation_status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  rotation_started_at?: string;
}

export interface APIKeyAuditLog {
  id: string;
  timestamp: string;
  action: 'created' | 'rotated' | 'deleted' | 'activated' | 'deactivated' | 'tested' | 'updated';
  provider: 'kie' | 'anthropic';
  key_name: string;
  performed_by: string;
  ip_address: string;
  user_agent?: string;
  details?: string;
  success: boolean;
  error_message?: string;
}

export interface KeyTestResult {
  provider: 'kie' | 'anthropic';
  success: boolean;
  latency_ms: number;
  rate_limit_remaining: number | null;
  models_available: string[];
  error?: string;
  tested_at: string;
}

// Helper functions for AI Router
export function getFeatureIcon(feature: AIFeatureType): string {
  const icons: Record<AIFeatureType, string> = {
    chat: '💬',
    completion: '✍️',
    embedding: '🔗',
    analysis: '🔍',
    code_review: '📝',
    test_generation: '🧪',
  };
  return icons[feature] || '⚙️';
}

export function getModelInfo(model: AIModelType): {
  name: string;
  icon: string;
  tier: string;
  cost: number;
  latency: string;
  costBadge: string;
  description: string;
} {
  const modelInfo: Record<AIModelType, ReturnType<typeof getModelInfo>> = {
    'claude-opus-4.5-thinking': {
      name: 'Opus 4.5 Thinking',
      icon: '🧠',
      tier: 'Premium',
      cost: 0.015,
      latency: '2000ms',
      costBadge: '$$$',
      description: 'Deep reasoning with extended thinking',
    },
    'claude-opus-4.5': {
      name: 'Opus 4.5',
      icon: '🎯',
      tier: 'Premium',
      cost: 0.015,
      latency: '1200ms',
      costBadge: '$$$',
      description: 'Highest quality, complex tasks',
    },
    'claude-sonnet-4': {
      name: 'Sonnet 4',
      icon: '⚡',
      tier: 'Standard',
      cost: 0.003,
      latency: '450ms',
      costBadge: '$$',
      description: 'Balanced quality and speed',
    },
    'claude-haiku-3.5': {
      name: 'Haiku 3.5',
      icon: '🚀',
      tier: 'Economy',
      cost: 0.00025,
      latency: '200ms',
      costBadge: '$',
      description: 'Fast, cost-effective tasks',
    },
  };
  return modelInfo[model] || modelInfo['claude-sonnet-4'];
}

export function getQualityTierColor(tier: 'premium' | 'standard' | 'economy'): string {
  const colors: Record<typeof tier, string> = {
    premium: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    standard: 'bg-primary/10 text-primary border-primary/20',
    economy: 'bg-success/10 text-success border-success/20',
  };
  return colors[tier];
}

export function formatTimeoutDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
