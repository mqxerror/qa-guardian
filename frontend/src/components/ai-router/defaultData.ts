// Default mock data for AI Router page state initialization
// Extracted from AIRouterPage.tsx to reduce file size

import type {
  APIKeyConfig, APIKeyAuditLog, RetryAttempt, RetryStats,
  FeatureTimeout, TimeoutEvent, TimeoutStats, AIModelType,
  FeatureModelConfig, ModelUsageStats,
  ProviderRateLimitConfig, ProviderRateLimitStatus, RateLimitEvent, RateLimitAlert,
  FallbackRule, FallbackTestResult, FallbackStats,
  AIBudgetConfig, AISpendingData, BudgetAlert,
  AICacheConfig, CacheStats, CacheEntry, CacheEvent,
} from './types';
import type { RetryConfig } from './AIRetryConfigPanel';

export const DEFAULT_API_KEYS: APIKeyConfig[] = [
  {
    id: 'key-kie-1', provider: 'kie', name: 'Kie.ai Production Key',
    key_prefix: 'kie_prod', key_suffix: '...7x9z',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    last_used_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    last_rotated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true, permissions: ['chat', 'completions', 'embeddings'],
    usage_count: 15420, rate_limit_remaining: 9500, version: 2, role: 'primary', traffic_percentage: 100,
  },
  {
    id: 'key-kie-2', provider: 'kie', name: 'Kie.ai Standby Key',
    key_prefix: 'kie_stby', key_suffix: '...3k8m',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    last_used_at: null, last_rotated_at: null,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true, permissions: ['chat', 'completions', 'embeddings'],
    usage_count: 0, rate_limit_remaining: 10000, version: 3, role: 'standby', traffic_percentage: 0,
  },
  {
    id: 'key-anthropic-1', provider: 'anthropic', name: 'Anthropic API Key',
    key_prefix: 'sk-ant-a', key_suffix: '...mK4Q',
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    last_used_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    last_rotated_at: null, expires_at: null,
    is_active: true, permissions: ['messages', 'completions'],
    usage_count: 3250, rate_limit_remaining: 4000, version: 1, role: 'primary', traffic_percentage: 100,
  },
];

export const DEFAULT_KEY_AUDIT_LOGS: APIKeyAuditLog[] = [
  { id: 'audit-1', timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), action: 'rotated', provider: 'kie', key_name: 'Kie.ai Production Key', performed_by: 'admin@company.com', ip_address: '192.168.1.100', details: 'Scheduled rotation', success: true },
  { id: 'audit-2', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), action: 'created', provider: 'kie', key_name: 'Kie.ai Standby Key', performed_by: 'admin@company.com', ip_address: '192.168.1.100', details: 'Standby key for rotation', success: true },
  { id: 'audit-3', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), action: 'tested', provider: 'anthropic', key_name: 'Anthropic API Key', performed_by: 'admin@company.com', ip_address: '192.168.1.100', details: 'Connection test passed', success: true },
];

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: true, max_retries: 3, initial_delay_ms: 100, max_delay_ms: 5000,
  backoff_multiplier: 2, retry_on_timeout: true, retry_on_rate_limit: true, retry_on_error: true,
};

export const DEFAULT_RETRY_STATS: RetryStats = {
  total_retries: 47, successful_retries: 38, failed_after_retries: 9,
  avg_retries_before_success: 1.8, avg_retry_delay_ms: 312,
  by_error_type: { timeout: 12, rate_limit: 18, error: 11, server_error: 6 },
};

