/**
 * Create Test Modal Components
 * Feature #1800: CreateTestModal with two-section layout
 * Feature #1801: useCreateTest zustand store
 * Feature #1802: URLInput component
 * Feature #1807: CustomTestWizard with MethodSelection
 * Feature #1808: AIGenerateStep with useAIParser
 * Feature #1809: ManualSetupStep with type-specific forms
 * Feature #1810: E2EConfig component
 * Feature #1815: ReviewStep with create submission
 *
 * This module provides the new two-section Create Test modal with:
 * - Quick Test: URL input + multi-test generation
 * - Custom Test: Entry to full wizard
 */

// Main components
export { CreateTestModal, default } from './CreateTestModal';
export { CustomTestWizard } from './CustomTestWizard';
export type { ConfigMethod, CustomTestWizardProps } from './CustomTestWizard';
export { AIGenerateStep } from './AIGenerateStep';
export type { AIGenerateStepProps } from './AIGenerateStep';
export { ManualSetupStep } from './ManualSetupStep';
export type { ManualSetupStepProps, ManualSetupFormState } from './ManualSetupStep';
export { ReviewStep } from './ReviewStep';
export type { ReviewStepProps, WizardConfig, AIGeneratedConfig, ManualSetupConfig } from './ReviewStep';

// Test type config components (Feature #1810+)
export { E2EConfig, VisualConfig } from './config';
export type {
  E2EConfigProps,
  E2EConfigState,
  VisualConfigProps,
  VisualConfigState,
  ViewportConfig,
  CaptureMode,
} from './config';

// Hooks (Feature #1801, #1808)
export { useCreateTest, useAIParser } from './hooks';
export type {
  ModalSection,
  WizardStep,
  GeneratedTestPreview,
  ValidationErrors,
  DetectedTestType,
  ViewportPreset,
  ParsedResult,
  AIParserState,
  UseAIParserOptions,
} from './hooks';

// Shared components (Feature #1802)
export { URLInput } from './shared';
export type { URLInputProps } from './shared';

// Types
export * from './types';
