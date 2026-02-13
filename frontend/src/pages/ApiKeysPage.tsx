// ApiKeysPage - Extracted from App.tsx for code quality compliance
// Feature #636: Adopt Modal component in page-level inline modals
// Feature #1357: Frontend file size limit enforcement
// Feature #690: Migrated from raw fetch to React Query hooks

import { useState } from 'react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Button } from '@/components/ui/button';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '../hooks/api/useOrganization';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Check, Clock, ChevronDown, Loader2 } from 'lucide-react';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';

import type { ApiKey } from '@/types/organization';

export function ApiKeysPage() {
  const { formatDate } = useTimezoneStore();

  // Feature #690: React Query hooks for data fetching and mutations
  const { data: apiKeys = [], isLoading } = useApiKeys();
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  // Rate limiting configuration
  const [showRateLimitConfig, setShowRateLimitConfig] = useState(false);
  const [rateLimitValue, setRateLimitValue] = useState(100);
  const [rateLimitWindow, setRateLimitWindow] = useState(60);
  const [burstLimit, setBurstLimit] = useState(20);
  const [burstWindow, setBurstWindow] = useState(10);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await createMutation.mutateAsync({
        name: newKeyName,
        scopes: newKeyScopes,
        // Include rate limit config if custom values are set
        ...(showRateLimitConfig ? {
          rate_limit: rateLimitValue,
          rate_limit_window: rateLimitWindow,
          burst_limit: burstLimit,
          burst_window: burstWindow,
        } : {}),
      });
      // Show the created key (this is the only time the full key is shown!)
      setCreatedKey(result.api_key as ApiKey);
    } catch {
      // Error is handled by mutation state
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
    createMutation.reset();
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
      await deleteMutation.mutateAsync(keyId);
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
        <PageHeader
          title="API Keys"
          description="Manage API keys for programmatic access to your organization"
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Settings', href: '/settings' },
            { label: 'API Keys' }
          ]}
          actions={
            <Button
              onClick={() => setShowCreateModal(true)}
            >
              Create API Key
            </Button>
          }
        />

        {/* API Keys List */}
        <div className="mt-8">
          {isLoading ? (
            <p className="text-muted-foreground">Loading API keys...</p>
          ) : apiKeys.length === 0 ? (
            /* Feature #728: EmptyState adoption */
            <EmptyState
              icon={EmptyStateIcons.document}
              title="No API keys yet"
              description="Create an API key to access the QA Guardian API programmatically."
              action={{ label: 'Create API Key', onClick: () => setShowCreateModal(true) }}
            />
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
                    <Button
                      variant="link"
                      onClick={() => handleDeleteKey(key.id)}
                      className="text-sm text-destructive hover:text-destructive/80 p-0 h-auto"
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Create API Key Modal - Feature #636: Using Modal component */}
        <Modal
          isOpen={showCreateModal}
          onClose={handleCloseCreateModal}
          title={createdKey ? "API Key Created" : "Create API Key"}
          size="md"
        >
          {createdKey ? (
            // Show the created key (only shown once!)
            <>
              <ModalBody>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                    <Check className="h-5 w-5 text-success" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">API Key Created</h3>
                </div>
                <div className="rounded-md bg-warning/5 border border-warning/20 p-3 mb-4">
                  <p className="text-sm text-warning font-medium">
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
                    <Button
                      onClick={handleCopyKey}
                      size="sm"
                    >
                      {keyCopied ? 'Copied!' : 'Copy'}
                    </Button>
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
              </ModalBody>
              <ModalFooter>
                <Button
                  onClick={handleCloseCreateModal}
                  className="w-full"
                >
                  Done
                </Button>
              </ModalFooter>
            </>
          ) : (
            // Create key form
            <form onSubmit={handleCreateKey}>
              <ModalBody className="space-y-4">
                {createMutation.error && (
                  <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {createMutation.error.message}
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
                      <Button
                        key={scope}
                        type="button"
                        variant={newKeyScopes.includes(scope) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleScope(scope)}
                        className="rounded-full"
                      >
                        {scope}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground font-medium">MCP Scopes (for Claude Code integration)</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {['mcp', 'mcp:read', 'mcp:write', 'mcp:execute'].map((scope) => (
                      <Button
                        key={scope}
                        type="button"
                        variant={newKeyScopes.includes(scope) ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => toggleScope(scope)}
                        className={`rounded-full ${newKeyScopes.includes(scope) ? 'bg-accent text-primary-foreground border-accent' : ''}`}
                      >
                        {scope}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select at least one scope for the API key.
                  </p>
                </div>

                {/* Rate Limiting Configuration (Collapsible) */}
                <div className="border border-border rounded-md">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowRateLimitConfig(!showRateLimitConfig)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium h-auto"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Rate Limiting {showRateLimitConfig && <span className="text-xs text-muted-foreground">(Custom)</span>}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showRateLimitConfig ? 'rotate-180' : ''}`} />
                  </Button>
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
              </ModalBody>
              <ModalFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseCreateModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || newKeyScopes.length === 0}
                  className="flex items-center gap-2"
                >
                  {createMutation.isPending && (
                    <Loader2 className="animate-spin h-4 w-4" />
                  )}
                  {createMutation.isPending ? 'Creating...' : 'Create Key'}
                </Button>
              </ModalFooter>
            </form>
          )}
        </Modal>
      </div>
    </Layout>
  );
}
