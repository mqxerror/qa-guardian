/**
 * AlertRoutingModal - Extracted from MonitoringPage.tsx for Feature #47
 * Feature #127: Mobile responsive design audit and fixes
 * Handles creation and editing of alert routing rules with multiple destination types
 */

import { useState } from 'react';
import { toast } from '../../../../stores/toastStore';
import { AlertRoutingCondition, AlertRoutingDestination, AlertRoutingRule } from '../../types';

export interface AlertRoutingModalProps {
 isOpen: boolean;
 onClose: () => void;
 token: string;
 editingRule: AlertRoutingRule | null;
 onSuccess: () => void;
}

export function AlertRoutingModal({
 isOpen,
 onClose,
 token,
 editingRule,
 onSuccess,
}: AlertRoutingModalProps) {
 // Form state
 const [name, setName] = useState(editingRule?.name || '');
 const [description, setDescription] = useState(editingRule?.description || '');
 const [conditionMatch, setConditionMatch] = useState<'all' | 'any'>(editingRule?.condition_match || 'all');
 const [conditions, setConditions] = useState<AlertRoutingCondition[]>(
 editingRule?.conditions || [{ field: 'severity', operator: 'equals', value: 'critical' }]
 );
 const [destinations, setDestinations] = useState<AlertRoutingDestination[]>(
 editingRule?.destinations || [{ type: 'pagerduty', name: 'PagerDuty', config: {} }]
 );
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [testingDestinationIndex, setTestingDestinationIndex] = useState<number | null>(null);

 if (!isOpen) return null;

 const resetForm = () => {
 setName('');
 setDescription('');
 setConditionMatch('all');
 setConditions([{ field: 'severity', operator: 'equals', value: 'critical' }]);
 setDestinations([{ type: 'pagerduty', name: 'PagerDuty', config: {} }]);
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!token || !name.trim() || conditions.length === 0 || destinations.length === 0) return;

 setIsSubmitting(true);
 try {
 const payload = {
 name: name.trim(),
 description: description.trim() || undefined,
 condition_match: conditionMatch,
 conditions,
 destinations,
 };

 const url = editingRule
 ? `/api/v1/monitoring/alert-routing/rules/${editingRule.id}`
 : '/api/v1/monitoring/alert-routing/rules';

 const response = await fetch(url, {
 method: editingRule ? 'PATCH' : 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify(payload),
 });

 if (response.ok) {
 toast.success(editingRule ? 'Alert routing rule updated' : 'Alert routing rule created');
 resetForm();
 onClose();
 onSuccess();
 } else {
 const data = await response.json();
 toast.error(data.error || 'Failed to save alert routing rule');
 }
 } catch (error) {
 console.error('Failed to save alert routing rule:', error);
 toast.error('Failed to save alert routing rule');
 } finally {
 setIsSubmitting(false);
 }
 };

 const addCondition = () => {
 setConditions([...conditions, { field: 'severity', operator: 'equals', value: 'high' }]);
 };

 const removeCondition = (index: number) => {
 setConditions(conditions.filter((_, i) => i !== index));
 };

 const updateCondition = (index: number, updates: Partial<AlertRoutingCondition>) => {
 setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
 };

 const addDestination = () => {
 setDestinations([...destinations, { type: 'slack', name: 'Slack', config: {} }]);
 };

 const removeDestination = (index: number) => {
 setDestinations(destinations.filter((_, i) => i !== index));
 };

 const updateDestination = (index: number, updates: Partial<AlertRoutingDestination>) => {
 setDestinations(destinations.map((d, i) => i === index ? { ...d, ...updates } : d));
 };

 const testDestination = async (dest: AlertRoutingDestination, index: number) => {
 if (!token) {
 toast.error('Not authenticated');
 return;
 }

 // Validate required fields based on destination type
 const validationErrors: Record<string, string> = {
 pagerduty: !dest.config.integration_key ? 'PagerDuty integration key is required' : '',
 opsgenie: !dest.config.api_key ? 'OpsGenie API key is required' : '',
 slack: !dest.config.webhook_url ? 'Slack webhook URL is required' : '',
 webhook: !dest.config.url ? 'Webhook URL is required' : '',
 n8n: !dest.config.n8n_webhook_url ? 'n8n webhook URL is required' : '',
 telegram: (!dest.config.telegram_bot_token || !dest.config.telegram_chat_id) ? 'Telegram bot token and chat ID are required' : '',
 teams: !dest.config.teams_webhook_url ? 'Teams webhook URL is required' : '',
 discord: !dest.config.discord_webhook_url ? 'Discord webhook URL is required' : '',
 };

 const error = validationErrors[dest.type];
 if (error) {
 toast.error(error);
 return;
 }

 setTestingDestinationIndex(index);
 try {
 const response = await fetch('/api/v1/monitoring/alert-routing/test-destination', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({
 destination: dest,
 test_alert: {
 check_name: 'Test Check',
 check_type: 'uptime',
 severity: 'medium',
 error_message: 'This is a test alert from QA Guardian',
 location: 'us-east',
 timestamp: new Date().toISOString(),
 },
 }),
 });

 if (response.ok) {
 toast.success(`Test alert sent to ${dest.name}`);
 } else {
 const data = await response.json();
 toast.error(data.error || `Failed to test ${dest.type} destination`);
 }
 } catch (error) {
 console.error('Failed to test destination:', error);
 toast.error(`Failed to test ${dest.type} destination`);
 } finally {
 setTestingDestinationIndex(null);
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
 <div
 role="dialog"
 aria-modal="true"
 aria-labelledby="alert-routing-modal-title"
 className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4 sm:p-6 shadow-xl"
 >
 <h2 id="alert-routing-modal-title" className="text-lg font-semibold text-foreground mb-4">
 {editingRule ? 'Edit Alert Routing Rule' : 'Create Alert Routing Rule'}
 </h2>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Rule Name *</label>
 <input
 type="text"
 value={name}
 onChange={e => setName(e.target.value)}
 placeholder="Route critical alerts to PagerDuty"
 required
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Description</label>
 <textarea
 value={description}
 onChange={e => setDescription(e.target.value)}
 placeholder="Description of this routing rule..."
 rows={2}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
 />
 </div>

 {/* Conditions Section */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <label className="text-sm font-medium text-foreground">Conditions *</label>
 <div className="flex items-center gap-2">
 <select
 value={conditionMatch}
 onChange={e => setConditionMatch(e.target.value as 'all' | 'any')}
 className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
 >
 <option value="all">Match ALL conditions</option>
 <option value="any">Match ANY condition</option>
 </select>
 <button
 type="button"
 onClick={addCondition}
 className="text-xs text-primary hover:underline"
 >
 + Add Condition
 </button>
 </div>
 </div>
 <div className="space-y-2">
 {conditions.map((cond, index) => (
 <div key={index} className="flex items-center gap-2 p-2 rounded bg-muted/50">
 <select
 value={cond.field}
 onChange={e => updateCondition(index, { field: e.target.value as AlertRoutingCondition['field'] })}
 className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 >
 <option value="severity">Severity</option>
 <option value="check_type">Check Type</option>
 <option value="check_name">Check Name</option>
 <option value="location">Location</option>
 <option value="tag">Tag</option>
 <option value="error_contains">Error Contains</option>
 </select>
 <select
 value={cond.operator}
 onChange={e => updateCondition(index, { operator: e.target.value as AlertRoutingCondition['operator'] })}
 className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 >
 <option value="equals">equals</option>
 <option value="not_equals">not equals</option>
 <option value="contains">contains</option>
 <option value="in">in</option>
 <option value="not_in">not in</option>
 </select>
 {cond.field === 'severity' ? (
 <select
 value={cond.value as string}
 onChange={e => updateCondition(index, { value: e.target.value })}
 className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 >
 <option value="critical">critical</option>
 <option value="high">high</option>
 <option value="medium">medium</option>
 <option value="low">low</option>
 <option value="info">info</option>
 </select>
 ) : cond.field === 'check_type' ? (
 <select
 value={cond.value as string}
 onChange={e => updateCondition(index, { value: e.target.value })}
 className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 >
 <option value="uptime">uptime</option>
 <option value="transaction">transaction</option>
 <option value="performance">performance</option>
 <option value="webhook">webhook</option>
 <option value="dns">dns</option>
 <option value="tcp">tcp</option>
 </select>
 ) : (
 <input
 type="text"
 value={cond.value as string}
 onChange={e => updateCondition(index, { value: e.target.value })}
 placeholder="Value"
 className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 )}
 {conditions.length > 1 && (
 <button
 type="button"
 onClick={() => removeCondition(index)}
 className="text-destructive hover:text-destructive"
 >
 ✕
 </button>
 )}
 </div>
 ))}
 </div>
 </div>

 {/* Destinations Section */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <label className="text-sm font-medium text-foreground">Destinations *</label>
 <button
 type="button"
 onClick={addDestination}
 className="text-xs text-primary hover:underline"
 >
 + Add Destination
 </button>
 </div>
 <div className="space-y-3">
 {destinations.map((dest, index) => (
 <DestinationConfig
 key={index}
 dest={dest}
 index={index}
 totalDestinations={destinations.length}
 testingIndex={testingDestinationIndex}
 onUpdate={updateDestination}
 onRemove={removeDestination}
 onTest={testDestination}
 />
 ))}
 </div>
 </div>

 <div className="flex gap-3 pt-4">
 <button
 type="button"
 onClick={() => {
 resetForm();
 onClose();
 }}
 className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={isSubmitting || !name.trim() || conditions.length === 0 || destinations.length === 0}
 className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isSubmitting ? 'Saving...' : editingRule ? 'Update' : 'Create'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}

// Destination Configuration Sub-component
interface DestinationConfigProps {
 dest: AlertRoutingDestination;
 index: number;
 totalDestinations: number;
 testingIndex: number | null;
 onUpdate: (index: number, updates: Partial<AlertRoutingDestination>) => void;
 onRemove: (index: number) => void;
 onTest: (dest: AlertRoutingDestination, index: number) => void;
}

function DestinationConfig({
 dest,
 index,
 totalDestinations,
 testingIndex,
 onUpdate,
 onRemove,
 onTest,
}: DestinationConfigProps) {
 return (
 <div className="p-3 rounded-md border border-border bg-muted/30">
 <div className="flex items-center gap-2 mb-2">
 <select
 value={dest.type}
 onChange={e => onUpdate(index, { type: e.target.value as AlertRoutingDestination['type'], config: {} })}
 className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 >
 <option value="pagerduty">PagerDuty</option>
 <option value="slack">Slack</option>
 <option value="teams">Microsoft Teams</option>
 <option value="discord">Discord</option>
 <option value="email">Email</option>
 <option value="webhook">Webhook</option>
 <option value="opsgenie">OpsGenie</option>
 <option value="on_call">On-Call Schedule</option>
 <option value="n8n">n8n Workflow</option>
 <option value="telegram">Telegram</option>
 </select>
 <input
 type="text"
 value={dest.name}
 onChange={e => onUpdate(index, { name: e.target.value })}
 placeholder="Destination name"
 className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 {totalDestinations > 1 && (
 <button
 type="button"
 onClick={() => onRemove(index)}
 className="text-destructive hover:text-destructive"
 >
 ✕
 </button>
 )}
 </div>

 {/* Type-specific configuration */}
 {dest.type === 'pagerduty' && (
 <PagerDutyConfig dest={dest} index={index} onUpdate={onUpdate} />
 )}
 {dest.type === 'slack' && (
 <SlackConfig dest={dest} index={index} onUpdate={onUpdate} />
 )}
 {dest.type === 'email' && (
 <EmailConfig dest={dest} index={index} onUpdate={onUpdate} />
 )}
 {dest.type === 'webhook' && (
 <WebhookConfig dest={dest} index={index} onUpdate={onUpdate} />
 )}
 {dest.type === 'opsgenie' && (
 <OpsGenieConfig dest={dest} index={index} onUpdate={onUpdate} />
 )}
 {dest.type === 'on_call' && (
 <OnCallConfig dest={dest} index={index} onUpdate={onUpdate} />
 )}
 {dest.type === 'n8n' && (
 <N8nConfig dest={dest} index={index} onUpdate={onUpdate} />
 )}
 {dest.type === 'telegram' && (
 <TelegramConfig dest={dest} index={index} onUpdate={onUpdate} />
 )}
 {dest.type === 'teams' && (
 <TeamsConfig dest={dest} index={index} onUpdate={onUpdate} />
 )}
 {dest.type === 'discord' && (
 <DiscordConfig dest={dest} index={index} onUpdate={onUpdate} />
 )}

 {/* Test Destination Button */}
 {['pagerduty', 'opsgenie', 'slack', 'webhook', 'n8n', 'telegram', 'teams', 'discord'].includes(dest.type) && (
 <div className="pt-2 mt-2 border-t border-border/50">
 <button
 type="button"
 onClick={() => onTest(dest, index)}
 disabled={testingIndex === index}
 className="w-full rounded-md bg-warning/20 border border-warning/50 px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning/30 disabled:opacity-50"
 >
 {testingIndex === index ? '🔄 Testing...' : '🧪 Send Test Alert'}
 </button>
 </div>
 )}
 </div>
 );
}

// Config sub-components for each destination type
interface ConfigProps {
 dest: AlertRoutingDestination;
 index: number;
 onUpdate: (index: number, updates: Partial<AlertRoutingDestination>) => void;
}

function PagerDutyConfig({ dest, index, onUpdate }: ConfigProps) {
 return (
 <div className="space-y-2 pt-2 border-t border-border/50">
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Integration Key (Routing Key) *
 </label>
 <input
 type="text"
 value={dest.config.integration_key || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, integration_key: e.target.value }
 })}
 placeholder="e.g., R034M12345ABCDEF..."
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
 />
 <p className="text-xs text-muted-foreground mt-1">
 Find this in PagerDuty: Services → Your Service → Integrations → Events API v2
 </p>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Severity Mapping
 </label>
 <div className="grid grid-cols-2 gap-2 text-xs">
 {(['critical', 'high', 'medium', 'low'] as const).map(severity => (
 <div key={severity} className="flex items-center gap-2">
 <span className={`w-16 font-medium ${
 severity === 'critical' ? 'text-red-500' :
 severity === 'high' ? 'text-orange-500' :
 severity === 'medium' ? 'text-warning' : 'text-primary'
 }`}>{severity}:</span>
 <select
 value={dest.config.severity_mapping?.[severity] || (
 severity === 'critical' ? 'critical' :
 severity === 'high' ? 'error' :
 severity === 'medium' ? 'warning' : 'info'
 )}
 onChange={e => onUpdate(index, {
 config: {
 ...dest.config,
 severity_mapping: {
 ...dest.config.severity_mapping,
 [severity]: e.target.value
 }
 }
 })}
 className="flex-1 rounded border border-input bg-background px-1 py-0.5 text-xs"
 >
 <option value="critical">Critical</option>
 <option value="error">Error</option>
 <option value="warning">Warning</option>
 <option value="info">Info</option>
 </select>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
}

function SlackConfig({ dest, index, onUpdate }: ConfigProps) {
 return (
 <div className="space-y-2 pt-2 border-t border-border/50">
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Webhook URL *
 </label>
 <input
 type="url"
 value={dest.config.webhook_url || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, webhook_url: e.target.value }
 })}
 placeholder="https://hooks.slack.com/services/..."
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Channel (optional)
 </label>
 <input
 type="text"
 value={dest.config.channel || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, channel: e.target.value }
 })}
 placeholder="#alerts"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 </div>
 );
}

