// ProjectDetailPage - Extracted from App.tsx (Feature #1441)
// Project details with test suites, test management, and GitHub integration
// Feature #636: Adopt Modal component in page-level inline modals
// Feature #58: Migrated to React Query for parallel data loading
// Feature #125: Added skeleton loaders for better perceived performance
// Feature #337: Dark-first design system redesign
// Feature #550: Real-time wave visualization for smoke test
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { SkeletonProjectDetail } from "../components/ui/Skeleton";
// Feature #337: Design system components
// Feature #526: Added ScoreCard for project health overview
import {
  PageHeader,
  AnimatedCard,
  StatCard,
  StatusPill,
  SectionHeader,
  MetadataRow,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useReducedMotion,
  ScoreCard,
  EmptyStates, // Feature #559: Enhanced empty state
} from "../components/ui";
import { Flame, Plus, Settings, Loader2, FolderKanban, TestTube2, Calendar, User, MoreHorizontal, Github, Shield, ChevronDown, Globe, FileCheck, CheckCircle2, XCircle, Search, X } from "lucide-react";
// Feature #550: Real-time wave visualization for smoke test
import { WaveProgressCard, type WaveProgressStatus } from "../components/ui/wave-progress-card";
import { useSuiteRunSocket, type SuiteRun as SuiteRunSocket } from "../hooks/useSuiteRunSocket";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useAuthStore } from "../stores/authStore";
import { useTimezoneStore } from "../stores/timezoneStore";
import { useTestDefaultsStore } from "../stores/testDefaultsStore";
import { toast } from "../stores/toastStore";
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
// Feature #58: Import React Query hooks for parallel data fetching
// Feature #144: Added project settings hooks for caching
import {
  useProject, useSuites, useInvalidateSuites,
  useProjectMembers, useAlertChannels, useAlertHistory,
  useEnvVars, useHealingSettings, useSastConfig, useDastConfig,
  useRunsByProject, // Feature #558: Recent activity feed
} from '../hooks/api';
import { useMembers } from '../hooks/api/useSettings';
// Feature #49: Import modular types, utilities and hooks from project-detail
import {
  // Types (still needed for inline useState declarations until fully migrated)
  TestSuite,
  ProjectMember,
  OrgMember,
  AlertChannel,
  AlertHistoryEntry,
  EnvironmentVariable,
  HealingSettings,
  DEFAULT_HEALING_SETTINGS,
  GitHubConnection,
  GitHubTestFile,
  GitHubRepository,
  CustomRule,
  SASTConfig,
  SASTFinding,
  SASTScanResult,
  SecretPattern,
  DASTConfig,
  DASTScanResult,
  OpenAPISpec,
  PRDependencyScanResult,
  VisionHealingResult,
  EditSelectorModalState,
  // Utilities
  DEVICE_PRESETS,
  getErrorMessage,
  getDevicePresetDimensions,
  getSASTSeverityClass,
  getDASTRiskClass,
  getAlertChannelIcon,
  getAlertConditionLabel,
  getScanStatusClass,
  getScanStatusIcon,
  getHealingStrategyClass,
  getHealingStrategyLabel,
  formatFilePath,
  getMemberRoleClass,
  formatTimestamp,
  getRelativeTime,
  truncateText,
  // Components
  SuiteCard,
  SASTSeverityBadge,
  DASTRiskBadge,
  ScanStatusBadge,
  MemberRoleBadge,
  // Hooks (Feature #49)
  useGitHubHandlers,
  useSastHandlers,
  useDastHandlers,
  useSettingsHandlers,
  // Tab Components (Feature #49)
  SecurityTab,
  GitHubTab,
  SettingsTab,
  // Modal Components (Feature #49)
  ProjectModals,
} from '../components/project-detail';

// Removed inline type definitions - now imported from project-detail module (Feature #49)

// Feature #558: Utility to compute security score from SAST and DAST scans
function computeSecurityScore(
  sastScans: SASTScanResult[],
  dastScans: DASTScanResult[]
): number {
  // Perfect score if both have scans with zero findings
  if (
    sastScans.length > 0 && sastScans[0]?.summary?.total === 0 &&
    dastScans.length > 0 && dastScans[0]?.summary?.total === 0
  ) {
    return 100;
  }

  // Neutral score if no scans yet
  if (sastScans.length === 0 && dastScans.length === 0) {
    return 50;
  }

  // Calculate penalty based on severity
  const penalty =
    (sastScans[0]?.summary?.bySeverity?.critical || 0) * 20 +
    (sastScans[0]?.summary?.bySeverity?.high || 0) * 10 +
    (dastScans[0]?.summary?.byRisk?.high || 0) * 10;

  return Math.max(0, 100 - penalty);
}

