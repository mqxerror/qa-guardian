/**
 * SuiteHeaderActions Component
 * Feature #50: Extract suite header actions from TestSuitePage.tsx
 * Feature #555: Added export run results as JSON/PDF
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileJson, FileText, Download, ChevronDown, Clock } from 'lucide-react';

interface SuiteHeaderActionsProps {
  suiteId: string;
  testsCount: number;
  isRunningSuite: boolean;
  canCreateTest: boolean;
  canDeleteSuite: boolean;
  onRunSuite: () => void;
  onExportTests: () => void;
  onShowImportModal: () => void;
  onShowRecordModal: () => void;
  onShowCreateTestModal: () => void;
  onShowDeleteSuiteModal: () => void;
  // Feature #555: Export run results
  hasCompletedRun?: boolean;
  onExportRunJSON?: () => void;
  onExportRunPDF?: () => void;
}

export function SuiteHeaderActions({
  suiteId,
  testsCount,
  isRunningSuite,
  canCreateTest,
  canDeleteSuite,
  onRunSuite,
  onExportTests,
  onShowImportModal,
  onShowRecordModal,
  onShowCreateTestModal,
  onShowDeleteSuiteModal,
  hasCompletedRun,
  onExportRunJSON,
  onExportRunPDF,
}: SuiteHeaderActionsProps) {
  // Feature #555: Export results dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="flex gap-2">
      {testsCount > 0 && (
        <button
          onClick={onRunSuite}
          disabled={isRunningSuite}
          className="rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground hover:bg-success disabled:opacity-50 disabled:cursor-not-allowed"
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
      {/* Feature #555: Export run results dropdown */}
      {hasCompletedRun && onExportRunJSON && onExportRunPDF && (
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            onBlur={() => setTimeout(() => setShowExportMenu(false), 150)}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Results
            <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <button
                onClick={() => { onExportRunJSON(); setShowExportMenu(false); }}
                className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
              >
                <FileJson className="w-4 h-4 text-info" />
                Export as JSON
              </button>
              <button
                onClick={() => { onExportRunPDF(); setShowExportMenu(false); }}
                className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
              >
                <FileText className="w-4 h-4 text-destructive" />
                Export as PDF
              </button>
            </div>
          )}
        </div>
      )}
      {/* Feature #1851: View run history at suite level */}
      <Link
        to={`/suites/${suiteId}/runs`}
        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted inline-flex items-center gap-1"
      >
        <Clock className="w-4 h-4" />
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
            className="rounded-md bg-warning px-4 py-2 text-sm font-medium text-warning-foreground hover:bg-warning/90"
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
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          Delete Suite
        </button>
      )}
    </div>
  );
}

export default SuiteHeaderActions;