function EmailConfig({ dest, index, onUpdate }: ConfigProps) {
 return (
 <div className="pt-2 border-t border-border/50">
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Email Addresses *
 </label>
 <input
 type="text"
 value={dest.config.addresses?.join(', ') || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, addresses: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
 })}
 placeholder="alert@example.com, oncall@example.com"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 );
}

function WebhookConfig({ dest, index, onUpdate }: ConfigProps) {
 return (
 <div className="pt-2 border-t border-border/50">
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Webhook URL *
 </label>
 <input
 type="url"
 value={dest.config.url || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, url: e.target.value }
 })}
 placeholder="https://your-endpoint.com/webhook"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 );
}

function OpsGenieConfig({ dest, index, onUpdate }: ConfigProps) {
 return (
 <div className="pt-2 border-t border-border/50">
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 API Key *
 </label>
 <input
 type="text"
 value={dest.config.api_key || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, api_key: e.target.value }
 })}
 placeholder="OpsGenie API Key"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
 />
 </div>
 );
}

function OnCallConfig({ dest, index, onUpdate }: ConfigProps) {
 return (
 <div className="pt-2 border-t border-border/50">
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Schedule ID *
 </label>
 <input
 type="text"
 value={dest.config.schedule_id || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, schedule_id: e.target.value }
 })}
 placeholder="on-call-schedule-id"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 );
}

