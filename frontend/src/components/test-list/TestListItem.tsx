/**
 * Test List Item Component
 * Feature #1787: Extract test list components from TestSuitePage
 * Feature #1958: Enhanced with run metadata columns (Last Run, Result, Runs, Avg Time)
 *
 * Renders a single test row in the test list table.
 * Replaces the inline JSX that was duplicated in TestSuitePage.
 */

import { TestListItemProps } from './types';
import { TestStatusBadge } from './TestStatusBadge';
import { AIBadge } from './AIBadge';
import { HealingBadge } from './HealingBadge';
import { TestTypeBadge } from './TestTypeBadge';

// Feature #1958: Format relative time
function formatRelativeTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'Never';

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// Feature #1958: Format duration
function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

// Feature #1958: Result badge component
function ResultBadge({ result }: { result: 'passed' | 'failed' | 'error' | 'running' | null | undefined }) {
  if (!result) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const styles = {
    passed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    error: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };

  const icons = {
    passed: '✓',
    failed: '✗',
    error: '⚠',
    running: '●',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[result]}`}>
      <span>{icons[result]}</span>
      <span className="capitalize">{result}</span>
    </span>
  );
}

export function TestListItem({
  test,
  onView,
  onSelect,
  isSelected = false,
  showCheckbox = false,
}: TestListItemProps) {
  const handleClick = () => {
    onView(test.id);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(test.id, e.target.checked);
    }
  };

  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView(test.id);
  };

  return (
    <div
      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_80px] gap-2 border-b border-border px-4 py-3 last:border-0 items-center hover:bg-muted/20 cursor-pointer min-w-[800px]"
      onClick={handleClick}
    >
      {/* Column 1: Name & Description */}
      <div className="flex items-center gap-2 min-w-0">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 flex-shrink-0"
          />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-foreground truncate">{test.name}</span>
            <TestTypeBadge testType={test.test_type} />
            <HealingBadge
              isActive={test.healing_active || false}
              status={test.healing_status || null}
              count={test.healing_count}
            />
          </div>
          {test.description && (
            <p className="text-xs text-muted-foreground truncate">{test.description}</p>
          )}
        </div>
      </div>

      {/* Column 2: Status & AI Badges */}
      <div className="flex items-center gap-1 flex-wrap">
        <TestStatusBadge status={test.status} />
        <AIBadge
          isAiGenerated={test.ai_generated || false}
          confidenceScore={test.ai_confidence_score}
          reviewStatus={test.review_status}
        />
      </div>

      {/* Column 3: Last Run (Feature #1958) */}
      <div className="text-sm text-muted-foreground" title={test.last_run_at ? new Date(test.last_run_at).toLocaleString() : undefined}>
        {formatRelativeTime(test.last_run_at)}
      </div>

      {/* Column 4: Last Result (Feature #1958) */}
      <div>
        <ResultBadge result={test.last_result} />
      </div>

      {/* Column 5: Run Count (Feature #1958) */}
      <div className="text-sm text-muted-foreground">
        {test.run_count ?? 0}
      </div>

      {/* Column 6: Avg Duration (Feature #1958) */}
      <div className="text-sm text-muted-foreground">
        {formatDuration(test.avg_duration_ms)}
      </div>

      {/* Column 7: Actions */}
      <div>
        <button
          onClick={handleViewClick}
          className="text-sm text-primary hover:underline"
        >
          View
        </button>
      </div>
    </div>
  );
}

export default TestListItem;
