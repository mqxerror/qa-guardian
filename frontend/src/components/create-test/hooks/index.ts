/**
 * Create Test Hooks
 * Feature #1801: Zustand store for test creation state
 * Feature #1808: useAIParser hook for AI Generate step
 */

export { useCreateTest, default } from './useCreateTest';
export type {
  ModalSection,
  WizardStep,
  GeneratedTestPreview,
  ValidationErrors,
} from './useCreateTest';

// Feature #1808: AI Parser hook
export { useAIParser } from './useAIParser';
export type {
  DetectedTestType,
  ViewportPreset,
  ParsedResult,
  AIParserState,
  UseAIParserOptions,
} from './useAIParser';
