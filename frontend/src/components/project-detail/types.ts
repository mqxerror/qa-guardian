/**
 * Types for Project Detail Page
 * Extracted from ProjectDetailPage.tsx for modularity (Feature #49)
 */

// Project interface
export interface Project {
  id: string;
  name: string;
  description?: string;
  slug: string;
  base_url?: string;
  default_browser?: string;
  viewport_profiles?: ViewportProfile[];
  created_at: string;
}

export interface ViewportProfile {
  name: string;
  width: number;
  height: number;
}

// Feature #656: Import canonical TestSuite from shared location
export { type TestSuite } from '../../hooks/api/useSuites';

// Project members
export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: 'developer' | 'viewer';
  added_at: string;
  added_by: string;
}

export interface OrgMember {
  user_id: string;
  organization_id: string;
  role: string;
  id?: string;
  email?: string;
  name?: string;
}

// Alert channels
export type AlertChannelType = 'email' | 'slack' | 'webhook';
export type AlertCondition = 'any_failure' | 'all_failures' | 'threshold';

export interface AlertChannel {
  id: string;
  name: string;
  type: AlertChannelType;
  enabled: boolean;
  condition: AlertCondition;
  threshold_percent?: number;
  suppress_on_retry_success?: boolean;
  email_addresses?: string[];
  webhook_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AlertHistoryEntry {
  id: string;
  timestamp: string;
  type: 'email' | 'webhook';
  channelId: string;
  channelName: string;
  projectId: string;
  runId: string;
  success: boolean;
  error?: string;
  details: {
    recipients?: string[];
    subject?: string;
    webhookUrl?: string;
    responseStatus?: number;
  };
}

// Environment variables
export interface EnvironmentVariable {
  id: string;
  project_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

// Healing settings
export interface HealingSettings {
  healing_enabled: boolean;
  healing_timeout: number;
  max_healing_attempts: number;
  healing_strategies: string[];
  notify_on_healing: boolean;
}

export const DEFAULT_HEALING_SETTINGS: HealingSettings = {
  healing_enabled: true,
  healing_timeout: 30,
  max_healing_attempts: 3,
  healing_strategies: ['selector_fallback', 'visual_match', 'text_match', 'attribute_match'],
  notify_on_healing: false,
};

// Edit selector modal
export interface EditSelectorModalState {
  isOpen: boolean;
  runId: string;
  testId: string;
  stepId: string;
  currentSelector: string;
  originalSelector: string;
  wasHealed: boolean;
}

// Vision healing result
export interface VisionHealingResult {
  found: boolean;
  confidence: number;
  matched_element: {
    location: { x: number; y: number; width: number; height: number };
    visual_similarity: number;
    text_match?: string;
    attributes_match: Record<string, string>;
  } | null;
  suggested_selectors: Array<{
    selector: string;
    type: string;
    confidence: number;
    reason: string;
    best_practice: boolean;
  }>;
  healing_strategy: string;
  analysis: {
    element_type: string;
    visual_characteristics: string[];
    text_content?: string;
    nearby_elements: string[];
    page_context: string;
  };
  approval_required: boolean;
  auto_heal_recommended: boolean;
}

// GitHub integration
export interface GitHubConnection {
  id: string;
  github_owner: string;
  github_repo: string;
  github_branch: string;
  test_path: string;
  connected_at: string;
  last_synced_at?: string;
}

export interface GitHubTestFile {
  path: string;
  name: string;
  type: 'spec' | 'test';
}

export interface GitHubRepository {
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
}

export interface PullRequest {
  number: number;
  title: string;
  head_sha: string;
  branch: string;
  status_check?: { status: string } | null;
}

// SAST types
export type SASTSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface CustomRule {
  id: string;
  name: string;
  yaml: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SASTConfig {
  enabled: boolean;
  ruleset: 'default' | 'security' | 'custom';
  customRules?: string[];
  customRulesYaml?: CustomRule[];
  excludePaths?: string[];
  severityThreshold: SASTSeverity;
  autoScan: boolean;
  lastScanAt?: string;
  lastScanStatus?: 'pending' | 'running' | 'completed' | 'failed';
  prChecksEnabled?: boolean;
  prCommentsEnabled?: boolean;
  blockPrOnCritical?: boolean;
  blockPrOnHigh?: boolean;
}

export interface RemediationGuidance {
  summary: string;
  steps: string[];
  secureCodeExample?: {
    before: string;
    after: string;
    language: string;
  };
  references: {
    title: string;
    url: string;
  }[];
}

export interface SASTFinding {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: SASTSeverity;
  category: string;
  message: string;
  filePath: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  snippet?: string;
  cweId?: string;
  owaspCategory?: string;
  suggestion?: string;
  remediation?: RemediationGuidance;
  isFalsePositive?: boolean;
}

export interface FalsePositive {
  id: string;
  projectId: string;
  ruleId: string;
  filePath: string;
  line: number;
  snippet?: string;
  reason: string;
  markedBy: string;
  markedAt: string;
}

export interface SASTScanResult {
  id: string;
  projectId: string;
  repositoryUrl?: string;
  branch?: string;
  commitSha?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  findings: SASTFinding[];
  summary: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byCategory: Record<string, number>;
  };
  error?: string;
}

export interface SASTRuleset {
  id: string;
  name: string;
  description: string;
}

// Secret patterns
export interface SecretPattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  severity: SASTSeverity;
  category: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// DAST types
export type DASTRisk = 'High' | 'Medium' | 'Low' | 'Informational';
export type DASTConfidence = 'High' | 'Medium' | 'Low' | 'User Confirmed' | 'False Positive';

export interface DASTConfig {
  enabled: boolean;
  targetUrl: string;
  scanProfile: 'baseline' | 'full' | 'api';
  alertThreshold: 'LOW' | 'MEDIUM' | 'HIGH';
  autoScan: boolean;
  lastScanAt?: string;
  lastScanStatus?: 'pending' | 'running' | 'completed' | 'failed';
  contextConfig?: {
    includeUrls?: string[];
    excludeUrls?: string[];
    maxCrawlDepth?: number;
  };
  authConfig?: {
    enabled: boolean;
    loginUrl?: string;
    usernameField?: string;
    passwordField?: string;
    submitSelector?: string;
    loggedInIndicator?: string;
    credentials?: {
      username: string;
      password: string;
    };
  };
}

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
  isFalsePositive?: boolean;
}

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
    byRisk: { high: number; medium: number; low: number; informational: number };
    byConfidence: { high: number; medium: number; low: number };
  };
  statistics?: { urlsScanned: number; requestsSent: number; duration: number };
  error?: string;
  progress?: {
    phase: string;
    percentage: number;
    currentUrl?: string;
    urlsScanned?: number;
    totalUrls?: number;
    urlsDiscovered?: number;
    alertsFound?: number;
    phaseDescription?: string;
    estimatedTimeRemaining?: number;
  };
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
}

