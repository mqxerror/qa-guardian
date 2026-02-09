// Feature #1441: FlakyTestsDashboardPage extracted from App.tsx (~1,575 lines)
// Features #1102-1107: Flaky test management, quarantine, suggestions, impact report
// Feature #76: Migrated to React Query with caching
// Feature #336: Dark-first design system redesign

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { logger } from '../utils/logger';
// Feature #336: Design system components
import {
 PageHeader,
 AnimatedCard,
 // StatCard, // Unused
 StatusPill,
 SectionHeader,
 CardContent,
 useReducedMotion,
} from '../components/ui';
import { AlertTriangle, RefreshCw, Settings2 } from 'lucide-react';
import {
 useFlakyTests,
 useFlakyImpactReport,
 useAutoQuarantineSettings,
 useRetryStrategySettings,
 useRetryStrategyPreview,
 useRemediationSuggestions,
 useQuarantineTest,
 useReleaseFromQuarantine,
 useRunAutoQuarantine,
 useUpdateAutoQuarantineSettings,
 useUpdateRetryStrategySettings,
} from '../hooks/api/useFlakyTests';

// FlakyTest interface
interface FlakyTest {
 test_id: string;
 test_name: string;
 suite_id: string;
 suite_name: string;
 project_id: string;
 project_name: string;
 pass_count: number;
 fail_count: number;
 total_runs: number;
 pass_rate: number;
 flakiness_percentage: number;
 flakiness_score: number;
 recommendation: string;
 last_run?: string;
 last_result?: 'passed' | 'failed';
 recent_runs?: Array<{ result: 'passed' | 'failed'; timestamp: string }>;
 retry_count?: number;
 passed_on_retry_count?: number;
 first_try_failure_count?: number;
 first_try_failure_rate?: number;
 retry_success_rate?: number;
 is_retry_flaky?: boolean;
 has_time_pattern?: boolean;
 peak_failure_hours?: Array<{ hour: number; hour_label: string; failure_rate: number; failures: number; total: number }>;
 peak_failure_days?: Array<{ day: number; day_name: string; failure_rate: number; failures: number; total: number }>;
 correlates_with_peak_load?: boolean;
 peak_load_failure_rate?: number;
 time_pattern_summary?: string;
 hourly_failure_rates?: number[];
 has_environment_pattern?: boolean;
 browser_stats?: Array<{ browser: string; pass: number; fail: number; total: number; failure_rate: number }>;
 environment_stats?: Array<{ environment: string; pass: number; fail: number; total: number; failure_rate: number }>;
 os_stats?: Array<{ os: string; pass: number; fail: number; total: number; failure_rate: number }>;
 is_browser_specific?: boolean;
 ci_vs_local_difference?: boolean;
 fails_more_on_ci?: boolean;
 is_os_specific?: boolean;
 environment_pattern_summary?: string;
 quarantined?: boolean;
 released_from_quarantine_at?: string;
}

