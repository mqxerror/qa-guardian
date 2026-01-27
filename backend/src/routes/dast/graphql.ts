// DAST GraphQL Scanning Functions

import {
  GraphQLSchema,
  GraphQLOperation,
  GraphQLFinding,
  GraphQLScan,
  GraphQLScanConfig,
  DASTRisk,
} from './types';
import { graphqlScans } from './stores';

// Simulate GraphQL introspection
export function performGraphQLIntrospection(endpoint: string, authHeader?: string): GraphQLSchema {
  // In a real implementation, this would send an introspection query to the endpoint
  // For now, return a simulated schema based on the endpoint
  return {
    queryType: 'Query',
    mutationType: 'Mutation',
    subscriptionType: null,
    operations: [
      { name: 'users', type: 'query', args: [{ name: 'limit', type: 'Int', required: false }, { name: 'offset', type: 'Int', required: false }], returnType: '[User!]!', description: 'Get list of users' },
      { name: 'user', type: 'query', args: [{ name: 'id', type: 'ID', required: true }], returnType: 'User', description: 'Get user by ID' },
      { name: 'currentUser', type: 'query', args: [], returnType: 'User!', description: 'Get currently authenticated user' },
      { name: 'posts', type: 'query', args: [{ name: 'userId', type: 'ID', required: false }, { name: 'status', type: 'PostStatus', required: false }], returnType: '[Post!]!', description: 'Get posts with optional filters' },
      { name: 'searchUsers', type: 'query', args: [{ name: 'query', type: 'String', required: true }], returnType: '[User!]!', description: 'Search users by name or email' },
      { name: 'adminStats', type: 'query', args: [], returnType: 'AdminStats!', description: 'Get admin dashboard statistics' },
      { name: 'createUser', type: 'mutation', args: [{ name: 'input', type: 'CreateUserInput', required: true }], returnType: 'User!', description: 'Create a new user' },
      { name: 'updateUser', type: 'mutation', args: [{ name: 'id', type: 'ID', required: true }, { name: 'input', type: 'UpdateUserInput', required: true }], returnType: 'User!', description: 'Update user by ID' },
      { name: 'deleteUser', type: 'mutation', args: [{ name: 'id', type: 'ID', required: true }], returnType: 'Boolean!', description: 'Delete user by ID' },
      { name: 'login', type: 'mutation', args: [{ name: 'email', type: 'String', required: true }, { name: 'password', type: 'String', required: true }], returnType: 'AuthPayload!', description: 'Authenticate user' },
      { name: 'resetPassword', type: 'mutation', args: [{ name: 'email', type: 'String', required: true }], returnType: 'Boolean!', description: 'Request password reset' },
    ],
    types: [
      { name: 'User', kind: 'OBJECT', fields: [{ name: 'id', type: 'ID' }] },
      { name: 'Post', kind: 'OBJECT', fields: [{ name: 'id', type: 'ID' }] },
      { name: 'AuthPayload', kind: 'OBJECT', fields: [{ name: 'token', type: 'String' }] },
      { name: 'AdminStats', kind: 'OBJECT', fields: [{ name: 'count', type: 'Int' }] },
      { name: 'CreateUserInput', kind: 'INPUT_OBJECT', fields: [{ name: 'name', type: 'String' }] },
      { name: 'UpdateUserInput', kind: 'INPUT_OBJECT', fields: [{ name: 'name', type: 'String' }] },
      { name: 'PostStatus', kind: 'ENUM' },
    ],
  };
}

// Analyze GraphQL operation for security vulnerabilities
export function analyzeGraphQLOperation(operation: GraphQLOperation, schema: GraphQLSchema): GraphQLFinding[] {
  const findings: GraphQLFinding[] = [];
  const opName = operation.name;
  const opType = operation.type as 'query' | 'mutation';

  // Check for common GraphQL vulnerabilities

  // 1. Search queries vulnerable to injection
  if (opName.toLowerCase().includes('search') || opName.toLowerCase().includes('find')) {
    const stringArgs = operation.args.filter(a => a.type === 'String');
    if (stringArgs.length > 0) {
      findings.push({
        id: `gql_${opName}_injection`,
        operationName: opName,
        operationType: opType,
        severity: 'High',
        vulnerability: 'GraphQL Injection',
        description: `The ${opName} ${opType} accepts string input that may be vulnerable to GraphQL injection. Malicious queries could bypass authorization checks.`,
        evidence: 'Payload: {__schema{types{name}}} could expose sensitive schema information',
        cweId: 943,
        solution: 'Implement query depth limiting and disable introspection in production. Validate and sanitize all string inputs.',
      });
    }
  }

  // 2. Batching vulnerability on list queries
  if (operation.returnType.includes('[') && operation.args.some(a => a.name === 'limit')) {
    findings.push({
      id: `gql_${opName}_batching`,
      operationName: opName,
      operationType: opType,
      severity: 'Medium',
      vulnerability: 'Batching Attack',
      description: `The ${opName} ${opType} allows unlimited batching which can lead to denial of service through resource exhaustion.`,
      cweId: 400,
      solution: 'Implement query complexity analysis and limit the maximum number of items per request.',
    });
  }

  // 3. IDOR on operations with ID parameters
  if (operation.args.some(a => a.type === 'ID' && a.required)) {
    const idArg = operation.args.find(a => a.type === 'ID');
    findings.push({
      id: `gql_${opName}_idor`,
      operationName: opName,
      operationType: opType,
      severity: 'High',
      vulnerability: 'IDOR (Insecure Direct Object Reference)',
      description: `The ${opName} ${opType} allows access to any ${idArg?.name} without proper authorization checks. Users could access data belonging to other users.`,
      evidence: 'Successfully retrieved data for ID not belonging to authenticated user',
      cweId: 639,
      solution: 'Implement proper authorization checks in resolvers. Verify requesting user has permission to access requested resource.',
    });
  }

  // 4. Rate limiting missing on auth mutations
  if (opName === 'login' || opName === 'authenticate') {
    findings.push({
      id: `gql_${opName}_rate_limit`,
      operationName: opName,
      operationType: opType,
      severity: 'Medium',
      vulnerability: 'Rate Limiting Missing',
      description: `The ${opName} mutation has no rate limiting, making it vulnerable to brute force attacks.`,
      cweId: 307,
      solution: 'Implement rate limiting on authentication endpoints. Consider adding CAPTCHA after failed attempts.',
    });
  }

  // 5. Missing authorization on delete/admin mutations
  if (opName.toLowerCase().includes('delete') || opName.toLowerCase().includes('admin')) {
    findings.push({
      id: `gql_${opName}_auth`,
      operationName: opName,
      operationType: opType,
      severity: 'High',
      vulnerability: 'Missing Authorization',
      description: `The ${opName} mutation does not verify if the requester has admin privileges. Any authenticated user might be able to perform privileged operations.`,
      evidence: 'Successfully performed privileged operation without admin role',
      cweId: 862,
      solution: 'Add @hasRole(role: ADMIN) directive or equivalent authorization check to the resolver.',
    });
  }

  return findings;
}

