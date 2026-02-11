// APIKeysTab - API key management
// Feature #451: Extracted from SettingsPage.tsx
// Feature #658: Migrated hand-rolled modal to shared Modal component

import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTimezoneStore } from '../../stores/timezoneStore';
import { toast } from '../../stores/toastStore';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../ui/Modal';
import { type ApiKey } from '../../hooks/api/useSettings';

export function APIKeysTab() {
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

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const response = await fetch(`/api/v1/organizations/${user?.organization_id}/api-keys`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setApiKeys(data.api_keys || []);
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
        body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create API key');
      }

      const data = await response.json();
      setCreatedKey(data.api_key);
      setApiKeys(prev => [...prev, data.api_key]);
      setNewKeyName('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/v1/organizations/${user?.organization_id}/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter(k => k.id !== keyId));
        toast.success('API key revoked');
      } else {
        toast.error('Failed to revoke API key');
      }
    } catch (err) {
      toast.error('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-foreground">API Keys</h3>
          <p className="text-sm text-muted-foreground">Manage API keys for programmatic access.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Create API Key
        </button>
      </div>

      {/* Keys Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Key</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Scopes</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Created</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : apiKeys.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No API keys created yet</td>
              </tr>
            ) : (
              apiKeys.map(key => (
                <tr key={key.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-foreground font-medium">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{key.key_prefix}...</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {key.scopes.map(scope => (
                        <span key={scope} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                          {scope}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(key.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="text-sm text-destructive hover:underline"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Feature #658: Create Modal - migrated to shared Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          if (!createdKey) setShowCreateModal(false);
        }}
        title={createdKey ? "API Key Created" : "Create API Key"}
        size="md"
        closeOnBackdrop={!createdKey}
        closeOnEscape={!createdKey}
      >
        {createdKey ? (
          <>
            <ModalHeader showCloseButton={false}>API Key Created</ModalHeader>
            <ModalBody>
              <div className="bg-warning/5 border border-warning/20 rounded-md p-4">
                <p className="text-sm text-warning mb-2">
                  ⚠️ Make sure to copy your API key now. You won't be able to see it again!
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background p-2 rounded text-xs font-mono break-all text-foreground">
                    {createdKey.key}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdKey.key!)}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
                  >
                    {keyCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <button
                onClick={() => {
                  setCreatedKey(null);
                  setShowCreateModal(false);
                }}
                className="w-full px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80"
              >
                Done
              </button>
            </ModalFooter>
          </>
        ) : (
          <form onSubmit={handleCreateKey}>
            <ModalHeader onClose={() => setShowCreateModal(false)}>Create API Key</ModalHeader>
            <ModalBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="My API Key"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Scopes</label>
                <div className="space-y-2">
                  {['read', 'write', 'execute', 'admin'].map(scope => (
                    <label key={scope} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyScopes([...newKeyScopes, scope]);
                          } else {
                            setNewKeyScopes(newKeyScopes.filter(s => s !== scope));
                          }
                        }}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-foreground capitalize">{scope}</span>
                    </label>
                  ))}
                </div>
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
            </ModalBody>
            <ModalFooter>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Key'}
              </button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </div>
  );
}
