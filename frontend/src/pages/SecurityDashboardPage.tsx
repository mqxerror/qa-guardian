// SecurityDashboardPage - SAST findings dashboard across all projects
// Feature #1441: Extracted from App.tsx for code quality compliance

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Types for Security Dashboard
interface DashboardFinding {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  scanId: string;
  scanDate: string;
  ruleId: string;
  ruleName: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  message: string;
  filePath: string;
  line: number;
  column?: number;
  snippet?: string;
  cweId?: string;
  owaspCategory?: string;
  suggestion?: string;
  isFalsePositive?: boolean;
}

interface SecurityDashboardData {
  findings: DashboardFinding[];
  summary: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byCategory: Record<string, number>;
    projectsScanned: number;
    totalProjects: number;
    falsePositives: number;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface TrendDataPoint {
  date: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  scanCount: number;
}

interface TrendsData {
  trends: TrendDataPoint[];
  summary: {
    totalScans: number;
    latestFindings: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    changes: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  scans: Array<{
    date: string;
    scanId: string;
    projectId: string;
    projectName: string;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
}

interface DetectedSecret {
  id: string;
  projectId: string;
  projectName: string;
  secretType: string;
  secretTypeName: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  filePath: string;
  line: number;
  column?: number;
  snippet: string;
  detectedAt: string;
  commitSha?: string;
  commitAuthor?: string;
  status: 'active' | 'resolved' | 'false-positive';
  resolvedAt?: string;
  resolvedBy?: string;
  verificationStatus?: 'unverified' | 'active' | 'revoked' | 'unknown';
  lastVerifiedAt?: string;
  lastVerifiedBy?: string;
  verificationError?: string;
}

interface SecretType {
  id: string;
  name: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface SecretsData {
  secrets: DetectedSecret[];
  summary: {
    total: number;
    active: number;
    resolved: number;
    falsePositives: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    bySecretType: Array<{
      type: string;
      name: string;
      count: number;
      severity: string;
      category: string;
    }>;
    byCategory: Record<string, number>;
    byProject: Array<{ id: string; name: string; count: number }>;
  };
  secretTypes: SecretType[];
}

export function SecurityDashboardPage() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState<SecurityDashboardData | null>(null);
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [secretsData, setSecretsData] = useState<SecretsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrendsLoading, setIsTrendsLoading] = useState(true);
  const [isSecretsLoading, setIsSecretsLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'severity' | 'project'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [expandedSecrets, setExpandedSecrets] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'findings' | 'trends' | 'secrets'>('findings');
  const [secretsProjectFilter, setSecretsProjectFilter] = useState<string>('all');
  const [secretsTypeFilter, setSecretsTypeFilter] = useState<string>('all');
  const [secretsSortBy, setSecretsSortBy] = useState<'date' | 'severity' | 'project' | 'type'>('date');
  const [verifyingSecrets, setVerifyingSecrets] = useState<Set<string>>(new Set());

  // Verify a secret to check if it's still active
  const verifySecret = async (secretId: string) => {
    setVerifyingSecrets(prev => new Set([...prev, secretId]));
    try {
      const response = await fetch(`/api/v1/secrets/${secretId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Update the secret in the local state
        setSecretsData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            secrets: prev.secrets.map(s =>
              s.id === secretId ? data.secret : s
            ),
          };
        });
      }
    } catch (error) {
      console.error('Failed to verify secret:', error);
    } finally {
      setVerifyingSecrets(prev => {
        const newSet = new Set(prev);
        newSet.delete(secretId);
        return newSet;
      });
    }
  };

  // State for secret scanning
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ message: string; secretsFound: number } | null>(null);

  // Scan for secrets in env files and CI configs
  const scanForSecrets = async (scanEnvFiles: boolean = true, scanCiConfigs: boolean = true) => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const response = await fetch('/api/v1/secrets/scan', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanEnvFiles,
          scanCiConfigs,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setScanResult({
          message: data.message,
          secretsFound: data.secretsFound,
        });
        // Refresh secrets data after scan
        fetchSecretsData();
      }
    } catch (error) {
      console.error('Failed to scan for secrets:', error);
      setScanResult({
        message: 'Failed to scan for secrets',
        secretsFound: 0,
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Get verification status badge
  const getVerificationStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            Active
          </span>
        );
      case 'revoked':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Revoked
          </span>
        );
      case 'unknown':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Unknown
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            Unverified
          </span>
        );
    }
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (severityFilter.length > 0) {
        params.set('severity', severityFilter.join(','));
      }
      if (categoryFilter.length > 0) {
        params.set('category', categoryFilter.join(','));
      }
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const response = await fetch(`/api/v1/sast/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error('Failed to fetch security dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrendsData = async () => {
    try {
      setIsTrendsLoading(true);
      const response = await fetch('/api/v1/sast/trends?days=30', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const trends = await response.json();
        setTrendsData(trends);
      }
    } catch (error) {
      console.error('Failed to fetch security trends:', error);
    } finally {
      setIsTrendsLoading(false);
    }
  };

  const fetchSecretsData = async () => {
    try {
      setIsSecretsLoading(true);
      const params = new URLSearchParams();
      if (secretsProjectFilter !== 'all') {
        params.set('project', secretsProjectFilter);
      }
      if (secretsTypeFilter !== 'all') {
        params.set('secretType', secretsTypeFilter);
      }
      params.set('sortBy', secretsSortBy);
      params.set('sortOrder', sortOrder);

      const response = await fetch(`/api/v1/secrets/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const secrets = await response.json();
        setSecretsData(secrets);
      }
    } catch (error) {
      console.error('Failed to fetch secrets dashboard:', error);
    } finally {
      setIsSecretsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchTrendsData();
    fetchSecretsData();
  }, [token]);

  useEffect(() => {
    fetchDashboardData();
  }, [severityFilter, categoryFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchSecretsData();
  }, [secretsProjectFilter, secretsTypeFilter, secretsSortBy, sortOrder]);

  const toggleFinding = (findingId: string) => {
    setExpandedFindings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(findingId)) {
        newSet.delete(findingId);
      } else {
        newSet.add(findingId);
      }
      return newSet;
    });
  };

  const toggleSecret = (secretId: string) => {
    setExpandedSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(secretId)) {
        newSet.delete(secretId);
      } else {
        newSet.add(secretId);
      }
      return newSet;
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cloud': return 'cloud';
      case 'vcs': return 'git';
      case 'payment': return 'credit-card';
      case 'crypto': return 'lock';
      case 'auth': return 'key';
      case 'database': return 'database';
      case 'communication': return 'message';
      case 'package': return 'package';
      case 'platform': return 'server';
      default: return 'shield';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-600 text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-black';
      case 'LOW': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityBorderColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'border-l-red-600';
      case 'HIGH': return 'border-l-orange-500';
      case 'MEDIUM': return 'border-l-yellow-500';
      case 'LOW': return 'border-l-blue-500';
      default: return 'border-l-gray-500';
    }
  };

  const toggleSeverityFilter = (severity: string) => {
    setSeverityFilter(prev =>
      prev.includes(severity)
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    );
  };

  const toggleCategoryFilter = (category: string) => {
    setCategoryFilter(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatChartDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground">Security Dashboard</h2>
          <p className="mt-2 text-muted-foreground">
            SAST findings across all projects in your organization
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-border">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('findings')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'findings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Findings
            </button>
            <button
              onClick={() => setActiveTab('secrets')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'secrets'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Secrets
              {secretsData && secretsData.summary.active > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-600 text-white">
                  {secretsData.summary.active}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'trends'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Trends
            </button>
          </nav>
        </div>

        {activeTab === 'secrets' ? (
          /* Secrets Tab Content */
          isSecretsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !secretsData ? (
            <div className="text-center py-12 text-muted-foreground">
              Failed to load secrets data
            </div>
          ) : (
            <>
              {/* Secrets Summary Cards */}
              <div className="grid gap-4 md:grid-cols-5 mb-8">
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-sm font-medium text-muted-foreground">Total Secrets</h3>
                  <p className="mt-2 text-3xl font-bold text-foreground">{secretsData.summary.total}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {secretsData.summary.active} active, {secretsData.summary.resolved} resolved
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-sm font-medium text-muted-foreground">Critical</h3>
                  <p className="mt-2 text-3xl font-bold text-red-600">{secretsData.summary.bySeverity.critical}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-sm font-medium text-muted-foreground">High</h3>
                  <p className="mt-2 text-3xl font-bold text-orange-500">{secretsData.summary.bySeverity.high}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-sm font-medium text-muted-foreground">Medium</h3>
                  <p className="mt-2 text-3xl font-bold text-yellow-500">{secretsData.summary.bySeverity.medium}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-sm font-medium text-muted-foreground">Low</h3>
                  <p className="mt-2 text-3xl font-bold text-blue-500">{secretsData.summary.bySeverity.low}</p>
                </div>
              </div>

              {/* Secrets by Type */}
              {secretsData.summary.bySecretType.length > 0 && (
                <div className="mb-8 rounded-lg border border-border bg-card p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Secrets by Type</h3>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {secretsData.summary.bySecretType.map((typeInfo) => (
                      <div
                        key={typeInfo.type}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSecretsTypeFilter(typeInfo.type)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{typeInfo.name}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getSeverityColor(typeInfo.severity)}`}>
                          {typeInfo.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scan Controls */}
              <div className="mb-6 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Scan for Secrets</h3>
                    <p className="text-sm text-muted-foreground">
                      Scan .env files and CI/CD configs for exposed secrets
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => scanForSecrets(true, false)}
                      disabled={isScanning}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isScanning ? 'Scanning...' : 'Scan .env Files'}
                    </button>
                    <button
                      onClick={() => scanForSecrets(false, true)}
                      disabled={isScanning}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isScanning ? 'Scanning...' : 'Scan CI Configs'}
                    </button>
                    <button
                      onClick={() => scanForSecrets(true, true)}
                      disabled={isScanning}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isScanning ? 'Scanning...' : 'Scan All'}
                    </button>
                  </div>
                </div>
                {scanResult && (
                  <div className={`mt-4 p-3 rounded-lg ${scanResult.secretsFound > 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                    <p className="text-sm font-medium">{scanResult.message}</p>
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="mb-6 flex flex-wrap items-center gap-4">
                {/* Project Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Project:</span>
                  <select
                    value={secretsProjectFilter}
                    onChange={(e) => setSecretsProjectFilter(e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="all">All Projects</option>
                    {secretsData.summary.byProject.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({project.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Secret Type Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Type:</span>
                  <select
                    value={secretsTypeFilter}
                    onChange={(e) => setSecretsTypeFilter(e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="all">All Types</option>
                    {secretsData.secretTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Controls */}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
                  <select
                    value={secretsSortBy}
                    onChange={(e) => setSecretsSortBy(e.target.value as 'date' | 'severity' | 'project' | 'type')}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="date">Detection Date</option>
                    <option value="severity">Severity</option>
                    <option value="project">Project</option>
                    <option value="type">Type</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>

              {/* Clear Filters */}
              {(secretsProjectFilter !== 'all' || secretsTypeFilter !== 'all') && (
                <div className="mb-4">
                  <button
                    onClick={() => { setSecretsProjectFilter('all'); setSecretsTypeFilter('all'); }}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              {/* Secrets List */}
              <div className="space-y-4">
                {secretsData.secrets.length === 0 ? (
                  <div className="text-center py-12 rounded-lg border border-border bg-card">
                    <div className="text-4xl mb-4">🔐</div>
                    <h3 className="text-lg font-semibold text-foreground">No Secrets Detected</h3>
                    <p className="text-muted-foreground mt-2">
                      {secretsProjectFilter !== 'all' || secretsTypeFilter !== 'all'
                        ? 'No secrets match your current filters'
                        : 'Run secret detection scans on your projects to detect exposed secrets'}
                    </p>
                  </div>
                ) : (
                  secretsData.secrets.map((secret) => (
                    <div
                      key={secret.id}
                      className={`rounded-lg border border-border bg-card overflow-hidden border-l-4 ${getSeverityBorderColor(secret.severity)} ${
                        secret.status !== 'active' ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Secret Header */}
                      <div
                        className="p-4 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSecret(secret.id)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getSeverityColor(secret.severity)}`}>
                                {secret.severity}
                              </span>
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">
                                {secret.secretTypeName}
                              </span>
                              {secret.status === 'resolved' && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  Resolved
                                </span>
                              )}
                              {secret.status === 'false-positive' && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  False Positive
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm font-mono text-muted-foreground truncate">
                              {secret.filePath}:{secret.line}
                            </p>
                          </div>
                          <div className="text-right text-sm shrink-0">
                            <p className="text-primary font-medium">
                              {secret.projectName}
                            </p>
                            <p className="text-muted-foreground text-xs mt-1">
                              {formatDate(secret.detectedAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedSecrets.has(secret.id) && (
                        <div className="border-t border-border p-4 bg-muted/30">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <h5 className="text-sm font-semibold text-foreground mb-2">Location</h5>
                              <p className="text-sm font-mono text-muted-foreground">
                                {secret.filePath}:{secret.line}
                                {secret.column && `:${secret.column}`}
                              </p>
                            </div>
                            {secret.commitSha && (
                              <div>
                                <h5 className="text-sm font-semibold text-foreground mb-2">Commit</h5>
                                <p className="text-sm font-mono text-muted-foreground">
                                  {secret.commitSha.substring(0, 12)}
                                  {secret.commitAuthor && ` by ${secret.commitAuthor}`}
                                </p>
                              </div>
                            )}
                          </div>
                          {secret.snippet && (
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold text-foreground mb-2">Code Snippet</h5>
                              <pre className="p-3 rounded bg-background border border-border text-sm overflow-x-auto">
                                <code>{secret.snippet}</code>
                              </pre>
                            </div>
                          )}

                          {/* Verification Status */}
                          <div className="mt-4 p-3 rounded-lg border border-border bg-background">
                            <div className="flex items-center justify-between">
                              <div>
                                <h5 className="text-sm font-semibold text-foreground mb-1">Verification Status</h5>
                                <div className="flex items-center gap-2">
                                  {getVerificationStatusBadge(secret.verificationStatus)}
                                  {secret.lastVerifiedAt && (
                                    <span className="text-xs text-muted-foreground">
                                      Last checked: {formatDate(secret.lastVerifiedAt)}
                                    </span>
                                  )}
                                </div>
                                {secret.verificationError && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {secret.verificationError}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); verifySecret(secret.id); }}
                                disabled={verifyingSecrets.has(secret.id)}
                                className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {verifyingSecrets.has(secret.id) ? (
                                  <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Verifying...
                                  </>
                                ) : (
                                  <>
                                    Verify Secret
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {secret.status === 'resolved' && secret.resolvedAt && (
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold text-foreground mb-2">Resolution</h5>
                              <p className="text-sm text-muted-foreground">
                                Resolved on {formatDate(secret.resolvedAt)}
                                {secret.resolvedBy && ` by ${secret.resolvedBy}`}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )
        ) : activeTab === 'trends' ? (
          /* Trends Tab Content */
          isTrendsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !trendsData ? (
            <div className="text-center py-12 text-muted-foreground">
              Failed to load trends data
            </div>
          ) : trendsData.trends.length === 0 ? (
            <div className="text-center py-12 rounded-lg border border-border bg-card">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold text-foreground">No Trend Data</h3>
              <p className="text-muted-foreground mt-2">
                Run multiple SAST scans over time to see security trends
              </p>
            </div>
          ) : (
            <>
              {/* Trend Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4 mb-8">
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-sm font-medium text-muted-foreground">Total Scans</h3>
                  <p className="mt-2 text-3xl font-bold text-foreground">{trendsData.summary.totalScans}</p>
                  <p className="mt-1 text-xs text-muted-foreground">in the last 30 days</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-sm font-medium text-muted-foreground">Critical Findings</h3>
                  <p className="mt-2 text-3xl font-bold text-red-600">{trendsData.summary.latestFindings.critical}</p>
                  <p className={`mt-1 text-xs font-medium ${
                    trendsData.summary.changes.critical > 0 ? 'text-red-500' :
                    trendsData.summary.changes.critical < 0 ? 'text-green-500' :
                    'text-muted-foreground'
                  }`}>
                    {trendsData.summary.changes.critical > 0 ? '↑' : trendsData.summary.changes.critical < 0 ? '↓' : '→'} {Math.abs(trendsData.summary.changes.critical)}% change
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-sm font-medium text-muted-foreground">High Findings</h3>
                  <p className="mt-2 text-3xl font-bold text-orange-500">{trendsData.summary.latestFindings.high}</p>
                  <p className={`mt-1 text-xs font-medium ${
                    trendsData.summary.changes.high > 0 ? 'text-red-500' :
                    trendsData.summary.changes.high < 0 ? 'text-green-500' :
                    'text-muted-foreground'
                  }`}>
                    {trendsData.summary.changes.high > 0 ? '↑' : trendsData.summary.changes.high < 0 ? '↓' : '→'} {Math.abs(trendsData.summary.changes.high)}% change
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-sm font-medium text-muted-foreground">Total Findings</h3>
                  <p className="mt-2 text-3xl font-bold text-foreground">{trendsData.summary.latestFindings.total}</p>
                  <p className={`mt-1 text-xs font-medium ${
                    trendsData.summary.changes.total > 0 ? 'text-red-500' :
                    trendsData.summary.changes.total < 0 ? 'text-green-500' :
                    'text-muted-foreground'
                  }`}>
                    {trendsData.summary.changes.total > 0 ? '↑' : trendsData.summary.changes.total < 0 ? '↓' : '→'} {Math.abs(trendsData.summary.changes.total)}% change
                  </p>
                </div>
              </div>

              {/* Findings Over Time Chart */}
              <div className="rounded-lg border border-border bg-card p-6 mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Findings Over Time</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsData.trends} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatChartDate}
                        className="text-xs"
                        stroke="currentColor"
                      />
                      <YAxis className="text-xs" stroke="currentColor" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(label) => formatChartDate(label as string)}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="critical"
                        name="Critical"
                        stroke="#dc2626"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="high"
                        name="High"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="medium"
                        name="Medium"
                        stroke="#eab308"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="low"
                        name="Low"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Severity Breakdown Chart */}
              <div className="rounded-lg border border-border bg-card p-6 mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Severity Breakdown</h3>
                <div className="grid gap-4 md:grid-cols-4">
                  {['critical', 'high', 'medium', 'low'].map(severity => {
                    const latest = trendsData.summary.latestFindings[severity as keyof typeof trendsData.summary.latestFindings];
                    const total = trendsData.summary.latestFindings.total || 1;
                    const percentage = Math.round((latest / total) * 100);
                    const colors = {
                      critical: { bar: 'bg-red-600', text: 'text-red-600' },
                      high: { bar: 'bg-orange-500', text: 'text-orange-500' },
                      medium: { bar: 'bg-yellow-500', text: 'text-yellow-500' },
                      low: { bar: 'bg-blue-500', text: 'text-blue-500' },
                    };
                    return (
                      <div key={severity} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium capitalize text-foreground">{severity}</span>
                          <span className={`text-sm font-bold ${colors[severity as keyof typeof colors].text}`}>
                            {latest} ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[severity as keyof typeof colors].bar}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Scans List */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Recent Scans</h3>
                <div className="space-y-3">
                  {trendsData.scans.slice(0, 10).map(scan => (
                    <div
                      key={scan.scanId}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-foreground">{scan.projectName}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(scan.date)}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="px-2 py-1 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          {scan.critical} critical
                        </span>
                        <span className="px-2 py-1 rounded bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          {scan.high} high
                        </span>
                        <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          {scan.medium} medium
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        ) : (
          /* Findings Tab Content */
          isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !data ? (
            <div className="text-center py-12 text-muted-foreground">
              Failed to load security data
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-5 mb-8">
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground">Total Findings</h3>
                <p className="mt-2 text-3xl font-bold text-foreground">{data.summary.total}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.summary.falsePositives} marked as false positive
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground">Critical</h3>
                <p className="mt-2 text-3xl font-bold text-red-600">{data.summary.bySeverity.critical}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground">High</h3>
                <p className="mt-2 text-3xl font-bold text-orange-500">{data.summary.bySeverity.high}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground">Medium</h3>
                <p className="mt-2 text-3xl font-bold text-yellow-500">{data.summary.bySeverity.medium}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground">Low</h3>
                <p className="mt-2 text-3xl font-bold text-blue-500">{data.summary.bySeverity.low}</p>
              </div>
            </div>

            {/* Projects Scanned */}
            <div className="mb-8 p-4 rounded-lg border border-border bg-card">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{data.summary.projectsScanned}</span> of{' '}
                <span className="font-semibold text-foreground">{data.summary.totalProjects}</span> projects scanned
              </p>
            </div>

            {/* Filters and Sort */}
            <div className="mb-6 flex flex-wrap items-center gap-4">
              {/* Severity Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Severity:</span>
                <div className="flex gap-1">
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
                    <button
                      key={sev}
                      onClick={() => toggleSeverityFilter(sev)}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        severityFilter.includes(sev)
                          ? getSeverityColor(sev)
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              {Object.keys(data.summary.byCategory).length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Category:</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(data.summary.byCategory).map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleCategoryFilter(cat)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          categoryFilter.includes(cat)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {cat} ({data.summary.byCategory[cat]})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sort Controls */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'severity' | 'project')}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="date">Date Discovered</option>
                  <option value="severity">Severity</option>
                  <option value="project">Project</option>
                </select>
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* Clear Filters */}
            {(severityFilter.length > 0 || categoryFilter.length > 0) && (
              <div className="mb-4">
                <button
                  onClick={() => { setSeverityFilter([]); setCategoryFilter([]); }}
                  className="text-sm text-primary hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Findings List */}
            <div className="space-y-4">
              {data.findings.length === 0 ? (
                <div className="text-center py-12 rounded-lg border border-border bg-card">
                  <div className="text-4xl mb-4">🛡️</div>
                  <h3 className="text-lg font-semibold text-foreground">No Findings</h3>
                  <p className="text-muted-foreground mt-2">
                    {severityFilter.length > 0 || categoryFilter.length > 0
                      ? 'No findings match your current filters'
                      : 'Run SAST scans on your projects to see security findings here'}
                  </p>
                </div>
              ) : (
                data.findings.map(finding => (
                  <div
                    key={finding.id}
                    className={`rounded-lg border border-border bg-card overflow-hidden border-l-4 ${getSeverityBorderColor(finding.severity)} ${
                      finding.isFalsePositive ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Finding Header */}
                    <div
                      className="p-4 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleFinding(finding.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getSeverityColor(finding.severity)}`}>
                              {finding.severity}
                            </span>
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">
                              {finding.category}
                            </span>
                            {finding.isFalsePositive && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                False Positive
                              </span>
                            )}
                          </div>
                          <h4 className={`mt-2 font-semibold text-foreground ${finding.isFalsePositive ? 'line-through' : ''}`}>
                            {finding.ruleName}
                          </h4>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {finding.message}
                          </p>
                        </div>
                        <div className="text-right text-sm shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${finding.projectId}`); }}
                            className="text-primary hover:underline font-medium"
                          >
                            {finding.projectName}
                          </button>
                          <p className="text-muted-foreground text-xs mt-1">
                            {formatDate(finding.scanDate)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedFindings.has(finding.id) && (
                      <div className="border-t border-border p-4 bg-muted/30">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <h5 className="text-sm font-semibold text-foreground mb-2">Location</h5>
                            <p className="text-sm font-mono text-muted-foreground">
                              {finding.filePath}:{finding.line}
                              {finding.column && `:${finding.column}`}
                            </p>
                          </div>
                          {finding.cweId && (
                            <div>
                              <h5 className="text-sm font-semibold text-foreground mb-2">Reference</h5>
                              <p className="text-sm text-muted-foreground">
                                {finding.cweId}
                                {finding.owaspCategory && ` • ${finding.owaspCategory}`}
                              </p>
                            </div>
                          )}
                        </div>
                        {finding.snippet && (
                          <div className="mt-4">
                            <h5 className="text-sm font-semibold text-foreground mb-2">Code Snippet</h5>
                            <pre className="p-3 rounded bg-background border border-border text-sm overflow-x-auto">
                              <code>{finding.snippet}</code>
                            </pre>
                          </div>
                        )}
                        {finding.suggestion && (
                          <div className="mt-4">
                            <h5 className="text-sm font-semibold text-foreground mb-2">Suggested Fix</h5>
                            <p className="text-sm text-muted-foreground">{finding.suggestion}</p>
                          </div>
                        )}
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => navigate(`/projects/${finding.projectId}`)}
                            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            View Project
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Load More */}
            {data.pagination.hasMore && (
              <div className="mt-6 text-center">
                <button
                  className="px-6 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-muted"
                >
                  Load More
                </button>
              </div>
            )}
          </>
          )
        )}
      </div>
    </Layout>
  );
}