export const DEFAULT_RETRY_LOGS: RetryAttempt[] = [
  { request_id: 'req-001', attempt_number: 1, timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), delay_ms: 100, error_type: 'timeout', error_message: 'Request timeout after 30000ms', success: false },
  { request_id: 'req-001', attempt_number: 2, timestamp: new Date(Date.now() - 5 * 60 * 1000 + 200).toISOString(), delay_ms: 200, error_type: 'timeout', error_message: 'Request timeout after 30000ms', success: false },
  { request_id: 'req-001', attempt_number: 3, timestamp: new Date(Date.now() - 5 * 60 * 1000 + 600).toISOString(), delay_ms: 0, error_type: 'timeout', error_message: '', success: true },
  { request_id: 'req-002', attempt_number: 1, timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), delay_ms: 100, error_type: 'rate_limit', error_message: 'Rate limit exceeded. Retry after 1s.', success: false },
  { request_id: 'req-002', attempt_number: 2, timestamp: new Date(Date.now() - 10 * 60 * 1000 + 1200).toISOString(), delay_ms: 0, error_type: 'rate_limit', error_message: '', success: true },
];

export const DEFAULT_FEATURE_TIMEOUTS: FeatureTimeout[] = [
  { feature: 'chat', name: 'Chat Completion', description: 'Interactive chat responses', timeout_ms: 30000, enabled: true, fallback_on_timeout: true },
  { feature: 'completion', name: 'Text Completion', description: 'Code/text completions', timeout_ms: 45000, enabled: true, fallback_on_timeout: true },
  { feature: 'embedding', name: 'Embeddings', description: 'Vector embeddings generation', timeout_ms: 15000, enabled: true, fallback_on_timeout: false },
  { feature: 'analysis', name: 'Test Analysis', description: 'AI-powered test analysis', timeout_ms: 60000, enabled: true, fallback_on_timeout: true },
  { feature: 'code_review', name: 'Code Review', description: 'AI code review suggestions', timeout_ms: 90000, enabled: true, fallback_on_timeout: true },
  { feature: 'test_generation', name: 'Test Generation', description: 'Automated test creation', timeout_ms: 120000, enabled: true, fallback_on_timeout: true },
];

export const DEFAULT_TIMEOUT_EVENTS: TimeoutEvent[] = [
  { id: 'to-001', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), feature: 'code_review', configured_timeout_ms: 90000, actual_duration_ms: 92500, provider: 'kie', triggered_fallback: true, fallback_success: true },
  { id: 'to-002', timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), feature: 'test_generation', configured_timeout_ms: 120000, actual_duration_ms: 125000, provider: 'anthropic', triggered_fallback: false, error_message: 'Request cancelled by user' },
  { id: 'to-003', timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(), feature: 'chat', configured_timeout_ms: 30000, actual_duration_ms: 31200, provider: 'kie', triggered_fallback: true, fallback_success: true },
];

export const DEFAULT_TIMEOUT_STATS: TimeoutStats = {
  total_timeouts: 23,
  timeouts_by_feature: { chat: 5, completion: 3, embedding: 1, analysis: 4, code_review: 6, test_generation: 4 },
  avg_timeout_duration_ms: 2500, fallback_success_rate: 87.5, most_timeout_prone_feature: 'code_review',
};

export const DEFAULT_ORG_MODEL: AIModelType = 'claude-sonnet-4';

export const DEFAULT_FEATURE_MODEL_CONFIGS: FeatureModelConfig[] = [
  { feature: 'chat', name: 'Chat Completion', description: 'Interactive chat & conversations', model: 'claude-sonnet-4', enabled: true, override_org_default: false, cost_per_1k_tokens: 0.003, avg_latency_ms: 450, quality_tier: 'standard' },
  { feature: 'completion', name: 'Text Completion', description: 'Code & text completions', model: 'claude-sonnet-4', enabled: true, override_org_default: false, cost_per_1k_tokens: 0.003, avg_latency_ms: 380, quality_tier: 'standard' },
  { feature: 'embedding', name: 'Embeddings', description: 'Vector embeddings generation', model: 'claude-haiku-3.5', enabled: true, override_org_default: true, cost_per_1k_tokens: 0.00025, avg_latency_ms: 120, quality_tier: 'economy' },
  { feature: 'analysis', name: 'Test Analysis', description: 'AI-powered test analysis & insights', model: 'claude-opus-4.5-thinking', enabled: true, override_org_default: true, cost_per_1k_tokens: 0.015, avg_latency_ms: 2500, quality_tier: 'premium' },
  { feature: 'code_review', name: 'Code Review', description: 'AI code review suggestions', model: 'claude-opus-4.5', enabled: true, override_org_default: true, cost_per_1k_tokens: 0.015, avg_latency_ms: 1800, quality_tier: 'premium' },
  { feature: 'test_generation', name: 'Test Generation', description: 'Automated test creation', model: 'claude-opus-4.5-thinking', enabled: true, override_org_default: true, cost_per_1k_tokens: 0.015, avg_latency_ms: 3200, quality_tier: 'premium' },
];

