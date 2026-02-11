// MultiLanguageDependencyPage - extracted from App.tsx
// Feature #773: Multi-language Dependency Support
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { RefreshCw, Settings, Check, X, AlertTriangle, Clock } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';

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
  const { token } = useAuthStore();

  const [config, setConfig] = useState<MultiLanguageScanConfig | null>(null);
  const [dependencies, setDependencies] = useState<Record<string, LanguageDependency[]>>({});
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [scanResults, setScanResults] = useState<LanguageScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [includeTransitive, setIncludeTransitive] = useState(true);
  const [includeDev, setIncludeDev] = useState(false);

  // Load projects list first
  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/projects', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const projectList = Array.isArray(data) ? data : data.projects || [];
        setProjects(projectList);
        if (projectList.length > 0 && !selectedProject) {
          setSelectedProject(projectList[0].id);
        }
      })
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedProject) return;

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
    javascript: 'bg-warning/20 text-warning',
    python: 'bg-primary/20 text-primary',
    java: 'bg-warning/20 text-warning',
    go: 'bg-info/20 text-info',
    rust: 'bg-destructive/20 text-destructive',
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
    <Layout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Feature #639: PageHeader component */}
        <PageHeader
          title="Multi-Language Dependencies"
          description="Scan and analyze dependencies across npm, pip, maven, go modules, and cargo"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'Multi-Language Dependencies' }]}
          actions={
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfigModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Settings className="h-4 w-4" />
                Configure
              </button>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scanning...' : 'Scan All Languages'}
              </button>
            </div>
          }
        />

        {/* Language Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {['javascript', 'python', 'java', 'go', 'rust'].map((lang) => {
            const langConfig = config?.enabled_languages?.find((l) => l.language === lang);
            const langSummary = summaryByLanguage[lang] || { total: 0, vulnerable: 0 };
            const scanResult = scanResults.find((r) => r.language === lang);

            return (
              <div
                key={lang}
                className={`p-4 rounded-lg border ${
                  selectedLanguage === lang ? 'border-primary bg-primary/10' : 'border-border bg-card'
                } cursor-pointer hover:border-primary/50 transition-colors`}
                onClick={() => setSelectedLanguage(lang === selectedLanguage ? 'all' : lang)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{languageIcons[lang]}</span>
                  {langConfig?.enabled ? (
                    <span className="text-xs px-2 py-0.5 bg-success/20 text-success rounded">Enabled</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">Disabled</span>
                  )}
                </div>
                <h3 className="font-medium text-foreground capitalize">{lang}</h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <div>{langSummary.total} packages</div>
                  {langSummary.vulnerable > 0 && (
                    <div className="text-destructive">{langSummary.vulnerable} vulnerable</div>
                  )}
                </div>
                {scanResult && (
                  <div className="mt-2">
                    {scanResult.status === 'completed' ? (
                      <span className="text-xs text-success flex items-center gap-1"><Check className="h-3 w-3" /> Scanned</span>
                    ) : scanResult.status === 'pending' || scanResult.status === 'scanning' ? (
                      <span className="text-xs text-primary flex items-center gap-1"><Clock className="h-3 w-3" /> Scanning...</span>
                    ) : (
                      <span className="text-xs text-destructive flex items-center gap-1"><X className="h-3 w-3" /> Failed</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Language:</label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="rounded-lg border border-border bg-background text-foreground px-3 py-1.5"
            >
              <option value="all">All Languages</option>
              <option value="javascript">JavaScript (npm)</option>
              <option value="python">Python (pip)</option>
              <option value="java">Java (maven)</option>
              <option value="go">Go (modules)</option>
              <option value="rust">Rust (cargo)</option>
            </select>
          </div>
          <label className="flex items-center text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={includeTransitive}
              onChange={(e) => setIncludeTransitive(e.target.checked)}
              className="mr-2 rounded border-border"
            />
            Include transitive
          </label>
          <label className="flex items-center text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={includeDev}
              onChange={(e) => setIncludeDev(e.target.checked)}
              className="mr-2 rounded border-border"
            />
            Include dev dependencies
          </label>
          <div className="ml-auto text-sm text-muted-foreground">
            Showing {filteredDeps.length} dependencies
          </div>
        </div>

        {/* Dependencies Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Package</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Language</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Version</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Latest</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">License</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Vulnerabilities</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeps.slice(0, 50).map((dep) => (
                <tr key={dep.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span className="mr-2">{languageIcons[dep.language]}</span>
                      <div>
                        <div className="font-medium text-foreground">{dep.name}</div>
                        {dep.is_transitive && dep.parent_package && (
                          <div className="text-xs text-muted-foreground">via {dep.parent_package}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${languageColors[dep.language]}`}>
                      {dep.language}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-foreground">{dep.current_version}</td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {dep.latest_version !== dep.current_version ? (
                      <span className="text-warning">{dep.latest_version}</span>
                    ) : (
                      <span className="text-success">{dep.latest_version}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{dep.license || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {dep.is_dev && (
                        <span className="text-xs px-1.5 py-0.5 bg-accent/20 text-accent rounded">dev</span>
                      )}
                      {dep.is_transitive ? (
                        <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">transitive</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded">direct</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {dep.vulnerabilities.length > 0 ? (
                      <div className="flex items-center">
                        <span className="text-destructive font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {dep.vulnerabilities.length}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({dep.vulnerabilities.map((v) => v.severity).join(', ')})
                        </span>
                      </div>
                    ) : (
                      <span className="text-success flex items-center gap-1"><Check className="h-3 w-3" /> None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDeps.length > 50 && (
            <div className="px-4 py-3 bg-muted/50 text-sm text-muted-foreground text-center border-t border-border">
              Showing 50 of {filteredDeps.length} dependencies
            </div>
          )}
        </div>

        {/* Stats Section */}
        {stats && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-medium text-foreground mb-4">Organization Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-foreground">{stats.summary?.total_dependencies || 0}</div>
                <div className="text-sm text-muted-foreground">Total Dependencies</div>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10">
                <div className="text-2xl font-bold text-destructive">{stats.summary?.total_vulnerabilities || 0}</div>
                <div className="text-sm text-destructive/80">Vulnerabilities</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-foreground">{stats.summary?.languages_tracked || 5}</div>
                <div className="text-sm text-muted-foreground">Languages Tracked</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-foreground">{stats.summary?.projects_scanned || 0}</div>
                <div className="text-sm text-muted-foreground">Projects Scanned</div>
              </div>
            </div>
          </div>
        )}

        {/* Feature #661: Configuration Modal - migrated to shared Modal */}
        {config && (
          <Modal
            isOpen={showConfigModal}
            onClose={() => setShowConfigModal(false)}
            title="Multi-Language Scan Configuration"
            size="lg"
          >
            <ModalHeader onClose={() => setShowConfigModal(false)}>
              Multi-Language Scan Configuration
            </ModalHeader>
            <ModalBody>
              <div className="space-y-6">
                {/* Language toggles */}
                <div>
                  <h3 className="font-medium text-foreground mb-3">Enabled Languages</h3>
                  <div className="space-y-2">
                    {config.enabled_languages.map((langConfig, idx) => (
                      <div key={langConfig.language} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                        <div className="flex items-center">
                          <span className="mr-2">{languageIcons[langConfig.language]}</span>
                          <span className="capitalize font-medium text-foreground">{langConfig.language}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
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
                          className="h-4 w-4 rounded border-border"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <div className="font-medium text-foreground">Scan Dev Dependencies</div>
                      <div className="text-sm text-muted-foreground">Include devDependencies, dev-requires, etc.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.scan_dev_dependencies}
                      onChange={(e) => setConfig({ ...config, scan_dev_dependencies: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <div className="font-medium text-foreground">Scan Transitive Dependencies</div>
                      <div className="text-sm text-muted-foreground">Include indirect dependencies</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.scan_transitive}
                      onChange={(e) => setConfig({ ...config, scan_transitive: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <div className="font-medium text-foreground">Auto-detect Languages</div>
                      <div className="text-sm text-muted-foreground">Automatically detect languages in projects</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.auto_detect_languages}
                      onChange={(e) => setConfig({ ...config, auto_detect_languages: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <div className="font-medium text-foreground">Parallel Scanning</div>
                      <div className="text-sm text-muted-foreground">Scan multiple languages simultaneously</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.parallel_scanning}
                      onChange={(e) => setConfig({ ...config, parallel_scanning: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Cache Duration (hours)
                    </label>
                    <input
                      type="number"
                      value={config.cache_duration_hours}
                      onChange={(e) => setConfig({ ...config, cache_duration_hours: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                      min={1}
                      max={168}
                    />
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save Configuration
              </button>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </Layout>
  );
}
