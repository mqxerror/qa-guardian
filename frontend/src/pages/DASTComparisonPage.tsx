// Feature #756: DAST Comparison Between Scans
// Extracted from App.tsx for code quality compliance
// Feature #1986: Shows demo/mock data - real DAST comparison integration coming soon
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';

// Types
type DASTCompareRisk = 'High' | 'Medium' | 'Low' | 'Informational';
type DASTCompareConfidence = 'High' | 'Medium' | 'Low' | 'User Confirmed' | 'False Positive';

interface DASTCompareAlert {
  id: string;
  pluginId: string;
  name: string;
  risk: DASTCompareRisk;
  confidence: DASTCompareConfidence;
  description: string;
  url: string;
  method: string;
  param?: string;
  attack?: string;
  evidence?: string;
  solution: string;
  cweId?: number;
}

interface DASTCompareScan {
  id: string;
  targetUrl: string;
  scanProfile: 'baseline' | 'full' | 'api';
  status: 'completed';
  startedAt: string;
  completedAt: string;
  alerts: DASTCompareAlert[];
  summary: {
    total: number;
    byRisk: { high: number; medium: number; low: number; informational: number; };
  };
}

interface DASTComparisonResult {
  scan1: DASTCompareScan;
  scan2: DASTCompareScan;
  newFindings: DASTCompareAlert[];
  fixedFindings: DASTCompareAlert[];
  unchangedFindings: DASTCompareAlert[];
  summary: {
    totalNew: number;
    totalFixed: number;
    totalUnchanged: number;
    riskDelta: { high: number; medium: number; low: number; informational: number; };
    overallImprovement: boolean;
  };
}

