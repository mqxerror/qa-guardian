/**
 * Hooks Index
 * Central export point for all custom hooks
 */

export {
  useAccessibilityState,
  type UseAccessibilityStateReturn,
  type A11yAIResults,
  type AccessibilityData,
} from './useAccessibilityState';

export {
  useMetricsState,
  type UseMetricsStateReturn,
  type K6ActiveChart,
  type K6ExportFormat,
  type K6ActiveTab,
  type LighthouseActiveTab,
  type EndpointSortBy,
} from './useMetricsState';

export {
  useVisualTestState,
  type UseVisualTestStateParams,
  type UseVisualTestStateReturn,
} from './useVisualTestState';

export {
  useQuickTestSocket,
  type WaveStep,
  type WaveState,
  type QuickTestSummary,
  type QuickTestState,
} from './useQuickTestSocket';

export {
  useSuiteRunSocket,
  type LiveScreenshot,
  type ScreenshotHistoryEntry,
  type SuiteRun,
  type SuiteRunResult,
  type TestRunStatus,
  type CurrentStepProgress,
  type UseSuiteRunSocketProps,
  type UseSuiteRunSocketReturn,
} from './useSuiteRunSocket';

// Feature #708: Monitoring page state management hooks
export {
  useMonitoringFilters,
  type MonitoringFiltersState,
  type UseMonitoringFiltersReturn,
} from './useMonitoringFilters';

export {
  useMonitoringModals,
  type MonitoringModalsState,
  type UseMonitoringModalsReturn,
} from './useMonitoringModals';
