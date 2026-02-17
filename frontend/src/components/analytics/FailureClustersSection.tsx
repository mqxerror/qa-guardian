// Feature #515: Extracted from AnalyticsPage.tsx
// Failure Clusters Section Component (Feature #1075)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFailureClusters } from '../../hooks/api/useAnalytics';
import type { FailureCluster } from './types';

interface FailureClustersSectionProps {
  token: string | null;
}

// Get cluster icon based on pattern type
const getClusterIcon = (patternType: string): string => {
  const icons: Record<string, string> = {
    'Network Issues': '🌐',
    'Timing/Race Conditions': '⏱️',
    'Data Issues': '📊',
    'Element Locator Issues': '🔍',
    'Environment Issues': '⚙️',
    'Timeout': '⏱️',
    'Element Not Found': '🔍',
    'Network': '🌐',
    'Navigation': '🧭',
    'Assertion': '❌',
    'Click': '👆',
    'Selector': '🎯',
    'Authentication': '🔐',
    'Server': '🖥️',
    'Rate Limit': '🚫',
    'Other': '❓',
  };
  return icons[patternType] || '❓';
};

const getClusterColor = (patternType: string): string => {
  const colors: Record<string, string> = {
    'Network Issues': 'bg-info/15 text-info border-info/30',
    'Timing/Race Conditions': 'bg-warning/15 text-warning border-warning/30',
    'Data Issues': 'bg-primary/15 text-primary border-primary/30',
    'Element Locator Issues': 'bg-destructive/15 text-destructive border-destructive/30',
    'Environment Issues': 'bg-muted text-muted-foreground border-border',
    'Timeout': 'bg-warning/15 text-warning border-warning/30',
    'Element Not Found': 'bg-destructive/15 text-destructive border-destructive/30',
    'Network': 'bg-info/15 text-info border-info/30',
  };
  return colors[patternType] || 'bg-muted text-muted-foreground border-border';
};

export function FailureClustersSection(_props: FailureClustersSectionProps) {
  const navigate = useNavigate();
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 14 | 30>(7);

  // Feature #72: Use React Query hook for caching
  const { data: clustersData, isLoading } = useFailureClusters(days);
  const clusters = (clustersData?.clusters || []) as FailureCluster[];

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
            AI Failure Clusters
          </h3>
          <p className="text-sm text-muted-foreground">
            AI-grouped failures with similar patterns across your test runs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 14 | 30)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Analyzing failure patterns...</p>
        </div>
      ) : clusters.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground font-medium">No failure clusters found!</p>
          <p className="text-sm text-muted-foreground mt-2">
            Either your tests are all passing, or failures are too few to cluster. Great job!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Cluster Overview */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <span>📊</span>
                Cluster Overview
              </h4>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-2 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-foreground">{clusters.length}</div>
                <div className="text-xs text-muted-foreground">Clusters</div>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-destructive">
                  {clusters.reduce((sum, c) => sum + c.count, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Total Failures</div>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-warning">
                  {new Set(clusters.flatMap(c => c.affected_tests)).size}
                </div>
                <div className="text-xs text-muted-foreground">Tests Affected</div>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-foreground">
                  {Math.max(...clusters.map(c => c.count))}
                </div>
                <div className="text-xs text-muted-foreground">Largest Cluster</div>
              </div>
            </div>
          </div>

          {/* Cluster List */}
          {clusters.map((cluster) => (
            <div
              key={cluster.cluster_id}
              className={`rounded-lg border bg-card overflow-hidden transition-all ${getClusterColor(cluster.pattern_type).split(' ').slice(0, 3).join(' ')}`}
            >
              {/* Cluster Header */}
              <div
                className="p-4 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedCluster(expandedCluster === cluster.cluster_id ? null : cluster.cluster_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getClusterIcon(cluster.pattern_type)}</span>
                    <div>
                      <h4 className="font-semibold text-foreground">{cluster.cluster_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {cluster.affected_tests.length} affected test{cluster.affected_tests.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-2xl font-bold text-foreground">{cluster.count}</span>
                      <span className="text-sm text-muted-foreground ml-1">failure{cluster.count !== 1 ? 's' : ''}</span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-muted-foreground transition-transform ${expandedCluster === cluster.cluster_id ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>First seen: {new Date(cluster.first_seen).toLocaleString()}</span>
                  <span>|</span>
                  <span>Last seen: {new Date(cluster.last_seen).toLocaleString()}</span>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedCluster === cluster.cluster_id && (
                <div className="border-t border-border bg-background/50 p-4">
                  <h5 className="text-sm font-medium text-foreground mb-3">Recent Failures</h5>
                  <div className="space-y-2">
                    {cluster.failures.slice(0, 5).map((failure, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-md bg-card border border-border hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/tests/${failure.test_id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{failure.test_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {failure.suite_name} / {failure.project_name}
                            </p>
                            <p className="text-xs text-destructive mt-1 truncate" title={failure.error_message}>
                              {failure.error_message.slice(0, 100)}{failure.error_message.length > 100 ? '...' : ''}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                            {new Date(failure.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    {cluster.failures.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        + {cluster.failures.length - 5} more failures
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
