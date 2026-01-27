// MCPPlaygroundPage - Interactive MCP Tool Testing
// Feature #1233: MCP Tool Playground
// Extracted from App.tsx for code quality compliance (Feature #1357)

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { Layout } from '../components/Layout';

// Types for MCP Tools
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

export function MCPPlaygroundPage() {
  const { token } = useAuthStore();
  const [tools, setTools] = useState<MCPToolInfo[]>([]);
  const [selectedTool, setSelectedTool] = useState<MCPToolInfo | null>(null);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [response, setResponse] = useState<{ success: boolean; data: unknown; error?: string } | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all tools on mount
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await fetch('https://qa.pixelcraftedmedia.com/mcp/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/list',
            params: {},
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.result?.tools) {
            const toolList: MCPToolInfo[] = data.result.tools.map((t: { name: string; description?: string; inputSchema?: unknown }) => ({
              name: t.name,
              description: t.description || 'No description available',
              category: 'general',
              permission: 'read' as const,
              inputSchema: t.inputSchema as MCPToolInfo['inputSchema'],
            }));
            setTools(toolList.sort((a, b) => a.name.localeCompare(b.name)));
          }
        }
      } catch (err) {
        console.error('Failed to fetch tools:', err);
        // Provide some mock tools for testing
        setTools([
          { name: 'list_all_tools', description: 'List all available MCP tools', category: 'meta', permission: 'read' },
          { name: 'validate_api_key', description: 'Validate API key and permissions', category: 'meta', permission: 'read' },
          { name: 'get_help', description: 'Get help for MCP tools', category: 'meta', permission: 'read' },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTools();
  }, []);

  // Reset parameters when tool changes
  useEffect(() => {
    if (selectedTool) {
      const defaultParams: Record<string, unknown> = {};
      const props = selectedTool.inputSchema?.properties || {};
      for (const [key, prop] of Object.entries(props)) {
        if (prop.default !== undefined) {
          defaultParams[key] = prop.default;
        } else if (prop.type === 'boolean') {
          defaultParams[key] = false;
        } else if (prop.type === 'number' || prop.type === 'integer') {
          defaultParams[key] = '';
        } else if (prop.enum && prop.enum.length > 0) {
          defaultParams[key] = prop.enum[0];
        } else {
          defaultParams[key] = '';
        }
      }
      setParameters(defaultParams);
      setResponse(null);
      setExecutionTime(null);
    }
  }, [selectedTool]);

  const handleExecute = async () => {
    if (!selectedTool) return;

    setIsExecuting(true);
    setResponse(null);
    const startTime = Date.now();

    try {
      // Clean up parameters - remove empty strings and convert types
      const cleanedParams: Record<string, unknown> = {};
      const props = selectedTool.inputSchema?.properties || {};
      for (const [key, value] of Object.entries(parameters)) {
        if (value === '' || value === undefined) continue;
        const propType = props[key]?.type;
        if (propType === 'number' || propType === 'integer') {
          cleanedParams[key] = Number(value);
        } else if (propType === 'boolean') {
          cleanedParams[key] = value === true || value === 'true';
        } else if (propType === 'array') {
          // Try to parse as JSON array, or split by comma
          if (typeof value === 'string') {
            try {
              cleanedParams[key] = JSON.parse(value);
            } catch {
              cleanedParams[key] = value.split(',').map(s => s.trim()).filter(s => s);
            }
          } else {
            cleanedParams[key] = value;
          }
        } else {
          cleanedParams[key] = value;
        }
      }

      const res = await fetch('https://qa.pixelcraftedmedia.com/mcp/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: selectedTool.name,
            arguments: cleanedParams,
          },
        }),
      });

      const endTime = Date.now();
      setExecutionTime(endTime - startTime);

      const data = await res.json();

      if (data.error) {
        setResponse({ success: false, data: null, error: data.error.message || JSON.stringify(data.error) });
      } else if (data.result?.content) {
        try {
          const content = JSON.parse(data.result.content[0].text);
          setResponse({ success: content.success !== false, data: content });
        } catch {
          setResponse({ success: true, data: data.result.content[0].text });
        }
      } else {
        setResponse({ success: true, data: data.result || data });
      }
    } catch (err) {
      setExecutionTime(Date.now() - startTime);
      setResponse({ success: false, data: null, error: err instanceof Error ? err.message : 'Failed to execute tool' });
    } finally {
      setIsExecuting(false);
    }
  };

  const renderParameterInput = (key: string, prop: { type?: string; description?: string; enum?: string[]; default?: unknown }) => {
    const value = parameters[key];
    const isRequired = selectedTool?.inputSchema?.required?.includes(key);

    if (prop.enum && prop.enum.length > 0) {
      return (
        <select
          value={String(value || '')}
          onChange={(e) => setParameters({ ...parameters, [key]: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
        >
          {prop.enum.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (prop.type === 'boolean') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setParameters({ ...parameters, [key]: e.target.checked })}
            className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground">Enable</span>
        </label>
      );
    }

    if (prop.type === 'number' || prop.type === 'integer') {
      return (
        <input
          type="number"
          value={String(value || '')}
          onChange={(e) => setParameters({ ...parameters, [key]: e.target.value })}
          placeholder={prop.description || `Enter ${key}`}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground"
        />
      );
    }

    if (prop.type === 'array') {
      return (
        <textarea
          value={String(value || '')}
          onChange={(e) => setParameters({ ...parameters, [key]: e.target.value })}
          placeholder={prop.description || `Enter ${key} (JSON array or comma-separated)`}
          rows={2}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground font-mono text-sm"
        />
      );
    }

    // Default to text input
    return (
      <input
        type="text"
        value={String(value || '')}
        onChange={(e) => setParameters({ ...parameters, [key]: e.target.value })}
        placeholder={prop.description || `Enter ${key}`}
        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground"
      />
    );
  };

  const filteredTools = tools.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground">MCP Playground</h2>
          <p className="mt-2 text-muted-foreground">
            Test MCP tools interactively. Select a tool, configure parameters, and execute to see results in real-time.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Tool Selection & Parameters */}
            <div className="space-y-6">
              {/* Tool Selection */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Select Tool</h3>

                {/* Search */}
                <div className="relative mb-4">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search tools..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground text-sm"
                  />
                </div>

                {/* Tool Dropdown */}
                <select
                  value={selectedTool?.name || ''}
                  onChange={(e) => {
                    const tool = tools.find(t => t.name === e.target.value);
                    setSelectedTool(tool || null);
                  }}
                  className="w-full px-4 py-3 border border-input rounded-md bg-background text-foreground font-mono"
                >
                  <option value="">-- Select a tool --</option>
                  {filteredTools.map((tool) => (
                    <option key={tool.name} value={tool.name}>
                      {tool.name}
                    </option>
                  ))}
                </select>

                {selectedTool && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {selectedTool.description}
                  </p>
                )}

                <p className="mt-2 text-xs text-muted-foreground">
                  {filteredTools.length} tools available
                </p>
              </div>

              {/* Parameters */}
              {selectedTool && (
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Parameters</h3>

                  {selectedTool.inputSchema?.properties && Object.keys(selectedTool.inputSchema.properties).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(selectedTool.inputSchema.properties).map(([key, prop]) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            {key}
                            {selectedTool.inputSchema?.required?.includes(key) && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                            {prop.type && (
                              <span className="ml-2 text-xs text-muted-foreground font-normal">
                                ({prop.type})
                              </span>
                            )}
                          </label>
                          {renderParameterInput(key, prop)}
                          {prop.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{prop.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This tool has no configurable parameters.
                    </p>
                  )}

                  {/* Execute Button */}
                  <button
                    onClick={handleExecute}
                    disabled={isExecuting || !selectedTool}
                    className="mt-6 w-full py-3 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isExecuting ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                        Executing...
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Execute Tool
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Right Panel - Response */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Response</h3>
                {executionTime !== null && (
                  <span className="text-xs text-muted-foreground">
                    Executed in {executionTime}ms
                  </span>
                )}
              </div>

              {!selectedTool ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="h-16 w-16 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-4 text-muted-foreground">
                    Select a tool to get started
                  </p>
                </div>
              ) : !response ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="h-16 w-16 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="mt-4 text-muted-foreground">
                    Click "Execute Tool" to see results
                  </p>
                </div>
              ) : (
                <div>
                  {/* Status Badge */}
                  <div className="mb-4">
                    {response.success ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-sm font-medium">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-sm font-medium">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Error
                      </span>
                    )}
                  </div>

                  {/* Error Message */}
                  {response.error && (
                    <div className="mb-4 p-3 rounded-md bg-red-100/50 dark:bg-red-900/20 text-red-800 dark:text-red-400 text-sm">
                      {response.error}
                    </div>
                  )}

                  {/* Response Data */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
                        toast.success('Copied to clipboard');
                      }}
                      className="absolute top-2 right-2 p-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy to clipboard"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <pre className="p-4 rounded-md bg-muted/30 text-sm font-mono text-foreground overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(response.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
