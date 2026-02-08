/**
 * VirtualList Component
 *
 * Feature #63: Virtual scrolling for large lists
 *
 * Uses @tanstack/react-virtual to efficiently render only visible items,
 * dramatically improving performance for lists with 1000+ items.
 */

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualListProps<T> {
  /**
   * Array of items to render
   */
  items: T[];

  /**
   * Height of each item in pixels (can be function for variable heights)
   */
  itemHeight: number | ((index: number) => number);

  /**
   * Height of the scrollable container in pixels
   */
  containerHeight: number;

  /**
   * Render function for each item
   */
  renderItem: (item: T, index: number, virtualRow: { size: number; start: number }) => React.ReactNode;

  /**
   * Optional CSS class for the container
   */
  className?: string;

  /**
   * Optional overscan count (number of items to render outside visible area)
   * Helps with smooth scrolling. Default: 5
   */
  overscan?: number;

  /**
   * Optional key extractor function
   */
  getItemKey?: (item: T, index: number) => string | number;

  /**
   * Optional gap between items in pixels
   */
  gap?: number;

  /**
   * Optional empty state component
   */
  emptyState?: React.ReactNode;

  /**
   * Optional loading state
   */
  isLoading?: boolean;

  /**
   * Optional loading component
   */
  loadingState?: React.ReactNode;
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className = '',
  overscan = 5,
  getItemKey,
  gap = 0,
  emptyState,
  isLoading,
  loadingState,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const getItemSize = typeof itemHeight === 'function'
    ? itemHeight
    : () => itemHeight + gap;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getItemSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index], index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (isLoading) {
    return (
      loadingState || (
        <div
          className={`flex items-center justify-center ${className}`}
          style={{ height: containerHeight }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )
    );
  }

  if (items.length === 0) {
    return (
      emptyState || (
        <div
          className={`flex items-center justify-center text-muted-foreground ${className}`}
          style={{ height: containerHeight }}
        >
          No items to display
        </div>
      )
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size - gap,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index, {
                size: virtualRow.size,
                start: virtualRow.start,
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hook for creating a virtual list with more control
 */
export function useVirtualList<T>({
  items,
  itemHeight,
  containerRef,
  overscan = 5,
  getItemKey,
}: {
  items: T[];
  itemHeight: number | ((index: number) => number);
  containerRef: React.RefObject<HTMLDivElement>;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string | number;
}) {
  const getItemSize = typeof itemHeight === 'function'
    ? itemHeight
    : () => itemHeight;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: getItemSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index], index)
      : undefined,
  });

  return {
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    scrollToIndex: virtualizer.scrollToIndex,
    scrollToOffset: virtualizer.scrollToOffset,
    measure: virtualizer.measure,
  };
}

/**
 * VirtualTable component for table-based virtual scrolling
 */
export interface VirtualTableProps<T> {
  items: T[];
  rowHeight: number;
  containerHeight: number;
  renderRow: (item: T, index: number) => React.ReactNode;
  renderHeader?: () => React.ReactNode;
  className?: string;
  overscan?: number;
  getRowKey?: (item: T, index: number) => string | number;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
}

export function VirtualTable<T>({
  items,
  rowHeight,
  containerHeight,
  renderRow,
  renderHeader,
  className = '',
  overscan = 5,
  getRowKey,
  emptyState,
  isLoading,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
    getItemKey: getRowKey
      ? (index) => getRowKey(items[index], index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (isLoading) {
    return (
      <div className={`${className}`}>
        {renderHeader && (
          <div className="sticky top-0 z-10 bg-card">
            {renderHeader()}
          </div>
        )}
        <div
          className="flex items-center justify-center"
          style={{ height: containerHeight }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`${className}`}>
        {renderHeader && (
          <div className="sticky top-0 z-10 bg-card">
            {renderHeader()}
          </div>
        )}
        {emptyState || (
          <div
            className="flex items-center justify-center text-muted-foreground"
            style={{ height: containerHeight }}
          >
            No items to display
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {renderHeader && (
        <div className="sticky top-0 z-10 bg-card">
          {renderHeader()}
        </div>
      )}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: containerHeight }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: rowHeight,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderRow(item, virtualRow.index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualList;
