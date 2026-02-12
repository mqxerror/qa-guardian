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
export type { SuiteState, RecordingStep, ReviewStats, StepTemplate } from './useSuiteState';
export { useModalState } from './useModalState';
export type { ModalState, ScreenshotElement, ScreenshotTestStep, ScreenshotAnalysis, GeneratedTestPreview, GeneratedTestSuiteTest, GeneratedTestSuite, ConvertedGherkinTest, ParsedOpenApiEndpoint, GeneratedApiTest } from './useModalState';
export { useRecordingState } from './useRecordingState';
export type { RecordingState, UseRecordingStateReturn } from './useRecordingState';
// Feature #50: New hooks for state consolidation
export { useCreateTestState } from './useCreateTestState';
export type { UseCreateTestStateReturn, NewTestType, UrlValidationState, AntiAliasingTolerance, CaptureMode, DiffThresholdMode, WcagLevel, IgnoreRegion } from './useCreateTestState';
export { useAIGenerationState } from './useAIGenerationState';
export type { UseAIGenerationStateReturn, AIGenMode, AIWizardStep, AnnotationType, Annotation, AICopilotSuggestion } from './useAIGenerationState';
// Feature #702: Additional state consolidation hooks
export { useAIHealthState } from './useAIHealthState';
export type { UseAIHealthStateReturn, AIHealthReport, AIHealthRecommendation } from './useAIHealthState';
export { useReviewState } from './useReviewState';
export type { UseReviewStateReturn } from './useReviewState';
export { useSelectorEditState } from './useSelectorEditState';
export type { UseSelectorEditStateReturn, SelectorModalState } from './useSelectorEditState';

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
  GeneratedTestPreviewModal,
  RecordTestModal,
  ReviewRecordedTestModal,
  FullEditTestModal,
} from './modals';
export type { EditSelectorModalState, StepTemplate as TemplateType, FullEditTestModalProps } from './modals';

// Header Components
export { SuiteHeaderActions } from './SuiteHeaderActions';

// Review Panels
export { HumanReviewPanel } from './HumanReviewPanel';

// Results Display
export { SuiteRunResults } from './SuiteRunResults';
export type { LiveScreenshot, ScreenshotHistoryItem } from './SuiteRunResults';

// Test List
export { TestListSection } from './TestListSection';