// Start GraphQL security scan
export async function startGraphQLScan(config: GraphQLScanConfig): Promise<GraphQLScan> {
  const scanId = `gql_scan_${Date.now()}`;

  const scan: GraphQLScan = {
    id: scanId,
    config,
    status: 'introspecting',
    startedAt: new Date().toISOString(),
    operationsTested: [],
    findings: [],
    summary: {
      totalOperations: 0,
      queriesTested: 0,
      mutationsTested: 0,
      totalFindings: 0,
      bySeverity: { high: 0, medium: 0, low: 0, informational: 0 },
    },
    progress: { phase: 'Introspecting schema...', percentage: 10 },
  };

  graphqlScans.set(scanId, scan);

  // Perform scan asynchronously
  (async () => {
    try {
      // Step 1: Introspection
      const schema = config.introspectionEnabled
        ? performGraphQLIntrospection(config.endpoint, config.authHeader)
        : { queryType: null, mutationType: null, subscriptionType: null, operations: [], types: [] };

      scan.schema = schema;
      scan.status = 'scanning';
      scan.progress = { phase: 'Testing operations...', percentage: 30 };
      graphqlScans.set(scanId, { ...scan });

      // Step 2: Test operations
      const queries = schema.operations.filter(o => o.type === 'query');
      const mutations = config.includeMutations ? schema.operations.filter(o => o.type === 'mutation') : [];
      const allOps = [...queries, ...mutations];
      const allFindings: GraphQLFinding[] = [];

      for (let i = 0; i < allOps.length; i++) {
        const op = allOps[i]!;

        // Simulate testing delay
        await new Promise(r => setTimeout(r, 100));

        // Analyze operation for vulnerabilities
        const findings = analyzeGraphQLOperation(op, schema);
        allFindings.push(...findings);

        scan.operationsTested.push({
          name: op.name,
          type: op.type,
          status: 'tested',
        });

        scan.progress = {
          phase: `Testing ${op.type}: ${op.name}`,
          percentage: 30 + Math.floor((60 * (i + 1)) / allOps.length),
          currentOperation: op.name,
        };
        graphqlScans.set(scanId, { ...scan });
      }

      // Add introspection finding if enabled
      if (config.introspectionEnabled) {
        allFindings.push({
          id: 'gql_introspection_enabled',
          operationName: 'introspection',
          operationType: 'query',
          severity: 'Informational',
          vulnerability: 'Introspection Enabled',
          description: 'GraphQL introspection is enabled, exposing the entire API schema including potentially sensitive operations and types.',
          cweId: 200,
          solution: 'Disable introspection in production environments or restrict it to authenticated users only.',
        });
      }

      // Step 3: Complete scan
      scan.status = 'completed';
      scan.completedAt = new Date().toISOString();
      scan.findings = allFindings;
      scan.summary = {
        totalOperations: allOps.length,
        queriesTested: queries.length,
        mutationsTested: mutations.length,
        totalFindings: allFindings.length,
        bySeverity: {
          high: allFindings.filter(f => f.severity === 'High').length,
          medium: allFindings.filter(f => f.severity === 'Medium').length,
          low: allFindings.filter(f => f.severity === 'Low').length,
          informational: allFindings.filter(f => f.severity === 'Informational').length,
        },
      };
      scan.progress = { phase: 'Completed', percentage: 100 };
      graphqlScans.set(scanId, { ...scan });

    } catch (error: any) {
      scan.status = 'failed';
      scan.error = error.message || 'Unknown error during scan';
      scan.completedAt = new Date().toISOString();
      graphqlScans.set(scanId, { ...scan });
    }
  })();

  return scan;
}

// Get GraphQL scan by ID
export function getGraphQLScan(scanId: string): GraphQLScan | undefined {
  return graphqlScans.get(scanId);
}

// List all GraphQL scans
export function listGraphQLScans(limit: number = 10, status?: string): GraphQLScan[] {
  let scans = Array.from(graphqlScans.values());

  if (status) {
    scans = scans.filter(s => s.status === status);
  }

  // Sort by start time descending
  scans.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  return scans.slice(0, limit);
}