export function DASTComparisonPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedScan1, setSelectedScan1] = useState<string>('');
  const [selectedScan2, setSelectedScan2] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<DASTComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'fixed' | 'unchanged'>('new');

  // Mock available scans
  const availableScans: DASTCompareScan[] = [
    {
      id: 'scan_001',
      targetUrl: 'https://api.example.com',
      scanProfile: 'full',
      status: 'completed',
      startedAt: '2025-01-10T08:00:00Z',
      completedAt: '2025-01-10T09:30:00Z',
      alerts: [
        { id: 'a1', pluginId: '10021', name: 'X-Frame-Options Header Not Set', risk: 'Medium', confidence: 'High', description: 'X-Frame-Options header is not included in the HTTP response to protect against Clickjacking attacks.', url: 'https://api.example.com/login', method: 'GET', solution: 'Add X-Frame-Options header with value DENY or SAMEORIGIN.', cweId: 1021 },
        { id: 'a2', pluginId: '10038', name: 'Content Security Policy (CSP) Header Not Set', risk: 'Medium', confidence: 'High', description: 'CSP header is not set which helps prevent XSS attacks.', url: 'https://api.example.com/', method: 'GET', solution: 'Implement a Content Security Policy header.', cweId: 693 },
        { id: 'a3', pluginId: '10096', name: 'Timestamp Disclosure', risk: 'Low', confidence: 'Low', description: 'Server timestamp disclosed in response.', url: 'https://api.example.com/health', method: 'GET', solution: 'Remove timestamps from responses or encrypt them.', cweId: 200 },
        { id: 'a4', pluginId: '40012', name: 'Cross Site Scripting (Reflected)', risk: 'High', confidence: 'Medium', description: 'Reflected XSS vulnerability found in search parameter.', url: 'https://api.example.com/search?q=test', method: 'GET', param: 'q', attack: '<script>alert(1)</script>', evidence: '<script>alert(1)</script>', solution: 'Sanitize and encode all user inputs.', cweId: 79 },
        { id: 'a5', pluginId: '90033', name: 'Loosely Scoped Cookie', risk: 'Informational', confidence: 'High', description: 'Cookies set without the Secure flag.', url: 'https://api.example.com/auth', method: 'POST', solution: 'Set Secure flag on all cookies.', cweId: 614 },
      ],
      summary: { total: 5, byRisk: { high: 1, medium: 2, low: 1, informational: 1 } },
    },
    {
      id: 'scan_002',
      targetUrl: 'https://api.example.com',
      scanProfile: 'full',
      status: 'completed',
      startedAt: '2025-01-12T08:00:00Z',
      completedAt: '2025-01-12T09:45:00Z',
      alerts: [
        { id: 'a6', pluginId: '10038', name: 'Content Security Policy (CSP) Header Not Set', risk: 'Medium', confidence: 'High', description: 'CSP header is not set which helps prevent XSS attacks.', url: 'https://api.example.com/', method: 'GET', solution: 'Implement a Content Security Policy header.', cweId: 693 },
        { id: 'a7', pluginId: '10096', name: 'Timestamp Disclosure', risk: 'Low', confidence: 'Low', description: 'Server timestamp disclosed in response.', url: 'https://api.example.com/health', method: 'GET', solution: 'Remove timestamps from responses or encrypt them.', cweId: 200 },
        { id: 'a8', pluginId: '90033', name: 'Loosely Scoped Cookie', risk: 'Informational', confidence: 'High', description: 'Cookies set without the Secure flag.', url: 'https://api.example.com/auth', method: 'POST', solution: 'Set Secure flag on all cookies.', cweId: 614 },
        { id: 'a9', pluginId: '10020', name: 'X-Content-Type-Options Header Missing', risk: 'Low', confidence: 'Medium', description: 'X-Content-Type-Options header is missing.', url: 'https://api.example.com/api/data', method: 'GET', solution: 'Add X-Content-Type-Options header with value nosniff.', cweId: 693 },
      ],
      summary: { total: 4, byRisk: { high: 0, medium: 1, low: 2, informational: 1 } },
    },
    {
      id: 'scan_003',
      targetUrl: 'https://api.example.com',
      scanProfile: 'api',
      status: 'completed',
      startedAt: '2025-01-14T10:00:00Z',
      completedAt: '2025-01-14T11:15:00Z',
      alerts: [
        { id: 'a10', pluginId: '10038', name: 'Content Security Policy (CSP) Header Not Set', risk: 'Medium', confidence: 'High', description: 'CSP header is not set which helps prevent XSS attacks.', url: 'https://api.example.com/', method: 'GET', solution: 'Implement a Content Security Policy header.', cweId: 693 },
        { id: 'a11', pluginId: '90033', name: 'Loosely Scoped Cookie', risk: 'Informational', confidence: 'High', description: 'Cookies set without the Secure flag.', url: 'https://api.example.com/auth', method: 'POST', solution: 'Set Secure flag on all cookies.', cweId: 614 },
        { id: 'a12', pluginId: '40018', name: 'SQL Injection', risk: 'High', confidence: 'Medium', description: 'SQL injection vulnerability detected in user_id parameter.', url: 'https://api.example.com/users', method: 'GET', param: 'user_id', attack: "1' OR '1'='1", evidence: 'Database error message disclosed', solution: 'Use parameterized queries and input validation.', cweId: 89 },
      ],
      summary: { total: 3, byRisk: { high: 1, medium: 1, low: 0, informational: 1 } },
    },
  ];

  // Load from URL params if present
  useEffect(() => {
    const s1 = searchParams.get('scan1');
    const s2 = searchParams.get('scan2');
    if (s1) setSelectedScan1(s1);
    if (s2) setSelectedScan2(s2);
  }, [searchParams]);

  const compareScans = async () => {
    if (!selectedScan1 || !selectedScan2 || selectedScan1 === selectedScan2) return;

    setIsComparing(true);

    // Simulate API call
    await new Promise(r => setTimeout(r, 1500));

    const scan1 = availableScans.find(s => s.id === selectedScan1)!;
    const scan2 = availableScans.find(s => s.id === selectedScan2)!;

    // Compare alerts by pluginId and url to determine new/fixed/unchanged
    const scan1AlertKeys = new Set(scan1.alerts.map(a => `${a.pluginId}-${a.url}`));
    const scan2AlertKeys = new Set(scan2.alerts.map(a => `${a.pluginId}-${a.url}`));

    const newFindings = scan2.alerts.filter(a => !scan1AlertKeys.has(`${a.pluginId}-${a.url}`));
    const fixedFindings = scan1.alerts.filter(a => !scan2AlertKeys.has(`${a.pluginId}-${a.url}`));
    const unchangedFindings = scan2.alerts.filter(a => scan1AlertKeys.has(`${a.pluginId}-${a.url}`));

    // Calculate risk delta
    const riskDelta = {
      high: scan2.summary.byRisk.high - scan1.summary.byRisk.high,
      medium: scan2.summary.byRisk.medium - scan1.summary.byRisk.medium,
      low: scan2.summary.byRisk.low - scan1.summary.byRisk.low,
      informational: scan2.summary.byRisk.informational - scan1.summary.byRisk.informational,
    };

    const overallImprovement = fixedFindings.length > newFindings.length ||
      (riskDelta.high < 0 && newFindings.filter(f => f.risk === 'High').length === 0);

    setComparisonResult({
      scan1,
      scan2,
      newFindings,
      fixedFindings,
      unchangedFindings,
      summary: {
        totalNew: newFindings.length,
        totalFixed: fixedFindings.length,
        totalUnchanged: unchangedFindings.length,
        riskDelta,
        overallImprovement,
      },
    });

    setIsComparing(false);
    setActiveTab('new');
  };

  const getRiskColor = (risk: DASTCompareRisk) => {
    switch (risk) {
      case 'High': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'Medium': return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'Low': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'Informational': return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const renderAlertCard = (alert: DASTCompareAlert, status: 'new' | 'fixed' | 'unchanged') => (
    <div key={alert.id} className={`p-4 rounded-lg border ${
      status === 'new' ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' :
      status === 'fixed' ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' :
      'border-border bg-card'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(alert.risk)}`}>
            {alert.risk}
          </span>
          {status === 'new' && (
            <span className="px-2 py-0.5 rounded text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30">
              NEW
            </span>
          )}
          {status === 'fixed' && (
            <span className="px-2 py-0.5 rounded text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30">
              FIXED
            </span>
          )}
        </div>
        {alert.cweId && (
          <span className="text-xs text-muted-foreground">CWE-{alert.cweId}</span>
        )}
      </div>
      <h4 className="font-medium text-foreground mb-1">{alert.name}</h4>
      <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
      <div className="text-xs text-muted-foreground space-y-1">
        <p><span className="font-medium">URL:</span> {alert.url}</p>
        <p><span className="font-medium">Method:</span> {alert.method}</p>
        {alert.param && <p><span className="font-medium">Parameter:</span> {alert.param}</p>}
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs font-medium text-foreground mb-1">Solution:</p>
        <p className="text-xs text-muted-foreground">{alert.solution}</p>
      </div>
    </div>
  );

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
                This feature demonstrates DAST scan comparison with simulated findings.
                Real ZAP/OWASP integration will be available in a future release.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/security')} className="text-muted-foreground hover:text-foreground">
              &larr;
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">DAST Scan Comparison</h1>
              <p className="text-muted-foreground">Compare findings between two security scans</p>
            </div>
          </div>
        </div>

        {/* Scan Selection */}
        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Select Scans to Compare</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scan 1 (Earlier/Before) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                First Scan (Before)
              </label>
              <select
                value={selectedScan1}
                onChange={(e) => setSelectedScan1(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
              >
                <option value="">Select a scan...</option>
                {availableScans.map((scan) => (
                  <option key={scan.id} value={scan.id} disabled={scan.id === selectedScan2}>
                    {new Date(scan.startedAt).toLocaleDateString()} - {scan.scanProfile} scan ({scan.summary.total} findings)
                  </option>
                ))}
              </select>
              {selectedScan1 && (
                <div className="mt-2 p-3 rounded bg-muted/30 text-sm">
                  <p className="font-medium text-foreground">{availableScans.find(s => s.id === selectedScan1)?.targetUrl}</p>
                  <p className="text-muted-foreground">
                    {availableScans.find(s => s.id === selectedScan1)?.summary.byRisk.high || 0} High {' '}
                    {availableScans.find(s => s.id === selectedScan1)?.summary.byRisk.medium || 0} Medium {' '}
                    {availableScans.find(s => s.id === selectedScan1)?.summary.byRisk.low || 0} Low
                  </p>
                </div>
              )}
            </div>

            {/* Scan 2 (Later/After) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Second Scan (After)
              </label>
              <select
                value={selectedScan2}
                onChange={(e) => setSelectedScan2(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
              >
                <option value="">Select a scan...</option>
                {availableScans.map((scan) => (
                  <option key={scan.id} value={scan.id} disabled={scan.id === selectedScan1}>
                    {new Date(scan.startedAt).toLocaleDateString()} - {scan.scanProfile} scan ({scan.summary.total} findings)
                  </option>
                ))}
              </select>
              {selectedScan2 && (
                <div className="mt-2 p-3 rounded bg-muted/30 text-sm">
                  <p className="font-medium text-foreground">{availableScans.find(s => s.id === selectedScan2)?.targetUrl}</p>
                  <p className="text-muted-foreground">
                    {availableScans.find(s => s.id === selectedScan2)?.summary.byRisk.high || 0} High {' '}
                    {availableScans.find(s => s.id === selectedScan2)?.summary.byRisk.medium || 0} Medium {' '}
                    {availableScans.find(s => s.id === selectedScan2)?.summary.byRisk.low || 0} Low
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              onClick={compareScans}
              disabled={!selectedScan1 || !selectedScan2 || selectedScan1 === selectedScan2 || isComparing}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isComparing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isComparing ? 'Comparing...' : 'Compare Scans'}
            </button>
          </div>
        </div>

        {/* Comparison Results */}
        {comparisonResult && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className={`rounded-lg border p-4 ${
                comparisonResult.summary.overallImprovement
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20'
                  : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{comparisonResult.summary.overallImprovement ? '📈' : '📉'}</span>
                  <span className="text-sm font-medium text-foreground">Overall Status</span>
                </div>
                <p className={`text-lg font-bold ${comparisonResult.summary.overallImprovement ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {comparisonResult.summary.overallImprovement ? 'Improved' : 'Needs Attention'}
                </p>
              </div>

              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🆕</span>
                  <span className="text-sm font-medium text-foreground">New Findings</span>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{comparisonResult.summary.totalNew}</p>
              </div>

              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">✅</span>
                  <span className="text-sm font-medium text-foreground">Fixed Findings</span>
                </div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{comparisonResult.summary.totalFixed}</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">➡️</span>
                  <span className="text-sm font-medium text-foreground">Unchanged</span>
                </div>
                <p className="text-2xl font-bold text-muted-foreground">{comparisonResult.summary.totalUnchanged}</p>
              </div>
            </div>

            {/* Risk Delta */}
            <div className="rounded-lg border border-border bg-card p-4 mb-6">
              <h3 className="font-medium text-foreground mb-3">Risk Level Changes</h3>
              <div className="flex flex-wrap gap-4">
                {(['high', 'medium', 'low', 'informational'] as const).map((risk) => {
                  const delta = comparisonResult.summary.riskDelta[risk];
                  const isImproved = delta < 0;
                  const isWorse = delta > 0;
                  return (
                    <div key={risk} className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(risk.charAt(0).toUpperCase() + risk.slice(1) as DASTCompareRisk)}`}>
                        {risk.charAt(0).toUpperCase() + risk.slice(1)}
                      </span>
                      <span className={`font-medium ${isImproved ? 'text-green-600' : isWorse ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                      {isImproved && <span className="text-green-600">↓</span>}
                      {isWorse && <span className="text-red-600">↑</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabs for Findings */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab('new')}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${
                    activeTab === 'new'
                      ? 'text-red-600 dark:text-red-400 border-b-2 border-red-500'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  New Findings ({comparisonResult.newFindings.length})
                </button>
                <button
                  onClick={() => setActiveTab('fixed')}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${
                    activeTab === 'fixed'
                      ? 'text-green-600 dark:text-green-400 border-b-2 border-green-500'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Fixed Findings ({comparisonResult.fixedFindings.length})
                </button>
                <button
                  onClick={() => setActiveTab('unchanged')}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${
                    activeTab === 'unchanged'
                      ? 'text-foreground border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Unchanged ({comparisonResult.unchangedFindings.length})
                </button>
              </div>

              <div className="p-4">
                {activeTab === 'new' && (
                  <div className="space-y-4">
                    {comparisonResult.newFindings.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-4xl mb-2">🎉</p>
                        <p>No new vulnerabilities found!</p>
                      </div>
                    ) : (
                      comparisonResult.newFindings.map(alert => renderAlertCard(alert, 'new'))
                    )}
                  </div>
                )}

                {activeTab === 'fixed' && (
                  <div className="space-y-4">
                    {comparisonResult.fixedFindings.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-4xl mb-2">📋</p>
                        <p>No vulnerabilities were fixed between these scans.</p>
                      </div>
                    ) : (
                      comparisonResult.fixedFindings.map(alert => renderAlertCard(alert, 'fixed'))
                    )}
                  </div>
                )}

                {activeTab === 'unchanged' && (
                  <div className="space-y-4">
                    {comparisonResult.unchangedFindings.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-4xl mb-2">✨</p>
                        <p>All findings have changed between scans!</p>
                      </div>
                    ) : (
                      comparisonResult.unchangedFindings.map(alert => renderAlertCard(alert, 'unchanged'))
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!comparisonResult && !isComparing && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
            <p className="text-4xl mb-4">🔐</p>
            <p className="text-lg font-medium text-foreground mb-2">Select two scans to compare</p>
            <p className="text-muted-foreground">
              Compare DAST scan results to track which vulnerabilities have been fixed, which are new, and which remain unchanged.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
