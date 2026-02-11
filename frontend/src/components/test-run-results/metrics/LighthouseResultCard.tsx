/**
 * LighthouseResultCard - Lighthouse performance results display
 * Feature #103: Extracted from MetricsTab.tsx
 */
import React from 'react';
import { TestResult, LighthouseActiveTab, LighthouseResult } from '../types';
import {
 LighthouseOverviewTab,
 LighthousePerformanceTab,
 LighthouseAccessibilityTab,
 LighthouseBestPracticesTab,
 LighthouseSEOTab,
} from './LighthouseTabs';
import { SecurityInsightsSection } from './LighthouseSharedSections';

// Opportunity item from Lighthouse audit
export interface LighthouseOpportunity {
  id: string;
  title: string;
  savings: string | number;
  details?: string;
}

// Diagnostic item from Lighthouse audit
export interface LighthouseDiagnostic {
  id: string;
  title: string;
  details?: string;
}

// Passed audit item from Lighthouse
export interface LighthousePassedAudit {
  id: string;
  title: string;
  description?: string;
  category?: string;
}

export interface LighthouseResultCardProps {
 result: TestResult;
 lighthouse: LighthouseResult;
 opportunities: LighthouseOpportunity[];
 diagnostics: LighthouseDiagnostic[];
 passedAudits: LighthousePassedAudit[];
 passedAuditsByCategory: Record<string, LighthousePassedAudit[]>;
 lighthouseActiveTab: LighthouseActiveTab;
 setLighthouseActiveTab: (tab: LighthouseActiveTab) => void;
 expandedOpportunities: Set<string>;
 toggleOpportunity: (id: string) => void;
 expandedDiagnostics: Set<string>;
 toggleDiagnostic: (id: string) => void;
 expandedPassedAudits: Set<string>;
 togglePassedAudit: (id: string) => void;
 passedAuditsCollapsed: boolean;
 setPassedAuditsCollapsed: (collapsed: boolean) => void;
 securityInsightsCollapsed: boolean;
 setSecurityInsightsCollapsed: (collapsed: boolean) => void;
 expandedMixedContentResources: boolean;
 setExpandedMixedContentResources: (expanded: boolean) => void;
 perfAILoading: boolean;
 perfAIResult: Record<string, string>;
 setPerfAIResult: React.Dispatch<React.SetStateAction<Record<string, string>>>;
 perfAIError: string | null;
 perfAIAnalysisOpen: string | null;
 analyzePerformanceResults: (testName: string, lighthouse: LighthouseResult, loadTest?: unknown) => void;
 exportLighthousePDF: (lighthouse: LighthouseResult, testName: string, url?: string) => void;
}

