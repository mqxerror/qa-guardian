// Feature #771: Auto-PR for Dependency Updates Page
// Extracted from App.tsx as part of Feature #1441

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../stores/toastStore';

// Feature #771: Auto-PR for Dependency Updates interfaces
interface AutoPRConfig {
  enabled: boolean;
  auto_merge_patch: boolean;
  auto_merge_minor: boolean;
  require_tests_pass: boolean;
  include_changelog: boolean;
  assignees: string[];
  labels: string[];
  branch_prefix: string;
  schedule: 'immediate' | 'daily' | 'weekly';
  max_prs_per_day: number;
}

interface AutoPR {
  id: string;
  project_id: string;
  project_name: string;
  dependency_name: string;
  current_version: string;
  target_version: string;
  update_type: 'patch' | 'minor' | 'major';
  vulnerability?: {
    cve_id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
  };
  pr_number?: number;
  pr_url?: string;
  pr_title: string;
  pr_body: string;
  branch_name: string;
  status: 'pending' | 'created' | 'merged' | 'closed' | 'failed';
  changelog?: string;
  tests_status?: 'pending' | 'running' | 'passed' | 'failed';
  created_at: string;
  updated_at: string;
  merged_at?: string;
}

export function AutoPRPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Config state
  const [config, setConfig] = useState<AutoPRConfig>({
    enabled: false,
    auto_merge_patch: false,
    auto_merge_minor: false,
    require_tests_pass: true,
    include_changelog: true,
    assignees: [],
    labels: ['dependencies', 'security'],
    branch_prefix: 'deps/',
    schedule: 'immediate',
    max_prs_per_day: 10,
  });
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // PRs state
  const [prs, setPrs] = useState<AutoPR[]>([]);
  const [prSummary, setPrSummary] = useState({
    total: 0,
    pending: 0,
    created: 0,
    merged: 0,
    closed: 0,
    failed: 0,
  });
  const [isLoadingPRs, setIsLoadingPRs] = useState(true);
  const [expandedPR, setExpandedPR] = useState<string | null>(null);

  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    prs_created: AutoPR[];
    total_scanned: number;
  } | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'created' | 'merged' | 'closed' | 'failed'>('all');

  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/v1/organization/auto-pr/config', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setConfig(data.config);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    loadConfig();
  }, [token]);

  // Load PRs
  useEffect(() => {
    const loadPRs = async () => {
      try {
        const response = await fetch('/api/v1/organization/auto-pr', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setPrs(data.prs || []);
          setPrSummary(data.summary);
        }
      } catch (error) {
        console.error('Failed to load PRs:', error);
      } finally {
        setIsLoadingPRs(false);
      }
    };
    loadPRs();
  }, [token]);

  // Save config
  const saveConfig = async (updates: Partial<AutoPRConfig>) => {
    setIsSavingConfig(true);
    try {
      const response = await fetch('/api/v1/organization/auto-pr/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        toast.success(data.message);
      }
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Scan and create PRs
  const handleScanAndCreate = async () => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const response = await fetch('/api/v1/organization/auto-pr/scan-and-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ project_id: 'demo-project' }),
      });
      if (response.ok) {
        const data = await response.json();
        setScanResult(data);
        // Reload PRs
        const prsResponse = await fetch('/api/v1/organization/auto-pr', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (prsResponse.ok) {
          const prsData = await prsResponse.json();
          setPrs(prsData.prs || []);
          setPrSummary(prsData.summary);
        }
        toast.success(data.message);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to scan');
      }
    } catch (error) {
      toast.error('Failed to scan and create PRs');
    } finally {
      setIsScanning(false);
    }
  };

  // Update PR status (merge/close)
  const updatePRStatus = async (prId: string, status: 'merged' | 'closed', testsStatus?: 'passed' | 'failed') => {
    try {
      const response = await fetch(`/api/v1/organization/auto-pr/${prId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status, tests_status: testsStatus }),
      });
      if (response.ok) {
        const data = await response.json();
        setPrs(prs.map(pr => pr.id === prId ? data.pr : pr));
        toast.success(`PR ${status}`);
      }
    } catch (error) {
      toast.error('Failed to update PR');
    }
  };

  // Filter PRs
  const filteredPRs = prs.filter(pr =>
    statusFilter === 'all' || pr.status === statusFilter
  );

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-gray-600 bg-gray-100';
      case 'created': return 'text-blue-600 bg-blue-100';
      case 'merged': return 'text-green-600 bg-green-100';
      case 'closed': return 'text-gray-600 bg-gray-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTestStatusIcon = (status?: string) => {
    switch (status) {
      case 'passed': return '\u2713';
      case 'failed': return '\u2717';
      case 'running': return '\u27F3';
      case 'pending': return '\u25CB';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/security')} className="text-gray-500 hover:text-gray-700">
              &#8592; Back to Security
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Auto-PR for Dependency Updates</h1>
              <p className="text-gray-500">Automatically create PRs to update vulnerable dependencies</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleScanAndCreate}
              disabled={!config.enabled || isScanning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isScanning ? 'Scanning...' : 'Scan & Create PRs'}
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Total PRs</div>
            <div className="text-2xl font-bold text-gray-900">{prSummary.total}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Pending</div>
            <div className="text-2xl font-bold text-gray-600">{prSummary.pending}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Created</div>
            <div className="text-2xl font-bold text-blue-600">{prSummary.created}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Merged</div>
            <div className="text-2xl font-bold text-green-600">{prSummary.merged}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Closed</div>
            <div className="text-2xl font-bold text-gray-500">{prSummary.closed}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Failed</div>
            <div className="text-2xl font-bold text-red-600">{prSummary.failed}</div>
          </div>
        </div>

        {/* Configuration Section */}
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Auto-PR Configuration</h2>
          </div>
          <div className="p-6">
            {isLoadingConfig ? (
              <div className="text-center py-4 text-gray-500">Loading configuration...</div>
            ) : (
              <div className="space-y-6">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Enable Auto-PR</div>
                    <div className="text-sm text-gray-500">Automatically create PRs for vulnerable dependencies</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => saveConfig({ enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Auto-merge options */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto-merge Patch Updates</div>
                      <div className="text-sm text-gray-500">Automatically merge patch version updates</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.auto_merge_patch}
                        onChange={(e) => saveConfig({ auto_merge_patch: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto-merge Minor Updates</div>
                      <div className="text-sm text-gray-500">Automatically merge minor version updates</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.auto_merge_minor}
                        onChange={(e) => saveConfig({ auto_merge_minor: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* Other options */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Require Tests to Pass</div>
                      <div className="text-sm text-gray-500">Only merge after tests pass</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.require_tests_pass}
                        onChange={(e) => saveConfig({ require_tests_pass: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Include Changelog</div>
                      <div className="text-sm text-gray-500">Add changelog to PR description</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.include_changelog}
                        onChange={(e) => saveConfig({ include_changelog: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* Schedule */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                  <select
                    value={config.schedule}
                    onChange={(e) => saveConfig({ schedule: e.target.value as AutoPRConfig['schedule'] })}
                    className="w-full max-w-xs px-3 py-2 border rounded-lg"
                  >
                    <option value="immediate">Immediate</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scan Result */}
        {scanResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="font-semibold text-green-800">Scan Complete</div>
            <div className="text-sm text-green-600">
              Scanned {scanResult.total_scanned} dependencies, created {scanResult.prs_created.length} PR(s)
            </div>
          </div>
        )}

        {/* PRs List */}
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Auto-Generated PRs</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="created">Created</option>
              <option value="merged">Merged</option>
              <option value="closed">Closed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="p-6">
            {isLoadingPRs ? (
              <div className="text-center py-8 text-gray-500">Loading PRs...</div>
            ) : filteredPRs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No auto-PRs yet. {config.enabled ? 'Click "Scan & Create PRs" to get started.' : 'Enable Auto-PR first.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPRs.map(pr => (
                  <div key={pr.id} className="border rounded-lg overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedPR(expandedPR === pr.id ? null : pr.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pr.status)}`}>
                            {pr.status.toUpperCase()}
                          </span>
                          <div>
                            <div className="font-medium text-gray-900">
                              {pr.dependency_name} {pr.current_version} &#8594; {pr.target_version}
                            </div>
                            <div className="text-sm text-gray-500">
                              {pr.project_name} &bull; PR #{pr.pr_number} &bull; {pr.update_type} update
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {pr.vulnerability && (
                            <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(pr.vulnerability.severity)}`}>
                              {pr.vulnerability.cve_id}
                            </span>
                          )}
                          {pr.tests_status && (
                            <span className={`text-sm ${pr.tests_status === 'passed' ? 'text-green-600' : pr.tests_status === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>
                              Tests: {getTestStatusIcon(pr.tests_status)} {pr.tests_status}
                            </span>
                          )}
                          <span className="text-gray-400">{expandedPR === pr.id ? '\u25BC' : '\u25B6'}</span>
                        </div>
                      </div>
                    </div>
                    {expandedPR === pr.id && (
                      <div className="border-t bg-gray-50 p-4">
                        <div className="space-y-3">
                          <div>
                            <div className="text-sm font-medium text-gray-700">PR Title</div>
                            <div className="text-sm text-gray-600">{pr.pr_title}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-700">Branch</div>
                            <div className="text-sm font-mono text-gray-600">{pr.branch_name}</div>
                          </div>
                          {pr.vulnerability && (
                            <div>
                              <div className="text-sm font-medium text-gray-700">Security Fix</div>
                              <div className="text-sm text-gray-600">
                                <span className={`inline-block px-2 py-0.5 rounded mr-2 ${getSeverityColor(pr.vulnerability.severity)}`}>
                                  {pr.vulnerability.severity}
                                </span>
                                {pr.vulnerability.title}
                              </div>
                            </div>
                          )}
                          {pr.changelog && (
                            <div>
                              <div className="text-sm font-medium text-gray-700">Changelog</div>
                              <pre className="text-xs text-gray-600 bg-white p-2 rounded border mt-1 overflow-auto max-h-32">
                                {pr.changelog}
                              </pre>
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            Created: {new Date(pr.created_at).toLocaleString()}
                            {pr.merged_at && ` \u2022 Merged: ${new Date(pr.merged_at).toLocaleString()}`}
                          </div>
                          {pr.status === 'created' && (
                            <div className="flex space-x-2 pt-2">
                              <button
                                onClick={() => updatePRStatus(pr.id, 'merged', 'passed')}
                                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                              >
                                Merge
                              </button>
                              <button
                                onClick={() => updatePRStatus(pr.id, 'closed')}
                                className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                              >
                                Close
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
