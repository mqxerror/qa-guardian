// DependencyTreePage - Feature #271
// Interactive dependency tree visualization with vulnerability highlighting
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { PageHeader } from '../components/ui';
import { ChevronRight, AlertCircle, Package, Shield, AlertTriangle, Search, Loader2, CheckCircle } from 'lucide-react';

// Types for dependency data
interface Vulnerability {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  fixed_version?: string;
}

interface Dependency {
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
  vulnerabilities: Vulnerability[];
  last_scanned_at: string;
}

// Tree node structure for visualization
interface TreeNode {
  id: string;
  name: string;
  version: string;
  license?: string;
  vulnerabilities: Vulnerability[];
  isVulnerable: boolean;
  isExpanded: boolean;
  depth: number;
  children: TreeNode[];
  language: string;
  isDev: boolean;
}

interface AllDependenciesResponse {
  project_id: string;
  dependencies_by_language: Record<string, Dependency[]>;
  summary: Record<string, {
    total: number;
    direct: number;
    transitive: number;
    vulnerabilities: number;
  }>;
  totals: {
    total_dependencies: number;
    total_vulnerabilities: number;
    languages_scanned: number;
  };
}

// Build tree structure from flat dependencies
function buildDependencyTree(
  deps: Dependency[],
  language: string
): TreeNode[] {
  // Group by direct (depth 0/1) vs transitive
  const directDeps = deps.filter(d => !d.is_transitive || d.depth <= 1);
  const transitiveDeps = deps.filter(d => d.is_transitive && d.depth > 1);

  // Create a map for quick lookup
  const depMap = new Map<string, Dependency>();
  deps.forEach(d => depMap.set(d.name, d));

  // Build tree nodes for direct dependencies
  const rootNodes: TreeNode[] = directDeps.map(dep => {
    const children = transitiveDeps
      .filter(td => td.parent_package === dep.name)
      .map(td => createTreeNode(td, language, []));

    return createTreeNode(dep, language, children);
  });

  return rootNodes;
}

function createTreeNode(
  dep: Dependency,
  language: string,
  children: TreeNode[]
): TreeNode {
  return {
    id: dep.id,
    name: dep.name,
    version: dep.current_version,
    license: dep.license,
    vulnerabilities: dep.vulnerabilities,
    isVulnerable: dep.vulnerabilities.length > 0,
    isExpanded: false,
    depth: dep.depth,
    children,
    language,
    isDev: dep.is_dev,
  };
}

// Severity color mapping
const severityColors: Record<string, string> = {
  CRITICAL: '#dc2626', // red-600
  HIGH: '#ea580c',     // orange-600
  MEDIUM: '#d97706',   // amber-600
  LOW: '#65a30d',      // lime-600
};

const severityBgColors: Record<string, string> = {
  CRITICAL: '#fef2f2', // red-50
  HIGH: '#fff7ed',     // orange-50
  MEDIUM: '#fffbeb',   // amber-50
  LOW: '#f7fee7',      // lime-50
};

// Language icons/colors
const languageConfig: Record<string, { color: string; icon: string }> = {
  javascript: { color: '#f7df1e', icon: 'JS' },
  python: { color: '#3776ab', icon: 'PY' },
  java: { color: '#007396', icon: 'JV' },
  go: { color: '#00add8', icon: 'GO' },
  rust: { color: '#dea584', icon: 'RS' },
};

