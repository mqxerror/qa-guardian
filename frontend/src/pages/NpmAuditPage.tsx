// NpmAuditPage - Extracted from App.tsx for code quality compliance
// Feature #761: npm audit Integration

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';

// Types
interface NpmAdvisory {
  id: string;
  ghsaId: string;
  cve?: string;
  title: string;
  url: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  moduleName: string;
  version: string;
  vulnerableVersions: string;
  patchedVersions?: string;
  overview: string;
  recommendation: string;
  findings: {
    version: string;
    paths: string[];
  }[];
  cwe?: string[];
  access: string;
  cvss?: {
    score: number;
    vectorString: string;
  };
  created: string;
  updated: string;
}

interface NpmAuditConfig {
  packageLockOnly: boolean;
  omitDev: boolean;
  registry: string;
  auditLevel: 'critical' | 'high' | 'moderate' | 'low' | 'info';
}

interface NpmAuditResult {
  runAt: string;
  projectPath: string;
  totalDependencies: number;
  advisories: NpmAdvisory[];
  metadata: {
    vulnerabilities: {
      critical: number;
      high: number;
      moderate: number;
      low: number;
      info: number;
      total: number;
    };
    dependencies: {
      prod: number;
      dev: number;
      optional: number;
      total: number;
    };
  };
  progress?: {
    phase: string;
    percent: number;
  };
}

