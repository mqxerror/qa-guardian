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
// Feature #411: AIActionPage removed - dead demo page
export { BillingPage } from './BillingPage';
export { ApiKeysPage } from './ApiKeysPage';
export { MCPToolsPage } from './MCPToolsPage';
export { PublicStatusPage } from './PublicStatusPage';
export { default as SharedTestRunPage } from './SharedTestRunPage'; // Feature #2002
export { OrganizationMembersPage } from './OrganizationMembersPage';
export { AuditLogsPage } from './AuditLogsPage';
export { WebhookConfigurationPage } from './WebhookConfigurationPage';
export { DASTComparisonPage } from './DASTComparisonPage';
export { NpmAuditPage } from './NpmAuditPage';
export { LicenseCompliancePage } from './LicenseCompliancePage';
// Feature #268: SBOM Generation Page
export { SbomPage } from './SbomPage';
export { ContainerScanPage } from './ContainerScanPage';
// Feature #412: KieAIProviderPage content moved to SettingsPage AI tab
// Feature #412: AnthropicProviderPage content moved to SettingsPage AI tab
export { MCPChatPage } from './MCPChatPage';
// Feature #411: AIRunComparisonPage removed - dead demo page
export { MCPAnalyticsPage } from './MCPAnalyticsPage';
export { MCPPlaygroundPage } from './MCPPlaygroundPage';
export { SecurityDashboardPage } from './SecurityDashboardPage';
// Feature #411: OrganizationInsightsPage removed - dead demo page
// Feature #411: BestPracticesPage removed - dead demo page
export { TestImprovementAnalyzerPage } from './TestImprovementAnalyzerPage';
// Feature #411: IndustryBenchmarkPage removed - dead demo page
// Feature #884: ReleaseNotesPage removed - not core QA functionality
// Feature #411: PersonalizedInsightsPage removed - dead demo page
// Feature #411: TeamSkillGapsPage removed - dead demo page
// Feature #411: AILearningPage removed - dead demo page
// Feature #885: TestDocumentationPage removed - niche feature
export { ProviderHealthPage } from './ProviderHealthPage';
// Feature #412: AICostTrackingPage merged into AIAnalyticsPage
// Feature #412: AIUsageAnalyticsDashboard merged into AIAnalyticsPage
export { AIAnalyticsPage } from './AIAnalyticsPage';
// Feature #411: AIThinkingDemoPage removed - dead demo page
// Feature #411: AIConfidenceDemoPage removed - dead demo page
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
// Feature #866: AIAgentWorkspacePage removed (duplicates MCP Chat)
export { ReportPage } from './ReportPage'; // Feature #1732
export { SettingsPage } from './SettingsPage'; // Feature #1832: Unified Settings page
export { SuiteRunHistoryPage } from './SuiteRunHistoryPage'; // Feature #1851: Suite run history
export { ProjectRunHistoryPage } from './ProjectRunHistoryPage'; // Feature #1852: Project run history
export { RunHistoryPage } from './RunHistoryPage'; // Feature #1855: Global run history
export { ServicesPage } from './ServicesPage'; // Feature #2128: Platform Services Dashboard
export { WebhookIntegrationGuidesPage } from './WebhookIntegrationGuidesPage'; // Feature #323: Integration guides
// Feature #886: OpenAPITestGeneratorPage removed - very niche feature

// All major pages have been extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules - COMPLETE
//
// Note: Extracted pages that exceed 400 lines need further splitting:
// - TestDetailPage: 10,003 lines - needs componentization
// - TestSuitePage: 7,604 lines - needs componentization
// - SchedulesPage: 828 lines
// - ScheduleDetailsPage: 675 lines
// - WebhookConfigurationPage: 723 lines