export function FlakyTestsDashboardPage() {
 const { token } = useAuthStore();
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
 const flakyTests = flakyTestsData?.flakyTests || [];
 const projects = flakyTestsData?.projects || [];
 const suites = flakyTestsData?.suites || [];
 const isLoading = isLoadingFlakyTests;
 const impactReport = impactReportData || null;
 const isLoadingImpact = isLoadingImpactReport;
 const autoQuarantineSettings = autoQuarantineData || null;
 const retryStrategySettings = retryStrategyData || null;
 const retryStrategyPreview = retryPreviewData || null;

 // UI state (filters, modals, etc.)
 const [projectFilter, setProjectFilter] = useState<string>('all');
 const [suiteFilter, setSuiteFilter] = useState<string>('all');
 const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
 const [sortBy, setSortBy] = useState<'score' | 'name' | 'runs'>('score');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

 // Feature #1102: Flaky Test Impact Report UI state
 // (impactReport and isLoadingImpact now come from React Query)
 const [showImpactReport, setShowImpactReport] = useState(true);

 // Feature #1104: Auto-quarantine settings UI state
 // (autoQuarantineSettings now comes from React Query)
 const [showAutoQuarantineSettings, setShowAutoQuarantineSettings] = useState(false);
 const [isLoadingAutoQuarantine, setIsLoadingAutoQuarantine] = useState(false);
 const [autoQuarantineResult, setAutoQuarantineResult] = useState<{
 tests_quarantined: number;
 quarantined_tests: Array<{
 test_id: string;
 test_name: string;
 flakiness_score: number;
 quarantined_at: string;
 }>;
 } | null>(null);

 // Feature #1105: Retry strategy settings UI state
 // (retryStrategySettings and retryStrategyPreview now come from React Query)
 const [showRetryStrategySettings, setShowRetryStrategySettings] = useState(false);

 // Feature #1106: Flakiness remediation suggestions state
 const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
 const [selectedTestForSuggestions, setSelectedTestForSuggestions] = useState<string | null>(null);
 const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
 const [suggestions, setSuggestions] = useState<{
 test_id: string;
 test_name: string;
 suite_name: string;
 project_name: string;
 analysis: {
 total_runs: number;
 pass_count: number;
 fail_count: number;
 flakiness_score: number;
 flakiness_percentage: number;
 is_retry_flaky: boolean;
 retry_success_rate: number;
 patterns_detected: string[];
 };
 suggestions: Array<{
 id: string;
 category: string;
 priority: 'high' | 'medium' | 'low';
 title: string;
 description: string;
 pattern_matched: string;
 confidence: number;
 code_example?: {
 before: string;
 after: string;
 language: string;
 explanation: string;
 };
 impact: string;
 implementation_steps: string[];
 }>;
 suggestions_count: number;
 high_priority_count: number;
 generated_at: string;
 } | null>(null);

 // Feature #1953: AI flakiness pattern analysis state
 const [showFlakinessAnalysisModal, setShowFlakinessAnalysisModal] = useState(false);
 const [selectedTestForAnalysis, setSelectedTestForAnalysis] = useState<FlakyTest | null>(null);
 const [isLoadingFlakinessAnalysis, setIsLoadingFlakinessAnalysis] = useState(false);
 const [flakinessAnalysis, setFlakinessAnalysis] = useState<string | null>(null);
 const [flakinessAnalysisCache, setFlakinessAnalysisCache] = useState<Record<string, { analysis: string; timestamp: number }>>({});

 // Feature #76: Data fetching is now handled by React Query hooks:
 // - useFlakyTests() for flaky tests list, projects, and suites
 // - useFlakyImpactReport() for impact report
 // - useAutoQuarantineSettings() for auto-quarantine settings
 // - useRetryStrategySettings() for retry strategy settings
 // - useRetryStrategyPreview() for retry strategy preview

 // Feature #1105: Update retry strategy settings
 // Feature #76: Use React Query mutation for updating retry strategy settings
 const handleUpdateRetryStrategySettings = async (updates: Partial<typeof retryStrategySettings>) => {
 updateRetryStrategyMutation.mutate(updates, {
 onSuccess: () => {
 toast.success('Retry strategy settings updated');
 refetchRetryStrategy();
 refetchRetryPreview();
 },
 onError: () => {
 toast.error('Failed to update retry strategy settings');
 },
 });
 };

 // Feature #1105: Update a specific rule's retry count
 const handleUpdateRuleRetries = (ruleIndex: number, newRetries: number) => {
 if (!retryStrategySettings) return;
 const updatedRules = [...retryStrategySettings.rules];
 updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], retries: newRetries };
 handleUpdateRetryStrategySettings({ rules: updatedRules });
 };

 // Feature #1104: Run auto-quarantine check - using React Query mutation
 const handleRunAutoQuarantine = async () => {
 setIsLoadingAutoQuarantine(true);
 runAutoQuarantineMutation.mutate(undefined, {
 onSuccess: (data) => {
 setAutoQuarantineResult(data);
 if (data.tests_quarantined > 0) {
 toast.success(`Auto-quarantined ${data.tests_quarantined} test(s) exceeding threshold`);
 // Refresh flaky tests list to update quarantine status
 refetchFlakyTests();
 } else {
 toast.info('No tests exceeded the auto-quarantine threshold');
 }
 },
 onError: () => {
 toast.error('Failed to run auto-quarantine check');
 },
 onSettled: () => {
 setIsLoadingAutoQuarantine(false);
 },
 });
 };

 // Feature #1104: Update auto-quarantine settings - using React Query mutation
 const handleUpdateAutoQuarantineSettings = async (updates: Partial<typeof autoQuarantineSettings>) => {
 updateAutoQuarantineMutation.mutate(updates, {
 onSuccess: () => {
 toast.success('Auto-quarantine settings updated');
 refetchAutoQuarantine();
 },
 onError: () => {
 toast.error('Failed to update settings');
 },
 });
 };

 // Filter and sort tests
 const filteredTests = flakyTests
 .filter((t) => {
 if (projectFilter !== 'all' && t.project_id !== projectFilter) return false;
 if (suiteFilter !== 'all' && t.suite_id !== suiteFilter) return false;
 if (severityFilter !== 'all') {
 const score = t.flakiness_score || t.flakiness_percentage / 100;
 if (severityFilter === 'high' && score < 0.7) return false;
 if (severityFilter === 'medium' && (score < 0.4 || score >= 0.7)) return false;
 if (severityFilter === 'low' && score >= 0.4) return false;
 }
 return true;
 })
 .sort((a, b) => {
 let comparison = 0;
 if (sortBy === 'score') {
 comparison = (a.flakiness_score || a.flakiness_percentage / 100) - (b.flakiness_score || b.flakiness_percentage / 100);
 } else if (sortBy === 'name') {
 comparison = a.test_name.localeCompare(b.test_name);
 } else if (sortBy === 'runs') {
 comparison = a.total_runs - b.total_runs;
 }
 return sortOrder === 'asc' ? comparison : -comparison;
 });

 // Available suites based on project filter
 const availableSuites = projectFilter === 'all' ? suites : suites.filter(s => s.project_id === projectFilter);

 // Handle quick actions - Feature #76: using React Query mutations
 // Feature #1103: Quarantine a flaky test
 const handleQuarantine = async (testId: string) => {
 quarantineTestMutation.mutate({ testId, reason: 'Flaky test - investigating' }, {
 onSuccess: (data) => {
 toast.success(`Test "${data.test_name}" quarantined successfully`);
 refetchFlakyTests();
 },
 onError: (error) => {
 toast.error(error instanceof Error ? error.message : 'Failed to quarantine test');
 },
 });
 };

 // Feature #1103: Unquarantine a test
 const handleUnquarantine = async (testId: string) => {
 releaseQuarantineMutation.mutate(testId, {
 onSuccess: (data) => {
 toast.success(`Test "${data.test_name}" removed from quarantine`);
 refetchFlakyTests();
 },
 onError: (error) => {
 toast.error(error instanceof Error ? error.message : 'Failed to unquarantine test');
 },
 });
 };

 // ===========================================
 // Feature #1107: Release test from quarantine with confirmation
 // ===========================================
 const [showReleaseConfirmModal, setShowReleaseConfirmModal] = useState(false);
 const [testToRelease, setTestToRelease] = useState<{ test_id: string; test_name: string } | null>(null);
 const [isReleasingFromQuarantine, setIsReleasingFromQuarantine] = useState(false);

 const handleReleaseFromQuarantine = (testId: string, testName: string) => {
 setTestToRelease({ test_id: testId, test_name: testName });
 setShowReleaseConfirmModal(true);
 };

 // Feature #76: Use React Query mutation for release from quarantine
 const confirmReleaseFromQuarantine = async () => {
 if (!testToRelease) return;
 setIsReleasingFromQuarantine(true);

 releaseQuarantineMutation.mutate(testToRelease.test_id, {
 onSuccess: (data) => {
 toast.success(`Test "${data.test_name}" released from quarantine and is now running normally`, 5000);
 refetchFlakyTests();
 setShowReleaseConfirmModal(false);
 setTestToRelease(null);
 },
 onError: (error) => {
 toast.error(error instanceof Error ? error.message : 'Failed to release test from quarantine');
 },
 onSettled: () => {
 setIsReleasingFromQuarantine(false);
 },
 });
 };

 const handleInvestigate = (testId: string) => {
 navigate(`/tests/${testId}`);
 };

 const handleIgnore = async (testId: string) => {
 toast.info(`Ignoring test ${testId}... (Feature coming soon)`);
 };

 // Feature #1106: Get AI suggestions for a flaky test
 const handleGetSuggestions = async (testId: string) => {
 if (!token) return;
 setSelectedTestForSuggestions(testId);
 setShowSuggestionsModal(true);
 setIsLoadingSuggestions(true);
 setSuggestions(null);

 try {
 const response = await fetch(`/api/v1/ai-insights/flaky-tests/${testId}/suggestions?include_code_examples=true`, {
 headers: { Authorization: `Bearer ${token}` },
 });
 if (response.ok) {
 const data = await response.json();
 setSuggestions(data);
 } else {
 toast.error('Failed to load AI suggestions');
 }
 } catch (error) {
 console.error('Failed to get suggestions:', error);
 toast.error('Failed to load AI suggestions');
 } finally {
 setIsLoadingSuggestions(false);
 }
 };

 // Feature #1953: AI flakiness pattern analysis
 const handleAnalyzeFlakiness = async (test: FlakyTest) => {
 if (!token) return;

 // Check cache first (24hr TTL)
 const cached = flakinessAnalysisCache[test.test_id];
 if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
 setSelectedTestForAnalysis(test);
 setFlakinessAnalysis(cached.analysis);
 setShowFlakinessAnalysisModal(true);
 logger.ai.debug('Using cached flakiness analysis for:', test.test_name);
 return;
 }

 setSelectedTestForAnalysis(test);
 setShowFlakinessAnalysisModal(true);
 setIsLoadingFlakinessAnalysis(true);
 setFlakinessAnalysis(null);

 // Build summarized history for AI (Feature #1953 Step 2 & 3)
 const historySummary = {
 test_name: test.test_name,
 suite_name: test.suite_name,
 project_name: test.project_name,
 total_runs: test.total_runs,
 pass_count: test.pass_count,
 fail_count: test.fail_count,
 pass_rate: test.pass_rate,
 flakiness_score: test.flakiness_score,
 is_retry_flaky: test.is_retry_flaky,
 retry_success_rate: test.retry_success_rate,
 has_time_pattern: test.has_time_pattern,
 time_pattern_summary: test.time_pattern_summary,
 peak_failure_hours: test.peak_failure_hours?.slice(0, 3), // Top 3 only
 has_environment_pattern: test.has_environment_pattern,
 environment_pattern_summary: test.environment_pattern_summary,
 is_browser_specific: test.is_browser_specific,
 is_os_specific: test.is_os_specific,
 fails_more_on_ci: test.fails_more_on_ci,
 recent_runs: test.recent_runs?.slice(-10).map(r => r.result), // Last 10 results only
 };

 try {
 const response = await fetch('https://qa.pixelcraftedmedia.com/api/v1/mcp-tools/chat', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({
 message: `Analyze why this test is flaky. Identify patterns (time-based, environment-based, data-based) and provide actionable fix suggestions.

Test Data:
${JSON.stringify(historySummary, null, 2)}

Please provide:
1. What patterns indicate this test is flaky
2. Most likely root cause(s)
3. Specific actionable recommendations to fix it
4. Priority: should this be quarantined, fixed, or monitored?`,
 complexity: 'simple', // Use Haiku for cost efficiency
 }),
 });

 if (response.ok) {
 const data = await response.json();
 const analysis = data.response || data.content || 'No analysis available';
 setFlakinessAnalysis(analysis);
 // Cache the result
 setFlakinessAnalysisCache(prev => ({
 ...prev,
 [test.test_id]: { analysis, timestamp: Date.now() },
 }));
 logger.ai.debug('Flakiness analysis triggered for:', test.test_name);
 } else {
 toast.error('Failed to analyze flakiness');
 setFlakinessAnalysis('Failed to get AI analysis. Please try again.');
 }
 } catch (error) {
 console.error('Failed to analyze flakiness:', error);
 toast.error('Failed to analyze flakiness');
 setFlakinessAnalysis('Error connecting to AI service. Please try again.');
 } finally {
 setIsLoadingFlakinessAnalysis(false);
 }
 };

 // Sparkline component for trend visualization
 const Sparkline = ({ runs }: { runs?: Array<{ result: 'passed' | 'failed'; timestamp: string }> }) => {
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
 };

 // Get severity badge
 const getSeverityBadge = (score: number) => {
 if (score >= 0.7) return { label: 'High', class: 'bg-destructive/10 text-destructive' };
 if (score >= 0.4) return { label: 'Medium', class: 'bg-warning/10 text-warning' };
 return { label: 'Low', class: 'bg-warning/10 text-warning' };
 };

 return (
 <Layout>
 <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
 {/* Feature #336: PageHeader with action buttons */}
 <PageHeader
 title="AI Insights - Flaky Tests"
 description="Manage and investigate tests with inconsistent results"
 breadcrumbs={[
 { label: 'Home', href: '/' },
 { label: 'AI Insights', href: '/ai-insights' },
 { label: 'Flaky Tests' }
 ]}
 actions={
 <div className="flex items-center gap-4">
 {/* Feature #1105: Retry Strategy button */}
 <button
 onClick={() => {
 setShowRetryStrategySettings(!showRetryStrategySettings);
 if (!showRetryStrategySettings) {
 refetchRetryPreview();
 }
 }}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
 title="Configure retry strategy based on flakiness level"
 >
 <RefreshCw className="h-4 w-4" /> Retry Strategy
 {retryStrategySettings?.enabled && (
 <StatusPill status="passed" className="text-[10px]">ON</StatusPill>
 )}
 </button>
 {/* Feature #1104: Auto-quarantine button */}
 <button
 onClick={() => setShowAutoQuarantineSettings(!showAutoQuarantineSettings)}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-warning/30 bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
 title="Configure auto-quarantine settings"
 >
 <Settings2 className="h-4 w-4" /> Auto-Quarantine
 {autoQuarantineSettings?.enabled && (
 <StatusPill status="passed" className="text-[10px]">ON</StatusPill>
 )}
 </button>
 {/* Hero stat */}
 <AnimatedCard variant="hero" className="px-4 py-2">
 <div className="text-right">
 <span className="text-3xl font-bold text-warning">{filteredTests.length}</span>
 <p className="text-sm text-muted-foreground">Flaky Tests</p>
 </div>
 </AnimatedCard>
 </div>
 }
 />

 {/* Feature #1104: Auto-Quarantine Settings Panel */}
 {showAutoQuarantineSettings && autoQuarantineSettings && (
 <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-warning flex items-center gap-2">
 <span>🤖</span> Auto-Quarantine Settings
 </h2>
 <button
 onClick={() => setShowAutoQuarantineSettings(false)}
 className="text-warning hover:text-warning"
 >
 ×
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
 {/* Enable/Disable Toggle */}
 <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-warning/20">
 <label className="flex items-center gap-2 cursor-pointer flex-1">
 <input
 type="checkbox"
 checked={autoQuarantineSettings.enabled}
 onChange={(e) => handleUpdateAutoQuarantineSettings({ enabled: e.target.checked })}
 className="w-5 h-5 rounded border-border text-warning focus:ring-warning"
 />
 <span className="text-sm font-medium text-foreground">Enabled</span>
 </label>
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${
 autoQuarantineSettings.enabled
 ? 'bg-success/10 text-success'
 : 'bg-muted text-muted-foreground'
 }`}>
 {autoQuarantineSettings.enabled ? 'Active' : 'Disabled'}
 </span>
 </div>

 {/* Threshold Setting */}
 <div className="p-3 rounded-lg bg-card border border-warning/20">
 <label className="text-xs font-medium text-muted-foreground block mb-1">
 Flakiness Threshold
 </label>
 <div className="flex items-center gap-2">
 <input
 type="range"
 min="0.3"
 max="1.0"
 step="0.05"
 value={autoQuarantineSettings.threshold}
 onChange={(e) => handleUpdateAutoQuarantineSettings({ threshold: parseFloat(e.target.value) })}
 className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-amber-600"
 />
 <span className="text-sm font-bold text-warning min-w-[3rem] text-right">
 {(autoQuarantineSettings.threshold * 100).toFixed(0)}%
 </span>
 </div>
 </div>

 {/* Minimum Runs Setting */}
 <div className="p-3 rounded-lg bg-card border border-warning/20">
 <label className="text-xs font-medium text-muted-foreground block mb-1">
 Min Runs Required
 </label>
 <select
 value={autoQuarantineSettings.min_runs}
 onChange={(e) => handleUpdateAutoQuarantineSettings({ min_runs: parseInt(e.target.value) })}
 className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
 >
 {[2, 3, 5, 10, 15, 20].map((n) => (
 <option key={n} value={n}>{n} runs</option>
 ))}
 </select>
 </div>

 {/* Notifications Toggle */}
 <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-warning/20">
 <label className="flex items-center gap-2 cursor-pointer flex-1">
 <input
 type="checkbox"
 checked={autoQuarantineSettings.notify_on_quarantine}
 onChange={(e) => handleUpdateAutoQuarantineSettings({ notify_on_quarantine: e.target.checked })}
 className="w-5 h-5 rounded border-border text-warning focus:ring-warning"
 />
 <span className="text-sm font-medium text-foreground">🔔 Notify on Quarantine</span>
 </label>
 </div>
 </div>

 {/* Run Auto-Quarantine Button */}
 <div className="flex items-center gap-4">
 <button
 onClick={handleRunAutoQuarantine}
 disabled={!autoQuarantineSettings.enabled || isLoadingAutoQuarantine}
 className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
 autoQuarantineSettings.enabled && !isLoadingAutoQuarantine
 ? 'bg-warning text-white hover:bg-warning'
 : 'bg-muted text-muted-foreground cursor-not-allowed'
 }`}
 >
 {isLoadingAutoQuarantine ? (
 <>
 <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
 Running...
 </>
 ) : (
 <>
 <span>🚀</span> Run Auto-Quarantine Now
 </>
 )}
 </button>

 <p className="text-xs text-muted-foreground">
 Tests with flakiness score ≥ {(autoQuarantineSettings.threshold * 100).toFixed(0)}% and at least {autoQuarantineSettings.min_runs} runs will be automatically quarantined
 </p>
 </div>

 {/* Auto-Quarantine Result */}
 {autoQuarantineResult && autoQuarantineResult.tests_quarantined > 0 && (
 <div className="mt-4 p-3 rounded-lg bg-success/5 border border-success/30">
 <h3 className="text-sm font-semibold text-success mb-2">
 ✅ Auto-Quarantined {autoQuarantineResult.tests_quarantined} Test(s)
 </h3>
 <ul className="text-sm text-success space-y-1">
 {autoQuarantineResult.quarantined_tests.map((t) => (
 <li key={t.test_id} className="flex items-center gap-2">
 <span className="font-medium">{t.test_name}</span>
 <span className="text-xs px-1.5 py-0.5 rounded bg-success/10">
 {(t.flakiness_score * 100).toFixed(0)}% flaky
 </span>
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}

 {/* Feature #1105: Retry Strategy Settings Panel */}
 {showRetryStrategySettings && retryStrategySettings && (
 <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mb-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
 <span>🔄</span> Retry Strategy Settings
 </h2>
 <button
 onClick={() => setShowRetryStrategySettings(false)}
 className="text-primary hover:text-primary"
 >
 ×
 </button>
 </div>

 <p className="text-sm text-primary mb-4">
 Configure how many retries to apply to tests based on their flakiness score. Tests with higher flakiness get more retries automatically.
 </p>

 {/* Enable/Disable Toggle */}
 <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-primary/20 mb-4 w-fit">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={retryStrategySettings.enabled}
 onChange={(e) => handleUpdateRetryStrategySettings({ enabled: e.target.checked })}
 className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
 />
 <span className="text-sm font-medium text-foreground">Enable Dynamic Retry Strategy</span>
 </label>
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${
 retryStrategySettings.enabled
 ? 'bg-success/10 text-success'
 : 'bg-muted text-muted-foreground'
 }`}>
 {retryStrategySettings.enabled ? 'Active' : 'Disabled'}
 </span>
 </div>

 {/* Retry Rules Configuration */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
 {retryStrategySettings.rules.map((rule, index) => {
 const severityLabel = rule.max_score <= 0.3 ? 'Low' : rule.max_score <= 0.6 ? 'Medium' : 'High';
 const severityColor = severityLabel === 'Low'
 ? 'border-success/30 bg-success/5'
 : severityLabel === 'Medium'
 ? 'border-warning/30 bg-warning/5'
 : 'border-destructive/30 bg-destructive/5';
 const textColor = severityLabel === 'Low'
 ? 'text-success'
 : severityLabel === 'Medium'
 ? 'text-warning'
 : 'text-destructive';

 return (
 <div
 key={index}
 className={`p-4 rounded-lg border ${severityColor}`}
 >
 <div className="flex items-center justify-between mb-2">
 <span className={`text-sm font-semibold ${textColor}`}>
 {severityLabel} Flakiness
 </span>
 <span className={`text-xs px-2 py-0.5 rounded ${
 severityLabel === 'Low' ? 'bg-success/10 text-success' :
 severityLabel === 'Medium' ? 'bg-warning/10 text-warning' :
 'bg-destructive/10 text-destructive'
 }`}>
 {(rule.min_score * 100).toFixed(0)}% - {rule.max_score >= 1 ? '100' : (rule.max_score * 100).toFixed(0)}%
 </span>
 </div>
 <div className="flex items-center gap-2">
 <label className="text-xs text-muted-foreground">Retries:</label>
 <select
 value={rule.retries}
 onChange={(e) => handleUpdateRuleRetries(index, parseInt(e.target.value))}
 disabled={!retryStrategySettings.enabled}
 className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
 >
 {[0, 1, 2, 3, 4, 5].map((n) => (
 <option key={n} value={n}>{n} {n === 1 ? 'retry' : 'retries'}</option>
 ))}
 </select>
 </div>
 {retryStrategyPreview && (
 <div className="mt-2 text-xs text-muted-foreground">
 {retryStrategyPreview.by_rule[index]?.test_count || 0} tests in this range
 </div>
 )}
 </div>
 );
 })}
 </div>

 {/* Additional Settings */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
 <div className="p-3 rounded-lg bg-card border border-primary/20">
 <label className="text-xs font-medium text-muted-foreground block mb-1">
 Default Retries (for tests without flakiness data)
 </label>
 <select
 value={retryStrategySettings.default_retries}
 onChange={(e) => handleUpdateRetryStrategySettings({ default_retries: parseInt(e.target.value) })}
 disabled={!retryStrategySettings.enabled}
 className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
 >
 {[0, 1, 2, 3].map((n) => (
 <option key={n} value={n}>{n} {n === 1 ? 'retry' : 'retries'}</option>
 ))}
 </select>
 </div>

 <div className="p-3 rounded-lg bg-card border border-primary/20">
 <label className="text-xs font-medium text-muted-foreground block mb-1">
 Maximum Retries Allowed
 </label>
 <select
 value={retryStrategySettings.max_retries}
 onChange={(e) => handleUpdateRetryStrategySettings({ max_retries: parseInt(e.target.value) })}
 disabled={!retryStrategySettings.enabled}
 className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
 >
 {[1, 2, 3, 4, 5, 7, 10].map((n) => (
 <option key={n} value={n}>{n} {n === 1 ? 'retry' : 'retries'}</option>
 ))}
 </select>
 </div>
 </div>

 {/* Preview Summary */}
 {retryStrategyPreview && retryStrategyPreview.total_flaky_tests > 0 && (
 <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
 <h3 className="text-sm font-semibold text-primary mb-2">
 📊 Current Retry Distribution
 </h3>
 <div className="grid grid-cols-3 gap-2 text-center">
 {retryStrategyPreview.by_rule.map((rule, idx) => (
 <div key={idx} className="p-2 rounded bg-card">
 <div className="text-lg font-bold text-primary">{rule.test_count}</div>
 <div className="text-xs text-muted-foreground">{rule.range}</div>
 <div className="text-xs text-primary">{rule.retries} {rule.retries === 1 ? 'retry' : 'retries'}</div>
 </div>
 ))}
 </div>
 <p className="text-xs text-primary mt-2 text-center">
 Total: {retryStrategyPreview.total_flaky_tests} flaky tests configured for dynamic retries
 </p>
 </div>
 )}
 </div>
 )}

 {/* Filters */}
 <div className="rounded-lg border border-border bg-card p-4 mb-6">
 <div className="flex flex-wrap items-center gap-4">
 <div className="flex items-center gap-2">
 <label className="text-sm font-medium text-foreground">Project:</label>
 <select
 value={projectFilter}
 onChange={(e) => {
 setProjectFilter(e.target.value);
 setSuiteFilter('all'); // Reset suite when project changes
 }}
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
 value={suiteFilter}
 onChange={(e) => setSuiteFilter(e.target.value)}
 className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
 >
 <option value="all">All Suites</option>
 {availableSuites.map((s) => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 </div>

 <div className="flex items-center gap-2">
 <label className="text-sm font-medium text-foreground">Severity:</label>
 <select
 value={severityFilter}
 onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
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
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
 className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
 >
 <option value="score">Flakiness Score</option>
 <option value="name">Test Name</option>
 <option value="runs">Total Runs</option>
 </select>
 <button
 onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
 className="px-2 py-1.5 rounded-md border border-input bg-background hover:bg-muted transition-colors"
 title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
 >
 {sortOrder === 'asc' ? '↑' : '↓'}
 </button>
 </div>
 </div>
 </div>

 {/* Tests List */}
 {isLoading ? (
 <div className="rounded-lg border border-border bg-card p-8 text-center">
 <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
 <p className="text-muted-foreground">Loading flaky tests...</p>
 </div>
 ) : filteredTests.length === 0 ? (
 <div className="rounded-lg border border-border bg-card p-8 text-center">
 <div className="text-4xl mb-3">✅</div>
 <p className="text-foreground font-medium">No flaky tests found!</p>
 <p className="text-sm text-muted-foreground mt-2">
 {flakyTests.length > 0 ? 'Try adjusting your filters.' : 'Your tests are running consistently. Keep up the good work!'}
 </p>
 </div>
 ) : (
 <div className="rounded-lg border border-border bg-card overflow-hidden">
 {/* Table Header */}
 <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 border-b border-border text-sm font-medium text-muted-foreground">
 <div className="col-span-4">Test</div>
 <div className="col-span-2 text-center">Flakiness Score</div>
 <div className="col-span-2 text-center">Trend</div>
 <div className="col-span-1 text-center">Runs</div>
 <div className="col-span-3 text-right">Actions</div>
 </div>

 {/* Table Body */}
 {filteredTests.map((test) => {
 const score = test.flakiness_score || test.flakiness_percentage / 100;
 const severity = getSeverityBadge(score);

 return (
 <div
 key={test.test_id}
 className="grid grid-cols-12 gap-4 p-4 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors items-center"
 >
 {/* Test Info */}
 <div className="col-span-4">
 <button
 onClick={() => navigate(`/tests/${test.test_id}`)}
 className="font-medium text-foreground hover:text-primary text-left"
 >
 {test.test_name}
 </button>
 <p className="text-xs text-muted-foreground mt-0.5">
 {test.suite_name} / {test.project_name}
 </p>
 <div className="flex items-center gap-1.5 mt-1">
 <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${severity.class}`}>
 {severity.label}
 </span>
 {test.is_retry_flaky && (
 <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
 🔄 Retry
 </span>
 )}
 {test.has_time_pattern && (
 <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
 ⏰ Time
 </span>
 )}
 {test.has_environment_pattern && (
 <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-info/10 text-info">
 🖥️ Env
 </span>
 )}
 {/* Feature #1103: Quarantine badge */}
 {test.quarantined && (
 <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/30">
 🏥 Quarantined
 </span>
 )}
 </div>
 </div>

 {/* Flakiness Score */}
 <div className="col-span-2 text-center">
 <div className="inline-flex flex-col items-center">
 <span className={`text-lg font-bold ${
 score >= 0.7 ? 'text-destructive' :
 score >= 0.4 ? 'text-warning' :
 'text-success'
 }`}>
 {score.toFixed(2)}
 </span>
 <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
 <div
 className={`h-full ${
 score >= 0.7 ? 'bg-destructive' :
 score >= 0.4 ? 'bg-warning' :
 'bg-success'
 }`}
 style={{ width: `${score * 100}%` }}
 />
 </div>
 </div>
 </div>

 {/* Trend Sparkline */}
 <div className="col-span-2 flex justify-center">
 <Sparkline runs={test.recent_runs} />
 </div>

 {/* Runs */}
 <div className="col-span-1 text-center">
 <span className="text-sm text-foreground">{test.total_runs}</span>
 <p className="text-xs text-muted-foreground">
 {test.pass_rate}% pass
 </p>
 </div>

 {/* Actions */}
 <div className="col-span-3 flex justify-end gap-2">
 {/* Feature #1103/#1107: Quarantine/Release buttons */}
 {test.quarantined ? (
 <button
 onClick={() => handleReleaseFromQuarantine(test.test_id, test.test_name)}
 className="px-2 py-1 text-xs font-medium rounded border border-success/30 bg-success/5 text-success hover:bg-success/10 transition-colors"
 title="Release from quarantine - test will run normally but be monitored"
 >
 🔓 Release
 </button>
 ) : (
 <button
 onClick={() => handleQuarantine(test.test_id)}
 className="px-2 py-1 text-xs font-medium rounded border border-warning/30 bg-warning/5 text-warning hover:bg-warning/10 transition-colors"
 title="Quarantine this test - exclude from CI failures"
 >
 🏥 Quarantine
 </button>
 )}
 {/* Feature #1953: AI Flakiness Analysis button */}
 <button
 onClick={() => handleAnalyzeFlakiness(test)}
 className="px-2 py-1 text-xs font-medium rounded border border-accent/30 bg-gradient-to-r from-accent/10 to-accent/5 text-accent hover:from-accent/20 hover:to-accent/10 transition-colors"
 title="AI analysis: why is this test flaky?"
 >
 🤖 Why Flaky?
 </button>
 <button
 onClick={() => handleGetSuggestions(test.test_id)}
 className="px-2 py-1 text-xs font-medium rounded border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
 title="Get AI suggestions to fix this flaky test"
 >
 💡 Suggestions
 </button>
 <button
 onClick={() => handleInvestigate(test.test_id)}
 className="px-2 py-1 text-xs font-medium rounded border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
 title="Investigate test details"
 >
 🔍 Investigate
 </button>
 <button
 onClick={() => handleIgnore(test.test_id)}
 className="px-2 py-1 text-xs font-medium rounded border border-border bg-muted text-foreground hover:bg-muted transition-colors"
 title="Ignore this test from flaky reports"
 >
 🙈 Ignore
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* Summary Stats */}
 {!isLoading && flakyTests.length > 0 && (
 <div className="grid grid-cols-5 gap-4 mt-6">
 <div className="rounded-lg border border-border bg-card p-4">
 <div className="text-3xl font-bold text-destructive">
 {flakyTests.filter(t => (t.flakiness_score || t.flakiness_percentage / 100) >= 0.7).length}
 </div>
 <div className="text-sm text-muted-foreground">High Severity</div>
 </div>
 <div className="rounded-lg border border-border bg-card p-4">
 <div className="text-3xl font-bold text-warning">
 {flakyTests.filter(t => {
 const s = t.flakiness_score || t.flakiness_percentage / 100;
 return s >= 0.4 && s < 0.7;
 }).length}
 </div>
 <div className="text-sm text-muted-foreground">Medium Severity</div>
 </div>
 <div className="rounded-lg border border-border bg-card p-4">
 <div className="text-3xl font-bold text-warning">
 {flakyTests.filter(t => (t.flakiness_score || t.flakiness_percentage / 100) < 0.4).length}
 </div>
 <div className="text-sm text-muted-foreground">Low Severity</div>
 </div>
 <div className="rounded-lg border border-border bg-card p-4">
 <div className="text-3xl font-bold text-foreground">
 {flakyTests.filter(t => t.is_retry_flaky).length}
 </div>
 <div className="text-sm text-muted-foreground">Retry Flaky</div>
 </div>
 {/* Feature #1103: Quarantined count */}
 <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
 <div className="text-3xl font-bold text-warning">
 {flakyTests.filter(t => t.quarantined).length}
 </div>
 <div className="text-sm text-warning">Quarantined</div>
 </div>
 </div>
 )}

 {/* Feature #1102: Flaky Test Impact Report */}
 {showImpactReport && (
 <div className="mt-8 rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
 <span className="text-xl">💰</span> Flaky Test Impact Report
 </h2>
 <button
 onClick={() => setShowImpactReport(false)}
 className="text-muted-foreground hover:text-foreground"
 title="Hide section"
 >
 ×
 </button>
 </div>

 {isLoadingImpact ? (
 <div className="flex items-center justify-center py-8">
 <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
 <span className="ml-2 text-muted-foreground">Loading impact data...</span>
 </div>
 ) : !impactReport ? (
 <div className="text-center py-8 text-muted-foreground">
 <p>No impact data available</p>
 </div>
 ) : (
 <div className="space-y-6">
 {/* Report Period */}
 <div className="text-sm text-muted-foreground">
 📅 Report period: {new Date(impactReport.report_period.start).toLocaleDateString()} - {new Date(impactReport.report_period.end).toLocaleDateString()} ({impactReport.report_period.days} days)
 </div>

 {/* Impact Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {/* CI Time Wasted */}
 <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
 <div className="flex items-center gap-2 mb-2">
 <span className="text-lg">⏱️</span>
 <span className="text-sm font-medium text-warning">CI Time Wasted</span>
 </div>
 <div className="text-2xl font-bold text-warning">
 {impactReport.impact.ci_time_wasted.hours}h
 </div>
 <div className="text-sm text-warning">
 ({impactReport.impact.ci_time_wasted.minutes} minutes)
 </div>
 <div className="text-sm font-medium text-warning mt-1">
 ${impactReport.impact.ci_time_wasted.cost_usd.toFixed(2)} cost
 </div>
 </div>

 {/* Developer Time */}
 <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
 <div className="flex items-center gap-2 mb-2">
 <span className="text-lg">👩‍💻</span>
 <span className="text-sm font-medium text-primary">Developer Time</span>
 </div>
 <div className="text-2xl font-bold text-primary">
 {impactReport.impact.developer_time_investigating.hours}h
 </div>
 <div className="text-sm text-primary">
 investigating issues
 </div>
 <div className="text-sm font-medium text-primary mt-1">
 ${impactReport.impact.developer_time_investigating.cost_usd.toFixed(2)} cost
 </div>
 </div>

 {/* False Alerts */}
 <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
 <div className="flex items-center gap-2 mb-2">
 <span className="text-lg">🚨</span>
 <span className="text-sm font-medium text-destructive">False Alerts</span>
 </div>
 <div className="text-2xl font-bold text-destructive">
 {impactReport.impact.false_failure_alerts.count}
 </div>
 <div className="text-sm text-destructive">
 false positives
 </div>
 <div className="text-sm font-medium text-destructive mt-1">
 {impactReport.impact.false_failure_alerts.estimated_noise_percentage}% noise
 </div>
 </div>

 {/* Total Cost */}
 <div className="rounded-lg border border-success/20 bg-success/5 p-4">
 <div className="flex items-center gap-2 mb-2">
 <span className="text-lg">💵</span>
 <span className="text-sm font-medium text-success">Total Cost Impact</span>
 </div>
 <div className="text-2xl font-bold text-success">
 ${impactReport.impact.total_cost_impact.usd.toFixed(2)}
 </div>
 <div className="text-sm text-success">
 this month
 </div>
 <div className="text-sm font-medium text-success mt-1">
 ${impactReport.impact.total_cost_impact.annual_projection_usd.toFixed(2)}/year projected
 </div>
 </div>
 </div>

 {/* Top Offenders */}
 {impactReport.top_offenders.length > 0 && (
 <div>
 <h3 className="text-sm font-medium text-foreground mb-3">🏆 Top Cost Contributors</h3>
 <div className="rounded-lg border border-border overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-muted/50">
 <tr>
 <th className="text-left px-4 py-2 font-medium">Test</th>
 <th className="text-center px-4 py-2 font-medium">Flakiness</th>
 <th className="text-center px-4 py-2 font-medium">Retries</th>
 <th className="text-center px-4 py-2 font-medium">CI Time</th>
 <th className="text-center px-4 py-2 font-medium">Dev Time</th>
 <th className="text-right px-4 py-2 font-medium">Est. Cost</th>
 </tr>
 </thead>
 <tbody>
 {impactReport.top_offenders.slice(0, 5).map((test, idx) => (
 <tr
 key={test.test_id}
 className="border-t border-border hover:bg-muted/30 cursor-pointer"
 onClick={() => navigate(`/tests/${test.test_id}`)}
 >
 <td className="px-4 py-2">
 <span className="text-muted-foreground mr-2">#{idx + 1}</span>
 {test.test_name}
 </td>
 <td className="text-center px-4 py-2">
 <span className={`px-2 py-1 rounded text-xs font-medium ${
 test.flakiness_score >= 0.7 ? 'bg-destructive/10 text-destructive' :
 test.flakiness_score >= 0.4 ? 'bg-warning/10 text-warning' :
 'bg-success/10 text-success'
 }`}>
 {(test.flakiness_score * 100).toFixed(0)}%
 </span>
 </td>
 <td className="text-center px-4 py-2">{test.retries}</td>
 <td className="text-center px-4 py-2">{test.ci_time_wasted_minutes}m</td>
 <td className="text-center px-4 py-2">{test.estimated_dev_time_minutes}m</td>
 <td className="text-right px-4 py-2 font-medium text-destructive">
 ${test.estimated_cost.toFixed(2)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Recommendations */}
 {impactReport.recommendations.length > 0 && (
 <div>
 <h3 className="text-sm font-medium text-foreground mb-3">💡 Recommendations</h3>
 <div className="space-y-2">
 {impactReport.recommendations.map((rec, idx) => (
 <div
 key={idx}
 className={`rounded-lg border p-3 ${
 rec.priority === 'high' ? 'border-destructive/20 bg-destructive/5' :
 rec.priority === 'medium' ? 'border-warning/20 bg-warning/5' :
 'border-border bg-muted'
 }`}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
 rec.priority === 'high' ? 'bg-destructive/20 text-destructive' :
 rec.priority === 'medium' ? 'bg-warning/20 text-warning' :
 'bg-secondary text-foreground'
 }`}>
 {rec.priority}
 </span>
 <span className="font-medium">{rec.action}</span>
 </div>
 <span className="text-sm text-success font-medium">
 Save ~${rec.estimated_savings_usd.toFixed(2)}
 </span>
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
 )}

 {/* Feature #1106: AI Suggestions Modal */}
 {showSuggestionsModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
 <div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-lg border border-border bg-background shadow-xl m-4">
 <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-background">
 <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
 <span>💡</span> AI Suggestions for {suggestions?.test_name || 'Test'}
 </h2>
 <button
 onClick={() => setShowSuggestionsModal(false)}
 className="p-2 rounded-lg hover:bg-muted transition-colors"
 >
 ✕
 </button>
 </div>

 <div className="p-6">
 {isLoadingSuggestions ? (
 <div className="flex flex-col items-center justify-center py-12">
 <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mb-4" />
 <p className="text-muted-foreground">Analyzing failure patterns...</p>
 </div>
 ) : suggestions ? (
 <div className="space-y-6">
 {/* Analysis Summary */}
 <div className="p-4 rounded-lg border border-accent/20 bg-accent/5">
 <h3 className="text-sm font-semibold text-accent mb-3">📊 Analysis Summary</h3>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
 <div>
 <div className="text-2xl font-bold text-foreground">{suggestions.analysis.total_runs}</div>
 <div className="text-xs text-muted-foreground">Total Runs</div>
 </div>
 <div>
 <div className="text-2xl font-bold text-destructive">{suggestions.analysis.flakiness_percentage}%</div>
 <div className="text-xs text-muted-foreground">Flakiness Score</div>
 </div>
 <div>
 <div className="text-2xl font-bold text-success">{suggestions.analysis.pass_count}</div>
 <div className="text-xs text-muted-foreground">Passes</div>
 </div>
 <div>
 <div className="text-2xl font-bold text-destructive">{suggestions.analysis.fail_count}</div>
 <div className="text-xs text-muted-foreground">Failures</div>
 </div>
 </div>
 {suggestions.analysis.patterns_detected.length > 0 && (
 <div className="flex flex-wrap gap-2">
 <span className="text-xs text-muted-foreground">Patterns detected:</span>
 {suggestions.analysis.patterns_detected.map((p, i) => (
 <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent">
 {p}
 </span>
 ))}
 </div>
 )}
 </div>

 {/* Suggestions List */}
 <div>
 <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
 🔧 Remediation Suggestions ({suggestions.suggestions_count})
 <span className="px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive">
 {suggestions.high_priority_count} high priority
 </span>
 </h3>
 <div className="space-y-4">
 {suggestions.suggestions.map((s) => (
 <div
 key={s.id}
 className={`rounded-lg border p-4 ${
 s.priority === 'high' ? 'border-destructive/20 bg-destructive/5' :
 s.priority === 'medium' ? 'border-warning/20 bg-warning/5' :
 'border-border bg-muted/50'
 }`}
 >
 <div className="flex items-start justify-between mb-2">
 <div className="flex items-center gap-2">
 <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
 s.priority === 'high' ? 'bg-destructive/20 text-destructive' :
 s.priority === 'medium' ? 'bg-warning/20 text-warning' :
 'bg-secondary text-foreground'
 }`}>
 {s.priority}
 </span>
 <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
 {s.category.replace(/_/g, ' ')}
 </span>
 <span className="text-xs text-muted-foreground">
 {Math.round(s.confidence * 100)}% confidence
 </span>
 </div>
 </div>

 <h4 className="font-semibold text-foreground mb-1">{s.title}</h4>
 <p className="text-sm text-muted-foreground mb-2">{s.description}</p>

 <div className="text-xs text-accent mb-3">
 <strong>Pattern matched:</strong> {s.pattern_matched}
 </div>

 {s.code_example && (
 <div className="mb-3 rounded-lg bg-background p-4 overflow-x-auto">
 <div className="flex gap-4 mb-3">
 <div className="flex-1">
 <div className="text-xs text-destructive mb-2 font-semibold">❌ Before</div>
 <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{s.code_example.before}</pre>
 </div>
 <div className="w-px bg-card" />
 <div className="flex-1">
 <div className="text-xs text-success mb-2 font-semibold">✅ After</div>
 <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{s.code_example.after}</pre>
 </div>
 </div>
 <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
 💡 {s.code_example.explanation}
 </p>
 </div>
 )}

 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <div className="text-xs font-medium text-success mb-1">Impact</div>
 <p className="text-muted-foreground">{s.impact}</p>
 </div>
 <div>
 <div className="text-xs font-medium text-primary mb-1">Implementation Steps</div>
 <ol className="text-muted-foreground list-decimal list-inside text-xs space-y-0.5">
 {s.implementation_steps.map((step, i) => (
 <li key={i}>{step}</li>
 ))}
 </ol>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {suggestions.suggestions.length === 0 && (
 <div className="text-center py-8 text-muted-foreground">
 <p className="text-lg mb-2">✅ No specific suggestions at this time</p>
 <p className="text-sm">The test failure patterns don't match known flakiness issues.</p>
 </div>
 )}
 </div>
 ) : (
 <div className="text-center py-8 text-muted-foreground">
 <p>Failed to load suggestions. Please try again.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Feature #1107: Release from Quarantine Confirmation Modal */}
 {showReleaseConfirmModal && testToRelease && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
 <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-xl m-4">
 <div className="flex items-center justify-between px-6 py-4 border-b border-border">
 <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
 <span>🔓</span> Release from Quarantine
 </h2>
 <button
 onClick={() => {
 setShowReleaseConfirmModal(false);
 setTestToRelease(null);
 }}
 className="p-2 rounded-lg hover:bg-muted transition-colors"
 >
 ✕
 </button>
 </div>

 <div className="p-6 space-y-4">
 <div className="p-4 rounded-lg bg-success/5 border border-success/20">
 <div className="font-semibold text-success mb-1">
 {testToRelease.test_name}
 </div>
 <p className="text-sm text-success">
 This test will be released from quarantine and will:
 </p>
 </div>

 <ul className="space-y-2 text-sm text-muted-foreground">
 <li className="flex items-start gap-2">
 <span className="text-success mt-0.5">✓</span>
 <span>Return to <strong className="text-foreground">normal execution</strong> in CI/CD pipelines</span>
 </li>
 <li className="flex items-start gap-2">
 <span className="text-success mt-0.5">✓</span>
 <span>Test failures will <strong className="text-foreground">block builds</strong> again</span>
 </li>
 <li className="flex items-start gap-2">
 <span className="text-primary mt-0.5">🔍</span>
 <span><strong className="text-foreground">Monitoring continues</strong> - if flakiness returns above threshold, the test may be auto-quarantined again</span>
 </li>
 </ul>

 {autoQuarantineSettings?.enabled && (
 <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
 <div className="flex items-center gap-2 text-primary">
 <span>🤖</span>
 <span className="font-medium">Auto-Quarantine Active</span>
 </div>
 <p className="text-primary mt-1">
 If this test exceeds {(autoQuarantineSettings.threshold * 100).toFixed(0)}% flakiness
 after {autoQuarantineSettings.min_runs} runs, it will be automatically re-quarantined.
 </p>
 </div>
 )}

 <div className="flex gap-3 pt-4">
 <button
 onClick={() => {
 setShowReleaseConfirmModal(false);
 setTestToRelease(null);
 }}
 className="flex-1 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
 disabled={isReleasingFromQuarantine}
 >
 Cancel
 </button>
 <button
 onClick={confirmReleaseFromQuarantine}
 disabled={isReleasingFromQuarantine}
 className="flex-1 px-4 py-2 rounded-lg bg-success text-white hover:bg-success transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
 >
 {isReleasingFromQuarantine ? (
 <>
 <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
 Releasing...
 </>
 ) : (
 <>
 <span>🔓</span> Confirm Release
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Feature #1953: AI Flakiness Analysis Modal */}
 {showFlakinessAnalysisModal && selectedTestForAnalysis && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
 <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
 <div className="p-4 border-b border-border bg-gradient-to-r from-accent/10 to-accent/5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-full bg-gradient-to-r from-accent to-accent/70 flex items-center justify-center">
 <span className="text-white text-lg">🤖</span>
 </div>
 <div>
 <h3 className="font-semibold text-foreground">AI Flakiness Analysis</h3>
 <p className="text-sm text-muted-foreground truncate max-w-md" title={selectedTestForAnalysis.test_name}>
 {selectedTestForAnalysis.test_name}
 </p>
 </div>
 </div>
 <button
 onClick={() => setShowFlakinessAnalysisModal(false)}
 className="p-2 rounded-full hover:bg-muted transition-colors"
 >
 <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 </div>

 <div className="p-4 overflow-y-auto max-h-[60vh]">
 {/* Test Stats Summary */}
 <div className="grid grid-cols-4 gap-3 mb-4">
 <div className="bg-muted/50 rounded-lg p-2 text-center">
 <div className="text-lg font-bold text-foreground">{selectedTestForAnalysis.total_runs}</div>
 <div className="text-xs text-muted-foreground">Total Runs</div>
 </div>
 <div className="bg-muted/50 rounded-lg p-2 text-center">
 <div className="text-lg font-bold text-destructive">{(selectedTestForAnalysis.flakiness_score * 100).toFixed(0)}%</div>
 <div className="text-xs text-muted-foreground">Flaky</div>
 </div>
 <div className="bg-muted/50 rounded-lg p-2 text-center">
 <div className="text-lg font-bold text-success">{selectedTestForAnalysis.pass_rate}%</div>
 <div className="text-xs text-muted-foreground">Pass Rate</div>
 </div>
 <div className="bg-muted/50 rounded-lg p-2 text-center">
 <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
 {selectedTestForAnalysis.has_time_pattern && <span title="Time pattern">⏰</span>}
 {selectedTestForAnalysis.has_environment_pattern && <span title="Env pattern">🖥️</span>}
 {selectedTestForAnalysis.is_retry_flaky && <span title="Retry flaky">🔄</span>}
 {!selectedTestForAnalysis.has_time_pattern && !selectedTestForAnalysis.has_environment_pattern && !selectedTestForAnalysis.is_retry_flaky && '—'}
 </div>
 <div className="text-xs text-muted-foreground">Patterns</div>
 </div>
 </div>

 {/* AI Analysis Content */}
 {isLoadingFlakinessAnalysis ? (
 <div className="flex flex-col items-center justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mb-3" />
 <p className="text-sm text-muted-foreground">Analyzing flakiness patterns...</p>
 </div>
 ) : flakinessAnalysis ? (
 <div className="prose prose-sm max-w-none">
 <div className="bg-gradient-to-r from-accent/10 to-accent/5 rounded-lg p-4 border border-accent/20">
 <div className="whitespace-pre-wrap text-sm text-foreground">{flakinessAnalysis}</div>
 </div>
 </div>
 ) : null}

 {/* Cached indicator */}
 {flakinessAnalysisCache[selectedTestForAnalysis.test_id] && !isLoadingFlakinessAnalysis && (
 <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
 <span className="flex items-center gap-1">
 <span>💾</span> Cached analysis (24hr)
 </span>
 <button
 onClick={() => {
 // Clear cache and re-analyze
 setFlakinessAnalysisCache(prev => {
 const { [selectedTestForAnalysis.test_id]: _, ...rest } = prev;
 return rest;
 });
 handleAnalyzeFlakiness(selectedTestForAnalysis);
 }}
 className="text-accent hover:text-accent/80"
 >
 🔄 Refresh
 </button>
 </div>
 )}
 </div>

 <div className="p-4 border-t border-border bg-muted/30 flex justify-between">
 <button
 onClick={() => handleGetSuggestions(selectedTestForAnalysis.test_id)}
 className="px-4 py-2 text-sm font-medium rounded-lg border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
 >
 💡 Get Fix Suggestions
 </button>
 <button
 onClick={() => setShowFlakinessAnalysisModal(false)}
 className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </Layout>
 );
}
