/**
 * Test Configuration Components
 * Feature #1810: E2EConfig component
 * Feature #1811: VisualConfig component
 * Feature #1812: PerformanceConfig component
 * Feature #1813: LoadConfig component
 * Feature #1814: AccessibilityConfig component
 *
 * This module exports type-specific configuration forms
 * for use in the CustomTestWizard ManualSetupStep.
 */

// E2E Configuration (Feature #1810)
export { E2EConfig, default } from './E2EConfig';
export type { E2EConfigProps, E2EConfigState } from './E2EConfig';

// StepBuilder Component (Feature #1822)
export { StepBuilder } from './StepBuilder';
export type { StepBuilderProps, Step, StepAction } from './StepBuilder';

// Visual Regression Configuration (Feature #1811)
export { VisualConfig } from './VisualConfig';
export type { VisualConfigProps, VisualConfigState, ViewportConfig, CaptureMode } from './VisualConfig';

// Performance/Lighthouse Configuration (Feature #1812)
export { PerformanceConfig } from './PerformanceConfig';
export type { PerformanceConfigProps, PerformanceConfigState, DevicePreset } from './PerformanceConfig';

// Load/K6 Configuration (Feature #1813)
export { LoadConfig } from './LoadConfig';
export type { LoadConfigProps, LoadConfigState, LoadScenario } from './LoadConfig';

// Accessibility/axe-core Configuration (Feature #1814)
export { AccessibilityConfig } from './AccessibilityConfig';
export type { AccessibilityConfigProps, AccessibilityConfigState, WCAGLevel, Severity } from './AccessibilityConfig';
