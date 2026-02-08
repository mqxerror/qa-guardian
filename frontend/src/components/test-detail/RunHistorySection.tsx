// RunHistorySection.tsx
// Feature #48: Extracted from TestDetailPage.tsx
import { Link } from 'react-router-dom';
import { TestRunType } from './types';

interface RunCounts {
 all: number;
 passed: number;
 failed: number;
 running: number;
}

interface RunHistorySectionProps {
 runs: TestRunType[];
 filteredRuns: TestRunType[];
 sortedRuns: TestRunType[];
 paginatedRuns: TestRunType[];
 runCounts: RunCounts;
 statusFilter: 'all' | 'passed' | 'failed' | 'running';
 dateFilter: 'all' | 'today' | '7days' | '30days';
 sortBy: 'date' | 'duration';
 sortOrder: 'asc' | 'desc';
 runPage: number;
 pageSize: number;
 totalPages: number;
 hasActiveFilters: boolean;
 isLoadTest: boolean;
 selectedRunsForCompare: string[];
 isComparing: boolean;
 isDownloadingArtifacts: boolean;
 formatDateTime: (date: string) => string;
 onSetStatusFilter: (filter: 'all' | 'passed' | 'failed' | 'running') => void;
 onSetDateFilter: (filter: 'all' | 'today' | '7days' | '30days') => void;
 onSort: (by: 'date' | 'duration') => void;
 onSetRunPage: (page: number) => void;
 onSetPageSize: (size: number) => void;
 onClearFilters: () => void;
 onExportRuns: () => void;
 onToggleRunSelection: (runId: string) => void;
 onCompareRuns: () => void;
 onDownloadAllArtifacts: (runId: string) => void;
}

