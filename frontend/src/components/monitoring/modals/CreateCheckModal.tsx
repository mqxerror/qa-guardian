/**
 * CreateCheckModal Component
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 * Feature #127: Mobile responsive design audit and fixes
 *
 * Handles creating and editing uptime checks with smart defaults and presets
 */

import { useState, useEffect } from 'react';
import { MonitoringLocation, MonitoringLocationInfo, UptimeAssertion, UptimeCheck } from '../types';
import { toast } from '../../../stores/toastStore';

// Preset configurations for simplified modal
const presets = {
  light: {
    label: 'Light Touch',
    description: '5 min interval, 1 failure threshold',
    icon: '🌿',
    interval: 300, // 5 minutes
    consecutiveFailures: 1,
    timeout: 15000,
  },
  standard: {
    label: 'Standard',
    description: '1 min interval, 2 failures threshold',
    icon: '⚡',
    interval: 60, // 1 minute
    consecutiveFailures: 2,
    timeout: 10000,
  },
  critical: {
    label: 'Critical',
    description: '30s interval, 1 failure threshold',
    icon: '🔥',
    interval: 30, // 30 seconds
    consecutiveFailures: 1,
    timeout: 5000,
  },
};

// Available monitoring locations
const availableLocations: MonitoringLocationInfo[] = [
  { id: 'us-east', name: 'US East', city: 'Virginia', region: 'North America' },
  { id: 'us-west', name: 'US West', city: 'Oregon', region: 'North America' },
  { id: 'europe', name: 'Europe', city: 'Frankfurt', region: 'EU' },
  { id: 'asia-pacific', name: 'Asia Pacific', city: 'Tokyo', region: 'APAC' },
  { id: 'australia', name: 'Australia', city: 'Sydney', region: 'Oceania' },
];

export interface CreateCheckModalProps {
  isOpen: boolean;
  editingCheck: UptimeCheck | null;
  token: string;
  availableGroups: string[];
  onClose: () => void;
  onCheckCreated: (check: UptimeCheck) => void;
  onCheckUpdated: (check: UptimeCheck) => void;
}

// Helper to convert headers object to text
const headersToText = (headers?: Record<string, string>): string => {
  if (!headers) return '';
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
};

// Helper to parse headers text to object
const textToHeaders = (text: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (!text) return headers;
  text.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      headers[key.trim()] = valueParts.join(':').trim();
    }
  });
  return headers;
};

