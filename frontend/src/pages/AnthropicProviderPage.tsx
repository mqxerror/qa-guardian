// Feature #1322: Anthropic Direct Provider Page
// Extracted from App.tsx for code quality compliance
// Feature #317: Use environment-based API URL instead of hardcoded localhost

import React, { useState, useEffect } from 'react';

// Feature #317: API base URL from environment
const API_BASE = import.meta.env.VITE_API_URL || '';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';

// Type definitions
interface AnthropicConfig {
  enabled: boolean;
  api_key: string;
  api_version: string;
  model: string;
  max_tokens: number;
  temperature: number;
  use_as_fallback: boolean;
  rate_limit_handling: 'retry' | 'queue' | 'fail';
  max_retries: number;
  retry_delay_ms: number;
}

interface AnthropicStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  rate_limited_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  avg_response_time_ms: number;
  avg_tokens_per_request: number;
  error_rate: number;
  pricing: Record<string, { input_cost_per_million: number; output_cost_per_million: number }>;
}

interface AnthropicRateLimitInfo {
  requests_remaining: number;
  requests_limit: number;
  tokens_remaining: number;
  tokens_limit: number;
  reset_at: string;
}

interface AnthropicChatResponse {
  id: string;
  model: string;
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
  cost: { input_cost: number; output_cost: number; total_cost: number };
  response_time_ms: number;
}

