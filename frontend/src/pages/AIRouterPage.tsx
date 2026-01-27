// AIRouterPage - Extracted from App.tsx (Feature #1441)
// AI Provider Router with circuit breaker, rate limiting, and fallback management
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/authStore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "../stores/toastStore";


interface AIRouterConfig {
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
  // Feature #1331: Retry with exponential backoff
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
interface RetryAttempt {
  request_id: string;
  attempt_number: number;
  timestamp: string;
  delay_ms: number;
  error_type: 'timeout' | 'rate_limit' | 'error' | 'server_error';
  error_message: string;
  success: boolean;
}

interface RetryStats {
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
type AIFeatureType = 'chat' | 'completion' | 'embedding' | 'analysis' | 'code_review' | 'test_generation';

interface FeatureTimeout {
  feature: AIFeatureType;
  name: string;
  description: string;
  timeout_ms: number;
  enabled: boolean;
  fallback_on_timeout: boolean;
}

// Feature #1333: Model selection per feature
type AIModelType = 'claude-opus-4.5-thinking' | 'claude-opus-4.5' | 'claude-sonnet-4' | 'claude-haiku-3.5';

interface FeatureModelConfig {
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

interface ModelUsageStats {
  feature: AIFeatureType;
  model: AIModelType;
  request_count: number;
  total_tokens: number;
  total_cost_cents: number;
  avg_latency_ms: number;
  last_used: string;
}

interface TimeoutEvent {
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

interface TimeoutStats {
  total_timeouts: number;
  timeouts_by_feature: Record<AIFeatureType, number>;
  avg_timeout_duration_ms: number;
  fallback_success_rate: number;
  most_timeout_prone_feature: AIFeatureType | null;
}

// Feature #1335: Provider-specific rate limiting
type RateLimitStrategy = 'queue' | 'retry' | 'failover' | 'drop';

interface ProviderRateLimitConfig {
  provider: 'kie' | 'anthropic';
  provider_name: string;
  enabled: boolean;
  requests_per_minute: number;
  requests_per_hour: number;
  tokens_per_minute: number;
  burst_allowance: number; // Extra requests allowed in burst
  queue_max_size: number;
  queue_timeout_ms: number;
  strategy_on_limit: RateLimitStrategy;
  auto_distribute: boolean; // Distribute requests evenly across time
  alert_threshold_percent: number; // Alert when usage reaches this %
}

interface ProviderRateLimitStatus {
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

interface QueuedRequest {
  id: string;
  feature: AIFeatureType;
  enqueued_at: string;
  estimated_wait_ms: number;
  priority: 'high' | 'normal' | 'low';
  tokens_estimate: number;
  status: 'queued' | 'processing' | 'completed' | 'dropped';
}

interface RateLimitEvent {
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

interface RateLimitAlert {
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
type FallbackTrigger = 'error' | 'timeout' | 'rate_limit' | 'server_error' | 'network_error';

interface FallbackRule {
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

interface FallbackTestResult {
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

interface FallbackStats {
  total_fallbacks_24h: number;
  successful_fallbacks_24h: number;
  failed_fallbacks_24h: number;
  avg_fallback_latency_ms: number;
  by_trigger: Record<FallbackTrigger, number>;
  by_rule: Record<string, { triggered: number; success_rate: number }>;
}

// Feature #1329: Monthly AI Budget Limits
interface AIBudgetConfig {
  monthly_budget_cents: number;
  soft_limit_percentage: number; // e.g., 80 = 80%
  hard_limit_percentage: number; // e.g., 100 = 100%
  alert_on_soft_limit: boolean;
  block_on_hard_limit: boolean;
  billing_cycle_day: number; // 1-28
  rollover_enabled: boolean;
  rollover_cap_percentage: number;
}

interface AISpendingData {
  current_month_spend_cents: number;
  last_month_spend_cents: number;
  daily_spend: { date: string; amount_cents: number }[];
  by_feature: Record<AIFeatureType, number>;
  by_provider: Record<string, number>;
  requests_this_month: number;
  avg_cost_per_request_cents: number;
}

interface BudgetAlert {
  id: string;
  timestamp: string;
  type: 'soft_limit' | 'hard_limit' | 'approaching' | 'reset';
  percentage: number;
  message: string;
  acknowledged: boolean;
}

// Feature #1330: AI Cost Alert Notifications
interface CostAlertThreshold {
  percentage: number;
  enabled: boolean;
  email_enabled: boolean;
  slack_enabled: boolean;
  last_triggered?: string;
}

interface AlertNotificationConfig {
  thresholds: CostAlertThreshold[];
  email_recipients: string[];
  slack_webhook_url: string;
  slack_channel: string;
  slack_enabled: boolean;
  email_enabled: boolean;
  include_breakdown: boolean;
  include_suggestions: boolean;
  cooldown_minutes: number; // Don't send same alert within this period
}

interface CostAlertNotification {
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

interface CostReductionSuggestion {
  id: string;
  category: 'caching' | 'batching' | 'model_downgrade' | 'rate_limiting' | 'feature_disable';
  title: string;
  description: string;
  estimated_savings_percent: number;
  priority: 'high' | 'medium' | 'low';
  action_url?: string;
}

// Feature #1332: AI Response Caching
interface AICacheConfig {
  enabled: boolean;
  default_ttl_seconds: number;
  max_cache_size_mb: number;
  cache_by_feature: Record<AIFeatureType, { enabled: boolean; ttl_seconds: number }>;
  invalidate_on_model_change: boolean;
  invalidate_on_prompt_change: boolean;
  hash_algorithm: 'sha256' | 'md5' | 'xxhash';
}

interface CacheEntry {
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

interface CacheStats {
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

interface CacheEvent {
  id: string;
  timestamp: string;
  type: 'hit' | 'miss' | 'store' | 'invalidate' | 'expire' | 'evict';
  cache_key: string;
  feature_type: AIFeatureType;
  latency_saved_ms?: number;
  cost_saved_cents?: number;
  reason?: string;
}

interface RouterStats {
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

interface CircuitBreakerState {
  provider: string;
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  last_failure_time?: string;
  last_success_time?: string;
  recovery_at?: string;
}

interface ProviderSwitchLog {
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
interface ActiveProviderState {
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

interface ProviderChangeLog {
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

interface ProviderSwitchResult {
  success: boolean;
  previous_provider: string;
  new_provider: string;
  switch_id: string;
  switched_at: string;
  reason: string;
  requests_drained: number;
  switch_duration_ms: number;
  service_interruption_ms: number;
  message: string;
  error?: string;
}

// Feature #1337: AI API Key Management
// Feature #1328: AI API Key Rotation Support (Zero-Downtime)
interface APIKeyConfig {
  id: string;
  provider: 'kie' | 'anthropic';
  name: string;
  key_prefix: string; // First 8 chars
  key_suffix: string; // Last 4 chars
  created_at: string;
  last_used_at: string | null;
  last_rotated_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  permissions: string[];
  usage_count: number;
  rate_limit_remaining: number | null;
  // Feature #1328: Key versioning for zero-downtime rotation
  version: number;
  role: 'primary' | 'standby' | 'retiring';
  traffic_percentage: number; // 0-100
  rotation_status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  rotation_started_at?: string;
}

interface APIKeyAuditLog {
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

interface KeyTestResult {
  provider: 'kie' | 'anthropic';
  success: boolean;
  latency_ms: number;
  rate_limit_remaining: number | null;
  models_available: string[];
  error?: string;
  tested_at: string;
}

function AIRouterPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // State
  const [config, setConfig] = useState<AIRouterConfig | null>(null);
  const [stats, setStats] = useState<RouterStats | null>(null);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerState[]>([]);
  const [logs, setLogs] = useState<ProviderSwitchLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Feature #1327: Provider Hot-Swap State
  const [activeProvider, setActiveProvider] = useState<ActiveProviderState | null>(null);
  const [changeLogs, setChangeLogs] = useState<ProviderChangeLog[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchResult, setSwitchResult] = useState<ProviderSwitchResult | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchReason, setSwitchReason] = useState('');
  const [gracefulSwitch, setGracefulSwitch] = useState(true);
  const [targetProvider, setTargetProvider] = useState<'kie' | 'anthropic'>('anthropic');

  // Feature #1337: API Key Management State
  const [apiKeys, setApiKeys] = useState<APIKeyConfig[]>([
    {
      id: 'key-kie-1',
      provider: 'kie',
      name: 'Kie.ai Production Key',
      key_prefix: 'kie_prod',
      key_suffix: '...7x9z',
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_used_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      last_rotated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      permissions: ['chat', 'completions', 'embeddings'],
      usage_count: 15420,
      rate_limit_remaining: 9500,
      version: 2,
      role: 'primary',
      traffic_percentage: 100,
    },
    {
      id: 'key-kie-2',
      provider: 'kie',
      name: 'Kie.ai Standby Key',
      key_prefix: 'kie_stby',
      key_suffix: '...3k8m',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      last_used_at: null,
      last_rotated_at: null,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      permissions: ['chat', 'completions', 'embeddings'],
      usage_count: 0,
      rate_limit_remaining: 10000,
      version: 3,
      role: 'standby',
      traffic_percentage: 0,
    },
    {
      id: 'key-anthropic-1',
      provider: 'anthropic',
      name: 'Anthropic API Key',
      key_prefix: 'sk-ant-a',
      key_suffix: '...mK4Q',
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      last_used_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      last_rotated_at: null,
      expires_at: null,
      is_active: true,
      permissions: ['messages', 'completions'],
      usage_count: 3250,
      rate_limit_remaining: 4000,
      version: 1,
      role: 'primary',
      traffic_percentage: 100,
    },
  ]);
  const [keyAuditLogs, setKeyAuditLogs] = useState<APIKeyAuditLog[]>([
    {
      id: 'audit-1',
      timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      action: 'rotated',
      provider: 'kie',
      key_name: 'Kie.ai Production Key',
      performed_by: 'admin@company.com',
      ip_address: '192.168.1.100',
      details: 'Scheduled rotation',
      success: true,
    },
    {
      id: 'audit-2',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      action: 'tested',
      provider: 'anthropic',
      key_name: 'Anthropic API Key',
      performed_by: 'admin@company.com',
      ip_address: '192.168.1.100',
      details: 'Connection test passed',
      success: true,
    },
  ]);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalMode, setKeyModalMode] = useState<'add' | 'edit' | 'rotate'>('add');
  const [editingKey, setEditingKey] = useState<APIKeyConfig | null>(null);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState<'kie' | 'anthropic'>('kie');
  const [isTestingKey, setIsTestingKey] = useState<string | null>(null);
  const [keyTestResult, setKeyTestResult] = useState<KeyTestResult | null>(null);
  const [showKeyValue, setShowKeyValue] = useState<Record<string, boolean>>({});

  // Feature #1331: Retry with exponential backoff state
  const [retryConfig, setRetryConfig] = useState({
    enabled: true,
    max_retries: 3,
    initial_delay_ms: 100,
    max_delay_ms: 5000,
    backoff_multiplier: 2,
    retry_on_timeout: true,
    retry_on_rate_limit: true,
    retry_on_error: true,
  });
  const [retryStats, setRetryStats] = useState<RetryStats>({
    total_retries: 47,
    successful_retries: 38,
    failed_after_retries: 9,
    avg_retries_before_success: 1.8,
    avg_retry_delay_ms: 312,
    by_error_type: {
      timeout: 12,
      rate_limit: 18,
      error: 11,
      server_error: 6,
    },
  });
  const [retryLogs, setRetryLogs] = useState<RetryAttempt[]>([
    {
      request_id: 'req-001',
      attempt_number: 1,
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      delay_ms: 100,
      error_type: 'timeout',
      error_message: 'Request timeout after 30000ms',
      success: false,
    },
    {
      request_id: 'req-001',
      attempt_number: 2,
      timestamp: new Date(Date.now() - 5 * 60 * 1000 + 200).toISOString(),
      delay_ms: 200,
      error_type: 'timeout',
      error_message: 'Request timeout after 30000ms',
      success: false,
    },
    {
      request_id: 'req-001',
      attempt_number: 3,
      timestamp: new Date(Date.now() - 5 * 60 * 1000 + 600).toISOString(),
      delay_ms: 0,
      error_type: 'timeout',
      error_message: '',
      success: true,
    },
    {
      request_id: 'req-002',
      attempt_number: 1,
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      delay_ms: 100,
      error_type: 'rate_limit',
      error_message: 'Rate limit exceeded. Retry after 1s.',
      success: false,
    },
    {
      request_id: 'req-002',
      attempt_number: 2,
      timestamp: new Date(Date.now() - 10 * 60 * 1000 + 1200).toISOString(),
      delay_ms: 0,
      error_type: 'rate_limit',
      error_message: '',
      success: true,
    },
  ]);
  const [isSimulatingRetry, setIsSimulatingRetry] = useState(false);

  // Feature #1334: Per-feature timeout configuration
  const [defaultTimeout, setDefaultTimeout] = useState(30000); // 30 seconds default
  const [featureTimeouts, setFeatureTimeouts] = useState<FeatureTimeout[]>([
    { feature: 'chat', name: 'Chat Completion', description: 'Interactive chat responses', timeout_ms: 30000, enabled: true, fallback_on_timeout: true },
    { feature: 'completion', name: 'Text Completion', description: 'Code/text completions', timeout_ms: 45000, enabled: true, fallback_on_timeout: true },
    { feature: 'embedding', name: 'Embeddings', description: 'Vector embeddings generation', timeout_ms: 15000, enabled: true, fallback_on_timeout: false },
    { feature: 'analysis', name: 'Test Analysis', description: 'AI-powered test analysis', timeout_ms: 60000, enabled: true, fallback_on_timeout: true },
    { feature: 'code_review', name: 'Code Review', description: 'AI code review suggestions', timeout_ms: 90000, enabled: true, fallback_on_timeout: true },
    { feature: 'test_generation', name: 'Test Generation', description: 'Automated test creation', timeout_ms: 120000, enabled: true, fallback_on_timeout: true },
  ]);
  const [timeoutEvents, setTimeoutEvents] = useState<TimeoutEvent[]>([
    {
      id: 'to-001',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      feature: 'code_review',
      configured_timeout_ms: 90000,
      actual_duration_ms: 92500,
      provider: 'kie',
      triggered_fallback: true,
      fallback_success: true,
    },
    {
      id: 'to-002',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      feature: 'test_generation',
      configured_timeout_ms: 120000,
      actual_duration_ms: 125000,
      provider: 'anthropic',
      triggered_fallback: false,
      error_message: 'Request cancelled by user',
    },
    {
      id: 'to-003',
      timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      feature: 'chat',
      configured_timeout_ms: 30000,
      actual_duration_ms: 31200,
      provider: 'kie',
      triggered_fallback: true,
      fallback_success: true,
    },
  ]);
  const [timeoutStats, setTimeoutStats] = useState<TimeoutStats>({
    total_timeouts: 23,
    timeouts_by_feature: {
      chat: 5,
      completion: 3,
      embedding: 1,
      analysis: 4,
      code_review: 6,
      test_generation: 4,
    },
    avg_timeout_duration_ms: 2500,
    fallback_success_rate: 87.5,
    most_timeout_prone_feature: 'code_review',
  });
  const [isSimulatingTimeout, setIsSimulatingTimeout] = useState(false);

