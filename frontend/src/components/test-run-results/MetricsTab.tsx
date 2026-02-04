/**
 * MetricsTab Component
 * Feature #46: Extracted from TestRunResultPage.tsx for modular architecture
 *
 * Displays Lighthouse performance metrics, K6 load test results,
 * Core Web Vitals, and AI-powered performance analysis.
 */

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Cell,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
} from 'recharts';
import CircularGauge from './CircularGauge';
import { formatBytes } from './utils';
import { TestResult, LoadTestResult, LighthouseResult, K6ActiveTab, K6ActiveChart, LighthouseActiveTab, K6ExportFormat } from './types';

// Props interface for MetricsTab
export interface MetricsTabProps {
  // Performance and load test data
  performanceResults: TestResult[];
  loadTestResults: TestResult[];

  // Lighthouse tab state
  lighthouseActiveTab: LighthouseActiveTab;
  setLighthouseActiveTab: (tab: LighthouseActiveTab) => void;

  // K6 tab state
  k6ActiveTab: K6ActiveTab;
  setK6ActiveTab: (tab: K6ActiveTab) => void;
  k6ActiveChart: K6ActiveChart;
  setK6ActiveChart: (chart: K6ActiveChart) => void;
  k6ShowThresholds: boolean;
  setK6ShowThresholds: (show: boolean) => void;
  k6ExportFormat: K6ExportFormat;
  setK6ExportFormat: (format: K6ExportFormat) => void;

  // Expanded state
  expandedOpportunities: Set<string>;
  toggleOpportunity: (id: string) => void;
  expandedDiagnostics: Set<string>;
  toggleDiagnostic: (id: string) => void;
  expandedPassedAudits: Set<string>;
  togglePassedAudit: (id: string) => void;
  passedAuditsCollapsed: boolean;
  setPassedAuditsCollapsed: (collapsed: boolean) => void;
  expandedEndpoints: Set<string>;
  toggleEndpoint: (endpoint: string) => void;

  // Endpoint sorting
  endpointSortBy: 'avg_time' | 'p95_time' | 'error_rate' | 'count';
  setEndpointSortBy: (sortBy: 'avg_time' | 'p95_time' | 'error_rate' | 'count') => void;
  endpointSortDesc: boolean;
  setEndpointSortDesc: (desc: boolean) => void;

  // Security insights state
  securityInsightsCollapsed: boolean;
  setSecurityInsightsCollapsed: (collapsed: boolean) => void;
  expandedMixedContentResources: boolean;
  setExpandedMixedContentResources: (expanded: boolean) => void;

  // AI analysis state
  perfAILoading: boolean;
  perfAIResult: Record<string, string>;
  setPerfAIResult: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  perfAIError: string | null;
  perfAIAnalysisOpen: string | null;

  // Handler functions
  analyzePerformanceResults: (testName: string, lighthouse: any, loadTest?: any) => void;
  exportK6Results: (loadTestData: any, testName: string, format: K6ExportFormat) => void;
  exportK6ResultsPDF: (loadTestData: any, testName: string) => void;
  exportLighthousePDF: (lighthouse: any, testName: string, url?: string) => void;
  generateK6TimeSeries: (loadTestData: any) => Array<{ time: string; vus: number; rps: number; avg_response_time: number; p95_response_time: number }>;
  generateResponseTimeHistogram: (loadTestData: any) => Array<{ range: string; count: number; percentage: number }>;

  // Comparison state
  showPreviousComparison: boolean;
  setShowPreviousComparison: (show: boolean) => void;
}

