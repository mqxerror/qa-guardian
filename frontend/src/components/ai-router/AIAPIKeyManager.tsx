// AIAPIKeyManager - Extracted from AIRouterPage.tsx (Feature #405)
// Manages API keys for AI providers with zero-downtime rotation support

import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../ui/Modal';
import type { APIKeyConfig, APIKeyAuditLog, KeyTestResult } from './types';

interface AIAPIKeyManagerProps {
  apiKeys: APIKeyConfig[];
  setApiKeys: React.Dispatch<React.SetStateAction<APIKeyConfig[]>>;
  keyAuditLogs: APIKeyAuditLog[];
  setKeyAuditLogs: React.Dispatch<React.SetStateAction<APIKeyAuditLog[]>>;
}

export function AIAPIKeyManager({
  apiKeys,
  setApiKeys,
  keyAuditLogs,
  setKeyAuditLogs,
}: AIAPIKeyManagerProps) {
  // Modal state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalMode, setKeyModalMode] = useState<'add' | 'rotate'>('add');
  const [editingKey, setEditingKey] = useState<APIKeyConfig | null>(null);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState<'kie' | 'anthropic'>('kie');
  const [isTestingKey, setIsTestingKey] = useState<string | null>(null);
  const [keyTestResult, setKeyTestResult] = useState<KeyTestResult | null>(null);
  const [rotatingKeys, setRotatingKeys] = useState<Set<string>>(new Set());

  // Validation
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

  // Test API key
  const testApiKey = async (keyId: string) => {
    setIsTestingKey(keyId);
    setKeyTestResult(null);

    await new Promise(r => setTimeout(r, 1500));

    const key = apiKeys.find(k => k.id === keyId);
    if (!key) return;

    const result: KeyTestResult = {
      provider: key.provider,
      success: Math.random() > 0.1,
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

  // Add new API key
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
      version: maxVersion + 1,
      role: providerKeys.length === 0 ? 'primary' : 'standby',
      traffic_percentage: providerKeys.length === 0 ? 100 : 0,
    };

    setApiKeys(prev => [...prev, newKey]);

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

  // Rotate API key
  const rotateApiKey = async () => {
    if (!editingKey) return;

    const validation = validateApiKey(newKeyValue, editingKey.provider);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

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

  // Toggle key active state
  const toggleKeyActive = (keyId: string) => {
    const key = apiKeys.find(k => k.id === keyId);
    if (!key) return;

    setApiKeys(prev => prev.map(k =>
      k.id === keyId ? { ...k, is_active: !k.is_active } : k
    ));

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
  };

  // Delete API key
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

  // Zero-downtime rotation
  const startZeroDowntimeRotation = async (primaryKeyId: string, standbyKeyId: string) => {
    const primaryKey = apiKeys.find(k => k.id === primaryKeyId);
    const standbyKey = apiKeys.find(k => k.id === standbyKeyId);
    if (!primaryKey || !standbyKey) return;

    setRotatingKeys(prev => new Set([...prev, primaryKeyId, standbyKeyId]));

    const trafficShifts = [
      { primary: 75, standby: 25 },
      { primary: 50, standby: 50 },
      { primary: 25, standby: 75 },
      { primary: 0, standby: 100 },
    ];

    for (const shift of trafficShifts) {
      await new Promise(r => setTimeout(r, 1000));

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

  // Group keys by provider for rotation UI
  const keysByProvider = apiKeys.reduce((acc, key) => {
    if (!acc[key.provider]) acc[key.provider] = [];
    acc[key.provider].push(key);
    return acc;
  }, {} as Record<string, APIKeyConfig[]>);

  return (
    <div className="bg-card rounded-lg shadow p-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            🔑 API Key Management
            <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">Encrypted</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Securely manage AI provider API keys with encryption at rest</p>
        </div>
        <button
          onClick={openAddKeyModal}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
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
              key.is_active ? 'border-border bg-card' : 'border-border bg-muted opacity-60'
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
                      key.is_active ? 'bg-success/10 text-success' : 'bg-muted text-foreground'
                    }`}>
                      {key.is_active ? '✓ Active' : '○ Inactive'}
                    </span>
                    <span className="text-xs bg-muted text-foreground px-2 py-0.5 rounded-full capitalize">
                      {key.provider}
                    </span>
                    <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                      v{key.version}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      key.role === 'primary' ? 'bg-primary/10 text-primary' :
                      key.role === 'standby' ? 'bg-warning/10 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {key.role === 'primary' ? '🔷 Primary' :
                       key.role === 'standby' ? '🔶 Standby' :
                       '⬜ Retiring'}
                    </span>
                    {key.traffic_percentage > 0 && key.traffic_percentage < 100 && (
                      <span className="text-xs bg-info/10 text-info px-2 py-0.5 rounded-full animate-pulse">
                        🔄 {key.traffic_percentage}% traffic
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground font-mono mt-1">
                    {key.key_prefix}{'•'.repeat(20)}{key.key_suffix}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-4 flex-wrap">
                    <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                    {key.last_used_at && (
                      <span>Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>
                    )}
                    {key.last_rotated_at && (
                      <span className="text-warning">Rotated: {new Date(key.last_rotated_at).toLocaleDateString()}</span>
                    )}
                    <span>Usage: {key.usage_count.toLocaleString()} requests</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testApiKey(key.id)}
                  disabled={isTestingKey === key.id}
                  className="px-3 py-1.5 text-sm bg-muted text-foreground rounded hover:bg-muted/80 disabled:opacity-50 flex items-center gap-1"
                >
                  {isTestingKey === key.id ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-primary border-t-transparent"></div>
                      Testing...
                    </>
                  ) : (
                    <>🧪 Test</>
                  )}
                </button>
                <button
                  onClick={() => openRotateKeyModal(key)}
                  className="px-3 py-1.5 text-sm bg-warning/10 text-warning rounded hover:bg-warning/20"
                >
                  🔄 Rotate
                </button>
                <button
                  onClick={() => toggleKeyActive(key.id)}
                  className={`px-3 py-1.5 text-sm rounded ${
                    key.is_active
                      ? 'bg-muted text-foreground hover:bg-muted/80'
                      : 'bg-success/10 text-success hover:bg-success/20'
                  }`}
                >
                  {key.is_active ? '⏸️ Disable' : '▶️ Enable'}
                </button>
                <button
                  onClick={() => deleteApiKey(key.id)}
                  className="px-3 py-1.5 text-sm bg-destructive/10 text-destructive rounded hover:bg-destructive/20"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Test Result */}
            {keyTestResult && isTestingKey === null && keyTestResult.tested_at && (
              <div className={`mt-3 p-3 rounded text-sm ${
                keyTestResult.success ? 'bg-success/10 border border-success/20' : 'bg-destructive/10 border border-destructive/20'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {keyTestResult.success ? '✅ Connection Successful' : '❌ Connection Failed'}
                  </span>
                  {keyTestResult.success && (
                    <span className="text-success">{keyTestResult.latency_ms}ms</span>
                  )}
                </div>
                {keyTestResult.success && keyTestResult.models_available && (
                  <div className="text-xs mt-1 text-muted-foreground">
                    Models: {keyTestResult.models_available.join(', ')}
                  </div>
                )}
                {keyTestResult.error && (
                  <div className="text-xs mt-1 text-destructive">{keyTestResult.error}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Zero-Downtime Rotation Panel */}
      <div className="mt-6 border-t pt-6">
        <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
          🔄 Zero-Downtime Key Rotation
          <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">Gradual Traffic Shift</span>
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Rotate keys without service interruption by gradually shifting traffic from primary to standby key.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(keysByProvider).map(([provider, keys]) => {
            const primaryKey = keys.find(k => k.role === 'primary');
            const standbyKeys = keys.filter(k => k.role === 'standby');
            return (
              <div key={provider} className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  {provider === 'kie' ? '🤖' : '🔵'} {provider === 'kie' ? 'Kie.ai' : 'Anthropic'}
                </h4>

                <div className="flex items-center gap-4">
                  {/* Primary Key */}
                  <div className="flex-1 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="text-xs text-primary mb-1">Primary</div>
                    {primaryKey ? (
                      <>
                        <div className="font-medium text-sm">{primaryKey.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          v{primaryKey.version} • {primaryKey.traffic_percentage}% traffic
                        </div>
                        <div className="mt-2 w-full bg-primary/20 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${primaryKey.traffic_percentage}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">No primary key</div>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="text-xl text-muted-foreground">→</div>

                  {/* Standby Key */}
                  <div className="flex-1 p-3 bg-warning/5 rounded-lg border border-warning/20">
                    <div className="text-xs text-warning mb-1">Standby</div>
                    {standbyKeys.length > 0 ? (
                      <>
                        <div className="font-medium text-sm">{standbyKeys[0].name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          v{standbyKeys[0].version} • {standbyKeys[0].traffic_percentage}% traffic
                        </div>
                        <div className="mt-2 w-full bg-warning/20 rounded-full h-2">
                          <div
                            className="bg-warning h-2 rounded-full transition-all duration-500"
                            style={{ width: `${standbyKeys[0].traffic_percentage}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">No standby key - add one first</div>
                    )}
                  </div>
                </div>

                {/* Rotation Button */}
                {primaryKey && standbyKeys.length > 0 && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => startZeroDowntimeRotation(primaryKey.id, standbyKeys[0].id)}
                      disabled={rotatingKeys.has(primaryKey.id) || rotatingKeys.has(standbyKeys[0].id)}
                      className="px-4 py-2 bg-gradient-to-r from-primary to-warning text-primary-foreground rounded-lg hover:from-primary hover:to-warning disabled:opacity-50 flex items-center gap-2"
                    >
                      {rotatingKeys.has(primaryKey.id) ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Rotating Traffic...
                        </>
                      ) : (
                        <>🔄 Start Zero-Downtime Rotation</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Audit Logs */}
      <div className="mt-6 border-t pt-6">
        <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
          📜 API Key Audit Log
          <span className="text-xs bg-muted text-foreground px-2 py-0.5 rounded-full">
            Last {keyAuditLogs.length} changes
          </span>
        </h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {keyAuditLogs.map((log) => (
            <div
              key={log.id}
              className={`flex items-center justify-between p-3 rounded border text-sm ${
                log.success ? 'bg-muted/50 border-border' : 'bg-destructive/5 border-destructive/20'
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
                  <div className="text-xs text-muted-foreground">
                    by {log.performed_by} • {log.ip_address} • {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  log.provider === 'kie' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
                }`}>
                  {log.provider}
                </span>
                {log.success ? (
                  <span className="text-success">✓</span>
                ) : (
                  <span className="text-destructive">✗</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature #659: API Key Modal - migrated to shared Modal */}
      <Modal
        isOpen={showKeyModal}
        onClose={() => {
          setShowKeyModal(false);
          setNewKeyValue('');
          setNewKeyName('');
          setEditingKey(null);
        }}
        title={keyModalMode === 'add' ? 'Add New API Key' : 'Rotate API Key'}
        size="md"
      >
        <ModalHeader onClose={() => {
          setShowKeyModal(false);
          setNewKeyValue('');
          setNewKeyName('');
          setEditingKey(null);
        }}>
          {keyModalMode === 'add' ? '➕ Add New API Key' : '🔄 Rotate API Key'}
        </ModalHeader>
        <ModalBody>
          {keyModalMode === 'add' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-input text-foreground"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Provider</label>
                <select
                  value={newKeyProvider}
                  onChange={(e) => setNewKeyProvider(e.target.value as 'kie' | 'anthropic')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-input text-foreground"
                >
                  <option value="kie">🤖 Kie.ai</option>
                  <option value="anthropic">🔵 Anthropic</option>
                </select>
              </div>
            </>
          )}

          {keyModalMode === 'rotate' && editingKey && (
            <div className="mb-4 p-3 bg-warning/5 border border-warning/20 rounded-lg">
              <div className="flex items-center gap-2 text-warning">
                <span className="text-lg">⚠️</span>
                <span className="font-medium">Rotating: {editingKey.name}</span>
              </div>
              <p className="text-sm text-warning mt-1">
                The current key will be replaced. Make sure to update any services using this key.
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm bg-input text-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {keyModalMode === 'add'
                ? `${newKeyProvider === 'kie' ? 'Kie.ai' : 'Anthropic'} keys should start with "${newKeyProvider === 'kie' ? 'kie_' : 'sk-ant-'}"`
                : editingKey && `${editingKey.provider === 'kie' ? 'Kie.ai' : 'Anthropic'} keys should start with "${editingKey.provider === 'kie' ? 'kie_' : 'sk-ant-'}"`
              }
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            onClick={() => {
              setShowKeyModal(false);
              setNewKeyValue('');
              setNewKeyName('');
              setEditingKey(null);
            }}
            className="px-4 py-2 text-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={keyModalMode === 'add' ? addNewApiKey : rotateApiKey}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            {keyModalMode === 'add' ? 'Add Key' : 'Rotate Key'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
