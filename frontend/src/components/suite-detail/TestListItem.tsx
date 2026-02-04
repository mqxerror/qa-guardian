/**
 * TestListItem Component
 * Feature #50: Extracted from TestSuitePage.tsx
 * Displays a single test in the test list with metadata
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { TestTypeBadge, TestStatusBadge, AIConfidenceBadge, ReviewStatusBadge } from './TestTypeBadge';
import { formatRelativeTime, formatDuration, truncateText } from './utils';
import type { TestType } from './types';

interface TestListItemProps {
  test: TestType;
  onRun?: (testId: string) => void;
  onDuplicate?: (test: TestType) => void;
  onDelete?: (testId: string) => void;
  showQuickActions?: boolean;
}

const TestListItem: React.FC<TestListItemProps> = React.memo(({
  test,
  onRun,
  onDuplicate,
  onDelete,
  showQuickActions = true,
}) => {
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  return (
    <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/tests/${test.id}`}
            className="text-lg font-semibold text-foreground hover:text-primary truncate"
          >
            {test.name}
          </Link>
          <TestTypeBadge type={test.type} />
          {test.last_result && <TestStatusBadge status={test.last_result} />}
          {test.ai_generated && (
            <AIConfidenceBadge confidence={test.ai_confidence_score} />
          )}
          {test.review_status && test.review_status !== 'approved' && (
            <ReviewStatusBadge status={test.review_status} />
          )}
        </div>

        {test.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
            {truncateText(test.description, 100)}
          </p>
        )}

        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {test.run_count !== undefined && (
            <span className="flex items-center gap-1">
              <span>🏃</span>
              {test.run_count} run{test.run_count !== 1 ? 's' : ''}
            </span>
          )}
          {test.avg_duration_ms !== undefined && test.avg_duration_ms !== null && (
            <span className="flex items-center gap-1">
              <span>⏱️</span>
              ~{formatDuration(test.avg_duration_ms)}
            </span>
          )}
          {test.last_run_at && (
            <span className="flex items-center gap-1">
              <span>📅</span>
              Last run: {formatRelativeTime(new Date(test.last_run_at))}
            </span>
          )}
          {test.target_url && (
            <span className="flex items-center gap-1 max-w-[200px] truncate">
              <span>🔗</span>
              {truncateText(test.target_url.replace(/^https?:\/\//, ''), 30)}
            </span>
          )}
        </div>
      </div>

      {showQuickActions && (
        <div className="relative ml-4" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            aria-label="Test actions"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-10">
              <div className="py-1">
                {onRun && (
                  <button
                    onClick={() => {
                      onRun(test.id);
                      setShowDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <span>▶️</span>
                    Run Test
                  </button>
                )}
                <Link
                  to={`/tests/${test.id}`}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                  onClick={() => setShowDropdown(false)}
                >
                  <span>📝</span>
                  Edit Test
                </Link>
                {onDuplicate && (
                  <button
                    onClick={() => {
                      onDuplicate(test);
                      setShowDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <span>📋</span>
                    Duplicate
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      onDelete(test.id);
                      setShowDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <span>🗑️</span>
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

TestListItem.displayName = 'TestListItem';

export default TestListItem;
