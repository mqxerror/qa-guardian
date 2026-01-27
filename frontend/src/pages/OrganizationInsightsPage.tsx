// OrganizationInsightsPage - Cross-project failure pattern learning
// Feature #1244: Extracted from App.tsx for code quality compliance
// Feature #1441: Split App.tsx into logical modules

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

// Types for cross-project failure pattern learning
interface CrossProjectPattern {
  id: string;
  pattern_name: string;
  description: string;
  affected_projects: string[];
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'selector_drift' | 'timing_issue' | 'api_change' | 'dependency_conflict' | 'env_mismatch';
  confidence: number;
}

interface CrossProjectSolution {
  id: string;
  source_project: string;
  target_projects: string[];
  solution_type: string;
  description: string;
  original_fix: string;
  applicability_score: number;
  estimated_impact: number;
  affected_tests: number;
  status: 'suggested' | 'applied' | 'rejected';
}

interface ProjectFailureInsight {
  project_id: string;
  project_name: string;
  failure_count: number;
  common_patterns: string[];
  related_projects: string[];
  health_score: number;
}

export function OrganizationInsightsPage() {
  const { token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [patterns, setPatterns] = useState<CrossProjectPattern[]>([]);
  const [solutions, setSolutions] = useState<CrossProjectSolution[]>([]);
  const [projectInsights, setProjectInsights] = useState<ProjectFailureInsight[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [showAppliedSolutions, setShowAppliedSolutions] = useState(false);

  // Feature #1544: Fetch real data from AI-powered API endpoint
  // Falls back to demo data if API is unavailable
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/v1/ai-insights/cross-project-patterns', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        // Map API response to component state
        if (data.patterns && data.patterns.length > 0) {
          setPatterns(data.patterns);
        } else {
          throw new Error('No patterns in response');
        }

        if (data.solutions && data.solutions.length > 0) {
          setSolutions(data.solutions);
        }

        if (data.project_insights && data.project_insights.length > 0) {
          setProjectInsights(data.project_insights);
        }
      } catch (error) {
        console.error('Failed to fetch organization insights:', error);
        // No fallback data - show empty state when API fails
        setPatterns([]);
        setSolutions([]);
        setProjectInsights([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'selector_drift': return '🎯';
      case 'timing_issue': return '⏱️';
      case 'api_change': return '🔄';
      case 'dependency_conflict': return '📦';
      case 'env_mismatch': return '🌍';
      default: return '❓';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-amber-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'applied': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Analyzing cross-project patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header - Step 1: View Organization Insights */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>🏢</span> Organization Insights
          </h1>
          <p className="text-muted-foreground mt-1">AI learns from failures across all projects to identify patterns and solutions</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showAppliedSolutions}
              onChange={(e) => setShowAppliedSolutions(e.target.checked)}
              className="rounded border-input"
            />
            Show applied solutions
          </label>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Patterns Detected</span>
            <span className="text-2xl">🔍</span>
          </div>
          <p className="text-3xl font-bold text-foreground mt-2">{patterns.length}</p>
          <p className="text-sm text-muted-foreground">Across {new Set(patterns.flatMap(p => p.affected_projects)).size} projects</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cross-Project Solutions</span>
            <span className="text-2xl">💡</span>
          </div>
          <p className="text-3xl font-bold text-foreground mt-2">{solutions.length}</p>
          <p className="text-sm text-green-600">{solutions.filter(s => s.status === 'applied').length} already applied</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Potential Impact</span>
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-3xl font-bold text-green-600 mt-2">-{Math.round(solutions.reduce((acc, s) => acc + s.estimated_impact, 0) / solutions.length)}%</p>
          <p className="text-sm text-muted-foreground">Avg. failure reduction</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tests Affected</span>
            <span className="text-2xl">🧪</span>
          </div>
          <p className="text-3xl font-bold text-foreground mt-2">{solutions.reduce((acc, s) => acc + s.affected_tests, 0)}</p>
          <p className="text-sm text-muted-foreground">Could benefit from fixes</p>
        </div>
      </div>

      {/* Step 2: AI shows patterns across projects */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 text-sm">2</span>
          <span>🔗</span> Cross-Project Failure Patterns
        </h2>
        <p className="text-sm text-muted-foreground mb-4">AI identifies recurring failure patterns that affect multiple projects</p>

        <div className="space-y-4">
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              className={`rounded-lg border p-4 cursor-pointer transition-all ${selectedPattern === pattern.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}
              onClick={() => setSelectedPattern(selectedPattern === pattern.id ? null : pattern.id)}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{getCategoryIcon(pattern.category)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="font-semibold text-foreground">{pattern.pattern_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityBadge(pattern.severity)}`}>
                      {pattern.severity.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                      {(pattern.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{pattern.description}</p>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <span className="text-foreground font-medium">{pattern.occurrence_count} occurrences</span>
                    <span className="text-muted-foreground">First seen: {new Date(pattern.first_seen).toLocaleDateString()}</span>
                    <span className="text-muted-foreground">Last seen: {new Date(pattern.last_seen).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Affected projects:</span>
                    {pattern.affected_projects.map((project, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium">
                        {project}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 3: AI identifies Project A fix applies to Project B */}
      <div className="rounded-lg border bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 text-sm">3</span>
          <span>🔄</span> Cross-Project Fix Applicability
        </h2>
        <p className="text-sm text-muted-foreground mb-4">AI identifies fixes from one project that can solve similar issues in others</p>

        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🧠</span>
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">AI Learning Insight</p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Based on analysis of {patterns.reduce((acc, p) => acc + p.occurrence_count, 0)} failure occurrences across {new Set(patterns.flatMap(p => p.affected_projects)).size} projects,
                AI has identified <strong>{solutions.length} solutions</strong> that can be cross-pollinated between projects,
                potentially reducing overall test failures by <strong>{Math.round(solutions.reduce((acc, s) => acc + s.estimated_impact, 0) / solutions.length)}%</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {solutions.slice(0, 4).map((solution) => (
            <div key={solution.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔧</span>
                  <span className="font-semibold text-foreground">{solution.solution_type}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(solution.status)}`}>
                  {solution.status}
                </span>
              </div>
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-muted-foreground">From:</span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                    {solution.source_project}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-sm text-muted-foreground">To:</span>
                  {solution.target_projects.map((target, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium">
                      {target}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{solution.description}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 font-medium">{solution.applicability_score}% match</span>
                <span className="text-foreground">-{solution.estimated_impact}% failures</span>
                <span className="text-muted-foreground">{solution.affected_tests} tests</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 4: AI suggests cross-pollination of solutions */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 text-sm">4</span>
          <span>💡</span> AI-Suggested Cross-Pollination Actions
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Recommended actions to apply successful fixes across your organization</p>

        <div className="space-y-4">
          {solutions
            .filter(s => showAppliedSolutions || s.status === 'suggested')
            .map((solution, index) => (
            <div key={solution.id} className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm flex-shrink-0 ${
                  index === 0 ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                  index === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                }`}>
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="font-semibold text-foreground">{solution.solution_type}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(solution.status)}`}>
                      {solution.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      {solution.applicability_score}% applicability
                    </span>
                  </div>

                  <div className="mb-3 p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">Original fix in <strong>{solution.source_project}</strong>:</p>
                    <p className="text-sm text-foreground font-mono">{solution.original_fix}</p>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-muted-foreground">Apply to:</span>
                    {solution.target_projects.map((target, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium">
                        {target}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Impact:</span>
                      <span className="font-bold text-green-600">-{solution.estimated_impact}% failures</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Tests affected:</span>
                      <span className="font-bold text-foreground">{solution.affected_tests}</span>
                    </div>
                  </div>

                  {solution.status === 'suggested' && (
                    <div className="mt-4 flex items-center gap-2">
                      <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                        Apply to All Projects
                      </button>
                      <button className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors">
                        Review Details
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Health Overview */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>📊</span> Project Health Overview
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Project</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Health Score</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Failures</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Common Patterns</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Related Projects</th>
              </tr>
            </thead>
            <tbody>
              {projectInsights.map((project) => (
                <tr key={project.project_id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-2 font-medium text-foreground">{project.project_name}</td>
                  <td className="text-center py-3 px-2">
                    <span className={`font-bold ${getHealthColor(project.health_score)}`}>{project.health_score}%</span>
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className="font-mono text-red-600">{project.failure_count}</span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {project.common_patterns.map((pattern, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs">
                          {pattern}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {project.related_projects.map((related, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">
                          {related}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
