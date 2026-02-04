/**
 * HumanReviewPanel Component
 * Feature #50: Extract from TestSuitePage.tsx
 * Feature #1151: Human review workflow for AI tests
 * Feature #1152: Batch review AI-generated tests
 */

import React from 'react';
import type { TestType } from './types';

interface ReviewStats {
  total_tests: number;
  ai_generated: number;
  pending_review: number;
  approved: number;
  rejected: number;
}

interface HumanReviewPanelProps {
  tests: TestType[];
  requireHumanReview: boolean;
  showReviewPanel: boolean;
  reviewStats: ReviewStats | null;
  selectedForReview: Set<string>;
  isApproving: boolean;
  onToggleHumanReview: () => void;
  onToggleReviewPanel: () => void;
  onToggleTestSelection: (testId: string) => void;
  onToggleAllTestsSelection: (testIds: string[]) => void;
  onReviewTest: (testId: string, action: 'approve' | 'reject') => void;
  onBatchReview: (action: 'approve' | 'reject') => void;
}

export function HumanReviewPanel({
  tests,
  requireHumanReview,
  showReviewPanel,
  reviewStats,
  selectedForReview,
  isApproving,
  onToggleHumanReview,
  onToggleReviewPanel,
  onToggleTestSelection,
  onToggleAllTestsSelection,
  onReviewTest,
  onBatchReview,
}: HumanReviewPanelProps) {
  const pendingTests = tests.filter(t => t.review_status === 'pending_review');
  const pendingIds = pendingTests.map(t => t.id);
  const allSelected = pendingIds.length > 0 && pendingIds.every(id => selectedForReview.has(id));

  return (
    <>
      {/* Feature #1151: Human Review Settings Panel */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">🔍 Human Review for AI Tests</span>
            <button
              onClick={onToggleHumanReview}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                requireHumanReview ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  requireHumanReview ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-xs text-muted-foreground">
              {requireHumanReview ? 'Required' : 'Disabled'}
            </span>
          </div>
          {reviewStats && reviewStats.pending_review > 0 && (
            <button
              onClick={onToggleReviewPanel}
              className="flex items-center gap-1 rounded-md bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-200"
            >
              <span>⏳</span>
              <span>{reviewStats.pending_review} Pending Review</span>
            </button>
          )}
        </div>
        {reviewStats && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>🤖 {reviewStats.ai_generated} AI-generated</span>
            <span>✅ {reviewStats.approved} approved</span>
            {reviewStats.rejected > 0 && <span>❌ {reviewStats.rejected} rejected</span>}
          </div>
        )}
      </div>

      {/* Feature #1151: Pending Review Tests Panel - Enhanced with #1152 Batch Review */}
      {showReviewPanel && pendingTests.length > 0 && (
        <div className="mb-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              ⏳ Tests Pending Review
            </h3>
            <button
              onClick={onToggleReviewPanel}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          {/* Feature #1152: Batch selection controls */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-orange-200 dark:border-orange-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onToggleAllTestsSelection(pendingIds)}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-muted-foreground">
                Select All ({selectedForReview.size}/{pendingTests.length} selected)
              </span>
            </label>
            {selectedForReview.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onBatchReview('approve')}
                  disabled={isApproving}
                  className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                >
                  ✓ Batch Approve ({selectedForReview.size})
                </button>
                <button
                  onClick={() => onBatchReview('reject')}
                  disabled={isApproving}
                  className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                >
                  ✗ Batch Reject ({selectedForReview.size})
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {pendingTests.map(test => (
              <div key={test.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                <div className="flex items-center gap-3">
                  {/* Feature #1152: Checkbox for batch selection */}
                  <input
                    type="checkbox"
                    checked={selectedForReview.has(test.id)}
                    onChange={() => onToggleTestSelection(test.id)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-medium text-sm">{test.name}</span>
                    {test.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{test.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onReviewTest(test.id, 'approve')}
                    disabled={isApproving}
                    className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => onReviewTest(test.id, 'reject')}
                    disabled={isApproving}
                    className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default HumanReviewPanel;