export function DependencyTreePage() {
  const navigate = useNavigate();
  const { token } = useAuthStore();

  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AllDependenciesResponse | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('javascript');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showVulnerableOnly, setShowVulnerableOnly] = useState(false);

  // Load projects
  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/projects', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(result => {
        const projectList = Array.isArray(result) ? result : result.projects || [];
        setProjects(projectList);
        if (projectList.length > 0 && !selectedProject) {
          setSelectedProject(projectList[0].id);
        }
      })
      .catch(err => console.error('Failed to load projects:', err));
  }, [token]);

  // Load dependencies when project changes
  useEffect(() => {
    if (!token || !selectedProject) return;

    setLoading(true);
    setError(null);

    fetch(`/api/v1/projects/${selectedProject}/all-dependencies`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(result => {
        setData(result);
        // Select first available language
        const languages = Object.keys(result.dependencies_by_language || {});
        if (languages.length > 0 && !languages.includes(selectedLanguage)) {
          setSelectedLanguage(languages[0]);
        }
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [token, selectedProject]);

  // Build tree from current language dependencies
  const treeData = useMemo(() => {
    if (!data || !data.dependencies_by_language[selectedLanguage]) {
      return [];
    }
    return buildDependencyTree(
      data.dependencies_by_language[selectedLanguage],
      selectedLanguage
    );
  }, [data, selectedLanguage]);

  // Filter tree based on search and vulnerability filter
  const filteredTree = useMemo(() => {
    let filtered = treeData;

    if (showVulnerableOnly) {
      filtered = filtered.filter(node =>
        node.isVulnerable || node.children.some(c => c.isVulnerable)
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(node =>
        node.name.toLowerCase().includes(term) ||
        node.children.some(c => c.name.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [treeData, searchTerm, showVulnerableOnly]);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const selectNode = useCallback((node: TreeNode) => {
    setSelectedNode(node);
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set<string>();
    filteredTree.forEach(node => {
      allIds.add(node.id);
      node.children.forEach(c => allIds.add(c.id));
    });
    setExpandedNodes(allIds);
  }, [filteredTree]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // Render a tree node
  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedNode?.id === node.id;

    return (
      <div key={node.id} style={{ marginLeft: level * 24 }}>
        <div
          onClick={() => selectNode(node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            marginBottom: '4px',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: isSelected ? '#eff6ff' : node.isVulnerable ? '#fef2f2' : '#f9fafb',
            border: isSelected ? '2px solid #3b82f6' : node.isVulnerable ? '1px solid #fca5a5' : '1px solid #e5e7eb',
            transition: 'all 0.15s ease',
          }}
        >
          {/* Expand/collapse button */}
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                marginRight: '8px',
              }}
            >
              <ChevronRight
                size={16}
                color="#6b7280"
                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
              />
            </button>
          ) : (
            <div style={{ width: '32px' }} />
          )}

          {/* Package icon/indicator */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: node.isVulnerable ? '#dc2626' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
            }}
          >
            {node.isVulnerable ? (
              <AlertCircle size={16} color="white" />
            ) : (
              <Package size={16} color="white" />
            )}
          </div>

          {/* Package info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>{node.name}</span>
              <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>
                v{node.version}
              </span>
              {node.isDev && (
                <span style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: '#dbeafe',
                  color: '#1d4ed8',
                  borderRadius: '4px',
                  fontWeight: 500,
                }}>
                  dev
                </span>
              )}
            </div>
            {node.license && (
              <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginTop: '2px' }}>
                {node.license}
              </div>
            )}
          </div>

          {/* Vulnerability badges */}
          {node.isVulnerable && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {node.vulnerabilities.map((vuln, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    backgroundColor: severityBgColors[vuln.severity],
                    color: severityColors[vuln.severity],
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  {vuln.severity}
                </span>
              ))}
            </div>
          )}

          {/* Children count */}
          {hasChildren && (
            <span style={{
              fontSize: '11px',
              color: 'hsl(var(--muted-foreground))',
              marginLeft: '8px',
            }}>
              {node.children.length} dep{node.children.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Render children if expanded */}
        {isExpanded && hasChildren && (
          <div style={{ borderLeft: '2px solid hsl(var(--border))', marginLeft: '16px', paddingLeft: '8px' }}>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Detail panel for selected node
  const renderDetailPanel = () => {
    if (!selectedNode) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'hsl(var(--muted-foreground))',
        }}>
          <Package size={48} style={{ marginBottom: '16px' }} />
          <p>Click a package to view details</p>
        </div>
      );
    }

    return (
      <div style={{ padding: '20px' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: languageConfig[selectedNode.language]?.color || '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              {languageConfig[selectedNode.language]?.icon || '?'}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                {selectedNode.name}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>
                v{selectedNode.version}
              </p>
            </div>
          </div>
          {selectedNode.license && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px',
              fontSize: '13px',
              color: 'hsl(var(--muted-foreground))',
            }}>
              <Shield size={14} />
              {selectedNode.license}
            </div>
          )}
        </div>

        {/* Vulnerabilities section */}
        {selectedNode.vulnerabilities.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              Vulnerabilities ({selectedNode.vulnerabilities.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedNode.vulnerabilities.map((vuln, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: severityBgColors[vuln.severity],
                    border: `1px solid ${severityColors[vuln.severity]}20`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      backgroundColor: severityColors[vuln.severity],
                      color: 'white',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}>
                      {vuln.severity}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                      {vuln.id}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'hsl(var(--foreground))' }}>
                    {vuln.title}
                  </p>
                  {vuln.fixed_version && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#059669' }}>
                      Fixed in: v{vuln.fixed_version}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Children dependencies */}
        {selectedNode.children.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Transitive Dependencies ({selectedNode.children.length})
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selectedNode.children.map(child => (
                <span
                  key={child.id}
                  onClick={() => selectNode(child)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: child.isVulnerable ? '#fef2f2' : '#f3f4f6',
                    color: child.isVulnerable ? '#dc2626' : '#4b5563',
                    border: `1px solid ${child.isVulnerable ? '#fca5a5' : '#e5e7eb'}`,
                  }}
                >
                  {child.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* No vulnerabilities message */}
        {selectedNode.vulnerabilities.length === 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            backgroundColor: '#f0fdf4',
            borderRadius: '8px',
            border: '1px solid #bbf7d0',
          }}>
            <CheckCircle size={24} color="#16a34a" />
            <span style={{ color: '#15803d', fontWeight: 500 }}>
              No known vulnerabilities
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Feature #639: PageHeader component */}
      <div className="bg-card border-b border-border px-6 py-5">
        <PageHeader
          title="Dependency Tree"
          description="Interactive visualization of project dependencies with vulnerability highlighting"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'Dependency Tree' }]}
        />

        {/* Controls */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Project selector */}
          <div style={{ minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>
              Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                backgroundColor: 'hsl(var(--card))',
              }}
            >
              <option value="">Select a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Language tabs */}
          {data && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.keys(data.dependencies_by_language).map(lang => {
                const langData = data.summary[lang];
                const isActive = selectedLanguage === lang;
                const config = languageConfig[lang] || { color: 'hsl(var(--muted-foreground))', icon: '?' };

                return (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: isActive ? `2px solid ${config.color}` : '1px solid #e5e7eb',
                      backgroundColor: isActive ? `${config.color}15` : 'white',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? config.color : '#6b7280',
                    }}
                  >
                    <span style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      backgroundColor: config.color,
                      color: 'white',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                    }}>
                      {config.icon}
                    </span>
                    {lang}
                    {langData && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: langData.vulnerabilities > 0 ? '#fef2f2' : '#f3f4f6',
                        color: langData.vulnerabilities > 0 ? '#dc2626' : '#6b7280',
                      }}>
                        {langData.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', height: 'calc(100vh - 180px)' }}>
        {/* Tree panel */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px', borderRight: '1px solid hsl(var(--border))' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ flex: 1, minWidth: '200px', maxWidth: '300px', position: 'relative' }}>
              <Search
                size={16}
                color="#9ca3af"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search packages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 40px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Vulnerable only toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showVulnerableOnly}
                onChange={(e) => setShowVulnerableOnly(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
              />
              <span style={{ fontSize: '13px', color: 'hsl(var(--foreground))' }}>Vulnerable only</span>
            </label>

            {/* Expand/Collapse buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={expandAll}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'hsl(var(--card))',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'hsl(var(--card))',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--muted-foreground))' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p>Loading dependencies...</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div style={{ padding: '20px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredTree.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--muted-foreground))' }}>
              <Package size={48} style={{ margin: '0 auto 12px' }} />
              <p>No dependencies found</p>
              <p style={{ fontSize: '13px' }}>Select a project to view its dependency tree</p>
            </div>
          )}

          {/* Tree view */}
          {!loading && !error && filteredTree.length > 0 && (
            <div>
              {filteredTree.map(node => renderTreeNode(node))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div style={{ width: '380px', backgroundColor: 'hsl(var(--card))', overflow: 'auto' }}>
          {renderDetailPanel()}
        </div>
      </div>

      {/* Summary bar */}
      {data && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'hsl(var(--card))',
          borderTop: '1px solid #e5e7eb',
          padding: '12px 24px',
          display: 'flex',
          gap: '24px',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
              {data.totals.total_dependencies}
            </div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>Total Dependencies</div>
          </div>
          <div style={{ width: '1px', backgroundColor: 'hsl(var(--border))' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>
              {data.totals.total_vulnerabilities}
            </div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>Vulnerabilities</div>
          </div>
          <div style={{ width: '1px', backgroundColor: 'hsl(var(--border))' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#6366f1' }}>
              {data.totals.languages_scanned}
            </div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>Languages</div>
          </div>
        </div>
      )}

      {/* CSS for animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default DependencyTreePage;
