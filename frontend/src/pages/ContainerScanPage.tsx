// Container Image Scanning with Trivy - Feature #269
// Scan Docker images for OS-level vulnerabilities
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Button } from '../components/ui/button';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { useAuthStore } from '../stores/authStore';
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Package,
  Layers,
  Download,
  RefreshCw,
  CheckCircle,
  // XCircle, // Unused
} from 'lucide-react';

interface Vulnerability {
  id: string;
  package: string;
  version: string;
  fixed_version?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvss_score: number;
  in_base_image: boolean;
}

interface Layer {
  id: string;
  command: string;
  size_mb: number;
  vulnerability_count: number;
  is_base_layer: boolean;
}

interface ScanResult {
  scan_id: string;
  image: {
    reference: string;
    name: string;
    tag: string;
    registry: string;
  };
  scan: {
    status: string;
    scanned_at: string;
    scanner: string;
    scanner_version: string;
  };
  summary: {
    total_vulnerabilities: number;
    by_severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    fixable: number;
    from_base_image: number;
  };
  vulnerabilities: Vulnerability[];
  layers?: Layer[];
  base_image?: {
    reference: string;
    vulnerabilities: number;
    recommendation: string;
  };
}

const severityColors = {
  critical: 'bg-destructive text-primary-foreground',
  high: 'bg-warning text-primary-foreground',
  medium: 'bg-warning text-warning-foreground',
  low: 'bg-primary text-primary-foreground',
};

const severityBorderColors = {
  critical: 'border-destructive',
  high: 'border-warning',
  medium: 'border-warning',
  low: 'border-primary',
};