export function NpmAuditPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<NpmAuditConfig>({
    packageLockOnly: true,
    omitDev: false,
    registry: 'https://registry.npmjs.org',
    auditLevel: 'moderate',
  });
  const [auditResult, setAuditResult] = useState<NpmAuditResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [expandedAdvisories, setExpandedAdvisories] = useState<Set<string>>(new Set());
  const [projectPath, setProjectPath] = useState('/app/frontend');

  // Mock npm advisories
  const mockAdvisories: NpmAdvisory[] = [
    {
      id: '1089153',
      ghsaId: 'GHSA-67hx-6x53-jw92',
      cve: 'CVE-2024-4068',
      title: 'braces: Uncontrolled resource consumption in braces',
      url: 'https://github.com/advisories/GHSA-67hx-6x53-jw92',
      severity: 'high',
      moduleName: 'braces',
      version: '3.0.2',
      vulnerableVersions: '<3.0.3',
      patchedVersions: '>=3.0.3',
      overview: 'The braces package fails to limit the number of characters it can handle, which could lead to Memory Exhaustion.',
      recommendation: 'Upgrade to version 3.0.3 or later',
      findings: [{ version: '3.0.2', paths: ['node_modules/braces', 'node_modules/micromatch/node_modules/braces'] }],
      cwe: ['CWE-400'],
      access: 'public',
      cvss: { score: 7.5, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H' },
      created: '2024-05-13',
      updated: '2024-05-14',
    },
    {
      id: '1096302',
      ghsaId: 'GHSA-952p-6rrq-rcjv',
      cve: 'CVE-2024-39338',
      title: 'axios: SSRF and credential leakage via absolute URL',
      url: 'https://github.com/advisories/GHSA-952p-6rrq-rcjv',
      severity: 'high',
      moduleName: 'axios',
      version: '0.21.4',
      vulnerableVersions: '<1.7.4',
      patchedVersions: '>=1.7.4',
      overview: 'axios 1.7.2 allows SSRF via unexpected behavior where requests for path-relative URLs get processed as protocol-relative URLs.',
      recommendation: 'Upgrade to version 1.7.4 or later',
      findings: [{ version: '0.21.4', paths: ['node_modules/axios'] }],
      cwe: ['CWE-918'],
      access: 'public',
      cvss: { score: 8.1, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N' },
      created: '2024-07-21',
      updated: '2024-08-12',
    },
    {
      id: '1092459',
      ghsaId: 'GHSA-rv95-896h-c2vc',
      cve: 'CVE-2024-27980',
      title: 'ws: DoS when parsing a crafted message',
      url: 'https://github.com/advisories/GHSA-rv95-896h-c2vc',
      severity: 'moderate',
      moduleName: 'ws',
      version: '7.5.9',
      vulnerableVersions: '>=7.0.0 <7.5.10 || >=8.0.0 <8.17.1',
      patchedVersions: '>=7.5.10 || >=8.17.1',
      overview: 'ws is vulnerable to denial of service when handling a request with many HTTP headers.',
      recommendation: 'Upgrade to version 7.5.10, 8.17.1 or later',
      findings: [{ version: '7.5.9', paths: ['node_modules/ws', 'node_modules/socket.io-client/node_modules/ws'] }],
      cwe: ['CWE-400'],
      access: 'public',
      cvss: { score: 5.3, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L' },
      created: '2024-04-10',
      updated: '2024-06-14',
    },
    {
      id: '1088427',
      ghsaId: 'GHSA-3xgq-45jj-v275',
      title: 'socket.io-parser: Insufficient input validation',
      url: 'https://github.com/advisories/GHSA-3xgq-45jj-v275',
      severity: 'moderate',
      moduleName: 'socket.io-parser',
      version: '4.2.1',
      vulnerableVersions: '<4.2.3',
      patchedVersions: '>=4.2.3',
      overview: 'socket.io-parser is vulnerable to insufficient input validation, which can lead to unexpected behavior.',
      recommendation: 'Upgrade to version 4.2.3 or later',
      findings: [{ version: '4.2.1', paths: ['node_modules/socket.io-parser'] }],
      cwe: ['CWE-20'],
      access: 'public',
      created: '2024-03-01',
      updated: '2024-03-15',
    },
    {
      id: '1089267',
      ghsaId: 'GHSA-c2qf-rxjj-qqgw',
      cve: 'CVE-2024-4067',
      title: 'micromatch: ReDoS when matching specially crafted patterns',
      url: 'https://github.com/advisories/GHSA-c2qf-rxjj-qqgw',
      severity: 'moderate',
      moduleName: 'micromatch',
      version: '4.0.4',
      vulnerableVersions: '<4.0.6',
      patchedVersions: '>=4.0.6',
      overview: 'micromatch uses inefficient regex when processing certain patterns, leading to ReDoS.',
      recommendation: 'Upgrade to version 4.0.6 or later',
      findings: [{ version: '4.0.4', paths: ['node_modules/micromatch'] }],
      cwe: ['CWE-1333'],
      access: 'public',
      cvss: { score: 6.5, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L' },
      created: '2024-05-14',
      updated: '2024-05-14',
    },
    {
      id: '1090523',
      ghsaId: 'GHSA-grv7-fg5c-xmjg',
      cve: 'CVE-2024-37890',
      title: 'ws: Cross-Site WebSocket Hijacking',
      url: 'https://github.com/advisories/GHSA-grv7-fg5c-xmjg',
      severity: 'critical',
      moduleName: 'ws',
      version: '7.5.9',
      vulnerableVersions: '<5.2.4 || >=6.0.0 <6.2.3 || >=7.0.0 <7.5.10 || >=8.0.0 <8.17.1',
      patchedVersions: '>=5.2.4 || >=6.2.3 || >=7.5.10 || >=8.17.1',
      overview: 'A vulnerability in the ws package allows Cross-Site WebSocket Hijacking (CSWSH). This happens because of improper verification of the Origin header during WebSocket handshake.',
      recommendation: 'Upgrade to version 5.2.4, 6.2.3, 7.5.10, or 8.17.1 or later. Use custom verification for Origin header.',
      findings: [{ version: '7.5.9', paths: ['node_modules/ws'] }],
      cwe: ['CWE-346', 'CWE-1385'],
      access: 'public',
      cvss: { score: 9.1, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N' },
      created: '2024-06-17',
      updated: '2024-06-17',
    },
    {
      id: '1085421',
      ghsaId: 'GHSA-wm7h-9275-46v2',
      title: 'semver: vulnerable to Regular Expression Denial of Service',
      url: 'https://github.com/advisories/GHSA-wm7h-9275-46v2',
      severity: 'low',
      moduleName: 'semver',
      version: '5.7.1',
      vulnerableVersions: '<5.7.2 || >=6.0.0 <6.3.1 || >=7.0.0 <7.5.2',
      patchedVersions: '>=5.7.2 || >=6.3.1 || >=7.5.2',
      overview: 'Versions of the package semver are vulnerable to Regular Expression Denial of Service (ReDoS) via the function new Range.',
      recommendation: 'Upgrade to version 5.7.2, 6.3.1, 7.5.2 or later',
      findings: [{ version: '5.7.1', paths: ['node_modules/semver'] }],
      cwe: ['CWE-1333'],
      access: 'public',
      created: '2023-06-21',
      updated: '2023-07-01',
    },
  ];

  const runAudit = async () => {
    setIsScanning(true);
    setAuditResult(null);

    // Simulate npm audit phases
    const phases = [
      { phase: 'Checking package.json...', percent: 10 },
      { phase: 'Resolving dependencies...', percent: 25 },
      { phase: 'Running npm audit...', percent: 50 },
      { phase: 'Analyzing advisories...', percent: 75 },
      { phase: 'Generating fix suggestions...', percent: 90 },
    ];

    for (const p of phases) {
      setAuditResult(prev => ({
        ...prev as NpmAuditResult,
        progress: { phase: p.phase, percent: p.percent }
      }));
      await new Promise(r => setTimeout(r, 600));
    }

    // Filter advisories based on audit level
    const severityOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
    const filteredAdvisories = mockAdvisories.filter(
      a => severityOrder[a.severity] <= severityOrder[config.auditLevel]
    );

    // Calculate metadata
    const vulnCounts = filteredAdvisories.reduce(
      (acc, a) => {
        acc[a.severity]++;
        acc.total++;
        return acc;
      },
      { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 }
    );

    setAuditResult({
      runAt: new Date().toISOString(),
      projectPath,
      totalDependencies: 847,
      advisories: filteredAdvisories,
      metadata: {
        vulnerabilities: vulnCounts,
        dependencies: { prod: 523, dev: 324, optional: 12, total: 847 },
      },
    });

    setIsScanning(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
      case 'high': return 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'moderate': return 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'low': return 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'info': return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedAdvisories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredAdvisories = (auditResult?.advisories || []).filter(a =>
    selectedSeverity === 'all' || a.severity === selectedSeverity
  );

  const getFixCommand = (advisory: NpmAdvisory) => {
    if (advisory.patchedVersions) {
      return `npm install ${advisory.moduleName}@"${advisory.patchedVersions}"`;
    }
    return `npm update ${advisory.moduleName}`;
  };

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/security')} className="text-muted-foreground hover:text-foreground">
              &#8592;
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                npm audit
                <span className="text-sm font-normal text-muted-foreground">Security Scanner</span>
              </h1>
              <p className="text-muted-foreground">
                Detect vulnerabilities in Node.js project dependencies
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="rounded-lg border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold text-foreground mb-4">Scan Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Project Path</label>
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                placeholder="/path/to/node/project"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Audit Level</label>
              <select
                value={config.auditLevel}
                onChange={(e) => setConfig({ ...config, auditLevel: e.target.value as NpmAuditConfig['auditLevel'] })}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              >
                <option value="critical">Critical only</option>
                <option value="high">High and above</option>
                <option value="moderate">Moderate and above</option>
                <option value="low">Low and above</option>
                <option value="info">All (including info)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.packageLockOnly}
                onChange={(e) => setConfig({ ...config, packageLockOnly: e.target.checked })}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Package lock only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.omitDev}
                onChange={(e) => setConfig({ ...config, omitDev: e.target.checked })}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Omit dev dependencies</span>
            </label>
          </div>

          <button
            onClick={runAudit}
            disabled={isScanning}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium"
          >
            {isScanning ? 'Running npm audit...' : 'Run npm audit'}
          </button>
        </div>

        {/* Progress */}
        {isScanning && auditResult?.progress && (
          <div className="rounded-lg border border-border bg-card p-4 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
              <span className="text-foreground font-medium">{auditResult.progress.phase}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${auditResult.progress.percent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Results */}
        {auditResult && !isScanning && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 p-4 text-center">
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-purple-600">{auditResult.metadata.vulnerabilities.critical}</p>
              </div>
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4 text-center">
                <p className="text-sm text-muted-foreground">High</p>
                <p className="text-2xl font-bold text-red-600">{auditResult.metadata.vulnerabilities.high}</p>
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
                <p className="text-sm text-muted-foreground">Moderate</p>
                <p className="text-2xl font-bold text-amber-600">{auditResult.metadata.vulnerabilities.moderate}</p>
              </div>
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4 text-center">
                <p className="text-sm text-muted-foreground">Low</p>
                <p className="text-2xl font-bold text-blue-600">{auditResult.metadata.vulnerabilities.low}</p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{auditResult.metadata.vulnerabilities.total}</p>
              </div>
            </div>

            {/* Dependency Info */}
            <div className="rounded-lg border border-border bg-card p-4 mb-6">
              <div className="flex items-center gap-6">
                <span className="text-sm text-foreground">
                  <span className="font-medium">Scanned:</span> {auditResult.projectPath}
                </span>
                <span className="text-sm text-muted-foreground">
                  Production: <span className="font-medium text-foreground">{auditResult.metadata.dependencies.prod}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  Dev: <span className="font-medium text-foreground">{auditResult.metadata.dependencies.dev}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  Total: <span className="font-medium text-foreground">{auditResult.metadata.dependencies.total}</span>
                </span>
              </div>
            </div>

            {/* Filters */}
            <div className="rounded-lg border border-border bg-card p-4 mb-6">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-foreground">Filter:</span>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="px-3 py-1 rounded-md border border-border bg-background text-foreground text-sm"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="moderate">Moderate</option>
                  <option value="low">Low</option>
                </select>
                <span className="text-sm text-muted-foreground ml-auto">
                  Showing {filteredAdvisories.length} of {auditResult.advisories.length} advisories
                </span>
              </div>
            </div>

            {/* Advisory List */}
            <div className="space-y-3">
              {filteredAdvisories.length === 0 ? (
                <div className="rounded-lg border border-dashed border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20 p-8 text-center">
                  <p className="text-4xl mb-2">&#127881;</p>
                  <p className="text-lg font-medium text-green-700 dark:text-green-400">No vulnerabilities found!</p>
                  <p className="text-muted-foreground">Your dependencies are secure</p>
                </div>
              ) : (
                filteredAdvisories.map((advisory) => (
                  <div key={advisory.id} className="rounded-lg border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => toggleExpand(advisory.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${getSeverityColor(advisory.severity)}`}>
                          {advisory.severity}
                        </span>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-foreground">{advisory.moduleName}</span>
                            <span className="text-xs text-muted-foreground">v{advisory.version}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{advisory.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {advisory.ghsaId && (
                          <span className="font-mono text-xs text-primary">{advisory.ghsaId}</span>
                        )}
                        {advisory.cvss && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            advisory.cvss.score >= 9 ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                            advisory.cvss.score >= 7 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            advisory.cvss.score >= 4 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            CVSS {advisory.cvss.score}
                          </span>
                        )}
                        <svg className={`w-5 h-5 text-muted-foreground transition-transform ${expandedAdvisories.has(advisory.id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {expandedAdvisories.has(advisory.id) && (
                      <div className="p-4 border-t border-border bg-muted/20">
                        <p className="text-sm text-foreground mb-4">{advisory.overview}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Package</p>
                            <p className="font-mono text-sm text-foreground">{advisory.moduleName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Vulnerable Versions</p>
                            <p className="font-mono text-sm text-red-600">{advisory.vulnerableVersions}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Patched Versions</p>
                            <p className="font-mono text-sm text-green-600">{advisory.patchedVersions || 'No patch available'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Advisory ID</p>
                            <p className="text-sm text-foreground">{advisory.ghsaId}</p>
                          </div>
                        </div>

                        {/* Affected Paths */}
                        <div className="mb-4">
                          <p className="text-xs text-muted-foreground mb-2">Affected Paths ({advisory.findings[0]?.paths.length || 0})</p>
                          <div className="bg-muted/50 rounded p-2 max-h-24 overflow-y-auto">
                            {advisory.findings[0]?.paths.map((path, i) => (
                              <p key={i} className="font-mono text-xs text-muted-foreground">{path}</p>
                            ))}
                          </div>
                        </div>

                        {/* CWE Tags */}
                        {advisory.cwe && advisory.cwe.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs text-muted-foreground mb-2">CWE Identifiers</p>
                            <div className="flex flex-wrap gap-2">
                              {advisory.cwe.map((cwe, i) => (
                                <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">
                                  {cwe}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fix Command */}
                        <div className="mb-4">
                          <p className="text-xs text-muted-foreground mb-2">Suggested Fix Command</p>
                          <div className="bg-gray-900 dark:bg-gray-950 rounded p-3 flex items-center justify-between">
                            <code className="text-sm text-green-400 font-mono">{getFixCommand(advisory)}</code>
                            <button
                              onClick={() => navigator.clipboard.writeText(getFixCommand(advisory))}
                              className="text-gray-400 hover:text-white text-xs px-2 py-1"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        {/* Recommendation */}
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                          <p className="text-sm text-blue-800 dark:text-blue-300">
                            <span className="font-medium">Recommendation:</span> {advisory.recommendation}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <a
                            href={advisory.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
                          >
                            View Advisory &#8594;
                          </a>
                          {advisory.patchedVersions && (
                            <button className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                              Auto-fix
                            </button>
                          )}
                          <button className="px-3 py-1 border border-border rounded text-sm hover:bg-muted">
                            Ignore
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!auditResult && !isScanning && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
            <p className="text-4xl mb-4">&#128230;</p>
            <p className="text-lg font-medium text-foreground mb-2">Run npm audit security scan</p>
            <p className="text-muted-foreground">
              npm audit will check your Node.js dependencies against the npm advisory database and show npm-specific security advisories with suggested fix commands.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
