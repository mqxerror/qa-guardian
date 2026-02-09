// ProjectDetailPage - Extracted from App.tsx (Feature #1441)
// Project details with test suites, test management, and GitHub integration
// Feature #58: Migrated to React Query for parallel data loading
// Feature #125: Added skeleton loaders for better perceived performance
// Feature #337: Dark-first design system redesign
import { useState, useEffect, useRef } from "react"; // useCallback unused
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
} from "../components/ui";
import { Flame, Plus, Settings, Loader2, FolderKanban, TestTube2, Calendar, User, MoreHorizontal, Github, Shield, ChevronDown } from "lucide-react";
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
// Feature #58: Import React Query hooks for parallel data fetching
// Feature #144: Added project settings hooks for caching
import {
  useProject, useSuites, useInvalidateSuites,
  useProjectMembers, useAlertChannels, useAlertHistory,
  useEnvVars, useHealingSettings, useSastConfig, useDastConfig,
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
  const [isRunningQuickSmokeTest, setIsRunningQuickSmokeTest] = useState(false);
  const [smokeTestRunId, setSmokeTestRunId] = useState<string | null>(null);

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
            toast.success('Site Healthy ✅ - Click test details to view results', 5000);
            // Navigate to test details after a short delay
            setTimeout(() => navigate(`/tests/${testId}`), 1000);
          } else if (status === 'failed' || status === 'error') {
            completed = true;
            toast.error('Issues Found ⚠️ - Click test details to view results', 8000);
            // Navigate to test details after a short delay
            setTimeout(() => navigate(`/tests/${testId}`), 1000);
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
            <ScoreCard
              score={
                sastScans.length > 0 && sastScans[0]?.summary?.total === 0 &&
                dastScans.length > 0 && dastScans[0]?.summary?.total === 0
                  ? 100
                  : sastScans.length === 0 && dastScans.length === 0
                    ? 50
                    : Math.max(0, 100 - (
                        (sastScans[0]?.summary?.bySeverity?.critical || 0) * 20 +
                        (sastScans[0]?.summary?.bySeverity?.high || 0) * 10 +
                        (dastScans[0]?.summary?.byRisk?.high || 0) * 10
                      ))
              }
              label="Security Score"
              size="sm"
            />
            <div className="p-3 rounded-lg bg-muted text-center">
              <div className="text-xl font-bold text-foreground">
                {githubConnected ? '✓' : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">GitHub</div>
            </div>
          </div>
        )}

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