export function RunHistorySection({
 runs,
 filteredRuns,
 sortedRuns,
 paginatedRuns,
 runCounts,
 statusFilter,
 dateFilter,
 sortBy,
 sortOrder,
 runPage,
 pageSize,
 totalPages,
 hasActiveFilters,
 isLoadTest,
 selectedRunsForCompare,
 isComparing,
 isDownloadingArtifacts,
 formatDateTime,
 onSetStatusFilter,
 onSetDateFilter,
 onSort,
 onSetRunPage,
 onSetPageSize,
 onClearFilters,
 onExportRuns,
 onToggleRunSelection,
 onCompareRuns,
 onDownloadAllArtifacts,
}: RunHistorySectionProps) {
 if (runs.length === 0) {
 return null;
 }

 return (
 <div className="mt-8 rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between flex-wrap gap-4">
 <h2 className="text-lg font-semibold text-foreground">Run History</h2>
 <div className="flex items-center gap-4 flex-wrap">
 {/* Sort controls */}
 <div className="flex items-center gap-2">
 <span className="text-sm text-muted-foreground">Sort:</span>
 <div className="flex rounded-md border border-border">
 <button
 onClick={() => onSort('date')}
 className={`px-3 py-1 text-sm font-medium ${
 sortBy === 'date'
 ? 'bg-primary text-primary-foreground'
 : 'bg-background text-foreground hover:bg-muted'
 } rounded-l-md`}
 >
 Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
 </button>
 <button
 onClick={() => onSort('duration')}
 className={`px-3 py-1 text-sm font-medium ${
 sortBy === 'duration'
 ? 'bg-primary text-primary-foreground'
 : 'bg-background text-foreground hover:bg-muted'
 } border-l border-border rounded-r-md`}
 >
 Duration {sortBy === 'duration' && (sortOrder === 'asc' ? '↑' : '↓')}
 </button>
 </div>
 </div>

 <div className="flex items-center gap-4">
 {/* Status filter */}
 <div className="flex items-center gap-2">
 <span className="text-sm text-muted-foreground">Status:</span>
 <div className="flex rounded-md border border-border">
 <button
 onClick={() => onSetStatusFilter('all')}
 className={`px-3 py-1 text-sm font-medium ${
 statusFilter === 'all'
 ? 'bg-primary text-primary-foreground'
 : 'bg-background text-foreground hover:bg-muted'
 } rounded-l-md`}
 >
 All ({runCounts.all})
 </button>
 <button
 onClick={() => onSetStatusFilter('passed')}
 className={`px-3 py-1 text-sm font-medium ${
 statusFilter === 'passed'
 ? 'bg-success text-white'
 : 'bg-background text-foreground hover:bg-muted'
 } border-l border-border`}
 >
 Passed ({runCounts.passed})
 </button>
 <button
 onClick={() => onSetStatusFilter('failed')}
 className={`px-3 py-1 text-sm font-medium ${
 statusFilter === 'failed'
 ? 'bg-destructive text-white'
 : 'bg-background text-foreground hover:bg-muted'
 } border-l border-border rounded-r-md`}
 >
 Failed ({runCounts.failed})
 </button>
 </div>
 </div>

 {/* Date filter */}
 <div className="flex items-center gap-2">
 <span className="text-sm text-muted-foreground">Date:</span>
 <select
 value={dateFilter}
 onChange={(e) => onSetDateFilter(e.target.value as 'all' | 'today' | '7days' | '30days')}
 className="rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground"
 >
 <option value="all">All Time</option>
 <option value="today">Today</option>
 <option value="7days">Last 7 Days</option>
 <option value="30days">Last 30 Days</option>
 </select>
 </div>

 {hasActiveFilters && (
 <button
 onClick={onClearFilters}
 className="rounded-md border border-border px-3 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 Clear Filters
 </button>
 )}

 {filteredRuns.length > 0 && (
 <button
 onClick={onExportRuns}
 className="rounded-md border border-border bg-background px-3 py-1 text-sm font-medium text-foreground hover:bg-muted"
 >
 Export Runs ({filteredRuns.length})
 </button>
 )}

 {/* Compare K6 Runs button (Feature #564) */}
 {isLoadTest && selectedRunsForCompare.length === 2 && (
 <button
 onClick={onCompareRuns}
 disabled={isComparing}
 className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-white hover:bg-primary disabled:opacity-50"
 >
 {isComparing ? 'Comparing...' : '📊 Compare Selected'}
 </button>
 )}
 {isLoadTest && selectedRunsForCompare.length > 0 && selectedRunsForCompare.length < 2 && (
 <span className="text-sm text-muted-foreground">
 Select {2 - selectedRunsForCompare.length} more run{selectedRunsForCompare.length === 1 ? '' : 's'} to compare
 </span>
 )}
 </div>
 </div>

 {/* Active filter chips */}
 {hasActiveFilters && (
 <div className="flex items-center gap-2 mt-3">
 <span className="text-sm text-muted-foreground">Active filters:</span>
 {statusFilter !== 'all' && (
 <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
 Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
 <button
 onClick={() => onSetStatusFilter('all')}
 className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
 aria-label="Clear status filter"
 >
 <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
 </svg>
 </button>
 </span>
 )}
 {dateFilter !== 'all' && (
 <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
 Date: {dateFilter === 'today' ? 'Today' : dateFilter === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
 <button
 onClick={() => onSetDateFilter('all')}
 className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
 aria-label="Clear date filter"
 >
 <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
 </svg>
 </button>
 </span>
 )}
 </div>
 )}
 </div>

 {/* Run list */}
 <div className="mt-4 space-y-2">
 {sortedRuns.length === 0 ? (
 <div className="py-8 text-center">
 <p className="text-sm font-medium text-foreground">
 No {statusFilter === 'all' ? '' : statusFilter} runs found
 </p>
 {hasActiveFilters && (
 <p className="mt-2 text-sm text-muted-foreground">
 Try adjusting your filters or{' '}
 <button
 onClick={onClearFilters}
 className="text-primary hover:underline"
 >
 clear all filters
 </button>
 {' '}to see more results.
 </p>
 )}
 </div>
 ) : paginatedRuns.map((run) => (
 <div
 key={run.id}
 className={`flex items-center justify-between rounded-md border p-3 ${
 selectedRunsForCompare.includes(run.id)
 ? 'border-primary bg-primary/5/50'
 : 'border-border'
 }`}
 >
 <div className="flex items-center gap-3">
 {/* Checkbox for K6 run comparison (Feature #564) */}
 {isLoadTest && (run.status === 'passed' || run.status === 'failed') && (
 <label className="cursor-pointer">
 <input
 type="checkbox"
 checked={selectedRunsForCompare.includes(run.id)}
 onChange={() => onToggleRunSelection(run.id)}
 className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
 />
 </label>
 )}
 {/* Feature #1979: Added 'warning' status styling for accessibility tests */}
 <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
 run.status === 'passed' ? 'bg-success/10 text-success' :
 run.status === 'failed' ? 'bg-destructive/10 text-destructive' :
 run.status === 'warning' ? 'bg-warning/10 text-warning' :
 run.status === 'running' ? 'bg-primary/10 text-primary' :
 run.status === 'pending' ? 'bg-warning/10 text-warning' :
 'bg-muted text-foreground'
 }`}>
 {run.status}
 </span>
 <span className="text-sm text-muted-foreground">
 {formatDateTime(run.created_at)}
 </span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-sm text-muted-foreground">
 {run.duration_ms ? `${run.duration_ms}ms` : '-'}
 </span>
 {/* Feature #1823: View Details link to TestRunResultPage */}
 {(run.status === 'passed' || run.status === 'failed' || run.status === 'error') && (
 <Link
 to={`/runs/${run.id}`}
 className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
 title="View detailed run results"
 >
 <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 View Details
 </Link>
 )}
 {/* Download All Artifacts button for completed runs */}
 {(run.status === 'passed' || run.status === 'failed' || run.status === 'error') && (
 <button
 onClick={() => onDownloadAllArtifacts(run.id)}
 disabled={isDownloadingArtifacts}
 className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
 title="Download all artifacts (screenshots, traces, videos)"
 >
 <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
 </svg>
 Download All
 </button>
 )}
 </div>
 </div>
 ))}
 </div>

 {/* Pagination */}
 {sortedRuns.length > 0 && (
 <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-4">
 <div className="flex items-center gap-4">
 <p className="text-sm text-muted-foreground">
 Showing {(runPage - 1) * pageSize + 1} to {Math.min(runPage * pageSize, sortedRuns.length)} of {sortedRuns.length} results
 </p>
 <div className="flex items-center gap-2">
 <label htmlFor="page-size-select" className="text-sm text-muted-foreground">
 Per page:
 </label>
 <select
 id="page-size-select"
 value={pageSize}
 onChange={(e) => onSetPageSize(parseInt(e.target.value, 10))}
 className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
 >
 <option value="5">5</option>
 <option value="10">10</option>
 <option value="25">25</option>
 <option value="50">50</option>
 <option value="100">100</option>
 </select>
 </div>
 </div>
 {totalPages > 1 && (
 <div className="flex items-center gap-2">
 <button
 onClick={() => onSetRunPage(runPage - 1)}
 disabled={runPage === 1}
 className="rounded-md border border-border px-3 py-1 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Previous
 </button>
 <span className="text-sm text-muted-foreground">
 Page {runPage} of {totalPages}
 </span>
 <button
 onClick={() => onSetRunPage(runPage + 1)}
 disabled={runPage === totalPages}
 className="rounded-md border border-border px-3 py-1 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Next
 </button>
 </div>
 )}
 </div>
 )}
 </div>
 );
}
