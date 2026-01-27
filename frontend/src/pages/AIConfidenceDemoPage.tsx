// ============================================================================
// FEATURE #1279: AI Confidence Indicators & Demo Page
// Extracted from App.tsx for code quality compliance (Feature #1357)
// ============================================================================

import React, { useState } from 'react';
import { Layout } from '../components/Layout';

// Types
interface AIConfidenceIndicatorProps {
  confidence: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  explanation?: string;
}

interface AIConfidenceBadgeProps {
  confidence: number;
  type?: 'prediction' | 'analysis' | 'suggestion' | 'detection';
}

// AI Confidence Indicator Component
export function AIConfidenceIndicator({
  confidence,
  label,
  showPercentage = true,
  size = 'md',
  explanation
}: AIConfidenceIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Color coding based on confidence level
  const getColorClasses = () => {
    if (confidence >= 90) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
    if (confidence >= 75) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    if (confidence >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
    if (confidence >= 40) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
  };

  const getConfidenceLabel = () => {
    if (confidence >= 90) return 'Very High';
    if (confidence >= 75) return 'High';
    if (confidence >= 60) return 'Moderate';
    if (confidence >= 40) return 'Low';
    return 'Very Low';
  };

  const getDefaultExplanation = () => {
    if (confidence >= 90) return 'AI is highly confident in this prediction based on strong pattern matches and historical data.';
    if (confidence >= 75) return 'AI has good confidence in this prediction with substantial supporting evidence.';
    if (confidence >= 60) return 'AI has moderate confidence. Consider reviewing the supporting evidence.';
    if (confidence >= 40) return 'AI has low confidence. This prediction should be verified manually.';
    return 'AI has very low confidence. Treat this as a suggestion only and verify independently.';
  };

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  return (
    <div className="relative inline-block">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border cursor-help transition-all ${getColorClasses()} ${sizeClasses[size]}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* AI Icon */}
        <span className="text-xs">🤖</span>

        {/* Confidence Bar */}
        <div className="w-8 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              confidence >= 90 ? 'bg-green-500' :
              confidence >= 75 ? 'bg-blue-500' :
              confidence >= 60 ? 'bg-yellow-500' :
              confidence >= 40 ? 'bg-orange-500' :
              'bg-red-500'
            }`}
            style={{ width: `${confidence}%` }}
          />
        </div>

        {/* Label or Percentage */}
        {showPercentage && <span className="font-medium">{confidence}%</span>}
        {label && <span className="font-medium">{label}</span>}
      </div>

      {/* Tooltip on Hover */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-popover border border-border shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getColorClasses()}`}>
              {getConfidenceLabel()} Confidence
            </span>
            <span className="text-sm font-bold text-foreground">{confidence}%</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {explanation || getDefaultExplanation()}
          </p>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-border" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-[1px] border-8 border-transparent border-t-popover" />
          </div>
        </div>
      )}
    </div>
  );
}

// AI Confidence Badge - Compact version
export function AIConfidenceBadge({ confidence, type = 'prediction' }: AIConfidenceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getColorClasses = () => {
    if (confidence >= 90) return 'bg-green-500 text-white';
    if (confidence >= 75) return 'bg-blue-500 text-white';
    if (confidence >= 60) return 'bg-yellow-500 text-white';
    if (confidence >= 40) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'prediction': return 'Prediction Confidence';
      case 'analysis': return 'Analysis Confidence';
      case 'suggestion': return 'Suggestion Confidence';
      case 'detection': return 'Detection Confidence';
      default: return 'AI Confidence';
    }
  };

  const getExplanation = () => {
    const levelDesc = confidence >= 90 ? 'very high' :
                      confidence >= 75 ? 'high' :
                      confidence >= 60 ? 'moderate' :
                      confidence >= 40 ? 'low' : 'very low';

    switch (type) {
      case 'prediction':
        return `AI ${levelDesc} confidence that this prediction will be accurate based on historical patterns and data analysis.`;
      case 'analysis':
        return `AI ${levelDesc} confidence in this analysis based on code patterns, test history, and error signatures.`;
      case 'suggestion':
        return `AI ${levelDesc} confidence that this suggestion will resolve the issue based on similar past cases.`;
      case 'detection':
        return `AI ${levelDesc} confidence in this detection based on pattern matching and anomaly analysis.`;
      default:
        return `AI ${levelDesc} confidence level for this insight.`;
    }
  };

  return (
    <div className="relative inline-block">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-help ${getColorClasses()}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        🤖 {confidence}%
      </span>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-lg bg-popover border border-border shadow-lg">
          <p className="text-xs font-medium text-foreground mb-1">{getTypeLabel()}</p>
          <p className="text-xs text-muted-foreground">{getExplanation()}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-border" />
          </div>
        </div>
      )}
    </div>
  );
}

