/**
 * Test Detail Components
 * Feature #48: Modular test detail page
 */

// Types
export * from './types';

// Utilities
export * from './utils';
export { exportAccessibilityPDF, exportAccessibilityCSV } from './exportUtils';

// Code Generation Utilities (Feature #48)
export {
  generatePlaywrightCode,
  generateK6Script,
  getK6Templates,
  highlightJavaScriptLine,
  detectFoldableRegions,
  isLineHidden,
  getFoldIcon,
  selectorPatterns,
  getValuePatterns,
  findSelectorAutocomplete,
  findValueAutocomplete,
  type K6Template,
  type FoldableRegion,
} from './codeGenUtils';

// Components
export { default as TestStatusBadge } from './TestStatusBadge';
export { VideoPlayer } from './VideoPlayer';
export { FlakinessPanel } from './FlakinessPanel';
export { ImageLightbox } from './ImageLightbox';
export { K6CompareModal, type K6CompareResults } from './K6CompareModal';
export { RunHistorySection } from './RunHistorySection';
export { CurrentRunPanel, type CurrentRunPanelProps, type LiveProgress, type ConsoleLogEntry } from './CurrentRunPanel';
export { ViewCodeTab } from './ViewCodeTab';
export { K6ScriptTab } from './K6ScriptTab';
export { TestDetailsCard } from './TestDetailsCard';
export { TestStepsTab } from './TestStepsTab';
export { BaselineTab } from './BaselineTab';
export { LiveExecutionPanel, type LiveExecutionPanelProps } from './LiveExecutionPanel';
export { TestHeader, type TestHeaderProps } from './TestHeader';
export { TestResultCard, type TestResultCardProps, type TestResult } from './TestResultCard';

// Modals
export * from './modals';

// Hooks
export { useTestDetailActions, type UseTestDetailActionsProps } from './useTestDetailActions';
export {
  useTestDetailState,
  useCoreTestState,
  useModalState,
  useVisualTestingState,
  useUIState,
  useStepManagementState,
  type TestDetailState,
  type TestSuite,
  type Project,
  type BaselineData,
  type BaselineHistoryEntry,
  type MergeableBranch,
  type RejectionStatus,
} from './useTestDetailState';
export {
  useBaselineHandlers,
  type UseBaselineHandlersProps,
  type BaselineHandlers,
} from './useBaselineHandlers';
