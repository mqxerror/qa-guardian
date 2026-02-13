// Feature #763: License Compliance Checking Page
// Feature #868: Wired to real license-scanner.ts backend via React Query hooks
// Detects dependencies with non-compliant licenses

import { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Button } from '../components/ui/button';
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';

import {
  useProjects,
  useLicenseCompliance,
  useLicensePolicy,
  useUpdateLicensePolicy,
} from '@/hooks/api';
import type { LicenseViolation } from '@/hooks/api';

// ============================================================================
// License display database — enriches SPDX IDs with category/risk info
// ============================================================================

interface LicenseDisplayInfo {
  spdxId: string;
  name: string;
  category: 'permissive' | 'copyleft' | 'copyleft-weak' | 'proprietary' | 'public-domain' | 'unknown';
  copyleft: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

const LICENSE_DISPLAY: Record<string, LicenseDisplayInfo> = {
  'MIT': { spdxId: 'MIT', name: 'MIT License', category: 'permissive', copyleft: false, riskLevel: 'low', description: 'A short and simple permissive license.' },
  'Apache-2.0': { spdxId: 'Apache-2.0', name: 'Apache License 2.0', category: 'permissive', copyleft: false, riskLevel: 'low', description: 'Permissive license with patent grant.' },
  'Apache-1.1': { spdxId: 'Apache-1.1', name: 'Apache License 1.1', category: 'permissive', copyleft: false, riskLevel: 'low', description: 'Legacy Apache license.' },
  'BSD-2-Clause': { spdxId: 'BSD-2-Clause', name: 'BSD 2-Clause License', category: 'permissive', copyleft: false, riskLevel: 'low', description: 'Simplified BSD license.' },
  'BSD-3-Clause': { spdxId: 'BSD-3-Clause', name: 'BSD 3-Clause License', category: 'permissive', copyleft: false, riskLevel: 'low', description: 'BSD license with non-endorsement clause.' },
  '0BSD': { spdxId: '0BSD', name: 'Zero-Clause BSD', category: 'public-domain', copyleft: false, riskLevel: 'low', description: 'Public domain equivalent BSD.' },
  'ISC': { spdxId: 'ISC', name: 'ISC License', category: 'permissive', copyleft: false, riskLevel: 'low', description: 'Functionally equivalent to MIT.' },
  'CC0-1.0': { spdxId: 'CC0-1.0', name: 'Creative Commons Zero', category: 'public-domain', copyleft: false, riskLevel: 'low', description: 'Public domain dedication.' },
  'Unlicense': { spdxId: 'Unlicense', name: 'The Unlicense', category: 'public-domain', copyleft: false, riskLevel: 'low', description: 'Public domain equivalent.' },
  'GPL-2.0-only': { spdxId: 'GPL-2.0-only', name: 'GNU GPLv2', category: 'copyleft', copyleft: true, riskLevel: 'high', description: 'Strong copyleft license.' },
  'GPL-3.0-only': { spdxId: 'GPL-3.0-only', name: 'GNU GPLv3', category: 'copyleft', copyleft: true, riskLevel: 'high', description: 'Strong copyleft with patent grant.' },
  'GPL-3.0-or-later': { spdxId: 'GPL-3.0-or-later', name: 'GNU GPLv3+', category: 'copyleft', copyleft: true, riskLevel: 'high', description: 'Strong copyleft, v3 or later.' },
  'AGPL-3.0-only': { spdxId: 'AGPL-3.0-only', name: 'GNU AGPLv3', category: 'copyleft', copyleft: true, riskLevel: 'high', description: 'Strong copyleft extending to network use.' },
  'LGPL-2.1-only': { spdxId: 'LGPL-2.1-only', name: 'GNU LGPLv2.1', category: 'copyleft-weak', copyleft: true, riskLevel: 'medium', description: 'Weak copyleft for libraries.' },
  'LGPL-3.0-only': { spdxId: 'LGPL-3.0-only', name: 'GNU LGPLv3', category: 'copyleft-weak', copyleft: true, riskLevel: 'medium', description: 'Weak copyleft for libraries.' },
  'MPL-2.0': { spdxId: 'MPL-2.0', name: 'Mozilla Public License 2.0', category: 'copyleft-weak', copyleft: true, riskLevel: 'medium', description: 'File-level copyleft.' },
  'Python-2.0': { spdxId: 'Python-2.0', name: 'Python License 2.0', category: 'permissive', copyleft: false, riskLevel: 'low', description: 'Permissive Python license.' },
  'Zlib': { spdxId: 'Zlib', name: 'zlib License', category: 'permissive', copyleft: false, riskLevel: 'low', description: 'Permissive zlib license.' },
  'BlueOak-1.0.0': { spdxId: 'BlueOak-1.0.0', name: 'Blue Oak Model License', category: 'permissive', copyleft: false, riskLevel: 'low', description: 'Modern permissive license.' },
};

function getLicenseDisplay(spdxId: string | null): LicenseDisplayInfo {
  if (!spdxId) {
    return { spdxId: 'UNKNOWN', name: 'Unknown License', category: 'unknown', copyleft: false, riskLevel: 'high', description: 'License could not be determined.' };
  }
  return LICENSE_DISPLAY[spdxId] || {
    spdxId,
    name: spdxId,
    category: spdxId.includes('GPL') || spdxId.includes('AGPL') ? 'copyleft' : 'permissive',
    copyleft: spdxId.includes('GPL') || spdxId.includes('AGPL'),
    riskLevel: spdxId.includes('GPL') || spdxId.includes('AGPL') ? 'high' : 'low',
    description: `License: ${spdxId}`,
  };
}

// ============================================================================
// Component
// ============================================================================

export function LicenseCompliancePage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showNonCompliantOnly, setShowNonCompliantOnly] = useState(false);
  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set());
  const [showPolicyConfig, setShowPolicyConfig] = useState(false);

  // Fetch projects for the selector
  const { data: projects } = useProjects();

  // Fetch license compliance results (only when a project is selected)
  const {
    data: scanResult,
    isLoading: isScanning,
    isError: scanError,
    error: scanErrorDetails,
    refetch: triggerScan,
  } = useLicenseCompliance(selectedProjectId, !!selectedProjectId);

  // Fetch org license policy
  const { data: orgPolicy } = useLicensePolicy();

  // Update policy mutation
  const updatePolicy = useUpdateLicensePolicy();

  // Map backend response to display format
  const displayPackages = useMemo(() => {
    if (!scanResult?.packages) return [];
    const violationMap = new Map<string, LicenseViolation>();
    for (const v of scanResult.violations) {
      violationMap.set(`${v.package}@${v.version}`, v);
    }

    return scanResult.packages.map((pkg, idx) => {
      const violation = violationMap.get(`${pkg.name}@${pkg.version}`);
      const display = getLicenseDisplay(pkg.spdx_id);
      const warnings: string[] = [];
      if (violation) {
        warnings.push(violation.reason);
        if (violation.violation_type === 'blocklist') {
          warnings.push(`${violation.license} is on the organization's blocklist`);
        }
      }
      if (display.copyleft) {
        warnings.push(`${display.spdxId} is a ${display.category === 'copyleft' ? 'strong' : 'weak'} copyleft license`);
      }

      return {
        id: `pkg-${idx}`,
        pkgName: pkg.name,
        version: pkg.version,
        spdxId: pkg.spdx_id || 'UNKNOWN',
        display,
        isCompliant: !violation,
        warnings,
        repository: pkg.repository,
        publisher: pkg.publisher,
      };
    });
  }, [scanResult]);

  // Compute summary from category perspective
  const categorySummary = useMemo(() => {
    const byCat: Record<string, number> = {};
    const byRisk = { low: 0, medium: 0, high: 0 };
    for (const pkg of displayPackages) {
      byCat[pkg.display.category] = (byCat[pkg.display.category] || 0) + 1;
      byRisk[pkg.display.riskLevel]++;
    }
    return { byCat, byRisk };
  }, [displayPackages]);

  // Filter packages
  const filteredDeps = useMemo(() => {
    return displayPackages.filter(d => {
      if (selectedCategory !== 'all' && d.display.category !== selectedCategory) return false;
      if (showNonCompliantOnly && d.isCompliant && d.warnings.length === 0) return false;
      return true;
    });
  }, [displayPackages, selectedCategory, showNonCompliantOnly]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'permissive': return 'text-success bg-success/10';
      case 'copyleft': return 'text-destructive bg-destructive/10';
      case 'copyleft-weak': return 'text-warning bg-warning/10';
      case 'proprietary': return 'text-accent bg-accent/10';
      case 'public-domain': return 'text-primary bg-primary/10';
      default: return 'text-foreground bg-muted';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-destructive';
      default: return 'text-foreground';
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedDeps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleRunScan = () => {
    if (selectedProjectId) {
      triggerScan();
    }
  };

  const handlePolicyToggle = (list: 'allowlist' | 'blocklist', spdxId: string) => {
    if (!orgPolicy) return;
    const currentList = orgPolicy[list];
    const otherList = list === 'allowlist' ? 'blocklist' : 'allowlist';
    const otherCurrent = orgPolicy[otherList];

    let newList: string[];
    let newOther = otherCurrent;

    if (currentList.includes(spdxId)) {
      // Remove from this list
      newList = currentList.filter(l => l !== spdxId);
    } else {
      // Add to this list, remove from other
      newList = [...currentList, spdxId];
      newOther = otherCurrent.filter(l => l !== spdxId);
    }

    updatePolicy.mutate({
      [list]: newList,
      [otherList]: newOther,
    });
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title="License Compliance"
          description="Detect dependencies with non-compliant licenses"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'License Compliance' }]}
          actions={
            <Button
              variant={showPolicyConfig ? 'default' : 'outline'}
              onClick={() => setShowPolicyConfig(!showPolicyConfig)}
              className="flex items-center gap-2"
            >
              &#x2699;&#xFE0F; Configure Policy
            </Button>
          }
        />

        {/* Policy Configuration Panel */}
        {showPolicyConfig && orgPolicy && (
          <div className="rounded-lg border border-border bg-card p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              License Policy: {orgPolicy.name}
              {orgPolicy.is_default && <span className="text-xs text-muted-foreground ml-2">(Default)</span>}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Allowlist */}
              <div className="p-4 rounded-lg border border-success/20 bg-success/5">
                <h3 className="font-medium text-success mb-3 flex items-center gap-2">
                  <span>&#x2705;</span> Allowed Licenses ({orgPolicy.allowlist.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.values(LICENSE_DISPLAY).map(license => (
                    <label key={`allow-${license.spdxId}`} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgPolicy.allowlist.includes(license.spdxId)}
                        onChange={() => handlePolicyToggle('allowlist', license.spdxId)}
                        className="rounded border-border"
                        disabled={updatePolicy.isPending}
                      />
                      <span className={orgPolicy.allowlist.includes(license.spdxId) ? 'text-success' : 'text-muted-foreground'}>
                        {license.spdxId}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Blocklist */}
              <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                <h3 className="font-medium text-destructive mb-3 flex items-center gap-2">
                  <span>&#x274C;</span> Blocked Licenses ({orgPolicy.blocklist.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.values(LICENSE_DISPLAY).map(license => (
                    <label key={`block-${license.spdxId}`} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgPolicy.blocklist.includes(license.spdxId)}
                        onChange={() => handlePolicyToggle('blocklist', license.spdxId)}
                        className="rounded border-border"
                        disabled={updatePolicy.isPending}
                      />
                      <span className={orgPolicy.blocklist.includes(license.spdxId) ? 'text-destructive' : 'text-muted-foreground'}>
                        {license.spdxId}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {updatePolicy.isPending && (
              <p className="text-xs text-muted-foreground mt-3">Updating policy...</p>
            )}
          </div>
        )}

        {/* Scan Controls */}
        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Dependency License Scan</h2>
              <p className="text-sm text-muted-foreground">Select a project and scan its dependencies for license compliance</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="px-3 py-2 rounded-md border border-border bg-background text-foreground min-w-[200px]"
              >
                <option value="">Select a project...</option>
                {projects?.projects?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Button
                onClick={handleRunScan}
                disabled={isScanning || !selectedProjectId}
                className="flex items-center gap-2"
              >
                {isScanning && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {isScanning ? 'Scanning...' : 'Run License Scan'}
              </Button>
            </div>
          </div>

          {/* Scan Progress */}
          {isScanning && (
            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-primary">Scanning dependencies...</span>
              </div>
              <div className="w-full h-2 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}

          {/* Error */}
          {scanError && (
            <div className="mt-4 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="text-sm text-destructive">
                Scan failed: {scanErrorDetails instanceof Error ? scanErrorDetails.message : 'Unknown error'}
              </p>
            </div>
          )}
        </div>

        {/* Results */}
        {scanResult && !isScanning && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total Packages</p>
                <p className="text-2xl font-bold text-foreground">{scanResult.summary.total_packages}</p>
              </div>
              <div className="rounded-lg border border-success/20 bg-success/5 p-4">
                <p className="text-sm text-success">Compliant</p>
                <p className="text-2xl font-bold text-success">{scanResult.summary.compliant_packages}</p>
              </div>
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">Violations</p>
                <p className="text-2xl font-bold text-destructive">{scanResult.summary.violation_count}</p>
              </div>
              <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                <p className="text-sm text-warning">Unknown Licenses</p>
                <p className="text-2xl font-bold text-warning">{scanResult.summary.unknown_license_count}</p>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm text-primary">Compliance</p>
                <p className="text-2xl font-bold text-primary">{scanResult.summary.compliance_percentage}%</p>
              </div>
            </div>

            {/* License Distribution */}
            <div className="rounded-lg border border-border bg-card p-4 mb-6">
              <h3 className="font-medium text-foreground mb-3">License Distribution</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(scanResult.license_summary)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 15)
                  .map(([license, count]) => {
                    const display = getLicenseDisplay(license);
                    return (
                      <span key={license} className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(display.category)}`}>
                        {license}: {count}
                      </span>
                    );
                  })}
              </div>
            </div>

            {/* Severity Breakdown */}
            {scanResult.severity_breakdown && (scanResult.severity_breakdown.critical > 0 || scanResult.severity_breakdown.high > 0) && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 mb-6">
                <h3 className="font-medium text-destructive mb-3">Violations by Severity</h3>
                <div className="flex flex-wrap gap-4">
                  {scanResult.severity_breakdown.critical > 0 && (
                    <span className="text-sm font-bold text-destructive">Critical: {scanResult.severity_breakdown.critical}</span>
                  )}
                  {scanResult.severity_breakdown.high > 0 && (
                    <span className="text-sm font-bold text-destructive">High: {scanResult.severity_breakdown.high}</span>
                  )}
                  {scanResult.severity_breakdown.medium > 0 && (
                    <span className="text-sm font-medium text-warning">Medium: {scanResult.severity_breakdown.medium}</span>
                  )}
                  {scanResult.severity_breakdown.low > 0 && (
                    <span className="text-sm text-muted-foreground">Low: {scanResult.severity_breakdown.low}</span>
                  )}
                </div>
              </div>
            )}

            {/* Policy Applied */}
            {scanResult.policy_applied && (
              <div className="rounded-lg border border-border bg-card p-4 mb-6">
                <h3 className="font-medium text-foreground mb-2">Policy Applied: {scanResult.policy_applied.name}</h3>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Allowlist: {scanResult.policy_applied.allowlist.join(', ')}</span>
                  <span>Blocklist: {scanResult.policy_applied.blocklist.join(', ')}</span>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4 mb-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-md border border-border bg-background text-foreground"
              >
                <option value="all">All Categories</option>
                <option value="permissive">Permissive</option>
                <option value="copyleft">Copyleft (Strong)</option>
                <option value="copyleft-weak">Copyleft (Weak)</option>
                <option value="proprietary">Proprietary</option>
                <option value="public-domain">Public Domain</option>
                <option value="unknown">Unknown</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showNonCompliantOnly}
                  onChange={(e) => setShowNonCompliantOnly(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-muted-foreground">Show issues only</span>
              </label>
              <span className="text-sm text-muted-foreground ml-auto">
                Showing {filteredDeps.length} of {displayPackages.length} packages
              </span>
            </div>

            {/* Packages List */}
            <div className="space-y-2">
              {filteredDeps.map(dep => (
                <div
                  key={dep.id}
                  className={`rounded-lg border ${!dep.isCompliant ? 'border-destructive/20 bg-destructive/5' : dep.warnings.length > 0 ? 'border-warning/20 bg-warning/5' : 'border-border bg-card'}`}
                >
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => toggleExpand(dep.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {!dep.isCompliant ? (
                          <span className="text-destructive">&#x274C;</span>
                        ) : dep.warnings.length > 0 ? (
                          <span className="text-warning">&#x26A0;&#xFE0F;</span>
                        ) : (
                          <span className="text-success">&#x2705;</span>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{dep.pkgName}</p>
                          <p className="text-xs text-muted-foreground">{dep.version}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(dep.display.category)}`}>
                        {dep.spdxId}
                      </span>
                      {dep.display.copyleft && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
                          Copyleft
                        </span>
                      )}
                      <span className={`text-xs font-medium ${getRiskColor(dep.display.riskLevel)}`}>
                        {dep.display.riskLevel.toUpperCase()} RISK
                      </span>
                    </div>
                    <span className="text-muted-foreground">{expandedDeps.has(dep.id) ? '\u25B2' : '\u25BC'}</span>
                  </div>

                  {expandedDeps.has(dep.id) && (
                    <div className="px-4 pb-4 border-t border-border/50 pt-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">License</p>
                          <p className="text-sm font-medium text-foreground">{dep.display.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{dep.display.description}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Details</p>
                          <div className="flex flex-wrap gap-1">
                            <span className={`px-1.5 py-0.5 text-xs rounded ${getCategoryColor(dep.display.category)}`}>
                              {dep.display.category}
                            </span>
                            {dep.publisher && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                                By: {dep.publisher}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {dep.warnings.length > 0 && (
                        <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                          <p className="text-xs font-medium text-warning mb-2">&#x26A0;&#xFE0F; Warnings</p>
                          <ul className="space-y-1">
                            {dep.warnings.map((w, i) => (
                              <li key={i} className="text-xs text-warning flex items-start gap-1">
                                <span>&#x2022;</span>
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {dep.repository && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          <a href={dep.repository} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                            &#x1F517; {dep.repository}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredDeps.length === 0 && (
              <EmptyState
                icon={EmptyStateIcons.security}
                title="All packages are compliant!"
                description="No license issues found matching your filter criteria."
              />
            )}
          </>
        )}

        {/* Initial empty state */}
        {!scanResult && !isScanning && (
          <EmptyState
            icon={EmptyStateIcons.document}
            title="Run a license compliance scan"
            description="Select a project above and click 'Run License Scan' to analyze dependencies for license compliance."
            size="lg"
          />
        )}
      </div>
    </Layout>
  );
}
