// Feature #764: Container Image Scanning Page
// Extracted from App.tsx for code quality compliance (400 line limit)
// Scans Docker images for vulnerabilities in base images and dependencies
// Feature #1986: Shows demo/mock data - real container scanning integration coming soon

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';

// Container registry interface
interface ContainerRegistry {
  id: string;
  name: string;
  type: 'docker-hub' | 'gcr' | 'ecr' | 'acr' | 'ghcr' | 'custom';
  url: string;
  connected: boolean;
  lastSync?: string;
}

// Container image interface
interface ContainerImage {
  id: string;
  name: string;
  tag: string;
  digest: string;
  size: string;
  created: string;
  registry: string;
  layers: number;
  platform: string;
}

// Container layer interface
interface ContainerLayer {
  id: string;
  command: string;
  size: string;
  created: string;
  vulnerabilities: number;
  isBaseImage: boolean;
}

// Container vulnerability interface
interface ContainerVulnerability {
  id: string;
  cveId: string;
  pkgName: string;
  installedVersion: string;
  fixedVersion?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  title: string;
  description: string;
  layer: string;
  isBaseImage: boolean;
  cvss?: number;
  publishedDate: string;
}

// Container scan result interface
interface ContainerScanResult {
  id: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  image: ContainerImage;
  layers: ContainerLayer[];
  vulnerabilities: ContainerVulnerability[];
  summary: {
    total: number;
    bySeverity: { critical: number; high: number; medium: number; low: number; unknown: number };
    baseImageVulns: number;
    applicationVulns: number;
    fixable: number;
  };
  progress?: {
    phase: string;
    percentage: number;
  };
}

