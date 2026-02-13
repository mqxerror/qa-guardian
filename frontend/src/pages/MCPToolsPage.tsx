import { useState, useEffect, useCallback } from 'react';
import { Search, Meh, ServerOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { toast } from '../stores/toastStore';

import type { MCPToolInfo } from '@/types/mcp';

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

 // Feature #873: Extract fetchTools to a callback for retry support
 const fetchTools = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  try {
   const response = await fetch(`${import.meta.env.VITE_MCP_URL || ''}/mcp/message`, {
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
    // Feature #873: Show clean unavailable state instead of mock data
    setTools([]);
    setCategories([]);
    setError('MCP server returned an error. The server may be unavailable or misconfigured.');
   }
  } catch (err) {
   console.error('Failed to fetch MCP tools:', err);
   // Feature #873: Show clean unavailable state instead of mock data
   setTools([]);
   setCategories([]);
   setError('Unable to connect to MCP server. Please check the server status and try again.');
  } finally {
   setIsLoading(false);
  }
 }, []);

 useEffect(() => {
  fetchTools();
 }, [fetchTools]);

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
  read: 'bg-success/10 text-success',
  write: 'bg-primary/10 text-primary',
  execute: 'bg-warning/10 text-warning',
  admin: 'bg-destructive/10 text-destructive',
 };

 return (
  <Layout>
   <div className="p-8">
    {/* Feature #640: PageHeader component */}
    <PageHeader
     title="MCP Tools Catalog"
     description="Browse and search all available Model Context Protocol (MCP) tools for AI agent integration"
     breadcrumbs={[
      { label: 'Home', href: '/' },
      { label: 'MCP', href: '/mcp/chat' },
      { label: 'Tools Catalog' }
     ]}
     actions={
      <span className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary font-medium">
       {tools.length} tools available
      </span>
     }
    />

    {/* Feature #873: Clean unavailable state when MCP server is down */}
    {error && tools.length === 0 ? (
     <div className="text-center py-16 border border-dashed border-border rounded-xl bg-card">
      <ServerOff className="mx-auto h-16 w-16 text-muted-foreground/50" strokeWidth={1.5} />
      <h3 className="mt-4 text-lg font-semibold text-foreground">MCP Server Unavailable</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
       {error}
      </p>
      <Button
       variant="outline"
       size="sm"
       className="mt-4 gap-2"
       onClick={fetchTools}
       disabled={isLoading}
      >
       <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
       {isLoading ? 'Retrying...' : 'Retry Connection'}
      </Button>
     </div>
    ) : (
     <>
      {error && (
       <div className="mb-4 p-3 text-sm rounded bg-warning/10 text-warning">
        {error}
       </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 mb-6">
       <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
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
        <Meh className="mx-auto h-16 w-16 text-muted-foreground/50" strokeWidth={1.5} />
        <p className="mt-4 text-muted-foreground">No tools match your search</p>
        <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setSelectedPermission('all'); }} className="mt-2">Clear all filters</Button>
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
                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tool.name); toast.success(`Copied "${tool.name}" to clipboard`); }}>Copy Name</Button>
                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`await callMCP('tools/call', { name: '${tool.name}', arguments: {} });`); toast.success('Copied usage example'); }}>Copy Usage</Button>
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
     </>
    )}
   </div>
  </Layout>
 );
}

export default MCPToolsPage;
