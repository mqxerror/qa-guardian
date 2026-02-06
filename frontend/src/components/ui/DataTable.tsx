/**
 * Feature #131: Unified DataTable Component
 * A flexible data table with sorting, filtering, and pagination support.
 *
 * Usage:
 * ```tsx
 * <DataTable
 *   data={items}
 *   columns={[
 *     { key: 'name', header: 'Name', sortable: true },
 *     { key: 'status', header: 'Status', render: (item) => <Badge>{item.status}</Badge> },
 *   ]}
 *   keyExtractor={(item) => item.id}
 *   onSort={(key, direction) => handleSort(key, direction)}
 *   pagination={{ page: 1, pageSize: 10, total: 100, onPageChange: setPage }}
 * />
 * ```
 */

import React, { memo, useMemo, useCallback, useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type SortDirection = 'asc' | 'desc' | null;

export interface DataTableColumn<T> {
  /** Unique key for this column */
  key: string;
  /** Header text */
  header: string;
  /** Custom render function */
  render?: (item: T, index: number) => React.ReactNode;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** CSS classes for the column header */
  headerClassName?: string;
  /** CSS classes for the column cells */
  cellClassName?: string;
  /** Column width (e.g., 'w-32', '100px') */
  width?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether to hide on mobile */
  hideOnMobile?: boolean;
}

export interface DataTablePagination {
  /** Current page (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  total: number;
  /** Page change callback */
  onPageChange: (page: number) => void;
  /** Page size change callback */
  onPageSizeChange?: (pageSize: number) => void;
  /** Available page size options */
  pageSizeOptions?: number[];
}

export interface DataTableProps<T> {
  /** Data array */
  data: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Extract unique key from item */
  keyExtractor: (item: T, index: number) => string;
  /** Sort state */
  sortKey?: string;
  /** Sort direction */
  sortDirection?: SortDirection;
  /** Sort change callback */
  onSort?: (key: string, direction: SortDirection) => void;
  /** Pagination config */
  pagination?: DataTablePagination;
  /** Row click handler */
  onRowClick?: (item: T, index: number) => void;
  /** Row selection state */
  selectedKeys?: Set<string>;
  /** Row selection change callback */
  onSelectionChange?: (selectedKeys: Set<string>) => void;
  /** Whether to allow multi-select */
  multiSelect?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Number of skeleton rows when loading */
  loadingRowsCount?: number;
  /** Empty state content */
  emptyState?: React.ReactNode;
  /** Table container className */
  className?: string;
  /** Table className */
  tableClassName?: string;
  /** Enable sticky header */
  stickyHeader?: boolean;
  /** Compact mode with less padding */
  compact?: boolean;
  /** Striped rows */
  striped?: boolean;
  /** Hover effect on rows */
  hoverable?: boolean;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const SortIcon = memo(function SortIcon({ direction }: { direction: SortDirection }) {
  if (!direction) {
    return (
      <svg className="w-4 h-4 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={direction === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
      />
    </svg>
  );
});

const Checkbox = memo(function Checkbox({
  checked,
  indeterminate,
  onChange,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate || false;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
    />
  );
});

// =============================================================================
// PAGINATION COMPONENT
// =============================================================================

const Pagination = memo(function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: DataTablePagination) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      if (page > 3) pages.push('ellipsis');

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (page < totalPages - 2) pages.push('ellipsis');

      pages.push(totalPages);
    }

    return pages;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-border">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Showing {startItem}-{endItem} of {total}
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-2 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {pageNumbers.map((pageNum, idx) =>
          pageNum === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                page === pageNum
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              {pageNum}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-2 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function DataTableComponent<T>({
  data,
  columns,
  keyExtractor,
  sortKey,
  sortDirection,
  onSort,
  pagination,
  onRowClick,
  selectedKeys,
  onSelectionChange,
  multiSelect = false,
  loading = false,
  loadingRowsCount = 5,
  emptyState,
  className = '',
  tableClassName = '',
  stickyHeader = false,
  compact = false,
  striped = false,
  hoverable = true,
}: DataTableProps<T>) {
  // Handle sort click
  const handleSort = useCallback(
    (key: string) => {
      if (!onSort) return;

      let newDirection: SortDirection;
      if (sortKey !== key) {
        newDirection = 'asc';
      } else if (sortDirection === 'asc') {
        newDirection = 'desc';
      } else {
        newDirection = null;
      }

      onSort(key, newDirection);
    },
    [sortKey, sortDirection, onSort]
  );

  // Handle row selection
  const handleRowSelect = useCallback(
    (key: string, checked: boolean) => {
      if (!onSelectionChange) return;

      const newSelection = new Set(selectedKeys);
      if (checked) {
        newSelection.add(key);
      } else {
        newSelection.delete(key);
      }
      onSelectionChange(newSelection);
    },
    [selectedKeys, onSelectionChange]
  );

  // Handle select all
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (!onSelectionChange) return;

      if (checked) {
        const allKeys = new Set(data.map((item, idx) => keyExtractor(item, idx)));
        onSelectionChange(allKeys);
      } else {
        onSelectionChange(new Set());
      }
    },
    [data, keyExtractor, onSelectionChange]
  );

  // Selection state
  const allSelected = selectedKeys?.size === data.length && data.length > 0;
  const someSelected = selectedKeys && selectedKeys.size > 0 && !allSelected;

  // Cell padding
  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  // Empty state
  if (!loading && data.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className={`rounded-lg border border-border bg-card overflow-hidden ${className}`}>
        <table className={`w-full ${tableClassName}`}>
          <thead className="bg-muted/50">
            <tr>
              {onSelectionChange && (
                <th className={`${cellPadding} w-10`}>
                  <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                </th>
              )}
              {columns.map((col) => (
                <th key={col.key} className={cellPadding}>
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: loadingRowsCount }).map((_, idx) => (
              <tr key={idx} className="animate-pulse">
                {onSelectionChange && (
                  <td className={cellPadding}>
                    <div className="h-4 w-4 bg-muted rounded" />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className={cellPadding}>
                    <div className="h-4 bg-muted rounded" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-card overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className={`w-full ${tableClassName}`}>
          <thead className={`bg-muted/50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
            <tr>
              {onSelectionChange && multiSelect && (
                <th className={`${cellPadding} w-10`}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map((col) => {
                const alignClass =
                  col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';
                const hideClass = col.hideOnMobile ? 'hidden md:table-cell' : '';

                return (
                  <th
                    key={col.key}
                    className={`${cellPadding} ${alignClass} ${hideClass} text-sm font-medium text-muted-foreground ${col.headerClassName || ''}`}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.sortable && onSort ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {col.header}
                        <SortIcon direction={sortKey === col.key ? sortDirection || null : null} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((item, index) => {
              const key = keyExtractor(item, index);
              const isSelected = selectedKeys?.has(key);
              const rowClasses = [
                hoverable && 'hover:bg-muted/30',
                striped && index % 2 === 1 && 'bg-muted/10',
                onRowClick && 'cursor-pointer',
                isSelected && 'bg-primary/5',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <tr
                  key={key}
                  className={rowClasses}
                  onClick={() => onRowClick?.(item, index)}
                >
                  {onSelectionChange && multiSelect && (
                    <td className={cellPadding} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected || false}
                        onChange={(checked) => handleRowSelect(key, checked)}
                      />
                    </td>
                  )}
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';
                    const hideClass = col.hideOnMobile ? 'hidden md:table-cell' : '';

                    return (
                      <td
                        key={col.key}
                        className={`${cellPadding} ${alignClass} ${hideClass} ${col.cellClassName || ''}`}
                      >
                        {col.render
                          ? col.render(item, index)
                          : String((item as any)[col.key] ?? '-')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && <Pagination {...pagination} />}
    </div>
  );
}

export const DataTable = memo(DataTableComponent) as typeof DataTableComponent;

export default DataTable;
