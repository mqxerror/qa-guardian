/**
 * Quick Test Components
 * Feature #514: Extracted from QuickTestPage.tsx
 * Re-exports all quick-test components and utilities
 */

// Types
export * from './types';

// Utilities
export * from './utils';

// Badge components - Feature #521: Thin wrappers around unified Badge with Quick Test styling (xs/rounded)
export { SourceBadge, PriorityBadge, SeverityBadge, ImpactBadge } from './badges';
// Also export types for type safety
export type { SourceType, PriorityType, ImpactType } from '../ui/Badge';

// Modal components
export { CreateTestSuiteModal } from './CreateTestSuiteModal';
export { ScheduleModal } from './ScheduleModal';
export { SaveAsSuiteModal } from './SaveAsSuiteModal'; // Feature #532

// Wave detail components - Feature #514: Extracted from QuickTestPage
// Note: AccessibilityData, APIDiscoveryData, SeoAnalysisData types are exported via './types'
export {
  AIAnalysisDetails,
  AccessibilityDetails,
  APIDiscoveryDetails,
  SeoAnalysisDetails, // Feature #527
} from './WaveDetails';

// WaveCard component - Feature #514: Extracted from QuickTestPage
export { WaveCard } from './WaveCard';
export type { WaveCardProps } from './WaveCard';

// Feature #537: Detailed Report component
export { DetailedReport } from './DetailedReport';

// ScreenshotModal component - Feature #514: Extracted from QuickTestPage
export { ScreenshotModal } from './ScreenshotModal';
export type { ScreenshotModalProps } from './ScreenshotModal';
