/**
 * K6ResultCard - K6 Load Test Results Display
 * Feature #103: Extracted from MetricsTab.tsx
 */
import React from 'react';
import { TestResult, LoadTestResult, K6ActiveTab, K6ExportFormat } from '../types';

export interface K6ResultCardProps {
 result: TestResult;
 loadTest: LoadTestResult;
 k6ActiveTab: K6ActiveTab;
 setK6ActiveTab: (tab: K6ActiveTab) => void;
 k6ActiveChart: string;
 setK6ActiveChart: (chart: string) => void;
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

export const K6ResultCard: React.FC<K6ResultCardProps> = ({
 result,
 loadTest,
 k6ActiveTab,
 setK6ActiveTab,
 k6ShowThresholds,
 k6ExportFormat,
 perfAILoading,
 perfAIResult,
 setPerfAIResult,
 perfAIAnalysisOpen,
 analyzePerformanceResults,
 exportK6Results,
 exportK6ResultsPDF,
}) => {
 // Check if essential metrics exist
 const hasEssentialMetrics = loadTest.summary?.requests_per_second !== undefined ||
 loadTest.summary?.total_requests !== undefined ||
 loadTest.response_times?.avg !== undefined ||
 loadTest.response_times?.p95 !== undefined;

 // If no essential metrics, show failure state
 if (!hasEssentialMetrics) {
 return (
 <div className="bg-card border border-destructive/30 rounded-xl overflow-hidden shadow-lg">
 <div className="border-b-4 border-destructive">
 <div className="p-5 bg-gradient-to-r from-destructive/5 to-destructive/10/50">
 <div className="flex items-center justify-between mb-3">
 <span className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-medium rounded-full flex items-center gap-1.5">
 <span>⚡</span> K6 Load Test
 </span>
 <div className="px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 bg-destructive/10 text-destructive">
 ❌ TEST FAILED
 </div>
 </div>
 <h4 className="text-xl font-semibold text-foreground mb-1">{result.test_name}</h4>
 </div>
 </div>
 <div className="p-6">
 <div className="flex items-start gap-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
 <svg className="w-8 h-8 text-destructive flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
 </svg>
 <div>
 <h5 className="font-semibold text-destructive mb-2">Load Test Could Not Complete</h5>
 <p className="text-sm text-destructive">
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
 <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg shadow-black/5">
 {/* Header */}
 <div className={`border-b-4 ${
 overallStatus === 'passed' ? 'border-success' :
 overallStatus === 'warning' ? 'border-warning' :
 'border-destructive'
 }`}>
 <div className="p-5 bg-gradient-to-r from-muted/50 to-muted/20">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3">
 <span className="px-3 py-1 bg-accent/10 text-accent text-xs font-medium rounded-full flex items-center gap-1.5">
 <span>⚡</span> K6 Load Test
 </span>
 <span className="text-xs text-muted-foreground">
 {new Date(loadTest.started_at || Date.now()).toLocaleString()}
 </span>
 </div>
 <div className={`px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 ${
 overallStatus === 'passed' ? 'bg-success/10 text-success' :
 overallStatus === 'warning' ? 'bg-warning/10 text-warning' :
 'bg-destructive/10 text-destructive'
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
 className="px-3 py-1.5 text-sm bg-destructive text-primary-foreground rounded-lg hover:bg-destructive transition-colors flex items-center gap-1.5"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
 </svg>
 PDF
 </button>

 <button
 onClick={() => analyzePerformanceResults(result.test_name, null, loadTest)}
 disabled={perfAILoading && perfAIAnalysisOpen === result.test_name}
 className="px-3 py-1.5 text-sm bg-gradient-to-r from-accent to-accent/80 text-primary-foreground rounded-lg hover:from-accent/90 hover:to-accent/70 transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
 <div className="mx-6 my-4 p-4 bg-gradient-to-r from-accent/5 to-accent/10 border border-accent/20 rounded-xl">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <span className="text-xl">🤖</span>
 <h4 className="font-semibold text-accent">AI Load Test Analysis</h4>
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
 <div className="prose prose-sm max-w-none">
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
 (loadTest.response_times?.p95 || 0) < 200 ? 'text-success' :
 (loadTest.response_times?.p95 || 0) < 500 ? 'text-foreground' :
 'text-warning'
 }`}>
 {loadTest.response_times?.p95 || 0}ms
 </div>
 <div className="text-sm text-muted-foreground">P95 Response</div>
 </div>
 <div className={`p-4 rounded-lg text-center ${
 errorRate < 1 ? 'bg-success/5' :
 errorRate < 5 ? 'bg-warning/5' :
 'bg-destructive/5'
 }`}>
 <div className={`text-2xl font-bold ${
 errorRate < 1 ? 'text-success' :
 errorRate < 5 ? 'text-warning' :
 'text-destructive'
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

 {/* Tab Content */}
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
