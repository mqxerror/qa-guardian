/**
 * Metrics components barrel file
 * Feature #103: Extracted from MetricsTab.tsx
 */

// Core Web Vitals
export { CoreWebVitalsSection } from './CoreWebVitalsSection';

// K6 Load Test
export { K6ResultCard } from './K6ResultCard';
export type { K6ResultCardProps } from './K6ResultCard';

// Lighthouse Result Card
export { LighthouseResultCard } from './LighthouseResultCard';
export type { LighthouseResultCardProps } from './LighthouseResultCard';

// Lighthouse Tab Components
export {
  LighthouseOverviewTab,
  LighthousePerformanceTab,
  LighthouseAccessibilityTab,
  LighthouseBestPracticesTab,
  LighthouseSEOTab,
} from './LighthouseTabs';

// Shared Sections
export {
  FilmstripSection,
  OpportunitiesSection,
  DiagnosticsSection,
  SecurityInsightsSection,
} from './LighthouseSharedSections';
