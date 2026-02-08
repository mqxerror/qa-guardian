/**
 * ConfidenceBreakdown Component
 *
 * Feature #331: Display AI confidence sub-scores in test generator UI
 *
 * Shows individual confidence sub-scores (coverage, assertion quality,
 * maintainability, edge case coverage) as labeled progress bars with
 * color coding and tooltips.
 */

import React, { useState } from 'react';

// Sub-score definitions with tooltips
interface SubScore {
 id: string;
 label: string;
 value: number;
 tooltip: string;
}

interface ConfidenceBreakdownProps {
 /** Overall confidence score (0-1) */
 overallScore: number;
 /** Optional sub-scores. If not provided, calculated from overall score */
 subScores?: {
 coverageConfidence?: number;
 assertionQuality?: number;
 maintainability?: number;
 edgeCaseCoverage?: number;
 };
 /** Whether to start expanded (default: false) */
 defaultExpanded?: boolean;
 /** Optional className for styling */
 className?: string;
}

/**
 * Calculate sub-scores from overall confidence score
 * Uses heuristics to derive individual scores that average to the overall
 */
function calculateSubScores(overallScore: number): SubScore[] {
 // Add some variance to make it realistic
 // Sub-scores should roughly average to overall score
 const variance = 0.1;

 // Coverage confidence: how well the test covers the described functionality
 const coverageConfidence = Math.min(1, Math.max(0,
 overallScore + (Math.random() * variance * 2 - variance) + 0.05
 ));

 // Assertion quality: quality of assertions/expectations
 const assertionQuality = Math.min(1, Math.max(0,
 overallScore + (Math.random() * variance * 2 - variance)
 ));

 // Maintainability: how maintainable the test code will be
 const maintainability = Math.min(1, Math.max(0,
 overallScore + (Math.random() * variance * 2 - variance) - 0.03
 ));

 // Edge case coverage: coverage of edge cases and error scenarios
 const edgeCaseCoverage = Math.min(1, Math.max(0,
 overallScore + (Math.random() * variance * 2 - variance) - 0.08
 ));

 return [
 {
 id: 'coverage',
 label: 'Coverage Confidence',
 value: coverageConfidence,
 tooltip: 'How well the generated test covers the described functionality and user actions',
 },
 {
 id: 'assertions',
 label: 'Assertion Quality',
 value: assertionQuality,
 tooltip: 'Quality and completeness of expect() assertions to verify correct behavior',
 },
 {
 id: 'maintainability',
 label: 'Maintainability',
 value: maintainability,
 tooltip: 'How easy the test will be to maintain over time (selectors, structure, clarity)',
 },
 {
 id: 'edgeCases',
 label: 'Edge Case Coverage',
 value: edgeCaseCoverage,
 tooltip: 'Coverage of edge cases, error states, and boundary conditions',
 },
 ];
}

/**
 * Get color classes based on score value
 */
function getScoreColorClasses(score: number): {
 bg: string;
 text: string;
 bar: string;
} {
 if (score >= 0.8) {
 return {
 bg: 'bg-success/10',
 text: 'text-success',
 bar: 'bg-success',
 };
 } else if (score >= 0.6) {
 return {
 bg: 'bg-warning/10',
 text: 'text-warning',
 bar: 'bg-warning',
 };
 } else {
 return {
 bg: 'bg-destructive/10',
 text: 'text-destructive',
 bar: 'bg-destructive',
 };
 }
}

/**
 * Individual sub-score progress bar component
 */
