/**
 * SuiteHeaderActions Component
 * Feature #50: Extract suite header actions from TestSuitePage.tsx
 */

import React from 'react';
import { Link } from 'react-router-dom';

interface SuiteHeaderActionsProps {
  suiteId: string;
  testsCount: number;
  isRunningSuite: boolean;
  isAnalyzingParallel: boolean;
  canCreateTest: boolean;
  canDeleteSuite: boolean;
  onRunWithParallelization: () => void;
  onRunSuite: () => void;
  onExportTests: () => void;
  onShowImportModal: () => void;
  onShowRecordModal: () => void;
  onShowCreateTestModal: () => void;
  onShowDeleteSuiteModal: () => void;
}

export function SuiteHeaderActions({
  suiteId,
  testsCount,
  isRunningSuite,
  isAnalyzingParallel,
  canCreateTest,
  canDeleteSuite,
  onRunWithParallelization,
  onRunSuite,
  onExportTests,
  onShowImportModal,
  onShowRecordModal,
  onShowCreateTestModal,
  onShowDeleteSuiteModal,
}: SuiteHeaderActionsProps) {
  return (
    <div className="flex gap-2">
      {testsCount > 0 && (
        <button
          onClick={onRunWithParallelization}
          disabled={isRunningSuite || isAnalyzingParallel}
          className="rounded-md bg-gradient-to-r from-accent to-primary px-4 py-2 text-sm font-medium text-white hover:from-accent/90 hover:to-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzingParallel ? '🤖 Analyzing...' : '🤖 AI Parallel Run'}
        </button>
      )}
      {testsCount > 0 && (
        <button
          onClick={onRunSuite}
          disabled={isRunningSuite}
          className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunningSuite ? 'Running...' : 'Run Suite'}
        </button>
      )}
      {testsCount > 0 && (
        <button
          onClick={onExportTests}
          className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Export Tests
        </button>
      )}
      {/* Feature #1851: View run history at suite level */}
      <Link
        to={`/suites/${suiteId}/runs`}
        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        View History
      </Link>
      {canCreateTest && (
        <>
          <button
            onClick={onShowImportModal}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Import Tests
          </button>
          <button
            onClick={onShowRecordModal}
            className="rounded-md bg-warning px-4 py-2 text-sm font-medium text-white hover:bg-warning/90"
          >
            🎬 Record New Test
          </button>
          {/* Feature #1800: New two-section Create Test modal */}
          <button
            onClick={onShowCreateTestModal}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Test
          </button>
        </>
      )}
      {canDeleteSuite && (
        <button
          onClick={onShowDeleteSuiteModal}
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive"
        >
          Delete Suite
        </button>
      )}
    </div>
  );
}

export default SuiteHeaderActions;