// OpenAPI Specification
export interface OpenAPIEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
}

export interface OpenAPISpec {
  id: string;
  name: string;
  version: string;
  endpoints: OpenAPIEndpoint[];
  endpointCount: number;
  uploadedAt: string;
  uploadedBy: string;
}

// PR Dependency Scanning
export interface PRDependencyScanResult {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    new_in_pr: number;
    fixed_in_pr: number;
  };
}

// Device presets for viewport selection
export interface DevicePreset {
  width: number;
  height: number;
  label: string;
}

export const DEVICE_PRESETS: Record<string, DevicePreset> = {
  desktop: { width: 1280, height: 720, label: 'Desktop (1280x720)' },
  'desktop-hd': { width: 1920, height: 1080, label: 'Desktop HD (1920x1080)' },
  'iphone-14': { width: 390, height: 844, label: 'iPhone 14 (390x844)' },
  'iphone-14-pro-max': { width: 430, height: 932, label: 'iPhone 14 Pro Max (430x932)' },
  'iphone-se': { width: 375, height: 667, label: 'iPhone SE (375x667)' },
  'pixel-7': { width: 412, height: 915, label: 'Pixel 7 (412x915)' },
  'samsung-s23': { width: 360, height: 780, label: 'Samsung S23 (360x780)' },
  'ipad': { width: 768, height: 1024, label: 'iPad (768x1024)' },
  'ipad-pro': { width: 1024, height: 1366, label: 'iPad Pro (1024x1366)' },
  custom: { width: 0, height: 0, label: 'Custom' },
};

// Tab types
export type ProjectTab = 'suites' | 'settings' | 'github' | 'security';

// Slack channel
export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}
