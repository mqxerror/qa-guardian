/**
 * Suite Detail Components
 * Feature #50: Modular test suite detail page
 */

// Types
export * from './types';

// Utilities
export * from './utils';

// Hooks
export { useSuiteState } from './useSuiteState';
export type { SuiteState, RecordingStep, ParallelizationPlan, ParallelizationWorker, ReviewStats, StepTemplate } from './useSuiteState';
export { useModalState } from './useModalState';
export type { ModalState, ScreenshotElement, ScreenshotTestStep, ScreenshotAnalysis, GeneratedTestPreview, GeneratedTestSuiteTest, GeneratedTestSuite, ConvertedGherkinTest, ParsedOpenApiEndpoint, GeneratedApiTest } from './useModalState';

// Components
export { default as TestListItem } from './TestListItem';
export {
  TestTypeBadge,
  TestStatusBadge,
  AIConfidenceBadge,
  ReviewStatusBadge,
} from './TestTypeBadge';

// Modals
export {
  DeleteSuiteModal,
  DeleteTestModal,
  ImportTestsModal,
  EditSelectorModal,
  ExpandedScreenshotModal,
  InsertTemplateModal,
} from './modals';
export type { EditSelectorModalState, StepTemplate as TemplateType } from './modals';

// Panels
export { ParallelizationPanel } from './ParallelizationPanel';

// Header Components
export { SuiteHeaderActions } from './SuiteHeaderActions';

// Review Panels
export { HumanReviewPanel } from './HumanReviewPanel';

// Results Display
export { SuiteRunResults } from './SuiteRunResults';
export type { LiveScreenshot, ScreenshotHistoryItem } from './SuiteRunResults';
