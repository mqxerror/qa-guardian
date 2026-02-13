// ProjectDetailPage - Extracted from App.tsx (Feature #1441)
// Project details with test suites, test management, and GitHub integration
// Feature #636: Adopt Modal component in page-level inline modals
// Feature #58: Migrated to React Query for parallel data loading
// Feature #125: Added skeleton loaders for better perceived performance
// Feature #337: Dark-first design system redesign
// Feature #550: Real-time wave visualization for smoke test
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { SkeletonProjectDetail } from "../components/ui/Skeleton";
// Feature #337: Design system components
// Feature #526: Added ScoreCard for project health overview
import {
  PageHeader,
  AnimatedCard,
  ScoreCard,
  EmptyStates, // Feature #559: Enhanced empty state
} from "../components/ui";
import { Flame, Settings, Loader2, FolderKanban, MoreHorizontal, Github, Shield, ChevronDown, Globe, FileCheck, CheckCircle2, XCircle, Search, X, Clock, Zap, GitBranch } from "lucide-react";
// Feature #550: Real-time wave visualization for smoke test
import { WaveProgressCard, type WaveProgressStatus } from "../components/ui/wave-progress-card";
// useSuiteRunSocket moved to useSmokeTest hook (Feature #718)
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useAuthStore } from "../stores/authStore";
import { useTimezoneStore } from "../stores/timezoneStore";
// useTestDefaultsStore moved to useCreateSuiteModal hook (Feature #718)
// toast moved to hooks (Feature #718)
import { createLogger } from "../utils/logger";
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Button } from '@/components/ui/button';

