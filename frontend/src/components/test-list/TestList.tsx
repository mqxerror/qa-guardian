/**
 * Test List Component
 * Feature #1787: Extract test list components from TestSuitePage
 * Feature #1958: Enhanced with run metadata columns and sorting
 *
 * Renders a list of tests with optional filtering and selection.
 * Replaces the inline test list rendering in TestSuitePage.
 */

import { useMemo } from 'react';
import { TestListProps, TestSortField } from './types';
import { TestListItem } from './TestListItem';

// Sort indicator component
function SortIndicator({ field, currentField, direction }: {
  field: TestSortField;
  currentField?: TestSortField;
  direction?: 'asc' | 'desc';
}) {
  if (field !== currentField) {
    return <span className="ml-1 text-muted-foreground/30">↕</span>;
  }
  return <span className="ml-1">{direction === 'asc' ? '↑' : '↓'}</span>;
}

// Sortable header component
function SortableHeader({
  label,
  field,
  currentField,
  direction,
  onSort,
  className = '',
}: {
  label: string;
  field: TestSortField;
  currentField?: TestSortField;
  direction?: 'asc' | 'desc';
  onSort?: (field: TestSortField) => void;
  className?: string;
}) {
  if (!onSort) {
    return <div className={className}>{label}</div>;
  }

  return (
    <button
      className={`flex items-center hover:text-foreground transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      {label}
      <SortIndicator field={field} currentField={currentField} direction={direction} />
    </button>
  );
}

export function TestList({
  tests,
  onView,
  onSelect,
  selectedIds = new Set(),
  showCheckboxes = false,
  emptyMessage = 'No tests found',
  searchQuery = '',
  sortField,
  sortDirection,
  onSort,
}: TestListProps) {
  // Filter tests based on search query
  const filteredTests = useMemo(() => {
    if (!searchQuery.trim()) return tests;

    const query = searchQuery.toLowerCase().trim();
    return tests.filter(
      (test) =>
        test.name.toLowerCase().includes(query) ||
        (test.description && test.description.toLowerCase().includes(query))
    );
  }, [tests, searchQuery]);

  // Sort filtered tests
  const sortedTests = useMemo(() => {
    if (!sortField) return filteredTests;

    return [...filteredTests].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'last_run':
          const aTime = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
          const bTime = b.last_run_at ? new Date(b.last_run_at).getTime() : 0;
          comparison = aTime - bTime;
          break;
        case 'last_result':
          // Order: passed > running > failed > error > null
          const resultOrder = { passed: 4, running: 3, failed: 2, error: 1 };
          const aOrder = a.last_result ? resultOrder[a.last_result] || 0 : 0;
          const bOrder = b.last_result ? resultOrder[b.last_result] || 0 : 0;
          comparison = aOrder - bOrder;
          break;
        case 'run_count':
          comparison = (a.run_count || 0) - (b.run_count || 0);
          break;
        case 'avg_duration':
          comparison = (a.avg_duration_ms || 0) - (b.avg_duration_ms || 0);
          break;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [filteredTests, sortField, sortDirection]);

  // Empty state for no tests
  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/10 py-16">
        <svg
          className="h-12 w-12 text-muted-foreground/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="mt-4 text-lg font-medium text-foreground">No tests yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first test to get started
        </p>
      </div>
    );
  }

  // Empty state for no search results
  if (filteredTests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/10 py-12">
        <svg
          className="h-10 w-10 text-muted-foreground/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <p className="mt-4 text-lg font-medium text-foreground">No matching tests</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting your search query
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      {/* Table Header - Feature #1958: Enhanced with run metadata columns */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_80px] gap-2 border-b border-border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground min-w-[800px]">
        <SortableHeader label="Name" field="name" currentField={sortField} direction={sortDirection} onSort={onSort} />
        <SortableHeader label="Status" field="status" currentField={sortField} direction={sortDirection} onSort={onSort} />
        <SortableHeader label="Last Run" field="last_run" currentField={sortField} direction={sortDirection} onSort={onSort} />
        <SortableHeader label="Result" field="last_result" currentField={sortField} direction={sortDirection} onSort={onSort} />
        <SortableHeader label="Runs" field="run_count" currentField={sortField} direction={sortDirection} onSort={onSort} />
        <SortableHeader label="Avg Time" field="avg_duration" currentField={sortField} direction={sortDirection} onSort={onSort} />
        <div>Actions</div>
      </div>

      {/* Test Rows */}
      {sortedTests.map((test) => (
        <TestListItem
          key={test.id}
          test={test}
          onView={onView}
          onSelect={onSelect}
          isSelected={selectedIds.has(test.id)}
          showCheckbox={showCheckboxes}
        />
      ))}
    </div>
  );
}

export default TestList;
