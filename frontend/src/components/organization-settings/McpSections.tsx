/**
 * MCP Settings Sections - Connections, Audit Log, Analytics, Tools Catalog
 * Extracted from OrganizationSettingsPage.tsx for component decomposition (Agent 7)
 * Feature #594: MCP Connection management
 * Feature #846: MCP Audit Log
 * Feature #848: MCP Analytics Dashboard
 * Feature #1232: MCP Tools Catalog
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { createLogger } from '../../utils/logger';
import { EmptyState, EmptyStateIcons } from '../ui/EmptyState';
import { Button } from '../ui/button';
import { Wifi, FileText, BarChart3, LayoutGrid, Search } from 'lucide-react';
import {
  useMcpConnections,
  useMcpAuditLogs,
  useMcpAnalytics,
  useExportMcpAnalytics,
} from '../../hooks/api';
import type { McpAuditLogEntry, MCPToolInfo } from './types';

const logger = createLogger('org-settings-mcp');

// ---------------------------------------------------------------------------
// MCPConnectionsSection
// ---------------------------------------------------------------------------
export function MCPConnectionsSection() {
  const { data: connections = [], isLoading } = useMcpConnections();

  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString();

  if (isLoading) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">MCP Connections</h3>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-2">
        <Wifi className="h-6 w-6 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">MCP Connections</h3>
        <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
          {connections.length} active
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Active Model Context Protocol (MCP) connections from AI agents like Claude Code.
      </p>

      {connections.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <Wifi className="mx-auto h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-muted-foreground">No active MCP connections</p>
          <p className="text-xs text-muted-foreground mt-1">Connect an AI agent using an API key with MCP scopes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div key={conn.id} className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
                  <span className="font-medium text-foreground">{conn.api_key_name}</span>
                  {conn.client_info?.transport && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {conn.client_info.transport.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{conn.connected_duration_formatted}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><span className="text-muted-foreground/70">Connected:</span> <span className="text-foreground">{formatDateTime(conn.connected_at)}</span></div>
                <div><span className="text-muted-foreground/70">Last Activity:</span> <span className="text-foreground">{formatDateTime(conn.last_activity_at)}</span></div>
                {conn.ip_address && <div><span className="text-muted-foreground/70">IP:</span> <span className="text-foreground font-mono">{conn.ip_address}</span></div>}
                {conn.client_info?.user_agent && <div className="col-span-2"><span className="text-muted-foreground/70">Agent:</span> <span className="text-foreground">{conn.client_info.user_agent}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MCPAuditLogSection
// ---------------------------------------------------------------------------
export function MCPAuditLogSection() {
  const [selectedLog, setSelectedLog] = useState<McpAuditLogEntry | null>(null);
  const [filterMethod, setFilterMethod] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: auditData, isLoading } = useMcpAuditLogs({
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    method: filterMethod || undefined,
    response_type: filterStatus || undefined,
  });
  const auditLogs = auditData?.logs || [];
  const totalLogs = auditData?.total || 0;

  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString();
  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'initialize': return '\uD83D\uDD0C';
      case 'tools/call': return '\uD83D\uDD27';
      case 'tools/list': return '\uD83D\uDCCB';
      case 'resources/read': return '\uD83D\uDCD6';
      case 'resources/list': return '\uD83D\uDCDA';
      default: return '\uD83D\uDCE1';
    }
  };

  const totalPages = Math.ceil(totalLogs / pageSize);

  if (isLoading) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">MCP Audit Log</h3>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-2">
        <FileText className="h-6 w-6 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">MCP Audit Log</h3>
        <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">{totalLogs} entries</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Full audit trail of all MCP requests with timestamps, API keys, and request/response data.</p>

      <div className="flex gap-3 mb-4">
        <select value={filterMethod} onChange={(e) => { setFilterMethod(e.target.value); setCurrentPage(1); }} className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground">
          <option value="">All Methods</option>
          <option value="initialize">Initialize</option>
          <option value="tools/call">Tools Call</option>
          <option value="tools/list">Tools List</option>
          <option value="resources/read">Resources Read</option>
          <option value="resources/list">Resources List</option>
        </select>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground">
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
      </div>

      {auditLogs.length === 0 ? (
        <EmptyState icon={EmptyStateIcons.document} title="No MCP audit logs found" description="MCP tool invocations will be logged here." size="sm" />
      ) : (
        <>
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedLog?.id === log.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getMethodIcon(log.method)}</span>
                    <span className="font-medium text-foreground">{log.method}</span>
                    {log.tool_name && <span className="text-sm text-muted-foreground">&rarr; {log.tool_name}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${log.response_type === 'success' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>{log.response_type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</span>
                </div>
                <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>\uD83D\uDD11 {log.api_key_name}</span>
                  {log.duration_ms !== undefined && <span>\u23F1\uFE0F {log.duration_ms}ms</span>}
                </div>
                {selectedLog?.id === log.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {log.request_params && Object.keys(log.request_params).length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Request Parameters:</span>
                        <pre className="mt-1 p-2 text-xs bg-muted rounded overflow-x-auto">{JSON.stringify(log.request_params, null, 2)}</pre>
                      </div>
                    )}
                    {log.response_type === 'error' && (
                      <div>
                        <span className="text-xs font-medium text-destructive">Error:</span>
                        <div className="mt-1 p-2 text-xs bg-destructive/10 text-destructive rounded">{log.response_error_code && <span className="font-mono">[{log.response_error_code}] </span>}{log.response_error_message}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalLogs)} of {totalLogs}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MCPAnalyticsDashboard
// ---------------------------------------------------------------------------
export function MCPAnalyticsDashboard() {
  const [timePeriod, setTimePeriod] = useState<string>('7d');

  const { data: analytics, isLoading } = useMcpAnalytics(timePeriod);
  const exportMutation = useExportMcpAnalytics();

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      await exportMutation.mutateAsync({ format, timePeriod });
    } catch (err) {
      logger.error('Failed to export analytics:', err);
    }
  };

  const sortedTools = analytics ? Object.entries(analytics.by_tool).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.count - a.count) : [];
  const sortedApiKeys = analytics ? Object.entries(analytics.by_api_key).map(([id, stats]) => ({ id, ...stats })).sort((a, b) => b.count - a.count) : [];
  const maxToolCount = sortedTools.length > 0 ? sortedTools[0].count : 1;
  const maxApiKeyCount = sortedApiKeys.length > 0 ? sortedApiKeys[0].count : 1;

  if (isLoading) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">MCP Analytics Dashboard</h3>
        <div className="mt-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">MCP Analytics Dashboard</h3>
        </div>
        <div className="flex items-center gap-2">
          <select value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)} className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground">
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? 'Exporting...' : '\uD83D\uDCE5 Export CSV'}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">View MCP usage statistics, trends, and performance metrics.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg border border-border bg-muted/30"><div className="text-2xl font-bold text-foreground">{analytics?.total_calls || 0}</div><div className="text-sm text-muted-foreground">Total Requests</div></div>
        <div className="p-4 rounded-lg border border-border bg-success/10"><div className="text-2xl font-bold text-success">{analytics?.successful_calls || 0}</div><div className="text-sm text-muted-foreground">Successful</div></div>
        <div className="p-4 rounded-lg border border-border bg-destructive/10"><div className="text-2xl font-bold text-destructive">{analytics?.failed_calls || 0}</div><div className="text-sm text-muted-foreground">Failed</div></div>
        <div className="p-4 rounded-lg border border-border bg-primary/10"><div className="text-2xl font-bold text-primary">{analytics?.avg_response_time_ms || 0}ms</div><div className="text-sm text-muted-foreground">Avg Response</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">\uD83D\uDD27 Most Used Tools</h4>
          {sortedTools.length === 0 ? (
            <EmptyState icon={EmptyStateIcons.analytics} title="No tool usage data yet" size="sm" />
          ) : (
            <div className="space-y-2">
              {sortedTools.slice(0, 8).map((tool) => (
                <div key={tool.name} className="flex items-center gap-2">
                  <div className="w-24 text-xs text-foreground truncate" title={tool.name}>{tool.name}</div>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden"><div className="h-full bg-primary/80 rounded" style={{ width: `${(tool.count / maxToolCount) * 100}%` }} /></div>
                  <div className="w-12 text-xs text-muted-foreground text-right">{tool.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">\uD83D\uDD11 Requests by API Key</h4>
          {sortedApiKeys.length === 0 ? (
            <EmptyState icon={EmptyStateIcons.analytics} title="No API key usage data yet" size="sm" />
          ) : (
            <div className="space-y-2">
              {sortedApiKeys.slice(0, 8).map((key) => (
                <div key={key.id} className="flex items-center gap-2">
                  <div className="w-24 text-xs text-foreground truncate" title={key.name}>{key.name}</div>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden"><div className="h-full bg-primary/80 rounded" style={{ width: `${(key.count / maxApiKeyCount) * 100}%` }} /></div>
                  <div className="w-12 text-xs text-muted-foreground text-right">{key.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MCPToolsCatalogSection
// ---------------------------------------------------------------------------
export function MCPToolsCatalogSection() {
  const { token } = useAuthStore();
  const [tools, setTools] = useState<MCPToolInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPermission, setSelectedPermission] = useState<string>('all');
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateMockToolsCatalog = () => {
      const mockCategories = ['testing', 'execution', 'analysis', 'management', 'reporting', 'integrations', 'ai', 'meta'];
      const mockTools: MCPToolInfo[] = [
        { name: 'run_test', description: 'Execute a single test case by ID', category: 'testing', permission: 'execute' },
        { name: 'run_test_suite', description: 'Execute an entire test suite', category: 'testing', permission: 'execute' },
        { name: 'create_test', description: 'Create a new test case', category: 'testing', permission: 'write' },
        { name: 'get_test', description: 'Get test case details', category: 'testing', permission: 'read' },
        { name: 'list_tests', description: 'List all test cases', category: 'testing', permission: 'read' },
        { name: 'get_run_status', description: 'Get status of a test run', category: 'execution', permission: 'read' },
        { name: 'analyze_failure', description: 'AI-powered failure analysis', category: 'analysis', permission: 'read' },
        { name: 'get_flaky_tests', description: 'Get list of flaky tests', category: 'analysis', permission: 'read' },
        { name: 'create_project', description: 'Create a new project', category: 'management', permission: 'write' },
        { name: 'list_projects', description: 'List all projects', category: 'management', permission: 'read' },
        { name: 'generate_report', description: 'Generate test report', category: 'reporting', permission: 'read' },
        { name: 'generate_test', description: 'AI-generate test from description', category: 'ai', permission: 'write' },
        { name: 'list_all_tools', description: 'List all available MCP tools', category: 'meta', permission: 'read' },
      ];
      setTools(mockTools);
      setCategories(mockCategories);
      setError('Using cached catalog - MCP server may be unavailable');
    };

    const fetchTools = async () => {
      try {
        const response = await fetch(`/api/v1/mcp-rpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: 'list_all_tools', arguments: { include_descriptions: true, include_permissions: true } } }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.result?.content) {
            const content = JSON.parse(data.result.content[0].text);
            if (content.success) {
              const allTools: MCPToolInfo[] = [];
              const cats: string[] = content.categories || [];
              for (const category of cats) {
                const catTools = content.tools_by_category?.[category] || [];
                for (const tool of catTools) {
                  allTools.push({ name: tool.name, description: tool.description || 'No description available', category, permission: tool.permission || 'read', inputSchema: tool.inputSchema });
                }
              }
              setTools(allTools);
              setCategories(cats);
              setError(null);
            } else { generateMockToolsCatalog(); }
          }
        } else { generateMockToolsCatalog(); }
      } catch { generateMockToolsCatalog(); }
      finally { setIsLoading(false); }
    };
    fetchTools();
  }, [token]);

  const filteredTools = tools.filter(tool => {
    const matchesSearch = searchQuery === '' || tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesPermission = selectedPermission === 'all' || tool.permission === selectedPermission;
    return matchesSearch && matchesCategory && matchesPermission;
  });

  const toolsByCategory = filteredTools.reduce((acc, tool) => { if (!acc[tool.category]) acc[tool.category] = []; acc[tool.category].push(tool); return acc; }, {} as Record<string, MCPToolInfo[]>);
  const permissionColors: Record<string, string> = {
    read: 'bg-success/10 text-success',
    write: 'bg-primary/10 text-primary',
    execute: 'bg-warning/10 text-warning',
    admin: 'bg-destructive/10 text-destructive',
  };

  if (isLoading) {
    return (<div className="mt-6 rounded-lg border border-border bg-card p-6"><h3 className="text-lg font-semibold text-foreground">MCP Tools Catalog</h3><div className="mt-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div></div>);
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-2">
        <LayoutGrid className="h-6 w-6 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">MCP Tools Catalog</h3>
        <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">{tools.length} tools</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Browse and search all available Model Context Protocol (MCP) tools for AI agent integration.</p>
      {error && <div className="mb-4 p-2 text-xs rounded bg-warning/10 text-warning">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search tools..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-3 py-2 text-sm border border-input rounded-md bg-background text-foreground" />
        </div>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground">
          <option value="all">All Categories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
        </select>
        <select value={selectedPermission} onChange={(e) => setSelectedPermission(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground">
          <option value="all">All Permissions</option>
          <option value="read">Read</option><option value="write">Write</option><option value="execute">Execute</option><option value="admin">Admin</option>
        </select>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">Showing {filteredTools.length} of {tools.length} tools</div>

      {filteredTools.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <p className="mt-3 text-sm text-muted-foreground">No tools match your search</p>
          <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setSelectedPermission('all'); }} className="mt-2 text-xs px-0 h-auto">Clear filters</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(toolsByCategory).map(([category, catTools]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><span className="capitalize">{category}</span><span className="text-xs font-normal text-muted-foreground">({catTools.length})</span></h4>
              <div className="space-y-2">
                {catTools.map((tool) => (
                  <div key={tool.name} className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-medium text-foreground">{tool.name}</code>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${permissionColors[tool.permission]}`}>{tool.permission}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                      </div>
                    </div>
                    {expandedTool === tool.name && (
                      <div className="mt-3 pt-3 border-t border-border text-xs">
                        <div><span className="text-muted-foreground">Category:</span> <span className="text-foreground capitalize">{tool.category}</span></div>
                        <div className="flex gap-2 mt-2">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tool.name); toast.success(`Copied "${tool.name}" to clipboard`); }} className="text-xs h-auto px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20">Copy Name</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
