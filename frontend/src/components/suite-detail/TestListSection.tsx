/**
 * TestListSection Component
 * Feature #50: Extract tests list from TestSuitePage.tsx
 *
 * Displays the list of tests in a suite with sorting, searching, and actions.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TestType } from './types';
import { formatRelativeTime } from './utils';

// Local sort field type matching TestSuitePage.tsx
type LocalSortField = 'name' | 'status' | 'last_run' | 'last_result' | 'run_count' | 'avg_duration';
type LocalSortDirection = 'asc' | 'desc';

interface TestListSectionProps {
  tests: TestType[];
  filteredTests: TestType[];
  sortedTests: TestType[];
  searchQuery: string;
  sortField: LocalSortField | null;
  sortDirection: LocalSortDirection;
  suiteRun: any;
  openActionsDropdown: string | null;
  runningTestId: string | null;
  canCreateTest: boolean;
  onSearchChange: (query: string) => void;
  onSort: (field: LocalSortField) => void;
  onOpenCreateTestModal: () => void;
  onSetActionsDropdown: (testId: string | null) => void;
  onRunSingleTest: (testId: string) => void;
  onDuplicateTest: (test: TestType) => void;
  onShowTemplateModal: (testId: string) => void;
  onShowDeleteTestModal: (testId: string) => void;
  loadStepTemplates: () => void;
}

/**
 * TestListSection - Displays the list of tests with sortable columns and actions
 */
