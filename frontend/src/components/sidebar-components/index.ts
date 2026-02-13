/**
 * Sidebar Component Library
 *
 * Barrel file exporting all sidebar-related components and types.
 * Extracted from Sidebar.tsx for Feature #104.
 */

// Icons
export {
  DashboardIcon,
  ProjectsIcon,
  SchedulesIcon,
  AnalyticsIcon,
  TeamIcon,
  SettingsIcon,
  BillingIcon,
  ApiKeysIcon,
  AuditLogsIcon,
  WebhooksIcon,
  CollapseIcon,
  ExpandIcon,
  LogoutIcon,
  BellIcon,
  VisualReviewIcon,
  SecurityIcon,
  SecurityGroupIcon,
  DASTIcon,
  DependenciesIcon,
  SecretsIcon,
  ContainerScanIcon,
  MonitoringIcon,
  ServicesIcon,
  AIInsightsIcon,
  AIGroupIcon,
  AITestGeneratorIcon,
  MCPToolsIcon,
  MCPPlaygroundIcon,
  MCPAnalyticsIcon,
  MCPChatIcon,
  MCPAutopilotIcon,
  MCPDocumentationIcon,
  // Feature #884: MCPReleaseNotesIcon removed
  MCPScheduleOptimizerIcon,
  MCPTeamInsightsIcon,
  TechnicalDebtIcon,
  OrgInsightsIcon,
  // Feature #453: BestPracticesIcon, IndustryBenchmarkIcon removed (orphaned)
  // Feature #885: TestDocumentationIcon removed
  TestingGroupIcon,
  TestSuitesIcon,
  TestResultsIcon,
  RunHistoryIcon,
  // Feature #884: ReleaseNotesIcon removed
  // Feature #453: PersonalizedInsightsIcon, TeamSkillsIcon, AILearningIcon removed (orphaned)
} from './SidebarIcons';

// Components
export { NotificationDropdown } from './NotificationDropdown';
export { NavItem, NavItemWithBadge, PinIcon } from './NavItem';
export type { NavItemProps, NavItemWithBadgeProps } from './NavItem';
export { CollapsibleNavGroup } from './CollapsibleNavGroup';
export { OrganizationSwitcher, OrgSwitcherIcon, ChevronDownIcon, CheckIcon } from './OrganizationSwitcher';

// Types and utilities
export { hasAccess } from './types';
export type { UserRole, MenuVisibility, MenuItemConfig } from './types';