  // Feature #1333: Model selection per feature
  const [orgDefaultModel, setOrgDefaultModel] = useState<AIModelType>('claude-sonnet-4');
  const [featureModelConfigs, setFeatureModelConfigs] = useState<FeatureModelConfig[]>([
    {
      feature: 'chat',
      name: 'Chat Completion',
      description: 'Interactive chat & conversations',
      model: 'claude-sonnet-4',
      enabled: true,
      override_org_default: false,
      cost_per_1k_tokens: 0.003,
      avg_latency_ms: 450,
      quality_tier: 'standard'
    },
    {
      feature: 'completion',
      name: 'Text Completion',
      description: 'Code & text completions',
      model: 'claude-sonnet-4',
      enabled: true,
      override_org_default: false,
      cost_per_1k_tokens: 0.003,
      avg_latency_ms: 380,
      quality_tier: 'standard'
    },
    {
      feature: 'embedding',
      name: 'Embeddings',
      description: 'Vector embeddings generation',
      model: 'claude-haiku-3.5',
      enabled: true,
      override_org_default: true,
      cost_per_1k_tokens: 0.00025,
      avg_latency_ms: 120,
      quality_tier: 'economy'
    },
    {
      feature: 'analysis',
      name: 'Test Analysis',
      description: 'AI-powered test analysis & insights',
      model: 'claude-opus-4.5-thinking',
      enabled: true,
      override_org_default: true,
      cost_per_1k_tokens: 0.015,
      avg_latency_ms: 2500,
      quality_tier: 'premium'
    },
    {
      feature: 'code_review',
      name: 'Code Review',
      description: 'AI code review suggestions',
      model: 'claude-opus-4.5',
      enabled: true,
      override_org_default: true,
      cost_per_1k_tokens: 0.015,
      avg_latency_ms: 1800,
      quality_tier: 'premium'
    },
    {
      feature: 'test_generation',
      name: 'Test Generation',
      description: 'Automated test creation',
      model: 'claude-opus-4.5-thinking',
      enabled: true,
      override_org_default: true,
      cost_per_1k_tokens: 0.015,
      avg_latency_ms: 3200,
      quality_tier: 'premium'
    },
  ]);
  const [modelUsageStats, setModelUsageStats] = useState<ModelUsageStats[]>([
    { feature: 'chat', model: 'claude-sonnet-4', request_count: 8420, total_tokens: 2105000, total_cost_cents: 6315, avg_latency_ms: 445, last_used: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
    { feature: 'completion', model: 'claude-sonnet-4', request_count: 5120, total_tokens: 1024000, total_cost_cents: 3072, avg_latency_ms: 372, last_used: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
    { feature: 'embedding', model: 'claude-haiku-3.5', request_count: 12350, total_tokens: 617500, total_cost_cents: 154, avg_latency_ms: 118, last_used: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
    { feature: 'analysis', model: 'claude-opus-4.5-thinking', request_count: 890, total_tokens: 890000, total_cost_cents: 13350, avg_latency_ms: 2480, last_used: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
    { feature: 'code_review', model: 'claude-opus-4.5', request_count: 520, total_tokens: 416000, total_cost_cents: 6240, avg_latency_ms: 1750, last_used: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
    { feature: 'test_generation', model: 'claude-opus-4.5-thinking', request_count: 280, total_tokens: 560000, total_cost_cents: 8400, avg_latency_ms: 3150, last_used: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
  ]);

  // Feature #1335: Provider-specific rate limiting
  const [rateLimitConfigs, setRateLimitConfigs] = useState<ProviderRateLimitConfig[]>([
    {
      provider: 'kie',
      provider_name: 'Kie.ai',
      enabled: true,
      requests_per_minute: 60,
      requests_per_hour: 1000,
      tokens_per_minute: 100000,
      burst_allowance: 10,
      queue_max_size: 50,
      queue_timeout_ms: 30000,
      strategy_on_limit: 'queue',
      auto_distribute: true,
      alert_threshold_percent: 80,
    },
    {
      provider: 'anthropic',
      provider_name: 'Anthropic',
      enabled: true,
      requests_per_minute: 50,
      requests_per_hour: 500,
      tokens_per_minute: 80000,
      burst_allowance: 5,
      queue_max_size: 30,
      queue_timeout_ms: 45000,
      strategy_on_limit: 'failover',
      auto_distribute: true,
      alert_threshold_percent: 75,
    },
  ]);
  const [rateLimitStatus, setRateLimitStatus] = useState<ProviderRateLimitStatus[]>([
    {
      provider: 'kie',
      requests_remaining_minute: 42,
      requests_remaining_hour: 856,
      tokens_remaining_minute: 72500,
      reset_at_minute: new Date(Date.now() + 38 * 1000).toISOString(),
      reset_at_hour: new Date(Date.now() + 42 * 60 * 1000).toISOString(),
      current_queue_size: 3,
      queued_requests: [
        { id: 'req-001', feature: 'chat', enqueued_at: new Date(Date.now() - 2000).toISOString(), estimated_wait_ms: 1500, priority: 'high', tokens_estimate: 1200, status: 'queued' },
        { id: 'req-002', feature: 'analysis', enqueued_at: new Date(Date.now() - 1500).toISOString(), estimated_wait_ms: 3000, priority: 'normal', tokens_estimate: 5000, status: 'queued' },
        { id: 'req-003', feature: 'completion', enqueued_at: new Date(Date.now() - 800).toISOString(), estimated_wait_ms: 4200, priority: 'low', tokens_estimate: 800, status: 'queued' },
      ],
      is_rate_limited: false,
      time_until_available_ms: 0,
      last_rate_limit_hit: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      rate_limit_hits_1h: 2,
      rate_limit_hits_24h: 8,
    },
    {
      provider: 'anthropic',
      requests_remaining_minute: 12,
      requests_remaining_hour: 245,
      tokens_remaining_minute: 28000,
      reset_at_minute: new Date(Date.now() + 22 * 1000).toISOString(),
      reset_at_hour: new Date(Date.now() + 28 * 60 * 1000).toISOString(),
      current_queue_size: 0,
      queued_requests: [],
      is_rate_limited: true,
      time_until_available_ms: 22000,
      last_rate_limit_hit: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      rate_limit_hits_1h: 5,
      rate_limit_hits_24h: 18,
    },
  ]);
  const [rateLimitEvents, setRateLimitEvents] = useState<RateLimitEvent[]>([
    { id: 'evt-001', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), provider: 'anthropic', feature: 'chat', event_type: 'limit_hit', details: 'Rate limit reached: 50/50 requests per minute', requests_remaining: 0 },
    { id: 'evt-002', timestamp: new Date(Date.now() - 2 * 60 * 1000 + 500).toISOString(), provider: 'anthropic', feature: 'chat', event_type: 'failover_triggered', details: 'Failover to Kie.ai initiated', requests_remaining: 0 },
    { id: 'evt-003', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), provider: 'kie', feature: 'analysis', event_type: 'limit_hit', details: 'Rate limit reached: 60/60 requests per minute', requests_remaining: 0 },
    { id: 'evt-004', timestamp: new Date(Date.now() - 15 * 60 * 1000 + 200).toISOString(), provider: 'kie', feature: 'analysis', event_type: 'request_queued', details: 'Request queued for processing', requests_remaining: 0, queue_position: 1, wait_time_ms: 1500 },
    { id: 'evt-005', timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(), provider: 'kie', feature: 'analysis', event_type: 'limit_cleared', details: 'Rate limit reset, processing queued requests', requests_remaining: 60 },
  ]);
  const [rateLimitAlerts, setRateLimitAlerts] = useState<RateLimitAlert[]>([
    {
      id: 'alert-rl-001',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      provider: 'anthropic',
      alert_type: 'sustained_limiting',
      severity: 'warning',
      message: 'Anthropic has been rate limited 5 times in the last hour',
      threshold_value: 3,
      actual_value: 5,
      acknowledged: false,
    },
    {
      id: 'alert-rl-002',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      provider: 'kie',
      alert_type: 'limit_approaching',
      severity: 'info',
      message: 'Kie.ai usage at 82% of hourly limit',
      threshold_value: 80,
      actual_value: 82,
      acknowledged: true,
    },
  ]);
  const [showRateLimitConfigModal, setShowRateLimitConfigModal] = useState(false);
  const [editingRateLimitProvider, setEditingRateLimitProvider] = useState<'kie' | 'anthropic' | null>(null);

  // Feature #1339: Fallback rules configuration
  const [fallbackRules, setFallbackRules] = useState<FallbackRule[]>([
    {
      id: 'rule-1',
      name: 'Timeout Fallback',
      enabled: true,
      priority: 1,
      triggers: ['timeout'],
      source_provider: 'kie',
      target_provider: 'anthropic',
      retry_before_fallback: 2,
      timeout_threshold_ms: 30000,
      retry_delay_ms: 1000,
      max_fallback_attempts: 3,
      preserve_context: true,
      log_fallback: true,
      notify_on_fallback: false,
      cooldown_after_fallback_ms: 5000,
    },
    {
      id: 'rule-2',
      name: 'Rate Limit Failover',
      enabled: true,
      priority: 2,
      triggers: ['rate_limit'],
      source_provider: 'any',
      target_provider: 'anthropic',
      retry_before_fallback: 0,
      timeout_threshold_ms: 60000,
      retry_delay_ms: 500,
      max_fallback_attempts: 1,
      preserve_context: true,
      log_fallback: true,
      notify_on_fallback: true,
      cooldown_after_fallback_ms: 10000,
    },
    {
      id: 'rule-3',
      name: 'Error Recovery',
      enabled: true,
      priority: 3,
      triggers: ['error', 'server_error'],
      source_provider: 'any',
      target_provider: 'anthropic',
      retry_before_fallback: 3,
      timeout_threshold_ms: 45000,
      retry_delay_ms: 2000,
      max_fallback_attempts: 2,
      preserve_context: false,
      log_fallback: true,
      notify_on_fallback: true,
      cooldown_after_fallback_ms: 15000,
    },
    {
      id: 'rule-4',
      name: 'Network Failover',
      enabled: false,
      priority: 4,
      triggers: ['network_error'],
      source_provider: 'any',
      target_provider: 'kie',
      retry_before_fallback: 1,
      timeout_threshold_ms: 20000,
      retry_delay_ms: 3000,
      max_fallback_attempts: 2,
      preserve_context: true,
      log_fallback: true,
      notify_on_fallback: false,
      cooldown_after_fallback_ms: 20000,
    },
  ]);
  const [fallbackTestResults, setFallbackTestResults] = useState<FallbackTestResult[]>([
    {
      rule_id: 'rule-1',
      trigger: 'timeout',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      source_provider: 'Kie.ai',
      target_provider: 'Anthropic',
      success: true,
      fallback_latency_ms: 245,
      retries_attempted: 2,
    },
    {
      rule_id: 'rule-2',
      trigger: 'rate_limit',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      source_provider: 'Kie.ai',
      target_provider: 'Anthropic',
      success: true,
      fallback_latency_ms: 89,
      retries_attempted: 0,
    },
    {
      rule_id: 'rule-3',
      trigger: 'server_error',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      source_provider: 'Anthropic',
      target_provider: 'Anthropic',
      success: false,
      fallback_latency_ms: 3500,
      retries_attempted: 3,
      error_message: 'Max fallback attempts exceeded',
    },
  ]);
  const [fallbackStats] = useState<FallbackStats>({
    total_fallbacks_24h: 12,
    successful_fallbacks_24h: 10,
    failed_fallbacks_24h: 2,
    avg_fallback_latency_ms: 312,
    by_trigger: {
      error: 3,
      timeout: 5,
      rate_limit: 3,
      server_error: 1,
      network_error: 0,
    },
    by_rule: {
      'rule-1': { triggered: 5, success_rate: 100 },
      'rule-2': { triggered: 3, success_rate: 100 },
      'rule-3': { triggered: 4, success_rate: 50 },
      'rule-4': { triggered: 0, success_rate: 0 },
    },
  });
  const [showFallbackRuleModal, setShowFallbackRuleModal] = useState(false);
  const [editingFallbackRule, setEditingFallbackRule] = useState<FallbackRule | null>(null);
  const [isTestingFallback, setIsTestingFallback] = useState(false);
  const [testingFallbackTrigger, setTestingFallbackTrigger] = useState<FallbackTrigger | null>(null);

  // Feature #1329: Monthly AI Budget Limits
  const [budgetConfig, setBudgetConfig] = useState<AIBudgetConfig>({
    monthly_budget_cents: 50000, // $500.00
    soft_limit_percentage: 80,
    hard_limit_percentage: 100,
    alert_on_soft_limit: true,
    block_on_hard_limit: true,
    billing_cycle_day: 1,
    rollover_enabled: false,
    rollover_cap_percentage: 25,
  });
  const [spendingData, setSpendingData] = useState<AISpendingData>({
    current_month_spend_cents: 34250, // $342.50
    last_month_spend_cents: 42180,
    daily_spend: [
      { date: '2026-01-01', amount_cents: 1250 },
      { date: '2026-01-02', amount_cents: 1480 },
      { date: '2026-01-03', amount_cents: 1320 },
      { date: '2026-01-04', amount_cents: 1150 },
      { date: '2026-01-05', amount_cents: 1680 },
      { date: '2026-01-06', amount_cents: 1420 },
      { date: '2026-01-07', amount_cents: 1580 },
      { date: '2026-01-08', amount_cents: 1720 },
      { date: '2026-01-09', amount_cents: 1380 },
      { date: '2026-01-10', amount_cents: 1250 },
      { date: '2026-01-11', amount_cents: 1620 },
      { date: '2026-01-12', amount_cents: 1480 },
      { date: '2026-01-13', amount_cents: 1350 },
      { date: '2026-01-14', amount_cents: 1720 },
      { date: '2026-01-15', amount_cents: 1850 },
      { date: '2026-01-16', amount_cents: 2500 },
    ],
    by_feature: {
      chat: 12500,
      completion: 8200,
      embedding: 3100,
      analysis: 4800,
      code_review: 3200,
      test_generation: 2450,
    },
    by_provider: {
      kie: 24500,
      anthropic: 9750,
    },
    requests_this_month: 15420,
    avg_cost_per_request_cents: 2.22,
  });
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([
    {
      id: 'alert-001',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'approaching',
      percentage: 65,
      message: 'You have used 65% of your monthly AI budget.',
      acknowledged: true,
    },
    {
      id: 'alert-002',
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      type: 'soft_limit',
      percentage: 80,
      message: 'Soft limit reached! You have used 80% of your monthly AI budget.',
      acknowledged: false,
    },
  ]);
  const [showBudgetResetModal, setShowBudgetResetModal] = useState(false);

  // Feature #1330: AI Cost Alert Notifications
  const [alertNotificationConfig, setAlertNotificationConfig] = useState<AlertNotificationConfig>({
    thresholds: [
      { percentage: 50, enabled: true, email_enabled: true, slack_enabled: false },
      { percentage: 80, enabled: true, email_enabled: true, slack_enabled: true },
      { percentage: 100, enabled: true, email_enabled: true, slack_enabled: true },
    ],
    email_recipients: ['admin@company.com', 'finance@company.com'],
    slack_webhook_url: '', // Configure via environment variable
    slack_channel: '#ai-cost-alerts',
    slack_enabled: true,
    email_enabled: true,
    include_breakdown: true,
    include_suggestions: true,
    cooldown_minutes: 60,
  });
  const [sentNotifications, setSentNotifications] = useState<CostAlertNotification[]>([
    {
      id: 'notif-001',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      threshold_percentage: 50,
      current_percentage: 52,
      spend_amount_cents: 26000,
      budget_amount_cents: 50000,
      channels_sent: ['email'],
      recipients: ['admin@company.com'],
      breakdown_included: true,
      suggestions_included: true,
      status: 'sent',
    },
    {
      id: 'notif-002',
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      threshold_percentage: 80,
      current_percentage: 81,
      spend_amount_cents: 40500,
      budget_amount_cents: 50000,
      channels_sent: ['email', 'slack'],
      recipients: ['admin@company.com', 'finance@company.com'],
      breakdown_included: true,
      suggestions_included: true,
      status: 'sent',
    },
  ]);
  const [costReductionSuggestions] = useState<CostReductionSuggestion[]>([
    {
      id: 'sug-001',
      category: 'caching',
      title: 'Enable Response Caching',
      description: 'Cache AI responses for similar queries to reduce duplicate API calls. Estimated to reduce calls by 25-35%.',
      estimated_savings_percent: 30,
      priority: 'high',
      action_url: '/settings/ai/caching',
    },
    {
      id: 'sug-002',
      category: 'batching',
      title: 'Batch Similar Requests',
      description: 'Group multiple small requests into batched operations to reduce per-request overhead.',
      estimated_savings_percent: 15,
      priority: 'medium',
      action_url: '/settings/ai/batching',
    },
    {
      id: 'sug-003',
      category: 'model_downgrade',
      title: 'Use Smaller Models for Simple Tasks',
      description: 'Route simple classification and extraction tasks to smaller, cheaper models like GPT-3.5 instead of GPT-4.',
      estimated_savings_percent: 40,
      priority: 'high',
      action_url: '/settings/ai/model-routing',
    },
    {
      id: 'sug-004',
      category: 'rate_limiting',
      title: 'Implement User Rate Limits',
      description: 'Set per-user or per-team daily request limits to prevent runaway usage.',
      estimated_savings_percent: 20,
      priority: 'medium',
      action_url: '/settings/ai/rate-limits',
    },
    {
      id: 'sug-005',
      category: 'feature_disable',
      title: 'Disable Low-Value AI Features',
      description: 'Temporarily disable AI features with low usage but high cost per request.',
      estimated_savings_percent: 10,
      priority: 'low',
      action_url: '/settings/ai/features',
    },
  ]);
  const [showTestNotificationModal, setShowTestNotificationModal] = useState(false);
  const [testNotificationThreshold, setTestNotificationThreshold] = useState(80);

  // Feature #1332: AI Response Caching
  const [cacheConfig, setCacheConfig] = useState<AICacheConfig>({
    enabled: true,
    default_ttl_seconds: 3600, // 1 hour
    max_cache_size_mb: 512,
    cache_by_feature: {
      chat: { enabled: true, ttl_seconds: 1800 },
      completion: { enabled: true, ttl_seconds: 3600 },
      embedding: { enabled: true, ttl_seconds: 86400 }, // 24 hours - embeddings rarely change
      analysis: { enabled: true, ttl_seconds: 7200 },
      code_review: { enabled: false, ttl_seconds: 1800 }, // Code reviews should be fresh
      test_generation: { enabled: true, ttl_seconds: 3600 },
    },
    invalidate_on_model_change: true,
    invalidate_on_prompt_change: true,
    hash_algorithm: 'sha256',
  });
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    total_entries: 1847,
    active_entries: 1523,
    total_hits: 45892,
    total_misses: 12456,
    hit_rate_percent: 78.6,
    cache_size_mb: 387.5,
    max_size_mb: 512,
    estimated_cost_savings_cents: 18450,
    estimated_latency_savings_ms: 892000,
    by_feature: {
      chat: { hits: 15420, misses: 4280, entries: 542 },
      completion: { hits: 12350, misses: 3120, entries: 412 },
      embedding: { hits: 8920, misses: 980, entries: 289 },
      analysis: { hits: 4580, misses: 2340, entries: 156 },
      code_review: { hits: 2120, misses: 890, entries: 78 },
      test_generation: { hits: 2502, misses: 846, entries: 46 },
    },
  });
  const [cacheEntries, setCacheEntries] = useState<CacheEntry[]>([
    {
      id: 'cache-001',
      cache_key: 'sha256:a1b2c3d4e5f6...',
      request_hash: 'req_abc123',
      feature_type: 'chat',
      provider: 'kie',
      model: 'claude-3-sonnet',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      hit_count: 47,
      last_hit_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      response_size_bytes: 2450,
      ttl_seconds: 3600,
      status: 'active',
    },
    {
      id: 'cache-002',
      cache_key: 'sha256:f7g8h9i0j1k2...',
      request_hash: 'req_def456',
      feature_type: 'embedding',
      provider: 'anthropic',
      model: 'claude-3-haiku',
      created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      hit_count: 182,
      last_hit_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      response_size_bytes: 1024,
      ttl_seconds: 86400,
      status: 'active',
    },
    {
      id: 'cache-003',
      cache_key: 'sha256:l3m4n5o6p7q8...',
      request_hash: 'req_ghi789',
      feature_type: 'completion',
      provider: 'kie',
      model: 'claude-3-opus',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      hit_count: 23,
      last_hit_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      response_size_bytes: 4890,
      ttl_seconds: 3600,
      status: 'expired',
    },
  ]);
  const [cacheEvents, setCacheEvents] = useState<CacheEvent[]>([
    {
      id: 'evt-001',
      timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      type: 'hit',
      cache_key: 'sha256:a1b2c3d4e5f6...',
      feature_type: 'chat',
      latency_saved_ms: 850,
      cost_saved_cents: 2,
    },
    {
      id: 'evt-002',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      type: 'store',
      cache_key: 'sha256:x9y8z7w6v5u4...',
      feature_type: 'analysis',
    },
    {
      id: 'evt-003',
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      type: 'miss',
      cache_key: 'sha256:p1q2r3s4t5u6...',
      feature_type: 'completion',
    },
    {
      id: 'evt-004',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      type: 'invalidate',
      cache_key: 'sha256:k9j8h7g6f5d4...',
      feature_type: 'chat',
      reason: 'Model configuration changed',
    },
    {
      id: 'evt-005',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      type: 'evict',
      cache_key: 'sha256:e3d2c1b0a9z8...',
      feature_type: 'embedding',
      reason: 'Cache size limit reached',
    },
  ]);
  const [showCacheClearModal, setShowCacheClearModal] = useState(false);
  const [cacheKeyPreview, setCacheKeyPreview] = useState('');

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [configRes, statsRes, cbRes, logsRes, activeRes, changeLogsRes] = await Promise.all([
        fetch('https://qa.pixelcraftedmedia.com/api/v1/ai/router/config', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('https://qa.pixelcraftedmedia.com/api/v1/ai/router/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('https://qa.pixelcraftedmedia.com/api/v1/ai/router/circuit-breaker', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('https://qa.pixelcraftedmedia.com/api/v1/ai/router/logs?limit=20', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        // Feature #1327: Fetch active provider state
        fetch('https://qa.pixelcraftedmedia.com/api/v1/ai/provider/active', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('https://qa.pixelcraftedmedia.com/api/v1/ai/provider/change-logs?limit=10', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (configRes.ok) setConfig(await configRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (cbRes.ok) {
        const data = await cbRes.json();
        setCircuitBreakers(data.providers || []);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
      // Feature #1327: Set active provider state
      if (activeRes.ok) setActiveProvider(await activeRes.json());
      if (changeLogsRes.ok) {
        const data = await changeLogsRes.json();
        setChangeLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch router data:', error);
    }
    setIsLoading(false);
  };

  // Update configuration
  const updateConfig = async (updates: Partial<AIRouterConfig>) => {
    setIsSaving(true);
    try {
      const response = await fetch('https://qa.pixelcraftedmedia.com/api/v1/ai/router/config', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    }
    setIsSaving(false);
  };

  // Test failover
  const testFailover = async (failureType: 'timeout' | 'rate_limit' | 'error') => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('https://qa.pixelcraftedmedia.com/api/v1/ai/router/test-failover', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ simulate_failure: failureType }),
      });

      const result = await response.json();
      setTestResult(result);
      fetchData();
    } catch (error) {
      setTestResult({ success: false, message: 'Test failed' });
    }
    setIsTesting(false);
  };

  // Reset circuit breaker
  const resetCircuitBreaker = async (provider: string) => {
    try {
      await fetch('https://qa.pixelcraftedmedia.com/api/v1/ai/router/circuit-breaker/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to reset circuit breaker:', error);
    }
  };

  // Feature #1327: Hot-swap provider without restart
  const hotSwapProvider = async () => {
    setIsSwitching(true);
    setSwitchResult(null);
    try {
      const response = await fetch('https://qa.pixelcraftedmedia.com/api/v1/ai/provider/switch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_provider: targetProvider,
          reason: switchReason || 'Manual switch via admin UI',
          graceful_switch: gracefulSwitch,
          drain_timeout_ms: 5000,
        }),
      });

      const result = await response.json();
      setSwitchResult(result);

      if (result.success) {
        setShowSwitchModal(false);
        setSwitchReason('');
        fetchData();
      }
    } catch (error) {
      setSwitchResult({
        success: false,
        error: 'Failed to switch provider',
        message: 'Network error occurred',
      } as any);
    }
    setIsSwitching(false);
  };

  // Open switch modal with target provider
  const openSwitchModal = (target: 'kie' | 'anthropic') => {
    setTargetProvider(target);
    setSwitchResult(null);
    setShowSwitchModal(true);
  };

  // Feature #1337: API Key Management Functions
  const maskApiKey = (key: APIKeyConfig) => {
    return `${key.key_prefix}${'•'.repeat(20)}${key.key_suffix}`;
  };

  const validateApiKey = (key: string, provider: 'kie' | 'anthropic'): { valid: boolean; error?: string } => {
    if (!key.trim()) return { valid: false, error: 'API key is required' };
    if (key.length < 20) return { valid: false, error: 'API key is too short' };
    if (provider === 'kie' && !key.startsWith('kie_')) {
      return { valid: false, error: 'Kie.ai keys should start with "kie_"' };
    }
    if (provider === 'anthropic' && !key.startsWith('sk-ant-')) {
      return { valid: false, error: 'Anthropic keys should start with "sk-ant-"' };
    }
    return { valid: true };
  };

  const testApiKey = async (keyId: string) => {
    setIsTestingKey(keyId);
    setKeyTestResult(null);

    // Simulate API test
    await new Promise(r => setTimeout(r, 1500));

    const key = apiKeys.find(k => k.id === keyId);
    if (!key) return;

    const result: KeyTestResult = {
      provider: key.provider,
      success: Math.random() > 0.1, // 90% success rate simulation
      latency_ms: Math.floor(Math.random() * 200) + 50,
      rate_limit_remaining: key.provider === 'kie' ? 9500 : 4000,
      models_available: key.provider === 'kie'
        ? ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
        : ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
      tested_at: new Date().toISOString(),
    };

    if (!result.success) {
      result.error = 'Connection test failed: Invalid API key or insufficient permissions';
    }

    setKeyTestResult(result);
    setIsTestingKey(null);

    // Add audit log
    setKeyAuditLogs(prev => [{
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'tested',
      provider: key.provider,
      key_name: key.name,
      performed_by: 'admin@company.com',
      ip_address: '192.168.1.100',
      details: result.success ? 'Connection test passed' : result.error,
      success: result.success,
      error_message: result.error,
    }, ...prev]);
  };

  const rotateApiKey = async () => {
    if (!editingKey) return;

    const validation = validateApiKey(newKeyValue, editingKey.provider);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    // Simulate key rotation
    await new Promise(r => setTimeout(r, 1000));

    setApiKeys(prev => prev.map(k =>
      k.id === editingKey.id
        ? {
            ...k,
            key_prefix: newKeyValue.substring(0, 8),
            key_suffix: '...' + newKeyValue.slice(-4),
            last_rotated_at: new Date().toISOString(),
          }
        : k
    ));

    // Add audit log
    setKeyAuditLogs(prev => [{
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'rotated',
      provider: editingKey.provider,
      key_name: editingKey.name,
      performed_by: 'admin@company.com',
      ip_address: '192.168.1.100',
      details: 'Manual key rotation',
      success: true,
    }, ...prev]);

    setShowKeyModal(false);
    setNewKeyValue('');
    setEditingKey(null);
  };

  const addNewApiKey = async () => {
    const validation = validateApiKey(newKeyValue, newKeyProvider);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    if (!newKeyName.trim()) {
      alert('Key name is required');
      return;
    }

    // Get the highest version number for this provider to assign next version
    const providerKeys = apiKeys.filter(k => k.provider === newKeyProvider);
    const maxVersion = providerKeys.reduce((max, k) => Math.max(max, k.version || 0), 0);

    const newKey: APIKeyConfig = {
      id: `key-${newKeyProvider}-${Date.now()}`,
      provider: newKeyProvider,
      name: newKeyName,
      key_prefix: newKeyValue.substring(0, 8),
      key_suffix: '...' + newKeyValue.slice(-4),
      created_at: new Date().toISOString(),
      last_used_at: null,
      last_rotated_at: null,
      expires_at: null,
      is_active: true,
      permissions: newKeyProvider === 'kie' ? ['chat', 'completions', 'embeddings'] : ['messages', 'completions'],
      usage_count: 0,
      rate_limit_remaining: newKeyProvider === 'kie' ? 10000 : 5000,
      // Feature #1328: Key versioning
      version: maxVersion + 1,
      role: providerKeys.length === 0 ? 'primary' : 'standby', // First key is primary, others are standby
      traffic_percentage: providerKeys.length === 0 ? 100 : 0,
    };

    setApiKeys(prev => [...prev, newKey]);

    // Add audit log
    setKeyAuditLogs(prev => [{
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'created',
      provider: newKeyProvider,
      key_name: newKeyName,
      performed_by: 'admin@company.com',
      ip_address: '192.168.1.100',
      details: 'New API key added',
      success: true,
    }, ...prev]);

    setShowKeyModal(false);
    setNewKeyValue('');
    setNewKeyName('');
  };

  const toggleKeyActive = (keyId: string) => {
    setApiKeys(prev => prev.map(k =>
      k.id === keyId ? { ...k, is_active: !k.is_active } : k
    ));

    const key = apiKeys.find(k => k.id === keyId);
    if (key) {
      setKeyAuditLogs(prev => [{
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: key.is_active ? 'deactivated' : 'activated',
        provider: key.provider,
        key_name: key.name,
        performed_by: 'admin@company.com',
        ip_address: '192.168.1.100',
        details: key.is_active ? 'Key deactivated' : 'Key activated',
        success: true,
      }, ...prev]);
    }
  };

  const deleteApiKey = (keyId: string) => {
    const key = apiKeys.find(k => k.id === keyId);
    if (!key) return;

    if (!window.confirm(`Are you sure you want to delete "${key.name}"? This action cannot be undone.`)) {
      return;
    }

    setApiKeys(prev => prev.filter(k => k.id !== keyId));

    setKeyAuditLogs(prev => [{
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'deleted',
      provider: key.provider,
      key_name: key.name,
      performed_by: 'admin@company.com',
      ip_address: '192.168.1.100',
      details: 'API key deleted',
      success: true,
    }, ...prev]);
  };

  const openAddKeyModal = () => {
    setKeyModalMode('add');
    setEditingKey(null);
    setNewKeyValue('');
    setNewKeyName('');
    setNewKeyProvider('kie');
    setShowKeyModal(true);
  };

  const openRotateKeyModal = (key: APIKeyConfig) => {
    setKeyModalMode('rotate');
    setEditingKey(key);
    setNewKeyValue('');
    setShowKeyModal(true);
  };

  // Feature #1328: Zero-downtime key rotation with gradual traffic shift
  const [rotatingKeys, setRotatingKeys] = useState<Set<string>>(new Set());

  const startZeroDowntimeRotation = async (primaryKeyId: string, standbyKeyId: string) => {
    const primaryKey = apiKeys.find(k => k.id === primaryKeyId);
    const standbyKey = apiKeys.find(k => k.id === standbyKeyId);
    if (!primaryKey || !standbyKey) return;

    // Mark rotation as in progress
    setRotatingKeys(prev => new Set([...prev, primaryKeyId, standbyKeyId]));

    // Start gradual traffic shift: 100/0 -> 75/25 -> 50/50 -> 25/75 -> 0/100
    const trafficShifts = [
      { primary: 75, standby: 25 },
      { primary: 50, standby: 50 },
      { primary: 25, standby: 75 },
      { primary: 0, standby: 100 },
    ];

    for (const shift of trafficShifts) {
      await new Promise(r => setTimeout(r, 1000)); // 1 second between shifts

      setApiKeys(prev => prev.map(k => {
        if (k.id === primaryKeyId) {
          return { ...k, traffic_percentage: shift.primary, rotation_status: 'in_progress' as const };
        }
        if (k.id === standbyKeyId) {
          return { ...k, traffic_percentage: shift.standby, rotation_status: 'in_progress' as const };
        }
        return k;
      }));
    }

    // Finalize: swap roles
    setApiKeys(prev => prev.map(k => {
      if (k.id === primaryKeyId) {
        return { ...k, role: 'retiring' as const, rotation_status: 'completed' as const, traffic_percentage: 0 };
      }
      if (k.id === standbyKeyId) {
        return { ...k, role: 'primary' as const, rotation_status: 'completed' as const, traffic_percentage: 100 };
      }
      return k;
    }));

    setRotatingKeys(prev => {
      const next = new Set(prev);
      next.delete(primaryKeyId);
      next.delete(standbyKeyId);
      return next;
    });

    // Add audit log
    setKeyAuditLogs(prev => [{
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'rotated',
      provider: primaryKey.provider,
      key_name: `${primaryKey.name} → ${standbyKey.name}`,
      performed_by: 'admin@company.com',
      ip_address: '192.168.1.100',
      details: 'Zero-downtime rotation completed',
      success: true,
    }, ...prev]);
  };

  const promoteToStandby = (keyId: string) => {
    const key = apiKeys.find(k => k.id === keyId);
    if (!key || key.role === 'standby') return;

    setApiKeys(prev => prev.map(k =>
      k.id === keyId ? { ...k, role: 'standby' as const } : k
    ));

    if (key) {
      setKeyAuditLogs(prev => [{
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'updated',
        provider: key.provider,
        key_name: key.name,
        performed_by: 'admin@company.com',
        ip_address: '192.168.1.100',
        details: 'Key demoted to standby role',
        success: true,
      }, ...prev]);
    }
  };

  const formatNumber = (num: number) => num.toLocaleString();

  // Feature #1331: Calculate delay for exponential backoff
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
      alert(`All ${retryConfig.max_retries} retries failed for ${errorType}. Triggering fallback to ${config?.fallback_provider || 'none'}.`);
    }
  };