export const DEFAULT_MODEL_USAGE_STATS: ModelUsageStats[] = [
  { feature: 'chat', model: 'claude-sonnet-4', request_count: 8420, total_tokens: 2105000, total_cost_cents: 6315, avg_latency_ms: 445, last_used: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  { feature: 'completion', model: 'claude-sonnet-4', request_count: 5120, total_tokens: 1024000, total_cost_cents: 3072, avg_latency_ms: 372, last_used: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
  { feature: 'embedding', model: 'claude-haiku-3.5', request_count: 12350, total_tokens: 617500, total_cost_cents: 154, avg_latency_ms: 118, last_used: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
  { feature: 'analysis', model: 'claude-opus-4.5-thinking', request_count: 890, total_tokens: 890000, total_cost_cents: 13350, avg_latency_ms: 2480, last_used: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { feature: 'code_review', model: 'claude-opus-4.5', request_count: 520, total_tokens: 416000, total_cost_cents: 6240, avg_latency_ms: 1750, last_used: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  { feature: 'test_generation', model: 'claude-opus-4.5-thinking', request_count: 280, total_tokens: 560000, total_cost_cents: 8400, avg_latency_ms: 3150, last_used: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
];

export const DEFAULT_RATE_LIMIT_CONFIGS: ProviderRateLimitConfig[] = [
  { provider: 'kie', provider_name: 'Kie.ai', enabled: true, requests_per_minute: 60, requests_per_hour: 1000, tokens_per_minute: 100000, burst_allowance: 10, queue_max_size: 50, queue_timeout_ms: 30000, strategy_on_limit: 'queue', auto_distribute: true, alert_threshold_percent: 80 },
  { provider: 'anthropic', provider_name: 'Anthropic', enabled: true, requests_per_minute: 50, requests_per_hour: 500, tokens_per_minute: 80000, burst_allowance: 5, queue_max_size: 30, queue_timeout_ms: 45000, strategy_on_limit: 'failover', auto_distribute: true, alert_threshold_percent: 75 },
];

export const DEFAULT_RATE_LIMIT_STATUS: ProviderRateLimitStatus[] = [
  { provider: 'kie', requests_remaining_minute: 42, requests_remaining_hour: 856, tokens_remaining_minute: 72500, reset_at_minute: new Date(Date.now() + 38 * 1000).toISOString(), reset_at_hour: new Date(Date.now() + 42 * 60 * 1000).toISOString(), current_queue_size: 3, queued_requests: [{ id: 'req-001', feature: 'chat', enqueued_at: new Date(Date.now() - 2000).toISOString(), estimated_wait_ms: 1500, priority: 'high', tokens_estimate: 1200, status: 'queued' }, { id: 'req-002', feature: 'analysis', enqueued_at: new Date(Date.now() - 1500).toISOString(), estimated_wait_ms: 3000, priority: 'normal', tokens_estimate: 5000, status: 'queued' }, { id: 'req-003', feature: 'completion', enqueued_at: new Date(Date.now() - 800).toISOString(), estimated_wait_ms: 4200, priority: 'low', tokens_estimate: 800, status: 'queued' }], is_rate_limited: false, time_until_available_ms: 0, last_rate_limit_hit: new Date(Date.now() - 15 * 60 * 1000).toISOString(), rate_limit_hits_1h: 2, rate_limit_hits_24h: 8 },
  { provider: 'anthropic', requests_remaining_minute: 12, requests_remaining_hour: 245, tokens_remaining_minute: 28000, reset_at_minute: new Date(Date.now() + 22 * 1000).toISOString(), reset_at_hour: new Date(Date.now() + 28 * 60 * 1000).toISOString(), current_queue_size: 0, queued_requests: [], is_rate_limited: true, time_until_available_ms: 22000, last_rate_limit_hit: new Date(Date.now() - 2 * 60 * 1000).toISOString(), rate_limit_hits_1h: 5, rate_limit_hits_24h: 18 },
];

export const DEFAULT_RATE_LIMIT_EVENTS: RateLimitEvent[] = [
  { id: 'evt-001', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), provider: 'anthropic', feature: 'chat', event_type: 'limit_hit', details: 'Rate limit reached: 50/50 requests per minute', requests_remaining: 0 },
  { id: 'evt-002', timestamp: new Date(Date.now() - 2 * 60 * 1000 + 500).toISOString(), provider: 'anthropic', feature: 'chat', event_type: 'failover_triggered', details: 'Failover to Kie.ai initiated', requests_remaining: 0 },
  { id: 'evt-003', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), provider: 'kie', feature: 'analysis', event_type: 'limit_hit', details: 'Rate limit reached: 60/60 requests per minute', requests_remaining: 0 },
  { id: 'evt-004', timestamp: new Date(Date.now() - 15 * 60 * 1000 + 200).toISOString(), provider: 'kie', feature: 'analysis', event_type: 'request_queued', details: 'Request queued for processing', requests_remaining: 0, queue_position: 1, wait_time_ms: 1500 },
  { id: 'evt-005', timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(), provider: 'kie', feature: 'analysis', event_type: 'limit_cleared', details: 'Rate limit reset, processing queued requests', requests_remaining: 60 },
];

export const DEFAULT_RATE_LIMIT_ALERTS: RateLimitAlert[] = [
  { id: 'alert-rl-001', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), provider: 'anthropic', alert_type: 'sustained_limiting', severity: 'warning', message: 'Anthropic has been rate limited 5 times in the last hour', threshold_value: 3, actual_value: 5, acknowledged: false },
  { id: 'alert-rl-002', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), provider: 'kie', alert_type: 'limit_approaching', severity: 'info', message: 'Kie.ai usage at 82% of hourly limit', threshold_value: 80, actual_value: 82, acknowledged: true },
];

export const DEFAULT_FALLBACK_RULES: FallbackRule[] = [
  { id: 'rule-1', name: 'Timeout Fallback', enabled: true, priority: 1, triggers: ['timeout'], source_provider: 'kie', target_provider: 'anthropic', retry_before_fallback: 2, timeout_threshold_ms: 30000, retry_delay_ms: 1000, max_fallback_attempts: 3, preserve_context: true, log_fallback: true, notify_on_fallback: false, cooldown_after_fallback_ms: 5000 },
  { id: 'rule-2', name: 'Rate Limit Failover', enabled: true, priority: 2, triggers: ['rate_limit'], source_provider: 'any', target_provider: 'anthropic', retry_before_fallback: 0, timeout_threshold_ms: 60000, retry_delay_ms: 500, max_fallback_attempts: 1, preserve_context: true, log_fallback: true, notify_on_fallback: true, cooldown_after_fallback_ms: 10000 },
  { id: 'rule-3', name: 'Error Recovery', enabled: true, priority: 3, triggers: ['error', 'server_error'], source_provider: 'any', target_provider: 'anthropic', retry_before_fallback: 3, timeout_threshold_ms: 45000, retry_delay_ms: 2000, max_fallback_attempts: 2, preserve_context: false, log_fallback: true, notify_on_fallback: true, cooldown_after_fallback_ms: 15000 },
  { id: 'rule-4', name: 'Network Failover', enabled: false, priority: 4, triggers: ['network_error'], source_provider: 'any', target_provider: 'kie', retry_before_fallback: 1, timeout_threshold_ms: 20000, retry_delay_ms: 3000, max_fallback_attempts: 2, preserve_context: true, log_fallback: true, notify_on_fallback: false, cooldown_after_fallback_ms: 20000 },
];

export const DEFAULT_FALLBACK_TEST_RESULTS: FallbackTestResult[] = [
  { rule_id: 'rule-1', trigger: 'timeout', timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), source_provider: 'Kie.ai', target_provider: 'Anthropic', success: true, fallback_latency_ms: 245, retries_attempted: 2 },
  { rule_id: 'rule-2', trigger: 'rate_limit', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), source_provider: 'Kie.ai', target_provider: 'Anthropic', success: true, fallback_latency_ms: 89, retries_attempted: 0 },
  { rule_id: 'rule-3', trigger: 'server_error', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), source_provider: 'Anthropic', target_provider: 'Anthropic', success: false, fallback_latency_ms: 3500, retries_attempted: 3, error_message: 'Max fallback attempts exceeded' },
];

