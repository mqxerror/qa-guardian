import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore, SidebarSection } from '../stores/sidebarStore';
import { useNotificationStore, InAppNotification } from '../stores/notificationStore';
import { useVisualReviewStore } from '../stores/visualReviewStore';

// Icons as simple SVG components
const DashboardIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ProjectsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const SchedulesIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const TeamIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const SettingsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const BillingIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const ApiKeysIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const AuditLogsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// Feature #1301: Webhooks icon
const WebhooksIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const CollapseIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

const ExpandIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

const LogoutIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const BellIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

// Visual Review icon (eye with comparison)
const VisualReviewIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

// Security Dashboard icon (shield with check)
const SecurityIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

// Feature #1502: Security group icon (shield - smaller for group header)
const SecurityGroupIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

// DAST Scanning icon (radar/scan)
const DASTIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

// Dependencies icon (package/box)
const DependenciesIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

// Secrets icon (key)
const SecretsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

// Container Scan icon (cube/container)
const ContainerScanIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

// Monitoring icon (activity/pulse)
const MonitoringIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// Feature #2128: Services icon (server/stack)
const ServicesIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

// AI Insights icon (brain with sparkle)
const AIInsightsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

// Feature #1503: AI & MCP group icon (sparkle/star with connecting dots)
const AIGroupIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

// Feature #1503: AI Test Generator icon (beaker/flask with sparkle)
const AITestGeneratorIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

// MCP Tools icon (wrench with API connector)
const MCPToolsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// MCP Playground icon (play button in a terminal)
const MCPPlaygroundIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// MCP Analytics icon (chart/graph)
const MCPAnalyticsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// MCP Chat icon (chat bubble with AI sparkle)
const MCPChatIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

// MCP Autopilot icon (robot/automation)
const MCPAutopilotIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

// Feature #1442: MCPProductionRiskIcon removed
// Feature #1443: MCPTechDebtIcon removed
// Feature #1444: MCPTestDiscoveryIcon removed

// Feature #1271: MCP Documentation icon (document with text)
const MCPDocumentationIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// Feature #1272: MCP Release Notes icon (tag with version)
const MCPReleaseNotesIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

// Feature #1273: MCP Schedule Optimizer icon (clock with gear)
const MCPScheduleOptimizerIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Feature #1274: MCP Team Insights icon (users with chart)
const MCPTeamInsightsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

// Technical Debt icon (scales/balance)
const TechnicalDebtIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
  </svg>
);

// Organization Insights icon (building with connected nodes)
const OrgInsightsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

// Best Practices icon (trophy/award)
const BestPracticesIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

// Industry Benchmark icon (bar chart with trend line)
const IndustryBenchmarkIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// Test Documentation icon (document with code)
const TestDocumentationIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// Feature #1501: Testing group icon (beaker/test tube)
const TestingGroupIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

// Test Suites icon (folder with checkmark)
const TestSuitesIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

// Test Results icon (clipboard with list)
const TestResultsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

// Feature #1855: Run History icon (clock)
const RunHistoryIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Release Notes icon (tag with document)
const ReleaseNotesIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

// Personalized Insights icon (target with user)
const PersonalizedInsightsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Team Skills icon (graduation cap with people)
const TeamSkillsIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
  </svg>
);

// AI Learning icon (brain with sparkles)
const AILearningIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

// Notification dropdown component
function NotificationDropdown({ collapsed }: { collapsed: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotificationStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'test_complete':
        return '✅';
      case 'test_failed':
        return '❌';
      case 'schedule_triggered':
        return '⏰';
      case 'alert':
        return '⚠️';
      default:
        return '📣';
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={collapsed ? 'Notifications' : undefined}
        aria-label="Notifications"
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground relative ${
          collapsed ? 'justify-center' : 'w-full'
        }`}
      >
        <BellIcon />
        {!collapsed && <span>Notifications</span>}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-1 rounded-md border border-border bg-card shadow-lg ${
          collapsed ? 'left-full ml-2 w-80' : 'left-0 w-full min-w-80'
        }`}>
          <div className="flex items-center justify-between border-b border-border p-3">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => clearNotifications()}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                  className={`flex items-start gap-3 p-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted transition-colors ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium truncate ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatTime(notification.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Feature #1364: Pin icon for menu items
const PinIcon = ({ filled }: { filled?: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  isActive: boolean;
  // Feature #1364: Pin functionality
  isPinned?: boolean;
  onTogglePin?: (path: string) => void;
  showPinIcon?: boolean;
}

function NavItem({ to, icon, label, collapsed, isActive, isPinned, onTogglePin, showPinIcon = true }: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        to={to}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        } ${collapsed ? 'justify-center' : ''}`}
      >
        {icon}
        {!collapsed && <span className="flex-1">{label}</span>}
        {/* Feature #1364: Pin indicator when pinned (always visible) */}
        {!collapsed && isPinned && !isHovered && (
          <span className="text-primary/60">
            <PinIcon filled />
          </span>
        )}
      </Link>
      {/* Feature #1364: Pin button on hover */}
      {!collapsed && showPinIcon && onTogglePin && isHovered && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin(to);
          }}
          title={isPinned ? 'Unpin from sidebar' : 'Pin to top of sidebar'}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted-foreground/20 transition-colors ${
            isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <PinIcon filled={isPinned} />
        </button>
      )}
    </div>
  );
}

