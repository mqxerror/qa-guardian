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
  MCPReleaseNotesIcon,
  MCPScheduleOptimizerIcon,
  MCPTeamInsightsIcon,
  TechnicalDebtIcon,
  OrgInsightsIcon,
  BestPracticesIcon,
  IndustryBenchmarkIcon,
  TestDocumentationIcon,
  TestingGroupIcon,
  TestSuitesIcon,
  TestResultsIcon,
  RunHistoryIcon,
  ReleaseNotesIcon,
  PersonalizedInsightsIcon,
  TeamSkillsIcon,
  AILearningIcon,
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
