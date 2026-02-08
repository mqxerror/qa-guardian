/**
 * DastConfigPanel - DAST configuration and scan results UI
 * Feature #102: Extracted from SecurityTab.tsx
 */
import { DASTConfig, DASTScanResult, OpenAPISpec } from '../types';

export interface DastConfigPanelProps {
 projectId: string;
 token: string | null;
 dastConfig: DASTConfig;
 dastScans: DASTScanResult[];
 isLoadingDast: boolean;
 isUpdatingDast: boolean;
 isRunningDastScan: boolean;
 selectedDastScan: DASTScanResult | null;
 dastTargetUrl: string;
 openApiSpec: OpenAPISpec | null;
 isUploadingSpec: boolean;
 specUploadError: string | null;
 dastSchedules: any[];
 handleUpdateDastConfig: (updates: Partial<DASTConfig>) => Promise<void>;
 handleTriggerDastScan: () => Promise<void>;
 setDastTargetUrl: (url: string) => void;
 setSelectedDastScan: (scan: DASTScanResult | null) => void;
 handleUploadOpenApiSpec: (content: string) => Promise<void>;
 handleDeleteOpenApiSpec: () => Promise<void>;
 setDastScans: (scans: DASTScanResult[]) => void;
 setDastSchedules: (schedules: any[]) => void;
}

export function DastConfigPanel(props: DastConfigPanelProps) {
 const {
 projectId,
 token,
 dastConfig,
 dastScans,
 isLoadingDast,
 isUpdatingDast,
 isRunningDastScan,
 selectedDastScan,
 dastTargetUrl,
 openApiSpec,
 isUploadingSpec,
 specUploadError,
 dastSchedules,
 handleUpdateDastConfig,
 handleTriggerDastScan,
 setDastTargetUrl,
 setSelectedDastScan,
 handleUploadOpenApiSpec,
 handleDeleteOpenApiSpec,
 setDastScans,
 setDastSchedules,
 } = props;

 return (
 <div className="mt-8 pt-8 border-t border-border">
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-4">
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
 <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
 </svg>
 </div>
 <div>
 <h2 className="text-lg font-semibold text-foreground">Dynamic Application Security Testing (DAST)</h2>
 <p className="text-sm text-muted-foreground">
 Scan running web applications for security vulnerabilities using OWASP ZAP
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span id="dast-toggle-label" className="text-sm text-muted-foreground">
 {dastConfig.enabled ? 'Enabled' : 'Disabled'}
 </span>
 <button
 type="button"
 role="switch"
 aria-checked={dastConfig.enabled}
 aria-labelledby="dast-toggle-label"
 onClick={() => !isUpdatingDast && handleUpdateDastConfig({ enabled: !dastConfig.enabled })}
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${
 dastConfig.enabled ? 'bg-purple-600' : 'bg-muted'
 }`}
 >
 <span
 className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
 dastConfig.enabled ? 'translate-x-6' : 'translate-x-1'
 }`}
 />
 </button>
 </div>
 </div>

 {isLoadingDast ? (
 <div className="py-8 text-center">
 <svg className="mx-auto h-8 w-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 <p className="mt-2 text-muted-foreground">Loading DAST configuration...</p>
 </div>
 ) : dastConfig.enabled ? (
 <DASTConfigSection
 projectId={projectId}
 token={token}
 dastConfig={dastConfig}
 dastTargetUrl={dastTargetUrl}
 openApiSpec={openApiSpec}
 isUpdatingDast={isUpdatingDast}
 isRunningDastScan={isRunningDastScan}
 isUploadingSpec={isUploadingSpec}
 specUploadError={specUploadError}
 dastSchedules={dastSchedules}
 handleUpdateDastConfig={handleUpdateDastConfig}
 handleTriggerDastScan={handleTriggerDastScan}
 setDastTargetUrl={setDastTargetUrl}
 handleUploadOpenApiSpec={handleUploadOpenApiSpec}
 handleDeleteOpenApiSpec={handleDeleteOpenApiSpec}
 setDastSchedules={setDastSchedules}
 />
 ) : null}
 </div>

 {/* DAST Scan Results */}
 {dastConfig.enabled && dastScans.length > 0 && (
 <DASTScanResults
 projectId={projectId}
 token={token}
 dastScans={dastScans}
 selectedDastScan={selectedDastScan}
 setSelectedDastScan={setSelectedDastScan}
 setDastScans={setDastScans}
 />
 )}
 </div>
 );
}