const MetricsTab: React.FC<MetricsTabProps> = ({
  performanceResults,
  loadTestResults,
  lighthouseActiveTab,
  setLighthouseActiveTab,
  k6ActiveTab,
  setK6ActiveTab,
  k6ActiveChart,
  setK6ActiveChart,
  k6ShowThresholds,
  setK6ShowThresholds,
  k6ExportFormat,
  setK6ExportFormat,
  expandedOpportunities,
  toggleOpportunity,
  expandedDiagnostics,
  toggleDiagnostic,
  expandedPassedAudits,
  togglePassedAudit,
  passedAuditsCollapsed,
  setPassedAuditsCollapsed,
  expandedEndpoints,
  toggleEndpoint,
  endpointSortBy,
  setEndpointSortBy,
  endpointSortDesc,
  setEndpointSortDesc,
  securityInsightsCollapsed,
  setSecurityInsightsCollapsed,
  expandedMixedContentResources,
  setExpandedMixedContentResources,
  perfAILoading,
  perfAIResult,
  setPerfAIResult,
  perfAIError,
  perfAIAnalysisOpen,
  analyzePerformanceResults,
  exportK6Results,
  exportK6ResultsPDF,
  exportLighthousePDF,
  generateK6TimeSeries,
  generateResponseTimeHistogram,
  showPreviousComparison,
  setShowPreviousComparison,
}) => {
  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Performance Metrics</h2>
          <p className="text-sm text-muted-foreground mt-1">Lighthouse audit results and performance analysis</p>
        </div>
        {/* Compare with previous run toggle */}
        <button
          onClick={() => setShowPreviousComparison(!showPreviousComparison)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            showPreviousComparison
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Compare Previous
          </span>
        </button>
      </div>

      {/* Lighthouse Results */}
      {performanceResults.length > 0 && (
        <div className="mb-8">
          {performanceResults.map((result, idx) => {
            const lighthouse = result.steps.find(s => s.lighthouse)?.lighthouse;
            if (!lighthouse) return null;

            // Feature #1887: Use real opportunities and diagnostics from backend
            const opportunities = (lighthouse.opportunities || [])
              .map((opp: any) => ({
                id: opp.id,
                title: opp.title,
                savings: opp.savings >= 1000 ? `${(opp.savings / 1000).toFixed(1)}s` : `${opp.savings}ms`,
                details: opp.description,
              }))
              .sort((a: any, b: any) => {
                const savingsA = parseFloat(a.savings) * (a.savings.includes('s') ? 1000 : 1);
                const savingsB = parseFloat(b.savings) * (b.savings.includes('s') ? 1000 : 1);
                return savingsB - savingsA;
              });

            const diagnostics = (lighthouse.diagnostics || [])
              .map((diag: any) => ({
                id: diag.id,
                title: diag.title,
                details: diag.description,
              }));

            // Feature #1889: Extract passed audits from lighthouse results
            const passedAudits = (lighthouse.passedAudits || [])
              .map((audit: any) => ({
                id: audit.id,
                title: audit.title,
                details: audit.description,
                category: audit.category || 'Other',
              }));

            // Group passed audits by category
            const passedAuditsByCategory = passedAudits.reduce((acc: Record<string, any[]>, audit: any) => {
              const cat = audit.category;
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(audit);
              return acc;
            }, {});

            return (
              <LighthouseResultCard
                key={idx}
                result={result}
                lighthouse={lighthouse}
                opportunities={opportunities}
                diagnostics={diagnostics}
                passedAudits={passedAudits}
                passedAuditsByCategory={passedAuditsByCategory}
                lighthouseActiveTab={lighthouseActiveTab}
                setLighthouseActiveTab={setLighthouseActiveTab}
                expandedOpportunities={expandedOpportunities}
                toggleOpportunity={toggleOpportunity}
                expandedDiagnostics={expandedDiagnostics}
                toggleDiagnostic={toggleDiagnostic}
                expandedPassedAudits={expandedPassedAudits}
                togglePassedAudit={togglePassedAudit}
                passedAuditsCollapsed={passedAuditsCollapsed}
                setPassedAuditsCollapsed={setPassedAuditsCollapsed}
                securityInsightsCollapsed={securityInsightsCollapsed}
                setSecurityInsightsCollapsed={setSecurityInsightsCollapsed}
                expandedMixedContentResources={expandedMixedContentResources}
                setExpandedMixedContentResources={setExpandedMixedContentResources}
                perfAILoading={perfAILoading}
                perfAIResult={perfAIResult}
                setPerfAIResult={setPerfAIResult}
                perfAIError={perfAIError}
                perfAIAnalysisOpen={perfAIAnalysisOpen}
                analyzePerformanceResults={analyzePerformanceResults}
                exportLighthousePDF={exportLighthousePDF}
              />
            );
          })}
        </div>
      )}

      {/* K6 Load Test Results */}
      {loadTestResults.length > 0 && (
        <div className="mt-10 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <span className="text-3xl">🔥</span> K6 Load Test Results
            </h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={k6ShowThresholds}
                  onChange={(e) => setK6ShowThresholds(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-muted-foreground">Show Thresholds</span>
              </label>
            </div>
          </div>

          {loadTestResults.map((result, idx) => {
            const loadTest = result.load_test;
            if (!loadTest) return null;

            return (
              <K6ResultCard
                key={idx}
                result={result}
                loadTest={loadTest}
                k6ActiveTab={k6ActiveTab}
                setK6ActiveTab={setK6ActiveTab}
                k6ActiveChart={k6ActiveChart}
                setK6ActiveChart={setK6ActiveChart}
                k6ShowThresholds={k6ShowThresholds}
                k6ExportFormat={k6ExportFormat}
                setK6ExportFormat={setK6ExportFormat}
                expandedEndpoints={expandedEndpoints}
                toggleEndpoint={toggleEndpoint}
                endpointSortBy={endpointSortBy}
                setEndpointSortBy={setEndpointSortBy}
                endpointSortDesc={endpointSortDesc}
                setEndpointSortDesc={setEndpointSortDesc}
                perfAILoading={perfAILoading}
                perfAIResult={perfAIResult}
                setPerfAIResult={setPerfAIResult}
                perfAIError={perfAIError}
                perfAIAnalysisOpen={perfAIAnalysisOpen}
                analyzePerformanceResults={analyzePerformanceResults}
                exportK6Results={exportK6Results}
                exportK6ResultsPDF={exportK6ResultsPDF}
                generateK6TimeSeries={generateK6TimeSeries}
                generateResponseTimeHistogram={generateResponseTimeHistogram}
              />
            );
          })}
        </div>
      )}

      {performanceResults.length === 0 && loadTestResults.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-muted-foreground">No performance metrics available for this run.</p>
          <p className="text-sm text-muted-foreground mt-1">Run a Lighthouse or load test to see metrics here.</p>
        </div>
      )}
    </div>
  );
};

// Sub-component props interfaces
interface LighthouseResultCardProps {
  result: TestResult;
  lighthouse: any;
  opportunities: any[];
  diagnostics: any[];
  passedAudits: any[];
  passedAuditsByCategory: Record<string, any[]>;
  lighthouseActiveTab: LighthouseActiveTab;
  setLighthouseActiveTab: (tab: LighthouseActiveTab) => void;
  expandedOpportunities: Set<string>;
  toggleOpportunity: (id: string) => void;
  expandedDiagnostics: Set<string>;
  toggleDiagnostic: (id: string) => void;
  expandedPassedAudits: Set<string>;
  togglePassedAudit: (id: string) => void;
  passedAuditsCollapsed: boolean;
  setPassedAuditsCollapsed: (collapsed: boolean) => void;
  securityInsightsCollapsed: boolean;
  setSecurityInsightsCollapsed: (collapsed: boolean) => void;
  expandedMixedContentResources: boolean;
  setExpandedMixedContentResources: (expanded: boolean) => void;
  perfAILoading: boolean;
  perfAIResult: Record<string, string>;
  setPerfAIResult: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  perfAIError: string | null;
  perfAIAnalysisOpen: string | null;
  analyzePerformanceResults: (testName: string, lighthouse: any, loadTest?: any) => void;
  exportLighthousePDF: (lighthouse: any, testName: string, url?: string) => void;
}

// Lighthouse Result Card Component - renders a single Lighthouse result
const LighthouseResultCard: React.FC<LighthouseResultCardProps> = ({
  result,
  lighthouse,
  opportunities,
  diagnostics,
  passedAudits,
  passedAuditsByCategory,
  lighthouseActiveTab,
  setLighthouseActiveTab,
  expandedOpportunities,
  toggleOpportunity,
  expandedDiagnostics,
  toggleDiagnostic,
  expandedPassedAudits,
  togglePassedAudit,
  passedAuditsCollapsed,
  setPassedAuditsCollapsed,
  securityInsightsCollapsed,
  setSecurityInsightsCollapsed,
  expandedMixedContentResources,
  setExpandedMixedContentResources,
  perfAILoading,
  perfAIResult,
  setPerfAIResult,
  perfAIError,
  perfAIAnalysisOpen,
  analyzePerformanceResults,
  exportLighthousePDF,
}) => {
  // Calculate overall status based on all scores
  const scores = [
    lighthouse.performance || 0,
    lighthouse.accessibility || 0,
    lighthouse.best_practices || lighthouse.bestPractices || 0,
    lighthouse.seo || 0,
  ].filter(s => s > 0);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const lighthouseStatus = minScore >= 90 ? 'excellent' :
                           minScore >= 50 ? 'needs-improvement' : 'poor';

  // Get top 3 opportunities for improvement
  const topOpportunities = opportunities.slice(0, 3);

  // Get low-scoring categories
  const lowScoreCategories = [
    { name: 'Performance', score: lighthouse.performance || 0 },
    { name: 'Accessibility', score: lighthouse.accessibility || 0 },
    { name: 'Best Practices', score: lighthouse.best_practices || lighthouse.bestPractices || 0 },
    { name: 'SEO', score: lighthouse.seo || 0 },
  ].filter(c => c.score < 90 && c.score > 0).sort((a, b) => a.score - b.score);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg shadow-black/5 dark:shadow-black/20">
      {/* Header */}
      <div className="p-5 bg-gradient-to-r from-muted/50 to-muted/20 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{result.test_name}</h3>
            {lighthouse.url && (
              <p className="text-sm text-muted-foreground">{lighthouse.url}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lighthouse.device && (
              <span className="px-2 py-1 text-xs bg-muted rounded-lg text-muted-foreground">
                {lighthouse.device === 'mobile' ? '📱 Mobile' : '🖥️ Desktop'}
              </span>
            )}
            {/* AI Performance Analysis button */}
            <button
              onClick={() => analyzePerformanceResults(result.test_name, lighthouse)}
              disabled={perfAILoading && perfAIAnalysisOpen === result.test_name}
              className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="AI Performance Analysis"
            >
              {perfAILoading && perfAIAnalysisOpen === result.test_name ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <span>🤖</span>
                  AI Analysis
                </>
              )}
            </button>
            {/* PDF Export button */}
            <button
              onClick={() => exportLighthousePDF(lighthouse, result.test_name, lighthouse.url)}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5"
              title="Export as PDF Report"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* AI Performance Analysis Results Panel */}
      {perfAIResult[result.test_name] && (
        <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <h4 className="font-semibold text-purple-700 dark:text-purple-300">AI Performance Analysis</h4>
            </div>
            <button
              onClick={() => setPerfAIResult(prev => {
                const newResult = { ...prev };
                delete newResult[result.test_name];
                return newResult;
              })}
              className="text-muted-foreground hover:text-foreground p-1"
              title="Close analysis"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-sm text-foreground">
              {perfAIResult[result.test_name]}
            </div>
          </div>
        </div>
      )}

      {/* AI Performance Analysis Error */}
      {perfAIError && perfAIAnalysisOpen === result.test_name && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{perfAIError}</span>
          </div>
        </div>
      )}

      {/* Executive Summary Card */}
      <div className={`mx-6 mt-6 p-6 rounded-xl border-2 ${
        lighthouseStatus === 'excellent' ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800' :
        lighthouseStatus === 'needs-improvement' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800' :
        'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800'
      }`}>
        {/* Status Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              lighthouseStatus === 'excellent' ? 'bg-green-100 dark:bg-green-800' :
              lighthouseStatus === 'needs-improvement' ? 'bg-yellow-100 dark:bg-yellow-800' :
              'bg-red-100 dark:bg-red-800'
            }`}>
              {lighthouseStatus === 'excellent' ? (
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : lighthouseStatus === 'needs-improvement' ? (
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div>
              <h4 className={`text-xl font-bold ${
                lighthouseStatus === 'excellent' ? 'text-green-700 dark:text-green-400' :
                lighthouseStatus === 'needs-improvement' ? 'text-yellow-700 dark:text-yellow-400' :
                'text-red-700 dark:text-red-400'
              }`}>
                {lighthouseStatus === 'excellent' ? 'Excellent Performance' :
                 lighthouseStatus === 'needs-improvement' ? 'Needs Improvement' :
                 'Poor Performance'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {lighthouseStatus === 'excellent'
                  ? 'All categories score 90+ - your page meets modern web standards'
                  : lighthouseStatus === 'needs-improvement'
                  ? `${lowScoreCategories.length} categor${lowScoreCategories.length === 1 ? 'y' : 'ies'} below 90: ${lowScoreCategories.map(c => c.name).join(', ')}`
                  : `Critical issues found in ${lowScoreCategories.filter(c => c.score < 50).length} categories`
                }
              </p>
            </div>
          </div>

          {/* Comparison badge if previous audit available */}
          {lighthouse.comparison_to_previous && (
            <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              lighthouse.comparison_to_previous.improved
                ? 'bg-green-100 text-green-700 dark:bg-green-800/50 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-300'
            }`}>
              {lighthouse.comparison_to_previous.improved ? '↑' : '↓'} {Math.abs(lighthouse.comparison_to_previous.avg_change || 0)} pts vs previous
            </div>
          )}
        </div>

        {/* Score Gauges in Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Performance', value: lighthouse.performance, icon: '⚡' },
            { label: 'Accessibility', value: lighthouse.accessibility, icon: '♿' },
            { label: 'Best Practices', value: lighthouse.best_practices || lighthouse.bestPractices, icon: '✓' },
            { label: 'SEO', value: lighthouse.seo, icon: '🔍' },
          ].filter(m => m.value !== undefined).map(metric => (
            <div key={metric.label} className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">{metric.icon}</div>
              <div className={`text-3xl font-bold ${
                (metric.value || 0) >= 90 ? 'text-green-600' :
                (metric.value || 0) >= 50 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {metric.value}
              </div>
              <div className="text-sm text-muted-foreground font-medium">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Top 3 Issues to Fix */}
        {topOpportunities.length > 0 && (
          <div className="bg-white/30 dark:bg-gray-800/30 rounded-lg p-4 mb-4">
            <h5 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <span>🎯</span> Top Issues to Fix
            </h5>
            <div className="space-y-2">
              {topOpportunities.map((opp: any, i: number) => (
                <div key={opp.id || i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-300' :
                      i === 1 ? 'bg-orange-100 text-orange-700 dark:bg-orange-800/50 dark:text-orange-300' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-800/50 dark:text-yellow-300'
                    }`}>{i + 1}</span>
                    <span className="text-foreground">{opp.title}</span>
                  </div>
                  <span className={`font-medium ${
                    parseFloat(opp.savings) >= 1 ? 'text-red-600' :
                    parseFloat(opp.savings) >= 0.5 ? 'text-orange-600' :
                    'text-yellow-600'
                  }`}>
                    Save {opp.savings}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* One-liner Summary */}
        <div className="pt-4 border-t border-current/10">
          <p className="text-sm text-muted-foreground italic">
            📊 <strong>Summary:</strong>{' '}
            {lighthouseStatus === 'excellent'
              ? `This page excels across all Lighthouse categories with an average score of ${avgScore}. It provides a fast, accessible, and SEO-friendly experience.`
              : lighthouseStatus === 'needs-improvement'
              ? `This page has an average score of ${avgScore}. Focus on ${lowScoreCategories[0]?.name || 'performance'} (${lowScoreCategories[0]?.score || 0}) to achieve the biggest improvement${topOpportunities[0] ? ` - fixing "${topOpportunities[0].title}" could save ${topOpportunities[0].savings}` : ''}.`
              : `Critical performance issues detected with an average score of ${avgScore}. ${lowScoreCategories.filter(c => c.score < 50).map(c => c.name).join(' and ')} need${lowScoreCategories.filter(c => c.score < 50).length === 1 ? 's' : ''} immediate attention.`
            }
          </p>
        </div>
      </div>

      {/* Tabbed Interface for Lighthouse Results */}
      <div className="border-b border-border">
        <nav className="flex overflow-x-auto px-6 -mb-px">
          {[
            { id: 'overview' as const, label: 'Overview', icon: '📊' },
            { id: 'performance' as const, label: 'Performance', icon: '⚡' },
            { id: 'accessibility' as const, label: 'Accessibility', icon: '♿' },
            { id: 'best_practices' as const, label: 'Best Practices', icon: '✓' },
            { id: 'seo' as const, label: 'SEO', icon: '🔍' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setLighthouseActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                lighthouseActiveTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {/* Overview Tab */}
        {lighthouseActiveTab === 'overview' && (
          <LighthouseOverviewTab
            lighthouse={lighthouse}
            opportunities={opportunities}
            diagnostics={diagnostics}
            expandedOpportunities={expandedOpportunities}
            toggleOpportunity={toggleOpportunity}
            expandedDiagnostics={expandedDiagnostics}
            toggleDiagnostic={toggleDiagnostic}
          />
        )}

        {/* Performance Tab */}
        {lighthouseActiveTab === 'performance' && (
          <LighthousePerformanceTab
            lighthouse={lighthouse}
            opportunities={opportunities}
            diagnostics={diagnostics}
            expandedOpportunities={expandedOpportunities}
            toggleOpportunity={toggleOpportunity}
            expandedDiagnostics={expandedDiagnostics}
            toggleDiagnostic={toggleDiagnostic}
          />
        )}

        {/* Accessibility Tab */}
        {lighthouseActiveTab === 'accessibility' && (
          <LighthouseAccessibilityTab
            lighthouse={lighthouse}
            passedAudits={passedAudits}
          />
        )}

        {/* Best Practices Tab */}
        {lighthouseActiveTab === 'best_practices' && (
          <LighthouseBestPracticesTab
            lighthouse={lighthouse}
            passedAudits={passedAudits}
          />
        )}

        {/* SEO Tab */}
        {lighthouseActiveTab === 'seo' && (
          <LighthouseSEOTab
            lighthouse={lighthouse}
            passedAudits={passedAudits}
          />
        )}

        {/* Security Insights section */}
        {(lighthouse.csp || lighthouse.mixedContent || lighthouse.authentication) && (
          <SecurityInsightsSection
            lighthouse={lighthouse}
            securityInsightsCollapsed={securityInsightsCollapsed}
            setSecurityInsightsCollapsed={setSecurityInsightsCollapsed}
            expandedMixedContentResources={expandedMixedContentResources}
            setExpandedMixedContentResources={setExpandedMixedContentResources}
          />
        )}
      </div>
    </div>
  );
};

// Placeholder components for the sub-sections
// These will be implemented inline to keep the file self-contained

interface LighthouseOverviewTabProps {
  lighthouse: any;
  opportunities: any[];
  diagnostics: any[];
  expandedOpportunities: Set<string>;
  toggleOpportunity: (id: string) => void;
  expandedDiagnostics: Set<string>;
  toggleDiagnostic: (id: string) => void;
}

const LighthouseOverviewTab: React.FC<LighthouseOverviewTabProps> = ({
  lighthouse,
  opportunities,
  diagnostics,
  expandedOpportunities,
  toggleOpportunity,
  expandedDiagnostics,
  toggleDiagnostic,
}) => (
  <>
    {/* Circular Gauges for main scores */}
    <div className="flex justify-center gap-8 flex-wrap mb-8">
      {[
        { label: 'Performance', value: lighthouse.performance },
        { label: 'Accessibility', value: lighthouse.accessibility },
        { label: 'Best Practices', value: lighthouse.best_practices || lighthouse.bestPractices },
        { label: 'SEO', value: lighthouse.seo },
      ].filter(m => m.value !== undefined).map(metric => (
        <CircularGauge
          key={metric.label}
          score={metric.value || 0}
          label={metric.label}
          size={100}
        />
      ))}
    </div>

    {/* Core Web Vitals with visual gauges */}
    {lighthouse.metrics && (
      <CoreWebVitalsSection lighthouse={lighthouse} />
    )}
  </>
);

interface LighthousePerformanceTabProps {
  lighthouse: any;
  opportunities: any[];
  diagnostics: any[];
  expandedOpportunities: Set<string>;
  toggleOpportunity: (id: string) => void;
  expandedDiagnostics: Set<string>;
  toggleDiagnostic: (id: string) => void;
}

const LighthousePerformanceTab: React.FC<LighthousePerformanceTabProps> = ({
  lighthouse,
  opportunities,
  diagnostics,
  expandedOpportunities,
  toggleOpportunity,
  expandedDiagnostics,
  toggleDiagnostic,
}) => (
  <>
    {/* Performance metrics (Core Web Vitals) */}
    {lighthouse.metrics && (
      <div className="border border-border rounded-xl p-5 mb-6 shadow-sm bg-card">
        <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
          <span className="text-lg">⚡</span> Core Web Vitals
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'LCP', value: lighthouse.metrics.lcp, unit: 'ms', good: 2500, description: 'Largest Contentful Paint' },
            { label: 'FCP', value: lighthouse.metrics.fcp, unit: 'ms', good: 1800, description: 'First Contentful Paint' },
            { label: 'CLS', value: lighthouse.metrics.cls, unit: '', good: 0.1, description: 'Cumulative Layout Shift' },
            { label: 'TBT', value: lighthouse.metrics.tbt, unit: 'ms', good: 200, description: 'Total Blocking Time' },
          ].filter(m => m.value !== undefined).map(metric => (
            <div key={metric.label} className="p-4 bg-muted/30 rounded-lg">
              <div className={`text-2xl font-bold ${
                metric.label === 'CLS'
                  ? (metric.value || 0) <= metric.good ? 'text-green-600' : 'text-red-600'
                  : (metric.value || 0) <= metric.good ? 'text-green-600' : 'text-red-600'
              }`}>
                {metric.label === 'CLS'
                  ? (metric.value || 0).toFixed(3)
                  : `${Math.round(metric.value || 0)}${metric.unit}`}
              </div>
              <div className="text-sm font-medium text-foreground">{metric.label}</div>
              <div className="text-xs text-muted-foreground">{metric.description}</div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Filmstrip view of page load */}
    {lighthouse.filmstrip && lighthouse.filmstrip.length > 0 && (
      <FilmstripSection lighthouse={lighthouse} />
    )}

    {/* Opportunities section */}
    <OpportunitiesSection
      opportunities={opportunities}
      expandedOpportunities={expandedOpportunities}
      toggleOpportunity={toggleOpportunity}
    />

    {/* Diagnostics section */}
    <DiagnosticsSection
      diagnostics={diagnostics}
      expandedDiagnostics={expandedDiagnostics}
      toggleDiagnostic={toggleDiagnostic}
    />
  </>
);

interface LighthouseAccessibilityTabProps {
  lighthouse: any;
  passedAudits: any[];
}

const LighthouseAccessibilityTab: React.FC<LighthouseAccessibilityTabProps> = ({
  lighthouse,
  passedAudits,
}) => (
  <>
    {/* Accessibility Score */}
    <div className="flex justify-center mb-6">
      <CircularGauge
        score={lighthouse.accessibility || 0}
        label="Accessibility"
        size={120}
      />
    </div>

    {/* Accessibility-specific passed audits */}
    {passedAudits.filter((a: any) => a.category === 'Accessibility').length > 0 && (
      <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-border">
          <h4 className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
            <span className="text-lg">✅</span> Passed Accessibility Audits
            <span className="text-xs bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded-full ml-2">
              {passedAudits.filter((a: any) => a.category === 'Accessibility').length} passed
            </span>
          </h4>
        </div>
        <div className="divide-y divide-border max-h-64 overflow-y-auto">
          {passedAudits.filter((a: any) => a.category === 'Accessibility').slice(0, 10).map((audit: any) => (
            <div key={audit.id} className="p-3 flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span className="text-sm text-foreground">{audit.title}</span>
            </div>
          ))}
          {passedAudits.filter((a: any) => a.category === 'Accessibility').length > 10 && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              +{passedAudits.filter((a: any) => a.category === 'Accessibility').length - 10} more passed
            </div>
          )}
        </div>
      </div>
    )}

    {/* Note about accessibility */}
    <div className="border border-border rounded-xl p-4 bg-muted/30 text-sm text-muted-foreground">
      <p>💡 <strong>Tip:</strong> Accessibility improvements help users with disabilities and often improve overall user experience. Focus on color contrast, keyboard navigation, and screen reader compatibility.</p>
    </div>
  </>
);

interface LighthouseBestPracticesTabProps {
  lighthouse: any;
  passedAudits: any[];
}

const LighthouseBestPracticesTab: React.FC<LighthouseBestPracticesTabProps> = ({
  lighthouse,
  passedAudits,
}) => (
  <>
    {/* Best Practices Score */}
    <div className="flex justify-center mb-6">
      <CircularGauge
        score={lighthouse.best_practices || lighthouse.bestPractices || 0}
        label="Best Practices"
        size={120}
      />
    </div>

    {/* Best Practices passed audits */}
    {passedAudits.filter((a: any) => a.category === 'Best Practices').length > 0 && (
      <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
        <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-b border-border">
          <h4 className="font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
            <span className="text-lg">✓</span> Passed Best Practice Audits
            <span className="text-xs bg-purple-100 dark:bg-purple-800 px-2 py-0.5 rounded-full ml-2">
              {passedAudits.filter((a: any) => a.category === 'Best Practices').length} passed
            </span>
          </h4>
        </div>
        <div className="divide-y divide-border max-h-64 overflow-y-auto">
          {passedAudits.filter((a: any) => a.category === 'Best Practices').slice(0, 10).map((audit: any) => (
            <div key={audit.id} className="p-3 flex items-center gap-2">
              <span className="text-purple-500">✓</span>
              <span className="text-sm text-foreground">{audit.title}</span>
            </div>
          ))}
          {passedAudits.filter((a: any) => a.category === 'Best Practices').length > 10 && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              +{passedAudits.filter((a: any) => a.category === 'Best Practices').length - 10} more passed
            </div>
          )}
        </div>
      </div>
    )}
  </>
);

interface LighthouseSEOTabProps {
  lighthouse: any;
  passedAudits: any[];
}

const LighthouseSEOTab: React.FC<LighthouseSEOTabProps> = ({
  lighthouse,
  passedAudits,
}) => (
  <>
    {/* SEO Score */}
    <div className="flex justify-center mb-6">
      <CircularGauge
        score={lighthouse.seo || 0}
        label="SEO"
        size={120}
      />
    </div>

    {/* SEO passed audits */}
    {passedAudits.filter((a: any) => a.category === 'SEO').length > 0 && (
      <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-border">
          <h4 className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <span className="text-lg">🔍</span> Passed SEO Audits
            <span className="text-xs bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded-full ml-2">
              {passedAudits.filter((a: any) => a.category === 'SEO').length} passed
            </span>
          </h4>
        </div>
        <div className="divide-y divide-border max-h-64 overflow-y-auto">
          {passedAudits.filter((a: any) => a.category === 'SEO').slice(0, 10).map((audit: any) => (
            <div key={audit.id} className="p-3 flex items-center gap-2">
              <span className="text-blue-500">✓</span>
              <span className="text-sm text-foreground">{audit.title}</span>
            </div>
          ))}
          {passedAudits.filter((a: any) => a.category === 'SEO').length > 10 && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              +{passedAudits.filter((a: any) => a.category === 'SEO').length - 10} more passed
            </div>
          )}
        </div>
      </div>
    )}

    {/* SEO Tips */}
    <div className="border border-border rounded-xl p-4 bg-muted/30 text-sm text-muted-foreground">
      <p>💡 <strong>Tip:</strong> Good SEO helps search engines understand and rank your page. Ensure proper meta tags, structured data, and mobile-friendly design.</p>
    </div>
  </>
);

// Core Web Vitals Section
const CoreWebVitalsSection: React.FC<{ lighthouse: any }> = ({ lighthouse }) => (
  <div className="border border-border rounded-lg p-4 mb-6">
    <div className="flex items-center justify-between mb-4">
      <h4 className="font-medium text-foreground flex items-center gap-2">
        <span>⚡</span> Core Web Vitals
      </h4>
      <div className="flex gap-4">
        <span className="flex items-center gap-1 text-xs text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500"></span> Good
        </span>
        <span className="flex items-center gap-1 text-xs text-yellow-600">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Needs Improvement
        </span>
        <span className="flex items-center gap-1 text-xs text-red-600">
          <span className="w-2 h-2 rounded-full bg-red-500"></span> Poor
        </span>
      </div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[
        { label: 'LCP', fullName: 'Largest Contentful Paint', value: lighthouse.metrics.lcp, format: (v: number) => `${(v / 1000).toFixed(2)}s`, threshold: { good: 2500, poor: 4000, max: 8000 }, description: 'Measures loading performance' },
        { label: 'FCP', fullName: 'First Contentful Paint', value: lighthouse.metrics.fcp, format: (v: number) => `${(v / 1000).toFixed(2)}s`, threshold: { good: 1800, poor: 3000, max: 6000 }, description: 'First content visible' },
        { label: 'CLS', fullName: 'Cumulative Layout Shift', value: lighthouse.metrics.cls, format: (v: number) => v.toFixed(3), threshold: { good: 0.1, poor: 0.25, max: 0.5 }, description: 'Visual stability' },
        { label: 'TBT', fullName: 'Total Blocking Time', value: lighthouse.metrics.tbt, format: (v: number) => `${v}ms`, threshold: { good: 200, poor: 600, max: 1200 }, description: 'Main thread blocking' },
      ].filter(m => m.value !== undefined).map(metric => {
        const value = metric.value || 0;
        const status = value <= metric.threshold.good ? 'good' : value <= metric.threshold.poor ? 'needs-improvement' : 'poor';

        return (
          <div
            key={metric.label}
            className={`p-4 rounded-lg ${
              status === 'good' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
              status === 'needs-improvement' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' :
              'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground mb-1">{metric.label}</div>
            <div className={`text-2xl font-bold ${
              status === 'good' ? 'text-green-600 dark:text-green-400' :
              status === 'needs-improvement' ? 'text-yellow-600 dark:text-yellow-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {metric.format(value)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">{metric.description}</div>
          </div>
        );
      })}
    </div>
  </div>
);

// Filmstrip Section
const FilmstripSection: React.FC<{ lighthouse: any }> = ({ lighthouse }) => (
  <div className="border border-border rounded-xl p-5 mb-6 shadow-sm bg-card">
    <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
      <span className="text-lg">🎬</span> Page Load Filmstrip
      <span className="text-xs text-muted-foreground font-normal ml-2">
        Click to view full size
      </span>
    </h4>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {lighthouse.filmstrip.map((frame: { timestamp_ms: number; screenshot_base64: string; label?: string }, idx: number) => (
        <div
          key={idx}
          className="flex-shrink-0 cursor-pointer group"
          onClick={() => {
            const img = document.createElement('img');
            img.src = `data:image/png;base64,${frame.screenshot_base64}`;
            img.className = 'max-w-full max-h-full';
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';
            modal.onclick = () => modal.remove();
            modal.appendChild(img);
            document.body.appendChild(modal);
          }}
        >
          <div className="relative">
            <img
              src={`data:image/png;base64,${frame.screenshot_base64}`}
              alt={`Frame at ${frame.timestamp_ms}ms`}
              className="h-24 w-auto rounded border border-border group-hover:border-primary transition-colors"
            />
            {frame.label && (
              <span className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                frame.label === 'LCP' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                frame.label === 'TTI' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}>
                {frame.label}
              </span>
            )}
          </div>
          <div className="text-center text-xs text-muted-foreground mt-1">
            {frame.timestamp_ms >= 1000
              ? `${(frame.timestamp_ms / 1000).toFixed(1)}s`
              : `${frame.timestamp_ms}ms`
            }
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Opportunities Section
const OpportunitiesSection: React.FC<{
  opportunities: any[];
  expandedOpportunities: Set<string>;
  toggleOpportunity: (id: string) => void;
}> = ({ opportunities, expandedOpportunities, toggleOpportunity }) => (
  <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
    <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-b border-border flex items-center justify-between">
      <h4 className="font-semibold text-foreground flex items-center gap-2">
        <span className="text-lg">💡</span> Opportunities
      </h4>
      <span className="text-xs text-muted-foreground">
        {opportunities.length} suggestions
      </span>
    </div>
    <div className="divide-y divide-border">
      {opportunities.map((opp) => (
        <div key={opp.id} className="bg-background">
          <button
            onClick={() => toggleOpportunity(opp.id)}
            className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg
                className={`w-4 h-4 transition-transform ${expandedOpportunities.has(opp.id) ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm text-foreground">{opp.title}</span>
            </div>
            <span className="text-sm font-medium text-orange-600">
              Save ~{opp.savings}
            </span>
          </button>
          {expandedOpportunities.has(opp.id) && (
            <div className="px-10 pb-3 text-sm text-muted-foreground">
              {opp.details}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Diagnostics Section
const DiagnosticsSection: React.FC<{
  diagnostics: any[];
  expandedDiagnostics: Set<string>;
  toggleDiagnostic: (id: string) => void;
}> = ({ diagnostics, expandedDiagnostics, toggleDiagnostic }) => (
  <div className="border border-border rounded-xl overflow-hidden shadow-sm">
    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-border flex items-center justify-between">
      <h4 className="font-semibold text-foreground flex items-center gap-2">
        <span className="text-lg">🔍</span> Diagnostics
      </h4>
      <span className="text-xs text-muted-foreground">
        {diagnostics.length} items
      </span>
    </div>
    <div className="divide-y divide-border">
      {diagnostics.map((diag) => (
        <div key={diag.id} className="bg-background">
          <button
            onClick={() => toggleDiagnostic(diag.id)}
            className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${expandedDiagnostics.has(diag.id) ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm text-foreground">{diag.title}</span>
          </button>
          {expandedDiagnostics.has(diag.id) && (
            <div className="px-10 pb-3 text-sm text-muted-foreground">
              {diag.details}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Security Insights Section
const SecurityInsightsSection: React.FC<{
  lighthouse: any;
  securityInsightsCollapsed: boolean;
  setSecurityInsightsCollapsed: (collapsed: boolean) => void;
  expandedMixedContentResources: boolean;
  setExpandedMixedContentResources: (expanded: boolean) => void;
}> = ({
  lighthouse,
  securityInsightsCollapsed,
  setSecurityInsightsCollapsed,
  expandedMixedContentResources,
  setExpandedMixedContentResources,
}) => (
  <div className="border border-border rounded-lg overflow-hidden mt-6">
    <button
      onClick={() => setSecurityInsightsCollapsed(!securityInsightsCollapsed)}
      className="w-full p-3 bg-purple-50 dark:bg-purple-900/20 border-b border-border flex items-center justify-between hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
    >
      <h4 className="font-medium text-purple-700 dark:text-purple-400 flex items-center gap-2">
        <span>🔒</span> Security Insights
      </h4>
      <div className="flex items-center gap-2">
        {lighthouse.csp?.blocksLighthouse && (
          <span className="text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">
            CSP Issue
          </span>
        )}
        {lighthouse.mixedContent?.detected && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            lighthouse.mixedContent.securityImpact === 'high'
              ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
              : 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300'
          }`}>
            Mixed Content ({lighthouse.mixedContent.count})
          </span>
        )}
        {lighthouse.authentication?.required && (
          <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
            Auth Required
          </span>
        )}
        <svg
          className={`w-4 h-4 text-purple-600 transition-transform ${securityInsightsCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>
    {!securityInsightsCollapsed && (
      <div className="divide-y divide-border">
        {/* CSP Detection */}
        {lighthouse.csp && (
          <div className="p-4 bg-background">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-3 h-3 rounded-full ${lighthouse.csp.detected ? (lighthouse.csp.blocksLighthouse ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-400'}`}></span>
              <h5 className="font-medium text-foreground">Content Security Policy</h5>
              <span className={`text-xs px-2 py-0.5 rounded ${
                lighthouse.csp.detected
                  ? (lighthouse.csp.blocksLighthouse
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400')
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
              }`}>
                {lighthouse.csp.detected
                  ? (lighthouse.csp.blocksLighthouse ? 'Restrictive' : 'Present')
                  : 'Not Detected'}
              </span>
            </div>
            {lighthouse.csp.warning && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">⚠️ {lighthouse.csp.warning}</p>
            )}
            {lighthouse.csp.suggestion && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300">
                💡 {lighthouse.csp.suggestion}
              </div>
            )}
          </div>
        )}

        {/* Mixed Content Detection */}
        {lighthouse.mixedContent && lighthouse.mixedContent.detected && (
          <div className="p-4 bg-background">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-3 h-3 rounded-full ${lighthouse.mixedContent.securityImpact === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
              <h5 className="font-medium text-foreground">Mixed Content</h5>
            </div>
            {lighthouse.mixedContent.warning && (
              <p className="text-sm text-muted-foreground mb-2">{lighthouse.mixedContent.warning}</p>
            )}
            <div className="flex gap-4 text-sm mb-3">
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">{lighthouse.mixedContent.count}</span>
                <span className="text-muted-foreground">total resources</span>
              </div>
            </div>
          </div>
        )}

        {/* Authentication Detection */}
        {lighthouse.authentication && lighthouse.authentication.required && (
          <div className="p-4 bg-background">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <h5 className="font-medium text-foreground">Authentication Detection</h5>
            </div>
            {lighthouse.authentication.warning && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">⚠️ {lighthouse.authentication.warning}</p>
            )}
            {lighthouse.authentication.suggestion && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300">
                💡 {lighthouse.authentication.suggestion}
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>
);

// K6 Result Card Component placeholder - this will be a very large component
// For now, export a simplified version that delegates to the inline JSX
interface K6ResultCardProps {
  result: TestResult;
  loadTest: LoadTestResult;
  k6ActiveTab: K6ActiveTab;
  setK6ActiveTab: (tab: K6ActiveTab) => void;
  k6ActiveChart: K6ActiveChart;
  setK6ActiveChart: (chart: K6ActiveChart) => void;
  k6ShowThresholds: boolean;
  k6ExportFormat: K6ExportFormat;
  setK6ExportFormat: (format: K6ExportFormat) => void;
  expandedEndpoints: Set<string>;
  toggleEndpoint: (endpoint: string) => void;
  endpointSortBy: 'avg_time' | 'p95_time' | 'error_rate' | 'count';
  setEndpointSortBy: (sortBy: 'avg_time' | 'p95_time' | 'error_rate' | 'count') => void;
  endpointSortDesc: boolean;
  setEndpointSortDesc: (desc: boolean) => void;
  perfAILoading: boolean;
  perfAIResult: Record<string, string>;
  setPerfAIResult: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  perfAIError: string | null;
  perfAIAnalysisOpen: string | null;
  analyzePerformanceResults: (testName: string, lighthouse: any, loadTest?: any) => void;
  exportK6Results: (loadTestData: any, testName: string, format: K6ExportFormat) => void;
  exportK6ResultsPDF: (loadTestData: any, testName: string) => void;
  generateK6TimeSeries: (loadTestData: any) => Array<{ time: string; vus: number; rps: number; avg_response_time: number; p95_response_time: number }>;
  generateResponseTimeHistogram: (loadTestData: any) => Array<{ range: string; count: number; percentage: number }>;
}

const K6ResultCard: React.FC<K6ResultCardProps> = ({
  result,
  loadTest,
  k6ActiveTab,
  setK6ActiveTab,
  k6ActiveChart,
  setK6ActiveChart,
  k6ShowThresholds,
  k6ExportFormat,
  setK6ExportFormat,
  expandedEndpoints,
  toggleEndpoint,
  endpointSortBy,
  setEndpointSortBy,
  endpointSortDesc,
  setEndpointSortDesc,
  perfAILoading,
  perfAIResult,
  setPerfAIResult,
  perfAIError,
  perfAIAnalysisOpen,
  analyzePerformanceResults,
  exportK6Results,
  exportK6ResultsPDF,
  generateK6TimeSeries,
  generateResponseTimeHistogram,
}) => {
  // Check if essential metrics exist
  const hasEssentialMetrics = loadTest.summary?.requests_per_second !== undefined ||
                              loadTest.summary?.total_requests !== undefined ||
                              loadTest.response_times?.avg !== undefined ||
                              loadTest.response_times?.p95 !== undefined;

  // If no essential metrics, show failure state
  if (!hasEssentialMetrics) {
    return (
      <div className="bg-card border border-red-300 dark:border-red-800 rounded-xl overflow-hidden shadow-lg">
        <div className="border-b-4 border-red-500">
          <div className="p-5 bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-900/30 dark:to-red-900/10">
            <div className="flex items-center justify-between mb-3">
              <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-full flex items-center gap-1.5">
                <span>⚡</span> K6 Load Test
              </span>
              <div className="px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                ❌ TEST FAILED
              </div>
            </div>
            <h4 className="text-xl font-semibold text-foreground mb-1">{result.test_name}</h4>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <svg className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h5 className="font-semibold text-red-700 dark:text-red-300 mb-2">Load Test Could Not Complete</h5>
              <p className="text-sm text-red-600 dark:text-red-400">
                The load test failed to collect metrics. This typically happens when the target server could not handle the load.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const successRateNum = parseFloat(String(loadTest.summary?.success_rate).replace('%', '')) || 0;
  const errorRate = 100 - successRateNum;

  // Calculate thresholds status
  const thresholds = loadTest.thresholds || {
    'http_req_duration{expected_response:true}': (loadTest.response_times?.p95 || 0) < 500,
    'http_req_failed': errorRate < 1,
    'http_reqs': (parseFloat(String(loadTest.summary?.requests_per_second)) || 0) > 50,
  };
  const thresholdsPassed = Object.values(thresholds).filter(Boolean).length;
  const thresholdsFailed = Object.values(thresholds).length - thresholdsPassed;

  // Calculate overall status
  const overallStatus = successRateNum >= 99 && errorRate < 1 && thresholdsFailed === 0 ? 'passed' :
                        successRateNum >= 95 && errorRate < 5 ? 'warning' : 'failed';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg shadow-black/5 dark:shadow-black/20">
      {/* Header */}
      <div className={`border-b-4 ${
        overallStatus === 'passed' ? 'border-green-500' :
        overallStatus === 'warning' ? 'border-yellow-500' :
        'border-red-500'
      }`}>
        <div className="p-5 bg-gradient-to-r from-muted/50 to-muted/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full flex items-center gap-1.5">
                <span>⚡</span> K6 Load Test
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(loadTest.started_at || Date.now()).toLocaleString()}
              </span>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 ${
              overallStatus === 'passed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
              overallStatus === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
              'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {overallStatus === 'passed' ? '✅' : overallStatus === 'warning' ? '⚠️' : '❌'}
              {overallStatus === 'passed' ? 'PASSED' : overallStatus === 'warning' ? 'WARNING' : 'FAILED'}
            </div>
          </div>

          <h4 className="text-xl font-semibold text-foreground mb-1">{result.test_name}</h4>
          {loadTest.target_url && (
            <div className="text-sm text-muted-foreground font-mono mb-4">
              🌐 {loadTest.target_url}
            </div>
          )}

          {/* Quick action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportK6Results(loadTest, result.test_name, k6ExportFormat)}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export {k6ExportFormat.toUpperCase()}
            </button>

            <button
              onClick={() => exportK6ResultsPDF(loadTest, result.test_name)}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF
            </button>

            <button
              onClick={() => analyzePerformanceResults(result.test_name, null, loadTest)}
              disabled={perfAILoading && perfAIAnalysisOpen === result.test_name}
              className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {perfAILoading && perfAIAnalysisOpen === result.test_name ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <span>🤖</span>
                  AI Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI Analysis Result */}
      {perfAIResult[result.test_name] && (
        <div className="mx-6 my-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <h4 className="font-semibold text-purple-700 dark:text-purple-300">AI Load Test Analysis</h4>
            </div>
            <button
              onClick={() => setPerfAIResult(prev => {
                const newResult = { ...prev };
                delete newResult[result.test_name];
                return newResult;
              })}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-sm text-foreground">
              {perfAIResult[result.test_name]}
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Summary */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <div className="text-2xl font-bold text-foreground">
              {loadTest.summary?.requests_per_second || '0'}
            </div>
            <div className="text-sm text-muted-foreground">Requests/sec</div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <div className={`text-2xl font-bold ${
              (loadTest.response_times?.p95 || 0) < 200 ? 'text-green-600' :
              (loadTest.response_times?.p95 || 0) < 500 ? 'text-foreground' :
              'text-yellow-600'
            }`}>
              {loadTest.response_times?.p95 || 0}ms
            </div>
            <div className="text-sm text-muted-foreground">P95 Response</div>
          </div>
          <div className={`p-4 rounded-lg text-center ${
            errorRate < 1 ? 'bg-green-50 dark:bg-green-900/20' :
            errorRate < 5 ? 'bg-yellow-50 dark:bg-yellow-900/20' :
            'bg-red-50 dark:bg-red-900/20'
          }`}>
            <div className={`text-2xl font-bold ${
              errorRate < 1 ? 'text-green-600' :
              errorRate < 5 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {errorRate.toFixed(2)}%
            </div>
            <div className="text-sm text-muted-foreground">Error Rate</div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <div className="text-2xl font-bold text-foreground">
              {(loadTest.summary?.total_requests || 0).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Total Requests</div>
          </div>
        </div>

        {/* Tabbed Interface */}
        <div className="border-b border-border mb-6">
          <nav className="flex overflow-x-auto -mb-px">
            {[
              { id: 'overview' as const, label: 'Overview', icon: '📊' },
              { id: 'response_times' as const, label: 'Response Times', icon: '⏱️' },
              { id: 'throughput' as const, label: 'Throughput', icon: '📈' },
              { id: 'errors' as const, label: 'Errors', icon: '⚠️' },
              { id: 'endpoints' as const, label: 'Endpoints', icon: '🔗' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setK6ActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  k6ActiveTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content - Simplified for now */}
        <div className="text-sm text-muted-foreground">
          {k6ActiveTab === 'overview' && (
            <div className="space-y-4">
              <p>Total Requests: {(loadTest.summary?.total_requests || 0).toLocaleString()}</p>
              <p>Success Rate: {loadTest.summary?.success_rate || '0%'}</p>
              <p>Data Transferred: {loadTest.summary?.data_transferred_formatted || '0 B'}</p>
            </div>
          )}
          {k6ActiveTab === 'response_times' && (
            <div className="space-y-4">
              <p>Min: {loadTest.response_times?.min || 0}ms</p>
              <p>Avg: {loadTest.response_times?.avg || 0}ms</p>
              <p>P95: {loadTest.response_times?.p95 || 0}ms</p>
              <p>Max: {loadTest.response_times?.max || 0}ms</p>
            </div>
          )}
          {k6ActiveTab === 'throughput' && (
            <div className="space-y-4">
              <p>Requests/sec: {loadTest.summary?.requests_per_second || 0}</p>
              <p>Data Transferred: {loadTest.summary?.data_transferred_formatted || '0 B'}</p>
            </div>
          )}
          {k6ActiveTab === 'errors' && (
            <div className="space-y-4">
              <p>Error Rate: {errorRate.toFixed(2)}%</p>
              <p>Failed Requests: {loadTest.summary?.failed_requests || 0}</p>
            </div>
          )}
          {k6ActiveTab === 'endpoints' && (
            <div className="space-y-4">
              {loadTest.endpoints ? (
                loadTest.endpoints.map((endpoint, idx) => (
                  <div key={idx} className="p-2 bg-muted/30 rounded">
                    <span className="font-mono">{endpoint.method} {endpoint.path}</span>
                    <span className="ml-2 text-muted-foreground">{endpoint.count} requests, {endpoint.avg_time}ms avg</span>
                  </div>
                ))
              ) : (
                <p>No endpoint data available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetricsTab;
