import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';
import { toast } from '../stores/toastStore';

// Feature #1232: MCP Tools Catalog interface
interface MCPToolInfo {
  name: string;
  description: string;
  category: string;
  permission: 'read' | 'write' | 'execute' | 'admin';
  inputSchema?: {
    type: string;
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

export function MCPToolsPage() {
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
    const fetchTools = async () => {
      try {
        const response = await fetch('https://qa.pixelcraftedmedia.com/mcp/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: 'list_all_tools',
              arguments: { include_descriptions: true, include_permissions: true },
            },
          }),
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
                  allTools.push({
                    name: tool.name,
                    description: tool.description || 'No description available',
                    category: category,
                    permission: tool.permission || 'read',
                    inputSchema: tool.inputSchema,
                  });
                }
              }
              setTools(allTools);
              setCategories(cats);
              setError(null);
            } else {
              throw new Error(content.error || 'Failed to fetch tools');
            }
          }
        } else {
          generateMockToolsCatalog();
        }
      } catch (err) {
        console.error('Failed to fetch MCP tools:', err);
        generateMockToolsCatalog();
      } finally {
        setIsLoading(false);
      }
    };

    const generateMockToolsCatalog = () => {
      // Feature #1439: Updated mock catalog after MCP tool cleanup (v2.1)
      // Feature #1445: 'risk' category removed (get_production_risk removed)
      const mockCategories = ['testing', 'execution', 'analysis', 'management', 'reporting', 'ai', 'chat'];
      const mockTools: MCPToolInfo[] = [
        { name: 'run_test', description: 'Execute a single test case by ID', category: 'testing', permission: 'execute' },
        { name: 'run_test_suite', description: 'Execute an entire test suite', category: 'testing', permission: 'execute' },
        { name: 'create_test', description: 'Create a new test case', category: 'testing', permission: 'write' },
        { name: 'update_test', description: 'Update a test case (including steps array)', category: 'testing', permission: 'write' },
        { name: 'get_test', description: 'Get test case details', category: 'testing', permission: 'read' },
        { name: 'list_tests', description: 'List all test cases', category: 'testing', permission: 'read' },
        { name: 'get_run_status', description: 'Get status of a test run', category: 'execution', permission: 'read' },
        // Feature #1429: Unified get_result replaces get_test_results, get_result_details, get_result_timeline
        { name: 'get_result', description: 'Get test results with optional details, timeline, and artifacts', category: 'execution', permission: 'read' },
        { name: 'analyze_failure', description: 'AI-powered failure analysis', category: 'analysis', permission: 'read' },
        { name: 'get_flaky_tests', description: 'Get list of flaky tests', category: 'analysis', permission: 'read' },
        // Feature #1430: Unified get_security_findings replaces get_vulnerabilities, get_vulnerability_details
        { name: 'get_security_findings', description: 'Get security findings including vulnerabilities, secrets, and compliance issues', category: 'analysis', permission: 'read' },
        { name: 'list_projects', description: 'List all projects', category: 'management', permission: 'read' },
        // Feature #1435: Unified export_data replaces generate_report, export_analytics_csv, export_results
        { name: 'export_data', description: 'Export data in various formats (results, analytics, accessibility, report)', category: 'reporting', permission: 'read' },
        { name: 'generate_test', description: 'AI-generate test from description', category: 'ai', permission: 'execute' },
        { name: 'generate_test_suite', description: 'Generate test suite from user story', category: 'ai', permission: 'execute' },
        { name: 'suggest_fix', description: 'AI-suggest fix for failure', category: 'ai', permission: 'read' },
        { name: 'explain_test_failure_ai', description: 'Get AI explanation of test failure with fix suggestions', category: 'ai', permission: 'read' },
        // Feature #1265: MCP chat tool for natural language conversation
        { name: 'chat', description: 'Natural language conversation with the platform. Send messages to get answers, execute commands, and manage tests through conversation.', category: 'chat', permission: 'execute' },
        { name: 'chat_history', description: 'Get the conversation history for context-aware follow-up messages', category: 'chat', permission: 'read' },
        { name: 'chat_clear', description: 'Clear conversation history to start fresh', category: 'chat', permission: 'write' },
        { name: 'ask_qa_guardian', description: 'Natural language interface to the entire platform', category: 'chat', permission: 'read' },
        // Feature #1445: get_production_risk removed (Feature #1268 cleanup)
        // Feature #1444: discover_tests removed (Feature #1270 cleanup)
        // Feature #1271: Documentation generation tool
        { name: 'generate_documentation', description: 'Generate documentation from test suites including markdown, diagrams, and coverage summary', category: 'ai', permission: 'execute' },
        // Feature #1272: Release notes generation tool
        { name: 'generate_release_notes', description: 'Generate release notes from test changes between versions with categorized changes and test evidence', category: 'ai', permission: 'execute' },
        // Feature #1436: Removed notify_team - use built-in alerting
        // Feature #1434: Removed list_all_tools, validate_api_key, get_help - AI agents have MCP manifest
      ];
      setTools(mockTools);
      setCategories(mockCategories);
      setError('Using cached catalog - MCP server may be unavailable');
    };

    fetchTools();
  }, [token]);

  const filteredTools = tools.filter(tool => {
    const matchesSearch = searchQuery === '' ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesPermission = selectedPermission === 'all' || tool.permission === selectedPermission;
    return matchesSearch && matchesCategory && matchesPermission;
  });

  const toolsByCategory = filteredTools.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, MCPToolInfo[]>);

  const permissionColors: Record<string, string> = {
    read: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    write: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    execute: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-foreground">MCP Tools Catalog</h2>
            <p className="mt-2 text-muted-foreground">
              Browse and search all available Model Context Protocol (MCP) tools for AI agent integration.
            </p>
          </div>
          <span className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary font-medium">
            {tools.length} tools available
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 text-sm rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            {error}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search tools by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-4 py-2 border border-input rounded-lg bg-background text-foreground">
            <option value="all">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
          </select>
          <select value={selectedPermission} onChange={(e) => setSelectedPermission(e.target.value)} className="px-4 py-2 border border-input rounded-lg bg-background text-foreground">
            <option value="all">All Permissions</option>
            <option value="read">Read</option>
            <option value="write">Write</option>
            <option value="execute">Execute</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredTools.length} of {tools.length} tools{searchQuery && ` matching "${searchQuery}"`}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div></div>
        ) : filteredTools.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <svg className="mx-auto h-16 w-16 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-4 text-muted-foreground">No tools match your search</p>
            <button onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setSelectedPermission('all'); }} className="mt-2 text-sm text-primary hover:underline">Clear all filters</button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(toolsByCategory).map(([category, catTools]) => (
              <div key={category} className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-lg font-semibold text-foreground mb-3 capitalize flex items-center gap-2">{category}<span className="text-sm font-normal text-muted-foreground">({catTools.length})</span></h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {catTools.map((tool) => (
                    <div key={tool.name} className="p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}>
                      <div className="flex items-start justify-between">
                        <code className="text-sm font-mono font-medium text-foreground">{tool.name}</code>
                        <span className={`text-xs px-2 py-0.5 rounded ${permissionColors[tool.permission]}`}>{tool.permission}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{tool.description}</p>
                      {expandedTool === tool.name && (
                        <div className="mt-3 pt-3 border-t border-border text-xs space-y-2">
                          <div><span className="text-muted-foreground">Required scope:</span> <code className="px-1 py-0.5 rounded bg-muted">mcp:{tool.permission}</code></div>
                          <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tool.name); toast.success(`Copied "${tool.name}" to clipboard`); }} className="px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20">Copy Name</button>
                            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`await callMCP('tools/call', { name: '${tool.name}', arguments: {} });`); toast.success('Copied usage example'); }} className="px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20">Copy Usage</button>
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

        <div className="mt-8 p-4 rounded-lg border border-border bg-muted/30">
          <h4 className="text-sm font-semibold text-foreground mb-3">Permission Levels</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded ${permissionColors.read}`}>read</span><span className="text-muted-foreground">View data only</span></div>
            <div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded ${permissionColors.write}`}>write</span><span className="text-muted-foreground">Create/modify data</span></div>
            <div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded ${permissionColors.execute}`}>execute</span><span className="text-muted-foreground">Run actions</span></div>
            <div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded ${permissionColors.admin}`}>admin</span><span className="text-muted-foreground">Full access</span></div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default MCPToolsPage;
