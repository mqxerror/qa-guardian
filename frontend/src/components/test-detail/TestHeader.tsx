// Feature #48: TestHeader - Extracted from TestDetailPage.tsx
// Displays breadcrumb navigation, test title, status badge, and action buttons

import { Link } from 'react-router-dom';
import { TestType } from './types';

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
      {/* Breadcrumb navigation */}
      <nav className="mb-6 flex items-center gap-2 text-sm">
        <Link to="/projects" className="text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link to={`/projects/${project?.id}`} className="text-muted-foreground hover:text-foreground">
          {project?.name || 'Project'}
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link to={`/suites/${suite?.id}`} className="text-muted-foreground hover:text-foreground">
          {suite?.name || 'Suite'}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">{test?.name}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{test?.name}</h1>
          {test?.description && (
            <p className="mt-2 text-muted-foreground">{test.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            test?.status === 'active' ? 'bg-green-100 text-green-700' :
            test?.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
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
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Run Test
            </button>
          )}

          {canRun && !isRunning && (
            <button
              onClick={onSchedule}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Schedule
            </button>
          )}

          {isRunning && (
            <button
              onClick={onCancelRun}
              disabled={isCancellingRun}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete Test
            </button>
          )}
        </div>
      </div>

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
