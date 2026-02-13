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
import { Settings, Terminal, BarChart3, MessageCircle } from 'lucide-react';

// Tab configuration
// Feature #1408: team-insights removed - enterprise bloat
// Feature #1442: production-risk removed
// Feature #1443: tech-debt removed - enterprise feature
// Feature #1444: test-discovery removed
// Feature #866: agent-workspace removed (duplicates MCP Chat)
// Feature #413: documentation and release-notes removed - broken tabs with no backing pages
export type MCPHubTab =
 | 'tools'
 | 'playground'
 | 'analytics'
 | 'chat';
 // Feature #1410: schedule-optimizer removed - keep simple cron scheduling

interface TabConfig {
 id: MCPHubTab;
 path: string;
 label: string;
 shortLabel: string;
 icon: React.ReactNode;
 description: string;
}

// Icons for each tab - using Lucide React icons
const ToolsIcon = () => <Settings className="h-5 w-5" />;
const PlaygroundIcon = () => <Terminal className="h-5 w-5" />;
const AnalyticsIcon = () => <BarChart3 className="h-5 w-5" />;
const ChatIcon = () => <MessageCircle className="h-5 w-5" />;
// Feature #866: AgentWorkspaceIcon removed

// Feature #1442: ProductionRiskIcon removed
// Feature #1443: TechDebtIcon removed
// Feature #1444: TestDiscoveryIcon removed
// Feature #413: DocumentationIcon and ReleaseNotesIcon removed - broken tabs

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
 // Feature #866: agent-workspace tab removed (duplicates MCP Chat)
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
 // Feature #413: documentation and release-notes tabs removed - broken tabs with no backing pages
 // Feature #1410: schedule-optimizer tab removed - keep simple cron scheduling
 // Feature #1408: team-insights tab removed - enterprise bloat
];

export function MCPHub() {
 const location = useLocation();
 const navigate = useNavigate();

 // Get active tab based on current path - Feature #513: prefixed with _ as used indirectly via path
 const _activeTab = TABS.find(t => location.pathname === t.path) || TABS[0];

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
 <Settings className="h-7 w-7 text-primary" />
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
