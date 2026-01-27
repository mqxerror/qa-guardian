/**
 * Types for Test List components
 * Feature #1787: Extract test list components from TestSuitePage
 */

export type TestStatus = 'active' | 'draft' | 'disabled' | 'archived';

export type TestType = 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';

export type ReviewStatus = 'pending_review' | 'approved' | 'rejected' | null;

export type HealingStatus = 'pending' | 'applied' | 'rejected' | null;

export interface TestStep {
  action: string;
  target: string;
  value?: string;
}

export interface Test {
  id: string;
  name: string;
  description?: string;
  status: TestStatus;
  test_type: TestType;
  target_url?: string;
  steps: TestStep[];

  // AI generation metadata
  ai_generated?: boolean;
  ai_confidence_score?: number;
  review_status?: ReviewStatus;

  // Self-healing metadata
  healing_active?: boolean;
  healing_status?: HealingStatus;
  healing_count?: number;

  // Visual regression specific
  viewport_width?: number;
  viewport_height?: number;
  diff_threshold?: number;

  // Timestamps
  created_at?: string;
  updated_at?: string;
  last_run_at?: string;

  // Feature #1958: Run metadata for test list display
  run_count?: number;
  last_result?: 'passed' | 'failed' | 'error' | 'running' | null;
  avg_duration_ms?: number | null;
}

export interface TestListItemProps {
  test: Test;
  onView: (testId: string) => void;
  onSelect?: (testId: string, selected: boolean) => void;
  isSelected?: boolean;
  showCheckbox?: boolean;
}

// Feature #1958: Sort options for test list
export type TestSortField = 'name' | 'status' | 'last_run' | 'last_result' | 'run_count' | 'avg_duration';
export type SortDirection = 'asc' | 'desc';

export interface TestListProps {
  tests: Test[];
  onView: (testId: string) => void;
  onSelect?: (testId: string, selected: boolean) => void;
  selectedIds?: Set<string>;
  showCheckboxes?: boolean;
  emptyMessage?: string;
  searchQuery?: string;
  // Feature #1958: Sorting
  sortField?: TestSortField;
  sortDirection?: SortDirection;
  onSort?: (field: TestSortField) => void;
}

export interface TestStatusBadgeProps {
  status: TestStatus;
  size?: 'sm' | 'md';
}

export interface AIBadgeProps {
  isAiGenerated: boolean;
  confidenceScore?: number;
  reviewStatus?: ReviewStatus;
}

export interface HealingBadgeProps {
  isActive: boolean;
  status?: HealingStatus;
  count?: number;
}

export interface TestTypeBadgeProps {
  testType: TestType;
}
