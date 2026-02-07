// Feature #1321: Kie.ai Provider Integration Page
// Extracted from App.tsx for code quality compliance
// Feature #317: Use environment-based API URL instead of hardcoded localhost

import React, { useState, useEffect } from 'react';

// Feature #317: API base URL from environment
const API_BASE = import.meta.env.VITE_API_URL || '';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';

// Type definitions
interface KieAIConfig {
  enabled: boolean;
  api_key: string;
  api_endpoint: string;
  model: string;
  max_tokens: number;
  temperature: number;
  cost_tracking_enabled: boolean;
}

interface KieAIPricing {
  input_cost_per_million: number;
  output_cost_per_million: number;
  thinking_cost_per_million: number;
}

interface KieAIStats {
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_thinking_tokens: number;
  total_cost: number;
  total_savings: number;
  avg_response_time_ms: number;
  success_rate: number;
  pricing: KieAIPricing;
  comparison_pricing: KieAIPricing;
  savings_percentage: number;
}

interface KieAIChatResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    thinking_tokens?: number;
    total_tokens: number;
  };
  cost: {
    input_cost: number;
    output_cost: number;
    thinking_cost: number;
    total_cost: number;
    savings: {
      direct_anthropic_cost: number;
      kie_ai_cost: number;
      savings: number;
      savings_percentage: number;
    };
  };
}