export function TestListSection({
  tests,
  filteredTests,
  sortedTests,
  searchQuery,
  sortField,
  sortDirection,
  suiteRun,
  openActionsDropdown,
  runningTestId,
  canCreateTest,
  onSearchChange,
  onSort,
  onOpenCreateTestModal,
  onSetActionsDropdown,
  onRunSingleTest,
  onDuplicateTest,
  onShowTemplateModal,
  onShowDeleteTestModal,
  loadStepTemplates,
}: TestListSectionProps) {
  const navigate = useNavigate();

  // Helper function to render sort indicator
  const renderSortIndicator = (field: LocalSortField) => {
    if (sortField === field) {
      return sortDirection === 'asc' ? '↑' : '↓';
    }
    return <span className="text-muted-foreground/30">↕</span>;
  };

  // Helper function to render test type icon
  const renderTestTypeIcon = (testType: string) => {
    switch (testType) {
      case 'e2e':
        return (
          <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" title="End-to-End Test">
            🌐
          </span>
        );
      case 'visual_regression':
        return (
          <span className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" title="Visual Regression Test">
            📸
          </span>
        );
      case 'accessibility':
        return (
          <span className="inline-flex items-center rounded bg-teal-100 px-1.5 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" title="Accessibility Test">
            ♿
          </span>
        );
      case 'lighthouse':
        return (
          <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title="Performance Test (Lighthouse)">
            ⚡
          </span>
        );
      case 'load':
        return (
          <span className="inline-flex items-center rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" title="Load Test (K6)">
            📊
          </span>
        );
      default:
        return null;
    }
  };

  // Format duration
  const formatDuration = (ms: number | null | undefined) => {
    if (ms == null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">Tests</h2>
        {tests.length > 0 && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-64 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="text-muted-foreground hover:text-foreground"
                title="Clear search"
              >
                &times;
              </button>
            )}
          </div>
        )}
      </div>

      {tests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <h3 className="text-lg font-semibold text-foreground">No tests yet</h3>
          <p className="mt-2 text-muted-foreground">
            Create your first test in this suite.
          </p>
          {canCreateTest && (
            <button
              onClick={onOpenCreateTestModal}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create Test
            </button>
          )}
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <h3 className="text-lg font-semibold text-foreground">No tests found</h3>
          <p className="mt-2 text-muted-foreground">
            No tests match your search "{searchQuery}".
          </p>
          <button
            onClick={() => onSearchChange('')}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          {/* Feature #1958: Enhanced header with run metadata columns and sorting */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px_100px] gap-2 border-b border-border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground min-w-[900px]">
            <button
              className="flex items-center hover:text-foreground transition-colors text-left"
              onClick={() => onSort('name')}
            >
              Name
              <span className="ml-1">{renderSortIndicator('name')}</span>
            </button>
            <button
              className="flex items-center hover:text-foreground transition-colors text-left"
              onClick={() => onSort('status')}
            >
              Status
              <span className="ml-1">{renderSortIndicator('status')}</span>
            </button>
            <button
              className="flex items-center hover:text-foreground transition-colors text-left"
              onClick={() => onSort('last_run')}
            >
              Last Run
              <span className="ml-1">{renderSortIndicator('last_run')}</span>
            </button>
            <button
              className="flex items-center hover:text-foreground transition-colors text-left"
              onClick={() => onSort('last_result')}
            >
              Result
              <span className="ml-1">{renderSortIndicator('last_result')}</span>
            </button>
            <button
              className="flex items-center hover:text-foreground transition-colors text-left"
              onClick={() => onSort('run_count')}
            >
              Runs
              <span className="ml-1">{renderSortIndicator('run_count')}</span>
            </button>
            <button
              className="flex items-center hover:text-foreground transition-colors text-left"
              onClick={() => onSort('avg_duration')}
            >
              Avg Time
              <span className="ml-1">{renderSortIndicator('avg_duration')}</span>
            </button>
            <div>Actions</div>
          </div>

          {/* Test rows */}
          {sortedTests.map((test) => {
            // Feature #1959: Check run status for this test
            const testResult = suiteRun?.results?.find((r: any) => r.test_id === test.id);
            const isCurrentlyRunning = suiteRun?.status === 'running' && !testResult && suiteRun?.results?.length < tests.length;
            const completedTestIds = suiteRun?.results?.map((r: any) => r.test_id) || [];
            const currentTestIndex = completedTestIds.length;
            const testsInOrder = tests.map(t => t.id);
            const isThisTestRunning = isCurrentlyRunning && testsInOrder[currentTestIndex] === test.id;
            const wasRecentlyRun = testResult && (Date.now() - new Date(suiteRun?.started_at || 0).getTime() < 60000);

            return (
              <div
                key={test.id}
                className={`grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px_100px] gap-2 border-b border-border px-4 py-3 last:border-0 items-center hover:bg-muted/20 cursor-pointer transition-colors min-w-[900px] ${
                  wasRecentlyRun ? 'bg-primary/5 hover:bg-primary/10' : ''
                } ${isThisTestRunning ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                onClick={() => navigate(`/tests/${test.id}`)}
              >
                {/* Name Column */}
                <div>
                  <div className="flex items-center gap-2">
                    {renderTestTypeIcon(test.test_type)}
                    <span className="font-medium text-foreground">{test.name}</span>
                    {/* Feature #1071: Healing indicator badge */}
                    {test.healing_active && (
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                          test.healing_status === 'pending'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : test.healing_status === 'applied'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : test.healing_status === 'rejected'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}
                        title={`${test.healing_count || 1} healed selector${(test.healing_count || 1) > 1 ? 's' : ''} (${test.healing_status || 'pending'})`}
                      >
                        🔧
                        {test.healing_count && test.healing_count > 1 && (
                          <span>{test.healing_count}</span>
                        )}
                      </span>
                    )}
                  </div>
                  {test.description && (
                    <p className="text-xs text-muted-foreground truncate">{test.description}</p>
                  )}
                </div>

                {/* Status Column */}
                <div className="flex items-center gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    test.status === 'active' ? 'bg-green-100 text-green-700' :
                    test.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {test.status}
                  </span>
                  {/* Feature #1164: AI Generated badge with confidence level */}
                  {test.ai_generated && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium cursor-help bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      title={
                        test.ai_confidence_score !== undefined
                          ? `AI Generated - ${test.ai_confidence_score}% confidence\n${
                              test.ai_confidence_score >= 80
                                ? 'High confidence: Ready for use'
                                : test.ai_confidence_score >= 60
                                ? 'Medium confidence: Review recommended'
                                : 'Low confidence: Human review required'
                            }`
                          : 'This test was generated by AI'
                      }
                    >
                      🤖 AI Generated
                      {test.ai_confidence_score !== undefined && (
                        <span className={`ml-1 font-semibold ${
                          test.ai_confidence_score >= 80 ? 'text-green-600 dark:text-green-400' :
                          test.ai_confidence_score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-orange-600 dark:text-orange-400'
                        }`}>
                          {test.ai_confidence_score}%
                        </span>
                      )}
                    </span>
                  )}
                  {/* Feature #1151: Human review workflow - Show review status for AI-generated tests */}
                  {test.ai_generated && test.review_status === 'pending_review' && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" title="Pending human review">
                      ⏳ Review
                    </span>
                  )}
                  {test.ai_generated && test.review_status === 'approved' && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" title="Approved by reviewer">
                      ✅ Approved
                    </span>
                  )}
                  {test.ai_generated && test.review_status === 'rejected' && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" title="Rejected by reviewer">
                      ❌ Rejected
                    </span>
                  )}
                </div>

                {/* Last Run Column */}
                <div className="text-sm text-muted-foreground" title={test.last_run_at ? new Date(test.last_run_at).toLocaleString() : undefined}>
                  {isThisTestRunning ? (
                    <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Now
                    </span>
                  ) : test.last_run_at ? (
                    formatRelativeTime(new Date(test.last_run_at))
                  ) : (
                    'Never'
                  )}
                </div>

                {/* Result Column */}
                <div>
                  {isThisTestRunning ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      ● Running
                    </span>
                  ) : testResult ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      testResult.status === 'passed'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : testResult.status === 'failed'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {testResult.status === 'passed' ? '✓' : testResult.status === 'failed' ? '✗' : '○'}
                      <span className="capitalize">{testResult.status}</span>
                    </span>
                  ) : test.last_result ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      test.last_result === 'passed'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : test.last_result === 'failed'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : test.last_result === 'error'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {test.last_result === 'passed' ? '✓' : test.last_result === 'failed' ? '✗' : test.last_result === 'error' ? '⚠' : '○'}
                      <span className="capitalize">{test.last_result}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>

                {/* Run Count Column */}
                <div className="text-sm text-muted-foreground text-center">
                  {test.run_count ?? 0}
                </div>

                {/* Avg Duration Column */}
                <div className="text-sm text-muted-foreground">
                  {formatDuration(test.avg_duration_ms)}
                </div>

                {/* Actions Column */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetActionsDropdown(openActionsDropdown === test.id ? null : test.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Actions
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openActionsDropdown === test.id && (
                    <div
                      className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-card shadow-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="py-1">
                        <button
                          onClick={() => {
                            onSetActionsDropdown(null);
                            navigate(`/tests/${test.id}`);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </button>
                        <button
                          onClick={() => {
                            onSetActionsDropdown(null);
                            onRunSingleTest(test.id);
                          }}
                          disabled={runningTestId === test.id}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          {runningTestId === test.id ? (
                            <>
                              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Running...
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Run Test
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            onSetActionsDropdown(null);
                            navigate(`/tests/${test.id}?edit=true`);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            onSetActionsDropdown(null);
                            onDuplicateTest(test);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Duplicate
                        </button>
                        <button
                          onClick={() => {
                            onSetActionsDropdown(null);
                            onShowTemplateModal(test.id);
                            loadStepTemplates();
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                          </svg>
                          Insert Template
                        </button>
                        <div className="border-t border-border my-1" />
                        <button
                          onClick={() => {
                            onSetActionsDropdown(null);
                            onShowDeleteTestModal(test.id);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TestListSection;
