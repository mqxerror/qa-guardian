/**
 * MetricsTab Component
 * Feature #46: Extracted from TestRunResultPage.tsx for modular architecture
 * Feature #103: Refactored to import sub-components from metrics/ folder
 *
 * Displays Lighthouse performance metrics, K6 load test results,
 * Core Web Vitals, and AI-powered performance analysis.
 */

import React from 'react';
import { TestResult, K6ActiveTab, K6ActiveChart, LighthouseActiveTab, K6ExportFormat } from './types';
import { LighthouseResultCard, K6ResultCard } from './metrics';

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
                  className="rounded border-border"
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

export default MetricsTab;