function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuthStore();
  const { formatDate } = useTimezoneStore();
  const { defaults: testDefaults } = useTestDefaultsStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Feature #49: Use extracted hooks for GitHub, SAST, DAST, and Settings
  const [githubState, githubHandlers] = useGitHubHandlers({ projectId: id, token });
  const [sastState, sastHandlers] = useSastHandlers({ projectId: id, token, githubBranch: githubState.githubConnection?.github_branch });
  const [dastState, dastHandlers] = useDastHandlers({ projectId: id, token });
  const [settingsState, settingsHandlers] = useSettingsHandlers({ projectId: id, token });

  // Tab navigation - default to 'suites'
  const activeTab = searchParams.get('tab') || 'suites';
  const setActiveTab = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  // Feature #58: React Query hooks for parallel data loading
  // Project and suites load in parallel automatically via React Query
  const { data: projectData, isLoading: projectLoading, error: projectError } = useProject(id);
  const { data: suitesData, isLoading: suitesLoading } = useSuites(id);
  const { invalidateByProject } = useInvalidateSuites();

  // Extract data from React Query responses
  const project = projectData?.project || null;
  const suites = suitesData?.suites || suitesData?.data || [];
  const isLoading = projectLoading || suitesLoading;
  const error = projectError ? (projectError instanceof Error ? projectError.message : 'Failed to load project') : null;

  // Feature #558: Fetch recent runs for activity feed
  const { data: recentRunsData } = useRunsByProject(id, 5);

  // Feature #1794: Project defaults state
  const [projectDefaultBrowser, setProjectDefaultBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [projectViewportProfiles, setProjectViewportProfiles] = useState<Array<{name: string; width: number; height: number}>>([
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 },
  ]);
  const [isSavingProjectDefaults, setIsSavingProjectDefaults] = useState(false);

  // Feature #58: GitHub data loading state (lazy-loaded when tab active)
  // Feature #144: Settings data loading is now handled by React Query hooks
  const [githubDataLoaded, setGithubDataLoaded] = useState(false);
  const [showCreateSuiteModal, setShowCreateSuiteModal] = useState(false);
  // Feature #559: Suite search filter
  const [suiteSearchQuery, setSuiteSearchQuery] = useState('');
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDescription, setNewSuiteDescription] = useState('');
  const [newSuiteBrowser, setNewSuiteBrowser] = useState<'chromium' | 'firefox' | 'webkit'>(testDefaults.defaultBrowser);
  const [newSuiteViewportWidth, setNewSuiteViewportWidth] = useState(1280);
  const [newSuiteViewportHeight, setNewSuiteViewportHeight] = useState(720);
  const [newSuiteTimeout, setNewSuiteTimeout] = useState(testDefaults.defaultTimeout / 1000); // Convert ms to seconds
  const [newSuiteRetryCount, setNewSuiteRetryCount] = useState(testDefaults.defaultRetries);
  const [devicePreset, setDevicePreset] = useState('desktop');
  const [isCreatingSuite, setIsCreatingSuite] = useState(false);

  // Use imported DEVICE_PRESETS from project-detail module (Feature #49)
  const handleDevicePresetChange = (preset: string) => {
    setDevicePreset(preset);
    const dimensions = getDevicePresetDimensions(preset);
    if (dimensions) {
      setNewSuiteViewportWidth(dimensions.width);
      setNewSuiteViewportHeight(dimensions.height);
    }
  };
  const [createSuiteError, setCreateSuiteError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Feature #1975: One-click Smoke Test state
  // Feature #550: Added wave visualization state
  const [isRunningQuickSmokeTest, setIsRunningQuickSmokeTest] = useState(false);
  const [smokeTestRunId, setSmokeTestRunId] = useState<string | null>(null);
  const [smokeTestTestId, setSmokeTestTestId] = useState<string | null>(null);
  const [smokeTestResult, setSmokeTestResult] = useState<'passed' | 'failed' | null>(null);
  const [smokeTestCurrentStep, setSmokeTestCurrentStep] = useState<{
    phase: 'health' | 'pageload' | 'validation';
    stepIndex: number;
    totalSteps: number;
  } | null>(null);
  const [smokeTestExpandedPhase, setSmokeTestExpandedPhase] = useState<string | null>(null);

  // Feature #49: Settings state and handlers from useSettingsHandlers hook
  // Destructure what we need from settingsState
  const {
    projectMembers, orgMembers, showAddMemberModal, selectedUserId, selectedMemberRole,
    isAddingMember, addMemberError,
    alertChannels, showCreateAlertModal, newAlertType, newAlertName, newAlertCondition,
    newAlertThreshold, newAlertEmails, newAlertWebhookUrl, newAlertSlackChannel,
    slackChannels, newAlertSuppressOnRetry, isCreatingAlert, createAlertError,
    alertHistory, showAlertHistory,
    envVars, showAddEnvModal, newEnvKey, newEnvValue, newEnvIsSecret,
    isAddingEnv, addEnvError, editingEnvId, editEnvValue,
    healingSettings, isSavingHealingSettings, healingSettingsMessage,
    editSelectorModal, editSelectorValue, editSelectorNotes, editSelectorApplyToTest,
    isSubmittingSelector, isHealingWithVision, visionHealingResult,
  } = settingsState;
  const {
    setProjectMembers, setOrgMembers, setShowAddMemberModal, setSelectedUserId, setSelectedMemberRole,
    handleAddMember, handleRemoveMember,
    setAlertChannels, setShowCreateAlertModal, setNewAlertType, setNewAlertName, setNewAlertCondition,
    setNewAlertThreshold, setNewAlertEmails, setNewAlertWebhookUrl, setNewAlertSlackChannel,
    setSlackChannels, setNewAlertSuppressOnRetry, setAlertHistory, setShowAlertHistory,
    handleCreateAlert, handleToggleAlert, handleDeleteAlert,
    setEnvVars, setShowAddEnvModal, setNewEnvKey, setNewEnvValue, setNewEnvIsSecret,
    setAddEnvError, setEditingEnvId, setEditEnvValue,
    handleAddEnvVar, handleUpdateEnvVar, handleDeleteEnvVar,
    setHealingSettings, handleSaveHealingSettings,
    setEditSelectorModal, setEditSelectorValue, setEditSelectorNotes, setEditSelectorApplyToTest,
    handleUpdateSelector, handleAcceptHealed, handleHealWithVision,
  } = settingsHandlers;

  // Feature #49: GitHub state and handlers from useGitHubHandlers hook
  const {
    githubConnected, githubUsername, isConnectingGithub, githubConnection,
    githubTestFiles, githubRepositories, showRepoSelectModal, selectedRepo,
    selectedBranch, selectedTestPath, isConnectingRepo, isSyncingGithub,
    isDisconnectingRepo, isChangingBranch, availableBranches, githubError,
    prChecksEnabled, isTogglingPRChecks, pullRequests, prCommentsEnabled, isTogglingPRComments,
    prDependencyScanEnabled, isTogglingPRDependencyScan, prDependencyScanFiles,
    prDependencyScanSeverity, prDependencyScanBlockOnCritical,
    isRunningPRDependencyScan, prDependencyScanResults,
  } = githubState;
  const {
    setGithubConnected, setGithubUsername, setGithubConnection, setGithubTestFiles,
    setShowRepoSelectModal, setSelectedRepo, setSelectedBranch, setSelectedTestPath,
    setAvailableBranches, setGithubError, setPrChecksEnabled, setPullRequests, setPrCommentsEnabled,
    setPrDependencyScanEnabled, setPrDependencyScanFiles, setPrDependencyScanSeverity, setPrDependencyScanBlockOnCritical,
    handleConnectGithub, handleDisconnectGithub, handleOpenRepoSelect, handleConnectRepo,
    handleDisconnectRepo, handleSyncRepo, handleChangeBranch, handleTogglePRChecks,
    fetchPullRequests, handlePostPRStatus, handleTogglePRComments, handlePostPRComment,
    handleTogglePRDependencyScan, handleUpdatePRDependencyScanConfig, handleTriggerPRDependencyScan,
  } = githubHandlers;

  // Feature #49: SAST state and handlers from useSastHandlers hook
  const {
    sastConfig, sastScans, isLoadingSast, isUpdatingSast, isRunningScan, selectedScan,
    sastRulesets, customRules, isLoadingCustomRules, showAddCustomRuleModal,
    newCustomRuleName, newCustomRuleYaml, isAddingCustomRule, customRuleError,
    secretPatterns, showAddSecretPatternModal, newPatternName, newPatternDescription,
    newPatternRegex, newPatternSeverity, isAddingPattern, patternError,
    patternTestInput, patternTestResult,
    showFalsePositiveModal, selectedFinding, fpReason, isMarkingFP, showFalsePositives,
    expandedRemediations,
  } = sastState;
  const {
    setSastConfig, setSastScans, setIsLoadingSast, setSelectedScan,
    setSastRulesets, setCustomRules, setShowAddCustomRuleModal,
    setNewCustomRuleName, setNewCustomRuleYaml, setCustomRuleError,
    setSecretPatterns, setShowAddSecretPatternModal, setNewPatternName,
    setNewPatternDescription, setNewPatternRegex, setNewPatternSeverity,
    setPatternError, setPatternTestInput, setPatternTestResult,
    setShowFalsePositiveModal, setSelectedFinding, setFpReason, setShowFalsePositives,
    toggleRemediation,
    handleUpdateSastConfig, handleTriggerScan, handleAddCustomRule, handleToggleCustomRule,
    handleDeleteCustomRule, handleTestPattern, handleAddSecretPattern,
    handleToggleSecretPattern, handleDeleteSecretPattern, handleMarkFalsePositive,
  } = sastHandlers;

  // Feature #49: DAST state and handlers from useDastHandlers hook
  const {
    dastConfig, dastScans, isLoadingDast, isUpdatingDast, isRunningDastScan,
    selectedDastScan, dastTargetUrl, openApiSpec, isUploadingSpec, specUploadError, dastSchedules,
  } = dastState;
  const {
    setDastConfig, setDastScans, setIsLoadingDast, setSelectedDastScan,
    setDastTargetUrl, setOpenApiSpec, setDastSchedules,
    handleUpdateDastConfig, handleTriggerDastScan, handleUploadOpenApiSpec, handleDeleteOpenApiSpec,
  } = dastHandlers;

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
      // Feature #58: Use React Query invalidation to refetch suites
      invalidateByProject(id || '');
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

  // Feature #550: Smoke test WebSocket callbacks
  const handleSmokeTestRunUpdate = useCallback(() => {
    // Update handled by currentStep tracking
  }, []);

  const handleSmokeTestRunComplete = useCallback((completedRun: SuiteRunSocket) => {
    const passed = completedRun.status === 'passed';
    setSmokeTestResult(passed ? 'passed' : 'failed');
    setIsRunningQuickSmokeTest(false);
    setSmokeTestCurrentStep(null);

    if (passed) {
      toast.success('Site Healthy ✅ - All checks passed!', 5000);
    } else {
      toast.error('Issues Found ⚠️ - Some checks failed', 8000);
    }
  }, []);

  // Placeholder callbacks for screenshot (not used in smoke test)
  const handleSmokeTestScreenshot = useCallback(() => {}, []);
  const handleSmokeTestScreenshotHistory = useCallback(() => {}, []);

  // Feature #550: Use WebSocket for real-time smoke test progress
  const { currentStep: socketCurrentStep } = useSuiteRunSocket({
    runId: smokeTestRunId,
    token,
    onRunUpdate: handleSmokeTestRunUpdate,
    onRunComplete: handleSmokeTestRunComplete,
    onScreenshot: handleSmokeTestScreenshot,
    onScreenshotHistory: handleSmokeTestScreenshotHistory,
    enabled: isRunningQuickSmokeTest && !!smokeTestRunId,
  });

  // Map socket step progress to smoke test phases
  useEffect(() => {
    if (socketCurrentStep && isRunningQuickSmokeTest) {
      // Map step index to phases: 0=health, 1=pageload, 2+=validation
      const stepIdx = socketCurrentStep.stepIndex;
      const phase: 'health' | 'pageload' | 'validation' =
        stepIdx === 0 ? 'health' : stepIdx === 1 ? 'pageload' : 'validation';
      setSmokeTestCurrentStep({
        phase,
        stepIndex: socketCurrentStep.stepIndex,
        totalSteps: socketCurrentStep.totalSteps,
      });
    }
  }, [socketCurrentStep, isRunningQuickSmokeTest]);

  // Feature #1975 + #550: One-click Smoke Test handler with WebSocket
  const handleQuickSmokeTest = async () => {
    if (!project?.base_url) {
      toast.error('No base URL configured for this project. Please set it in Settings.');
      return;
    }

    // Reset state
    setIsRunningQuickSmokeTest(true);
    setSmokeTestRunId(null);
    setSmokeTestTestId(null);
    setSmokeTestResult(null);
    setSmokeTestCurrentStep({ phase: 'health', stepIndex: 0, totalSteps: 3 });
    setSmokeTestExpandedPhase(null);

    try {
      // Start the smoke test - WebSocket will handle progress tracking
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
        const errorData = await testResponse.json();
        throw new Error(errorData.message || 'Failed to run smoke test');
      }

      const testData = await testResponse.json();
      setSmokeTestRunId(testData.run_id);
      setSmokeTestTestId(testData.test_id);
      // WebSocket will now handle the progress tracking via useSuiteRunSocket
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run smoke test';
      toast.error(message);
      setIsRunningQuickSmokeTest(false);
      setSmokeTestCurrentStep(null);
    }
  };

  // Feature #550: Reset smoke test state
  const dismissSmokeTestResult = () => {
    setSmokeTestResult(null);
    setSmokeTestRunId(null);
    setSmokeTestTestId(null);
    setSmokeTestCurrentStep(null);
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

  // Feature #144: Use React Query hooks for settings data (with caching)
  // Only enable queries when Settings tab is active for lazy loading
  const isSettingsTab = activeTab === 'settings';
  const isAdminOrOwner = user?.role === 'owner' || user?.role === 'admin';
  const isNotViewer = user?.role !== 'viewer';

  // React Query hooks for settings data
  const { data: projectMembersData } = useProjectMembers(isSettingsTab && isAdminOrOwner ? id : undefined);
  const { data: orgMembersData } = useMembers(isSettingsTab && isAdminOrOwner ? user?.organization_id : undefined);
  const { data: alertChannelsData } = useAlertChannels(isSettingsTab && isNotViewer ? id : undefined);
  const { data: alertHistoryData } = useAlertHistory();
  const { data: envVarsData } = useEnvVars(isSettingsTab && isNotViewer ? id : undefined);
  const { data: healingSettingsData } = useHealingSettings(isSettingsTab && isNotViewer ? id : undefined);

  // Sync React Query data to handler state
  useEffect(() => {
    if (projectMembersData) setProjectMembers(projectMembersData);
  }, [projectMembersData, setProjectMembers]);

  useEffect(() => {
    if (orgMembersData) setOrgMembers(orgMembersData);
  }, [orgMembersData, setOrgMembers]);

  useEffect(() => {
    if (alertChannelsData) setAlertChannels(alertChannelsData);
  }, [alertChannelsData, setAlertChannels]);

  useEffect(() => {
    if (alertHistoryData && id) {
      const projectHistory = alertHistoryData.filter(
        (h: AlertHistoryEntry) => h.projectId === id
      );
      setAlertHistory(projectHistory);
    }
  }, [alertHistoryData, id, setAlertHistory]);

  useEffect(() => {
    if (envVarsData) setEnvVars(envVarsData);
  }, [envVarsData, setEnvVars]);

  useEffect(() => {
    if (healingSettingsData) setHealingSettings(healingSettingsData);
  }, [healingSettingsData, setHealingSettings]);

  // Feature #58: Lazy-load GitHub data when GitHub tab is activated
  useEffect(() => {
    if (activeTab !== 'github' || githubDataLoaded) return;

    const fetchGitHubData = async () => {
      try {
        // Load GitHub data in parallel
        const [statusRes, connRes] = await Promise.all([
          fetch('/api/v1/github/status', {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
          fetch(`/api/v1/projects/${id}/github`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
        ]);

        if (statusRes.ok) {
          const githubStatus = await statusRes.json();
          setGithubConnected(githubStatus.connected);
          setGithubUsername(githubStatus.username);
        }

        if (connRes.ok) {
          const githubConnData = await connRes.json();
          if (githubConnData.connected) {
            setGithubConnection(githubConnData.connection);
            setGithubTestFiles(githubConnData.test_files || []);
            setAvailableBranches(githubConnData.branches || []);

            // Fetch PR checks status
            const prResponse = await fetch(`/api/v1/projects/${id}/github/pull-requests`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (prResponse.ok) {
              const prData = await prResponse.json();
              setPullRequests(prData.pull_requests || []);
              setPrChecksEnabled(prData.pr_checks_enabled || false);
              setPrCommentsEnabled(prData.pr_comments_enabled || false);
            }
          }
        }

        setGithubDataLoaded(true);
      } catch (err) {
        console.error('Failed to load GitHub data:', err);
      }
    };

    fetchGitHubData();
  }, [activeTab, githubDataLoaded, id, token]);

  // Feature #144: Use React Query hooks for SAST/DAST data (with caching)
  const isSecurityTab = activeTab === 'security';

  // React Query hooks for SAST data
  const { data: sastData, isLoading: sastQueryLoading } = useSastConfig(isSecurityTab ? id : undefined);

  // React Query hooks for DAST data
  const { data: dastData, isLoading: dastQueryLoading } = useDastConfig(isSecurityTab ? id : undefined);

  // Sync SAST data from React Query to handler state
  useEffect(() => {
    if (sastData) {
      if (sastData.config) setSastConfig(sastData.config);
      if (sastData.rulesets) setSastRulesets(sastData.rulesets);
      if (sastData.scans) setSastScans(sastData.scans);
      if (sastData.customRules) setCustomRules(sastData.customRules);
      if (sastData.patterns) setSecretPatterns(sastData.patterns);
    }
  }, [sastData, setSastConfig, setSastRulesets, setSastScans, setCustomRules, setSecretPatterns]);

  // Sync DAST data from React Query to handler state
  useEffect(() => {
    if (dastData) {
      if (dastData.config) setDastConfig(dastData.config);
      if (dastData.targetUrl !== undefined) setDastTargetUrl(dastData.targetUrl);
      if (dastData.scans) setDastScans(dastData.scans);
      setOpenApiSpec(dastData.spec || null);
      if (dastData.schedules) setDastSchedules(dastData.schedules);
    }
  }, [dastData, setDastConfig, setDastTargetUrl, setDastScans, setOpenApiSpec, setDastSchedules]);

  // Sync loading state
  useEffect(() => {
    setIsLoadingSast(sastQueryLoading);
  }, [sastQueryLoading, setIsLoadingSast]);

  useEffect(() => {
    setIsLoadingDast(dastQueryLoading);
  }, [dastQueryLoading, setIsLoadingDast]);

  // Poll for updates when there's a running DAST scan (still needed for real-time progress)
  useEffect(() => {
    if (activeTab !== 'security') return;

    const pollInterval = setInterval(async () => {
      const hasRunningScans = dastScans.some(s => s.status === 'running');
      if (hasRunningScans) {
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
  }, [id, token, activeTab, dastScans, setDastScans]);

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

  // Feature #125: Skeleton loader for better perceived performance
  if (isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <SkeletonProjectDetail />
        </div>
      </Layout>
    );
  }

  if (error) {
    // Distinguish rate-limit errors from actual 404s
    const statusCode = (projectError as Error & { status?: number })?.status;
    const isRateLimited = statusCode === 429 || error.includes('429');

    return (
      <Layout>
        <div className="flex flex-col items-center justify-center p-8 min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {isRateLimited ? 'Too Many Requests' : 'Project Not Found'}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {isRateLimited
                ? 'You\'ve hit the rate limit. The project still exists — please wait a moment and try again.'
                : error}
            </p>
            {!isRateLimited && (
              <p className="mt-1 text-sm text-muted-foreground">
                The project may not exist, or you may not have access to it.
              </p>
            )}
            <div className="mt-6 flex gap-3 justify-center">
              {isRateLimited && (
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => navigate('/projects')}
                className={`rounded-md px-6 py-2 font-medium ${isRateLimited ? 'bg-muted text-muted-foreground hover:bg-muted/80' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
              >
                Go to Projects
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Feature #337: PageHeader with breadcrumbs and action buttons */}
        <PageHeader
          title={project?.name || 'Project'}
          description={project?.description}
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Projects', href: '/projects' },
            { label: project?.name || 'Project' }
          ]}
          actions={
            <div className="flex items-center gap-3">
              {/* Feature #1975: One-click Smoke Test button */}
              <button
                onClick={handleQuickSmokeTest}
                disabled={isRunningQuickSmokeTest || !project?.base_url}
                title={!project?.base_url ? 'Set a base URL in project settings first' : 'Run a quick health check on the project'}
                className={`rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2 transition-all ${
                  isRunningQuickSmokeTest
                    ? 'bg-warning text-warning-foreground cursor-wait'
                    : !project?.base_url
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-warning text-warning-foreground hover:bg-warning/90'
                }`}
              >
                {isRunningQuickSmokeTest ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Flame className="h-4 w-4" />
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
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Project
                </button>
              )}
            </div>
          }
        />

        {/* Feature #550: Inline Smoke Test Wave Visualization */}
        {(isRunningQuickSmokeTest || smokeTestResult) && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Flame className="h-5 w-5 text-warning" />
                Smoke Test
              </h3>
              {smokeTestResult && (
                <button
                  onClick={dismissSmokeTestResult}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              )}
            </div>

            {/* Wave Progress Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Health Check Wave */}
              <WaveProgressCard
                status={
                  smokeTestResult === 'passed' ? 'completed' :
                  smokeTestResult === 'failed' && smokeTestCurrentStep?.phase !== 'health' ? 'completed' :
                  smokeTestResult === 'failed' && smokeTestCurrentStep?.phase === 'health' ? 'failed' :
                  smokeTestCurrentStep?.phase === 'health' ? 'running' :
                  (smokeTestCurrentStep?.stepIndex || 0) > 0 ? 'completed' :
                  'waiting' as WaveProgressStatus
                }
                icon={Globe}
                title="Health Check"
                subtitle="DNS & SSL verification"
                expanded={smokeTestExpandedPhase === 'health'}
                onToggle={() => setSmokeTestExpandedPhase(
                  smokeTestExpandedPhase === 'health' ? null : 'health'
                )}
                steps={[
                  { name: 'DNS Resolution', status: (smokeTestCurrentStep?.stepIndex || 0) >= 1 || smokeTestResult ? 'completed' : smokeTestCurrentStep?.phase === 'health' ? 'running' : 'pending' },
                  { name: 'SSL Certificate', status: (smokeTestCurrentStep?.stepIndex || 0) >= 1 || smokeTestResult ? 'completed' : 'pending' },
                ]}
                animate={smokeTestCurrentStep?.phase === 'health'}
              />

              {/* Page Load Wave */}
              <WaveProgressCard
                status={
                  smokeTestResult === 'passed' ? 'completed' :
                  smokeTestResult === 'failed' && smokeTestCurrentStep?.phase === 'validation' ? 'completed' :
                  smokeTestResult === 'failed' && smokeTestCurrentStep?.phase === 'pageload' ? 'failed' :
                  smokeTestCurrentStep?.phase === 'pageload' ? 'running' :
                  (smokeTestCurrentStep?.stepIndex || 0) > 1 ? 'completed' :
                  'waiting' as WaveProgressStatus
                }
                icon={FileCheck}
                title="Page Load"
                subtitle="HTTP response & timing"
                expanded={smokeTestExpandedPhase === 'pageload'}
                onToggle={() => setSmokeTestExpandedPhase(
                  smokeTestExpandedPhase === 'pageload' ? null : 'pageload'
                )}
                steps={[
                  { name: 'HTTP Status', status: (smokeTestCurrentStep?.stepIndex || 0) >= 2 || smokeTestResult ? 'completed' : smokeTestCurrentStep?.phase === 'pageload' ? 'running' : 'pending' },
                  { name: 'Response Time', status: (smokeTestCurrentStep?.stepIndex || 0) >= 2 || smokeTestResult ? 'completed' : 'pending' },
                ]}
                animate={smokeTestCurrentStep?.phase === 'pageload'}
              />

              {/* Basic Validation Wave */}
              <WaveProgressCard
                status={
                  smokeTestResult === 'passed' ? 'completed' :
                  smokeTestResult === 'failed' && smokeTestCurrentStep?.phase === 'validation' ? 'failed' :
                  smokeTestCurrentStep?.phase === 'validation' ? 'running' :
                  'waiting' as WaveProgressStatus
                }
                icon={CheckCircle2}
                title="Validation"
                subtitle="Content & structure checks"
                expanded={smokeTestExpandedPhase === 'validation'}
                onToggle={() => setSmokeTestExpandedPhase(
                  smokeTestExpandedPhase === 'validation' ? null : 'validation'
                )}
                steps={[
                  { name: 'HTML Structure', status: smokeTestResult ? (smokeTestResult === 'passed' ? 'completed' : 'failed') : smokeTestCurrentStep?.phase === 'validation' ? 'running' : 'pending' },
                  { name: 'Console Errors', status: smokeTestResult ? (smokeTestResult === 'passed' ? 'completed' : 'pending') : 'pending' },
                ]}
                animate={smokeTestCurrentStep?.phase === 'validation'}
              />
            </div>

            {/* Results Summary */}
            {smokeTestResult && (
              <div className={`mt-4 p-3 rounded-lg ${
                smokeTestResult === 'passed'
                  ? 'bg-success/10 border border-success/20'
                  : 'bg-destructive/10 border border-destructive/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {smokeTestResult === 'passed' ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className={`font-medium ${
                      smokeTestResult === 'passed' ? 'text-success' : 'text-destructive'
                    }`}>
                      {smokeTestResult === 'passed'
                        ? 'All checks passed!'
                        : 'Some checks failed'
                      }
                    </span>
                  </div>
                  {smokeTestTestId && (
                    <Link
                      to={`/tests/${smokeTestTestId}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View Details →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feature #526: Project Health Overview with ScoreCards */}
        {suites.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreCard
              score={suites.length}
              label="Test Suites"
              maxScore={suites.length}
              thresholds={{ good: 1, warning: 0 }}
              size="sm"
            />
            <ScoreCard
              score={suites.reduce((total, s) => total + ((s as TestSuite).test_count || 0), 0)}
              label="Total Tests"
              maxScore={suites.reduce((total, s) => total + ((s as TestSuite).test_count || 0), 0) || 1}
              thresholds={{ good: 1, warning: 0 }}
              size="sm"
            />
            {/* Feature #558: Extracted security score calculation */}
            <ScoreCard
              score={computeSecurityScore(sastScans, dastScans)}
              label="Security Score"
              size="sm"
            />
            {/* Feature #558: Replaced raw div with ScoreCard */}
            <ScoreCard
              score={githubConnected ? 100 : 0}
              label="GitHub"
              size="sm"
              thresholds={{ good: 100, warning: 1 }}
            />
          </div>
        )}

        {/* Feature #558: Recent Activity feed - last 5 runs across all suites */}
        {(() => {
          const recentRuns = (recentRunsData?.runs || recentRunsData?.data || []).slice(0, 5);
          if (recentRuns.length === 0) return null;
          return (
            <div className="mt-4 rounded-lg border border-border bg-card">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Recent Activity
                </h3>
              </div>
              <div className="divide-y divide-border">
                {recentRuns.map((run: { id: string; suite_name?: string; test_name?: string; status: string; created_at: string; duration_ms?: number }) => (
                  <button
                    key={run.id}
                    onClick={() => navigate(`/runs/${run.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      run.status === 'passed' ? 'bg-success' :
                      run.status === 'failed' ? 'bg-destructive' :
                      run.status === 'running' ? 'bg-warning animate-pulse' :
                      'bg-muted-foreground'
                    }`} />
                    <span className="flex-1 truncate text-foreground">
                      {run.suite_name || 'Suite'}{run.test_name ? ` › ${run.test_name}` : ''}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {getRelativeTime(run.created_at)}
                    </span>
                    {run.duration_ms != null && run.duration_ms > 0 && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {run.duration_ms < 1000 ? `${run.duration_ms}ms` : `${(run.duration_ms / 1000).toFixed(1)}s`}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Tab Navigation - Feature #490: Progressive disclosure with badges */}
        <div className="mt-6 border-b border-border">
          <nav className="-mb-px flex items-center gap-4" aria-label="Project tabs">
            {/* Primary Tab: Suites with test count badge */}
            <button
              onClick={() => setActiveTab('suites')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'suites'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              aria-current={activeTab === 'suites' ? 'page' : undefined}
            >
              <FolderKanban className="h-4 w-4" />
              Suites
              {suites.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                  {suites.length}
                </span>
              )}
            </button>

            {/* Primary Tab: Settings */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              aria-current={activeTab === 'settings' ? 'page' : undefined}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>

            {/* Primary Tab: Security with vulnerability count badge */}
            <button
              onClick={() => setActiveTab('security')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'security'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              aria-current={activeTab === 'security' ? 'page' : undefined}
            >
              <Shield className="h-4 w-4" />
              Security
              {(() => {
                // Calculate total vulnerabilities from SAST and DAST scans
                const sastFindingCount = sastScans.reduce((total, scan) =>
                  total + (scan.findings?.length || 0), 0
                );
                const dastFindingCount = dastScans.reduce((total, scan) =>
                  total + (scan.alerts?.length || 0), 0
                );
                const totalVulnerabilities = sastFindingCount + dastFindingCount;
                if (totalVulnerabilities > 0) {
                  return (
                    <span className="ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-destructive/10 text-destructive">
                      {totalVulnerabilities}
                    </span>
                  );
                }
                return null;
              })()}
            </button>

            {/* More Dropdown for overflow tabs */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                    activeTab === 'github'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  More
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem
                  onClick={() => setActiveTab('github')}
                  className={`flex items-center gap-2 cursor-pointer ${
                    activeTab === 'github' ? 'bg-accent' : ''
                  }`}
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        {/* Suites Tab Content */}
        {activeTab === 'suites' && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Test Suites</h2>
              <div className="flex items-center gap-2">
                {/* Feature #559: Suite search filter */}
                {suites.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={suiteSearchQuery}
                      onChange={(e) => setSuiteSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setSuiteSearchQuery(''); }}
                      placeholder="Search suites..."
                      className="h-9 w-48 rounded-md border border-input bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {suiteSearchQuery && (
                      <button
                        onClick={() => setSuiteSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {canCreateSuite && (
                  <button
                    onClick={() => setShowCreateSuiteModal(true)}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Create Suite
                  </button>
                )}
              </div>
            </div>

            {/* Feature #559: Enhanced empty state with EmptyStates component */}
            {suites.length === 0 ? (
              EmptyStates.noSuites(canCreateSuite ? () => setShowCreateSuiteModal(true) : undefined)
            ) : (() => {
              const query = suiteSearchQuery.toLowerCase().trim();
              const filteredSuites = query
                ? suites.filter((s) => {
                    const suite = s as TestSuite;
                    return (
                      (suite.name || '').toLowerCase().includes(query) ||
                      (suite.description || '').toLowerCase().includes(query)
                    );
                  })
                : suites;

              if (filteredSuites.length === 0) {
                return EmptyStates.noSearchResults(suiteSearchQuery);
              }

              return (
                /* Feature #549: Enriched suite cards with AnimatedCard + SuiteCard */
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSuites.map((suite, index) => (
                    <AnimatedCard
                      key={suite.id}
                      variant="interactive"
                      staggerIndex={index}
                      className="p-0"
                    >
                      <SuiteCard
                        suite={suite as TestSuite}
                        projectId={id || ''}
                        formatDate={formatDate}
                      />
                    </AnimatedCard>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Settings Tab Content - Using SettingsTab component (Feature #49) */}
        {activeTab === 'settings' && (
          <SettingsTab
            project={project}
            user={user}
            token={token}
            formatDate={formatDate}
            projectDefaultBrowser={projectDefaultBrowser}
            setProjectDefaultBrowser={setProjectDefaultBrowser}
            projectViewportProfiles={projectViewportProfiles}
            setProjectViewportProfiles={setProjectViewportProfiles}
            isSavingProjectDefaults={isSavingProjectDefaults}
            setIsSavingProjectDefaults={setIsSavingProjectDefaults}
            canManageMembers={canManageMembers}
            canManageAlerts={canManageAlerts}
            availableMembers={availableMembers}
            getMemberDetails={getMemberDetails}
            settingsState={settingsState}
            settingsHandlers={settingsHandlers}
          />
        )}

        {/* GitHub Tab Content - Using GitHubTab component (Feature #49) */}
        {activeTab === 'github' && (
          <GitHubTab
            projectId={id || ''}
            token={token}
            user={user}
            formatDate={formatDate}
            slackChannels={slackChannels}
            setSlackChannels={setSlackChannels}
            // GitHub state
            githubConnected={githubConnected}
            githubUsername={githubUsername}
            isConnectingGithub={isConnectingGithub}
            githubConnection={githubConnection}
            githubTestFiles={githubTestFiles}
            isSyncingGithub={isSyncingGithub}
            isDisconnectingRepo={isDisconnectingRepo}
            isChangingBranch={isChangingBranch}
            availableBranches={availableBranches}
            githubError={githubError}
            prChecksEnabled={prChecksEnabled}
            isTogglingPRChecks={isTogglingPRChecks}
            pullRequests={pullRequests}
            prCommentsEnabled={prCommentsEnabled}
            isTogglingPRComments={isTogglingPRComments}
            // PR Dependency Scan state
            prDependencyScanEnabled={prDependencyScanEnabled}
            isTogglingPRDependencyScan={isTogglingPRDependencyScan}
            prDependencyScanFiles={prDependencyScanFiles}
            prDependencyScanSeverity={prDependencyScanSeverity}
            prDependencyScanBlockOnCritical={prDependencyScanBlockOnCritical}
            isRunningPRDependencyScan={isRunningPRDependencyScan}
            prDependencyScanResults={prDependencyScanResults}
            // GitHub handlers
            handleConnectGithub={handleConnectGithub}
            handleDisconnectGithub={handleDisconnectGithub}
            handleOpenRepoSelect={handleOpenRepoSelect}
            handleDisconnectRepo={handleDisconnectRepo}
            handleSyncRepo={handleSyncRepo}
            handleChangeBranch={handleChangeBranch}
            handleTogglePRChecks={handleTogglePRChecks}
            handlePostPRStatus={handlePostPRStatus}
            handleTogglePRComments={handleTogglePRComments}
            handlePostPRComment={handlePostPRComment}
            handleTogglePRDependencyScan={handleTogglePRDependencyScan}
            handleUpdatePRDependencyScanConfig={handleUpdatePRDependencyScanConfig}
            handleTriggerPRDependencyScan={handleTriggerPRDependencyScan}
          />
        )}

        {/* Security Tab Content - Using SecurityTab component (Feature #49) */}
        {activeTab === 'security' && (
          <SecurityTab
            projectId={id || ''}
            token={token}
            // SAST state
            sastConfig={sastConfig}
            sastScans={sastScans}
            isLoadingSast={isLoadingSast}
            isUpdatingSast={isUpdatingSast}
            isRunningScan={isRunningScan}
            selectedScan={selectedScan}
            sastRulesets={sastRulesets}
            customRules={customRules}
            isLoadingCustomRules={isLoadingCustomRules}
            showAddCustomRuleModal={showAddCustomRuleModal}
            newCustomRuleName={newCustomRuleName}
            newCustomRuleYaml={newCustomRuleYaml}
            isAddingCustomRule={isAddingCustomRule}
            customRuleError={customRuleError}
            secretPatterns={secretPatterns}
            showAddSecretPatternModal={showAddSecretPatternModal}
            newPatternName={newPatternName}
            newPatternDescription={newPatternDescription}
            newPatternRegex={newPatternRegex}
            newPatternSeverity={newPatternSeverity}
            isAddingPattern={isAddingPattern}
            patternError={patternError}
            patternTestInput={patternTestInput}
            patternTestResult={patternTestResult}
            showFalsePositiveModal={showFalsePositiveModal}
            selectedFinding={selectedFinding}
            fpReason={fpReason}
            isMarkingFP={isMarkingFP}
            showFalsePositives={showFalsePositives}
            expandedRemediations={expandedRemediations}
            // DAST state
            dastConfig={dastConfig}
            dastScans={dastScans}
            isLoadingDast={isLoadingDast}
            isUpdatingDast={isUpdatingDast}
            isRunningDastScan={isRunningDastScan}
            selectedDastScan={selectedDastScan}
            dastTargetUrl={dastTargetUrl}
            openApiSpec={openApiSpec}
            isUploadingSpec={isUploadingSpec}
            specUploadError={specUploadError}
            dastSchedules={dastSchedules}
            // SAST handlers
            handleUpdateSastConfig={handleUpdateSastConfig}
            handleTriggerScan={handleTriggerScan}
            setSelectedScan={setSelectedScan}
            setShowAddCustomRuleModal={setShowAddCustomRuleModal}
            setNewCustomRuleName={setNewCustomRuleName}
            setNewCustomRuleYaml={setNewCustomRuleYaml}
            setCustomRuleError={setCustomRuleError}
            handleAddCustomRule={handleAddCustomRule}
            handleToggleCustomRule={handleToggleCustomRule}
            handleDeleteCustomRule={handleDeleteCustomRule}
            setShowAddSecretPatternModal={setShowAddSecretPatternModal}
            setNewPatternName={setNewPatternName}
            setNewPatternDescription={setNewPatternDescription}
            setNewPatternRegex={setNewPatternRegex}
            setNewPatternSeverity={setNewPatternSeverity}
            setPatternError={setPatternError}
            setPatternTestInput={setPatternTestInput}
            setPatternTestResult={setPatternTestResult}
            handleAddSecretPattern={handleAddSecretPattern}
            handleToggleSecretPattern={handleToggleSecretPattern}
            handleDeleteSecretPattern={handleDeleteSecretPattern}
            handleTestPattern={handleTestPattern}
            setShowFalsePositiveModal={setShowFalsePositiveModal}
            setSelectedFinding={setSelectedFinding}
            setFpReason={setFpReason}
            handleMarkFalsePositive={handleMarkFalsePositive}
            toggleRemediation={toggleRemediation}
            // DAST handlers
            handleUpdateDastConfig={handleUpdateDastConfig}
            handleTriggerDastScan={handleTriggerDastScan}
            setDastTargetUrl={setDastTargetUrl}
            setSelectedDastScan={setSelectedDastScan}
            handleUploadOpenApiSpec={handleUploadOpenApiSpec}
            handleDeleteOpenApiSpec={handleDeleteOpenApiSpec}
            setDastScans={setDastScans}
            setDastSchedules={setDastSchedules}
          />
        )}

        {/* Feature #1535: Autopilot Tab Content removed - enterprise bloat */}

        {/* Feature #1539: Maintenance Tab Content removed - uses dummy data with no real API */}

        {/* Feature #1540: Discovery Tab Content removed - uses dummy data with no real AI API */}

        {/* Feature #1536: Predictions Tab Content removed - simple flaky test detection is sufficient */}

        {/* Feature #1541: Code Quality Tab Content removed - uses dummy data with no real API */}

        {/* Repository Selection Modal - Feature #636: Using Modal component */}
        <Modal
          isOpen={showRepoSelectModal}
          onClose={() => {
            setShowRepoSelectModal(false);
            setSelectedRepo(null);
          }}
          title="Select Repository"
          size="lg"
        >
          <ModalBody>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a repository to connect to this project.
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
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
          </ModalBody>
          <ModalFooter>
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
          </ModalFooter>
        </Modal>

        {/* Modal Components - Using ProjectModals component (Feature #49) */}
        <ProjectModals
          project={project}
          showAddEnvModal={showAddEnvModal}
          showDeleteModal={showDeleteModal}
          showCreateAlertModal={showCreateAlertModal}
          showAddMemberModal={showAddMemberModal}
          showCreateSuiteModal={showCreateSuiteModal}
          isDeleting={isDeleting}
          deleteError={deleteError}
          setShowDeleteModal={setShowDeleteModal}
          handleDeleteProject={handleDeleteProject}
          setShowCreateSuiteModal={setShowCreateSuiteModal}
          newSuiteName={newSuiteName}
          setNewSuiteName={setNewSuiteName}
          newSuiteDescription={newSuiteDescription}
          setNewSuiteDescription={setNewSuiteDescription}
          newSuiteBrowser={newSuiteBrowser}
          setNewSuiteBrowser={setNewSuiteBrowser}
          devicePreset={devicePreset}
          setDevicePreset={setDevicePreset}
          handleDevicePresetChange={handleDevicePresetChange}
          newSuiteViewportWidth={newSuiteViewportWidth}
          setNewSuiteViewportWidth={setNewSuiteViewportWidth}
          newSuiteViewportHeight={newSuiteViewportHeight}
          setNewSuiteViewportHeight={setNewSuiteViewportHeight}
          newSuiteTimeout={newSuiteTimeout}
          setNewSuiteTimeout={setNewSuiteTimeout}
          newSuiteRetryCount={newSuiteRetryCount}
          setNewSuiteRetryCount={setNewSuiteRetryCount}
          isCreatingSuite={isCreatingSuite}
          createSuiteError={createSuiteError}
          handleCreateSuite={handleCreateSuite}
          availableMembers={availableMembers}
          settingsState={settingsState}
          settingsHandlers={settingsHandlers}
        />
      </div>
    </Layout>
  );
}
export { ProjectDetailPage };