// NavItem with badge support for counts
interface NavItemWithBadgeProps extends NavItemProps {
  badgeCount: number;
}

function NavItemWithBadge({ to, icon, label, collapsed, isActive, badgeCount, isPinned, onTogglePin, showPinIcon = true }: NavItemWithBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        to={to}
        title={collapsed ? `${label}${badgeCount > 0 ? ` (${badgeCount} pending)` : ''}` : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        } ${collapsed ? 'justify-center' : ''}`}
      >
        {icon}
        {!collapsed && <span className="flex-1">{label}</span>}
        {badgeCount > 0 && (
          <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 text-xs text-white font-bold px-1 ${
            collapsed ? 'absolute top-1 right-1' : ''
          }`}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
        {/* Feature #1364: Pin indicator when pinned (always visible) */}
        {!collapsed && isPinned && !isHovered && badgeCount === 0 && (
          <span className="text-primary/60">
            <PinIcon filled />
          </span>
        )}
      </Link>
      {/* Feature #1364: Pin button on hover */}
      {!collapsed && showPinIcon && onTogglePin && isHovered && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin(to);
          }}
          title={isPinned ? 'Unpin from sidebar' : 'Pin to top of sidebar'}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted-foreground/20 transition-colors ${
            isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          } ${badgeCount > 0 ? 'right-10' : ''}`}
        >
          <PinIcon filled={isPinned} />
        </button>
      )}
    </div>
  );
}

/**
 * Feature #1501: Collapsible Navigation Group Component
 * Feature #1502: Added badge support for security alerts
 *
 * A reusable component for creating collapsible sections in the sidebar.
 * Features:
 * - Expand/collapse with animated chevron icon
 * - Smooth height transition animation
 * - Shows active indicator dot when any child item is active (even when collapsed)
 * - State persisted via parent component (localStorage)
 * - Optional badge count for alerts/notifications
 */
interface CollapsibleNavGroupProps {
  label: string;
  collapsed: boolean;  // sidebar collapsed state
  isExpanded: boolean; // group expanded state
  onToggle: () => void;
  hasActiveChild: boolean;
  sectionId?: string; // Feature #1509: For scroll-to-section support
  children: React.ReactNode;
  icon?: React.ReactNode;
  badgeCount?: number; // Feature #1502: Optional badge for alerts
  badgeColor?: 'amber' | 'red' | 'primary'; // Feature #1502: Badge color variant
  shortcutKey?: string; // Feature #1505: Keyboard shortcut key hint
  showShortcutHint?: boolean; // Feature #1505: Whether to show shortcut hint
}

function CollapsibleNavGroup({
  label,
  collapsed,
  isExpanded,
  onToggle,
  hasActiveChild,
  children,
  icon,
  badgeCount = 0,
  badgeColor = 'amber',
  shortcutKey,
  showShortcutHint = false,
  sectionId
}: CollapsibleNavGroupProps) {
  // Badge color class mapping
  const badgeColorClass = {
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    primary: 'bg-primary'
  }[badgeColor];

  // When sidebar is collapsed, show just the icon or a small indicator
  if (collapsed) {
    return (
      <div className="relative" data-section={sectionId}>
        <button
          onClick={onToggle}
          title={`${label}${badgeCount > 0 ? ` (${badgeCount} alerts)` : ''}${shortcutKey ? ` (G+${shortcutKey})` : ''}`}
          className={`flex items-center justify-center w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            hasActiveChild
              ? 'text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          {icon || (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          )}
          {/* Feature #1505: Shortcut hint when G is pressed */}
          {showShortcutHint && shortcutKey && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] text-white font-bold animate-pulse shadow-lg">
              {shortcutKey}
            </span>
          )}
          {/* Badge when collapsed - takes priority over active indicator (when not showing shortcut) */}
          {!showShortcutHint && badgeCount > 0 ? (
            <span className={`absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full ${badgeColorClass} text-[10px] text-white font-bold`}>
              {badgeCount > 9 ? '!' : badgeCount}
            </span>
          ) : !showShortcutHint && hasActiveChild && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1" data-section={sectionId}>
      {/* Group header */}
      <button
        onClick={onToggle}
        className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          hasActiveChild
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <span className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
          {/* Feature #1505: Shortcut hint when G is pressed */}
          {showShortcutHint && shortcutKey && (
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] text-white font-bold animate-pulse">
              {shortcutKey}
            </span>
          )}
          {/* Badge - takes priority over active indicator (when not showing shortcut) */}
          {!showShortcutHint && badgeCount > 0 ? (
            <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full ${badgeColorClass} text-xs text-white font-bold px-1`}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          ) : !showShortcutHint && !isExpanded && hasActiveChild && (
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
        </span>
        {/* Animated chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform duration-200 ease-in-out ${isExpanded ? '' : '-rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Animated content container */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pl-2 space-y-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// Organization Switcher Icon
const OrgSwitcherIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Organization Switcher component
function OrganizationSwitcher({ collapsed }: { collapsed: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, organizations, fetchOrganizations, switchOrganization } = useAuthStore();

  // Fetch organizations on mount
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentOrg = organizations.find(org => org.is_current) || organizations.find(org => org.id === user?.organization_id);

  const handleSwitch = async (orgId: string) => {
    if (orgId === user?.organization_id) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      await switchOrganization(orgId);
      setIsOpen(false);
      // Navigate to dashboard to refresh data for the new organization
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to switch organization:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if only one organization
  if (organizations.length <= 1) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative px-2 mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        title={collapsed ? currentOrg?.name || 'Switch Organization' : undefined}
        className={`flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors ${
          collapsed ? 'justify-center' : ''
        } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
      >
        <OrgSwitcherIcon />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate text-foreground">
              {currentOrg?.name || 'Select Org'}
            </span>
            <ChevronDownIcon />
          </>
        )}
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-1 rounded-md border border-border bg-card shadow-lg ${
          collapsed ? 'left-full ml-2 w-56' : 'left-2 right-2'
        }`}>
          <div className="p-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground">Switch Organization</p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                disabled={isLoading}
                className={`flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-left transition-colors ${
                  org.is_current || org.id === user?.organization_id
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <span className="flex-1 truncate">{org.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{org.role}</span>
                {(org.is_current || org.id === user?.organization_id) && (
                  <CheckIcon />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Feature #1363: Role-based menu visibility configuration
 *
 * Menu items are organized by role:
 * - 'all': Visible to all authenticated users
 * - 'qa': QA-focused features (testing, visual review, analytics)
 * - 'developer': Developer tools (MCP, API keys)
 * - 'admin': Administrative features (team, settings, billing)
 * - 'owner': Owner-only features (billing)
 */
type UserRole = 'owner' | 'admin' | 'developer' | 'viewer';
type MenuVisibility = 'all' | 'qa' | 'developer' | 'admin' | 'owner';

interface MenuItemConfig {
  path: string;
  icon: React.ReactNode;
  label: string;
  visibility: MenuVisibility;
  // Some items should be shown if user has advanced features enabled
  advancedOnly?: boolean;
}

// Check if user role has access to menu visibility level
function hasAccess(userRole: UserRole | undefined, visibility: MenuVisibility): boolean {
  if (!userRole) return false;

  switch (visibility) {
    case 'all':
      return true;
    case 'qa':
      // QA features available to all roles
      return true;
    case 'developer':
      // Developer features for developers, admins, and owners
      return userRole === 'developer' || userRole === 'admin' || userRole === 'owner';
    case 'admin':
      // Admin features for admins and owners
      return userRole === 'admin' || userRole === 'owner';
    case 'owner':
      // Owner-only features
      return userRole === 'owner';
    default:
      return false;
  }
}

export function Sidebar() {
  const { user, logout, token } = useAuthStore();
  const { collapsed, toggle } = useSidebarStore();
  const { pendingCount, fetchPendingCount } = useVisualReviewStore();
  const navigate = useNavigate();
  const location = useLocation();

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
    } catch {}
  }, [showAdvancedFeatures]);

  // Feature #1364: Persist pinned items
  useEffect(() => {
    try {
      localStorage.setItem('qa-guardian-pinned-items', JSON.stringify(pinnedItems));
    } catch {}
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
    } catch {}
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
    { path: '/security/trivy', icon: <DependenciesIcon />, label: 'Dependencies', visibility: 'qa' },
    { path: '/security/containers', icon: <ContainerScanIcon />, label: 'Container Scan', visibility: 'qa' },
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
  const mcpMenuItems: MenuItemConfig[] = [
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
  const visibleMcpItems = filterMenuItems(mcpMenuItems);

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
        {!collapsed && (
          <div className="mb-2 px-3 py-2">
            <div className="text-sm font-medium text-foreground">{user?.name}</div>
            <div className="text-xs text-muted-foreground">{user?.role}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
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
