// Dependency Upgrade Recommendations - Feature #270
// Show upgrade recommendations with breaking change risk analysis
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import {
  ArrowUp,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  // Shield, // Unused
  Package,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Download,
  Info
} from 'lucide-react';

interface Recommendation {
  package: string;
  current_version: string;
  recommended_version: string;
  latest_version: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  vulnerabilities: string[];
  upgrade_type: 'patch' | 'minor' | 'major';
  risk_level: 'safe' | 'caution' | 'breaking';
  breaking_changes: boolean;
  changelog_url: string;
  description: string;
  migration_notes?: string[];
  alternative?: {
    package: string;
    reason: string;
  };
}

interface UpgradeData {
  project_id: string;
  project_name: string;
  recommendations: Recommendation[];
  summary: {
    total_recommendations: number;
    by_risk_level: {
      safe: number;
      caution: number;
      breaking: number;
    };
    by_severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    total_vulnerabilities: number;
    actionable_now: number;
  };
  metadata: {
    generated_at: string;
    npm_registry_checked: boolean;
    include_dev: boolean;
    min_severity: string;
  };
}

interface Project {
  id: string;
  name: string;
}

const riskColors = {
  safe: 'bg-success text-primary-foreground',
  caution: 'bg-warning text-warning-foreground',
  breaking: 'bg-destructive text-primary-foreground',
};

const riskBorderColors = {
  safe: 'border-success',
  caution: 'border-warning',
  breaking: 'border-destructive',
};

const severityColors = {
  critical: 'text-destructive',
  high: 'text-warning',
  medium: 'text-warning',
  low: 'text-primary',
};