export function AnthropicProviderPage() {
  const navigate = useNavigate();
  // Feature #232: Fixed to use Zustand auth store instead of non-existent localStorage token
  const token = useAuthStore.getState().token;

  // State
  const [config, setConfig] = useState<AnthropicConfig | null>(null);
  const [stats, setStats] = useState<AnthropicStats | null>(null);
  const [rateLimits, setRateLimits] = useState<AnthropicRateLimitInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; latency_ms?: number; models_available?: string[] } | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [lastResponse, setLastResponse] = useState<AnthropicChatResponse | null>(null);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [configRes, statsRes, rateLimitsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/ai/anthropic/config`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/v1/ai/anthropic/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/v1/ai/anthropic/rate-limits`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (configRes.ok) setConfig(await configRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (rateLimitsRes.ok) setRateLimits(await rateLimitsRes.json());
    } catch (error) {
      console.error('Failed to fetch Anthropic data:', error);
    }
    setIsLoading(false);
  };

  // Update configuration
  const updateConfig = async (updates: Partial<AnthropicConfig>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/anthropic/config`, {
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

  // Test connection
  const testConnection = async () => {
    setIsTesting(true);
    setConnectionStatus(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/anthropic/test-connection`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      setConnectionStatus(result);
      if (result.rate_limit) {
        setRateLimits(result.rate_limit);
      }
    } catch (error) {
      setConnectionStatus({ success: false });
    }
    setIsTesting(false);
  };

  // Send chat message
  const sendChat = async () => {
    if (!chatInput.trim()) return;

    setIsChatting(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/anthropic/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config?.model || 'claude-sonnet-4',
          messages: [{ role: 'user', content: chatInput }],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setLastResponse(result);
        setChatInput('');
        fetchData();
      }
    } catch (error) {
      console.error('Chat failed:', error);
    }
    setIsChatting(false);
  };

  // Format currency
  const formatCurrency = (amount: number) => `$${amount.toFixed(6)}`;
  const formatNumber = (num: number) => num.toLocaleString();

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Layout>
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/ai-insights')}
            className="text-primary hover:text-primary/80 mb-2 flex items-center gap-1"
          >
            {'\u2190'} Back to AI Insights
          </button>
          <h1 className="text-2xl font-bold text-foreground">{'\u{1F535}'} Anthropic Direct</h1>
          <p className="text-muted-foreground">Direct API access as fallback provider for reliability</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={testConnection}
            disabled={isTesting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isTesting ? 'Testing...' : '\u{1F50C} Test Connection'}
          </button>
        </div>
      </div>

      {/* Connection Status */}
      {connectionStatus && (
        <div className={`mb-6 p-4 rounded-lg border ${connectionStatus.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{connectionStatus.success ? '\u2705' : '\u274C'}</span>
            <div>
              <div className={`font-medium ${connectionStatus.success ? 'text-green-400' : 'text-red-400'}`}>
                {connectionStatus.success ? 'Connection Successful' : 'Connection Failed'}
              </div>
              {connectionStatus.latency_ms && (
                <div className="text-sm text-muted-foreground">
                  Latency: {connectionStatus.latency_ms}ms
                  {connectionStatus.models_available && ` \u2022 Models: ${connectionStatus.models_available.join(', ')}`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Model Pricing */}
      <div className="mb-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-6 text-white">
        <h2 className="text-xl font-bold mb-4">{'\u{1F48E}'} Model Pricing</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/20 rounded p-3 text-center">
            <div className="font-bold text-lg">Claude Opus 4</div>
            <div className="text-sm mt-1">$15.00/M input</div>
            <div className="text-sm">$75.00/M output</div>
            <div className="text-xs mt-1 opacity-70">Most powerful</div>
          </div>
          <div className="bg-white/30 rounded p-3 text-center border-2 border-white/50">
            <div className="font-bold text-lg">Claude Sonnet 4</div>
            <div className="text-sm mt-1">$3.00/M input</div>
            <div className="text-sm">$15.00/M output</div>
            <div className="text-xs mt-1 opacity-70">Best balance</div>
          </div>
          <div className="bg-white/20 rounded p-3 text-center">
            <div className="font-bold text-lg">Claude Haiku 3.5</div>
            <div className="text-sm mt-1">$0.80/M input</div>
            <div className="text-sm">$4.00/M output</div>
            <div className="text-xs mt-1 opacity-70">Most affordable</div>
          </div>
        </div>
      </div>

      {/* Stats and Config Grid */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Usage Stats */}
        <div className="col-span-2 bg-card rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">{'\u{1F4CA}'} Usage Statistics</h2>
          {stats && (
            <>
              <div className="grid grid-cols-5 gap-3">
                <div className="text-center p-3 bg-blue-500/10 rounded">
                  <div className="text-2xl font-bold text-blue-400">{formatNumber(stats.total_requests)}</div>
                  <div className="text-xs text-muted-foreground">Total Requests</div>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded">
                  <div className="text-2xl font-bold text-green-400">{formatNumber(stats.successful_requests)}</div>
                  <div className="text-xs text-muted-foreground">Successful</div>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded">
                  <div className="text-2xl font-bold text-red-400">{stats.failed_requests}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
                <div className="text-center p-3 bg-amber-500/10 rounded">
                  <div className="text-2xl font-bold text-amber-400">{stats.rate_limited_requests}</div>
                  <div className="text-xs text-muted-foreground">Rate Limited</div>
                </div>
                <div className="text-center p-3 bg-purple-500/10 rounded">
                  <div className="text-2xl font-bold text-purple-400">{stats.error_rate}%</div>
                  <div className="text-xs text-muted-foreground">Error Rate</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="border border-border rounded p-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Input Tokens:</span>
                    <span className="font-medium text-foreground">{formatNumber(stats.total_input_tokens)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Output Tokens:</span>
                    <span className="font-medium text-foreground">{formatNumber(stats.total_output_tokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg per Request:</span>
                    <span className="font-medium text-foreground">{formatNumber(stats.avg_tokens_per_request)}</span>
                  </div>
                </div>
                <div className="border border-border rounded p-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Total Cost:</span>
                    <span className="font-medium text-foreground">{formatCurrency(stats.total_cost)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Avg Response:</span>
                    <span className="font-medium text-foreground">{stats.avg_response_time_ms}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Success Rate:</span>
                    <span className="font-medium text-green-400">{(100 - stats.error_rate).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Configuration */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">{'\u2699\uFE0F'} Configuration</h2>
          {config && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Provider Enabled</span>
                <button
                  onClick={() => updateConfig({ enabled: !config.enabled })}
                  disabled={isSaving}
                  className={`w-10 h-5 rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-muted'}`}
                >
                  <div className={`w-4 h-4 bg-card rounded-full shadow transform transition-transform ${config.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Use as Fallback</span>
                <button
                  onClick={() => updateConfig({ use_as_fallback: !config.use_as_fallback })}
                  disabled={isSaving}
                  className={`w-10 h-5 rounded-full transition-colors ${config.use_as_fallback ? 'bg-green-500' : 'bg-muted'}`}
                >
                  <div className={`w-4 h-4 bg-card rounded-full shadow transform transition-transform ${config.use_as_fallback ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Model</label>
                <select
                  value={config.model}
                  onChange={(e) => updateConfig({ model: e.target.value })}
                  disabled={isSaving}
                  className="mt-1 w-full border border-input rounded p-1.5 text-sm bg-background text-foreground"
                >
                  <option value="claude-opus-4">Claude Opus 4</option>
                  <option value="claude-sonnet-4">Claude Sonnet 4</option>
                  <option value="claude-haiku-3.5">Claude Haiku 3.5</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Rate Limit Handling</label>
                <select
                  value={config.rate_limit_handling}
                  onChange={(e) => updateConfig({ rate_limit_handling: e.target.value as 'retry' | 'queue' | 'fail' })}
                  disabled={isSaving}
                  className="mt-1 w-full border border-input rounded p-1.5 text-sm bg-background text-foreground"
                >
                  <option value="retry">Retry with delay</option>
                  <option value="queue">Queue requests</option>
                  <option value="fail">Fail immediately</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Max Retries: {config.max_retries}</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={config.max_retries}
                  onChange={(e) => updateConfig({ max_retries: parseInt(e.target.value) })}
                  disabled={isSaving}
                  className="mt-1 w-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rate Limits */}
      {rateLimits && (
        <div className="mb-6 bg-muted/50 rounded-lg p-4">
          <h3 className="font-medium text-foreground mb-3">{'\u{1F4C8}'} Rate Limits</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Requests</div>
              <div className="bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${(rateLimits.requests_remaining / rateLimits.requests_limit) * 100}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatNumber(rateLimits.requests_remaining)} / {formatNumber(rateLimits.requests_limit)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Tokens</div>
              <div className="bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${(rateLimits.tokens_remaining / rateLimits.tokens_limit) * 100}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatNumber(rateLimits.tokens_remaining)} / {formatNumber(rateLimits.tokens_limit)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Chat */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">{'\u{1F4AC}'} Test Chat</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendChat()}
            placeholder="Enter a message to test the Anthropic provider..."
            className="flex-1 border border-input rounded p-2 bg-background text-foreground placeholder:text-muted-foreground"
            disabled={isChatting}
          />
          <button
            onClick={sendChat}
            disabled={isChatting || !chatInput.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isChatting ? 'Sending...' : 'Send'}
          </button>
        </div>

        {lastResponse && (
          <div className="border border-border rounded p-4 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-foreground">Response</span>
              <div className="text-xs text-muted-foreground">
                Model: {lastResponse.model} {'\u2022'} {lastResponse.response_time_ms}ms
              </div>
            </div>
            <div className="text-sm mb-4 whitespace-pre-wrap text-foreground">
              {lastResponse.content[0]?.text}
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs border-t border-border pt-2">
              <div className="text-foreground"><span className="text-muted-foreground">Input:</span> {lastResponse.usage.input_tokens}</div>
              <div className="text-foreground"><span className="text-muted-foreground">Output:</span> {lastResponse.usage.output_tokens}</div>
              <div className="text-foreground"><span className="text-muted-foreground">Cost:</span> {formatCurrency(lastResponse.cost.total_cost)}</div>
              <div className="text-foreground"><span className="text-muted-foreground">Time:</span> {lastResponse.response_time_ms}ms</div>
            </div>
          </div>
        )}
      </div>
    </div>
    </Layout>
  );
}
