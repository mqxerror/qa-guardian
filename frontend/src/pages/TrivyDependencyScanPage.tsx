// TrivyDependencyScanPage - Extracted from App.tsx for code quality compliance
// Feature #759: Trivy Integration for Dependency Scanning
// Feature #760: Grype as Secondary Scanner
// Feature #765: SBOM Generation (CycloneDX and SPDX)
// Feature #766: Upgrade recommendations with breaking change warnings
// Feature #767: Dependency Tree Visualization
// Feature #1986: Shows demo/mock data - real Trivy/Grype integration coming soon

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';

// Types
interface TrivyVulnerability {
  id: string;
  cveId: string;
  pkgName: string;
  installedVersion: string;
  fixedVersion?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  title: string;
  description: string;
  cvss?: number;
  publishedDate: string;
  references: string[];
  scanner: 'trivy' | 'grype' | 'both'; // Feature #760: Track which scanner found this
  breakingChange?: boolean; // Feature #766: Flag for major version upgrades
  breakingChangeReason?: string; // Feature #766: Reason for breaking change
}

interface TrivyScanConfig {
  enabled: boolean;
  scanSchedule: 'manual' | 'daily' | 'weekly' | 'on_push';
  severityThreshold: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  ignoreUnfixed: boolean;
  autoFix: boolean;
  grypeEnabled: boolean; // Feature #760: Secondary scanner
}

interface TrivyScanResult {
  id: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  projectName: string;
  targetType: 'package.json' | 'requirements.txt' | 'Gemfile' | 'go.mod' | 'pom.xml' | 'Cargo.toml';
  vulnerabilities: TrivyVulnerability[];
  summary: {
    total: number;
    bySeverity: { critical: number; high: number; medium: number; low: number; unknown: number };
    fixable: number;
    byScanner?: { trivy: number; grype: number; both: number }; // Feature #760: Track scanner source
  };
  progress?: {
    phase: string;
    percentage: number;
  };
}

// Feature #767: Dependency Tree Types
interface DependencyNode {
  name: string;
  version: string;
  type: 'direct' | 'transitive' | 'dev';
  vulnerable?: boolean;
  vulnerabilityId?: string;
  children?: DependencyNode[];
}

