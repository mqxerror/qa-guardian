/**
 * ResultsTab Component
 * Feature #46: Modular test results page - Extract Results Tab
 *
 * Displays the test results with filtering, result cards, and actions.
 * Extracted from TestRunResultPage.tsx for better maintainability.
 */

import { Link } from 'react-router-dom';
import { TestRun, TestResult, ResultSummary, ActiveTab } from './types';
import { formatDuration } from './utils';

// Key metric type from getKeyMetric helper
interface KeyMetric {
 type: 'performance' | 'accessibility' | 'load' | 'visual' | 'e2e';
 value: string;
 label: string;
}

// Props interface for ResultsTab component
export interface ResultsTabProps {
 /** The test run object containing all results */
 run: TestRun;
 /** Filtered array of test results based on current filter */
 filteredResults: TestResult[];
 /** Summary counts of passed/failed/skipped tests */
 resultSummary: ResultSummary;
 /** Current filter selection */
 selectedResultsFilter: 'all' | 'passed' | 'failed' | 'skipped';
 /** Setter for the filter selection */
 setSelectedResultsFilter: (filter: 'all' | 'passed' | 'failed' | 'skipped') => void;
 /** Set of expanded result card test IDs */
 expandedResultCards: Set<string>;
 /** Toggle function for expanding/collapsing result cards */
 toggleResultCard: (testId: string) => void;
 /** Set of test IDs currently being rerun */
 rerunningTests: Set<string>;
 /** Function to rerun all failed tests */
 rerunFailedTests: () => void;
 /** Function to export results in JSON or CSV format */
 exportResults: (format: 'json' | 'csv') => void;
 /** Helper function to get key metric for a test result */
 getKeyMetric: (result: TestResult) => KeyMetric;
 /** Function to navigate to other tabs */
 setActiveTab: (tab: ActiveTab) => void;
}

/**
 * ResultsTab displays the test results grid with filtering and actions.
 * Features:
 * - Filter buttons for all/passed/failed/skipped
 * - Rerun failed tests button
 * - Export to JSON/CSV
 * - Expandable result cards with details
 * - Navigation to test details, timeline, and screenshots
 */
