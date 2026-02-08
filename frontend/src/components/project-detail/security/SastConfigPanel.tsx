/**
 * SastConfigPanel - SAST configuration UI
 * Feature #102: Extracted from SecurityTab.tsx
 */
import { SASTConfig } from '../types';

export interface SastConfigPanelProps {
 sastConfig: SASTConfig;
 sastRulesets: Array<{ id: string; name: string; description: string }>;
 isUpdatingSast: boolean;
 isRunningScan: boolean;
 handleUpdateSastConfig: (updates: Partial<SASTConfig>) => Promise<void>;
 handleTriggerScan: () => Promise<void>;
}

export function SastConfigPanel({
 sastConfig,
 sastRulesets,
 isUpdatingSast,
 isRunningScan,
 handleUpdateSastConfig,
 handleTriggerScan,
}: SastConfigPanelProps) {
 return (
 <div className="space-y-4">
 {/* Ruleset Selection */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Semgrep Ruleset
 </label>
 <select
 value={sastConfig.ruleset}
 onChange={(e) => handleUpdateSastConfig({ ruleset: e.target.value as 'default' | 'security' | 'custom' })}
 disabled={isUpdatingSast}
 className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
 >
 {sastRulesets.map((ruleset) => (
 <option key={ruleset.id} value={ruleset.id}>
 {ruleset.name} - {ruleset.description}
 </option>
 ))}
 </select>
 </div>

 {/* Severity Threshold */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Minimum Severity to Report
 </label>
 <select
 value={sastConfig.severityThreshold}
 onChange={(e) => handleUpdateSastConfig({ severityThreshold: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' })}
 disabled={isUpdatingSast}
 className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
 >
 <option value="CRITICAL">Critical only</option>
 <option value="HIGH">High and above</option>
 <option value="MEDIUM">Medium and above</option>
 <option value="LOW">All findings (including low)</option>
 </select>
 </div>

 {/* Auto-scan toggle */}
 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 id="auto-scan"
 checked={sastConfig.autoScan}
 onChange={(e) => handleUpdateSastConfig({ autoScan: e.target.checked })}
 disabled={isUpdatingSast}
 className="h-4 w-4 rounded border-border text-warning focus:ring-warning"
 />
 <label htmlFor="auto-scan" className="text-sm text-foreground">
 Automatically scan on repository changes
 </label>
 </div>

 {/* Trigger Scan Button */}
 <div className="pt-4 border-t border-border">
 <button
 onClick={handleTriggerScan}
 disabled={isRunningScan || isUpdatingSast}
 className="flex items-center gap-2 rounded-md bg-warning px-4 py-2 text-sm font-medium text-white hover:bg-warning/90 disabled:opacity-50"
 >
 {isRunningScan ? (
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
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 Run SAST Scan
 </>
 )}
 </button>
 {sastConfig.lastScanAt && (
 <p className="mt-2 text-xs text-muted-foreground">
 Last scan: {new Date(sastConfig.lastScanAt).toLocaleString()}
 {sastConfig.lastScanStatus && (
 <span className={`ml-2 ${
 sastConfig.lastScanStatus === 'completed' ? 'text-success' :
 sastConfig.lastScanStatus === 'failed' ? 'text-destructive' :
 'text-warning'
 }`}>
 ({sastConfig.lastScanStatus})
 </span>
 )}
 </p>
 )}
 </div>

 {/* GitHub PR Integration Settings */}
 <div className="pt-4 mt-4 border-t border-border">
 <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
 <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
 <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
 </svg>
 GitHub PR Integration
 </h4>
 <p className="text-xs text-muted-foreground mb-4">
 Configure how SAST scans integrate with GitHub pull requests
 </p>

 <div className="space-y-3">
 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 id="sast-pr-checks"
 checked={sastConfig.prChecksEnabled || false}
 onChange={(e) => handleUpdateSastConfig({ prChecksEnabled: e.target.checked })}
 disabled={isUpdatingSast}
 className="h-4 w-4 rounded border-border text-warning focus:ring-warning"
 />
 <label htmlFor="sast-pr-checks" className="text-sm text-foreground">
 Enable SAST checks on pull requests
 </label>
 </div>

 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 id="sast-pr-comments"
 checked={sastConfig.prCommentsEnabled || false}
 onChange={(e) => handleUpdateSastConfig({ prCommentsEnabled: e.target.checked })}
 disabled={isUpdatingSast || !sastConfig.prChecksEnabled}
 className="h-4 w-4 rounded border-border text-warning focus:ring-warning disabled:opacity-50"
 />
 <label htmlFor="sast-pr-comments" className={`text-sm ${sastConfig.prChecksEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
 Post SAST findings as PR comments
 </label>
 </div>

 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 id="sast-block-critical"
 checked={sastConfig.blockPrOnCritical || false}
 onChange={(e) => handleUpdateSastConfig({ blockPrOnCritical: e.target.checked })}
 disabled={isUpdatingSast || !sastConfig.prChecksEnabled}
 className="h-4 w-4 rounded border-border text-destructive focus:ring-destructive disabled:opacity-50"
 />
 <label htmlFor="sast-block-critical" className={`text-sm ${sastConfig.prChecksEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
 <span className="text-destructive font-medium">Block PR</span> if critical vulnerabilities found
 </label>
 </div>

 <div className="flex items-center gap-3">
 <input
 type="checkbox"
 id="sast-block-high"
 checked={sastConfig.blockPrOnHigh || false}
 onChange={(e) => handleUpdateSastConfig({ blockPrOnHigh: e.target.checked })}
 disabled={isUpdatingSast || !sastConfig.prChecksEnabled}
 className="h-4 w-4 rounded border-border text-warning focus:ring-warning disabled:opacity-50"
 />
 <label htmlFor="sast-block-high" className={`text-sm ${sastConfig.prChecksEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
 <span className="text-warning font-medium">Block PR</span> if high or critical vulnerabilities found
 </label>
 </div>
 </div>

 {sastConfig.prChecksEnabled && (
 <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
 <p className="text-xs text-primary">
 <strong>Note:</strong> SAST checks will automatically run when a PR is created or updated.
 {sastConfig.blockPrOnCritical && ' PRs with critical vulnerabilities will be blocked from merging.'}
 {sastConfig.blockPrOnHigh && !sastConfig.blockPrOnCritical && ' PRs with high or critical vulnerabilities will be blocked from merging.'}
 </p>
 </div>
 )}
 </div>
 </div>
 );
}
