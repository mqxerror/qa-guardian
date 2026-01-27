// MultiLanguageDependencyPage - extracted from App.tsx
// Feature #773: Multi-language Dependency Support
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Type definitions for multi-language dependency scanning
interface LanguageScanConfig {
  language: 'javascript' | 'python' | 'java' | 'go' | 'rust';
  enabled: boolean;
  manifest_files: string[];
  lock_files: string[];
  registries: string[];
}

interface MultiLanguageScanConfig {
  organization_id: string;
  enabled_languages: LanguageScanConfig[];
  scan_dev_dependencies: boolean;
  scan_transitive: boolean;
  auto_detect_languages: boolean;
  parallel_scanning: boolean;
  cache_duration_hours: number;
}

interface LanguageDependency {
  id: string;
  project_id: string;
  language: 'javascript' | 'python' | 'java' | 'go' | 'rust';
  name: string;
  current_version: string;
  latest_version: string;
  license?: string;
  is_dev: boolean;
  is_transitive: boolean;
  depth: number;
  parent_package?: string;
  registry: string;
  vulnerabilities: Array<{
    id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    fixed_version?: string;
  }>;
  last_scanned_at: string;
}

interface LanguageScanResult {
  project_id: string;
  language: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  total_dependencies: number;
  direct_dependencies: number;
  transitive_dependencies: number;
  vulnerabilities_found: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export function MultiLanguageDependencyPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [config, setConfig] = useState<MultiLanguageScanConfig | null>(null);
  const [dependencies, setDependencies] = useState<Record<string, LanguageDependency[]>>({});
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('proj-1');
  const [scanResults, setScanResults] = useState<LanguageScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [includeTransitive, setIncludeTransitive] = useState(true);
  const [includeDev, setIncludeDev] = useState(false);

