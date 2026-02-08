/**
 * AI Insights Hub Component
 *
 * Unified hub page with tabs for all 11 AI insight pages.
 * Acts as a layout wrapper that renders child routes in the content area.
 *
 * Feature #1362: AI Insights Hub page
 */

import { useSearchParams, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { AIPoweredBadge } from './ui/AIBadges';

// Tab configuration
// Feature #411: Removed dead demo tabs (organization, best-practices, benchmarks, personalized, team-skills, ai-learning)
export type AIInsightTab =
  | 'flaky-tests'
  | 'test-analyzer'
  | 'test-documentation'
  | 'release-notes';

interface TabConfig {
  id: AIInsightTab;
  path: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  description: string;
  adminOnly?: boolean;
}

// Icons for each tab
const FlakyTestsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

// Feature #411: Removed OrgInsightsIcon, BestPracticesIcon, BenchmarksIcon - dead demo icons

const TestDocsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ReleaseNotesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

// Feature #411: Test Analyzer Icon
const TestAnalyzerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

// Tab configurations with route paths
// Feature #411: Removed 6 dead demo tabs (organization, best-practices, benchmarks, personalized, team-skills, ai-learning)
const TABS: TabConfig[] = [
  {
    id: 'flaky-tests',
    path: '/ai-insights/flaky-tests',
    label: 'Flaky Tests',
    shortLabel: 'Flaky',
    icon: <FlakyTestsIcon />,
    description: 'Analyze and manage flaky tests with AI-powered insights',
  },
  {
    id: 'test-analyzer',
    path: '/ai-insights/test-analyzer',
    label: 'Test Analyzer',
    shortLabel: 'Analyzer',
    icon: <TestAnalyzerIcon />,
    description: 'AI-powered test improvement suggestions',
  },
  {
    id: 'test-documentation',
    path: '/ai-insights/test-documentation',
    label: 'Test Docs',
    shortLabel: 'Docs',
    icon: <TestDocsIcon />,
    description: 'Auto-generated test documentation',
  },
  {
    id: 'release-notes',
    path: '/ai-insights/release-notes',
    label: 'Release Notes',
    shortLabel: 'Releases',
    icon: <ReleaseNotesIcon />,
    description: 'AI-generated release notes from test changes',
  },
];

export function AIInsightsHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  // Filter tabs based on user role
  const availableTabs = TABS.filter(tab => !tab.adminOnly || isAdmin);

  // Get active tab based on current path
  const activeTab = availableTabs.find(t => location.pathname === t.path) || availableTabs[0];

  // Navigate to tab
  const handleTabClick = (tab: TabConfig) => {
    navigate(tab.path);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Insights Hub
          </h1>
          <AIPoweredBadge size="md" />
        </div>
        <p className="text-muted-foreground mt-1">
          AI-powered analysis and recommendations for your test suite
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border mb-6">
        <nav className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent -mb-px" aria-label="AI Insights tabs">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${location.pathname === tab.path
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                }
              `}
              aria-current={location.pathname === tab.path ? 'page' : undefined}
              title={tab.description}
            >
              <span className="hidden sm:inline">{tab.icon}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content - renders the nested route */}
      <div className="min-h-[400px]">
        <Outlet />
      </div>
    </div>
  );
}

// Simple wrapper components that can be used to render existing page content
// These are exported for use in the route configuration
export function AIInsightsIndex() {
  const navigate = useNavigate();

  // Redirect to first tab (flaky-tests) if at /ai-insights
  React.useEffect(() => {
    navigate('/ai-insights/flaky-tests', { replace: true });
  }, [navigate]);

  return null;
}

import React from 'react';

export default AIInsightsHub;
