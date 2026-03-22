/**
 * PaginationControls - Reusable pagination bar for paginated lists
 * Extracted from TestSuitePage.tsx for component decomposition (Agent 7)
 * Feature #59: Pagination controls for tests
 */

import { Button } from '../ui/button';

export interface PaginationData {
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface PaginationControlsProps {
  pagination: PaginationData;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (size: number) => void;
  /** Label for items (e.g. "tests", "runs"). Defaults to "items". */
  itemLabel?: string;
}

export function PaginationControls({
  pagination,
  currentPage,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemLabel = 'items',
}: PaginationControlsProps) {
  const start = ((currentPage - 1) * itemsPerPage) + 1;
  const end = Math.min(currentPage * itemsPerPage, pagination.total);

  return (
    <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground">
        Showing {start} to {end} of {pagination.total} {itemLabel}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Per page:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="rounded border border-input bg-background px-2 py-1 text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={!pagination.hasPrev}
            title="First page"
          >
            &laquo;&laquo;
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={!pagination.hasPrev}
            title="Previous page"
          >
            &laquo;
          </Button>
          <span className="px-3 text-sm">
            {currentPage} / {pagination.totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(Math.min(pagination.totalPages, currentPage + 1))}
            disabled={!pagination.hasNext}
            title="Next page"
          >
            &raquo;
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(pagination.totalPages)}
            disabled={!pagination.hasNext}
            title="Last page"
          >
            &raquo;&raquo;
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PaginationControls;
