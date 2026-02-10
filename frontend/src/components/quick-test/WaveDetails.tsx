/**
 * Feature #514: Wave Details Components
 * Extracted from QuickTestPage.tsx
 * Feature #622: Added React.memo for performance optimization
 *
 * Contains the detail components for each wave type:
 * - AIAnalysisDetails (Wave 4)
 * - AccessibilityDetails (Wave 5)
 * - APIDiscoveryDetails (Wave 6)
 * - SeoAnalysisDetails (Wave 7)
 */

import { memo } from 'react';
import {
  Eye,
  Lightbulb,
  AlertTriangle,
  Accessibility,
  CheckCircle2,
  Network,
  FileJson,
  Lock,
  Unlock,
  Wand2,
  XCircle,
  Search,
  Heading1,
  FileText,
  Map,
  Code2,
  Navigation,
  Menu,
  Activity,
} from 'lucide-react';
import { SourceBadge, PriorityBadge, SeverityBadge, ImpactBadge } from './badges';
import type { AIAnalysisData, AccessibilityData, APIDiscoveryData, SeoAnalysisData } from './types';

// ============================================================
// Feature #467: AI Analysis Details Component
// ============================================================

interface AIAnalysisDetailsProps {
  data: AIAnalysisData;
  onCreateTestSuite?: () => void;
}

export const AIAnalysisDetails = memo(function AIAnalysisDetails({ data, onCreateTestSuite }: AIAnalysisDetailsProps) {
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
        <div className="flex items-center gap-2 text-xs text-method-ai bg-method-ai/10 px-2 py-1 rounded">
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Lightbulb className="w-3.5 h-3.5" />
              Test Suggestions ({data.testSuggestions!.length})
            </div>
            {/* Feature #475: Create Test Suite button */}
            {onCreateTestSuite && (
              <button
                onClick={onCreateTestSuite}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                <Wand2 className="w-3 h-3" />
                Create Test Suite
              </button>
            )}
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
});
AIAnalysisDetails.displayName = 'AIAnalysisDetails';

// ============================================================
// Feature #471: Accessibility Details Component
// AccessibilityData is now imported from ./types
// ============================================================

export const AccessibilityDetails = memo(function AccessibilityDetails({ data }: { data: AccessibilityData }) {
  if (!data || !data.violationCounts) return null;
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
        <div className="text-center p-2 rounded bg-destructive/10">
          <div className="text-lg font-bold text-destructive">{data.violationCounts.critical}</div>
          <div className="text-xs text-muted-foreground">Critical</div>
        </div>
        <div className="text-center p-2 rounded bg-warning/10">
          <div className="text-lg font-bold text-warning">{data.violationCounts.serious}</div>
          <div className="text-xs text-muted-foreground">Serious</div>
        </div>
        <div className="text-center p-2 rounded bg-warning/10">
          <div className="text-lg font-bold text-warning">{data.violationCounts.moderate}</div>
          <div className="text-xs text-muted-foreground">Moderate</div>
        </div>
        <div className="text-center p-2 rounded bg-info/10">
          <div className="text-lg font-bold text-info">{data.violationCounts.minor}</div>
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
});
AccessibilityDetails.displayName = 'AccessibilityDetails';

// ============================================================
// Feature #472: API Discovery Details Component
// APIDiscoveryData is now imported from ./types
// ============================================================

export const APIDiscoveryDetails = memo(function APIDiscoveryDetails({ data }: { data: APIDiscoveryData }) {
  if (!data || !data.summary) return null;
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
          <div className="text-center p-2 rounded bg-info/10">
            <div className="text-lg font-bold text-info">{data.summary.protected}</div>
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
                    concern.severity === 'high' ? 'bg-destructive/20 text-destructive' :
                    concern.severity === 'medium' ? 'bg-warning/20 text-warning' :
                    'bg-info/20 text-info'
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
                    endpoint.method === 'GET' ? 'bg-info/20 text-info' :
                    endpoint.method === 'POST' ? 'bg-success/20 text-success' :
                    endpoint.method === 'PUT' ? 'bg-warning/20 text-warning' :
                    endpoint.method === 'DELETE' ? 'bg-destructive/20 text-destructive' :
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
                      <Lock className="w-3.5 h-3.5 text-info" />
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
});
APIDiscoveryDetails.displayName = 'APIDiscoveryDetails';

