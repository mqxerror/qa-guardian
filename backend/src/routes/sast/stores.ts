/**
 * SAST Module Stores
 *
 * In-memory data stores for SAST integration data.
 * Extracted from sast.ts (Feature #1376)
 *
 * Updated for Feature #2089: PostgreSQL migration
 * Now uses repository functions with in-memory fallback
 */

import {
  SASTConfig,
  SASTScanResult,
  FalsePositive,
  SASTPRCheck,
  SASTPRComment,
  SecretPattern,
  SecretPatternTemplate,
} from './types';
import { generateSimpleId } from '../../utils';

// Import repository functions
import * as sastRepo from '../../services/repositories/sast';

// Re-export repository functions for database access
export const getSASTConfig = sastRepo.getSASTConfig;
export const updateSASTConfig = sastRepo.updateSASTConfig;
export const deleteSASTConfig = sastRepo.deleteSASTConfig;

export const createSastScan = sastRepo.createSastScan;
export const getSastScan = sastRepo.getSastScan;
export const updateSastScan = sastRepo.updateSastScan;
export const getSastScansByProject = sastRepo.getSastScansByProject;
export const deleteSastScan = sastRepo.deleteSastScan;

export const getFalsePositives = sastRepo.getFalsePositives;
export const addFalsePositive = sastRepo.addFalsePositive;
export const removeFalsePositive = sastRepo.removeFalsePositive;

export const createSastPRCheck = sastRepo.createSastPRCheck;
export const getSastPRChecks = sastRepo.getSastPRChecks;
export const updateSastPRCheck = sastRepo.updateSastPRCheck;

export const createSastPRComment = sastRepo.createSastPRComment;
export const getSastPRComments = sastRepo.getSastPRComments;

export const getSecretPatterns = sastRepo.getSecretPatterns;
export const addSecretPattern = sastRepo.addSecretPattern;
export const updateSecretPattern = sastRepo.updateSecretPattern;
export const removeSecretPattern = sastRepo.removeSecretPattern;

// Backward compatible Map exports (from repository memory stores)
// These are kept for backward compatibility with existing code that uses Map operations
export const sastConfigs: Map<string, SASTConfig> = sastRepo.getMemorySastConfigs();
export const sastScans: Map<string, SASTScanResult[]> = sastRepo.getMemorySastScans();
export const falsePositives: Map<string, FalsePositive[]> = sastRepo.getMemoryFalsePositives();
export const sastPRChecks: Map<string, SASTPRCheck[]> = sastRepo.getMemorySastPRChecks();
export const sastPRComments: Map<string, SASTPRComment[]> = sastRepo.getMemorySastPRComments();
export const secretPatterns: Map<string, SecretPattern[]> = sastRepo.getMemorySecretPatterns();

// Default SAST config
export const DEFAULT_SAST_CONFIG: SASTConfig = {
  enabled: false,
  ruleset: 'default',
  severityThreshold: 'MEDIUM',
  autoScan: false,
};

// Semgrep rule categories
export const SEMGREP_RULESETS: Record<string, string> = {
  default: 'p/default',
  security: 'p/security-audit',
  owasp: 'p/owasp-top-ten',
  secrets: 'p/secrets',
  ci: 'p/ci',
};

/**
 * Generate unique ID
 * Feature #1360: Uses shared utility to reduce duplication
 */
export function generateId(): string {
  return generateSimpleId();
}

/**
 * Feature #1558: Common rule templates for Gitleaks
 * Pre-defined patterns users can use as starting points
 */
