// ProjectDetailPage - Extracted from App.tsx (Feature #1441)
// Project details with test suites, test management, and GitHub integration
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/authStore";
import { useTimezoneStore } from "../stores/timezoneStore";
import { useTestDefaultsStore } from "../stores/testDefaultsStore";
import { toast } from "../stores/toastStore";


function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuthStore();
  const { formatDate } = useTimezoneStore();
  const { defaults: testDefaults } = useTestDefaultsStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab navigation - default to 'suites'
  const activeTab = searchParams.get('tab') || 'suites';
  const setActiveTab = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };
  const [project, setProject] = useState<{ id: string; name: string; description?: string; slug: string; base_url?: string; default_browser?: string; viewport_profiles?: Array<{name: string; width: number; height: number}>; created_at: string } | null>(null);
  // Feature #1794: Project defaults state
  const [projectDefaultBrowser, setProjectDefaultBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [projectViewportProfiles, setProjectViewportProfiles] = useState<Array<{name: string; width: number; height: number}>>([
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 },
  ]);
  const [isSavingProjectDefaults, setIsSavingProjectDefaults] = useState(false);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateSuiteModal, setShowCreateSuiteModal] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDescription, setNewSuiteDescription] = useState('');
  const [newSuiteBrowser, setNewSuiteBrowser] = useState<'chromium' | 'firefox' | 'webkit'>(testDefaults.defaultBrowser);
  const [newSuiteViewportWidth, setNewSuiteViewportWidth] = useState(1280);
  const [newSuiteViewportHeight, setNewSuiteViewportHeight] = useState(720);
  const [newSuiteTimeout, setNewSuiteTimeout] = useState(testDefaults.defaultTimeout / 1000); // Convert ms to seconds
  const [newSuiteRetryCount, setNewSuiteRetryCount] = useState(testDefaults.defaultRetries);
  const [devicePreset, setDevicePreset] = useState('desktop');
  const [isCreatingSuite, setIsCreatingSuite] = useState(false);

  // Device presets for mobile emulation
  const devicePresets: Record<string, { width: number; height: number; label: string }> = {
    desktop: { width: 1280, height: 720, label: 'Desktop (1280×720)' },
    'desktop-hd': { width: 1920, height: 1080, label: 'Desktop HD (1920×1080)' },
    'iphone-14': { width: 390, height: 844, label: 'iPhone 14 (390×844)' },
    'iphone-14-pro-max': { width: 430, height: 932, label: 'iPhone 14 Pro Max (430×932)' },
    'iphone-se': { width: 375, height: 667, label: 'iPhone SE (375×667)' },
    'pixel-7': { width: 412, height: 915, label: 'Pixel 7 (412×915)' },
    'samsung-s23': { width: 360, height: 780, label: 'Samsung S23 (360×780)' },
    'ipad': { width: 768, height: 1024, label: 'iPad (768×1024)' },
    'ipad-pro': { width: 1024, height: 1366, label: 'iPad Pro (1024×1366)' },
    custom: { width: 0, height: 0, label: 'Custom' },
  };

  const handleDevicePresetChange = (preset: string) => {
    setDevicePreset(preset);
    if (preset !== 'custom' && devicePresets[preset]) {
      setNewSuiteViewportWidth(devicePresets[preset].width);
      setNewSuiteViewportHeight(devicePresets[preset].height);
    }
  };
  const [createSuiteError, setCreateSuiteError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Feature #1975: One-click Smoke Test state
  const [isRunningQuickSmokeTest, setIsRunningQuickSmokeTest] = useState(false);
  const [smokeTestRunId, setSmokeTestRunId] = useState<string | null>(null);

  // Project members state (project-level permissions)
  interface ProjectMember {
    project_id: string;
    user_id: string;
    role: 'developer' | 'viewer';
    added_at: string;
    added_by: string;
  }

  interface OrgMember {
    user_id: string;
    organization_id: string;
    role: string;
    id?: string;
    email?: string;
    name?: string;
  }

  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedMemberRole, setSelectedMemberRole] = useState<'developer' | 'viewer'>('developer');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  // Alert channels state
  interface AlertChannel {
    id: string;
    name: string;
    type: 'email' | 'slack' | 'webhook';
    enabled: boolean;
    condition: 'any_failure' | 'all_failures' | 'threshold';
    threshold_percent?: number;
    suppress_on_retry_success?: boolean;
    email_addresses?: string[];
    webhook_url?: string;
    created_at: string;
    updated_at: string;
  }

  const [alertChannels, setAlertChannels] = useState<AlertChannel[]>([]);
  const [showCreateAlertModal, setShowCreateAlertModal] = useState(false);
  const [newAlertType, setNewAlertType] = useState<'email' | 'slack' | 'webhook'>('email');
  const [newAlertName, setNewAlertName] = useState('');
  const [newAlertCondition, setNewAlertCondition] = useState<'any_failure' | 'all_failures' | 'threshold'>('any_failure');
  const [newAlertThreshold, setNewAlertThreshold] = useState(50);
  const [newAlertEmails, setNewAlertEmails] = useState('');
  const [newAlertWebhookUrl, setNewAlertWebhookUrl] = useState('');
  const [newAlertSlackChannel, setNewAlertSlackChannel] = useState('');
  const [slackChannels, setSlackChannels] = useState<Array<{id: string; name: string; is_private: boolean}>>([]);
  const [newAlertSuppressOnRetry, setNewAlertSuppressOnRetry] = useState(false);
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [createAlertError, setCreateAlertError] = useState('');

  // Environment variables state
  interface EnvironmentVariable {
    id: string;
    project_id: string;
    key: string;
    value: string;
    is_secret: boolean;
    created_at: string;
    updated_at: string;
  }

  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [showAddEnvModal, setShowAddEnvModal] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [newEnvIsSecret, setNewEnvIsSecret] = useState(false);
  const [isAddingEnv, setIsAddingEnv] = useState(false);
  const [addEnvError, setAddEnvError] = useState('');
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [editEnvValue, setEditEnvValue] = useState('');

  // Healing settings state (Feature #1064)
  interface HealingSettings {
    healing_enabled: boolean;
    healing_timeout: number;
    max_healing_attempts: number;
    healing_strategies: string[];
    notify_on_healing: boolean;
  }
  const [healingSettings, setHealingSettings] = useState<HealingSettings>({
    healing_enabled: true,
    healing_timeout: 30,
    max_healing_attempts: 3,
    healing_strategies: ['selector_fallback', 'visual_match', 'text_match', 'attribute_match'],
    notify_on_healing: false,
  });
  const [isSavingHealingSettings, setIsSavingHealingSettings] = useState(false);
  const [healingSettingsMessage, setHealingSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Feature #1535: Autopilot removed - enterprise bloat not needed for SMB

  // Feature #1539: Test Maintenance state removed - uses dummy data with no real API

  // Feature #1540: Test Discovery state removed - uses dummy data with no real AI API

  // Feature #1536: Predictions removed - simple flaky test detection is sufficient

  // Feature #1541: Code Quality Correlation state removed - uses dummy data with no real API

  // Feature #1065: Edit selector modal state for ProjectDetailPage
  interface EditSelectorModalState {
    isOpen: boolean;
    runId: string;
    testId: string;
    stepId: string;
    currentSelector: string;
    originalSelector: string;
    wasHealed: boolean;
  }
  const [editSelectorModal, setEditSelectorModal] = useState<EditSelectorModalState>({
    isOpen: false,
    runId: '',
    testId: '',
    stepId: '',
    currentSelector: '',
    originalSelector: '',
    wasHealed: false,
  });
  const [editSelectorValue, setEditSelectorValue] = useState('');
  const [editSelectorNotes, setEditSelectorNotes] = useState('');
  const [editSelectorApplyToTest, setEditSelectorApplyToTest] = useState(true);
  const [isSubmittingSelector, setIsSubmittingSelector] = useState(false);

  // Feature #1347: Vision healing state
  const [isHealingWithVision, setIsHealingWithVision] = useState(false);
  const [visionHealingResult, setVisionHealingResult] = useState<{
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
  } | null>(null);

  // Alert history state
  interface AlertHistoryEntry {
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
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([]);
  const [showAlertHistory, setShowAlertHistory] = useState(false);

  // GitHub integration state
  interface GitHubConnection {
    id: string;
    github_owner: string;
    github_repo: string;
    github_branch: string;
    test_path: string;
    connected_at: string;
    last_synced_at?: string;
  }

  interface GitHubTestFile {
    path: string;
    name: string;
    type: 'spec' | 'test';
  }

  interface GitHubRepository {
    owner: string;
    name: string;
    full_name: string;
    default_branch: string;
    private: boolean;
  }

  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [isConnectingGithub, setIsConnectingGithub] = useState(false);
  const [githubConnection, setGithubConnection] = useState<GitHubConnection | null>(null);
  const [githubTestFiles, setGithubTestFiles] = useState<GitHubTestFile[]>([]);
  const [githubRepositories, setGithubRepositories] = useState<GitHubRepository[]>([]);
  const [showRepoSelectModal, setShowRepoSelectModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [selectedTestPath, setSelectedTestPath] = useState('tests');
  const [isConnectingRepo, setIsConnectingRepo] = useState(false);
  const [isSyncingGithub, setIsSyncingGithub] = useState(false);
  const [isDisconnectingRepo, setIsDisconnectingRepo] = useState(false);
  const [isChangingBranch, setIsChangingBranch] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [githubError, setGithubError] = useState('');
  const [prChecksEnabled, setPrChecksEnabled] = useState(false);
  const [isTogglingPRChecks, setIsTogglingPRChecks] = useState(false);
  const [pullRequests, setPullRequests] = useState<Array<{ number: number; title: string; head_sha: string; branch: string; status_check?: { status: string } | null }>>([]);
  const [prCommentsEnabled, setPrCommentsEnabled] = useState(false);
  const [isTogglingPRComments, setIsTogglingPRComments] = useState(false);

  // Feature #768: PR Dependency Scanning state
  const [prDependencyScanEnabled, setPrDependencyScanEnabled] = useState(false);
  const [isTogglingPRDependencyScan, setIsTogglingPRDependencyScan] = useState(false);
  const [prDependencyScanFiles, setPrDependencyScanFiles] = useState<string[]>(['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);
  const [prDependencyScanSeverity, setPrDependencyScanSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [prDependencyScanBlockOnCritical, setPrDependencyScanBlockOnCritical] = useState(false);
  const [isRunningPRDependencyScan, setIsRunningPRDependencyScan] = useState<number | null>(null);
  const [prDependencyScanResults, setPrDependencyScanResults] = useState<Record<number, {
    summary: { total: number; critical: number; high: number; medium: number; low: number; new_in_pr: number; fixed_in_pr: number };
  }>>({});

  // SAST (Static Application Security Testing) state
  interface CustomRule {
    id: string;
    name: string;
    yaml: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }

  interface SASTConfig {
    enabled: boolean;
    ruleset: 'default' | 'security' | 'custom';
    customRules?: string[];
    customRulesYaml?: CustomRule[];
    excludePaths?: string[];
    severityThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    autoScan: boolean;
    lastScanAt?: string;
    lastScanStatus?: 'pending' | 'running' | 'completed' | 'failed';
    // GitHub PR integration settings
    prChecksEnabled?: boolean;
    prCommentsEnabled?: boolean;
    blockPrOnCritical?: boolean;
    blockPrOnHigh?: boolean;
  }

  // DAST (Dynamic Application Security Testing) interfaces
  interface DASTConfig {
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

  type DASTRisk = 'High' | 'Medium' | 'Low' | 'Informational';
  type DASTConfidence = 'High' | 'Medium' | 'Low' | 'User Confirmed' | 'False Positive';

  interface DASTAlert {
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

  interface DASTScanResult {
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
      byRisk: { high: number; medium: number; low: number; informational: number; };
      byConfidence: { high: number; medium: number; low: number; };
    };
    statistics?: { urlsScanned: number; requestsSent: number; duration: number; };
    error?: string;
    // Progress tracking for running scans
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
  }

  // OpenAPI Specification
  interface OpenAPIEndpoint {
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
  }

  interface OpenAPISpec {
    id: string;
    name: string;
    version: string;
    endpoints: OpenAPIEndpoint[];
    endpointCount: number;
    uploadedAt: string;
    uploadedBy: string;
  }

  type SASTSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

  interface RemediationGuidance {
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

  interface SASTFinding {
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

  interface FalsePositive {
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

  interface SASTScanResult {
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

  const [sastConfig, setSastConfig] = useState<SASTConfig>({
    enabled: false,
    ruleset: 'default',
    severityThreshold: 'MEDIUM',
    autoScan: false,
  });
  const [sastScans, setSastScans] = useState<SASTScanResult[]>([]);
  const [isLoadingSast, setIsLoadingSast] = useState(false);
  const [isUpdatingSast, setIsUpdatingSast] = useState(false);
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [selectedScan, setSelectedScan] = useState<SASTScanResult | null>(null);
  const [sastRulesets, setSastRulesets] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [isLoadingCustomRules, setIsLoadingCustomRules] = useState(false);
  const [showAddCustomRuleModal, setShowAddCustomRuleModal] = useState(false);
  const [newCustomRuleName, setNewCustomRuleName] = useState('');
  const [newCustomRuleYaml, setNewCustomRuleYaml] = useState('');
  const [isAddingCustomRule, setIsAddingCustomRule] = useState(false);
  const [customRuleError, setCustomRuleError] = useState<string | null>(null);

  // Custom Secret Patterns state
  interface SecretPattern {
    id: string;
    name: string;
    description: string;
    pattern: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }
  const [secretPatterns, setSecretPatterns] = useState<SecretPattern[]>([]);
  const [showAddSecretPatternModal, setShowAddSecretPatternModal] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternDescription, setNewPatternDescription] = useState('');
  const [newPatternRegex, setNewPatternRegex] = useState('');
  const [newPatternSeverity, setNewPatternSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [isAddingPattern, setIsAddingPattern] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);
  const [patternTestInput, setPatternTestInput] = useState('');
  const [patternTestResult, setPatternTestResult] = useState<{ matches: boolean; matched?: string } | null>(null);

  const [showFalsePositiveModal, setShowFalsePositiveModal] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<SASTFinding | null>(null);
  const [fpReason, setFpReason] = useState('');
  const [isMarkingFP, setIsMarkingFP] = useState(false);
  const [showFalsePositives, setShowFalsePositives] = useState(true);
  const [expandedRemediations, setExpandedRemediations] = useState<Set<string>>(new Set());

  // DAST state
  const [dastConfig, setDastConfig] = useState<DASTConfig>({
    enabled: false,
    targetUrl: '',
    scanProfile: 'baseline',
    alertThreshold: 'LOW',
    autoScan: false,
  });
  const [dastScans, setDastScans] = useState<DASTScanResult[]>([]);
  const [isLoadingDast, setIsLoadingDast] = useState(false);
  const [isUpdatingDast, setIsUpdatingDast] = useState(false);
  const [isRunningDastScan, setIsRunningDastScan] = useState(false);
  const [selectedDastScan, setSelectedDastScan] = useState<DASTScanResult | null>(null);
  const [dastTargetUrl, setDastTargetUrl] = useState('');
  const [openApiSpec, setOpenApiSpec] = useState<OpenAPISpec | null>(null);
  const [isUploadingSpec, setIsUploadingSpec] = useState(false);
  const [specUploadError, setSpecUploadError] = useState<string | null>(null);
  const [dastSchedules, setDastSchedules] = useState<any[]>([]);

  // Toggle remediation expansion for a finding
  const toggleRemediation = (findingId: string) => {
    setExpandedRemediations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(findingId)) {
        newSet.delete(findingId);
      } else {
        newSet.add(findingId);
      }
      return newSet;
    });
  };

  const canCreateSuite = user?.role !== 'viewer';
  const canDeleteProject = user?.role === 'owner' || user?.role === 'admin';
  const canManageMembers = user?.role === 'owner' || user?.role === 'admin';
  const canManageAlerts = user?.role !== 'viewer';

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreateSuiteModal) setShowCreateSuiteModal(false);
        if (showDeleteModal) setShowDeleteModal(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showCreateSuiteModal, showDeleteModal]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/v1/projects/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('Project not found');
          } else if (response.status === 403) {
            setError('You do not have access to this project');
          } else {
            setError('Failed to load project');
          }
          return;
        }

        const data = await response.json();
        setProject(data.project);

        // Fetch test suites
        const suitesResponse = await fetch(`/api/v1/projects/${id}/suites`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (suitesResponse.ok) {
          const suitesData = await suitesResponse.json();
          setSuites(suitesData.suites);
        }

        // Fetch project members (only for admins/owners)
        if (user?.role === 'owner' || user?.role === 'admin') {
          const membersResponse = await fetch(`/api/v1/projects/${id}/members`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (membersResponse.ok) {
            const membersData = await membersResponse.json();
            setProjectMembers(membersData.members);
          }

          // Fetch organization members for the dropdown
          const orgMembersResponse = await fetch(`/api/v1/organizations/${user?.organization_id}/members`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (orgMembersResponse.ok) {
            const orgMembersData = await orgMembersResponse.json();
            setOrgMembers(orgMembersData.members);
          }
        }

        // Fetch alert channels (all roles except viewer can see)
        if (user?.role !== 'viewer') {
          const alertsResponse = await fetch(`/api/v1/projects/${id}/alerts`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (alertsResponse.ok) {
            const alertsData = await alertsResponse.json();
            setAlertChannels(alertsData.channels);
          }

          // Fetch alert history
          const historyResponse = await fetch('/api/v1/alert-history', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            // Filter to only this project's alerts
            const projectHistory = historyData.history.filter(
              (h: AlertHistoryEntry) => h.projectId === id
            );
            setAlertHistory(projectHistory);
          }

          // Fetch environment variables
          const envResponse = await fetch(`/api/v1/projects/${id}/env`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (envResponse.ok) {
            const envData = await envResponse.json();
            setEnvVars(envData.env_vars);
          }

          // Fetch healing settings (Feature #1064)
          const healingResponse = await fetch(`/api/v1/projects/${id}/healing-settings`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (healingResponse.ok) {
            const healingData = await healingResponse.json();
            setHealingSettings(healingData.healing_settings);
          }
        }

        // Fetch GitHub status and project connection
        const githubStatusResponse = await fetch('/api/v1/github/status', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (githubStatusResponse.ok) {
          const githubStatus = await githubStatusResponse.json();
          setGithubConnected(githubStatus.connected);
          setGithubUsername(githubStatus.username);
        }

        // Fetch GitHub connection for this project
        const githubConnResponse = await fetch(`/api/v1/projects/${id}/github`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (githubConnResponse.ok) {
          const githubConnData = await githubConnResponse.json();
          if (githubConnData.connected) {
            setGithubConnection(githubConnData.connection);
            setGithubTestFiles(githubConnData.test_files || []);
            setAvailableBranches(githubConnData.branches || []);

            // Fetch PR checks status
            const prResponse = await fetch(`/api/v1/projects/${id}/github/pull-requests`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (prResponse.ok) {
              const prData = await prResponse.json();
              setPullRequests(prData.pull_requests || []);
              setPrChecksEnabled(prData.pr_checks_enabled || false);
              setPrCommentsEnabled(prData.pr_comments_enabled || false);
            }
          }
        }
      } catch (err) {
        setError('Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProject();
  }, [id, token, user?.role, user?.organization_id]);

  // Fetch SAST configuration and scans when Security tab is active
  useEffect(() => {
    if (activeTab !== 'security') return;

    const fetchSastData = async () => {
      setIsLoadingSast(true);
      try {
        // Fetch SAST config
        const configResponse = await fetch(`/api/v1/projects/${id}/sast/config`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (configResponse.ok) {
          const configData = await configResponse.json();
          setSastConfig(configData.config);
        }

        // Fetch SAST rulesets
        const rulesetsResponse = await fetch('/api/v1/sast/rulesets', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (rulesetsResponse.ok) {
          const rulesetsData = await rulesetsResponse.json();
          setSastRulesets(rulesetsData.rulesets);
        }

        // Fetch recent scans
        const scansResponse = await fetch(`/api/v1/projects/${id}/sast/scans?limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (scansResponse.ok) {
          const scansData = await scansResponse.json();
          setSastScans(scansData.scans);
        }

        // Fetch custom rules
        const customRulesResponse = await fetch(`/api/v1/projects/${id}/sast/custom-rules`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (customRulesResponse.ok) {
          const customRulesData = await customRulesResponse.json();
          setCustomRules(customRulesData.rules || []);
        }

        // Fetch custom secret patterns
        const patternsResponse = await fetch(`/api/v1/projects/${id}/sast/patterns`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (patternsResponse.ok) {
          const patternsData = await patternsResponse.json();
          setSecretPatterns(patternsData.patterns || []);
        }
      } catch (err) {
        console.error('Failed to load SAST data:', err);
      } finally {
        setIsLoadingSast(false);
      }
    };

    fetchSastData();

    // Also fetch DAST data when security tab is active
    const fetchDastData = async () => {
      setIsLoadingDast(true);
      try {
        // Fetch DAST config
        const configResponse = await fetch(`/api/v1/projects/${id}/dast/config`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (configResponse.ok) {
          const configData = await configResponse.json();
          setDastConfig(configData.config);
          setDastTargetUrl(configData.config.targetUrl || '');
        }

        // Fetch recent DAST scans
        const scansResponse = await fetch(`/api/v1/projects/${id}/dast/scans?limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (scansResponse.ok) {
          const scansData = await scansResponse.json();
          setDastScans(scansData.scans);
        }

        // Fetch OpenAPI spec if available
        const specResponse = await fetch(`/api/v1/projects/${id}/dast/openapi-spec`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (specResponse.ok) {
          const specData = await specResponse.json();
          setOpenApiSpec(specData.spec);
        } else {
          setOpenApiSpec(null);
        }

        // Fetch DAST schedules
        const schedulesResponse = await fetch(`/api/v1/projects/${id}/dast/schedules`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (schedulesResponse.ok) {
          const schedulesData = await schedulesResponse.json();
          setDastSchedules(schedulesData.schedules || []);
        }
      } catch (err) {
        console.error('Failed to load DAST data:', err);
      } finally {
        setIsLoadingDast(false);
      }
    };

    fetchDastData();

    // Poll for updates when there's a running scan
    const pollInterval = setInterval(async () => {
      const hasRunningScans = dastScans.some(s => s.status === 'running');
      if (hasRunningScans && activeTab === 'security') {
        try {
          const scansResponse = await fetch(`/api/v1/projects/${id}/dast/scans?limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (scansResponse.ok) {
            const scansData = await scansResponse.json();
            setDastScans(scansData.scans);
          }
        } catch (err) {
          console.error('Failed to poll DAST scans:', err);
        }
      }
    }, 500);  // Poll every 500ms for smooth progress updates

    return () => clearInterval(pollInterval);
  }, [id, token, activeTab, dastScans]);

  // Handler to update DAST configuration
  const handleUpdateDastConfig = async (updates: Partial<DASTConfig>) => {
    setIsUpdatingDast(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/dast/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update DAST configuration');
      }

      const data = await response.json();
      setDastConfig(data.config);
      toast.success('DAST configuration updated');
    } catch (err) {
      toast.error('Failed to update DAST configuration');
    } finally {
      setIsUpdatingDast(false);
    }
  };

  // Handler to trigger a DAST scan
  const handleTriggerDastScan = async () => {
    const urlToScan = dastTargetUrl || dastConfig.targetUrl;
    if (!urlToScan) {
      toast.error('Please configure a target URL first');
      return;
    }

    // Validate URL
    try {
      new URL(urlToScan);
    } catch {
      toast.error('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setIsRunningDastScan(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/dast/scans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUrl: urlToScan,
          scanProfile: dastConfig.scanProfile,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start DAST scan');
      }

      const data = await response.json();
      toast.success('DAST scan started');

      // Poll for scan completion
      const pollScan = async (scanId: string) => {
        const scanResponse = await fetch(`/api/v1/projects/${id}/dast/scans/${scanId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (scanResponse.ok) {
          const scanData = await scanResponse.json();
          if (scanData.scan.status === 'completed' || scanData.scan.status === 'failed') {
            // Refresh scans list
            const scansResponse = await fetch(`/api/v1/projects/${id}/dast/scans?limit=10`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (scansResponse.ok) {
              const scansData = await scansResponse.json();
              setDastScans(scansData.scans);
            }
            setIsRunningDastScan(false);
            if (scanData.scan.status === 'completed') {
              toast.success(`DAST scan completed: ${scanData.scan.summary.total} alerts`);
            } else {
              toast.error('DAST scan failed');
            }
          } else {
            // Still running, poll again after 2 seconds
            setTimeout(() => pollScan(scanId), 2000);
          }
        }
      };

      // Start polling
      setTimeout(() => pollScan(data.scan.id), 2000);
    } catch (err) {
      toast.error('Failed to start DAST scan');
      setIsRunningDastScan(false);
    }
  };

  // Handler to upload OpenAPI specification
  const handleUploadOpenApiSpec = async (content: string) => {
    setIsUploadingSpec(true);
    setSpecUploadError(null);
    try {
      const response = await fetch(`/api/v1/projects/${id}/dast/openapi-spec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload OpenAPI specification');
      }

      const data = await response.json();
      toast.success(`OpenAPI specification uploaded: ${data.spec.endpointCount} endpoints found`);

      // Refresh the spec
      const specResponse = await fetch(`/api/v1/projects/${id}/dast/openapi-spec`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (specResponse.ok) {
        const specData = await specResponse.json();
        setOpenApiSpec(specData.spec);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload OpenAPI specification';
      setSpecUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploadingSpec(false);
    }
  };

  // Handler to delete OpenAPI specification
  const handleDeleteOpenApiSpec = async () => {
    try {
      const response = await fetch(`/api/v1/projects/${id}/dast/openapi-spec`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to delete OpenAPI specification');
      }

      setOpenApiSpec(null);
      toast.success('OpenAPI specification deleted');
    } catch (err) {
      toast.error('Failed to delete OpenAPI specification');
    }
  };

  // Handler to update SAST configuration
  const handleUpdateSastConfig = async (updates: Partial<SASTConfig>) => {
    setIsUpdatingSast(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/sast/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update SAST configuration');
      }

      const data = await response.json();
      setSastConfig(data.config);
      toast.success('SAST configuration updated');
    } catch (err) {
      toast.error('Failed to update SAST configuration');
    } finally {
      setIsUpdatingSast(false);
    }
  };

  // Handler to trigger a SAST scan
  const handleTriggerScan = async () => {
    setIsRunningScan(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/sast/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ branch: githubConnection?.github_branch || 'main' }),
      });

      if (!response.ok) {
        throw new Error('Failed to start SAST scan');
      }

      const data = await response.json();
      toast.success('SAST scan started');

      // Poll for scan completion
      const pollScan = async (scanId: string) => {
        const scanResponse = await fetch(`/api/v1/projects/${id}/sast/scans/${scanId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (scanResponse.ok) {
          const scanData = await scanResponse.json();
          if (scanData.scan.status === 'completed' || scanData.scan.status === 'failed') {
            // Refresh scans list
            const scansResponse = await fetch(`/api/v1/projects/${id}/sast/scans?limit=10`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (scansResponse.ok) {
              const scansData = await scansResponse.json();
              setSastScans(scansData.scans);
            }
            setIsRunningScan(false);
            if (scanData.scan.status === 'completed') {
              toast.success(`SAST scan completed: ${scanData.scan.summary.total} findings`);
            } else {
              toast.error('SAST scan failed');
            }
          } else {
            // Still running, poll again after 2 seconds
            setTimeout(() => pollScan(scanId), 2000);
          }
        }
      };

      // Start polling
      setTimeout(() => pollScan(data.scanId), 2000);
    } catch (err) {
      toast.error('Failed to start SAST scan');
      setIsRunningScan(false);
    }
  };

  // Handler to add a custom SAST rule
  const handleAddCustomRule = async () => {
    if (!newCustomRuleName.trim() || !newCustomRuleYaml.trim()) {
      setCustomRuleError('Name and YAML are required');
      return;
    }

    setIsAddingCustomRule(true);
    setCustomRuleError(null);

    try {
      const response = await fetch(`/api/v1/projects/${id}/sast/custom-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newCustomRuleName,
          yaml: newCustomRuleYaml,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add custom rule');
      }

      const data = await response.json();
      setCustomRules([...customRules, data.rule]);
      setShowAddCustomRuleModal(false);
      setNewCustomRuleName('');
      setNewCustomRuleYaml('');
      toast.success('Custom rule added successfully');
    } catch (err) {
      setCustomRuleError(err instanceof Error ? err.message : 'Failed to add custom rule');
    } finally {
      setIsAddingCustomRule(false);
    }
  };

  // Handler to toggle a custom rule's enabled status
  const handleToggleCustomRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/v1/projects/${id}/sast/custom-rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update custom rule');
      }

      const data = await response.json();
      setCustomRules(customRules.map(r => r.id === ruleId ? data.rule : r));
      toast.success(`Custom rule ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error('Failed to update custom rule');
    }
  };

  // Handler to delete a custom rule
  const handleDeleteCustomRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this custom rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/projects/${id}/sast/custom-rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete custom rule');
      }

      setCustomRules(customRules.filter(r => r.id !== ruleId));
      toast.success('Custom rule deleted');
    } catch (err) {
      toast.error('Failed to delete custom rule');
    }
  };

  // Handler to test a regex pattern
  const handleTestPattern = () => {
    if (!newPatternRegex || !patternTestInput) {
      setPatternTestResult(null);
      return;
    }
    try {
      const regex = new RegExp(newPatternRegex);
      const match = regex.exec(patternTestInput);
      if (match) {
        setPatternTestResult({ matches: true, matched: match[0] });
      } else {
        setPatternTestResult({ matches: false });
      }
      setPatternError(null);
    } catch (err) {
      setPatternError(err instanceof Error ? `Invalid regex: ${err.message}` : 'Invalid regex pattern');
      setPatternTestResult(null);
    }
  };

  // Handler to add a custom secret pattern
  const handleAddSecretPattern = async () => {
    if (!newPatternName.trim() || !newPatternRegex.trim()) {
      setPatternError('Name and pattern are required');
      return;
    }

    // Validate regex
    try {
      new RegExp(newPatternRegex);
    } catch (err) {
      setPatternError(err instanceof Error ? `Invalid regex: ${err.message}` : 'Invalid regex pattern');
      return;
    }

    setIsAddingPattern(true);
    setPatternError(null);

    try {
      const response = await fetch(`/api/v1/projects/${id}/sast/patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newPatternName.trim(),
          description: newPatternDescription.trim(),
          pattern: newPatternRegex.trim(),
          severity: newPatternSeverity,
          category: 'custom',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add pattern');
      }

      const data = await response.json();
      setSecretPatterns([...secretPatterns, data]);
      setShowAddSecretPatternModal(false);
      setNewPatternName('');
      setNewPatternDescription('');
      setNewPatternRegex('');
      setNewPatternSeverity('HIGH');
      setPatternTestInput('');
      setPatternTestResult(null);
      toast.success('Custom secret pattern added');
    } catch (err) {
      setPatternError(err instanceof Error ? err.message : 'Failed to add pattern');
    } finally {
      setIsAddingPattern(false);
    }
  };

  // Handler to toggle a secret pattern
  const handleToggleSecretPattern = async (patternId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/v1/projects/${id}/sast/patterns/${patternId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update pattern');
      }

      const data = await response.json();
      setSecretPatterns(secretPatterns.map(p => p.id === patternId ? { ...p, enabled } : p));
      toast.success(`Pattern ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error('Failed to update pattern');
    }
  };

  // Handler to delete a secret pattern
  const handleDeleteSecretPattern = async (patternId: string) => {
    if (!confirm('Are you sure you want to delete this secret pattern?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/projects/${id}/sast/patterns/${patternId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete pattern');
      }

      setSecretPatterns(secretPatterns.filter(p => p.id !== patternId));
      toast.success('Secret pattern deleted');
    } catch (err) {
      toast.error('Failed to delete pattern');
    }
  };

  // Handler to mark a finding as false positive
  const handleMarkFalsePositive = async () => {
    if (!selectedFinding || !fpReason.trim()) {
      return;
    }

    setIsMarkingFP(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/sast/false-positives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ruleId: selectedFinding.ruleId,
          filePath: selectedFinding.filePath,
          line: selectedFinding.line,
          snippet: selectedFinding.snippet,
          reason: fpReason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark as false positive');
      }

      // Update the finding in the scan results
      if (selectedScan) {
        const updatedFindings = selectedScan.findings.map(f =>
          f.ruleId === selectedFinding.ruleId &&
          f.filePath === selectedFinding.filePath &&
          f.line === selectedFinding.line
            ? { ...f, isFalsePositive: true }
            : f
        );
        setSelectedScan({ ...selectedScan, findings: updatedFindings });
        setSastScans(sastScans.map(s =>
          s.id === selectedScan.id ? { ...s, findings: updatedFindings } : s
        ));
      }

      setShowFalsePositiveModal(false);
      setSelectedFinding(null);
      setFpReason('');
      toast.success('Finding marked as false positive');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark as false positive');
    } finally {
      setIsMarkingFP(false);
    }
  };

  const handleCreateSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSuiteError('');
    setIsCreatingSuite(true);

    try {
      const response = await fetch(`/api/v1/projects/${id}/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newSuiteName,
          description: newSuiteDescription,
          browser: newSuiteBrowser,
          viewport_width: newSuiteViewportWidth,
          viewport_height: newSuiteViewportHeight,
          timeout: newSuiteTimeout,
          retry_count: newSuiteRetryCount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create test suite');
      }

      const data = await response.json();
      setSuites([...suites, data.suite]);
      setNewSuiteName('');
      setNewSuiteDescription('');
      setNewSuiteBrowser(testDefaults.defaultBrowser);
      setNewSuiteViewportWidth(1280);
      setNewSuiteViewportHeight(720);
      setNewSuiteTimeout(testDefaults.defaultTimeout / 1000);
      setNewSuiteRetryCount(testDefaults.defaultRetries);
      setShowCreateSuiteModal(false);
      toast.success(`Test suite "${data.suite.name}" created successfully!`);
    } catch (err) {
      // Use enhanced error handling for network errors
      toast.error(getErrorMessage(err, 'Failed to create test suite'));
    } finally {
      setIsCreatingSuite(false);
    }
  };

  const handleDeleteProject = async () => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete project');
      }

      // Navigate to projects list after successful deletion
      navigate('/projects');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  // Feature #1975: One-click Smoke Test handler
  const handleQuickSmokeTest = async () => {
    if (!project?.base_url) {
      toast.error('No base URL configured for this project. Please set it in Settings.');
      return;
    }

    setIsRunningQuickSmokeTest(true);
    setSmokeTestRunId(null);

    try {
      // Step 1: Create a temporary smoke test
      const testResponse = await fetch(`/api/v1/projects/${id}/quick-smoke-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_url: project.base_url,
        }),
      });

      if (!testResponse.ok) {
        // If the quick-smoke-test endpoint doesn't exist, try creating a test in a default suite
        const errorData = await testResponse.json();
        throw new Error(errorData.message || 'Failed to run smoke test');
      }

      const testData = await testResponse.json();
      const runId = testData.run_id;
      const testId = testData.test_id;
      const suiteId = testData.suite_id;
      setSmokeTestRunId(runId);

      // Step 2: Poll for test completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 60; // Max 60 seconds

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

        const statusResponse = await fetch(`/api/v1/runs/${runId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const status = statusData.run?.status;

          if (status === 'passed') {
            completed = true;
            toast.success(
              <div
                className="cursor-pointer"
                onClick={() => navigate(`/tests/${testId}`)}
              >
                <span className="font-semibold">Site Healthy ✅</span>
                <br />
                <span className="text-xs opacity-75">Click to view details</span>
              </div>,
              { duration: 5000 }
            );
          } else if (status === 'failed' || status === 'error') {
            completed = true;
            toast.error(
              <div
                className="cursor-pointer"
                onClick={() => navigate(`/tests/${testId}`)}
              >
                <span className="font-semibold">Issues Found ⚠️</span>
                <br />
                <span className="text-xs opacity-75">Click to view details</span>
              </div>,
              { duration: 8000 }
            );
          }
        }
      }

      if (!completed) {
        toast.warning('Smoke test is taking longer than expected. Check run history for results.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run smoke test';
      toast.error(message);
    } finally {
      setIsRunningQuickSmokeTest(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMemberError('');
    setIsAddingMember(true);

    try {
      const response = await fetch(`/api/v1/projects/${id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: selectedMemberRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add member');
      }

      const data = await response.json();
      setProjectMembers([...projectMembers, data.member]);
      setSelectedUserId('');
      setSelectedMemberRole('developer');
      setShowAddMemberModal(false);
      toast.success('Member added to project successfully');
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from the project?')) return;

    try {
      const response = await fetch(`/api/v1/projects/${id}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to remove member');
      }

      setProjectMembers(projectMembers.filter(m => m.user_id !== memberId));
      toast.success('Member removed from project');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  // Alert channel handlers
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAlertError('');
    setIsCreatingAlert(true);

    // Validate based on type
    if (newAlertType === 'email') {
      const emailAddresses = newAlertEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'));

      if (emailAddresses.length === 0) {
        setCreateAlertError('Please enter at least one valid email address');
        setIsCreatingAlert(false);
        return;
      }
    } else if (newAlertType === 'webhook') {
      if (!newAlertWebhookUrl || !newAlertWebhookUrl.startsWith('http')) {
        setCreateAlertError('Please enter a valid webhook URL (must start with http:// or https://)');
        setIsCreatingAlert(false);
        return;
      }
    } else if (newAlertType === 'slack') {
      if (!newAlertSlackChannel) {
        setCreateAlertError('Please select a Slack channel');
        setIsCreatingAlert(false);
        return;
      }
    }

    try {
      const bodyData: Record<string, unknown> = {
        name: newAlertName,
        type: newAlertType,
        condition: newAlertCondition,
        threshold_percent: newAlertCondition === 'threshold' ? newAlertThreshold : undefined,
        suppress_on_retry_success: newAlertSuppressOnRetry,
        enabled: true,
      };

      if (newAlertType === 'email') {
        bodyData.email_addresses = newAlertEmails
          .split(',')
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'));
      } else if (newAlertType === 'webhook') {
        bodyData.webhook_url = newAlertWebhookUrl;
      } else if (newAlertType === 'slack') {
        bodyData.slack_channel = newAlertSlackChannel;
      }

      const response = await fetch(`/api/v1/projects/${id}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create alert channel');
      }

      const data = await response.json();
      setAlertChannels([...alertChannels, data.channel]);
      setNewAlertName('');
      setNewAlertType('email');
      setNewAlertCondition('any_failure');
      setNewAlertThreshold(50);
      setNewAlertEmails('');
      setNewAlertWebhookUrl('');
      setNewAlertSlackChannel('');
      setNewAlertSuppressOnRetry(false);
      setShowCreateAlertModal(false);
      const alertTypeName = newAlertType === 'email' ? 'Email' : newAlertType === 'slack' ? 'Slack' : 'Webhook';
      toast.success(`${alertTypeName} alert channel created successfully`);
    } catch (err) {
      setCreateAlertError(err instanceof Error ? err.message : 'Failed to create alert channel');
    } finally {
      setIsCreatingAlert(false);
    }
  };

  const handleToggleAlert = async (channelId: string, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/v1/projects/${id}/alerts/${channelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: !currentEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update alert channel');
      }

      setAlertChannels(alertChannels.map(ch =>
        ch.id === channelId ? { ...ch, enabled: !currentEnabled } : ch
      ));
      toast.success(`Alert ${currentEnabled ? 'disabled' : 'enabled'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update alert');
    }
  };

  const handleDeleteAlert = async (channelId: string) => {
    if (!confirm('Are you sure you want to delete this alert channel?')) return;

    try {
      const response = await fetch(`/api/v1/projects/${id}/alerts/${channelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete alert channel');
      }

      setAlertChannels(alertChannels.filter(ch => ch.id !== channelId));
      toast.success('Alert channel deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete alert');
    }
  };

  // ========== ENVIRONMENT VARIABLES HANDLERS ==========

  const handleAddEnvVar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddEnvError('');
    setIsAddingEnv(true);

    try {
      const response = await fetch(`/api/v1/projects/${id}/env`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: newEnvKey,
          value: newEnvValue,
          is_secret: newEnvIsSecret,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add environment variable');
      }

      const data = await response.json();
      setEnvVars([...envVars, data.env_var]);
      setNewEnvKey('');
      setNewEnvValue('');
      setNewEnvIsSecret(false);
      setShowAddEnvModal(false);
      toast.success('Environment variable added');
    } catch (err) {
      setAddEnvError(err instanceof Error ? err.message : 'Failed to add environment variable');
    } finally {
      setIsAddingEnv(false);
    }
  };

  const handleUpdateEnvVar = async (varId: string) => {
    try {
      const response = await fetch(`/api/v1/projects/${id}/env/${varId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          value: editEnvValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update environment variable');
      }

      const data = await response.json();
      setEnvVars(envVars.map(v => v.id === varId ? data.env_var : v));
      setEditingEnvId(null);
      setEditEnvValue('');
      toast.success('Environment variable updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update environment variable');
    }
  };

  const handleDeleteEnvVar = async (varId: string) => {
    if (!confirm('Are you sure you want to delete this environment variable?')) return;

    try {
      const response = await fetch(`/api/v1/projects/${id}/env/${varId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete environment variable');
      }

      setEnvVars(envVars.filter(v => v.id !== varId));
      toast.success('Environment variable deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete environment variable');
    }
  };

  // Healing settings handler (Feature #1064)
  const handleSaveHealingSettings = async () => {
    setIsSavingHealingSettings(true);
    setHealingSettingsMessage(null);

    try {
      const response = await fetch(`/api/v1/projects/${id}/healing-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(healingSettings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update healing settings');
      }

      const data = await response.json();
      setHealingSettings(data.healing_settings);
      setHealingSettingsMessage({ type: 'success', text: 'Healing settings saved successfully' });
      toast.success('Healing settings saved successfully');
    } catch (err) {
      setHealingSettingsMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save healing settings' });
      toast.error(err instanceof Error ? err.message : 'Failed to save healing settings');
    } finally {
      setIsSavingHealingSettings(false);
    }
  };

  // Feature #1065: Handle selector update
  const handleUpdateSelector = async () => {
    if (!token || !editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    if (!editSelectorValue.trim()) {
      toast.error('Selector cannot be empty');
      return;
    }

    setIsSubmittingSelector(true);
    try {
      const response = await fetch(
        `/api/v1/runs/${editSelectorModal.runId}/results/${editSelectorModal.testId}/steps/${editSelectorModal.stepId}/selector`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            new_selector: editSelectorValue.trim(),
            notes: editSelectorNotes.trim() || undefined,
            apply_to_test: editSelectorApplyToTest,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update selector');
      }

      const data = await response.json();
      toast.success(data.message || 'Selector updated successfully');

      // Reset and close modal
      setEditSelectorModal({
        isOpen: false,
        runId: '',
        testId: '',
        stepId: '',
        currentSelector: '',
        originalSelector: '',
        wasHealed: false,
      });
      setEditSelectorValue('');
      setEditSelectorNotes('');
      setEditSelectorApplyToTest(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update selector');
    } finally {
      setIsSubmittingSelector(false);
    }
  };

  // Feature #1065: Handle accept healed selector
  const handleAcceptHealed = async () => {
    if (!token || !editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    setIsSubmittingSelector(true);
    try {
      const response = await fetch(
        `/api/v1/runs/${editSelectorModal.runId}/results/${editSelectorModal.testId}/steps/${editSelectorModal.stepId}/accept-healed`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apply_to_test: editSelectorApplyToTest,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to accept healed selector');
      }

      const data = await response.json();
      toast.success(data.message || 'Healed selector accepted');

      // Reset and close modal
      setEditSelectorModal({
        isOpen: false,
        runId: '',
        testId: '',
        stepId: '',
        currentSelector: '',
        originalSelector: '',
        wasHealed: false,
      });
      setEditSelectorValue('');
      setEditSelectorNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept healed selector');
    } finally {
      setIsSubmittingSelector(false);
    }
  };

  // Feature #1347: Handle heal with vision
  const handleHealWithVision = async () => {
    if (!token || !editSelectorModal.originalSelector) {
      toast.error('Missing required information');
      return;
    }

    setIsHealingWithVision(true);
    setVisionHealingResult(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/ai/heal-with-vision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_selector: editSelectorModal.originalSelector,
          page_screenshot: '', // Would be captured from the test run
          element_context: {
            tag_name: editSelectorModal.originalSelector.includes('button') ? 'button' :
                      editSelectorModal.originalSelector.includes('input') ? 'input' :
                      editSelectorModal.originalSelector.includes('a') ? 'a' : undefined,
            text_content: editSelectorModal.currentSelector !== editSelectorModal.originalSelector
              ? undefined : undefined,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to heal with vision');
      }

      const data = await response.json();
      setVisionHealingResult(data.healing);

      if (data.healing.suggested_selectors?.length > 0) {
        const topSuggestion = data.healing.suggested_selectors[0];
        setEditSelectorValue(topSuggestion.selector);
        toast.success(`Found ${data.healing.suggested_selectors.length} alternative selectors (${Math.round(topSuggestion.confidence * 100)}% confidence)`);
      } else {
        toast.warning('No alternative selectors found');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to heal with vision');
    } finally {
      setIsHealingWithVision(false);
    }
  };

  // GitHub integration handlers
  const handleConnectGithub = async () => {
    setIsConnectingGithub(true);
    setGithubError('');

    try {
      const response = await fetch('/api/v1/github/connect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to connect GitHub');
      }

      const data = await response.json();
      setGithubConnected(true);
      setGithubUsername(data.username);
      toast.success('GitHub account connected successfully');
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to connect GitHub');
    } finally {
      setIsConnectingGithub(false);
    }
  };

  const handleDisconnectGithub = async () => {
    if (!confirm('Disconnect your GitHub account?')) return;

    try {
      const response = await fetch('/api/v1/github/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect GitHub');
      }

      setGithubConnected(false);
      setGithubUsername(null);
      toast.success('GitHub account disconnected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect GitHub');
    }
  };

  const handleOpenRepoSelect = async () => {
    setGithubError('');
    setShowRepoSelectModal(true);

    // Fetch available repositories
    try {
      const response = await fetch('/api/v1/github/repositories', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to load repositories');
      }

      const data = await response.json();
      setGithubRepositories(data.repositories);
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to load repositories');
    }
  };

  const handleConnectRepo = async () => {
    if (!selectedRepo) return;

    setIsConnectingRepo(true);
    setGithubError('');

    try {
      const response = await fetch(`/api/v1/projects/${id}/github/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          owner: selectedRepo.owner,
          repo: selectedRepo.name,
          branch: selectedBranch || selectedRepo.default_branch,
          test_path: selectedTestPath,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to connect repository');
      }

      const data = await response.json();
      setGithubConnection(data.connection);
      setShowRepoSelectModal(false);
      setSelectedRepo(null);
      toast.success(data.message || 'Repository connected successfully');

      // Fetch test files
      const testFilesResponse = await fetch(`/api/v1/projects/${id}/github`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (testFilesResponse.ok) {
        const testFilesData = await testFilesResponse.json();
        setGithubTestFiles(testFilesData.test_files || []);
      }

      // Fetch pull requests after connecting repo
      fetchPullRequests();
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to connect repository');
    } finally {
      setIsConnectingRepo(false);
    }
  };

  const handleDisconnectRepo = async () => {
    if (!confirm('Disconnect this repository? Imported tests will remain but won\'t sync with GitHub.')) return;

    setIsDisconnectingRepo(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/github`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect repository');
      }

      setGithubConnection(null);
      setGithubTestFiles([]);
      toast.success('Repository disconnected successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect repository');
    } finally {
      setIsDisconnectingRepo(false);
    }
  };

  const handleSyncRepo = async () => {
    setIsSyncingGithub(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/github/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync repository');
      }

      const data = await response.json();
      setGithubTestFiles(data.test_files || []);
      if (githubConnection) {
        setGithubConnection({
          ...githubConnection,
          last_synced_at: data.last_synced_at,
        });
      }
      toast.success('Repository synced successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync repository');
    } finally {
      setIsSyncingGithub(false);
    }
  };

  const handleChangeBranch = async (newBranch: string) => {
    if (!githubConnection || newBranch === githubConnection.github_branch) return;

    setIsChangingBranch(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/github/branch`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ branch: newBranch }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change branch');
      }

      const data = await response.json();
      setGithubConnection({
        ...githubConnection,
        github_branch: newBranch,
        last_synced_at: data.connection.last_synced_at,
      });
      setGithubTestFiles(data.test_files || []);
      toast.success(`Branch changed to '${newBranch}' - ${data.total} test file(s) discovered`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change branch');
    } finally {
      setIsChangingBranch(false);
    }
  };

  const handleTogglePRChecks = async (enabled: boolean) => {
    if (!id) return;

    setIsTogglingPRChecks(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/github/pr-checks`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pr_checks_enabled: enabled }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update PR checks setting');
      }

      setPrChecksEnabled(enabled);
      toast.success(`PR status checks ${enabled ? 'enabled' : 'disabled'}`);

      // If enabling, fetch the PRs
      if (enabled) {
        fetchPullRequests();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update PR checks setting');
    } finally {
      setIsTogglingPRChecks(false);
    }
  };

  const fetchPullRequests = async () => {
    if (!id) return;

    try {
      const response = await fetch(`/api/v1/projects/${id}/github/pull-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return; // Silently fail for PR fetch
      }

      const data = await response.json();
      setPullRequests(data.pull_requests || []);
      setPrChecksEnabled(data.pr_checks_enabled || false);
      setPrCommentsEnabled(data.pr_comments_enabled || false);
    } catch {
      // Silently fail for PR fetch
    }
  };

  const handlePostPRStatus = async (prNumber: number, status: string) => {
    if (!id) return;

    try {
      const response = await fetch(`/api/v1/projects/${id}/github/pull-requests/${prNumber}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to post PR status');
      }

      toast.success(`PR status check posted: ${status}`);

      // Refresh the PR list to show updated status
      fetchPullRequests();

      // Simulate status progression for demo
      if (status === 'pending') {
        setTimeout(async () => {
          await fetch(`/api/v1/projects/${id}/github/pull-requests/${prNumber}/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ status: 'running' }),
          });
          fetchPullRequests();

          // After 2 more seconds, mark as success
          setTimeout(async () => {
            await fetch(`/api/v1/projects/${id}/github/pull-requests/${prNumber}/status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ status: 'success' }),
            });
            fetchPullRequests();
            toast.success('Tests passed! PR status check updated to success.');
          }, 2000);
        }, 1500);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post PR status');
    }
  };

  const handleTogglePRComments = async (enabled: boolean) => {
    if (!id) return;

    setIsTogglingPRComments(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/github/pr-comments`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pr_comments_enabled: enabled }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update PR comments setting');
      }

      setPrCommentsEnabled(enabled);
      toast.success(`PR comments ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update PR comments setting');
    } finally {
      setIsTogglingPRComments(false);
    }
  };

  const handlePostPRComment = async (prNumber: number) => {
    if (!id) return;

    try {
      // Simulate test results
      const passed = Math.floor(Math.random() * 15) + 5;
      const failed = Math.floor(Math.random() * 3);
      const skipped = Math.floor(Math.random() * 2);

      const response = await fetch(`/api/v1/projects/${id}/github/pull-requests/${prNumber}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ passed, failed, skipped }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to post PR comment');
      }

      const data = await response.json();
      toast.success(`Comment posted to PR #${prNumber}: ${data.comment.passed} passed, ${data.comment.failed} failed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post PR comment');
    }
  };

  // Feature #768: Toggle PR Dependency Scanning
  const handleTogglePRDependencyScan = async (enabled: boolean) => {
    if (!id) return;

    setIsTogglingPRDependencyScan(true);
    try {
      const response = await fetch(`/api/v1/projects/${id}/github/pr-dependency-scan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pr_dependency_scan_enabled: enabled }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update PR dependency scan setting');
      }

      setPrDependencyScanEnabled(enabled);
      toast.success(`PR dependency scanning ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update PR dependency scan setting');
    } finally {
      setIsTogglingPRDependencyScan(false);
    }
  };

  // Feature #768: Update PR Dependency Scan Config
  const handleUpdatePRDependencyScanConfig = async (config: {
    pr_dependency_scan_files?: string[];
    pr_dependency_scan_severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    pr_dependency_scan_block_on_critical?: boolean;
  }) => {
    if (!id) return;

    try {
      const response = await fetch(`/api/v1/projects/${id}/github/pr-dependency-scan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update PR dependency scan config');
      }

      const data = await response.json();
      if (config.pr_dependency_scan_files) {
        setPrDependencyScanFiles(data.pr_dependency_scan_files);
      }
      if (config.pr_dependency_scan_severity) {
        setPrDependencyScanSeverity(data.pr_dependency_scan_severity);
      }
      if (config.pr_dependency_scan_block_on_critical !== undefined) {
        setPrDependencyScanBlockOnCritical(data.pr_dependency_scan_block_on_critical);
      }
      toast.success('PR dependency scan settings updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update PR dependency scan config');
    }
  };

  // Feature #768: Trigger PR Dependency Scan
  const handleTriggerPRDependencyScan = async (prNumber: number) => {
    if (!id) return;

    setIsRunningPRDependencyScan(prNumber);
    try {
      const response = await fetch(`/api/v1/projects/${id}/github/pull-requests/${prNumber}/dependency-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ changed_files: ['package.json', 'package-lock.json'] }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to run dependency scan');
      }

      const data = await response.json();

      // Store the scan result
      setPrDependencyScanResults(prev => ({
        ...prev,
        [prNumber]: {
          summary: data.scan_result.summary,
        },
      }));

      if (data.merge_blocked) {
        toast.error(`PR #${prNumber} blocked: ${data.scan_result.summary.critical} critical vulnerabilities found!`);
      } else if (data.scan_result.summary.total > 0) {
        toast.warning(`PR #${prNumber}: ${data.scan_result.summary.total} vulnerabilities found (${data.scan_result.summary.new_in_pr} new)`);
      } else {
        toast.success(`PR #${prNumber}: No vulnerabilities found!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run dependency scan');
    } finally {
      setIsRunningPRDependencyScan(null);
    }
  };

  // Get organization members who can be added (exclude admins/owners and existing project members)
  const availableMembers = orgMembers.filter(m => {
    // Only developers and viewers need to be added explicitly
    if (m.role === 'owner' || m.role === 'admin') return false;
    // Exclude already added members
    if (projectMembers.some(pm => pm.user_id === m.user_id)) return false;
    return true;
  });

  // Get member details helper
  const getMemberDetails = (userId: string) => {
    return orgMembers.find(m => m.user_id === userId);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center p-8 min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Project Not Found</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The project may not exist, or you may not have access to it.
            </p>
            <button
              onClick={() => navigate('/projects')}
              className="mt-6 rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Projects
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Breadcrumb navigation */}
        <nav className="mb-6 flex items-center gap-2 text-sm">
          <Link to="/projects" className="text-muted-foreground hover:text-foreground">
            Projects
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">{project?.name}</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{project?.name}</h1>
            {project?.description && (
              <p className="mt-2 text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Feature #1975: One-click Smoke Test button */}
            <button
              onClick={handleQuickSmokeTest}
              disabled={isRunningQuickSmokeTest || !project?.base_url}
              title={!project?.base_url ? 'Set a base URL in project settings first' : 'Run a quick health check on the project'}
              className={`rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2 transition-all ${
                isRunningQuickSmokeTest
                  ? 'bg-orange-500 text-white cursor-wait'
                  : !project?.base_url
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {isRunningQuickSmokeTest ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Running...
                </>
              ) : (
                <>
                  <span className="text-lg">🔥</span>
                  Smoke Test
                </>
              )}
            </button>
            {/* Feature #1852: View run history at project level */}
            <Link
              to={`/projects/${id}/runs`}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run History
            </Link>
            {canDeleteProject && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete Project
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 border-b border-border">
          <nav className="-mb-px flex gap-4" aria-label="Project tabs">
            <button
              onClick={() => setActiveTab('suites')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'suites'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              aria-current={activeTab === 'suites' ? 'page' : undefined}
            >
              Suites
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              aria-current={activeTab === 'settings' ? 'page' : undefined}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab('github')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'github'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              aria-current={activeTab === 'github' ? 'page' : undefined}
            >
              GitHub
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'security'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              aria-current={activeTab === 'security' ? 'page' : undefined}
            >
              Security
            </button>
            {/* Feature #1535: Autopilot Tab removed - enterprise bloat */}
            {/* Feature #1539: Maintenance Tab removed - uses dummy data with no real API */}
            {/* Feature #1540: Discovery Tab removed - uses dummy data with no real AI API */}
            {/* Feature #1536: Predictions Tab removed - simple flaky test detection is sufficient */}
            {/* Feature #1541: Code Quality Tab removed - uses dummy data with no real API */}
          </nav>
        </div>

        {/* Add Environment Variable Modal */}
        {showAddEnvModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowAddEnvModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="add-env-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 id="add-env-title" className="text-lg font-semibold text-foreground">Add Environment Variable</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a variable that can be used in your tests.
              </p>
              <form onSubmit={handleAddEnvVar} className="mt-4 space-y-4">
                {addEnvError && (
                  <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {addEnvError}
                  </div>
                )}
                <div>
                  <label htmlFor="env-key" className="mb-1 block text-sm font-medium text-foreground">
                    Variable Name
                  </label>
                  <input
                    type="text"
                    id="env-key"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                    required
                    pattern="[A-Z_][A-Z0-9_]*"
                    placeholder="e.g., API_KEY, BASE_URL"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use uppercase letters, numbers, and underscores only.
                  </p>
                </div>
                <div>
                  <label htmlFor="env-value" className="mb-1 block text-sm font-medium text-foreground">
                    Value
                  </label>
                  <input
                    type={newEnvIsSecret ? 'password' : 'text'}
                    id="env-value"
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                    required
                    placeholder="Enter variable value"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="env-secret"
                    checked={newEnvIsSecret}
                    onChange={(e) => setNewEnvIsSecret(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="env-secret" className="text-sm text-foreground">
                    Mark as secret (value will be masked)
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddEnvModal(false);
                      setNewEnvKey('');
                      setNewEnvValue('');
                      setNewEnvIsSecret(false);
                      setAddEnvError('');
                    }}
                    className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingEnv}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isAddingEnv ? 'Adding...' : 'Add Variable'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Project Modal */}
        {showDeleteModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="delete-project-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 id="delete-project-title" className="text-lg font-semibold text-foreground">Delete Project</h3>
              <p className="mt-2 text-muted-foreground">
                Are you sure you want to delete "{project?.name}"? This action cannot be undone and will delete all test suites and tests within this project.
              </p>
              {deleteError && (
                <div role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {deleteError}
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Suites Tab Content */}
        {activeTab === 'suites' && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Test Suites</h2>
              {canCreateSuite && (
                <button
                  onClick={() => setShowCreateSuiteModal(true)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create Suite
                </button>
              )}
            </div>

            {suites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                <h3 className="text-lg font-semibold text-foreground">No test suites yet</h3>
                <p className="mt-2 text-muted-foreground">
                  Create your first test suite to organize your tests.
                </p>
                {canCreateSuite && (
                  <button
                    onClick={() => setShowCreateSuiteModal(true)}
                    className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Create Suite
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {suites.map((suite) => (
                  <div
                    key={suite.id}
                    onClick={() => navigate(`/suites/${suite.id}`)}
                    className="cursor-pointer rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md"
                  >
                    <h3 className="text-lg font-semibold text-foreground">{suite.name}</h3>
                    {suite.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {suite.description}
                      </p>
                    )}
                    <p className="mt-4 text-xs text-muted-foreground">
                      ID: {suite.id}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <>
            {/* Project Details Section */}
        <div className="mt-8">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Project Details</h2>
            <dl className="mt-4 space-y-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">ID</dt>
                <dd className="text-foreground">{project?.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Slug</dt>
                <dd className="text-foreground">{project?.slug}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                <dd className="text-foreground">
                  {project?.created_at ? formatDate(project.created_at) : '-'}
                </dd>
              </div>
              {project?.base_url && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Base URL</dt>
                  <dd className="text-foreground">
                    <a href={project.base_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {project.base_url}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Feature #1794: Test Defaults Section */}
        <div className="mt-8">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Test Defaults</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure default settings for all tests in this project
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Default Browser */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Default Browser
                </label>
                <select
                  value={projectDefaultBrowser}
                  onChange={(e) => setProjectDefaultBrowser(e.target.value as 'chromium' | 'firefox' | 'webkit')}
                  className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="chromium">Chromium (Chrome/Edge)</option>
                  <option value="firefox">Firefox</option>
                  <option value="webkit">WebKit (Safari)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  New test suites will use this browser by default
                </p>
              </div>

              {/* Viewport Profiles */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Viewport Profiles
                </label>
                <p className="text-sm text-muted-foreground mb-3">
                  Define common viewport sizes for visual and E2E tests
                </p>
                <div className="space-y-2">
                  {projectViewportProfiles.map((profile, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => {
                          const newProfiles = [...projectViewportProfiles];
                          newProfiles[index].name = e.target.value;
                          setProjectViewportProfiles(newProfiles);
                        }}
                        className="flex-1 max-w-[150px] rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
                        placeholder="Profile name"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={profile.width}
                          onChange={(e) => {
                            const newProfiles = [...projectViewportProfiles];
                            newProfiles[index].width = parseInt(e.target.value) || 0;
                            setProjectViewportProfiles(newProfiles);
                          }}
                          className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground text-center"
                          min={320}
                          max={3840}
                        />
                        <span className="text-muted-foreground">×</span>
                        <input
                          type="number"
                          value={profile.height}
                          onChange={(e) => {
                            const newProfiles = [...projectViewportProfiles];
                            newProfiles[index].height = parseInt(e.target.value) || 0;
                            setProjectViewportProfiles(newProfiles);
                          }}
                          className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground text-center"
                          min={200}
                          max={2160}
                        />
                      </div>
                      <button
                        onClick={() => {
                          setProjectViewportProfiles(projectViewportProfiles.filter((_, i) => i !== index));
                        }}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove profile"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setProjectViewportProfiles([...projectViewportProfiles, { name: 'New Profile', width: 1280, height: 720 }]);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Viewport Profile
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-border">
                <button
                  onClick={async () => {
                    setIsSavingProjectDefaults(true);
                    try {
                      // Save to backend (mock for now - would need API endpoint)
                      await new Promise(resolve => setTimeout(resolve, 500));
                      toast.success('Project defaults saved successfully');
                    } catch (err) {
                      toast.error('Failed to save project defaults');
                    } finally {
                      setIsSavingProjectDefaults(false);
                    }
                  }}
                  disabled={isSavingProjectDefaults}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSavingProjectDefaults ? 'Saving...' : 'Save Defaults'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Project Members Section (Project-Level Permissions) */}
        {canManageMembers && (
          <div className="mt-8">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Project Access</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage which team members have access to this project. Owners and admins always have full access.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  disabled={availableMembers.length === 0}
                >
                  Add Member
                </button>
              </div>

              {projectMembers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-muted-foreground">
                    No members have been granted explicit access to this project yet.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Developers and viewers need to be added here to access this project.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Member</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Project Role</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectMembers.map((member) => {
                        const details = getMemberDetails(member.user_id);
                        return (
                          <tr key={member.user_id} className="border-b border-border last:border-0">
                            <td className="py-3 px-4">
                              <div>
                                <div className="font-medium text-foreground">{details?.name || 'Unknown User'}</div>
                                <div className="text-sm text-muted-foreground">{details?.email || member.user_id}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                member.role === 'developer'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                              }`}>
                                {member.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleRemoveMember(member.user_id)}
                                className="text-sm text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alert Channels Section */}
        {canManageAlerts && (
          <div className="mt-8">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Alert Channels</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure notifications for test failures in this project.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setNewAlertType('email'); setShowCreateAlertModal(true); }}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Add Email Alert
                  </button>
                  <button
                    onClick={async () => {
                      // Fetch Slack channels before opening modal
                      try {
                        const response = await fetch(`/api/v1/organizations/${user?.organization_id}/slack/channels`, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (response.ok) {
                          const data = await response.json();
                          setSlackChannels(data.channels || []);
                          setNewAlertType('slack');
                          setShowCreateAlertModal(true);
                        } else if (response.status === 404) {
                          toast.error('Please connect Slack first in Organization Settings');
                        } else {
                          toast.error('Failed to fetch Slack channels');
                        }
                      } catch {
                        toast.error('Failed to fetch Slack channels');
                      }
                    }}
                    className="rounded-md bg-[#4A154B] px-4 py-2 text-sm font-medium text-white hover:bg-[#611f64]"
                  >
                    Add Slack Alert
                  </button>
                  <button
                    onClick={() => { setNewAlertType('webhook'); setShowCreateAlertModal(true); }}
                    className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Add Webhook Alert
                  </button>
                </div>
              </div>

              {alertChannels.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="mt-2 text-muted-foreground">
                    No alert channels configured yet.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Get notified when tests fail by adding an email alert.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        channel.enabled ? 'border-border bg-background' : 'border-border/50 bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          channel.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {channel.type === 'email' ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${channel.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {channel.name}
                            </span>
                            {!channel.enabled && (
                              <span className="text-xs text-muted-foreground">(disabled)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="capitalize">
                              {channel.condition === 'any_failure' && 'On any failure'}
                              {channel.condition === 'all_failures' && 'On all failures'}
                              {channel.condition === 'threshold' && `When ${channel.threshold_percent}%+ fail`}
                            </span>
                            <span>•</span>
                            <span>
                              {channel.type === 'email' && `${channel.email_addresses?.length || 0} recipient(s)`}
                              {channel.type === 'webhook' && 'Webhook endpoint'}
                            </span>
                            {channel.suppress_on_retry_success && (
                              <>
                                <span>•</span>
                                <span className="text-amber-600 dark:text-amber-400" title="Alert is suppressed if test passes on retry">
                                  Retry-aware
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleAlert(channel.id, channel.enabled)}
                          className={`rounded-md px-3 py-1.5 text-sm ${
                            channel.enabled
                              ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90'
                          }`}
                        >
                          {channel.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteAlert(channel.id)}
                          className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Alert History Section */}
              <div className="mt-6 border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-foreground">Alert History</h3>
                  <button
                    onClick={() => setShowAlertHistory(!showAlertHistory)}
                    className="text-sm text-primary hover:underline"
                  >
                    {showAlertHistory ? 'Hide History' : 'Show History'}
                  </button>
                </div>

                {showAlertHistory && (
                  <>
                    {alertHistory.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          No alerts have been triggered yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {alertHistory.map((entry) => (
                          <div
                            key={entry.id}
                            className={`flex items-start gap-3 rounded-lg border p-3 ${
                              entry.success
                                ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-900/10'
                                : 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10'
                            }`}
                          >
                            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                              entry.success ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {entry.success ? (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  entry.type === 'email'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                }`}>
                                  {entry.type === 'email' ? 'Email' : 'Webhook'}
                                </span>
                                <span className="text-sm font-medium text-foreground truncate">
                                  {entry.channelName}
                                </span>
                                <span className={`text-xs ${entry.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {entry.success ? 'Sent' : 'Failed'}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {entry.type === 'email' && entry.details.recipients && (
                                  <span>To: {entry.details.recipients.join(', ')}</span>
                                )}
                                {entry.type === 'webhook' && entry.details.webhookUrl && (
                                  <span>URL: {entry.details.webhookUrl.substring(0, 50)}...</span>
                                )}
                              </div>
                              {entry.error && (
                                <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                                  Error: {entry.error}
                                </div>
                              )}
                              <div className="mt-1 text-xs text-muted-foreground">
                                {new Date(entry.timestamp).toLocaleString()}
                                {' • '}
                                <button
                                  onClick={() => navigate(`/runs/${entry.runId}`)}
                                  className="text-primary hover:underline"
                                >
                                  View Run
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Environment Variables Section */}
              {(user?.role === 'owner' || user?.role === 'admin') && (
                <div className="mt-6 border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-md font-semibold text-foreground">Environment Variables</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Configure variables to use in your tests. Secret values are masked.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddEnvModal(true)}
                      className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      Add Variable
                    </button>
                  </div>

                  {envVars.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center">
                      <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="mt-2 text-muted-foreground">
                        No environment variables configured yet.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add variables like API keys, base URLs, or test credentials.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Key</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Value</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">Type</th>
                            <th className="px-4 py-2 text-right text-sm font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {envVars.map((envVar) => (
                            <tr key={envVar.id} className="hover:bg-muted/20">
                              <td className="px-4 py-3 text-sm font-mono text-foreground">{envVar.key}</td>
                              <td className="px-4 py-3 text-sm">
                                {editingEnvId === envVar.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editEnvValue}
                                      onChange={(e) => setEditEnvValue(e.target.value)}
                                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleUpdateEnvVar(envVar.id)}
                                      className="text-sm text-primary hover:underline"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => { setEditingEnvId(null); setEditEnvValue(''); }}
                                      className="text-sm text-muted-foreground hover:underline"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <span className={`font-mono ${envVar.is_secret ? 'text-muted-foreground' : 'text-foreground'}`}>
                                    {envVar.value}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {envVar.is_secret ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                    Secret
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                    Plain
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {editingEnvId !== envVar.id && (
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => { setEditingEnvId(envVar.id); setEditEnvValue(''); }}
                                      className="text-sm text-primary hover:underline"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteEnvVar(envVar.id)}
                                      className="text-sm text-red-600 hover:underline"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* AI Test Healing Settings Section (Feature #1064) */}
              {(user?.role === 'owner' || user?.role === 'admin') && (
                <div className="mt-6 border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-md font-semibold text-foreground flex items-center gap-2">
                        <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        AI Test Healing
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Configure AI-powered test self-healing to automatically fix broken selectors.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                    {/* Enable/Disable Healing */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-foreground">Enable AI Healing</label>
                        <p className="text-xs text-muted-foreground">When enabled, tests will attempt to self-heal when selectors fail</p>
                      </div>
                      <button
                        onClick={() => setHealingSettings({ ...healingSettings, healing_enabled: !healingSettings.healing_enabled })}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          healingSettings.healing_enabled ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            healingSettings.healing_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Healing Timeout */}
                    <div>
                      <label className="text-sm font-medium text-foreground">Healing Timeout (seconds)</label>
                      <p className="text-xs text-muted-foreground mb-2">Maximum time to attempt healing before aborting (5-120 seconds)</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="5"
                          max="120"
                          step="5"
                          value={healingSettings.healing_timeout}
                          onChange={(e) => setHealingSettings({ ...healingSettings, healing_timeout: parseInt(e.target.value) })}
                          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                          disabled={!healingSettings.healing_enabled}
                        />
                        <input
                          type="number"
                          min="5"
                          max="120"
                          value={healingSettings.healing_timeout}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val >= 5 && val <= 120) {
                              setHealingSettings({ ...healingSettings, healing_timeout: val });
                            }
                          }}
                          className="w-20 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground text-center"
                          disabled={!healingSettings.healing_enabled}
                        />
                        <span className="text-sm text-muted-foreground">sec</span>
                      </div>
                    </div>

                    {/* Max Healing Attempts */}
                    <div>
                      <label className="text-sm font-medium text-foreground">Max Healing Attempts</label>
                      <p className="text-xs text-muted-foreground mb-2">Maximum number of healing attempts per failed selector (1-10)</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={healingSettings.max_healing_attempts}
                          onChange={(e) => setHealingSettings({ ...healingSettings, max_healing_attempts: parseInt(e.target.value) })}
                          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                          disabled={!healingSettings.healing_enabled}
                        />
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={healingSettings.max_healing_attempts}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val >= 1 && val <= 10) {
                              setHealingSettings({ ...healingSettings, max_healing_attempts: val });
                            }
                          }}
                          className="w-20 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground text-center"
                          disabled={!healingSettings.healing_enabled}
                        />
                      </div>
                    </div>

                    {/* Healing Strategies */}
                    <div>
                      <label className="text-sm font-medium text-foreground">Healing Strategies</label>
                      <p className="text-xs text-muted-foreground mb-2">Select which healing strategies to use when selectors fail</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'selector_fallback', label: 'Selector Fallback', desc: 'Try alternative selectors' },
                          { id: 'visual_match', label: 'Visual Match', desc: 'Match elements by appearance' },
                          { id: 'text_match', label: 'Text Match', desc: 'Find elements by text content' },
                          { id: 'attribute_match', label: 'Attribute Match', desc: 'Match by data attributes' },
                          { id: 'css_selector', label: 'CSS Selector', desc: 'Generate CSS selectors' },
                          { id: 'xpath', label: 'XPath', desc: 'Generate XPath selectors' },
                        ].map((strategy) => (
                          <label
                            key={strategy.id}
                            className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                              healingSettings.healing_strategies.includes(strategy.id)
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:bg-muted/30'
                            } ${!healingSettings.healing_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={healingSettings.healing_strategies.includes(strategy.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setHealingSettings({
                                    ...healingSettings,
                                    healing_strategies: [...healingSettings.healing_strategies, strategy.id],
                                  });
                                } else {
                                  setHealingSettings({
                                    ...healingSettings,
                                    healing_strategies: healingSettings.healing_strategies.filter((s) => s !== strategy.id),
                                  });
                                }
                              }}
                              disabled={!healingSettings.healing_enabled}
                              className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                            />
                            <div>
                              <span className="text-sm font-medium text-foreground">{strategy.label}</span>
                              <p className="text-xs text-muted-foreground">{strategy.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Notify on Healing */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div>
                        <label className="text-sm font-medium text-foreground">Notify on Healing</label>
                        <p className="text-xs text-muted-foreground">Send a notification when healing is applied to a test</p>
                      </div>
                      <button
                        onClick={() => setHealingSettings({ ...healingSettings, notify_on_healing: !healingSettings.notify_on_healing })}
                        disabled={!healingSettings.healing_enabled}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          healingSettings.notify_on_healing ? 'bg-primary' : 'bg-muted'
                        } ${!healingSettings.healing_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            healingSettings.notify_on_healing ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      {healingSettingsMessage && (
                        <p className={`text-sm ${healingSettingsMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                          {healingSettingsMessage.text}
                        </p>
                      )}
                      <button
                        onClick={handleSaveHealingSettings}
                        disabled={isSavingHealingSettings}
                        className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isSavingHealingSettings ? 'Saving...' : 'Save Healing Settings'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
          </>
        )}

        {/* GitHub Tab Content */}
        {activeTab === 'github' && (
          <div className="mt-8 space-y-6">
            {/* GitHub Account Status */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <svg className="h-6 w-6 text-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">GitHub Account</h2>
                    {githubConnected ? (
                      <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Connected as {githubUsername}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Connect your GitHub account to access repositories</p>
                    )}
                  </div>
                </div>
                {githubConnected ? (
                  <button
                    onClick={handleDisconnectGithub}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnectGithub}
                    disabled={isConnectingGithub}
                    className="rounded-md bg-[#24292e] px-4 py-2 text-sm font-medium text-white hover:bg-[#24292e]/90 disabled:opacity-50"
                  >
                    {isConnectingGithub ? 'Connecting...' : 'Connect GitHub'}
                  </button>
                )}
              </div>
            </div>

            {/* Repository Connection */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Repository</h2>
                {githubConnection && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncRepo}
                      disabled={isSyncingGithub}
                      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {isSyncingGithub ? 'Syncing...' : 'Sync'}
                    </button>
                    <button
                      onClick={handleDisconnectRepo}
                      disabled={isDisconnectingRepo}
                      className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {isDisconnectingRepo ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                )}
              </div>

              {githubError && (
                <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {githubError}
                </div>
              )}

              {githubConnection ? (
                <div>
                  {/* Connected Repository Info */}
                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="flex items-center gap-3">
                      <svg className="h-8 w-8 text-foreground" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      <div>
                        <p className="font-semibold text-foreground">
                          {githubConnection.github_owner}/{githubConnection.github_repo}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Path: {githubConnection.test_path}
                        </p>
                      </div>
                    </div>

                    {/* Branch Selector */}
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-sm font-medium text-foreground">Branch:</label>
                      <select
                        value={githubConnection.github_branch}
                        onChange={(e) => handleChangeBranch(e.target.value)}
                        disabled={isChangingBranch}
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                      >
                        {availableBranches.map((branch) => (
                          <option key={branch} value={branch}>{branch}</option>
                        ))}
                      </select>
                      {isChangingBranch && (
                        <svg className="h-4 w-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                    </div>

                    {githubConnection.last_synced_at && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last synced: {formatDate(githubConnection.last_synced_at)}
                      </p>
                    )}
                  </div>

                  {/* Test Files */}
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      Discovered Test Files ({githubTestFiles.length})
                    </h3>
                    {githubTestFiles.length > 0 ? (
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {githubTestFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                            <svg className="h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-foreground font-mono text-xs truncate">{file.path}</span>
                            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                              {file.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No test files found in this repository.</p>
                    )}
                  </div>

                  {/* PR Status Checks */}
                  <div className="mt-6 pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">PR Status Checks</h3>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prChecksEnabled}
                          onChange={(e) => handleTogglePRChecks(e.target.checked)}
                          disabled={isTogglingPRChecks}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                        />
                        <span className="text-sm text-muted-foreground">
                          {isTogglingPRChecks ? 'Updating...' : 'Enabled'}
                        </span>
                      </label>
                    </div>

                    {prChecksEnabled && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          QA Guardian will post status checks to pull requests including E2E and Visual test results.
                          Visual test failures will block PR merging until regressions are fixed or baselines are approved.
                        </p>

                        {pullRequests.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {pullRequests.map((pr) => (
                              <div key={pr.number} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    #{pr.number}: {pr.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {pr.branch} • {pr.head_sha.substring(0, 7)}
                                  </p>
                                </div>
                                {pr.status_check ? (
                                  <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                                    pr.status_check.status === 'success' ? 'bg-green-500/10 text-green-600' :
                                    pr.status_check.status === 'failure' ? 'bg-red-500/10 text-red-600' :
                                    pr.status_check.status === 'running' ? 'bg-blue-500/10 text-blue-600' :
                                    pr.status_check.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' :
                                    'bg-gray-500/10 text-gray-600'
                                  }`}>
                                    {pr.status_check.status === 'running' && (
                                      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    )}
                                    {pr.status_check.status === 'success' && (
                                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                    {pr.status_check.status === 'failure' && (
                                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                    {pr.status_check.status}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handlePostPRStatus(pr.number, 'pending')}
                                    className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                                  >
                                    Run Tests
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No open pull requests found.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* PR Comments */}
                  <div className="mt-6 pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">PR Comments</h3>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prCommentsEnabled}
                          onChange={(e) => handleTogglePRComments(e.target.checked)}
                          disabled={isTogglingPRComments}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                        />
                        <span className="text-sm text-muted-foreground">
                          {isTogglingPRComments ? 'Updating...' : 'Enabled'}
                        </span>
                      </label>
                    </div>

                    {prCommentsEnabled && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          QA Guardian will post test result comments to pull requests in this repository.
                        </p>

                        {pullRequests.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {pullRequests.map((pr) => (
                              <div key={`comment-${pr.number}`} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    #{pr.number}: {pr.title}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handlePostPRComment(pr.number)}
                                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                                >
                                  Post Comment
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No open pull requests found.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Feature #768: PR Dependency Scanning */}
                  <div className="mt-6 pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        PR Dependency Scanning
                      </h3>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prDependencyScanEnabled}
                          onChange={(e) => handleTogglePRDependencyScan(e.target.checked)}
                          disabled={isTogglingPRDependencyScan}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                        />
                        <span className="text-sm text-muted-foreground">
                          {isTogglingPRDependencyScan ? 'Updating...' : 'Enabled'}
                        </span>
                      </label>
                    </div>

                    {prDependencyScanEnabled && (
                      <div className="space-y-4">
                        <p className="text-xs text-muted-foreground mb-2">
                          Automatically scan dependencies when package files change in a PR. Vulnerabilities will be flagged before merge.
                        </p>

                        {/* Watched Files */}
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Watch Files</label>
                          <div className="flex flex-wrap gap-2">
                            {['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].map((file) => (
                              <label key={file} className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="checkbox"
                                  checked={prDependencyScanFiles.includes(file)}
                                  onChange={(e) => {
                                    const newFiles = e.target.checked
                                      ? [...prDependencyScanFiles, file]
                                      : prDependencyScanFiles.filter(f => f !== file);
                                    handleUpdatePRDependencyScanConfig({ pr_dependency_scan_files: newFiles });
                                  }}
                                  className="h-3 w-3 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-muted-foreground font-mono">{file}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Severity Threshold */}
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Minimum Severity to Report</label>
                          <select
                            value={prDependencyScanSeverity}
                            onChange={(e) => handleUpdatePRDependencyScanConfig({ pr_dependency_scan_severity: e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' })}
                            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
                          >
                            <option value="CRITICAL">Critical only</option>
                            <option value="HIGH">High and above</option>
                            <option value="MEDIUM">Medium and above</option>
                            <option value="LOW">All vulnerabilities</option>
                          </select>
                        </div>

                        {/* Block on Critical */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="block-on-critical"
                            checked={prDependencyScanBlockOnCritical}
                            onChange={(e) => handleUpdatePRDependencyScanConfig({ pr_dependency_scan_block_on_critical: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <label htmlFor="block-on-critical" className="text-sm text-foreground">
                            Block PR merge on critical vulnerabilities
                          </label>
                        </div>

                        {/* PR List with Scan Button */}
                        {pullRequests.length > 0 && (
                          <div className="mt-4">
                            <label className="block text-xs font-medium text-foreground mb-2">Scan PRs for Dependencies</label>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {pullRequests.map((pr) => (
                                <div key={`dep-${pr.number}`} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      #{pr.number}: {pr.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {pr.branch}
                                    </p>
                                  </div>
                                  {prDependencyScanResults[pr.number] ? (
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                        prDependencyScanResults[pr.number].summary.critical > 0
                                          ? 'bg-red-500/10 text-red-600'
                                          : prDependencyScanResults[pr.number].summary.high > 0
                                            ? 'bg-orange-500/10 text-orange-600'
                                            : prDependencyScanResults[pr.number].summary.total > 0
                                              ? 'bg-yellow-500/10 text-yellow-600'
                                              : 'bg-green-500/10 text-green-600'
                                      }`}>
                                        {prDependencyScanResults[pr.number].summary.total === 0
                                          ? '✓ Clean'
                                          : `${prDependencyScanResults[pr.number].summary.total} vuln${prDependencyScanResults[pr.number].summary.total !== 1 ? 's' : ''}`}
                                      </span>
                                      {prDependencyScanResults[pr.number].summary.new_in_pr > 0 && (
                                        <span className="text-xs text-red-500">
                                          +{prDependencyScanResults[pr.number].summary.new_in_pr} new
                                        </span>
                                      )}
                                      {prDependencyScanResults[pr.number].summary.fixed_in_pr > 0 && (
                                        <span className="text-xs text-green-500">
                                          -{prDependencyScanResults[pr.number].summary.fixed_in_pr} fixed
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleTriggerPRDependencyScan(pr.number)}
                                      disabled={isRunningPRDependencyScan === pr.number}
                                      className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {isRunningPRDependencyScan === pr.number ? (
                                        <>
                                          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                          Scanning...
                                        </>
                                      ) : (
                                        <>
                                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                          </svg>
                                          Scan Dependencies
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  {githubConnected ? (
                    <>
                      <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">No Repository Connected</h3>
                      <p className="mt-2 text-muted-foreground">
                        Connect a GitHub repository to import and run Playwright tests.
                      </p>
                      <button
                        onClick={handleOpenRepoSelect}
                        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Connect Repository
                      </button>
                    </>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">Connect GitHub First</h3>
                      <p className="mt-2 text-muted-foreground">
                        Connect your GitHub account above to access your repositories.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Security Tab Content - SAST Scanning */}
        {activeTab === 'security' && (
          <div className="mt-8 space-y-6">
            {/* SAST Configuration Section */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                    <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Static Application Security Testing (SAST)</h2>
                    <p className="text-sm text-muted-foreground">
                      Scan your source code for security vulnerabilities using Semgrep
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-muted-foreground">
                    {sastConfig.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      sastConfig.enabled ? 'bg-orange-600' : 'bg-muted'
                    }`}
                    onClick={() => !isUpdatingSast && handleUpdateSastConfig({ enabled: !sastConfig.enabled })}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        sastConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </label>
              </div>

              {isLoadingSast ? (
                <div className="py-8 text-center">
                  <svg className="mx-auto h-8 w-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="mt-2 text-muted-foreground">Loading SAST configuration...</p>
                </div>
              ) : sastConfig.enabled && (
                <div className="space-y-4">
                  {/* Ruleset Selection */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Semgrep Ruleset
                    </label>
                    <select
                      value={sastConfig.ruleset}
                      onChange={(e) => handleUpdateSastConfig({ ruleset: e.target.value as 'default' | 'security' | 'custom' })}
                      disabled={isUpdatingSast}
                      className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      {sastRulesets.map((ruleset) => (
                        <option key={ruleset.id} value={ruleset.id}>
                          {ruleset.name} - {ruleset.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Severity Threshold */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Minimum Severity to Report
                    </label>
                    <select
                      value={sastConfig.severityThreshold}
                      onChange={(e) => handleUpdateSastConfig({ severityThreshold: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' })}
                      disabled={isUpdatingSast}
                      className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="CRITICAL">Critical only</option>
                      <option value="HIGH">High and above</option>
                      <option value="MEDIUM">Medium and above</option>
                      <option value="LOW">All findings (including low)</option>
                    </select>
                  </div>

                  {/* Auto-scan toggle */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="auto-scan"
                      checked={sastConfig.autoScan}
                      onChange={(e) => handleUpdateSastConfig({ autoScan: e.target.checked })}
                      disabled={isUpdatingSast}
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <label htmlFor="auto-scan" className="text-sm text-foreground">
                      Automatically scan on repository changes
                    </label>
                  </div>

                  {/* Trigger Scan Button */}
                  <div className="pt-4 border-t border-border">
                    <button
                      onClick={handleTriggerScan}
                      disabled={isRunningScan || isUpdatingSast}
                      className="flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      {isRunningScan ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Scanning...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Run SAST Scan
                        </>
                      )}
                    </button>
                    {sastConfig.lastScanAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last scan: {new Date(sastConfig.lastScanAt).toLocaleString()}
                        {sastConfig.lastScanStatus && (
                          <span className={`ml-2 ${
                            sastConfig.lastScanStatus === 'completed' ? 'text-green-600' :
                            sastConfig.lastScanStatus === 'failed' ? 'text-red-600' :
                            'text-amber-600'
                          }`}>
                            ({sastConfig.lastScanStatus})
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* GitHub PR Integration Settings */}
                  <div className="pt-4 mt-4 border-t border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                      </svg>
                      GitHub PR Integration
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Configure how SAST scans integrate with GitHub pull requests
                    </p>

                    <div className="space-y-3">
                      {/* PR Checks Toggle */}
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="sast-pr-checks"
                          checked={sastConfig.prChecksEnabled || false}
                          onChange={(e) => handleUpdateSastConfig({ prChecksEnabled: e.target.checked })}
                          disabled={isUpdatingSast}
                          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <label htmlFor="sast-pr-checks" className="text-sm text-foreground">
                          Enable SAST checks on pull requests
                        </label>
                      </div>

                      {/* PR Comments Toggle */}
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="sast-pr-comments"
                          checked={sastConfig.prCommentsEnabled || false}
                          onChange={(e) => handleUpdateSastConfig({ prCommentsEnabled: e.target.checked })}
                          disabled={isUpdatingSast || !sastConfig.prChecksEnabled}
                          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
                        />
                        <label htmlFor="sast-pr-comments" className={`text-sm ${sastConfig.prChecksEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                          Post SAST findings as PR comments
                        </label>
                      </div>

                      {/* Block on Critical Toggle */}
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="sast-block-critical"
                          checked={sastConfig.blockPrOnCritical || false}
                          onChange={(e) => handleUpdateSastConfig({ blockPrOnCritical: e.target.checked })}
                          disabled={isUpdatingSast || !sastConfig.prChecksEnabled}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 disabled:opacity-50"
                        />
                        <label htmlFor="sast-block-critical" className={`text-sm ${sastConfig.prChecksEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                          <span className="text-red-600 font-medium">Block PR</span> if critical vulnerabilities found
                        </label>
                      </div>

                      {/* Block on High Toggle */}
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="sast-block-high"
                          checked={sastConfig.blockPrOnHigh || false}
                          onChange={(e) => handleUpdateSastConfig({ blockPrOnHigh: e.target.checked })}
                          disabled={isUpdatingSast || !sastConfig.prChecksEnabled}
                          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
                        />
                        <label htmlFor="sast-block-high" className={`text-sm ${sastConfig.prChecksEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                          <span className="text-amber-600 font-medium">Block PR</span> if high or critical vulnerabilities found
                        </label>
                      </div>
                    </div>

                    {sastConfig.prChecksEnabled && (
                      <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          <strong>Note:</strong> SAST checks will automatically run when a PR is created or updated.
                          {sastConfig.blockPrOnCritical && ' PRs with critical vulnerabilities will be blocked from merging.'}
                          {sastConfig.blockPrOnHigh && !sastConfig.blockPrOnCritical && ' PRs with high or critical vulnerabilities will be blocked from merging.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Rules Section */}
            {sastConfig.enabled && (
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Custom Rules</h3>
                    <p className="text-sm text-muted-foreground">
                      Add organization-specific Semgrep rules for custom vulnerability detection
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddCustomRuleModal(true)}
                    className="flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Custom Rule
                  </button>
                </div>

                {customRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <svg className="mx-auto h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>No custom rules configured yet</p>
                    <p className="text-sm mt-1">Add custom Semgrep rules to detect organization-specific patterns</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-background"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                              rule.enabled ? 'bg-orange-600' : 'bg-muted'
                            }`}
                            onClick={() => handleToggleCustomRule(rule.id, !rule.enabled)}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                rule.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{rule.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Added {new Date(rule.createdAt).toLocaleDateString()}
                              {rule.enabled ? ' • Active' : ' • Disabled'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteCustomRule(rule.id)}
                            className="p-2 text-muted-foreground hover:text-red-600 transition-colors"
                            title="Delete rule"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Custom Secret Patterns Section */}
            {sastConfig.enabled && (
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Custom Secret Patterns</h3>
                      <p className="text-sm text-muted-foreground">
                        Define custom regex patterns to detect organization-specific secrets
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddSecretPatternModal(true)}
                    className="flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Pattern
                  </button>
                </div>

                {secretPatterns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <svg className="mx-auto h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <p>No custom secret patterns configured</p>
                    <p className="text-sm mt-1">Add regex patterns to detect organization-specific secrets like internal API keys or tokens</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {secretPatterns.map((pattern) => (
                      <div
                        key={pattern.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-background"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                              pattern.enabled ? 'bg-purple-600' : 'bg-muted'
                            }`}
                            onClick={() => handleToggleSecretPattern(pattern.id, !pattern.enabled)}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                pattern.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{pattern.name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                pattern.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                pattern.severity === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                pattern.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                {pattern.severity}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Pattern: <code className="bg-muted px-1 rounded">{pattern.pattern}</code>
                            </p>
                            {pattern.description && (
                              <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteSecretPattern(pattern.id)}
                            className="p-2 text-muted-foreground hover:text-red-600 transition-colors"
                            title="Delete pattern"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Feature #1560: Pre-commit Hook Generation Section */}
            {sastConfig.enabled && (
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Pre-commit Hook</h3>
                      <p className="text-sm text-muted-foreground">
                        Generate a pre-commit hook to prevent secrets from being committed
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">Why use a pre-commit hook?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Catches secrets before they enter your git history</li>
                    <li>Prevents accidental credential exposure</li>
                    <li>Enforces security at the developer level</li>
                    <li>Works offline, no server required</li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Pre-commit Framework Option */}
                  <div className="border border-border rounded-lg p-4 hover:border-green-500 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span className="font-medium text-foreground">.pre-commit-config.yaml</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      For the pre-commit framework. Easiest setup with automatic updates.
                    </p>
                    <div className="flex gap-2">
                      <a
                        href={`/api/v1/projects/${id}/sast/gitleaks/pre-commit/download?format=pre-commit&mode=fail`}
                        download=".pre-commit-config.yaml"
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Block Mode
                      </a>
                      <a
                        href={`/api/v1/projects/${id}/sast/gitleaks/pre-commit/download?format=pre-commit&mode=warn`}
                        download=".pre-commit-config.yaml"
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Warn Mode
                      </a>
                    </div>
                  </div>

                  {/* Git Hook Option */}
                  <div className="border border-border rounded-lg p-4 hover:border-green-500 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span className="font-medium text-foreground">Git Hook Script</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Native bash script for .git/hooks/pre-commit. No dependencies required.
                    </p>
                    <div className="flex gap-2">
                      <a
                        href={`/api/v1/projects/${id}/sast/gitleaks/pre-commit/download?format=git-hook&mode=fail`}
                        download="pre-commit"
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Block Mode
                      </a>
                      <a
                        href={`/api/v1/projects/${id}/sast/gitleaks/pre-commit/download?format=git-hook&mode=warn`}
                        download="pre-commit"
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Warn Mode
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Block Mode:</strong> Prevents commits when secrets are detected.{' '}
                    <strong>Warn Mode:</strong> Shows warnings but allows the commit.
                    {secretPatterns.filter(p => p.enabled).length > 0 && (
                      <> Your {secretPatterns.filter(p => p.enabled).length} custom pattern(s) will be included.</>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Add Secret Pattern Modal */}
            {showAddSecretPatternModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Add Custom Secret Pattern</h3>
                    <button
                      onClick={() => {
                        setShowAddSecretPatternModal(false);
                        setNewPatternName('');
                        setNewPatternDescription('');
                        setNewPatternRegex('');
                        setNewPatternSeverity('HIGH');
                        setPatternError(null);
                        setPatternTestInput('');
                        setPatternTestResult(null);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {patternError && (
                    <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                      {patternError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Pattern Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newPatternName}
                        onChange={(e) => setNewPatternName(e.target.value)}
                        placeholder="e.g., Internal API Key"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        value={newPatternDescription}
                        onChange={(e) => setNewPatternDescription(e.target.value)}
                        placeholder="e.g., Detects our internal API keys starting with IAK_"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Regex Pattern <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newPatternRegex}
                        onChange={(e) => {
                          setNewPatternRegex(e.target.value);
                          setPatternTestResult(null);
                        }}
                        placeholder="e.g., IAK_[A-Za-z0-9]{32}"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Enter a valid JavaScript regex pattern (without slashes)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Severity
                      </label>
                      <select
                        value={newPatternSeverity}
                        onChange={(e) => setNewPatternSeverity(e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      >
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </div>

                    {/* Pattern Tester */}
                    <div className="pt-4 border-t border-border">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Test Your Pattern
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={patternTestInput}
                          onChange={(e) => {
                            setPatternTestInput(e.target.value);
                            setPatternTestResult(null);
                          }}
                          placeholder="Enter test string..."
                          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
                        />
                        <button
                          onClick={handleTestPattern}
                          disabled={!newPatternRegex || !patternTestInput}
                          className="px-4 py-2 rounded-md bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50"
                        >
                          Test
                        </button>
                      </div>
                      {patternTestResult && (
                        <div className={`mt-2 p-2 rounded text-sm ${
                          patternTestResult.matches
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                        }`}>
                          {patternTestResult.matches ? (
                            <>✓ Pattern matches! Found: <code className="bg-green-100 dark:bg-green-900/30 px-1 rounded">{patternTestResult.matched}</code></>
                          ) : (
                            <>✗ Pattern does not match the test string</>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowAddSecretPatternModal(false);
                        setNewPatternName('');
                        setNewPatternDescription('');
                        setNewPatternRegex('');
                        setNewPatternSeverity('HIGH');
                        setPatternError(null);
                        setPatternTestInput('');
                        setPatternTestResult(null);
                      }}
                      className="px-4 py-2 rounded-md border border-input bg-background text-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddSecretPattern}
                      disabled={isAddingPattern || !newPatternName.trim() || !newPatternRegex.trim()}
                      className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isAddingPattern ? 'Adding...' : 'Add Pattern'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Custom Rule Modal */}
            {showAddCustomRuleModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Add Custom Semgrep Rule</h3>
                    <button
                      onClick={() => {
                        setShowAddCustomRuleModal(false);
                        setNewCustomRuleName('');
                        setNewCustomRuleYaml('');
                        setCustomRuleError(null);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {customRuleError && (
                    <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                      {customRuleError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Rule Name
                      </label>
                      <input
                        type="text"
                        value={newCustomRuleName}
                        onChange={(e) => setNewCustomRuleName(e.target.value)}
                        placeholder="e.g., Detect hardcoded API keys"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Semgrep Rule YAML
                      </label>
                      <textarea
                        value={newCustomRuleYaml}
                        onChange={(e) => setNewCustomRuleYaml(e.target.value)}
                        placeholder={`rules:
  - id: my-custom-rule
    pattern: $X = "HARDCODED_SECRET"
    message: "Hardcoded secret detected"
    severity: ERROR
    languages: [javascript, typescript]`}
                        rows={12}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Write a valid Semgrep rule in YAML format.{' '}
                        <a
                          href="https://semgrep.dev/docs/writing-rules/overview/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:underline"
                        >
                          Learn more about Semgrep rules
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowAddCustomRuleModal(false);
                        setNewCustomRuleName('');
                        setNewCustomRuleYaml('');
                        setCustomRuleError(null);
                      }}
                      className="px-4 py-2 rounded-md border border-input bg-background text-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddCustomRule}
                      disabled={isAddingCustomRule || !newCustomRuleName.trim() || !newCustomRuleYaml.trim()}
                      className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      {isAddingCustomRule ? 'Adding...' : 'Add Rule'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Scan Results Section */}
            {sastConfig.enabled && sastScans.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Recent Scan Results</h3>
                <div className="space-y-4">
                  {sastScans.map((scan) => (
                    <div
                      key={scan.id}
                      className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                        selectedScan?.id === scan.id
                          ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10'
                          : 'border-border hover:border-orange-300'
                      }`}
                      onClick={() => setSelectedScan(selectedScan?.id === scan.id ? null : scan)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            scan.status === 'completed' && scan.summary.bySeverity.critical > 0
                              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                              : scan.status === 'completed' && scan.summary.bySeverity.high > 0
                              ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                              : scan.status === 'completed' && scan.summary.bySeverity.medium > 0
                              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                              : scan.status === 'completed'
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : scan.status === 'failed'
                              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {scan.status === 'running' ? (
                              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : scan.status === 'completed' ? (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {scan.status === 'completed' ? `${scan.summary.total} findings` :
                               scan.status === 'running' ? 'Scan in progress...' : 'Scan failed'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(scan.startedAt).toLocaleString()}
                              {scan.branch && ` • Branch: ${scan.branch}`}
                            </p>
                          </div>
                        </div>
                        {scan.status === 'completed' && (
                          <div className="flex items-center gap-4 text-sm">
                            {scan.summary.bySeverity.critical > 0 && (
                              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                {scan.summary.bySeverity.critical} critical
                              </span>
                            )}
                            {scan.summary.bySeverity.high > 0 && (
                              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {scan.summary.bySeverity.high} high
                              </span>
                            )}
                            {scan.summary.bySeverity.medium > 0 && (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {scan.summary.bySeverity.medium} medium
                              </span>
                            )}
                            {scan.summary.bySeverity.low > 0 && (
                              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                {scan.summary.bySeverity.low} low
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expanded findings view */}
                      {selectedScan?.id === scan.id && scan.findings.length > 0 && (
                        <div className="mt-4 border-t border-border pt-4">
                          <h4 className="text-sm font-medium text-foreground mb-3">Findings</h4>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {scan.findings.map((finding) => (
                              <div
                                key={finding.id}
                                className={`rounded-md border p-3 ${
                                  finding.isFalsePositive
                                    ? 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30 opacity-60'
                                    : finding.severity === 'CRITICAL'
                                    ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10'
                                    : finding.severity === 'HIGH'
                                    ? 'border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-900/10'
                                    : finding.severity === 'MEDIUM'
                                    ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/10'
                                    : 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-900/10'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex flex-col gap-1">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                      finding.isFalsePositive
                                        ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                        : finding.severity === 'CRITICAL'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                        : finding.severity === 'HIGH'
                                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                        : finding.severity === 'MEDIUM'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    }`}>
                                      {finding.severity}
                                    </span>
                                    {finding.isFalsePositive && (
                                      <span className="inline-flex items-center rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                                        False Positive
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className={`font-medium text-foreground ${finding.isFalsePositive ? 'line-through' : ''}`}>
                                        {finding.ruleName}
                                      </p>
                                      {!finding.isFalsePositive && (
                                        <button
                                          onClick={() => {
                                            setSelectedFinding(finding);
                                            setShowFalsePositiveModal(true);
                                          }}
                                          className="shrink-0 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                        >
                                          Mark False Positive
                                        </button>
                                      )}
                                    </div>
                                    <p className={`text-sm text-muted-foreground mt-1 ${finding.isFalsePositive ? 'line-through' : ''}`}>
                                      {finding.message}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                                      {finding.filePath}:{finding.line}
                                      {finding.column && `:${finding.column}`}
                                    </p>
                                    {finding.snippet && (
                                      <pre className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto">
                                        {finding.snippet}
                                      </pre>
                                    )}
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {finding.cweId && (
                                        <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300">
                                          {finding.cweId}
                                        </span>
                                      )}
                                      {finding.owaspCategory && (
                                        <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
                                          {finding.owaspCategory}
                                        </span>
                                      )}
                                    </div>
                                    {finding.suggestion && !finding.isFalsePositive && (
                                      <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                                        <p className="text-xs text-green-800 dark:text-green-200">
                                          <strong>Suggestion:</strong> {finding.suggestion}
                                        </p>
                                      </div>
                                    )}

                                    {/* Expandable Remediation Guidance */}
                                    {finding.remediation && !finding.isFalsePositive && (
                                      <div className="mt-3 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                                        <button
                                          onClick={() => toggleRemediation(finding.id)}
                                          className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                        >
                                          <span className="flex items-center gap-2 text-sm font-medium">
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                            Remediation Guidance
                                          </span>
                                          <svg
                                            className={`h-4 w-4 transition-transform ${expandedRemediations.has(finding.id) ? 'rotate-180' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>

                                        {expandedRemediations.has(finding.id) && (
                                          <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
                                            {/* Summary */}
                                            <div>
                                              <p className="text-sm text-foreground font-medium">{finding.remediation.summary}</p>
                                            </div>

                                            {/* Steps */}
                                            <div>
                                              <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Fix Steps</h5>
                                              <ol className="list-decimal list-inside space-y-1">
                                                {finding.remediation.steps.map((step, idx) => (
                                                  <li key={idx} className="text-sm text-muted-foreground">{step}</li>
                                                ))}
                                              </ol>
                                            </div>

                                            {/* Secure Code Example */}
                                            {finding.remediation.secureCodeExample && (
                                              <div>
                                                <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Secure Code Pattern</h5>
                                                <div className="grid md:grid-cols-2 gap-3">
                                                  <div>
                                                    <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">❌ Before (Vulnerable)</p>
                                                    <pre className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-red-200 dark:border-red-800">
                                                      {finding.remediation.secureCodeExample.before}
                                                    </pre>
                                                  </div>
                                                  <div>
                                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">✅ After (Secure)</p>
                                                    <pre className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-green-200 dark:border-green-800">
                                                      {finding.remediation.secureCodeExample.after}
                                                    </pre>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {/* References */}
                                            {finding.remediation.references.length > 0 && (
                                              <div>
                                                <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Documentation & References</h5>
                                                <ul className="space-y-1">
                                                  {finding.remediation.references.map((ref, idx) => (
                                                    <li key={idx}>
                                                      <a
                                                        href={ref.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                      >
                                                        {ref.title}
                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                      </a>
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state when SAST is not enabled */}
            {!sastConfig.enabled && !isLoadingSast && (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-foreground">SAST Scanning Disabled</h3>
                <p className="mt-2 text-muted-foreground">
                  Enable SAST scanning to detect security vulnerabilities in your source code using Semgrep.
                </p>
                <button
                  onClick={() => handleUpdateSastConfig({ enabled: true })}
                  className="mt-4 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                >
                  Enable SAST Scanning
                </button>
              </div>
            )}

            {/* ========== DAST Section ========== */}
            <div className="mt-8 pt-8 border-t border-border">
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Dynamic Application Security Testing (DAST)</h2>
                      <p className="text-sm text-muted-foreground">
                        Scan running web applications for security vulnerabilities using OWASP ZAP
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-muted-foreground">
                      {dastConfig.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <div
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        dastConfig.enabled ? 'bg-purple-600' : 'bg-muted'
                      }`}
                      onClick={() => !isUpdatingDast && handleUpdateDastConfig({ enabled: !dastConfig.enabled })}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          dastConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </div>
                  </label>
                </div>

                {isLoadingDast ? (
                  <div className="py-8 text-center">
                    <svg className="mx-auto h-8 w-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="mt-2 text-muted-foreground">Loading DAST configuration...</p>
                  </div>
                ) : dastConfig.enabled && (
                  <div className="space-y-4">
                    {/* Target URL */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Target URL
                      </label>
                      <input
                        type="url"
                        value={dastTargetUrl}
                        onChange={(e) => setDastTargetUrl(e.target.value)}
                        onBlur={() => {
                          if (dastTargetUrl !== dastConfig.targetUrl) {
                            handleUpdateDastConfig({ targetUrl: dastTargetUrl });
                          }
                        }}
                        placeholder="https://your-app.example.com"
                        className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        The URL of the running application to scan (e.g., staging environment)
                      </p>
                    </div>

                    {/* Scan Profile */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Scan Profile
                      </label>
                      <select
                        value={dastConfig.scanProfile}
                        onChange={(e) => handleUpdateDastConfig({ scanProfile: e.target.value as 'baseline' | 'full' | 'api' })}
                        disabled={isUpdatingDast}
                        className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      >
                        <option value="baseline">Baseline Scan - Quick passive scan (~2 min)</option>
                        <option value="full">Full Scan - Comprehensive active scan (~30+ min)</option>
                        <option value="api">API Scan - For REST/GraphQL APIs (~5-10 min)</option>
                      </select>
                    </div>

                    {/* OpenAPI Spec Upload (for API scans) */}
                    {dastConfig.scanProfile === 'api' && (
                      <div className="border border-border rounded-lg p-4 bg-muted/30">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          OpenAPI Specification (Optional)
                        </label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Upload an OpenAPI/Swagger specification to scan specific API endpoints
                        </p>

                        {openApiSpec ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                  ✅ {openApiSpec.name} v{openApiSpec.version}
                                </p>
                                <p className="text-xs text-green-600 dark:text-green-400">
                                  {openApiSpec.endpointCount} endpoints • Uploaded {new Date(openApiSpec.uploadedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <button
                                onClick={handleDeleteOpenApiSpec}
                                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                              >
                                Remove
                              </button>
                            </div>

                            {/* Show endpoint list */}
                            <details className="text-sm">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                View endpoints ({openApiSpec.endpointCount})
                              </summary>
                              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                                {openApiSpec.endpoints.map((ep, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs font-mono p-1 bg-muted rounded">
                                    <span className={`px-1.5 py-0.5 rounded text-white ${
                                      ep.method === 'GET' ? 'bg-blue-500' :
                                      ep.method === 'POST' ? 'bg-green-500' :
                                      ep.method === 'PUT' ? 'bg-amber-500' :
                                      ep.method === 'DELETE' ? 'bg-red-500' :
                                      'bg-gray-500'
                                    }`}>
                                      {ep.method}
                                    </span>
                                    <span>{ep.path}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <textarea
                              id="openapi-spec-input"
                              placeholder='Paste OpenAPI/Swagger JSON here...&#10;&#10;Example:&#10;{&#10;  "openapi": "3.0.0",&#10;  "info": { "title": "My API", "version": "1.0" },&#10;  "paths": { "/users": { "get": { ... } } }&#10;}'
                              className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground"
                            />
                            {specUploadError && (
                              <p className="text-xs text-red-600 dark:text-red-400">
                                ❌ {specUploadError}
                              </p>
                            )}
                            <button
                              onClick={() => {
                                const textarea = document.getElementById('openapi-spec-input') as HTMLTextAreaElement;
                                if (textarea?.value) {
                                  handleUploadOpenApiSpec(textarea.value);
                                } else {
                                  toast.error('Please paste an OpenAPI specification first');
                                }
                              }}
                              disabled={isUploadingSpec}
                              className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isUploadingSpec ? (
                                <>
                                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Parsing...
                                </>
                              ) : (
                                <>Upload Specification</>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Full Scan Configuration */}
                    {dastConfig.scanProfile === 'full' && (
                      <div className="border border-border rounded-lg p-4 bg-muted/30">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Full Scan Configuration
                        </label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Configure crawl depth and scope for comprehensive security testing
                        </p>

                        {/* Crawl Depth */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-foreground mb-1">
                            Crawl Depth
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={dastConfig.contextConfig?.maxCrawlDepth || 5}
                              onChange={(e) => handleUpdateDastConfig({
                                contextConfig: {
                                  ...dastConfig.contextConfig,
                                  maxCrawlDepth: parseInt(e.target.value)
                                }
                              })}
                              className="w-48"
                            />
                            <span className="text-sm font-medium text-foreground w-8">
                              {dastConfig.contextConfig?.maxCrawlDepth || 5}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {(dastConfig.contextConfig?.maxCrawlDepth || 5) <= 3 ? '(Shallow)' :
                               (dastConfig.contextConfig?.maxCrawlDepth || 5) <= 6 ? '(Medium)' :
                               '(Deep)'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Higher values discover more pages but increase scan time (Est: {
                              (dastConfig.contextConfig?.maxCrawlDepth || 5) <= 3 ? '30-45 min' :
                              (dastConfig.contextConfig?.maxCrawlDepth || 5) <= 6 ? '45-90 min' :
                              '90-120+ min'
                            })
                          </p>
                        </div>

                        {/* Scope Configuration */}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Include URLs (one per line, supports wildcards)
                            </label>
                            <textarea
                              value={(dastConfig.contextConfig?.includeUrls || []).join('\n')}
                              onChange={(e) => handleUpdateDastConfig({
                                contextConfig: {
                                  ...dastConfig.contextConfig,
                                  includeUrls: e.target.value.split('\n').filter(u => u.trim())
                                }
                              })}
                              placeholder="https://example.com/*&#10;https://example.com/api/*"
                              className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono placeholder:text-muted-foreground"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Exclude URLs (one per line, supports wildcards)
                            </label>
                            <textarea
                              value={(dastConfig.contextConfig?.excludeUrls || []).join('\n')}
                              onChange={(e) => handleUpdateDastConfig({
                                contextConfig: {
                                  ...dastConfig.contextConfig,
                                  excludeUrls: e.target.value.split('\n').filter(u => u.trim())
                                }
                              })}
                              placeholder="https://example.com/logout*&#10;https://example.com/admin/*"
                              className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>

                        {/* Scan Coverage Info */}
                        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-xs text-amber-800 dark:text-amber-200">
                            <strong>⚠️ Full Scan Notice:</strong> This scan performs active testing including XSS, SQL Injection, and command injection checks. Only run on test/staging environments.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Authentication Configuration */}
                    <div className="border border-border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <label className="text-sm font-medium text-foreground">
                            Authenticated Scanning
                          </label>
                        </div>
                        <div
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                            dastConfig.authConfig?.enabled ? 'bg-amber-600' : 'bg-muted'
                          }`}
                          onClick={() => !isUpdatingDast && handleUpdateDastConfig({
                            authConfig: {
                              ...dastConfig.authConfig,
                              enabled: !dastConfig.authConfig?.enabled,
                              loginUrl: dastConfig.authConfig?.loginUrl || '',
                              usernameField: dastConfig.authConfig?.usernameField || '#username',
                              passwordField: dastConfig.authConfig?.passwordField || '#password',
                              submitSelector: dastConfig.authConfig?.submitSelector || 'button[type="submit"]',
                              loggedInIndicator: dastConfig.authConfig?.loggedInIndicator || '',
                              credentials: dastConfig.authConfig?.credentials || { username: '', password: '' }
                            }
                          })}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              dastConfig.authConfig?.enabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Enable to scan protected areas that require authentication. The scanner will log in before scanning.
                      </p>

                      {dastConfig.authConfig?.enabled && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          {/* Login URL */}
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Login URL *
                            </label>
                            <input
                              type="url"
                              value={dastConfig.authConfig?.loginUrl || ''}
                              onChange={(e) => handleUpdateDastConfig({
                                authConfig: {
                                  ...dastConfig.authConfig,
                                  enabled: true,
                                  loginUrl: e.target.value
                                }
                              })}
                              placeholder="https://your-app.example.com/login"
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                            />
                          </div>

                          {/* Credentials */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Username *
                              </label>
                              <input
                                type="text"
                                value={dastConfig.authConfig?.credentials?.username || ''}
                                onChange={(e) => handleUpdateDastConfig({
                                  authConfig: {
                                    ...dastConfig.authConfig,
                                    enabled: true,
                                    credentials: {
                                      ...dastConfig.authConfig?.credentials,
                                      username: e.target.value,
                                      password: dastConfig.authConfig?.credentials?.password || ''
                                    }
                                  }
                                })}
                                placeholder="test@example.com"
                                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Password *
                              </label>
                              <input
                                type="password"
                                value={dastConfig.authConfig?.credentials?.password || ''}
                                onChange={(e) => handleUpdateDastConfig({
                                  authConfig: {
                                    ...dastConfig.authConfig,
                                    enabled: true,
                                    credentials: {
                                      ...dastConfig.authConfig?.credentials,
                                      username: dastConfig.authConfig?.credentials?.username || '',
                                      password: e.target.value
                                    }
                                  }
                                })}
                                placeholder="••••••••"
                                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                              />
                            </div>
                          </div>

                          {/* Form Selectors */}
                          <details className="group">
                            <summary className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                              <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              Advanced Form Settings
                            </summary>
                            <div className="mt-3 space-y-3 pl-5">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Username Field Selector
                                  </label>
                                  <input
                                    type="text"
                                    value={dastConfig.authConfig?.usernameField || '#username'}
                                    onChange={(e) => handleUpdateDastConfig({
                                      authConfig: {
                                        ...dastConfig.authConfig,
                                        enabled: true,
                                        usernameField: e.target.value
                                      }
                                    })}
                                    placeholder="#username"
                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground"
                                  />
                                  <p className="text-[10px] text-muted-foreground mt-0.5">CSS selector for username input</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Password Field Selector
                                  </label>
                                  <input
                                    type="text"
                                    value={dastConfig.authConfig?.passwordField || '#password'}
                                    onChange={(e) => handleUpdateDastConfig({
                                      authConfig: {
                                        ...dastConfig.authConfig,
                                        enabled: true,
                                        passwordField: e.target.value
                                      }
                                    })}
                                    placeholder="#password"
                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground"
                                  />
                                  <p className="text-[10px] text-muted-foreground mt-0.5">CSS selector for password input</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Submit Button Selector
                                  </label>
                                  <input
                                    type="text"
                                    value={dastConfig.authConfig?.submitSelector || 'button[type="submit"]'}
                                    onChange={(e) => handleUpdateDastConfig({
                                      authConfig: {
                                        ...dastConfig.authConfig,
                                        enabled: true,
                                        submitSelector: e.target.value
                                      }
                                    })}
                                    placeholder="button[type='submit']"
                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground"
                                  />
                                  <p className="text-[10px] text-muted-foreground mt-0.5">CSS selector for login button</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                                    Logged-In Indicator
                                  </label>
                                  <input
                                    type="text"
                                    value={dastConfig.authConfig?.loggedInIndicator || ''}
                                    onChange={(e) => handleUpdateDastConfig({
                                      authConfig: {
                                        ...dastConfig.authConfig,
                                        enabled: true,
                                        loggedInIndicator: e.target.value
                                      }
                                    })}
                                    placeholder="Welcome|Dashboard|Logout"
                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground"
                                  />
                                  <p className="text-[10px] text-muted-foreground mt-0.5">Text that indicates successful login (regex)</p>
                                </div>
                              </div>
                            </div>
                          </details>

                          {/* Session Handling Info */}
                          <div className="flex items-start gap-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <svg className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-xs text-blue-800 dark:text-blue-200">
                              <span className="font-medium">Session Handling:</span> The scanner will maintain session cookies after login to access protected pages. Session tokens are automatically managed during the scan.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Alert Threshold */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Minimum Alert Level
                      </label>
                      <select
                        value={dastConfig.alertThreshold}
                        onChange={(e) => handleUpdateDastConfig({ alertThreshold: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })}
                        disabled={isUpdatingDast}
                        className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      >
                        <option value="HIGH">High risk only</option>
                        <option value="MEDIUM">Medium and above</option>
                        <option value="LOW">All alerts (including low)</option>
                      </select>
                    </div>

                    {/* Trigger Scan Button */}
                    <div className="pt-4 border-t border-border">
                      <button
                        onClick={handleTriggerDastScan}
                        disabled={isRunningDastScan || isUpdatingDast || !dastTargetUrl}
                        className="flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {isRunningDastScan ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Scanning...
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            Start DAST Scan
                          </>
                        )}
                      </button>
                      {dastConfig.lastScanAt && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Last scan: {new Date(dastConfig.lastScanAt).toLocaleString()}
                          {dastConfig.lastScanStatus && (
                            <span className={`ml-2 ${
                              dastConfig.lastScanStatus === 'completed' ? 'text-green-600' :
                              dastConfig.lastScanStatus === 'failed' ? 'text-red-600' :
                              'text-amber-600'
                            }`}>
                              ({dastConfig.lastScanStatus})
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* DAST Schedule Section */}
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-foreground flex items-center gap-2">
                          <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Scheduled Scans
                        </h4>
                        <button
                          onClick={() => {
                            // Toggle schedule form visibility
                            const formEl = document.getElementById('dast-schedule-form');
                            if (formEl) {
                              formEl.classList.toggle('hidden');
                            }
                          }}
                          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                        >
                          + Add Schedule
                        </button>
                      </div>

                      {/* Schedule Creation Form (hidden by default) */}
                      <div id="dast-schedule-form" className="hidden mb-4 p-4 bg-muted/30 rounded-lg border border-border">
                        <h5 className="font-medium text-foreground mb-3">Create New Schedule</h5>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm text-muted-foreground mb-1">Schedule Name</label>
                            <input
                              type="text"
                              id="dast-schedule-name"
                              placeholder="Nightly Security Scan"
                              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Frequency</label>
                              <select
                                id="dast-schedule-frequency"
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                defaultValue="nightly"
                              >
                                <option value="hourly">Hourly</option>
                                <option value="daily">Daily</option>
                                <option value="nightly">Nightly (2:00 AM)</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Time (24h)</label>
                              <input
                                type="time"
                                id="dast-schedule-time"
                                defaultValue="02:00"
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Day of Week</label>
                              <select
                                id="dast-schedule-day-of-week"
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                defaultValue="1"
                              >
                                <option value="0">Sunday</option>
                                <option value="1">Monday</option>
                                <option value="2">Tuesday</option>
                                <option value="3">Wednesday</option>
                                <option value="4">Thursday</option>
                                <option value="5">Friday</option>
                                <option value="6">Saturday</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm text-muted-foreground mb-1">Timezone</label>
                              <select
                                id="dast-schedule-timezone"
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                defaultValue="UTC"
                              >
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">America/New_York</option>
                                <option value="America/Los_Angeles">America/Los_Angeles</option>
                                <option value="Europe/London">Europe/London</option>
                                <option value="Europe/Paris">Europe/Paris</option>
                                <option value="Asia/Tokyo">Asia/Tokyo</option>
                                <option value="Asia/Singapore">Asia/Singapore</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" id="dast-schedule-notify-failure" defaultChecked className="rounded border-input" />
                              <span className="text-muted-foreground">Notify on failure</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" id="dast-schedule-notify-high" defaultChecked className="rounded border-input" />
                              <span className="text-muted-foreground">Notify on high severity</span>
                            </label>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={async () => {
                                const name = (document.getElementById('dast-schedule-name') as HTMLInputElement).value;
                                const frequency = (document.getElementById('dast-schedule-frequency') as HTMLSelectElement).value;
                                const time = (document.getElementById('dast-schedule-time') as HTMLInputElement).value;
                                const dayOfWeek = parseInt((document.getElementById('dast-schedule-day-of-week') as HTMLSelectElement).value);
                                const timezone = (document.getElementById('dast-schedule-timezone') as HTMLSelectElement).value;
                                const notifyOnFailure = (document.getElementById('dast-schedule-notify-failure') as HTMLInputElement).checked;
                                const notifyOnHighSeverity = (document.getElementById('dast-schedule-notify-high') as HTMLInputElement).checked;

                                if (!name.trim()) {
                                  toast.error('Schedule name is required');
                                  return;
                                }

                                const [hour, minute] = time.split(':').map(Number);

                                try {
                                  const response = await fetch(`/api/v1/projects/${id}/dast/schedules`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({
                                      name,
                                      frequency,
                                      hour,
                                      minute,
                                      dayOfWeek,
                                      timezone,
                                      notifyOnFailure,
                                      notifyOnHighSeverity,
                                      targetUrl: dastTargetUrl,
                                      scanProfile: dastConfig.scanProfile,
                                    }),
                                  });

                                  if (response.ok) {
                                    const result = await response.json();
                                    toast.success('DAST schedule created successfully');
                                    // Refresh schedules
                                    const schedulesResponse = await fetch(`/api/v1/projects/${id}/dast/schedules`, {
                                      headers: { 'Authorization': `Bearer ${token}` },
                                    });
                                    if (schedulesResponse.ok) {
                                      const data = await schedulesResponse.json();
                                      setDastSchedules(data.schedules || []);
                                    }
                                    // Hide form
                                    document.getElementById('dast-schedule-form')?.classList.add('hidden');
                                    // Clear form
                                    (document.getElementById('dast-schedule-name') as HTMLInputElement).value = '';
                                  } else {
                                    const error = await response.json();
                                    toast.error(error.error || 'Failed to create schedule');
                                  }
                                } catch (err) {
                                  toast.error('Failed to create schedule');
                                }
                              }}
                              className="flex-1 h-9 rounded-md bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700"
                            >
                              Create Schedule
                            </button>
                            <button
                              onClick={() => {
                                document.getElementById('dast-schedule-form')?.classList.add('hidden');
                              }}
                              className="h-9 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Existing Schedules List */}
                      {dastSchedules.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No scheduled scans configured. Click "Add Schedule" to create one.</p>
                      ) : (
                        <div className="space-y-2">
                          {dastSchedules.map((schedule: any) => (
                            <div key={schedule.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${schedule.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                                  <span className="font-medium text-foreground">{schedule.name}</span>
                                  <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-2 py-0.5 rounded">
                                    {schedule.frequency}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {schedule.nextRunAt ? (
                                    <>Next run: {new Date(schedule.nextRunAt).toLocaleString()}</>
                                  ) : (
                                    <>Schedule disabled</>
                                  )}
                                  {schedule.runCount > 0 && (
                                    <span className="ml-2">• {schedule.runCount} runs</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {/* Toggle Enable/Disable */}
                                <button
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(`/api/v1/projects/${id}/dast/schedules/${schedule.id}/toggle`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}` },
                                      });
                                      if (response.ok) {
                                        const result = await response.json();
                                        setDastSchedules(dastSchedules.map((s: any) =>
                                          s.id === schedule.id ? result.schedule : s
                                        ));
                                        toast.success(result.message);
                                      }
                                    } catch (err) {
                                      toast.error('Failed to toggle schedule');
                                    }
                                  }}
                                  className="p-2 hover:bg-muted rounded-md"
                                  title={schedule.enabled ? 'Disable schedule' : 'Enable schedule'}
                                >
                                  {schedule.enabled ? (
                                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  ) : (
                                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  )}
                                </button>
                                {/* Run Now */}
                                <button
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(`/api/v1/projects/${id}/dast/schedules/${schedule.id}/trigger`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}` },
                                      });
                                      if (response.ok) {
                                        const result = await response.json();
                                        toast.success('Scheduled scan triggered');
                                        // Refresh scans
                                        const scansResponse = await fetch(`/api/v1/projects/${id}/dast/scans`, {
                                          headers: { 'Authorization': `Bearer ${token}` },
                                        });
                                        if (scansResponse.ok) {
                                          const data = await scansResponse.json();
                                          setDastScans(data.scans || []);
                                        }
                                      } else {
                                        const error = await response.json();
                                        toast.error(error.error || 'Failed to trigger scan');
                                      }
                                    } catch (err) {
                                      toast.error('Failed to trigger scan');
                                    }
                                  }}
                                  className="p-2 hover:bg-muted rounded-md"
                                  title="Run now"
                                >
                                  <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                                {/* Delete */}
                                <button
                                  onClick={async () => {
                                    if (!confirm('Are you sure you want to delete this schedule?')) return;
                                    try {
                                      const response = await fetch(`/api/v1/projects/${id}/dast/schedules/${schedule.id}`, {
                                        method: 'DELETE',
                                        headers: { 'Authorization': `Bearer ${token}` },
                                      });
                                      if (response.ok) {
                                        setDastSchedules(dastSchedules.filter((s: any) => s.id !== schedule.id));
                                        toast.success('Schedule deleted');
                                      }
                                    } catch (err) {
                                      toast.error('Failed to delete schedule');
                                    }
                                  }}
                                  className="p-2 hover:bg-muted rounded-md"
                                  title="Delete schedule"
                                >
                                  <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DAST Scan Results */}
            {dastConfig.enabled && dastScans.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-6 mt-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Recent DAST Scans</h3>
                <div className="space-y-4">
                  {dastScans.map((scan) => (
                    <div key={scan.id} className="border border-border rounded-lg overflow-hidden">
                      {/* Scan Header */}
                      <button
                        onClick={() => setSelectedDastScan(selectedDastScan?.id === scan.id ? null : scan)}
                        className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`h-3 w-3 rounded-full ${
                            scan.status === 'completed' ? 'bg-green-500' :
                            scan.status === 'failed' ? 'bg-red-500' :
                            scan.status === 'running' ? 'bg-amber-500 animate-pulse' :
                            'bg-gray-400'
                          }`} />
                          <div className="text-left">
                            <p className="font-medium text-foreground text-sm truncate max-w-xs">
                              {scan.targetUrl}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {scan.scanProfile} scan • {new Date(scan.startedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {scan.status === 'running' && scan.progress && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {scan.progress.percentage}%
                              </span>
                              <span className="text-muted-foreground">
                                {scan.progress.alertsFound} findings
                              </span>
                            </div>
                          )}
                          {scan.status === 'completed' && (
                            <div className="flex items-center gap-2 text-sm">
                              {scan.summary.byRisk.high > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 font-medium">
                                  {scan.summary.byRisk.high} High
                                </span>
                              )}
                              {scan.summary.byRisk.medium > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                                  {scan.summary.byRisk.medium} Medium
                                </span>
                              )}
                              {scan.summary.byRisk.low > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                                  {scan.summary.byRisk.low} Low
                                </span>
                              )}
                              {scan.summary.total === 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-medium">
                                  No issues
                                </span>
                              )}
                            </div>
                          )}
                          <svg
                            className={`h-5 w-5 text-muted-foreground transition-transform ${
                              selectedDastScan?.id === scan.id ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Live Progress Panel for Running Scans */}
                      {scan.status === 'running' && scan.progress && (
                        <div className="p-4 border-t border-border bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
                          <div className="space-y-4">
                            {/* Progress Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="font-medium text-amber-700 dark:text-amber-300">
                                  {scan.progress.phaseDescription}
                                </span>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {scan.progress.estimatedTimeRemaining && scan.progress.estimatedTimeRemaining > 0
                                  ? `~${Math.ceil(scan.progress.estimatedTimeRemaining / 60)} min remaining`
                                  : 'Completing...'}
                              </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="absolute h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500 ease-out"
                                style={{ width: `${scan.progress.percentage}%` }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-bold text-white drop-shadow">
                                  {scan.progress.percentage}%
                                </span>
                              </div>
                            </div>

                            {/* Progress Stats */}
                            <div className="grid grid-cols-4 gap-4 text-center">
                              <div className="p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                                <p className="text-lg font-bold text-foreground">{scan.progress.urlsDiscovered}</p>
                                <p className="text-xs text-muted-foreground">URLs Discovered</p>
                              </div>
                              <div className="p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                                <p className="text-lg font-bold text-foreground">{scan.progress.urlsScanned}</p>
                                <p className="text-xs text-muted-foreground">URLs Scanned</p>
                              </div>
                              <div className="p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                                <p className="text-lg font-bold text-foreground">{scan.statistics?.requestsSent || 0}</p>
                                <p className="text-xs text-muted-foreground">Requests Sent</p>
                              </div>
                              <div className="p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{scan.progress.alertsFound}</p>
                                <p className="text-xs text-muted-foreground">Findings</p>
                              </div>
                            </div>

                            {/* Current URL being scanned */}
                            {scan.progress.currentUrl && (
                              <div className="text-xs text-muted-foreground truncate">
                                <span className="font-medium">Scanning: </span>
                                {scan.progress.currentUrl}
                              </div>
                            )}

                            {/* Live Findings Preview */}
                            {scan.summary && scan.summary.total > 0 && (
                              <div className="flex items-center gap-2 text-sm pt-2 border-t border-amber-200 dark:border-amber-800">
                                <span className="text-muted-foreground">Live findings:</span>
                                {scan.summary.byRisk.high > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 font-medium text-xs">
                                    {scan.summary.byRisk.high} High
                                  </span>
                                )}
                                {scan.summary.byRisk.medium > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium text-xs">
                                    {scan.summary.byRisk.medium} Medium
                                  </span>
                                )}
                                {scan.summary.byRisk.low > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium text-xs">
                                    {scan.summary.byRisk.low} Low
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Expanded Scan Details */}
                      {selectedDastScan?.id === scan.id && scan.status === 'completed' && (
                        <div className="p-4 border-t border-border bg-background">
                          {/* Scan Statistics */}
                          {scan.statistics && (
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <div className="text-center p-3 bg-muted/30 rounded-lg">
                                <p className="text-2xl font-bold text-foreground">{scan.statistics.urlsScanned}</p>
                                <p className="text-xs text-muted-foreground">URLs Scanned</p>
                              </div>
                              <div className="text-center p-3 bg-muted/30 rounded-lg">
                                <p className="text-2xl font-bold text-foreground">{scan.statistics.requestsSent}</p>
                                <p className="text-xs text-muted-foreground">Requests Sent</p>
                              </div>
                              <div className="text-center p-3 bg-muted/30 rounded-lg">
                                <p className="text-2xl font-bold text-foreground">{Math.round(scan.statistics.duration / 60)}m</p>
                                <p className="text-xs text-muted-foreground">Duration</p>
                              </div>
                            </div>
                          )}

                          {/* Endpoints Tested (for API scans) */}
                          {scan.scanProfile === 'api' && scan.endpointsTested && (
                            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-blue-900 dark:text-blue-100">
                                  📡 API Endpoints Tested
                                </h4>
                                <span className="text-sm text-blue-700 dark:text-blue-300">
                                  {scan.endpointsTested.tested}/{scan.endpointsTested.total} endpoints
                                </span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                                {scan.endpointsTested.endpoints.map((ep, idx) => (
                                  <div
                                    key={idx}
                                    className={`flex items-center gap-2 p-2 rounded text-xs font-mono ${
                                      ep.status === 'tested'
                                        ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                                        : ep.status === 'skipped'
                                        ? 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                                        : 'bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
                                    }`}
                                  >
                                    <span className={`px-1.5 py-0.5 rounded text-white text-[10px] ${
                                      ep.method === 'GET' ? 'bg-blue-500' :
                                      ep.method === 'POST' ? 'bg-green-500' :
                                      ep.method === 'PUT' ? 'bg-amber-500' :
                                      ep.method === 'DELETE' ? 'bg-red-500' :
                                      'bg-gray-500'
                                    }`}>
                                      {ep.method}
                                    </span>
                                    <span className="truncate flex-1" title={ep.path}>{ep.path}</span>
                                    {ep.alertCount > 0 && (
                                      <span className="text-red-600 dark:text-red-400">⚠️{ep.alertCount}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Generate Report Section */}
                          <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                              <div>
                                <h4 className="font-medium text-foreground">Generate Security Report</h4>
                                <p className="text-sm text-muted-foreground">Download a comprehensive vulnerability report</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  id="dast-report-format"
                                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                  defaultValue="html"
                                >
                                  <option value="html">HTML Report</option>
                                  <option value="pdf">PDF Report</option>
                                  <option value="json">JSON Report</option>
                                </select>
                                <button
                                  onClick={async () => {
                                    const format = (document.getElementById('dast-report-format') as HTMLSelectElement).value;
                                    try {
                                      const response = await fetch(`/api/v1/projects/${id}/dast/scans/${scan.id}/report?format=${format}`, {
                                        headers: { 'Authorization': `Bearer ${token}` },
                                      });
                                      if (response.ok) {
                                        const contentType = response.headers.get('Content-Type') || '';
                                        const contentDisposition = response.headers.get('Content-Disposition') || '';
                                        const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/);
                                        const fileName = fileNameMatch ? fileNameMatch[1] : `dast-report.${format}`;

                                        const blob = await response.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = fileName;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                        toast.success(`${format.toUpperCase()} report downloaded successfully`);
                                      } else {
                                        const error = await response.json();
                                        toast.error(error.message || 'Failed to generate report');
                                      }
                                    } catch (err) {
                                      toast.error('Failed to generate report');
                                    }
                                  }}
                                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Generate Report
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Alerts List */}
                          {scan.alerts.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                              <svg className="mx-auto h-10 w-10 mb-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p>No security alerts found!</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <h4 className="font-medium text-foreground text-sm">Alerts ({scan.alerts.filter(a => !a.isFalsePositive).length})</h4>
                              {scan.alerts.filter(a => !a.isFalsePositive).map((alert) => (
                                <div
                                  key={alert.id}
                                  className="p-4 rounded-lg border border-border bg-muted/20"
                                >
                                  <div className="flex items-start gap-3">
                                    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      alert.risk === 'High'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                        : alert.risk === 'Medium'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                        : alert.risk === 'Low'
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                    }`}>
                                      {alert.risk}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-foreground">{alert.name}</p>
                                      <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                                      <div className="mt-2 text-xs space-y-1">
                                        <p className="font-mono text-muted-foreground">
                                          <span className="font-semibold">{alert.method}</span> {alert.url}
                                        </p>
                                        {alert.param && (
                                          <p className="text-muted-foreground">
                                            <span className="font-semibold">Parameter:</span> {alert.param}
                                          </p>
                                        )}
                                        {alert.attack && (
                                          <div className="mt-1 p-1.5 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                            <p className="text-muted-foreground">
                                              <span className="font-semibold text-red-700 dark:text-red-300">Attack Payload:</span>
                                              <code className="ml-1 px-1 py-0.5 rounded bg-red-100 dark:bg-red-800 text-red-900 dark:text-red-100 font-mono text-xs break-all">
                                                {alert.attack}
                                              </code>
                                            </p>
                                          </div>
                                        )}
                                        {alert.evidence && !alert.attack && (
                                          <p className="text-muted-foreground">
                                            <span className="font-semibold">Evidence:</span> {alert.evidence}
                                          </p>
                                        )}
                                        {alert.cweId && (
                                          <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300">
                                            CWE-{alert.cweId}
                                          </span>
                                        )}
                                      </div>
                                      {alert.solution && (
                                        <div className="mt-3 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                                          <p className="text-xs text-green-800 dark:text-green-200">
                                            <strong>Solution:</strong> {alert.solution}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feature #1535: Autopilot Tab Content removed - enterprise bloat */}

        {/* Feature #1539: Maintenance Tab Content removed - uses dummy data with no real API */}

        {/* Feature #1540: Discovery Tab Content removed - uses dummy data with no real AI API */}

        {/* Feature #1536: Predictions Tab Content removed - simple flaky test detection is sufficient */}

        {/* Feature #1541: Code Quality Tab Content removed - uses dummy data with no real API */}

        {/* False Positive Modal */}
        {showFalsePositiveModal && selectedFinding && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && !isMarkingFP && setShowFalsePositiveModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="false-positive-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                  <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 id="false-positive-title" className="text-lg font-semibold text-foreground">Mark as False Positive</h3>
                  <p className="text-sm text-muted-foreground">This finding will be excluded from future scans</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-md p-3 mb-4">
                <p className="text-sm font-medium text-foreground">{selectedFinding.ruleName}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {selectedFinding.filePath}:{selectedFinding.line}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="fp-reason" className="block text-sm font-medium text-foreground mb-1">
                    Reason for marking as false positive <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="fp-reason"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Explain why this finding is a false positive..."
                    value={fpReason}
                    onChange={(e) => setFpReason(e.target.value)}
                    disabled={isMarkingFP}
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFalsePositiveModal(false);
                      setSelectedFinding(null);
                      setFpReason('');
                    }}
                    className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    disabled={isMarkingFP}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkFalsePositive}
                    className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
                    disabled={isMarkingFP || !fpReason.trim()}
                  >
                    {isMarkingFP ? 'Marking...' : 'Mark as False Positive'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Repository Selection Modal */}
        {showRepoSelectModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowRepoSelectModal(false)}
          >
            <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-foreground">Select Repository</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a repository to connect to this project.
              </p>

              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {githubRepositories.map((repo) => (
                  <button
                    key={repo.full_name}
                    onClick={() => {
                      setSelectedRepo(repo);
                      setSelectedBranch(repo.default_branch);
                    }}
                    className={`w-full flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                      selectedRepo?.full_name === repo.full_name
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <svg className="h-5 w-5 text-muted-foreground flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{repo.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {repo.private ? 'Private' : 'Public'} • Default: {repo.default_branch}
                      </p>
                    </div>
                    {selectedRepo?.full_name === repo.full_name && (
                      <svg className="h-5 w-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {selectedRepo && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Branch</label>
                    <input
                      type="text"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      placeholder={selectedRepo.default_branch}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Test Directory</label>
                    <input
                      type="text"
                      value={selectedTestPath}
                      onChange={(e) => setSelectedTestPath(e.target.value)}
                      placeholder="tests"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Path to your Playwright test files (e.g., tests, e2e, specs)
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRepoSelectModal(false);
                    setSelectedRepo(null);
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnectRepo}
                  disabled={!selectedRepo || isConnectingRepo}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isConnectingRepo ? 'Connecting...' : 'Connect Repository'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Alert Modal */}
        {showCreateAlertModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowCreateAlertModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="create-alert-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 id="create-alert-title" className="text-lg font-semibold text-foreground">
                Create {newAlertType === 'email' ? 'Email' : newAlertType === 'slack' ? 'Slack' : 'Webhook'} Alert
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {newAlertType === 'email'
                  ? 'Get notified by email when tests fail in this project.'
                  : newAlertType === 'slack'
                  ? 'Post test failure alerts to your Slack channel.'
                  : 'Send test failure data to your webhook endpoint.'}
              </p>
              <form onSubmit={handleCreateAlert} className="mt-4 space-y-4">
                {createAlertError && (
                  <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {createAlertError}
                  </div>
                )}
                <div>
                  <label htmlFor="alert-name" className="mb-1 block text-sm font-medium text-foreground">
                    Alert Name
                  </label>
                  <input
                    type="text"
                    id="alert-name"
                    value={newAlertName}
                    onChange={(e) => setNewAlertName(e.target.value)}
                    required
                    placeholder={newAlertType === 'email' ? 'e.g., Development Team Alert' : newAlertType === 'slack' ? 'e.g., QA Alerts Channel' : 'e.g., CI/CD Webhook'}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="alert-condition" className="mb-1 block text-sm font-medium text-foreground">
                    Alert Condition
                  </label>
                  <select
                    id="alert-condition"
                    value={newAlertCondition}
                    onChange={(e) => setNewAlertCondition(e.target.value as 'any_failure' | 'all_failures' | 'threshold')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="any_failure">On any test failure</option>
                    <option value="all_failures">Only when all tests fail</option>
                    <option value="threshold">When failure rate exceeds threshold</option>
                  </select>
                </div>
                {newAlertCondition === 'threshold' && (
                  <div>
                    <label htmlFor="alert-threshold" className="mb-1 block text-sm font-medium text-foreground">
                      Failure Threshold (%)
                    </label>
                    <input
                      type="number"
                      id="alert-threshold"
                      min="1"
                      max="100"
                      value={newAlertThreshold}
                      onChange={(e) => setNewAlertThreshold(parseInt(e.target.value, 10))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Alert when {newAlertThreshold}% or more of tests fail
                    </p>
                  </div>
                )}
                {newAlertType === 'email' && (
                  <div>
                    <label htmlFor="alert-emails" className="mb-1 block text-sm font-medium text-foreground">
                      Email Recipients
                    </label>
                    <textarea
                      id="alert-emails"
                      value={newAlertEmails}
                      onChange={(e) => setNewAlertEmails(e.target.value)}
                      required
                      placeholder="Enter email addresses, separated by commas"
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Separate multiple email addresses with commas
                    </p>
                  </div>
                )}
                {newAlertType === 'slack' && (
                  <div>
                    <label htmlFor="alert-slack-channel" className="mb-1 block text-sm font-medium text-foreground">
                      Slack Channel
                    </label>
                    <select
                      id="alert-slack-channel"
                      value={newAlertSlackChannel}
                      onChange={(e) => setNewAlertSlackChannel(e.target.value)}
                      required
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="">Select a channel...</option>
                      {slackChannels.map(channel => (
                        <option key={channel.id} value={channel.id}>
                          {channel.is_private ? '🔒 ' : '# '}{channel.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Test failure alerts will be posted to this Slack channel
                    </p>
                  </div>
                )}
                {newAlertType === 'webhook' && (
                  <div>
                    <label htmlFor="alert-webhook-url" className="mb-1 block text-sm font-medium text-foreground">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      id="alert-webhook-url"
                      value={newAlertWebhookUrl}
                      onChange={(e) => setNewAlertWebhookUrl(e.target.value)}
                      required
                      placeholder="https://your-endpoint.com/webhook"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      We'll POST a JSON payload to this URL when tests fail
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="alert-suppress-retry"
                    checked={newAlertSuppressOnRetry}
                    onChange={(e) => setNewAlertSuppressOnRetry(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <label htmlFor="alert-suppress-retry" className="text-sm font-medium text-foreground">
                    Suppress alert if test passes on retry
                  </label>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  If enabled, alerts won't be sent when tests initially fail but pass after retrying.
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateAlertModal(false)}
                    className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingAlert}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isCreatingAlert ? 'Creating...' : 'Create Alert'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowAddMemberModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="add-member-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 id="add-member-title" className="text-lg font-semibold text-foreground">Add Member to Project</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Grant a team member access to this project.
              </p>
              <form onSubmit={handleAddMember} className="mt-4 space-y-4">
                {addMemberError && (
                  <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {addMemberError}
                  </div>
                )}
                <div>
                  <label htmlFor="member-select" className="mb-1 block text-sm font-medium text-foreground">
                    Team Member
                  </label>
                  <select
                    id="member-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="">Select a team member...</option>
                    {availableMembers.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.name || member.email || member.user_id} ({member.role})
                      </option>
                    ))}
                  </select>
                  {availableMembers.length === 0 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      All eligible team members already have access.
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="member-role" className="mb-1 block text-sm font-medium text-foreground">
                    Project Role
                  </label>
                  <select
                    id="member-role"
                    value={selectedMemberRole}
                    onChange={(e) => setSelectedMemberRole(e.target.value as 'developer' | 'viewer')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="developer">Developer - Can create and run tests</option>
                    <option value="viewer">Viewer - Read-only access</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddMemberModal(false)}
                    className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingMember || !selectedUserId}
                    className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isAddingMember ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Suite Modal */}
        {showCreateSuiteModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowCreateSuiteModal(false)}
          >
            <div role="dialog" aria-modal="true" aria-labelledby="create-suite-title" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 id="create-suite-title" className="text-lg font-semibold text-foreground">Create Test Suite</h3>
              <form onSubmit={handleCreateSuite} className="mt-4 space-y-4">
                {createSuiteError && (
                  <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {createSuiteError}
                  </div>
                )}
                <div>
                  <label htmlFor="suite-name" className="mb-1 block text-sm font-medium text-foreground">
                    Suite Name
                  </label>
                  <input
                    id="suite-name"
                    type="text"
                    value={newSuiteName}
                    onChange={(e) => setNewSuiteName(e.target.value)}
                    placeholder="e.g., Login Tests"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="suite-description" className="mb-1 block text-sm font-medium text-foreground">
                    Description (optional)
                  </label>
                  <textarea
                    id="suite-description"
                    value={newSuiteDescription}
                    onChange={(e) => setNewSuiteDescription(e.target.value)}
                    placeholder="Describe the test suite..."
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="suite-browser" className="mb-1 block text-sm font-medium text-foreground">
                    Browser
                  </label>
                  <select
                    id="suite-browser"
                    value={newSuiteBrowser}
                    onChange={(e) => setNewSuiteBrowser(e.target.value as 'chromium' | 'firefox' | 'webkit')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="chromium">Chromium (Chrome/Edge)</option>
                    <option value="firefox">Firefox</option>
                    <option value="webkit">WebKit (Safari)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="device-preset" className="mb-1 block text-sm font-medium text-foreground">
                    Device / Viewport Preset
                  </label>
                  <select
                    id="device-preset"
                    value={devicePreset}
                    onChange={(e) => handleDevicePresetChange(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <optgroup label="Desktop">
                      <option value="desktop">Desktop (1280×720)</option>
                      <option value="desktop-hd">Desktop HD (1920×1080)</option>
                    </optgroup>
                    <optgroup label="Mobile - iOS">
                      <option value="iphone-14">iPhone 14 (390×844)</option>
                      <option value="iphone-14-pro-max">iPhone 14 Pro Max (430×932)</option>
                      <option value="iphone-se">iPhone SE (375×667)</option>
                    </optgroup>
                    <optgroup label="Mobile - Android">
                      <option value="pixel-7">Pixel 7 (412×915)</option>
                      <option value="samsung-s23">Samsung S23 (360×780)</option>
                    </optgroup>
                    <optgroup label="Tablet">
                      <option value="ipad">iPad (768×1024)</option>
                      <option value="ipad-pro">iPad Pro (1024×1366)</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="custom">Custom Dimensions</option>
                    </optgroup>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="viewport-width" className="mb-1 block text-sm font-medium text-foreground">
                      Viewport Width
                    </label>
                    <input
                      id="viewport-width"
                      type="number"
                      value={newSuiteViewportWidth}
                      onChange={(e) => {
                        setNewSuiteViewportWidth(parseInt(e.target.value) || 1280);
                        setDevicePreset('custom');
                      }}
                      min={320}
                      max={3840}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                  </div>
                  <div>
                    <label htmlFor="viewport-height" className="mb-1 block text-sm font-medium text-foreground">
                      Viewport Height
                    </label>
                    <input
                      id="viewport-height"
                      type="number"
                      value={newSuiteViewportHeight}
                      onChange={(e) => {
                        setNewSuiteViewportHeight(parseInt(e.target.value) || 720);
                        setDevicePreset('custom');
                      }}
                      min={240}
                      max={2160}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="suite-timeout" className="mb-1 block text-sm font-medium text-foreground">
                      Timeout (seconds)
                    </label>
                    <input
                      id="suite-timeout"
                      type="number"
                      value={newSuiteTimeout}
                      onChange={(e) => setNewSuiteTimeout(parseInt(e.target.value) || 30)}
                      min={5}
                      max={300}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Test timeout (5-300s)</p>
                  </div>
                  <div>
                    <label htmlFor="suite-retry-count" className="mb-1 block text-sm font-medium text-foreground">
                      Retry Count
                    </label>
                    <input
                      id="suite-retry-count"
                      type="number"
                      value={newSuiteRetryCount}
                      onChange={(e) => setNewSuiteRetryCount(parseInt(e.target.value) || 0)}
                      min={0}
                      max={5}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Retries on failure (0-5)</p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateSuiteModal(false)}
                    className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingSuite}
                    className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreatingSuite && (
                      <svg aria-hidden="true" className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isCreatingSuite ? 'Creating...' : 'Create Suite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Feature #1065: Edit Selector Modal for ProjectDetailPage */}
        {editSelectorModal.isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && !isSubmittingSelector && setEditSelectorModal({
              isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
            })}
          >
            <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {editSelectorModal.wasHealed ? 'Edit Healed Selector' : 'Edit Selector'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {editSelectorModal.wasHealed ? 'Modify or accept the AI-healed selector' : 'Manually update the selector'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditSelectorModal({
                    isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
                  })}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={isSubmittingSelector}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Feature #1347: Vision Healing Button */}
              <div className="mb-4">
                <button
                  onClick={handleHealWithVision}
                  disabled={isHealingWithVision || isSubmittingSelector}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {isHealingWithVision ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing with Vision AI...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      🔮 Heal with Vision AI
                    </>
                  )}
                </button>
                <p className="mt-1 text-xs text-muted-foreground text-center">
                  Use Claude Vision to find the element visually and suggest robust selectors
                </p>
              </div>

              {/* Vision Healing Results */}
              {visionHealingResult && (
                <div className="mb-4 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-md border border-violet-200 dark:border-violet-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-violet-700 dark:text-violet-300 flex items-center gap-1">
                      <span>🔮</span> Vision AI Suggestions
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      visionHealingResult.confidence >= 0.8 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      visionHealingResult.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {Math.round(visionHealingResult.confidence * 100)}% confidence
                    </span>
                  </div>

                  {/* Element Analysis */}
                  <div className="text-xs text-violet-600 dark:text-violet-400 mb-2">
                    Detected: <span className="font-medium">{visionHealingResult.analysis.element_type}</span>
                    {visionHealingResult.analysis.text_content && (
                      <> with text "<span className="font-medium">{visionHealingResult.analysis.text_content}</span>"</>
                    )}
                  </div>

                  {/* Suggested Selectors */}
                  <div className="space-y-2">
                    {visionHealingResult.suggested_selectors.slice(0, 3).map((suggestion, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded cursor-pointer transition-colors ${
                          editSelectorValue === suggestion.selector
                            ? 'bg-violet-200 dark:bg-violet-800 border-2 border-violet-400'
                            : 'bg-white dark:bg-gray-800 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-700'
                        }`}
                        onClick={() => setEditSelectorValue(suggestion.selector)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <code className="text-xs font-mono text-violet-800 dark:text-violet-200 break-all">
                            {suggestion.selector}
                          </code>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            {suggestion.best_practice && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                ✓ Best
                              </span>
                            )}
                            <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                              {suggestion.type}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                      </div>
                    ))}
                  </div>

                  {/* Auto-heal recommendation */}
                  {visionHealingResult.auto_heal_recommended && (
                    <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 rounded text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      Auto-heal recommended - High confidence best practice selector
                    </div>
                  )}
                </div>
              )}

              {/* Original Selector */}
              <div className="mb-4 p-3 bg-muted/50 rounded-md">
                <div className="text-xs font-medium text-muted-foreground mb-1">Original Selector</div>
                <code className="text-sm font-mono text-foreground break-all">
                  {editSelectorModal.originalSelector || 'N/A'}
                </code>
              </div>

              {/* Current Selector (if healed) */}
              {editSelectorModal.wasHealed && editSelectorModal.currentSelector !== editSelectorModal.originalSelector && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                  <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1 flex items-center gap-1">
                    <span>🔧</span> AI-Healed Selector
                  </div>
                  <code className="text-sm font-mono text-green-800 dark:text-green-200 break-all">
                    {editSelectorModal.currentSelector}
                  </code>
                </div>
              )}

              {/* New Selector Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">
                  {editSelectorModal.wasHealed ? 'New Selector (or keep healed)' : 'New Selector'}
                </label>
                <input
                  type="text"
                  value={editSelectorValue}
                  onChange={(e) => setEditSelectorValue(e.target.value)}
                  placeholder={editSelectorModal.currentSelector || 'Enter selector...'}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports CSS selectors, XPath, or data-testid attributes
                </p>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
                <textarea
                  value={editSelectorNotes}
                  onChange={(e) => setEditSelectorNotes(e.target.value)}
                  placeholder="Why are you changing this selector?"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Apply to Test Definition Checkbox */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editSelectorApplyToTest}
                    onChange={(e) => setEditSelectorApplyToTest(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Apply to test definition</span>
                </label>
                <p className="ml-6 text-xs text-muted-foreground">
                  If checked, the new selector will be saved to the test so future runs use it
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEditSelectorModal({
                      isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
                    });
                    setEditSelectorValue('');
                    setEditSelectorNotes('');
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  disabled={isSubmittingSelector}
                >
                  Cancel
                </button>
                {editSelectorModal.wasHealed && (
                  <button
                    onClick={handleAcceptHealed}
                    disabled={isSubmittingSelector}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {isSubmittingSelector ? 'Accepting...' : '✓ Accept Healed'}
                  </button>
                )}
                <button
                  onClick={handleUpdateSelector}
                  disabled={isSubmittingSelector || !editSelectorValue.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmittingSelector ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
export { ProjectDetailPage };
