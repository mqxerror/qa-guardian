// BestPracticesPage - Best practices recommendations from high-performing projects
// Feature #1245: Extracted from App.tsx for code quality compliance
// Feature #1441: Split App.tsx into logical modules
// Feature #1542: Replace dummy data with real AI API calls

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

// Types for best practices recommendation engine
interface ProjectMetrics {
  id: string;
  name: string;
  tier: 'top' | 'mid' | 'low';
  pass_rate: number;
  avg_test_duration: number;
  flakiness_score: number;
  coverage: number;
  test_count: number;
  maintainability_score: number;
}

interface BestPractice {
  id: string;
  name: string;
  category: 'testing_strategy' | 'ci_cd' | 'code_quality' | 'automation' | 'monitoring';
  description: string;
  adoption_rate_top: number;
  adoption_rate_overall: number;
  impact_score: number;
  source_projects: string[];
  implementation_effort: 'low' | 'medium' | 'high';
  expected_improvement: string;
}

interface PracticeRecommendation {
  id: string;
  practice: BestPractice;
  target_project: string;
  source_project: string;
  relevance_score: number;
  current_status: 'not_adopted' | 'partial' | 'adopted';
  suggested_steps: string[];
  estimated_roi: number;
}

export function BestPracticesPage() {
  const { token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics[]>([]);
  const [bestPractices, setBestPractices] = useState<BestPractice[]>([]);
  const [recommendations, setRecommendations] = useState<PracticeRecommendation[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');

  // Feature #1542: Fetch real data from AI-powered API endpoint
  // Falls back to demo data if API is unavailable (e.g., backend not restarted yet)
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/v1/ai-insights/best-practices', {
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
        if (data.project_metrics) {
          setProjectMetrics(data.project_metrics);
        }

        if (data.best_practices) {
          setBestPractices(data.best_practices);
        }

        if (data.recommendations) {
          setRecommendations(data.recommendations);
        }
      } catch (error) {
        console.error('Failed to fetch best practices data:', error);
        // No fallback data - show empty state when API fails
        setProjectMetrics([]);
        setBestPractices([]);
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'top': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'mid': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'low': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'testing_strategy': return '🧪';
      case 'ci_cd': return '⚙️';
      case 'code_quality': return '✨';
      case 'automation': return '🤖';
      case 'monitoring': return '📊';
      default: return '📌';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'testing_strategy': return 'Testing Strategy';
      case 'ci_cd': return 'CI/CD';
      case 'code_quality': return 'Code Quality';
      case 'automation': return 'Automation';
      case 'monitoring': return 'Monitoring';
      default: return category;
    }
  };

  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case 'high': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'medium': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'low': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'adopted': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'partial': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      default: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    }
  };

  const getMetricColor = (value: number, type: 'pass_rate' | 'coverage' | 'flakiness') => {
    if (type === 'flakiness') {
      if (value <= 5) return 'text-green-600';
      if (value <= 15) return 'text-amber-600';
      return 'text-red-600';
    }
    if (value >= 90) return 'text-green-600';
    if (value >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const topProjects = projectMetrics.filter(p => p.tier === 'top');
  const filteredRecommendations = recommendations.filter(r =>
    (selectedCategory === 'all' || r.practice.category === selectedCategory) &&
    (selectedProject === 'all' || r.target_project === selectedProject)
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Analyzing best practices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Step 1: View Best Practices Recommendations */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>🏆</span> Best Practices Recommendations
          </h1>
          <p className="text-muted-foreground mt-1">AI recommends practices from high-performing projects</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All Categories</option>
            <option value="testing_strategy">Testing Strategy</option>
            <option value="ci_cd">CI/CD</option>
            <option value="code_quality">Code Quality</option>
            <option value="automation">Automation</option>
            <option value="monitoring">Monitoring</option>
          </select>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All Projects</option>
            {projectMetrics.filter(p => p.tier !== 'top').map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Top Performing</span>
            <span className="text-2xl">🏆</span>
          </div>
          <p className="text-3xl font-bold text-green-600 mt-2">{topProjects.length}</p>
          <p className="text-sm text-muted-foreground">Projects with &gt;95% pass rate</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Best Practices</span>
            <span className="text-2xl">📚</span>
          </div>
          <p className="text-3xl font-bold text-foreground mt-2">{bestPractices.length}</p>
          <p className="text-sm text-muted-foreground">Identified from top projects</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Recommendations</span>
            <span className="text-2xl">💡</span>
          </div>
          <p className="text-3xl font-bold text-foreground mt-2">{recommendations.length}</p>
          <p className="text-sm text-muted-foreground">Actionable suggestions</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Potential ROI</span>
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-3xl font-bold text-green-600 mt-2">{Math.round(recommendations.reduce((acc, r) => acc + r.estimated_roi, 0) / 100)}x</p>
          <p className="text-sm text-muted-foreground">Avg. return on investment</p>
        </div>
      </div>

      {/* Step 2: AI compares project metrics */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 text-sm">2</span>
          <span>📊</span> Project Metrics Comparison
        </h2>
        <p className="text-sm text-muted-foreground mb-4">AI compares metrics across all projects to identify top performers</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Project</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Tier</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Pass Rate</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Avg Duration</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Flakiness</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Coverage</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Tests</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Maintainability</th>
              </tr>
            </thead>
            <tbody>
              {projectMetrics.map((project) => (
                <tr key={project.id} className={`border-b hover:bg-muted/50 ${project.tier === 'top' ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      {project.tier === 'top' && <span className="text-lg">🏆</span>}
                      <span className="font-medium text-foreground">{project.name}</span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTierBadge(project.tier)}`}>
                      {project.tier.toUpperCase()}
                    </span>
                  </td>
                  <td className={`text-center py-3 px-2 font-bold ${getMetricColor(project.pass_rate, 'pass_rate')}`}>
                    {project.pass_rate}%
                  </td>
                  <td className="text-center py-3 px-2 text-muted-foreground">{project.avg_test_duration}s</td>
                  <td className={`text-center py-3 px-2 font-bold ${getMetricColor(project.flakiness_score, 'flakiness')}`}>
                    {project.flakiness_score}%
                  </td>
                  <td className={`text-center py-3 px-2 font-bold ${getMetricColor(project.coverage, 'coverage')}`}>
                    {project.coverage}%
                  </td>
                  <td className="text-center py-3 px-2 text-muted-foreground">{project.test_count}</td>
                  <td className="text-center py-3 px-2">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${project.maintainability_score >= 80 ? 'bg-green-500' : project.maintainability_score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${project.maintainability_score}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{project.maintainability_score}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 3: AI identifies what top projects do differently */}
      <div className="rounded-lg border bg-gradient-to-r from-violet-500/10 to-purple-500/10 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 text-sm">3</span>
          <span>🔍</span> What Top Projects Do Differently
        </h2>
        <p className="text-sm text-muted-foreground mb-4">AI identifies practices that differentiate high-performing projects</p>

        <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🧠</span>
            <div>
              <p className="font-semibold text-violet-800 dark:text-violet-200">AI Analysis Insight</p>
              <p className="text-sm text-violet-700 dark:text-violet-300 mt-1">
                Top-performing projects have <strong>{Math.round(topProjects.reduce((acc, p) => acc + p.pass_rate, 0) / topProjects.length)}% average pass rate</strong> compared to{' '}
                <strong>{Math.round(projectMetrics.filter(p => p.tier !== 'top').reduce((acc, p) => acc + p.pass_rate, 0) / projectMetrics.filter(p => p.tier !== 'top').length)}%</strong> for others.
                The key differentiators are practices adopted by &gt;85% of top projects but &lt;50% overall.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {bestPractices.slice(0, 8).map((practice) => (
            <div key={practice.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{getCategoryIcon(practice.category)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getEffortBadge(practice.implementation_effort)}`}>
                  {practice.implementation_effort} effort
                </span>
              </div>
              <h3 className="font-semibold text-foreground mb-2">{practice.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">{practice.description}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Top projects:</span>
                  <span className="font-bold text-green-600">{practice.adoption_rate_top}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall:</span>
                  <span className="font-bold text-amber-600">{practice.adoption_rate_overall}%</span>
                </div>
                <div className="pt-2 border-t">
                  <span className="text-sm text-green-600 font-medium">{practice.expected_improvement}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 4: AI suggests adopt these practices from Project X */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 text-sm">4</span>
          <span>💡</span> Adopt These Practices from Top Projects
        </h2>
        <p className="text-sm text-muted-foreground mb-4">AI suggests specific practices to adopt from high-performing projects</p>

        <div className="space-y-4">
          {filteredRecommendations.map((rec, index) => (
            <div key={rec.id} className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm flex-shrink-0 ${
                  index === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                  index === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                }`}>
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-xl">{getCategoryIcon(rec.practice.category)}</span>
                    <h3 className="font-semibold text-foreground">{rec.practice.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                      {getCategoryLabel(rec.practice.category)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(rec.current_status)}`}>
                      {rec.current_status === 'not_adopted' ? 'Not Adopted' : rec.current_status === 'partial' ? 'Partial' : 'Adopted'}
                    </span>
                  </div>

                  <div className="mb-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">Adopt from:</span>
                      <span className="px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
                        🏆 {rec.source_project}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">Apply to:</span>
                      <span className="px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium">
                        {rec.target_project}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.practice.description}</p>
                  </div>

                  <div className="flex items-center gap-6 text-sm mb-3">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Relevance:</span>
                      <span className="font-bold text-foreground">{rec.relevance_score}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Expected:</span>
                      <span className="font-bold text-green-600">{rec.practice.expected_improvement}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">ROI:</span>
                      <span className="font-bold text-blue-600">{rec.estimated_roi}%</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getEffortBadge(rec.practice.implementation_effort)}`}>
                      {rec.practice.implementation_effort} effort
                    </span>
                  </div>

                  <details className="mb-3">
                    <summary className="cursor-pointer text-sm text-violet-600 hover:text-violet-700 font-medium">
                      View implementation steps ({rec.suggested_steps.length} steps)
                    </summary>
                    <ol className="mt-2 ml-4 space-y-1 text-sm text-muted-foreground list-decimal">
                      {rec.suggested_steps.map((step, stepIndex) => (
                        <li key={stepIndex}>{step}</li>
                      ))}
                    </ol>
                  </details>

                  <div className="flex items-center gap-2">
                    <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                      Adopt Practice
                    </button>
                    <button className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors">
                      View Details
                    </button>
                    <button className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors">
                      Compare with {rec.source_project}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
