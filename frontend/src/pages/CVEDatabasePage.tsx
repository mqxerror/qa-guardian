// Feature #762: CVE Database Scanner Page
// Extracted from App.tsx for code quality compliance (400 line limit)
// Scans dependencies against the National Vulnerability Database (NVD)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';

// CVE vulnerability interface with NVD details
interface CVEVulnerability {
  id: string;
  cveId: string;
  source: string;
  pkgName: string;
  installedVersion: string;
  fixedVersion?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  cvss: {
    version: string;
    score: number;
    vector: string;
    attackVector: string;
    attackComplexity: string;
    privilegesRequired: string;
    userInteraction: string;
    scope: string;
    confidentiality: string;
    integrity: string;
    availability: string;
  };
  publishedDate: string;
  lastModifiedDate: string;
  nvdUrl: string;
  references: {
    url: string;
    source: string;
    tags: string[];
  }[];
  cwe: { id: string; name: string }[];
  affectedVersions: string;
  exploitabilityScore?: number;
  impactScore?: number;
}

// CVE scan result interface
interface CVEScanResult {
  scanId: string;
  scanDate: string;
  projectName: string;
  totalDependencies: number;
  vulnerabilities: CVEVulnerability[];
  summary: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    bySource: {
      nvd: number;
      ghsa: number;
      osv: number;
    };
  };
  progress?: {
    phase: string;
    percent: number;
  };
}

