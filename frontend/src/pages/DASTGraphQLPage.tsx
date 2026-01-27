// Feature #758: DAST GraphQL Scanning with Introspection
// Extracted from App.tsx for code quality compliance (Feature #1441)
// Feature #1986: Shows demo/mock data - real GraphQL DAST integration coming soon
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com';

// GraphQL scanning interfaces
interface GraphQLOperation {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  args: { name: string; type: string; required: boolean }[];
  returnType: string;
  description?: string;
  deprecated?: boolean;
  deprecationReason?: string;
}

interface GraphQLSchema {
  queryType: string | null;
  mutationType: string | null;
  subscriptionType: string | null;
  operations: GraphQLOperation[];
  types: { name: string; kind: string; fields: number }[];
}

interface GraphQLScanConfig {
  endpoint: string;
  introspectionEnabled: boolean;
  authHeader?: string;
  customHeaders?: Record<string, string>;
  maxDepth: number;
  includeMutations: boolean;
  includeSubscriptions: boolean;
  rateLimit: number;
}

interface GraphQLFinding {
  id: string;
  operationName: string;
  operationType: 'query' | 'mutation';
  severity: 'High' | 'Medium' | 'Low' | 'Informational';
  vulnerability: string;
  description: string;
  evidence?: string;
  cweId?: number;
  solution: string;
  testedPayload?: string;
}

interface GraphQLScanResult {
  id: string;
  status: 'pending' | 'introspecting' | 'scanning' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  schema?: GraphQLSchema;
  operationsTested: { name: string; type: string; status: 'tested' | 'skipped' | 'failed' }[];
  findings: GraphQLFinding[];
  summary: {
    totalOperations: number;
    queriesTested: number;
    mutationsTested: number;
    totalFindings: number;
    bySeverity: { high: number; medium: number; low: number; informational: number };
  };
  progress?: {
    phase: string;
    percentage: number;
    currentOperation?: string;
  };
}