export function ContainerScanPage() {
  const navigate = useNavigate();
  const [registries] = useState<ContainerRegistry[]>([
    { id: 'r1', name: 'Docker Hub', type: 'docker-hub', url: 'https://hub.docker.com', connected: true, lastSync: '2026-01-16T10:00:00Z' },
    { id: 'r2', name: 'GitHub Container Registry', type: 'ghcr', url: 'https://ghcr.io', connected: true, lastSync: '2026-01-16T09:30:00Z' },
    { id: 'r3', name: 'AWS ECR', type: 'ecr', url: 'https://123456789.dkr.ecr.us-east-1.amazonaws.com', connected: false },
  ]);
  const [showRegistryConfig, setShowRegistryConfig] = useState(false);
  const [selectedRegistry, setSelectedRegistry] = useState<string>('r1');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ContainerScanResult | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [showBaseImageOnly, setShowBaseImageOnly] = useState(false);
  const [expandedVulns, setExpandedVulns] = useState<Set<string>>(new Set());
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'vulnerabilities' | 'layers'>('vulnerabilities');

  // Mock images for selected registry
  const mockImages: Record<string, ContainerImage[]> = {
    r1: [
      { id: 'img1', name: 'qa-guardian/backend', tag: 'latest', digest: 'sha256:abc123...', size: '245 MB', created: '2026-01-15T14:00:00Z', registry: 'Docker Hub', layers: 12, platform: 'linux/amd64' },
      { id: 'img2', name: 'qa-guardian/frontend', tag: 'v2.1.0', digest: 'sha256:def456...', size: '125 MB', created: '2026-01-14T10:00:00Z', registry: 'Docker Hub', layers: 8, platform: 'linux/amd64' },
      { id: 'img3', name: 'qa-guardian/worker', tag: 'latest', digest: 'sha256:ghi789...', size: '310 MB', created: '2026-01-13T16:00:00Z', registry: 'Docker Hub', layers: 15, platform: 'linux/amd64' },
    ],
    r2: [
      { id: 'img4', name: 'ghcr.io/qa-guardian/api', tag: 'main', digest: 'sha256:jkl012...', size: '198 MB', created: '2026-01-16T08:00:00Z', registry: 'GitHub Container Registry', layers: 10, platform: 'linux/amd64' },
    ],
    r3: [],
  };

  // Mock layers for scanned image
  const mockLayers: ContainerLayer[] = [
    { id: 'l1', command: 'FROM node:20-alpine', size: '118 MB', created: '2026-01-10T00:00:00Z', vulnerabilities: 3, isBaseImage: true },
    { id: 'l2', command: 'RUN apk add --no-cache python3 make g++', size: '45 MB', created: '2026-01-10T00:01:00Z', vulnerabilities: 2, isBaseImage: true },
    { id: 'l3', command: 'WORKDIR /app', size: '0 B', created: '2026-01-15T14:00:00Z', vulnerabilities: 0, isBaseImage: false },
    { id: 'l4', command: 'COPY package*.json ./', size: '512 KB', created: '2026-01-15T14:00:01Z', vulnerabilities: 0, isBaseImage: false },
    { id: 'l5', command: 'RUN npm ci --only=production', size: '78 MB', created: '2026-01-15T14:00:30Z', vulnerabilities: 4, isBaseImage: false },
    { id: 'l6', command: 'COPY . .', size: '3.2 MB', created: '2026-01-15T14:01:00Z', vulnerabilities: 0, isBaseImage: false },
    { id: 'l7', command: 'RUN npm run build', size: '1.1 MB', created: '2026-01-15T14:02:00Z', vulnerabilities: 0, isBaseImage: false },
    { id: 'l8', command: 'EXPOSE 3000', size: '0 B', created: '2026-01-15T14:02:01Z', vulnerabilities: 0, isBaseImage: false },
    { id: 'l9', command: 'CMD ["node", "dist/index.js"]', size: '0 B', created: '2026-01-15T14:02:02Z', vulnerabilities: 0, isBaseImage: false },
  ];

  // Mock vulnerabilities
  const mockVulnerabilities: ContainerVulnerability[] = [
    { id: 'cv1', cveId: 'CVE-2024-21626', pkgName: 'runc', installedVersion: '1.1.9', fixedVersion: '1.1.12', severity: 'CRITICAL', title: 'Container Escape via WORKDIR', description: 'A file descriptor leak vulnerability in runc allows container escape via the WORKDIR instruction when running malicious images.', layer: 'l1', isBaseImage: true, cvss: 9.8, publishedDate: '2024-01-31' },
    { id: 'cv2', cveId: 'CVE-2024-24790', pkgName: 'golang', installedVersion: '1.21.0', fixedVersion: '1.21.11', severity: 'CRITICAL', title: 'Memory Corruption in net/netip', description: 'A vulnerability in Go\'s net/netip package allows memory corruption when parsing malformed IPv4-mapped IPv6 addresses.', layer: 'l1', isBaseImage: true, cvss: 9.1, publishedDate: '2024-06-04' },
    { id: 'cv3', cveId: 'CVE-2024-28180', pkgName: 'busybox', installedVersion: '1.36.1', fixedVersion: '1.36.2', severity: 'HIGH', title: 'Command Injection in ash', description: 'BusyBox ash shell allows command injection via specially crafted environment variables.', layer: 'l2', isBaseImage: true, cvss: 8.1, publishedDate: '2024-03-06' },
    { id: 'cv4', cveId: 'CVE-2024-27982', pkgName: 'node', installedVersion: '20.10.0', fixedVersion: '20.12.0', severity: 'HIGH', title: 'HTTP Request Smuggling', description: 'Node.js is vulnerable to HTTP Request Smuggling via Content-Length and Transfer-Encoding headers.', layer: 'l1', isBaseImage: true, cvss: 7.5, publishedDate: '2024-04-03' },
    { id: 'cv5', cveId: 'CVE-2024-4068', pkgName: 'braces', installedVersion: '3.0.2', fixedVersion: '3.0.3', severity: 'HIGH', title: 'ReDoS in braces', description: 'The braces npm package before 3.0.3 is vulnerable to Regular Expression Denial of Service.', layer: 'l5', isBaseImage: false, cvss: 7.5, publishedDate: '2024-05-13' },
    { id: 'cv6', cveId: 'CVE-2024-38374', pkgName: 'lodash', installedVersion: '4.17.15', fixedVersion: '4.17.21', severity: 'HIGH', title: 'Prototype Pollution', description: 'Lodash is vulnerable to Prototype Pollution via the setWith function.', layer: 'l5', isBaseImage: false, cvss: 7.2, publishedDate: '2024-06-15' },
    { id: 'cv7', cveId: 'CVE-2024-4067', pkgName: 'micromatch', installedVersion: '4.0.4', fixedVersion: '4.0.6', severity: 'MEDIUM', title: 'ReDoS in micromatch', description: 'Micromatch before 4.0.6 is vulnerable to Regular Expression Denial of Service.', layer: 'l5', isBaseImage: false, cvss: 6.5, publishedDate: '2024-05-14' },
    { id: 'cv8', cveId: 'CVE-2024-28863', pkgName: 'tar', installedVersion: '6.1.11', fixedVersion: '6.2.1', severity: 'MEDIUM', title: 'Directory Traversal', description: 'The tar npm package allows directory traversal via symbolic links.', layer: 'l5', isBaseImage: false, cvss: 5.5, publishedDate: '2024-04-02' },
    { id: 'cv9', cveId: 'CVE-2023-44270', pkgName: 'postcss', installedVersion: '8.4.21', fixedVersion: '8.4.31', severity: 'LOW', title: 'ReDoS in PostCSS', description: 'PostCSS is vulnerable to regular expression denial of service.', layer: 'l5', isBaseImage: false, cvss: 3.7, publishedDate: '2023-09-29' },
  ];

  const runScan = async () => {
    if (!selectedImage) return;

    setIsScanning(true);
    const image = mockImages[selectedRegistry]?.find(i => i.id === selectedImage);
    if (!image) return;

    setScanResult({
      id: `container_scan_${Date.now()}`,
      status: 'scanning',
      startedAt: new Date().toISOString(),
      image,
      layers: [],
      vulnerabilities: [],
      summary: { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }, baseImageVulns: 0, applicationVulns: 0, fixable: 0 },
      progress: { phase: 'Pulling image manifest...', percentage: 5 },
    });

    await new Promise(r => setTimeout(r, 600));
    setScanResult(prev => prev ? { ...prev, progress: { phase: 'Downloading image layers...', percentage: 15 } } : null);

    await new Promise(r => setTimeout(r, 800));
    setScanResult(prev => prev ? { ...prev, progress: { phase: 'Analyzing base image: node:20-alpine...', percentage: 30 } } : null);

    await new Promise(r => setTimeout(r, 600));
    setScanResult(prev => prev ? { ...prev, progress: { phase: 'Scanning layer 1/9 (base OS packages)...', percentage: 45 } } : null);

    await new Promise(r => setTimeout(r, 500));
    setScanResult(prev => prev ? { ...prev, progress: { phase: 'Scanning layer 5/9 (npm dependencies)...', percentage: 60 } } : null);

    await new Promise(r => setTimeout(r, 500));
    setScanResult(prev => prev ? { ...prev, progress: { phase: 'Matching CVEs against vulnerability database...', percentage: 75 } } : null);

    await new Promise(r => setTimeout(r, 400));
    setScanResult(prev => prev ? { ...prev, progress: { phase: 'Generating layer-by-layer analysis...', percentage: 90 } } : null);

    await new Promise(r => setTimeout(r, 300));

    const baseImageVulns = mockVulnerabilities.filter(v => v.isBaseImage).length;
    const applicationVulns = mockVulnerabilities.filter(v => !v.isBaseImage).length;
    const fixable = mockVulnerabilities.filter(v => v.fixedVersion).length;

    setScanResult({
      id: `container_scan_${Date.now()}`,
      status: 'completed',
      startedAt: new Date(Date.now() - 3700).toISOString(),
      completedAt: new Date().toISOString(),
      image,
      layers: mockLayers,
      vulnerabilities: mockVulnerabilities,
      summary: {
        total: mockVulnerabilities.length,
        bySeverity: {
          critical: mockVulnerabilities.filter(v => v.severity === 'CRITICAL').length,
          high: mockVulnerabilities.filter(v => v.severity === 'HIGH').length,
          medium: mockVulnerabilities.filter(v => v.severity === 'MEDIUM').length,
          low: mockVulnerabilities.filter(v => v.severity === 'LOW').length,
          unknown: mockVulnerabilities.filter(v => v.severity === 'UNKNOWN').length,
        },
        baseImageVulns,
        applicationVulns,
        fixable,
      },
      progress: { phase: 'Completed', percentage: 100 },
    });

    setIsScanning(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
      case 'HIGH': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'MEDIUM': return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'LOW': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const filteredVulns = scanResult?.vulnerabilities.filter(v => {
    if (selectedSeverity !== 'all' && v.severity !== selectedSeverity) return false;
    if (showBaseImageOnly && !v.isBaseImage) return false;
    return true;
  }) || [];

  const toggleExpandVuln = (id: string) => {
    setExpandedVulns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleExpandLayer = (id: string) => {
    setExpandedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const getRegistryIcon = (type: string) => {
    switch (type) {
      case 'docker-hub': return '&#x1F433;';
      case 'ghcr': return '&#x1F419;';
      case 'ecr': return '&#x2601;&#xFE0F;';
      case 'acr': return '&#x1F535;';
      case 'gcr': return '&#x1F7E2;';
      default: return '&#x1F4E6;';
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Feature #1986: Demo Mode Banner */}
        <div className="rounded-lg border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚧</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-amber-800 dark:text-amber-300">Demo Mode - Mock Data</h3>
                <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-medium rounded-full">
                  Coming Soon
                </span>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                This feature demonstrates container scanning with simulated data.
                Real Trivy/Docker scanning integration will be available in a future release.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/security')} className="text-muted-foreground hover:text-foreground">&#8592;</button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">&#x1F433; Container Image Scanning</h1>
              <p className="text-muted-foreground">Scan Docker images for vulnerabilities in base images</p>
            </div>
          </div>
          <button
            onClick={() => setShowRegistryConfig(!showRegistryConfig)}
            className={`px-4 py-2 rounded-md flex items-center gap-2 ${showRegistryConfig ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}
          >
            &#x2699;&#xFE0F; Configure Registries
          </button>
        </div>

        {/* Registry Configuration Panel */}
        {showRegistryConfig && (
          <div className="rounded-lg border border-border bg-card p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Container Registry Connections</h2>
            <div className="space-y-3">
              {registries.map(reg => (
                <div key={reg.id} className={`p-4 rounded-lg border ${reg.connected ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' : 'border-border bg-muted/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" dangerouslySetInnerHTML={{ __html: getRegistryIcon(reg.type) }} />
                      <div>
                        <p className="font-medium text-foreground">{reg.name}</p>
                        <p className="text-xs text-muted-foreground">{reg.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {reg.connected ? (
                        <>
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">&#x2705; Connected</span>
                          {reg.lastSync && <span className="text-xs text-muted-foreground">Last sync: {new Date(reg.lastSync).toLocaleString()}</span>}
                        </>
                      ) : (
                        <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90">Connect</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-4 px-4 py-2 border border-dashed border-border rounded-md text-muted-foreground hover:bg-muted w-full">
              + Add Container Registry
            </button>
          </div>
        )}

        {/* Image Selection */}
        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Select Image to Scan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Container Registry</label>
              <select
                value={selectedRegistry}
                onChange={(e) => { setSelectedRegistry(e.target.value); setSelectedImage(''); }}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
              >
                {registries.filter(r => r.connected).map(reg => (
                  <option key={reg.id} value={reg.id}>{reg.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Image</label>
              <select
                value={selectedImage}
                onChange={(e) => setSelectedImage(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
              >
                <option value="">Select an image...</option>
                {mockImages[selectedRegistry]?.map(img => (
                  <option key={img.id} value={img.id}>{img.name}:{img.tag}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedImage && mockImages[selectedRegistry]?.find(i => i.id === selectedImage) && (
            <div className="p-4 rounded-lg bg-muted/30 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Size</p>
                  <p className="font-medium text-foreground">{mockImages[selectedRegistry]?.find(i => i.id === selectedImage)?.size}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Layers</p>
                  <p className="font-medium text-foreground">{mockImages[selectedRegistry]?.find(i => i.id === selectedImage)?.layers}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Platform</p>
                  <p className="font-medium text-foreground">{mockImages[selectedRegistry]?.find(i => i.id === selectedImage)?.platform}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium text-foreground">{new Date(mockImages[selectedRegistry]?.find(i => i.id === selectedImage)?.created || '').toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={runScan}
            disabled={!selectedImage || isScanning}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isScanning && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isScanning ? 'Scanning...' : '&#x1F50D; Run Container Scan'}
          </button>

          {/* Scan Progress */}
          {scanResult && scanResult.status === 'scanning' && (
            <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{scanResult.progress?.phase}</span>
                <span className="text-sm font-bold text-blue-600">{scanResult.progress?.percentage}%</span>
              </div>
              <div className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${scanResult.progress?.percentage}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Scan Results */}
        {scanResult && scanResult.status === 'completed' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total Vulns</p>
                <p className="text-2xl font-bold text-foreground">{scanResult.summary.total}</p>
              </div>
              <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 p-4">
                <p className="text-sm text-purple-600 dark:text-purple-400">Critical</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{scanResult.summary.bySeverity.critical}</p>
              </div>
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
                <p className="text-sm text-red-600 dark:text-red-400">High</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{scanResult.summary.bySeverity.high}</p>
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
                <p className="text-sm text-amber-600 dark:text-amber-400">Medium</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{scanResult.summary.bySeverity.medium}</p>
              </div>
              <div className="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/20 p-4">
                <p className="text-sm text-cyan-600 dark:text-cyan-400">Base Image</p>
                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{scanResult.summary.baseImageVulns}</p>
              </div>
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4">
                <p className="text-sm text-green-600 dark:text-green-400">Fixable</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{scanResult.summary.fixable}</p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setViewMode('vulnerabilities')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'vulnerabilities' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                &#x1F6E1;&#xFE0F; Vulnerabilities
              </button>
              <button
                onClick={() => setViewMode('layers')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'layers' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                &#x1F4DA; Layer Analysis
              </button>
            </div>

            {/* Vulnerabilities View */}
            {viewMode === 'vulnerabilities' && (
              <>
                {/* Filters */}
                <div className="flex items-center gap-4 mb-4">
                  <select
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    className="px-3 py-2 rounded-md border border-border bg-background text-foreground"
                  >
                    <option value="all">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showBaseImageOnly}
                      onChange={(e) => setShowBaseImageOnly(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-muted-foreground">Base image only</span>
                  </label>
                  <span className="text-sm text-muted-foreground ml-auto">
                    Showing {filteredVulns.length} of {scanResult.vulnerabilities.length} vulnerabilities
                  </span>
                </div>

                {/* Vulnerabilities List */}
                <div className="space-y-2">
                  {filteredVulns.map(vuln => (
                    <div key={vuln.id} className={`rounded-lg border ${vuln.isBaseImage ? 'border-cyan-200 dark:border-cyan-800 bg-cyan-50/30 dark:bg-cyan-950/10' : 'border-border bg-card'}`}>
                      <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggleExpandVuln(vuln.id)}>
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSeverityColor(vuln.severity)}`}>{vuln.severity}</span>
                          <div>
                            <p className="font-medium text-foreground">{vuln.cveId}</p>
                            <p className="text-xs text-muted-foreground">{vuln.pkgName} {vuln.installedVersion}</p>
                          </div>
                          {vuln.isBaseImage && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                              &#x1F4E6; Base Image
                            </span>
                          )}
                          {vuln.fixedVersion && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              &#x2705; Fix: {vuln.fixedVersion}
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground">{expandedVulns.has(vuln.id) ? '&#x25B2;' : '&#x25BC;'}</span>
                      </div>

                      {expandedVulns.has(vuln.id) && (
                        <div className="px-4 pb-4 border-t border-border/50 pt-4">
                          <p className="font-medium text-foreground mb-2">{vuln.title}</p>
                          <p className="text-sm text-muted-foreground mb-4">{vuln.description}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">CVSS Score</p>
                              <p className="font-medium text-foreground">{vuln.cvss || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Published</p>
                              <p className="font-medium text-foreground">{vuln.publishedDate}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Layer</p>
                              <p className="font-medium text-foreground font-mono text-xs">{scanResult.layers.find(l => l.id === vuln.layer)?.command.slice(0, 30)}...</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Fix Version</p>
                              <p className="font-medium text-green-600">{vuln.fixedVersion || 'No fix available'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Layers View */}
            {viewMode === 'layers' && (
              <div className="space-y-2">
                {scanResult.layers.map((layer, idx) => (
                  <div key={layer.id} className={`rounded-lg border ${layer.isBaseImage ? 'border-cyan-200 dark:border-cyan-800 bg-cyan-50/30 dark:bg-cyan-950/10' : 'border-border bg-card'}`}>
                    <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggleExpandLayer(layer.id)}>
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-mono text-sm text-foreground">{layer.command}</p>
                          <p className="text-xs text-muted-foreground">{layer.size}</p>
                        </div>
                        {layer.isBaseImage && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                            &#x1F4E6; Base Image
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {layer.vulnerabilities > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            {layer.vulnerabilities} vuln{layer.vulnerabilities > 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="text-muted-foreground">{expandedLayers.has(layer.id) ? '&#x25B2;' : '&#x25BC;'}</span>
                      </div>
                    </div>

                    {expandedLayers.has(layer.id) && (
                      <div className="px-4 pb-4 border-t border-border/50 pt-4">
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <p className="text-muted-foreground">Created</p>
                            <p className="font-medium text-foreground">{new Date(layer.created).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Layer Type</p>
                            <p className="font-medium text-foreground">{layer.isBaseImage ? 'Base Image Layer' : 'Application Layer'}</p>
                          </div>
                        </div>
                        {layer.vulnerabilities > 0 && (
                          <div>
                            <p className="text-sm font-medium text-foreground mb-2">Vulnerabilities in this layer:</p>
                            <div className="space-y-1">
                              {scanResult.vulnerabilities.filter(v => v.layer === layer.id).map(v => (
                                <div key={v.id} className="flex items-center gap-2 text-sm">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${getSeverityColor(v.severity)}`}>{v.severity}</span>
                                  <span className="font-mono text-foreground">{v.cveId}</span>
                                  <span className="text-muted-foreground">in {v.pkgName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!scanResult && (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <span className="text-5xl mb-4 block">&#x1F433;</span>
            <p className="text-lg font-medium text-foreground mb-2">Scan a container image</p>
            <p className="text-muted-foreground">
              Select a container image from your registry to scan for vulnerabilities in base images and application dependencies.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
