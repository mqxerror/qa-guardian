// QA Guardian Frontend - Updated for DAST
import { Routes, Route, Link, useNavigate, useLocation, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import { Navigation } from './components/Navigation';
import { Layout } from './components/Layout';
import { RouteErrorBoundary, ErrorFallback } from './components/ErrorBoundary';
// Feature #412: AIInsightsHub deleted - child pages promoted to /ai/* routes
import { MCPHub, MCPHubIndex } from './components/MCPHub';
import { QAChatWidget } from './components/QAChatWidget';
import { useAuthStore } from './stores/authStore';
import { useThemeStore, Theme } from './stores/themeStore';
import { useNotificationStore } from './stores/notificationStore';
import { useTimezoneStore } from './stores/timezoneStore';
import { useTestDefaultsStore } from './stores/testDefaultsStore';
import { useArtifactRetentionStore } from './stores/artifactRetentionStore';
import { useToastStore, toast } from './stores/toastStore';
import { useSocketStore } from './stores/socketStore';
import { useVisualReviewStore } from './stores/visualReviewStore';
import { useSidebarStore } from './stores/sidebarStore';
import { getErrorMessage, isNetworkError, isOffline } from './utils/errorHandling';
// Feature #105: Removed dead imports (recharts, jsPDF) - these are lazy-loaded in extracted pages
// Feature #1357: Extracted pages for code quality compliance (400 line limit)
// Eager imports: most-visited pages loaded in the main bundle
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

// Lazy imports: all other pages loaded on-demand via code splitting
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const CreateOrganizationPage = lazy(() => import('./pages/CreateOrganizationPage').then(m => ({ default: m.CreateOrganizationPage })));
const AcceptInvitationPage = lazy(() => import('./pages/AcceptInvitationPage').then(m => ({ default: m.AcceptInvitationPage })));
const SchedulesPage = lazy(() => import('./pages/SchedulesPage').then(m => ({ default: m.SchedulesPage })));
const ScheduleDetailsPage = lazy(() => import('./pages/ScheduleDetailsPage').then(m => ({ default: m.ScheduleDetailsPage })));
// Feature #411: AIActionPage removed - dead demo page with mock data
const BillingPage = lazy(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })));
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage').then(m => ({ default: m.ApiKeysPage })));
const MCPToolsPage = lazy(() => import('./pages/MCPToolsPage').then(m => ({ default: m.MCPToolsPage })));
const PublicStatusPage = lazy(() => import('./pages/PublicStatusPage').then(m => ({ default: m.PublicStatusPage })));
const SharedTestRunPage = lazy(() => import('./pages/SharedTestRunPage'));
const OrganizationMembersPage = lazy(() => import('./pages/OrganizationMembersPage').then(m => ({ default: m.OrganizationMembersPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const WebhookConfigurationPage = lazy(() => import('./pages/WebhookConfigurationPage').then(m => ({ default: m.WebhookConfigurationPage })));
const WebhookIntegrationGuidesPage = lazy(() => import('./pages/WebhookIntegrationGuidesPage').then(m => ({ default: m.WebhookIntegrationGuidesPage }))); // Feature #323
const DASTComparisonPage = lazy(() => import('./pages/DASTComparisonPage').then(m => ({ default: m.DASTComparisonPage })));
const DASTGraphQLPage = lazy(() => import('./pages/DASTGraphQLPage').then(m => ({ default: m.DASTGraphQLPage })));
const TrivyDependencyScanPage = lazy(() => import('./pages/TrivyDependencyScanPage').then(m => ({ default: m.TrivyDependencyScanPage })));
const NpmAuditPage = lazy(() => import('./pages/NpmAuditPage').then(m => ({ default: m.NpmAuditPage })));
const CVEDatabasePage = lazy(() => import('./pages/CVEDatabasePage').then(m => ({ default: m.CVEDatabasePage })));
const LicenseCompliancePage = lazy(() => import('./pages/LicenseCompliancePage').then(m => ({ default: m.LicenseCompliancePage })));
// Feature #268: SBOM Generation Page
const SbomPage = lazy(() => import('./pages/SbomPage').then(m => ({ default: m.SbomPage })));
const ContainerScanPage = lazy(() => import('./pages/ContainerScanPage').then(m => ({ default: m.ContainerScanPage })));
// Feature #270: Upgrade Recommendations Page
const UpgradeRecommendationsPage = lazy(() => import('./pages/UpgradeRecommendationsPage').then(m => ({ default: m.UpgradeRecommendationsPage })));
// Feature #271: Dependency Tree Visualization
const DependencyTreePage = lazy(() => import('./pages/DependencyTreePage').then(m => ({ default: m.DependencyTreePage })));
const DependencyPolicyPage = lazy(() => import('./pages/DependencyPolicyPage').then(m => ({ default: m.DependencyPolicyPage })));
const AutoPRPage = lazy(() => import('./pages/AutoPRPage').then(m => ({ default: m.AutoPRPage })));
const DependencyAgePage = lazy(() => import('./pages/DependencyAgePage').then(m => ({ default: m.DependencyAgePage })));
const MultiLanguageDependencyPage = lazy(() => import('./pages/MultiLanguageDependencyPage').then(m => ({ default: m.MultiLanguageDependencyPage })));
const VulnerabilityHistoryPage = lazy(() => import('./pages/VulnerabilityHistoryPage').then(m => ({ default: m.VulnerabilityHistoryPage })));
const ExploitabilityAnalysisPage = lazy(() => import('./pages/ExploitabilityAnalysisPage').then(m => ({ default: m.ExploitabilityAnalysisPage })));
const ScanCachingPage = lazy(() => import('./pages/ScanCachingPage').then(m => ({ default: m.ScanCachingPage })));
// Feature #412: KieAIProviderPage content moved to SettingsPage AI tab
// Feature #412: AnthropicProviderPage content moved to SettingsPage AI tab
const DependencyAlertsPage = lazy(() => import('./pages/DependencyAlertsPage').then(m => ({ default: m.DependencyAlertsPage })));
const MCPChatPage = lazy(() => import('./pages/MCPChatPage').then(m => ({ default: m.MCPChatPage })));
// Feature #411: AIRunComparisonPage removed - dead demo page with mock data
const MCPAnalyticsPage = lazy(() => import('./pages/MCPAnalyticsPage').then(m => ({ default: m.MCPAnalyticsPage })));
const MCPPlaygroundPage = lazy(() => import('./pages/MCPPlaygroundPage').then(m => ({ default: m.MCPPlaygroundPage })));
const SecurityDashboardPage = lazy(() => import('./pages/SecurityDashboardPage').then(m => ({ default: m.SecurityDashboardPage })));
// Feature #411: OrganizationInsightsPage removed - dead demo page with mock data
// Feature #411: BestPracticesPage removed - dead demo page with mock data
const TestImprovementAnalyzerPage = lazy(() => import('./pages/TestImprovementAnalyzerPage').then(m => ({ default: m.TestImprovementAnalyzerPage })));
// Feature #411: IndustryBenchmarkPage removed - dead demo page with mock data
const ReleaseNotesPage = lazy(() => import('./pages/ReleaseNotesPage').then(m => ({ default: m.ReleaseNotesPage })));
// Feature #411: PersonalizedInsightsPage removed - dead demo page with mock data
// Feature #411: TeamSkillGapsPage removed - dead demo page with mock data
// Feature #411: AILearningPage removed - dead demo page with mock data
const TestDocumentationPage = lazy(() => import('./pages/TestDocumentationPage').then(m => ({ default: m.TestDocumentationPage })));
const ProviderHealthPage = lazy(() => import('./pages/ProviderHealthPage').then(m => ({ default: m.ProviderHealthPage })));
// Feature #412: AICostTrackingPage merged into AIAnalyticsPage
// Feature #412: AIUsageAnalyticsDashboard merged into AIAnalyticsPage
const AIAnalyticsPage = lazy(() => import('./pages/AIAnalyticsPage').then(m => ({ default: m.AIAnalyticsPage })));
// Feature #411: AIThinkingDemoPage removed - dead demo page with mock data
// Feature #411: AIConfidenceDemoPage removed - dead demo page with mock data
const FlakyTestsDashboardPage = lazy(() => import('./pages/FlakyTestsDashboardPage').then(m => ({ default: m.FlakyTestsDashboardPage })));
const VisualReviewPage = lazy(() => import('./pages/VisualReviewPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage').then(m => ({ default: m.MonitoringPage })));
const AIRouterPage = lazy(() => import('./pages/AIRouterPage').then(m => ({ default: m.AIRouterPage })));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const OrganizationSettingsPage = lazy(() => import('./pages/OrganizationSettingsPage'));
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
const OpenAPITestGeneratorPage = lazy(() => import('./pages/OpenAPITestGeneratorPage').then(m => ({ default: m.OpenAPITestGeneratorPage }))); // Feature #324

// Loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Feature #756: DASTComparisonPage extracted to ./pages/DASTComparisonPage.tsx
// Feature #758: DASTGraphQLPage extracted to ./pages/DASTGraphQLPage.tsx

// DASTGraphQLPage removed (~520 lines) - now imported from ./pages/DASTGraphQLPage.tsx
// TrivyDependencyScanPage removed (~1060 lines) - now imported from ./pages/TrivyDependencyScanPage.tsx

// Feature #759-767: TrivyDependencyScanPage extracted to ./pages/TrivyDependencyScanPage.tsx


// Feature #761: NpmAuditPage extracted to ./pages/NpmAuditPage.tsx (~618 lines)


// Feature #762: CVEDatabasePage extracted to ./pages/CVEDatabasePage.tsx (~620 lines)


// Feature #763: LicenseCompliancePage extracted to ./pages/LicenseCompliancePage.tsx (~760 lines)


// Feature #764: ContainerScanPage extracted to ./pages/ContainerScanPage.tsx (~580 lines)

// Feature #770: DependencyPolicyPage extracted to ./pages/DependencyPolicyPage.tsx (~695 lines)

// Feature #771: AutoPRPage extracted to ./pages/AutoPRPage.tsx (~545 lines)

// Feature #772: DependencyAgePage extracted to ./pages/DependencyAgePage.tsx (~438 lines)

// Feature #773: MultiLanguageDependencyPage extracted to ./pages/MultiLanguageDependencyPage.tsx (~480 lines)

// Feature #774: VulnerabilityHistoryPage extracted to ./pages/VulnerabilityHistoryPage.tsx (~437 lines)

// Feature #775: ExploitabilityAnalysisPage extracted to ./pages/ExploitabilityAnalysisPage.tsx (~418 lines)

// Feature #776: ScanCachingPage extracted to ./pages/ScanCachingPage.tsx (~438 lines)

// Feature #1321: KieAIProviderPage extracted to ./pages/KieAIProviderPage.tsx (~455 lines)

// Feature #1322: AnthropicProviderPage extracted to ./pages/AnthropicProviderPage.tsx (~420 lines)


// AIRouterPage EXTRACTED to ./pages/AIRouterPage.tsx (~6,684 lines)
// Feature #1441: Split App.tsx into logical modules
// Types moved: AIRouterConfig, RetryAttempt, RetryStats, AIFeatureType, FeatureTimeout,
// AIModelType, FeatureModelConfig, ModelUsageStats, TimeoutEvent, TimeoutStats,
// RateLimitStrategy, ProviderRateLimitConfig, ProviderRateLimitStatus, QueuedRequest,
// RateLimitEvent, RateLimitAlert, FallbackTrigger, FallbackRule, FallbackTestResult,
// FallbackStats, AIBudgetConfig, AISpendingData, BudgetAlert, CostAlertThreshold,
// AlertNotificationConfig, CostAlertNotification, CostReductionSuggestion, AICacheConfig,
// CacheEntry, CacheStats, CacheEvent, RouterStats, CircuitBreakerState, ProviderSwitchLog,
// ActiveProviderState, ProviderChangeLog, ProviderSwitchResult, APIKeyConfig,
// APIKeyAuditLog, KeyTestResult


// Feature #1326: AIUsageAnalyticsDashboard extracted to ./pages/AIUsageAnalyticsDashboard.tsx (~518 lines)


// Feature #767: DependencyAlertsPage extracted to ./pages/DependencyAlertsPage.tsx (~550 lines)

// Feature #1282: AI Action with Pre-filled Parameters
// AIActionPage extracted to ./pages/AIActionPage.tsx (Feature #1357)
// Interface AIActionParams moved to AIActionPage.tsx


// Feature #1421: AISuggestionsSidebar removed - dead code cleanup
// The component and interfaces (AISuggestion, PageContext, AISuggestionsSidebar) were removed
// as the feature was disabled in Feature #1420


// Feature #1280: AIThinkingDemoPage, AIThinkingIndicator, AIThinkingSpinner extracted to ./pages/AIThinkingDemoPage.tsx (~352 lines)



// Feature #1279: AIConfidenceDemoPage, AIConfidenceIndicator, AIConfidenceBadge, AIConfidenceCard extracted to ./pages/AIConfidenceDemoPage.tsx (~406 lines)


// Feature #1278: AI Insights Command Palette
interface CommandPaletteAction {
  id: string;
  icon: string;
  label: string;
  description: string;
  category: 'ai-insights' | 'navigation' | 'actions' | 'recent';
  shortcut?: string;
  action: () => void;
}

interface AICommandResult {
  type: 'explanation' | 'analysis' | 'suggestion' | 'action';
  title: string;
  content: string;
  details?: string[];
  confidence?: number;
}

function AICommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  // Feature #1418: Get auth state to hide palette for logged-out users
  const { token } = useAuthStore();
  // Feature #1509: Get sidebar store to expand sections
  const { expandSection } = useSidebarStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<AICommandResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Feature #1506: Recent searches history
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('qa-guardian-recent-searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Feature #1506: Save a search to recent history
  const saveRecentSearch = (searchQuery: string) => {
    // Don't store empty or very short queries (less than 3 characters)
    if (!searchQuery || searchQuery.trim().length < 3) return;

    const trimmed = searchQuery.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5); // Keep last 5 unique searches
      try {
        localStorage.setItem('qa-guardian-recent-searches', JSON.stringify(updated));
      } catch { /* storage unavailable */ }
      return updated;
    });
  };

  // Feature #1506: Clear search history
  const clearSearchHistory = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('qa-guardian-recent-searches');
    } catch { /* storage unavailable */ }
  };

  // AI Commands
  const aiCommands: CommandPaletteAction[] = [
    {
      id: 'explain-failure',
      icon: '🔍',
      label: 'Explain this failure',
      description: 'Get AI analysis of why the current test failed',
      category: 'ai-insights',
      action: async () => {
        setIsProcessing(true);
        await new Promise(r => setTimeout(r, 1500));
        setAiResult({
          type: 'explanation',
          title: 'Failure Explanation',
          content: 'The test failed because the expected element ".checkout-button" was not found within the timeout period. This appears to be a selector mismatch caused by a recent UI refactor.',
          details: [
            'Selector ".checkout-button" not found in DOM',
            'Similar element ".btn-checkout" exists on page',
            'Last successful run: 2 hours ago',
            'Git commit abc123 changed button classes'
          ],
          confidence: 92
        });
        setIsProcessing(false);
      }
    },
    {
      id: 'suggest-fix',
      icon: '💡',
      label: 'Suggest a fix',
      description: 'Get AI-suggested fix for the current issue',
      category: 'ai-insights',
      action: async () => {
        setIsProcessing(true);
        await new Promise(r => setTimeout(r, 1200));
        setAiResult({
          type: 'suggestion',
          title: 'Suggested Fix',
          content: 'Update the selector from ".checkout-button" to ".btn-checkout" or use a more stable selector like [data-testid="checkout-btn"].',
          details: [
            'Option 1: Change selector to ".btn-checkout"',
            'Option 2: Use data-testid attribute (recommended)',
            'Option 3: Use text-based selector: text="Checkout"'
          ],
          confidence: 88
        });
        setIsProcessing(false);
      }
    },
    {
      id: 'analyze-flaky',
      icon: '📊',
      label: 'Analyze flaky tests',
      description: 'Get AI analysis of test flakiness patterns',
      category: 'ai-insights',
      action: async () => {
        setIsProcessing(true);
        await new Promise(r => setTimeout(r, 1800));
        setAiResult({
          type: 'analysis',
          title: 'Flaky Test Analysis',
          content: 'Found 3 tests with flaky behavior in the past 7 days. Primary causes: timing issues (60%), race conditions (25%), and environment variance (15%).',
          details: [
            'checkout.spec.ts - 40% failure rate - timing issue',
            'auth.spec.ts - 25% failure rate - race condition',
            'dashboard.spec.ts - 15% failure rate - env variance'
          ],
          confidence: 85
        });
        setIsProcessing(false);
      }
    },
    {
      id: 'generate-test',
      icon: '✨',
      label: 'Generate test for current page',
      description: 'AI generates a test based on the current application state',
      category: 'ai-insights',
      action: async () => {
        setIsProcessing(true);
        await new Promise(r => setTimeout(r, 2500));
        setAiResult({
          type: 'action',
          title: 'Generated Test',
          content: 'Generated comprehensive test for the Dashboard page including navigation, data loading, and user interactions.',
          details: [
            '✓ Navigate to /dashboard',
            '✓ Wait for metrics to load',
            '✓ Verify chart renders with data',
            '✓ Click on test run card',
            '✓ Verify detail view opens'
          ],
          confidence: 90
        });
        setIsProcessing(false);
      }
    },
    {
      id: 'root-cause',
      icon: '🎯',
      label: 'Find root cause',
      description: 'Deep AI analysis to find the root cause of failures',
      category: 'ai-insights',
      action: async () => {
        setIsProcessing(true);
        await new Promise(r => setTimeout(r, 2200));
        setAiResult({
          type: 'explanation',
          title: 'Root Cause Analysis',
          content: 'The root cause is a breaking change in the API response format. The backend now returns nested objects instead of flat fields.',
          details: [
            'API response changed from { name: "..." } to { user: { name: "..." } }',
            'Commit: def456 by john@example.com',
            '5 tests affected by this change',
            'Suggested: Update data accessors in test helpers'
          ],
          confidence: 94
        });
        setIsProcessing(false);
      }
    }
  ];

  // Feature #1366: Track recent pages
  const [recentPages, setRecentPages] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('qa-guardian-recent-pages');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Track navigation for recent pages
  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath && currentPath !== '/login' && currentPath !== '/register') {
      setRecentPages(prev => {
        const filtered = prev.filter(p => p !== currentPath);
        const updated = [currentPath, ...filtered].slice(0, 5);
        try {
          localStorage.setItem('qa-guardian-recent-pages', JSON.stringify(updated));
        } catch { /* storage unavailable */ }
        return updated;
      });
    }
  }, [location.pathname]);

  // Feature #1507: Enhanced fuzzy matching with scoring and character highlighting
  interface FuzzyMatchResult {
    matches: boolean;
    score: number;
    matchedIndices: number[];
  }

  // Calculate Levenshtein distance for typo tolerance
  const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };

  // Feature #1507: Enhanced fuzzy matching with scoring
  const fuzzyMatchWithScore = (text: string, query: string): FuzzyMatchResult => {
    if (!query) return { matches: true, score: 0, matchedIndices: [] };

    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase().trim();
    const matchedIndices: number[] = [];
    const score = 0;

    // Exact match (highest priority)
    if (textLower === queryLower) {
      return { matches: true, score: 1000, matchedIndices: Array.from({ length: text.length }, (_, i) => i) };
    }

    // Starts with query (high priority)
    if (textLower.startsWith(queryLower)) {
      for (let i = 0; i < queryLower.length; i++) {
        matchedIndices.push(i);
      }
      return { matches: true, score: 500 + (queryLower.length / textLower.length) * 100, matchedIndices };
    }

    // Contains query as substring (medium-high priority)
    const containsIndex = textLower.indexOf(queryLower);
    if (containsIndex !== -1) {
      for (let i = 0; i < queryLower.length; i++) {
        matchedIndices.push(containsIndex + i);
      }
      // Penalize if not at word boundary
      const atWordBoundary = containsIndex === 0 || /\s/.test(text[containsIndex - 1]);
      return { matches: true, score: atWordBoundary ? 400 : 300, matchedIndices };
    }

    // Word-by-word matching (medium priority)
    const searchTerms = queryLower.split(/\s+/).filter(Boolean);
    if (searchTerms.length > 1) {
      const allTermsMatch = searchTerms.every(term => textLower.includes(term));
      if (allTermsMatch) {
        searchTerms.forEach(term => {
          const idx = textLower.indexOf(term);
          if (idx !== -1) {
            for (let i = 0; i < term.length; i++) {
              if (!matchedIndices.includes(idx + i)) {
                matchedIndices.push(idx + i);
              }
            }
          }
        });
        matchedIndices.sort((a, b) => a - b);
        return { matches: true, score: 200 + (matchedIndices.length / textLower.length) * 50, matchedIndices };
      }
    }

    // Fuzzy character matching (lower priority) - characters appear in order
    let queryIdx = 0;
    for (let i = 0; i < textLower.length && queryIdx < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIdx]) {
        matchedIndices.push(i);
        queryIdx++;
      }
    }
    if (queryIdx === queryLower.length) {
      // Calculate score based on match compactness
      const compactness = matchedIndices.length > 1
        ? 1 - (matchedIndices[matchedIndices.length - 1] - matchedIndices[0]) / textLower.length
        : 1;
      return { matches: true, score: 100 + compactness * 50, matchedIndices };
    }

    // Typo tolerance using Levenshtein distance (lowest priority but still matches)
    const words = textLower.split(/\s+/);
    for (const word of words) {
      const distance = levenshteinDistance(queryLower, word);
      const maxAllowedDistance = Math.max(1, Math.floor(queryLower.length / 3));
      if (distance <= maxAllowedDistance) {
        // Find approximate match location
        const wordIndex = textLower.indexOf(word);
        for (let i = 0; i < word.length; i++) {
          matchedIndices.push(wordIndex + i);
        }
        return { matches: true, score: 50 - distance * 10, matchedIndices };
      }
    }

    return { matches: false, score: 0, matchedIndices: [] };
  };

  // Feature #1366: Simple fuzzy matching function (backwards compatible)
  const fuzzyMatch = (text: string, query: string): boolean => {
    return fuzzyMatchWithScore(text, query).matches;
  };

  // Feature #1507: Get combined score for a command
  const getCommandScore = (cmd: CommandPaletteAction, query: string): { score: number; labelIndices: number[]; descIndices: number[] } => {
    const labelResult = fuzzyMatchWithScore(cmd.label, query);
    const descResult = fuzzyMatchWithScore(cmd.description, query);
    // Label matches are weighted higher than description matches
    const score = Math.max(labelResult.score * 1.5, descResult.score);
    return {
      score,
      labelIndices: labelResult.matches ? labelResult.matchedIndices : [],
      descIndices: descResult.matches ? descResult.matchedIndices : []
    };
  };

  // Feature #1509: Jump to sidebar section commands
  const jumpToSectionCommands: CommandPaletteAction[] = [
    {
      id: 'jump-testing',
      icon: '🧪',
      label: 'Jump to Testing',
      description: 'Expand Testing section in sidebar',
      category: 'navigation',
      shortcut: 'G T',
      action: () => {
        expandSection('testing');
        navigate('/projects');
        setIsOpen(false);
        // Scroll sidebar to testing section after a brief delay
        setTimeout(() => {
          document.querySelector('[data-section="testing"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    },
    {
      id: 'jump-security',
      icon: '🛡️',
      label: 'Jump to Security',
      description: 'Expand Security section in sidebar',
      category: 'navigation',
      action: () => {
        expandSection('security');
        navigate('/security');
        setIsOpen(false);
        setTimeout(() => {
          document.querySelector('[data-section="security"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    },
    {
      id: 'jump-ai-mcp',
      icon: '✨',
      label: 'Jump to AI & MCP',
      description: 'Expand AI & MCP section in sidebar',
      category: 'navigation',
      action: () => {
        expandSection('ai-mcp');
        navigate('/ai/flaky-tests');
        setIsOpen(false);
        setTimeout(() => {
          document.querySelector('[data-section="ai-mcp"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    },
  ];

  // Navigation commands - comprehensive list of all routes
  const navigationCommands: CommandPaletteAction[] = [
    // Feature #1509: Jump to section commands at the top
    ...jumpToSectionCommands,
    // Core navigation
    { id: 'nav-dashboard', icon: '📊', label: 'Go to Dashboard', description: 'View main dashboard', category: 'navigation', shortcut: 'G D', action: () => { navigate('/dashboard'); setIsOpen(false); } },
    { id: 'nav-projects', icon: '📁', label: 'Go to Projects', description: 'View all projects', category: 'navigation', shortcut: 'G P', action: () => { navigate('/projects'); setIsOpen(false); } },
    { id: 'nav-schedules', icon: '📅', label: 'Go to Schedules', description: 'Manage test schedules', category: 'navigation', action: () => { navigate('/schedules'); setIsOpen(false); } },
    { id: 'nav-analytics', icon: '📈', label: 'Go to Analytics', description: 'View test analytics', category: 'navigation', shortcut: 'G A', action: () => { navigate('/analytics'); setIsOpen(false); } },
    { id: 'nav-visual-review', icon: '👁️', label: 'Go to Visual Review', description: 'Review visual regression tests', category: 'navigation', action: () => { navigate('/visual-review'); setIsOpen(false); } },
    { id: 'nav-security', icon: '🔒', label: 'Go to Security', description: 'View security scans', category: 'navigation', shortcut: 'G S', action: () => { navigate('/security'); setIsOpen(false); } },
    { id: 'nav-monitoring', icon: '📡', label: 'Go to Monitoring', description: 'Monitor uptime and performance', category: 'navigation', action: () => { navigate('/monitoring'); setIsOpen(false); } },
    // AI Insights
    // Feature #412: Updated AI routes from /ai-insights/* to /ai/*
    { id: 'nav-ai-flaky', icon: '⚡', label: 'Flaky Tests', description: 'Analyze flaky test patterns', category: 'navigation', shortcut: 'G I', action: () => { navigate('/ai/flaky-tests'); setIsOpen(false); } },
    { id: 'nav-ai-analytics', icon: '📊', label: 'AI Analytics', description: 'AI usage and cost analytics', category: 'navigation', action: () => { navigate('/ai/analytics'); setIsOpen(false); } },
    // Organization - Feature #1832: Unified Settings page
    { id: 'nav-settings', icon: '⚙️', label: 'Go to Settings', description: 'Organization settings', category: 'navigation', shortcut: 'G ,', action: () => { navigate('/settings'); setIsOpen(false); } },
    { id: 'nav-team', icon: '👥', label: 'Team Members', description: 'Manage team members', category: 'navigation', action: () => { navigate('/settings?tab=team'); setIsOpen(false); } },
    { id: 'nav-billing', icon: '💳', label: 'Billing & Plans', description: 'Manage billing and subscription', category: 'navigation', action: () => { navigate('/settings?tab=billing'); setIsOpen(false); } },
    { id: 'nav-api-keys', icon: '🔑', label: 'API Keys', description: 'Manage API keys', category: 'navigation', action: () => { navigate('/settings?tab=api-keys'); setIsOpen(false); } },
    { id: 'nav-webhooks', icon: '🔔', label: 'Webhooks', description: 'Configure webhook notifications', category: 'navigation', action: () => { navigate('/settings?tab=webhooks'); setIsOpen(false); } },
    { id: 'nav-audit-logs', icon: '📋', label: 'Audit Logs', description: 'View audit history', category: 'navigation', action: () => { navigate('/settings?tab=audit-logs'); setIsOpen(false); } },
    // MCP Tools
    { id: 'nav-mcp-tools', icon: '🛠️', label: 'MCP Tools', description: 'Browse MCP tool library', category: 'navigation', action: () => { navigate('/organization/mcp-tools'); setIsOpen(false); } },
    { id: 'nav-mcp-playground', icon: '🎮', label: 'MCP Playground', description: 'Test MCP tools interactively', category: 'navigation', action: () => { navigate('/organization/mcp-playground'); setIsOpen(false); } },
    { id: 'nav-mcp-chat', icon: '💬', label: 'MCP Chat', description: 'Chat with AI assistant', category: 'navigation', action: () => { navigate('/organization/mcp-chat'); setIsOpen(false); } },
  ];

  // Recent pages as commands
  const recentCommands: CommandPaletteAction[] = recentPages.slice(0, 3).map((path, idx) => {
    const pageLabels: Record<string, { icon: string; label: string }> = {
      '/dashboard': { icon: '📊', label: 'Dashboard' },
      '/projects': { icon: '📁', label: 'Projects' },
      '/schedules': { icon: '📅', label: 'Schedules' },
      '/analytics': { icon: '📈', label: 'Analytics' },
      '/visual-review': { icon: '👁️', label: 'Visual Review' },
      '/security': { icon: '🔒', label: 'Security' },
      '/monitoring': { icon: '📡', label: 'Monitoring' },
      '/ai/flaky-tests': { icon: '⚡', label: 'Flaky Tests' },
      '/ai/analytics': { icon: '📊', label: 'AI Analytics' },
      '/settings': { icon: '⚙️', label: 'Settings' },
      '/organization/members': { icon: '👥', label: 'Team' },
      '/organization/settings': { icon: '⚙️', label: 'Settings' },
      '/organization/mcp-chat': { icon: '💬', label: 'MCP Chat' },
    };
    const info = pageLabels[path] || { icon: '📄', label: path.split('/').pop() || 'Page' };
    return {
      id: `recent-${idx}`,
      icon: info.icon,
      label: info.label,
      description: `Recently visited • ${path}`,
      category: 'recent' as const,
      action: () => { navigate(path); setIsOpen(false); }
    };
  });

  // Action commands
  const actionCommands: CommandPaletteAction[] = [
    { id: 'action-run-tests', icon: '▶️', label: 'Run all tests', description: 'Trigger a full test run', category: 'actions', action: () => { alert('Test run triggered!'); setIsOpen(false); } },
    { id: 'action-new-project', icon: '➕', label: 'Create new project', description: 'Start a new testing project', category: 'actions', action: () => { navigate('/projects/new'); setIsOpen(false); } },
    { id: 'action-export', icon: '📤', label: 'Export report', description: 'Export test results as PDF', category: 'actions', action: () => { alert('Export started!'); setIsOpen(false); } },
  ];

  // Feature #1366: Include recent pages in commands
  // Feature #398: Memoize allCommands to prevent recreating on every render
  const allCommands = useMemo(() =>
    [...recentCommands, ...aiCommands, ...navigationCommands, ...actionCommands],
    // Note: These arrays are recreated each render but contain stable action functions.
    // We intentionally omit them from deps since the command structure doesn't change
    // unless recentPages changes. This prevents unnecessary re-filtering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recentPages.length]
  );

  // Feature #1507: Use fuzzy matching with scoring and sorting
  const { filteredCommands, matchHighlights } = useMemo(() => {
    if (!query) {
      return { filteredCommands: allCommands, matchHighlights: new Map<string, { labelIndices: number[]; descIndices: number[] }>() };
    }

    const scoredCommands: Array<{ cmd: CommandPaletteAction; score: number; labelIndices: number[]; descIndices: number[] }> = [];
    const newHighlights = new Map<string, { labelIndices: number[]; descIndices: number[] }>();

    for (const cmd of allCommands) {
      const { score, labelIndices, descIndices } = getCommandScore(cmd, query);
      if (score > 0) {
        scoredCommands.push({ cmd, score, labelIndices, descIndices });
        newHighlights.set(cmd.id, { labelIndices, descIndices });
      }
    }

    // Sort by score descending (highest relevance first)
    scoredCommands.sort((a, b) => b.score - a.score);

    return { filteredCommands: scoredCommands.map(sc => sc.cmd), matchHighlights: newHighlights };
  }, [query, allCommands]);

  // Feature #1507: Helper to render text with highlighted matches
  const renderHighlightedText = (text: string, indices: number[], className: string = 'bg-primary/20 text-primary font-semibold') => {
    if (!indices || indices.length === 0) return text;

    const indicesSet = new Set(indices);
    const result: React.ReactNode[] = [];
    let currentChunk = '';
    let isHighlighted = false;

    for (let i = 0; i < text.length; i++) {
      const shouldHighlight = indicesSet.has(i);
      if (shouldHighlight !== isHighlighted) {
        if (currentChunk) {
          result.push(
            isHighlighted
              ? <span key={`h-${i}`} className={className}>{currentChunk}</span>
              : currentChunk
          );
        }
        currentChunk = text[i];
        isHighlighted = shouldHighlight;
      } else {
        currentChunk += text[i];
      }
    }
    if (currentChunk) {
      result.push(
        isHighlighted
          ? <span key="h-end" className={className}>{currentChunk}</span>
          : currentChunk
      );
    }

    return <>{result}</>;
  };

  // Feature #1506: Execute command and save search history
  const executeCommand = (cmd: CommandPaletteAction) => {
    if (query) {
      saveRecentSearch(query);
    }
    cmd.action();
  };

  // Feature #1506: Re-run a recent search
  const rerunSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    setSelectedIndex(0);
  };

  // Keyboard event handler
  // Feature #1418: Only allow command palette for authenticated users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open palette with Cmd+K or Ctrl+K - only for authenticated users
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Feature #1418: Don't open palette if user is not logged in
        if (!token) {
          return;
        }
        setIsOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
        setAiResult(null);
      }

      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        setAiResult(null);
      }

      // Navigate with arrows
      if (isOpen && !aiResult) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
        }
        if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
          e.preventDefault();
          // Feature #1506: Execute command (saves search history automatically)
          executeCommand(filteredCommands[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, aiResult, token, query, saveRecentSearch]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { setIsOpen(false); setAiResult(null); }}
      />

      {/* Palette */}
      <div className="relative w-full max-w-2xl mx-4 bg-card rounded-xl shadow-2xl border border-border overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-muted-foreground">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            disabled={isProcessing}
          />
          <kbd className="px-2 py-1 text-xs bg-muted rounded text-muted-foreground">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
          </kbd>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="p-8 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">AI is analyzing...</p>
          </div>
        )}

        {/* AI Result */}
        {aiResult && !isProcessing && (
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-foreground">{aiResult.title}</h3>
              {aiResult.confidence && (
                <span className="px-2 py-1 bg-primary/10 text-primary text-sm rounded">
                  {aiResult.confidence}% confidence
                </span>
              )}
            </div>
            <p className="text-foreground mb-4">{aiResult.content}</p>
            {aiResult.details && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Details:</p>
                <ul className="space-y-1">
                  {aiResult.details.map((detail, idx) => (
                    <li key={idx} className="text-sm text-foreground flex items-start gap-2 p-2 rounded bg-muted/50">
                      <span className="text-primary">•</span>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setAiResult(null)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                New Command
              </button>
              <button
                onClick={() => { setIsOpen(false); setAiResult(null); }}
                className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Commands List */}
        {!isProcessing && !aiResult && (
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Feature #1366: Recent Pages Section */}
            {!query && filteredCommands.some(c => c.category === 'recent') && (
              <div className="p-2">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                  <span>🕐</span> Recent
                </p>
                {filteredCommands.filter(c => c.category === 'recent').map((cmd) => {
                  const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedIndex === globalIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="text-lg">{cmd.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium">{cmd.label}</p>
                        <p className="text-sm text-muted-foreground">{cmd.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Feature #1506: Recent Searches Section */}
            {!query && recentSearches.length > 0 && (
              <div className={`p-2 ${filteredCommands.some(c => c.category === 'recent') ? 'border-t border-border' : ''}`}>
                <div className="flex items-center justify-between px-3 py-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                    <span>🔍</span> Recent Searches
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSearchHistory();
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Clear search history"
                  >
                    Clear
                  </button>
                </div>
                {recentSearches.map((search, idx) => (
                  <button
                    key={`search-${idx}`}
                    onClick={() => rerunSearch(search)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-muted text-foreground"
                  >
                    <span className="text-muted-foreground">↻</span>
                    <div className="flex-1">
                      <p className="font-medium">{search}</p>
                      <p className="text-sm text-muted-foreground">Click to search again</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* AI Insights Section */}
            {filteredCommands.some(c => c.category === 'ai-insights') && (
            <div className={`p-2 ${!query && (filteredCommands.some(c => c.category === 'recent') || recentSearches.length > 0) ? 'border-t border-border' : ''}`}>
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">AI Insights</p>
              {filteredCommands.filter(c => c.category === 'ai-insights').map((cmd, idx) => {
                const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
                const highlights = matchHighlights.get(cmd.id);
                return (
                  <button
                    key={cmd.id}
                    onClick={() => executeCommand(cmd)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedIndex === globalIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className="text-lg">{cmd.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium">
                        {query && highlights ? renderHighlightedText(cmd.label, highlights.labelIndices) : cmd.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {query && highlights ? renderHighlightedText(cmd.description, highlights.descIndices, 'bg-primary/10 text-primary/80') : cmd.description}
                      </p>
                    </div>
                    {cmd.shortcut && (
                      <kbd className="px-2 py-1 text-xs bg-muted rounded">{cmd.shortcut}</kbd>
                    )}
                  </button>
                );
              })}
            </div>
            )}

            {/* Navigation Section */}
            {filteredCommands.some(c => c.category === 'navigation') && (
              <div className="p-2 border-t border-border">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Navigation</p>
                {filteredCommands.filter(c => c.category === 'navigation').map((cmd) => {
                  const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
                  const highlights = matchHighlights.get(cmd.id);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedIndex === globalIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="text-lg">{cmd.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium">
                          {query && highlights ? renderHighlightedText(cmd.label, highlights.labelIndices) : cmd.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {query && highlights ? renderHighlightedText(cmd.description, highlights.descIndices, 'bg-primary/10 text-primary/80') : cmd.description}
                        </p>
                      </div>
                      {cmd.shortcut && (
                        <kbd className="px-2 py-1 text-xs bg-muted rounded">{cmd.shortcut}</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Actions Section */}
            {filteredCommands.some(c => c.category === 'actions') && (
              <div className="p-2 border-t border-border">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Actions</p>
                {filteredCommands.filter(c => c.category === 'actions').map((cmd) => {
                  const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
                  const highlights = matchHighlights.get(cmd.id);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedIndex === globalIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="text-lg">{cmd.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium">
                          {query && highlights ? renderHighlightedText(cmd.label, highlights.labelIndices) : cmd.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {query && highlights ? renderHighlightedText(cmd.description, highlights.descIndices, 'bg-primary/10 text-primary/80') : cmd.description}
                        </p>
                      </div>
                      {cmd.shortcut && (
                        <kbd className="px-2 py-1 text-xs bg-muted rounded">{cmd.shortcut}</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* No results */}
            {filteredCommands.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No commands found for "{query}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Feature #1247: QA Chat Interface - Control QA Guardian through conversation

// QAChatWidget EXTRACTED to ./components/QAChatWidget.tsx (~936 lines)
// Feature #1441: Split App.tsx into logical modules

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
          {/* Icon based on type - decorative, hidden from screen readers */}
          {t.type === 'success' && (
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          {t.type === 'error' && (
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          {t.type === 'warning' && (
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          {t.type === 'info' && (
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          )}
          <span>{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-2 rounded-full p-0.5 hover:bg-white/20"
            aria-label="Dismiss notification"
          >
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
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
      <QAChatWidget />
      <AICommandPalette />
      {/* Feature #1420: AI Suggestions sidebar removed */}
      {/* Feature #101: RouteErrorBoundary catches render errors and React Query errors */}
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
        {/* Feature #2002: Shareable link for test run results */}
        <Route path="/shared/run/:token" element={<SharedTestRunPage />} />

        {/* Protected routes - require authentication */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectDetailPage />
            </ProtectedRoute>
          }
        />
        {/* Feature #1852: Project run history page */}
        <Route
          path="/projects/:projectId/runs"
          element={
            <ProtectedRoute>
              <ProjectRunHistoryPage />
            </ProtectedRoute>
          }
        />
        {/* Feature #1855: Global run history page (accessible from sidebar) */}
        <Route
          path="/run-history"
          element={
            <ProtectedRoute>
              <RunHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suites/:suiteId"
          element={
            <ProtectedRoute>
              <TestSuitePage />
            </ProtectedRoute>
          }
        />
        {/* Feature #1851: Suite run history page */}
        <Route
          path="/suites/:suiteId/runs"
          element={
            <ProtectedRoute>
              <SuiteRunHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tests/:testId"
          element={
            <ProtectedRoute>
              <TestDetailPage />
            </ProtectedRoute>
          }
        />
        {/* Feature #1823: Test run result detail page */}
        <Route
          path="/runs/:runId"
          element={
            <ProtectedRoute>
              <TestRunResultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedules"
          element={
            <ProtectedRoute>
              <SchedulesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedules/:scheduleId"
          element={
            <ProtectedRoute>
              <ScheduleDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/visual-review"
          element={
            <ProtectedRoute>
              <VisualReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security"
          element={
            <ProtectedRoute>
              <SecurityDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dast-compare"
          element={
            <ProtectedRoute>
              <DASTComparisonPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dast-graphql"
          element={
            <ProtectedRoute>
              <DASTGraphQLPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/trivy"
          element={
            <ProtectedRoute>
              <TrivyDependencyScanPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/npm-audit"
          element={
            <ProtectedRoute>
              <NpmAuditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/cve-database"
          element={
            <ProtectedRoute>
              <CVEDatabasePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/licenses"
          element={
            <ProtectedRoute>
              <LicenseCompliancePage />
            </ProtectedRoute>
          }
        />
        {/* Feature #268: SBOM Generation Page */}
        <Route
          path="/security/sbom"
          element={
            <ProtectedRoute>
              <SbomPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/containers"
          element={
            <ProtectedRoute>
              <ContainerScanPage />
            </ProtectedRoute>
          }
        />
        {/* Feature #270: Upgrade Recommendations Page */}
        <Route
          path="/security/upgrade-recommendations"
          element={
            <ProtectedRoute>
              <UpgradeRecommendationsPage />
            </ProtectedRoute>
          }
        />
        {/* Feature #271: Dependency Tree Visualization */}
        <Route
          path="/security/dependency-tree"
          element={
            <ProtectedRoute>
              <DependencyTreePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dependency-alerts"
          element={
            <ProtectedRoute>
              <DependencyAlertsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dependency-policies"
          element={
            <ProtectedRoute>
              <DependencyPolicyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/auto-pr"
          element={
            <ProtectedRoute>
              <AutoPRPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/dependency-age"
          element={
            <ProtectedRoute>
              <DependencyAgePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/multi-language"
          element={
            <ProtectedRoute>
              <MultiLanguageDependencyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/vulnerability-history"
          element={
            <ProtectedRoute>
              <VulnerabilityHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/exploitability"
          element={
            <ProtectedRoute>
              <ExploitabilityAnalysisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security/scan-cache"
          element={
            <ProtectedRoute>
              <ScanCachingPage />
            </ProtectedRoute>
          }
        />
        {/* Feature #412: AI provider pages removed - content moved to /settings?tab=ai-config */}
        <Route path="/ai/kie-provider" element={<Navigate to="/settings?tab=ai-config" replace />} />
        <Route path="/ai/anthropic-provider" element={<Navigate to="/settings?tab=ai-config" replace />} />
        <Route
          path="/ai/router"
          element={
            <RoleProtectedRoute allowedRoles={['owner', 'admin']}>
              <AIRouterPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/ai/health"
          element={
            <RoleProtectedRoute allowedRoles={['owner', 'admin']}>
              <ProviderHealthPage />
            </RoleProtectedRoute>
          }
        />
        {/* Feature #412: /ai/costs and /ai/analytics merged into single AIAnalyticsPage */}
        <Route path="/ai/costs" element={<Navigate to="/ai/analytics" replace />} />
        <Route
          path="/ai/analytics"
          element={
            <RoleProtectedRoute allowedRoles={['owner', 'admin']}>
              <AIAnalyticsPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/ai/test-generator"
          element={
            <ProtectedRoute>
              <AITestGeneratorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai/test-review"
          element={
            <ProtectedRoute>
              <AITestReviewPage />
            </ProtectedRoute>
          }
        />
        {/* Feature #324: OpenAPI/Swagger to Playwright test generation */}
        <Route
          path="/ai/openapi-generator"
          element={
            <ProtectedRoute>
              <OpenAPITestGeneratorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute>
              <MonitoringPage />
            </ProtectedRoute>
          }
        />
        {/* Feature #412: AIInsightsHub wrapper deleted - child pages promoted to direct /ai/* routes */}
        <Route path="/ai-insights" element={<Navigate to="/ai/flaky-tests" replace />} />
        <Route path="/ai-insights/flaky-tests" element={<Navigate to="/ai/flaky-tests" replace />} />
        <Route path="/ai-insights/test-analyzer" element={<Navigate to="/ai/test-analyzer" replace />} />
        <Route path="/ai-insights/test-documentation" element={<Navigate to="/ai/test-documentation" replace />} />
        <Route path="/ai-insights/release-notes" element={<Navigate to="/ai/release-notes" replace />} />
        <Route
          path="/ai/flaky-tests"
          element={
            <ProtectedRoute>
              <FlakyTestsDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai/test-analyzer"
          element={
            <ProtectedRoute>
              <TestImprovementAnalyzerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai/test-documentation"
          element={
            <ProtectedRoute>
              <TestDocumentationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai/release-notes"
          element={
            <ProtectedRoute>
              <ReleaseNotesPage />
            </ProtectedRoute>
          }
        />

        {/* Feature #1832: Unified Settings page with tabbed layout */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Legacy admin routes - redirect to unified Settings page with appropriate tab */}
        <Route path="/organization/settings" element={<Navigate to="/settings?tab=general" replace />} />
        <Route path="/organization/members" element={<Navigate to="/settings?tab=team" replace />} />
        <Route path="/organization/billing" element={<Navigate to="/settings?tab=billing" replace />} />
        <Route path="/organization/api-keys" element={<Navigate to="/settings?tab=api-keys" replace />} />
        <Route path="/organization/webhooks" element={<Navigate to="/settings?tab=webhooks" replace />} />
        {/* Feature #323: Webhook integration guides for n8n/Zapier/Make */}
        <Route path="/webhooks/integration-guides" element={<ProtectedRoute><WebhookIntegrationGuidesPage /></ProtectedRoute>} />
        <Route path="/organization/audit-logs" element={<Navigate to="/settings?tab=audit-logs" replace />} />
        {/* Feature #1365: MCP Hub - consolidated MCP tools under /mcp */}
        <Route
          path="/mcp"
          element={
            <ProtectedRoute>
              <MCPHub />
            </ProtectedRoute>
          }
        >
          <Route index element={<MCPHubIndex />} />
          <Route path="tools" element={<MCPToolsPage />} />
          <Route path="playground" element={<MCPPlaygroundPage />} />
          <Route path="chat" element={<MCPChatPage />} />
          <Route path="agent-workspace" element={<AIAgentWorkspacePage />} />
          <Route path="analytics" element={<MCPAnalyticsPage />} />
          {/* Feature #1442: production-risk removed - redirect to tools */}
          <Route path="production-risk" element={<Navigate to="/mcp/tools" replace />} />
          {/* Feature #1443: tech-debt removed - redirect to tools */}
          <Route path="tech-debt" element={<Navigate to="/mcp/tools" replace />} />
          {/* Feature #1444: test-discovery removed - redirect to tools */}
          <Route path="test-discovery" element={<Navigate to="/mcp/tools" replace />} />
          {/* Feature #1441: documentation route removed - redirect to tools */}
          <Route path="documentation" element={<Navigate to="/mcp/tools" replace />} />
          {/* Feature #1441: release-notes route removed - redirect to tools */}
          <Route path="release-notes" element={<Navigate to="/mcp/tools" replace />} />
          {/* Feature #1410: schedule route removed - redirect to tools */}
          <Route path="schedule" element={<Navigate to="/mcp/tools" replace />} />
          {/* Feature #1408: team route removed - redirect to tools */}
          <Route path="team" element={<Navigate to="/mcp/tools" replace />} />
        </Route>
        {/* Legacy MCP routes - redirect to new hub paths */}
        <Route path="/organization/mcp-tools" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/organization/mcp-playground" element={<Navigate to="/mcp/playground" replace />} />
        <Route path="/organization/mcp-analytics" element={<Navigate to="/mcp/analytics" replace />} />
        <Route path="/organization/mcp-chat" element={<Navigate to="/mcp/chat" replace />} />
        {/* Feature #1442: production-risk removed */}
        <Route path="/organization/mcp-production-risk" element={<Navigate to="/mcp/tools" replace />} />
        {/* Feature #1443: tech-debt removed */}
        <Route path="/organization/mcp-tech-debt" element={<Navigate to="/mcp/tools" replace />} />
        {/* Feature #1444: test-discovery removed */}
        <Route path="/organization/mcp-test-discovery" element={<Navigate to="/mcp/tools" replace />} />
        <Route path="/organization/mcp-documentation" element={<Navigate to="/mcp/documentation" replace />} />
        <Route path="/organization/mcp-release-notes" element={<Navigate to="/mcp/release-notes" replace />} />
        {/* Feature #1410: schedule-optimizer redirect updated to tools */}
        <Route path="/organization/mcp-schedule-optimizer" element={<Navigate to="/mcp/tools" replace />} />
        {/* Feature #1408: team-insights redirect updated to tools */}
        <Route path="/organization/mcp-team-insights" element={<Navigate to="/mcp/tools" replace />} />
        {/* Feature #411: AI Run Comparison route removed - dead demo page */}
        {/* Feature #411: AI Confidence Demo route removed - dead demo page */}
        {/* Feature #411: AI Thinking Demo route removed - dead demo page */}
        {/* Feature #411: AI Action route removed - dead demo page */}

        {/* Feature #1732: Comprehensive Report View */}
        <Route
          path="/reports/:reportId"
          element={
            <ProtectedRoute>
              <ReportPage />
            </ProtectedRoute>
          }
        />

        {/* Feature #2128: Platform Services Dashboard */}
        <Route
          path="/services"
          element={
            <ProtectedRoute>
              <ServicesPage />
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


// Feature #1441: AnalyticsPage and FailureClustersSection EXTRACTED to ./pages/AnalyticsPage.tsx (~5,652 lines)
// The following were moved:
// - TrendDataPoint, TrendSummary, AccessibilityTrendDataPoint, AccessibilityTrendSummary interfaces
// - FlakyTest interface
// - AnalyticsPage function (~1,685 lines)
// - FailureCluster, RelatedCommit, CommitDetails, RootCauseAnalysis interfaces
// - CrossTestCorrelation, HumanReadableExplanation, TechnicalExplanation interfaces  
// - ExecutiveSummary, LLMRootCauseAnalysis interfaces
// - FailureClustersSection function (~3,455 lines)


// Visual Review Page types moved to ./pages/VisualReviewPage.tsx
// (PendingVisualChange, VisualChangeImpactAnalysis)


// ========== Security Dashboard Page ==========
// NOTE: SecurityDashboardPage and its types (DashboardFinding, SecurityDashboardData,
// TrendsData, DetectedSecret, SecretType, SecretsData) have been extracted to
// ./pages/SecurityDashboardPage.tsx (~1120 lines)


// Feature #1244: OrganizationInsightsPage EXTRACTED to ./pages/OrganizationInsightsPage.tsx (~390 lines)
// Types moved: CrossProjectPattern, CrossProjectSolution, ProjectFailureInsight


// Feature #1245: BestPracticesPage EXTRACTED to ./pages/BestPracticesPage.tsx (~415 lines)
// Types moved: ProjectMetrics, BestPractice, PracticeRecommendation

// Feature #1350: TestImprovementAnalyzerPage EXTRACTED to ./pages/TestImprovementAnalyzerPage.tsx (~400 lines)
// Types moved: TestImprovementAnalysis

// Feature #1246: IndustryBenchmarkPage EXTRACTED to ./pages/IndustryBenchmarkPage.tsx (~580 lines)
// Types moved: IndustryBenchmark, IndustryPercentile, GapAnalysis

// Feature #1255: ReleaseNotesPage EXTRACTED to ./pages/ReleaseNotesPage.tsx (~620 lines)
// Types moved: Release, TestDelta, GeneratedReleaseNotes

// Feature #1259: PersonalizedInsightsPage EXTRACTED to ./pages/PersonalizedInsightsPage.tsx (~410 lines)
// Types moved: PersonalizedInsight


// TestDocumentationPage extracted to ./pages/TestDocumentationPage.tsx (Feature #1253, #1254)
// Types moved: TestSuiteForDocs, GeneratedDocumentation, DocumentVersion, TestModification

// TeamSkillGapsPage extracted to ./pages/TeamSkillGapsPage.tsx (Feature #1260, #1261)


// AILearningPage extracted to ./pages/AILearningPage.tsx (Feature #1262, #1264)

// Feature #1100: FlakyTestsDashboardPage extracted to ./pages/FlakyTestsDashboardPage.tsx (~1575 lines)
// Feature #1441: Split App.tsx into logical modules

// SecurityDashboardPage EXTRACTED to ./pages/SecurityDashboardPage.tsx (~1120 lines)
// Feature #1441: Split App.tsx into logical modules

// Types previously used by SecurityDashboardPage have also been moved to the extracted file:
// - DashboardFinding, SecurityDashboardData, TrendDataPoint, TrendsData
// - DetectedSecret, SecretType, SecretsData

// REMOVED: function SecurityDashboardPage() { ... } (lines 24169-25288)

// NOTE: The following interfaces (lines 16892-17038) were specific to SecurityDashboardPage
// and have been moved to ./pages/SecurityDashboardPage.tsx:
// - DashboardFinding, SecurityDashboardData, TrendDataPoint, TrendsData
// - DetectedSecret, SecretType, SecretsData

// Now importing SecurityDashboardPage from ./pages instead
// SecurityDashboardPage function body has been moved to ./pages/SecurityDashboardPage.tsx

// MonitoringPage EXTRACTED to ./pages/MonitoringPage.tsx (~11,170 lines)
// Feature #1441: Split App.tsx into logical modules
// Types moved: MonitoringLocation, MonitoringLocationInfo, LocationResult, UptimeAssertion,
// AssertionResult, SSLCertificateInfo, UptimeCheck, CheckResult, MonitoringSummary,
// WebhookCheck, WebhookEvent, SlaPeriod, SlaMetrics, Incident, IncidentData,
// HistoryChartDataPoint, HistoryStatusEntry, HistoryData, MaintenanceWindow, MaintenanceData,
// TransactionStepAssertion, TransactionStep, TransactionCheck, TransactionStepResult,
// TransactionResult, TransactionStepInput, PerformanceCheck, PerformanceMetrics,
// PerformanceResult, PerformanceTrends

// VisualReviewPage EXTRACTED to ./pages/VisualReviewPage.tsx (~1028 lines)
// Types moved: PendingVisualChange, VisualChangeImpactAnalysis

// OrganizationSettingsPage EXTRACTED to ./pages/OrganizationSettingsPage.tsx (~1,611 lines)
// Feature #1441: Split App.tsx into logical modules
// Types moved: SessionInfo, SlackChannel, SlackConnectionData, MCPConnection, McpAuditLogEntry, McpAnalytics, MCPToolInfo
// Components moved: SessionManagementSection, ArtifactRetentionSection, StorageUsageSection,
//   MCPConnectionsSection, MCPAuditLogSection, MCPAnalyticsDashboard, MCPToolsCatalogSection,
//   SlackIntegrationSection, OrganizationSettingsPage

// Types Invitation, Member moved to OrganizationMembersPage.tsx

// Feature #1232: MCPToolsPage extracted to pages/MCPToolsPage.tsx

// Feature #1233: MCPPlaygroundPage extracted to ./pages/MCPPlaygroundPage.tsx (~430 lines)

// Feature #1265: MCPChatPage extracted to ./pages/MCPChatPage.tsx (~306 lines)

// Feature #1268: AIRunComparisonPage extracted to ./pages/AIRunComparisonPage.tsx (~445 lines)

// Feature #1234: MCPAnalyticsPage extracted to ./pages/MCPAnalyticsPage.tsx (~390 lines)

// OrganizationMembersPage extracted to ./pages/OrganizationMembersPage.tsx (Feature #1357)

// ProjectsPage extracted to ./pages/ProjectsPage.tsx (Feature #1357)

// ProjectDetailPage EXTRACTED to ./pages/ProjectDetailPage.tsx (~7,961 lines)
// Feature #1441: Split App.tsx into logical modules


// BillingPage extracted to ./pages/BillingPage.tsx (Feature #1357)

// ApiKeysPage extracted to ./pages/ApiKeysPage.tsx (Feature #1357)
// Type ApiKey moved to ApiKeysPage.tsx


// TestSuitePage EXTRACTED to ./pages/TestSuitePage.tsx (~7,520 lines)
// Feature #1441: Split App.tsx into logical modules



// TestDetailPage EXTRACTED to ./pages/TestDetailPage.tsx (~9,907 lines)
// Feature #1441: Split App.tsx into logical modules
// Types also extracted: TestRunType, ConsoleLog, NetworkRequest, TestRunResult, StepResult



// NotFoundPage moved to pages/NotFoundPage.tsx for code quality compliance (#1357)

export default App;
