/**
 * useCommandPaletteCommands - Custom hook that builds the full list of palette commands.
 * Extracted from AICommandPalette.tsx to keep the main component focused on rendering. (Agent 7)
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSidebarStore } from '../../stores/sidebarStore';
import type { CommandPaletteAction, AICommandResult } from './types';

interface UseCommandPaletteCommandsOptions {
  /** Callback to close the palette */
  close: () => void;
  /** Callback to start processing state */
  setIsProcessing: (v: boolean) => void;
  /** Callback to set the AI result */
  setAiResult: (r: AICommandResult | null) => void;
  /** Recent page paths (for building recent page commands) */
  recentPages: string[];
}

export function useCommandPaletteCommands({
  close,
  setIsProcessing,
  setAiResult,
  recentPages,
}: UseCommandPaletteCommandsOptions): CommandPaletteAction[] {
  const navigate = useNavigate();
  const { expandSection } = useSidebarStore();

  return useMemo(() => {
    // ---- Recent page commands ----
    const pageLabels: Record<string, { icon: string; label: string }> = {
      '/dashboard': { icon: '📊', label: 'Dashboard' },
      '/projects': { icon: '📁', label: 'Projects' },
      '/schedules': { icon: '📅', label: 'Schedules' },
      '/analytics': { icon: '📈', label: 'Analytics' },
      '/visual-review': { icon: '👁️', label: 'Visual Review' },
      '/security': { icon: '🔒', label: 'Security' },
      '/monitoring': { icon: '📡', label: 'Monitoring' },
      '/ai/flaky-tests': { icon: '⚡', label: 'Flaky Tests' },
      '/ai/analytics': { icon: '📊', label: 'AI Analytics' },
      '/settings': { icon: '⚙️', label: 'Settings' },
      '/organization/members': { icon: '👥', label: 'Team' },
      '/organization/settings': { icon: '⚙️', label: 'Settings' },
      '/organization/mcp-chat': { icon: '💬', label: 'MCP Chat' },
    };
    const recentCommands: CommandPaletteAction[] = recentPages.slice(0, 3).map((path, idx) => {
      const info = pageLabels[path] || { icon: '📄', label: path.split('/').pop() || 'Page' };
      return {
        id: `recent-${idx}`,
        icon: info.icon,
        label: info.label,
        description: `Recently visited • ${path}`,
        category: 'recent' as const,
        action: () => { navigate(path); close(); },
      };
    });

    // ---- AI insight commands ----
    const aiCommands: CommandPaletteAction[] = [
      {
        id: 'explain-failure',
        icon: '🔍',
        label: 'Explain this failure',
        description: 'Get AI analysis of why the current test failed',
        category: 'ai-insights',
        action: async () => {
          setIsProcessing(true);
          await new Promise(r => setTimeout(r, 1500));
          setAiResult({
            type: 'explanation',
            title: 'Failure Explanation',
            content: 'The test failed because the expected element ".checkout-button" was not found within the timeout period. This appears to be a selector mismatch caused by a recent UI refactor.',
            details: [
              'Selector ".checkout-button" not found in DOM',
              'Similar element ".btn-checkout" exists on page',
              'Last successful run: 2 hours ago',
              'Git commit abc123 changed button classes',
            ],
            confidence: 92,
          });
          setIsProcessing(false);
        },
      },
      {
        id: 'suggest-fix',
        icon: '💡',
        label: 'Suggest a fix',
        description: 'Get AI-suggested fix for the current issue',
        category: 'ai-insights',
        action: async () => {
          setIsProcessing(true);
          await new Promise(r => setTimeout(r, 1200));
          setAiResult({
            type: 'suggestion',
            title: 'Suggested Fix',
            content: 'Update the selector from ".checkout-button" to ".btn-checkout" or use a more stable selector like [data-testid="checkout-btn"].',
            details: [
              'Option 1: Change selector to ".btn-checkout"',
              'Option 2: Use data-testid attribute (recommended)',
              'Option 3: Use text-based selector: text="Checkout"',
            ],
            confidence: 88,
          });
          setIsProcessing(false);
        },
      },
      {
        id: 'analyze-flaky',
        icon: '📊',
        label: 'Analyze flaky tests',
        description: 'Get AI analysis of test flakiness patterns',
        category: 'ai-insights',
        action: async () => {
          setIsProcessing(true);
          await new Promise(r => setTimeout(r, 1800));
          setAiResult({
            type: 'analysis',
            title: 'Flaky Test Analysis',
            content: 'Found 3 tests with flaky behavior in the past 7 days. Primary causes: timing issues (60%), race conditions (25%), and environment variance (15%).',
            details: [
              'checkout.spec.ts - 40% failure rate - timing issue',
              'auth.spec.ts - 25% failure rate - race condition',
              'dashboard.spec.ts - 15% failure rate - env variance',
            ],
            confidence: 85,
          });
          setIsProcessing(false);
        },
      },
      {
        id: 'generate-test',
        icon: '✨',
        label: 'Generate test for current page',
        description: 'AI generates a test based on the current application state',
        category: 'ai-insights',
        action: async () => {
          setIsProcessing(true);
          await new Promise(r => setTimeout(r, 2500));
          setAiResult({
            type: 'action',
            title: 'Generated Test',
            content: 'Generated comprehensive test for the Dashboard page including navigation, data loading, and user interactions.',
            details: [
              '✓ Navigate to /dashboard',
              '✓ Wait for metrics to load',
              '✓ Verify chart renders with data',
              '✓ Click on test run card',
              '✓ Verify detail view opens',
            ],
            confidence: 90,
          });
          setIsProcessing(false);
        },
      },
      {
        id: 'root-cause',
        icon: '🎯',
        label: 'Find root cause',
        description: 'Deep AI analysis to find the root cause of failures',
        category: 'ai-insights',
        action: async () => {
          setIsProcessing(true);
          await new Promise(r => setTimeout(r, 2200));
          setAiResult({
            type: 'explanation',
            title: 'Root Cause Analysis',
            content: 'The root cause is a breaking change in the API response format. The backend now returns nested objects instead of flat fields.',
            details: [
              'API response changed from { name: "..." } to { user: { name: "..." } }',
              'Commit: def456 by john@example.com',
              '5 tests affected by this change',
              'Suggested: Update data accessors in test helpers',
            ],
            confidence: 94,
          });
          setIsProcessing(false);
        },
      },
    ];

    // ---- Jump-to-section commands (Feature #1509) ----
    const jumpToSectionCommands: CommandPaletteAction[] = [
      {
        id: 'jump-testing', icon: '🧪', label: 'Jump to Testing',
        description: 'Expand Testing section in sidebar', category: 'navigation', shortcut: 'G T',
        action: () => {
          expandSection('testing'); navigate('/projects'); close();
          setTimeout(() => { document.querySelector('[data-section="testing"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
        },
      },
      {
        id: 'jump-security', icon: '🛡️', label: 'Jump to Security',
        description: 'Expand Security section in sidebar', category: 'navigation',
        action: () => {
          expandSection('security'); navigate('/security'); close();
          setTimeout(() => { document.querySelector('[data-section="security"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
        },
      },
      {
        id: 'jump-ai-mcp', icon: '✨', label: 'Jump to AI & MCP',
        description: 'Expand AI & MCP section in sidebar', category: 'navigation',
        action: () => {
          expandSection('ai-mcp'); navigate('/ai/flaky-tests'); close();
          setTimeout(() => { document.querySelector('[data-section="ai-mcp"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
        },
      },
    ];

    // ---- Navigation commands ----
    const navigationCommands: CommandPaletteAction[] = [
      ...jumpToSectionCommands,
      { id: 'nav-dashboard', icon: '📊', label: 'Go to Dashboard', description: 'View main dashboard', category: 'navigation', shortcut: 'G D', action: () => { navigate('/dashboard'); close(); } },
      { id: 'nav-projects', icon: '📁', label: 'Go to Projects', description: 'View all projects', category: 'navigation', shortcut: 'G P', action: () => { navigate('/projects'); close(); } },
      { id: 'nav-schedules', icon: '📅', label: 'Go to Schedules', description: 'Manage test schedules', category: 'navigation', action: () => { navigate('/schedules'); close(); } },
      { id: 'nav-analytics', icon: '📈', label: 'Go to Analytics', description: 'View test analytics', category: 'navigation', shortcut: 'G A', action: () => { navigate('/analytics'); close(); } },
      { id: 'nav-visual-review', icon: '👁️', label: 'Go to Visual Review', description: 'Review visual regression tests', category: 'navigation', action: () => { navigate('/visual-review'); close(); } },
      { id: 'nav-security', icon: '🔒', label: 'Go to Security', description: 'View security scans', category: 'navigation', shortcut: 'G S', action: () => { navigate('/security'); close(); } },
      { id: 'nav-monitoring', icon: '📡', label: 'Go to Monitoring', description: 'Monitor uptime and performance', category: 'navigation', action: () => { navigate('/monitoring'); close(); } },
      // Feature #412: Updated AI routes from /ai-insights/* to /ai/*
      { id: 'nav-ai-flaky', icon: '⚡', label: 'Flaky Tests', description: 'Analyze flaky test patterns', category: 'navigation', shortcut: 'G I', action: () => { navigate('/ai/flaky-tests'); close(); } },
      { id: 'nav-ai-analytics', icon: '📊', label: 'AI Analytics', description: 'AI usage and cost analytics', category: 'navigation', action: () => { navigate('/ai/analytics'); close(); } },
      // Feature #1832: Unified Settings page
      { id: 'nav-settings', icon: '⚙️', label: 'Go to Settings', description: 'Organization settings', category: 'navigation', shortcut: 'G ,', action: () => { navigate('/settings'); close(); } },
      { id: 'nav-team', icon: '👥', label: 'Team Members', description: 'Manage team members', category: 'navigation', action: () => { navigate('/settings?tab=team'); close(); } },
      { id: 'nav-billing', icon: '💳', label: 'Billing & Plans', description: 'Manage billing and subscription', category: 'navigation', action: () => { navigate('/settings?tab=billing'); close(); } },
      { id: 'nav-api-keys', icon: '🔑', label: 'API Keys', description: 'Manage API keys', category: 'navigation', action: () => { navigate('/settings?tab=api-keys'); close(); } },
      { id: 'nav-webhooks', icon: '🔔', label: 'Webhooks', description: 'Configure webhook notifications', category: 'navigation', action: () => { navigate('/settings?tab=webhooks'); close(); } },
      { id: 'nav-audit-logs', icon: '📋', label: 'Audit Logs', description: 'View audit history', category: 'navigation', action: () => { navigate('/settings?tab=audit-logs'); close(); } },
      // MCP Tools
      { id: 'nav-mcp-tools', icon: '🛠️', label: 'MCP Tools', description: 'Browse MCP tool library', category: 'navigation', action: () => { navigate('/organization/mcp-tools'); close(); } },
      { id: 'nav-mcp-playground', icon: '🎮', label: 'MCP Playground', description: 'Test MCP tools interactively', category: 'navigation', action: () => { navigate('/organization/mcp-playground'); close(); } },
      { id: 'nav-mcp-chat', icon: '💬', label: 'MCP Chat', description: 'Chat with AI assistant', category: 'navigation', action: () => { navigate('/organization/mcp-chat'); close(); } },
    ];

    // ---- Action commands ----
    const actionCommands: CommandPaletteAction[] = [
      { id: 'action-run-tests', icon: '▶️', label: 'Run all tests', description: 'Trigger a full test run', category: 'actions', action: () => { alert('Test run triggered!'); close(); } },
      { id: 'action-new-project', icon: '➕', label: 'Create new project', description: 'Start a new testing project', category: 'actions', action: () => { navigate('/projects/new'); close(); } },
      { id: 'action-export', icon: '📤', label: 'Export report', description: 'Export test results as PDF', category: 'actions', action: () => { alert('Export started!'); close(); } },
    ];

    return [...recentCommands, ...aiCommands, ...navigationCommands, ...actionCommands];
    // Stable unless recentPages changes -- command structure is static
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentPages.length, navigate, expandSection, close, setIsProcessing, setAiResult]);
}
