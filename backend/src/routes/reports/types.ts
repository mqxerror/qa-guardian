/**
 * Comprehensive Report Types
 * Feature #1732: Unified report data structures combining all test types
 */

// Section types for each test type
export interface E2EReportSection {
  type: 'e2e';
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    avgDuration: number;
  };
  tests: Array<{
    id: string;
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    screenshotUrl?: string;
    videoUrl?: string;
  }>;
}

export interface VisualReportSection {
  type: 'visual';
  summary: {
    total: number;
    noChange: number;
    diffsDetected: number;
    approved: number;
    pending: number;
  };
  comparisons: Array<{
    id: string;
    testName: string;
    viewport: string;
    diffPercentage: number;
    status: 'match' | 'diff' | 'approved' | 'pending';
    baselineUrl?: string;
    actualUrl?: string;
    diffUrl?: string;
  }>;
}

export interface AccessibilityReportSection {
  type: 'accessibility';
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    wcagCompliance: number; // percentage
  };
  violations: Array<{
    id: string;
    rule: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    wcagLevel: string;
    description: string;
    nodes: number;
    helpUrl?: string;
  }>;
}

export interface PerformanceReportSection {
  type: 'performance';
  summary: {
    score: number;
    lcp: number;      // Largest Contentful Paint (ms)
    fid: number;      // First Input Delay (ms)
    cls: number;      // Cumulative Layout Shift
    ttfb: number;     // Time to First Byte (ms)
    fcp: number;      // First Contentful Paint (ms)
    tti: number;      // Time to Interactive (ms)
    speedIndex: number;
  };
  audits: Array<{
    id: string;
    title: string;
    score: number;
    category: string;
    displayValue?: string;
    description?: string;
  }>;
  coreWebVitals: {
    lcp: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    fid: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    cls: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  };
}

export interface LoadReportSection {
  type: 'load';
  summary: {
    vus: number;           // Virtual users
    duration: number;      // Test duration in seconds
    requestsTotal: number;
    requestsFailed: number;
    rps: number;           // Requests per second
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  thresholds: Array<{
    name: string;
    passed: boolean;
    value: string;
    threshold: string;
  }>;
  scenarios: Array<{
    name: string;
    vus: number;
    duration: string;
    rps: number;
    errorRate: number;
  }>;
}

export interface SecurityReportSection {
  type: 'security';
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    riskScore: number; // 0-100
  };
  vulnerabilities: Array<{
    id: string;
    name: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    description: string;
    location?: string;
    cwe?: string;
    remediation?: string;
  }>;
  headers: {
    present: string[];
    missing: string[];
    misconfigured: string[];
  };
}

// Main comprehensive report structure
export interface ComprehensiveReport {
  id: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  createdBy: string;

  // Report metadata
  title: string;
  description?: string;
  period: {
    start: string;
    end: string;
  };

  // Executive summary
  executiveSummary: {
    overallScore: number;           // 0-100
    overallStatus: 'passing' | 'warning' | 'failing';
    highlights: string[];
    criticalIssues: string[];
    recommendations: string[];
  };

  // Test type sections (any can be null if not included)
  sections: {
    e2e?: E2EReportSection;
    visual?: VisualReportSection;
    accessibility?: AccessibilityReportSection;
    performance?: PerformanceReportSection;
    load?: LoadReportSection;
    security?: SecurityReportSection;
  };

  // Metadata
  generatedBy: 'mcp' | 'api' | 'scheduled';
  format: 'html' | 'json' | 'pdf';
  viewUrl: string;
}

// Report generation request
export interface GenerateReportRequest {
  projectId: string;
  title?: string;
  description?: string;
  period?: {
    start: string;
    end: string;
  };
  includeSections?: Array<'e2e' | 'visual' | 'accessibility' | 'performance' | 'load' | 'security'>;
  format?: 'html' | 'json' | 'pdf';
}

// Stored report (minimal for list views)
export interface ReportSummary {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  createdAt: string;
  createdBy: string;
  overallScore: number;
  overallStatus: 'passing' | 'warning' | 'failing';
  sectionTypes: string[];
  viewUrl: string;
}
