/**
 * AppSidebar Component - Feature #255, #256
 *
 * Rebuilt using shadcn/ui Sidebar primitives (21st.dev integration).
 * Feature #256: Collapsible navigation groups with icon-only collapsed mode.
 *
 * Navigation Groups per spec:
 * 1. Always visible: Dashboard, Projects
 * 2. Testing (expanded by default): Schedules, Visual Review, Analytics
 * 3. Security & Quality (collapsed): Security Dashboard, NPM Audit, Container Scan, SBOM, Dependency Tree, DAST Comparison, License Compliance, Monitoring
 * 4. AI Features (collapsed): AI Insights, Test Generator, AI Chat
 * 5. Settings (collapsed): Team, Settings, Billing, API Keys
 * 6. Developer Tools (collapsed, dev+ role): MCP Hub, Audit Logs
 *
 * Features:
 * - Role-based visibility (viewer, qa, developer, admin, owner)
 * - Pinned items with localStorage persistence
 * - Keyboard shortcuts (G+T, G+S, G+A, G+D, G+M)
 * - Collapsible navigation groups with localStorage persistence
 * - Icon-only collapsed mode with tooltips
 * - Organization switcher
 * - Notification dropdown
 * - Connection status indicator
 * - Security alert badges
 * - Visual review pending count
 */
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
// Feature #513: Removed unused Bell import
import { ChevronDown, ChevronRight, Pin, LogOut, RefreshCw, Eye, EyeOff, Building2, Check, Users, Key, CreditCard, ClipboardList, Bot, Zap, Sun, Moon, Monitor, Keyboard } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore, SidebarSection } from '../stores/sidebarStore';
import { useVisualReviewStore } from '../stores/visualReviewStore';
import { useThemeStore, type Theme } from '../stores/themeStore';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { usePrefetch } from '../hooks/usePrefetch';
import { createLogger } from '../utils/logger';

const log = createLogger('Sidebar');

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Feature #513: Tooltip, TooltipContent, TooltipTrigger - currently unused (collapsed mode tooltips planned)
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipTrigger,
// } from '@/components/ui/tooltip';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Import existing icons
// Feature #513: Removed unused LogoutIcon, ServicesIcon - using lucide-react LogOut instead
import {
  DashboardIcon,
  ProjectsIcon,
  SchedulesIcon,
  AnalyticsIcon,
  SettingsIcon,
  VisualReviewIcon,
  SecurityIcon,
  AIInsightsIcon,
  AITestGeneratorIcon,
  MCPToolsIcon,
  TestingGroupIcon,
  RunHistoryIcon,
} from './sidebar-components/SidebarIcons';

// Import types
import { MenuItemConfig, UserRole, hasAccess } from './sidebar-components/types';

