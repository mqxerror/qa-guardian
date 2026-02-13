// Feature #725: npm Audit Page — wired to backend dependency-scanner
// Replaces the "Coming Soon" stub with a full scan UI using the existing
// GET /api/v1/security/dependencies/:projectId endpoint.

import { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import {
  PageHeader,
  Badge,
  SeverityBadge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
  Alert,
  AlertTitle,
  AlertDescription,
} from '../components/ui';
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { Button } from '../components/ui/button';
import { Skeleton, SkeletonTable, SkeletonStatsGrid } from '../components/ui/Skeleton';
import { toast } from '../stores/toastStore';
import {
  Package,
  RefreshCw,
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  ArrowUpCircle,
} from 'lucide-react';
import {
  useProjects,
  useNpmAuditScan,
  useRunNpmAuditScan,
  type NpmAuditDependency,
} from '../hooks/api';
import type { SeverityLevel } from '../constants/colors';

// ============================================================================
// Severity filter tab values
// ============================================================================

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

// ============================================================================
// Component
// ============================================================================

export function NpmAuditPage() {
  // ---- Project selection state ----
  const { data: projectsData, isLoading: isLoadingProjects } = useProjects();
  const projects = projectsData?.projects ?? [];
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // ---- Scan options ----
  const [includeDev, setIncludeDev] = useState(true);

  // ---- Whether the user has triggered a scan at least once ----
  const [scanTriggered, setScanTriggered] = useState(false);

  // ---- Fetch npm audit results ----
  const {
    data: scanResult,
    isLoading: isScanning,
    isError,
    error,
    isFetching,
  } = useNpmAuditScan(selectedProjectId, includeDev, scanTriggered && !!selectedProjectId);

  const { runScan } = useRunNpmAuditScan(selectedProjectId, includeDev);

  // ---- UI state ----
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [expandedDep, setExpandedDep] = useState<string | null>(null);

  // ---- Handlers ----

  const handleRunScan = () => {
    if (!selectedProjectId) {
      toast.error('Please select a project first');
      return;
    }
    setScanTriggered(true);
    // If already triggered, invalidate cache to force re-fetch
    runScan();
    toast.info('Starting npm audit scan...');
  };

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command).then(() => {
      toast.success('Command copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy command');
    });
  };

  // ---- Derived data ----

  const summary = scanResult?.summary;

  // Memoize the dependencies array to avoid re-creating [] on every render
  const dependencies = useMemo(
    () => scanResult?.dependencies ?? [],
    [scanResult?.dependencies]
  );

  /** Filter dependencies by severity level of their worst vulnerability */
  const filteredDependencies = useMemo(() => {
    if (severityFilter === 'all') return dependencies;

    return dependencies.filter((dep: NpmAuditDependency) => {
      if (!dep.vulnerable) return false;
      return dep.vulnerabilities.some(v => v.severity === severityFilter);
    });
  }, [dependencies, severityFilter]);

  /** Count vulnerable packages per severity for the filter tab badges */
  const severityCounts = useMemo(() => {
    const counts = { all: 0, critical: 0, high: 0, medium: 0, low: 0 };
    for (const dep of dependencies) {
      if (!dep.vulnerable) continue;
      counts.all++;
      const severities = new Set(dep.vulnerabilities.map(v => v.severity));
      if (severities.has('critical')) counts.critical++;
      if (severities.has('high')) counts.high++;
      if (severities.has('medium')) counts.medium++;
      if (severities.has('low')) counts.low++;
    }
    return counts;
  }, [dependencies]);

  // ---- Render helpers ----

  const renderScanControls = () => (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={includeDev}
          onChange={(e) => setIncludeDev(e.target.checked)}
          className="rounded border-border"
        />
        Include dev dependencies
      </label>
      <Button
        onClick={handleRunScan}
        disabled={!selectedProjectId || isFetching}
      >
        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        {isFetching ? 'Scanning...' : 'Run Scan'}
      </Button>
    </div>
  );

  // ---- Render ----

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageHeader
          title="npm Audit"
          description="Audit npm dependencies for known vulnerabilities using real npm audit"
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Security', href: '/security' },
            { label: 'npm Audit' },
          ]}
          actions={renderScanControls()}
        />

        {/* Project Selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <label htmlFor="npm-audit-project" className="text-sm font-medium text-foreground whitespace-nowrap">
                Project
              </label>
              {isLoadingProjects ? (
                <Skeleton className="h-10 w-64" />
              ) : (
                <select
                  id="npm-audit-project"
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    // Reset scan state when project changes
                    setScanTriggered(false);
                  }}
                  className="flex-1 max-w-md px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="">Select a project...</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pre-scan state: no project selected or scan not yet triggered */}
        {!scanTriggered && (
          <EmptyState
            icon={EmptyStateIcons.security}
            title="Ready to Scan"
            description="Select a project and click 'Run Scan' to audit npm dependencies for known vulnerabilities."
            size="lg"
          />
        )}

        {/* Loading state */}
        {scanTriggered && isScanning && !scanResult && (
          <div className="space-y-6">
            <SkeletonStatsGrid count={5} />
            <SkeletonTable rows={6} columns={6} />
          </div>
        )}

        {/* Error state */}
        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scan Failed</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'An unexpected error occurred while running the npm audit scan.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Scan warning (e.g., no package-lock.json) */}
        {scanResult?.scan_warning && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scan Warning</AlertTitle>
            <AlertDescription>{scanResult.scan_warning}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {scanResult && summary && (
          <>
            {/* Summary Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Total Dependencies
                </div>
                <div className="text-2xl font-bold text-foreground mt-1">
                  {summary.total_dependencies}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summary.production_dependencies} prod / {summary.dev_dependencies} dev
                </div>
              </div>

              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <ShieldAlert className="h-4 w-4" />
                  Critical
                </div>
                <div className="text-2xl font-bold text-destructive mt-1">
                  {summary.severity_breakdown.critical}
                </div>
              </div>

              <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                <div className="flex items-center gap-2 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  High
                </div>
                <div className="text-2xl font-bold text-warning mt-1">
                  {summary.severity_breakdown.high}
                </div>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Shield className="h-4 w-4" />
                  Medium
                </div>
                <div className="text-2xl font-bold text-primary mt-1">
                  {summary.severity_breakdown.medium}
                </div>
              </div>

              <div className="rounded-lg border border-success/30 bg-success/10 p-4">
                <div className="flex items-center gap-2 text-sm text-success">
                  <ShieldCheck className="h-4 w-4" />
                  Low
                </div>
                <div className="text-2xl font-bold text-success mt-1">
                  {summary.severity_breakdown.low}
                </div>
              </div>
            </div>

            {/* Scan metadata */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Source: <span className="font-medium text-foreground">{scanResult.source}</span>
                {' | '}
                Scanned: <span className="font-medium text-foreground">{new Date(scanResult.scanned_at).toLocaleString()}</span>
                {' | '}
                Vulnerable: <span className="font-medium text-foreground">{summary.vulnerable_dependencies}</span> of {summary.total_dependencies} packages
              </span>
              {isFetching && (
                <span className="flex items-center gap-2 text-primary">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Refreshing...
                </span>
              )}
            </div>

            {/* Severity Filter Tabs + Dependencies Table */}
            <Tabs value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="all">
                    All
                    {severityCounts.all > 0 && (
                      <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                        {severityCounts.all}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="critical">
                    Critical
                    {severityCounts.critical > 0 && (
                      <span className="ml-1.5 text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
                        {severityCounts.critical}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="high">
                    High
                    {severityCounts.high > 0 && (
                      <span className="ml-1.5 text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">
                        {severityCounts.high}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="medium">
                    Medium
                    {severityCounts.medium > 0 && (
                      <span className="ml-1.5 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                        {severityCounts.medium}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="low">
                    Low
                    {severityCounts.low > 0 && (
                      <span className="ml-1.5 text-xs bg-success/20 text-success px-1.5 py-0.5 rounded-full">
                        {severityCounts.low}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* All tabs share the same content; filtering happens via the state */}
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(tab => (
                <TabsContent key={tab} value={tab}>
                  {filteredDependencies.length === 0 ? (
                    <EmptyState
                      icon={EmptyStateIcons.security}
                      title={tab === 'all' ? 'No Vulnerable Dependencies' : `No ${tab} severity vulnerabilities`}
                      description={
                        tab === 'all'
                          ? 'Great news! No vulnerable dependencies were found in this scan.'
                          : `No dependencies with ${tab} severity vulnerabilities were found.`
                      }
                    />
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8" />
                            <TableHead>Package</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Vulnerabilities</TableHead>
                            <TableHead>Fix Available</TableHead>
                            <TableHead>Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDependencies.map((dep: NpmAuditDependency) => {
                            const isExpanded = expandedDep === dep.name;
                            // Determine the worst severity for this dependency
                            const worstSeverity = getWorstSeverity(dep);

                            return (
                              <DepRow
                                key={dep.name}
                                dep={dep}
                                worstSeverity={worstSeverity}
                                isExpanded={isExpanded}
                                onToggle={() => setExpandedDep(isExpanded ? null : dep.name)}
                                onCopyCommand={handleCopyCommand}
                              />
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>

            {/* Upgrade Suggestions */}
            {scanResult.upgrade_suggestions.length > 0 && (
              <div className="rounded-lg border border-border bg-card">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <ArrowUpCircle className="h-5 w-5 text-primary" />
                    Upgrade Suggestions
                  </h2>
                </div>
                <div className="p-6 space-y-3">
                  {scanResult.upgrade_suggestions.map(suggestion => (
                    <div
                      key={suggestion.package}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                    >
                      <div>
                        <span className="font-mono text-sm text-foreground">{suggestion.package}</span>
                        <span className="text-muted-foreground text-sm ml-2">
                          {suggestion.current_version} → {suggestion.recommended_version}
                        </span>
                        {suggestion.breaking_changes_likely && (
                          <Badge color="orange" size="xs" className="ml-2">
                            Breaking
                          </Badge>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Fixes {suggestion.vulnerabilities_fixed} vulnerabilit{suggestion.vulnerabilities_fixed === 1 ? 'y' : 'ies'}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyCommand(suggestion.upgrade_command)}
                      >
                        <Copy className="h-3 w-3" />
                        Copy Command
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {scanResult.recommendations.length > 0 && (
              <div className="rounded-lg border border-border bg-card">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="text-lg font-semibold text-foreground">Recommendations</h2>
                </div>
                <div className="p-6 space-y-3">
                  {scanResult.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                      <Badge
                        variant="severity"
                        value={mapRecommendationPriority(rec.priority)}
                        size="sm"
                      >
                        {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}
                      </Badge>
                      <div>
                        <div className="text-sm font-medium text-foreground">{rec.message}</div>
                        <div className="text-xs text-muted-foreground mt-1">{rec.action}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * A single dependency row in the table, with expandable vulnerability details.
 * Extracted for readability and to avoid an overly complex render tree.
 */
function DepRow({
  dep,
  worstSeverity,
  isExpanded,
  onToggle,
  onCopyCommand,
}: {
  dep: NpmAuditDependency;
  worstSeverity: SeverityLevel;
  isExpanded: boolean;
  onToggle: () => void;
  onCopyCommand: (cmd: string) => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          {dep.vulnerability_count > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : null}
        </TableCell>
        <TableCell>
          <span className="font-mono text-sm font-medium text-foreground">{dep.name}</span>
        </TableCell>
        <TableCell>
          <span className="font-mono text-sm text-muted-foreground">{dep.version}</span>
        </TableCell>
        <TableCell>
          {dep.vulnerable ? (
            <SeverityBadge severity={worstSeverity} />
          ) : (
            <Badge color="green" size="sm">Clean</Badge>
          )}
        </TableCell>
        <TableCell>
          <span className="text-sm text-foreground">{dep.vulnerability_count}</span>
        </TableCell>
        <TableCell>
          {dep.update_available ? (
            <span className="text-xs text-success font-medium">Yes</span>
          ) : dep.vulnerable ? (
            <span className="text-xs text-muted-foreground">No</span>
          ) : (
            <span className="text-xs text-muted-foreground">--</span>
          )}
        </TableCell>
        <TableCell>
          <Badge
            color={dep.type === 'production' ? 'blue' : 'gray'}
            size="xs"
          >
            {dep.type === 'production' ? 'prod' : 'dev'}
          </Badge>
        </TableCell>
      </TableRow>

      {/* Expanded vulnerability detail rows */}
      {isExpanded && dep.vulnerabilities.map((vuln, i) => (
        <TableRow key={`${dep.name}-vuln-${i}`} className="bg-muted/20">
          <TableCell />
          <TableCell colSpan={6}>
            <div className="py-1 pl-4 border-l-2 border-border space-y-1">
              <div className="flex items-center gap-3">
                <SeverityBadge severity={vuln.severity as SeverityLevel} size="xs" />
                <span className="text-sm font-medium text-foreground">{vuln.title}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>ID: <span className="font-mono">{vuln.cve_id}</span></span>
                <span>Patch: {vuln.patched_version}</span>
                {vuln.cwe_ids.length > 0 && (
                  <span>CWE: {vuln.cwe_ids.join(', ')}</span>
                )}
                {vuln.references.length > 0 && (
                  <a
                    href={vuln.references[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Advisory <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {dep.update_available && dep.latest_version && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-success">
                    Fix: upgrade to {dep.latest_version}
                  </span>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      const cmd = dep.latest_version.startsWith('via ')
                        ? `npm update ${dep.latest_version.replace('via ', '').split('@')[0]}`
                        : `npm install ${dep.name}@${dep.latest_version}`;
                      onCopyCommand(cmd);
                    }}
                  >
                    <Copy className="h-3 w-3 inline mr-1" />
                    Copy fix command
                  </Button>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/** Determine the worst severity among a dependency's vulnerabilities */
function getWorstSeverity(dep: NpmAuditDependency): SeverityLevel {
  const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  let worst: SeverityLevel = 'info';
  let worstScore = -1;

  for (const vuln of dep.vulnerabilities) {
    const score = order[vuln.severity] ?? 0;
    if (score > worstScore) {
      worstScore = score;
      worst = vuln.severity as SeverityLevel;
    }
  }

  return worst;
}

/** Map recommendation priority strings to SeverityLevel for badge rendering */
function mapRecommendationPriority(priority: string): SeverityLevel {
  switch (priority.toLowerCase()) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'medium': return 'medium';
    case 'low': return 'low';
    default: return 'info';
  }
}
