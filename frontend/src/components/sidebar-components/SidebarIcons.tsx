/**
 * Sidebar Icon Components
 *
 * All Lucide icon components used in the sidebar navigation.
 * Refactored from inline SVGs to Lucide for Feature #632.
 */
import {
  Home,
  FolderOpen,
  Calendar,
  BarChart3,
  Users,
  Settings,
  CreditCard,
  Key,
  FileText,
  Bell,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Eye,
  ShieldCheck,
  Map,
  Package,
  Box,
  Activity,
  Server,
  Lightbulb,
  Sparkles,
  FlaskConical,
  Cog,
  Terminal,
  MessageCircle,
  Monitor,
  BookOpen,
  Tag,
  Clock,
  UsersRound,
  Scale,
  Building,
  BadgeCheck,
  ClipboardList,
  History,
} from 'lucide-react';

// Icons as Lucide component wrappers
export const DashboardIcon = () => (
  <Home className="h-5 w-5" aria-hidden="true" />
);

export const ProjectsIcon = () => (
  <FolderOpen className="h-5 w-5" aria-hidden="true" />
);

export const SchedulesIcon = () => (
  <Calendar className="h-5 w-5" aria-hidden="true" />
);

export const AnalyticsIcon = () => (
  <BarChart3 className="h-5 w-5" aria-hidden="true" />
);

export const TeamIcon = () => (
  <Users className="h-5 w-5" aria-hidden="true" />
);

export const SettingsIcon = () => (
  <Settings className="h-5 w-5" aria-hidden="true" />
);

export const BillingIcon = () => (
  <CreditCard className="h-5 w-5" aria-hidden="true" />
);

export const ApiKeysIcon = () => (
  <Key className="h-5 w-5" aria-hidden="true" />
);

export const AuditLogsIcon = () => (
  <FileText className="h-5 w-5" aria-hidden="true" />
);

// Feature #1301: Webhooks icon
export const WebhooksIcon = () => (
  <Bell className="h-5 w-5" aria-hidden="true" />
);

export const CollapseIcon = () => (
  <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
);

export const ExpandIcon = () => (
  <ChevronsRight className="h-5 w-5" aria-hidden="true" />
);

export const LogoutIcon = () => (
  <LogOut className="h-5 w-5" aria-hidden="true" />
);

export const BellIcon = () => (
  <Bell className="h-5 w-5" aria-hidden="true" />
);

// Visual Review icon (eye with comparison)
export const VisualReviewIcon = () => (
  <Eye className="h-5 w-5" aria-hidden="true" />
);

// Security Dashboard icon (shield with check)
export const SecurityIcon = () => (
  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
);

// Feature #1502: Security group icon (shield - smaller for group header)
export const SecurityGroupIcon = () => (
  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
);

// DAST Scanning icon (radar/scan)
export const DASTIcon = () => (
  <Map className="h-5 w-5" aria-hidden="true" />
);

// Dependencies icon (package/box)
export const DependenciesIcon = () => (
  <Package className="h-5 w-5" aria-hidden="true" />
);

// Secrets icon (key)
export const SecretsIcon = () => (
  <Key className="h-5 w-5" aria-hidden="true" />
);

// Container Scan icon (cube/container)
export const ContainerScanIcon = () => (
  <Box className="h-5 w-5" aria-hidden="true" />
);

// Monitoring icon (activity/pulse)
export const MonitoringIcon = () => (
  <Activity className="h-5 w-5" aria-hidden="true" />
);

// Feature #2128: Services icon (server/stack)
export const ServicesIcon = () => (
  <Server className="h-5 w-5" aria-hidden="true" />
);

// AI Insights icon (brain with sparkle)
export const AIInsightsIcon = () => (
  <Lightbulb className="h-5 w-5" aria-hidden="true" />
);

// Feature #1503: AI & MCP group icon (sparkle/star with connecting dots)
export const AIGroupIcon = () => (
  <Sparkles className="h-4 w-4" aria-hidden="true" />
);

// Feature #1503: AI Test Generator icon (beaker/flask with sparkle)
export const AITestGeneratorIcon = () => (
  <FlaskConical className="h-5 w-5" aria-hidden="true" />
);

// MCP Tools icon (wrench with API connector)
export const MCPToolsIcon = () => (
  <Cog className="h-5 w-5" aria-hidden="true" />
);

// MCP Playground icon (play button in a terminal)
export const MCPPlaygroundIcon = () => (
  <Terminal className="h-5 w-5" aria-hidden="true" />
);

// MCP Analytics icon (chart/graph)
export const MCPAnalyticsIcon = () => (
  <BarChart3 className="h-5 w-5" aria-hidden="true" />
);

// MCP Chat icon (chat bubble with AI sparkle)
export const MCPChatIcon = () => (
  <MessageCircle className="h-5 w-5" aria-hidden="true" />
);

// MCP Autopilot icon (robot/automation)
export const MCPAutopilotIcon = () => (
  <Monitor className="h-5 w-5" aria-hidden="true" />
);

// Feature #1271: MCP Documentation icon (document with text)
export const MCPDocumentationIcon = () => (
  <BookOpen className="h-5 w-5" aria-hidden="true" />
);

// Feature #1272: MCP Release Notes icon (tag with version)
export const MCPReleaseNotesIcon = () => (
  <Tag className="h-5 w-5" aria-hidden="true" />
);

// Feature #1273: MCP Schedule Optimizer icon (clock with gear)
export const MCPScheduleOptimizerIcon = () => (
  <Clock className="h-5 w-5" aria-hidden="true" />
);

// Feature #1274: MCP Team Insights icon (users with chart)
export const MCPTeamInsightsIcon = () => (
  <UsersRound className="h-5 w-5" aria-hidden="true" />
);

// Technical Debt icon (scales/balance)
export const TechnicalDebtIcon = () => (
  <Scale className="h-5 w-5" aria-hidden="true" />
);

// Organization Insights icon (building with connected nodes)
export const OrgInsightsIcon = () => (
  <Building className="h-5 w-5" aria-hidden="true" />
);

// Feature #453: BestPracticesIcon and IndustryBenchmarkIcon removed (orphaned - pages deleted)

// Test Documentation icon (document with code)
export const TestDocumentationIcon = () => (
  <FileText className="h-5 w-5" aria-hidden="true" />
);

// Feature #1501: Testing group icon (beaker/test tube)
export const TestingGroupIcon = () => (
  <FlaskConical className="h-4 w-4" aria-hidden="true" />
);

// Test Suites icon (folder with checkmark)
export const TestSuitesIcon = () => (
  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
);

// Test Results icon (clipboard with list)
export const TestResultsIcon = () => (
  <ClipboardList className="h-5 w-5" aria-hidden="true" />
);

// Feature #1855: Run History icon (clock)
export const RunHistoryIcon = () => (
  <History className="h-5 w-5" aria-hidden="true" />
);

// Release Notes icon (tag with document)
export const ReleaseNotesIcon = () => (
  <Tag className="h-5 w-5" aria-hidden="true" />
);

// Feature #453: PersonalizedInsightsIcon, TeamSkillsIcon, AILearningIcon removed (orphaned - pages deleted)
