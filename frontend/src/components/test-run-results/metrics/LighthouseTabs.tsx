/**
 * LighthouseTabs - Tab components for Lighthouse results
 * Feature #103: Extracted from MetricsTab.tsx
 *
 * Contains:
 * - LighthouseOverviewTab
 * - LighthousePerformanceTab
 * - LighthouseAccessibilityTab
 * - LighthouseBestPracticesTab
 * - LighthouseSEOTab
 */
import React from 'react';
import CircularGauge from '../CircularGauge';
import { CoreWebVitalsSection } from './CoreWebVitalsSection';
import { FilmstripSection, OpportunitiesSection, DiagnosticsSection } from './LighthouseSharedSections';

// Overview Tab
export interface LighthouseOverviewTabProps {
 lighthouse: any;
 opportunities: any[];
 diagnostics: any[];
 expandedOpportunities: Set<string>;
 toggleOpportunity: (id: string) => void;
 expandedDiagnostics: Set<string>;
 toggleDiagnostic: (id: string) => void;
}

export const LighthouseOverviewTab: React.FC<LighthouseOverviewTabProps> = ({
 lighthouse,
 opportunities,
 diagnostics,
 expandedOpportunities,
 toggleOpportunity,
 expandedDiagnostics,
 toggleDiagnostic,
}) => (
 <>
 {/* Feature #67: Side-by-side Circular Gauges when both mobile and desktop available */}
 {lighthouse.mobileResults && lighthouse.desktopResults ? (
 <div className="mb-8">
 {/* Mobile Gauges */}
 <div className="mb-6">
 <div className="flex items-center justify-center gap-2 mb-4 py-2 bg-primary/5 rounded-lg">
 <span className="text-xl">📱</span>
 <span className="font-semibold text-primary">Mobile Results</span>
 </div>
 <div className="flex justify-center gap-6 flex-wrap">
 {[
 { label: 'Performance', value: lighthouse.mobileResults.performance_score },
 { label: 'Accessibility', value: lighthouse.mobileResults.accessibility_score },
 { label: 'Best Practices', value: lighthouse.mobileResults.best_practices_score },
 { label: 'SEO', value: lighthouse.mobileResults.seo_score },
 ].map(metric => (
 <CircularGauge
 key={`mobile-${metric.label}`}
 score={metric.value || 0}
 label={metric.label}
 size={80}
 />
 ))}
 </div>
 </div>

 {/* Desktop Gauges */}
 <div>
 <div className="flex items-center justify-center gap-2 mb-4 py-2 bg-purple-50 rounded-lg">
 <span className="text-xl">🖥️</span>
 <span className="font-semibold text-purple-700">Desktop Results</span>
 </div>
 <div className="flex justify-center gap-6 flex-wrap">
 {[
 { label: 'Performance', value: lighthouse.desktopResults.performance_score },
 { label: 'Accessibility', value: lighthouse.desktopResults.accessibility_score },
 { label: 'Best Practices', value: lighthouse.desktopResults.best_practices_score },
 { label: 'SEO', value: lighthouse.desktopResults.seo_score },
 ].map(metric => (
 <CircularGauge
 key={`desktop-${metric.label}`}
 score={metric.value || 0}
 label={metric.label}
 size={80}
 />
 ))}
 </div>
 </div>
 </div>
 ) : (
 /* Original single-device view */
 <div className="flex justify-center gap-8 flex-wrap mb-8">
 {[
 { label: 'Performance', value: lighthouse.performance },
 { label: 'Accessibility', value: lighthouse.accessibility },
 { label: 'Best Practices', value: lighthouse.best_practices || lighthouse.bestPractices },
 { label: 'SEO', value: lighthouse.seo },
 ].filter(m => m.value !== undefined).map(metric => (
 <CircularGauge
 key={metric.label}
 score={metric.value || 0}
 label={metric.label}
 size={100}
 />
 ))}
 </div>
 )}

 {/* Core Web Vitals with visual gauges */}
 {lighthouse.metrics && (
 <CoreWebVitalsSection lighthouse={lighthouse} />
 )}
 </>
);

// Performance Tab
export interface LighthousePerformanceTabProps {
 lighthouse: any;
 opportunities: any[];
 diagnostics: any[];
 expandedOpportunities: Set<string>;
 toggleOpportunity: (id: string) => void;
 expandedDiagnostics: Set<string>;
 toggleDiagnostic: (id: string) => void;
}

