/**
 * ExecutiveSummary Component
 * Feature #46: Extracted from TestRunResultPage.tsx
 * Feature #1858: Executive Summary Card
 */

import React from 'react';
import { ResultSummary, ActiveTab } from './types';
import { calculateHealthScore, getHealthScoreColorClass, getHealthScoreBarClass } from './utils';

interface ExecutiveSummaryProps {
  resultSummary: ResultSummary;
  runId?: string;
  onViewFailures?: () => void;
}

const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  resultSummary,
  runId,
  onViewFailures,
}) => {
  const healthScore = calculateHealthScore(resultSummary.passed, resultSummary.total);

  return (
    <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Executive Summary
        </h2>
        {runId && (
          <span className="text-xs text-muted-foreground">Run #{runId.slice(-8)}</span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Score */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <div className="text-sm text-muted-foreground mb-2">Health Score</div>
          <div className="flex items-center gap-3">
            <div className={`text-4xl font-bold ${
              resultSummary.total === 0 ? 'text-gray-400' : getHealthScoreColorClass(healthScore)
            }`}>
              {resultSummary.total === 0 ? 'N/A' : healthScore}
            </div>
            {resultSummary.total > 0 && (
              <div className="text-lg text-muted-foreground">/100</div>
            )}
          </div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                resultSummary.total === 0 ? 'bg-muted-foreground/50' : getHealthScoreBarClass(healthScore)
              }`}
              style={{ width: resultSummary.total === 0 ? '0%' : `${healthScore}%` }}
            />
          </div>
        </div>

        {/* Pass Rate */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <div className="text-sm text-muted-foreground mb-2">Pass Rate</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${
              resultSummary.total === 0 ? 'text-gray-400' :
              resultSummary.failed === 0 ? 'text-green-600 dark:text-green-400' :
              resultSummary.passed === 0 ? 'text-red-600 dark:text-red-400' :
              'text-amber-600 dark:text-amber-400'
            }`}>
              {resultSummary.total === 0 ? '0' : healthScore}%
            </span>
            <span className="text-sm text-muted-foreground">
              ({resultSummary.passed}/{resultSummary.total} tests)
            </span>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            {resultSummary.failed === 0 && resultSummary.total > 0 ? (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                All tests passed
              </span>
            ) : resultSummary.total > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                {resultSummary.failed} test{resultSummary.failed !== 1 ? 's' : ''} need attention
              </span>
            ) : (
              <span>No test results available</span>
            )}
          </div>
        </div>

        {/* Critical Issues */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <div className="text-sm text-muted-foreground mb-2">Critical Issues</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${
              resultSummary.failed === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {resultSummary.failed}
            </span>
            <span className="text-sm text-muted-foreground">
              {resultSummary.failed === 1 ? 'failure' : 'failures'}
            </span>
          </div>
          {resultSummary.failed > 0 && onViewFailures && (
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={onViewFailures}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View failure details
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
          {resultSummary.failed === 0 && resultSummary.total > 0 && (
            <div className="mt-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              No critical issues
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ExecutiveSummary);
