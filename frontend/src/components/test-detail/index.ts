/**
 * Test Detail Components
 * Feature #48: Modular test detail page
 */

// Types
export * from './types';

// Utilities
export * from './utils';

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

// Modals
export * from './modals';

// Hooks
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
