// ApiKeysPage - Extracted from App.tsx for code quality compliance
// Feature #1357: Frontend file size limit enforcement

import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';

interface ApiKey {
  id: string;
  name: string;
  key?: string;  // Only present at creation time
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
}

export function ApiKeysPage() {
  const { user, token } = useAuthStore();
  const { formatDate } = useTimezoneStore();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  // Rate limiting configuration
  const [showRateLimitConfig, setShowRateLimitConfig] = useState(false);
  const [rateLimitValue, setRateLimitValue] = useState(100);
  const [rateLimitWindow, setRateLimitWindow] = useState(60);
  const [burstLimit, setBurstLimit] = useState(20);
  const [burstWindow, setBurstWindow] = useState(10);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateModal) {
        setShowCreateModal(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showCreateModal]);

  // Fetch API keys on mount
  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const response = await fetch(`/api/v1/organizations/${user?.organization_id}/api-keys`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setApiKeys(data.api_keys);
        }
      } catch (err) {
        console.error('Failed to fetch API keys:', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (user?.organization_id) {
      fetchApiKeys();
    }
  }, [token, user?.organization_id]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setIsCreating(true);

    try {
      const response = await fetch(`/api/v1/organizations/${user?.organization_id}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newKeyName,
          scopes: newKeyScopes,
          // Include rate limit config if custom values are set
          ...(showRateLimitConfig ? {
            rate_limit: rateLimitValue,
            rate_limit_window: rateLimitWindow,
            burst_limit: burstLimit,
            burst_window: burstWindow,
          } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create API key');
      }

      const data = await response.json();
      // Show the created key (this is the only time the full key is shown!)
      setCreatedKey(data.api_key);
      // Add the key to the list (without the full key)
      setApiKeys([...apiKeys, {
        id: data.api_key.id,
        name: data.api_key.name,
        key_prefix: data.api_key.key_prefix,
        scopes: data.api_key.scopes,
        expires_at: data.api_key.expires_at,
        created_at: data.api_key.created_at,
      }]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (createdKey?.key) {
      await navigator.clipboard.writeText(createdKey.key);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreatedKey(null);
    setNewKeyName('');
    setNewKeyScopes(['read']);
    setCreateError('');
    setKeyCopied(false);
    // Reset rate limit config
    setShowRateLimitConfig(false);
    setRateLimitValue(100);
    setRateLimitWindow(60);
    setBurstLimit(20);
    setBurstWindow(10);
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter(k => k.id !== keyId));
      }
    } catch (err) {
      console.error('Failed to delete API key:', err);
    }
  };

  const toggleScope = (scope: string) => {
    if (newKeyScopes.includes(scope)) {
      setNewKeyScopes(newKeyScopes.filter(s => s !== scope));
    } else {
      setNewKeyScopes([...newKeyScopes, scope]);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">API Keys</h1>
            <p className="mt-2 text-muted-foreground">
              Manage API keys for programmatic access to your organization
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create API Key
          </button>
        </div>

        {/* API Keys List */}
        <div className="mt-8">
          {isLoading ? (
            <p className="text-muted-foreground">Loading API keys...</p>
          ) : apiKeys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <h3 className="text-lg font-semibold text-foreground">No API keys yet</h3>
              <p className="mt-2 text-muted-foreground">
                Create an API key to access the QA Guardian API programmatically.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
              >
                Create API Key
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-5 gap-4 border-b border-border bg-muted/30 px-6 py-3 text-sm font-medium text-muted-foreground">
                  <div>Name</div>
                  <div>Key</div>
                  <div>Scopes</div>
                  <div>Created</div>
                  <div>Actions</div>
                </div>
                {apiKeys.map((key) => (
                  <div key={key.id} className="grid grid-cols-5 gap-4 border-b border-border px-6 py-4 last:border-0 items-center">
                    <div className="font-medium text-foreground">{key.name}</div>
                    <div className="font-mono text-sm text-muted-foreground">{key.key_prefix}</div>
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(key.created_at)}
                  </div>
                  <div>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="text-sm text-destructive hover:underline"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Create API Key Modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
          >
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              {createdKey ? (
                // Show the created key (only shown once!)
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <svg aria-hidden="true" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">API Key Created</h3>
                  </div>
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 mb-4">
                    <p className="text-sm text-amber-800 font-medium">
                      Make sure to copy your API key now. You won't be able to see it again!
                    </p>
                  </div>
                  <div className="mb-4">
                    <label className="mb-1 block text-sm font-medium text-foreground">Your API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={createdKey.key || ''}
                        readOnly
                        className="flex-1 rounded-md border border-input bg-muted px-3 py-2 font-mono text-sm text-foreground"
                      />
                      <button
                        onClick={handleCopyKey}
                        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        {keyCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>Name:</strong> {createdKey.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Scopes:</strong> {createdKey.scopes.join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={handleCloseCreateModal}
                    className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Done
                  </button>
                </div>
              ) : (
                // Create key form
                <>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Create API Key</h3>
                  <form onSubmit={handleCreateKey} className="space-y-4">
                    {createError && (
                      <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {createError}
                      </div>
                    )}
                    <div>
                      <label htmlFor="api-key-name" className="mb-1 block text-sm font-medium text-foreground">
                        Key Name
                      </label>
                      <input
                        id="api-key-name"
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g., CI/CD Pipeline"
                        required
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      />
                    </div>
                    <div>
                      <span className="mb-2 block text-sm font-medium text-foreground">
                        Scopes
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {['read', 'execute', 'write', 'admin'].map((scope) => (
                          <button
                            key={scope}
                            type="button"
                            onClick={() => toggleScope(scope)}
                            className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                              newKeyScopes.includes(scope)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-foreground border-border hover:border-primary'
                            }`}
                          >
                            {scope}
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground font-medium">MCP Scopes (for Claude Code integration)</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {['mcp', 'mcp:read', 'mcp:write', 'mcp:execute'].map((scope) => (
                          <button
                            key={scope}
                            type="button"
                            onClick={() => toggleScope(scope)}
                            className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                              newKeyScopes.includes(scope)
                                ? 'bg-violet-600 text-white border-violet-600'
                                : 'bg-background text-foreground border-border hover:border-violet-600'
                            }`}
                          >
                            {scope}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Select at least one scope for the API key.
                      </p>
                    </div>

                    {/* Rate Limiting Configuration (Collapsible) */}
                    <div className="border border-border rounded-md">
                      <button
                        type="button"
                        onClick={() => setShowRateLimitConfig(!showRateLimitConfig)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 rounded-md"
                      >
                        <span className="flex items-center gap-2">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Rate Limiting {showRateLimitConfig && <span className="text-xs text-muted-foreground">(Custom)</span>}
                        </span>
                        <svg
                          className={`h-4 w-4 transition-transform ${showRateLimitConfig ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showRateLimitConfig && (
                        <div className="px-3 pb-3 space-y-3 border-t border-border">
                          <div className="pt-3 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Max Requests
                              </label>
                              <input
                                type="number"
                                value={rateLimitValue}
                                onChange={(e) => setRateLimitValue(Number(e.target.value))}
                                min={1}
                                max={1000}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Window (seconds)
                              </label>
                              <input
                                type="number"
                                value={rateLimitWindow}
                                onChange={(e) => setRateLimitWindow(Number(e.target.value))}
                                min={10}
                                max={3600}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Burst Limit
                              </label>
                              <input
                                type="number"
                                value={burstLimit}
                                onChange={(e) => setBurstLimit(Number(e.target.value))}
                                min={0}
                                max={100}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Burst Window (sec)
                              </label>
                              <input
                                type="number"
                                value={burstWindow}
                                onChange={(e) => setBurstWindow(Number(e.target.value))}
                                min={1}
                                max={60}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Burst allows {burstLimit} extra requests within {burstWindow}s when rate limit is reached.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleCloseCreateModal}
                        className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreating || newKeyScopes.length === 0}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isCreating && (
                          <svg aria-hidden="true" className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        {isCreating ? 'Creating...' : 'Create Key'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
