// QA Guardian Frontend
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import { RouteErrorBoundary, PageErrorBoundary } from './components/ErrorBoundary';
import { MCPHub, MCPHubIndex } from './components/MCPHub';
import { useToastStore } from './stores/toastStore';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// Feature #619: Lazy-load large widgets that aren't needed on initial page load
// QAChatWidget (709 lines) loads when user interacts with chat
// AICommandPalette (873 lines) loads when user presses Ctrl+K
const QAChatWidget = lazy(() => import('./components/QAChatWidget'));
const AICommandPalette = lazy(() => import('./components/AICommandPalette'));

// Eager imports: most-visited pages loaded in the main bundle
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';

// Lazy imports: all other pages loaded on-demand via code splitting
// Feature #620: ForgotPasswordPage and ResetPasswordPage lazy-loaded (rarely-used auth recovery flows)
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const CreateOrganizationPage = lazy(() => import('./pages/CreateOrganizationPage').then(m => ({ default: m.CreateOrganizationPage })));
const AcceptInvitationPage = lazy(() => import('./pages/AcceptInvitationPage').then(m => ({ default: m.AcceptInvitationPage })));
const SchedulesPage = lazy(() => import('./pages/SchedulesPage').then(m => ({ default: m.SchedulesPage })));
const ScheduleDetailsPage = lazy(() => import('./pages/ScheduleDetailsPage').then(m => ({ default: m.ScheduleDetailsPage })));
const MCPToolsPage = lazy(() => import('./pages/MCPToolsPage').then(m => ({ default: m.MCPToolsPage })));
const PublicStatusPage = lazy(() => import('./pages/PublicStatusPage').then(m => ({ default: m.PublicStatusPage })));
const SharedTestRunPage = lazy(() => import('./pages/SharedTestRunPage'));
const WebhookIntegrationGuidesPage = lazy(() => import('./pages/WebhookIntegrationGuidesPage').then(m => ({ default: m.WebhookIntegrationGuidesPage })));
const DASTComparisonPage = lazy(() => import('./pages/DASTComparisonPage').then(m => ({ default: m.DASTComparisonPage })));
const DASTGraphQLPage = lazy(() => import('./pages/DASTGraphQLPage').then(m => ({ default: m.DASTGraphQLPage })));
const TrivyDependencyScanPage = lazy(() => import('./pages/TrivyDependencyScanPage').then(m => ({ default: m.TrivyDependencyScanPage })));
const NpmAuditPage = lazy(() => import('./pages/NpmAuditPage').then(m => ({ default: m.NpmAuditPage })));
const CVEDatabasePage = lazy(() => import('./pages/CVEDatabasePage').then(m => ({ default: m.CVEDatabasePage })));
const LicenseCompliancePage = lazy(() => import('./pages/LicenseCompliancePage').then(m => ({ default: m.LicenseCompliancePage })));
const SbomPage = lazy(() => import('./pages/SbomPage').then(m => ({ default: m.SbomPage })));
const ContainerScanPage = lazy(() => import('./pages/ContainerScanPage').then(m => ({ default: m.ContainerScanPage })));
const UpgradeRecommendationsPage = lazy(() => import('./pages/UpgradeRecommendationsPage').then(m => ({ default: m.UpgradeRecommendationsPage })));
const DependencyTreePage = lazy(() => import('./pages/DependencyTreePage').then(m => ({ default: m.DependencyTreePage })));
const DependencyPolicyPage = lazy(() => import('./pages/DependencyPolicyPage').then(m => ({ default: m.DependencyPolicyPage })));
const AutoPRPage = lazy(() => import('./pages/AutoPRPage').then(m => ({ default: m.AutoPRPage })));
const DependencyAgePage = lazy(() => import('./pages/DependencyAgePage').then(m => ({ default: m.DependencyAgePage })));
const MultiLanguageDependencyPage = lazy(() => import('./pages/MultiLanguageDependencyPage').then(m => ({ default: m.MultiLanguageDependencyPage })));
const VulnerabilityHistoryPage = lazy(() => import('./pages/VulnerabilityHistoryPage').then(m => ({ default: m.VulnerabilityHistoryPage })));
const ExploitabilityAnalysisPage = lazy(() => import('./pages/ExploitabilityAnalysisPage').then(m => ({ default: m.ExploitabilityAnalysisPage })));
const ScanCachingPage = lazy(() => import('./pages/ScanCachingPage').then(m => ({ default: m.ScanCachingPage })));
const DependencyAlertsPage = lazy(() => import('./pages/DependencyAlertsPage').then(m => ({ default: m.DependencyAlertsPage })));
const MCPChatPage = lazy(() => import('./pages/MCPChatPage').then(m => ({ default: m.MCPChatPage })));
const MCPAnalyticsPage = lazy(() => import('./pages/MCPAnalyticsPage').then(m => ({ default: m.MCPAnalyticsPage })));
const MCPPlaygroundPage = lazy(() => import('./pages/MCPPlaygroundPage').then(m => ({ default: m.MCPPlaygroundPage })));
const SecurityDashboardPage = lazy(() => import('./pages/SecurityDashboardPage').then(m => ({ default: m.SecurityDashboardPage })));
const TestImprovementAnalyzerPage = lazy(() => import('./pages/TestImprovementAnalyzerPage').then(m => ({ default: m.TestImprovementAnalyzerPage })));
const ReleaseNotesPage = lazy(() => import('./pages/ReleaseNotesPage').then(m => ({ default: m.ReleaseNotesPage })));
const TestDocumentationPage = lazy(() => import('./pages/TestDocumentationPage').then(m => ({ default: m.TestDocumentationPage })));
const ProviderHealthPage = lazy(() => import('./pages/ProviderHealthPage').then(m => ({ default: m.ProviderHealthPage })));
const AIAnalyticsPage = lazy(() => import('./pages/AIAnalyticsPage').then(m => ({ default: m.AIAnalyticsPage })));
const FlakyTestsDashboardPage = lazy(() => import('./pages/FlakyTestsDashboardPage').then(m => ({ default: m.FlakyTestsDashboardPage })));
const VisualReviewPage = lazy(() => import('./pages/VisualReviewPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage').then(m => ({ default: m.MonitoringPage })));
const AIRouterPage = lazy(() => import('./pages/AIRouterPage').then(m => ({ default: m.AIRouterPage })));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const TestSuitePage = lazy(() => import('./pages/TestSuitePage').then(m => ({ default: m.TestSuitePage })));
const TestDetailPage = lazy(() => import('./pages/TestDetailPage').then(m => ({ default: m.TestDetailPage })));
const TestRunResultPage = lazy(() => import('./pages/TestRunResultPage'));
const AITestGeneratorPage = lazy(() => import('./pages/AITestGeneratorPage').then(m => ({ default: m.AITestGeneratorPage })));
const AITestReviewPage = lazy(() => import('./pages/AITestReviewPage').then(m => ({ default: m.AITestReviewPage })));
const AIAgentWorkspacePage = lazy(() => import('./pages/AIAgentWorkspacePage').then(m => ({ default: m.AIAgentWorkspacePage })));
const ReportPage = lazy(() => import('./pages/ReportPage').then(m => ({ default: m.ReportPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const SuiteRunHistoryPage = lazy(() => import('./pages/SuiteRunHistoryPage').then(m => ({ default: m.SuiteRunHistoryPage })));
const ProjectRunHistoryPage = lazy(() => import('./pages/ProjectRunHistoryPage').then(m => ({ default: m.ProjectRunHistoryPage })));
const RunHistoryPage = lazy(() => import('./pages/RunHistoryPage').then(m => ({ default: m.RunHistoryPage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })));
const OpenAPITestGeneratorPage = lazy(() => import('./pages/OpenAPITestGeneratorPage').then(m => ({ default: m.OpenAPITestGeneratorPage })));
const QuickTestPage = lazy(() => import('./pages/QuickTestPage').then(m => ({ default: m.QuickTestPage })));
const CompareQuickTestPage = lazy(() => import('./pages/CompareQuickTestPage').then(m => ({ default: m.CompareQuickTestPage })));

import { PageSkeleton } from './components/ui/Skeleton';
const PageLoader = () => <PageSkeleton />;

function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2"
      role="status"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-in slide-in-from-bottom-5 duration-300 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg flex items-center gap-2 ${
            t.type === 'success' ? 'bg-success' :
            t.type === 'error' ? 'bg-destructive' :
            t.type === 'warning' ? 'bg-warning' :
            'bg-primary'
          }`}
        >
          {/* Icon based on type */}
          {t.type === 'success' && (
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          )}
          {t.type === 'error' && (
            <XCircle aria-hidden="true" className="h-5 w-5" />
          )}
          {t.type === 'warning' && (
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          )}
          {t.type === 'info' && (
            <Info aria-hidden="true" className="h-5 w-5" />
          )}
          <span>{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-2 rounded-full p-0.5 hover:bg-white/20"
            aria-label="Dismiss notification"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ToastContainer />
      {/* Feature #619: Lazy-loaded widgets with Suspense - no fallback needed since they're hidden by default */}
      <Suspense fallback={null}>
        <QAChatWidget />
      </Suspense>
      <Suspense fallback={null}>
        <AICommandPalette />
      </Suspense>
      <RouteErrorBoundary>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/organizations/new" element={<CreateOrganizationPage />} />
        <Route path="/invitations/:inviteId" element={<AcceptInvitationPage />} />
        <Route path="/status/:slug" element={<PublicStatusPage />} />
        <Route path="/shared/run/:token" element={<SharedTestRunPage />} />

        {/* Protected routes - require authentication */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <DashboardPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quick-test"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <QuickTestPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quick-test/compare"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <CompareQuickTestPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <ProjectsPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <ProjectDetailPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/runs"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <ProjectRunHistoryPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/run-history"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <RunHistoryPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suites/:suiteId"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <TestSuitePage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suites/:suiteId/runs"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <SuiteRunHistoryPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tests/:testId"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <TestDetailPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/runs/:runId"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <TestRunResultPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedules"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <SchedulesPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedules/:scheduleId"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <ScheduleDetailsPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <AnalyticsPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/visual-review"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <VisualReviewPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Security routes */}
        <Route
          path="/security"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <SecurityDashboardPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dast-compare"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <DASTComparisonPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dast-graphql"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <DASTGraphQLPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/trivy"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <TrivyDependencyScanPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/npm-audit"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <NpmAuditPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/cve-database"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <CVEDatabasePage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/licenses"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <LicenseCompliancePage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/sbom"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <SbomPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/containers"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <ContainerScanPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/upgrade-recommendations"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <UpgradeRecommendationsPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dependency-tree"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <DependencyTreePage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dependency-alerts"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <DependencyAlertsPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dependency-policies"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <DependencyPolicyPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/auto-pr"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <AutoPRPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dependency-age"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <DependencyAgePage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/multi-language"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <MultiLanguageDependencyPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/vulnerability-history"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <VulnerabilityHistoryPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/exploitability"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <ExploitabilityAnalysisPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/scan-cache"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <ScanCachingPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* AI routes */}
        <Route path="/ai/kie-provider" element={<Navigate to="/settings?tab=ai-config" replace />} />
        <Route path="/ai/anthropic-provider" element={<Navigate to="/settings?tab=ai-config" replace />} />
        <Route
          path="/ai/router"
          element={
            <RoleProtectedRoute allowedRoles={['owner', 'admin']}>
              <PageErrorBoundary>
                <AIRouterPage />
              </PageErrorBoundary>
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/ai/health"
          element={
            <RoleProtectedRoute allowedRoles={['owner', 'admin']}>
              <PageErrorBoundary>
                <ProviderHealthPage />
              </PageErrorBoundary>
            </RoleProtectedRoute>
          }
        />
        <Route path="/ai/costs" element={<Navigate to="/ai/analytics" replace />} />
        <Route
          path="/ai/analytics"
          element={
            <RoleProtectedRoute allowedRoles={['owner', 'admin']}>
              <PageErrorBoundary>
                <AIAnalyticsPage />
              </PageErrorBoundary>
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/ai/test-generator"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <AITestGeneratorPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai/test-review"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <AITestReviewPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai/openapi-generator"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <OpenAPITestGeneratorPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <MonitoringPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* AI Insights redirects */}
        <Route path="/ai-insights" element={<Navigate to="/ai/flaky-tests" replace />} />
        <Route path="/ai-insights/flaky-tests" element={<Navigate to="/ai/flaky-tests" replace />} />
        <Route path="/ai-insights/test-analyzer" element={<Navigate to="/ai/test-analyzer" replace />} />
        <Route path="/ai-insights/test-documentation" element={<Navigate to="/ai/test-documentation" replace />} />
        <Route path="/ai-insights/release-notes" element={<Navigate to="/ai/release-notes" replace />} />
        <Route
          path="/ai/flaky-tests"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <FlakyTestsDashboardPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai/test-analyzer"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <TestImprovementAnalyzerPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai/test-documentation"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <TestDocumentationPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai/release-notes"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <ReleaseNotesPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Settings */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <SettingsPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Legacy admin routes - redirect to unified Settings page */}
        <Route path="/organization/settings" element={<Navigate to="/settings?tab=general" replace />} />
        <Route path="/organization/members" element={<Navigate to="/settings?tab=team" replace />} />
        <Route path="/organization/billing" element={<Navigate to="/settings?tab=billing" replace />} />
        <Route path="/organization/api-keys" element={<Navigate to="/settings?tab=api-keys" replace />} />
        <Route path="/organization/webhooks" element={<Navigate to="/settings?tab=webhooks" replace />} />
        <Route path="/webhooks/integration-guides" element={<ProtectedRoute><PageErrorBoundary><WebhookIntegrationGuidesPage /></PageErrorBoundary></ProtectedRoute>} />
        <Route path="/organization/audit-logs" element={<Navigate to="/settings?tab=audit-logs" replace />} />

        {/* MCP Hub */}
        <Route
          path="/mcp"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <MCPHub />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route index element={<MCPHubIndex />} />
          <Route path="tools" element={<MCPToolsPage />} />
          <Route path="playground" element={<MCPPlaygroundPage />} />
          <Route path="chat" element={<MCPChatPage />} />
          <Route path="agent-workspace" element={<AIAgentWorkspacePage />} />
          <Route path="analytics" element={<MCPAnalyticsPage />} />
          <Route path="production-risk" element={<Navigate to="/mcp/tools" replace />} />
          <Route path="tech-debt" element={<Navigate to="/mcp/tools" replace />} />
          <Route path="test-discovery" element={<Navigate to="/mcp/tools" replace />} />
          <Route path="documentation" element={<Navigate to="/mcp/tools" replace />} />
          <Route path="release-notes" element={<Navigate to="/mcp/tools" replace />} />
          <Route path="schedule" element={<Navigate to="/mcp/tools" replace />} />
          <Route path="team" element={<Navigate to="/mcp/tools" replace />} />
        </Route>

        {/* Legacy MCP routes - redirect to new hub paths */}
        <Route path="/organization/mcp-tools" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/organization/mcp-playground" element={<Navigate to="/mcp/playground" replace />} />
        <Route path="/organization/mcp-analytics" element={<Navigate to="/mcp/analytics" replace />} />
        <Route path="/organization/mcp-chat" element={<Navigate to="/mcp/chat" replace />} />
        <Route path="/organization/mcp-production-risk" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/organization/mcp-tech-debt" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/organization/mcp-test-discovery" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/organization/mcp-documentation" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/organization/mcp-release-notes" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/mcp/documentation" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/mcp/release-notes" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/organization/mcp-schedule-optimizer" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/organization/mcp-team-insights" element={<Navigate to="/mcp/tools" replace />} />

        {/* Reports */}
        <Route
          path="/reports/:reportId"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <ReportPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Platform Services */}
        <Route
          path="/services"
          element={
            <ProtectedRoute>
              <PageErrorBoundary>
                <ServicesPage />
              </PageErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      </RouteErrorBoundary>
    </div>
  );
}

export default App;
