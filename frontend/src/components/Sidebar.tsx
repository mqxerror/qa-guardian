/**
 * Sidebar Component
 * Feature #104: Refactored to import sub-components from sidebar/ folder
 *
 * Main navigation sidebar with collapsible groups, pinned items,
 * role-based visibility, and keyboard shortcuts.
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore, SidebarSection } from '../stores/sidebarStore';
import { useVisualReviewStore } from '../stores/visualReviewStore';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator'; // Feature #167
import { usePrefetch } from '../hooks/usePrefetch'; // Feature #134

// Import icons from sidebar folder
import {
  DashboardIcon,
  ProjectsIcon,
  SchedulesIcon,
  AnalyticsIcon,
  SettingsIcon,
  CollapseIcon,
  ExpandIcon,
  LogoutIcon,
  VisualReviewIcon,
  SecurityIcon,
  SecurityGroupIcon,
  DASTIcon,
  MonitoringIcon,
  ServicesIcon,
  AIInsightsIcon,
  AIGroupIcon,
  AITestGeneratorIcon,
  MCPToolsIcon,
  TestingGroupIcon,
  RunHistoryIcon,
} from './sidebar-components/SidebarIcons';

// Import components from sidebar-components folder
import {
  NotificationDropdown,
  NavItem,
  NavItemWithBadge,
  PinIcon,
  CollapsibleNavGroup,
  OrganizationSwitcher,
} from './sidebar-components';

// Import types from sidebar-components folder
import { MenuItemConfig, UserRole, hasAccess } from './sidebar-components/types';

export function Sidebar() {
  const { user, logout, token } = useAuthStore();
  const { collapsed, toggle } = useSidebarStore();
  const { pendingCount, fetchPendingCount } = useVisualReviewStore();
  const navigate = useNavigate();
  const location = useLocation();
  const prefetch = usePrefetch(); // Feature #134: Route prefetching

  // Feature #1502: Security alert count for badge
  const [securityAlertCount, setSecurityAlertCount] = useState(0);

  // Feature #1502: Fetch security alert count (critical + high severity findings)
  useEffect(() => {
    const fetchSecurityAlerts = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/v1/sast/dashboard?severity=CRITICAL,HIGH&limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          // Count critical and high severity findings
          const count = (data.summary?.bySeverity?.critical || 0) + (data.summary?.bySeverity?.high || 0);
          setSecurityAlertCount(count);
        }
      } catch (error) {
        // Silently fail - badge just won't show
        console.debug('Could not fetch security alerts:', error);
      }
    };
    fetchSecurityAlerts();
    // Refresh every 5 minutes
    const interval = setInterval(fetchSecurityAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  // Feature #1363: Advanced features toggle (persisted in localStorage)
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('qa-guardian-show-advanced-features');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  // Feature #1364: Pinned items (persisted in localStorage)
  const [pinnedItems, setPinnedItems] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('qa-guardian-pinned-items');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Feature #1364: Collapsed sections (now managed via store for cross-component access)
  // Feature #1502: Security group defaults to collapsed
  // Feature #1509: Use store to allow command palette to expand sections
  // Feature #1549: Use store's toggleSection for proper state management
  const { collapsedSections, setCollapsedSections, toggleSection: storeToggleSection, expandSection } = useSidebarStore();

  // Persist advanced features preference
  useEffect(() => {
    try {
      localStorage.setItem('qa-guardian-show-advanced-features', JSON.stringify(showAdvancedFeatures));
    } catch { /* storage unavailable */ }
  }, [showAdvancedFeatures]);

  // Feature #1364: Persist pinned items
  useEffect(() => {
    try {
      localStorage.setItem('qa-guardian-pinned-items', JSON.stringify(pinnedItems));
    } catch { /* storage unavailable */ }
  }, [pinnedItems]);

  // Feature #1364: Collapsed sections now persisted via zustand store (removed localStorage effect)

  // Feature #1364: Toggle pin for an item
  const togglePin = (path: string) => {
    setPinnedItems(prev => {
      if (prev.includes(path)) {
        return prev.filter(p => p !== path);
      }
      return [...prev, path];
    });
  };

  // Feature #1364: Toggle section collapse
  // Feature #1549: Use store's toggleSection for proper state management
  const toggleSection = (section: string) => {
    storeToggleSection(section as 'testing' | 'security' | 'ai-mcp');
  };

  // Feature #1364: Reset navigation preferences to defaults
  // Feature #1502: Security defaults to collapsed
  const resetNavPreferences = () => {
    setPinnedItems([]);
    setCollapsedSections(['security']); // Security defaults to collapsed
    setShowAdvancedFeatures(false);
    try {
      localStorage.removeItem('qa-guardian-pinned-items');
      localStorage.setItem('qa-guardian-collapsed-sections', JSON.stringify(['security']));
      localStorage.removeItem('qa-guardian-show-advanced-features');
    } catch { /* storage unavailable */ }
  };

  // Feature #1364: Check if item is pinned
  const isPinned = (path: string) => pinnedItems.includes(path);

  // Feature #1364: Check if section is collapsed
  // Feature #1549: Ensure safe array access with fallback
  const isSectionCollapsed = (section: SidebarSection) => {
    const sections = Array.isArray(collapsedSections) ? collapsedSections : [];
    return sections.includes(section);
  };

  // Feature #1505: Keyboard shortcuts for sidebar navigation
  // G+T: Testing, G+S: Security, G+A: AI & MCP, G+D: Dashboard
  const [showShortcutHints, setShowShortcutHints] = useState(false);
  const shortcutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let waitingForSecondKey = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key.toLowerCase() === 'g' && !waitingForSecondKey) {
        waitingForSecondKey = true;
        setShowShortcutHints(true);

        // Clear any existing timeout
        if (shortcutTimeoutRef.current) {
          clearTimeout(shortcutTimeoutRef.current);
        }

        // Reset after 1.5 seconds if no second key pressed
        shortcutTimeoutRef.current = setTimeout(() => {
          waitingForSecondKey = false;
          setShowShortcutHints(false);
        }, 1500);
        return;
      }

      if (waitingForSecondKey) {
        waitingForSecondKey = false;
        setShowShortcutHints(false);
        if (shortcutTimeoutRef.current) {
          clearTimeout(shortcutTimeoutRef.current);
        }

        const key = e.key.toLowerCase();

        switch (key) {
          case 't':
            // G+T: Expand Testing group and navigate to Projects
            e.preventDefault();
            expandSection('testing');
            navigate('/projects');
            break;
          case 's':
            // G+S: Expand Security group and navigate to Security Dashboard
            e.preventDefault();
            expandSection('security');
            navigate('/security');
            break;
          case 'a':
            // G+A: Expand AI & MCP group and navigate to AI Insights
            e.preventDefault();
            expandSection('ai-mcp');
            navigate('/ai-insights');
            break;
          case 'd':
            // G+D: Navigate to Dashboard
            e.preventDefault();
            navigate('/dashboard');
            break;
          case 'm':
            // G+M: Navigate to MCP Hub
            e.preventDefault();
            expandSection('ai-mcp');
            navigate('/mcp');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (shortcutTimeoutRef.current) {
        clearTimeout(shortcutTimeoutRef.current);
      }
    };
  }, [navigate, expandSection]);

  // Fetch pending visual approvals count on mount and when token changes
  useEffect(() => {
    if (token) {
      fetchPendingCount(token);
    }
  }, [token, fetchPendingCount]);

  // Refetch when navigating away from visual-review page (might have approved some)
  useEffect(() => {
    if (token && location.pathname !== '/visual-review') {
      // Small delay to allow any approvals to propagate
      const timer = setTimeout(() => fetchPendingCount(token), 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, token, fetchPendingCount]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  // Feature #1363: Menu item configuration with role-based visibility
  // Note: Dashboard is rendered separately at the top of the nav (not in this array)
  // Note: Security is now in its own collapsible group (#1502)
  const coreMenuItems: MenuItemConfig[] = [
    { path: '/schedules', icon: <SchedulesIcon />, label: 'Schedules', visibility: 'all' },
    { path: '/analytics', icon: <AnalyticsIcon />, label: 'Analytics', visibility: 'qa' },
    { path: '/monitoring', icon: <MonitoringIcon />, label: 'Monitoring', visibility: 'qa' },
    { path: '/services', icon: <ServicesIcon />, label: 'Services', visibility: 'qa' }, // Feature #2128
  ];

  // Feature #1502: Security group menu items
  const securityMenuItems: MenuItemConfig[] = [
    { path: '/security', icon: <SecurityIcon />, label: 'Dashboard', visibility: 'qa' },
    { path: '/security/dast-compare', icon: <DASTIcon />, label: 'DAST Scanning', visibility: 'qa' },
    // Dependencies and Container Scan removed - mock pages replaced with "Coming Soon" placeholders
  ];

  // Feature #1503: AI & MCP group menu items
  const aiMcpMenuItems: MenuItemConfig[] = [
    { path: '/ai-insights', icon: <AIInsightsIcon />, label: 'AI Insights', visibility: 'all' },
    { path: '/ai/test-generator', icon: <AITestGeneratorIcon />, label: 'Test Generator', visibility: 'qa' },
    { path: '/mcp', icon: <MCPToolsIcon />, label: 'MCP Hub', visibility: 'developer', advancedOnly: true },
  ];

  // Feature #1501: Testing group menu items
  // Note: Test Suites and Test Results are accessed through the Projects page
  // as they are hierarchical: Projects -> Suites -> Tests -> Results
  const testingMenuItems: MenuItemConfig[] = [
    { path: '/projects', icon: <ProjectsIcon />, label: 'Projects', visibility: 'all' },
    { path: '/run-history', icon: <RunHistoryIcon />, label: 'Run History', visibility: 'all' }, // Feature #1855
    // Visual Review is handled separately due to badge count
  ];

  // Feature #1832: Consolidated Admin menu into single Settings page
  // All admin items (Team, General Settings, Billing, API Keys, Webhooks, Audit Logs)
  // are now tabs within the unified Settings page
  const adminMenuItems: MenuItemConfig[] = [
    { path: '/settings', icon: <SettingsIcon />, label: 'Settings', visibility: 'developer' },
  ];

  // Feature #1365: MCP Hub - single entry for all MCP tools
  // MCP tools - visible to developers+, or anyone with advanced features enabled
  // Feature #513: Prefixed with _ - items merged into main menu structure
  const _mcpMenuItems: MenuItemConfig[] = [
    { path: '/mcp', icon: <MCPToolsIcon />, label: 'MCP Hub', visibility: 'developer', advancedOnly: true },
  ];

  // Filter menu items based on user role and advanced features toggle
  const filterMenuItems = (items: MenuItemConfig[]): MenuItemConfig[] => {
    return items.filter(item => {
      // Check role-based access
      const hasRoleAccess = hasAccess(user?.role as UserRole, item.visibility);

      // For advanced-only items:
      // - Show if user has native role access (developer+)
      // - OR show if user enabled advanced features toggle (for viewers)
      if (item.advancedOnly) {
        const isDeveloperPlus = user?.role === 'developer' || user?.role === 'admin' || user?.role === 'owner';
        // Developers+ always see these items; viewers see them only with toggle enabled
        if (isDeveloperPlus) {
          return true; // Developer+ always has access
        }
        return showAdvancedFeatures; // Viewers can opt-in via toggle
      }

      return hasRoleAccess;
    });
  };

  const visibleCoreItems = filterMenuItems(coreMenuItems);
  const visibleTestingItems = filterMenuItems(testingMenuItems);
  const visibleSecurityItems = filterMenuItems(securityMenuItems);
  const visibleAiMcpItems = filterMenuItems(aiMcpMenuItems);
  const visibleAdminItems = filterMenuItems(adminMenuItems);

  // Feature #1501: Check if any testing item is active (for collapsible group indicator)
  // Testing group includes: Projects, Suites, Tests, Run History, and Visual Review
  const hasActiveTestingItem =
    isActive('/projects') ||
    location.pathname.startsWith('/projects/') ||
    location.pathname.startsWith('/suites/') ||
    location.pathname.startsWith('/tests/') ||
    location.pathname.startsWith('/runs/') ||
    isActive('/run-history') || // Feature #1855
    isActive('/visual-review');

  // Feature #1502: Check if any security item is active (for collapsible group indicator)
  const hasActiveSecurityItem = location.pathname.startsWith('/security');

  // Feature #1503: Check if any AI/MCP item is active (for collapsible group indicator)
  const hasActiveAiMcpItem =
    location.pathname.startsWith('/ai-insights') ||
    location.pathname.startsWith('/ai/') ||
    location.pathname.startsWith('/mcp');

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center border-b border-border p-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <h1 className="text-xl font-bold text-foreground">QA Guardian</h1>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <ExpandIcon /> : <CollapseIcon />}
        </button>
      </div>

      {/* Organization Switcher */}
      <OrganizationSwitcher collapsed={collapsed} />

      {/* Navigation - Feature #1363: Role-based menu visibility, Feature #1364: Pinned items */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {/* Feature #1364: Pinned items section - shown at top */}
        {pinnedItems.length > 0 && !collapsed && (
          <div className="pb-2 mb-2 border-b border-border">
            <div className="flex items-center justify-between px-3 py-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <PinIcon filled /> Pinned
              </p>
            </div>
            {/* Render pinned items from all visible items */}
            {[
              { path: '/dashboard', icon: <DashboardIcon />, label: 'Dashboard', visibility: 'all' as const },
              ...visibleCoreItems, ...visibleTestingItems, ...visibleSecurityItems, ...visibleAiMcpItems, ...visibleAdminItems,
              { path: '/visual-review', icon: <VisualReviewIcon />, label: 'Visual Review', visibility: 'all' as const },
            ]
              .filter(item => isPinned(item.path))
              .map(item => (
                <NavItem
                  key={`pinned-${item.path}`}
                  to={item.path}
                  icon={item.icon}
                  label={item.label}
                  collapsed={collapsed}
                  isActive={isActive(item.path) || (item.path === '/ai-insights' && location.pathname.startsWith('/ai-insights')) || (item.path === '/ai/test-generator' && location.pathname.startsWith('/ai/')) || (item.path === '/mcp' && location.pathname.startsWith('/mcp')) || (item.path === '/projects' && location.pathname.startsWith('/projects/'))}
                  isPinned={true}
                  onTogglePin={togglePin}
                />
              ))}
          </div>
        )}

        {/* Dashboard - always at top */}
        <NavItem
          to="/dashboard"
          icon={<DashboardIcon />}
          label="Dashboard"
          collapsed={collapsed}
          isActive={isActive('/dashboard')}
          isPinned={isPinned('/dashboard')}
          onTogglePin={togglePin}
          onPrefetch={prefetch.dashboard}  // Feature #134: Prefetch dashboard data
        />

        {/* Feature #1501: Collapsible Testing group */}
        <CollapsibleNavGroup
          label="Testing"
          collapsed={collapsed}
          isExpanded={!isSectionCollapsed('testing')}
          onToggle={() => toggleSection('testing')}
          hasActiveChild={hasActiveTestingItem}
          sectionId="testing"
          icon={<TestingGroupIcon />}
          shortcutKey="T"
          showShortcutHint={showShortcutHints}
        >
          {visibleTestingItems.map(item => (
            <NavItem
              key={item.path}
              to={item.path}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
              isActive={isActive(item.path) || (item.path === '/projects' && location.pathname.startsWith('/projects/'))}
              isPinned={isPinned(item.path)}
              onTogglePin={togglePin}
              onPrefetch={item.path === '/projects' ? prefetch.projects : undefined}  // Feature #134
            />
          ))}
          {/* Visual Review with badge - inside Testing group */}
          <NavItemWithBadge
            to="/visual-review"
            icon={<VisualReviewIcon />}
            label="Visual Review"
            collapsed={collapsed}
            isActive={isActive('/visual-review')}
            badgeCount={pendingCount}
            isPinned={isPinned('/visual-review')}
            onTogglePin={togglePin}
          />
        </CollapsibleNavGroup>

        {/* Other core menu items (Schedules, Analytics, Monitoring) */}
        {visibleCoreItems.map(item => (
          <NavItem
            key={item.path}
            to={item.path}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
            isActive={isActive(item.path)}
            isPinned={isPinned(item.path)}
            onTogglePin={togglePin}
          />
        ))}

        {/* Feature #1502: Collapsible Security group - default collapsed, with alert badge */}
        {visibleSecurityItems.length > 0 && (
          <CollapsibleNavGroup
            label="Security"
            collapsed={collapsed}
            isExpanded={!isSectionCollapsed('security')}
            onToggle={() => toggleSection('security')}
            hasActiveChild={hasActiveSecurityItem}
            icon={<SecurityGroupIcon />}
            badgeCount={securityAlertCount}
            badgeColor="red"
            shortcutKey="S"
            sectionId="security"
            showShortcutHint={showShortcutHints}
          >
            {visibleSecurityItems.map(item => (
              <NavItem
                key={item.path}
                to={item.path}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                isActive={isActive(item.path) || location.pathname.startsWith(item.path + '/')}
                isPinned={isPinned(item.path)}
                onTogglePin={togglePin}
              />
            ))}
          </CollapsibleNavGroup>
        )}

        {/* Feature #1503: Collapsible AI & MCP group - default expanded for primary users */}
        {visibleAiMcpItems.length > 0 && (
          <CollapsibleNavGroup
            label="AI & MCP"
            collapsed={collapsed}
            isExpanded={!isSectionCollapsed('ai-mcp')}
            onToggle={() => toggleSection('ai-mcp')}
            hasActiveChild={hasActiveAiMcpItem}
            icon={<AIGroupIcon />}
            shortcutKey="A"
            showShortcutHint={showShortcutHints}
            sectionId="ai-mcp"
          >
            {visibleAiMcpItems.map(item => (
              <NavItem
                key={item.path}
                to={item.path}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                isActive={isActive(item.path) || location.pathname.startsWith(item.path + '/')}
                isPinned={isPinned(item.path)}
                onTogglePin={togglePin}
              />
            ))}
          </CollapsibleNavGroup>
        )}

        {/* Feature #1832: Single Settings link (consolidated Admin menu) */}
        {visibleAdminItems.length > 0 && (
          <>
            {!collapsed && (
              <div className="pt-3 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase">
                Admin
              </div>
            )}
            {visibleAdminItems.map(item => (
              <NavItem
                key={item.path}
                to={item.path}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                isActive={isActive(item.path) || location.pathname.startsWith('/settings')}
                isPinned={isPinned(item.path)}
                onTogglePin={togglePin}
              />
            ))}
          </>
        )}

        {/* Feature #1365: MCP Hub moved to AI & MCP group (#1503) */}

        {/* Notifications */}
        <NotificationDropdown collapsed={collapsed} />

        {/* Feature #1363: Advanced features toggle for non-developer users */}
        {user?.role === 'viewer' && (
          <div className={`mt-2 pt-2 border-t border-border ${collapsed ? 'text-center' : ''}`}>
            <button
              onClick={() => setShowAdvancedFeatures(!showAdvancedFeatures)}
              title={collapsed ? (showAdvancedFeatures ? 'Hide advanced features' : 'Show advanced features') : undefined}
              aria-label={showAdvancedFeatures ? 'Hide advanced features' : 'Show advanced features'}
              className={`flex items-center gap-2 w-full rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAdvancedFeatures ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
              </svg>
              {!collapsed && (
                <span>{showAdvancedFeatures ? 'Hide Advanced' : 'Show Advanced'}</span>
              )}
            </button>
          </div>
        )}

        {/* Feature #1364: Reset preferences option */}
        {!collapsed && (pinnedItems.length > 0 || collapsedSections.length > 0) && (
          <div className="mt-2 pt-2 border-t border-border">
            <button
              onClick={resetNavPreferences}
              className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reset Layout</span>
            </button>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-2">
        {/* Feature #167: Connection status indicator */}
        {collapsed ? (
          <div className="flex justify-center mb-2 py-2">
            <ConnectionStatusIndicator collapsed={true} />
          </div>
        ) : (
          <ConnectionStatusIndicator collapsed={false} />
        )}

        {!collapsed && (
          <div className="mb-2 px-3 py-2">
            <div className="text-sm font-medium text-foreground">{user?.name}</div>
            <div className="text-xs text-muted-foreground">{user?.role}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          aria-label="Logout"
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogoutIcon />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
