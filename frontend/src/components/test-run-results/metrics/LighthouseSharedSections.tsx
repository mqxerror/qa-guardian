/**
 * LighthouseSharedSections - Shared sections for Lighthouse results
 * Feature #103: Extracted from MetricsTab.tsx
 *
 * Contains:
 * - FilmstripSection
 * - OpportunitiesSection
 * - DiagnosticsSection
 * - SecurityInsightsSection
 */
import React from 'react';

// Filmstrip Section
export const FilmstripSection: React.FC<{ lighthouse: any }> = ({ lighthouse }) => (
  <div className="border border-border rounded-xl p-5 mb-6 shadow-sm bg-card">
    <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
      <span className="text-lg">🎬</span> Page Load Filmstrip
      <span className="text-xs text-muted-foreground font-normal ml-2">
        Click to view full size
      </span>
    </h4>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {lighthouse.filmstrip.map((frame: { timestamp_ms: number; screenshot_base64: string; label?: string }, idx: number) => (
        <div
          key={idx}
          className="flex-shrink-0 cursor-pointer group"
          onClick={() => {
            const img = document.createElement('img');
            img.src = `data:image/png;base64,${frame.screenshot_base64}`;
            img.className = 'max-w-full max-h-full';
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';
            modal.onclick = () => modal.remove();
            modal.appendChild(img);
            document.body.appendChild(modal);
          }}
        >
          <div className="relative">
            <img
              src={`data:image/png;base64,${frame.screenshot_base64}`}
              alt={`Frame at ${frame.timestamp_ms}ms`}
              className="h-24 w-auto rounded border border-border group-hover:border-primary transition-colors"
            />
            {frame.label && (
              <span className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                frame.label === 'LCP' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                frame.label === 'TTI' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}>
                {frame.label}
              </span>
            )}
          </div>
          <div className="text-center text-xs text-muted-foreground mt-1">
            {frame.timestamp_ms >= 1000
              ? `${(frame.timestamp_ms / 1000).toFixed(1)}s`
              : `${frame.timestamp_ms}ms`
            }
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Opportunities Section
export interface OpportunitiesSectionProps {
  opportunities: any[];
  expandedOpportunities: Set<string>;
  toggleOpportunity: (id: string) => void;
}

export const OpportunitiesSection: React.FC<OpportunitiesSectionProps> = ({
  opportunities,
  expandedOpportunities,
  toggleOpportunity,
}) => (
  <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
    <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-b border-border flex items-center justify-between">
      <h4 className="font-semibold text-foreground flex items-center gap-2">
        <span className="text-lg">💡</span> Opportunities
      </h4>
      <span className="text-xs text-muted-foreground">
        {opportunities.length} suggestions
      </span>
    </div>
    <div className="divide-y divide-border">
      {opportunities.map((opp) => (
        <div key={opp.id} className="bg-background">
          <button
            onClick={() => toggleOpportunity(opp.id)}
            className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg
                className={`w-4 h-4 transition-transform ${expandedOpportunities.has(opp.id) ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm text-foreground">{opp.title}</span>
            </div>
            <span className="text-sm font-medium text-orange-600">
              Save ~{opp.savings}
            </span>
          </button>
          {expandedOpportunities.has(opp.id) && (
            <div className="px-10 pb-3 text-sm text-muted-foreground">
              {opp.details}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Diagnostics Section
export interface DiagnosticsSectionProps {
  diagnostics: any[];
  expandedDiagnostics: Set<string>;
  toggleDiagnostic: (id: string) => void;
}

export const DiagnosticsSection: React.FC<DiagnosticsSectionProps> = ({
  diagnostics,
  expandedDiagnostics,
  toggleDiagnostic,
}) => (
  <div className="border border-border rounded-xl overflow-hidden shadow-sm">
    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-border flex items-center justify-between">
      <h4 className="font-semibold text-foreground flex items-center gap-2">
        <span className="text-lg">🔍</span> Diagnostics
      </h4>
      <span className="text-xs text-muted-foreground">
        {diagnostics.length} items
      </span>
    </div>
    <div className="divide-y divide-border">
      {diagnostics.map((diag) => (
        <div key={diag.id} className="bg-background">
          <button
            onClick={() => toggleDiagnostic(diag.id)}
            className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${expandedDiagnostics.has(diag.id) ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm text-foreground">{diag.title}</span>
          </button>
          {expandedDiagnostics.has(diag.id) && (
            <div className="px-10 pb-3 text-sm text-muted-foreground">
              {diag.details}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Security Insights Section
export interface SecurityInsightsSectionProps {
  lighthouse: any;
  securityInsightsCollapsed: boolean;
  setSecurityInsightsCollapsed: (collapsed: boolean) => void;
  expandedMixedContentResources: boolean;
  setExpandedMixedContentResources: (expanded: boolean) => void;
}

export const SecurityInsightsSection: React.FC<SecurityInsightsSectionProps> = ({
  lighthouse,
  securityInsightsCollapsed,
  setSecurityInsightsCollapsed,
  expandedMixedContentResources,
  setExpandedMixedContentResources,
}) => (
  <div className="border border-border rounded-lg overflow-hidden mt-6">
    <button
      onClick={() => setSecurityInsightsCollapsed(!securityInsightsCollapsed)}
      className="w-full p-3 bg-purple-50 dark:bg-purple-900/20 border-b border-border flex items-center justify-between hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
    >
      <h4 className="font-medium text-purple-700 dark:text-purple-400 flex items-center gap-2">
        <span>🔒</span> Security Insights
      </h4>
      <div className="flex items-center gap-2">
        {lighthouse.csp?.blocksLighthouse && (
          <span className="text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">
            CSP Issue
          </span>
        )}
        {lighthouse.mixedContent?.detected && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            lighthouse.mixedContent.securityImpact === 'high'
              ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
              : 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300'
          }`}>
            Mixed Content ({lighthouse.mixedContent.count})
          </span>
        )}
        {lighthouse.authentication?.required && (
          <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
            Auth Required
          </span>
        )}
        <svg
          className={`w-4 h-4 text-purple-600 transition-transform ${securityInsightsCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>
    {!securityInsightsCollapsed && (
      <div className="divide-y divide-border">
        {/* CSP Detection */}
        {lighthouse.csp && (
          <div className="p-4 bg-background">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-3 h-3 rounded-full ${lighthouse.csp.detected ? (lighthouse.csp.blocksLighthouse ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-400'}`}></span>
              <h5 className="font-medium text-foreground">Content Security Policy</h5>
              <span className={`text-xs px-2 py-0.5 rounded ${
                lighthouse.csp.detected
                  ? (lighthouse.csp.blocksLighthouse
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400')
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
              }`}>
                {lighthouse.csp.detected
                  ? (lighthouse.csp.blocksLighthouse ? 'Restrictive' : 'Present')
                  : 'Not Detected'}
              </span>
            </div>
            {lighthouse.csp.warning && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">⚠️ {lighthouse.csp.warning}</p>
            )}
            {lighthouse.csp.suggestion && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300">
                💡 {lighthouse.csp.suggestion}
              </div>
            )}
          </div>
        )}

        {/* Mixed Content Detection */}
        {lighthouse.mixedContent && lighthouse.mixedContent.detected && (
          <div className="p-4 bg-background">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-3 h-3 rounded-full ${lighthouse.mixedContent.securityImpact === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
              <h5 className="font-medium text-foreground">Mixed Content</h5>
            </div>
            {lighthouse.mixedContent.warning && (
              <p className="text-sm text-muted-foreground mb-2">{lighthouse.mixedContent.warning}</p>
            )}
            <div className="flex gap-4 text-sm mb-3">
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">{lighthouse.mixedContent.count}</span>
                <span className="text-muted-foreground">total resources</span>
              </div>
            </div>
          </div>
        )}

        {/* Authentication Detection */}
        {lighthouse.authentication && lighthouse.authentication.required && (
          <div className="p-4 bg-background">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <h5 className="font-medium text-foreground">Authentication Detection</h5>
            </div>
            {lighthouse.authentication.warning && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">⚠️ {lighthouse.authentication.warning}</p>
            )}
            {lighthouse.authentication.suggestion && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300">
                💡 {lighthouse.authentication.suggestion}
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>
);
