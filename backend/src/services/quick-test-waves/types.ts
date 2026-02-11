/**
 * Quick Test Wave Types
 * Feature #672: Shared types extracted from quick-test-runner.ts
 */

import type { Browser, Page, BrowserContext } from 'playwright';

// Feature #579: Browser type for cross-browser Quick Test
export type QuickTestBrowser = 'chromium' | 'firefox' | 'webkit';

export interface QuickTestRequest {
  url: string;
  runId: string;
  orgId: string;
  userId: string;
  // Feature #579: Cross-browser Quick Test (default: chromium)
  browser?: QuickTestBrowser;
}

export interface WaveResult {
  wave: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface QuickTestResult {
  runId: string;
  orgId: string; // Feature #461: Add orgId for IDOR protection
  url: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  waves: WaveResult[];
  summary?: {
    healthScore: number;
    performanceScore: number;
    securityScore: number;
    accessibilityScore: number; // Feature #471
    apiScore: number; // Feature #472
    seoScore: number; // Feature #527
    overallScore: number;
  };
}

// Health Check types
export interface HealthCheckResult {
  dns: {
    resolved: boolean;
    addresses?: string[];
    error?: string;
    durationMs: number;
  };
  http: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    durationMs: number;
    error?: string;
  };
  ssl?: {
    valid: boolean;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    daysUntilExpiry?: number;
    error?: string;
    durationMs: number;
  };
  redirects: Array<{
    from: string;
    to: string;
    status: number;
  }>;
  totalDurationMs: number;
}

// Visual + Performance types
export interface VisualPerformanceResult {
  // Feature #563: Renamed from 'lighthouse' to 'performanceScores' to avoid misleading users.
  // These are custom heuristic scores derived from Core Web Vitals, NOT real Lighthouse audit results.
  performanceScores?: {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
  };
  coreWebVitals?: {
    lcp?: number; // Largest Contentful Paint
    fid?: number; // First Input Delay (deprecated, replaced by INP)
    cls?: number; // Cumulative Layout Shift
    fcp?: number; // First Contentful Paint
    ttfb?: number; // Time to First Byte
    inp?: number; // Feature #564: Interaction to Next Paint (replaced FID in March 2024)
  };
  screenshots: {
    desktop?: string; // Base64 encoded (temporary, before saving to disk)
    mobile?: string;
  };
  // Feature #466: URLs for saved screenshots (set after saving to disk)
  screenshotUrls?: {
    desktop?: string;
    mobile?: string;
  };
  loadTime: number;
}

// Security Scan types
export interface SecurityScanResult {
  headers: {
    score: number;
    missing: string[];
    present: Record<string, string>;
    recommendations: string[];
  };
  cookies: Array<{
    name: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite: string;
    issues: string[];
  }>;
  mixedContent: {
    detected: boolean;
    resources: string[];
  };
  exposedPaths: Array<{
    path: string;
    accessible: boolean;
    status: number;
  }>;
  overallScore: number;
}

// AI Analysis types
// Feature #467: Extended to include source field for vision vs metrics transparency
export interface AIAnalysisResult {
  testSuggestions: Array<{
    type: 'e2e' | 'visual' | 'accessibility' | 'performance';
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    source?: 'vision' | 'metrics'; // Feature #467: Track recommendation source
  }>;
  uxIssues: Array<{
    severity: 'critical' | 'major' | 'minor';
    issue: string;
    recommendation: string;
    source?: 'vision' | 'metrics'; // Feature #467: Track recommendation source
  }>;
  accessibilityRecommendations: Array<{
    recommendation: string;
    source?: 'vision' | 'metrics'; // Feature #467: Track recommendation source
  }> | string[]; // Support both formats for backward compatibility
  summary: string;
  visionAnalysisIncluded?: boolean; // Feature #467: Indicate if vision was used
}

// Feature #471: Accessibility scan result types
export interface AccessibilityScanResult {
  score: number;
  violations: Array<{
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
  }>;
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

// Feature #472: API Discovery scan result types
export interface APIEndpoint {
  path: string;
  method: string;
  status: number;
  statusText: string;
  responseTimeMs: number;
  authRequired: boolean; // true if returns 401/403, false if returns 200 without auth
  isHealthy: boolean;
  contentType?: string;
  errorMessage?: string;
}

export interface APIDiscoveryResult {
  score: number;
  discoveredPaths: string[];
  openAPISpec?: {
    found: boolean;
    url?: string;
    title?: string;
    version?: string;
    endpointCount?: number;
  };
  endpoints: APIEndpoint[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    protected: number; // endpoints requiring auth
    unprotected: number; // endpoints returning 200 without auth
    byMethod: Record<string, number>;
  };
  securityConcerns: Array<{
    type: 'unprotected_sensitive' | 'no_auth_check' | 'exposed_docs';
    path: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

// Feature #527: SEO Analysis result types
export interface SeoMetaTag {
  name: string;
  content: string | null;
  present: boolean;
  valid: boolean;
  issue?: string;
}

export interface SeoAnalysisResult {
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
  schemaMarkup: {
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
  // Feature #529: Navigation Visibility Check
  navigation: {
    hasNavElement: boolean;
    hasHeader: boolean;
    hasFooter: boolean;
    hasBreadcrumbs: boolean;
    hasMobileMenuToggle: boolean;
    navElements: Array<{
      type: 'nav' | 'role-navigation' | 'header' | 'footer' | 'breadcrumb';
      visible: boolean;
      ariaLabel?: string;
    }>;
    issues: string[];
  };
  // Feature #530: Tracking Scripts Detection
  tracking: {
    scripts: Array<{
      name: string;
      type: 'gtm' | 'ga4' | 'fb_pixel' | 'hotjar' | 'linkedin' | 'other';
      id?: string;
      source: 'script_src' | 'window_global' | 'inline';
    }>;
    hasGTM: boolean;
    hasGA4: boolean;
    hasFBPixel: boolean;
    hasHotjar: boolean;
    hasLinkedIn: boolean;
    summary: string;
  };
  issues: string[];
  recommendations: string[];
}

// Wave emitter function type
export type WaveEmitter = {
  emitStart: (wave: number, name: string) => void;
  emitProgress: (wave: number, progress: number, message?: string) => void;
  emitComplete: (wave: number, data: Record<string, unknown>) => void;
  emitError: (wave: number, error: string) => void;
};