const ResultsTab = ({
 run,
 filteredResults,
 resultSummary,
 selectedResultsFilter,
 setSelectedResultsFilter,
 expandedResultCards,
 toggleResultCard,
 rerunningTests,
 rerunFailedTests,
 exportResults,
 getKeyMetric,
 setActiveTab,
}: ResultsTabProps) => {
 return (
 <div>
 {/* Header with filters and actions */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-4">
 <h2 className="text-lg font-semibold text-foreground">Test Results</h2>

 {/* Filter buttons */}
 <div className="flex rounded-md overflow-hidden border border-border">
 {([
 { id: 'all', label: 'All', count: run.results?.length || 0 },
 { id: 'passed', label: 'Passed', count: resultSummary.passed },
 { id: 'failed', label: 'Failed', count: resultSummary.failed },
 { id: 'skipped', label: 'Skipped', count: resultSummary.skipped },
 ] as const).map(filter => (
 <button
 key={filter.id}
 onClick={() => setSelectedResultsFilter(filter.id)}
 className={`px-3 py-1.5 text-sm ${
 selectedResultsFilter === filter.id
 ? 'bg-primary text-primary-foreground'
 : 'bg-background text-foreground hover:bg-muted'
 }`}
 >
 {filter.label} ({filter.count})
 </button>
 ))}
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-2">
 {resultSummary.failed > 0 && (
 <button
 onClick={rerunFailedTests}
 disabled={rerunningTests.size > 0}
 className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-warning text-warning-foreground rounded-md hover:bg-warning/90 transition-colors disabled:opacity-50"
 >
 {rerunningTests.size > 0 ? (
 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 ) : (
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 )}
 Rerun Failed
 </button>
 )}

 <div className="flex rounded-md overflow-hidden border border-border">
 <button
 onClick={() => exportResults('json')}
 className="px-3 py-1.5 text-sm bg-background text-foreground hover:bg-muted border-r border-border"
 >
 JSON
 </button>
 <button
 onClick={() => exportResults('csv')}
 className="px-3 py-1.5 text-sm bg-background text-foreground hover:bg-muted"
 >
 CSV
 </button>
 </div>
 </div>
 </div>

 {/* Result Cards */}
 {filteredResults.length === 0 ? (
 <div className="p-12 text-center bg-muted/30 rounded-lg">
 <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
 </svg>
 <p className="text-lg font-medium text-foreground mb-2">No results match the filter</p>
 <p className="text-muted-foreground">Try selecting a different filter.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {filteredResults.map((result) => {
 const isExpanded = expandedResultCards.has(result.test_id);
 const keyMetric = getKeyMetric(result);
 const failedSteps = result.steps.filter(s => s.status === 'failed');
 const lastScreenshot = result.screenshot_base64 || result.steps.find(s => s.screenshot_after)?.screenshot_after;

 return (
 <div
 key={result.test_id}
 data-test-id={result.test_id} /* Feature #2000: For scroll-to-test navigation */
 className={`border rounded-lg overflow-hidden transition-all ${
 result.status === 'failed' || result.status === 'error'
 ? 'border-destructive/30'
 : result.status === 'passed'
 ? 'border-success/30'
 : 'border-border'
 }`}
 >
 {/* Card Header - Always visible */}
 <div
 onClick={() => toggleResultCard(result.test_id)}
 className={`p-4 cursor-pointer transition-colors ${
 result.status === 'failed' || result.status === 'error'
 ? 'bg-destructive/5 hover:bg-destructive/10'
 : result.status === 'passed'
 ? 'bg-success/5 hover:bg-success/10'
 : 'bg-muted/30 hover:bg-muted/50'
 }`}
 >
 <div className="flex items-center gap-4">
 {/* Expand/Collapse icon */}
 <svg
 className={`w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
 fill="none" viewBox="0 0 24 24" stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>

 {/* Status icon */}
 <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
 result.status === 'passed'
 ? 'bg-success/10'
 : result.status === 'failed' || result.status === 'error'
 ? 'bg-destructive/10'
 : 'bg-muted'
 }`}>
 {result.status === 'passed' && (
 <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 )}
 {(result.status === 'failed' || result.status === 'error') && (
 <svg className="w-5 h-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 )}
 {result.status === 'skipped' && (
 <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
 </svg>
 )}
 </div>

 {/* Test info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <h3 className="font-medium text-foreground truncate">{result.test_name}</h3>
 {/* Type badge based on metrics */}
 <span className={`px-2 py-0.5 text-xs rounded-full ${
 keyMetric.type === 'performance' ? 'bg-accent/10 text-accent' :
 keyMetric.type === 'accessibility' ? 'bg-primary/10 text-primary' :
 keyMetric.type === 'load' ? 'bg-warning/10 text-warning' :
 keyMetric.type === 'visual' ? 'bg-accent/10 text-accent' :
 'bg-muted text-foreground'
 }`}>
 {keyMetric.type.toUpperCase()}
 </span>
 </div>
 {/* Error preview if failed */}
 {result.error && (
 <p className="text-sm text-destructive truncate">{result.error}</p>
 )}
 </div>

 {/* Key Metric */}
 <div className="text-center px-4 flex-shrink-0">
 <div className="text-lg font-bold text-foreground">{keyMetric.value}</div>
 <div className="text-xs text-muted-foreground">{keyMetric.label}</div>
 </div>

 {/* Duration */}
 <div className="text-center px-4 flex-shrink-0">
 <div className="text-lg font-bold text-foreground">{formatDuration(result.duration_ms)}</div>
 <div className="text-xs text-muted-foreground">Duration</div>
 </div>

 {/* Screenshot thumbnail */}
 {lastScreenshot && (
 <div className="w-16 h-12 rounded overflow-hidden border border-border flex-shrink-0">
 <img
 src={lastScreenshot.startsWith('data:') ? lastScreenshot : `data:image/png;base64,${lastScreenshot}`}
 alt="Screenshot"
 className="w-full h-full object-cover"
 />
 </div>
 )}
 </div>
 </div>

 {/* Expanded Content */}
 {isExpanded && (
 <div className="border-t border-border p-4 bg-background">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Error details */}
 {result.error && (
 <div className="md:col-span-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
 <h4 className="text-sm font-medium text-destructive mb-2">Error Message</h4>
 <pre className="text-sm text-destructive whitespace-pre-wrap font-mono overflow-auto max-h-32">
 {result.error}
 </pre>
 </div>
 )}

 {/* Steps summary */}
 <div className="p-3 bg-muted/30 rounded-lg">
 <h4 className="text-sm font-medium text-foreground mb-2">Steps</h4>
 <div className="flex items-center gap-4 text-sm">
 <span className="text-success">
 {result.steps.filter(s => s.status === 'passed').length} passed
 </span>
 {failedSteps.length > 0 && (
 <span className="text-destructive">
 {failedSteps.length} failed
 </span>
 )}
 <span className="text-muted-foreground">
 {result.steps.length} total
 </span>
 </div>
 {/* Failed steps list */}
 {failedSteps.length > 0 && (
 <div className="mt-2 space-y-1">
 {failedSteps.slice(0, 3).map((step, sIdx) => (
 <div key={sIdx} className="text-xs text-destructive">
 - {step.action}: {step.error || 'Failed'}
 </div>
 ))}
 {failedSteps.length > 3 && (
 <div className="text-xs text-muted-foreground">
 + {failedSteps.length - 3} more failed steps
 </div>
 )}
 </div>
 )}
 </div>

 {/* Metrics based on type */}
 <div className="p-3 bg-muted/30 rounded-lg">
 <h4 className="text-sm font-medium text-foreground mb-2">Key Metrics</h4>
 <div className="grid grid-cols-2 gap-2 text-sm">
 <div>
 <span className="text-muted-foreground">{keyMetric.label}:</span>
 <span className="ml-1 font-medium text-foreground">{keyMetric.value}</span>
 </div>
 <div>
 <span className="text-muted-foreground">Duration:</span>
 <span className="ml-1 font-medium text-foreground">{formatDuration(result.duration_ms)}</span>
 </div>
 {result.console_logs && result.console_logs.length > 0 && (
 <div>
 <span className="text-muted-foreground">Logs:</span>
 <span className="ml-1 font-medium text-foreground">{result.console_logs.length}</span>
 </div>
 )}
 {result.network_requests && result.network_requests.length > 0 && (
 <div>
 <span className="text-muted-foreground">Requests:</span>
 <span className="ml-1 font-medium text-foreground">{result.network_requests.length}</span>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Action buttons */}
 <div className="mt-4 flex items-center gap-2">
 <Link
 to={`/tests/${result.test_id}`}
 className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
 >
 View Test Details
 </Link>
 <button
 onClick={() => setActiveTab('timeline')}
 className="px-3 py-1.5 text-sm border border-border rounded-md text-foreground hover:bg-muted"
 >
 View Timeline
 </button>
 {lastScreenshot && (
 <button
 onClick={() => setActiveTab('screenshots')}
 className="px-3 py-1.5 text-sm border border-border rounded-md text-foreground hover:bg-muted"
 >
 View Screenshots
 </button>
 )}
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
};

export default ResultsTab;