export const SECRET_PATTERN_TEMPLATES: SecretPatternTemplate[] = [
  {
    id: 'internal-api-key',
    name: 'Internal API Key',
    description: 'Detect internal API keys with custom prefix (modify pattern to match your prefix)',
    pattern: 'INTERNAL_[A-Za-z0-9]{32}',
    severity: 'HIGH',
    category: 'internal',
  },
  {
    id: 'custom-jwt-secret',
    name: 'Custom JWT Secret',
    description: 'Detect JWT secrets configured in your application',
    pattern: 'JWT_SECRET[=:\\s]*[\'"]?[A-Za-z0-9+/=]{32,}[\'"]?',
    severity: 'CRITICAL',
    category: 'auth',
  },
  {
    id: 'database-connection-string',
    name: 'Database Connection String',
    description: 'Detect database connection strings with credentials',
    pattern: '(postgres|mysql|mongodb|redis)://[^:]+:[^@]+@[^\\s]+',
    severity: 'CRITICAL',
    category: 'database',
  },
  {
    id: 'private-key-header',
    name: 'Private Key Header',
    description: 'Detect private key file contents',
    pattern: '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----',
    severity: 'CRITICAL',
    category: 'crypto',
  },
  {
    id: 'slack-webhook-url',
    name: 'Slack Webhook URL',
    description: 'Detect Slack incoming webhook URLs',
    pattern: 'https://hooks\\.slack\\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+',
    severity: 'HIGH',
    category: 'communication',
  },
  {
    id: 'sendgrid-api-key',
    name: 'SendGrid API Key',
    description: 'Detect SendGrid API keys',
    pattern: 'SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}',
    severity: 'HIGH',
    category: 'communication',
  },
  {
    id: 'twilio-account-sid',
    name: 'Twilio Account SID',
    description: 'Detect Twilio Account SIDs',
    pattern: 'AC[a-f0-9]{32}',
    severity: 'MEDIUM',
    category: 'communication',
  },
  {
    id: 'twilio-auth-token',
    name: 'Twilio Auth Token',
    description: 'Detect Twilio authentication tokens',
    pattern: 'TWILIO_AUTH_TOKEN[=:\\s]*[\'"]?[a-f0-9]{32}[\'"]?',
    severity: 'HIGH',
    category: 'communication',
  },
  {
    id: 'heroku-api-key',
    name: 'Heroku API Key',
    description: 'Detect Heroku API keys',
    pattern: 'HEROKU_API_KEY[=:\\s]*[\'"]?[A-Fa-f0-9-]{36}[\'"]?',
    severity: 'HIGH',
    category: 'platform',
  },
  {
    id: 'mailchimp-api-key',
    name: 'Mailchimp API Key',
    description: 'Detect Mailchimp API keys',
    pattern: '[a-f0-9]{32}-us[0-9]{1,2}',
    severity: 'HIGH',
    category: 'communication',
  },
  {
    id: 'generic-secret-assignment',
    name: 'Generic Secret Assignment',
    description: 'Detect assignments to variables named "secret" or "password"',
    pattern: '(password|secret|api_key|apikey|api-key)[=:\\s]*[\'"][^\'\"]{8,}[\'"]',
    severity: 'MEDIUM',
    category: 'generic',
  },
  {
    id: 'base64-encoded-secret',
    name: 'Base64 Encoded Secret',
    description: 'Detect base64 encoded secrets in configuration',
    pattern: 'SECRET_BASE64[=:\\s]*[\'"]?[A-Za-z0-9+/=]{40,}[\'"]?',
    severity: 'MEDIUM',
    category: 'generic',
  },
  // Feature #1561: Azure connection string patterns
  {
    id: 'azure-storage-connection',
    name: 'Azure Storage Connection String',
    description: 'Detect Azure Storage account connection strings with access keys',
    pattern: 'DefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{86,88}(;|$)',
    severity: 'CRITICAL',
    category: 'azure',
  },
  {
    id: 'azure-storage-account-key',
    name: 'Azure Storage Account Key',
    description: 'Detect standalone Azure Storage account keys',
    pattern: 'AccountKey[=:\\s]*[\'"]?[A-Za-z0-9+/=]{86,88}[\'"]?',
    severity: 'CRITICAL',
    category: 'azure',
  },
  {
    id: 'azure-sql-connection',
    name: 'Azure SQL Connection String',
    description: 'Detect Azure SQL Database connection strings with credentials',
    pattern: 'Server=tcp:[a-z0-9.-]+\\.database\\.windows\\.net[^;]*;.*Password=[^;]+',
    severity: 'CRITICAL',
    category: 'azure',
  },
  {
    id: 'azure-sql-password',
    name: 'Azure SQL Password',
    description: 'Detect passwords in Azure SQL connection strings',
    pattern: '(Server|Data Source)=[^;]*\\.database\\.windows\\.net[^;]*;[^;]*Password=[^;]+',
    severity: 'CRITICAL',
    category: 'azure',
  },
  {
    id: 'azure-service-bus',
    name: 'Azure Service Bus Connection String',
    description: 'Detect Azure Service Bus connection strings with shared access keys',
    pattern: 'Endpoint=sb://[a-z0-9.-]+\\.servicebus\\.windows\\.net/;SharedAccessKey[^;]*=[A-Za-z0-9+/=]+',
    severity: 'CRITICAL',
    category: 'azure',
  },
  {
    id: 'azure-cosmosdb-key',
    name: 'Azure Cosmos DB Key',
    description: 'Detect Azure Cosmos DB primary or secondary keys',
    pattern: 'AccountEndpoint=https://[a-z0-9.-]+\\.documents\\.azure\\.com[^;]*;AccountKey=[A-Za-z0-9+/=]{86,88}',
    severity: 'CRITICAL',
    category: 'azure',
  },
  {
    id: 'azure-cosmosdb-connection',
    name: 'Azure Cosmos DB Connection String',
    description: 'Detect Azure Cosmos DB MongoDB-compatible connection strings',
    pattern: 'mongodb://[^:]+:[^@]+@[a-z0-9.-]+\\.mongo\\.cosmos\\.azure\\.com',
    severity: 'CRITICAL',
    category: 'azure',
  },
  {
    id: 'azure-event-hub',
    name: 'Azure Event Hubs Connection String',
    description: 'Detect Azure Event Hubs connection strings',
    pattern: 'Endpoint=sb://[a-z0-9.-]+\\.servicebus\\.windows\\.net/;[^;]*SharedAccessKey=[A-Za-z0-9+/=]+',
    severity: 'HIGH',
    category: 'azure',
  },
  {
    id: 'azure-app-insights',
    name: 'Azure Application Insights Key',
    description: 'Detect Azure Application Insights instrumentation keys',
    pattern: 'InstrumentationKey=[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',
    severity: 'MEDIUM',
    category: 'azure',
  },
  {
    id: 'azure-client-secret',
    name: 'Azure AD Client Secret',
    description: 'Detect Azure Active Directory client secrets',
    pattern: 'AZURE_CLIENT_SECRET[=:\\s]*[\'"]?[A-Za-z0-9~._-]{34,}[\'"]?',
    severity: 'CRITICAL',
    category: 'azure',
  },
  // Feature #1562: GCP service account and API key patterns
  {
    id: 'gcp-api-key',
    name: 'GCP API Key',
    description: 'Detect Google Cloud Platform API keys (AIza prefix)',
    pattern: 'AIza[0-9A-Za-z_-]{35}',
    severity: 'HIGH',
    category: 'gcp',
  },
  {
    id: 'gcp-service-account-json',
    name: 'GCP Service Account JSON',
    description: 'Detect GCP service account JSON key files by type field',
    pattern: '"type"\\s*:\\s*"service_account"',
    severity: 'CRITICAL',
    category: 'gcp',
  },
  {
    id: 'gcp-private-key-id',
    name: 'GCP Private Key ID',
    description: 'Detect GCP private_key_id field in service account JSON',
    pattern: '"private_key_id"\\s*:\\s*"[a-f0-9]{40}"',
    severity: 'CRITICAL',
    category: 'gcp',
  },
  {
    id: 'gcp-private-key',
    name: 'GCP Private Key',
    description: 'Detect GCP private_key field containing RSA key',
    pattern: '"private_key"\\s*:\\s*"-----BEGIN (RSA )?PRIVATE KEY-----',
    severity: 'CRITICAL',
    category: 'gcp',
  },
  {
    id: 'gcp-oauth-client-secret',
    name: 'GCP OAuth Client Secret',
    description: 'Detect GCP OAuth 2.0 client secrets',
    pattern: 'GOOG[A-Za-z0-9_-]{28,32}',
    severity: 'HIGH',
    category: 'gcp',
  },
  {
    id: 'gcp-client-id',
    name: 'GCP Client ID',
    description: 'Detect GCP OAuth client IDs',
    pattern: '[0-9]+-[a-z0-9]+\\.apps\\.googleusercontent\\.com',
    severity: 'MEDIUM',
    category: 'gcp',
  },
  {
    id: 'gcp-service-account-email',
    name: 'GCP Service Account Email',
    description: 'Detect GCP service account email addresses',
    pattern: '"client_email"\\s*:\\s*"[a-z0-9-]+@[a-z0-9-]+\\.iam\\.gserviceaccount\\.com"',
    severity: 'HIGH',
    category: 'gcp',
  },
  {
    id: 'firebase-api-key',
    name: 'Firebase API Key',
    description: 'Detect Firebase/GCP API keys with Firebase config',
    pattern: 'apiKey:\\s*[\'"]AIza[0-9A-Za-z_-]{35}[\'"]',
    severity: 'HIGH',
    category: 'gcp',
  },
  // Feature #1563: Observability and alerting platform tokens
  {
    id: 'datadog-api-key',
    name: 'Datadog API Key',
    description: 'Detect Datadog API keys (32 hex characters)',
    pattern: 'DD_API_KEY[=:\\\\s]*[\'"]?[a-f0-9]{32}[\'"]?',
    severity: 'HIGH',
    category: 'observability',
  },
  {
    id: 'datadog-app-key',
    name: 'Datadog Application Key',
    description: 'Detect Datadog Application keys (40 hex characters)',
    pattern: 'DD_APP_KEY[=:\\\\s]*[\'"]?[a-f0-9]{40}[\'"]?',
    severity: 'HIGH',
    category: 'observability',
  },
  {
    id: 'datadog-api-key-inline',
    name: 'Datadog API Key (inline)',
    description: 'Detect Datadog API keys assigned to variables',
    pattern: '(datadog_api_key|DATADOG_API_KEY)[=:\\\\s]*[\'"]?[a-f0-9]{32}[\'"]?',
    severity: 'HIGH',
    category: 'observability',
  },
  {
    id: 'newrelic-license-key',
    name: 'New Relic License Key',
    description: 'Detect New Relic license keys (40 character alphanumeric ending in NRAL)',
    pattern: '[a-f0-9]{36}NRAL',
    severity: 'HIGH',
    category: 'observability',
  },
  {
    id: 'newrelic-api-key',
    name: 'New Relic API Key',
    description: 'Detect New Relic User API keys (NRAK prefix)',
    pattern: 'NRAK-[A-Z0-9]{27}',
    severity: 'HIGH',
    category: 'observability',
  },
  {
    id: 'newrelic-insights-key',
    name: 'New Relic Insights Key',
    description: 'Detect New Relic Insights insert/query keys (NRII/NRIQ prefix)',
    pattern: 'NRI[IQ]-[A-Za-z0-9_-]{32}',
    severity: 'HIGH',
    category: 'observability',
  },
  {
    id: 'pagerduty-api-token',
    name: 'PagerDuty API Token',
    description: 'Detect PagerDuty REST API tokens',
    pattern: 'PAGERDUTY[_-]?(API[_-]?)?TOKEN[=:\\\\s]*[\'"]?[A-Za-z0-9+/=_-]{20,}[\'"]?',
    severity: 'HIGH',
    category: 'alerting',
  },
  {
    id: 'pagerduty-integration-key',
    name: 'PagerDuty Integration Key',
    description: 'Detect PagerDuty Events API integration keys (32 hex characters)',
    pattern: '(pagerduty[_-]?integration[_-]?key|PAGERDUTY_INTEGRATION_KEY)[=:\\\\s]*[\'"]?[a-f0-9]{32}[\'"]?',
    severity: 'HIGH',
    category: 'alerting',
  },
  {
    id: 'opsgenie-api-key',
    name: 'OpsGenie API Key',
    description: 'Detect OpsGenie API keys (36 character UUIDs)',
    pattern: '(opsgenie[_-]?api[_-]?key|OPSGENIE_API_KEY)[=:\\\\s]*[\'"]?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[\'"]?',
    severity: 'HIGH',
    category: 'alerting',
  },
  {
    id: 'opsgenie-api-key-inline',
    name: 'OpsGenie API Key (inline)',
    description: 'Detect OpsGenie GenieKey header values',
    pattern: 'GenieKey\\s+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',
    severity: 'HIGH',
    category: 'alerting',
  },
  // Feature #1564: Firebase credentials detection
  {
    id: 'firebase-server-key',
    name: 'Firebase Cloud Messaging Server Key',
    description: 'Detect Firebase Cloud Messaging (FCM) server keys - PRIVATE, must not be exposed',
    pattern: 'AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}',
    severity: 'CRITICAL',
    category: 'firebase',
  },
  {
    id: 'firebase-database-url',
    name: 'Firebase Realtime Database URL',
    description: 'Detect Firebase Realtime Database URLs (can reveal project structure)',
    pattern: 'https://[a-z0-9-]+\\.firebaseio\\.com',
    severity: 'MEDIUM',
    category: 'firebase',
  },
  {
    id: 'firebase-database-url-region',
    name: 'Firebase Realtime Database URL (regional)',
    description: 'Detect regional Firebase Realtime Database URLs',
    pattern: 'https://[a-z0-9-]+\\.[a-z]+-[a-z]+[0-9]?\\.firebasedatabase\\.app',
    severity: 'MEDIUM',
    category: 'firebase',
  },
  {
    id: 'firebase-admin-sdk-private-key',
    name: 'Firebase Admin SDK Private Key',
    description: 'Detect Firebase Admin SDK service account private keys',
    pattern: '"private_key"\\s*:\\s*"-----BEGIN PRIVATE KEY-----[^"]+-----END PRIVATE KEY-----\\\\n"',
    severity: 'CRITICAL',
    category: 'firebase',
  },
  {
    id: 'firebase-service-account-json',
    name: 'Firebase Service Account JSON',
    description: 'Detect Firebase/GCP service account JSON by project_id field with firebase suffix',
    pattern: '"project_id"\\s*:\\s*"[a-z0-9-]+-firebase"',
    severity: 'HIGH',
    category: 'firebase',
  },
  {
    id: 'firebase-web-api-key-exposed',
    name: 'Firebase Web API Key (in backend code)',
    description: 'Detect Firebase API keys in backend/server code where they should not be - web apiKey is public but server code should use service accounts',
    pattern: '(FIREBASE_API_KEY|firebase[_-]?api[_-]?key)[=:\\\\s]*[\'"]?AIza[0-9A-Za-z_-]{35}[\'"]?',
    severity: 'MEDIUM',
    category: 'firebase',
  },
  {
    id: 'firebase-storage-bucket',
    name: 'Firebase Storage Bucket',
    description: 'Detect Firebase Storage bucket URLs',
    pattern: 'gs://[a-z0-9-]+\\.appspot\\.com',
    severity: 'LOW',
    category: 'firebase',
  },
  {
    id: 'firebase-dynamic-links',
    name: 'Firebase Dynamic Links Domain',
    description: 'Detect Firebase Dynamic Links domains',
    pattern: 'https://[a-z0-9-]+\\.page\\.link',
    severity: 'LOW',
    category: 'firebase',
  },
];