const logger = createLogger('project-detail');
// Feature #58: Import React Query hooks for parallel data fetching
// Feature #144: Added project settings hooks for caching
import {
  useProject, useSuites,
  useProjectMembers, useAlertChannels, useAlertHistory,
  useEnvVars, useHealingSettings, useSastConfig, useDastConfig,
  useRunsByProject, // Feature #558: Recent activity feed
} from '../hooks/api';
import { useMembers } from '../hooks/api/useSettings';
// Feature #49: Import modular types, utilities and hooks from project-detail
import {
  // Types
  TestSuite,
  AlertHistoryEntry,
  SASTScanResult,
  DASTScanResult,
  // Utilities
  getRelativeTime,
  // Components
  SuiteCard,
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
// Feature #718: Extracted state hooks
import { useCreateSuiteModal } from '../hooks/useCreateSuiteModal';
import { useSmokeTest } from '../hooks/useSmokeTest';
import { useProjectDetailModals } from '../hooks/useProjectDetailModals';

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

  // Extract data from React Query responses
  const project = projectData?.project || null;
  const suites = suitesData?.suites || suitesData?.data || [];
  const isLoading = projectLoading || suitesLoading;
  const error = projectError ? (projectError instanceof Error ? projectError.message : 'Failed to load project') : null;

  // Feature #558: Fetch recent runs for activity feed
  const { data: recentRunsData } = useRunsByProject(id, 5);

  // Feature #718: Extracted state hooks (reduces 25 useState → 2 in main component)
  const suiteModal = useCreateSuiteModal(id);
  const detailModals = useProjectDetailModals(id, () => navigate('/projects'));
  const smokeTest = useSmokeTest(id, project?.base_url);
  const [githubDataLoaded, setGithubDataLoaded] = useState(false);
  // Feature #559: Suite search filter
  const [suiteSearchQuery, setSuiteSearchQuery] = useState('');

  // Feature #49: Settings state and handlers from useSettingsHandlers hook
  // Only destructure what's actually used in this file (rest is passed via settingsState/settingsHandlers objects)
  const {
    slackChannels,
    orgMembers,
    projectMembers,
    showAddEnvModal,
    showCreateAlertModal,
    showAddMemberModal,
  } = settingsState;
  const {
    setProjectMembers, setOrgMembers,
    setAlertChannels,
    setSlackChannels, setAlertHistory,
    setEnvVars,
    setHealingSettings,
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
    setAvailableBranches, setPrChecksEnabled, setPullRequests, setPrCommentsEnabled,
    handleConnectGithub, handleDisconnectGithub, handleOpenRepoSelect, handleConnectRepo,
    handleDisconnectRepo, handleSyncRepo, handleChangeBranch, handleTogglePRChecks,
    handlePostPRStatus, handleTogglePRComments, handlePostPRComment,
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
    setShowFalsePositiveModal, setSelectedFinding, setFpReason,
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

  // Feature #718: handleCreateSuite, handleDeleteProject, and smoke test handlers
  // all extracted into useCreateSuiteModal, useProjectDetailModals, and useSmokeTest hooks

  const canCreateSuite = user?.role !== 'viewer';
  const canDeleteProject = user?.role === 'owner' || user?.role === 'admin';
  const canManageMembers = user?.role === 'owner' || user?.role === 'admin';
  const canManageAlerts = user?.role !== 'viewer';

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (suiteModal.showCreateSuiteModal) suiteModal.setShowCreateSuiteModal(false);
        if (detailModals.showDeleteModal) detailModals.setShowDeleteModal(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [suiteModal.showCreateSuiteModal, detailModals.showDeleteModal]);

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
        logger.error('Failed to load GitHub data:', err);
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
          logger.error('Failed to poll DAST scans:', err);
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
                <Button
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              )}
              <Button
                variant={isRateLimited ? 'secondary' : 'default'}
                onClick={() => navigate('/projects')}
              >
                Go to Projects
              </Button>
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
              <Button
                onClick={smokeTest.handleQuickSmokeTest}
                disabled={smokeTest.isRunningQuickSmokeTest || !project?.base_url}
                title={!project?.base_url ? 'Set a base URL in project settings first' : 'Run a quick health check on the project'}
                className={`${
                  smokeTest.isRunningQuickSmokeTest
                    ? 'bg-warning text-warning-foreground cursor-wait'
                    : !project?.base_url
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-warning text-warning-foreground hover:bg-warning/90'
                }`}
              >
                {smokeTest.isRunningQuickSmokeTest ? (
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
              </Button>
              {/* Feature #1852: View run history at project level */}
              <Link
                to={`/projects/${id}/runs`}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted inline-flex items-center gap-1"
              >
                <Clock className="w-4 h-4" />
                Run History
              </Link>
              {canDeleteProject && (
                <Button
                  variant="destructive"
                  onClick={() => detailModals.setShowDeleteModal(true)}
                >
                  Delete Project
                </Button>
              )}
            </div>
          }
        />

        {/* Feature #550: Inline Smoke Test Wave Visualization */}
        {(smokeTest.isRunningQuickSmokeTest || smokeTest.smokeTestResult) && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Flame className="h-5 w-5 text-warning" />
                Smoke Test
              </h3>
              {smokeTest.smokeTestResult && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={smokeTest.dismissSmokeTestResult}
                >
                  Dismiss
                </Button>
              )}
            </div>

            {/* Wave Progress Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Health Check Wave */}
              <WaveProgressCard
                status={
                  smokeTest.smokeTestResult === 'passed' ? 'completed' :
                  smokeTest.smokeTestResult === 'failed' && smokeTest.smokeTestCurrentStep?.phase !== 'health' ? 'completed' :
                  smokeTest.smokeTestResult === 'failed' && smokeTest.smokeTestCurrentStep?.phase === 'health' ? 'failed' :
                  smokeTest.smokeTestCurrentStep?.phase === 'health' ? 'running' :
                  (smokeTest.smokeTestCurrentStep?.stepIndex || 0) > 0 ? 'completed' :
                  'waiting' as WaveProgressStatus
                }
                icon={Globe}
                title="Health Check"
                subtitle="DNS & SSL verification"
                expanded={smokeTest.smokeTestExpandedPhase === 'health'}
                onToggle={() => smokeTest.setSmokeTestExpandedPhase(
                  smokeTest.smokeTestExpandedPhase === 'health' ? null : 'health'
                )}
                steps={[
                  { name: 'DNS Resolution', status: (smokeTest.smokeTestCurrentStep?.stepIndex || 0) >= 1 || smokeTest.smokeTestResult ? 'completed' : smokeTest.smokeTestCurrentStep?.phase === 'health' ? 'running' : 'pending' },
                  { name: 'SSL Certificate', status: (smokeTest.smokeTestCurrentStep?.stepIndex || 0) >= 1 || smokeTest.smokeTestResult ? 'completed' : 'pending' },
                ]}
                animate={smokeTest.smokeTestCurrentStep?.phase === 'health'}
              />

              {/* Page Load Wave */}
              <WaveProgressCard
                status={
                  smokeTest.smokeTestResult === 'passed' ? 'completed' :
                  smokeTest.smokeTestResult === 'failed' && smokeTest.smokeTestCurrentStep?.phase === 'validation' ? 'completed' :
                  smokeTest.smokeTestResult === 'failed' && smokeTest.smokeTestCurrentStep?.phase === 'pageload' ? 'failed' :
                  smokeTest.smokeTestCurrentStep?.phase === 'pageload' ? 'running' :
                  (smokeTest.smokeTestCurrentStep?.stepIndex || 0) > 1 ? 'completed' :
                  'waiting' as WaveProgressStatus
                }
                icon={FileCheck}
                title="Page Load"
                subtitle="HTTP response & timing"
                expanded={smokeTest.smokeTestExpandedPhase === 'pageload'}
                onToggle={() => smokeTest.setSmokeTestExpandedPhase(
                  smokeTest.smokeTestExpandedPhase === 'pageload' ? null : 'pageload'
                )}
                steps={[
                  { name: 'HTTP Status', status: (smokeTest.smokeTestCurrentStep?.stepIndex || 0) >= 2 || smokeTest.smokeTestResult ? 'completed' : smokeTest.smokeTestCurrentStep?.phase === 'pageload' ? 'running' : 'pending' },
                  { name: 'Response Time', status: (smokeTest.smokeTestCurrentStep?.stepIndex || 0) >= 2 || smokeTest.smokeTestResult ? 'completed' : 'pending' },
                ]}
                animate={smokeTest.smokeTestCurrentStep?.phase === 'pageload'}
              />

              {/* Basic Validation Wave */}
              <WaveProgressCard
                status={
                  smokeTest.smokeTestResult === 'passed' ? 'completed' :
                  smokeTest.smokeTestResult === 'failed' && smokeTest.smokeTestCurrentStep?.phase === 'validation' ? 'failed' :
                  smokeTest.smokeTestCurrentStep?.phase === 'validation' ? 'running' :
                  'waiting' as WaveProgressStatus
                }
                icon={CheckCircle2}
                title="Validation"
                subtitle="Content & structure checks"
                expanded={smokeTest.smokeTestExpandedPhase === 'validation'}
                onToggle={() => smokeTest.setSmokeTestExpandedPhase(
                  smokeTest.smokeTestExpandedPhase === 'validation' ? null : 'validation'
                )}
                steps={[
                  { name: 'HTML Structure', status: smokeTest.smokeTestResult ? (smokeTest.smokeTestResult === 'passed' ? 'completed' : 'failed') : smokeTest.smokeTestCurrentStep?.phase === 'validation' ? 'running' : 'pending' },
                  { name: 'Console Errors', status: smokeTest.smokeTestResult ? (smokeTest.smokeTestResult === 'passed' ? 'completed' : 'pending') : 'pending' },
                ]}
                animate={smokeTest.smokeTestCurrentStep?.phase === 'validation'}
              />
            </div>

            {/* Results Summary */}
            {smokeTest.smokeTestResult && (
              <div className={`mt-4 p-3 rounded-lg ${
                smokeTest.smokeTestResult === 'passed'
                  ? 'bg-success/10 border border-success/20'
                  : 'bg-destructive/10 border border-destructive/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {smokeTest.smokeTestResult === 'passed' ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className={`font-medium ${
                      smokeTest.smokeTestResult === 'passed' ? 'text-success' : 'text-destructive'
                    }`}>
                      {smokeTest.smokeTestResult === 'passed'
                        ? 'All checks passed!'
                        : 'Some checks failed'
                      }
                    </span>
                  </div>
                  {smokeTest.smokeTestTestId && (
                    <Link
                      to={`/tests/${smokeTest.smokeTestTestId}`}
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
                  <Zap className="w-4 h-4" />
                  Recent Activity
                </h3>
              </div>
              <div className="divide-y divide-border">
                {recentRuns.map((run: { id: string; suite_name?: string; test_name?: string; status: string; created_at: string; duration_ms?: number }) => (
                  <Button
                    key={run.id}
                    variant="ghost"
                    onClick={() => navigate(`/runs/${run.id}`)}
                    className="w-full h-auto flex items-center gap-3 px-4 py-2.5 text-sm text-left rounded-none"
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
                  </Button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Tab Navigation - Feature #490: Progressive disclosure with badges */}
        <div className="mt-6 border-b border-border">
          <nav className="-mb-px flex items-center gap-4" aria-label="Project tabs">
            {/* Primary Tab: Suites with test count badge */}
            <Button
              variant="ghost"
              onClick={() => setActiveTab('suites')}
              className={`py-3 px-1 text-sm font-medium border-b-2 rounded-none flex items-center gap-2 ${
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
            </Button>

            {/* Primary Tab: Settings */}
            <Button
              variant="ghost"
              onClick={() => setActiveTab('settings')}
              className={`py-3 px-1 text-sm font-medium border-b-2 rounded-none flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              aria-current={activeTab === 'settings' ? 'page' : undefined}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>

            {/* Primary Tab: Security with vulnerability count badge */}
            <Button
              variant="ghost"
              onClick={() => setActiveTab('security')}
              className={`py-3 px-1 text-sm font-medium border-b-2 rounded-none flex items-center gap-2 ${
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
            </Button>

            {/* More Dropdown for overflow tabs */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`py-3 px-1 text-sm font-medium border-b-2 rounded-none flex items-center gap-1 ${
                    activeTab === 'github'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  More
                  <ChevronDown className="h-3 w-3" />
                </Button>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSuiteSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}
                {canCreateSuite && (
                  <Button
                    size="sm"
                    onClick={() => suiteModal.setShowCreateSuiteModal(true)}
                  >
                    Create Suite
                  </Button>
                )}
              </div>
            </div>

            {/* Feature #559: Enhanced empty state with EmptyStates component */}
            {suites.length === 0 ? (
              EmptyStates.noSuites(canCreateSuite ? () => suiteModal.setShowCreateSuiteModal(true) : undefined)
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
            projectDefaultBrowser={detailModals.projectDefaultBrowser}
            setProjectDefaultBrowser={detailModals.setProjectDefaultBrowser}
            projectViewportProfiles={detailModals.projectViewportProfiles}
            setProjectViewportProfiles={detailModals.setProjectViewportProfiles}
            isSavingProjectDefaults={detailModals.isSavingProjectDefaults}
            setIsSavingProjectDefaults={detailModals.setIsSavingProjectDefaults}
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
                <Button
                  key={repo.full_name}
                  variant="outline"
                  onClick={() => {
                    setSelectedRepo(repo);
                    setSelectedBranch(repo.default_branch);
                  }}
                  className={`w-full h-auto flex items-center gap-3 p-3 text-left ${
                    selectedRepo?.full_name === repo.full_name
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <GitBranch className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{repo.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {repo.private ? 'Private' : 'Public'} • Default: {repo.default_branch}
                    </p>
                  </div>
                  {selectedRepo?.full_name === repo.full_name && (
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </Button>
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
            <Button
              variant="outline"
              onClick={() => {
                setShowRepoSelectModal(false);
                setSelectedRepo(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnectRepo}
              disabled={!selectedRepo || isConnectingRepo}
            >
              {isConnectingRepo ? 'Connecting...' : 'Connect Repository'}
            </Button>
          </ModalFooter>
        </Modal>

        {/* Modal Components - Using ProjectModals component (Feature #49) */}
        <ProjectModals
          project={project}
          showAddEnvModal={showAddEnvModal}
          showDeleteModal={detailModals.showDeleteModal}
          showCreateAlertModal={showCreateAlertModal}
          showAddMemberModal={showAddMemberModal}
          showCreateSuiteModal={suiteModal.showCreateSuiteModal}
          isDeleting={detailModals.isDeleting}
          deleteError={detailModals.deleteError}
          setShowDeleteModal={detailModals.setShowDeleteModal}
          handleDeleteProject={detailModals.handleDeleteProject}
          setShowCreateSuiteModal={suiteModal.setShowCreateSuiteModal}
          newSuiteName={suiteModal.newSuiteName}
          setNewSuiteName={suiteModal.setNewSuiteName}
          newSuiteDescription={suiteModal.newSuiteDescription}
          setNewSuiteDescription={suiteModal.setNewSuiteDescription}
          newSuiteBrowser={suiteModal.newSuiteBrowser}
          setNewSuiteBrowser={suiteModal.setNewSuiteBrowser}
          devicePreset={suiteModal.devicePreset}
          setDevicePreset={suiteModal.setDevicePreset}
          handleDevicePresetChange={suiteModal.handleDevicePresetChange}
          newSuiteViewportWidth={suiteModal.newSuiteViewportWidth}
          setNewSuiteViewportWidth={suiteModal.setNewSuiteViewportWidth}
          newSuiteViewportHeight={suiteModal.newSuiteViewportHeight}
          setNewSuiteViewportHeight={suiteModal.setNewSuiteViewportHeight}
          newSuiteTimeout={suiteModal.newSuiteTimeout}
          setNewSuiteTimeout={suiteModal.setNewSuiteTimeout}
          newSuiteRetryCount={suiteModal.newSuiteRetryCount}
          setNewSuiteRetryCount={suiteModal.setNewSuiteRetryCount}
          isCreatingSuite={suiteModal.isCreatingSuite}
          createSuiteError={suiteModal.createSuiteError}
          handleCreateSuite={suiteModal.handleCreateSuite}
          availableMembers={availableMembers}
          settingsState={settingsState}
          settingsHandlers={settingsHandlers}
        />
      </div>
    </Layout>
  );
}
export { ProjectDetailPage };
