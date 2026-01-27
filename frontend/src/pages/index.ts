// Pages exports - extracted from App.tsx for code quality compliance
// Feature #1357: Frontend file size limit enforcement

export { HomePage } from './HomePage';
export { LoginPage } from './LoginPage';
export { RegisterPage } from './RegisterPage';
export { DashboardPage } from './DashboardPage';
export { NotFoundPage } from './NotFoundPage';
export { ProjectsPage } from './ProjectsPage';
export { ForgotPasswordPage } from './ForgotPasswordPage';
export { ResetPasswordPage } from './ResetPasswordPage';
export { CreateOrganizationPage } from './CreateOrganizationPage';
export { AcceptInvitationPage } from './AcceptInvitationPage';
export { SchedulesPage } from './SchedulesPage';
export { ScheduleDetailsPage } from './ScheduleDetailsPage';
export { AIActionPage } from './AIActionPage';
export { BillingPage } from './BillingPage';
export { ApiKeysPage } from './ApiKeysPage';
export { MCPToolsPage } from './MCPToolsPage';
export { PublicStatusPage } from './PublicStatusPage';
export { default as SharedTestRunPage } from './SharedTestRunPage'; // Feature #2002
export { OrganizationMembersPage } from './OrganizationMembersPage';
export { AuditLogsPage } from './AuditLogsPage';
export { WebhookConfigurationPage } from './WebhookConfigurationPage';
export { DASTComparisonPage } from './DASTComparisonPage';
export { DASTGraphQLPage } from './DASTGraphQLPage';
export { TrivyDependencyScanPage } from './TrivyDependencyScanPage';
export { NpmAuditPage } from './NpmAuditPage';
export { CVEDatabasePage } from './CVEDatabasePage';
export { LicenseCompliancePage } from './LicenseCompliancePage';
export { ContainerScanPage } from './ContainerScanPage';
export { DependencyPolicyPage } from './DependencyPolicyPage';
export { AutoPRPage } from './AutoPRPage';
export { DependencyAgePage } from './DependencyAgePage';
export { MultiLanguageDependencyPage } from './MultiLanguageDependencyPage';
export { VulnerabilityHistoryPage } from './VulnerabilityHistoryPage';
export { ExploitabilityAnalysisPage } from './ExploitabilityAnalysisPage';
export { ScanCachingPage } from './ScanCachingPage';
export { KieAIProviderPage } from './KieAIProviderPage';
export { AnthropicProviderPage } from './AnthropicProviderPage';
export { DependencyAlertsPage } from './DependencyAlertsPage';
export { MCPChatPage } from './MCPChatPage';
export { AIRunComparisonPage } from './AIRunComparisonPage';
export { MCPAnalyticsPage } from './MCPAnalyticsPage';
export { MCPPlaygroundPage } from './MCPPlaygroundPage';
export { SecurityDashboardPage } from './SecurityDashboardPage';
export { OrganizationInsightsPage } from './OrganizationInsightsPage';
export { BestPracticesPage } from './BestPracticesPage';
export { TestImprovementAnalyzerPage } from './TestImprovementAnalyzerPage';
export { IndustryBenchmarkPage } from './IndustryBenchmarkPage';
export { ReleaseNotesPage } from './ReleaseNotesPage';
export { PersonalizedInsightsPage } from './PersonalizedInsightsPage';
export { TeamSkillGapsPage } from './TeamSkillGapsPage';
export { AILearningPage } from './AILearningPage';
export { TestDocumentationPage } from './TestDocumentationPage';
export { ProviderHealthPage } from './ProviderHealthPage';
export { AICostTrackingPage } from './AICostTrackingPage';
export { AIUsageAnalyticsDashboard } from './AIUsageAnalyticsDashboard';
export { AIThinkingDemoPage, AIThinkingIndicator, AIThinkingSpinner } from './AIThinkingDemoPage';
export { AIConfidenceDemoPage, AIConfidenceIndicator, AIConfidenceBadge, AIConfidenceCard } from './AIConfidenceDemoPage';
export { FlakyTestsDashboardPage } from './FlakyTestsDashboardPage';
export { default as VisualReviewPage } from './VisualReviewPage';
export { AnalyticsPage } from './AnalyticsPage';
export { MonitoringPage } from './MonitoringPage';
export { AIRouterPage } from './AIRouterPage';
export { ProjectDetailPage } from './ProjectDetailPage';
export { default as OrganizationSettingsPage } from './OrganizationSettingsPage';
export { TestSuitePage } from './TestSuitePage';
export { TestDetailPage } from './TestDetailPage';
export { default as TestRunResultPage } from './TestRunResultPage'; // Feature #1823
export { AITestGeneratorPage } from './AITestGeneratorPage';
export { AITestReviewPage } from './AITestReviewPage';
export { AIAgentWorkspacePage } from './AIAgentWorkspacePage';
export { ReportPage } from './ReportPage'; // Feature #1732
export { SettingsPage } from './SettingsPage'; // Feature #1832: Unified Settings page
export { SuiteRunHistoryPage } from './SuiteRunHistoryPage'; // Feature #1851: Suite run history
export { ProjectRunHistoryPage } from './ProjectRunHistoryPage'; // Feature #1852: Project run history
export { RunHistoryPage } from './RunHistoryPage'; // Feature #1855: Global run history

// All major pages have been extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules - COMPLETE
//
// Note: Extracted pages that exceed 400 lines need further splitting:
// - TestDetailPage: 10,003 lines - needs componentization
// - TestSuitePage: 7,604 lines - needs componentization
// - SchedulesPage: 828 lines
// - ScheduleDetailsPage: 675 lines
// - WebhookConfigurationPage: 723 lines
