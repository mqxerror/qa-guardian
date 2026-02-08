/**
 * Quality Health Card Component
 * Feature #468: Dashboard quality health summary with traffic-light indicator
 *
 * Displays a synthesized quality assessment based on:
 * - Pass rate (primary factor)
 * - Security vulnerabilities (if available)
 * - Flaky test percentage (if available)
 *
 * Uses semantic design tokens for colors.
 */

import { useMemo } from 'react';
import { AnimatedCard, CardContent } from '../ui';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface QualityHealthData {
  passRate: number;
  totalRuns?: number;
  passedRuns?: number;
  failedRuns?: number;
  // Optional: security vulnerabilities count
  openVulnerabilities?: number;
  criticalVulnerabilities?: number;
  // Optional: flaky test info
  flakyTestCount?: number;
  totalTests?: number;
}

export interface QualityHealthCardProps {
  data: QualityHealthData;
  isLoading?: boolean;
  className?: string;
}

// ============================================================
// Health Score Calculation
// ============================================================

type HealthStatus = 'healthy' | 'warning' | 'critical';

interface HealthResult {
  score: number;
  status: HealthStatus;
  trend: 'up' | 'down' | 'neutral';
  summary: string[];
}

function calculateHealthScore(data: QualityHealthData): HealthResult {
  let score = 100;
  const issues: string[] = [];
  const positives: string[] = [];

  // Pass rate is the primary factor (0-50 points)
  // > 95% = 50 points (green)
  // 85-95% = 35-50 points (yellow)
  // < 85% = 0-35 points (red)
  if (data.passRate >= 95) {
    score = 100;
    positives.push(`${data.passRate.toFixed(1)}% pass rate - excellent`);
  } else if (data.passRate >= 85) {
    score = 70 + ((data.passRate - 85) / 10) * 30; // 70-100
    issues.push(`${data.passRate.toFixed(1)}% pass rate - needs improvement`);
  } else if (data.passRate >= 70) {
    score = 50 + ((data.passRate - 70) / 15) * 20; // 50-70
    issues.push(`${data.passRate.toFixed(1)}% pass rate - attention needed`);
  } else {
    score = Math.max(0, (data.passRate / 70) * 50); // 0-50
    issues.push(`${data.passRate.toFixed(1)}% pass rate - critical`);
  }

  // Security vulnerabilities factor (-20 points max)
  if (data.criticalVulnerabilities && data.criticalVulnerabilities > 0) {
    score -= Math.min(20, data.criticalVulnerabilities * 10);
    issues.push(`${data.criticalVulnerabilities} critical vulnerabilities`);
  } else if (data.openVulnerabilities && data.openVulnerabilities > 0) {
    score -= Math.min(10, data.openVulnerabilities * 2);
    issues.push(`${data.openVulnerabilities} open vulnerabilities`);
  } else if (data.openVulnerabilities === 0) {
    positives.push('No security vulnerabilities');
  }

  // Flaky test factor (-15 points max)
  if (data.flakyTestCount && data.totalTests) {
    const flakyPercentage = (data.flakyTestCount / data.totalTests) * 100;
    if (flakyPercentage > 10) {
      score -= 15;
      issues.push(`${flakyPercentage.toFixed(1)}% flaky tests - high`);
    } else if (flakyPercentage > 5) {
      score -= 10;
      issues.push(`${flakyPercentage.toFixed(1)}% flaky tests`);
    } else if (flakyPercentage > 0) {
      score -= 5;
    }
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine status
  let status: HealthStatus;
  if (score >= 85) {
    status = 'healthy';
  } else if (score >= 60) {
    status = 'warning';
  } else {
    status = 'critical';
  }

  // Determine trend based on pass rate
  let trend: 'up' | 'down' | 'neutral';
  if (data.passRate >= 90) {
    trend = 'up';
  } else if (data.passRate >= 70) {
    trend = 'neutral';
  } else {
    trend = 'down';
  }

  // Build summary (max 3 items)
  const summary = [...issues.slice(0, 2), ...positives.slice(0, 1)].slice(0, 3);
  if (summary.length === 0) {
    summary.push('All systems nominal');
  }

  return { score: Math.round(score), status, trend, summary };
}

// ============================================================
// Component
// ============================================================

export function QualityHealthCard({ data, isLoading, className }: QualityHealthCardProps) {
  const health = useMemo(() => calculateHealthScore(data), [data]);

  // Status colors using semantic tokens
  const statusColors = {
    healthy: {
      ring: 'ring-success',
      bg: 'bg-success',
      text: 'text-success',
      lightBg: 'bg-success/10',
    },
    warning: {
      ring: 'ring-warning',
      bg: 'bg-warning',
      text: 'text-warning',
      lightBg: 'bg-warning/10',
    },
    critical: {
      ring: 'ring-destructive',
      bg: 'bg-destructive',
      text: 'text-destructive',
      lightBg: 'bg-destructive/10',
    },
  };

  const colors = statusColors[health.status];

  const TrendIcon = health.trend === 'up' ? TrendingUp : health.trend === 'down' ? TrendingDown : Minus;
  const trendColor = health.trend === 'up' ? 'text-success' : health.trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  if (isLoading) {
    return (
      <div className={`h-44 bg-muted/50 rounded-lg animate-pulse ${className}`} />
    );
  }

  return (
    <AnimatedCard variant="hero" className={className}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Traffic Light Indicator */}
          <div className="relative">
            {/* Outer ring with glow effect */}
            <div className={`w-20 h-20 rounded-full ${colors.lightBg} ring-4 ${colors.ring} ring-opacity-50 flex items-center justify-center`}>
              {/* Score display */}
              <div className="text-center">
                <div className={`text-2xl font-bold ${colors.text}`}>
                  {health.score}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Score
                </div>
              </div>
            </div>
            {/* Trend arrow positioned at bottom-right */}
            <div className={`absolute -bottom-1 -right-1 p-1 rounded-full bg-background border border-border ${trendColor}`}>
              <TrendIcon className="w-3 h-3" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Activity className={`w-4 h-4 ${colors.text}`} />
              <h3 className="font-semibold text-foreground">Quality Health</h3>
            </div>

            <div className={`text-sm font-medium ${colors.text} mb-3`}>
              {health.status === 'healthy' && 'Healthy'}
              {health.status === 'warning' && 'Needs Attention'}
              {health.status === 'critical' && 'Critical'}
            </div>

            {/* Summary items */}
            <div className="space-y-1">
              {health.summary.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.includes('critical') || item.includes('attention') || item.includes('vulnerabilities') ? (
                    <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0" />
                  ) : item.includes('excellent') || item.includes('No security') || item.includes('nominal') ? (
                    <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" />
                  ) : (
                    <Shield className="w-3 h-3 flex-shrink-0" />
                  )}
                  <span className="truncate">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom stats bar */}
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-success" />
              {data.passedRuns ?? 0} passed
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-destructive" />
              {data.failedRuns ?? 0} failed
            </span>
          </div>
          <span>{data.totalRuns ?? 0} total runs</span>
        </div>
      </CardContent>
    </AnimatedCard>
  );
}

export default QualityHealthCard;