  // Feature #1334: Update feature timeout
  const updateFeatureTimeout = (feature: AIFeatureType, updates: Partial<FeatureTimeout>) => {
    setFeatureTimeouts(prev => prev.map(ft =>
      ft.feature === feature ? { ...ft, ...updates } : ft
    ));
  };

  // Feature #1334: Format timeout duration for display
  const formatTimeoutDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Feature #1334: Get feature icon
  const getFeatureIcon = (feature: AIFeatureType): string => {
    const icons: Record<AIFeatureType, string> = {
      chat: '💬',
      completion: '✍️',
      embedding: '📊',
      analysis: '🔍',
      code_review: '👁️',
      test_generation: '🧪',
    };
    return icons[feature] || '⚙️';
  };

  // Feature #1333: Model selection helper functions
  const getModelInfo = (model: AIModelType) => {
    const modelInfo: Record<AIModelType, { name: string; icon: string; description: string; tier: string; costBadge: string; cost: number; latency: string }> = {
      'claude-opus-4.5-thinking': {
        name: 'Opus 4.5 Thinking',
        icon: '🧠',
        description: 'Most capable, extended reasoning',
        tier: 'Premium',
        costBadge: '$$$',
        cost: 0.015,
        latency: '3000'
      },
      'claude-opus-4.5': {
        name: 'Opus 4.5',
        icon: '🎯',
        description: 'High capability, complex tasks',
        tier: 'Premium',
        costBadge: '$$$',
        cost: 0.015,
        latency: '2000'
      },
      'claude-sonnet-4': {
        name: 'Sonnet 4',
        icon: '⚡',
        description: 'Balanced speed & quality',
        tier: 'Standard',
        costBadge: '$$',
        cost: 0.003,
        latency: '800'
      },
      'claude-haiku-3.5': {
        name: 'Haiku 3.5',
        icon: '🚀',
        description: 'Fast, cost-effective',
        tier: 'Economy',
        costBadge: '$',
        cost: 0.00025,
        latency: '200'
      },
    };
    return modelInfo[model];
  };