export function KieAIProviderPage() {
  const navigate = useNavigate();
  // Feature #232: Fixed to use Zustand auth store instead of non-existent localStorage token
  const token = useAuthStore.getState().token;

  // State
  const [config, setConfig] = useState<KieAIConfig | null>(null);
  const [stats, setStats] = useState<KieAIStats | null>(null);
  const [chatHistory, setChatHistory] = useState<KieAIChatResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; latency_ms?: number } | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [lastResponse, setLastResponse] = useState<KieAIChatResponse | null>(null);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [configRes, statsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/ai/kie/config`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/v1/ai/kie/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/v1/ai/kie/history?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (configRes.ok) setConfig(await configRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (historyRes.ok) {
        const data = await historyRes.json();
        setChatHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch Kie.ai data:', error);
    }
    setIsLoading(false);
  };

  // Update configuration
  const updateConfig = async (updates: Partial<KieAIConfig>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/kie/config`, {
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
      const response = await fetch(`${API_BASE}/api/v1/ai/kie/test-connection`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      setConnectionStatus(result);
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
      const response = await fetch(`${API_BASE}/api/v1/ai/kie/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config?.model || 'claude-opus-4.5-thinking',
          messages: [{ role: 'user', content: chatInput }],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setLastResponse(result);
        setChatInput('');
        // Refresh stats
        fetchData();
      }
    } catch (error) {
      console.error('Chat failed:', error);
    }
    setIsChatting(false);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(6)}`;
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

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
          <h1 className="text-2xl font-bold text-foreground">{'\u{1F916}'} Kie.ai Provider</h1>
          <p className="text-muted-foreground">70% cost savings on Claude Opus 4.5 thinking model</p>
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pricing Comparison Banner */}
      <div className="mb-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1">{'\u{1F4B0}'} 70% Cost Savings</h2>
            <p className="opacity-90">Compared to direct Anthropic API pricing</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">$1.50<span className="text-sm">/M input</span></div>
            <div className="text-lg">$7.50<span className="text-sm">/M output</span></div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="bg-white/20 rounded p-2 text-center">
            <div className="font-bold">Input Tokens</div>
            <div>$1.50/M <span className="line-through opacity-60">$5.00/M</span></div>
          </div>
          <div className="bg-white/20 rounded p-2 text-center">
            <div className="font-bold">Output Tokens</div>
            <div>$7.50/M <span className="line-through opacity-60">$25.00/M</span></div>
          </div>
          <div className="bg-white/20 rounded p-2 text-center">
            <div className="font-bold">Thinking Tokens</div>
            <div>$5.00/M <span className="line-through opacity-60">$15.00/M</span></div>
          </div>
        </div>
      </div>

      {/* Stats and Config Grid */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Usage Stats */}
        <div className="col-span-2 bg-card rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">{'\u{1F4CA}'} Usage Statistics</h2>
          {stats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-500/10 rounded">
                <div className="text-2xl font-bold text-blue-400">{formatNumber(stats.total_requests)}</div>
                <div className="text-sm text-muted-foreground">Total Requests</div>
              </div>
              <div className="text-center p-3 bg-purple-500/10 rounded">
                <div className="text-2xl font-bold text-purple-400">{formatNumber(stats.total_input_tokens + stats.total_output_tokens)}</div>
                <div className="text-sm text-muted-foreground">Total Tokens</div>
              </div>
              <div className="text-center p-3 bg-green-500/10 rounded">
                <div className="text-2xl font-bold text-green-400">{formatCurrency(stats.total_savings)}</div>
                <div className="text-sm text-muted-foreground">Total Savings</div>
              </div>
              <div className="text-center p-3 bg-amber-500/10 rounded">
                <div className="text-2xl font-bold text-amber-400">{stats.avg_response_time_ms}ms</div>
                <div className="text-sm text-muted-foreground">Avg Response</div>
              </div>
            </div>
          )}

          {stats && (
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
                  <span className="text-muted-foreground">Thinking Tokens:</span>
                  <span className="font-medium text-foreground">{formatNumber(stats.total_thinking_tokens)}</span>
                </div>
              </div>
              <div className="border border-border rounded p-3">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Total Cost:</span>
                  <span className="font-medium text-foreground">{formatCurrency(stats.total_cost)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Savings:</span>
                  <span className="font-medium text-green-400">{formatCurrency(stats.total_savings)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className="font-medium text-foreground">{stats.success_rate}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Configuration */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">{'\u2699\uFE0F'} Configuration</h2>
          {config && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-foreground">Provider Enabled</span>
                <button
                  onClick={() => updateConfig({ enabled: !config.enabled })}
                  disabled={isSaving}
                  className={`w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-muted'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">API Key</label>
                <input
                  type="password"
                  value={config.api_key}
                  readOnly
                  className="mt-1 w-full border border-input rounded p-2 bg-muted text-foreground"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Model</label>
                <select
                  value={config.model}
                  onChange={(e) => updateConfig({ model: e.target.value })}
                  disabled={isSaving}
                  className="mt-1 w-full border border-input rounded p-2 bg-background text-foreground"
                >
                  <option value="claude-opus-4.5-thinking">Claude Opus 4.5 (Thinking)</option>
                  <option value="claude-opus-4.5">Claude Opus 4.5</option>
                  <option value="claude-sonnet-4">Claude Sonnet 4</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Temperature</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
                  disabled={isSaving}
                  className="mt-1 w-full"
                />
                <div className="text-xs text-muted-foreground text-right">{config.temperature}</div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Cost Tracking</span>
                <button
                  onClick={() => updateConfig({ cost_tracking_enabled: !config.cost_tracking_enabled })}
                  disabled={isSaving}
                  className={`w-12 h-6 rounded-full transition-colors ${config.cost_tracking_enabled ? 'bg-green-500' : 'bg-muted'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${config.cost_tracking_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Chat */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">{'\u{1F4AC}'} Test Chat</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendChat()}
            placeholder="Enter a message to test the Kie.ai provider..."
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
              <span className="text-xs text-muted-foreground">Model: {lastResponse.model}</span>
            </div>
            <div className="text-sm mb-4 whitespace-pre-wrap text-foreground">
              {lastResponse.choices[0]?.message.content}
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs border-t border-border pt-2">
              <div className="text-foreground">
                <span className="text-muted-foreground">Input:</span> {lastResponse.usage.prompt_tokens} tokens
              </div>
              <div className="text-foreground">
                <span className="text-muted-foreground">Output:</span> {lastResponse.usage.completion_tokens} tokens
              </div>
              <div className="text-foreground">
                <span className="text-muted-foreground">Cost:</span> {formatCurrency(lastResponse.cost.total_cost)}
              </div>
              <div className="text-green-400">
                <span className="text-muted-foreground">Saved:</span> {formatCurrency(lastResponse.cost.savings.savings)} ({lastResponse.cost.savings.savings_percentage}%)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </Layout>
  );
}