function N8nConfig({ dest, index, onUpdate }: ConfigProps) {
 return (
 <div className="space-y-2 pt-2 border-t border-border/50">
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 n8n Webhook URL *
 </label>
 <input
 type="url"
 value={dest.config.n8n_webhook_url || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, n8n_webhook_url: e.target.value }
 })}
 placeholder="https://n8n.example.com/webhook/..."
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Workflow ID (optional)
 </label>
 <input
 type="text"
 value={dest.config.workflow_id || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, workflow_id: e.target.value }
 })}
 placeholder="workflow-123"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 </div>
 );
}

function TelegramConfig({ dest, index, onUpdate }: ConfigProps) {
 return (
 <div className="space-y-2 pt-2 border-t border-border/50">
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Bot Token *
 </label>
 <input
 type="text"
 value={dest.config.telegram_bot_token || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, telegram_bot_token: e.target.value }
 })}
 placeholder="123456789:ABCDefGHIJKlmNOPQrsTUVwxyz"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Chat ID *
 </label>
 <input
 type="text"
 value={dest.config.telegram_chat_id || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, telegram_chat_id: e.target.value }
 })}
 placeholder="-1001234567890"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 </div>
 );
}

function TeamsConfig({ dest, index, onUpdate }: ConfigProps) {
 return (
 <div className="space-y-2 pt-2 border-t border-border/50">
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Teams Webhook URL *
 </label>
 <input
 type="url"
 value={dest.config.teams_webhook_url || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, teams_webhook_url: e.target.value }
 })}
 placeholder="https://outlook.office.com/webhook/..."
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 <p className="text-xs text-muted-foreground mt-1">
 Create an Incoming Webhook connector in your Teams channel
 </p>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Card Title (optional)
 </label>
 <input
 type="text"
 value={dest.config.teams_title || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, teams_title: e.target.value }
 })}
 placeholder="QA Guardian Alert"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Theme Color (optional)
 </label>
 <div className="flex gap-2 items-center">
 <input
 type="color"
 value={dest.config.teams_theme_color || '#FF0000'}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, teams_theme_color: e.target.value }
 })}
 className="w-10 h-8 rounded border border-input cursor-pointer"
 />
 <input
 type="text"
 value={dest.config.teams_theme_color || '#FF0000'}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, teams_theme_color: e.target.value }
 })}
 placeholder="#FF0000"
 className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
 />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Message Template (optional)
 </label>
 <textarea
 value={dest.config.message_template || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, message_template: e.target.value }
 })}
 placeholder="🚨 [{severity}] {check_name}: {error_message}"
 rows={2}
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 <p className="text-xs text-muted-foreground mt-1">
 Variables: {'{severity}'}, {'{check_name}'}, {'{check_type}'}, {'{error_message}'}, {'{timestamp}'}
 </p>
 </div>
 </div>
 );
}