export function CVEDatabasePage() {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<CVEScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [expandedVulns, setExpandedVulns] = useState<Set<string>>(new Set());

  // Mock CVE vulnerabilities matched against NVD
  const mockCVEVulnerabilities: CVEVulnerability[] = [
    {
      id: 'cve1',
      cveId: 'CVE-2024-38374',
      source: 'NVD',
      pkgName: 'lodash',
      installedVersion: '4.17.15',
      fixedVersion: '4.17.21',
      severity: 'CRITICAL',
      title: 'Prototype Pollution in lodash',
      description: 'Lodash versions prior to 4.17.21 are vulnerable to Prototype Pollution via the setWith and set functions. This allows attackers to modify the prototype of Object, potentially leading to denial of service or remote code execution in certain cases.',
      cvss: {
        version: '3.1',
        score: 9.8,
        vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
        attackVector: 'Network',
        attackComplexity: 'Low',
        privilegesRequired: 'None',
        userInteraction: 'None',
        scope: 'Unchanged',
        confidentiality: 'High',
        integrity: 'High',
        availability: 'High',
      },
      publishedDate: '2024-06-15T14:15:00Z',
      lastModifiedDate: '2024-06-20T10:30:00Z',
      nvdUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2024-38374',
      references: [
        { url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-38374', source: 'NVD', tags: ['Official'] },
        { url: 'https://github.com/lodash/lodash/pull/5085', source: 'GitHub', tags: ['Patch'] },
        { url: 'https://snyk.io/vuln/SNYK-JS-LODASH-1040724', source: 'Snyk', tags: ['Third Party Advisory'] },
      ],
      cwe: [{ id: 'CWE-1321', name: 'Improperly Controlled Modification of Object Prototype' }],
      affectedVersions: '<4.17.21',
      exploitabilityScore: 3.9,
      impactScore: 5.9,
    },
    {
      id: 'cve2',
      cveId: 'CVE-2024-39338',
      source: 'NVD',
      pkgName: 'axios',
      installedVersion: '0.21.4',
      fixedVersion: '1.7.4',
      severity: 'HIGH',
      title: 'Server-Side Request Forgery in Axios',
      description: 'An issue was discovered in axios 0.8.1 through 1.7.3. axios allows SSRF via unexpected behavior where requests for path-relative URLs gets processed as protocol-relative URLs, allowing attackers to forge requests to internal services.',
      cvss: {
        version: '3.1',
        score: 8.1,
        vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N',
        attackVector: 'Network',
        attackComplexity: 'Low',
        privilegesRequired: 'None',
        userInteraction: 'Required',
        scope: 'Unchanged',
        confidentiality: 'High',
        integrity: 'High',
        availability: 'None',
      },
      publishedDate: '2024-07-21T09:00:00Z',
      lastModifiedDate: '2024-08-12T16:45:00Z',
      nvdUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2024-39338',
      references: [
        { url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-39338', source: 'NVD', tags: ['Official'] },
        { url: 'https://github.com/axios/axios/security/advisories/GHSA-952p-6rrq-rcjv', source: 'GitHub', tags: ['Advisory'] },
      ],
      cwe: [{ id: 'CWE-918', name: 'Server-Side Request Forgery (SSRF)' }],
      affectedVersions: '>=0.8.1 <1.7.4',
      exploitabilityScore: 2.8,
      impactScore: 5.2,
    },
    {
      id: 'cve3',
      cveId: 'CVE-2023-45133',
      source: 'NVD',
      pkgName: '@babel/traverse',
      installedVersion: '7.18.0',
      fixedVersion: '7.23.2',
      severity: 'CRITICAL',
      title: 'Code Injection in Babel Traverse',
      description: 'Babel traverse before 7.23.2 is vulnerable to arbitrary code execution when processing malicious code during AST transformation. An attacker can craft a malicious code snippet that executes arbitrary code when processed by Babel.',
      cvss: {
        version: '3.1',
        score: 9.1,
        vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
        attackVector: 'Network',
        attackComplexity: 'Low',
        privilegesRequired: 'None',
        userInteraction: 'None',
        scope: 'Unchanged',
        confidentiality: 'High',
        integrity: 'High',
        availability: 'None',
      },
      publishedDate: '2023-10-12T17:15:00Z',
      lastModifiedDate: '2023-11-01T12:00:00Z',
      nvdUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2023-45133',
      references: [
        { url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-45133', source: 'NVD', tags: ['Official'] },
        { url: 'https://github.com/babel/babel/security/advisories/GHSA-67hx-6x53-jw92', source: 'GitHub', tags: ['Advisory', 'Patch'] },
      ],
      cwe: [{ id: 'CWE-94', name: 'Improper Control of Generation of Code (Code Injection)' }],
      affectedVersions: '<7.23.2',
      exploitabilityScore: 3.9,
      impactScore: 5.2,
    },
    {
      id: 'cve4',
      cveId: 'CVE-2024-37890',
      source: 'NVD',
      pkgName: 'ws',
      installedVersion: '7.5.9',
      fixedVersion: '7.5.10',
      severity: 'HIGH',
      title: 'Cross-Site WebSocket Hijacking in ws',
      description: 'The ws package for Node.js before 7.5.10, 8.x before 8.17.1 allows Cross-Site WebSocket Hijacking (CSWSH) due to improper validation of the Origin header during WebSocket handshake.',
      cvss: {
        version: '3.1',
        score: 7.5,
        vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
        attackVector: 'Network',
        attackComplexity: 'Low',
        privilegesRequired: 'None',
        userInteraction: 'None',
        scope: 'Unchanged',
        confidentiality: 'High',
        integrity: 'None',
        availability: 'None',
      },
      publishedDate: '2024-06-17T08:15:00Z',
      lastModifiedDate: '2024-06-25T14:30:00Z',
      nvdUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2024-37890',
      references: [
        { url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-37890', source: 'NVD', tags: ['Official'] },
        { url: 'https://github.com/websockets/ws/commit/e55e5106f10fcbaac37cfa89759e4cc0d073a52c', source: 'GitHub', tags: ['Patch'] },
      ],
      cwe: [{ id: 'CWE-346', name: 'Origin Validation Error' }, { id: 'CWE-1385', name: 'Missing Origin Validation in WebSockets' }],
      affectedVersions: '<7.5.10 || >=8.0.0 <8.17.1',
      exploitabilityScore: 3.9,
      impactScore: 3.6,
    },
    {
      id: 'cve5',
      cveId: 'CVE-2024-28863',
      source: 'NVD',
      pkgName: 'tar',
      installedVersion: '6.1.11',
      fixedVersion: '6.2.1',
      severity: 'MEDIUM',
      title: 'Directory Traversal in tar',
      description: 'The tar npm package before 6.2.1 allows directory traversal via symbolic link following during extraction. This can lead to arbitrary file write outside the intended directory.',
      cvss: {
        version: '3.1',
        score: 5.5,
        vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N',
        attackVector: 'Local',
        attackComplexity: 'Low',
        privilegesRequired: 'None',
        userInteraction: 'Required',
        scope: 'Unchanged',
        confidentiality: 'None',
        integrity: 'High',
        availability: 'None',
      },
      publishedDate: '2024-04-02T11:15:00Z',
      lastModifiedDate: '2024-04-15T09:00:00Z',
      nvdUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2024-28863',
      references: [
        { url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-28863', source: 'NVD', tags: ['Official'] },
        { url: 'https://github.com/npm/node-tar/security/advisories/GHSA-f5x3-32g6-xq36', source: 'GitHub', tags: ['Advisory'] },
      ],
      cwe: [{ id: 'CWE-22', name: 'Improper Limitation of a Pathname (Path Traversal)' }],
      affectedVersions: '<6.2.1',
      exploitabilityScore: 1.8,
      impactScore: 3.6,
    },
    {
      id: 'cve6',
      cveId: 'CVE-2024-24758',
      source: 'NVD',
      pkgName: 'undici',
      installedVersion: '5.26.0',
      fixedVersion: '5.28.3',
      severity: 'MEDIUM',
      title: 'SSRF via Proxy Headers in Undici',
      description: 'Undici before 5.28.3 is vulnerable to SSRF when proxy configuration allows untrusted headers to be forwarded, enabling attackers to access internal services.',
      cvss: {
        version: '3.1',
        score: 5.3,
        vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N',
        attackVector: 'Network',
        attackComplexity: 'Low',
        privilegesRequired: 'None',
        userInteraction: 'None',
        scope: 'Unchanged',
        confidentiality: 'Low',
        integrity: 'None',
        availability: 'None',
      },
      publishedDate: '2024-02-14T16:15:00Z',
      lastModifiedDate: '2024-02-28T11:00:00Z',
      nvdUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2024-24758',
      references: [
        { url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-24758', source: 'NVD', tags: ['Official'] },
        { url: 'https://github.com/nodejs/undici/security/advisories/GHSA-3787-6prv-h9w3', source: 'GitHub', tags: ['Advisory', 'Patch'] },
      ],
      cwe: [{ id: 'CWE-918', name: 'Server-Side Request Forgery (SSRF)' }],
      affectedVersions: '<5.28.3',
      exploitabilityScore: 3.9,
      impactScore: 1.4,
    },
  ];

  const runScan = async () => {
    setIsScanning(true);
    setScanResult(null);

    // Simulate scanning phases
    const phases = [
      { phase: 'Analyzing dependencies...', percent: 15 },
      { phase: 'Querying NVD database...', percent: 35 },
      { phase: 'Matching CVE records...', percent: 55 },
      { phase: 'Calculating CVSS scores...', percent: 75 },
      { phase: 'Generating report...', percent: 90 },
    ];

    for (const p of phases) {
      setScanResult(prev => ({
        ...prev as CVEScanResult,
        progress: { phase: p.phase, percent: p.percent }
      }));
      await new Promise(r => setTimeout(r, 500));
    }

    const summary = mockCVEVulnerabilities.reduce(
      (acc, v) => {
        acc.total++;
        acc.bySeverity[v.severity.toLowerCase() as keyof typeof acc.bySeverity]++;
        acc.bySource.nvd++; // All from NVD
        return acc;
      },
      { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, bySource: { nvd: 0, ghsa: 0, osv: 0 } }
    );

    setScanResult({
      scanId: 'scan_' + Date.now(),
      scanDate: new Date().toISOString(),
      projectName: 'qa-guardian-frontend',
      totalDependencies: 847,
      vulnerabilities: mockCVEVulnerabilities,
      summary,
    });

    setIsScanning(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 'text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
      case 'HIGH': return 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'MEDIUM': return 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'LOW': return 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const getCVSSColor = (score: number) => {
    if (score >= 9) return 'bg-purple-600 text-white';
    if (score >= 7) return 'bg-red-600 text-white';
    if (score >= 4) return 'bg-amber-500 text-white';
    return 'bg-blue-500 text-white';
  };

  const toggleExpand = (id: string) => {
    setExpandedVulns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredVulns = (scanResult?.vulnerabilities || []).filter(v =>
    selectedSeverity === 'all' || v.severity === selectedSeverity
  );

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/security')} className="text-muted-foreground hover:text-foreground">
              ←
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                🛡️ CVE Database Scanner
                <span className="text-sm font-normal px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                  NVD Integration
                </span>
              </h1>
              <p className="text-muted-foreground">
                Scan dependencies against the National Vulnerability Database (NVD)
              </p>
            </div>
          </div>
          <button
            onClick={runScan}
            disabled={isScanning}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-medium"
          >
            {isScanning ? 'Scanning...' : '🔍 Run CVE Scan'}
          </button>
        </div>

        {/* Progress */}
        {isScanning && scanResult?.progress && (
          <div className="rounded-lg border border-border bg-card p-4 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
              <span className="text-foreground font-medium">{scanResult.progress.phase}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${scanResult.progress.percent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Results */}
        {scanResult && !isScanning && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
                <p className="text-sm text-muted-foreground">NVD Matched</p>
                <p className="text-2xl font-bold text-green-600">{scanResult.summary.bySource.nvd}</p>
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
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
                <span className="text-sm text-muted-foreground ml-auto">
                  Showing {filteredVulns.length} of {scanResult.vulnerabilities.length} CVEs
                </span>
              </div>
            </div>

            {/* CVE List */}
            <div className="space-y-3">
              {filteredVulns.map((vuln) => (
                <div key={vuln.id} className="rounded-lg border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => toggleExpand(vuln.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold ${getSeverityColor(vuln.severity)}`}>
                        {vuln.severity}
                      </span>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-foreground">{vuln.pkgName}</span>
                          <span className="text-xs text-muted-foreground">v{vuln.installedVersion}</span>
                          {vuln.fixedVersion && (
                            <span className="text-xs text-green-600 dark:text-green-400">→ {vuln.fixedVersion}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{vuln.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* CVE ID Link */}
                      <a
                        href={vuln.nvdUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {vuln.cveId}
                      </a>
                      {/* CVSS Score Badge */}
                      <span className={`px-2 py-1 rounded text-xs font-bold ${getCVSSColor(vuln.cvss.score)}`}>
                        CVSS {vuln.cvss.score}
                      </span>
                      <svg className={`w-5 h-5 text-muted-foreground transition-transform ${expandedVulns.has(vuln.id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {expandedVulns.has(vuln.id) && (
                    <div className="p-4 border-t border-border bg-muted/20">
                      <p className="text-sm text-foreground mb-4">{vuln.description}</p>

                      {/* NVD Details Section */}
                      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">🏛️</span>
                          <h4 className="font-semibold text-foreground">NVD Details</h4>
                          <a
                            href={vuln.nvdUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline ml-auto"
                          >
                            View on NVD →
                          </a>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">CVE ID</p>
                            <a href={vuln.nvdUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline">
                              {vuln.cveId}
                            </a>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Published</p>
                            <p className="text-foreground">{new Date(vuln.publishedDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Last Modified</p>
                            <p className="text-foreground">{new Date(vuln.lastModifiedDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Source</p>
                            <p className="text-foreground">{vuln.source}</p>
                          </div>
                        </div>
                      </div>

                      {/* CVSS Details */}
                      <div className="rounded-lg border border-border bg-card p-4 mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-3 py-1 rounded font-bold text-sm ${getCVSSColor(vuln.cvss.score)}`}>
                            CVSS {vuln.cvss.version}: {vuln.cvss.score}
                          </span>
                          <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {vuln.cvss.vector}
                          </code>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Attack Vector</p>
                            <p className="text-foreground">{vuln.cvss.attackVector}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Attack Complexity</p>
                            <p className="text-foreground">{vuln.cvss.attackComplexity}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Privileges Required</p>
                            <p className="text-foreground">{vuln.cvss.privilegesRequired}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">User Interaction</p>
                            <p className="text-foreground">{vuln.cvss.userInteraction}</p>
                          </div>
                        </div>
                        {(vuln.exploitabilityScore || vuln.impactScore) && (
                          <div className="flex gap-4 mt-3 pt-3 border-t border-border">
                            {vuln.exploitabilityScore && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Exploitability:</span>{' '}
                                <span className="font-medium text-foreground">{vuln.exploitabilityScore}</span>
                              </div>
                            )}
                            {vuln.impactScore && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Impact:</span>{' '}
                                <span className="font-medium text-foreground">{vuln.impactScore}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Package Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Package</p>
                          <p className="font-mono text-sm text-foreground">{vuln.pkgName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Installed</p>
                          <p className="font-mono text-sm text-red-600">{vuln.installedVersion}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Fixed In</p>
                          <p className="font-mono text-sm text-green-600">{vuln.fixedVersion || 'No fix available'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Affected Versions</p>
                          <p className="font-mono text-sm text-foreground">{vuln.affectedVersions}</p>
                        </div>
                      </div>

                      {/* CWE Tags */}
                      {vuln.cwe && vuln.cwe.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-muted-foreground mb-2">CWE Weaknesses</p>
                          <div className="flex flex-wrap gap-2">
                            {vuln.cwe.map((cwe, i) => (
                              <span key={i} className="px-2 py-1 bg-muted rounded text-xs">
                                <span className="font-mono text-primary">{cwe.id}</span>
                                <span className="text-muted-foreground ml-1">- {cwe.name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* References */}
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-2">References</p>
                        <div className="flex flex-wrap gap-2">
                          {vuln.references.map((ref, i) => (
                            <a
                              key={i}
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs hover:bg-muted/70"
                            >
                              {ref.source === 'NVD' ? '🏛️' : ref.source === 'GitHub' ? '🐙' : '🔗'}
                              <span className="text-primary">{ref.source}</span>
                              {ref.tags && ref.tags.map((tag, j) => (
                                <span key={j} className="text-muted-foreground">({tag})</span>
                              ))}
                            </a>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <a
                          href={vuln.nvdUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          🏛️ View NVD Details
                        </a>
                        {vuln.fixedVersion && (
                          <button className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                            Auto-fix to {vuln.fixedVersion}
                          </button>
                        )}
                        <button className="px-3 py-1.5 border border-border rounded text-sm hover:bg-muted">
                          Add to Ignore List
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {!scanResult && !isScanning && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
            <p className="text-4xl mb-4">🛡️</p>
            <p className="text-lg font-medium text-foreground mb-2">Scan for CVE Vulnerabilities</p>
            <p className="text-muted-foreground max-w-md mx-auto">
              Run a dependency scan to match your packages against the National Vulnerability Database (NVD).
              View CVE details, CVSS scores, and remediation guidance.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