// ============================================================
// Feature #527: SEO Analysis Details Component
// ============================================================

export const SeoAnalysisDetails = memo(function SeoAnalysisDetails({ data }: { data: SeoAnalysisData }) {
  if (!data || !data.metaTags) return null;

  // Count issues and recommendations
  const issueCount = data.issues?.length || 0;
  const recCount = data.recommendations?.length || 0;

  // Helper for meta tag status
  const MetaTagStatus = ({ tag }: { tag: typeof data.metaTags.title }) => {
    if (!tag.present) {
      return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    }
    if (!tag.valid) {
      return <AlertTriangle className="w-3.5 h-3.5 text-warning" />;
    }
    return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
  };

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
            <div>SEO Score</div>
            <div>{issueCount} issues found</div>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{data.headingStructure.h1Count} H1 tag{data.headingStructure.h1Count !== 1 ? 's' : ''}</div>
          <div>{recCount} recommendations</div>
        </div>
      </div>

      {/* Essential Meta Tags */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
          <FileText className="w-3.5 h-3.5" />
          Essential Meta Tags
        </div>
        <div className="space-y-1.5">
          {/* Title */}
          <div className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
            <div className="flex items-center gap-2">
              <MetaTagStatus tag={data.metaTags.title} />
              <span className="text-foreground">Title</span>
            </div>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={data.metaTags.title.content || ''}>
              {data.metaTags.title.content || '(missing)'}
            </span>
          </div>
          {/* Description */}
          <div className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
            <div className="flex items-center gap-2">
              <MetaTagStatus tag={data.metaTags.description} />
              <span className="text-foreground">Meta Description</span>
            </div>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={data.metaTags.description.content || ''}>
              {data.metaTags.description.content ? `${data.metaTags.description.content.substring(0, 40)}...` : '(missing)'}
            </span>
          </div>
          {/* Canonical */}
          <div className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
            <div className="flex items-center gap-2">
              <MetaTagStatus tag={data.metaTags.canonical} />
              <span className="text-foreground">Canonical URL</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {data.metaTags.canonical.present ? 'present' : '(missing)'}
            </span>
          </div>
          {/* Viewport */}
          <div className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
            <div className="flex items-center gap-2">
              <MetaTagStatus tag={data.metaTags.viewport} />
              <span className="text-foreground">Viewport</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {data.metaTags.viewport.present ? 'present' : '(missing)'}
            </span>
          </div>
        </div>
      </div>

      {/* Social Tags */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
          <Search className="w-3.5 h-3.5" />
          Social Media Tags
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-background/50 text-xs">
            <MetaTagStatus tag={data.metaTags.ogTitle} />
            <span>og:title</span>
          </div>
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-background/50 text-xs">
            <MetaTagStatus tag={data.metaTags.ogDescription} />
            <span>og:description</span>
          </div>
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-background/50 text-xs">
            <MetaTagStatus tag={data.metaTags.ogImage} />
            <span>og:image</span>
          </div>
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-background/50 text-xs">
            <MetaTagStatus tag={data.metaTags.twitterCard} />
            <span>twitter:card</span>
          </div>
        </div>
      </div>

      {/* Heading Structure */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
          <Heading1 className="w-3.5 h-3.5" />
          Heading Structure
        </div>
        <div className="flex items-center gap-4 p-2 rounded bg-background/50">
          <div className="text-center">
            <div className={`text-lg font-bold ${
              data.headingStructure.h1Count === 1 ? 'text-success' :
              data.headingStructure.h1Count === 0 ? 'text-destructive' :
              'text-warning'
            }`}>
              {data.headingStructure.h1Count}
            </div>
            <div className="text-xs text-muted-foreground">H1 Tags</div>
          </div>
          <div className="flex-1 text-xs text-muted-foreground">
            {data.headingStructure.h1Count === 1 ? (
              <span className="text-success">Perfect - exactly one H1 tag</span>
            ) : data.headingStructure.h1Count === 0 ? (
              <span className="text-destructive">Missing H1 tag</span>
            ) : (
              <span className="text-warning">Multiple H1 tags found</span>
            )}
            {!data.headingStructure.hierarchyValid && (
              <div className="text-warning mt-1">Heading hierarchy has issues</div>
            )}
          </div>
        </div>
        {data.headingStructure.h1Texts.length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground truncate" title={data.headingStructure.h1Texts[0]}>
            H1: &ldquo;{data.headingStructure.h1Texts[0]}&rdquo;
          </div>
        )}
      </div>

      {/* Feature #544: Enhanced Crawlability with detailed findings */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
          <Map className="w-3.5 h-3.5" />
          Crawlability
        </div>
        <div className="space-y-2">
          {/* robots.txt */}
          <div className="p-2 rounded bg-background/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">robots.txt</span>
              <div className="flex items-center gap-1">
                {data.crawlability.robotsTxt.present ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    {!data.crawlability.robotsTxt.allowsCrawling && (
                      <span className="text-xs text-warning">(blocks crawling)</span>
                    )}
                  </>
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            </div>
            {data.crawlability.robotsTxt.present && data.crawlability.robotsTxt.content && (
              <div className="mt-2">
                {/* Show disallow rules */}
                {(() => {
                  const content = data.crawlability.robotsTxt.content || '';
                  const disallowRules = content.split('\n')
                    .filter(l => l.trim().toLowerCase().startsWith('disallow:'))
                    .map(l => l.trim().split(':').slice(1).join(':').trim())
                    .filter(Boolean);
                  const hasCrawlDelay = content.toLowerCase().includes('crawl-delay');
                  return (
                    <>
                      {disallowRules.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Disallow rules:</span>
                          <div className="mt-1 font-mono space-y-0.5">
                            {disallowRules.slice(0, 5).map((rule, i) => (
                              <div key={i} className="text-warning/80">{rule}</div>
                            ))}
                            {disallowRules.length > 5 && (
                              <div className="text-muted-foreground">+{disallowRules.length - 5} more</div>
                            )}
                          </div>
                        </div>
                      )}
                      {hasCrawlDelay && (
                        <div className="mt-1 text-xs text-warning">Crawl-delay directive detected</div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* sitemap.xml */}
          <div className="p-2 rounded bg-background/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">sitemap.xml</span>
              <div className="flex items-center gap-1">
                {data.crawlability.sitemap.present ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    {data.crawlability.sitemap.urlCount !== undefined && data.crawlability.sitemap.urlCount > 0 && (
                      <span className="text-xs text-muted-foreground font-medium">{data.crawlability.sitemap.urlCount} URLs</span>
                    )}
                  </>
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            </div>
            {data.crawlability.sitemap.present && data.crawlability.sitemap.url && (
              <div className="mt-1 text-xs text-muted-foreground font-mono truncate" title={data.crawlability.sitemap.url}>
                {data.crawlability.sitemap.url}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature #529 + #544: Enhanced Navigation Details */}
      {data.navigation && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Navigation className="w-3.5 h-3.5" />
            Navigation Elements
            {data.navigation.navElements.length > 0 && (
              <span className="text-xs text-muted-foreground">({data.navigation.navElements.length} elements)</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
              <span className="text-foreground">&lt;nav&gt;</span>
              <div className="flex items-center gap-1">
                {data.navigation.hasNavElement ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                {data.navigation.navElements.filter(n => n.type === 'nav' || n.type === 'role-navigation').length > 1 && (
                  <span className="text-xs text-muted-foreground">
                    ({data.navigation.navElements.filter(n => n.type === 'nav' || n.type === 'role-navigation').length})
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
              <span className="text-foreground">&lt;header&gt;</span>
              {data.navigation.hasHeader ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
              <span className="text-foreground">&lt;footer&gt;</span>
              {data.navigation.hasFooter ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
              <span className="text-foreground">Breadcrumbs</span>
              {data.navigation.hasBreadcrumbs ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
          </div>
          {/* Feature #544: Detailed nav element listing with aria-labels and visibility */}
          {data.navigation.navElements.filter(n => n.ariaLabel || !n.visible).length > 0 && (
            <div className="mt-2 space-y-1">
              {data.navigation.navElements.map((nav, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{nav.type}</span>
                  {nav.ariaLabel && <span className="text-primary/80">aria: &quot;{nav.ariaLabel}&quot;</span>}
                  {!nav.visible && <span className="text-warning">(hidden)</span>}
                </div>
              ))}
            </div>
          )}
          {data.navigation.hasMobileMenuToggle && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Menu className="w-3 h-3" />
              Mobile menu toggle detected
            </div>
          )}
          {data.navigation.issues.length > 0 && (
            <div className="mt-2 space-y-1">
              {data.navigation.issues.map((issue, idx) => (
                <div key={idx} className="text-xs text-warning">{issue}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feature #528 + #544: Enhanced Schema Markup with detailed findings */}
      {data.schemaMarkup && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Code2 className="w-3.5 h-3.5" />
            Structured Data
          </div>
          <div className="p-2 rounded bg-background/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-foreground">
                {data.schemaMarkup.hasStructuredData ? 'Schema Detected' : 'No Schema Found'}
              </span>
              {data.schemaMarkup.hasStructuredData ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <XCircle className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            {data.schemaMarkup.detectedTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.schemaMarkup.detectedTypes.map((type, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded"
                  >
                    {type}
                  </span>
                ))}
              </div>
            )}
            {/* Feature #544: JSON-LD script details with content preview */}
            {data.schemaMarkup.jsonLdScripts.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="text-xs text-muted-foreground font-medium">
                  {data.schemaMarkup.jsonLdScripts.length} JSON-LD script{data.schemaMarkup.jsonLdScripts.length !== 1 ? 's' : ''}
                  {data.schemaMarkup.issues.length > 0 && (
                    <span className="text-warning ml-2">({data.schemaMarkup.issues.length} issues)</span>
                  )}
                </div>
                {data.schemaMarkup.jsonLdScripts.map((script, idx) => (
                  <div key={idx} className="p-2 rounded bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">{script.type}</span>
                      <span className={`text-xs ${script.valid ? 'text-success' : 'text-destructive'}`}>
                        {script.valid ? 'Valid' : 'Invalid'}
                      </span>
                    </div>
                    {script.error && (
                      <div className="text-xs text-destructive mb-1">{script.error}</div>
                    )}
                    <pre className="text-[10px] text-muted-foreground font-mono overflow-x-auto max-h-16 whitespace-pre-wrap break-all">
                      {script.raw.substring(0, 200)}{script.raw.length > 200 ? '...' : ''}
                    </pre>
                  </div>
                ))}
              </div>
            )}
            {/* Feature #544: Microdata item details */}
            {data.schemaMarkup.microdataItems.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-muted-foreground font-medium mb-1">Microdata</div>
                <div className="space-y-1">
                  {data.schemaMarkup.microdataItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-foreground/80">{item.type}</span>
                      <span className="text-muted-foreground">{item.itemCount} instance{item.itemCount !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature #530: Tracking Scripts */}
      {data.tracking && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Activity className="w-3.5 h-3.5" />
            Tracking & Analytics
          </div>
          {data.tracking.scripts.length === 0 ? (
            <div className="p-2 rounded bg-background/50 text-sm text-muted-foreground">
              No tracking scripts detected
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.tracking.scripts.map((script, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded bg-background/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{script.name}</span>
                    {script.id && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {script.id}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {script.source.replace('_', ' ')}
                  </span>
                </div>
              ))}
              <div className="mt-2 text-xs text-muted-foreground">
                {data.tracking.summary}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {recCount > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Lightbulb className="w-3.5 h-3.5" />
            Recommendations
          </div>
          <div className="space-y-1.5">
            {data.recommendations.slice(0, 4).map((rec, idx) => (
              <div key={idx} className="p-2 rounded bg-warning/10 text-sm text-foreground/80">
                {rec}
              </div>
            ))}
            {data.recommendations.length > 4 && (
              <div className="text-xs text-muted-foreground text-center">
                +{data.recommendations.length - 4} more recommendations
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
SeoAnalysisDetails.displayName = 'SeoAnalysisDetails';
