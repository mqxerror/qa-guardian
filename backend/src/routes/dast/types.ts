// DAST (Dynamic Application Security Testing) Types and Interfaces

// OpenAPI endpoint definition
export interface OpenAPIEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required?: boolean;
    type?: string;
  }>;
  requestBody?: {
    contentType: string;
    schema?: object;
  };
  responses?: Record<string, { description: string }>;
}

// OpenAPI specification storage
export interface OpenAPISpec {
  id: string;
  projectId: string;
  name: string;
  version: string;
  content: string;  // Raw OpenAPI JSON/YAML content
  endpoints: OpenAPIEndpoint[];
  uploadedAt: string;
  uploadedBy: string;
}

// DAST configuration for a project
export interface DASTConfig {
  enabled: boolean;
  targetUrl: string;
  scanProfile: 'baseline' | 'full' | 'api';  // ZAP scan profile
  authConfig?: {
    enabled: boolean;
    loginUrl?: string;
    usernameField?: string;
    passwordField?: string;
    submitSelector?: string;
    loggedInIndicator?: string;  // Text to detect successful login
    credentials?: {
      username: string;
      password: string;
    };
  };
  contextConfig?: {
    includeUrls?: string[];  // URLs to include in scan
    excludeUrls?: string[];  // URLs to exclude from scan
    maxCrawlDepth?: number;  // Maximum depth for spider/crawler (1-10, default 5)
  };
  alertThreshold: 'LOW' | 'MEDIUM' | 'HIGH';  // Minimum alert level to report
  autoScan: boolean;  // Auto-scan on schedule
  lastScanAt?: string;
  lastScanStatus?: 'pending' | 'running' | 'completed' | 'failed';
  openApiSpecId?: string;  // ID of uploaded OpenAPI spec for API scans
}

// DAST scan result
export interface DASTScanResult {
  id: string;
  projectId: string;
  targetUrl: string;
  scanProfile: 'baseline' | 'full' | 'api';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  alerts: DASTAlert[];
  summary: {
    total: number;
    byRisk: {
      high: number;
      medium: number;
      low: number;
      informational: number;
    };
    byConfidence: {
      high: number;
      medium: number;
      low: number;
    };
  };
  statistics?: {
    urlsScanned: number;
    requestsSent: number;
    duration: number;  // in seconds
  };
  error?: string;
  // API scan specific
  endpointsTested?: {
    total: number;
    tested: number;
    endpoints: Array<{
      path: string;
      method: string;
      status: 'tested' | 'skipped' | 'failed';
      alertCount: number;
    }>;
  };
  // Scope configuration used for the scan
  scopeConfig?: {
    includeUrls?: string[];
    excludeUrls?: string[];
    urlsFilteredOut?: number;  // Number of alerts filtered out due to scope
  };
  // Real-time progress tracking
  progress?: {
    phase: 'spider' | 'active_scan' | 'passive_scan' | 'analyzing' | 'complete';
    phaseDescription: string;
    percentage: number;
    urlsDiscovered: number;
    urlsScanned: number;
    alertsFound: number;
    estimatedTimeRemaining?: number;  // in seconds
    currentUrl?: string;
  };
}

// Risk levels for DAST alerts (OWASP ZAP standard)
export type DASTRisk = 'High' | 'Medium' | 'Low' | 'Informational';
export type DASTConfidence = 'High' | 'Medium' | 'Low' | 'User Confirmed' | 'False Positive';

// Individual DAST alert (OWASP ZAP finding)
export interface DASTAlert {
  id: string;
  pluginId: string;
  name: string;
  risk: DASTRisk;
  confidence: DASTConfidence;
  description: string;
  url: string;
  method: string;
  param?: string;
  attack?: string;
  evidence?: string;
  solution: string;
  reference?: string;
  cweId?: number;
  wascId?: number;
  tags?: string[];
  isFalsePositive?: boolean;
}

// False positive record for DAST
export interface DASTFalsePositive {
  id: string;
  projectId: string;
  pluginId: string;
  url: string;
  param?: string;
  reason: string;
  markedBy: string;
  markedAt: string;
}

// DAST schedule for recurring scans
export interface DASTSchedule {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  description?: string;
  frequency: 'hourly' | 'daily' | 'nightly' | 'weekly' | 'monthly';
  cronExpression: string;  // Generated from frequency and time settings
  timezone: string;
  enabled: boolean;
  scanProfile: 'baseline' | 'full' | 'api';
  targetUrl: string;
  notifyOnFailure: boolean;
  notifyOnHighSeverity: boolean;
  emailRecipients?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunId?: string;
  runCount: number;
}

// Report format type
export type ReportFormat = 'pdf' | 'html' | 'json';

// GraphQL specific types
export interface GraphQLSchema {
  queryType: string | null;
  mutationType: string | null;
  subscriptionType: string | null;
  operations: GraphQLOperation[];
  types: GraphQLType[];
}

export interface GraphQLOperation {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  args: Array<{ name: string; type: string; required: boolean }>;
  returnType: string;
  description?: string;
}

export interface GraphQLType {
  name: string;
  kind: 'OBJECT' | 'INPUT_OBJECT' | 'ENUM' | 'SCALAR' | 'INTERFACE' | 'UNION';
  fields?: Array<{ name: string; type: string }>;
  enumValues?: string[];
}

export interface GraphQLScanConfig {
  endpoint: string;
  introspectionEnabled: boolean;
  authHeader?: string;
  includeMutations: boolean;
  depthLimit: number;
}

export interface GraphQLFinding {
  id: string;
  operationName: string;
  operationType: 'query' | 'mutation' | 'subscription';
  severity: DASTRisk;
  vulnerability: string;
  description: string;
  cweId?: number;
  solution: string;
  evidence?: string;
}

export interface GraphQLScan {
  id: string;
  config: GraphQLScanConfig;
  status: 'introspecting' | 'scanning' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  schema?: GraphQLSchema;
  operationsTested: Array<{
    name: string;
    type: 'query' | 'mutation' | 'subscription';
    status: 'pending' | 'tested' | 'skipped';
  }>;
  findings: GraphQLFinding[];
  summary: {
    totalOperations: number;
    queriesTested: number;
    mutationsTested: number;
    totalFindings: number;
    bySeverity: {
      high: number;
      medium: number;
      low: number;
      informational: number;
    };
  };
  progress?: {
    phase: string;
    percentage: number;
    currentOperation?: string;
  };
  error?: string;
}
