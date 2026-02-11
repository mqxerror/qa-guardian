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
import { ChevronRight, ChevronDown } from 'lucide-react';
import { LighthouseResult } from '../types';

// Opportunity item from Lighthouse audit
interface LighthouseOpportunity {
  id: string;
  title: string;
  savings: string | number;
  details?: string;
}

// Diagnostic item from Lighthouse audit
interface LighthouseDiagnostic {
  id: string;
  title: string;
  details?: string;
}

// Filmstrip frame type
interface FilmstripFrame {
  timestamp_ms: number;
  screenshot_base64: string;
  label?: string;
}

// Lighthouse data for filmstrip section (compatible with both LighthouseData and LighthouseResult)
interface LighthouseWithFilmstrip {
  filmstrip?: FilmstripFrame[];
}

// Filmstrip Section
export const FilmstripSection: React.FC<{ lighthouse: LighthouseWithFilmstrip }> = ({ lighthouse }) => (
 <div className="border border-border rounded-xl p-5 mb-6 shadow-sm bg-card">
 <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
 <span className="text-lg">🎬</span> Page Load Filmstrip
 <span className="text-xs text-muted-foreground font-normal ml-2">
 Click to view full size
 </span>
 </h4>
 <div className="flex gap-2 overflow-x-auto pb-2">
 {lighthouse.filmstrip?.map((frame: { timestamp_ms: number; screenshot_base64: string; label?: string }, idx: number) => (
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
 frame.label === 'LCP' ? 'bg-success/10 text-success' :
 frame.label === 'TTI' ? 'bg-primary/10 text-primary' :
 'bg-muted text-foreground'
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
 opportunities: LighthouseOpportunity[];
 expandedOpportunities: Set<string>;
 toggleOpportunity: (id: string) => void;
}

export const OpportunitiesSection: React.FC<OpportunitiesSectionProps> = ({
 opportunities,
 expandedOpportunities,
 toggleOpportunity,
}) => (
 <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
 <div className="p-4 bg-gradient-to-r from-warning/5 to-warning/5 border-b border-border flex items-center justify-between">
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
 <ChevronRight className={`w-4 h-4 transition-transform ${expandedOpportunities.has(opp.id) ? 'rotate-90' : ''}`} />
 <span className="text-sm text-foreground">{opp.title}</span>
 </div>
 <span className="text-sm font-medium text-warning">
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
 diagnostics: LighthouseDiagnostic[];
 expandedDiagnostics: Set<string>;
 toggleDiagnostic: (id: string) => void;
}

export const DiagnosticsSection: React.FC<DiagnosticsSectionProps> = ({
 diagnostics,
 expandedDiagnostics,
 toggleDiagnostic,
}) => (
 <div className="border border-border rounded-xl overflow-hidden shadow-sm">
 <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border flex items-center justify-between">
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
 <ChevronRight className={`w-4 h-4 transition-transform ${expandedDiagnostics.has(diag.id) ? 'rotate-90' : ''}`} />
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
 lighthouse: LighthouseResult;
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
 className="w-full p-3 bg-accent/5 border-b border-border flex items-center justify-between hover:bg-accent/10 transition-colors"
 >
 <h4 className="font-medium text-accent flex items-center gap-2">
 <span>🔒</span> Security Insights
 </h4>
 <div className="flex items-center gap-2">
 {lighthouse.csp?.blocksLighthouse && (
 <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full">
 CSP Issue
 </span>
 )}
 {lighthouse.mixedContent?.detected && (
 <span className={`text-xs px-2 py-1 rounded-full ${
 lighthouse.mixedContent.securityImpact === 'high'
 ? 'bg-destructive/10 text-destructive'
 : 'bg-warning/10 text-warning'
 }`}>
 Mixed Content ({lighthouse.mixedContent.count})
 </span>
 )}
 {lighthouse.authentication?.required && (
 <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
 Auth Required
 </span>
 )}
 <ChevronDown className={`w-4 h-4 text-accent transition-transform ${securityInsightsCollapsed ? '' : 'rotate-180'}`} />
 </div>
 </button>
 {!securityInsightsCollapsed && (
 <div className="divide-y divide-border">
 {/* CSP Detection */}
 {lighthouse.csp && (
 <div className="p-4 bg-background">
 <div className="flex items-center gap-2 mb-2">
 <span className={`w-3 h-3 rounded-full ${lighthouse.csp.detected ? (lighthouse.csp.blocksLighthouse ? 'bg-destructive' : 'bg-success') : 'bg-muted-foreground'}`}></span>
 <h5 className="font-medium text-foreground">Content Security Policy</h5>
 <span className={`text-xs px-2 py-0.5 rounded ${
 lighthouse.csp.detected
 ? (lighthouse.csp.blocksLighthouse
 ? 'bg-destructive/10 text-destructive'
 : 'bg-success/10 text-success')
 : 'bg-warning/10 text-warning'
 }`}>
 {lighthouse.csp.detected
 ? (lighthouse.csp.blocksLighthouse ? 'Restrictive' : 'Present')
 : 'Not Detected'}
 </span>
 </div>
 {lighthouse.csp.warning && (
 <p className="text-sm text-warning mb-2">⚠️ {lighthouse.csp.warning}</p>
 )}
 {lighthouse.csp.suggestion && (
 <div className="mt-2 p-2 bg-primary/5 rounded text-sm text-primary">
 💡 {lighthouse.csp.suggestion}
 </div>
 )}
 </div>
 )}

 {/* Mixed Content Detection */}
 {lighthouse.mixedContent && lighthouse.mixedContent.detected && (
 <div className="p-4 bg-background">
 <div className="flex items-center gap-2 mb-2">
 <span className={`w-3 h-3 rounded-full ${lighthouse.mixedContent.securityImpact === 'high' ? 'bg-destructive' : 'bg-warning'}`}></span>
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
 <span className="w-3 h-3 rounded-full bg-primary"></span>
 <h5 className="font-medium text-foreground">Authentication Detection</h5>
 </div>
 {lighthouse.authentication.warning && (
 <p className="text-sm text-warning mb-2">⚠️ {lighthouse.authentication.warning}</p>
 )}
 {lighthouse.authentication.suggestion && (
 <div className="mt-2 p-2 bg-primary/5 rounded text-sm text-primary">
 💡 {lighthouse.authentication.suggestion}
 </div>
 )}
 </div>
 )}
 </div>
 )}
 </div>
);