export const LighthouseResultCard: React.FC<LighthouseResultCardProps> = ({
 result,
 lighthouse,
 opportunities,
 diagnostics,
 passedAudits,
 passedAuditsByCategory,
 lighthouseActiveTab,
 setLighthouseActiveTab,
 expandedOpportunities,
 toggleOpportunity,
 expandedDiagnostics,
 toggleDiagnostic,
 expandedPassedAudits,
 togglePassedAudit,
 passedAuditsCollapsed,
 setPassedAuditsCollapsed,
 securityInsightsCollapsed,
 setSecurityInsightsCollapsed,
 expandedMixedContentResources,
 setExpandedMixedContentResources,
 perfAILoading,
 perfAIResult,
 setPerfAIResult,
 perfAIError,
 perfAIAnalysisOpen,
 analyzePerformanceResults,
 exportLighthousePDF,
}) => {
 // Calculate overall status based on all scores
 const scores = [
 lighthouse.performance || 0,
 lighthouse.accessibility || 0,
 lighthouse.best_practices || lighthouse.bestPractices || 0,
 lighthouse.seo || 0,
 ].filter(s => s > 0);
 const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
 const minScore = scores.length > 0 ? Math.min(...scores) : 0;
 const lighthouseStatus = minScore >= 90 ? 'excellent' :
 minScore >= 50 ? 'needs-improvement' : 'poor';

 // Get top 3 opportunities for improvement
 const topOpportunities = opportunities.slice(0, 3);

 // Get low-scoring categories
 const lowScoreCategories = [
 { name: 'Performance', score: lighthouse.performance || 0 },
 { name: 'Accessibility', score: lighthouse.accessibility || 0 },
 { name: 'Best Practices', score: lighthouse.best_practices || lighthouse.bestPractices || 0 },
 { name: 'SEO', score: lighthouse.seo || 0 },
 ].filter(c => c.score < 90).sort((a, b) => a.score - b.score);

 return (
 <div className={`bg-card border rounded-xl overflow-hidden shadow-lg shadow-black/5 ${
 lighthouseStatus === 'excellent' ? 'border-success/30' :
 lighthouseStatus === 'needs-improvement' ? 'border-warning/30' :
 'border-destructive/30'
 }`}>
 {/* Status Banner */}
 <div className={`border-b-4 ${
 lighthouseStatus === 'excellent' ? 'border-success' :
 lighthouseStatus === 'needs-improvement' ? 'border-warning' :
 'border-destructive'
 }`}>
 <div className={`p-5 bg-gradient-to-r ${
 lighthouseStatus === 'excellent' ? 'from-success/5 to-success/5' :
 lighthouseStatus === 'needs-improvement' ? 'from-warning/5 to-warning/5/50' :
 'from-destructive/5 to-rose-50/50'
 }`}>
 {/* Header row with test name and actions */}
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3">
 <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full flex items-center gap-1.5">
 <span>🔍</span> Lighthouse
 </span>
 <span className="text-xs text-muted-foreground">
 {new Date((lighthouse as LighthouseResult & { timestamp?: number }).timestamp || Date.now()).toLocaleString()}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => exportLighthousePDF(lighthouse, result.test_name, lighthouse.url)}
 className="px-3 py-1.5 text-sm bg-destructive text-primary-foreground rounded-lg hover:bg-destructive transition-colors flex items-center gap-1.5"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
 </svg>
 PDF
 </button>
 <button
 onClick={() => analyzePerformanceResults(result.test_name, lighthouse)}
 disabled={perfAILoading && perfAIAnalysisOpen === result.test_name}
 className="px-3 py-1.5 text-sm bg-gradient-to-r from-accent to-accent/80 text-primary-foreground rounded-lg hover:from-accent/90 hover:to-accent/70 transition-colors flex items-center gap-1.5 disabled:opacity-50"
 >
 {perfAILoading && perfAIAnalysisOpen === result.test_name ? (
 <>
 <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 Analyzing...
 </>
 ) : (
 <>
 <span>🤖</span>
 AI Analysis
 </>
 )}
 </button>
 </div>
 </div>

 <h4 className="text-xl font-semibold text-foreground mb-1">{result.test_name}</h4>
 {lighthouse.url && (
 <div className="text-sm text-muted-foreground font-mono mb-4">
 🌐 {lighthouse.url}
 </div>
 )}

 {/* Quick Summary Pills */}
 <div className="flex flex-wrap items-center gap-2 mb-4">
 <div className={`px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 ${
 lighthouseStatus === 'excellent' ? 'bg-success/10 text-success' :
 lighthouseStatus === 'needs-improvement' ? 'bg-warning/10 text-warning' :
 'bg-destructive/10 text-destructive'
 }`}>
 {lighthouseStatus === 'excellent' ? '✅' : lighthouseStatus === 'needs-improvement' ? '⚠️' : '❌'}
 {lighthouseStatus === 'excellent' ? 'EXCELLENT' : lighthouseStatus === 'needs-improvement' ? 'NEEDS WORK' : 'POOR'}
 </div>
 <span className="text-sm text-muted-foreground">
 Avg Score: <strong className="text-foreground">{avgScore}</strong>
 </span>
 </div>

 {/* AI Analysis Result */}
 {perfAIResult[result.test_name] && (
 <div className="p-4 bg-gradient-to-r from-accent/5 to-accent/10 border border-accent/20 rounded-xl mb-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <span className="text-xl">🤖</span>
 <h4 className="font-semibold text-accent">AI Performance Analysis</h4>
 </div>
 <button
 onClick={() => setPerfAIResult(prev => {
 const newResult = { ...prev };
 delete newResult[result.test_name];
 return newResult;
 })}
 className="text-muted-foreground hover:text-foreground p-1"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 <div className="prose prose-sm max-w-none">
 <div className="whitespace-pre-wrap text-sm text-foreground">
 {perfAIResult[result.test_name]}
 </div>
 </div>
 </div>
 )}

 {/* Top opportunities for low-performing pages */}
 {topOpportunities.length > 0 && lighthouseStatus !== 'excellent' && (
 <div className="bg-white/50 rounded-lg p-3 border border-current/10">
 <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Quick Wins</h5>
 {topOpportunities.map((opp, i) => (
 <div key={opp.id} className="flex items-center justify-between py-1">
 <span className="text-sm text-foreground truncate flex-1">{opp.title}</span>
 <span className={`text-xs font-semibold ml-2 ${
 parseFloat(String(opp.savings)) > 1 ? 'text-warning' :
 'text-warning'
 }`}>
 Save {opp.savings}
 </span>
 </div>
 ))}
 </div>
 )}

 {/* One-liner Summary */}
 <div className="pt-4 border-t border-current/10">
 <p className="text-sm text-muted-foreground italic">
 📊 <strong>Summary:</strong>{' '}
 {lighthouseStatus === 'excellent'
 ? `This page excels across all Lighthouse categories with an average score of ${avgScore}. It provides a fast, accessible, and SEO-friendly experience.`
 : lighthouseStatus === 'needs-improvement'
 ? `This page has an average score of ${avgScore}. Focus on ${lowScoreCategories[0]?.name || 'performance'} (${lowScoreCategories[0]?.score || 0}) to achieve the biggest improvement${topOpportunities[0] ? ` - fixing "${topOpportunities[0].title}" could save ${topOpportunities[0].savings}` : ''}.`
 : `Critical performance issues detected with an average score of ${avgScore}. ${lowScoreCategories.filter(c => c.score < 50).map(c => c.name).join(' and ')} need${lowScoreCategories.filter(c => c.score < 50).length === 1 ? 's' : ''} immediate attention.`
 }
 </p>
 </div>
 </div>

 {/* Tabbed Interface for Lighthouse Results */}
 <div className="border-b border-border">
 <nav className="flex overflow-x-auto px-6 -mb-px">
 {[
 { id: 'overview' as const, label: 'Overview', icon: '📊' },
 { id: 'performance' as const, label: 'Performance', icon: '⚡' },
 { id: 'accessibility' as const, label: 'Accessibility', icon: '♿' },
 { id: 'best_practices' as const, label: 'Best Practices', icon: '✓' },
 { id: 'seo' as const, label: 'SEO', icon: '🔍' },
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setLighthouseActiveTab(tab.id)}
 className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
 lighthouseActiveTab === tab.id
 ? 'border-primary text-primary'
 : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
 }`}
 >
 <span>{tab.icon}</span>
 {tab.label}
 </button>
 ))}
 </nav>
 </div>

 <div className="p-6">
 {/* Overview Tab */}
 {lighthouseActiveTab === 'overview' && (
 <LighthouseOverviewTab
 lighthouse={lighthouse}
 opportunities={opportunities}
 diagnostics={diagnostics}
 expandedOpportunities={expandedOpportunities}
 toggleOpportunity={toggleOpportunity}
 expandedDiagnostics={expandedDiagnostics}
 toggleDiagnostic={toggleDiagnostic}
 />
 )}

 {/* Performance Tab */}
 {lighthouseActiveTab === 'performance' && (
 <LighthousePerformanceTab
 lighthouse={lighthouse}
 opportunities={opportunities}
 diagnostics={diagnostics}
 expandedOpportunities={expandedOpportunities}
 toggleOpportunity={toggleOpportunity}
 expandedDiagnostics={expandedDiagnostics}
 toggleDiagnostic={toggleDiagnostic}
 />
 )}

 {/* Accessibility Tab */}
 {lighthouseActiveTab === 'accessibility' && (
 <LighthouseAccessibilityTab
 lighthouse={lighthouse}
 passedAudits={passedAudits}
 />
 )}

 {/* Best Practices Tab */}
 {lighthouseActiveTab === 'best_practices' && (
 <LighthouseBestPracticesTab
 lighthouse={lighthouse}
 passedAudits={passedAudits}
 />
 )}

 {/* SEO Tab */}
 {lighthouseActiveTab === 'seo' && (
 <LighthouseSEOTab
 lighthouse={lighthouse}
 passedAudits={passedAudits}
 />
 )}

 {/* Security Insights section */}
 {(lighthouse.csp || lighthouse.mixedContent || lighthouse.authentication) && (
 <SecurityInsightsSection
 lighthouse={lighthouse}
 securityInsightsCollapsed={securityInsightsCollapsed}
 setSecurityInsightsCollapsed={setSecurityInsightsCollapsed}
 expandedMixedContentResources={expandedMixedContentResources}
 setExpandedMixedContentResources={setExpandedMixedContentResources}
 />
 )}
 </div>
 </div>
 </div>
 );
};
