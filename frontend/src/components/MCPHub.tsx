/**
 * MCP Hub Component
 *
 * Unified hub page with tabs for all 12 MCP tool pages.
 * Acts as a layout wrapper that renders child routes in the content area.
 *
 * Feature #1365: MCP Tools Hub page
 */

import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import React from 'react';
import { MCPReadyBadge } from './ui/AIBadges';

// Tab configuration
// Feature #1408: team-insights removed - enterprise bloat
// Feature #1442: production-risk removed
// Feature #1443: tech-debt removed - enterprise feature
// Feature #1444: test-discovery removed
// Feature #1560: AI Agent Workspace added
export type MCPHubTab =
  | 'tools'
  | 'playground'
  | 'analytics'
  | 'chat'
  | 'agent-workspace'
  | 'documentation'
  | 'release-notes';
  // Feature #1410: schedule-optimizer removed - keep simple cron scheduling

interface TabConfig {
  id: MCPHubTab;
  path: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  description: string;
}

// Icons for each tab
const ToolsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PlaygroundIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

// Feature #1560: AI Agent Workspace icon
const AgentWorkspaceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

// Feature #1442: ProductionRiskIcon removed
// Feature #1443: TechDebtIcon removed
// Feature #1444: TestDiscoveryIcon removed

const DocumentationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ReleaseNotesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

// Feature #1410: ScheduleOptimizerIcon removed - keep simple cron scheduling

// Feature #1408: TeamInsightsIcon removed - enterprise bloat

// Tab configurations with route paths
const TABS: TabConfig[] = [
  {
    id: 'tools',
    path: '/mcp/tools',
    label: 'Tools Catalog',
    shortLabel: 'Tools',
    icon: <ToolsIcon />,
    description: 'Browse and manage MCP tools',
  },
  {
    id: 'playground',
    path: '/mcp/playground',
    label: 'Playground',
    shortLabel: 'Play',
    icon: <PlaygroundIcon />,
    description: 'Test MCP tools interactively',
  },
  {
    id: 'chat',
    path: '/mcp/chat',
    label: 'AI Chat',
    shortLabel: 'Chat',
    icon: <ChatIcon />,
    description: 'Natural language interface to QA Guardian',
  },
  {
    id: 'agent-workspace',
    path: '/mcp/agent-workspace',
    label: 'Agent Workspace',
    shortLabel: 'Agent',
    icon: <AgentWorkspaceIcon />,
    description: 'AI Agent with Kanban task board',
  },
  {
    id: 'analytics',
    path: '/mcp/analytics',
    label: 'Analytics',
    shortLabel: 'Stats',
    icon: <AnalyticsIcon />,
    description: 'MCP usage and performance metrics',
  },
  // Feature #1442: production-risk tab removed
  // Feature #1443: tech-debt tab removed
  // Feature #1444: test-discovery tab removed
  {
    id: 'documentation',
    path: '/mcp/documentation',
    label: 'Doc Gen',
    shortLabel: 'Docs',
    icon: <DocumentationIcon />,
    description: 'Auto-generate documentation',
  },
  {
    id: 'release-notes',
    path: '/mcp/release-notes',
    label: 'Releases',
    shortLabel: 'Release',
    icon: <ReleaseNotesIcon />,
    description: 'Generate release notes',
  },
  // Feature #1410: schedule-optimizer tab removed - keep simple cron scheduling
  // Feature #1408: team-insights tab removed - enterprise bloat
];

export function MCPHub() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get active tab based on current path
  const activeTab = TABS.find(t => location.pathname === t.path) || TABS[0];

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            MCP Hub
          </h1>
          <MCPReadyBadge size="md" />
        </div>
        <p className="text-muted-foreground mt-1">
          Model Context Protocol tools for AI-powered QA automation
        </p>
      </div>

      {/* Quick Access Shortcuts */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => navigate('/mcp/agent-workspace')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors"
        >
          <AgentWorkspaceIcon />
          <span>AI Agent</span>
        </button>
        <button
          onClick={() => navigate('/mcp/chat')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <ChatIcon />
          <span>Quick Chat</span>
        </button>
        <button
          onClick={() => navigate('/mcp/playground')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <PlaygroundIcon />
          <span>Try Tools</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border mb-6">
        <nav className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent -mb-px" aria-label="MCP Hub tabs">
          {TABS.map((tab) => (
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

// Redirect component for index route
export function MCPHubIndex() {
  const navigate = useNavigate();

  // Redirect to first tab (tools) if at /mcp
  React.useEffect(() => {
    navigate('/mcp/tools', { replace: true });
  }, [navigate]);

  return null;
}

export default MCPHub;
