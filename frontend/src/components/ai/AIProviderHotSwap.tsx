// AIProviderHotSwap - Extracted from AIRouterPage.tsx for Feature #328
// Hot-swap provider section with provider cards and switch modal

import { useState } from 'react';
import type {
  ActiveProviderState,
  ProviderSwitchResult,
  AIProviderType
} from './ai-types';

interface AIProviderHotSwapProps {
  activeProvider: ActiveProviderState | null;
  isSwitching: boolean;
  onSwitchProvider: (target: AIProviderType, reason: string, graceful: boolean) => Promise<void>;
}

export function AIProviderHotSwap({
  activeProvider,
  isSwitching,
  onSwitchProvider
}: AIProviderHotSwapProps) {
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchReason, setSwitchReason] = useState('');
  const [gracefulSwitch, setGracefulSwitch] = useState(true);
  const [targetProvider, setTargetProvider] = useState<AIProviderType>('anthropic');
  const [switchResult, setSwitchResult] = useState<ProviderSwitchResult | null>(null);

  const openSwitchModal = (target: AIProviderType) => {
    setTargetProvider(target);
    setSwitchResult(null);
    setSwitchReason('');
    setShowSwitchModal(true);
  };

  const handleSwitch = async () => {
    try {
      await onSwitchProvider(targetProvider, switchReason, gracefulSwitch);
      setSwitchResult({
        success: true,
        message: `Successfully switched to ${targetProvider}`,
        previous_provider: activeProvider?.current_provider,
        new_provider: targetProvider
      });
    } catch (error) {
      setSwitchResult({
        success: false,
        error: error instanceof Error ? error.message : 'Switch failed'
      });
    }
  };

  return (
    <>
      <div className="mb-6 bg-card rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>⚡</span> Hot-Swap Provider
              <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded">No Restart Required</span>
            </h2>
            <p className="text-sm text-foreground">Switch between AI providers instantly without service interruption</p>
          </div>
          {activeProvider?.switching && (
            <div className="flex items-center gap-2 text-warning animate-pulse">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-warning border-t-transparent"></div>
              <span>Switching...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Kie.ai Provider Card */}
          <ProviderCard
            provider="kie"
            name="Kie.ai"
            icon="🤖"
            tagline="💰 70% cost savings"
            tagColor="green"
            isActive={activeProvider?.current_provider === 'kie'}
            isConfigured={activeProvider?.available_providers?.find(p => p.id === 'kie')?.configured ?? false}
            isEnabled={activeProvider?.available_providers?.find(p => p.id === 'kie')?.enabled ?? false}
            isSwitching={isSwitching || activeProvider?.switching}
            onSwitch={() => openSwitchModal('kie')}
            features={[
              'Intelligent API proxy',
              'Lower latency routing',
              'Built-in caching'
            ]}
          />

          {/* Anthropic Direct Card */}
          <ProviderCard
            provider="anthropic"
            name="Anthropic Direct"
            icon="🔵"
            tagline="🔗 Direct API access"
            tagColor="blue"
            isActive={activeProvider?.current_provider === 'anthropic'}
            isConfigured={activeProvider?.available_providers?.find(p => p.id === 'anthropic')?.configured ?? false}
            isEnabled={activeProvider?.available_providers?.find(p => p.id === 'anthropic')?.enabled ?? false}
            isSwitching={isSwitching || activeProvider?.switching}
            onSwitch={() => openSwitchModal('anthropic')}
            features={[
              'Full API features',
              'Higher rate limits',
              'Latest models'
            ]}
          />
        </div>

        {/* Last Switch Info */}
        {activeProvider?.last_switch && (
          <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <span>📝</span>
              <span>Last switch: {activeProvider.last_switch.from} → {activeProvider.last_switch.to}</span>
              <span className="text-muted-foreground">|</span>
              <span>By: {activeProvider.last_switch.switched_by}</span>
              <span className="text-muted-foreground">|</span>
              <span>{new Date(activeProvider.last_switch.switched_at).toLocaleString()}</span>
            </div>
            {activeProvider.last_switch.reason && (
              <div className="text-muted-foreground mt-1">Reason: {activeProvider.last_switch.reason}</div>
            )}
          </div>
        )}
      </div>

      {/* Provider Switch Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span>⚡</span> Switch Provider
            </h3>

            <div className="mb-4 p-3 bg-primary/5 rounded-lg">
              <div className="text-sm text-primary">
                <strong>Current:</strong> {activeProvider?.current_provider === 'kie' ? 'Kie.ai' : 'Anthropic Direct'}
              </div>
              <div className="text-sm text-primary">
                <strong>Target:</strong> {targetProvider === 'kie' ? 'Kie.ai' : 'Anthropic Direct'}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">Reason for switch</label>
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
                  <div className="text-xs text-muted-foreground">Wait for pending requests to complete (recommended)</div>
                </div>
              </label>
            </div>

            {switchResult && (
              <div className={`mb-4 p-3 rounded-lg ${
                switchResult.success ? 'bg-success/5 border border-success/20' : 'bg-destructive/5 border border-destructive/20'
              }`}>
                <div className="font-medium text-sm">
                  {switchResult.success ? '✅ Switch successful!' : '❌ Switch failed'}
                </div>
                <div className="text-xs mt-1">{switchResult.message || switchResult.error}</div>
                {switchResult.success && switchResult.switch_duration_ms && (
                  <div className="text-xs text-foreground mt-1">
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
                className="px-4 py-2 text-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSwitch}
                disabled={isSwitching}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {isSwitching && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>}
                {isSwitching ? 'Switching...' : 'Switch Provider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Provider Card sub-component
interface ProviderCardProps {
  provider: AIProviderType;
  name: string;
  icon: string;
  tagline: string;
  tagColor: 'green' | 'blue';
  isActive: boolean;
  isConfigured: boolean;
  isEnabled: boolean;
  isSwitching?: boolean;
  onSwitch: () => void;
  features: string[];
}

function ProviderCard({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  provider: _provider, // Used for identification but not rendered directly
  name,
  icon,
  tagline,
  tagColor,
  isActive,
  isConfigured,
  isEnabled,
  isSwitching,
  onSwitch,
  features
}: ProviderCardProps) {
  return (
    <div className={`border-2 rounded-lg p-4 transition-all ${
      isActive
        ? 'border-success bg-success/5'
        : 'border-border hover:border-primary/30'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-3xl">{icon}</span>
            <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
              isConfigured ? 'bg-success' : 'bg-warning'
            }`} title={isConfigured ? 'Connected' : 'Not Configured'}></span>
          </div>
          <div>
            <div className="font-semibold text-lg">{name}</div>
            <div className={`text-sm font-medium ${tagColor === 'green' ? 'text-success' : 'text-primary'}`}>{tagline}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isActive ? (
            <span className="px-3 py-1 bg-success text-success-foreground text-xs rounded-full font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-card rounded-full animate-pulse"></span>
              ACTIVE
            </span>
          ) : (
            <button
              onClick={onSwitch}
              disabled={isSwitching}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Switch to {name}
            </button>
          )}
          <span className={`text-xs px-2 py-0.5 rounded ${
            isEnabled
              ? 'bg-success/10 text-success'
              : 'bg-muted text-muted-foreground'
          }`}>
            {isEnabled ? '✓ Enabled' : '○ Disabled'}
          </span>
        </div>
      </div>
      <div className="text-sm text-foreground space-y-1 border-t pt-3">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className={tagColor === 'green' ? 'text-success' : 'text-primary'}>✓</span> {feature}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AIProviderHotSwap;