export function AppSidebar() {
  const { user, logout, token, organizations, fetchOrganizations, switchOrganization } = useAuthStore();
  const { collapsedSections, toggleSection: storeToggleSection, expandSection, setCollapsedSections } = useSidebarStore();
  const { pendingCount, fetchPendingCount } = useVisualReviewStore();
  const { theme, setTheme } = useThemeStore();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { state } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const prefetch = usePrefetch();
  const isCollapsed = state === 'collapsed';

  // Feature #1502: Security alert count for badge
  const [securityAlertCount, setSecurityAlertCount] = useState(0);

  // Feature #1502: Fetch security alert count
  useEffect(() => {
    const fetchSecurityAlerts = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/v1/sast/dashboard?severity=CRITICAL,HIGH&limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const count = (data.summary?.bySeverity?.critical || 0) + (data.summary?.bySeverity?.high || 0);
          setSecurityAlertCount(count);
        }
      } catch (error) {
        log.debug('Could not fetch security alerts:', error);
      }
    };
    fetchSecurityAlerts();
    const interval = setInterval(fetchSecurityAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  // Feature #1363: Advanced features toggle
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('qa-guardian-show-advanced-features');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  // Feature #1364: Pinned items
  const [pinnedItems, setPinnedItems] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('qa-guardian-pinned-items');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist preferences
  useEffect(() => {
    try {
      localStorage.setItem('qa-guardian-show-advanced-features', JSON.stringify(showAdvancedFeatures));
    } catch { /* storage unavailable */ }
  }, [showAdvancedFeatures]);

  useEffect(() => {
    try {
      localStorage.setItem('qa-guardian-pinned-items', JSON.stringify(pinnedItems));
    } catch { /* storage unavailable */ }
  }, [pinnedItems]);

  // Feature #1364: Toggle pin
  const togglePin = (path: string) => {
    setPinnedItems(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
  };

  // Feature #1364: Toggle section
  const toggleSection = (section: string) => {
    storeToggleSection(section as SidebarSection);
  };

  // Feature #1364, #256: Reset preferences with default collapsed groups
  const resetNavPreferences = () => {
    const defaultCollapsed: SidebarSection[] = ['tools', 'admin', 'security', 'ai-mcp', 'settings', 'developer-tools'];
    setPinnedItems([]);
    setCollapsedSections(defaultCollapsed);
    setShowAdvancedFeatures(false);
    try {
      localStorage.removeItem('qa-guardian-pinned-items');
      localStorage.removeItem('qa-guardian-show-advanced-features');
    } catch { /* storage unavailable */ }
  };

  const isPinned = (path: string) => pinnedItems.includes(path);
  const isSectionCollapsed = (section: SidebarSection) => {
    const sections = Array.isArray(collapsedSections) ? collapsedSections : [];
    return sections.includes(section);
  };

  // Feature #1505: Keyboard shortcuts
  const [showShortcutHints, setShowShortcutHints] = useState(false);
  const shortcutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let waitingForSecondKey = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key.toLowerCase() === 'g' && !waitingForSecondKey) {
        waitingForSecondKey = true;
        setShowShortcutHints(true);

        if (shortcutTimeoutRef.current) {
          clearTimeout(shortcutTimeoutRef.current);
        }

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
            e.preventDefault();
            expandSection('tools');
            navigate('/projects');
            break;
          case 's':
            e.preventDefault();
            expandSection('admin');
            navigate('/security');
            break;
          case 'a':
            e.preventDefault();
            expandSection('tools');
            navigate('/ai-insights');
            break;
          case 'd':
            e.preventDefault();
            navigate('/dashboard');
            break;
          case 'm':
            e.preventDefault();
            expandSection('admin');
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

  // Fetch visual review pending count
  useEffect(() => {
    if (token) {
      fetchPendingCount(token);
    }
  }, [token, fetchPendingCount]);

  useEffect(() => {
    if (token && location.pathname !== '/visual-review') {
      const timer = setTimeout(() => fetchPendingCount(token), 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, token, fetchPendingCount]);

  // Fetch organizations
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  // Phase 2: Simplified sidebar structure
  // Tools group (collapsed by default) - merges Testing + AI
  const toolsMenuItems: MenuItemConfig[] = [
    { path: '/visual-review', icon: <VisualReviewIcon />, label: 'Visual Review', visibility: 'all' },
    { path: '/analytics', icon: <AnalyticsIcon />, label: 'Analytics', visibility: 'qa' },
    // T1.1: relabel — this path redirects to /ai/flaky-tests, so "Flaky Tests"
    // is what the user actually lands on. Old label was "AI Insights" which
    // implied a broader dashboard that doesn't exist yet.
    { path: '/ai-insights', icon: <AIInsightsIcon />, label: 'Flaky Tests', visibility: 'all' },
    { path: '/ai/test-generator', icon: <AITestGeneratorIcon />, label: 'Test Generator', visibility: 'qa' },
    { path: '/mcp/chat', icon: <MCPToolsIcon />, label: 'AI Chat', visibility: 'all' },
  ];

  // Admin group (collapsed by default) - merges Security + Settings + Developer Tools
  //
  // T1.1: the Settings page uses `?tab=<name>` query params, NOT nested routes.
  // Prior hrefs like /settings/team produced 404s because no such route was
  // registered. Switching to query-param style so all sub-tabs actually load.
  const adminMenuItems: MenuItemConfig[] = [
    { path: '/security', icon: <SecurityIcon />, label: 'Security Dashboard', visibility: 'qa' },
    { path: '/settings?tab=team', icon: <Users className="h-4 w-4" />, label: 'Team', visibility: 'admin' },
    { path: '/settings', icon: <SettingsIcon />, label: 'Settings', visibility: 'developer' },
    { path: '/ai/router', icon: <Bot className="h-4 w-4" />, label: 'AI Providers', visibility: 'admin' },
    { path: '/settings?tab=api-keys', icon: <Key className="h-4 w-4" />, label: 'API Keys', visibility: 'developer' },
    { path: '/settings?tab=billing', icon: <CreditCard className="h-4 w-4" />, label: 'Billing', visibility: 'admin' },
    { path: '/mcp', icon: <MCPToolsIcon />, label: 'MCP Hub', visibility: 'developer' },
    { path: '/settings?tab=audit-logs', icon: <ClipboardList className="h-4 w-4" />, label: 'Audit Logs', visibility: 'admin' },
  ];

  // Legacy groups kept for backwards compatibility with existing code paths
  const testingMenuItems: MenuItemConfig[] = [];
  const securityMenuItems: MenuItemConfig[] = [];
  const aiMenuItems: MenuItemConfig[] = [];
  const settingsMenuItems: MenuItemConfig[] = [];
  const developerToolsMenuItems: MenuItemConfig[] = [];

  // Filter menu items based on role
  const filterMenuItems = (items: MenuItemConfig[]): MenuItemConfig[] => {
    return items.filter(item => {
      const hasRoleAccess = hasAccess(user?.role as UserRole, item.visibility);
      if (item.advancedOnly) {
        const isDeveloperPlus = user?.role === 'developer' || user?.role === 'admin' || user?.role === 'owner';
        if (isDeveloperPlus) return true;
        return showAdvancedFeatures;
      }
      return hasRoleAccess;
    });
  };

  // Phase 2: Filter for new simplified groups
  const visibleToolsItems = filterMenuItems(toolsMenuItems);
  const visibleAdminItems = filterMenuItems(adminMenuItems);

  // Legacy (empty arrays, kept for backwards compat with pinned items logic)
  const visibleTestingItems = filterMenuItems(testingMenuItems);
  const visibleSecurityItems = filterMenuItems(securityMenuItems);
  const visibleAiItems = filterMenuItems(aiMenuItems);
  const visibleSettingsItems = filterMenuItems(settingsMenuItems);
  const visibleDeveloperToolsItems = filterMenuItems(developerToolsMenuItems);

  // Active item detection for new groups
  const hasActiveToolsItem = isActive('/visual-review') || isActive('/analytics') ||
    location.pathname.startsWith('/ai-insights') || location.pathname.startsWith('/ai/') || isActive('/mcp/chat');
  const hasActiveAdminItem = location.pathname.startsWith('/security') || isActive('/monitoring') ||
    location.pathname.startsWith('/settings') || isActive('/mcp') || isActive('/audit-logs');

  // Organization handling
  const currentOrg = organizations.find(org => org.is_current) || organizations.find(org => org.id === user?.organization_id);
  const [isOrgLoading, setIsOrgLoading] = useState(false);

  const handleOrgSwitch = async (orgId: string) => {
    if (orgId === user?.organization_id) return;
    setIsOrgLoading(true);
    try {
      await switchOrganization(orgId);
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to switch organization:', error);
    } finally {
      setIsOrgLoading(false);
    }
  };

  // Render nav item with shadcn primitives
  const renderNavItem = (item: MenuItemConfig, options?: { showBadge?: boolean; badgeCount?: number }) => {
    const active = isActive(item.path) ||
      (item.path === '/projects' && location.pathname.startsWith('/projects/')) ||
      (item.path === '/ai-insights' && location.pathname.startsWith('/ai-insights')) ||
      (item.path === '/ai/test-generator' && location.pathname.startsWith('/ai/')) ||
      (item.path === '/mcp' && location.pathname.startsWith('/mcp'));
    const pinned = isPinned(item.path);

    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.label}
          onMouseEnter={item.path === '/dashboard' ? prefetch.dashboard : item.path === '/projects' ? prefetch.projects : undefined}
        >
          <Link to={item.path} className="relative group">
            {item.icon}
            <span>{item.label}</span>
            {!isCollapsed && pinned && (
              <Pin className="h-3 w-3 ml-auto text-primary/60 fill-primary/60" />
            )}
          </Link>
        </SidebarMenuButton>
        {options?.showBadge && options.badgeCount && options.badgeCount > 0 && (
          <SidebarMenuBadge className="bg-warning text-warning-foreground">
            {options.badgeCount > 99 ? '99+' : options.badgeCount}
          </SidebarMenuBadge>
        )}
        {!isCollapsed && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(item.path); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent transition-all"
            title={pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className={`h-3 w-3 ${pinned ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
          </button>
        )}
      </SidebarMenuItem>
    );
  };

  // Render collapsible group
  const renderCollapsibleGroup = (
    label: string,
    sectionId: SidebarSection,
    icon: React.ReactNode,
    items: MenuItemConfig[],
    hasActiveChild: boolean,
    options?: { badge?: number; badgeColor?: string; shortcutKey?: string }
  ) => {
    const isExpanded = !isSectionCollapsed(sectionId);

    if (items.length === 0) return null;

    return (
      <Collapsible open={isExpanded} onOpenChange={() => toggleSection(sectionId)} className="group/collapsible">
        <SidebarGroup>
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 relative">
              <div className="flex items-center gap-2 flex-1">
                {icon}
                <span className="text-xs font-semibold uppercase">{label}</span>
                {showShortcutHints && options?.shortcutKey && (
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] text-primary-foreground font-bold animate-pulse">
                    {options.shortcutKey}
                  </span>
                )}
                {!showShortcutHints && options?.badge && options.badge > 0 && (
                  <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full ${options.badgeColor === 'red' ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'} text-xs font-bold px-1`}>
                    {options.badge > 99 ? '99+' : options.badge}
                  </span>
                )}
                {!showShortcutHints && !isExpanded && hasActiveChild && (
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map(item => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      {/* Header with SidebarTrigger */}
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center justify-between px-2 py-1">
          {!isCollapsed ? (
            <>
              <h1 className="text-xl font-bold text-foreground">QA Guardian</h1>
              <SidebarTrigger className="h-7 w-7" />
            </>
          ) : (
            <SidebarTrigger className="h-7 w-7 mx-auto" />
          )}
        </div>

        {/* Organization Switcher */}
        {organizations.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isOrgLoading}
                className={`flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                } ${isOrgLoading ? 'opacity-50 cursor-wait' : ''}`}
              >
                <Building2 className="h-4 w-4" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate text-foreground">
                      {currentOrg?.name || 'Select Org'}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleOrgSwitch(org.id)}
                  disabled={isOrgLoading}
                  className={org.is_current || org.id === user?.organization_id ? 'bg-primary/10' : ''}
                >
                  <span className="flex-1">{org.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{org.role}</span>
                  {(org.is_current || org.id === user?.organization_id) && (
                    <Check className="h-4 w-4 ml-2" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        {/* Pinned Items */}
        {pinnedItems.length > 0 && !isCollapsed && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1">
              <Pin className="h-3 w-3 fill-current" /> Pinned
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {[
                  { path: '/dashboard', icon: <DashboardIcon />, label: 'Dashboard', visibility: 'all' as const },
                  { path: '/projects', icon: <ProjectsIcon />, label: 'Projects', visibility: 'all' as const },
                  ...visibleTestingItems, ...visibleSecurityItems, ...visibleAiItems, ...visibleSettingsItems, ...visibleDeveloperToolsItems,
                ]
                  .filter(item => isPinned(item.path))
                  .map(item => renderNavItem(item, { showBadge: item.path === '/visual-review', badgeCount: pendingCount }))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {pinnedItems.length > 0 && !isCollapsed && <SidebarSeparator />}

        {/* Phase 2: Always Visible - Dashboard, Quick Test, Projects, Runs, Schedules */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItem({ path: '/dashboard', icon: <DashboardIcon />, label: 'Dashboard', visibility: 'all' })}
              {renderNavItem({ path: '/quick-test', icon: <Zap className="h-4 w-4" />, label: 'Quick Test', visibility: 'all' })}
              {renderNavItem({ path: '/projects', icon: <ProjectsIcon />, label: 'Projects', visibility: 'all' })}
              {renderNavItem({ path: '/run-history', icon: <RunHistoryIcon />, label: 'Runs', visibility: 'all' })}
              {renderNavItem({ path: '/schedules', icon: <SchedulesIcon />, label: 'Schedules', visibility: 'all' })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Phase 2: Tools (collapsed) - Visual Review, Analytics, AI features */}
        {renderCollapsibleGroup('Tools', 'tools', <TestingGroupIcon />, visibleToolsItems, hasActiveToolsItem, { shortcutKey: 'T', badge: pendingCount, badgeColor: 'amber' })}

        {/* Phase 2: Admin (collapsed) - Security, Settings, DevTools */}
        {visibleAdminItems.length > 0 && renderCollapsibleGroup('Admin', 'admin', <SettingsIcon />, visibleAdminItems, hasActiveAdminItem, { badge: securityAlertCount, badgeColor: 'red', shortcutKey: 'S' })}

        {/* Advanced Features Toggle for viewers */}
        {user?.role === 'viewer' && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setShowAdvancedFeatures(!showAdvancedFeatures)}
                    tooltip={showAdvancedFeatures ? 'Hide Advanced' : 'Show Advanced'}
                  >
                    {showAdvancedFeatures ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span>{showAdvancedFeatures ? 'Hide Advanced' : 'Show Advanced'}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Reset Preferences */}
        {!isCollapsed && (pinnedItems.length > 0 || collapsedSections.length > 0) && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={resetNavPreferences} tooltip="Reset Layout">
                    <RefreshCw className="h-4 w-4" />
                    <span>Reset Layout</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border">
        {/* Connection Status */}
        <div className={`${isCollapsed ? 'flex justify-center' : ''}`}>
          <ConnectionStatusIndicator collapsed={isCollapsed} />
        </div>

        {/* User Info */}
        {!isCollapsed && user && (
          <div className="px-3 py-2">
            <div className="text-sm font-medium text-foreground">{user.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
          </div>
        )}

        {/* Theme toggle — cycles through light → dark → system */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
                setTheme(next);
              }}
              tooltip={`Theme: ${theme} (click to switch)`}
            >
              {theme === 'light' ? (
                <Sun className="h-4 w-4" />
              ) : theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
              <span className="capitalize">{theme} theme</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Keyboard shortcuts help */}
          <SidebarMenuItem>
            <DropdownMenu open={showShortcuts} onOpenChange={setShowShortcuts}>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip="Keyboard shortcuts">
                  <Keyboard className="h-4 w-4" />
                  <span>Shortcuts</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-64">
                <DropdownMenuLabel>Keyboard Shortcuts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">G</kbd> then:
                </div>
                {[
                  { keys: 'D', label: 'Dashboard' },
                  { keys: 'T', label: 'Projects' },
                  { keys: 'S', label: 'Security' },
                  { keys: 'A', label: 'Flaky Tests' },
                  { keys: 'M', label: 'MCP Hub' },
                ].map((s) => (
                  <div key={s.keys} className="flex items-center justify-between px-2 py-1.5 text-sm">
                    <span className="text-foreground">{s.label}</span>
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">G + {s.keys}</kbd>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>

          {/* Logout */}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