  const getQualityTierColor = (tier: 'premium' | 'standard' | 'economy') => {
    switch (tier) {
      case 'premium': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'standard': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'economy': return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const updateFeatureModel = (feature: AIFeatureType, model: AIModelType) => {
    const modelInfo = getModelInfo(model);
    const costMap: Record<AIModelType, number> = {
      'claude-opus-4.5-thinking': 0.015,
      'claude-opus-4.5': 0.015,
      'claude-sonnet-4': 0.003,
      'claude-haiku-3.5': 0.00025
    };
    const latencyMap: Record<AIModelType, number> = {
      'claude-opus-4.5-thinking': 2500,
      'claude-opus-4.5': 1800,
      'claude-sonnet-4': 450,
      'claude-haiku-3.5': 120
    };
    const tierMap: Record<AIModelType, 'premium' | 'standard' | 'economy'> = {
      'claude-opus-4.5-thinking': 'premium',
      'claude-opus-4.5': 'premium',
      'claude-sonnet-4': 'standard',
      'claude-haiku-3.5': 'economy'
    };

    setFeatureModelConfigs(prev => prev.map(config =>
      config.feature === feature
        ? {
            ...config,
            model,
            override_org_default: model !== orgDefaultModel,
            cost_per_1k_tokens: costMap[model],
            avg_latency_ms: latencyMap[model],
            quality_tier: tierMap[model]
          }
        : config
    ));
  };

  const resetFeatureToOrgDefault = (feature: AIFeatureType) => {
    updateFeatureModel(feature, orgDefaultModel);
    setFeatureModelConfigs(prev => prev.map(config =>
      config.feature === feature
        ? { ...config, override_org_default: false }
        : config
    ));
  };

  const getTotalEstimatedMonthlyCost = () => {
    return modelUsageStats.reduce((sum, stat) => sum + stat.total_cost_cents, 0);
  };

  // Feature #1335: Rate limiting helper functions
  const getRateLimitUsagePercent = (provider: 'kie' | 'anthropic', metric: 'minute' | 'hour' | 'tokens'): number => {
    const config = rateLimitConfigs.find(c => c.provider === provider);
    const status = rateLimitStatus.find(s => s.provider === provider);
    if (!config || !status) return 0;

    if (metric === 'minute') {
      const used = config.requests_per_minute - status.requests_remaining_minute;
      return (used / config.requests_per_minute) * 100;
    } else if (metric === 'hour') {
      const used = config.requests_per_hour - status.requests_remaining_hour;
      return (used / config.requests_per_hour) * 100;
    } else {
      const used = config.tokens_per_minute - status.tokens_remaining_minute;
      return (used / config.tokens_per_minute) * 100;
    }
  };

  const getProviderRateLimitColor = (provider: 'kie' | 'anthropic'): string => {
    const status = rateLimitStatus.find(s => s.provider === provider);
    if (!status) return 'gray';
    if (status.is_rate_limited) return 'red';
    const config = rateLimitConfigs.find(c => c.provider === provider);
    if (!config) return 'gray';
    const usagePercent = getRateLimitUsagePercent(provider, 'minute');
    if (usagePercent >= config.alert_threshold_percent) return 'amber';
    if (usagePercent >= 50) return 'yellow';
    return 'green';
  };

  const formatTimeRemaining = (isoString: string): string => {
    const ms = new Date(isoString).getTime() - Date.now();
    if (ms <= 0) return 'Now';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStrategyIcon = (strategy: RateLimitStrategy): string => {
    switch (strategy) {
      case 'queue': return '📋';
      case 'retry': return '🔄';
      case 'failover': return '↔️';
      case 'drop': return '🚫';
      default: return '❓';
    }
  };

  const getStrategyLabel = (strategy: RateLimitStrategy): string => {
    switch (strategy) {
      case 'queue': return 'Queue requests';
      case 'retry': return 'Retry with backoff';
      case 'failover': return 'Failover to alt provider';
      case 'drop': return 'Drop request';
      default: return strategy;
    }
  };

  const getEventTypeIcon = (eventType: RateLimitEvent['event_type']): string => {
    switch (eventType) {
      case 'limit_hit': return '🛑';
      case 'request_queued': return '📋';
      case 'request_dropped': return '🚫';
      case 'failover_triggered': return '↔️';
      case 'limit_cleared': return '✅';
      default: return '📝';
    }
  };

  const getAlertSeverityColor = (severity: RateLimitAlert['severity']): { bg: string; text: string; border: string } => {
    switch (severity) {
      case 'critical': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
      case 'warning': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
      case 'info': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
      default: return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
    }
  };

  const updateRateLimitConfig = (provider: 'kie' | 'anthropic', updates: Partial<ProviderRateLimitConfig>) => {
    setRateLimitConfigs(prev => prev.map(c =>
      c.provider === provider ? { ...c, ...updates } : c
    ));
  };

  const acknowledgeRateLimitAlert = (alertId: string) => {
    setRateLimitAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
  };

  const clearQueuedRequest = (provider: 'kie' | 'anthropic', requestId: string) => {
    setRateLimitStatus(prev => prev.map(s =>
      s.provider === provider
        ? { ...s, queued_requests: s.queued_requests.filter(r => r.id !== requestId), current_queue_size: s.current_queue_size - 1 }
        : s
    ));
    // Add event for request being dropped
    const newEvent: RateLimitEvent = {
      id: `evt-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      provider,
      feature: 'chat',
      event_type: 'request_dropped',
      details: 'Request manually removed from queue',
      requests_remaining: rateLimitStatus.find(s => s.provider === provider)?.requests_remaining_minute || 0,
    };
    setRateLimitEvents(prev => [newEvent, ...prev.slice(0, 19)]);
  };

  const getTotalRateLimitHits = (): number => {
    return rateLimitStatus.reduce((sum, s) => sum + s.rate_limit_hits_24h, 0);
  };

  const getTotalQueuedRequests = (): number => {
    return rateLimitStatus.reduce((sum, s) => sum + s.current_queue_size, 0);
  };

  // Feature #1339: Fallback rules helper functions
  const getTriggerIcon = (trigger: FallbackTrigger): string => {
    switch (trigger) {
      case 'error': return '❌';
      case 'timeout': return '⏱️';
      case 'rate_limit': return '🚦';
      case 'server_error': return '🔥';
      case 'network_error': return '🌐';
    }
  };

  const getTriggerLabel = (trigger: FallbackTrigger): string => {
    switch (trigger) {
      case 'error': return 'Error';
      case 'timeout': return 'Timeout';
      case 'rate_limit': return 'Rate Limit';
      case 'server_error': return 'Server Error';
      case 'network_error': return 'Network Error';
    }
  };

  const getProviderLabel = (provider: 'kie' | 'anthropic' | 'any' | 'none'): string => {
    switch (provider) {
      case 'kie': return 'Kie.ai';
      case 'anthropic': return 'Anthropic';
      case 'any': return 'Any Provider';
      case 'none': return 'None (Fail)';
    }
  };

  const updateFallbackRule = (ruleId: string, updates: Partial<FallbackRule>) => {
    setFallbackRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  };

  const deleteFallbackRule = (ruleId: string) => {
    setFallbackRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  const createFallbackRule = () => {
    const newRule: FallbackRule = {
      id: `rule-${Date.now().toString(36)}`,
      name: 'New Fallback Rule',
      enabled: false,
      priority: fallbackRules.length + 1,
      triggers: ['error'],
      source_provider: 'any',
      target_provider: 'anthropic',
      retry_before_fallback: 1,
      timeout_threshold_ms: 30000,
      retry_delay_ms: 1000,
      max_fallback_attempts: 2,
      preserve_context: true,
      log_fallback: true,
      notify_on_fallback: false,
      cooldown_after_fallback_ms: 5000,
    };
    setFallbackRules(prev => [...prev, newRule]);
    setEditingFallbackRule(newRule);
    setShowFallbackRuleModal(true);
  };

  const testFallbackManually = async (trigger: FallbackTrigger) => {
    setIsTestingFallback(true);
    setTestingFallbackTrigger(trigger);

    // Find applicable rule
    const rule = fallbackRules
      .filter(r => r.enabled && r.triggers.includes(trigger))
      .sort((a, b) => a.priority - b.priority)[0];

    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

    const success = Math.random() > 0.2;
    const newResult: FallbackTestResult = {
      rule_id: rule?.id || 'no-rule',
      trigger,
      timestamp: new Date().toISOString(),
      source_provider: rule?.source_provider === 'any' ? 'Kie.ai' : getProviderLabel(rule?.source_provider || 'kie'),
      target_provider: getProviderLabel(rule?.target_provider || 'anthropic'),
      success,
      fallback_latency_ms: Math.floor(100 + Math.random() * 500),
      retries_attempted: rule?.retry_before_fallback || 0,
      error_message: success ? undefined : 'Simulated fallback failure for testing',
    };

    setFallbackTestResults(prev => [newResult, ...prev.slice(0, 9)]);
    setIsTestingFallback(false);
    setTestingFallbackTrigger(null);

    if (rule) {
      alert(`${success ? '✅' : '❌'} Fallback test for "${trigger}"\n\nRule: ${rule.name}\nTarget: ${getProviderLabel(rule.target_provider)}\nRetries: ${rule.retry_before_fallback}\nResult: ${success ? 'SUCCESS' : 'FAILED'}\nLatency: ${newResult.fallback_latency_ms}ms`);
    } else {
      alert(`⚠️ No enabled rule found for trigger "${trigger}"\n\nPlease enable a rule with this trigger to test fallback.`);
    }
  };

  const getFallbackSuccessRate = (): number => {
    if (fallbackStats.total_fallbacks_24h === 0) return 100;
    return Math.round((fallbackStats.successful_fallbacks_24h / fallbackStats.total_fallbacks_24h) * 100);
  };

  // Feature #1334: Simulate timeout scenario
  const simulateTimeout = async (feature: AIFeatureType) => {
    setIsSimulatingTimeout(true);
    const featureConfig = featureTimeouts.find(ft => ft.feature === feature);
    if (!featureConfig) {
      setIsSimulatingTimeout(false);
      return;
    }

    // Simulate a request that takes longer than configured timeout
    const configuredTimeout = featureConfig.timeout_ms;
    const actualDuration = configuredTimeout + Math.floor(Math.random() * 5000) + 1000; // 1-6s over timeout

    // Create timeout event
    const newEvent: TimeoutEvent = {
      id: `to-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      feature,
      configured_timeout_ms: configuredTimeout,
      actual_duration_ms: actualDuration,
      provider: config?.primary_provider || 'kie',
      triggered_fallback: featureConfig.fallback_on_timeout,
      fallback_success: featureConfig.fallback_on_timeout ? Math.random() > 0.15 : undefined,
    };

    // Simulate processing time
    await new Promise(r => setTimeout(r, 1500));

    // Add to events log
    setTimeoutEvents(prev => [newEvent, ...prev.slice(0, 19)]);

    // Update stats
    setTimeoutStats(prev => ({
      ...prev,
      total_timeouts: prev.total_timeouts + 1,
      timeouts_by_feature: {
        ...prev.timeouts_by_feature,
        [feature]: prev.timeouts_by_feature[feature] + 1,
      },
      avg_timeout_duration_ms: Math.round((prev.avg_timeout_duration_ms * prev.total_timeouts + (actualDuration - configuredTimeout)) / (prev.total_timeouts + 1)),
      fallback_success_rate: featureConfig.fallback_on_timeout && newEvent.fallback_success
        ? ((prev.fallback_success_rate * prev.total_timeouts) + 100) / (prev.total_timeouts + 1)
        : prev.fallback_success_rate,
    }));

    setIsSimulatingTimeout(false);

    // Show notification
    if (featureConfig.fallback_on_timeout) {
      if (newEvent.fallback_success) {
        alert(`⏱️ ${featureConfig.name} timed out after ${formatTimeoutDuration(configuredTimeout)}.\n✅ Successfully fell back to ${config?.fallback_provider || 'backup'} provider.`);
      } else {
        alert(`⏱️ ${featureConfig.name} timed out after ${formatTimeoutDuration(configuredTimeout)}.\n❌ Fallback to ${config?.fallback_provider || 'backup'} also failed.`);
      }
    } else {
      alert(`⏱️ ${featureConfig.name} timed out after ${formatTimeoutDuration(configuredTimeout)}.\n⚠️ No fallback configured for this feature.`);
    }
  };

  // Feature #1334: Reset all timeouts to default
  const resetToDefaultTimeouts = () => {
    setFeatureTimeouts(prev => prev.map(ft => ({
      ...ft,
      timeout_ms: defaultTimeout,
    })));
  };

  // Feature #1329: Budget helper functions
  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getBudgetPercentage = (): number => {
    return (spendingData.current_month_spend_cents / budgetConfig.monthly_budget_cents) * 100;
  };

  const getBudgetStatus = (): 'ok' | 'warning' | 'critical' | 'blocked' => {
    const percentage = getBudgetPercentage();
    if (percentage >= budgetConfig.hard_limit_percentage && budgetConfig.block_on_hard_limit) {
      return 'blocked';
    }
    if (percentage >= budgetConfig.soft_limit_percentage) {
      return 'critical';
    }
    if (percentage >= budgetConfig.soft_limit_percentage - 10) {
      return 'warning';
    }
    return 'ok';
  };

  const getDaysUntilReset = (): number => {
    const today = new Date();
    const resetDay = budgetConfig.billing_cycle_day;
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    if (currentDay < resetDay) {
      return resetDay - currentDay;
    } else {
      return daysInMonth - currentDay + resetDay;
    }
  };

  const getProjectedSpend = (): number => {
    const daysElapsed = spendingData.daily_spend.length;
    const avgDailySpend = spendingData.current_month_spend_cents / Math.max(daysElapsed, 1);
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    return Math.round(avgDailySpend * daysInMonth);
  };

  const simulateSpending = (amount_cents: number) => {
    const newSpend = spendingData.current_month_spend_cents + amount_cents;
    const newPercentage = (newSpend / budgetConfig.monthly_budget_cents) * 100;

    setSpendingData(prev => ({
      ...prev,
      current_month_spend_cents: newSpend,
      requests_this_month: prev.requests_this_month + Math.ceil(amount_cents / prev.avg_cost_per_request_cents),
    }));

    // Check for alerts
    if (newPercentage >= budgetConfig.hard_limit_percentage && budgetConfig.block_on_hard_limit) {
      setBudgetAlerts(prev => [{
        id: `alert-${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        type: 'hard_limit',
        percentage: Math.round(newPercentage),
        message: `Hard limit reached! AI requests are now blocked. Current spend: ${formatCurrency(newSpend)}`,
        acknowledged: false,
      }, ...prev]);
      alert(`🚫 HARD LIMIT REACHED!\n\nYou have used ${newPercentage.toFixed(1)}% of your monthly AI budget.\nNew AI requests are now blocked until the billing cycle resets.\n\nSpend: ${formatCurrency(newSpend)} / ${formatCurrency(budgetConfig.monthly_budget_cents)}`);
    } else if (newPercentage >= budgetConfig.soft_limit_percentage && budgetConfig.alert_on_soft_limit) {
      const existingSoftAlert = budgetAlerts.find(a => a.type === 'soft_limit' && !a.acknowledged);
      if (!existingSoftAlert) {
        setBudgetAlerts(prev => [{
          id: `alert-${Date.now().toString(36)}`,
          timestamp: new Date().toISOString(),
          type: 'soft_limit',
          percentage: Math.round(newPercentage),
          message: `Soft limit reached! You have used ${Math.round(newPercentage)}% of your monthly AI budget.`,
          acknowledged: false,
        }, ...prev]);
      }
    }
  };

  const resetBudget = () => {
    setSpendingData(prev => ({
      ...prev,
      current_month_spend_cents: 0,
      daily_spend: [],
      requests_this_month: 0,
    }));
    setBudgetAlerts(prev => [{
      id: `alert-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      type: 'reset',
      percentage: 0,
      message: 'Monthly budget has been reset for the new billing cycle.',
      acknowledged: false,
    }, ...prev]);
    setShowBudgetResetModal(false);
    alert('✅ Budget Reset!\n\nYour monthly AI budget has been reset. All spending counters are now at $0.00.');
  };

  const acknowledgeAlert = (alertId: string) => {
    setBudgetAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
  };

  // Feature #1330: AI Cost Alert Notification Functions
  const updateAlertThreshold = (index: number, updates: Partial<CostAlertThreshold>) => {
    setAlertNotificationConfig(prev => ({
      ...prev,
      thresholds: prev.thresholds.map((t, i) =>
        i === index ? { ...t, ...updates } : t
      ),
    }));
  };

  const addEmailRecipient = (email: string) => {
    if (email && !alertNotificationConfig.email_recipients.includes(email)) {
      setAlertNotificationConfig(prev => ({
        ...prev,
        email_recipients: [...prev.email_recipients, email],
      }));
    }
  };

  const removeEmailRecipient = (email: string) => {
    setAlertNotificationConfig(prev => ({
      ...prev,
      email_recipients: prev.email_recipients.filter(e => e !== email),
    }));
  };

  const sendTestNotification = (thresholdPercentage: number) => {
    const currentPercent = getBudgetPercentage();
    const channelsSent: ('email' | 'slack')[] = [];
    const recipients: string[] = [];

    if (alertNotificationConfig.email_enabled) {
      channelsSent.push('email');
      recipients.push(...alertNotificationConfig.email_recipients);
    }
    if (alertNotificationConfig.slack_enabled) {
      channelsSent.push('slack');
    }

    const newNotification: CostAlertNotification = {
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      threshold_percentage: thresholdPercentage,
      current_percentage: currentPercent,
      spend_amount_cents: spendingData.current_month_spend_cents,
      budget_amount_cents: budgetConfig.monthly_budget_cents,
      channels_sent: channelsSent,
      recipients: recipients,
      breakdown_included: alertNotificationConfig.include_breakdown,
      suggestions_included: alertNotificationConfig.include_suggestions,
      status: 'sent',
    };

    setSentNotifications(prev => [newNotification, ...prev]);
    setShowTestNotificationModal(false);

    // Show what the notification would contain
    let notificationPreview = `📧 Test Alert Sent!\n\n`;
    notificationPreview += `Threshold: ${thresholdPercentage}%\n`;
    notificationPreview += `Current Usage: ${currentPercent.toFixed(1)}%\n`;
    notificationPreview += `Spending: $${formatCurrency(spendingData.current_month_spend_cents)} / $${formatCurrency(budgetConfig.monthly_budget_cents)}\n\n`;
    notificationPreview += `Channels: ${channelsSent.join(', ')}\n`;
    notificationPreview += `Recipients: ${recipients.join(', ')}`;

    if (alertNotificationConfig.include_breakdown) {
      notificationPreview += `\n\n📊 Cost Breakdown Included:\n`;
      notificationPreview += `• KIE: $${formatCurrency(spendingData.by_provider.kie || 0)}\n`;
      notificationPreview += `• Anthropic: $${formatCurrency(spendingData.by_provider.anthropic || 0)}`;
    }

    if (alertNotificationConfig.include_suggestions) {
      notificationPreview += `\n\n💡 Top Cost Reduction Suggestions Included:\n`;
      const topSuggestions = costReductionSuggestions
        .sort((a, b) => b.estimated_savings_percent - a.estimated_savings_percent)
        .slice(0, 3);
      topSuggestions.forEach((s, i) => {
        notificationPreview += `${i + 1}. ${s.title} (${s.estimated_savings_percent}% savings)\n`;
      });
    }

    alert(notificationPreview);
  };

  const getSuggestionIcon = (category: CostReductionSuggestion['category']): string => {
    const icons: Record<CostReductionSuggestion['category'], string> = {
      caching: '💾',
      batching: '📦',
      model_downgrade: '⬇️',
      rate_limiting: '🚦',
      feature_disable: '🔌',
    };
    return icons[category];
  };

  const getPriorityColor = (priority: CostReductionSuggestion['priority']): string => {
    const colors: Record<CostReductionSuggestion['priority'], string> = {
      high: 'text-red-600 bg-red-50 border-red-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      low: 'text-green-600 bg-green-50 border-green-200',
    };
    return colors[priority];
  };

  const formatNotificationTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Feature #1332: AI Response Caching Functions
  const generateCacheKey = (feature: AIFeatureType, prompt: string, model: string): string => {
    // Simulate cache key generation from request parameters
    const input = `${feature}:${model}:${prompt}`;
    // Simple hash simulation (in real implementation, use proper hash function)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${cacheConfig.hash_algorithm}:${hashHex}...`;
  };

  const updateFeatureCacheConfig = (feature: AIFeatureType, updates: Partial<{ enabled: boolean; ttl_seconds: number }>) => {
    setCacheConfig(prev => ({
      ...prev,
      cache_by_feature: {
        ...prev.cache_by_feature,
        [feature]: { ...prev.cache_by_feature[feature], ...updates },
      },
    }));
  };

  const formatTTL = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCacheEventIcon = (type: CacheEvent['type']): string => {
    const icons: Record<CacheEvent['type'], string> = {
      hit: '✅',
      miss: '❌',
      store: '💾',
      invalidate: '🔄',
      expire: '⏰',
      evict: '🗑️',
    };
    return icons[type];
  };

  const getCacheEventColor = (type: CacheEvent['type']): string => {
    const colors: Record<CacheEvent['type'], string> = {
      hit: 'bg-green-50 border-green-200 text-green-800',
      miss: 'bg-red-50 border-red-200 text-red-800',
      store: 'bg-blue-50 border-blue-200 text-blue-800',
      invalidate: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      expire: 'bg-gray-50 border-gray-200 text-gray-800',
      evict: 'bg-orange-50 border-orange-200 text-orange-800',
    };
    return colors[type];
  };

  const simulateCacheHit = () => {
    const features: AIFeatureType[] = ['chat', 'completion', 'embedding', 'analysis'];
    const randomFeature = features[Math.floor(Math.random() * features.length)];
    const latencySaved = Math.floor(Math.random() * 1500) + 200;
    const costSaved = Math.floor(Math.random() * 5) + 1;

    const newEvent: CacheEvent = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'hit',
      cache_key: generateCacheKey(randomFeature, 'test prompt', 'claude-3-sonnet'),
      feature_type: randomFeature,
      latency_saved_ms: latencySaved,
      cost_saved_cents: costSaved,
    };

    setCacheEvents(prev => [newEvent, ...prev.slice(0, 9)]);
    setCacheStats(prev => ({
      ...prev,
      total_hits: prev.total_hits + 1,
      hit_rate_percent: ((prev.total_hits + 1) / (prev.total_hits + prev.total_misses + 1)) * 100,
      estimated_cost_savings_cents: prev.estimated_cost_savings_cents + costSaved,
      estimated_latency_savings_ms: prev.estimated_latency_savings_ms + latencySaved,
    }));

    alert(`✅ Cache HIT!\n\nFeature: ${randomFeature}\nLatency Saved: ${latencySaved}ms\nCost Saved: $${(costSaved / 100).toFixed(2)}`);
  };

  const simulateCacheMiss = () => {
    const features: AIFeatureType[] = ['chat', 'completion', 'embedding', 'analysis'];
    const randomFeature = features[Math.floor(Math.random() * features.length)];

    const newEvent: CacheEvent = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'miss',
      cache_key: generateCacheKey(randomFeature, 'new unique prompt', 'claude-3-sonnet'),
      feature_type: randomFeature,
    };

    setCacheEvents(prev => [newEvent, ...prev.slice(0, 9)]);
    setCacheStats(prev => ({
      ...prev,
      total_misses: prev.total_misses + 1,
      hit_rate_percent: (prev.total_hits / (prev.total_hits + prev.total_misses + 1)) * 100,
    }));

    // Simulate storing the response
    setTimeout(() => {
      const storeEvent: CacheEvent = {
        id: `evt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'store',
        cache_key: generateCacheKey(randomFeature, 'new unique prompt', 'claude-3-sonnet'),
        feature_type: randomFeature,
      };
      setCacheEvents(prev => [storeEvent, ...prev.slice(0, 9)]);
      setCacheStats(prev => ({
        ...prev,
        total_entries: prev.total_entries + 1,
        active_entries: prev.active_entries + 1,
      }));
    }, 500);

    alert(`❌ Cache MISS!\n\nFeature: ${randomFeature}\nNew request - response will be cached for future use.`);
  };

  const invalidateCache = (reason: string) => {
    const invalidateEvent: CacheEvent = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'invalidate',
      cache_key: 'all',
      feature_type: 'chat',
      reason: reason,
    };

    setCacheEvents(prev => [invalidateEvent, ...prev.slice(0, 9)]);
    setCacheStats(prev => ({
      ...prev,
      active_entries: 0,
    }));
    setCacheEntries(prev => prev.map(e => ({ ...e, status: 'invalidated' as const })));

    alert(`🔄 Cache Invalidated!\n\nReason: ${reason}\nAll ${cacheStats.active_entries} cached entries have been invalidated.`);
  };

  const clearCache = () => {
    setCacheStats(prev => ({
      ...prev,
      total_entries: 0,
      active_entries: 0,
      cache_size_mb: 0,
    }));
    setCacheEntries([]);
    setShowCacheClearModal(false);
    alert('🗑️ Cache Cleared!\n\nAll cached AI responses have been removed.');
  };

  const previewCacheKey = (prompt: string) => {
    if (prompt.length > 0) {
      const key = generateCacheKey('chat', prompt, 'claude-3-sonnet');
      setCacheKeyPreview(key);
    } else {
      setCacheKeyPreview('');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/ai-insights')}
            className="text-blue-500 hover:text-blue-700 mb-2 flex items-center gap-1"
          >
            ← Back to AI Insights
          </button>
          <h1 className="text-2xl font-bold">🔀 AI Provider Router</h1>
          <p className="text-gray-600">Route AI requests with automatic fallback</p>
        </div>
      </div>

      {/* Provider Flow Diagram */}
      <div className="mb-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-lg p-6 text-white">
        <h2 className="text-lg font-bold mb-4">Request Flow</h2>
        <div className="flex items-center justify-center gap-4">
          <div className="bg-white/20 rounded-lg p-4 text-center">
            <div className="text-2xl mb-1">📨</div>
            <div className="font-medium">Request</div>
          </div>
          <div className="text-2xl">→</div>
          <div className={`rounded-lg p-4 text-center ${config?.primary_provider === 'kie' ? 'bg-green-500/50 ring-2 ring-white' : 'bg-white/20'}`}>
            <div className="text-2xl mb-1">🤖</div>
            <div className="font-medium">Kie.ai</div>
            <div className="text-xs opacity-70">Primary</div>
          </div>
          <div className="text-xl">⚡</div>
          <div className={`rounded-lg p-4 text-center ${config?.fallback_provider === 'anthropic' ? 'bg-amber-500/50' : 'bg-white/20'}`}>
            <div className="text-2xl mb-1">🔵</div>
            <div className="font-medium">Anthropic</div>
            <div className="text-xs opacity-70">Fallback</div>
          </div>
          <div className="text-2xl">→</div>
          <div className="bg-white/20 rounded-lg p-4 text-center">
            <div className="text-2xl mb-1">✅</div>
            <div className="font-medium">Response</div>
          </div>
        </div>
      </div>

      {/* Feature #1327: Hot-Swap Provider Section */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>⚡</span> Hot-Swap Provider
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">No Restart Required</span>
            </h2>
            <p className="text-sm text-gray-600">Switch between AI providers instantly without service interruption</p>
          </div>
          {activeProvider?.switching && (
            <div className="flex items-center gap-2 text-amber-600 animate-pulse">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-600 border-t-transparent"></div>
              <span>Switching...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Kie.ai Provider Card */}
          <div className={`border-2 rounded-lg p-4 transition-all ${
            activeProvider?.current_provider === 'kie'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-blue-300'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="text-3xl">🤖</span>
                  {/* Connection Status Indicator */}
                  <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                    activeProvider?.available_providers?.find(p => p.id === 'kie')?.configured
                      ? 'bg-green-500'
                      : 'bg-yellow-500'
                  }`} title={activeProvider?.available_providers?.find(p => p.id === 'kie')?.configured ? 'Connected' : 'Not Configured'}></span>
                </div>
                <div>
                  <div className="font-semibold text-lg">Kie.ai</div>
                  <div className="text-sm text-green-600 font-medium">💰 70% cost savings</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {activeProvider?.current_provider === 'kie' ? (
                  <span className="px-3 py-1 bg-green-500 text-white text-xs rounded-full font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    ACTIVE
                  </span>
                ) : (
                  <button
                    onClick={() => openSwitchModal('kie')}
                    disabled={isSwitching || activeProvider?.switching}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    Switch to Kie.ai
                  </button>
                )}
                {/* Status Badge */}
                <span className={`text-xs px-2 py-0.5 rounded ${
                  activeProvider?.available_providers?.find(p => p.id === 'kie')?.enabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {activeProvider?.available_providers?.find(p => p.id === 'kie')?.enabled ? '✓ Enabled' : '○ Disabled'}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1 border-t pt-3">
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Intelligent API proxy
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Lower latency routing
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Built-in caching
              </div>
            </div>
          </div>

          {/* Anthropic Direct Card */}
          <div className={`border-2 rounded-lg p-4 transition-all ${
            activeProvider?.current_provider === 'anthropic'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-blue-300'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="text-3xl">🔵</span>
                  {/* Connection Status Indicator */}
                  <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                    activeProvider?.available_providers?.find(p => p.id === 'anthropic')?.configured
                      ? 'bg-green-500'
                      : 'bg-yellow-500'
                  }`} title={activeProvider?.available_providers?.find(p => p.id === 'anthropic')?.configured ? 'Connected' : 'Not Configured'}></span>
                </div>
                <div>
                  <div className="font-semibold text-lg">Anthropic Direct</div>
                  <div className="text-sm text-blue-600 font-medium">🔗 Direct API access</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {activeProvider?.current_provider === 'anthropic' ? (
                  <span className="px-3 py-1 bg-green-500 text-white text-xs rounded-full font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    ACTIVE
                  </span>
                ) : (
                  <button
                    onClick={() => openSwitchModal('anthropic')}
                    disabled={isSwitching || activeProvider?.switching}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    Switch to Anthropic
                  </button>
                )}
                {/* Status Badge */}
                <span className={`text-xs px-2 py-0.5 rounded ${
                  activeProvider?.available_providers?.find(p => p.id === 'anthropic')?.enabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {activeProvider?.available_providers?.find(p => p.id === 'anthropic')?.enabled ? '✓ Enabled' : '○ Disabled'}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1 border-t pt-3">
              <div className="flex items-center gap-2">
                <span className="text-blue-500">✓</span> Full API features
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-500">✓</span> Higher rate limits
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-500">✓</span> Latest models
              </div>
            </div>
          </div>
        </div>

        {/* Last Switch Info */}
        {activeProvider?.last_switch && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span>📝</span>
              <span>Last switch: {activeProvider.last_switch.from} → {activeProvider.last_switch.to}</span>
              <span className="text-gray-400">|</span>
              <span>By: {activeProvider.last_switch.switched_by}</span>
              <span className="text-gray-400">|</span>
              <span>{new Date(activeProvider.last_switch.switched_at).toLocaleString()}</span>
            </div>
            {activeProvider.last_switch.reason && (
              <div className="text-gray-500 mt-1">Reason: {activeProvider.last_switch.reason}</div>
            )}
          </div>
        )}
      </div>

      {/* Provider Switch Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span>⚡</span> Switch Provider
            </h3>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Current:</strong> {activeProvider?.current_provider === 'kie' ? 'Kie.ai' : 'Anthropic Direct'}
              </div>
              <div className="text-sm text-blue-800">
                <strong>Target:</strong> {targetProvider === 'kie' ? 'Kie.ai' : 'Anthropic Direct'}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for switch</label>
              <input
                type="text"
                value={switchReason}
                onChange={(e) => setSwitchReason(e.target.value)}
                placeholder="e.g., Cost optimization, performance testing..."
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gracefulSwitch}
                  onChange={(e) => setGracefulSwitch(e.target.checked)}
                  className="rounded"
                />
                <div>
                  <div className="text-sm font-medium">Graceful switch</div>
                  <div className="text-xs text-gray-500">Wait for pending requests to complete (recommended)</div>
                </div>
              </label>
            </div>

            {switchResult && (
              <div className={`mb-4 p-3 rounded-lg ${
                switchResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="font-medium text-sm">
                  {switchResult.success ? '✅ Switch successful!' : '❌ Switch failed'}
                </div>
                <div className="text-xs mt-1">{switchResult.message}</div>
                {switchResult.success && (
                  <div className="text-xs text-gray-600 mt-1">
                    Duration: {switchResult.switch_duration_ms}ms |
                    Interruption: {switchResult.service_interruption_ms}ms |
                    Requests drained: {switchResult.requests_drained}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSwitchModal(false)}
                disabled={isSwitching}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={hotSwapProvider}
                disabled={isSwitching}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSwitching && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>}
                {isSwitching ? 'Switching...' : 'Switch Provider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{formatNumber(stats.total_requests)}</div>
            <div className="text-xs text-gray-600">Total Requests</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.primary_success_rate}%</div>
            <div className="text-xs text-gray-600">Primary Success</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{formatNumber(stats.fallback_requests)}</div>
            <div className="text-xs text-gray-600">Fallbacks</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.fallback_success_rate}%</div>
            <div className="text-xs text-gray-600">Fallback Success</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <div className="text-2xl font-bold text-cyan-600">{stats.avg_latency_ms}ms</div>
            <div className="text-xs text-gray-600">Avg Latency</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
            <div className="text-xs text-gray-600">Errors</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Configuration */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">⚙️ Router Configuration</h2>
          {config && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Router Enabled</span>
                <button
                  onClick={() => updateConfig({ enabled: !config.enabled })}
                  disabled={isSaving}
                  className={`w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div>
                <label className="text-sm text-gray-600">Primary Provider</label>
                <select
                  value={config.primary_provider}
                  onChange={(e) => updateConfig({ primary_provider: e.target.value as any })}
                  disabled={isSaving}
                  className="mt-1 w-full border rounded p-2"
                >
                  <option value="kie">Kie.ai (70% savings)</option>
                  <option value="anthropic">Anthropic Direct</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600">Fallback Provider</label>
                <select
                  value={config.fallback_provider}
                  onChange={(e) => updateConfig({ fallback_provider: e.target.value as any })}
                  disabled={isSaving}
                  className="mt-1 w-full border rounded p-2"
                >
                  <option value="anthropic">Anthropic Direct</option>
                  <option value="kie">Kie.ai</option>
                  <option value="none">None (fail on error)</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600">Timeout (ms)</label>
                <input
                  type="number"
                  value={config.timeout_ms}
                  onChange={(e) => updateConfig({ timeout_ms: parseInt(e.target.value) })}
                  disabled={isSaving}
                  className="mt-1 w-full border rounded p-2"
                />
              </div>

              <div className="border-t pt-3">
                <div className="text-sm font-medium mb-2">Fallback Triggers</div>
                {['on_timeout', 'on_rate_limit', 'on_error', 'on_server_error'].map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm mb-1">
                    <input
                      type="checkbox"
                      checked={(config.fallback_conditions as any)[key]}
                      onChange={(e) =>
                        updateConfig({
                          fallback_conditions: { ...config.fallback_conditions, [key]: e.target.checked },
                        })
                      }
                      disabled={isSaving}
                    />
                    {key.replace('on_', '').replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Circuit Breakers */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">⚡ Circuit Breakers</h2>

          {circuitBreakers.map((cb) => (
            <div key={cb.provider} className={`mb-4 p-3 rounded-lg border ${
              cb.state === 'closed' ? 'border-green-200 bg-green-50'
              : cb.state === 'open' ? 'border-red-200 bg-red-50'
              : 'border-amber-200 bg-amber-50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium capitalize">{cb.provider}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  cb.state === 'closed' ? 'bg-green-200 text-green-800'
                  : cb.state === 'open' ? 'bg-red-200 text-red-800'
                  : 'bg-amber-200 text-amber-800'
                }`}>
                  {cb.state}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <div>Failures: {cb.failure_count}</div>
                {cb.recovery_at && (
                  <div>Recovers: {new Date(cb.recovery_at).toLocaleTimeString()}</div>
                )}
              </div>
              {cb.state !== 'closed' && (
                <button
                  onClick={() => resetCircuitBreaker(cb.provider)}
                  className="mt-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Reset
                </button>
              )}
            </div>
          ))}

          {config?.circuit_breaker && (
            <div className="mt-4 border-t pt-3">
              <div className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">CB Enabled:</span>
                  <span>{config.circuit_breaker.enabled ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">Threshold:</span>
                  <span>{config.circuit_breaker.failure_threshold} failures</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Recovery:</span>
                  <span>{config.circuit_breaker.recovery_time_ms / 1000}s</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Test Failover */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">🧪 Test Failover</h2>

          <div className="space-y-2 mb-4">
            <button
              onClick={() => testFailover('timeout')}
              disabled={isTesting}
              className="w-full px-4 py-2 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 disabled:opacity-50"
            >
              Test Timeout Failover
            </button>
            <button
              onClick={() => testFailover('rate_limit')}
              disabled={isTesting}
              className="w-full px-4 py-2 bg-purple-100 text-purple-800 rounded hover:bg-purple-200 disabled:opacity-50"
            >
              Test Rate Limit Failover
            </button>
            <button
              onClick={() => testFailover('error')}
              disabled={isTesting}
              className="w-full px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50"
            >
              Test Error Failover
            </button>
          </div>

          {testResult && (
            <div className={`p-3 rounded ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="font-medium mb-1">
                {testResult.success ? '✅ Test Passed' : '❌ Test Failed'}
              </div>
              <div className="text-sm text-gray-600">{testResult.message}</div>
              {testResult.total_latency_ms && (
                <div className="text-xs text-gray-500 mt-1">
                  Latency: {testResult.total_latency_ms}ms
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feature #1331: Retry Configuration with Exponential Backoff */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">🔄 Retry Configuration</h2>
        <p className="text-sm text-gray-500 mb-4">Configure automatic retries with exponential backoff for transient failures</p>

        {/* Retry Enable Toggle */}
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium">Enable Retries</div>
            <div className="text-xs text-gray-500">Automatically retry failed AI requests</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={retryConfig.enabled}
              onChange={(e) => setRetryConfig({ ...retryConfig, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {retryConfig.enabled && (
          <>
            {/* Retry Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <label className="block text-sm font-medium text-blue-800 mb-1">Max Retries</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={retryConfig.max_retries}
                  onChange={(e) => setRetryConfig({ ...retryConfig, max_retries: parseInt(e.target.value) || 3 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="text-xs text-blue-600 mt-1">Number of retry attempts (1-10)</div>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg">
                <label className="block text-sm font-medium text-amber-800 mb-1">Initial Delay (ms)</label>
                <input
                  type="number"
                  min="50"
                  max="5000"
                  value={retryConfig.initial_delay_ms}
                  onChange={(e) => setRetryConfig({ ...retryConfig, initial_delay_ms: parseInt(e.target.value) || 100 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <div className="text-xs text-amber-600 mt-1">Initial backoff delay</div>
              </div>

              <div className="p-3 bg-purple-50 rounded-lg">
                <label className="block text-sm font-medium text-purple-800 mb-1">Max Delay (ms)</label>
                <input
                  type="number"
                  min="1000"
                  max="60000"
                  value={retryConfig.max_delay_ms}
                  onChange={(e) => setRetryConfig({ ...retryConfig, max_delay_ms: parseInt(e.target.value) || 5000 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <div className="text-xs text-purple-600 mt-1">Maximum backoff delay cap</div>
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <label className="block text-sm font-medium text-green-800 mb-1">Backoff Multiplier</label>
                <input
                  type="number"
                  min="1.5"
                  max="4"
                  step="0.5"
                  value={retryConfig.backoff_multiplier}
                  onChange={(e) => setRetryConfig({ ...retryConfig, backoff_multiplier: parseFloat(e.target.value) || 2 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <div className="text-xs text-green-600 mt-1">Exponential multiplier (1.5-4)</div>
              </div>
            </div>

            {/* Retry Conditions */}
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Retry Conditions</h3>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
                  <input
                    type="checkbox"
                    checked={retryConfig.retry_on_timeout}
                    onChange={(e) => setRetryConfig({ ...retryConfig, retry_on_timeout: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">⏱️ Timeout</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
                  <input
                    type="checkbox"
                    checked={retryConfig.retry_on_rate_limit}
                    onChange={(e) => setRetryConfig({ ...retryConfig, retry_on_rate_limit: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm">🚦 Rate Limit</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
                  <input
                    type="checkbox"
                    checked={retryConfig.retry_on_error}
                    onChange={(e) => setRetryConfig({ ...retryConfig, retry_on_error: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                  <span className="text-sm">❌ Server Error</span>
                </label>
              </div>
            </div>

            {/* Backoff Preview */}
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <h3 className="text-sm font-medium mb-2">📊 Backoff Preview</h3>
              <div className="flex items-end gap-1 h-16">
                {Array.from({ length: retryConfig.max_retries }, (_, i) => {
                  const delay = calculateBackoffDelay(i + 1);
                  const maxHeight = 64;
                  const height = (delay / retryConfig.max_delay_ms) * maxHeight;
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <div
                        className="w-8 bg-gradient-to-t from-blue-500 to-purple-500 rounded-t transition-all"
                        style={{ height: `${Math.max(height, 8)}px` }}
                        title={`Attempt ${i + 1}: ${delay}ms`}
                      />
                      <div className="text-xs text-gray-500 mt-1">#{i + 1}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-gray-600 mt-2">
                Delays: {Array.from({ length: retryConfig.max_retries }, (_, i) => `${calculateBackoffDelay(i + 1)}ms`).join(' → ')}
              </div>
            </div>

            {/* Retry Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{retryStats.total_retries}</div>
                <div className="text-xs text-blue-800">Total Retries</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{retryStats.successful_retries}</div>
                <div className="text-xs text-green-800">Successful</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{retryStats.failed_after_retries}</div>
                <div className="text-xs text-red-800">Failed</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{retryStats.avg_retries_before_success.toFixed(1)}</div>
                <div className="text-xs text-purple-800">Avg Attempts</div>
              </div>
            </div>

            {/* Error Type Breakdown */}
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Retries by Error Type</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded">
                  <span>⏱️</span>
                  <div>
                    <div className="text-sm font-medium">{retryStats.by_error_type.timeout}</div>
                    <div className="text-xs text-gray-500">Timeout</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                  <span>🚦</span>
                  <div>
                    <div className="text-sm font-medium">{retryStats.by_error_type.rate_limit}</div>
                    <div className="text-xs text-gray-500">Rate Limit</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
                  <span>❌</span>
                  <div>
                    <div className="text-sm font-medium">{retryStats.by_error_type.error}</div>
                    <div className="text-xs text-gray-500">Client Error</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-100 rounded">
                  <span>🖥️</span>
                  <div>
                    <div className="text-sm font-medium">{retryStats.by_error_type.server_error}</div>
                    <div className="text-xs text-gray-500">Server Error</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulate Retry Buttons */}
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">🧪 Simulate Retry Scenarios</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => simulateRetry('timeout')}
                  disabled={isSimulatingRetry}
                  className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSimulatingRetry ? '⏳' : '⏱️'} Timeout Retry
                </button>
                <button
                  onClick={() => simulateRetry('rate_limit')}
                  disabled={isSimulatingRetry}
                  className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSimulatingRetry ? '⏳' : '🚦'} Rate Limit Retry
                </button>
                <button
                  onClick={() => simulateRetry('error')}
                  disabled={isSimulatingRetry}
                  className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSimulatingRetry ? '⏳' : '❌'} Error Retry
                </button>
              </div>
            </div>

            {/* Retry Logs */}
            <div>
              <h3 className="text-sm font-medium mb-2">📋 Retry Event Logs</h3>
              {retryLogs.length === 0 ? (
                <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                  <div className="text-2xl mb-2">📭</div>
                  <div className="text-sm">No retry events logged yet</div>
                  <div className="text-xs text-gray-400 mt-1">Simulate a retry scenario to see logs</div>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {retryLogs.slice().reverse().map((log, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded border text-sm ${
                        log.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{log.success ? '✅' : '🔄'}</span>
                        <div>
                          <div className="font-medium">
                            {log.request_id} • Attempt #{log.attempt_number}
                          </div>
                          <div className="text-xs text-gray-500">
                            {log.error_type.toUpperCase()} • {log.error_message}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium">{log.delay_ms}ms delay</div>
                        <div className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Feature #1334: Timeout Configuration */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">⏱️ Timeout Configuration</h2>
            <p className="text-sm text-gray-500">Configure timeout duration per AI feature type</p>
          </div>
          <button
            onClick={resetToDefaultTimeouts}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
          >
            Reset to Defaults
          </button>
        </div>

        {/* Default Timeout Setting */}
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-amber-800">🌐 Default Timeout</h3>
              <p className="text-sm text-amber-600">Base timeout for all AI requests</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5000"
                max="120000"
                step="5000"
                value={defaultTimeout}
                onChange={(e) => setDefaultTimeout(parseInt(e.target.value))}
                className="w-32 h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-2xl font-bold text-amber-700 w-20 text-right">
                {formatTimeoutDuration(defaultTimeout)}
              </div>
            </div>
          </div>
        </div>

        {/* Per-Feature Timeout Configuration */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">📋 Per-Feature Timeouts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featureTimeouts.map((ft) => (
              <div
                key={ft.feature}
                className={`p-4 rounded-lg border-2 transition-all ${
                  ft.enabled
                    ? 'bg-white border-blue-200 shadow-sm'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getFeatureIcon(ft.feature)}</span>
                    <div>
                      <div className="font-medium">{ft.name}</div>
                      <div className="text-xs text-gray-500">{ft.description}</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ft.enabled}
                      onChange={(e) => updateFeatureTimeout(ft.feature, { enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {ft.enabled && (
                  <>
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Timeout</span>
                        <span className="font-mono font-medium">{formatTimeoutDuration(ft.timeout_ms)}</span>
                      </div>
                      <input
                        type="range"
                        min="5000"
                        max="180000"
                        step="5000"
                        value={ft.timeout_ms}
                        onChange={(e) => updateFeatureTimeout(ft.feature, { timeout_ms: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>5s</span>
                        <span>3m</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ft.fallback_on_timeout}
                          onChange={(e) => updateFeatureTimeout(ft.feature, { fallback_on_timeout: e.target.checked })}
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                        />
                        <span className="text-gray-600">Fallback on timeout</span>
                      </label>
                      <button
                        onClick={() => simulateTimeout(ft.feature)}
                        disabled={isSimulatingTimeout}
                        className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50"
                      >
                        {isSimulatingTimeout ? '⏳' : '🧪'} Test
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Timeout Stats */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">📊 Timeout Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{timeoutStats.total_timeouts}</div>
              <div className="text-xs text-red-800">Total Timeouts</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{formatTimeoutDuration(timeoutStats.avg_timeout_duration_ms)}</div>
              <div className="text-xs text-amber-800">Avg Overage</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{timeoutStats.fallback_success_rate.toFixed(1)}%</div>
              <div className="text-xs text-green-800">Fallback Success</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg col-span-2">
              <div className="text-lg font-bold text-purple-600 flex items-center justify-center gap-2">
                {timeoutStats.most_timeout_prone_feature && (
                  <>
                    {getFeatureIcon(timeoutStats.most_timeout_prone_feature)}
                    <span>{featureTimeouts.find(f => f.feature === timeoutStats.most_timeout_prone_feature)?.name}</span>
                  </>
                )}
              </div>
              <div className="text-xs text-purple-800">Most Timeout-Prone</div>
            </div>
          </div>
        </div>

        {/* Timeouts by Feature Bar Chart */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">📈 Timeouts by Feature</h3>
          <div className="space-y-2">
            {featureTimeouts.map((ft) => {
              const count = timeoutStats.timeouts_by_feature[ft.feature];
              const maxCount = Math.max(...Object.values(timeoutStats.timeouts_by_feature));
              const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={ft.feature} className="flex items-center gap-3">
                  <span className="w-6 text-center">{getFeatureIcon(ft.feature)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{ft.name}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeout Event Logs */}
        <div>
          <h3 className="text-sm font-medium mb-3">📋 Timeout Event Logs</h3>
          {timeoutEvents.length === 0 ? (
            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
              <div className="text-2xl mb-2">⏱️</div>
              <div className="text-sm">No timeout events logged yet</div>
              <div className="text-xs text-gray-400 mt-1">Test a feature timeout to see logs</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {timeoutEvents.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-3 rounded border text-sm ${
                    event.triggered_fallback
                      ? event.fallback_success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {event.triggered_fallback
                        ? event.fallback_success
                          ? '✅'
                          : '❌'
                        : '⚠️'}
                    </span>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {getFeatureIcon(event.feature)}
                        {featureTimeouts.find(f => f.feature === event.feature)?.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Timeout: {formatTimeoutDuration(event.configured_timeout_ms)} •
                        Actual: {formatTimeoutDuration(event.actual_duration_ms)} •
                        {event.provider}
                        {event.triggered_fallback && ` → ${event.fallback_success ? 'Fallback OK' : 'Fallback Failed'}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature #1333: Model Selection per Feature */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              🤖 Model Selection per Feature
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {featureModelConfigs.filter(c => c.override_org_default).length} custom
              </span>
            </h2>
            <p className="text-sm text-gray-500">Configure which AI model to use for each feature (Opus 4.5 Thinking/Sonnet/Haiku)</p>
          </div>
          <button
            onClick={() => {
              setFeatureModelConfigs(prev => prev.map(c => ({
                ...c,
                model: orgDefaultModel,
                override_org_default: false,
                cost_per_1k_tokens: 0.003,
                avg_latency_ms: 450,
                quality_tier: 'standard' as const
              })));
            }}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
          >
            🔄 Reset All to Default
          </button>
          {/* Feature #1338: Bulk Model Assignment */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Bulk assign:</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  const model = e.target.value as AIModelType;
                  const modelInfo = getModelInfo(model);
                  setFeatureModelConfigs(prev => prev.map(c => ({
                    ...c,
                    model,
                    override_org_default: model !== orgDefaultModel,
                    cost_per_1k_tokens: modelInfo.cost,
                    avg_latency_ms: parseInt(modelInfo.latency) || c.avg_latency_ms,
                    quality_tier: modelInfo.tier.toLowerCase().includes('premium') ? 'premium' as const :
                                  modelInfo.tier.toLowerCase().includes('economy') ? 'economy' as const : 'standard' as const
                  })));
                  e.target.value = ''; // Reset dropdown after selection
                }
              }}
              className="border rounded px-2 py-1 text-sm bg-white"
              defaultValue=""
            >
              <option value="">Set all features to...</option>
              <option value="claude-opus-4.5-thinking">🧠 Opus 4.5 Thinking (All Premium)</option>
              <option value="claude-opus-4.5">🎯 Opus 4.5 (All Premium)</option>
              <option value="claude-sonnet-4">⚡ Sonnet 4 (All Standard)</option>
              <option value="claude-haiku-3.5">🚀 Haiku 3.5 (All Economy)</option>
            </select>
          </div>
        </div>

        {/* Organization Default Model */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏢</span>
              <div>
                <h3 className="font-medium">Organization Default Model</h3>
                <p className="text-sm text-gray-500">Used for features without custom configuration</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={orgDefaultModel}
                onChange={(e) => setOrgDefaultModel(e.target.value as AIModelType)}
                className="border rounded-lg px-3 py-2 font-medium bg-white"
              >
                <option value="claude-opus-4.5-thinking">🧠 Opus 4.5 Thinking ($$$)</option>
                <option value="claude-opus-4.5">🎯 Opus 4.5 ($$$)</option>
                <option value="claude-sonnet-4">⚡ Sonnet 4 ($$)</option>
                <option value="claude-haiku-3.5">🚀 Haiku 3.5 ($)</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
            <span className={`px-2 py-0.5 rounded border ${getQualityTierColor(getModelInfo(orgDefaultModel).tier.toLowerCase() as 'premium' | 'standard' | 'economy')}`}>
              {getModelInfo(orgDefaultModel).tier}
            </span>
            <span>{getModelInfo(orgDefaultModel).description}</span>
          </div>
        </div>

        {/* Per-Feature Model Configuration */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">📋 Per-Feature Model Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featureModelConfigs.map((config) => {
              const modelInfo = getModelInfo(config.model);
              const usageStats = modelUsageStats.find(s => s.feature === config.feature);
              return (
                <div
                  key={config.feature}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    config.override_org_default
                      ? 'border-purple-300 bg-purple-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getFeatureIcon(config.feature)}</span>
                      <div>
                        <div className="font-medium">{config.name}</div>
                        <div className="text-xs text-gray-500">{config.description}</div>
                      </div>
                    </div>
                    {config.override_org_default && (
                      <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">Custom</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <select
                      value={config.model}
                      onChange={(e) => updateFeatureModel(config.feature, e.target.value as AIModelType)}
                      className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="claude-opus-4.5-thinking">🧠 Opus 4.5 Thinking</option>
                      <option value="claude-opus-4.5">🎯 Opus 4.5</option>
                      <option value="claude-sonnet-4">⚡ Sonnet 4</option>
                      <option value="claude-haiku-3.5">🚀 Haiku 3.5</option>
                    </select>

                    <div className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded border ${getQualityTierColor(config.quality_tier)}`}>
                        {modelInfo.tier}
                      </span>
                      <span className="text-gray-500">~{config.avg_latency_ms}ms latency</span>
                      <span className="font-medium text-green-600">{modelInfo.costBadge}</span>
                    </div>

                    {usageStats && (
                      <div className="pt-2 border-t text-xs text-gray-500">
                        <div className="flex justify-between">
                          <span>{usageStats.request_count.toLocaleString()} requests</span>
                          <span>${(usageStats.total_cost_cents / 100).toFixed(2)} this month</span>
                        </div>
                      </div>
                    )}

                    {config.override_org_default && (
                      <button
                        onClick={() => resetFeatureToOrgDefault(config.feature)}
                        className="w-full text-xs text-purple-600 hover:text-purple-800 py-1"
                      >
                        ↩️ Reset to org default ({getModelInfo(orgDefaultModel).name})
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Model Usage Statistics */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">📊 Model Usage by Feature (This Month)</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {modelUsageStats.reduce((sum, s) => sum + s.request_count, 0).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">Total Requests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {(modelUsageStats.reduce((sum, s) => sum + s.total_tokens, 0) / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-gray-500">Total Tokens</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  ${(getTotalEstimatedMonthlyCost() / 100).toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">Total Cost</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {Math.round(modelUsageStats.reduce((sum, s) => sum + s.avg_latency_ms * s.request_count, 0) / modelUsageStats.reduce((sum, s) => sum + s.request_count, 0))}ms
                </div>
                <div className="text-xs text-gray-500">Avg Latency</div>
              </div>
            </div>

            <div className="space-y-2">
              {modelUsageStats
                .sort((a, b) => b.total_cost_cents - a.total_cost_cents)
                .map((stat) => {
                  const config = featureModelConfigs.find(c => c.feature === stat.feature);
                  const modelInfo = getModelInfo(stat.model);
                  const percentage = (stat.total_cost_cents / getTotalEstimatedMonthlyCost()) * 100;
                  return (
                    <div key={stat.feature} className="flex items-center gap-3">
                      <span className="w-6">{getFeatureIcon(stat.feature)}</span>
                      <span className="w-28 text-sm font-medium truncate">{config?.name}</span>
                      <span className="w-20 text-xs text-gray-500">{modelInfo.icon} {modelInfo.name.split(' ')[0]}</span>
                      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            stat.model.includes('opus') ? 'bg-purple-500' :
                            stat.model.includes('sonnet') ? 'bg-blue-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-sm font-medium">${(stat.total_cost_cents / 100).toFixed(2)}</span>
                      <span className="w-12 text-right text-xs text-gray-400">{percentage.toFixed(1)}%</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Cost Optimization Suggestions */}
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
          <h3 className="font-medium text-green-800 mb-2">💡 Cost Optimization Suggestions</h3>
          <div className="space-y-2 text-sm">
            {featureModelConfigs
              .filter(c => c.model.includes('opus') && c.feature !== 'analysis' && c.feature !== 'code_review')
              .map(c => (
                <div key={c.feature} className="flex items-center justify-between p-2 bg-white rounded border border-green-200">
                  <div className="flex items-center gap-2">
                    <span>{getFeatureIcon(c.feature)}</span>
                    <span className="font-medium">{c.name}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-600">Consider Sonnet 4 for ~80% cost savings</span>
                  </div>
                  <button
                    onClick={() => updateFeatureModel(c.feature, 'claude-sonnet-4')}
                    className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                  >
                    Apply
                  </button>
                </div>
              ))}
            {featureModelConfigs.filter(c => c.model.includes('opus') && c.feature !== 'analysis' && c.feature !== 'code_review').length === 0 && (
              <div className="text-gray-500 italic">✅ Your configuration is already cost-optimized!</div>
            )}
          </div>
        </div>
      </div>

      {/* Feature #1335: Provider-specific Rate Limiting */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              🚦 Provider Rate Limiting
              {rateLimitStatus.some(s => s.is_rate_limited) && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  {rateLimitStatus.filter(s => s.is_rate_limited).length} Limited
                </span>
              )}
              {getTotalQueuedRequests() > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {getTotalQueuedRequests()} queued
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500">Respect and manage rate limits for each AI provider with request queuing</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{getTotalRateLimitHits()} hits (24h)</span>
          </div>
        </div>

        {/* Rate Limit Alerts */}
        {rateLimitAlerts.filter(a => !a.acknowledged).length > 0 && (
          <div className="mb-4 space-y-2">
            {rateLimitAlerts.filter(a => !a.acknowledged).map(alert => {
              const colors = getAlertSeverityColor(alert.severity);
              return (
                <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                    <div>
                      <div className={`font-medium ${colors.text}`}>{alert.message}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()} · {alert.provider === 'kie' ? 'Kie.ai' : 'Anthropic'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => acknowledgeRateLimitAlert(alert.id)}
                    className="px-2 py-1 text-xs bg-white rounded border hover:bg-gray-50"
                  >
                    Dismiss
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Provider Rate Limit Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {rateLimitConfigs.map(config => {
            const status = rateLimitStatus.find(s => s.provider === config.provider);
            const color = getProviderRateLimitColor(config.provider);
            const minuteUsage = getRateLimitUsagePercent(config.provider, 'minute');
            const hourUsage = getRateLimitUsagePercent(config.provider, 'hour');
            const tokenUsage = getRateLimitUsagePercent(config.provider, 'tokens');

            return (
              <div
                key={config.provider}
                className={`p-4 rounded-lg border-2 ${
                  status?.is_rate_limited ? 'border-red-300 bg-red-50' :
                  color === 'amber' ? 'border-amber-300 bg-amber-50' :
                  color === 'yellow' ? 'border-yellow-300 bg-yellow-50' :
                  'border-green-300 bg-green-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{config.provider === 'kie' ? '🤖' : '🅰️'}</span>
                    <span className="font-semibold">{config.provider_name}</span>
                    {status?.is_rate_limited && (
                      <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">RATE LIMITED</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setEditingRateLimitProvider(config.provider);
                      setShowRateLimitConfigModal(true);
                    }}
                    className="text-xs px-2 py-1 bg-white rounded border hover:bg-gray-50"
                  >
                    ⚙️ Configure
                  </button>
                </div>

                {/* Usage Meters */}
                <div className="space-y-3 mb-4">
                  {/* Requests per Minute */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Requests/min</span>
                      <span className={`font-medium ${minuteUsage >= config.alert_threshold_percent ? 'text-red-600' : 'text-gray-700'}`}>
                        {status?.requests_remaining_minute || 0} / {config.requests_per_minute} remaining
                      </span>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          minuteUsage >= 90 ? 'bg-red-500' :
                          minuteUsage >= 75 ? 'bg-amber-500' :
                          minuteUsage >= 50 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(minuteUsage, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Resets in: {status ? formatTimeRemaining(status.reset_at_minute) : '—'}
                    </div>
                  </div>

                  {/* Requests per Hour */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Requests/hour</span>
                      <span className={`font-medium ${hourUsage >= config.alert_threshold_percent ? 'text-red-600' : 'text-gray-700'}`}>
                        {status?.requests_remaining_hour || 0} / {config.requests_per_hour} remaining
                      </span>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          hourUsage >= 90 ? 'bg-red-500' :
                          hourUsage >= 75 ? 'bg-amber-500' :
                          hourUsage >= 50 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(hourUsage, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Resets in: {status ? formatTimeRemaining(status.reset_at_hour) : '—'}
                    </div>
                  </div>

                  {/* Tokens per Minute */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Tokens/min</span>
                      <span className={`font-medium ${tokenUsage >= config.alert_threshold_percent ? 'text-red-600' : 'text-gray-700'}`}>
                        {((status?.tokens_remaining_minute || 0) / 1000).toFixed(1)}k / {(config.tokens_per_minute / 1000).toFixed(0)}k remaining
                      </span>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          tokenUsage >= 90 ? 'bg-red-500' :
                          tokenUsage >= 75 ? 'bg-amber-500' :
                          tokenUsage >= 50 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(tokenUsage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Strategy & Stats */}
                <div className="flex items-center justify-between text-xs border-t pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">On limit:</span>
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border">
                      {getStrategyIcon(config.strategy_on_limit)} {getStrategyLabel(config.strategy_on_limit)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span title="Rate limit hits in last hour">🛑 {status?.rate_limit_hits_1h || 0}/h</span>
                    <span title="Queued requests">📋 {status?.current_queue_size || 0}</span>
                  </div>
                </div>

                {/* Queue Preview */}
                {status && status.queued_requests.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs font-medium text-gray-600 mb-2">📋 Request Queue ({status.current_queue_size})</div>
                    <div className="space-y-1">
                      {status.queued_requests.slice(0, 3).map((req, idx) => (
                        <div key={req.id} className="flex items-center justify-between text-xs bg-white rounded p-2 border">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-white text-[10px] ${
                              req.priority === 'high' ? 'bg-red-500' :
                              req.priority === 'normal' ? 'bg-blue-500' :
                              'bg-gray-500'
                            }`}>
                              {idx + 1}
                            </span>
                            <span>{getFeatureIcon(req.feature)}</span>
                            <span className="text-gray-600">{req.tokens_estimate.toLocaleString()} tokens</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">~{Math.ceil(req.estimated_wait_ms / 1000)}s</span>
                            <button
                              onClick={() => clearQueuedRequest(config.provider, req.id)}
                              className="text-red-500 hover:text-red-700"
                              title="Remove from queue"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                      {status.queued_requests.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">+{status.queued_requests.length - 3} more...</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rate Limit Event Log */}
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">📜 Recent Rate Limit Events</h3>
          <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
            {rateLimitEvents.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-4">No rate limit events yet</div>
            ) : (
              <div className="space-y-2">
                {rateLimitEvents.slice(0, 10).map(event => (
                  <div key={event.id} className="flex items-start gap-3 text-sm">
                    <span className="text-lg">{getEventTypeIcon(event.event_type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{event.provider === 'kie' ? 'Kie.ai' : 'Anthropic'}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-gray-600 text-xs">{event.details}</div>
                      {event.queue_position && (
                        <div className="text-xs text-blue-600">Queue position: #{event.queue_position}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Auto-Distribute Info */}
        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚡</span>
            <span className="font-medium text-blue-800">Proactive Rate Limit Management</span>
          </div>
          <div className="text-sm text-blue-700 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Auto-distribute enabled: Requests are spread evenly across time windows</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Burst allowance: +{rateLimitConfigs[0].burst_allowance} requests allowed during traffic spikes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Failover ready: Anthropic configured to failover on rate limit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rate Limit Config Modal */}
      {showRateLimitConfigModal && editingRateLimitProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                ⚙️ Configure Rate Limits - {editingRateLimitProvider === 'kie' ? 'Kie.ai' : 'Anthropic'}
              </h3>
              <button onClick={() => setShowRateLimitConfigModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            {(() => {
              const config = rateLimitConfigs.find(c => c.provider === editingRateLimitProvider);
              if (!config) return null;

              return (
                <div className="space-y-4">
                  {/* Enable/Disable */}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => updateRateLimitConfig(editingRateLimitProvider, { enabled: e.target.checked })}
                      className="rounded"
                    />
                    <span>Enable rate limit management</span>
                  </label>

                  {/* Request Limits */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Requests/minute</label>
                      <input
                        type="number"
                        value={config.requests_per_minute}
                        onChange={(e) => updateRateLimitConfig(editingRateLimitProvider, { requests_per_minute: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Requests/hour</label>
                      <input
                        type="number"
                        value={config.requests_per_hour}
                        onChange={(e) => updateRateLimitConfig(editingRateLimitProvider, { requests_per_hour: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  </div>

                  {/* Token Limit */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Tokens/minute</label>
                    <input
                      type="number"
                      value={config.tokens_per_minute}
                      onChange={(e) => updateRateLimitConfig(editingRateLimitProvider, { tokens_per_minute: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>

                  {/* Strategy */}
                  <div>
                    <label className="block text-sm font-medium mb-1">On Rate Limit</label>
                    <select
                      value={config.strategy_on_limit}
                      onChange={(e) => updateRateLimitConfig(editingRateLimitProvider, { strategy_on_limit: e.target.value as RateLimitStrategy })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="queue">📋 Queue requests</option>
                      <option value="retry">🔄 Retry with backoff</option>
                      <option value="failover">↔️ Failover to alternate provider</option>
                      <option value="drop">🚫 Drop request (return error)</option>
                    </select>
                  </div>

                  {/* Queue Settings */}
                  {config.strategy_on_limit === 'queue' && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded">
                      <div>
                        <label className="block text-xs font-medium mb-1">Max Queue Size</label>
                        <input
                          type="number"
                          value={config.queue_max_size}
                          onChange={(e) => updateRateLimitConfig(editingRateLimitProvider, { queue_max_size: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Queue Timeout (ms)</label>
                        <input
                          type="number"
                          value={config.queue_timeout_ms}
                          onChange={(e) => updateRateLimitConfig(editingRateLimitProvider, { queue_timeout_ms: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Advanced Options */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.auto_distribute}
                        onChange={(e) => updateRateLimitConfig(editingRateLimitProvider, { auto_distribute: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Auto-distribute requests across time window</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <label className="text-sm">Burst allowance:</label>
                      <input
                        type="number"
                        value={config.burst_allowance}
                        onChange={(e) => updateRateLimitConfig(editingRateLimitProvider, { burst_allowance: parseInt(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 border rounded text-sm"
                      />
                      <span className="text-sm text-gray-500">extra requests</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm">Alert at:</label>
                      <input
                        type="number"
                        value={config.alert_threshold_percent}
                        onChange={(e) => updateRateLimitConfig(editingRateLimitProvider, { alert_threshold_percent: parseInt(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 border rounded text-sm"
                      />
                      <span className="text-sm text-gray-500">% usage</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      onClick={() => setShowRateLimitConfigModal(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setShowRateLimitConfigModal(false)}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Feature #1339: Fallback Rules Configuration UI */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              ↔️ Fallback Rules
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                getFallbackSuccessRate() >= 90 ? 'bg-green-100 text-green-700' :
                getFallbackSuccessRate() >= 70 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {getFallbackSuccessRate()}% success rate
              </span>
            </h2>
            <p className="text-sm text-gray-500">Configure when and how to fallback between providers</p>
          </div>
          <button
            onClick={createFallbackRule}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + Add Rule
          </button>
        </div>

        {/* Fallback Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{fallbackStats.total_fallbacks_24h}</div>
            <div className="text-xs text-blue-700">Total (24h)</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{fallbackStats.successful_fallbacks_24h}</div>
            <div className="text-xs text-green-700">Successful</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-600">{fallbackStats.failed_fallbacks_24h}</div>
            <div className="text-xs text-red-700">Failed</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-600">{fallbackStats.avg_fallback_latency_ms}ms</div>
            <div className="text-xs text-purple-700">Avg Latency</div>
          </div>
        </div>

        {/* Fallback by Trigger Type */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium mb-3">📊 Fallbacks by Trigger</h3>
          <div className="flex flex-wrap gap-3">
            {(['timeout', 'rate_limit', 'error', 'server_error', 'network_error'] as FallbackTrigger[]).map(trigger => (
              <div key={trigger} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border">
                <span>{getTriggerIcon(trigger)}</span>
                <span className="text-sm font-medium">{getTriggerLabel(trigger)}</span>
                <span className="px-2 py-0.5 text-xs bg-gray-100 rounded-full font-mono">
                  {fallbackStats.by_trigger[trigger]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fallback Rules List */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">📋 Configured Rules (Priority Order)</h3>
          <div className="space-y-3">
            {fallbackRules.sort((a, b) => a.priority - b.priority).map(rule => {
              const ruleStats = fallbackStats.by_rule[rule.id];
              return (
                <div
                  key={rule.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    rule.enabled
                      ? 'bg-white border-blue-200'
                      : 'bg-gray-50 border-gray-200 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        rule.enabled ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        #{rule.priority}
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {rule.name}
                          {!rule.enabled && <span className="text-xs text-gray-500">(disabled)</span>}
                        </div>
                        <div className="text-sm text-gray-500">
                          {getProviderLabel(rule.source_provider)} → {getProviderLabel(rule.target_provider)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => updateFallbackRule(rule.id, { enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                      <button
                        onClick={() => {
                          setEditingFallbackRule(rule);
                          setShowFallbackRuleModal(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Edit Rule"
                      >
                        ⚙️
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete rule "${rule.name}"?`)) {
                            deleteFallbackRule(rule.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete Rule"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Triggers */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {rule.triggers.map(trigger => (
                      <span key={trigger} className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded">
                        {getTriggerIcon(trigger)} {getTriggerLabel(trigger)}
                      </span>
                    ))}
                  </div>

                  {/* Rule Settings Summary */}
                  <div className="grid grid-cols-4 gap-3 text-xs text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">🔄</span>
                      <span>{rule.retry_before_fallback} retries before fallback</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">⏱️</span>
                      <span>{rule.timeout_threshold_ms / 1000}s timeout</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">🎯</span>
                      <span>Max {rule.max_fallback_attempts} attempts</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">⏲️</span>
                      <span>{rule.cooldown_after_fallback_ms / 1000}s cooldown</span>
                    </div>
                  </div>

                  {/* Rule Stats */}
                  {ruleStats && (
                    <div className="flex items-center gap-4 pt-3 border-t text-sm">
                      <span className="text-gray-500">
                        Triggered: <strong>{ruleStats.triggered}x</strong>
                      </span>
                      <span className={`${ruleStats.success_rate >= 80 ? 'text-green-600' : ruleStats.success_rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        Success rate: <strong>{ruleStats.success_rate}%</strong>
                      </span>
                      {rule.notify_on_fallback && (
                        <span className="text-blue-500">🔔 Notifications on</span>
                      )}
                      {rule.preserve_context && (
                        <span className="text-purple-500">📋 Preserves context</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Test Fallback Manually */}
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
          <h3 className="text-sm font-medium mb-3">🧪 Test Fallback Manually</h3>
          <p className="text-xs text-gray-600 mb-3">Simulate different failure scenarios to test your fallback rules</p>
          <div className="flex flex-wrap gap-2">
            {(['timeout', 'rate_limit', 'error', 'server_error', 'network_error'] as FallbackTrigger[]).map(trigger => (
              <button
                key={trigger}
                onClick={() => testFallbackManually(trigger)}
                disabled={isTestingFallback}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                  isTestingFallback && testingFallbackTrigger === trigger
                    ? 'bg-blue-500 text-white animate-pulse'
                    : 'bg-white border hover:border-blue-400 hover:bg-blue-50'
                } disabled:opacity-50`}
              >
                {isTestingFallback && testingFallbackTrigger === trigger ? '⏳' : getTriggerIcon(trigger)}
                Test {getTriggerLabel(trigger)}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Fallback Test Results */}
        <div>
          <h3 className="text-sm font-medium mb-3">📋 Recent Fallback Events</h3>
          {fallbackTestResults.length === 0 ? (
            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
              <div className="text-2xl mb-2">📭</div>
              <div className="text-sm">No fallback events recorded yet</div>
              <div className="text-xs text-gray-400 mt-1">Test a fallback scenario to see events</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {fallbackTestResults.map((result, idx) => {
                const rule = fallbackRules.find(r => r.id === result.rule_id);
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      result.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{result.success ? '✅' : '❌'}</span>
                      <div>
                        <div className="font-medium text-sm">
                          {getTriggerIcon(result.trigger)} {getTriggerLabel(result.trigger)} Fallback
                          {rule && <span className="text-gray-500 font-normal"> • {rule.name}</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.source_provider} → {result.target_provider}
                          {result.retries_attempted > 0 && ` • ${result.retries_attempted} retries`}
                          {result.error_message && ` • ${result.error_message}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{result.fallback_latency_ms}ms</div>
                      <div className="text-xs text-gray-400">{new Date(result.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fallback Rule Configuration Modal */}
      {showFallbackRuleModal && editingFallbackRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">⚙️ Configure Fallback Rule</h3>
              <button onClick={() => setShowFallbackRuleModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="space-y-4">
              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Rule Name</label>
                <input
                  type="text"
                  value={editingFallbackRule.name}
                  onChange={(e) => {
                    const updated = { ...editingFallbackRule, name: e.target.value };
                    setEditingFallbackRule(updated);
                    updateFallbackRule(editingFallbackRule.id, { name: e.target.value });
                  }}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              {/* Triggers */}
              <div>
                <label className="block text-sm font-medium mb-2">Fallback Triggers</label>
                <div className="flex flex-wrap gap-2">
                  {(['error', 'timeout', 'rate_limit', 'server_error', 'network_error'] as FallbackTrigger[]).map(trigger => (
                    <label
                      key={trigger}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                        editingFallbackRule.triggers.includes(trigger)
                          ? 'bg-blue-100 border-blue-400'
                          : 'bg-white border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editingFallbackRule.triggers.includes(trigger)}
                        onChange={(e) => {
                          const newTriggers = e.target.checked
                            ? [...editingFallbackRule.triggers, trigger]
                            : editingFallbackRule.triggers.filter(t => t !== trigger);
                          const updated = { ...editingFallbackRule, triggers: newTriggers };
                          setEditingFallbackRule(updated);
                          updateFallbackRule(editingFallbackRule.id, { triggers: newTriggers });
                        }}
                        className="sr-only"
                      />
                      <span>{getTriggerIcon(trigger)}</span>
                      <span className="text-sm">{getTriggerLabel(trigger)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Source and Target Provider */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Source Provider</label>
                  <select
                    value={editingFallbackRule.source_provider}
                    onChange={(e) => {
                      const updated = { ...editingFallbackRule, source_provider: e.target.value as any };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { source_provider: e.target.value as any });
                    }}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="any">Any Provider</option>
                    <option value="kie">Kie.ai</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fallback To</label>
                  <select
                    value={editingFallbackRule.target_provider}
                    onChange={(e) => {
                      const updated = { ...editingFallbackRule, target_provider: e.target.value as any };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { target_provider: e.target.value as any });
                    }}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="anthropic">Anthropic</option>
                    <option value="kie">Kie.ai</option>
                    <option value="none">None (Fail Request)</option>
                  </select>
                </div>
              </div>

              {/* Retry Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Retries Before Fallback</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={editingFallbackRule.retry_before_fallback}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const updated = { ...editingFallbackRule, retry_before_fallback: val };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { retry_before_fallback: val });
                    }}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <div className="text-xs text-gray-500 mt-1">Number of retries before triggering fallback</div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Retry Delay (ms)</label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={editingFallbackRule.retry_delay_ms}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1000;
                      const updated = { ...editingFallbackRule, retry_delay_ms: val };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { retry_delay_ms: val });
                    }}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <div className="text-xs text-gray-500 mt-1">Delay between retries</div>
                </div>
              </div>

              {/* Timeout & Fallback Attempts */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Timeout Threshold (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    max="120000"
                    step="1000"
                    value={editingFallbackRule.timeout_threshold_ms}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 30000;
                      const updated = { ...editingFallbackRule, timeout_threshold_ms: val };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { timeout_threshold_ms: val });
                    }}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <div className="text-xs text-gray-500 mt-1">Timeout for fallback requests</div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Fallback Attempts</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editingFallbackRule.max_fallback_attempts}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      const updated = { ...editingFallbackRule, max_fallback_attempts: val };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { max_fallback_attempts: val });
                    }}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <div className="text-xs text-gray-500 mt-1">Max attempts at fallback provider</div>
                </div>
              </div>

              {/* Cooldown */}
              <div>
                <label className="block text-sm font-medium mb-1">Cooldown After Fallback (ms)</label>
                <input
                  type="number"
                  min="0"
                  max="60000"
                  step="1000"
                  value={editingFallbackRule.cooldown_after_fallback_ms}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    const updated = { ...editingFallbackRule, cooldown_after_fallback_ms: val };
                    setEditingFallbackRule(updated);
                    updateFallbackRule(editingFallbackRule.id, { cooldown_after_fallback_ms: val });
                  }}
                  className="w-full px-3 py-2 border rounded"
                />
                <div className="text-xs text-gray-500 mt-1">Wait time after fallback before returning to primary</div>
              </div>

              {/* Options */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFallbackRule.preserve_context}
                    onChange={(e) => {
                      const updated = { ...editingFallbackRule, preserve_context: e.target.checked };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { preserve_context: e.target.checked });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">📋 Preserve conversation context on fallback</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFallbackRule.log_fallback}
                    onChange={(e) => {
                      const updated = { ...editingFallbackRule, log_fallback: e.target.checked };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { log_fallback: e.target.checked });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">📝 Log all fallback events</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFallbackRule.notify_on_fallback}
                    onChange={(e) => {
                      const updated = { ...editingFallbackRule, notify_on_fallback: e.target.checked };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { notify_on_fallback: e.target.checked });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">🔔 Send notification on fallback</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFallbackRule.enabled}
                    onChange={(e) => {
                      const updated = { ...editingFallbackRule, enabled: e.target.checked };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { enabled: e.target.checked });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Enable this rule</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFallbackRuleModal(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowFallbackRuleModal(false)}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature #1329: Monthly AI Budget Limits */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              💰 Monthly AI Budget
              {getBudgetStatus() === 'blocked' && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">BLOCKED</span>
              )}
              {getBudgetStatus() === 'critical' && (
                <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">Soft Limit</span>
              )}
            </h2>
            <p className="text-sm text-gray-500">Track and control AI spending with soft and hard limits</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBudgetResetModal(true)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              🔄 Reset Budget
            </button>
          </div>
        </div>

        {/* Budget Overview */}
        <div className={`mb-6 p-4 rounded-lg border-2 ${
          getBudgetStatus() === 'blocked' ? 'bg-red-50 border-red-300' :
          getBudgetStatus() === 'critical' ? 'bg-amber-50 border-amber-300' :
          getBudgetStatus() === 'warning' ? 'bg-yellow-50 border-yellow-300' :
          'bg-green-50 border-green-300'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-3xl font-bold">
                {formatCurrency(spendingData.current_month_spend_cents)}
                <span className="text-lg font-normal text-gray-500"> / {formatCurrency(budgetConfig.monthly_budget_cents)}</span>
              </div>
              <div className="text-sm text-gray-600">
                {getBudgetPercentage().toFixed(1)}% of monthly budget used
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Resets in</div>
              <div className="text-2xl font-bold">{getDaysUntilReset()} days</div>
              <div className="text-xs text-gray-400">on day {budgetConfig.billing_cycle_day}</div>
            </div>
          </div>

          {/* Progress bar with limits */}
          <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                getBudgetStatus() === 'blocked' ? 'bg-red-500' :
                getBudgetStatus() === 'critical' ? 'bg-amber-500' :
                getBudgetStatus() === 'warning' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(getBudgetPercentage(), 100)}%` }}
            />
            {/* Soft limit marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-600"
              style={{ left: `${budgetConfig.soft_limit_percentage}%` }}
              title={`Soft limit: ${budgetConfig.soft_limit_percentage}%`}
            />
            {/* Hard limit marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-600"
              style={{ left: `${Math.min(budgetConfig.hard_limit_percentage, 100)}%` }}
              title={`Hard limit: ${budgetConfig.hard_limit_percentage}%`}
            />
            {/* Labels */}
            <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-medium">
              <span className={getBudgetPercentage() > 50 ? 'text-white' : 'text-gray-700'}>
                {formatCurrency(spendingData.current_month_spend_cents)}
              </span>
              <span className="text-gray-600">
                {formatCurrency(budgetConfig.monthly_budget_cents)}
              </span>
            </div>
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>0%</span>
            <span className="text-amber-600">{budgetConfig.soft_limit_percentage}% soft</span>
            <span className="text-red-600">{budgetConfig.hard_limit_percentage}% hard</span>
          </div>

          {/* Projected spend warning */}
          {getProjectedSpend() > budgetConfig.monthly_budget_cents && (
            <div className="mt-3 p-2 bg-amber-100 border border-amber-300 rounded text-sm text-amber-800">
              ⚠️ At current rate, projected month-end spend: <strong>{formatCurrency(getProjectedSpend())}</strong>
              (over budget by {formatCurrency(getProjectedSpend() - budgetConfig.monthly_budget_cents)})
            </div>
          )}
        </div>

        {/* Budget Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Left: Budget Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">⚙️ Budget Configuration</h3>

            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Budget</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  step="100"
                  value={budgetConfig.monthly_budget_cents / 100}
                  onChange={(e) => setBudgetConfig({ ...budgetConfig, monthly_budget_cents: parseFloat(e.target.value) * 100 || 50000 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-amber-800">Soft Limit: {budgetConfig.soft_limit_percentage}%</label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={budgetConfig.alert_on_soft_limit}
                    onChange={(e) => setBudgetConfig({ ...budgetConfig, alert_on_soft_limit: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span>Alert</span>
                </label>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={budgetConfig.soft_limit_percentage}
                onChange={(e) => setBudgetConfig({ ...budgetConfig, soft_limit_percentage: parseInt(e.target.value) })}
                className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-amber-600 mt-1">Warn at {formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.soft_limit_percentage / 100)}</div>
            </div>

            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-red-800">Hard Limit: {budgetConfig.hard_limit_percentage}%</label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={budgetConfig.block_on_hard_limit}
                    onChange={(e) => setBudgetConfig({ ...budgetConfig, block_on_hard_limit: e.target.checked })}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span>Block</span>
                </label>
              </div>
              <input
                type="range"
                min={budgetConfig.soft_limit_percentage + 5}
                max="150"
                value={budgetConfig.hard_limit_percentage}
                onChange={(e) => setBudgetConfig({ ...budgetConfig, hard_limit_percentage: parseInt(e.target.value) })}
                className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-red-600 mt-1">Block at {formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.hard_limit_percentage / 100)}</div>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <label className="block text-sm font-medium text-blue-800 mb-2">Billing Cycle Day</label>
              <select
                value={budgetConfig.billing_cycle_day}
                onChange={(e) => setBudgetConfig({ ...budgetConfig, billing_cycle_day: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Day {i + 1}</option>
                ))}
              </select>
              <div className="text-xs text-blue-600 mt-1">Budget resets on this day each month</div>
            </div>
          </div>

          {/* Right: Spending Stats */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">📊 Spending Breakdown</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">{spendingData.requests_this_month.toLocaleString()}</div>
                <div className="text-xs text-blue-800">Requests</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">{formatCurrency(spendingData.avg_cost_per_request_cents)}</div>
                <div className="text-xs text-green-800">Avg Cost/Req</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-xl font-bold text-purple-600">{formatCurrency(spendingData.last_month_spend_cents)}</div>
                <div className="text-xs text-purple-800">Last Month</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-xl font-bold text-amber-600">{formatCurrency(getProjectedSpend())}</div>
                <div className="text-xs text-amber-800">Projected</div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">By Provider</h4>
              {Object.entries(spendingData.by_provider).map(([provider, cents]) => (
                <div key={provider} className="flex items-center gap-2 mb-2">
                  <span className="w-16 text-sm font-medium capitalize">{provider}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${provider === 'kie' ? 'bg-gradient-to-r from-teal-400 to-teal-500' : 'bg-gradient-to-r from-blue-400 to-blue-500'}`}
                      style={{ width: `${(cents / spendingData.current_month_spend_cents) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-16 text-right">{formatCurrency(cents)}</span>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">By Feature</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {Object.entries(spendingData.by_feature)
                  .sort(([, a], [, b]) => b - a)
                  .map(([feature, cents]) => (
                    <div key={feature} className="flex items-center gap-2 text-sm">
                      <span className="w-6">{getFeatureIcon(feature as AIFeatureType)}</span>
                      <span className="flex-1 truncate capitalize">{feature.replace('_', ' ')}</span>
                      <span className="text-gray-600">{formatCurrency(cents)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Feature #1340: Budget History Chart */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">📈 Daily Spending History</h3>
            <div className="flex items-center gap-2">
              <select
                value="16"
                className="text-xs border rounded px-2 py-1"
                onChange={() => {}}
              >
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="16">This month</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            {/* Mini chart showing daily spending */}
            <div className="flex items-end gap-1 h-32 mb-2">
              {spendingData.daily_spend.map((day, idx) => {
                const maxSpend = Math.max(...spendingData.daily_spend.map(d => d.amount_cents), 1);
                const height = (day.amount_cents / maxSpend) * 100;
                const dailyBudgetLimit = budgetConfig.monthly_budget_cents / 30;
                const isOverDailyBudget = day.amount_cents > dailyBudgetLimit;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center group relative"
                    title={`${new Date(day.date).toLocaleDateString()}: ${formatCurrency(day.amount_cents)}`}
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        isOverDailyBudget ? 'bg-red-400 hover:bg-red-500' : 'bg-blue-400 hover:bg-blue-500'
                      }`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                      {formatCurrency(day.amount_cents)}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* X-axis labels */}
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{spendingData.daily_spend[0]?.date ? new Date(spendingData.daily_spend[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
              <span>Daily avg: {formatCurrency(spendingData.daily_spend.length > 0 ? spendingData.daily_spend.reduce((a, b) => a + b.amount_cents, 0) / spendingData.daily_spend.length : 0)}</span>
              <span>{spendingData.daily_spend.length > 0 ? new Date(spendingData.daily_spend[spendingData.daily_spend.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-400 rounded" />
                <span>Within daily budget</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-400 rounded" />
                <span>Over daily budget</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-0.5 h-3 bg-amber-500" />
                <span>Avg: ~{formatCurrency(budgetConfig.monthly_budget_cents / 30)}/day</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature #1340: Export Budget Reports */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-blue-800">📄 Export Budget Reports</h3>
              <p className="text-xs text-blue-600">Download spending data for analysis or compliance</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const csvHeader = 'Date,Amount (USD),Provider,Feature\n';
                const csvData = spendingData.daily_spend.map(d =>
                  `${d.date},${(d.amount_cents / 100).toFixed(2)},Mixed,All Features`
                ).join('\n');
                const blob = new Blob([csvHeader + csvData], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `budget-report-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                alert('✅ Budget report downloaded as CSV');
              }}
              className="px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50 flex items-center gap-2"
            >
              <span>📊</span> Export CSV
            </button>
            <button
              onClick={() => {
                const reportData = {
                  generated_at: new Date().toISOString(),
                  period: {
                    start: spendingData.daily_spend[0]?.date || '',
                    end: spendingData.daily_spend[spendingData.daily_spend.length - 1]?.date || ''
                  },
                  budget: {
                    monthly_limit_cents: budgetConfig.monthly_budget_cents,
                    soft_limit_percent: budgetConfig.soft_limit_percentage,
                    hard_limit_percent: budgetConfig.hard_limit_percentage,
                    billing_cycle_day: budgetConfig.billing_cycle_day
                  },
                  spending: {
                    current_month_cents: spendingData.current_month_spend_cents,
                    last_month_cents: spendingData.last_month_spend_cents,
                    requests_this_month: spendingData.requests_this_month,
                    avg_cost_per_request_cents: spendingData.avg_cost_per_request_cents,
                    by_provider: spendingData.by_provider,
                    by_feature: spendingData.by_feature,
                    daily_breakdown: spendingData.daily_spend
                  },
                  status: getBudgetStatus(),
                  projected_month_end_cents: getProjectedSpend()
                };
                const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `budget-report-detailed-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                alert('✅ Detailed budget report downloaded as JSON');
              }}
              className="px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50 flex items-center gap-2"
            >
              <span>📋</span> Export JSON
            </button>
            <button
              onClick={() => {
                const summaryText = `
AI Budget Summary Report
========================
Generated: ${new Date().toLocaleString()}

BUDGET CONFIGURATION
-------------------
Monthly Budget: ${formatCurrency(budgetConfig.monthly_budget_cents)}
Soft Limit: ${budgetConfig.soft_limit_percentage}% (${formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.soft_limit_percentage / 100)})
Hard Limit: ${budgetConfig.hard_limit_percentage}% (${formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.hard_limit_percentage / 100)})
Billing Cycle: Day ${budgetConfig.billing_cycle_day} of each month

CURRENT STATUS
--------------
Status: ${getBudgetStatus().toUpperCase()}
Current Spend: ${formatCurrency(spendingData.current_month_spend_cents)}
Budget Used: ${getBudgetPercentage().toFixed(1)}%
Projected End-of-Month: ${formatCurrency(getProjectedSpend())}
Days Until Reset: ${getDaysUntilReset()}

SPENDING BREAKDOWN
------------------
Total Requests: ${spendingData.requests_this_month.toLocaleString()}
Avg Cost/Request: ${formatCurrency(spendingData.avg_cost_per_request_cents)}
Last Month Total: ${formatCurrency(spendingData.last_month_spend_cents)}

BY PROVIDER:
${Object.entries(spendingData.by_provider).map(([p, c]) => `  ${p}: ${formatCurrency(c)}`).join('\n')}

BY FEATURE:
${Object.entries(spendingData.by_feature).map(([f, c]) => `  ${f.replace('_', ' ')}: ${formatCurrency(c)}`).join('\n')}
                `.trim();
                const blob = new Blob([summaryText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `budget-summary-${new Date().toISOString().split('T')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);
                alert('✅ Budget summary downloaded as TXT');
              }}
              className="px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50 flex items-center gap-2"
            >
              <span>📝</span> Export Summary
            </button>
            <button
              onClick={() => {
                const printContent = `
                  <html>
                  <head>
                    <title>AI Budget Report</title>
                    <style>
                      body { font-family: system-ui, sans-serif; padding: 20px; max-width: 800px; margin: auto; }
                      h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
                      h2 { color: #374151; margin-top: 24px; }
                      .stat { background: #f3f4f6; padding: 12px; border-radius: 8px; margin: 8px 0; }
                      .stat-value { font-size: 24px; font-weight: bold; color: #1e40af; }
                      .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; }
                      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                      th, td { padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
                      th { background: #f3f4f6; }
                      @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
                    </style>
                  </head>
                  <body>
                    <h1>💰 AI Budget Report</h1>
                    <p>Generated: ${new Date().toLocaleString()}</p>

                    <h2>Budget Overview</h2>
                    <div class="grid">
                      <div class="stat">
                        <div>Current Spend</div>
                        <div class="stat-value">${formatCurrency(spendingData.current_month_spend_cents)}</div>
                      </div>
                      <div class="stat">
                        <div>Monthly Budget</div>
                        <div class="stat-value">${formatCurrency(budgetConfig.monthly_budget_cents)}</div>
                      </div>
                    </div>

                    <h2>Spending by Provider</h2>
                    <table>
                      <tr><th>Provider</th><th>Amount</th><th>%</th></tr>
                      ${Object.entries(spendingData.by_provider).map(([p, c]) =>
                        `<tr><td>${p}</td><td>${formatCurrency(c)}</td><td>${((c / spendingData.current_month_spend_cents) * 100).toFixed(1)}%</td></tr>`
                      ).join('')}
                    </table>

                    <h2>Spending by Feature</h2>
                    <table>
                      <tr><th>Feature</th><th>Amount</th><th>%</th></tr>
                      ${Object.entries(spendingData.by_feature).map(([f, c]) =>
                        `<tr><td>${f.replace('_', ' ')}</td><td>${formatCurrency(c)}</td><td>${((c / spendingData.current_month_spend_cents) * 100).toFixed(1)}%</td></tr>`
                      ).join('')}
                    </table>
                  </body>
                  </html>
                `;
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(printContent);
                  printWindow.document.close();
                  printWindow.print();
                }
              }}
              className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <span>🖨️</span> Print Report
            </button>
          </div>
        </div>

        {/* Simulate Spending */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium mb-3">🧪 Simulate Spending</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => simulateSpending(1000)}
              disabled={getBudgetStatus() === 'blocked'}
              className="px-3 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +$10.00
            </button>
            <button
              onClick={() => simulateSpending(5000)}
              disabled={getBudgetStatus() === 'blocked'}
              className="px-3 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +$50.00
            </button>
            <button
              onClick={() => simulateSpending(10000)}
              disabled={getBudgetStatus() === 'blocked'}
              className="px-3 py-2 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +$100.00
            </button>
            <button
              onClick={() => simulateSpending(budgetConfig.monthly_budget_cents - spendingData.current_month_spend_cents + 100)}
              disabled={getBudgetStatus() === 'blocked'}
              className="px-3 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Exceed Budget
            </button>
          </div>
          {getBudgetStatus() === 'blocked' && (
            <div className="mt-2 text-sm text-red-600">
              🚫 Spending blocked - hard limit reached. Reset budget to continue.
            </div>
          )}
        </div>

        {/* Budget Alerts */}
        <div>
          <h3 className="text-sm font-medium mb-3">🔔 Budget Alerts</h3>
          {budgetAlerts.length === 0 ? (
            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
              <div className="text-2xl mb-2">🔕</div>
              <div className="text-sm">No budget alerts</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {budgetAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-3 rounded border ${
                    alert.type === 'hard_limit' ? 'bg-red-50 border-red-200' :
                    alert.type === 'soft_limit' ? 'bg-amber-50 border-amber-200' :
                    alert.type === 'reset' ? 'bg-green-50 border-green-200' :
                    'bg-blue-50 border-blue-200'
                  } ${alert.acknowledged ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {alert.type === 'hard_limit' ? '🚫' :
                       alert.type === 'soft_limit' ? '⚠️' :
                       alert.type === 'reset' ? '✅' : '📊'}
                    </span>
                    <div>
                      <div className="font-medium text-sm">{alert.message}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Budget Reset Modal */}
      {showBudgetResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">🔄 Reset Monthly Budget</h3>
            <p className="text-gray-600 mb-4">
              This will reset your current month's spending to $0.00 and clear all spending history.
              This action is typically triggered automatically on billing cycle day {budgetConfig.billing_cycle_day}.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-sm text-amber-800">
              ⚠️ Current spend of <strong>{formatCurrency(spendingData.current_month_spend_cents)}</strong> will be cleared.
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBudgetResetModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={resetBudget}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Reset Budget
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature #1330: AI Cost Alert Notifications */}
      <div className="bg-white rounded-lg shadow p-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">🔔 Cost Alert Notifications</h2>
          <button
            onClick={() => setShowTestNotificationModal(true)}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            📧 Send Test Alert
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alert Thresholds Configuration */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-800 border-b pb-2">📊 Alert Thresholds (50%, 80%, 100%)</h3>
            {alertNotificationConfig.thresholds.map((threshold, index) => (
              <div key={threshold.percentage} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${threshold.percentage === 100 ? '🚨' : threshold.percentage >= 80 ? '⚠️' : '📍'}`}>
                      {threshold.percentage === 100 ? '🚨' : threshold.percentage >= 80 ? '⚠️' : '📍'}
                    </span>
                    <span className="font-semibold">{threshold.percentage}% Threshold</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={threshold.enabled}
                      onChange={(e) => updateAlertThreshold(index, { enabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-600">Enabled</span>
                  </label>
                </div>
                {threshold.enabled && (
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={threshold.email_enabled}
                        onChange={(e) => updateAlertThreshold(index, { email_enabled: e.target.checked })}
                        className="w-3.5 h-3.5 text-blue-600 rounded"
                      />
                      <span>📧 Email</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={threshold.slack_enabled}
                        onChange={(e) => updateAlertThreshold(index, { slack_enabled: e.target.checked })}
                        className="w-3.5 h-3.5 text-purple-600 rounded"
                      />
                      <span>💬 Slack</span>
                    </label>
                    {threshold.last_triggered && (
                      <span className="text-xs text-gray-500 ml-auto">
                        Last: {formatNotificationTime(threshold.last_triggered)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Notification Channels */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-800 border-b pb-2">📬 Notification Channels</h3>

            {/* Email Configuration */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">📧 Email Notifications</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertNotificationConfig.email_enabled}
                    onChange={(e) => setAlertNotificationConfig(prev => ({ ...prev, email_enabled: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">{alertNotificationConfig.email_enabled ? 'On' : 'Off'}</span>
                </label>
              </div>
              {alertNotificationConfig.email_enabled && (
                <div className="mt-2">
                  <label className="text-xs text-gray-500 block mb-1">Recipients:</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {alertNotificationConfig.email_recipients.map((email) => (
                      <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {email}
                        <button
                          onClick={() => removeEmailRecipient(email)}
                          className="hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="email"
                      placeholder="Add email recipient..."
                      className="flex-1 px-2 py-1 text-xs border rounded"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addEmailRecipient((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                        if (input) {
                          addEmailRecipient(input.value);
                          input.value = '';
                        }
                      }}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Slack Configuration */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">💬 Slack Notifications</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertNotificationConfig.slack_enabled}
                    onChange={(e) => setAlertNotificationConfig(prev => ({ ...prev, slack_enabled: e.target.checked }))}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm">{alertNotificationConfig.slack_enabled ? 'On' : 'Off'}</span>
                </label>
              </div>
              {alertNotificationConfig.slack_enabled && (
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Channel:</label>
                    <input
                      type="text"
                      value={alertNotificationConfig.slack_channel}
                      onChange={(e) => setAlertNotificationConfig(prev => ({ ...prev, slack_channel: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border rounded"
                      placeholder="#channel-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Webhook URL:</label>
                    <input
                      type="password"
                      value={alertNotificationConfig.slack_webhook_url}
                      onChange={(e) => setAlertNotificationConfig(prev => ({ ...prev, slack_webhook_url: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border rounded font-mono"
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Alert Content Options */}
            <div className="border rounded-lg p-3">
              <span className="font-medium block mb-2">📝 Alert Content</span>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertNotificationConfig.include_breakdown}
                    onChange={(e) => setAlertNotificationConfig(prev => ({ ...prev, include_breakdown: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">📊 Include Cost Breakdown (by provider & feature)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertNotificationConfig.include_suggestions}
                    onChange={(e) => setAlertNotificationConfig(prev => ({ ...prev, include_suggestions: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">💡 Include Cost Reduction Suggestions</span>
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-xs text-gray-500">Cooldown:</label>
                  <select
                    value={alertNotificationConfig.cooldown_minutes}
                    onChange={(e) => setAlertNotificationConfig(prev => ({ ...prev, cooldown_minutes: parseInt(e.target.value) }))}
                    className="px-2 py-1 text-xs border rounded"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={240}>4 hours</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Reduction Suggestions */}
        <div className="mt-6">
          <h3 className="font-medium text-gray-800 border-b pb-2 mb-3">💡 Cost Reduction Suggestions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {costReductionSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`border rounded-lg p-3 ${getPriorityColor(suggestion.priority)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getSuggestionIcon(suggestion.category)}</span>
                    <span className="font-medium text-sm">{suggestion.title}</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                    suggestion.priority === 'high' ? 'bg-red-200 text-red-800' :
                    suggestion.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-green-200 text-green-800'
                  }`}>
                    {suggestion.priority.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-2">{suggestion.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-700">
                    ~{suggestion.estimated_savings_percent}% savings
                  </span>
                  {suggestion.action_url && (
                    <button
                      onClick={() => alert(`Navigate to: ${suggestion.action_url}`)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Configure →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notification History */}
        <div className="mt-6">
          <h3 className="font-medium text-gray-800 border-b pb-2 mb-3">📜 Notification History</h3>
          {sentNotifications.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <div className="text-3xl mb-2">📭</div>
              <div>No notifications sent yet</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sentNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-center justify-between p-3 rounded border ${
                    notif.status === 'sent' ? 'bg-green-50 border-green-200' :
                    notif.status === 'failed' ? 'bg-red-50 border-red-200' :
                    'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {notif.status === 'sent' ? '✅' : notif.status === 'failed' ? '❌' : '⏳'}
                    </span>
                    <div>
                      <div className="font-medium text-sm">
                        {notif.threshold_percentage}% Threshold Alert
                      </div>
                      <div className="text-xs text-gray-500">
                        {notif.current_percentage.toFixed(1)}% used • ${formatCurrency(notif.spend_amount_cents)} / ${formatCurrency(notif.budget_amount_cents)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {notif.channels_sent.map(c => c === 'email' ? '📧' : '💬').join(' ')} → {notif.recipients.slice(0, 2).join(', ')}{notif.recipients.length > 2 ? ` +${notif.recipients.length - 2}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{formatNotificationTime(notif.timestamp)}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {notif.breakdown_included && <span className="text-xs" title="Breakdown included">📊</span>}
                      {notif.suggestions_included && <span className="text-xs" title="Suggestions included">💡</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Test Notification Modal */}
      {showTestNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">📧 Send Test Alert</h3>
            <p className="text-gray-600 mb-4">
              Send a test notification to verify your alert configuration is working correctly.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Simulate Threshold:
              </label>
              <div className="flex gap-2">
                {[50, 80, 100].map((threshold) => (
                  <button
                    key={threshold}
                    onClick={() => setTestNotificationThreshold(threshold)}
                    className={`flex-1 py-2 px-3 rounded border text-sm font-medium ${
                      testNotificationThreshold === threshold
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {threshold}%
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded p-3 mb-4 text-sm">
              <div className="font-medium mb-1">Preview:</div>
              <div className="text-gray-600">
                <div>• Channels: {[
                  alertNotificationConfig.email_enabled && 'Email',
                  alertNotificationConfig.slack_enabled && 'Slack'
                ].filter(Boolean).join(', ') || 'None'}</div>
                <div>• Recipients: {alertNotificationConfig.email_recipients.length} email(s)</div>
                <div>• Include breakdown: {alertNotificationConfig.include_breakdown ? 'Yes' : 'No'}</div>
                <div>• Include suggestions: {alertNotificationConfig.include_suggestions ? 'Yes' : 'No'}</div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowTestNotificationModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => sendTestNotification(testNotificationThreshold)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Send Test Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature #1332: AI Response Caching */}
      <div className="bg-white rounded-lg shadow p-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">💾 AI Response Caching</h2>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              cacheConfig.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {cacheConfig.enabled ? '✓ Enabled' : '○ Disabled'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCacheClearModal(true)}
              className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              🗑️ Clear Cache
            </button>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cacheConfig.enabled}
                onChange={(e) => setCacheConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm">Caching</span>
            </label>
          </div>
        </div>

        {/* Cache Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{cacheStats.hit_rate_percent.toFixed(1)}%</div>
            <div className="text-xs text-blue-600">Hit Rate</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{cacheStats.total_hits.toLocaleString()}</div>
            <div className="text-xs text-green-600">Total Hits</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">${(cacheStats.estimated_cost_savings_cents / 100).toFixed(2)}</div>
            <div className="text-xs text-purple-600">Cost Saved</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-700">{(cacheStats.estimated_latency_savings_ms / 1000).toFixed(1)}s</div>
            <div className="text-xs text-orange-600">Latency Saved</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cache Configuration */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-800 border-b pb-2">⚙️ Cache Configuration</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Default TTL</div>
                  <div className="text-xs text-gray-500">Time-to-live for cached responses</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={cacheConfig.default_ttl_seconds}
                    onChange={(e) => setCacheConfig(prev => ({ ...prev, default_ttl_seconds: parseInt(e.target.value) }))}
                    className="px-2 py-1 text-sm border rounded"
                  >
                    <option value={900}>15 minutes</option>
                    <option value={1800}>30 minutes</option>
                    <option value={3600}>1 hour</option>
                    <option value={7200}>2 hours</option>
                    <option value={86400}>24 hours</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Max Cache Size</div>
                  <div className="text-xs text-gray-500">{cacheStats.cache_size_mb.toFixed(1)} MB / {cacheStats.max_size_mb} MB used</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={cacheConfig.max_cache_size_mb}
                    onChange={(e) => setCacheConfig(prev => ({ ...prev, max_cache_size_mb: parseInt(e.target.value) }))}
                    className="px-2 py-1 text-sm border rounded"
                  >
                    <option value={128}>128 MB</option>
                    <option value={256}>256 MB</option>
                    <option value={512}>512 MB</option>
                    <option value={1024}>1 GB</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Hash Algorithm</div>
                  <div className="text-xs text-gray-500">Algorithm for cache key generation</div>
                </div>
                <select
                  value={cacheConfig.hash_algorithm}
                  onChange={(e) => setCacheConfig(prev => ({ ...prev, hash_algorithm: e.target.value as 'sha256' | 'md5' | 'xxhash' }))}
                  className="px-2 py-1 text-sm border rounded"
                >
                  <option value="sha256">SHA-256 (Secure)</option>
                  <option value="md5">MD5 (Fast)</option>
                  <option value="xxhash">xxHash (Fastest)</option>
                </select>
              </div>
            </div>

            {/* Invalidation Settings */}
            <div className="border-t pt-3 mt-3">
              <div className="font-medium text-sm mb-2">🔄 Auto-Invalidation</div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cacheConfig.invalidate_on_model_change}
                    onChange={(e) => setCacheConfig(prev => ({ ...prev, invalidate_on_model_change: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">Invalidate on model change</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cacheConfig.invalidate_on_prompt_change}
                    onChange={(e) => setCacheConfig(prev => ({ ...prev, invalidate_on_prompt_change: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">Invalidate on system prompt change</span>
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => invalidateCache('Manual invalidation by user')}
                  className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                >
                  🔄 Invalidate All
                </button>
              </div>
            </div>

            {/* Cache Key Preview */}
            <div className="border-t pt-3 mt-3">
              <div className="font-medium text-sm mb-2">🔑 Cache Key Generator</div>
              <input
                type="text"
                placeholder="Enter a sample prompt to preview cache key..."
                className="w-full px-3 py-2 text-sm border rounded mb-2"
                onChange={(e) => previewCacheKey(e.target.value)}
              />
              {cacheKeyPreview && (
                <div className="bg-gray-100 rounded p-2 font-mono text-xs break-all">
                  {cacheKeyPreview}
                </div>
              )}
            </div>
          </div>

          {/* Per-Feature Cache Settings */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-800 border-b pb-2">📋 Per-Feature TTL Settings</h3>

            <div className="space-y-2">
              {(Object.entries(cacheConfig.cache_by_feature) as [AIFeatureType, { enabled: boolean; ttl_seconds: number }][]).map(([feature, config]) => (
                <div key={feature} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => updateFeatureCacheConfig(feature, { enabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">{getFeatureIcon(feature)}</span>
                    <span className="text-sm font-medium capitalize">{feature.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={config.ttl_seconds}
                      onChange={(e) => updateFeatureCacheConfig(feature, { ttl_seconds: parseInt(e.target.value) })}
                      disabled={!config.enabled}
                      className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                    >
                      <option value={900}>15m</option>
                      <option value={1800}>30m</option>
                      <option value={3600}>1h</option>
                      <option value={7200}>2h</option>
                      <option value={86400}>24h</option>
                    </select>
                    <span className="text-xs text-gray-500 w-16 text-right">
                      {cacheStats.by_feature[feature]?.hits.toLocaleString() || 0} hits
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Hit/Miss by Feature */}
            <div className="border-t pt-3 mt-3">
              <div className="font-medium text-sm mb-2">📊 Hit Rate by Feature</div>
              <div className="space-y-2">
                {(Object.entries(cacheStats.by_feature) as [AIFeatureType, { hits: number; misses: number; entries: number }][]).map(([feature, stats]) => {
                  const hitRate = stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0;
                  return (
                    <div key={feature} className="flex items-center gap-2">
                      <span className="text-sm w-24 capitalize">{feature.replace('_', ' ')}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${hitRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-12 text-right">{hitRate.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Simulate Cache Actions */}
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium text-gray-800 mb-3">🧪 Simulate Cache Scenarios</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={simulateCacheHit}
              className="px-3 py-1.5 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200"
            >
              ✅ Simulate Hit
            </button>
            <button
              onClick={simulateCacheMiss}
              className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              ❌ Simulate Miss
            </button>
            <button
              onClick={() => invalidateCache('Model configuration changed')}
              className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
            >
              🔄 Simulate Config Change
            </button>
          </div>
        </div>

        {/* Cache Event Log */}
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium text-gray-800 mb-3">📜 Cache Event Log</h3>
          {cacheEvents.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <div className="text-2xl mb-1">📭</div>
              <div className="text-sm">No cache events yet</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cacheEvents.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-2 rounded border ${getCacheEventColor(event.type)}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCacheEventIcon(event.type)}</span>
                    <div>
                      <div className="text-sm font-medium uppercase">{event.type}</div>
                      <div className="text-xs">
                        {event.feature_type} • {event.cache_key.substring(0, 20)}...
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs">
                      {event.latency_saved_ms && <span className="text-green-700">-{event.latency_saved_ms}ms</span>}
                      {event.cost_saved_cents && <span className="ml-2 text-purple-700">-${(event.cost_saved_cents / 100).toFixed(2)}</span>}
                    </div>
                    <div className="text-xs text-gray-500">{formatNotificationTime(event.timestamp)}</div>
                    {event.reason && <div className="text-xs text-gray-500 italic">{event.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Cache Entries */}
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium text-gray-800 mb-3">📦 Recent Cache Entries ({cacheStats.active_entries.toLocaleString()} active)</h3>
          {cacheEntries.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <div className="text-2xl mb-1">📭</div>
              <div className="text-sm">No cache entries</div>
            </div>
          ) : (
            <div className="space-y-2">
              {cacheEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-3 rounded border ${
                    entry.status === 'active' ? 'bg-green-50 border-green-200' :
                    entry.status === 'expired' ? 'bg-gray-50 border-gray-200' :
                    'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        entry.status === 'active' ? 'bg-green-200 text-green-800' :
                        entry.status === 'expired' ? 'bg-gray-200 text-gray-600' :
                        'bg-yellow-200 text-yellow-800'
                      }`}>
                        {entry.status.toUpperCase()}
                      </span>
                      <span className="text-sm font-mono">{entry.cache_key}</span>
                    </div>
                    <span className="text-xs text-gray-500">{formatBytes(entry.response_size_bytes)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>{getFeatureIcon(entry.feature_type)} {entry.feature_type}</span>
                    <span>🤖 {entry.provider}</span>
                    <span>📊 {entry.hit_count} hits</span>
                    <span>⏱️ TTL: {formatTTL(entry.ttl_seconds)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cache Clear Confirmation Modal */}
      {showCacheClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">🗑️ Clear AI Cache</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to clear all cached AI responses? This will remove {cacheStats.active_entries.toLocaleString()} cached entries ({cacheStats.cache_size_mb.toFixed(1)} MB).
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-sm text-amber-800">
              ⚠️ This action cannot be undone. Future requests will need to be re-processed, increasing costs and latency temporarily.
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCacheClearModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={clearCache}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch Logs */}
      <div className="bg-white rounded-lg shadow p-4 mt-6">
        <h2 className="text-lg font-semibold mb-4">📋 Provider Switch Logs</h2>

        {logs.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <div className="text-3xl mb-2">📭</div>
            <div>No provider switches logged yet</div>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`flex items-center justify-between p-3 rounded border ${
                  log.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{log.success ? '✅' : '❌'}</span>
                  <div>
                    <div className="font-medium">
                      {log.from_provider} → {log.to_provider}
                    </div>
                    <div className="text-xs text-gray-500">
                      {log.reason} • {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                {log.latency_ms && (
                  <span className="text-sm text-gray-600">{log.latency_ms}ms</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feature #1337: API Key Management */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              🔑 API Key Management
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Encrypted</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">Securely manage AI provider API keys with encryption at rest</p>
          </div>
          <button
            onClick={openAddKeyModal}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <span>➕</span> Add API Key
          </button>
        </div>

        {/* API Keys List */}
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className={`border rounded-lg p-4 transition-all ${
                key.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {key.provider === 'kie' ? '🤖' : '🔵'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{key.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        key.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {key.is_active ? '✓ Active' : '○ Inactive'}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                        {key.provider}
                      </span>
                      {/* Feature #1328: Key version and role badges */}
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        v{key.version}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        key.role === 'primary' ? 'bg-blue-100 text-blue-700' :
                        key.role === 'standby' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {key.role === 'primary' ? '🔷 Primary' :
                         key.role === 'standby' ? '🔶 Standby' :
                         '⬜ Retiring'}
                      </span>
                      {key.traffic_percentage > 0 && key.traffic_percentage < 100 && (
                        <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full animate-pulse">
                          🔄 {key.traffic_percentage}% traffic
                        </span>
                      )}
                      {rotatingKeys.has(key.id) && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full animate-pulse">
                          ⏳ Rotating...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                        {showKeyValue[key.id] ? `${key.key_prefix}${'*'.repeat(24)}${key.key_suffix}` : maskApiKey(key)}
                      </code>
                      <button
                        onClick={() => setShowKeyValue(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                        className="text-gray-400 hover:text-gray-600"
                        title={showKeyValue[key.id] ? 'Hide key' : 'Show key'}
                      >
                        {showKeyValue[key.id] ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testApiKey(key.id)}
                    disabled={isTestingKey === key.id}
                    className="px-3 py-1.5 text-sm border border-blue-300 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isTestingKey === key.id ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent"></div>
                        Testing...
                      </>
                    ) : (
                      <>🧪 Test Connection</>
                    )}
                  </button>
                  <button
                    onClick={() => openRotateKeyModal(key)}
                    className="px-3 py-1.5 text-sm border border-amber-300 text-amber-600 rounded hover:bg-amber-50 flex items-center gap-1"
                  >
                    🔄 Rotate
                  </button>
                  <button
                    onClick={() => toggleKeyActive(key.id)}
                    className={`px-3 py-1.5 text-sm border rounded flex items-center gap-1 ${
                      key.is_active
                        ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        : 'border-green-300 text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {key.is_active ? '⏸️ Disable' : '▶️ Enable'}
                  </button>
                  <button
                    onClick={() => deleteApiKey(key.id)}
                    className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Key Details */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Created</div>
                  <div className="font-medium">{new Date(key.created_at).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">Last Used</div>
                  <div className="font-medium">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Last Rotated</div>
                  <div className="font-medium">
                    {key.last_rotated_at ? new Date(key.last_rotated_at).toLocaleDateString() : 'Never'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Usage Count</div>
                  <div className="font-medium">{formatNumber(key.usage_count)} requests</div>
                </div>
              </div>

              {/* Permissions */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Permissions:</span>
                {key.permissions.map((perm) => (
                  <span key={perm} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {perm}
                  </span>
                ))}
              </div>

              {/* Rate Limit & Expiry */}
              <div className="mt-3 flex items-center gap-4 text-sm">
                {key.rate_limit_remaining !== null && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Rate limit:</span>
                    <span className={`font-medium ${key.rate_limit_remaining < 1000 ? 'text-amber-600' : 'text-green-600'}`}>
                      {formatNumber(key.rate_limit_remaining)} remaining
                    </span>
                  </div>
                )}
                {key.expires_at && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Expires:</span>
                    <span className={`font-medium ${
                      new Date(key.expires_at) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        ? 'text-amber-600'
                        : 'text-gray-700'
                    }`}>
                      {new Date(key.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Test Result */}
              {keyTestResult && keyTestResult.provider === key.provider && (
                <div className={`mt-4 p-3 rounded-lg ${
                  keyTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{keyTestResult.success ? '✅' : '❌'}</span>
                    <span className="font-medium">
                      {keyTestResult.success ? 'Connection Test Passed' : 'Connection Test Failed'}
                    </span>
                    <span className="text-sm text-gray-500">
                      ({keyTestResult.latency_ms}ms)
                    </span>
                  </div>
                  {keyTestResult.success ? (
                    <div className="text-sm text-gray-600">
                      <span className="text-gray-500">Available models:</span>{' '}
                      {keyTestResult.models_available.join(', ')}
                    </div>
                  ) : (
                    <div className="text-sm text-red-600">{keyTestResult.error}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Feature #1328: Zero-Downtime Rotation Panel */}
        <div className="mt-6 border-t pt-6">
          <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
            🔄 Zero-Downtime Key Rotation
            <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">
              Gradual Traffic Shift
            </span>
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Rotate API keys without downtime by gradually shifting traffic from primary to standby key.
          </p>

          {/* Group keys by provider */}
          {['kie', 'anthropic'].map(provider => {
            const providerKeys = apiKeys.filter(k => k.provider === provider);
            const primaryKey = providerKeys.find(k => k.role === 'primary');
            const standbyKeys = providerKeys.filter(k => k.role === 'standby' && k.is_active);

            if (providerKeys.length < 2) return null;

            return (
              <div key={provider} className="mb-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{provider === 'kie' ? '🤖' : '🔵'}</span>
                  <span className="font-medium capitalize">{provider}</span>
                  <span className="text-xs text-gray-500">({providerKeys.length} keys)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Primary Key */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-xs text-blue-600 font-medium mb-1">🔷 PRIMARY</div>
                    {primaryKey ? (
                      <>
                        <div className="font-medium text-sm">{primaryKey.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          v{primaryKey.version} • {primaryKey.traffic_percentage}% traffic
                        </div>
                        <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${primaryKey.traffic_percentage}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-400">No primary key</div>
                    )}
                  </div>

                  {/* Standby Key */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="text-xs text-amber-600 font-medium mb-1">🔶 STANDBY</div>
                    {standbyKeys.length > 0 ? (
                      <>
                        <div className="font-medium text-sm">{standbyKeys[0].name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          v{standbyKeys[0].version} • {standbyKeys[0].traffic_percentage}% traffic
                        </div>
                        <div className="mt-2 w-full bg-amber-200 rounded-full h-2">
                          <div
                            className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${standbyKeys[0].traffic_percentage}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-400">No standby key - add one first</div>
                    )}
                  </div>
                </div>

                {/* Rotation Button */}
                {primaryKey && standbyKeys.length > 0 && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => startZeroDowntimeRotation(primaryKey.id, standbyKeys[0].id)}
                      disabled={rotatingKeys.has(primaryKey.id) || rotatingKeys.has(standbyKeys[0].id)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-amber-500 text-white rounded-lg hover:from-blue-600 hover:to-amber-600 disabled:opacity-50 flex items-center gap-2"
                    >
                      {rotatingKeys.has(primaryKey.id) ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Rotating Traffic...
                        </>
                      ) : (
                        <>
                          🔄 Start Zero-Downtime Rotation
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Key Audit Logs */}
        <div className="mt-6 border-t pt-6">
          <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
            📜 API Key Audit Log
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              Last {keyAuditLogs.length} changes
            </span>
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {keyAuditLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-center justify-between p-3 rounded border text-sm ${
                  log.success ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {log.action === 'created' && '➕'}
                    {log.action === 'rotated' && '🔄'}
                    {log.action === 'deleted' && '🗑️'}
                    {log.action === 'activated' && '▶️'}
                    {log.action === 'deactivated' && '⏸️'}
                    {log.action === 'tested' && '🧪'}
                    {log.action === 'updated' && '✏️'}
                  </span>
                  <div>
                    <div className="font-medium capitalize">
                      {log.action} - {log.key_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      by {log.performed_by} • {log.ip_address} • {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    log.provider === 'kie' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {log.provider}
                  </span>
                  {log.success ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-red-600">✗</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">
              {keyModalMode === 'add' ? '➕ Add New API Key' : '🔄 Rotate API Key'}
            </h3>

            {keyModalMode === 'add' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production API Key"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                  <select
                    value={newKeyProvider}
                    onChange={(e) => setNewKeyProvider(e.target.value as 'kie' | 'anthropic')}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="kie">🤖 Kie.ai</option>
                    <option value="anthropic">🔵 Anthropic</option>
                  </select>
                </div>
              </>
            )}

            {keyModalMode === 'rotate' && editingKey && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800">
                  <span className="text-lg">⚠️</span>
                  <span className="font-medium">Rotating: {editingKey.name}</span>
                </div>
                <p className="text-sm text-amber-700 mt-1">
                  The current key will be replaced. Make sure to update any services using this key.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {keyModalMode === 'add' ? 'API Key' : 'New API Key'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder={
                    keyModalMode === 'rotate' && editingKey
                      ? `Enter new ${editingKey.provider === 'kie' ? 'kie_' : 'sk-ant-'}... key`
                      : newKeyProvider === 'kie'
                        ? 'kie_xxxxxxxxxxxxx'
                        : 'sk-ant-xxxxxxxxxxxxx'
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {keyModalMode === 'add'
                  ? `${newKeyProvider === 'kie' ? 'Kie.ai' : 'Anthropic'} keys should start with "${newKeyProvider === 'kie' ? 'kie_' : 'sk-ant-'}"`
                  : editingKey && `${editingKey.provider === 'kie' ? 'Kie.ai' : 'Anthropic'} keys should start with "${editingKey.provider === 'kie' ? 'kie_' : 'sk-ant-'}"`
                }
              </p>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => {
                  setShowKeyModal(false);
                  setNewKeyValue('');
                  setNewKeyName('');
                  setEditingKey(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={keyModalMode === 'add' ? addNewApiKey : rotateApiKey}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                {keyModalMode === 'add' ? 'Add Key' : 'Rotate Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// DependencyAlertConfig and CVEAlert interfaces moved to ./pages/DependencyAlertsPage.tsx


// Feature #1324: ProviderHealthPage extracted to ./pages/ProviderHealthPage.tsx (~623 lines)


// Feature #1325: AICostTrackingPage extracted to ./pages/AICostTrackingPage.tsx (~568 lines)



export { AIRouterPage };
