/**
 * Quick Test Types
 * Feature #514: Extracted from QuickTestPage.tsx
 * Shared types used across quick-test components
 */

import type { QuickTestSummary } from '../../hooks/useQuickTestSocket';

// ============================================================
// Wave Types
// ============================================================

export interface WaveStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  result?: string;
}

export interface WaveData {
  wave: number;
  name: string;
  icon: React.ElementType;
  status: 'waiting' | 'running' | 'completed' | 'failed' | 'skipped';
  steps: WaveStep[];
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
  expanded: boolean;
}

// ============================================================
// Result Types
// ============================================================

export interface QuickTestResult {
  runId: string;
  url: string;
  timestamp: Date;
  status: 'running' | 'completed' | 'failed';
  summary?: {
    healthScore: number;
    performanceScore: number;
    securityScore: number;
    overallScore: number;
  };
}

export interface HistoryEntry {
  runId: string;
  url: string;
  timestamp: Date;
  score?: number;
}

// ============================================================
// AI Analysis Types
// ============================================================

export interface TestSuggestion {
  type: string;
  name: string;
  description: string;
  priority: string;
  source?: 'vision' | 'metrics';
}

export interface UXIssue {
  severity: string;
  issue: string;
  recommendation: string;
  source?: 'vision' | 'metrics';
}

export interface AIAnalysisData {
  testSuggestions?: TestSuggestion[];
  uxIssues?: UXIssue[];
  accessibilityRecommendations?: Array<{
    recommendation: string;
    source?: 'vision' | 'metrics';
  }> | string[];
  summary?: string;
  visionAnalysisIncluded?: boolean;
}

// ============================================================
// Accessibility Types (Wave 5)
// ============================================================

export interface AccessibilityViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  wcagTags: string[];
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary?: string;
  }>;
}

export interface AccessibilityData {
  score: number;
  violations: AccessibilityViolation[];
  violationCounts: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    total: number;
  };
  passesCount: number;
  wcagLevel: string;
  axeVersion: string;
}

// ============================================================
// API Discovery Types (Wave 6)
// ============================================================

export interface APIEndpoint {
  path: string;
  method: string;
  status: number;
  statusText: string;
  hasAuth: boolean;
  authType?: string;
}

export interface APIDiscoveryData {
  score: number;
  discoveredPaths: string[];
  openAPISpec?: {
    found: boolean;
    url?: string;
    title?: string;
    version?: string;
    endpointCount?: number;
  };
  endpoints: Array<{
    path: string;
    method: string;
    status: number;
    statusText: string;
    responseTimeMs: number;
    authRequired: boolean;
    isHealthy: boolean;
    contentType?: string;
    errorMessage?: string;
  }>;
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    protected: number;
    unprotected: number;
    byMethod: Record<string, number>;
  };
  securityConcerns: Array<{
    type: string;
    path: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

// ============================================================
// SEO Analysis Types (Wave 7)
// ============================================================

export interface SeoMetaTag {
  name: string;
  content: string | null;
  present: boolean;
  valid: boolean;
  issue?: string;
}

export interface SeoAnalysisData {
  score: number;
  metaTags: {
    title: SeoMetaTag;
    description: SeoMetaTag;
    canonical: SeoMetaTag;
    ogTitle: SeoMetaTag;
    ogDescription: SeoMetaTag;
    ogImage: SeoMetaTag;
    twitterCard: SeoMetaTag;
    twitterTitle: SeoMetaTag;
    twitterDescription: SeoMetaTag;
    viewport: SeoMetaTag;
    robots: SeoMetaTag;
  };
  headingStructure: {
    h1Count: number;
    h1Texts: string[];
    hasMultipleH1: boolean;
    headingHierarchy: Array<{ level: number; text: string }>;
    hierarchyValid: boolean;
    issues: string[];
  };
  crawlability: {
    robotsTxt: {
      present: boolean;
      url: string;
      content?: string;
      allowsCrawling: boolean;
    };
    sitemap: {
      present: boolean;
      url: string;
      urlCount?: number;
    };
  };
  // Feature #528: Schema Markup Detection
  schemaMarkup?: {
    jsonLdScripts: Array<{
      type: string;
      raw: string;
      valid: boolean;
      error?: string;
    }>;
    microdataItems: Array<{
      type: string;
      itemCount: number;
    }>;
    detectedTypes: string[];
    hasStructuredData: boolean;
    issues: string[];
  };
  issues: string[];
  recommendations: string[];
}

// ============================================================
// Modal Types
// ============================================================

export interface ScreenshotModalState {
  isOpen: boolean;
  url: string | null;
  type: 'desktop' | 'mobile' | null;
}

export interface ScheduleModalState {
  isOpen: boolean;
  frequency: '1h' | '6h' | '12h' | '24h' | 'weekly';
  notifyOnDrop: boolean;
  threshold: number;
  isSubmitting: boolean;
  error: string | null;
  success: boolean;
}

export interface CreateTestSuiteModalState {
  isOpen: boolean;
  testSuggestions: TestSuggestion[] | undefined;
}

// ============================================================
// Props Types
// ============================================================

export interface WaveCardProps {
  wave: WaveData;
  onToggleExpand: () => void;
  onScreenshotClick?: (url: string, type: 'desktop' | 'mobile') => void;
  onCreateTestSuite?: (testSuggestions: TestSuggestion[]) => void;
}

export interface ScoreDisplayProps {
  summary: QuickTestSummary | null;
}

export interface ScreenshotModalProps {
  isOpen: boolean;
  url: string | null;
  type: 'desktop' | 'mobile' | null;
  onClose: () => void;
}

export interface ScheduleModalProps {
  isOpen: boolean;
  state: ScheduleModalState;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onUpdateState: (updates: Partial<ScheduleModalState>) => void;
}

export interface CreateTestSuiteModalProps {
  isOpen: boolean;
  testSuggestions: TestSuggestion[] | undefined;
  onClose: () => void;
  targetUrl: string;
  token: string | null;
}

// ============================================================
// Helper Function Types
// ============================================================

export type ScoreColorFn = (score: number) => string;
export type ScoreBgColorFn = (score: number) => string;