function DiscordConfig({ dest, index, onUpdate }: ConfigProps) {
 return (
 <div className="space-y-3 p-3 rounded-md bg-indigo-500/10 border border-indigo-500/30">
 <p className="text-xs text-indigo-600 mb-2">
 🎮 Discord Webhook - send alerts to Discord channels
 </p>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Discord Webhook URL *
 </label>
 <input
 type="url"
 value={dest.config.discord_webhook_url || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, discord_webhook_url: e.target.value }
 })}
 placeholder="https://discord.com/api/webhooks/..."
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 <p className="text-xs text-muted-foreground mt-1">
 Get this from Discord: Channel Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL
 </p>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Bot Username (optional)
 </label>
 <input
 type="text"
 value={dest.config.discord_username || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, discord_username: e.target.value }
 })}
 placeholder="QA Guardian Bot"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Bot Avatar URL (optional)
 </label>
 <input
 type="url"
 value={dest.config.discord_avatar_url || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, discord_avatar_url: e.target.value }
 })}
 placeholder="https://example.com/avatar.png"
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Embed Color
 </label>
 <div className="flex gap-2 items-center">
 <input
 type="color"
 value={dest.config.discord_embed_color || '#5865F2'}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, discord_embed_color: e.target.value }
 })}
 className="w-10 h-8 rounded border border-input cursor-pointer"
 />
 <input
 type="text"
 value={dest.config.discord_embed_color || '#5865F2'}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, discord_embed_color: e.target.value }
 })}
 placeholder="#5865F2"
 className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
 />
 <div className="flex gap-1">
 {['#ED4245', '#FEE75C', '#57F287', '#5865F2', '#EB459E'].map(color => (
 <button
 key={color}
 type="button"
 onClick={() => onUpdate(index, {
 config: { ...dest.config, discord_embed_color: color }
 })}
 className="w-6 h-6 rounded border border-input"
 style={{ backgroundColor: color }}
 title={color}
 />
 ))}
 </div>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 Auto-colored by severity: 🔴 Critical #ED4245, 🟠 High #FEE75C, 🟢 Medium #57F287, 🔵 Low #5865F2
 </p>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">
 Message Template (optional)
 </label>
 <textarea
 value={dest.config.message_template || ''}
 onChange={e => onUpdate(index, {
 config: { ...dest.config, message_template: e.target.value }
 })}
 placeholder="🚨 [{severity}] {check_name}: {error_message}"
 rows={2}
 className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
 />
 <p className="text-xs text-muted-foreground mt-1">
 Variables: {'{severity}'}, {'{check_name}'}, {'{check_type}'}, {'{error_message}'}, {'{timestamp}'}
 </p>
 </div>
 </div>
 );
}

export default AlertRoutingModal;
