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
export type AIInsightTab =
  | 'flaky-tests'
  | 'organization'
  | 'best-practices'
  | 'benchmarks'
  | 'test-documentation'
  | 'release-notes'
  | 'personalized'
  | 'team-skills'
  | 'ai-learning';

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

const OrgInsightsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const BestPracticesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const BenchmarksIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

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

const PersonalizedIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const TeamSkillsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const AILearningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

// Tab configurations with route paths
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
    id: 'organization',
    path: '/ai-insights/organization',
    label: 'Organization',
    shortLabel: 'Org',
    icon: <OrgInsightsIcon />,
    description: 'Cross-project patterns and solutions',
  },
  {
    id: 'best-practices',
    path: '/ai-insights/best-practices',
    label: 'Best Practices',
    shortLabel: 'Practices',
    icon: <BestPracticesIcon />,
    description: 'AI-suggested best practices for your tests',
  },
  {
    id: 'benchmarks',
    path: '/ai-insights/industry-benchmark',
    label: 'Benchmarks',
    shortLabel: 'Benchmarks',
    icon: <BenchmarksIcon />,
    description: 'Compare your metrics against industry standards',
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
  {
    id: 'personalized',
    path: '/ai-insights/personalized',
    label: 'My Insights',
    shortLabel: 'My Insights',
    icon: <PersonalizedIcon />,
    description: 'Personalized insights based on your activity',
  },
  {
    id: 'team-skills',
    path: '/ai-insights/team-skills',
    label: 'Team Skills',
    shortLabel: 'Skills',
    icon: <TeamSkillsIcon />,
    description: 'Team skill gaps and training recommendations',
    adminOnly: true,
  },
  {
    id: 'ai-learning',
    path: '/ai-insights/learning',
    label: 'AI Learning',
    shortLabel: 'Learning',
    icon: <AILearningIcon />,
    description: 'AI model learning progress and customization',
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
