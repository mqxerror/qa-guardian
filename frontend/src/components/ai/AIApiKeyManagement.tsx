// AIApiKeyManagement - Extracted from AIRouterPage.tsx for Feature #328
// API Key management with encryption, rotation, and testing

import { useState } from 'react';
import type {
  APIKeyConfig,
  APIKeyAuditLog,
  KeyTestResult,
  AIProviderType
} from './ai-types';

interface AIApiKeyManagementProps {
  apiKeys: APIKeyConfig[];
  keyAuditLogs: APIKeyAuditLog[];
  onAddKey: (key: { provider: AIProviderType; name: string; value: string }) => Promise<void>;
  onRotateKey: (keyId: string, newValue: string) => Promise<void>;
  onToggleKey: (keyId: string) => void;
  onDeleteKey: (keyId: string) => void;
  onTestKey: (keyId: string) => Promise<KeyTestResult>;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function maskApiKey(key: APIKeyConfig): string {
  return `${key.key_prefix}${'*'.repeat(16)}${key.key_suffix}`;
}

export function AIApiKeyManagement({
  apiKeys,
  keyAuditLogs,
  onAddKey,
  onRotateKey,
  onToggleKey,
  onDeleteKey,
  onTestKey
}: AIApiKeyManagementProps) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalMode, setKeyModalMode] = useState<'add' | 'edit' | 'rotate'>('add');
  const [editingKey, setEditingKey] = useState<APIKeyConfig | null>(null);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState<AIProviderType>('kie');
  const [isTestingKey, setIsTestingKey] = useState<string | null>(null);
  const [keyTestResult, setKeyTestResult] = useState<KeyTestResult | null>(null);
  const [showKeyValue, setShowKeyValue] = useState<Record<string, boolean>>({});
  const [rotatingKeys, setRotatingKeys] = useState<Set<string>>(new Set());

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

  const handleTestKey = async (keyId: string) => {
    setIsTestingKey(keyId);
    try {
      const result = await onTestKey(keyId);
      setKeyTestResult(result);
    } finally {
      setIsTestingKey(null);
    }
  };

  const handleAddKey = async () => {
    await onAddKey({
      provider: newKeyProvider,
      name: newKeyName,
      value: newKeyValue
    });
    setShowKeyModal(false);
  };

  const handleRotateKey = async () => {
    if (!editingKey) return;
    setRotatingKeys(prev => new Set(prev).add(editingKey.id));
    try {
      await onRotateKey(editingKey.id, newKeyValue);
      setShowKeyModal(false);
    } finally {
      setRotatingKeys(prev => {
        const next = new Set(prev);
        next.delete(editingKey.id);
        return next;
      });
    }
  };

  return (
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
                  onClick={() => handleTestKey(key.id)}
                  disabled={isTestingKey === key.id}
                  className="px-3 py-1.5 text-sm border border-blue-300 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1"
                >
                  {isTestingKey === key.id ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent"></div>
                      Testing...
                    </>
                  ) : (
                    <>🧪 Test</>
                  )}
                </button>
                <button
                  onClick={() => openRotateKeyModal(key)}
                  className="px-3 py-1.5 text-sm border border-amber-300 text-amber-600 rounded hover:bg-amber-50 flex items-center gap-1"
                >
                  🔄 Rotate
                </button>
                <button
                  onClick={() => onToggleKey(key.id)}
                  className={`px-3 py-1.5 text-sm border rounded flex items-center gap-1 ${
                    key.is_active
                      ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      : 'border-green-300 text-green-600 hover:bg-green-50'
                  }`}
                >
                  {key.is_active ? '⏸️ Disable' : '▶️ Enable'}
                </button>
                <button
                  onClick={() => onDeleteKey(key.id)}
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

      {/* Audit Logs */}
      {keyAuditLogs.length > 0 && (
        <div className="mt-6 border-t pt-6">
          <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
            📋 API Key Audit Log
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {keyAuditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                <span className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                <span className="font-medium">{log.action}</span>
                <span className="text-gray-500">{log.key_name}</span>
                <span className="text-gray-400">by {log.performed_by}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Rotate Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">
              {keyModalMode === 'add' ? '➕ Add API Key' : '🔄 Rotate API Key'}
            </h3>

            {keyModalMode === 'add' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                  <select
                    value={newKeyProvider}
                    onChange={(e) => setNewKeyProvider(e.target.value as AIProviderType)}
                    className="w-full border rounded-lg p-2"
                  >
                    <option value="kie">Kie.ai</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production Key, Backup Key"
                    className="w-full border rounded-lg p-2"
                  />
                </div>
              </>
            )}

            {keyModalMode === 'rotate' && editingKey && (
              <div className="mb-4 p-3 bg-amber-50 rounded-lg">
                <div className="text-sm">
                  <strong>Rotating:</strong> {editingKey.name} ({editingKey.provider})
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Current version: v{editingKey.version}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {keyModalMode === 'add' ? 'API Key' : 'New API Key'}
              </label>
              <input
                type="password"
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder="sk-..."
                className="w-full border rounded-lg p-2 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={keyModalMode === 'add' ? handleAddKey : handleRotateKey}
                disabled={!newKeyValue || (keyModalMode === 'add' && !newKeyName)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
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

export default AIApiKeyManagement;
