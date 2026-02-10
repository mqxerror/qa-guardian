/**
 * Feature #537: Detailed Report Component
 * Shows a full breakdown of all Quick Test wave results in a structured,
 * collapsible format below the score section.
 *
 * Covers all 7 waves:
 * - Wave 1: Health (DNS, HTTP, SSL, redirects)
 * - Wave 2: Performance (CWV, Lighthouse scores)
 * - Wave 3: Security (headers, cookies, mixed content, exposed paths)
 * - Wave 4: AI Analysis (reuses AIAnalysisDetails)
 * - Wave 5: Accessibility (reuses AccessibilityDetails)
 * - Wave 6: API Discovery (reuses APIDiscoveryDetails)
 * - Wave 7: SEO (reuses SeoAnalysisDetails)
 */

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Gauge,
  Shield,
  Brain,
  Accessibility,
  Network,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Timer,
  Wifi,
  FileWarning,
  Cookie,
  Eye,
} from 'lucide-react';
import {
  AIAnalysisDetails,
  AccessibilityDetails,
  APIDiscoveryDetails,
  SeoAnalysisDetails,
} from './WaveDetails';
import type {
  WaveData,
  AIAnalysisData,
  AccessibilityData,
  APIDiscoveryData,
  SeoAnalysisData,
} from './types';

// ============================================================
// Types
// ============================================================

interface DetailedReportProps {
  waves: WaveData[];
}

