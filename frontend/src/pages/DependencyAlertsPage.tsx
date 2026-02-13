// Feature #767: Dependency Alerts Page
// Extracted from App.tsx for code quality compliance

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';

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
 // Feature #232: Fixed to use Zustand auth store instead of non-existent localStorage token
 const token = useAuthStore.getState().token;

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
 case 'CRITICAL': return 'text-accent bg-accent/10';
 case 'HIGH': return 'text-destructive bg-destructive/10';
 case 'MEDIUM': return 'text-warning bg-warning/10';
 case 'LOW': return 'text-primary bg-primary/10';
 default: return 'text-muted-foreground bg-muted';
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'new': return 'text-destructive bg-destructive/20';
 case 'acknowledged': return 'text-warning bg-warning/20';
 case 'dismissed': return 'text-muted-foreground bg-muted';
 case 'fixed': return 'text-success bg-success/20';
 default: return 'text-muted-foreground bg-muted';
 }
 };

 const filteredAlerts = alerts.filter(a => {
 if (statusFilter !== 'all' && a.status !== statusFilter) return false;
 if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
 return true;
 });

 return (
 <Layout>
 <div className="p-6 lg:p-8 space-y-6">
 {/* Feature #639: PageHeader component */}
 <PageHeader
   title="Dependency Alerts"
   description="Get notified when new CVEs affect your dependencies"
   breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'Dependency Alerts' }]}
   actions={
     <button
       onClick={() => setShowSimulateModal(true)}
       disabled={!config.enabled}
       className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
     >
       <span>{'\u26A0'}</span> Simulate CVE
     </button>
   }
 />

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
 <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
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
 className="rounded border-border"
 />
 <span className="text-foreground">{'\u{1F514}'} In-App</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={config.notify_email}
 onChange={(e) => saveConfig({ notify_email: e.target.checked })}
 className="rounded border-border"
 />
 <span className="text-foreground">{'\u2709'} Email</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={config.notify_slack}
 onChange={(e) => saveConfig({ notify_slack: e.target.checked })}
 className="rounded border-border"
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
 className="rounded border-border"
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
 <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
 <p className="text-3xl font-bold text-destructive">{summary.new}</p>
 <p className="text-sm text-destructive/80">New</p>
 </div>
 <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-center">
 <p className="text-3xl font-bold text-warning">{summary.acknowledged}</p>
 <p className="text-sm text-warning/80">Acknowledged</p>
 </div>
 <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
 <p className="text-3xl font-bold text-muted-foreground">{summary.dismissed}</p>
 <p className="text-sm text-muted-foreground/80">Dismissed</p>
 </div>
 <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-center">
 <p className="text-3xl font-bold text-success">{summary.fixed}</p>
 <p className="text-sm text-success/80">Fixed</p>
 </div>
 </div>

 {/* Severity Summary */}
 <div className="grid grid-cols-4 gap-2">
 <div className="rounded-lg bg-accent/10 p-3 text-center">
 <p className="text-xl font-bold text-accent">{summary.by_severity.critical}</p>
 <p className="text-xs text-accent/80">Critical</p>
 </div>
 <div className="rounded-lg bg-destructive/10 p-3 text-center">
 <p className="text-xl font-bold text-destructive">{summary.by_severity.high}</p>
 <p className="text-xs text-destructive/80">High</p>
 </div>
 <div className="rounded-lg bg-warning/10 p-3 text-center">
 <p className="text-xl font-bold text-warning">{summary.by_severity.medium}</p>
 <p className="text-xs text-warning/80">Medium</p>
 </div>
 <div className="rounded-lg bg-primary/10 p-3 text-center">
 <p className="text-xl font-bold text-primary">{summary.by_severity.low}</p>
 <p className="text-xs text-primary/80">Low</p>
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
 <EmptyState
 icon={EmptyStateIcons.security}
 title="No alerts found"
 description={config.enabled ? 'No vulnerability alerts match your filters. Simulate a CVE to test the alerting system.' : 'Enable dependency alerts to start receiving CVE notifications.'}
 />
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
 {alert.fixed_version && <span className="ml-2 text-success">{'\u2022'} Fix: {alert.fixed_version}</span>}
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
 <span className={`text-xs px-2 py-1 rounded ${proj.is_direct_dependency ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
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
 className="px-3 py-1 bg-warning/20 text-warning rounded hover:bg-warning/30 text-sm"
 >
 Acknowledge
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); updateAlertStatus(alert.id, 'dismissed', 'Not applicable'); }}
 className="px-3 py-1 bg-muted text-muted-foreground rounded hover:bg-muted/80 text-sm"
 >
 Dismiss
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); updateAlertStatus(alert.id, 'fixed'); }}
 className="px-3 py-1 bg-success/20 text-success rounded hover:bg-success/30 text-sm"
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

 {/* Feature #661: Simulate CVE Modal - migrated to shared Modal */}
      <Modal
        isOpen={showSimulateModal}
        onClose={() => setShowSimulateModal(false)}
        title="Simulate New CVE"
        size="md"
      >
        <ModalHeader onClose={() => setShowSimulateModal(false)}>
          Simulate New CVE
        </ModalHeader>
        <ModalBody>
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
        </ModalBody>
        <ModalFooter>
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
        </ModalFooter>
      </Modal>
 </div>
 </Layout>
 );
}