export function ContainerScanPage() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [imageName, setImageName] = useState('nginx:latest');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedVulns, setExpandedVulns] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showLayers, setShowLayers] = useState(true);

  const handleScan = async () => {
    if (!imageName.trim()) {
      setError('Please enter an image name');
      return;
    }

    setScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const response = await fetch(
        `/api/v1/security/container/scan?image=${encodeURIComponent(imageName)}&include_layers=true&include_base=true`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Scan failed with status ${response.status}`);
      }

      const data = await response.json();
      setScanResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan image');
    } finally {
      setScanning(false);
    }
  };

  const toggleVulnExpand = (id: string) => {
    const newExpanded = new Set(expandedVulns);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedVulns(newExpanded);
  };

  const filteredVulnerabilities = scanResult?.vulnerabilities.filter(v =>
    severityFilter === 'all' || v.severity === severityFilter
  ) ?? [];

  const exportReport = () => {
    if (!scanResult) return;
    const report = JSON.stringify(scanResult, null, 2);
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `container-scan-${scanResult.image.name.replace(/\//g, '-')}-${scanResult.image.tag}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Feature #639: PageHeader component */}
        <PageHeader
          title="Container Image Scanning"
          description="Scan Docker images for OS-level vulnerabilities using Trivy"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'Container Scan' }]}
          actions={
            scanResult && (
              <Button
                onClick={exportReport}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            )
          }
        />

        {/* Scan Form */}
        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Scan Container Image</h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Image Name (e.g., nginx:latest, node:18-alpine)
              </label>
              <input
                type="text"
                value={imageName}
                onChange={(e) => setImageName(e.target.value)}
                placeholder="Enter image name..."
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center gap-2"
              >
                {scanning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Scan Image
                  </>
                )}
              </Button>
            </div>
          </div>
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        {/* Scan Results */}
        {scanResult && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Package className="h-4 w-4" />
                  <span className="text-sm">Image</span>
                </div>
                <p className="text-lg font-semibold text-foreground truncate" title={scanResult.image.reference}>
                  {scanResult.image.reference}
                </p>
                <p className="text-xs text-muted-foreground">{scanResult.image.registry}</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Total Vulnerabilities</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{scanResult.summary.total_vulnerabilities}</p>
                <p className="text-xs text-muted-foreground">{scanResult.summary.fixable} fixable</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Layers className="h-4 w-4" />
                  <span className="text-sm">Base Image Issues</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{scanResult.summary.from_base_image}</p>
                <p className="text-xs text-muted-foreground">from base image</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Info className="h-4 w-4" />
                  <span className="text-sm">Scanner</span>
                </div>
                <p className="text-lg font-semibold text-foreground">{scanResult.scan.scanner}</p>
                <p className="text-xs text-muted-foreground">v{scanResult.scan.scanner_version}</p>
              </div>
            </div>

            {/* Severity Breakdown */}
            <div className="rounded-lg border border-border bg-card p-6 mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Severity Breakdown</h3>
              <div className="flex gap-4 flex-wrap">
                <Button
                  onClick={() => setSeverityFilter('all')}
                  variant={severityFilter === 'all' ? 'default' : 'outline'}
                >
                  All ({scanResult.summary.total_vulnerabilities})
                </Button>
                <Button
                  onClick={() => setSeverityFilter('critical')}
                  variant={severityFilter === 'critical' ? 'destructive' : 'outline'}
                >
                  Critical ({scanResult.summary.by_severity.critical})
                </Button>
                <Button
                  onClick={() => setSeverityFilter('high')}
                  variant={severityFilter === 'high' ? 'secondary' : 'outline'}
                >
                  High ({scanResult.summary.by_severity.high})
                </Button>
                <Button
                  onClick={() => setSeverityFilter('medium')}
                  variant={severityFilter === 'medium' ? 'secondary' : 'outline'}
                >
                  Medium ({scanResult.summary.by_severity.medium})
                </Button>
                <Button
                  onClick={() => setSeverityFilter('low')}
                  variant={severityFilter === 'low' ? 'default' : 'outline'}
                >
                  Low ({scanResult.summary.by_severity.low})
                </Button>
              </div>
            </div>

            {/* Base Image Recommendation */}
            {scanResult.base_image && (
              <div className={`rounded-lg border p-4 mb-6 ${
                scanResult.base_image.vulnerabilities > 0
                  ? 'border-warning bg-warning/10'
                  : 'border-success bg-success/10'
              }`}>
                <div className="flex items-start gap-3">
                  {scanResult.base_image.vulnerabilities > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-semibold text-foreground">Base Image: {scanResult.base_image.reference}</h4>
                    <p className="text-sm text-muted-foreground">{scanResult.base_image.recommendation}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Layer Analysis */}
            {scanResult.layers && scanResult.layers.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-6 mb-6">
                <Button
                  onClick={() => setShowLayers(!showLayers)}
                  variant="ghost"
                  className="flex items-center gap-2 text-lg font-semibold mb-4"
                >
                  {showLayers ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  <Layers className="h-5 w-5" />
                  Layer Analysis
                </Button>
                {showLayers && (
                  <div className="space-y-2">
                    {scanResult.layers.map((layer, index) => (
                      <div
                        key={layer.id}
                        className={`p-3 rounded-lg border ${
                          layer.vulnerability_count > 0 ? 'border-warning/50 bg-warning/5' : 'border-border bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">#{index + 1}</span>
                            <code className="text-sm text-foreground bg-muted px-2 py-1 rounded">{layer.command}</code>
                            {layer.is_base_layer && (
                              <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">Base Layer</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">{layer.size_mb} MB</span>
                            {layer.vulnerability_count > 0 ? (
                              <span className="text-warning font-medium">{layer.vulnerability_count} vulnerabilities</span>
                            ) : (
                              <span className="text-success">Clean</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Vulnerabilities List */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Vulnerabilities ({filteredVulnerabilities.length})
              </h3>
              {/* Feature #728: EmptyState adoption */}
              {filteredVulnerabilities.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.security}
                  title="No vulnerabilities found"
                  description="No vulnerabilities found for the selected severity filter."
                  size="sm"
                />
              ) : (
                <div className="space-y-3">
                  {filteredVulnerabilities.map((vuln) => (
                    <div
                      key={vuln.id}
                      className={`rounded-lg border-l-4 ${severityBorderColors[vuln.severity]} bg-muted/50 overflow-hidden`}
                    >
                      <Button
                        onClick={() => toggleVulnExpand(vuln.id)}
                        variant="ghost"
                        className="w-full p-4 text-left flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${severityColors[vuln.severity]}`}>
                            {vuln.severity}
                          </span>
                          <div>
                            <span className="font-mono text-foreground">{vuln.id}</span>
                            <span className="text-muted-foreground mx-2">in</span>
                            <span className="font-medium text-foreground">{vuln.package}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">CVSS {vuln.cvss_score}</span>
                          {vuln.in_base_image && (
                            <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">Base Image</span>
                          )}
                          {expandedVulns.has(vuln.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </Button>
                      {expandedVulns.has(vuln.id) && (
                        <div className="px-4 pb-4 border-t border-border">
                          <div className="grid grid-cols-2 gap-4 pt-4">
                            <div>
                              <span className="text-sm text-muted-foreground">Installed Version</span>
                              <p className="font-mono text-foreground">{vuln.version}</p>
                            </div>
                            <div>
                              <span className="text-sm text-muted-foreground">Fixed Version</span>
                              {vuln.fixed_version ? (
                                <p className="font-mono text-success">{vuln.fixed_version}</p>
                              ) : (
                                <p className="text-muted-foreground italic">No fix available</p>
                              )}
                            </div>
                          </div>
                          {vuln.fixed_version && (
                            <div className="mt-3 p-3 rounded bg-success/10 border border-success/30">
                              <div className="flex items-center gap-2 text-success">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Fix Available</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Update {vuln.package} from {vuln.version} to {vuln.fixed_version}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Feature #728: EmptyState adoption */}
        {!scanResult && !scanning && (
          <EmptyState
            icon={EmptyStateIcons.security}
            title="Scan Container Images"
            description="Enter a Docker image name above to scan for OS-level vulnerabilities, outdated packages, and security issues in your container images."
            size="lg"
          />
        )}
      </div>
    </Layout>
  );
}