interface ReportSectionProps {
  title: string;
  icon: React.ElementType;
  status: WaveData['status'];
  duration?: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

// ============================================================
// Collapsible Section Wrapper
// ============================================================

function ReportSection({ title, icon: Icon, status, duration, defaultExpanded = false, children }: ReportSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isComplete = status === 'completed';
  const isFailed = status === 'failed';
  const isSkipped = status === 'skipped';

  if (!isComplete && !isFailed && !isSkipped) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium text-foreground">{title}</span>
          {isComplete && (
            <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">Completed</span>
          )}
          {isFailed && (
            <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">Failed</span>
          )}
          {isSkipped && (
            <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full">Skipped</span>
          )}
          {duration && (
            <span className="text-xs text-muted-foreground">{duration}ms</span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Wave 1: Health Check Details
// ============================================================

function HealthCheckDetails({ data }: { data: Record<string, unknown> }) {
  const dns = data.dns as { resolved?: boolean; addresses?: string[]; durationMs?: number; error?: string } | undefined;
  const http = data.http as { status?: number; statusText?: string; durationMs?: number; headers?: Record<string, string>; error?: string } | undefined;
  const ssl = data.ssl as { valid?: boolean; issuer?: string; validFrom?: string; validTo?: string; daysUntilExpiry?: number; durationMs?: number; error?: string } | undefined;
  const redirects = data.redirects as Array<{ from?: string; to?: string; status?: number }> | undefined;

  return (
    <div className="space-y-4 pt-4">
      {/* DNS Resolution */}
      {dns && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Wifi className="w-3.5 h-3.5" />
            DNS Resolution
          </div>
          <div className="p-3 rounded bg-background/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {dns.resolved ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span className="text-sm text-foreground">
                  {dns.resolved ? 'Resolved successfully' : 'Failed to resolve'}
                </span>
              </div>
              {dns.durationMs !== undefined && (
                <span className="text-xs text-muted-foreground">{dns.durationMs}ms</span>
              )}
            </div>
            {dns.addresses && dns.addresses.length > 0 && (
              <div className="text-xs text-muted-foreground font-mono">
                {dns.addresses.join(', ')}
              </div>
            )}
            {dns.error && (
              <div className="text-xs text-destructive">{dns.error}</div>
            )}
          </div>
        </div>
      )}

      {/* HTTP Response */}
      {http && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Globe className="w-3.5 h-3.5" />
            HTTP Response
          </div>
          <div className="p-3 rounded bg-background/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {http.status && http.status >= 200 && http.status < 400 ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span className="text-sm text-foreground">
                  {http.status} {http.statusText}
                </span>
              </div>
              {http.durationMs !== undefined && (
                <span className="text-xs text-muted-foreground">{http.durationMs}ms</span>
              )}
            </div>
            {http.error && (
              <div className="text-xs text-destructive">{http.error}</div>
            )}
          </div>
        </div>
      )}

      {/* SSL/TLS */}
      {ssl && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Lock className="w-3.5 h-3.5" />
            SSL/TLS Certificate
          </div>
          <div className="p-3 rounded bg-background/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {ssl.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span className="text-sm text-foreground">
                  {ssl.valid ? 'Valid certificate' : 'Invalid certificate'}
                </span>
              </div>
              {ssl.durationMs !== undefined && (
                <span className="text-xs text-muted-foreground">{ssl.durationMs}ms</span>
              )}
            </div>
            {ssl.issuer && (
              <div className="text-xs text-muted-foreground">Issuer: {ssl.issuer}</div>
            )}
            {ssl.daysUntilExpiry !== undefined && (
              <div className={`text-xs ${ssl.daysUntilExpiry < 30 ? 'text-warning' : 'text-muted-foreground'}`}>
                Expires in {ssl.daysUntilExpiry} days
                {ssl.validTo && ` (${new Date(ssl.validTo).toLocaleDateString()})`}
              </div>
            )}
            {ssl.error && (
              <div className="text-xs text-destructive">{ssl.error}</div>
            )}
          </div>
        </div>
      )}

      {/* Redirects */}
      {redirects && redirects.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Redirects ({redirects.length})
          </div>
          <div className="space-y-1.5">
            {redirects.map((redirect, idx) => (
              <div key={idx} className="p-2 rounded bg-background/50 text-xs font-mono">
                <span className="text-warning">{redirect.status}</span>
                {' '}
                <span className="text-muted-foreground truncate">{redirect.from}</span>
                {' → '}
                <span className="text-foreground truncate">{redirect.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Wave 2: Performance Details
// ============================================================

function PerformanceDetails({ data }: { data: Record<string, unknown> }) {
  // Feature #563: Renamed from 'lighthouse' to 'performanceScores' - these are custom heuristic scores, not real Lighthouse
  const performanceScores = (data.performanceScores || data.lighthouse) as { performance?: number; accessibility?: number; seo?: number; bestPractices?: number } | undefined;
  const cwv = data.coreWebVitals as { lcp?: number; fid?: number; cls?: number; fcp?: number; ttfb?: number } | undefined;
  const loadTime = data.loadTime as number | undefined;

  // CWV thresholds per Google
  const cwvStatus = (metric: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
    switch (metric) {
      case 'lcp': return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
      case 'fid': return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
      case 'cls': return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
      case 'fcp': return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
      case 'ttfb': return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
      default: return 'good';
    }
  };

  const statusColor = (status: 'good' | 'needs-improvement' | 'poor') => {
    switch (status) {
      case 'good': return 'text-success';
      case 'needs-improvement': return 'text-warning';
      case 'poor': return 'text-destructive';
    }
  };

  const statusBg = (status: 'good' | 'needs-improvement' | 'poor') => {
    switch (status) {
      case 'good': return 'bg-success/10';
      case 'needs-improvement': return 'bg-warning/10';
      case 'poor': return 'bg-destructive/10';
    }
  };

  const statusLabel = (status: 'good' | 'needs-improvement' | 'poor') => {
    switch (status) {
      case 'good': return 'Good';
      case 'needs-improvement': return 'Needs Improvement';
      case 'poor': return 'Poor';
    }
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Load Time */}
      {loadTime !== undefined && (
        <div className="flex items-center gap-2 p-3 rounded bg-background/50">
          <Timer className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">Page Load Time:</span>
          <span className={`text-sm font-bold ${
            loadTime < 3000 ? 'text-success' :
            loadTime < 5000 ? 'text-warning' :
            'text-destructive'
          }`}>
            {(loadTime / 1000).toFixed(2)}s
          </span>
        </div>
      )}

      {/* Feature #563: Renamed from "Lighthouse Scores" to "Performance Scores" - these are heuristic, not real Lighthouse */}
      {performanceScores && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Gauge className="w-3.5 h-3.5" />
            Performance Scores
            <span className="text-[10px] opacity-60">(heuristic)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {performanceScores.performance !== undefined && (
              <div className="text-center p-3 rounded bg-background/50">
                <div className={`text-xl font-bold ${
                  performanceScores.performance >= 90 ? 'text-success' :
                  performanceScores.performance >= 50 ? 'text-warning' :
                  'text-destructive'
                }`}>
                  {performanceScores.performance}
                </div>
                <div className="text-xs text-muted-foreground">Performance</div>
              </div>
            )}
            {performanceScores.accessibility !== undefined && performanceScores.accessibility > 0 && (
              <div className="text-center p-3 rounded bg-background/50">
                <div className={`text-xl font-bold ${
                  performanceScores.accessibility >= 90 ? 'text-success' :
                  performanceScores.accessibility >= 50 ? 'text-warning' :
                  'text-destructive'
                }`}>
                  {performanceScores.accessibility}
                </div>
                <div className="text-xs text-muted-foreground">Accessibility</div>
              </div>
            )}
            {performanceScores.bestPractices !== undefined && performanceScores.bestPractices > 0 && (
              <div className="text-center p-3 rounded bg-background/50">
                <div className={`text-xl font-bold ${
                  performanceScores.bestPractices >= 90 ? 'text-success' :
                  performanceScores.bestPractices >= 50 ? 'text-warning' :
                  'text-destructive'
                }`}>
                  {performanceScores.bestPractices}
                </div>
                <div className="text-xs text-muted-foreground">Best Practices</div>
              </div>
            )}
            {performanceScores.seo !== undefined && performanceScores.seo > 0 && (
              <div className="text-center p-3 rounded bg-background/50">
                <div className={`text-xl font-bold ${
                  performanceScores.seo >= 90 ? 'text-success' :
                  performanceScores.seo >= 50 ? 'text-warning' :
                  'text-destructive'
                }`}>
                  {performanceScores.seo}
                </div>
                <div className="text-xs text-muted-foreground">SEO</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Core Web Vitals */}
      {cwv && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Eye className="w-3.5 h-3.5" />
            Core Web Vitals
          </div>
          <div className="space-y-2">
            {cwv.lcp !== undefined && (() => {
              const status = cwvStatus('lcp', cwv.lcp);
              return (
                <div className={`flex items-center justify-between p-2.5 rounded ${statusBg(status)}`}>
                  <div>
                    <div className="text-sm font-medium text-foreground">LCP (Largest Contentful Paint)</div>
                    <div className="text-xs text-muted-foreground">Target: ≤ 2.5s</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${statusColor(status)}`}>
                      {(cwv.lcp / 1000).toFixed(2)}s
                    </div>
                    <div className={`text-xs ${statusColor(status)}`}>{statusLabel(status)}</div>
                  </div>
                </div>
              );
            })()}
            {cwv.fcp !== undefined && (() => {
              const status = cwvStatus('fcp', cwv.fcp);
              return (
                <div className={`flex items-center justify-between p-2.5 rounded ${statusBg(status)}`}>
                  <div>
                    <div className="text-sm font-medium text-foreground">FCP (First Contentful Paint)</div>
                    <div className="text-xs text-muted-foreground">Target: ≤ 1.8s</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${statusColor(status)}`}>
                      {(cwv.fcp / 1000).toFixed(2)}s
                    </div>
                    <div className={`text-xs ${statusColor(status)}`}>{statusLabel(status)}</div>
                  </div>
                </div>
              );
            })()}
            {cwv.cls !== undefined && (() => {
              const status = cwvStatus('cls', cwv.cls);
              return (
                <div className={`flex items-center justify-between p-2.5 rounded ${statusBg(status)}`}>
                  <div>
                    <div className="text-sm font-medium text-foreground">CLS (Cumulative Layout Shift)</div>
                    <div className="text-xs text-muted-foreground">Target: ≤ 0.1</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${statusColor(status)}`}>
                      {cwv.cls.toFixed(3)}
                    </div>
                    <div className={`text-xs ${statusColor(status)}`}>{statusLabel(status)}</div>
                  </div>
                </div>
              );
            })()}
            {cwv.ttfb !== undefined && (() => {
              const status = cwvStatus('ttfb', cwv.ttfb);
              return (
                <div className={`flex items-center justify-between p-2.5 rounded ${statusBg(status)}`}>
                  <div>
                    <div className="text-sm font-medium text-foreground">TTFB (Time to First Byte)</div>
                    <div className="text-xs text-muted-foreground">Target: ≤ 800ms</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${statusColor(status)}`}>
                      {cwv.ttfb < 1000 ? `${cwv.ttfb}ms` : `${(cwv.ttfb / 1000).toFixed(2)}s`}
                    </div>
                    <div className={`text-xs ${statusColor(status)}`}>{statusLabel(status)}</div>
                  </div>
                </div>
              );
            })()}
            {cwv.fid !== undefined && (() => {
              const status = cwvStatus('fid', cwv.fid);
              return (
                <div className={`flex items-center justify-between p-2.5 rounded ${statusBg(status)}`}>
                  <div>
                    <div className="text-sm font-medium text-foreground">FID (First Input Delay)</div>
                    <div className="text-xs text-muted-foreground">Target: ≤ 100ms</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${statusColor(status)}`}>
                      {cwv.fid}ms
                    </div>
                    <div className={`text-xs ${statusColor(status)}`}>{statusLabel(status)}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Wave 3: Security Details
// ============================================================

function SecurityDetails({ data }: { data: Record<string, unknown> }) {
  const headers = data.headers as {
    score?: number;
    missing?: string[];
    present?: Record<string, string>;
    recommendations?: string[];
  } | undefined;
  const cookies = data.cookies as Array<{
    name?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: string;
    issues?: string[];
  }> | undefined;
  const mixedContent = data.mixedContent as { detected?: boolean; resources?: string[] } | undefined;
  const exposedPaths = data.exposedPaths as Array<{ path?: string; accessible?: boolean; status?: number }> | undefined;

  return (
    <div className="space-y-4 pt-4">
      {/* Security Headers */}
      {headers && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Shield className="w-3.5 h-3.5" />
            Security Headers {headers.score !== undefined && (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                headers.score >= 80 ? 'bg-success/10 text-success' :
                headers.score >= 50 ? 'bg-warning/10 text-warning' :
                'bg-destructive/10 text-destructive'
              }`}>
                {headers.score}/100
              </span>
            )}
          </div>

          {/* Present Headers */}
          {headers.present && Object.keys(headers.present).length > 0 && (
            <div className="space-y-1 mb-2">
              {Object.entries(headers.present).map(([name, value]) => (
                <div key={name} className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    <span className="font-mono text-foreground text-xs">{name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={value}>
                    {value.length > 50 ? value.substring(0, 50) + '…' : value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Missing Headers */}
          {headers.missing && headers.missing.length > 0 && (
            <div className="space-y-1">
              {headers.missing.map((header) => (
                <div key={header} className="flex items-center gap-2 p-2 rounded bg-destructive/5 text-sm">
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                  <span className="font-mono text-foreground text-xs">{header}</span>
                  <span className="text-xs text-destructive ml-auto">Missing</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {headers.recommendations && headers.recommendations.length > 0 && (
            <div className="mt-2 space-y-1">
              {headers.recommendations.slice(0, 3).map((rec, idx) => (
                <div key={idx} className="p-2 rounded bg-warning/5 text-xs text-foreground/80">
                  {rec}
                </div>
              ))}
              {headers.recommendations.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{headers.recommendations.length - 3} more recommendations
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cookies */}
      {cookies && cookies.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Cookie className="w-3.5 h-3.5" />
            Cookies ({cookies.length})
          </div>
          <div className="space-y-1.5">
            {cookies.slice(0, 5).map((cookie, idx) => (
              <div key={idx} className="p-2 rounded bg-background/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-foreground">{cookie.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${cookie.secure ? 'text-success' : 'text-warning'}`}>
                      {cookie.secure ? '🔒 Secure' : '⚠️ Not Secure'}
                    </span>
                    <span className={`text-xs ${cookie.httpOnly ? 'text-success' : 'text-warning'}`}>
                      {cookie.httpOnly ? 'HttpOnly' : 'JS accessible'}
                    </span>
                  </div>
                </div>
                {cookie.sameSite && (
                  <span className="text-xs text-muted-foreground">SameSite: {cookie.sameSite}</span>
                )}
                {cookie.issues && cookie.issues.length > 0 && (
                  <div className="text-xs text-warning mt-1">{cookie.issues.join('; ')}</div>
                )}
              </div>
            ))}
            {cookies.length > 5 && (
              <div className="text-xs text-muted-foreground text-center">
                +{cookies.length - 5} more cookies
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mixed Content */}
      {mixedContent && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <FileWarning className="w-3.5 h-3.5" />
            Mixed Content
          </div>
          <div className="p-3 rounded bg-background/50">
            {mixedContent.detected ? (
              <div>
                <div className="flex items-center gap-2 text-destructive text-sm mb-2">
                  <XCircle className="w-4 h-4" />
                  Mixed content detected
                </div>
                {mixedContent.resources && mixedContent.resources.length > 0 && (
                  <div className="space-y-1">
                    {mixedContent.resources.slice(0, 3).map((resource, idx) => (
                      <div key={idx} className="text-xs font-mono text-muted-foreground truncate">
                        {resource}
                      </div>
                    ))}
                    {mixedContent.resources.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{mixedContent.resources.length - 3} more resources
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-success text-sm">
                <CheckCircle2 className="w-4 h-4" />
                No mixed content detected
              </div>
            )}
          </div>
        </div>
      )}

      {/* Exposed Paths */}
      {exposedPaths && exposedPaths.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Exposed Paths
          </div>
          <div className="space-y-1">
            {exposedPaths.slice(0, 5).map((path, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
                <span className="font-mono text-xs text-foreground">{path.path}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${path.accessible ? 'text-warning' : 'text-success'}`}>
                    {path.accessible ? 'Accessible' : 'Blocked'}
                  </span>
                  <span className="text-xs text-muted-foreground">{path.status}</span>
                </div>
              </div>
            ))}
            {exposedPaths.length > 5 && (
              <div className="text-xs text-muted-foreground text-center">
                +{exposedPaths.length - 5} more paths
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Wave 4: AI Analysis Wrapper
// ============================================================

function AIAnalysisReport({ data }: { data: Record<string, unknown> }) {
  const skipped = data.skipped as boolean | undefined;
  if (skipped) {
    return (
      <div className="pt-4 text-sm text-muted-foreground">
        {(data.skipReason as string) || 'AI provider not configured'}
      </div>
    );
  }
  return (
    <div className="pt-1">
      <AIAnalysisDetails data={data as unknown as AIAnalysisData} />
    </div>
  );
}

// ============================================================
// Main DetailedReport Component
// ============================================================

const WAVE_CONFIG: Array<{
  wave: number;
  title: string;
  icon: React.ElementType;
}> = [
  { wave: 1, title: 'Health Check', icon: Globe },
  { wave: 2, title: 'Performance & Visual', icon: Gauge },
  { wave: 3, title: 'Security Scan', icon: Shield },
  { wave: 4, title: 'AI Analysis', icon: Brain },
  { wave: 5, title: 'Accessibility', icon: Accessibility },
  { wave: 6, title: 'API Discovery', icon: Network },
  { wave: 7, title: 'SEO Analysis', icon: Search },
];

export function DetailedReport({ waves }: DetailedReportProps) {
  const [showReport, setShowReport] = useState(false);
  const completedWaves = waves.filter(w => w.status === 'completed' || w.status === 'failed' || w.status === 'skipped');

  if (completedWaves.length === 0) return null;

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowReport(!showReport)}
        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        {showReport ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {showReport ? 'Hide Detailed Report' : 'Show Detailed Report'}
        <span className="text-xs text-muted-foreground">({completedWaves.length} waves)</span>
      </button>

      {showReport && (
        <div className="space-y-3">
          {WAVE_CONFIG.map(({ wave, title, icon }) => {
            const waveData = waves.find(w => w.wave === wave);
            if (!waveData || (waveData.status !== 'completed' && waveData.status !== 'failed' && waveData.status !== 'skipped')) {
              return null;
            }

            return (
              <ReportSection
                key={wave}
                title={title}
                icon={icon}
                status={waveData.status}
                duration={waveData.duration}
              >
                {/* Wave 1: Health */}
                {wave === 1 && waveData.data && (
                  <HealthCheckDetails data={waveData.data} />
                )}
                {/* Wave 2: Performance */}
                {wave === 2 && waveData.data && (
                  <PerformanceDetails data={waveData.data} />
                )}
                {/* Wave 3: Security */}
                {wave === 3 && waveData.data && (
                  <SecurityDetails data={waveData.data} />
                )}
                {/* Wave 4: AI */}
                {wave === 4 && waveData.data && (
                  <AIAnalysisReport data={waveData.data} />
                )}
                {/* Wave 5: Accessibility */}
                {wave === 5 && waveData.data && (
                  <AccessibilityDetails data={waveData.data as unknown as AccessibilityData} />
                )}
                {/* Wave 6: API Discovery */}
                {wave === 6 && waveData.data && (
                  <APIDiscoveryDetails data={waveData.data as unknown as APIDiscoveryData} />
                )}
                {/* Wave 7: SEO */}
                {wave === 7 && waveData.data && (
                  <SeoAnalysisDetails data={waveData.data as unknown as SeoAnalysisData} />
                )}
                {/* Error */}
                {waveData.error && (
                  <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
                    {waveData.error}
                  </div>
                )}
                {/* No data */}
                {!waveData.data && !waveData.error && (
                  <div className="pt-4 text-sm text-muted-foreground">
                    No detailed data available for this wave.
                  </div>
                )}
              </ReportSection>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DetailedReport;
