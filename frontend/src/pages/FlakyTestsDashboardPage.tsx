// Feature #1441: FlakyTestsDashboardPage extracted from App.tsx (~1,575 lines)
// Feature #717: Refactored - state extracted into useFlakyTestsFilters + useFlakyTestsModals
// Feature #636: Adopt Modal component in page-level inline modals
// Features #1102-1107: Flaky test management, quarantine, suggestions, impact report
// Feature #76: Migrated to React Query with caching
// Feature #336: Dark-first design system redesign

import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { toast } from '../stores/toastStore';
// Feature #336: Design system components
import {
 PageHeader,
 AnimatedCard,
 StatusPill,
} from '../components/ui';
import { RefreshCw, Settings2 } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import {
 useFlakyTests,
 useFlakyImpactReport,
 useAutoQuarantineSettings,
 useRetryStrategySettings,
 useRetryStrategyPreview,
 useQuarantineTest,
 useReleaseFromQuarantine,
 useRunAutoQuarantine,
 useUpdateAutoQuarantineSettings,
 useUpdateRetryStrategySettings,
 type RetryStrategySettings,
 type AutoQuarantineSettings,
} from '../hooks/api/useFlakyTests';
// Feature #717: Extracted state hooks
import { useFlakyTestsFilters } from '../hooks/useFlakyTestsFilters';
import { useFlakyTestsModals, type FlakyTest, type SuggestionsData, type AutoQuarantineResult } from '../hooks/useFlakyTestsModals';

// ============================================================================
// Sub-components (Feature #717: Split from monolith)
// ============================================================================

/** Sparkline component for trend visualization */
function Sparkline({ runs }: { runs?: Array<{ result: 'passed' | 'failed'; timestamp: string }> }) {
 if (!runs || runs.length === 0) {
   return <span className="text-xs text-muted-foreground">No data</span>;
 }
 return (
   <div className="flex gap-px h-4 w-24">
     {runs.slice(-10).map((run, idx) => (
       <div
         key={idx}
         className={`flex-1 rounded-sm ${
           run.result === 'passed' ? 'bg-success' : 'bg-destructive'
         }`}
         title={`${run.result === 'passed' ? '✓ Passed' : '✗ Failed'}`}
       />
     ))}
   </div>
 );
}

/** Get severity badge styling */
function getSeverityBadge(score: number) {
 if (score >= 0.7) return { label: 'High', class: 'bg-destructive/10 text-destructive' };
 if (score >= 0.4) return { label: 'Medium', class: 'bg-warning/10 text-warning' };
 return { label: 'Low', class: 'bg-warning/10 text-warning' };
}