export const DEFAULT_FALLBACK_STATS: FallbackStats = {
  total_fallbacks_24h: 12, successful_fallbacks_24h: 10, failed_fallbacks_24h: 2, avg_fallback_latency_ms: 312,
  by_trigger: { error: 3, timeout: 5, rate_limit: 3, server_error: 1, network_error: 0 },
  by_rule: { 'rule-1': { triggered: 5, success_rate: 100 }, 'rule-2': { triggered: 3, success_rate: 100 }, 'rule-3': { triggered: 4, success_rate: 50 }, 'rule-4': { triggered: 0, success_rate: 0 } },
};

export const DEFAULT_BUDGET_CONFIG: AIBudgetConfig = {
  monthly_budget_cents: 50000, soft_limit_percentage: 80, hard_limit_percentage: 100,
  alert_on_soft_limit: true, block_on_hard_limit: true, billing_cycle_day: 1,
  rollover_enabled: false, rollover_cap_percentage: 25,
};

export const DEFAULT_SPENDING_DATA: AISpendingData = {
  current_month_spend_cents: 34250, last_month_spend_cents: 42180,
  daily_spend: [
    { date: '2026-01-01', amount_cents: 1250 }, { date: '2026-01-02', amount_cents: 1480 },
    { date: '2026-01-03', amount_cents: 1320 }, { date: '2026-01-04', amount_cents: 1150 },
    { date: '2026-01-05', amount_cents: 1680 }, { date: '2026-01-06', amount_cents: 1420 },
    { date: '2026-01-07', amount_cents: 1580 }, { date: '2026-01-08', amount_cents: 1720 },
    { date: '2026-01-09', amount_cents: 1380 }, { date: '2026-01-10', amount_cents: 1250 },
    { date: '2026-01-11', amount_cents: 1620 }, { date: '2026-01-12', amount_cents: 1480 },
    { date: '2026-01-13', amount_cents: 1350 }, { date: '2026-01-14', amount_cents: 1720 },
    { date: '2026-01-15', amount_cents: 1850 }, { date: '2026-01-16', amount_cents: 2500 },
  ],
  by_feature: { chat: 12500, completion: 8200, embedding: 3100, analysis: 4800, code_review: 3200, test_generation: 2450 },
  by_provider: { kie: 24500, anthropic: 9750 },
  requests_this_month: 15420, avg_cost_per_request_cents: 2.22,
};