export const LighthousePerformanceTab: React.FC<LighthousePerformanceTabProps> = ({
 lighthouse,
 opportunities,
 diagnostics,
 expandedOpportunities,
 toggleOpportunity,
 expandedDiagnostics,
 toggleDiagnostic,
}) => (
 <>
 {/* Performance metrics (Core Web Vitals) */}
 {lighthouse.metrics && (
 <div className="border border-border rounded-xl p-5 mb-6 shadow-sm bg-card">
 <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
 <span className="text-lg">⚡</span> Core Web Vitals
 </h4>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {[
 { label: 'LCP', value: lighthouse.metrics.lcp, unit: 'ms', good: 2500, description: 'Largest Contentful Paint' },
 { label: 'FCP', value: lighthouse.metrics.fcp, unit: 'ms', good: 1800, description: 'First Contentful Paint' },
 { label: 'CLS', value: lighthouse.metrics.cls, unit: '', good: 0.1, description: 'Cumulative Layout Shift' },
 { label: 'TBT', value: lighthouse.metrics.tbt, unit: 'ms', good: 200, description: 'Total Blocking Time' },
 ].filter(m => m.value !== undefined).map(metric => (
 <div key={metric.label} className="p-4 bg-muted/30 rounded-lg">
 <div className={`text-2xl font-bold ${
 metric.label === 'CLS'
 ? (metric.value || 0) <= metric.good ? 'text-success' : 'text-destructive'
 : (metric.value || 0) <= metric.good ? 'text-success' : 'text-destructive'
 }`}>
 {metric.label === 'CLS'
 ? (metric.value || 0).toFixed(3)
 : `${Math.round(metric.value || 0)}${metric.unit}`}
 </div>
 <div className="text-sm font-medium text-foreground">{metric.label}</div>
 <div className="text-xs text-muted-foreground">{metric.description}</div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Filmstrip view of page load */}
 {lighthouse.filmstrip && lighthouse.filmstrip.length > 0 && (
 <FilmstripSection lighthouse={lighthouse} />
 )}

 {/* Opportunities section */}
 <OpportunitiesSection
 opportunities={opportunities}
 expandedOpportunities={expandedOpportunities}
 toggleOpportunity={toggleOpportunity}
 />

 {/* Diagnostics section */}
 <DiagnosticsSection
 diagnostics={diagnostics}
 expandedDiagnostics={expandedDiagnostics}
 toggleDiagnostic={toggleDiagnostic}
 />
 </>
);

// Accessibility Tab
export interface LighthouseAccessibilityTabProps {
 lighthouse: any;
 passedAudits: any[];
}

export const LighthouseAccessibilityTab: React.FC<LighthouseAccessibilityTabProps> = ({
 lighthouse,
 passedAudits,
}) => (
 <>
 {/* Accessibility Score */}
 <div className="flex justify-center mb-6">
 <CircularGauge
 score={lighthouse.accessibility || 0}
 label="Accessibility"
 size={120}
 />
 </div>

 {/* Accessibility-specific passed audits */}
 {passedAudits.filter((a: any) => a.category === 'Accessibility').length > 0 && (
 <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
 <div className="p-4 bg-gradient-to-r from-success/5 to-emerald-50 border-b border-border">
 <h4 className="font-semibold text-success flex items-center gap-2">
 <span className="text-lg">✅</span> Passed Accessibility Audits
 <span className="text-xs bg-success/10 px-2 py-0.5 rounded-full ml-2">
 {passedAudits.filter((a: any) => a.category === 'Accessibility').length} passed
 </span>
 </h4>
 </div>
 <div className="divide-y divide-border max-h-64 overflow-y-auto">
 {passedAudits.filter((a: any) => a.category === 'Accessibility').slice(0, 10).map((audit: any) => (
 <div key={audit.id} className="p-3 flex items-center gap-2">
 <span className="text-success">✓</span>
 <span className="text-sm text-foreground">{audit.title}</span>
 </div>
 ))}
 {passedAudits.filter((a: any) => a.category === 'Accessibility').length > 10 && (
 <div className="p-3 text-center text-sm text-muted-foreground">
 +{passedAudits.filter((a: any) => a.category === 'Accessibility').length - 10} more passed
 </div>
 )}
 </div>
 </div>
 )}

 {/* Note about accessibility */}
 <div className="border border-border rounded-xl p-4 bg-muted/30 text-sm text-muted-foreground">
 <p>💡 <strong>Tip:</strong> Accessibility improvements help users with disabilities and often improve overall user experience. Focus on color contrast, keyboard navigation, and screen reader compatibility.</p>
 </div>
 </>
);

// Best Practices Tab
export interface LighthouseBestPracticesTabProps {
 lighthouse: any;
 passedAudits: any[];
}

export const LighthouseBestPracticesTab: React.FC<LighthouseBestPracticesTabProps> = ({
 lighthouse,
 passedAudits,
}) => (
 <>
 {/* Best Practices Score */}
 <div className="flex justify-center mb-6">
 <CircularGauge
 score={lighthouse.best_practices || lighthouse.bestPractices || 0}
 label="Best Practices"
 size={120}
 />
 </div>

 {/* Best Practices passed audits */}
 {passedAudits.filter((a: any) => a.category === 'Best Practices').length > 0 && (
 <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
 <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 border-b border-border">
 <h4 className="font-semibold text-purple-700 flex items-center gap-2">
 <span className="text-lg">✓</span> Passed Best Practice Audits
 <span className="text-xs bg-purple-100 px-2 py-0.5 rounded-full ml-2">
 {passedAudits.filter((a: any) => a.category === 'Best Practices').length} passed
 </span>
 </h4>
 </div>
 <div className="divide-y divide-border max-h-64 overflow-y-auto">
 {passedAudits.filter((a: any) => a.category === 'Best Practices').slice(0, 10).map((audit: any) => (
 <div key={audit.id} className="p-3 flex items-center gap-2">
 <span className="text-purple-500">✓</span>
 <span className="text-sm text-foreground">{audit.title}</span>
 </div>
 ))}
 {passedAudits.filter((a: any) => a.category === 'Best Practices').length > 10 && (
 <div className="p-3 text-center text-sm text-muted-foreground">
 +{passedAudits.filter((a: any) => a.category === 'Best Practices').length - 10} more passed
 </div>
 )}
 </div>
 </div>
 )}
 </>
);

// SEO Tab
export interface LighthouseSEOTabProps {
 lighthouse: any;
 passedAudits: any[];
}

export const LighthouseSEOTab: React.FC<LighthouseSEOTabProps> = ({
 lighthouse,
 passedAudits,
}) => (
 <>
 {/* SEO Score */}
 <div className="flex justify-center mb-6">
 <CircularGauge
 score={lighthouse.seo || 0}
 label="SEO"
 size={120}
 />
 </div>

 {/* SEO passed audits */}
 {passedAudits.filter((a: any) => a.category === 'SEO').length > 0 && (
 <div className="border border-border rounded-xl overflow-hidden mb-6 shadow-sm">
 <div className="p-4 bg-gradient-to-r from-primary/5 to-indigo-50 border-b border-border">
 <h4 className="font-semibold text-primary flex items-center gap-2">
 <span className="text-lg">🔍</span> Passed SEO Audits
 <span className="text-xs bg-primary/10 px-2 py-0.5 rounded-full ml-2">
 {passedAudits.filter((a: any) => a.category === 'SEO').length} passed
 </span>
 </h4>
 </div>
 <div className="divide-y divide-border max-h-64 overflow-y-auto">
 {passedAudits.filter((a: any) => a.category === 'SEO').slice(0, 10).map((audit: any) => (
 <div key={audit.id} className="p-3 flex items-center gap-2">
 <span className="text-primary">✓</span>
 <span className="text-sm text-foreground">{audit.title}</span>
 </div>
 ))}
 {passedAudits.filter((a: any) => a.category === 'SEO').length > 10 && (
 <div className="p-3 text-center text-sm text-muted-foreground">
 +{passedAudits.filter((a: any) => a.category === 'SEO').length - 10} more passed
 </div>
 )}
 </div>
 </div>
 )}

 {/* SEO Tips */}
 <div className="border border-border rounded-xl p-4 bg-muted/30 text-sm text-muted-foreground">
 <p>💡 <strong>Tip:</strong> Good SEO helps search engines understand and rank your page. Ensure proper meta tags, structured data, and mobile-friendly design.</p>
 </div>
 </>
);
