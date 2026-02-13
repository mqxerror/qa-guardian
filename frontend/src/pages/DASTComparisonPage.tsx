// Feature #756: DAST Comparison Between Scans
// Feature #7: Real DAST scanning with lightweight scanner fallback
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Button } from '../components/ui/button';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { useAuthStore } from '../stores/authStore';

import type {
  DASTCompareRisk,
  DASTCompareAlert,
  DASTCompareScan,
  DASTComparisonResult,
} from '@/types/security';
import type { ProjectOption } from '@/types/organization';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export function DASTComparisonPage() {
 const [searchParams] = useSearchParams();
 const { token } = useAuthStore();
 const [selectedScan1, setSelectedScan1] = useState<string>('');
 const [selectedScan2, setSelectedScan2] = useState<string>('');
 const [comparisonResult, setComparisonResult] = useState<DASTComparisonResult | null>(null);
 const [isComparing, setIsComparing] = useState(false);
 const [activeTab, setActiveTab] = useState<'new' | 'fixed' | 'unchanged'>('new');

 // Real data state
 const [projects, setProjects] = useState<ProjectOption[]>([]);
 const [selectedProject, setSelectedProject] = useState<string>('');
 const [availableScans, setAvailableScans] = useState<DASTCompareScan[]>([]);
 const [loadingScans, setLoadingScans] = useState(false);
 const [isScanning, setIsScanning] = useState(false);
 const [scanTarget, setScanTarget] = useState('http://localhost:3001');
 const [scanProfile, setScanProfile] = useState<'baseline' | 'full'>('baseline');
 const [scanProgress, setScanProgress] = useState<string>('');
 const [error, setError] = useState<string | null>(null);

 const headers: Record<string, string> = {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json',
 };

 // Load projects
 useEffect(() => {
 const loadProjects = async () => {
 try {
 const res = await fetch(`${API_BASE_URL}/api/v1/projects`, { headers });
 if (res.ok) {
 const data = await res.json();
 setProjects(data.projects || []);
 if (data.projects?.length > 0) {
 setSelectedProject(data.projects[0].id);
 }
 }
 } catch (err) {
 console.error('Failed to load projects:', err);
 }
 };
 if (token) loadProjects();
 }, [token]);

 // Load scans when project changes
 useEffect(() => {
 if (!selectedProject) return;
 loadScans();
 }, [selectedProject]);

 const loadScans = async () => {
 if (!selectedProject) return;
 setLoadingScans(true);
 try {
 const res = await fetch(
 `${API_BASE_URL}/api/v1/projects/${selectedProject}/dast/scans?limit=20`,
 { headers }
 );
 if (res.ok) {
 const data = await res.json();
 const completedScans = (data.scans || []).filter((s: DASTCompareScan) => s.status === 'completed');
 setAvailableScans(completedScans);
 }
 } catch (err) {
 console.error('Failed to load scans:', err);
 } finally {
 setLoadingScans(false);
 }
 };

 // Run a new DAST scan
 const runNewScan = async () => {
 if (!selectedProject || !scanTarget) return;
 setIsScanning(true);
 setError(null);
 setScanProgress('Starting scan...');

 try {
 const res = await fetch(
 `${API_BASE_URL}/api/v1/projects/${selectedProject}/dast/scans`,
 {
 method: 'POST',
 headers,
 body: JSON.stringify({ targetUrl: scanTarget, scanProfile }),
 }
 );

 if (!res.ok) {
 const errData = await res.json();
 throw new Error(errData.message || errData.error || 'Failed to start scan');
 }

 const data = await res.json();
 setScanProgress(`Scan started (ID: ${data.scan.id.substring(0, 8)}...)`);

 // Poll for completion
 pollScanStatus(data.scan.id);
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message : 'Unknown error');
 setIsScanning(false);
 }
 };

 const pollScanStatus = async (scanId: string) => {
 const maxAttempts = 60; // 5 minutes max
 for (let i = 0; i < maxAttempts; i++) {
 await new Promise(r => setTimeout(r, 5000));
 try {
 const res = await fetch(
 `${API_BASE_URL}/api/v1/projects/${selectedProject}/dast/scans/${scanId}`,
 { headers }
 );
 if (res.ok) {
 const data = await res.json();
 const scan = data.scan;

 if (scan.progress) {
 setScanProgress(`${scan.progress.phaseDescription} (${scan.progress.percentage}%)`);
 }

 if (scan.status === 'completed') {
 setScanProgress(`Scan completed! Found ${scan.alerts?.length || 0} findings.`);
 setIsScanning(false);
 loadScans(); // Refresh the scan list
 return;
 }

 if (scan.status === 'failed') {
 setError(`Scan failed: ${scan.error || 'Unknown error'}`);
 setIsScanning(false);
 return;
 }
 }
 } catch (err) {
 console.error('Poll error:', err);
 }
 }
 setError('Scan timed out');
 setIsScanning(false);
 };

 // Load from URL params if present
 useEffect(() => {
 const s1 = searchParams.get('scan1');
 const s2 = searchParams.get('scan2');
 if (s1) setSelectedScan1(s1);
 if (s2) setSelectedScan2(s2);
 }, [searchParams]);

 const compareScans = async () => {
 if (!selectedScan1 || !selectedScan2 || selectedScan1 === selectedScan2) return;

 setIsComparing(true);

 const scan1 = availableScans.find(s => s.id === selectedScan1)!;
 const scan2 = availableScans.find(s => s.id === selectedScan2)!;

 // Compare alerts by pluginId + name to determine new/fixed/unchanged
 const scan1AlertKeys = new Set(scan1.alerts.map(a => `${a.pluginId}-${a.name}`));
 const scan2AlertKeys = new Set(scan2.alerts.map(a => `${a.pluginId}-${a.name}`));

 const newFindings = scan2.alerts.filter(a => !scan1AlertKeys.has(`${a.pluginId}-${a.name}`));
 const fixedFindings = scan1.alerts.filter(a => !scan2AlertKeys.has(`${a.pluginId}-${a.name}`));
 const unchangedFindings = scan2.alerts.filter(a => scan1AlertKeys.has(`${a.pluginId}-${a.name}`));

 // Calculate risk delta
 const riskDelta = {
 high: scan2.summary.byRisk.high - scan1.summary.byRisk.high,
 medium: scan2.summary.byRisk.medium - scan1.summary.byRisk.medium,
 low: scan2.summary.byRisk.low - scan1.summary.byRisk.low,
 informational: scan2.summary.byRisk.informational - scan1.summary.byRisk.informational,
 };

 const overallImprovement = fixedFindings.length > newFindings.length ||
 (riskDelta.high < 0 && newFindings.filter(f => f.risk === 'High').length === 0);

 setComparisonResult({
 scan1,
 scan2,
 newFindings,
 fixedFindings,
 unchangedFindings,
 summary: {
 totalNew: newFindings.length,
 totalFixed: fixedFindings.length,
 totalUnchanged: unchangedFindings.length,
 riskDelta,
 overallImprovement,
 },
 });

 setIsComparing(false);
 setActiveTab('new');
 };

 const getRiskColor = (risk: DASTCompareRisk) => {
 switch (risk) {
 case 'High': return 'text-destructive bg-destructive/10';
 case 'Medium': return 'text-warning bg-warning/10';
 case 'Low': return 'text-primary bg-primary/10';
 case 'Informational': return 'text-foreground bg-muted';
 }
 };

 const renderAlertCard = (alert: DASTCompareAlert, status: 'new' | 'fixed' | 'unchanged') => (
 <div key={alert.id} className={`p-4 rounded-lg border ${
 status === 'new' ? 'border-destructive/20 bg-destructive/5/50' :
 status === 'fixed' ? 'border-success/20 bg-success/5/50' :
 'border-border bg-card'
 }`}>
 <div className="flex items-start justify-between mb-2">
 <div className="flex items-center gap-2">
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(alert.risk)}`}>
 {alert.risk}
 </span>
 {status === 'new' && (
 <span className="px-2 py-0.5 rounded text-xs font-medium text-destructive bg-destructive/10">
 NEW
 </span>
 )}
 {status === 'fixed' && (
 <span className="px-2 py-0.5 rounded text-xs font-medium text-success bg-success/10">
 FIXED
 </span>
 )}
 </div>
 {alert.cweId && (
 <span className="text-xs text-muted-foreground">CWE-{alert.cweId}</span>
 )}
 </div>
 <h4 className="font-medium text-foreground mb-1">{alert.name}</h4>
 <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
 <div className="text-xs text-muted-foreground space-y-1">
 <p><span className="font-medium">URL:</span> {alert.url}</p>
 <p><span className="font-medium">Method:</span> {alert.method}</p>
 {alert.param && <p><span className="font-medium">Parameter:</span> {alert.param}</p>}
 {alert.evidence && <p><span className="font-medium">Evidence:</span> {alert.evidence}</p>}
 </div>
 <div className="mt-3 pt-3 border-t border-border">
 <p className="text-xs font-medium text-foreground mb-1">Solution:</p>
 <p className="text-xs text-muted-foreground">{alert.solution}</p>
 </div>
 </div>
 );

 return (
 <Layout>
 <div className="p-6 max-w-6xl mx-auto">
 <PageHeader
   title="DAST Security Scanner"
   description="Run dynamic security scans and compare findings"
   breadcrumbs={[
     { label: 'Home', href: '/' },
     { label: 'Security', href: '/security' },
     { label: 'DAST Scanner' }
   ]}
 />

 {/* Run New Scan Section */}
 <div className="rounded-lg border border-border bg-card p-6 mb-6">
 <h2 className="text-lg font-semibold text-foreground mb-4">Run New DAST Scan</h2>
 <p className="text-sm text-muted-foreground mb-4">
 Scan a target URL for security vulnerabilities. Analyzes security headers, cookie security, information disclosure, CORS policies, and more.
 </p>

 {projects.length > 0 && (
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Project</label>
 <select
 value={selectedProject}
 onChange={(e) => setSelectedProject(e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
 >
 {projects.map(p => (
 <option key={p.id} value={p.id}>{p.name}</option>
 ))}
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-foreground mb-1">Target URL</label>
 <input
 type="text"
 value={scanTarget}
 onChange={(e) => setScanTarget(e.target.value)}
 placeholder="http://localhost:3001"
 className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Scan Profile</label>
 <select
 value={scanProfile}
 onChange={(e) => setScanProfile(e.target.value as 'baseline' | 'full')}
 className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
 >
 <option value="baseline">Baseline (Quick)</option>
 <option value="full">Full (Thorough)</option>
 </select>
 </div>
 </div>
 )}

 <div className="flex items-center gap-4">
 <Button
 onClick={runNewScan}
 disabled={isScanning || !selectedProject || !scanTarget}
 variant="destructive"
 className="flex items-center gap-2"
 >
 {isScanning && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
 {isScanning ? 'Scanning...' : 'Run DAST Scan'}
 </Button>
 {scanProgress && (
 <span className="text-sm text-muted-foreground">{scanProgress}</span>
 )}
 </div>

 {error && (
 <div className="mt-3 p-3 rounded-md bg-destructive/5 border border-destructive/20">
 <p className="text-sm text-destructive">{error}</p>
 </div>
 )}
 </div>

 {/* Scan Results Summary */}
 {availableScans.length > 0 && (
 <div className="rounded-lg border border-border bg-card p-6 mb-6">
 <h2 className="text-lg font-semibold text-foreground mb-4">
 Completed Scans ({availableScans.length})
 </h2>
 <div className="space-y-3">
 {availableScans.map((scan) => (
 <div key={scan.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
 <div className="flex items-center gap-4">
 <div>
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${
 scan.scanProfile === 'full' ? 'bg-accent/10 text-accent' :
 scan.scanProfile === 'api' ? 'bg-primary/10 text-primary' :
 'bg-muted text-foreground'
 }`}>
 {scan.scanProfile}
 </span>
 </div>
 <div>
 <p className="text-sm font-medium text-foreground">{scan.targetUrl}</p>
 <p className="text-xs text-muted-foreground">
 {new Date(scan.startedAt).toLocaleString()} &bull; {scan.statistics?.urlsScanned || 0} URLs scanned &bull; {scan.statistics?.duration || 0}s
 </p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 {scan.summary.byRisk.high > 0 && (
 <span className="px-2 py-0.5 rounded text-xs font-medium text-destructive bg-destructive/10">
 {scan.summary.byRisk.high} High
 </span>
 )}
 {scan.summary.byRisk.medium > 0 && (
 <span className="px-2 py-0.5 rounded text-xs font-medium text-warning bg-warning/10">
 {scan.summary.byRisk.medium} Medium
 </span>
 )}
 {scan.summary.byRisk.low > 0 && (
 <span className="px-2 py-0.5 rounded text-xs font-medium text-primary bg-primary/10">
 {scan.summary.byRisk.low} Low
 </span>
 )}
 <span className="text-sm font-bold text-foreground">
 {scan.summary.total} total
 </span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Scan Comparison */}
 {availableScans.length >= 2 && (
 <div className="rounded-lg border border-border bg-card p-6 mb-6">
 <h2 className="text-lg font-semibold text-foreground mb-4">Compare Scans</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 First Scan (Before)
 </label>
 <select
 value={selectedScan1}
 onChange={(e) => setSelectedScan1(e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
 >
 <option value="">Select a scan...</option>
 {availableScans.map((scan) => (
 <option key={scan.id} value={scan.id} disabled={scan.id === selectedScan2}>
 {new Date(scan.startedAt).toLocaleString()} - {scan.scanProfile} ({scan.summary.total} findings)
 </option>
 ))}
 </select>
 {selectedScan1 && (() => {
 const scan = availableScans.find(s => s.id === selectedScan1);
 return scan ? (
 <div className="mt-2 p-3 rounded bg-muted/30 text-sm">
 <p className="font-medium text-foreground">{scan.targetUrl}</p>
 <p className="text-muted-foreground">
 {scan.summary.byRisk.high || 0} High{' '}
 {scan.summary.byRisk.medium || 0} Medium{' '}
 {scan.summary.byRisk.low || 0} Low
 </p>
 </div>
 ) : null;
 })()}
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Second Scan (After)
 </label>
 <select
 value={selectedScan2}
 onChange={(e) => setSelectedScan2(e.target.value)}
 className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
 >
 <option value="">Select a scan...</option>
 {availableScans.map((scan) => (
 <option key={scan.id} value={scan.id} disabled={scan.id === selectedScan1}>
 {new Date(scan.startedAt).toLocaleString()} - {scan.scanProfile} ({scan.summary.total} findings)
 </option>
 ))}
 </select>
 {selectedScan2 && (() => {
 const scan = availableScans.find(s => s.id === selectedScan2);
 return scan ? (
 <div className="mt-2 p-3 rounded bg-muted/30 text-sm">
 <p className="font-medium text-foreground">{scan.targetUrl}</p>
 <p className="text-muted-foreground">
 {scan.summary.byRisk.high || 0} High{' '}
 {scan.summary.byRisk.medium || 0} Medium{' '}
 {scan.summary.byRisk.low || 0} Low
 </p>
 </div>
 ) : null;
 })()}
 </div>
 </div>

 <div className="mt-4 flex justify-center">
 <Button
 onClick={compareScans}
 disabled={!selectedScan1 || !selectedScan2 || selectedScan1 === selectedScan2 || isComparing}
 className="flex items-center gap-2"
 >
 {isComparing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
 {isComparing ? 'Comparing...' : 'Compare Scans'}
 </Button>
 </div>
 </div>
 )}

 {/* Comparison Results */}
 {comparisonResult && (
 <>
 {/* Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
 <div className={`rounded-lg border p-4 ${
 comparisonResult.summary.overallImprovement
 ? 'border-success/20 bg-success/5'
 : 'border-warning/20 bg-warning/5'
 }`}>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-2xl">{comparisonResult.summary.overallImprovement ? '📈' : '📉'}</span>
 <span className="text-sm font-medium text-foreground">Overall Status</span>
 </div>
 <p className={`text-lg font-bold ${comparisonResult.summary.overallImprovement ? 'text-success' : 'text-warning'}`}>
 {comparisonResult.summary.overallImprovement ? 'Improved' : 'Needs Attention'}
 </p>
 </div>

 <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-2xl">🆕</span>
 <span className="text-sm font-medium text-foreground">New Findings</span>
 </div>
 <p className="text-2xl font-bold text-destructive">{comparisonResult.summary.totalNew}</p>
 </div>

 <div className="rounded-lg border border-success/20 bg-success/5 p-4">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-2xl">✅</span>
 <span className="text-sm font-medium text-foreground">Fixed Findings</span>
 </div>
 <p className="text-2xl font-bold text-success">{comparisonResult.summary.totalFixed}</p>
 </div>

 <div className="rounded-lg border border-border bg-card p-4">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-2xl">➡️</span>
 <span className="text-sm font-medium text-foreground">Unchanged</span>
 </div>
 <p className="text-2xl font-bold text-muted-foreground">{comparisonResult.summary.totalUnchanged}</p>
 </div>
 </div>

 {/* Risk Delta */}
 <div className="rounded-lg border border-border bg-card p-4 mb-6">
 <h3 className="font-medium text-foreground mb-3">Risk Level Changes</h3>
 <div className="flex flex-wrap gap-4">
 {(['high', 'medium', 'low', 'informational'] as const).map((risk) => {
 const delta = comparisonResult.summary.riskDelta[risk];
 const isImproved = delta < 0;
 const isWorse = delta > 0;
 return (
 <div key={risk} className="flex items-center gap-2">
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(risk.charAt(0).toUpperCase() + risk.slice(1) as DASTCompareRisk)}`}>
 {risk.charAt(0).toUpperCase() + risk.slice(1)}
 </span>
 <span className={`font-medium ${isImproved ? 'text-success' : isWorse ? 'text-destructive' : 'text-muted-foreground'}`}>
 {delta > 0 ? '+' : ''}{delta}
 </span>
 {isImproved && <span className="text-success">↓</span>}
 {isWorse && <span className="text-destructive">↑</span>}
 </div>
 );
 })}
 </div>
 </div>

 {/* Tabs for Findings */}
 <div className="rounded-lg border border-border bg-card">
 <div className="flex border-b border-border">
 <Button
 onClick={() => setActiveTab('new')}
 variant="ghost"
 size="sm"
 className={`flex-1 ${
 activeTab === 'new'
 ? 'text-destructive border-b-2 border-destructive'
 : 'text-muted-foreground'
 }`}
 >
 New Findings ({comparisonResult.newFindings.length})
 </Button>
 <Button
 onClick={() => setActiveTab('fixed')}
 variant="ghost"
 size="sm"
 className={`flex-1 ${
 activeTab === 'fixed'
 ? 'text-success border-b-2 border-success'
 : 'text-muted-foreground'
 }`}
 >
 Fixed Findings ({comparisonResult.fixedFindings.length})
 </Button>
 <Button
 onClick={() => setActiveTab('unchanged')}
 variant="ghost"
 size="sm"
 className={`flex-1 ${
 activeTab === 'unchanged'
 ? 'text-foreground border-b-2 border-primary'
 : 'text-muted-foreground'
 }`}
 >
 Unchanged ({comparisonResult.unchangedFindings.length})
 </Button>
 </div>

 <div className="p-4">
 {activeTab === 'new' && (
 <div className="space-y-4">
 {/* Feature #728: EmptyState adoption */}
 {comparisonResult.newFindings.length === 0 ? (
 <EmptyState icon={EmptyStateIcons.security} title="No new vulnerabilities found!" description="No new security issues were detected in this scan." size="sm" />
 ) : (
 comparisonResult.newFindings.map(alert => renderAlertCard(alert, 'new'))
 )}
 </div>
 )}

 {activeTab === 'fixed' && (
 <div className="space-y-4">
 {/* Feature #728: EmptyState adoption */}
 {comparisonResult.fixedFindings.length === 0 ? (
 <EmptyState icon={EmptyStateIcons.document} title="No fixed vulnerabilities" description="No vulnerabilities were fixed between these scans." size="sm" />
 ) : (
 comparisonResult.fixedFindings.map(alert => renderAlertCard(alert, 'fixed'))
 )}
 </div>
 )}

 {activeTab === 'unchanged' && (
 <div className="space-y-4">
 {/* Feature #728: EmptyState adoption */}
 {comparisonResult.unchangedFindings.length === 0 ? (
 <EmptyState icon={EmptyStateIcons.security} title="All findings changed" description="All findings have changed between scans!" size="sm" />
 ) : (
 comparisonResult.unchangedFindings.map(alert => renderAlertCard(alert, 'unchanged'))
 )}
 </div>
 )}
 </div>
 </div>
 </>
 )}

 {/* Feature #728: EmptyState adoption */}
 {availableScans.length === 0 && !loadingScans && !isScanning && (
 <EmptyState
 icon={EmptyStateIcons.security}
 title="No DAST scans yet"
 description="Run your first DAST scan above to analyze your application for security vulnerabilities."
 size="lg"
 />
 )}

 {loadingScans && (
 <div className="text-center py-8 text-muted-foreground">
 <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
 <p>Loading scans...</p>
 </div>
 )}
 </div>
 </Layout>
 );
}
