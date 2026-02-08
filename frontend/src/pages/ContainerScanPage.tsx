// Container Image Scanning with Trivy - Feature #269
// Scan Docker images for OS-level vulnerabilities
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
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
  ArrowLeft,
  CheckCircle,
  XCircle
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
  critical: 'bg-destructive text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-warning text-black',
  low: 'bg-primary text-white',
};

const severityBorderColors = {
  critical: 'border-destructive',
  high: 'border-orange-500',
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
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/security')}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Container Image Scanning
              </h1>
              <p className="text-muted-foreground">Scan Docker images for OS-level vulnerabilities using Trivy</p>
            </div>
          </div>
          {scanResult && (
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Download className="h-4 w-4" />
              Export Report
            </button>
          )}
        </div>

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
              <button
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
              </button>
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
                <button
                  onClick={() => setSeverityFilter('all')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    severityFilter === 'all'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  All ({scanResult.summary.total_vulnerabilities})
                </button>
                <button
                  onClick={() => setSeverityFilter('critical')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    severityFilter === 'critical'
                      ? 'bg-destructive text-white border-destructive'
                      : 'border-destructive text-destructive hover:bg-destructive/10'
                  }`}
                >
                  Critical ({scanResult.summary.by_severity.critical})
                </button>
                <button
                  onClick={() => setSeverityFilter('high')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    severityFilter === 'high'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-orange-500 text-orange-500 hover:bg-orange-500/10'
                  }`}
                >
                  High ({scanResult.summary.by_severity.high})
                </button>
                <button
                  onClick={() => setSeverityFilter('medium')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    severityFilter === 'medium'
                      ? 'bg-warning text-black border-warning'
                      : 'border-warning text-warning hover:bg-warning/10'
                  }`}
                >
                  Medium ({scanResult.summary.by_severity.medium})
                </button>
                <button
                  onClick={() => setSeverityFilter('low')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    severityFilter === 'low'
                      ? 'bg-primary text-white border-primary'
                      : 'border-primary text-primary hover:bg-primary/10'
                  }`}
                >
                  Low ({scanResult.summary.by_severity.low})
                </button>
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
                <button
                  onClick={() => setShowLayers(!showLayers)}
                  className="flex items-center gap-2 text-lg font-semibold text-foreground mb-4 hover:text-primary transition-colors"
                >
                  {showLayers ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  <Layers className="h-5 w-5" />
                  Layer Analysis
                </button>
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
              {filteredVulnerabilities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-success" />
                  <p>No vulnerabilities found for the selected severity filter</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredVulnerabilities.map((vuln) => (
                    <div
                      key={vuln.id}
                      className={`rounded-lg border-l-4 ${severityBorderColors[vuln.severity]} bg-muted/50 overflow-hidden`}
                    >
                      <button
                        onClick={() => toggleVulnExpand(vuln.id)}
                        className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/80 transition-colors"
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
                      </button>
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

        {/* Empty State */}
        {!scanResult && !scanning && (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Scan Container Images</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Enter a Docker image name above to scan for OS-level vulnerabilities,
              outdated packages, and security issues in your container images.
            </p>
            <div className="flex flex-wrap gap-2 justify-center text-sm">
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground">nginx:latest</span>
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground">node:18-alpine</span>
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground">python:3.11-slim</span>
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground">postgres:15</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
