/**
 * Test Results Components
 * Feature #46: Modular test results page
 */

// Types
export * from './types';

// Utilities
export * from './utils';

// Components
export { default as ExecutiveSummary } from './ExecutiveSummary';
export { default as SummaryCards } from './SummaryCards';
export { default as TabNavigation } from './TabNavigation';
export { default as AccessibilityTab } from './AccessibilityTab';
export { default as TimelineTab } from './TimelineTab';
export { default as VisualTab } from './VisualTab';
export { default as ResultsTab } from './ResultsTab';
export { default as LogsTab } from './LogsTab';
export { default as ScreenshotsTab } from './ScreenshotsTab';
export { default as CircularGauge } from './CircularGauge';
export { default as NetworkTab } from './NetworkTab';
export { default as MetricsTab } from './MetricsTab';

// Re-export ScreenshotItem type for convenience
export type { ScreenshotItem, ScreenshotsTabProps } from './ScreenshotsTab';

// Re-export TimelineTab types for convenience
export type { ComputedStep, SelectedScreenshot, TimelineTabProps } from './TimelineTab';

// PDF Export utilities
export { exportK6ResultsPDF, exportLighthousePDF } from './pdfExport';
export type { K6LoadTestData } from './pdfExport';

// Report generation utilities (Feature #46: Extracted from TestRunResultPage)
export {
  generatePdfReport,
  generateHtmlReport,
  escapeHtml,
  type PdfReportParams,
  type HtmlReportParams,
} from './reportGenerators';

// Modular components extracted in Feature #46 Phase 2
export { default as ExportModal } from './ExportModal';
export type { ExportModalProps } from './ExportModal';

export { default as BatchAnalysisModal } from './BatchAnalysisModal';
export type { BatchAnalysisModalProps } from './BatchAnalysisModal';

export { default as LiveExecutionView } from './LiveExecutionView';
export type { LiveExecutionViewProps } from './LiveExecutionView';

export { default as ComparisonPanel } from './ComparisonPanel';
export type { ComparisonPanelProps } from './ComparisonPanel';