export function UpgradeRecommendationsPage() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [data, setData] = useState<UpgradeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [riskFilter, setRiskFilter] = useState<string>('all');

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/v1/projects', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setProjects(data.projects || data || []);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };
    fetchProjects();
  }, [token]);

  const fetchRecommendations = async () => {
    if (!selectedProject) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/projects/${selectedProject}/upgrade-recommendations`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed with status ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProject) {
      fetchRecommendations();
    }
  }, [selectedProject]);

  const togglePackageExpand = (packageName: string) => {
    const newExpanded = new Set(expandedPackages);
    if (newExpanded.has(packageName)) {
      newExpanded.delete(packageName);
    } else {
      newExpanded.add(packageName);
    }
    setExpandedPackages(newExpanded);
  };

  const filteredRecommendations = data?.recommendations.filter(r =>
    riskFilter === 'all' || r.risk_level === riskFilter
  ) ?? [];

  const exportReport = () => {
    if (!data) return;
    const report = JSON.stringify(data, null, 2);
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upgrade-recommendations-${data.project_name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'safe':
        return <CheckCircle className="h-4 w-4" />;
      case 'caution':
        return <AlertTriangle className="h-4 w-4" />;
      case 'breaking':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Feature #639: PageHeader component */}
        <PageHeader
          title="Upgrade Recommendations"
          description="Dependency upgrades with breaking change risk analysis"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'Upgrade Recommendations' }]}
          actions={
            data && (
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                Export Report
              </button>
            )
          }
        />

        {/* Project Selection */}
        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Select Project</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted-foreground mb-2">Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchRecommendations}
              disabled={!selectedProject || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Package className="h-4 w-4" />
                  <span className="text-sm">Total Recommendations</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{data.summary.total_recommendations}</p>
                <p className="text-xs text-muted-foreground">{data.summary.actionable_now} safe to apply now</p>
              </div>

              <div className="rounded-lg border border-success/50 bg-success/10 p-4">
                <div className="flex items-center gap-2 text-success mb-2">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Safe Upgrades</span>
                </div>
                <p className="text-3xl font-bold text-success">{data.summary.by_risk_level.safe}</p>
                <p className="text-xs text-success/70">patch versions</p>
              </div>

              <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
                <div className="flex items-center gap-2 text-warning mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Caution Required</span>
                </div>
                <p className="text-3xl font-bold text-warning">{data.summary.by_risk_level.caution}</p>
                <p className="text-xs text-warning/70">minor versions</p>
              </div>

              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Breaking Changes</span>
                </div>
                <p className="text-3xl font-bold text-destructive">{data.summary.by_risk_level.breaking}</p>
                <p className="text-xs text-destructive/70">major versions</p>
              </div>
            </div>

            {/* Risk Filter */}
            <div className="rounded-lg border border-border bg-card p-6 mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Filter by Risk Level</h3>
              <div className="flex gap-4 flex-wrap">
                <button
                  onClick={() => setRiskFilter('all')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    riskFilter === 'all'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  All ({data.summary.total_recommendations})
                </button>
                <button
                  onClick={() => setRiskFilter('safe')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    riskFilter === 'safe'
                      ? 'bg-success text-primary-foreground border-success'
                      : 'border-success text-success hover:bg-success/10'
                  }`}
                >
                  <CheckCircle className="h-4 w-4" />
                  Safe ({data.summary.by_risk_level.safe})
                </button>
                <button
                  onClick={() => setRiskFilter('caution')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    riskFilter === 'caution'
                      ? 'bg-warning text-warning-foreground border-warning'
                      : 'border-warning text-warning hover:bg-warning/10'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Caution ({data.summary.by_risk_level.caution})
                </button>
                <button
                  onClick={() => setRiskFilter('breaking')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    riskFilter === 'breaking'
                      ? 'bg-destructive text-primary-foreground border-destructive'
                      : 'border-destructive text-destructive hover:bg-destructive/10'
                  }`}
                >
                  <AlertCircle className="h-4 w-4" />
                  Breaking ({data.summary.by_risk_level.breaking})
                </button>
              </div>
            </div>

            {/* Recommendations List */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Recommendations ({filteredRecommendations.length})
              </h3>
              {filteredRecommendations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p>No recommendations match the selected filter</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRecommendations.map((rec) => (
                    <div
                      key={rec.package}
                      className={`rounded-lg border-l-4 ${riskBorderColors[rec.risk_level]} bg-muted/50 overflow-hidden`}
                    >
                      <button
                        onClick={() => togglePackageExpand(rec.package)}
                        className="w-full p-4 text-left hover:bg-muted/80 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${riskColors[rec.risk_level]}`}>
                              {getRiskIcon(rec.risk_level)}
                              {rec.risk_level.toUpperCase()}
                            </span>
                            <div>
                              <span className="font-semibold text-foreground">{rec.package}</span>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">{rec.current_version}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-success font-medium">{rec.recommended_version}</span>
                                <span className={`text-xs uppercase ${severityColors[rec.severity]}`}>
                                  ({rec.severity})
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                              {rec.upgrade_type}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {rec.vulnerabilities.length} CVE{rec.vulnerabilities.length !== 1 ? 's' : ''}
                            </span>
                            {expandedPackages.has(rec.package) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </button>
                      {expandedPackages.has(rec.package) && (
                        <div className="px-4 pb-4 border-t border-border">
                          <p className="text-sm text-muted-foreground mt-4 mb-4">{rec.description}</p>

                          {/* CVE List */}
                          <div className="mb-4">
                            <h5 className="text-sm font-medium text-foreground mb-2">Vulnerabilities Fixed</h5>
                            <div className="flex flex-wrap gap-2">
                              {rec.vulnerabilities.map((cve) => (
                                <span key={cve} className="px-2 py-1 rounded bg-destructive/10 text-destructive text-xs font-mono">
                                  {cve}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Migration Notes */}
                          {rec.migration_notes && rec.migration_notes.length > 0 && (
                            <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30">
                              <h5 className="text-sm font-medium text-warning mb-2 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Migration Notes
                              </h5>
                              <ul className="list-disc list-inside text-sm text-muted-foreground">
                                {rec.migration_notes.map((note, i) => (
                                  <li key={i}>{note}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Alternative Package */}
                          {rec.alternative && (
                            <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
                              <h5 className="text-sm font-medium text-primary mb-1 flex items-center gap-2">
                                <Info className="h-4 w-4" />
                                Alternative Package
                              </h5>
                              <p className="text-sm text-muted-foreground">
                                Consider using <span className="font-mono text-primary">{rec.alternative.package}</span>: {rec.alternative.reason}
                              </p>
                            </div>
                          )}

                          {/* Changelog Link */}
                          <a
                            href={rec.changelog_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            View Changelog
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!data && !loading && !selectedProject && (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <ArrowUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Dependency Upgrade Recommendations</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Select a project above to see upgrade recommendations for vulnerable dependencies,
              with breaking change risk analysis and migration guidance.
            </p>
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-muted-foreground">Safe (patch)</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-muted-foreground">Caution (minor)</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-muted-foreground">Breaking (major)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