export function TrivyDependencyScanPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<TrivyScanConfig>({
    enabled: true,
    scanSchedule: 'daily',
    severityThreshold: 'HIGH',
    ignoreUnfixed: false,
    autoFix: false,
    grypeEnabled: false, // Feature #760: Grype secondary scanner
  });
  const [scanResult, setScanResult] = useState<TrivyScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [showFixableOnly, setShowFixableOnly] = useState(false);
  const [expandedVulns, setExpandedVulns] = useState<Set<string>>(new Set());
  const [selectedScanner, setSelectedScanner] = useState<string>('all'); // Feature #760

  // Feature #765: SBOM Generation State
  const [showSbomModal, setShowSbomModal] = useState(false);
  const [sbomFormat, setSbomFormat] = useState<'cyclonedx' | 'spdx'>('cyclonedx');
  const [sbomGenerating, setSbomGenerating] = useState(false);
  const [sbomGenerated, setSbomGenerated] = useState<{
    format: string;
    content: string;
    filename: string;
    timestamp: string;
    stats: {
      totalComponents: number;
      directDeps: number;
      transitiveDeps: number;
      devDeps: number;
    };
  } | null>(null);

  // Feature #767: Dependency Tree Visualization State
  const [showDependencyTree, setShowDependencyTree] = useState(false);
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<Set<string>>(new Set(['root']));

  // Feature #767: Mock Dependency Tree Data
  const mockDependencyTree: DependencyNode[] = [
    {
      name: 'express',
      version: '4.17.1',
      type: 'direct',
      vulnerable: true,
      vulnerabilityId: 'CVE-2024-29041',
      children: [
        { name: 'body-parser', version: '1.20.2', type: 'transitive' },
        { name: 'cookie', version: '0.5.0', type: 'transitive' },
        { name: 'debug', version: '2.6.9', type: 'transitive', children: [
          { name: 'ms', version: '2.0.0', type: 'transitive' }
        ]},
      ]
    },
    {
      name: 'lodash',
      version: '4.17.15',
      type: 'direct',
      vulnerable: true,
      vulnerabilityId: 'CVE-2024-38374',
    },
    {
      name: 'axios',
      version: '0.21.1',
      type: 'direct',
      vulnerable: true,
      vulnerabilityId: 'CVE-2024-31999',
      children: [
        { name: 'follow-redirects', version: '1.15.2', type: 'transitive' }
      ]
    },
    {
      name: 'jsonwebtoken',
      version: '8.5.1',
      type: 'direct',
      vulnerable: true,
      vulnerabilityId: 'CVE-2024-21490',
      children: [
        { name: 'jws', version: '3.2.2', type: 'transitive' },
        { name: 'lodash', version: '4.17.15', type: 'transitive', vulnerable: true, vulnerabilityId: 'CVE-2024-38374' },
        { name: 'ms', version: '2.1.3', type: 'transitive' }
      ]
    },
    {
      name: 'react',
      version: '18.2.0',
      type: 'direct',
      children: [
        { name: 'react-dom', version: '18.2.0', type: 'transitive' },
        { name: 'scheduler', version: '0.23.0', type: 'transitive' }
      ]
    },
    {
      name: 'typescript',
      version: '5.3.3',
      type: 'dev',
    },
    {
      name: '@babel/traverse',
      version: '7.18.0',
      type: 'transitive',
      vulnerable: true,
      vulnerabilityId: 'CVE-2023-45133',
      children: [
        { name: '@babel/types', version: '7.23.0', type: 'transitive' },
        { name: '@babel/generator', version: '7.23.0', type: 'transitive' }
      ]
    },
  ];

  const toggleTreeNode = (nodePath: string) => {
    setExpandedTreeNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodePath)) {
        newSet.delete(nodePath);
      } else {
        newSet.add(nodePath);
      }
      return newSet;
    });
  };

  // Mock vulnerabilities
  // Feature #760: Mock vulnerabilities with scanner source
  // Feature #766: Added breaking change flags for major version upgrades
  const mockTrivyVulnerabilities: TrivyVulnerability[] = [
    { id: 'v1', cveId: 'CVE-2024-38374', pkgName: 'lodash', installedVersion: '4.17.15', fixedVersion: '4.17.21', severity: 'CRITICAL', title: 'Prototype Pollution in lodash', description: 'Lodash versions prior to 4.17.21 are vulnerable to Prototype Pollution via the setWith function. This allows attackers to modify the prototype of Object, potentially leading to remote code execution.', cvss: 9.8, publishedDate: '2024-06-15', references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-38374', 'https://github.com/lodash/lodash/pull/5085'], scanner: 'both' },
    { id: 'v2', cveId: 'CVE-2024-29041', pkgName: 'express', installedVersion: '4.17.1', fixedVersion: '4.18.2', severity: 'HIGH', title: 'Open Redirect Vulnerability in Express', description: 'Express.js versions before 4.18.2 are vulnerable to open redirect attacks when using untrusted user input in the redirect() function.', cvss: 7.5, publishedDate: '2024-03-22', references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-29041'], scanner: 'trivy' },
    { id: 'v3', cveId: 'CVE-2024-21490', pkgName: 'jsonwebtoken', installedVersion: '8.5.1', fixedVersion: '9.0.0', severity: 'HIGH', title: 'Algorithm Confusion Attack in jsonwebtoken', description: 'The jsonwebtoken library before version 9.0.0 is vulnerable to algorithm confusion attacks when not properly validating the algorithm in JWT headers.', cvss: 7.2, publishedDate: '2024-01-18', references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-21490', 'https://github.com/auth0/node-jsonwebtoken/security/advisories/GHSA-hjrf-2m68-5959'], scanner: 'both', breakingChange: true, breakingChangeReason: 'Major version upgrade (v8 -> v9). API changes: jwt.verify() now requires algorithm to be explicitly specified. Check migration guide.' },
    { id: 'v4', cveId: 'CVE-2023-45133', pkgName: '@babel/traverse', installedVersion: '7.18.0', fixedVersion: '7.23.2', severity: 'CRITICAL', title: 'Code Injection via Crafted AST', description: 'Babel traverse before 7.23.2 is vulnerable to arbitrary code execution when processing malicious code during transformation.', cvss: 9.1, publishedDate: '2023-10-12', references: ['https://nvd.nist.gov/vuln/detail/CVE-2023-45133'], scanner: 'trivy' },
    { id: 'v5', cveId: 'CVE-2024-28863', pkgName: 'tar', installedVersion: '6.1.11', fixedVersion: '6.2.1', severity: 'MEDIUM', title: 'Directory Traversal in tar', description: 'The tar npm package before 6.2.1 allows directory traversal via symbolic link following during extraction.', cvss: 5.5, publishedDate: '2024-04-02', references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-28863'], scanner: 'both' },
    { id: 'v6', cveId: 'CVE-2024-24758', pkgName: 'undici', installedVersion: '5.26.0', fixedVersion: '5.28.3', severity: 'MEDIUM', title: 'SSRF via Proxy Headers', description: 'Undici before 5.28.3 is vulnerable to SSRF when proxy configuration allows untrusted headers to be forwarded.', cvss: 5.3, publishedDate: '2024-02-14', references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-24758'], scanner: 'trivy' },
    { id: 'v7', cveId: 'CVE-2023-44270', pkgName: 'postcss', installedVersion: '8.4.21', fixedVersion: '8.4.31', severity: 'LOW', title: 'ReDoS in PostCSS', description: 'PostCSS before 8.4.31 is vulnerable to regular expression denial of service when parsing malicious CSS.', cvss: 3.7, publishedDate: '2023-09-29', references: ['https://nvd.nist.gov/vuln/detail/CVE-2023-44270'], scanner: 'trivy' },
    { id: 'v8', cveId: 'CVE-2024-31999', pkgName: 'axios', installedVersion: '0.21.1', fixedVersion: '1.6.0', severity: 'HIGH', title: 'CSRF Vulnerability in Axios', description: 'Axios versions before 1.6.0 are vulnerable to cross-site request forgery due to improper handling of cookies.', cvss: 7.1, publishedDate: '2024-05-08', references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-31999'], scanner: 'both', breakingChange: true, breakingChangeReason: 'Major version upgrade (v0 -> v1). Breaking changes: CommonJS/ESM dual package, removed deprecated methods. Review changelog before upgrading.' },
  ];

  // Feature #760: Grype-only vulnerabilities (unique findings)
  // Feature #766: Added breaking change flags
  const mockGrypeOnlyVulnerabilities: TrivyVulnerability[] = [
    { id: 'g1', cveId: 'CVE-2024-39338', pkgName: 'axios', installedVersion: '0.21.1', fixedVersion: '1.7.4', severity: 'HIGH', title: 'Server-Side Request Forgery in Axios', description: 'Axios before 1.7.4 is vulnerable to SSRF when processing protocol-relative URLs, allowing attackers to make requests to internal services.', cvss: 8.1, publishedDate: '2024-07-21', references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-39338'], scanner: 'grype', breakingChange: true, breakingChangeReason: 'Major version upgrade (v0 -> v1). Breaking changes: CommonJS/ESM dual package, removed deprecated methods. Review changelog before upgrading.' },
    { id: 'g2', cveId: 'CVE-2024-4067', pkgName: 'micromatch', installedVersion: '4.0.4', fixedVersion: '4.0.6', severity: 'MEDIUM', title: 'ReDoS in micromatch', description: 'Micromatch before 4.0.6 is vulnerable to Regular Expression Denial of Service when processing crafted glob patterns.', cvss: 6.5, publishedDate: '2024-05-14', references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-4067'], scanner: 'grype' },
    { id: 'g3', cveId: 'GHSA-3xgq-45jj-v275', pkgName: 'socket.io-parser', installedVersion: '4.2.1', fixedVersion: '4.2.3', severity: 'HIGH', title: 'Insufficient Input Validation in socket.io-parser', description: 'Socket.io-parser before 4.2.3 is vulnerable to Denial of Service due to insufficient input validation when parsing malformed packets.', cvss: 7.5, publishedDate: '2024-03-01', references: ['https://github.com/advisories/GHSA-3xgq-45jj-v275'], scanner: 'grype' },
  ];

  const getMergedVulnerabilities = () => {
    if (config.grypeEnabled) {
      return [...mockTrivyVulnerabilities, ...mockGrypeOnlyVulnerabilities];
    }
    return mockTrivyVulnerabilities.map(v => ({ ...v, scanner: 'trivy' as const }));
  };

  const runScan = async () => {
    setIsScanning(true);
    setScanResult({
      id: `trivy_scan_${Date.now()}`,
      status: 'scanning',
      startedAt: new Date().toISOString(),
      projectName: 'qa-guardian-frontend',
      targetType: 'package.json',
      vulnerabilities: [],
      summary: { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }, fixable: 0 },
      progress: { phase: 'Initializing Trivy scanner...', percentage: 5 },
    });

    // Simulate scanning phases
    await new Promise(r => setTimeout(r, 800));
    setScanResult(prev => prev ? { ...prev, progress: { phase: 'Downloading Trivy vulnerability database...', percentage: 15 } } : null);

    await new Promise(r => setTimeout(r, 800));
    setScanResult(prev => prev ? { ...prev, progress: { phase: 'Running Trivy scan...', percentage: 30 } } : null);

    // Feature #760: If Grype enabled, show additional scanning phase
    if (config.grypeEnabled) {
      await new Promise(r => setTimeout(r, 800));
      setScanResult(prev => prev ? { ...prev, progress: { phase: 'Downloading Grype vulnerability database...', percentage: 45 } } : null);

      await new Promise(r => setTimeout(r, 800));
      setScanResult(prev => prev ? { ...prev, progress: { phase: 'Running Grype scan...', percentage: 60 } } : null);

      await new Promise(r => setTimeout(r, 600));
      setScanResult(prev => prev ? { ...prev, progress: { phase: 'Merging findings from Trivy and Grype...', percentage: 80 } } : null);
    } else {
      await new Promise(r => setTimeout(r, 1000));
      setScanResult(prev => prev ? { ...prev, progress: { phase: 'Matching dependencies against CVE database...', percentage: 65 } } : null);
    }

    await new Promise(r => setTimeout(r, 600));
    setScanResult(prev => prev ? { ...prev, progress: { phase: 'Analyzing vulnerability impact...', percentage: 90 } } : null);

    await new Promise(r => setTimeout(r, 400));

    // Complete scan - Feature #760: Use merged vulnerabilities when Grype enabled
    const vulns = getMergedVulnerabilities();
    const fixable = vulns.filter(v => v.fixedVersion).length;
    const trivyCount = vulns.filter(v => v.scanner === 'trivy').length;
    const grypeCount = vulns.filter(v => v.scanner === 'grype').length;
    const bothCount = vulns.filter(v => v.scanner === 'both').length;

    setScanResult({
      id: `trivy_scan_${Date.now()}`,
      status: 'completed',
      startedAt: new Date(Date.now() - 4200).toISOString(),
      completedAt: new Date().toISOString(),
      projectName: 'qa-guardian-frontend',
      targetType: 'package.json',
      vulnerabilities: vulns,
      summary: {
        total: vulns.length,
        bySeverity: {
          critical: vulns.filter(v => v.severity === 'CRITICAL').length,
          high: vulns.filter(v => v.severity === 'HIGH').length,
          medium: vulns.filter(v => v.severity === 'MEDIUM').length,
          low: vulns.filter(v => v.severity === 'LOW').length,
          unknown: vulns.filter(v => v.severity === 'UNKNOWN').length,
        },
        fixable,
        byScanner: config.grypeEnabled ? { trivy: trivyCount, grype: grypeCount, both: bothCount } : undefined,
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
    if (showFixableOnly && !v.fixedVersion) return false;
    // Feature #760: Filter by scanner
    if (selectedScanner !== 'all' && v.scanner !== selectedScanner && v.scanner !== 'both') return false;
    return true;
  }) || [];

  // Feature #760: Get scanner badge color
  const getScannerColor = (scanner: string) => {
    switch (scanner) {
      case 'trivy': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
      case 'grype': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'both': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedVulns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Feature #765: Generate SBOM
  const generateSbom = async () => {
    setSbomGenerating(true);
    setSbomGenerated(null);

    // Simulate SBOM generation
    await new Promise(r => setTimeout(r, 1500));

    const mockDependencies = [
      { name: 'react', version: '18.2.0', license: 'MIT', type: 'direct' },
      { name: 'react-dom', version: '18.2.0', license: 'MIT', type: 'direct' },
      { name: 'typescript', version: '5.3.3', license: 'Apache-2.0', type: 'dev' },
      { name: 'vite', version: '5.0.8', license: 'MIT', type: 'dev' },
      { name: 'lodash', version: '4.17.21', license: 'MIT', type: 'transitive' },
      { name: 'express', version: '4.18.2', license: 'MIT', type: 'direct' },
      { name: 'axios', version: '1.6.2', license: 'MIT', type: 'direct' },
      { name: 'tailwindcss', version: '3.4.0', license: 'MIT', type: 'dev' },
      { name: 'postcss', version: '8.4.32', license: 'MIT', type: 'transitive' },
      { name: 'autoprefixer', version: '10.4.16', license: 'MIT', type: 'transitive' },
      { name: 'socket.io', version: '4.7.2', license: 'MIT', type: 'direct' },
      { name: 'jsonwebtoken', version: '9.0.2', license: 'MIT', type: 'direct' },
      { name: '@babel/core', version: '7.23.6', license: 'MIT', type: 'transitive' },
      { name: 'eslint', version: '8.56.0', license: 'MIT', type: 'dev' },
      { name: 'prettier', version: '3.1.1', license: 'MIT', type: 'dev' },
    ];

    const stats = {
      totalComponents: mockDependencies.length,
      directDeps: mockDependencies.filter(d => d.type === 'direct').length,
      transitiveDeps: mockDependencies.filter(d => d.type === 'transitive').length,
      devDeps: mockDependencies.filter(d => d.type === 'dev').length,
    };

    let content: string;
    let filename: string;

    if (sbomFormat === 'cyclonedx') {
      // CycloneDX JSON format
      content = JSON.stringify({
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        serialNumber: `urn:uuid:${crypto.randomUUID()}`,
        version: 1,
        metadata: {
          timestamp: new Date().toISOString(),
          tools: [{ vendor: 'QA Guardian', name: 'SBOM Generator', version: '2.0.0' }],
          component: {
            type: 'application',
            name: 'qa-guardian-frontend',
            version: '2.1.0',
          },
        },
        components: mockDependencies.map((dep) => ({
          type: 'library',
          'bom-ref': `pkg:npm/${dep.name}@${dep.version}`,
          name: dep.name,
          version: dep.version,
          purl: `pkg:npm/${dep.name}@${dep.version}`,
          licenses: [{ license: { id: dep.license } }],
          scope: dep.type === 'dev' ? 'optional' : 'required',
        })),
        dependencies: mockDependencies.map(dep => ({
          ref: `pkg:npm/${dep.name}@${dep.version}`,
          dependsOn: [],
        })),
      }, null, 2);
      filename = `sbom-cyclonedx-${new Date().toISOString().split('T')[0]}.json`;
    } else {
      // SPDX JSON format
      content = JSON.stringify({
        spdxVersion: 'SPDX-2.3',
        dataLicense: 'CC0-1.0',
        SPDXID: 'SPDXRef-DOCUMENT',
        name: 'qa-guardian-frontend',
        documentNamespace: `https://qa-guardian.dev/spdx/${crypto.randomUUID()}`,
        creationInfo: {
          created: new Date().toISOString(),
          creators: ['Tool: QA Guardian SBOM Generator-2.0.0'],
        },
        packages: mockDependencies.map((dep, idx) => ({
          SPDXID: `SPDXRef-Package-${idx + 1}`,
          name: dep.name,
          versionInfo: dep.version,
          downloadLocation: `https://registry.npmjs.org/${dep.name}/-/${dep.name}-${dep.version}.tgz`,
          filesAnalyzed: false,
          licenseConcluded: dep.license,
          licenseDeclared: dep.license,
          copyrightText: 'NOASSERTION',
          externalRefs: [{
            referenceCategory: 'PACKAGE-MANAGER',
            referenceType: 'purl',
            referenceLocator: `pkg:npm/${dep.name}@${dep.version}`,
          }],
        })),
        relationships: mockDependencies.map((dep, idx) => ({
          spdxElementId: 'SPDXRef-DOCUMENT',
          relationshipType: dep.type === 'dev' ? 'DEV_DEPENDENCY_OF' : 'DEPENDENCY_OF',
          relatedSpdxElement: `SPDXRef-Package-${idx + 1}`,
        })),
      }, null, 2);
      filename = `sbom-spdx-${new Date().toISOString().split('T')[0]}.json`;
    }

    setSbomGenerated({
      format: sbomFormat,
      content,
      filename,
      timestamp: new Date().toISOString(),
      stats,
    });
    setSbomGenerating(false);
  };

  // Feature #765: Download SBOM
  const downloadSbom = () => {
    if (!sbomGenerated) return;
    const blob = new Blob([sbomGenerated.content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sbomGenerated.filename;
    a.click();
    URL.revokeObjectURL(url);
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
                This feature demonstrates dependency scanning with simulated vulnerabilities.
                Real Trivy/Grype integration will be available in a future release.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/security')} className="text-muted-foreground hover:text-foreground">&#8592;</button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Trivy Dependency Scanner</h1>
              <p className="text-muted-foreground">Scan project dependencies for known CVEs</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Feature #767: View Dependency Tree Button */}
            <button
              onClick={() => setShowDependencyTree(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2"
            >
              Dependency Tree
            </button>
            {/* Feature #765: Generate SBOM Button */}
            <button
              onClick={() => setShowSbomModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-2"
            >
              Generate SBOM
            </button>
            <div className="flex items-center gap-1">
              <img src="https://aquasecurity.github.io/trivy/latest/imgs/logo.png" alt="Trivy" className="h-7 w-7 object-contain" />
              <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">Trivy</span>
            </div>
            {config.grypeEnabled && (
              <>
                <span className="text-muted-foreground">+</span>
                <div className="flex items-center gap-1">
                  <span className="text-lg">&#129425;</span>
                  <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Grype</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Feature #765: SBOM Modal */}
        {showSbomModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Generate SBOM</h2>
                    <p className="text-sm text-muted-foreground">Software Bill of Materials for dependency tracking</p>
                  </div>
                  <button onClick={() => setShowSbomModal(false)} className="text-muted-foreground hover:text-foreground text-2xl">&times;</button>
                </div>
              </div>

              <div className="p-6">
                {/* Format Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground mb-3">Select SBOM Format</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setSbomFormat('cyclonedx')}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        sbomFormat === 'cyclonedx'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">&#128260;</span>
                        <span className="font-bold text-foreground">CycloneDX</span>
                        {sbomFormat === 'cyclonedx' && <span className="ml-auto text-emerald-600">&#10003;</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">OWASP standard format. Great for vulnerability tracking and license compliance.</p>
                      <div className="mt-2 text-xs text-muted-foreground">Version: 1.5 - JSON format</div>
                    </button>
                    <button
                      onClick={() => setSbomFormat('spdx')}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        sbomFormat === 'spdx'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">&#128196;</span>
                        <span className="font-bold text-foreground">SPDX</span>
                        {sbomFormat === 'spdx' && <span className="ml-auto text-emerald-600">&#10003;</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">Linux Foundation standard. Required for federal compliance and supply chain security.</p>
                      <div className="mt-2 text-xs text-muted-foreground">Version: 2.3 - JSON format</div>
                    </button>
                  </div>
                </div>

                {/* Generate Button */}
                {!sbomGenerated && (
                  <button
                    onClick={generateSbom}
                    disabled={sbomGenerating}
                    className="w-full px-4 py-3 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sbomGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating SBOM...
                      </>
                    ) : (
                      <>Generate {sbomFormat === 'cyclonedx' ? 'CycloneDX' : 'SPDX'} SBOM</>
                    )}
                  </button>
                )}

                {/* Generated SBOM Result */}
                {sbomGenerated && (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">&#10004;</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">SBOM Generated Successfully!</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Components</p>
                          <p className="font-bold text-foreground">{sbomGenerated.stats.totalComponents}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Direct Deps</p>
                          <p className="font-bold text-foreground">{sbomGenerated.stats.directDeps}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Transitive Deps</p>
                          <p className="font-bold text-foreground">{sbomGenerated.stats.transitiveDeps}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Dev Deps</p>
                          <p className="font-bold text-foreground">{sbomGenerated.stats.devDeps}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-foreground">{sbomGenerated.filename}</span>
                        <span className="text-xs text-muted-foreground">{(sbomGenerated.content.length / 1024).toFixed(1)} KB</span>
                      </div>
                      <pre className="text-xs bg-background p-3 rounded border border-border overflow-x-auto max-h-48">
                        {sbomGenerated.content.slice(0, 800)}...
                      </pre>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={downloadSbom}
                        className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center justify-center gap-2"
                      >
                        Download SBOM
                      </button>
                      <button
                        onClick={() => setSbomGenerated(null)}
                        className="px-4 py-3 border border-border rounded-md hover:bg-muted"
                      >
                        Generate Another
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Feature #767: Dependency Tree Modal */}
        {showDependencyTree && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Dependency Tree</h2>
                    <p className="text-sm text-muted-foreground">View dependency hierarchy with vulnerable paths highlighted</p>
                  </div>
                  <button onClick={() => setShowDependencyTree(false)} className="text-muted-foreground hover:text-foreground text-2xl">&times;</button>
                </div>
              </div>

              <div className="p-6">
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mb-6 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <span className="text-sm text-foreground">Direct Dependency</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                    <span className="text-sm text-foreground">Transitive Dependency</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                    <span className="text-sm text-foreground">Dev Dependency</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span className="text-sm text-foreground">Vulnerable</span>
                  </div>
                </div>

                {/* Tree View */}
                <div className="font-mono text-sm">
                  {(() => {
                    const renderNode = (node: DependencyNode, path: string, depth: number): React.ReactNode => {
                      const nodePath = `${path}/${node.name}`;
                      const isExpanded = expandedTreeNodes.has(nodePath);
                      const hasChildren = node.children && node.children.length > 0;

                      return (
                        <div key={nodePath}>
                          <div
                            className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer ${node.vulnerable ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                            style={{ paddingLeft: `${depth * 24 + 8}px` }}
                            onClick={() => hasChildren && toggleTreeNode(nodePath)}
                          >
                            {hasChildren ? (
                              <span className="w-4 text-muted-foreground">{isExpanded ? '&#9660;' : '&#9654;'}</span>
                            ) : (
                              <span className="w-4"></span>
                            )}
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              node.vulnerable ? 'bg-red-500' :
                              node.type === 'direct' ? 'bg-blue-500' :
                              node.type === 'dev' ? 'bg-purple-500' :
                              'bg-gray-400'
                            }`}></span>
                            <span className={`font-medium ${node.vulnerable ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                              {node.name}
                            </span>
                            <span className="text-muted-foreground">@{node.version}</span>
                            {node.type === 'direct' && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">direct</span>
                            )}
                            {node.type === 'dev' && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">dev</span>
                            )}
                            {node.vulnerable && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                &#9888; {node.vulnerabilityId}
                              </span>
                            )}
                          </div>
                          {hasChildren && isExpanded && (
                            <div>
                              {node.children!.map(child => renderNode(child, nodePath, depth + 1))}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return mockDependencyTree.map(node => renderNode(node, 'root', 0));
                  })()}
                </div>

                {/* Summary */}
                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                  <h3 className="font-semibold text-foreground mb-2">Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Direct Dependencies</p>
                      <p className="font-bold text-foreground">{mockDependencyTree.filter(n => n.type === 'direct').length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Transitive Dependencies</p>
                      <p className="font-bold text-foreground">{mockDependencyTree.reduce((acc, n) => acc + (n.children?.length || 0), 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Dev Dependencies</p>
                      <p className="font-bold text-foreground">{mockDependencyTree.filter(n => n.type === 'dev').length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vulnerable Paths</p>
                      <p className="font-bold text-red-600">{mockDependencyTree.filter(n => n.vulnerable).length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration */}
        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Scanning Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Enable Trivy Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="font-medium text-foreground">Enable Trivy Scanning</p>
                <p className="text-sm text-muted-foreground">Automatically scan dependencies for vulnerabilities</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={`w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-muted'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Scan Schedule */}
            <div className="p-3 bg-muted/30 rounded-lg">
              <label className="block text-sm font-medium text-foreground mb-2">Scan Schedule</label>
              <select
                value={config.scanSchedule}
                onChange={(e) => setConfig({ ...config, scanSchedule: e.target.value as 'manual' | 'daily' | 'weekly' | 'on_push' })}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
              >
                <option value="manual">Manual Only</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="on_push">On Every Push</option>
              </select>
            </div>

            {/* Severity Threshold */}
            <div className="p-3 bg-muted/30 rounded-lg">
              <label className="block text-sm font-medium text-foreground mb-2">Fail Threshold</label>
              <select
                value={config.severityThreshold}
                onChange={(e) => setConfig({ ...config, severityThreshold: e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' })}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
              >
                <option value="CRITICAL">Critical Only</option>
                <option value="HIGH">High and Critical</option>
                <option value="MEDIUM">Medium and Above</option>
                <option value="LOW">Low and Above</option>
              </select>
            </div>

            {/* Ignore Unfixed Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="font-medium text-foreground">Ignore Unfixed CVEs</p>
                <p className="text-sm text-muted-foreground">Skip vulnerabilities without available fixes</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, ignoreUnfixed: !config.ignoreUnfixed })}
                className={`w-12 h-6 rounded-full transition-colors ${config.ignoreUnfixed ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${config.ignoreUnfixed ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Feature #760: Enable Grype Secondary Scanner */}
            <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">Enable Grype Scanner</p>
                  <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">Secondary</span>
                </div>
                <p className="text-sm text-muted-foreground">Run Grype alongside Trivy for additional vulnerability detection</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, grypeEnabled: !config.grypeEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${config.grypeEnabled ? 'bg-orange-500' : 'bg-muted'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${config.grypeEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={runScan}
              disabled={!config.enabled || isScanning}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isScanning && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isScanning ? 'Scanning...' : config.grypeEnabled ? 'Run Trivy + Grype Scan' : 'Run Trivy Scan'}
            </button>
            <button
              onClick={() => setConfig({ ...config, enabled: true })}
              className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* Scan Progress */}
        {scanResult && scanResult.status === 'scanning' && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                  <span className="text-white">&#128230;</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{scanResult.progress?.phase}</p>
                  <p className="text-sm text-muted-foreground">Scanning {scanResult.projectName}</p>
                </div>
              </div>
              <span className="text-lg font-bold text-blue-600">{scanResult.progress?.percentage}%</span>
            </div>
            <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${scanResult.progress?.percentage || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {scanResult && scanResult.status === 'completed' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-sm text-muted-foreground">Total CVEs</p>
                <p className="text-2xl font-bold text-foreground">{scanResult.summary.total}</p>
              </div>
              <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 p-4 text-center">
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-purple-600">{scanResult.summary.bySeverity.critical}</p>
              </div>
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4 text-center">
                <p className="text-sm text-muted-foreground">High</p>
                <p className="text-2xl font-bold text-red-600">{scanResult.summary.bySeverity.high}</p>
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
                <p className="text-sm text-muted-foreground">Medium</p>
                <p className="text-2xl font-bold text-amber-600">{scanResult.summary.bySeverity.medium}</p>
              </div>
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4 text-center">
                <p className="text-sm text-muted-foreground">Low</p>
                <p className="text-2xl font-bold text-blue-600">{scanResult.summary.bySeverity.low}</p>
              </div>
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4 text-center">
                <p className="text-sm text-muted-foreground">Fixable</p>
                <p className="text-2xl font-bold text-green-600">{scanResult.summary.fixable}</p>
              </div>
            </div>

            {/* Feature #760: Scanner Breakdown (when Grype enabled) */}
            {scanResult.summary.byScanner && (
              <div className="rounded-lg border border-border bg-card p-4 mb-6">
                <h3 className="text-sm font-medium text-foreground mb-3">Findings by Scanner</h3>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                    <span className="text-sm text-foreground">Trivy Only: <span className="font-bold">{scanResult.summary.byScanner.trivy}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                    <span className="text-sm text-foreground">Grype Only: <span className="font-bold text-orange-600">{scanResult.summary.byScanner.grype}</span></span>
                    {scanResult.summary.byScanner.grype > 0 && (
                      <span className="text-xs text-orange-600 dark:text-orange-400">(unique findings!)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span className="text-sm text-foreground">Both Scanners: <span className="font-bold">{scanResult.summary.byScanner.both}</span></span>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="rounded-lg border border-border bg-card p-4 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Severity:</span>
                  <select
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    className="px-3 py-1 rounded-md border border-border bg-background text-foreground text-sm"
                  >
                    <option value="all">All</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                {/* Feature #760: Scanner filter */}
                {scanResult.summary.byScanner && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">Scanner:</span>
                    <select
                      value={selectedScanner}
                      onChange={(e) => setSelectedScanner(e.target.value)}
                      className="px-3 py-1 rounded-md border border-border bg-background text-foreground text-sm"
                    >
                      <option value="all">All Scanners</option>
                      <option value="trivy">Trivy Only</option>
                      <option value="grype">Grype Only</option>
                      <option value="both">Found by Both</option>
                    </select>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFixableOnly}
                    onChange={(e) => setShowFixableOnly(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">Show fixable only</span>
                </label>
                <span className="text-sm text-muted-foreground ml-auto">
                  Showing {filteredVulns.length} of {scanResult.summary.total} vulnerabilities
                </span>
              </div>
            </div>

            {/* Vulnerability List */}
            <div className="space-y-3">
              {filteredVulns.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
                  <p className="text-4xl mb-2">&#127881;</p>
                  <p className="text-lg font-medium text-foreground">No vulnerabilities match your filters</p>
                  <p className="text-muted-foreground">Try adjusting your filter settings</p>
                </div>
              ) : (
                filteredVulns.map((vuln) => (
                  <div key={vuln.id} className="rounded-lg border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => toggleExpand(vuln.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSeverityColor(vuln.severity)}`}>
                          {vuln.severity}
                        </span>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-foreground">{vuln.pkgName}</span>
                            <span className="text-xs text-muted-foreground">v{vuln.installedVersion}</span>
                            {vuln.fixedVersion && (
                              <span className="text-xs text-green-600 dark:text-green-400">&#8594; {vuln.fixedVersion}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{vuln.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Feature #760: Scanner badge */}
                        {scanResult.summary.byScanner && (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getScannerColor(vuln.scanner)}`}>
                            {vuln.scanner === 'both' ? '&#10003; Both' : vuln.scanner === 'grype' ? 'Grype' : 'Trivy'}
                          </span>
                        )}
                        <span className="font-mono text-sm text-primary">{vuln.cveId}</span>
                        {vuln.cvss && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            vuln.cvss >= 9 ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                            vuln.cvss >= 7 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            vuln.cvss >= 4 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            CVSS {vuln.cvss}
                          </span>
                        )}
                        <svg className={`w-5 h-5 text-muted-foreground transition-transform ${expandedVulns.has(vuln.id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {expandedVulns.has(vuln.id) && (
                      <div className="p-4 border-t border-border bg-muted/20">
                        <p className="text-sm text-foreground mb-4">{vuln.description}</p>

                        {/* Feature #766: Breaking Change Warning */}
                        {vuln.breakingChange && (
                          <div className="mb-4 p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
                            <div className="flex items-start gap-2">
                              <span className="text-lg">&#9888;</span>
                              <div>
                                <p className="font-semibold text-amber-700 dark:text-amber-300">Breaking Change Warning</p>
                                <p className="text-sm text-amber-600 dark:text-amber-400">{vuln.breakingChangeReason}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Package</p>
                            <p className="font-mono text-sm text-foreground">{vuln.pkgName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Installed Version</p>
                            <p className="font-mono text-sm text-red-600">{vuln.installedVersion}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Fixed Version</p>
                            <p className="font-mono text-sm text-green-600">{vuln.fixedVersion || 'No fix available'}</p>
                            {vuln.fixedVersion && !vuln.breakingChange && (
                              <span className="text-xs text-green-600">&#10003; Safe upgrade</span>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Published</p>
                            <p className="text-sm text-foreground">{new Date(vuln.publishedDate).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-xs text-muted-foreground mb-2">References</p>
                          <div className="flex flex-wrap gap-2">
                            {vuln.references.map((ref, i) => (
                              <a
                                key={i}
                                href={ref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                {ref.includes('nvd.nist.gov') ? 'NVD' : ref.includes('github.com') ? 'GitHub' : 'Reference'}
                              </a>
                            ))}
                          </div>
                        </div>

                        {vuln.fixedVersion && (
                          <div className="flex gap-2">
                            <button className={`px-3 py-1 rounded text-sm ${vuln.breakingChange ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'} text-white`}>
                              {vuln.breakingChange ? '&#9888; ' : ''}Auto-fix to {vuln.fixedVersion}
                            </button>
                            <button className="px-3 py-1 border border-border rounded text-sm hover:bg-muted">
                              Create PR
                            </button>
                            <button className="px-3 py-1 border border-border rounded text-sm hover:bg-muted">
                              Ignore
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!scanResult && !isScanning && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
            <p className="text-4xl mb-4">&#128230;</p>
            <p className="text-lg font-medium text-foreground mb-2">Run a Trivy dependency scan</p>
            <p className="text-muted-foreground">
              Trivy will analyze your project dependencies and identify known CVEs with CVSS scores and remediation guidance.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