export const DEFAULT_BUDGET_ALERTS: BudgetAlert[] = [
  { id: 'alert-001', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), type: 'approaching', percentage: 65, message: 'You have used 65% of your monthly AI budget.', acknowledged: true },
  { id: 'alert-002', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), type: 'soft_limit', percentage: 80, message: 'Soft limit reached! You have used 80% of your monthly AI budget.', acknowledged: false },
];

export const DEFAULT_CACHE_CONFIG: AICacheConfig = {
  enabled: true, default_ttl_seconds: 3600, max_cache_size_mb: 512,
  cache_by_feature: {
    chat: { enabled: true, ttl_seconds: 1800 }, completion: { enabled: true, ttl_seconds: 3600 },
    embedding: { enabled: true, ttl_seconds: 86400 }, analysis: { enabled: true, ttl_seconds: 7200 },
    code_review: { enabled: false, ttl_seconds: 1800 }, test_generation: { enabled: true, ttl_seconds: 3600 },
  },
  invalidate_on_model_change: true, invalidate_on_prompt_change: true, hash_algorithm: 'sha256',
};

export const DEFAULT_CACHE_STATS: CacheStats = {
  total_entries: 1847, active_entries: 1523, total_hits: 45892, total_misses: 12456,
  hit_rate_percent: 78.6, cache_size_mb: 387.5, max_size_mb: 512,
  estimated_cost_savings_cents: 18450, estimated_latency_savings_ms: 892000,
  by_feature: {
    chat: { hits: 15420, misses: 4280, entries: 542 }, completion: { hits: 12350, misses: 3120, entries: 412 },
    embedding: { hits: 8920, misses: 980, entries: 289 }, analysis: { hits: 4580, misses: 2340, entries: 156 },
    code_review: { hits: 2120, misses: 890, entries: 78 }, test_generation: { hits: 2502, misses: 846, entries: 46 },
  },
};

