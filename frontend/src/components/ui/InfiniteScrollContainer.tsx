/**
 * InfiniteScrollContainer Component
 *
 * Feature #64: Infinite scroll for run history
 *
 * Wraps content and automatically loads more data when scrolling near the bottom.
 * Uses Intersection Observer API for efficient scroll detection.
 */

import React, { useRef, useEffect, useCallback } from 'react';

export interface InfiniteScrollContainerProps {
  /**
   * Children to render inside the scrollable container
   */
  children: React.ReactNode;

  /**
   * Whether there's more data to load
   */
  hasNextPage: boolean | undefined;

  /**
   * Whether currently fetching the next page
   */
  isFetchingNextPage: boolean;

  /**
   * Function to call when user scrolls near the bottom
   */
  fetchNextPage: () => void;

  /**
   * Optional threshold in pixels from bottom to trigger loading (default: 100)
   */
  threshold?: number;

  /**
   * Optional CSS class for the container
   */
  className?: string;

  /**
   * Optional height for the container (default: auto)
   */
  height?: string | number;

  /**
   * Optional loading indicator component
   */
  loadingIndicator?: React.ReactNode;

  /**
   * Optional end of list component
   */
  endOfListIndicator?: React.ReactNode;

  /**
   * Whether to show default loading state
   */
  showDefaultLoading?: boolean;

  /**
   * Whether to show "end of list" message
   */
  showEndOfList?: boolean;
}

/**
 * Default loading indicator component
 */
const DefaultLoadingIndicator = () => (
  <div className="flex justify-center py-4">
    <div className="flex items-center gap-2 text-muted-foreground">
      <svg
        className="animate-spin h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>Loading more...</span>
    </div>
  </div>
);

/**
 * Default end of list indicator
 */
const DefaultEndOfList = () => (
  <div className="flex justify-center py-4 text-sm text-muted-foreground">
    No more items to load
  </div>
);

/**
 * InfiniteScrollContainer - Wraps content with infinite scroll capability
 */
export function InfiniteScrollContainer({
  children,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  threshold = 100,
  className = '',
  height,
  loadingIndicator,
  endOfListIndicator,
  showDefaultLoading = true,
  showEndOfList = true,
}: InfiniteScrollContainerProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Callback for when the sentinel element becomes visible
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  // Set up Intersection Observer
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: `${threshold}px`,
      threshold: 0,
    });

    observerRef.current.observe(node);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver, threshold]);

  const containerStyle: React.CSSProperties = height
    ? { height: typeof height === 'number' ? `${height}px` : height, overflowY: 'auto' }
    : {};

  return (
    <div className={className} style={containerStyle}>
      {children}

      {/* Sentinel element for intersection observer */}
      <div ref={loadMoreRef} className="h-1" />

      {/* Loading indicator */}
      {isFetchingNextPage && (
        showDefaultLoading ? (
          loadingIndicator || <DefaultLoadingIndicator />
        ) : null
      )}

      {/* End of list indicator */}
      {!hasNextPage && !isFetchingNextPage && showEndOfList && (
        endOfListIndicator || <DefaultEndOfList />
      )}
    </div>
  );
}

/**
 * Hook for using infinite scroll with custom logic
 */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  threshold = 100,
}: {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  threshold?: number;
}) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: `${threshold}px`,
      threshold: 0,
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [handleObserver, threshold]);

  return { loadMoreRef };
}

export default InfiniteScrollContainer;
