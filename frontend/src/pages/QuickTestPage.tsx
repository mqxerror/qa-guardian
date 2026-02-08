/**
 * Quick Test Page
 * Feature #425: Flagship instant QA feature - paste a URL and watch 5 waves of tests run live
 *
 * Features:
 * - URL input with validation
 * - 2x2 wave progress grid with real-time updates
 * - Animated step progression
 * - Overall score display
 * - History panel
 * - Export/save actions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from '../components/Layout';
import { useQuickTestSocket, WaveState, QuickTestSummary } from '../hooks/useQuickTestSocket';
import {
  PageHeader,
  AnimatedCard,
  CardContent,
} from '../components/ui';
import {
  Zap,
  Globe,
  Shield,
  Gauge,
  Brain,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  Save,
  Download,
  AlertCircle,
  Monitor,
  Smartphone,
  X,
  Maximize2,
  Eye,
  BarChart2,
  Lightbulb,
  AlertTriangle,
  Accessibility,
  Network,
  FileJson,
  Lock,
  Unlock,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface WaveStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  result?: string;
}

interface WaveData {
  wave: number;
  name: string;
  icon: React.ElementType;
  status: 'waiting' | 'running' | 'completed' | 'failed';
  steps: WaveStep[];
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
  expanded: boolean;
}

interface QuickTestResult {
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

interface HistoryEntry {
  runId: string;
  url: string;
  timestamp: Date;
  score?: number;
}

// ============================================================
// Constants
// ============================================================

const WAVE_DEFINITIONS = [
  {
    wave: 1,
    name: 'Health Check',
    icon: Globe,
    steps: [
      { name: 'DNS Resolution', status: 'pending' as const },
      { name: 'HTTP Request', status: 'pending' as const },
      { name: 'SSL Certificate', status: 'pending' as const },
      { name: 'Response Time', status: 'pending' as const },
    ],
  },
  {
    wave: 2,
    name: 'Visual + Performance',
    icon: Gauge,
    steps: [
      { name: 'Desktop Screenshot', status: 'pending' as const },
      { name: 'Mobile Screenshot', status: 'pending' as const },
      { name: 'Core Web Vitals', status: 'pending' as const },
      { name: 'Performance Score', status: 'pending' as const },
    ],
  },
  {
    wave: 3,
    name: 'Security Scan',
    icon: Shield,
    steps: [
      { name: 'Security Headers', status: 'pending' as const },
      { name: 'Cookie Audit', status: 'pending' as const },
      { name: 'Mixed Content', status: 'pending' as const },
      { name: 'Exposed Paths', status: 'pending' as const },
    ],
  },
  {
    wave: 4,
    name: 'AI Analysis',
    icon: Brain,
    steps: [
      { name: 'Test Suggestions', status: 'pending' as const },
      { name: 'UX Issues', status: 'pending' as const },
      { name: 'Accessibility', status: 'pending' as const },
      { name: 'Summary', status: 'pending' as const },
    ],
  },
  // Feature #471: Wave 5 - Accessibility Scan
  {
    wave: 5,
    name: 'Accessibility',
    icon: Accessibility,
    steps: [
      { name: 'WCAG 2.1 AA Scan', status: 'pending' as const },
      { name: 'Critical Violations', status: 'pending' as const },
      { name: 'Serious Violations', status: 'pending' as const },
      { name: 'Minor Violations', status: 'pending' as const },
    ],
  },
  // Feature #472: Wave 6 - API Discovery
  {
    wave: 6,
    name: 'API Discovery',
    icon: Network,
    steps: [
      { name: 'OpenAPI Spec Detection', status: 'pending' as const },
      { name: 'Common API Paths', status: 'pending' as const },
      { name: 'Endpoint Health', status: 'pending' as const },
      { name: 'Auth Protection', status: 'pending' as const },
    ],
  },
];

const RECENT_URLS_KEY = 'qa-guardian-quick-test-urls';
const MAX_RECENT_URLS = 5;
const HISTORY_KEY = 'qa-guardian-quick-test-history';
const MAX_HISTORY = 10;

// ============================================================
// Helper Functions
// ============================================================

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-success/20';
  if (score >= 60) return 'bg-warning/20';
  return 'bg-destructive/20';
}

// ============================================================
// Wave Card Component
// ============================================================

interface WaveCardProps {
  wave: WaveData;
  onToggleExpand: () => void;
  // Feature #466: Screenshot click handler
  onScreenshotClick?: (url: string, type: 'desktop' | 'mobile') => void;
}

function WaveCard({ wave, onToggleExpand, onScreenshotClick }: WaveCardProps) {
  const Icon = wave.icon;

  const getStatusStyles = () => {
    switch (wave.status) {
      case 'waiting':
        return 'border-muted bg-muted/10';
      case 'running':
        return 'border-primary bg-primary/10 animate-pulse';
      case 'completed':
        return 'border-success bg-success/10';
      case 'failed':
        return 'border-destructive bg-destructive/10';
      default:
        return 'border-muted bg-muted/10';
    }
  };

  const getStatusIcon = () => {
    switch (wave.status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`rounded-lg border-2 transition-all duration-300 ${getStatusStyles()}`}
    >
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${wave.status === 'running' ? 'bg-primary/20' : 'bg-muted'}`}>
            <Icon className={`w-5 h-5 ${wave.status === 'running' ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{wave.name}</h3>
            <p className="text-xs text-muted-foreground">
              {wave.status === 'waiting' && 'Waiting...'}
              {wave.status === 'running' && 'In progress...'}
              {wave.status === 'completed' && `Completed in ${wave.duration || 0}ms`}
              {wave.status === 'failed' && 'Failed'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {wave.expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {wave.expanded && (
        <div className="px-4 pb-4 space-y-2">
          {wave.steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 px-2 rounded bg-background/50"
            >
              <span className="text-sm text-foreground">{step.name}</span>
              <div className="flex items-center gap-2">
                {step.duration && (
                  <span className="text-xs text-muted-foreground">{step.duration}ms</span>
                )}
                {step.status === 'pending' && (
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                {step.status === 'running' && (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                )}
                {step.status === 'completed' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                )}
                {step.status === 'failed' && (
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                )}
              </div>
            </div>
          ))}
          {/* Feature #466: Screenshot thumbnails for Wave 2 (Visual + Performance) */}
          {wave.wave === 2 && wave.status === 'completed' && wave.data && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground mb-2">Screenshots</div>
              <div className="flex gap-3">
                {/* Desktop Screenshot */}
                {(wave.data as { desktopScreenshotUrl?: string }).desktopScreenshotUrl && (
                  <button
                    onClick={() => onScreenshotClick?.(
                      (wave.data as { desktopScreenshotUrl: string }).desktopScreenshotUrl,
                      'desktop'
                    )}
                    className="group relative rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                  >
                    <img
                      src={(wave.data as { desktopScreenshotUrl: string }).desktopScreenshotUrl}
                      alt="Desktop Screenshot"
                      className="w-32 h-20 object-cover object-top"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                      <div className="flex items-center gap-1 text-white text-xs">
                        <Monitor className="w-3 h-3" />
                        <span>Desktop</span>
                      </div>
                    </div>
                  </button>
                )}
                {/* Mobile Screenshot */}
                {(wave.data as { mobileScreenshotUrl?: string }).mobileScreenshotUrl && (
                  <button
                    onClick={() => onScreenshotClick?.(
                      (wave.data as { mobileScreenshotUrl: string }).mobileScreenshotUrl,
                      'mobile'
                    )}
                    className="group relative rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                  >
                    <img
                      src={(wave.data as { mobileScreenshotUrl: string }).mobileScreenshotUrl}
                      alt="Mobile Screenshot"
                      className="w-16 h-20 object-cover object-top"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                      <div className="flex items-center gap-1 text-white text-xs">
                        <Smartphone className="w-3 h-3" />
                        <span>Mobile</span>
                      </div>
                    </div>
                  </button>
                )}
                {/* No screenshots message */}
                {!(wave.data as { desktopScreenshotUrl?: string }).desktopScreenshotUrl &&
                 !(wave.data as { mobileScreenshotUrl?: string }).mobileScreenshotUrl && (
                  <div className="text-xs text-muted-foreground italic">
                    No screenshots captured
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Feature #467: AI Analysis details for Wave 4 */}
          {wave.wave === 4 && wave.status === 'completed' && wave.data && (
            <AIAnalysisDetails data={wave.data as AIAnalysisData} />
          )}

          {/* Feature #471: Accessibility details for Wave 5 */}
          {wave.wave === 5 && wave.status === 'completed' && wave.data && (
            <AccessibilityDetails data={wave.data as unknown as AccessibilityData} />
          )}

          {/* Feature #472: API Discovery details for Wave 6 */}
          {wave.wave === 6 && wave.status === 'completed' && wave.data && (
            <APIDiscoveryDetails data={wave.data as unknown as APIDiscoveryData} />
          )}

          {wave.error && (
            <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
              {wave.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Feature #467: AI Analysis Details Component
// ============================================================

interface AIAnalysisData {
  testSuggestions?: Array<{
    type: string;
    name: string;
    description: string;
    priority: string;
    source?: 'vision' | 'metrics';
  }>;
  uxIssues?: Array<{
    severity: string;
    issue: string;
    recommendation: string;
    source?: 'vision' | 'metrics';
  }>;
  accessibilityRecommendations?: Array<{
    recommendation: string;
    source?: 'vision' | 'metrics';
  }> | string[];
  summary?: string;
  visionAnalysisIncluded?: boolean;
}

function SourceBadge({ source }: { source?: 'vision' | 'metrics' }) {
  if (source === 'vision') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
        <Eye className="w-3 h-3" />
        Vision
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
      <BarChart2 className="w-3 h-3" />
      Metrics
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-destructive/20 text-destructive',
    medium: 'bg-warning/20 text-warning',
    low: 'bg-success/20 text-success',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs ${colors[priority] || 'bg-muted text-muted-foreground'}`}>
      {priority}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-destructive/20 text-destructive',
    major: 'bg-warning/20 text-warning',
    minor: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs ${colors[severity] || 'bg-muted text-muted-foreground'}`}>
      {severity}
    </span>
  );
}

function AIAnalysisDetails({ data }: { data: AIAnalysisData }) {
  const hasTestSuggestions = data.testSuggestions && data.testSuggestions.length > 0;
  const hasUxIssues = data.uxIssues && data.uxIssues.length > 0;
  const hasAccessibility = data.accessibilityRecommendations && data.accessibilityRecommendations.length > 0;

  if (!hasTestSuggestions && !hasUxIssues && !hasAccessibility && !data.summary) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-4">
      {/* Vision Analysis Indicator */}
      {data.visionAnalysisIncluded && (
        <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
          <Eye className="w-3 h-3" />
          <span>Vision analysis included - AI analyzed the screenshot for visual insights</span>
        </div>
      )}

      {/* Summary */}
      {data.summary && (
        <div className="text-sm text-foreground/80 italic">
          &ldquo;{data.summary}&rdquo;
        </div>
      )}

      {/* Test Suggestions */}
      {hasTestSuggestions && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Lightbulb className="w-3.5 h-3.5" />
            Test Suggestions
          </div>
          <div className="space-y-2">
            {data.testSuggestions!.slice(0, 3).map((suggestion, idx) => (
              <div key={idx} className="p-2 rounded bg-background/50 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground">{suggestion.name}</span>
                  <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">{suggestion.type}</span>
                  <PriorityBadge priority={suggestion.priority} />
                  <SourceBadge source={suggestion.source} />
                </div>
                <div className="text-xs text-muted-foreground">{suggestion.description}</div>
              </div>
            ))}
            {data.testSuggestions!.length > 3 && (
              <div className="text-xs text-muted-foreground text-center">
                +{data.testSuggestions!.length - 3} more suggestions
              </div>
            )}
          </div>
        </div>
      )}

      {/* UX Issues */}
      {hasUxIssues && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            UX Issues
          </div>
          <div className="space-y-2">
            {data.uxIssues!.slice(0, 3).map((issue, idx) => (
              <div key={idx} className="p-2 rounded bg-background/50 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground">{issue.issue}</span>
                  <SeverityBadge severity={issue.severity} />
                  <SourceBadge source={issue.source} />
                </div>
                <div className="text-xs text-muted-foreground">{issue.recommendation}</div>
              </div>
            ))}
            {data.uxIssues!.length > 3 && (
              <div className="text-xs text-muted-foreground text-center">
                +{data.uxIssues!.length - 3} more issues
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accessibility Recommendations */}
      {hasAccessibility && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Accessibility className="w-3.5 h-3.5" />
            Accessibility
          </div>
          <div className="space-y-1.5">
            {data.accessibilityRecommendations!.slice(0, 3).map((rec, idx) => {
              const recText = typeof rec === 'string' ? rec : rec.recommendation;
              const recSource = typeof rec === 'string' ? undefined : rec.source;
              return (
                <div key={idx} className="flex items-start gap-2 p-2 rounded bg-background/50 text-sm">
                  <span className="flex-1 text-foreground/80">{recText}</span>
                  <SourceBadge source={recSource} />
                </div>
              );
            })}
            {data.accessibilityRecommendations!.length > 3 && (
              <div className="text-xs text-muted-foreground text-center">
                +{data.accessibilityRecommendations!.length - 3} more recommendations
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Feature #471: Accessibility Details Component
// ============================================================

interface AccessibilityData {
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

function ImpactBadge({ impact }: { impact: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400',
    serious: 'bg-orange-500/20 text-orange-400',
    moderate: 'bg-yellow-500/20 text-yellow-400',
    minor: 'bg-blue-500/20 text-blue-400',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs ${colors[impact] || 'bg-muted text-muted-foreground'}`}>
      {impact}
    </span>
  );
}

function AccessibilityDetails({ data }: { data: AccessibilityData }) {
  const hasViolations = data.violations && data.violations.length > 0;

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-4">
      {/* Score and Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold ${
            data.score >= 90 ? 'text-success' :
            data.score >= 70 ? 'text-warning' :
            'text-destructive'
          }`}>
            {data.score}
          </div>
          <div className="text-xs text-muted-foreground">
            <div>WCAG {data.wcagLevel} Score</div>
            <div>axe-core v{data.axeVersion}</div>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{data.passesCount} rules passed</div>
          <div>{data.violationCounts.total} violations found</div>
        </div>
      </div>

      {/* Violation Counts */}
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center p-2 rounded bg-red-500/10">
          <div className="text-lg font-bold text-red-400">{data.violationCounts.critical}</div>
          <div className="text-xs text-muted-foreground">Critical</div>
        </div>
        <div className="text-center p-2 rounded bg-orange-500/10">
          <div className="text-lg font-bold text-orange-400">{data.violationCounts.serious}</div>
          <div className="text-xs text-muted-foreground">Serious</div>
        </div>
        <div className="text-center p-2 rounded bg-yellow-500/10">
          <div className="text-lg font-bold text-yellow-400">{data.violationCounts.moderate}</div>
          <div className="text-xs text-muted-foreground">Moderate</div>
        </div>
        <div className="text-center p-2 rounded bg-blue-500/10">
          <div className="text-lg font-bold text-blue-400">{data.violationCounts.minor}</div>
          <div className="text-xs text-muted-foreground">Minor</div>
        </div>
      </div>

      {/* Violations List */}
      {hasViolations && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Violations
          </div>
          <div className="space-y-2">
            {data.violations.slice(0, 5).map((violation, idx) => (
              <div key={idx} className="p-2 rounded bg-background/50 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground">{violation.id}</span>
                  <ImpactBadge impact={violation.impact} />
                  <a
                    href={violation.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs hover:underline ml-auto"
                  >
                    Learn more
                  </a>
                </div>
                <div className="text-xs text-muted-foreground mb-1">{violation.help}</div>
                <div className="text-xs text-muted-foreground/80 italic">
                  {violation.nodes.length} element{violation.nodes.length !== 1 ? 's' : ''} affected
                </div>
              </div>
            ))}
            {data.violations.length > 5 && (
              <div className="text-xs text-muted-foreground text-center">
                +{data.violations.length - 5} more violations
              </div>
            )}
          </div>
        </div>
      )}

      {/* No violations message */}
      {!hasViolations && (
        <div className="flex items-center gap-2 text-success text-sm">
          <CheckCircle2 className="w-4 h-4" />
          No accessibility violations detected
        </div>
      )}
    </div>
  );
}

// ============================================================
// Feature #472: API Discovery Details Component
// ============================================================

interface APIDiscoveryData {
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

function APIDiscoveryDetails({ data }: { data: APIDiscoveryData }) {
  const hasEndpoints = data.endpoints && data.endpoints.length > 0;
  const hasConcerns = data.securityConcerns && data.securityConcerns.length > 0;

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-4">
      {/* Score and Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold ${
            data.score >= 80 ? 'text-success' :
            data.score >= 60 ? 'text-warning' :
            'text-destructive'
          }`}>
            {data.score}
          </div>
          <div className="text-xs text-muted-foreground">
            <div>API Discovery Score</div>
            <div>{data.discoveredPaths.length} paths discovered</div>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{data.summary.healthy} healthy / {data.summary.total} total</div>
          <div>{data.summary.protected} protected endpoints</div>
        </div>
      </div>

      {/* OpenAPI Spec Info */}
      {data.openAPISpec?.found && (
        <div className="flex items-center gap-2 text-xs text-success bg-success/10 px-2 py-1.5 rounded">
          <FileJson className="w-3.5 h-3.5" />
          <span>
            OpenAPI Spec Found: {data.openAPISpec.title} v{data.openAPISpec.version}
            ({data.openAPISpec.endpointCount} endpoints)
          </span>
        </div>
      )}

      {/* Endpoint Summary */}
      {data.summary.total > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded bg-success/10">
            <div className="text-lg font-bold text-success">{data.summary.healthy}</div>
            <div className="text-xs text-muted-foreground">Healthy</div>
          </div>
          <div className="text-center p-2 rounded bg-destructive/10">
            <div className="text-lg font-bold text-destructive">{data.summary.unhealthy}</div>
            <div className="text-xs text-muted-foreground">Unhealthy</div>
          </div>
          <div className="text-center p-2 rounded bg-blue-500/10">
            <div className="text-lg font-bold text-blue-400">{data.summary.protected}</div>
            <div className="text-xs text-muted-foreground">Protected</div>
          </div>
          <div className="text-center p-2 rounded bg-warning/10">
            <div className="text-lg font-bold text-warning">{data.summary.unprotected}</div>
            <div className="text-xs text-muted-foreground">Unprotected</div>
          </div>
        </div>
      )}

      {/* Security Concerns */}
      {hasConcerns && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-destructive mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Security Concerns ({data.securityConcerns.length})
          </div>
          <div className="space-y-2">
            {data.securityConcerns.slice(0, 3).map((concern, idx) => (
              <div key={idx} className="p-2 rounded bg-destructive/10 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground">{concern.path}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    concern.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                    concern.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {concern.severity}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{concern.description}</div>
              </div>
            ))}
            {data.securityConcerns.length > 3 && (
              <div className="text-xs text-muted-foreground text-center">
                +{data.securityConcerns.length - 3} more concerns
              </div>
            )}
          </div>
        </div>
      )}

      {/* Endpoints List */}
      {hasEndpoints && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Network className="w-3.5 h-3.5" />
            Discovered Endpoints
          </div>
          <div className="space-y-1.5">
            {data.endpoints.slice(0, 6).map((endpoint, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                    endpoint.method === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                    endpoint.method === 'POST' ? 'bg-green-500/20 text-green-400' :
                    endpoint.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                    endpoint.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {endpoint.method}
                  </span>
                  <span className="font-mono text-foreground truncate max-w-[150px]" title={endpoint.path}>
                    {endpoint.path}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {endpoint.authRequired ? (
                    <span title="Auth Required">
                      <Lock className="w-3.5 h-3.5 text-blue-400" />
                    </span>
                  ) : (
                    <span title="No Auth">
                      <Unlock className="w-3.5 h-3.5 text-warning" />
                    </span>
                  )}
                  <span className={`text-xs ${
                    endpoint.isHealthy ? 'text-success' : 'text-destructive'
                  }`}>
                    {endpoint.status || '—'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {endpoint.responseTimeMs}ms
                  </span>
                </div>
              </div>
            ))}
            {data.endpoints.length > 6 && (
              <div className="text-xs text-muted-foreground text-center">
                +{data.endpoints.length - 6} more endpoints
              </div>
            )}
          </div>
        </div>
      )}

      {/* No endpoints message */}
      {!hasEndpoints && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Network className="w-4 h-4" />
          No API endpoints discovered
        </div>
      )}
    </div>
  );
}

// ============================================================
// Screenshot Modal Component
// ============================================================

interface ScreenshotModalProps {
  isOpen: boolean;
  url: string | null;
  type: 'desktop' | 'mobile' | null;
  onClose: () => void;
}

function ScreenshotModal({ isOpen, url, type, onClose }: ScreenshotModalProps) {
  if (!isOpen || !url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        {/* Type label */}
        <div className="absolute -top-10 left-0 flex items-center gap-2 text-white text-sm">
          {type === 'desktop' ? (
            <>
              <Monitor className="w-4 h-4" />
              <span>Desktop Screenshot</span>
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4" />
              <span>Mobile Screenshot</span>
            </>
          )}
        </div>
        {/* Image */}
        <img
          src={url}
          alt={`${type} Screenshot`}
          className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

// ============================================================
// Score Display Component
// ============================================================

interface ScoreDisplayProps {
  summary: QuickTestResult['summary'];
}

function ScoreDisplay({ summary }: ScoreDisplayProps) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Health', score: summary.healthScore },
        { label: 'Performance', score: summary.performanceScore },
        { label: 'Security', score: summary.securityScore },
        { label: 'Overall', score: summary.overallScore },
      ].map((item, idx) => (
        <div
          key={idx}
          className={`p-4 rounded-lg ${getScoreBgColor(item.score)} text-center`}
        >
          <div className={`text-3xl font-bold ${getScoreColor(item.score)}`}>
            {item.score}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function QuickTestPage() {
  // Feature #441: Use the useQuickTestSocket hook for real-time updates
  const {
    runId: currentRunId,
    url: testingUrl,
    status: testStatus,
    waves: hookWaves,
    summary,
    isConnected,
    startTest: hookStartTest,
    reset: resetTest,
  } = useQuickTestSocket();

  // URL Input State
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [showRecentUrls, setShowRecentUrls] = useState(false);

  // UI State for wave expansion (not managed by hook)
  const [waveExpanded, setWaveExpanded] = useState<Record<number, boolean>>({});

  // History State
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Feature #466: Screenshot modal state
  const [screenshotModal, setScreenshotModal] = useState<{
    isOpen: boolean;
    url: string | null;
    type: 'desktop' | 'mobile' | null;
  }>({ isOpen: false, url: null, type: null });

  // Refs
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Derive running state from hook
  const isRunning = testStatus === 'running';

  // Merge hook waves with local UI state (expanded) and icons
  const waves: WaveData[] = hookWaves.map((w, idx) => ({
    ...w,
    icon: WAVE_DEFINITIONS[idx]?.icon || Globe,
    expanded: waveExpanded[w.wave] || false,
  }));

  // Create result object from hook state
  const result: QuickTestResult | null = currentRunId ? {
    runId: currentRunId,
    url: testingUrl || '',
    timestamp: new Date(),
    status: testStatus === 'completed' ? 'completed' : testStatus === 'failed' ? 'failed' : 'running',
    summary: summary || undefined,
  } : null;

  // Load recent URLs and history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_URLS_KEY);
      if (saved) {
        setRecentUrls(JSON.parse(saved));
      }
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory).map((h: HistoryEntry) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        })));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Update history when test completes
  useEffect(() => {
    if (testStatus === 'completed' && currentRunId && testingUrl && summary) {
      const newEntry: HistoryEntry = {
        runId: currentRunId,
        url: testingUrl,
        timestamp: new Date(),
        score: summary.overallScore,
      };
      setHistory(prevHistory => {
        const updated = [newEntry, ...prevHistory.filter(h => h.runId !== newEntry.runId)].slice(0, MAX_HISTORY);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        } catch {
          // Ignore localStorage errors
        }
        return updated;
      });
    }
  }, [testStatus, currentRunId, testingUrl, summary]);

  // Start test using the hook
  const startTest = useCallback(async () => {
    // Validate URL
    if (!url.trim()) {
      setUrlError('Please enter a URL');
      return;
    }

    let testUrl = url.trim();
    // Add https:// if no protocol
    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
      testUrl = `https://${testUrl}`;
      setUrl(testUrl);
    }

    if (!isValidUrl(testUrl)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setUrlError(null);
    setWaveExpanded({}); // Reset expansions

    // Save to recent URLs
    setRecentUrls(prev => {
      const updated = [testUrl, ...prev.filter(u => u !== testUrl)].slice(0, MAX_RECENT_URLS);
      try {
        localStorage.setItem(RECENT_URLS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });

    // Use hook's startTest function
    const result = await hookStartTest(testUrl);
    if ('error' in result) {
      setUrlError(result.error);
    }
  }, [url, hookStartTest]);

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isRunning) {
      startTest();
    }
  };

  // Toggle wave expansion - uses local UI state since hook doesn't manage expansion
  const toggleWaveExpand = (waveIndex: number) => {
    const waveNum = waves[waveIndex]?.wave;
    if (waveNum) {
      setWaveExpanded(prev => ({
        ...prev,
        [waveNum]: !prev[waveNum],
      }));
    }
  };

  // Select from history
  const selectFromHistory = (entry: HistoryEntry) => {
    setUrl(entry.url);
    setShowHistory(false);
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Quick Test"
          description="Instant URL analysis with 6 parallel test waves"
          breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Quick Test' }]}
        />

        {/* URL Input Section */}
        <AnimatedCard>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    ref={urlInputRef}
                    type="text"
                    value={url}
                    onChange={e => {
                      setUrl(e.target.value);
                      setUrlError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowRecentUrls(true)}
                    onBlur={() => setTimeout(() => setShowRecentUrls(false), 200)}
                    placeholder="https://example.com"
                    className={`w-full px-4 py-3 rounded-lg bg-muted border text-lg font-mono
                      ${urlError ? 'border-destructive' : 'border-border'}
                      focus:outline-none focus:ring-2 focus:ring-primary
                      placeholder:text-muted-foreground`}
                    disabled={isRunning}
                  />

                  {/* Recent URLs Dropdown */}
                  {showRecentUrls && recentUrls.length > 0 && !isRunning && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-10">
                      <div className="p-2 text-xs text-muted-foreground border-b border-border">
                        Recent URLs
                      </div>
                      {recentUrls.map((recentUrl, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setUrl(recentUrl);
                            setShowRecentUrls(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm font-mono hover:bg-muted transition-colors"
                        >
                          {recentUrl}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={startTest}
                  disabled={isRunning || !isConnected}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium
                    hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center gap-2 transition-colors"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Test
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-3 py-3 bg-muted text-muted-foreground rounded-lg
                    hover:bg-muted/80 transition-colors"
                  title="History"
                >
                  <History className="w-5 h-5" />
                </button>
              </div>

              {urlError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {urlError}
                </div>
              )}

              {!isConnected && (
                <div className="flex items-center gap-2 text-warning text-sm">
                  <AlertCircle className="w-4 h-4" />
                  WebSocket disconnected - reconnecting...
                </div>
              )}
            </div>
          </CardContent>
        </AnimatedCard>

        {/* 4-Wave Progress Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {waves.map((wave, idx) => (
            <WaveCard
              key={wave.wave}
              wave={wave}
              onToggleExpand={() => toggleWaveExpand(idx)}
              onScreenshotClick={(url, type) => setScreenshotModal({ isOpen: true, url, type })}
            />
          ))}
        </div>

        {/* Results Section */}
        {result?.summary && (
          <AnimatedCard>
            <CardContent className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-foreground">Results</h2>
              <ScoreDisplay summary={result.summary} />

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg
                    hover:bg-muted/80 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg
                    hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save to Project
                </button>
              </div>
            </CardContent>
          </AnimatedCard>
        )}

        {/* History Panel */}
        {showHistory && history.length > 0 && (
          <AnimatedCard>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Recent Tests</h2>
              <div className="space-y-2">
                {history.map(entry => (
                  <button
                    key={entry.runId}
                    onClick={() => selectFromHistory(entry)}
                    className="w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors
                      flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-mono text-foreground truncate max-w-[300px]">
                          {entry.url}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {entry.score !== undefined && (
                      <div className={`text-lg font-bold ${getScoreColor(entry.score)}`}>
                        {entry.score}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </AnimatedCard>
        )}
      </div>

      {/* Feature #466: Screenshot Modal */}
      <ScreenshotModal
        isOpen={screenshotModal.isOpen}
        url={screenshotModal.url}
        type={screenshotModal.type}
        onClose={() => setScreenshotModal({ isOpen: false, url: null, type: null })}
      />
    </Layout>
  );
}

export default QuickTestPage;