export const DEFAULT_CACHE_ENTRIES: CacheEntry[] = [
  { id: 'cache-001', cache_key: 'sha256:a1b2c3d4e5f6...', request_hash: 'req_abc123', feature_type: 'chat', provider: 'kie', model: 'claude-3-sonnet', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), expires_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), hit_count: 47, last_hit_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), response_size_bytes: 2450, ttl_seconds: 3600, status: 'active' },
  { id: 'cache-002', cache_key: 'sha256:f7g8h9i0j1k2...', request_hash: 'req_def456', feature_type: 'embedding', provider: 'anthropic', model: 'claude-3-haiku', created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), hit_count: 182, last_hit_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), response_size_bytes: 1024, ttl_seconds: 86400, status: 'active' },
  { id: 'cache-003', cache_key: 'sha256:l3m4n5o6p7q8...', request_hash: 'req_ghi789', feature_type: 'completion', provider: 'kie', model: 'claude-3-opus', created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), expires_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), hit_count: 23, last_hit_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), response_size_bytes: 4890, ttl_seconds: 3600, status: 'expired' },
];

export const DEFAULT_CACHE_EVENTS: CacheEvent[] = [
  { id: 'evt-001', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), type: 'hit', cache_key: 'sha256:a1b2c3d4e5f6...', feature_type: 'chat', latency_saved_ms: 850, cost_saved_cents: 2 },
  { id: 'evt-002', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), type: 'store', cache_key: 'sha256:x9y8z7w6v5u4...', feature_type: 'analysis' },
  { id: 'evt-003', timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(), type: 'miss', cache_key: 'sha256:p1q2r3s4t5u6...', feature_type: 'completion' },
  { id: 'evt-004', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), type: 'invalidate', cache_key: 'sha256:k9j8h7g6f5d4...', feature_type: 'chat', reason: 'Model configuration changed' },
  { id: 'evt-005', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), type: 'evict', cache_key: 'sha256:e3d2c1b0a9z8...', feature_type: 'embedding', reason: 'Cache size limit reached' },
];
