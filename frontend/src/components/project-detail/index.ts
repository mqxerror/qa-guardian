/**
 * Project Detail Components
 * Feature #49: Modular project detail page
 */

// Types
export * from './types';

// Utilities
export * from './utils';

// Components
export { default as SuiteCard } from './SuiteCard';
export {
  SASTSeverityBadge,
  DASTRiskBadge,
  ScanStatusBadge,
  MemberRoleBadge,
} from './SeverityBadge';

// Hooks (Feature #49: Extracted from ProjectDetailPage)
export {
  useGitHubHandlers,
  type UseGitHubHandlersProps,
  type GitHubState,
  type GitHubHandlers,
} from './useGitHubHandlers';
export {
  useSastHandlers,
  type UseSastHandlersProps,
  type SastState,
  type SastHandlers,
} from './useSastHandlers';
export {
  useDastHandlers,
  type UseDastHandlersProps,
  type DastState,
  type DastHandlers,
} from './useDastHandlers';
export {
  useSettingsHandlers,
  type UseSettingsHandlersProps,
  type SettingsState,
  type SettingsHandlers,
} from './useSettingsHandlers';

// Tab Components (Feature #49: Extracted from ProjectDetailPage)
export { SecurityTab, type SecurityTabProps } from './SecurityTab';
export { GitHubTab, type GitHubTabProps } from './GitHubTab';
export { SettingsTab, type SettingsTabProps } from './SettingsTab';

// Modal Components (Feature #49: Extracted from ProjectDetailPage)
export { ProjectModals, type ProjectModalsProps } from './ProjectModals';
