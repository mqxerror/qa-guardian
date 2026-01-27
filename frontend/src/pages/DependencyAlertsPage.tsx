// Feature #767: Dependency Alerts Page
// Extracted from App.tsx for code quality compliance

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { toast } from '../stores/toastStore';

// Type definitions
interface DependencyAlertConfig {
  enabled: boolean;
  severity_threshold: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  notify_email: boolean;
  notify_slack: boolean;
  slack_webhook?: string;
  notify_in_app: boolean;
  auto_create_issues: boolean;
}

interface CVEAlert {
  id: string;
  cve_id: string;
  published_at: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvss_score: number;
  title: string;
  description: string;
  affected_package: string;
  affected_versions: string;
  fixed_version?: string;
  references: string[];
  affected_projects: Array<{
    project_id: string;
    project_name: string;
    installed_version: string;
    is_direct_dependency: boolean;
  }>;
  status: 'new' | 'acknowledged' | 'dismissed' | 'fixed';
  acknowledged_by?: string;
  acknowledged_at?: string;
  dismissed_reason?: string;
}

export function DependencyAlertsPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Configuration state
  const [config, setConfig] = useState<DependencyAlertConfig>({
    enabled: false,
    severity_threshold: 'HIGH',
    notify_email: true,
    notify_slack: false,
    notify_in_app: true,
    auto_create_issues: false,
  });
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Alerts state
  const [alerts, setAlerts] = useState<CVEAlert[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    new: 0,
    acknowledged: 0,
    dismissed: 0,
    fixed: 0,
    by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
  });
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  // Simulation state
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simulatePackage, setSimulatePackage] = useState('lodash');
  const [simulateSeverity, setSimulateSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [isSimulating, setIsSimulating] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'acknowledged' | 'dismissed' | 'fixed'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('all');

  // Load configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/v1/organization/dependency-alerts/config', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setConfig(data.config);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    loadConfig();
  }, [token]);

  // Load alerts
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const response = await fetch('/api/v1/organization/dependency-alerts', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setAlerts(data.alerts || []);
          setSummary(data.summary);
        }
      } catch (error) {
        console.error('Failed to load alerts:', error);
      } finally {
        setIsLoadingAlerts(false);
      }
    };
    loadAlerts();
  }, [token]);

  // Save configuration
  const saveConfig = async (updates: Partial<DependencyAlertConfig>) => {
    setIsSavingConfig(true);
    try {
      const response = await fetch('/api/v1/organization/dependency-alerts/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        toast.success(data.message);
      }
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Simulate CVE
  const handleSimulateCVE = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch('/api/v1/organization/dependency-alerts/simulate-cve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          package_name: simulatePackage,
          severity: simulateSeverity,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(`Alert created: ${data.alert.cve_id} - Notifications sent: ${data.notifications_sent.join(', ')}`);
        // Refresh alerts
        const alertsResponse = await fetch('/api/v1/organization/dependency-alerts', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (alertsResponse.ok) {
          const alertsData = await alertsResponse.json();
          setAlerts(alertsData.alerts || []);
          setSummary(alertsData.summary);
        }
        setShowSimulateModal(false);
      } else {
        toast.error(data.message || 'Failed to simulate CVE');
      }
    } catch (error) {
      toast.error('Failed to simulate CVE');
    } finally {
      setIsSimulating(false);
    }
  };

  // Update alert status
  const updateAlertStatus = async (alertId: string, status: 'acknowledged' | 'dismissed' | 'fixed', dismissedReason?: string) => {
    try {
      const response = await fetch(`/api/v1/organization/dependency-alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status, dismissed_reason: dismissedReason }),
      });
      if (response.ok) {
        const data = await response.json();
        setAlerts(prev => prev.map(a => a.id === alertId ? data.alert : a));
        toast.success(`Alert ${status}`);
        // Refresh summary
        const alertsResponse = await fetch('/api/v1/organization/dependency-alerts', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (alertsResponse.ok) {
          const alertsData = await alertsResponse.json();
          setSummary(alertsData.summary);
        }
      }
    } catch (error) {
      toast.error('Failed to update alert');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
      case 'HIGH': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'MEDIUM': return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'LOW': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-red-600 bg-red-100';
      case 'acknowledged': return 'text-amber-600 bg-amber-100';
      case 'dismissed': return 'text-gray-500 bg-gray-100';
      case 'fixed': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/security')} className="text-muted-foreground hover:text-foreground">{'\u2190'}</button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dependency Alerts</h1>
              <p className="text-muted-foreground">Get notified when new CVEs affect your dependencies</p>
            </div>
          </div>
          <button
            onClick={() => setShowSimulateModal(true)}
            disabled={!config.enabled}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <span>{'\u26A0'}</span> Simulate CVE
          </button>
        </div>

        {/* Configuration Section */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span>{'\u2699'}</span> Alert Configuration
          </h2>

          {isLoadingConfig ? (
            <p className="text-muted-foreground">Loading configuration...</p>
          ) : (
            <div className="space-y-4">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="font-medium text-foreground">Enable Dependency Alerts</p>
                  <p className="text-sm text-muted-foreground">Receive notifications when new vulnerabilities are published</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => saveConfig({ enabled: e.target.checked })}
                    disabled={isSavingConfig}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {config.enabled && (
                <>
                  {/* Severity Threshold */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Minimum Severity</label>
                      <select
                        value={config.severity_threshold}
                        onChange={(e) => saveConfig({ severity_threshold: e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' })}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                      >
                        <option value="CRITICAL">Critical only</option>
                        <option value="HIGH">High and above</option>
                        <option value="MEDIUM">Medium and above</option>
                        <option value="LOW">All severities</option>
                      </select>
                    </div>
                  </div>

                  {/* Notification Channels */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Notification Channels</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.notify_in_app}
                          onChange={(e) => saveConfig({ notify_in_app: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-foreground">{'\u{1F514}'} In-App</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.notify_email}
                          onChange={(e) => saveConfig({ notify_email: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-foreground">{'\u2709'} Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.notify_slack}
                          onChange={(e) => saveConfig({ notify_slack: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-foreground">{'\u{1F4AC}'} Slack</span>
                      </label>
                    </div>
                  </div>

                  {/* Auto-create Issues */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.auto_create_issues}
                      onChange={(e) => saveConfig({ auto_create_issues: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-foreground">Automatically create GitHub issues for critical alerts</span>
                  </label>
                </>
              )}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{summary.total}</p>
            <p className="text-sm text-muted-foreground">Total Alerts</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{summary.new}</p>
            <p className="text-sm text-red-600/80">New</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{summary.acknowledged}</p>
            <p className="text-sm text-amber-600/80">Acknowledged</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 p-4 text-center">
            <p className="text-3xl font-bold text-gray-500">{summary.dismissed}</p>
            <p className="text-sm text-gray-500/80">Dismissed</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{summary.fixed}</p>
            <p className="text-sm text-green-600/80">Fixed</p>
          </div>
        </div>

        {/* Severity Summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-3 text-center">
            <p className="text-xl font-bold text-purple-600">{summary.by_severity.critical}</p>
            <p className="text-xs text-purple-600/80">Critical</p>
          </div>
          <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-3 text-center">
            <p className="text-xl font-bold text-red-600">{summary.by_severity.high}</p>
            <p className="text-xs text-red-600/80">High</p>
          </div>
          <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-3 text-center">
            <p className="text-xl font-bold text-amber-600">{summary.by_severity.medium}</p>
            <p className="text-xs text-amber-600/80">Medium</p>
          </div>
          <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{summary.by_severity.low}</p>
            <p className="text-xs text-blue-600/80">Low</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 rounded-md border border-input bg-background text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="dismissed">Dismissed</option>
            <option value="fixed">Fixed</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
            className="px-3 py-2 rounded-md border border-input bg-background text-foreground"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {isLoadingAlerts ? (
            <p className="text-center text-muted-foreground py-8">Loading alerts...</p>
          ) : filteredAlerts.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <span className="text-5xl mb-4 block">{'\u{1F6E1}'}</span>
              <p className="text-lg font-medium text-foreground mb-2">No alerts found</p>
              <p className="text-muted-foreground">
                {config.enabled ? 'No vulnerability alerts match your filters. Simulate a CVE to test the alerting system.' : 'Enable dependency alerts to start receiving CVE notifications.'}
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-border bg-card overflow-hidden">
                {/* Alert Header */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                >
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                    {alert.severity}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(alert.status)}`}>
                    {alert.status.toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      <span className="font-mono text-sm">{alert.cve_id}</span> - {alert.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {alert.affected_package} {alert.affected_versions}
                      {alert.fixed_version && <span className="ml-2 text-green-600">{'\u2022'} Fix: {alert.fixed_version}</span>}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>CVSS: {alert.cvss_score}</p>
                    <p>{new Date(alert.published_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-muted-foreground">{expandedAlert === alert.id ? '\u25B2' : '\u25BC'}</span>
                </div>

                {/* Expanded Details */}
                {expandedAlert === alert.id && (
                  <div className="border-t border-border p-4 space-y-4 bg-muted/10">
                    <p className="text-foreground">{alert.description}</p>

                    {/* Affected Projects */}
                    {alert.affected_projects.length > 0 && (
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Affected Projects ({alert.affected_projects.length})</h4>
                        <div className="space-y-2">
                          {alert.affected_projects.map((proj) => (
                            <div key={proj.project_id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                              <div>
                                <span className="font-medium text-foreground">{proj.project_name}</span>
                                <span className="text-sm text-muted-foreground ml-2">v{proj.installed_version}</span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded ${proj.is_direct_dependency ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                                {proj.is_direct_dependency ? 'Direct' : 'Transitive'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* References */}
                    {alert.references.length > 0 && (
                      <div>
                        <h4 className="font-medium text-foreground mb-2">References</h4>
                        <div className="flex flex-wrap gap-2">
                          {alert.references.map((ref, i) => (
                            <a key={i} href={ref} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                              {ref.includes('nvd.nist.gov') ? '\u{1F3DB}\uFE0F NVD' : ref.includes('github.com') ? '\u{1F419} GitHub' : '\u{1F517} Link'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {alert.status === 'new' && (
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateAlertStatus(alert.id, 'acknowledged'); }}
                          className="px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 text-sm"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateAlertStatus(alert.id, 'dismissed', 'Not applicable'); }}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateAlertStatus(alert.id, 'fixed'); }}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                        >
                          Mark Fixed
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Simulate CVE Modal */}
        {showSimulateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 w-full max-w-md border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4">Simulate New CVE</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Simulate a new CVE being published to test the alerting system.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Package Name</label>
                  <input
                    type="text"
                    value={simulatePackage}
                    onChange={(e) => setSimulatePackage(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                    placeholder="e.g., lodash, express, axios"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Severity</label>
                  <select
                    value={simulateSeverity}
                    onChange={(e) => setSimulateSeverity(e.target.value as typeof simulateSeverity)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSimulateCVE}
                  disabled={isSimulating || !simulatePackage}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSimulating ? 'Simulating...' : 'Simulate CVE'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