export function DASTGraphQLPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<GraphQLScanConfig>({
    endpoint: '',
    introspectionEnabled: true,
    maxDepth: 3,
    includeMutations: true,
    includeSubscriptions: false,
    rateLimit: 10,
  });
  const [scanResult, setScanResult] = useState<GraphQLScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'schema' | 'operations' | 'findings'>('schema');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Mock schema for demo
  const mockSchema: GraphQLSchema = {
    queryType: 'Query',
    mutationType: 'Mutation',
    subscriptionType: null,
    operations: [
      { name: 'users', type: 'query', args: [{ name: 'limit', type: 'Int', required: false }, { name: 'offset', type: 'Int', required: false }], returnType: '[User!]!', description: 'Get list of users' },
      { name: 'user', type: 'query', args: [{ name: 'id', type: 'ID', required: true }], returnType: 'User', description: 'Get user by ID' },
      { name: 'currentUser', type: 'query', args: [], returnType: 'User!', description: 'Get currently authenticated user' },
      { name: 'posts', type: 'query', args: [{ name: 'userId', type: 'ID', required: false }, { name: 'status', type: 'PostStatus', required: false }], returnType: '[Post!]!', description: 'Get posts with optional filters' },
      { name: 'searchUsers', type: 'query', args: [{ name: 'query', type: 'String', required: true }], returnType: '[User!]!', description: 'Search users by name or email' },
      { name: 'adminStats', type: 'query', args: [], returnType: 'AdminStats!', description: 'Get admin dashboard statistics', deprecated: true, deprecationReason: 'Use dashboard query instead' },
      { name: 'createUser', type: 'mutation', args: [{ name: 'input', type: 'CreateUserInput', required: true }], returnType: 'User!', description: 'Create a new user' },
      { name: 'updateUser', type: 'mutation', args: [{ name: 'id', type: 'ID', required: true }, { name: 'input', type: 'UpdateUserInput', required: true }], returnType: 'User!', description: 'Update user by ID' },
      { name: 'deleteUser', type: 'mutation', args: [{ name: 'id', type: 'ID', required: true }], returnType: 'Boolean!', description: 'Delete user by ID' },
      { name: 'login', type: 'mutation', args: [{ name: 'email', type: 'String', required: true }, { name: 'password', type: 'String', required: true }], returnType: 'AuthPayload!', description: 'Authenticate user' },
      { name: 'resetPassword', type: 'mutation', args: [{ name: 'email', type: 'String', required: true }], returnType: 'Boolean!', description: 'Request password reset' },
    ],
    types: [
      { name: 'User', kind: 'OBJECT', fields: 8 },
      { name: 'Post', kind: 'OBJECT', fields: 6 },
      { name: 'AuthPayload', kind: 'OBJECT', fields: 2 },
      { name: 'AdminStats', kind: 'OBJECT', fields: 5 },
      { name: 'CreateUserInput', kind: 'INPUT_OBJECT', fields: 4 },
      { name: 'UpdateUserInput', kind: 'INPUT_OBJECT', fields: 3 },
      { name: 'PostStatus', kind: 'ENUM', fields: 3 },
    ],
  };

  const mockFindings: GraphQLFinding[] = [
    { id: 'gql1', operationName: 'searchUsers', operationType: 'query', severity: 'High', vulnerability: 'GraphQL Injection', description: 'The searchUsers query is vulnerable to GraphQL injection through the query parameter. Malicious queries can bypass authorization checks.', evidence: 'Payload: {__schema{types{name}}} returned sensitive schema information', cweId: 943, solution: 'Implement query depth limiting and disable introspection in production. Validate and sanitize all string inputs.', testedPayload: 'query { searchUsers(query: "{__schema{types{name}}}") { id email } }' },
    { id: 'gql2', operationName: 'users', operationType: 'query', severity: 'Medium', vulnerability: 'Batching Attack', description: 'The users query allows unlimited batching which can lead to denial of service through resource exhaustion.', cweId: 400, solution: 'Implement query complexity analysis and limit the maximum number of items per request.', testedPayload: 'query { users(limit: 10000) { id name email } }' },
    { id: 'gql3', operationName: 'user', operationType: 'query', severity: 'High', vulnerability: 'IDOR (Insecure Direct Object Reference)', description: 'User query allows access to any user ID without proper authorization checks. Authenticated users can retrieve data of other users.', evidence: 'Successfully retrieved user data for ID not belonging to authenticated user', cweId: 639, solution: 'Implement proper authorization checks in resolvers. Verify requesting user has permission to access requested resource.' },
    { id: 'gql4', operationName: 'login', operationType: 'mutation', severity: 'Medium', vulnerability: 'Rate Limiting Missing', description: 'The login mutation has no rate limiting, making it vulnerable to brute force attacks.', cweId: 307, solution: 'Implement rate limiting on authentication endpoints. Consider adding CAPTCHA after failed attempts.' },
    { id: 'gql5', operationName: 'deleteUser', operationType: 'mutation', severity: 'High', vulnerability: 'Missing Authorization', description: 'The deleteUser mutation does not verify if the requester has admin privileges. Any authenticated user can delete any account.', evidence: 'Successfully deleted user account without admin role', cweId: 862, solution: 'Add @hasRole(role: ADMIN) directive or equivalent authorization check to the resolver.' },
    { id: 'gql6', operationName: 'adminStats', operationType: 'query', severity: 'Low', vulnerability: 'Deprecated Operation Exposed', description: 'The deprecated adminStats query is still accessible and may leak sensitive internal statistics.', cweId: 200, solution: 'Remove deprecated operations from the schema or ensure they are properly protected.' },
    { id: 'gql7', operationName: 'introspection', operationType: 'query', severity: 'Informational', vulnerability: 'Introspection Enabled', description: 'GraphQL introspection is enabled, exposing the entire API schema including potentially sensitive operations and types.', cweId: 200, solution: 'Disable introspection in production environments or restrict it to authenticated users only.' },
  ];

  const runScan = async () => {
    if (!config.endpoint) return;

    setIsScanning(true);
    setScanResult({
      id: `gql_scan_${Date.now()}`,
      status: 'introspecting',
      startedAt: new Date().toISOString(),
      operationsTested: [],
      findings: [],
      summary: { totalOperations: 0, queriesTested: 0, mutationsTested: 0, totalFindings: 0, bySeverity: { high: 0, medium: 0, low: 0, informational: 0 } },
      progress: { phase: 'Introspecting schema...', percentage: 10 },
    });

    try {
      // Start the scan via API
      const token = localStorage.getItem('token');
      const startResponse = await fetch(`${API_BASE}/api/v1/dast/graphql/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      if (!startResponse.ok) {
        throw new Error('Failed to start GraphQL scan');
      }

      const { scanId } = await startResponse.json();

      // Poll for scan status
      let completed = false;
      while (!completed) {
        await new Promise(r => setTimeout(r, 500));

        const statusResponse = await fetch(`${API_BASE}/api/v1/dast/graphql/scan/${scanId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!statusResponse.ok) {
          throw new Error('Failed to get scan status');
        }

        const { scan } = await statusResponse.json();
        setScanResult(scan);

        if (scan.status === 'completed' || scan.status === 'failed') {
          completed = true;
          setActiveTab('findings');
        }
      }
    } catch (error) {
      console.error('GraphQL scan error:', error);
      // Fallback to mock data for demo purposes
      await new Promise(r => setTimeout(r, 1500));
      setScanResult(prev => prev ? {
        ...prev,
        status: 'scanning',
        schema: mockSchema,
        progress: { phase: 'Testing operations...', percentage: 30 },
      } : null);

      const queries = mockSchema.operations.filter(o => o.type === 'query');
      const mutations = config.includeMutations ? mockSchema.operations.filter(o => o.type === 'mutation') : [];
      const allOps = [...queries, ...mutations];

      for (let i = 0; i < allOps.length; i++) {
        await new Promise(r => setTimeout(r, 300));
        setScanResult(prev => prev ? {
          ...prev,
          operationsTested: [
            ...prev.operationsTested,
            { name: allOps[i].name, type: allOps[i].type, status: 'tested' }
          ],
          progress: {
            phase: `Testing ${allOps[i].type}: ${allOps[i].name}`,
            percentage: 30 + Math.floor((70 * (i + 1)) / allOps.length),
            currentOperation: allOps[i].name,
          },
        } : null);
      }

      await new Promise(r => setTimeout(r, 500));
      const findings = mockFindings;
      setScanResult(prev => prev ? {
        ...prev,
        status: 'completed',
        completedAt: new Date().toISOString(),
        findings,
        operationsTested: allOps.map(o => ({ name: o.name, type: o.type, status: 'tested' as const })),
        summary: {
          totalOperations: allOps.length,
          queriesTested: queries.length,
          mutationsTested: mutations.length,
          totalFindings: findings.length,
          bySeverity: {
            high: findings.filter(f => f.severity === 'High').length,
            medium: findings.filter(f => f.severity === 'Medium').length,
            low: findings.filter(f => f.severity === 'Low').length,
            informational: findings.filter(f => f.severity === 'Informational').length,
          },
        },
        progress: { phase: 'Completed', percentage: 100 },
      } : null);
      setActiveTab('findings');
    }

    setIsScanning(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'Medium': return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'Low': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

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
                This feature demonstrates GraphQL security scanning with simulated findings.
                Real GraphQL DAST integration will be available in a future release.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/security')} className="text-muted-foreground hover:text-foreground">&#8592;</button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">GraphQL Security Scanner</h1>
              <p className="text-muted-foreground">Scan GraphQL endpoints with introspection-based discovery</p>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">GraphQL Endpoint Configuration</h2>

          <div className="space-y-4">
            {/* Endpoint URL */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">GraphQL Endpoint URL</label>
              <input
                type="url"
                value={config.endpoint}
                onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                placeholder="https://api.example.com/graphql"
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Introspection Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Enable Introspection Discovery</p>
                <p className="text-sm text-muted-foreground">Use GraphQL introspection to discover all queries and mutations</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, introspectionEnabled: !config.introspectionEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${config.introspectionEnabled ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${config.introspectionEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Include Mutations */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Test Mutations</p>
                <p className="text-sm text-muted-foreground">Include mutation operations in security testing (may modify data)</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, includeMutations: !config.includeMutations })}
                className={`w-12 h-6 rounded-full transition-colors ${config.includeMutations ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${config.includeMutations ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              {showAdvanced ? '\u25BC' : '\u25B6'} Advanced Settings
            </button>

            {showAdvanced && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                {/* Auth Header */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Authorization Header (optional)</label>
                  <input
                    type="text"
                    value={config.authHeader || ''}
                    onChange={(e) => setConfig({ ...config, authHeader: e.target.value })}
                    placeholder="Bearer your-token-here"
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* Max Depth */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Max Query Depth: {config.maxDepth}</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={config.maxDepth}
                    onChange={(e) => setConfig({ ...config, maxDepth: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                {/* Rate Limit */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Rate Limit (req/sec): {config.rateLimit}</label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={config.rateLimit}
                    onChange={(e) => setConfig({ ...config, rateLimit: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={runScan}
              disabled={!config.endpoint || isScanning}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isScanning && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isScanning ? 'Scanning...' : 'Start GraphQL Scan'}
            </button>
          </div>
        </div>

        {/* Scan Progress */}
        {scanResult && scanResult.status !== 'completed' && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center animate-pulse">
                  <span className="text-white">&#128302;</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{scanResult.progress?.phase}</p>
                  <p className="text-sm text-muted-foreground">
                    {scanResult.progress?.currentOperation && `Current: ${scanResult.progress.currentOperation}`}
                  </p>
                </div>
              </div>
              <span className="text-lg font-bold text-amber-600">{scanResult.progress?.percentage}%</span>
            </div>
            <div className="h-2 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${scanResult.progress?.percentage || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {scanResult && scanResult.status === 'completed' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Operations Discovered</p>
                <p className="text-2xl font-bold text-foreground">{scanResult.summary.totalOperations}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Queries Tested</p>
                <p className="text-2xl font-bold text-blue-600">{scanResult.summary.queriesTested}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Mutations Tested</p>
                <p className="text-2xl font-bold text-purple-600">{scanResult.summary.mutationsTested}</p>
              </div>
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
                <p className="text-sm text-muted-foreground">Security Findings</p>
                <p className="text-2xl font-bold text-red-600">{scanResult.summary.totalFindings}</p>
              </div>
            </div>

            {/* Severity Breakdown */}
            <div className="rounded-lg border border-border bg-card p-4 mb-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-sm text-foreground">High: {scanResult.summary.bySeverity.high}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="text-sm text-foreground">Medium: {scanResult.summary.bySeverity.medium}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-sm text-foreground">Low: {scanResult.summary.bySeverity.low}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                  <span className="text-sm text-foreground">Info: {scanResult.summary.bySeverity.informational}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab('schema')}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === 'schema' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Schema ({scanResult.schema?.types.length || 0} types)
                </button>
                <button
                  onClick={() => setActiveTab('operations')}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === 'operations' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Operations ({scanResult.operationsTested.length})
                </button>
                <button
                  onClick={() => setActiveTab('findings')}
                  className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === 'findings' ? 'text-red-600 border-b-2 border-red-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Findings ({scanResult.findings.length})
                </button>
              </div>

              <div className="p-4">
                {/* Schema Tab */}
                {activeTab === 'schema' && scanResult.schema && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">Query Type</p>
                        <p className="font-mono text-sm text-blue-600">{scanResult.schema.queryType || 'None'}</p>
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">Mutation Type</p>
                        <p className="font-mono text-sm text-purple-600">{scanResult.schema.mutationType || 'None'}</p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">Subscription Type</p>
                        <p className="font-mono text-sm text-green-600">{scanResult.schema.subscriptionType || 'None'}</p>
                      </div>
                    </div>

                    <h4 className="font-medium text-foreground">Discovered Types</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {scanResult.schema.types.map((type) => (
                        <div key={type.name} className="p-2 border border-border rounded text-sm">
                          <p className="font-mono text-foreground">{type.name}</p>
                          <p className="text-xs text-muted-foreground">{type.kind} - {type.fields} fields</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Operations Tab */}
                {activeTab === 'operations' && scanResult.schema && (
                  <div className="space-y-3">
                    {scanResult.schema.operations.map((op) => (
                      <div key={op.name} className={`p-3 border rounded-lg ${op.deprecated ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10' : 'border-border'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${op.type === 'query' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                            {op.type.toUpperCase()}
                          </span>
                          <span className="font-mono font-medium text-foreground">{op.name}</span>
                          {op.deprecated && (
                            <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">DEPRECATED</span>
                          )}
                          {scanResult.operationsTested.find(t => t.name === op.name)?.status === 'tested' && (
                            <span className="text-green-500">&#10003;</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{op.description}</p>
                        <div className="text-xs font-mono text-muted-foreground">
                          ({op.args.map(a => `${a.name}: ${a.type}${a.required ? '!' : ''}`).join(', ')}) {'->'} {op.returnType}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Findings Tab */}
                {activeTab === 'findings' && (
                  <div className="space-y-4">
                    {scanResult.findings.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-4xl mb-2">&#127881;</p>
                        <p className="text-muted-foreground">No security vulnerabilities found!</p>
                      </div>
                    ) : (
                      scanResult.findings.map((finding) => (
                        <div key={finding.id} className="p-4 border border-border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(finding.severity)}`}>
                                {finding.severity}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${finding.operationType === 'query' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                                {finding.operationType}
                              </span>
                              <span className="font-mono text-sm text-foreground">{finding.operationName}</span>
                            </div>
                            {finding.cweId && (
                              <span className="text-xs text-muted-foreground">CWE-{finding.cweId}</span>
                            )}
                          </div>
                          <h4 className="font-medium text-foreground mb-1">{finding.vulnerability}</h4>
                          <p className="text-sm text-muted-foreground mb-3">{finding.description}</p>

                          {finding.evidence && (
                            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm">
                              <span className="font-medium text-red-700 dark:text-red-300">Evidence: </span>
                              <span className="text-red-600 dark:text-red-400">{finding.evidence}</span>
                            </div>
                          )}

                          {finding.testedPayload && (
                            <div className="mb-3 p-2 bg-muted/50 rounded">
                              <p className="text-xs text-muted-foreground mb-1">Tested Payload:</p>
                              <pre className="text-xs font-mono text-foreground overflow-x-auto">{finding.testedPayload}</pre>
                            </div>
                          )}

                          <div className="pt-3 border-t border-border">
                            <p className="text-xs font-medium text-foreground mb-1">Recommended Solution:</p>
                            <p className="text-xs text-muted-foreground">{finding.solution}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!scanResult && !isScanning && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
            <p className="text-4xl mb-4">&#128302;</p>
            <p className="text-lg font-medium text-foreground mb-2">Configure and run a GraphQL security scan</p>
            <p className="text-muted-foreground">
              Enter your GraphQL endpoint above and enable introspection to automatically discover and test all queries and mutations for security vulnerabilities.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default DASTGraphQLPage;