  useEffect(() => {
    // Load config
    fetch('/api/v1/organization/multi-language/config', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setConfig)
      .catch(console.error);

    // Load stats
    fetch('/api/v1/organization/multi-language/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error);

    // Load all dependencies
    fetch(`/api/v1/projects/${selectedProject}/all-dependencies`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setDependencies(data.dependencies_by_language || {}))
      .catch(console.error);
  }, [token, selectedProject]);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch(`/api/v1/projects/${selectedProject}/multi-language-scan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ languages: ['javascript', 'python', 'java', 'go', 'rust'] }),
      });
      const data = await res.json();
      setScanResults(data.results);

      // Poll for results
      const pollResults = async (scanId: string) => {
        const statusRes = await fetch(`/api/v1/scans/${scanId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const statusData = await statusRes.json();
        setScanResults(statusData.results);

        if (statusData.status !== 'completed' && statusData.status !== 'completed_with_errors') {
          setTimeout(() => pollResults(scanId), 1000);
        } else {
          setIsScanning(false);
          // Reload dependencies
          const depsRes = await fetch(`/api/v1/projects/${selectedProject}/all-dependencies`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const depsData = await depsRes.json();
          setDependencies(depsData.dependencies_by_language || {});
        }
      };

      setTimeout(() => pollResults(data.scan_id), 500);
    } catch (error) {
      console.error(error);
      setIsScanning(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      await fetch('/api/v1/organization/multi-language/config', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      setShowConfigModal(false);
    } catch (error) {
      console.error(error);
    }
  };

  const languageIcons: Record<string, string> = {
    javascript: '\u{1F4E6}',
    python: '\u{1F40D}',
    java: '\u2615',
    go: '\u{1F439}',
    rust: '\u{1F980}',
  };

  const languageColors: Record<string, string> = {
    javascript: 'bg-yellow-100 text-yellow-800',
    python: 'bg-blue-100 text-blue-800',
    java: 'bg-orange-100 text-orange-800',
    go: 'bg-cyan-100 text-cyan-800',
    rust: 'bg-red-100 text-red-800',
  };

  // Filter dependencies
  let filteredDeps: LanguageDependency[] = [];
  if (selectedLanguage === 'all') {
    filteredDeps = Object.values(dependencies).flat();
  } else if (dependencies[selectedLanguage]) {
    filteredDeps = dependencies[selectedLanguage];
  }

  if (!includeTransitive) {
    filteredDeps = filteredDeps.filter((d) => !d.is_transitive);
  }
  if (!includeDev) {
    filteredDeps = filteredDeps.filter((d) => !d.is_dev);
  }

  // Summary stats
  const summaryByLanguage: Record<string, { total: number; vulnerable: number }> = {};
  Object.entries(dependencies).forEach(([lang, deps]) => {
    summaryByLanguage[lang] = {
      total: deps.length,
      vulnerable: deps.filter((d) => d.vulnerabilities.length > 0).length,
    };
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/security')}
            className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
          >
            &#8592; Back to Security
          </button>
          <h1 className="text-2xl font-bold">Multi-Language Dependencies</h1>
          <p className="text-gray-600">Scan and analyze dependencies across npm, pip, maven, go modules, and cargo</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            &#9881;&#65039; Configure
          </button>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isScanning ? '\u{1F504} Scanning...' : '\u{1F50D} Scan All Languages'}
          </button>
        </div>
      </div>

      {/* Language Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {['javascript', 'python', 'java', 'go', 'rust'].map((lang) => {
          const langConfig = config?.enabled_languages?.find((l) => l.language === lang);
          const langSummary = summaryByLanguage[lang] || { total: 0, vulnerable: 0 };
          const scanResult = scanResults.find((r) => r.language === lang);

          return (
            <div
              key={lang}
              className={`p-4 rounded-lg border ${
                selectedLanguage === lang ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              } cursor-pointer hover:border-blue-300 transition-colors`}
              onClick={() => setSelectedLanguage(lang === selectedLanguage ? 'all' : lang)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{languageIcons[lang]}</span>
                {langConfig?.enabled ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">Enabled</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Disabled</span>
                )}
              </div>
              <h3 className="font-medium capitalize">{lang}</h3>
              <div className="mt-2 text-sm text-gray-600">
                <div>{langSummary.total} packages</div>
                {langSummary.vulnerable > 0 && (
                  <div className="text-red-600">{langSummary.vulnerable} vulnerable</div>
                )}
              </div>
              {scanResult && (
                <div className="mt-2">
                  {scanResult.status === 'completed' ? (
                    <span className="text-xs text-green-600">&#10003; Scanned</span>
                  ) : scanResult.status === 'pending' || scanResult.status === 'scanning' ? (
                    <span className="text-xs text-blue-600">&#9203; Scanning...</span>
                  ) : (
                    <span className="text-xs text-red-600">&#10007; Failed</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 mb-4">
        <div>
          <label className="text-sm text-gray-600 mr-2">Language:</label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="border rounded px-3 py-1.5"
          >
            <option value="all">All Languages</option>
            <option value="javascript">JavaScript (npm)</option>
            <option value="python">Python (pip)</option>
            <option value="java">Java (maven)</option>
            <option value="go">Go (modules)</option>
            <option value="rust">Rust (cargo)</option>
          </select>
        </div>
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={includeTransitive}
            onChange={(e) => setIncludeTransitive(e.target.checked)}
            className="mr-2"
          />
          Include transitive
        </label>
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={includeDev}
            onChange={(e) => setIncludeDev(e.target.checked)}
            className="mr-2"
          />
          Include dev dependencies
        </label>
        <div className="ml-auto text-sm text-gray-600">
          Showing {filteredDeps.length} dependencies
        </div>
      </div>

      {/* Dependencies Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Package</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Language</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Version</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Latest</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">License</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Vulnerabilities</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeps.slice(0, 50).map((dep) => (
              <tr key={dep.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    <span className="mr-2">{languageIcons[dep.language]}</span>
                    <div>
                      <div className="font-medium">{dep.name}</div>
                      {dep.is_transitive && dep.parent_package && (
                        <div className="text-xs text-gray-500">via {dep.parent_package}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded ${languageColors[dep.language]}`}>
                    {dep.language}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm">{dep.current_version}</td>
                <td className="px-4 py-3 font-mono text-sm">
                  {dep.latest_version !== dep.current_version ? (
                    <span className="text-orange-600">{dep.latest_version}</span>
                  ) : (
                    <span className="text-green-600">{dep.latest_version}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{dep.license || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex space-x-1">
                    {dep.is_dev && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">dev</span>
                    )}
                    {dep.is_transitive ? (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">transitive</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">direct</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {dep.vulnerabilities.length > 0 ? (
                    <div className="flex items-center">
                      <span className="text-red-600 font-medium">{dep.vulnerabilities.length}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({dep.vulnerabilities.map((v) => v.severity).join(', ')})
                      </span>
                    </div>
                  ) : (
                    <span className="text-green-600">&#10003; None</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredDeps.length > 50 && (
          <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 text-center">
            Showing 50 of {filteredDeps.length} dependencies
          </div>
        )}
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="mt-6 bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-3">Organization Statistics</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{stats.summary?.total_dependencies || 0}</div>
              <div className="text-sm text-gray-600">Total Dependencies</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{stats.summary?.total_vulnerabilities || 0}</div>
              <div className="text-sm text-gray-600">Vulnerabilities</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.summary?.languages_tracked || 5}</div>
              <div className="text-sm text-gray-600">Languages Tracked</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.summary?.projects_scanned || 0}</div>
              <div className="text-sm text-gray-600">Projects Scanned</div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && config && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Multi-Language Scan Configuration</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Language toggles */}
              <div>
                <h3 className="font-medium mb-2">Enabled Languages</h3>
                <div className="space-y-2">
                  {config.enabled_languages.map((langConfig, idx) => (
                    <div key={langConfig.language} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center">
                        <span className="mr-2">{languageIcons[langConfig.language]}</span>
                        <span className="capitalize font-medium">{langConfig.language}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({langConfig.manifest_files.join(', ')})
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={langConfig.enabled}
                        onChange={(e) => {
                          const updated = [...config.enabled_languages];
                          updated[idx] = { ...updated[idx], enabled: e.target.checked };
                          setConfig({ ...config, enabled_languages: updated });
                        }}
                        className="h-4 w-4"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Scan Dev Dependencies</div>
                    <div className="text-sm text-gray-500">Include devDependencies, dev-requires, etc.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.scan_dev_dependencies}
                    onChange={(e) => setConfig({ ...config, scan_dev_dependencies: e.target.checked })}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Scan Transitive Dependencies</div>
                    <div className="text-sm text-gray-500">Include indirect dependencies</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.scan_transitive}
                    onChange={(e) => setConfig({ ...config, scan_transitive: e.target.checked })}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Auto-detect Languages</div>
                    <div className="text-sm text-gray-500">Automatically detect languages in projects</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.auto_detect_languages}
                    onChange={(e) => setConfig({ ...config, auto_detect_languages: e.target.checked })}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Parallel Scanning</div>
                    <div className="text-sm text-gray-500">Scan multiple languages simultaneously</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.parallel_scanning}
                    onChange={(e) => setConfig({ ...config, parallel_scanning: e.target.checked })}
                    className="h-4 w-4"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cache Duration (hours)
                  </label>
                  <input
                    type="number"
                    value={config.cache_duration_hours}
                    onChange={(e) => setConfig({ ...config, cache_duration_hours: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min={1}
                    max={168}
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
