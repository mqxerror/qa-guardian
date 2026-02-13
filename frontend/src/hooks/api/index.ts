/**
 * API Hooks - Re-exports all React Query hooks for API data fetching
 * Feature #56: Create React Query hooks for API data fetching
 *
 * Usage:
 *   import { useRunsPaginated, useProjects, useSuite } from '@/hooks/api';
 *
 * These hooks provide:
 * - Automatic caching via React Query
 * - Automatic refetching on window focus
 * - Loading and error states
 * - Optimistic updates for mutations
 * - Cache invalidation helpers
 */

// Feature #655: Shared auth fetch helper
export { fetchWithAuth, type FetchError } from './fetchWithAuth';

// Runs hooks
export {
  useRuns,
  useRunsPaginated,
  useRunsInfinite,
  useRun,
  useRunsByTest,
  useRunsBySuite,
  useRunsByProject,  // Feature #558
  useStartRun,
  useCancelRun,
  useStartSuiteRun,  // Feature #143
  // Feature #701: Run result selector update hooks
  useUpdateRunSelector,
  useAcceptHealedSelector,
  useInvalidateRuns,
  runKeys,
  type TestRun,
  type PaginatedRunsResponse,
  type RunsQueryParams,
} from './useRuns';

// Projects hooks
export {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useInvalidateProjects,
  projectKeys,
  type Project,
  type ProjectsResponse,
  type CreateProjectInput,
  type UpdateProjectInput,
  // Feature #144: Project settings hooks
  useProjectMembers,
  useAlertChannels,
  useAlertHistory,
  useEnvVars,
  useHealingSettings,
  useSastConfig,
  useDastConfig,
  useInvalidateProjectSettings,
  projectSettingsKeys,
  // Types re-exported from project-detail
  type ProjectMember,
  type AlertChannel,
  type AlertHistoryEntry,
  type EnvironmentVariable,
  type HealingSettings,
  type SASTConfig,
  type SASTScanResult,
  type SASTRuleset,
  type CustomRule,
  type SecretPattern,
  type DASTConfig,
  type DASTScanResult,
  type OpenAPISpec,
} from './useProjects';

// Suites hooks
export {
  useSuites,
  useSuitesPaginated,
  useSuite,
  useCreateSuite,
  useUpdateSuite,
  useDeleteSuite,
  useInvalidateSuites,
  // Feature #701: Review settings and AI health check hooks
  useReviewSettings,
  useToggleHumanReview,
  useAIHealthCheck,
  suiteKeys,
  type TestSuite,
  type PaginatedSuitesResponse,
  type SuitesQueryParams,
  type CreateSuiteInput,
  type UpdateSuiteInput,
  // Feature #701: Review settings types
  type ReviewStats,
  type ReviewSettingsResponse,
  type AIHealthReport,
} from './useSuites';

// Tests hooks
export {
  useTests,
  useTestsPaginated,
  useTest,
  useTestCode,
  useCreateTest,
  useUpdateTest,
  useDeleteTest,
  useReviewTest,        // Feature #143
  useBatchReviewTests,  // Feature #143
  useDuplicateTest,     // Feature #143
  useUpdateSelector,    // Feature #143
  // Feature #701: Step template hooks
  useStepTemplates,
  useInsertTemplateSteps,
  useDeleteStepTemplate,
  stepTemplateKeys,
  useInvalidateTests,
  testKeys,
  type Test,
  type TestStep,
  type PaginatedTestsResponse,
  type TestsQueryParams,
  type CreateTestInput,
  type UpdateTestInput,
  // Feature #701: Step template type
  type StepTemplate,
} from './useTests';

// Dashboard hooks (Feature #70)
export {
  useDashboardStats,
  useRecentRuns,
  dashboardKeys,
  type DashboardStats,
  type RecentRun,
} from './useDashboard';

// Analytics hooks (Feature #72)
export {
  useFailingTests,
  useBrowserStats,
  useProjectComparison,
  useFlakyTests,
  usePassRateTrends,
  useAccessibilityTrends,
  useFailureClusters,
  analyticsKeys,
} from './useAnalytics';

// Real-time cache invalidation (Feature #96)
export { useRealtimeCacheInvalidation } from './useRealtimeCacheInvalidation';

// Organization hooks (Feature #84, #690)
export {
  useAuditLogs,
  useAuditLogActions,
  useAuditLogResourceTypes,
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useWebhookLogs,
  useInvalidateOrganization,
  organizationKeys,
  // Feature #690: Invitation hooks
  useInvitation,
  useAcceptInvitation,
  invitationKeys,
  type AuditLogEntry,
  type AuditLogsResponse,
  type AuditLogsParams,
  type ApiKey,
  type CreateApiKeyParams,
  type WebhookSubscription,
  type WebhookDeliveryLog,
  type CreateWebhookParams,
  type Invitation,
} from './useOrganization';

// Organization Settings hooks (Feature #709)
export {
  useSessions,
  useLogoutSession,
  useLogoutAllSessions,
  useArtifactRetention,
  useSaveArtifactRetention,
  useCleanupPreview,
  useRunCleanup,
  useStorageUsage,
  useMcpConnections,
  useMcpAuditLogs,
  useMcpAnalytics,
  useExportMcpAnalytics,
  useSlackConnection,
  useConnectSlack,
  useDisconnectSlack,
  useOrgMembers,
  useAdminMembers,
  useTransferOwnership,
  useDeleteOrganization,
  useInvalidateOrgSettings,
  orgSettingsKeys,
  type McpAuditLogsParams,
} from './useOrganizationSettings';

// Dependency Security hooks (Feature #710)
export {
  // Dependency Policy hooks
  useDependencyPolicies,
  usePolicyViolations,
  useCreateDependencyPolicy,
  useTogglePolicyEnabled,
  useDeleteDependencyPolicy,
  useSimulateBuild,
  useOverrideViolation,
  // Dependency Alerts hooks
  useDependencyAlertConfig,
  useDependencyAlerts,
  useUpdateDependencyAlertConfig,
  useSimulateCVE,
  useUpdateAlertStatus,
  // Auto-PR hooks
  useAutoPRConfig,
  useAutoPRs,
  useUpdateAutoPRConfig,
  useScanAndCreatePRs,
  useUpdateAutoPRStatus,
  // npm Audit hooks (Feature #725)
  useNpmAuditScan,
  useRunNpmAuditScan,
  // Invalidation helper
  useInvalidateDependencySecurity,
  dependencySecurityKeys,
  // Types
  type DependencyPolicy,
  type PolicyViolation,
  type ViolationSummary,
  type CreatePolicyInput,
  type SimulateBuildResult,
  type DependencyAlertConfig,
  type CVEAlert,
  type AlertSummary,
  type AutoPRConfig,
  type AutoPR,
  type AutoPRSummary,
  type ScanAndCreateResult,
  // npm Audit types (Feature #725)
  type NpmAuditVulnerability,
  type NpmAuditDependency,
  type NpmAuditUpgradeSuggestion,
  type NpmAuditRecommendation,
  type NpmAuditScanResult,
} from './useDependencySecurity';