export default function CreateCheckModal({
  isOpen,
  editingCheck,
  token,
  availableGroups,
  onClose,
  onCheckCreated,
  onCheckUpdated,
}: CreateCheckModalProps) {
  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formMethod, setFormMethod] = useState<'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH'>('GET');
  const [formInterval, setFormInterval] = useState(60);
  const [formTimeout, setFormTimeout] = useState(10000);
  const [formExpectedStatus, setFormExpectedStatus] = useState(200);
  const [formHeaders, setFormHeaders] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formLocations, setFormLocations] = useState<MonitoringLocation[]>(['us-east']);
  const [formAssertions, setFormAssertions] = useState<UptimeAssertion[]>([]);
  const [formSslWarningDays, setFormSslWarningDays] = useState(30);
  const [formConsecutiveFailures, setFormConsecutiveFailures] = useState(1);
  const [formTags, setFormTags] = useState('');
  const [formGroup, setFormGroup] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<'light' | 'standard' | 'critical' | null>('standard');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Reset form when modal opens/closes or editingCheck changes
  useEffect(() => {
    if (isOpen) {
      if (editingCheck) {
        // Populate form with existing check data
        setFormName(editingCheck.name);
        setFormUrl(editingCheck.url);
        setFormMethod(editingCheck.method);
        setFormInterval(editingCheck.interval);
        setFormTimeout(editingCheck.timeout);
        setFormExpectedStatus(editingCheck.expected_status);
        setFormHeaders(headersToText(editingCheck.headers));
        setFormBody(editingCheck.body || '');
        setFormLocations(editingCheck.locations || ['us-east']);
        setFormAssertions(editingCheck.assertions || []);
        setFormSslWarningDays(editingCheck.ssl_expiry_warning_days || 30);
        setFormConsecutiveFailures(editingCheck.consecutive_failures_threshold || 1);
        setFormTags(editingCheck.tags?.join(', ') || '');
        setFormGroup(editingCheck.group || '');
        setShowAdvancedOptions(true);
        setSelectedPreset(null);
      } else {
        // Reset to defaults
        resetForm();
      }
    }
  }, [isOpen, editingCheck]);

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormMethod('GET');
    setFormInterval(60);
    setFormTimeout(10000);
    setFormExpectedStatus(200);
    setFormHeaders('');
    setFormBody('');
    setFormLocations(['us-east']);
    setFormAssertions([]);
    setFormSslWarningDays(30);
    setFormConsecutiveFailures(1);
    setFormTags('');
    setFormGroup('');
    setSelectedPreset('standard');
    setShowAdvancedOptions(false);
  };

  // Auto-generate name from URL
  const generateNameFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const pathname = urlObj.pathname !== '/' ? urlObj.pathname : '';
      const baseName = hostname + pathname;
      return baseName.charAt(0).toUpperCase() + baseName.slice(1).replace(/\//g, ' ').trim() || hostname;
    } catch {
      return '';
    }
  };

  // Handle URL change with auto-name suggestion
  const handleUrlChange = (url: string) => {
    setFormUrl(url);
    if (!formName || formName === generateNameFromUrl(formUrl)) {
      setFormName(generateNameFromUrl(url));
    }
    if (url.startsWith('https://')) {
      setFormSslWarningDays(30);
    }
  };

  // Apply preset values to form
  const applyPreset = (presetKey: 'light' | 'standard' | 'critical') => {
    const preset = presets[presetKey];
    setSelectedPreset(presetKey);
    setFormInterval(preset.interval);
    setFormConsecutiveFailures(preset.consecutiveFailures);
    setFormTimeout(preset.timeout);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);

    try {
      const headers = textToHeaders(formHeaders);
      const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);

      const checkData = {
        name: formName,
        url: formUrl,
        method: formMethod,
        interval: formInterval,
        timeout: formTimeout,
        expected_status: formExpectedStatus,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        body: formBody || undefined,
        locations: formLocations,
        assertions: formAssertions.length > 0 ? formAssertions : undefined,
        ssl_expiry_warning_days: formUrl.startsWith('https://') ? formSslWarningDays : undefined,
        consecutive_failures_threshold: formConsecutiveFailures,
        tags: tags.length > 0 ? tags : undefined,
        group: formGroup || undefined,
      };

      const url = editingCheck
        ? `/api/v1/monitoring/uptime/${editingCheck.id}`
        : '/api/v1/monitoring/uptime';
      const method = editingCheck ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(checkData),
      });

      const data = await response.json();

      if (response.ok) {
        if (editingCheck) {
          toast.success('Check updated successfully');
          onCheckUpdated(data.check);
        } else {
          toast.success('Check created successfully');
          onCheckCreated(data.check);
        }
        onClose();
      } else {
        toast.error(data.error || 'Failed to save check');
      }
    } catch (error) {
      console.error('Error saving check:', error);
      toast.error('Failed to save check');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-check-title"
        className="w-full max-w-md rounded-lg bg-card p-4 sm:p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 id="create-check-title" className="text-lg font-semibold text-foreground mb-4">
          {editingCheck ? 'Edit Uptime Check' : 'Create Uptime Check'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL Input - Primary field */}
          <div>
            <label htmlFor="check-url" className="block text-sm font-medium text-foreground mb-1">URL to Monitor</label>
            <input
              type="url"
              id="check-url"
              value={formUrl}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="https://api.example.com/health"
              required
              autoFocus
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
            {formUrl && formName && (
              <p className="text-xs text-muted-foreground mt-1">Name: {formName}</p>
            )}
          </div>

          {/* Preset Selection - Only show when creating */}
          {!editingCheck && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Monitoring Level</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(presets) as [keyof typeof presets, typeof presets[keyof typeof presets]][]).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyPreset(key);
                      }
                    }}
                    className={`relative p-3 rounded-lg border-2 text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                      selectedPreset === key
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 hover:bg-muted'
                    }`}
                  >
                    {selectedPreset === key && (
                      <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <div className="text-xl mb-1">{preset.icon}</div>
                    <div className="font-medium text-sm text-foreground">{preset.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name field - editable */}
          <div>
            <label htmlFor="check-name" className="block text-sm font-medium text-foreground mb-1">Name</label>
            <input
              type="text"
              id="check-name"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Auto-generated from URL"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          {/* Advanced Options - Collapsible */}
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Options
              <span className="text-xs text-muted-foreground ml-auto">
                {showAdvancedOptions ? 'Click to collapse' : 'Method, Headers, Locations, Assertions...'}
              </span>
            </button>
          </div>

          {/* Advanced Options Content */}
          {showAdvancedOptions && (
            <div className="space-y-4 pl-2 border-l-2 border-border">
              {/* Method & Interval */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="check-method" className="block text-sm font-medium text-foreground mb-1">Method</label>
                  <select
                    id="check-method"
                    value={formMethod}
                    onChange={e => setFormMethod(e.target.value as 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="check-interval" className="block text-sm font-medium text-foreground mb-1">Interval</label>
                  <select
                    id="check-interval"
                    value={formInterval}
                    onChange={e => {
                      setFormInterval(parseInt(e.target.value));
                      setSelectedPreset(null);
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value={30}>30s</option>
                    <option value={60}>1 min</option>
                    <option value={120}>2 min</option>
                    <option value={180}>3 min</option>
                    <option value={300}>5 min</option>
                  </select>
                </div>
              </div>

              {/* Timeout & Expected Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="check-timeout" className="block text-sm font-medium text-foreground mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    id="check-timeout"
                    value={formTimeout}
                    onChange={e => setFormTimeout(parseInt(e.target.value))}
                    min={1000}
                    max={30000}
                    step={1000}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="check-expected-status" className="block text-sm font-medium text-foreground mb-1">Expected Status</label>
                  <input
                    type="number"
                    id="check-expected-status"
                    value={formExpectedStatus}
                    onChange={e => setFormExpectedStatus(parseInt(e.target.value))}
                    min={100}
                    max={599}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
              </div>

              {/* Request Headers */}
              <div>
                <label htmlFor="check-headers" className="block text-sm font-medium text-foreground mb-1">Request Headers</label>
                <textarea
                  id="check-headers"
                  value={formHeaders}
                  onChange={e => setFormHeaders(e.target.value)}
                  placeholder="Header-Name: value (one per line)"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
                />
              </div>

              {/* Request Body - Only for POST/PUT/PATCH */}
              {(formMethod === 'POST' || formMethod === 'PUT' || formMethod === 'PATCH') && (
                <div>
                  <label htmlFor="check-body" className="block text-sm font-medium text-foreground mb-1">Request Body</label>
                  <textarea
                    id="check-body"
                    value={formBody}
                    onChange={e => setFormBody(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
                  />
                </div>
              )}

              {/* Monitoring Locations */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Monitoring Locations</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableLocations.map(loc => (
                    <label
                      key={loc.id}
                      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                        formLocations.includes(loc.id)
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formLocations.includes(loc.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setFormLocations([...formLocations, loc.id]);
                          } else {
                            setFormLocations(formLocations.filter(l => l !== loc.id));
                          }
                        }}
                        className="rounded border-input"
                      />
                      <div className="flex-1 text-sm">
                        <div className="font-medium">{loc.name}</div>
                        <div className="text-xs text-muted-foreground">{loc.city}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {formLocations.length === 0 && (
                  <p className="text-xs text-destructive mt-1">At least one location required</p>
                )}
              </div>

              {/* Response Assertions */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Response Assertions</label>
                <div className="space-y-2">
                  {formAssertions.map((assertion, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30">
                      <select
                        value={assertion.type}
                        onChange={e => {
                          const updated = [...formAssertions];
                          updated[idx] = { ...updated[idx], type: e.target.value as UptimeAssertion['type'] };
                          setFormAssertions(updated);
                        }}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="responseTime">Response Time</option>
                        <option value="statusCode">Status Code</option>
                        <option value="bodyContains">Body Contains</option>
                        <option value="headerContains">Header Contains</option>
                      </select>
                      <select
                        value={assertion.operator}
                        onChange={e => {
                          const updated = [...formAssertions];
                          updated[idx] = { ...updated[idx], operator: e.target.value as UptimeAssertion['operator'] };
                          setFormAssertions(updated);
                        }}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="lessThan">&lt;</option>
                        <option value="greaterThan">&gt;</option>
                        <option value="equals">=</option>
                        <option value="contains">~</option>
                      </select>
                      <input
                        type={assertion.type === 'bodyContains' || assertion.type === 'headerContains' ? 'text' : 'number'}
                        value={assertion.value}
                        onChange={e => {
                          const updated = [...formAssertions];
                          const value = assertion.type === 'bodyContains' || assertion.type === 'headerContains'
                            ? e.target.value
                            : parseInt(e.target.value) || 0;
                          updated[idx] = { ...updated[idx], value };
                          setFormAssertions(updated);
                        }}
                        className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setFormAssertions(formAssertions.filter((_, i) => i !== idx))}
                        className="text-destructive hover:text-destructive"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormAssertions([...formAssertions, { type: 'responseTime', operator: 'lessThan', value: 500 }])}
                    className="text-sm text-primary hover:underline"
                  >
                    + Add Assertion
                  </button>
                </div>
              </div>

              {/* SSL Certificate Monitoring - Only for HTTPS URLs */}
              {formUrl.startsWith('https://') && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">🔒 SSL Monitoring</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Warn</span>
                    <input
                      type="number"
                      value={formSslWarningDays}
                      onChange={e => setFormSslWarningDays(parseInt(e.target.value) || 30)}
                      min={1}
                      max={365}
                      className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">days before SSL expiry</span>
                  </div>
                </div>
              )}

              {/* Consecutive Failure Alerting */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">🔔 Alert Threshold</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Alert after</span>
                  <input
                    type="number"
                    value={formConsecutiveFailures}
                    onChange={e => {
                      setFormConsecutiveFailures(parseInt(e.target.value) || 1);
                      setSelectedPreset(null);
                    }}
                    min={1}
                    max={10}
                    className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">consecutive failures</span>
                </div>
              </div>

              {/* Tags & Group */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="check-tags" className="block text-sm font-medium text-foreground mb-1">🏷️ Tags</label>
                  <input
                    type="text"
                    id="check-tags"
                    value={formTags}
                    onChange={e => setFormTags(e.target.value)}
                    placeholder="production, api"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="check-group" className="block text-sm font-medium text-foreground mb-1">📁 Group</label>
                  <input
                    type="text"
                    id="check-group"
                    value={formGroup}
                    onChange={e => setFormGroup(e.target.value)}
                    placeholder="Backend APIs"
                    list="available-groups"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <datalist id="available-groups">
                    {availableGroups.map(g => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formUrl || formLocations.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? (editingCheck ? 'Updating...' : 'Creating...') : (editingCheck ? 'Update Check' : 'Create Check')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
