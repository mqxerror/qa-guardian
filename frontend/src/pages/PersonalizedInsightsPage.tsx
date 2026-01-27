// Feature #1259: Personalized Insights per Team Member
// Extracted from App.tsx for code quality compliance

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';

// Types for personalized insights
interface PersonalizedInsight {
  id: string;
  type: 'test_status' | 'code_impact' | 'team_coverage' | 'flaky_alert' | 'recommendation';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  data?: {
    tests?: Array<{ name: string; status: 'passed' | 'failed' | 'flaky'; suite: string; lastRun: string }>;
    codeImpact?: Array<{ file: string; testsAffected: number; status: 'passing' | 'failing' | 'mixed' }>;
    teamCoverage?: { total: number; covered: number; percentage: number; trend: 'up' | 'down' | 'stable' };
    recommendation?: string;
  };
  timestamp: Date;
  forRoles: ('owner' | 'admin' | 'developer' | 'viewer')[];
}

export function PersonalizedInsightsPage() {
  const { user, token } = useAuthStore();
  const [insights, setInsights] = useState<PersonalizedInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week' | 'month'>('today');
  const [showAllInsights, setShowAllInsights] = useState(false);

  // Feature #1545: Fetch real personalized insights from API
  // Falls back to demo data if API is unavailable
  useEffect(() => {
    const loadInsights = async () => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/v1/ai-insights/personalized?timeframe=${selectedTimeframe}&show_all=${showAllInsights}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.insights && data.insights.length > 0) {
          // Convert timestamp strings to Date objects
          const formattedInsights = data.insights.map((insight: any) => ({
            ...insight,
            timestamp: new Date(insight.timestamp),
          }));
          setInsights(formattedInsights);
        } else {
          throw new Error('No insights in response');
        }
      } catch (error) {
        console.error('Failed to fetch personalized insights:', error);
        // No fallback data - show empty state when API fails
        setInsights([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadInsights();
  }, [token, user?.role, selectedTimeframe, showAllInsights]);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'test_status':
        return '🧪';
      case 'code_impact':
        return '💻';
      case 'team_coverage':
        return '📊';
      case 'flaky_alert':
        return '⚠️';
      case 'recommendation':
        return '💡';
      default:
        return '📌';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
      case 'passing':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
      case 'failing':
        return 'text-red-600 dark:text-red-400';
      case 'flaky':
      case 'mixed':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg aria-hidden="true" className="animate-spin h-8 w-8 text-primary mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-muted-foreground">Loading personalized insights for {user?.name}...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              🎯 Personalized Insights
            </h1>
            <p className="mt-2 text-muted-foreground">
              AI-tailored insights for <span className="font-medium text-foreground">{user?.name}</span>
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                {user?.role}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as 'today' | 'week' | 'month')}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            {(user?.role === 'admin' || user?.role === 'owner') && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showAllInsights}
                  onChange={(e) => setShowAllInsights(e.target.checked)}
                  className="rounded"
                />
                Show all role insights
              </label>
            )}
          </div>
        </div>

        {/* Role-specific welcome message */}
        <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl">
              {user?.role === 'developer' ? '👨‍💻' : user?.role === 'admin' ? '👔' : user?.role === 'owner' ? '🏆' : '👁️'}
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                {user?.role === 'developer' && 'Developer View'}
                {user?.role === 'admin' && 'QA Lead / Admin View'}
                {user?.role === 'owner' && 'Owner View'}
                {user?.role === 'viewer' && 'Viewer View'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'developer' && 'Focus on your tests and code impact'}
                {user?.role === 'admin' && 'Team-wide coverage and quality metrics'}
                {user?.role === 'owner' && 'Complete organizational test health overview'}
                {user?.role === 'viewer' && 'Read-only access to test insights'}
              </p>
            </div>
          </div>
        </div>

        {/* Insights Grid */}
        <div className="space-y-6">
          {insights.map((insight) => (
            <div key={insight.id} className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getInsightIcon(insight.type)}</span>
                  <div>
                    <h3 className="font-semibold text-foreground">{insight.title}</h3>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(insight.priority)}`}>
                    {insight.priority}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    for: {insight.forRoles.join(', ')}
                  </span>
                </div>
              </div>

              {/* Test Status Data */}
              {insight.type === 'test_status' && insight.data?.tests && (
                <div className="space-y-2">
                  {insight.data.tests.map((test, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg ${
                          test.status === 'passed' ? 'text-green-500' :
                          test.status === 'failed' ? 'text-red-500' :
                          'text-yellow-500'
                        }`}>
                          {test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '⚡'}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{test.name}</p>
                          <p className="text-xs text-muted-foreground">{test.suite}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-medium capitalize ${getStatusColor(test.status)}`}>
                          {test.status}
                        </span>
                        <p className="text-xs text-muted-foreground">{test.lastRun}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Code Impact Data */}
              {insight.type === 'code_impact' && insight.data?.codeImpact && (
                <div className="space-y-2">
                  {insight.data.codeImpact.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📄</span>
                        <div>
                          <p className="font-mono text-sm text-foreground">{file.file}</p>
                          <p className="text-xs text-muted-foreground">{file.testsAffected} tests affected</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                        file.status === 'passing' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        file.status === 'failing' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {file.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Team Coverage Data */}
              {insight.type === 'team_coverage' && insight.data?.teamCoverage && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-3xl font-bold text-foreground">{insight.data.teamCoverage.total}</div>
                    <div className="text-xs text-muted-foreground">Total Tests</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">{insight.data.teamCoverage.covered}</div>
                    <div className="text-xs text-muted-foreground">Covered</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-3xl font-bold text-primary">{insight.data.teamCoverage.percentage}%</div>
                    <div className="text-xs text-muted-foreground">Coverage</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-3xl font-bold">
                      {insight.data.teamCoverage.trend === 'up' ? '📈' : insight.data.teamCoverage.trend === 'down' ? '📉' : '➡️'}
                    </div>
                    <div className="text-xs text-muted-foreground">Trend: {insight.data.teamCoverage.trend}</div>
                  </div>
                </div>
              )}

              {/* Flaky Alert Data */}
              {insight.type === 'flaky_alert' && insight.data?.tests && (
                <div className="space-y-2">
                  {insight.data.tests.map((test, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">⚡</span>
                        <div>
                          <p className="font-medium text-foreground">{test.name}</p>
                          <p className="text-xs text-muted-foreground">{test.suite}</p>
                        </div>
                      </div>
                      <span className="text-sm text-yellow-700 dark:text-yellow-400">{test.lastRun}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendation Data */}
              {insight.type === 'recommendation' && insight.data?.recommendation && (
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-foreground">{insight.data.recommendation}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {insights.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No personalized insights available for your role.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