// DAST Configuration Section
interface DASTConfigSectionProps {
 projectId: string;
 token: string | null;
 dastConfig: DASTConfig;
 dastTargetUrl: string;
 openApiSpec: OpenAPISpec | null;
 isUpdatingDast: boolean;
 isRunningDastScan: boolean;
 isUploadingSpec: boolean;
 specUploadError: string | null;
 dastSchedules: any[];
 handleUpdateDastConfig: (updates: Partial<DASTConfig>) => Promise<void>;
 handleTriggerDastScan: () => Promise<void>;
 setDastTargetUrl: (url: string) => void;
 handleUploadOpenApiSpec: (content: string) => Promise<void>;
 handleDeleteOpenApiSpec: () => Promise<void>;
 setDastSchedules: (schedules: any[]) => void;
}

function DASTConfigSection(props: DASTConfigSectionProps) {
 const {
 dastConfig,
 dastTargetUrl,
 isUpdatingDast,
 isRunningDastScan,
 handleUpdateDastConfig,
 handleTriggerDastScan,
 setDastTargetUrl,
 } = props;

 return (
 <div className="space-y-4">
 {/* Target URL */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">Target URL</label>
 <input
 type="url"
 value={dastTargetUrl}
 onChange={(e) => setDastTargetUrl(e.target.value)}
 onBlur={() => {
 if (dastTargetUrl !== dastConfig.targetUrl) {
 handleUpdateDastConfig({ targetUrl: dastTargetUrl });
 }
 }}
 placeholder="https://your-app.example.com"
 className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
 />
 <p className="mt-1 text-xs text-muted-foreground">
 The URL of the running application to scan (e.g., staging environment)
 </p>
 </div>

 {/* Scan Profile */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">Scan Profile</label>
 <select
 value={dastConfig.scanProfile}
 onChange={(e) => handleUpdateDastConfig({ scanProfile: e.target.value as 'baseline' | 'full' | 'api' })}
 disabled={isUpdatingDast}
 className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
 >
 <option value="baseline">Baseline Scan - Quick passive scan (~2 min)</option>
 <option value="full">Full Scan - Comprehensive active scan (~30+ min)</option>
 <option value="api">API Scan - For REST/GraphQL APIs (~5-10 min)</option>
 </select>
 </div>

 {/* Alert Threshold */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">Minimum Alert Level</label>
 <select
 value={dastConfig.alertThreshold}
 onChange={(e) => handleUpdateDastConfig({ alertThreshold: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })}
 disabled={isUpdatingDast}
 className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
 >
 <option value="HIGH">High risk only</option>
 <option value="MEDIUM">Medium and above</option>
 <option value="LOW">All alerts (including low)</option>
 </select>
 </div>

 {/* Trigger Scan Button */}
 <div className="pt-4 border-t border-border">
 <button
 onClick={handleTriggerDastScan}
 disabled={isRunningDastScan || isUpdatingDast || !dastTargetUrl}
 className="flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
 >
 {isRunningDastScan ? (
 <>
 <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 Scanning...
 </>
 ) : (
 <>
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
 </svg>
 Start DAST Scan
 </>
 )}
 </button>
 {dastConfig.lastScanAt && (
 <p className="mt-2 text-xs text-muted-foreground">
 Last scan: {new Date(dastConfig.lastScanAt).toLocaleString()}
 {dastConfig.lastScanStatus && (
 <span className={`ml-2 ${
 dastConfig.lastScanStatus === 'completed' ? 'text-green-600' :
 dastConfig.lastScanStatus === 'failed' ? 'text-red-600' :
 'text-amber-600'
 }`}>
 ({dastConfig.lastScanStatus})
 </span>
 )}
 </p>
 )}
 </div>
 </div>
 );
}

// DAST Scan Results
interface DASTScanResultsProps {
 projectId: string;
 token: string | null;
 dastScans: DASTScanResult[];
 selectedDastScan: DASTScanResult | null;
 setSelectedDastScan: (scan: DASTScanResult | null) => void;
 setDastScans: (scans: DASTScanResult[]) => void;
}

function DASTScanResults(props: DASTScanResultsProps) {
 const { dastScans, selectedDastScan, setSelectedDastScan } = props;

 return (
 <div className="rounded-lg border border-border bg-card p-6 mt-6">
 <h3 className="text-lg font-semibold text-foreground mb-4">Recent DAST Scans</h3>
 <div className="space-y-4">
 {dastScans.map((scan) => (
 <div key={scan.id} className="border border-border rounded-lg overflow-hidden">
 <button
 onClick={() => setSelectedDastScan(selectedDastScan?.id === scan.id ? null : scan)}
 className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
 >
 <div className="flex items-center gap-4">
 <div className={`h-3 w-3 rounded-full ${
 scan.status === 'completed' ? 'bg-green-500' :
 scan.status === 'failed' ? 'bg-red-500' :
 scan.status === 'running' ? 'bg-amber-500 animate-pulse' :
 'bg-gray-400'
 }`} />
 <div className="text-left">
 <p className="font-medium text-foreground text-sm truncate max-w-xs">
 {scan.targetUrl}
 </p>
 <p className="text-xs text-muted-foreground">
 {scan.scanProfile} scan • {new Date(scan.startedAt).toLocaleString()}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-4">
 {scan.status === 'completed' && (
 <div className="flex items-center gap-2 text-sm">
 {scan.summary.byRisk.high > 0 && (
 <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">
 {scan.summary.byRisk.high} High
 </span>
 )}
 {scan.summary.byRisk.medium > 0 && (
 <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
 {scan.summary.byRisk.medium} Medium
 </span>
 )}
 {scan.summary.byRisk.low > 0 && (
 <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
 {scan.summary.byRisk.low} Low
 </span>
 )}
 {scan.summary.total === 0 && (
 <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
 No issues
 </span>
 )}
 </div>
 )}
 <svg
 className={`h-5 w-5 text-muted-foreground transition-transform ${
 selectedDastScan?.id === scan.id ? 'rotate-180' : ''
 }`}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </div>
 </button>

 {/* Expanded alerts view */}
 {selectedDastScan?.id === scan.id && scan.alerts && scan.alerts.length > 0 && (
 <div className="p-4 border-t border-border">
 <h4 className="font-medium text-foreground text-sm mb-3">Alerts ({scan.alerts.filter(a => !a.isFalsePositive).length})</h4>
 <div className="space-y-3 max-h-96 overflow-y-auto">
 {scan.alerts.filter(a => !a.isFalsePositive).map((alert) => (
 <div key={alert.id} className="p-3 rounded-lg border border-border bg-muted/20">
 <div className="flex items-start gap-3">
 <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
 alert.risk === 'High'
 ? 'bg-red-100 text-red-800'
 : alert.risk === 'Medium'
 ? 'bg-amber-100 text-amber-800'
 : alert.risk === 'Low'
 ? 'bg-blue-100 text-blue-800'
 : 'bg-muted text-foreground'
 }`}>
 {alert.risk}
 </span>
 <div className="flex-1 min-w-0">
 <p className="font-medium text-foreground">{alert.name}</p>
 <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
 <p className="mt-2 text-xs font-mono text-muted-foreground">
 <span className="font-semibold">{alert.method}</span> {alert.url}
 </p>
 {alert.solution && (
 <div className="mt-2 p-2 rounded bg-green-50 border border-green-200">
 <p className="text-xs text-green-800">
 <strong>Solution:</strong> {alert.solution}
 </p>
 </div>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 );
}