// ============================================================================
// Filter Bar
// ============================================================================
function FlakyTestsFilterBar({
 filters,
 projects,
}: {
 filters: ReturnType<typeof useFlakyTestsFilters>;
 projects: Array<{ id: string; name: string }>;
}) {
 return (
   <div className="rounded-lg border border-border bg-card p-4 mb-6">
     <div className="flex flex-wrap items-center gap-4">
       <div className="flex items-center gap-2">
         <label className="text-sm font-medium text-foreground">Project:</label>
         <select
           value={filters.projectFilter}
           onChange={(e) => filters.setProjectFilter(e.target.value)}
           className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
         >
           <option value="all">All Projects</option>
           {projects.map((p) => (
             <option key={p.id} value={p.id}>{p.name}</option>
           ))}
         </select>
       </div>

       <div className="flex items-center gap-2">
         <label className="text-sm font-medium text-foreground">Suite:</label>
         <select
           value={filters.suiteFilter}
           onChange={(e) => filters.setSuiteFilter(e.target.value)}
           className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
         >
           <option value="all">All Suites</option>
           {filters.availableSuites.map((s) => (
             <option key={s.id} value={s.id}>{s.name}</option>
           ))}
         </select>
       </div>

       <div className="flex items-center gap-2">
         <label className="text-sm font-medium text-foreground">Severity:</label>
         <select
           value={filters.severityFilter}
           onChange={(e) => filters.setSeverityFilter(e.target.value as 'all' | 'high' | 'medium' | 'low')}
           className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
         >
           <option value="all">All Severities</option>
           <option value="high">🔴 High (≥0.7)</option>
           <option value="medium">🟠 Medium (0.4-0.7)</option>
           <option value="low">🟡 Low (&lt;0.4)</option>
         </select>
       </div>

       <div className="flex items-center gap-2 ml-auto">
         <label className="text-sm font-medium text-foreground">Sort by:</label>
         <select
           value={filters.sortBy}
           onChange={(e) => filters.setSortBy(e.target.value as 'score' | 'name' | 'runs')}
           className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
         >
           <option value="score">Flakiness Score</option>
           <option value="name">Test Name</option>
           <option value="runs">Total Runs</option>
         </select>
         <button
           onClick={filters.toggleSortOrder}
           className="px-2 py-1.5 rounded-md border border-input bg-background hover:bg-muted transition-colors"
           title={filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
         >
           {filters.sortOrder === 'asc' ? '↑' : '↓'}
         </button>
       </div>
     </div>
   </div>
 );
}

// ============================================================================
// Tests Table
// ============================================================================
function FlakyTestsTable({
 tests,
 isLoading,
 allTests,
 onInvestigate,
 onQuarantine,
 onRelease,
 onGetSuggestions,
 onAnalyzeFlakiness,
 onIgnore,
}: {
 tests: FlakyTest[];
 isLoading: boolean;
 allTests: FlakyTest[];
 onInvestigate: (testId: string) => void;
 onQuarantine: (testId: string) => void;
 onRelease: (testId: string, testName: string) => void;
 onGetSuggestions: (testId: string) => void;
 onAnalyzeFlakiness: (test: FlakyTest) => void;
 onIgnore: (testId: string) => void;
}) {
 if (isLoading) {
   return (
     <div className="rounded-lg border border-border bg-card p-8 text-center">
       <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
       <p className="text-muted-foreground">Loading flaky tests...</p>
     </div>
   );
 }

 if (tests.length === 0) {
   return (
     <div className="rounded-lg border border-border bg-card p-8 text-center">
       <div className="text-4xl mb-3">✅</div>
       <p className="text-foreground font-medium">No flaky tests found!</p>
       <p className="text-sm text-muted-foreground mt-2">
         {allTests.length > 0 ? 'Try adjusting your filters.' : 'Your tests are running consistently. Keep up the good work!'}
       </p>
     </div>
   );
 }

 return (
   <div className="rounded-lg border border-border bg-card overflow-hidden">
     <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 border-b border-border text-sm font-medium text-muted-foreground">
       <div className="col-span-4">Test</div>
       <div className="col-span-2 text-center">Flakiness Score</div>
       <div className="col-span-2 text-center">Trend</div>
       <div className="col-span-1 text-center">Runs</div>
       <div className="col-span-3 text-right">Actions</div>
     </div>

     {tests.map((test) => {
       const score = test.flakiness_score || test.flakiness_percentage / 100;
       const severity = getSeverityBadge(score);

       return (
         <div key={test.test_id} className="grid grid-cols-12 gap-4 p-4 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors items-center">
           <div className="col-span-4">
             <button onClick={() => onInvestigate(test.test_id)} className="font-medium text-foreground hover:text-primary text-left">{test.test_name}</button>
             <p className="text-xs text-muted-foreground mt-0.5">{test.suite_name} / {test.project_name}</p>
             <div className="flex items-center gap-1.5 mt-1">
               <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${severity.class}`}>{severity.label}</span>
               {test.is_retry_flaky && <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">🔄 Retry</span>}
               {test.has_time_pattern && <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">⏰ Time</span>}
               {test.has_environment_pattern && <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-info/10 text-info">🖥️ Env</span>}
               {test.quarantined && <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/30">🏥 Quarantined</span>}
             </div>
           </div>
           <div className="col-span-2 text-center">
             <div className="inline-flex flex-col items-center">
               <span className={`text-lg font-bold ${score >= 0.7 ? 'text-destructive' : score >= 0.4 ? 'text-warning' : 'text-success'}`}>{score.toFixed(2)}</span>
               <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                 <div className={`h-full ${score >= 0.7 ? 'bg-destructive' : score >= 0.4 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${score * 100}%` }} />
               </div>
             </div>
           </div>
           <div className="col-span-2 flex justify-center"><Sparkline runs={test.recent_runs} /></div>
           <div className="col-span-1 text-center">
             <span className="text-sm text-foreground">{test.total_runs}</span>
             <p className="text-xs text-muted-foreground">{test.pass_rate}% pass</p>
           </div>
           <div className="col-span-3 flex justify-end gap-2">
             {test.quarantined ? (
               <button onClick={() => onRelease(test.test_id, test.test_name)} className="px-2 py-1 text-xs font-medium rounded border border-success/30 bg-success/5 text-success hover:bg-success/10 transition-colors" title="Release from quarantine">🔓 Release</button>
             ) : (
               <button onClick={() => onQuarantine(test.test_id)} className="px-2 py-1 text-xs font-medium rounded border border-warning/30 bg-warning/5 text-warning hover:bg-warning/10 transition-colors" title="Quarantine this test">🏥 Quarantine</button>
             )}
             <button onClick={() => onAnalyzeFlakiness(test)} className="px-2 py-1 text-xs font-medium rounded border border-accent/30 bg-gradient-to-r from-accent/10 to-accent/5 text-accent hover:from-accent/20 hover:to-accent/10 transition-colors" title="AI analysis: why is this test flaky?">🤖 Why Flaky?</button>
             <button onClick={() => onGetSuggestions(test.test_id)} className="px-2 py-1 text-xs font-medium rounded border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors" title="Get AI suggestions to fix this flaky test">💡 Suggestions</button>
             <button onClick={() => onInvestigate(test.test_id)} className="px-2 py-1 text-xs font-medium rounded border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors" title="Investigate test details">🔍 Investigate</button>
             <button onClick={() => onIgnore(test.test_id)} className="px-2 py-1 text-xs font-medium rounded border border-border bg-muted text-foreground hover:bg-muted transition-colors" title="Ignore this test">🙈 Ignore</button>
           </div>
         </div>
       );
     })}
   </div>
 );
}

// ============================================================================
// Summary Stats
// ============================================================================
function FlakyTestsSummaryStats({ tests }: { tests: FlakyTest[] }) {
 if (tests.length === 0) return null;
 return (
   <div className="grid grid-cols-5 gap-4 mt-6">
     <div className="rounded-lg border border-border bg-card p-4">
       <div className="text-3xl font-bold text-destructive">{tests.filter(t => (t.flakiness_score || t.flakiness_percentage / 100) >= 0.7).length}</div>
       <div className="text-sm text-muted-foreground">High Severity</div>
     </div>
     <div className="rounded-lg border border-border bg-card p-4">
       <div className="text-3xl font-bold text-warning">{tests.filter(t => { const s = t.flakiness_score || t.flakiness_percentage / 100; return s >= 0.4 && s < 0.7; }).length}</div>
       <div className="text-sm text-muted-foreground">Medium Severity</div>
     </div>
     <div className="rounded-lg border border-border bg-card p-4">
       <div className="text-3xl font-bold text-warning">{tests.filter(t => (t.flakiness_score || t.flakiness_percentage / 100) < 0.4).length}</div>
       <div className="text-sm text-muted-foreground">Low Severity</div>
     </div>
     <div className="rounded-lg border border-border bg-card p-4">
       <div className="text-3xl font-bold text-foreground">{tests.filter(t => t.is_retry_flaky).length}</div>
       <div className="text-sm text-muted-foreground">Retry Flaky</div>
     </div>
     <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
       <div className="text-3xl font-bold text-warning">{tests.filter(t => t.quarantined).length}</div>
       <div className="text-sm text-warning">Quarantined</div>
     </div>
   </div>
 );
}

// ============================================================================
// Auto-Quarantine Settings Panel
// ============================================================================
function AutoQuarantinePanel({ settings, onClose, onUpdate, onRun, isRunning, result }: {
 settings: AutoQuarantineSettings; onClose: () => void; onUpdate: (u: Partial<AutoQuarantineSettings>) => void; onRun: () => void; isRunning: boolean; result: AutoQuarantineResult | null;
}) {
 return (
   <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 mb-6">
     <div className="flex items-center justify-between mb-4">
       <h2 className="text-lg font-semibold text-warning flex items-center gap-2"><span>🤖</span> Auto-Quarantine Settings</h2>
       <button onClick={onClose} className="text-warning hover:text-warning">×</button>
     </div>
     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
       <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-warning/20">
         <label className="flex items-center gap-2 cursor-pointer flex-1">
           <input type="checkbox" checked={settings.enabled} onChange={(e) => onUpdate({ enabled: e.target.checked })} className="w-5 h-5 rounded border-border text-warning focus:ring-warning" />
           <span className="text-sm font-medium text-foreground">Enabled</span>
         </label>
         <span className={`px-2 py-0.5 rounded text-xs font-medium ${settings.enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{settings.enabled ? 'Active' : 'Disabled'}</span>
       </div>
       <div className="p-3 rounded-lg bg-card border border-warning/20">
         <label className="text-xs font-medium text-muted-foreground block mb-1">Flakiness Threshold</label>
         <div className="flex items-center gap-2">
           <input type="range" min="0.3" max="1.0" step="0.05" value={settings.threshold} onChange={(e) => onUpdate({ threshold: parseFloat(e.target.value) })} className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-amber-600" />
           <span className="text-sm font-bold text-warning min-w-[3rem] text-right">{(settings.threshold * 100).toFixed(0)}%</span>
         </div>
       </div>
       <div className="p-3 rounded-lg bg-card border border-warning/20">
         <label className="text-xs font-medium text-muted-foreground block mb-1">Min Runs Required</label>
         <select value={settings.min_runs} onChange={(e) => onUpdate({ min_runs: parseInt(e.target.value) })} className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm">
           {[2, 3, 5, 10, 15, 20].map(n => <option key={n} value={n}>{n} runs</option>)}
         </select>
       </div>
       <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-warning/20">
         <label className="flex items-center gap-2 cursor-pointer flex-1">
           <input type="checkbox" checked={settings.notify_on_quarantine} onChange={(e) => onUpdate({ notify_on_quarantine: e.target.checked })} className="w-5 h-5 rounded border-border text-warning focus:ring-warning" />
           <span className="text-sm font-medium text-foreground">🔔 Notify on Quarantine</span>
         </label>
       </div>
     </div>
     <div className="flex items-center gap-4">
       <button onClick={onRun} disabled={!settings.enabled || isRunning} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${settings.enabled && !isRunning ? 'bg-warning text-primary-foreground hover:bg-warning' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}>
         {isRunning ? <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Running...</> : <><span>🚀</span> Run Auto-Quarantine Now</>}
       </button>
       <p className="text-xs text-muted-foreground">Tests with flakiness score ≥ {(settings.threshold * 100).toFixed(0)}% and at least {settings.min_runs} runs will be automatically quarantined</p>
     </div>
     {result && result.tests_quarantined > 0 && (
       <div className="mt-4 p-3 rounded-lg bg-success/5 border border-success/30">
         <h3 className="text-sm font-semibold text-success mb-2">✅ Auto-Quarantined {result.tests_quarantined} Test(s)</h3>
         <ul className="text-sm text-success space-y-1">
           {result.quarantined_tests.map(t => <li key={t.test_id} className="flex items-center gap-2"><span className="font-medium">{t.test_name}</span><span className="text-xs px-1.5 py-0.5 rounded bg-success/10">{(t.flakiness_score * 100).toFixed(0)}% flaky</span></li>)}
         </ul>
       </div>
     )}
   </div>
 );
}

// ============================================================================
// Retry Strategy Settings Panel
// ============================================================================
function RetryStrategyPanel({ settings, preview, onClose, onUpdate }: {
 settings: RetryStrategySettings; preview: { total_flaky_tests: number; by_rule: Array<{ test_count: number; range: string; retries: number }> } | null; onClose: () => void; onUpdate: (u: Partial<RetryStrategySettings>) => void;
}) {
 const handleUpdateRuleRetries = (ruleIndex: number, newRetries: number) => {
   const updatedRules = [...settings.rules];
   updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], retries: newRetries };
   onUpdate({ rules: updatedRules });
 };

 return (
   <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-6">
     <div className="flex items-center justify-between mb-4">
       <h2 className="text-lg font-semibold text-primary flex items-center gap-2"><span>🔄</span> Retry Strategy Settings</h2>
       <button onClick={onClose} className="text-primary hover:text-primary">×</button>
     </div>
     <p className="text-sm text-primary mb-4">Configure how many retries to apply to tests based on their flakiness score.</p>
     <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-primary/20 mb-4 w-fit">
       <label className="flex items-center gap-2 cursor-pointer">
         <input type="checkbox" checked={settings.enabled} onChange={(e) => onUpdate({ enabled: e.target.checked })} className="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
         <span className="text-sm font-medium text-foreground">Enable Dynamic Retry Strategy</span>
       </label>
       <span className={`px-2 py-0.5 rounded text-xs font-medium ${settings.enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{settings.enabled ? 'Active' : 'Disabled'}</span>
     </div>
     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
       {settings.rules.map((rule, index) => {
         const severityLabel = rule.max_score <= 0.3 ? 'Low' : rule.max_score <= 0.6 ? 'Medium' : 'High';
         const severityColor = severityLabel === 'Low' ? 'border-success/30 bg-success/5' : severityLabel === 'Medium' ? 'border-warning/30 bg-warning/5' : 'border-destructive/30 bg-destructive/5';
         const textColor = severityLabel === 'Low' ? 'text-success' : severityLabel === 'Medium' ? 'text-warning' : 'text-destructive';
         return (
           <div key={index} className={`p-4 rounded-lg border ${severityColor}`}>
             <div className="flex items-center justify-between mb-2">
               <span className={`text-sm font-semibold ${textColor}`}>{severityLabel} Flakiness</span>
               <span className={`text-xs px-2 py-0.5 rounded ${severityLabel === 'Low' ? 'bg-success/10 text-success' : severityLabel === 'Medium' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                 {(rule.min_score * 100).toFixed(0)}% - {rule.max_score >= 1 ? '100' : (rule.max_score * 100).toFixed(0)}%
               </span>
             </div>
             <div className="flex items-center gap-2">
               <label className="text-xs text-muted-foreground">Retries:</label>
               <select value={rule.retries} onChange={(e) => handleUpdateRuleRetries(index, parseInt(e.target.value))} disabled={!settings.enabled} className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50">
                 {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {n === 1 ? 'retry' : 'retries'}</option>)}
               </select>
             </div>
             {preview && <div className="mt-2 text-xs text-muted-foreground">{preview.by_rule[index]?.test_count || 0} tests in this range</div>}
           </div>
         );
       })}
     </div>
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
       <div className="p-3 rounded-lg bg-card border border-primary/20">
         <label className="text-xs font-medium text-muted-foreground block mb-1">Default Retries (for tests without flakiness data)</label>
         <select value={settings.default_retries} onChange={(e) => onUpdate({ default_retries: parseInt(e.target.value) })} disabled={!settings.enabled} className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50">
           {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n} {n === 1 ? 'retry' : 'retries'}</option>)}
         </select>
       </div>
       <div className="p-3 rounded-lg bg-card border border-primary/20">
         <label className="text-xs font-medium text-muted-foreground block mb-1">Maximum Retries Allowed</label>
         <select value={settings.max_retries} onChange={(e) => onUpdate({ max_retries: parseInt(e.target.value) })} disabled={!settings.enabled} className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50">
           {[1, 2, 3, 4, 5, 7, 10].map(n => <option key={n} value={n}>{n} {n === 1 ? 'retry' : 'retries'}</option>)}
         </select>
       </div>
     </div>
     {preview && preview.total_flaky_tests > 0 && (
       <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
         <h3 className="text-sm font-semibold text-primary mb-2">📊 Current Retry Distribution</h3>
         <div className="grid grid-cols-3 gap-2 text-center">
           {preview.by_rule.map((rule, idx) => <div key={idx} className="p-2 rounded bg-card"><div className="text-lg font-bold text-primary">{rule.test_count}</div><div className="text-xs text-muted-foreground">{rule.range}</div><div className="text-xs text-primary">{rule.retries} {rule.retries === 1 ? 'retry' : 'retries'}</div></div>)}
         </div>
         <p className="text-xs text-primary mt-2 text-center">Total: {preview.total_flaky_tests} flaky tests configured for dynamic retries</p>
       </div>
     )}
   </div>
 );
}

