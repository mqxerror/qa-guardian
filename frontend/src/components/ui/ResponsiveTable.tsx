/**
 * Feature #127: ResponsiveTable Component
 * Displays data as a table on desktop (md+) and as cards on mobile
 *
 * Usage:
 * ```tsx
 * <ResponsiveTable
 *   data={items}
 *   columns={[
 *     { key: 'status', header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
 *     { key: 'name', header: 'Name' },
 *   ]}
 *   renderCard={(item) => <MyCard item={item} />}
 *   keyExtractor={(item) => item.id}
 * />
 * ```
 */

import React from 'react';

export interface TableColumn<T> {
  /** Unique key for this column */
  key: string;
  /** Header text */
  header: string;
  /** Optional custom render function */
  render?: (item: T, index: number) => React.ReactNode;
  /** CSS class for the column */
  className?: string;
  /** Show on mobile card view */
  showOnMobile?: boolean;
}

// Feature #421: Helper function for safe property access
function getItemProperty<T extends Record<string, unknown>>(item: T, key: string): unknown {
  return item[key];
}

interface ResponsiveTableProps<T extends Record<string, unknown>> {
  /** Data array */
  data: T[];
  /** Column definitions */
  columns: TableColumn<T>[];
  /** Extract unique key from item */
  keyExtractor: (item: T, index: number) => string;
  /** Render function for mobile card view */
  renderCard?: (item: T, index: number) => React.ReactNode;
  /** CSS class for the container */
  className?: string;
  /** CSS class for the table */
  tableClassName?: string;
  /** Row click handler */
  onRowClick?: (item: T, index: number) => void;
  /** Empty state content */
  emptyState?: React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Loading rows count */
  loadingRowsCount?: number;
}

export function ResponsiveTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyExtractor,
  renderCard,
  className = '',
  tableClassName = '',
  onRowClick,
  emptyState,
  loading,
  loadingRowsCount = 5,
}: ResponsiveTableProps<T>) {
  // Empty state
  if (!loading && data.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className={className}>
        {/* Mobile skeleton */}
        <div className="md:hidden space-y-4">
          {Array.from({ length: loadingRowsCount }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-2/3 mb-1" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
        {/* Desktop skeleton */}
        <div className="hidden md:block bg-card rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/50 p-4">
            <div className="flex gap-4">
              {columns.map((col) => (
                <div key={col.key} className="h-4 bg-muted rounded flex-1" />
              ))}
            </div>
          </div>
          {Array.from({ length: loadingRowsCount }).map((_, i) => (
            <div key={i} className="border-t border-border p-4 animate-pulse">
              <div className="flex gap-4">
                {columns.map((col) => (
                  <div key={col.key} className="h-4 bg-muted rounded flex-1" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Mobile card view */}
      <div className="md:hidden space-y-4">
        {data.map((item, index) => {
          const key = keyExtractor(item, index);

          // Use custom card renderer if provided
          if (renderCard) {
            return (
              <div
                key={key}
                onClick={() => onRowClick?.(item, index)}
                className={onRowClick ? 'cursor-pointer' : ''}
              >
                {renderCard(item, index)}
              </div>
            );
          }

          // Default card layout
          const mobileColumns = columns.filter((col) => col.showOnMobile !== false);

          return (
            <div
              key={key}
              className={`bg-card rounded-lg border border-border p-4 ${onRowClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
              onClick={() => onRowClick?.(item, index)}
            >
              {mobileColumns.map((col) => (
                <div key={col.key} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {col.header}
                  </span>
                  <span className="text-sm text-foreground">
                    {col.render ? col.render(item, index) : String(getItemProperty(item, col.key) ?? '-')}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className={`hidden md:block bg-card rounded-lg border border-border overflow-hidden ${tableClassName}`}>
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-sm font-medium text-muted-foreground ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((item, index) => (
              <tr
                key={keyExtractor(item, index)}
                className={onRowClick ? 'hover:bg-muted/30 cursor-pointer' : 'hover:bg-muted/30'}
                onClick={() => onRowClick?.(item, index)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                    {col.render ? col.render(item, index) : String(getItemProperty(item, col.key) ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Simple run card for mobile view
 */
interface RunCardProps {
  status: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  date?: React.ReactNode;
  stats?: React.ReactNode;
  action?: React.ReactNode;
}

export function DataCard({ status, title, subtitle, date, stats, action }: RunCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {status}
            {title}
          </div>
          {subtitle && <div className="text-sm text-muted-foreground truncate">{subtitle}</div>}
          {date && <div className="text-xs text-muted-foreground mt-1">{date}</div>}
        </div>
        <div className="text-right shrink-0">
          {stats && <div className="mb-1">{stats}</div>}
          {action}
        </div>
      </div>
    </div>
  );
}

/**
 * HorizontalScrollWrapper - Adds horizontal scrolling to table on mobile
 * Use this for tables that can't easily be converted to cards
 */
interface HorizontalScrollWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function HorizontalScrollWrapper({ children, className = '' }: HorizontalScrollWrapperProps) {
  return (
    <div className={`overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}>
      <div className="min-w-[640px] sm:min-w-0">
        {children}
      </div>
    </div>
  );
}

export default ResponsiveTable;
