// Feature #48: TestResultCard Barrel File
// Re-exports all sub-components and types for easy importing

// Types
export type {
  StepResult,
  VisualComparison,
  K6Results,
  DeviceLighthouseMetrics,
  LighthouseResults,
  AccessibilityResults,
  TestResult,
  TestResultCardProps,
} from './types';

export { getScoreColor, getScoreBgColor } from './types';

// Components
export { K6ResultsDisplay } from './K6ResultsDisplay';
export { VisualComparisonDisplay } from './VisualComparisonDisplay';
export { LighthouseResultsDisplay, DeviceScoreCard } from './LighthouseResultsDisplay';
export { AccessibilityResultsDisplay } from './AccessibilityResultsDisplay';