// ============================================================================
// Impact Report Section
// ============================================================================
function ImpactReportSection({ show, onClose, isLoading, impactReport, onNavigate }: {
 show: boolean; onClose: () => void; isLoading: boolean; impactReport: any; onNavigate: (path: string) => void;
}) {
 if (!show) return null;
 return (
   <div className="mt-8 rounded-lg border border-border bg-card p-6">
     <div className="flex items-center justify-between mb-6">
       <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><span className="text-xl">💰</span> Flaky Test Impact Report</h2>
       <button onClick={onClose} className="text-muted-foreground hover:text-foreground" title="Hide section">×</button>
     </div>
     {isLoading ? (
       <div className="flex items-center justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /><span className="ml-2 text-muted-foreground">Loading impact data...</span></div>
     ) : !impactReport ? (
       <div className="text-center py-8 text-muted-foreground"><p>No impact data available</p></div>
     ) : (
       <div className="space-y-6">
         <div className="text-sm text-muted-foreground">📅 Report period: {new Date(impactReport.report_period.start).toLocaleDateString()} - {new Date(impactReport.report_period.end).toLocaleDateString()} ({impactReport.report_period.days} days)</div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="rounded-lg border border-warning/20 bg-warning/5 p-4"><div className="flex items-center gap-2 mb-2"><span className="text-lg">⏱️</span><span className="text-sm font-medium text-warning">CI Time Wasted</span></div><div className="text-2xl font-bold text-warning">{impactReport.impact.ci_time_wasted.hours}h</div><div className="text-sm text-warning">({impactReport.impact.ci_time_wasted.minutes} minutes)</div><div className="text-sm font-medium text-warning mt-1">${impactReport.impact.ci_time_wasted.cost_usd.toFixed(2)} cost</div></div>
           <div className="rounded-lg border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-2 mb-2"><span className="text-lg">👩‍💻</span><span className="text-sm font-medium text-primary">Developer Time</span></div><div className="text-2xl font-bold text-primary">{impactReport.impact.developer_time_investigating.hours}h</div><div className="text-sm text-primary">investigating issues</div><div className="text-sm font-medium text-primary mt-1">${impactReport.impact.developer_time_investigating.cost_usd.toFixed(2)} cost</div></div>
           <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"><div className="flex items-center gap-2 mb-2"><span className="text-lg">🚨</span><span className="text-sm font-medium text-destructive">False Alerts</span></div><div className="text-2xl font-bold text-destructive">{impactReport.impact.false_failure_alerts.count}</div><div className="text-sm text-destructive">false positives</div><div className="text-sm font-medium text-destructive mt-1">{impactReport.impact.false_failure_alerts.estimated_noise_percentage}% noise</div></div>
           <div className="rounded-lg border border-success/20 bg-success/5 p-4"><div className="flex items-center gap-2 mb-2"><span className="text-lg">💵</span><span className="text-sm font-medium text-success">Total Cost Impact</span></div><div className="text-2xl font-bold text-success">${impactReport.impact.total_cost_impact.usd.toFixed(2)}</div><div className="text-sm text-success">this month</div><div className="text-sm font-medium text-success mt-1">${impactReport.impact.total_cost_impact.annual_projection_usd.toFixed(2)}/year projected</div></div>
         </div>
         {impactReport.top_offenders.length > 0 && (
           <div>
             <h3 className="text-sm font-medium text-foreground mb-3">🏆 Top Cost Contributors</h3>
             <div className="rounded-lg border border-border overflow-hidden">
               <table className="w-full text-sm">
                 <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2 font-medium">Test</th><th className="text-center px-4 py-2 font-medium">Flakiness</th><th className="text-center px-4 py-2 font-medium">Retries</th><th className="text-center px-4 py-2 font-medium">CI Time</th><th className="text-center px-4 py-2 font-medium">Dev Time</th><th className="text-right px-4 py-2 font-medium">Est. Cost</th></tr></thead>
                 <tbody>
                   {impactReport.top_offenders.slice(0, 5).map((test: any, idx: number) => (
                     <tr key={test.test_id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => onNavigate(`/tests/${test.test_id}`)}>
                       <td className="px-4 py-2"><span className="text-muted-foreground mr-2">#{idx + 1}</span>{test.test_name}</td>
                       <td className="text-center px-4 py-2"><span className={`px-2 py-1 rounded text-xs font-medium ${test.flakiness_score >= 0.7 ? 'bg-destructive/10 text-destructive' : test.flakiness_score >= 0.4 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>{(test.flakiness_score * 100).toFixed(0)}%</span></td>
                       <td className="text-center px-4 py-2">{test.retries}</td>
                       <td className="text-center px-4 py-2">{test.ci_time_wasted_minutes}m</td>
                       <td className="text-center px-4 py-2">{test.estimated_dev_time_minutes}m</td>
                       <td className="text-right px-4 py-2 font-medium text-destructive">${test.estimated_cost.toFixed(2)}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
         )}
         {impactReport.recommendations.length > 0 && (
           <div>
             <h3 className="text-sm font-medium text-foreground mb-3">💡 Recommendations</h3>
             <div className="space-y-2">
               {impactReport.recommendations.map((rec: any, idx: number) => (
                 <div key={idx} className={`rounded-lg border p-3 ${rec.priority === 'high' ? 'border-destructive/20 bg-destructive/5' : rec.priority === 'medium' ? 'border-warning/20 bg-warning/5' : 'border-border bg-muted'}`}>
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${rec.priority === 'high' ? 'bg-destructive/20 text-destructive' : rec.priority === 'medium' ? 'bg-warning/20 text-warning' : 'bg-secondary text-foreground'}`}>{rec.priority}</span>
                       <span className="font-medium">{rec.action}</span>
                     </div>
                     <span className="text-sm text-success font-medium">Save ~${rec.estimated_savings_usd.toFixed(2)}</span>
                   </div>
                   <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                 </div>
               ))}
             </div>
           </div>
         )}
       </div>
     )}
   </div>
 );
}

