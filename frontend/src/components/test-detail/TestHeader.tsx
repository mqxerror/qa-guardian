// Feature #48: TestHeader - Extracted from TestDetailPage.tsx
// Feature #554: Standardized to use shared PageHeader with consistent breadcrumbs
// Displays breadcrumb navigation, test title, status badge, and action buttons

import { TestType } from './types';
import { PageHeader } from '../ui';

export interface TestHeaderProps {
  test: TestType | null;
  project: { id: string; name: string } | null;
  suite: { id: string; name: string } | null;
  // Visual regression branch selection
  selectedBranch: string;
  availableBranches: string[];
  onBranchChange: (branch: string) => void;
  onAddBranch: (branch: string) => void;
  // Action handlers
  isRunning: boolean;
  canRun: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isDuplicating: boolean;
  isCancellingRun: boolean;
  onRunTest: () => void;
  onCancelRun: () => void;
  onSchedule: () => void;
  onEditTest: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  // Error states
  runError?: string;
  duplicateError?: string;
}

export function TestHeader({
  test,
  project,
  suite,
  selectedBranch,
  availableBranches,
  onBranchChange,
  onAddBranch,
  isRunning,
  canRun,
  canEdit,
  canDelete,
  isDuplicating,
  isCancellingRun,
  onRunTest,
  onCancelRun,
  onSchedule,
  onEditTest,
  onDuplicate,
  onDelete,
  runError,
  duplicateError,
}: TestHeaderProps) {
  // Determine if run button should be disabled
  const isRunDisabled =
    !['visual_regression', 'lighthouse', 'load', 'accessibility'].includes(test?.test_type || '') &&
    (test?.steps?.length || 0) === 0 &&
    !test?.target_url;

  return (
    <>
      {/* Feature #554: Standardized PageHeader with consistent breadcrumbs */}
      <PageHeader
        title={test?.name || 'Test'}
        description={test?.description}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name || 'Project', href: `/projects/${project?.id}` },
          { label: suite?.name || 'Suite', href: `/suites/${suite?.id}` },
          { label: test?.name || 'Test' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
              test?.status === 'active' ? 'bg-success/10 text-success' :
              test?.status === 'draft' ? 'bg-warning/10 text-warning' :
              'bg-muted text-foreground'
            }`}>
              {test?.status}
            </span>

          {/* Branch selector for visual regression tests */}
          {test?.test_type === 'visual_regression' && (
            <div className="flex items-center gap-2">
              <label htmlFor="branch-select" className="text-sm text-muted-foreground">
                Branch:
              </label>
              <select
                id="branch-select"
                value={selectedBranch}
                onChange={(e) => onBranchChange(e.target.value)}
                disabled={isRunning}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {availableBranches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
              {/* Option to enter a new branch name */}
              <input
                type="text"
                placeholder="New branch..."
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground w-32"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    const newBranch = e.currentTarget.value.trim();
                    onAddBranch(newBranch);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          )}

          {canRun && !isRunning && (
            <button
              onClick={onRunTest}
              disabled={isRunDisabled}
              className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success disabled:opacity-50"
            >
              Run Test
            </button>
          )}

          {canRun && !isRunning && (
            <button
              onClick={onSchedule}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary"
            >
              Schedule
            </button>
          )}

          {isRunning && (
            <button
              onClick={onCancelRun}
              disabled={isCancellingRun}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive disabled:opacity-50"
            >
              {isCancellingRun ? 'Cancelling...' : 'Cancel Run'}
            </button>
          )}

          {canEdit && (
            <button
              onClick={onEditTest}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Edit Test
            </button>
          )}

          {canEdit && (
            <button
              onClick={onDuplicate}
              disabled={isDuplicating}
              className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              {isDuplicating ? 'Duplicating...' : 'Duplicate'}
            </button>
          )}

          {canDelete && (
            <button
              onClick={onDelete}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive"
            >
              Delete Test
            </button>
          )}
          </div>
        }
      />

      {/* Run Error */}
      {runError && (
        <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {runError}
        </div>
      )}

      {/* Duplicate Error */}
      {duplicateError && (
        <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {duplicateError}
        </div>
      )}
    </>
  );
}