// AI Confidence Card - For larger displays
export function AIConfidenceCard({
  title,
  confidence,
  type,
  details
}: {
  title: string;
  confidence: number;
  type: 'prediction' | 'analysis' | 'suggestion' | 'detection';
  details?: string[];
}) {
  const getColorClasses = () => {
    if (confidence >= 90) return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20';
    if (confidence >= 75) return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20';
    if (confidence >= 60) return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20';
    if (confidence >= 40) return 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20';
    return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
  };

  const getProgressColor = () => {
    if (confidence >= 90) return 'bg-green-500';
    if (confidence >= 75) return 'bg-blue-500';
    if (confidence >= 60) return 'bg-yellow-500';
    if (confidence >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getConfidenceLevel = () => {
    if (confidence >= 90) return { label: 'Very High', icon: '✓✓' };
    if (confidence >= 75) return { label: 'High', icon: '✓' };
    if (confidence >= 60) return { label: 'Moderate', icon: '~' };
    if (confidence >= 40) return { label: 'Low', icon: '!' };
    return { label: 'Very Low', icon: '!!' };
  };

  const level = getConfidenceLevel();

  return (
    <div className={`rounded-lg border p-4 ${getColorClasses()}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{type}</p>
          <h4 className="font-semibold text-foreground">{title}</h4>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground">{confidence}%</p>
          <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
            <span>{level.icon}</span> {level.label}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${getProgressColor()}`}
          style={{ width: `${confidence}%` }}
        />
      </div>

      {/* Details */}
      {details && details.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Contributing Factors:</p>
          {details.map((detail, idx) => (
            <p key={idx} className="text-xs text-foreground flex items-start gap-1">
              <span className="text-primary mt-0.5">•</span>
              {detail}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// AI Confidence Demo Page
export function AIConfidenceDemoPage() {
  return (
    <Layout>
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🤖 AI Confidence Indicators</h1>
          <p className="text-muted-foreground mt-1">Visual indicators showing AI confidence levels throughout the application</p>
        </div>

        {/* Inline Indicators */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold text-lg text-foreground mb-4">Inline Confidence Indicators</h2>
          <p className="text-sm text-muted-foreground mb-4">Hover over each indicator to see the explanation</p>

          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-foreground">Very High (90%+):</span>
              <AIConfidenceIndicator confidence={95} />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-foreground">High (75-89%):</span>
              <AIConfidenceIndicator confidence={82} />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-foreground">Moderate (60-74%):</span>
              <AIConfidenceIndicator confidence={67} />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-foreground">Low (40-59%):</span>
              <AIConfidenceIndicator confidence={48} />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-foreground">Very Low (&lt;40%):</span>
              <AIConfidenceIndicator confidence={25} />
            </div>
          </div>
        </div>

        {/* Compact Badges */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold text-lg text-foreground mb-4">Compact Confidence Badges</h2>
          <p className="text-sm text-muted-foreground mb-4">Different badge types for various AI outputs</p>

          <div className="flex items-center gap-4 flex-wrap">
            <AIConfidenceBadge confidence={94} type="prediction" />
            <AIConfidenceBadge confidence={78} type="analysis" />
            <AIConfidenceBadge confidence={65} type="suggestion" />
            <AIConfidenceBadge confidence={45} type="detection" />
            <AIConfidenceBadge confidence={30} type="prediction" />
          </div>
        </div>

        {/* Size Variants */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold text-lg text-foreground mb-4">Size Variants</h2>

          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Small</p>
              <AIConfidenceIndicator confidence={88} size="sm" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Medium (default)</p>
              <AIConfidenceIndicator confidence={88} size="md" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Large</p>
              <AIConfidenceIndicator confidence={88} size="lg" />
            </div>
          </div>
        </div>

        {/* Confidence Cards */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold text-lg text-foreground mb-4">Confidence Cards</h2>
          <p className="text-sm text-muted-foreground mb-4">Detailed confidence display with contributing factors</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AIConfidenceCard
              title="Test Will Fail"
              confidence={91}
              type="prediction"
              details={[
                'Similar code changes caused failures 89% of the time',
                'Affected component has high test coupling',
                'Recent API changes detected in dependencies'
              ]}
            />
            <AIConfidenceCard
              title="Root Cause Identified"
              confidence={76}
              type="analysis"
              details={[
                'Error signature matches known pattern',
                'Stack trace analysis completed',
                'Historical correlation found'
              ]}
            />
            <AIConfidenceCard
              title="Suggested Fix"
              confidence={62}
              type="suggestion"
              details={[
                'Fix applied successfully in similar cases',
                'No side effects detected in simulation',
                'Requires manual verification'
              ]}
            />
            <AIConfidenceCard
              title="Flaky Test Detected"
              confidence={38}
              type="detection"
              details={[
                'Limited historical data available',
                'Inconsistent failure patterns',
                'May require more test runs to confirm'
              ]}
            />
          </div>
        </div>

        {/* Example in Context */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold text-lg text-foreground mb-4">Example: AI Insights in Context</h2>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">Checkout Flow Test Suite</p>
                  <p className="text-sm text-muted-foreground">5 tests • Last run: 2 hours ago</p>
                </div>
                <AIConfidenceBadge confidence={87} type="prediction" />
              </div>
              <p className="text-sm text-foreground mt-3">
                AI predicts this test suite has an <strong>87% chance of passing</strong> on the next run based on recent code changes and historical performance.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">Suggested Selector Fix</p>
                  <p className="text-sm text-muted-foreground">For: login-flow.spec.ts:45</p>
                </div>
                <AIConfidenceIndicator confidence={73} size="sm" />
              </div>
              <p className="text-sm text-foreground mt-3">
                Replace <code className="px-1 py-0.5 bg-muted rounded">.login-btn</code> with <code className="px-1 py-0.5 bg-muted rounded">[data-testid="login-button"]</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