// ============================================================================
// Suggestions Modal Content
// ============================================================================
function SuggestionsModalContent({ isLoading, suggestions }: { isLoading: boolean; suggestions: SuggestionsData | null }) {
 if (isLoading) return <div className="flex flex-col items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mb-4" /><p className="text-muted-foreground">Analyzing failure patterns...</p></div>;
 if (!suggestions) return <div className="text-center py-8 text-muted-foreground"><p>Failed to load suggestions. Please try again.</p></div>;
 return (
   <div className="space-y-6">
     <div className="p-4 rounded-lg border border-accent/20 bg-accent/5">
       <h3 className="text-sm font-semibold text-accent mb-3">📊 Analysis Summary</h3>
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
         <div><div className="text-2xl font-bold text-foreground">{suggestions.analysis.total_runs}</div><div className="text-xs text-muted-foreground">Total Runs</div></div>
         <div><div className="text-2xl font-bold text-destructive">{suggestions.analysis.flakiness_percentage}%</div><div className="text-xs text-muted-foreground">Flakiness Score</div></div>
         <div><div className="text-2xl font-bold text-success">{suggestions.analysis.pass_count}</div><div className="text-xs text-muted-foreground">Passes</div></div>
         <div><div className="text-2xl font-bold text-destructive">{suggestions.analysis.fail_count}</div><div className="text-xs text-muted-foreground">Failures</div></div>
       </div>
       {suggestions.analysis.patterns_detected.length > 0 && <div className="flex flex-wrap gap-2"><span className="text-xs text-muted-foreground">Patterns detected:</span>{suggestions.analysis.patterns_detected.map((p, i) => <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent">{p}</span>)}</div>}
     </div>
     <div>
       <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">🔧 Remediation Suggestions ({suggestions.suggestions_count})<span className="px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive">{suggestions.high_priority_count} high priority</span></h3>
       <div className="space-y-4">
         {suggestions.suggestions.map(s => (
           <div key={s.id} className={`rounded-lg border p-4 ${s.priority === 'high' ? 'border-destructive/20 bg-destructive/5' : s.priority === 'medium' ? 'border-warning/20 bg-warning/5' : 'border-border bg-muted/50'}`}>
             <div className="flex items-start justify-between mb-2"><div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${s.priority === 'high' ? 'bg-destructive/20 text-destructive' : s.priority === 'medium' ? 'bg-warning/20 text-warning' : 'bg-secondary text-foreground'}`}>{s.priority}</span><span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">{s.category.replace(/_/g, ' ')}</span><span className="text-xs text-muted-foreground">{Math.round(s.confidence * 100)}% confidence</span></div></div>
             <h4 className="font-semibold text-foreground mb-1">{s.title}</h4>
             <p className="text-sm text-muted-foreground mb-2">{s.description}</p>
             <div className="text-xs text-accent mb-3"><strong>Pattern matched:</strong> {s.pattern_matched}</div>
             {s.code_example && (
               <div className="mb-3 rounded-lg bg-background p-4 overflow-x-auto">
                 <div className="flex gap-4 mb-3"><div className="flex-1"><div className="text-xs text-destructive mb-2 font-semibold">❌ Before</div><pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{s.code_example.before}</pre></div><div className="w-px bg-card" /><div className="flex-1"><div className="text-xs text-success mb-2 font-semibold">✅ After</div><pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{s.code_example.after}</pre></div></div>
                 <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">💡 {s.code_example.explanation}</p>
               </div>
             )}
             <div className="grid grid-cols-2 gap-4 text-sm"><div><div className="text-xs font-medium text-success mb-1">Impact</div><p className="text-muted-foreground">{s.impact}</p></div><div><div className="text-xs font-medium text-primary mb-1">Implementation Steps</div><ol className="text-muted-foreground list-decimal list-inside text-xs space-y-0.5">{s.implementation_steps.map((step, i) => <li key={i}>{step}</li>)}</ol></div></div>
           </div>
         ))}
       </div>
     </div>
     {suggestions.suggestions.length === 0 && <div className="text-center py-8 text-muted-foreground"><p className="text-lg mb-2">✅ No specific suggestions at this time</p><p className="text-sm">The test failure patterns don't match known flakiness issues.</p></div>}
   </div>
 );
}

// ============================================================================
// Main Page Component (Feature #717: Composed from hooks + sub-components)
// 0 useState in main component - all state in extracted hooks
// ============================================================================
export function FlakyTestsDashboardPage() {
 const navigate = useNavigate();

 // Feature #76: React Query hooks for data fetching with caching
 const { data: flakyTestsData, isLoading: isLoadingFlakyTests, refetch: refetchFlakyTests } = useFlakyTests();
 const { data: impactReportData, isLoading: isLoadingImpactReport } = useFlakyImpactReport();
 const { data: autoQuarantineData, refetch: refetchAutoQuarantine } = useAutoQuarantineSettings();
 const { data: retryStrategyData, refetch: refetchRetryStrategy } = useRetryStrategySettings();
 const { data: retryPreviewData, refetch: refetchRetryPreview } = useRetryStrategyPreview();

 // React Query mutations
 const updateAutoQuarantineMutation = useUpdateAutoQuarantineSettings();
 const updateRetryStrategyMutation = useUpdateRetryStrategySettings();
 const quarantineTestMutation = useQuarantineTest();
 const releaseQuarantineMutation = useReleaseFromQuarantine();
 const runAutoQuarantineMutation = useRunAutoQuarantine();

 // Use React Query data with defaults
 const flakyTests = (flakyTestsData?.flakyTests || []) as FlakyTest[];
 const projects = flakyTestsData?.projects || [];
 const suites = flakyTestsData?.suites || [];
 const autoQuarantineSettings = autoQuarantineData || null;
 const retryStrategySettings = retryStrategyData || null;
 const retryStrategyPreview = retryPreviewData || null;

 // Feature #717: Extracted state hooks (0 useState in main component!)
 const filters = useFlakyTestsFilters(flakyTests, suites);
 const modals = useFlakyTestsModals();

 // Handlers using React Query mutations
 const handleUpdateRetryStrategySettings = (updates: Partial<RetryStrategySettings>) => {
   updateRetryStrategyMutation.mutate(updates, {
     onSuccess: () => { toast.success('Retry strategy settings updated'); refetchRetryStrategy(); refetchRetryPreview(); },
     onError: () => { toast.error('Failed to update retry strategy settings'); },
   });
 };

 const handleRunAutoQuarantine = () => {
   modals.setIsLoadingAutoQuarantine(true);
   runAutoQuarantineMutation.mutate(undefined, {
     onSuccess: (data) => {
       modals.setAutoQuarantineResult(data);
       if (data.tests_quarantined > 0) { toast.success(`Auto-quarantined ${data.tests_quarantined} test(s) exceeding threshold`); refetchFlakyTests(); }
       else { toast.info('No tests exceeded the auto-quarantine threshold'); }
     },
     onError: () => { toast.error('Failed to run auto-quarantine check'); },
     onSettled: () => { modals.setIsLoadingAutoQuarantine(false); },
   });
 };

 const handleUpdateAutoQuarantineSettings = (updates: Partial<AutoQuarantineSettings>) => {
   updateAutoQuarantineMutation.mutate(updates, {
     onSuccess: () => { toast.success('Auto-quarantine settings updated'); refetchAutoQuarantine(); },
     onError: () => { toast.error('Failed to update settings'); },
   });
 };

 const handleQuarantine = (testId: string) => {
   quarantineTestMutation.mutate({ testId, reason: 'Flaky test - investigating' }, {
     onSuccess: (data) => { toast.success(`Test "${data.test_name}" quarantined successfully`); refetchFlakyTests(); },
     onError: (error) => { toast.error(error instanceof Error ? error.message : 'Failed to quarantine test'); },
   });
 };

 const confirmReleaseFromQuarantine = () => {
   if (!modals.testToRelease) return;
   modals.setIsReleasingFromQuarantine(true);
   releaseQuarantineMutation.mutate(modals.testToRelease.test_id, {
     onSuccess: (data) => { toast.success(`Test "${data.test_name}" released from quarantine and is now running normally`, 5000); refetchFlakyTests(); modals.closeReleaseConfirmModal(); },
     onError: (error) => { toast.error(error instanceof Error ? error.message : 'Failed to release test from quarantine'); },
     onSettled: () => { modals.setIsReleasingFromQuarantine(false); },
   });
 };

 const handleIgnore = (testId: string) => { toast.info(`Ignoring test ${testId}... (Feature coming soon)`); };

 return (
   <Layout>
     <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
       <PageHeader
         title="AI Insights - Flaky Tests"
         description="Manage and investigate tests with inconsistent results"
         breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'AI Insights', href: '/ai-insights' }, { label: 'Flaky Tests' }]}
         actions={
           <div className="flex items-center gap-4">
             <button onClick={() => { modals.setShowRetryStrategySettings(!modals.showRetryStrategySettings); if (!modals.showRetryStrategySettings) refetchRetryPreview(); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Configure retry strategy based on flakiness level">
               <RefreshCw className="h-4 w-4" /> Retry Strategy
               {retryStrategySettings?.enabled && <StatusPill status="passed" className="text-[10px]">ON</StatusPill>}
             </button>
             <button onClick={() => modals.setShowAutoQuarantineSettings(!modals.showAutoQuarantineSettings)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-warning/30 bg-warning/10 text-warning hover:bg-warning/20 transition-colors" title="Configure auto-quarantine settings">
               <Settings2 className="h-4 w-4" /> Auto-Quarantine
               {autoQuarantineSettings?.enabled && <StatusPill status="passed" className="text-[10px]">ON</StatusPill>}
             </button>
             <AnimatedCard variant="hero" className="px-4 py-2">
               <div className="text-right"><span className="text-3xl font-bold text-warning">{filters.filteredTests.length}</span><p className="text-sm text-muted-foreground">Flaky Tests</p></div>
             </AnimatedCard>
           </div>
         }
       />

       {modals.showAutoQuarantineSettings && autoQuarantineSettings && <AutoQuarantinePanel settings={autoQuarantineSettings} onClose={() => modals.setShowAutoQuarantineSettings(false)} onUpdate={handleUpdateAutoQuarantineSettings} onRun={handleRunAutoQuarantine} isRunning={modals.isLoadingAutoQuarantine} result={modals.autoQuarantineResult} />}
       {modals.showRetryStrategySettings && retryStrategySettings && <RetryStrategyPanel settings={retryStrategySettings} preview={retryStrategyPreview} onClose={() => modals.setShowRetryStrategySettings(false)} onUpdate={handleUpdateRetryStrategySettings} />}

       <FlakyTestsFilterBar filters={filters} projects={projects} />

       <FlakyTestsTable tests={filters.filteredTests as FlakyTest[]} isLoading={isLoadingFlakyTests} allTests={flakyTests} onInvestigate={(testId) => navigate(`/tests/${testId}`)} onQuarantine={handleQuarantine} onRelease={modals.openReleaseConfirmModal} onGetSuggestions={modals.openSuggestionsModal} onAnalyzeFlakiness={modals.openFlakinessAnalysis} onIgnore={handleIgnore} />

       {!isLoadingFlakyTests && <FlakyTestsSummaryStats tests={flakyTests} />}

       <ImpactReportSection show={modals.showImpactReport} onClose={() => modals.setShowImpactReport(false)} isLoading={isLoadingImpactReport} impactReport={impactReportData} onNavigate={navigate} />

       {/* Suggestions Modal */}
       <Modal isOpen={modals.showSuggestionsModal} onClose={() => modals.setShowSuggestionsModal(false)} title={`AI Suggestions for ${modals.suggestions?.test_name || 'Test'}`} size="xl">
         <ModalBody><SuggestionsModalContent isLoading={modals.isLoadingSuggestions} suggestions={modals.suggestions} /></ModalBody>
       </Modal>

       {/* Release from Quarantine Confirmation Modal */}
       <Modal isOpen={modals.showReleaseConfirmModal && !!modals.testToRelease} onClose={modals.closeReleaseConfirmModal} title="Release from Quarantine" size="md">
         <ModalBody className="space-y-4">
           <div className="p-4 rounded-lg bg-success/5 border border-success/20"><div className="font-semibold text-success mb-1">{modals.testToRelease?.test_name}</div><p className="text-sm text-success">This test will be released from quarantine and will:</p></div>
           <ul className="space-y-2 text-sm text-muted-foreground">
             <li className="flex items-start gap-2"><span className="text-success mt-0.5">✓</span><span>Return to <strong className="text-foreground">normal execution</strong> in CI/CD pipelines</span></li>
             <li className="flex items-start gap-2"><span className="text-success mt-0.5">✓</span><span>Test failures will <strong className="text-foreground">block builds</strong> again</span></li>
             <li className="flex items-start gap-2"><span className="text-primary mt-0.5">🔍</span><span><strong className="text-foreground">Monitoring continues</strong> - if flakiness returns above threshold, the test may be auto-quarantined again</span></li>
           </ul>
           {autoQuarantineSettings?.enabled && <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm"><div className="flex items-center gap-2 text-primary"><span>🤖</span><span className="font-medium">Auto-Quarantine Active</span></div><p className="text-primary mt-1">If this test exceeds {(autoQuarantineSettings.threshold * 100).toFixed(0)}% flakiness after {autoQuarantineSettings.min_runs} runs, it will be automatically re-quarantined.</p></div>}
         </ModalBody>
         <ModalFooter>
           <button onClick={modals.closeReleaseConfirmModal} className="flex-1 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors" disabled={modals.isReleasingFromQuarantine}>Cancel</button>
           <button onClick={confirmReleaseFromQuarantine} disabled={modals.isReleasingFromQuarantine} className="flex-1 px-4 py-2 rounded-lg bg-success text-primary-foreground hover:bg-success transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
             {modals.isReleasingFromQuarantine ? <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Releasing...</> : <><span>🔓</span> Confirm Release</>}
           </button>
         </ModalFooter>
       </Modal>

       {/* AI Flakiness Analysis Modal */}
       <Modal isOpen={modals.showFlakinessAnalysisModal && !!modals.selectedTestForAnalysis} onClose={() => modals.setShowFlakinessAnalysisModal(false)} title="AI Flakiness Analysis" size="lg">
         <ModalBody>
           <div className="grid grid-cols-4 gap-3 mb-4">
             <div className="bg-muted/50 rounded-lg p-2 text-center"><div className="text-lg font-bold text-foreground">{modals.selectedTestForAnalysis?.total_runs}</div><div className="text-xs text-muted-foreground">Total Runs</div></div>
             <div className="bg-muted/50 rounded-lg p-2 text-center"><div className="text-lg font-bold text-destructive">{((modals.selectedTestForAnalysis?.flakiness_score ?? 0) * 100).toFixed(0)}%</div><div className="text-xs text-muted-foreground">Flaky</div></div>
             <div className="bg-muted/50 rounded-lg p-2 text-center"><div className="text-lg font-bold text-success">{modals.selectedTestForAnalysis?.pass_rate}%</div><div className="text-xs text-muted-foreground">Pass Rate</div></div>
             <div className="bg-muted/50 rounded-lg p-2 text-center"><div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">{modals.selectedTestForAnalysis?.has_time_pattern && <span title="Time pattern">⏰</span>}{modals.selectedTestForAnalysis?.has_environment_pattern && <span title="Env pattern">🖥️</span>}{modals.selectedTestForAnalysis?.is_retry_flaky && <span title="Retry flaky">🔄</span>}{!modals.selectedTestForAnalysis?.has_time_pattern && !modals.selectedTestForAnalysis?.has_environment_pattern && !modals.selectedTestForAnalysis?.is_retry_flaky && '—'}</div><div className="text-xs text-muted-foreground">Patterns</div></div>
           </div>
           {modals.isLoadingFlakinessAnalysis ? <div className="flex flex-col items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mb-3" /><p className="text-sm text-muted-foreground">Analyzing flakiness patterns...</p></div> : modals.flakinessAnalysis ? <div className="prose prose-sm max-w-none"><div className="bg-gradient-to-r from-accent/10 to-accent/5 rounded-lg p-4 border border-accent/20"><div className="whitespace-pre-wrap text-sm text-foreground">{modals.flakinessAnalysis}</div></div></div> : null}
           {modals.selectedTestForAnalysis && modals.flakinessAnalysisCache[modals.selectedTestForAnalysis.test_id] && !modals.isLoadingFlakinessAnalysis && <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-1"><span>💾</span> Cached analysis (24hr)</span><button onClick={() => modals.refreshFlakinessAnalysis(modals.selectedTestForAnalysis!)} className="text-accent hover:text-accent/80">🔄 Refresh</button></div>}
         </ModalBody>
         <ModalFooter>
           <button onClick={() => modals.selectedTestForAnalysis && modals.openSuggestionsModal(modals.selectedTestForAnalysis.test_id)} className="px-4 py-2 text-sm font-medium rounded-lg border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors">💡 Get Fix Suggestions</button>
           <button onClick={() => modals.setShowFlakinessAnalysisModal(false)} className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Close</button>
         </ModalFooter>
       </Modal>
     </div>
   </Layout>
 );
}