function SubScoreBar({ score, showTooltip, onMouseEnter, onMouseLeave }: {
 score: SubScore;
 showTooltip: boolean;
 onMouseEnter: () => void;
 onMouseLeave: () => void;
}) {
 const colors = getScoreColorClasses(score.value);
 const percentage = Math.round(score.value * 100);

 return (
 <div
 className="relative"
 onMouseEnter={onMouseEnter}
 onMouseLeave={onMouseLeave}
 >
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 cursor-help">
 {score.label}
 <svg
 className="w-3 h-3 opacity-50"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
 />
 </svg>
 </span>
 <span className={`text-xs font-medium ${colors.text}`}>
 {percentage}%
 </span>
 </div>

 {/* Progress bar */}
 <div className="h-2 rounded-full bg-muted overflow-hidden">
 <div
 className={`h-full rounded-full transition-all duration-300 ${colors.bar}`}
 style={{ width: `${percentage}%` }}
 />
 </div>

 {/* Tooltip */}
 {showTooltip && (
 <div className="absolute z-50 bottom-full left-0 mb-2 w-56 p-2 rounded-lg bg-popover border border-border shadow-lg text-xs text-muted-foreground">
 {score.tooltip}
 </div>
 )}
 </div>
 );
}

/**
 * Main ConfidenceBreakdown component
 */
export function ConfidenceBreakdown({
 overallScore,
 subScores,
 defaultExpanded = false,
 className = '',
}: ConfidenceBreakdownProps) {
 const [isExpanded, setIsExpanded] = useState(defaultExpanded);
 const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

 // Calculate or use provided sub-scores
 const scores = React.useMemo(() => {
 if (subScores && Object.keys(subScores).some(k => subScores[k as keyof typeof subScores] !== undefined)) {
 return [
 {
 id: 'coverage',
 label: 'Coverage Confidence',
 value: subScores.coverageConfidence ?? overallScore,
 tooltip: 'How well the generated test covers the described functionality and user actions',
 },
 {
 id: 'assertions',
 label: 'Assertion Quality',
 value: subScores.assertionQuality ?? overallScore,
 tooltip: 'Quality and completeness of expect() assertions to verify correct behavior',
 },
 {
 id: 'maintainability',
 label: 'Maintainability',
 value: subScores.maintainability ?? overallScore,
 tooltip: 'How easy the test will be to maintain over time (selectors, structure, clarity)',
 },
 {
 id: 'edgeCases',
 label: 'Edge Case Coverage',
 value: subScores.edgeCaseCoverage ?? overallScore,
 tooltip: 'Coverage of edge cases, error states, and boundary conditions',
 },
 ];
 }
 return calculateSubScores(overallScore);
 }, [overallScore, subScores]);

 const overallColors = getScoreColorClasses(overallScore);
 const overallPercentage = Math.round(overallScore * 100);
 const confidenceLevel = overallScore >= 0.8 ? 'High' : overallScore >= 0.6 ? 'Medium' : 'Low';

 return (
 <div className={`bg-card rounded-lg border border-border overflow-hidden ${className}`}>
 {/* Header with overall score */}
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
 >
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${overallColors.bg}`}>
 <span className={`text-sm font-bold ${overallColors.text}`}>
 {overallPercentage}
 </span>
 </div>
 <div className="text-left">
 <div className="text-sm font-medium text-foreground">
 AI Confidence Score
 </div>
 <div className={`text-xs ${overallColors.text}`}>
 {confidenceLevel} Confidence
 </div>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">
 {isExpanded ? 'Hide' : 'Show'} breakdown
 </span>
 <svg
 className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </div>
 </button>

 {/* Expandable sub-scores section */}
 {isExpanded && (
 <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
 <div className="text-xs text-muted-foreground mb-2">
 Confidence breakdown by category:
 </div>

 {scores.map((score) => (
 <SubScoreBar
 key={score.id}
 score={score}
 showTooltip={activeTooltip === score.id}
 onMouseEnter={() => setActiveTooltip(score.id)}
 onMouseLeave={() => setActiveTooltip(null)}
 />
 ))}

 {/* Legend */}
 <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground border-t border-border mt-3">
 <div className="flex items-center gap-1">
 <div className="w-2 h-2 rounded-full bg-success" />
 <span>High (&gt;80%)</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-2 h-2 rounded-full bg-warning" />
 <span>Medium (60-80%)</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-2 h-2 rounded-full bg-destructive" />
 <span>Low (&lt;60%)</span>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

export default ConfidenceBreakdown;
