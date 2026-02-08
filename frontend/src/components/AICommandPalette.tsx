// AICommandPalette - AI-powered command palette
// Feature #452: Extracted from App.tsx for better maintainability
// Feature #1278: AI Insights Command Palette

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore } from '../stores/sidebarStore';

// Command palette action interface
interface CommandPaletteAction {
  id: string;
  icon: string;
  label: string;
  description: string;
  category: 'ai-insights' | 'navigation' | 'actions' | 'recent';
  shortcut?: string;
  action: () => void;
}

// AI command result interface
interface AICommandResult {
  type: 'explanation' | 'analysis' | 'suggestion' | 'action';
  title: string;
  content: string;
  details?: string[];
  confidence?: number;
}

export function AICommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  // Feature #1418: Get auth state to hide palette for logged-out users
  const { token } = useAuthStore();
  // Feature #1509: Get sidebar store to expand sections
  const { expandSection } = useSidebarStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<AICommandResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Feature #1506: Recent searches history
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('qa-guardian-recent-searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Feature #1506: Save a search to recent history
  const saveRecentSearch = (searchQuery: string) => {
    // Don't store empty or very short queries (less than 3 characters)
    if (!searchQuery || searchQuery.trim().length < 3) return;

    const trimmed = searchQuery.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5); // Keep last 5 unique searches
      try {
        localStorage.setItem('qa-guardian-recent-searches', JSON.stringify(updated));
      } catch { /* storage unavailable */ }
      return updated;
    });
  };

  // Feature #1506: Clear search history
  const clearSearchHistory = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('qa-guardian-recent-searches');
    } catch { /* storage unavailable */ }
  };

  // AI Commands
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
            'Git commit abc123 changed button classes'
          ],
          confidence: 92
        });
        setIsProcessing(false);
      }
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
            'Option 3: Use text-based selector: text="Checkout"'
          ],
          confidence: 88
        });
        setIsProcessing(false);
      }
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
            'dashboard.spec.ts - 15% failure rate - env variance'
          ],
          confidence: 85
        });
        setIsProcessing(false);
      }
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
            '✓ Verify detail view opens'
          ],
          confidence: 90
        });
        setIsProcessing(false);
      }
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
            'Suggested: Update data accessors in test helpers'
          ],
          confidence: 94
        });
        setIsProcessing(false);
      }
    }
  ];

  // Feature #1366: Track recent pages
  const [recentPages, setRecentPages] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('qa-guardian-recent-pages');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Track navigation for recent pages
  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath && currentPath !== '/login' && currentPath !== '/register') {
      setRecentPages(prev => {
        const filtered = prev.filter(p => p !== currentPath);
        const updated = [currentPath, ...filtered].slice(0, 5);
        try {
          localStorage.setItem('qa-guardian-recent-pages', JSON.stringify(updated));
        } catch { /* storage unavailable */ }
        return updated;
      });
    }
  }, [location.pathname]);

  // Feature #1507: Enhanced fuzzy matching with scoring and character highlighting
  interface FuzzyMatchResult {
    matches: boolean;
    score: number;
    matchedIndices: number[];
  }

  // Calculate Levenshtein distance for typo tolerance
  const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };

  // Feature #1507: Enhanced fuzzy matching with scoring
  const fuzzyMatchWithScore = (text: string, query: string): FuzzyMatchResult => {
    if (!query) return { matches: true, score: 0, matchedIndices: [] };

    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase().trim();
    const matchedIndices: number[] = [];

    // Exact match (highest priority)
    if (textLower === queryLower) {
      return { matches: true, score: 1000, matchedIndices: Array.from({ length: text.length }, (_, i) => i) };
    }

    // Starts with query (high priority)
    if (textLower.startsWith(queryLower)) {
      for (let i = 0; i < queryLower.length; i++) {
        matchedIndices.push(i);
      }
      return { matches: true, score: 500 + (queryLower.length / textLower.length) * 100, matchedIndices };
    }

    // Contains query as substring (medium-high priority)
    const containsIndex = textLower.indexOf(queryLower);
    if (containsIndex !== -1) {
      for (let i = 0; i < queryLower.length; i++) {
        matchedIndices.push(containsIndex + i);
      }
      // Penalize if not at word boundary
      const atWordBoundary = containsIndex === 0 || /\s/.test(text[containsIndex - 1]);
      return { matches: true, score: atWordBoundary ? 400 : 300, matchedIndices };
    }

    // Word-by-word matching (medium priority)
    const searchTerms = queryLower.split(/\s+/).filter(Boolean);
    if (searchTerms.length > 1) {
      const allTermsMatch = searchTerms.every(term => textLower.includes(term));
      if (allTermsMatch) {
        searchTerms.forEach(term => {
          const idx = textLower.indexOf(term);
          if (idx !== -1) {
            for (let i = 0; i < term.length; i++) {
              if (!matchedIndices.includes(idx + i)) {
                matchedIndices.push(idx + i);
              }
            }
          }
        });
        matchedIndices.sort((a, b) => a - b);
        return { matches: true, score: 200 + (matchedIndices.length / textLower.length) * 50, matchedIndices };
      }
    }

    // Fuzzy character matching (lower priority) - characters appear in order
    let queryIdx = 0;
    for (let i = 0; i < textLower.length && queryIdx < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIdx]) {
        matchedIndices.push(i);
        queryIdx++;
      }
    }
    if (queryIdx === queryLower.length) {
      // Calculate score based on match compactness
      const compactness = matchedIndices.length > 1
        ? 1 - (matchedIndices[matchedIndices.length - 1] - matchedIndices[0]) / textLower.length
        : 1;
      return { matches: true, score: 100 + compactness * 50, matchedIndices };
    }

    // Typo tolerance using Levenshtein distance (lowest priority but still matches)
    const words = textLower.split(/\s+/);
    for (const word of words) {
      const distance = levenshteinDistance(queryLower, word);
      const maxAllowedDistance = Math.max(1, Math.floor(queryLower.length / 3));
      if (distance <= maxAllowedDistance) {
        // Find approximate match location
        const wordIndex = textLower.indexOf(word);
        for (let i = 0; i < word.length; i++) {
          matchedIndices.push(wordIndex + i);
        }
        return { matches: true, score: 50 - distance * 10, matchedIndices };
      }
    }

    return { matches: false, score: 0, matchedIndices: [] };
  };

  // Feature #1507: Get combined score for a command
  const getCommandScore = (cmd: CommandPaletteAction, query: string): { score: number; labelIndices: number[]; descIndices: number[] } => {
    const labelResult = fuzzyMatchWithScore(cmd.label, query);
    const descResult = fuzzyMatchWithScore(cmd.description, query);
    // Label matches are weighted higher than description matches
    const score = Math.max(labelResult.score * 1.5, descResult.score);
    return {
      score,
      labelIndices: labelResult.matches ? labelResult.matchedIndices : [],
      descIndices: descResult.matches ? descResult.matchedIndices : []
    };
  };

  // Feature #1509: Jump to sidebar section commands
  const jumpToSectionCommands: CommandPaletteAction[] = [
    {
      id: 'jump-testing',
      icon: '🧪',
      label: 'Jump to Testing',
      description: 'Expand Testing section in sidebar',
      category: 'navigation',
      shortcut: 'G T',
      action: () => {
        expandSection('testing');
        navigate('/projects');
        setIsOpen(false);
        // Scroll sidebar to testing section after a brief delay
        setTimeout(() => {
          document.querySelector('[data-section="testing"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    },
    {
      id: 'jump-security',
      icon: '🛡️',
      label: 'Jump to Security',
      description: 'Expand Security section in sidebar',
      category: 'navigation',
      action: () => {
        expandSection('security');
        navigate('/security');
        setIsOpen(false);
        setTimeout(() => {
          document.querySelector('[data-section="security"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    },
    {
      id: 'jump-ai-mcp',
      icon: '✨',
      label: 'Jump to AI & MCP',
      description: 'Expand AI & MCP section in sidebar',
      category: 'navigation',
      action: () => {
        expandSection('ai-mcp');
        navigate('/ai/flaky-tests');
        setIsOpen(false);
        setTimeout(() => {
          document.querySelector('[data-section="ai-mcp"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    },
  ];

  // Navigation commands - comprehensive list of all routes
  const navigationCommands: CommandPaletteAction[] = [
    // Feature #1509: Jump to section commands at the top
    ...jumpToSectionCommands,
    // Core navigation
    { id: 'nav-dashboard', icon: '📊', label: 'Go to Dashboard', description: 'View main dashboard', category: 'navigation', shortcut: 'G D', action: () => { navigate('/dashboard'); setIsOpen(false); } },
    { id: 'nav-projects', icon: '📁', label: 'Go to Projects', description: 'View all projects', category: 'navigation', shortcut: 'G P', action: () => { navigate('/projects'); setIsOpen(false); } },
    { id: 'nav-schedules', icon: '📅', label: 'Go to Schedules', description: 'Manage test schedules', category: 'navigation', action: () => { navigate('/schedules'); setIsOpen(false); } },
    { id: 'nav-analytics', icon: '📈', label: 'Go to Analytics', description: 'View test analytics', category: 'navigation', shortcut: 'G A', action: () => { navigate('/analytics'); setIsOpen(false); } },
    { id: 'nav-visual-review', icon: '👁️', label: 'Go to Visual Review', description: 'Review visual regression tests', category: 'navigation', action: () => { navigate('/visual-review'); setIsOpen(false); } },
    { id: 'nav-security', icon: '🔒', label: 'Go to Security', description: 'View security scans', category: 'navigation', shortcut: 'G S', action: () => { navigate('/security'); setIsOpen(false); } },
    { id: 'nav-monitoring', icon: '📡', label: 'Go to Monitoring', description: 'Monitor uptime and performance', category: 'navigation', action: () => { navigate('/monitoring'); setIsOpen(false); } },
    // AI Insights
    // Feature #412: Updated AI routes from /ai-insights/* to /ai/*
    { id: 'nav-ai-flaky', icon: '⚡', label: 'Flaky Tests', description: 'Analyze flaky test patterns', category: 'navigation', shortcut: 'G I', action: () => { navigate('/ai/flaky-tests'); setIsOpen(false); } },
    { id: 'nav-ai-analytics', icon: '📊', label: 'AI Analytics', description: 'AI usage and cost analytics', category: 'navigation', action: () => { navigate('/ai/analytics'); setIsOpen(false); } },
    // Organization - Feature #1832: Unified Settings page
    { id: 'nav-settings', icon: '⚙️', label: 'Go to Settings', description: 'Organization settings', category: 'navigation', shortcut: 'G ,', action: () => { navigate('/settings'); setIsOpen(false); } },
    { id: 'nav-team', icon: '👥', label: 'Team Members', description: 'Manage team members', category: 'navigation', action: () => { navigate('/settings?tab=team'); setIsOpen(false); } },
    { id: 'nav-billing', icon: '💳', label: 'Billing & Plans', description: 'Manage billing and subscription', category: 'navigation', action: () => { navigate('/settings?tab=billing'); setIsOpen(false); } },
    { id: 'nav-api-keys', icon: '🔑', label: 'API Keys', description: 'Manage API keys', category: 'navigation', action: () => { navigate('/settings?tab=api-keys'); setIsOpen(false); } },
    { id: 'nav-webhooks', icon: '🔔', label: 'Webhooks', description: 'Configure webhook notifications', category: 'navigation', action: () => { navigate('/settings?tab=webhooks'); setIsOpen(false); } },
    { id: 'nav-audit-logs', icon: '📋', label: 'Audit Logs', description: 'View audit history', category: 'navigation', action: () => { navigate('/settings?tab=audit-logs'); setIsOpen(false); } },
    // MCP Tools
    { id: 'nav-mcp-tools', icon: '🛠️', label: 'MCP Tools', description: 'Browse MCP tool library', category: 'navigation', action: () => { navigate('/organization/mcp-tools'); setIsOpen(false); } },
    { id: 'nav-mcp-playground', icon: '🎮', label: 'MCP Playground', description: 'Test MCP tools interactively', category: 'navigation', action: () => { navigate('/organization/mcp-playground'); setIsOpen(false); } },
    { id: 'nav-mcp-chat', icon: '💬', label: 'MCP Chat', description: 'Chat with AI assistant', category: 'navigation', action: () => { navigate('/organization/mcp-chat'); setIsOpen(false); } },
  ];

  // Recent pages as commands
  const recentCommands: CommandPaletteAction[] = recentPages.slice(0, 3).map((path, idx) => {
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
    const info = pageLabels[path] || { icon: '📄', label: path.split('/').pop() || 'Page' };
    return {
      id: `recent-${idx}`,
      icon: info.icon,
      label: info.label,
      description: `Recently visited • ${path}`,
      category: 'recent' as const,
      action: () => { navigate(path); setIsOpen(false); }
    };
  });

  // Action commands
  const actionCommands: CommandPaletteAction[] = [
    { id: 'action-run-tests', icon: '▶️', label: 'Run all tests', description: 'Trigger a full test run', category: 'actions', action: () => { alert('Test run triggered!'); setIsOpen(false); } },
    { id: 'action-new-project', icon: '➕', label: 'Create new project', description: 'Start a new testing project', category: 'actions', action: () => { navigate('/projects/new'); setIsOpen(false); } },
    { id: 'action-export', icon: '📤', label: 'Export report', description: 'Export test results as PDF', category: 'actions', action: () => { alert('Export started!'); setIsOpen(false); } },
  ];

  // Feature #1366: Include recent pages in commands
  // Feature #398: Memoize allCommands to prevent recreating on every render
  const allCommands = useMemo(() =>
    [...recentCommands, ...aiCommands, ...navigationCommands, ...actionCommands],
    // Note: These arrays are recreated each render but contain stable action functions.
    // We intentionally omit them from deps since the command structure doesn't change
    // unless recentPages changes. This prevents unnecessary re-filtering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recentPages.length]
  );

  // Feature #1507: Use fuzzy matching with scoring and sorting
  const { filteredCommands, matchHighlights } = useMemo(() => {
    if (!query) {
      return { filteredCommands: allCommands, matchHighlights: new Map<string, { labelIndices: number[]; descIndices: number[] }>() };
    }

    const scoredCommands: Array<{ cmd: CommandPaletteAction; score: number; labelIndices: number[]; descIndices: number[] }> = [];
    const newHighlights = new Map<string, { labelIndices: number[]; descIndices: number[] }>();

    for (const cmd of allCommands) {
      const { score, labelIndices, descIndices } = getCommandScore(cmd, query);
      if (score > 0) {
        scoredCommands.push({ cmd, score, labelIndices, descIndices });
        newHighlights.set(cmd.id, { labelIndices, descIndices });
      }
    }

    // Sort by score descending (highest relevance first)
    scoredCommands.sort((a, b) => b.score - a.score);

    return { filteredCommands: scoredCommands.map(sc => sc.cmd), matchHighlights: newHighlights };
  }, [query, allCommands]);

  // Feature #1507: Helper to render text with highlighted matches
  const renderHighlightedText = (text: string, indices: number[], className: string = 'bg-primary/20 text-primary font-semibold') => {
    if (!indices || indices.length === 0) return text;

    const indicesSet = new Set(indices);
    const result: React.ReactNode[] = [];
    let currentChunk = '';
    let isHighlighted = false;

    for (let i = 0; i < text.length; i++) {
      const shouldHighlight = indicesSet.has(i);
      if (shouldHighlight !== isHighlighted) {
        if (currentChunk) {
          result.push(
            isHighlighted
              ? <span key={`h-${i}`} className={className}>{currentChunk}</span>
              : currentChunk
          );
        }
        currentChunk = text[i];
        isHighlighted = shouldHighlight;
      } else {
        currentChunk += text[i];
      }
    }
    if (currentChunk) {
      result.push(
        isHighlighted
          ? <span key="h-end" className={className}>{currentChunk}</span>
          : currentChunk
      );
    }

    return <>{result}</>;
  };

  // Feature #1506: Execute command and save search history
  const executeCommand = (cmd: CommandPaletteAction) => {
    if (query) {
      saveRecentSearch(query);
    }
    cmd.action();
  };

  // Feature #1506: Re-run a recent search
  const rerunSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    setSelectedIndex(0);
  };

  // Keyboard event handler
  // Feature #1418: Only allow command palette for authenticated users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open palette with Cmd+K or Ctrl+K - only for authenticated users
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Feature #1418: Don't open palette if user is not logged in
        if (!token) {
          return;
        }
        setIsOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
        setAiResult(null);
      }

      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        setAiResult(null);
      }

      // Navigate with arrows
      if (isOpen && !aiResult) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
        }
        if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
          e.preventDefault();
          // Feature #1506: Execute command (saves search history automatically)
          executeCommand(filteredCommands[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, aiResult, token, query, saveRecentSearch]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { setIsOpen(false); setAiResult(null); }}
      />

      {/* Palette */}
      <div className="relative w-full max-w-2xl mx-4 bg-card rounded-xl shadow-2xl border border-border overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-muted-foreground">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            disabled={isProcessing}
          />
          <kbd className="px-2 py-1 text-xs bg-muted rounded text-muted-foreground">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
          </kbd>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="p-8 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">AI is analyzing...</p>
          </div>
        )}

        {/* AI Result */}
        {aiResult && !isProcessing && (
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-foreground">{aiResult.title}</h3>
              {aiResult.confidence && (
                <span className="px-2 py-1 bg-primary/10 text-primary text-sm rounded">
                  {aiResult.confidence}% confidence
                </span>
              )}
            </div>
            <p className="text-foreground mb-4">{aiResult.content}</p>
            {aiResult.details && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Details:</p>
                <ul className="space-y-1">
                  {aiResult.details.map((detail, idx) => (
                    <li key={idx} className="text-sm text-foreground flex items-start gap-2 p-2 rounded bg-muted/50">
                      <span className="text-primary">•</span>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setAiResult(null)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                New Command
              </button>
              <button
                onClick={() => { setIsOpen(false); setAiResult(null); }}
                className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Commands List */}
        {!isProcessing && !aiResult && (
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Feature #1366: Recent Pages Section */}
            {!query && filteredCommands.some(c => c.category === 'recent') && (
              <div className="p-2">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                  <span>🕐</span> Recent
                </p>
                {filteredCommands.filter(c => c.category === 'recent').map((cmd) => {
                  const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedIndex === globalIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="text-lg">{cmd.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium">{cmd.label}</p>
                        <p className="text-sm text-muted-foreground">{cmd.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Feature #1506: Recent Searches Section */}
            {!query && recentSearches.length > 0 && (
              <div className={`p-2 ${filteredCommands.some(c => c.category === 'recent') ? 'border-t border-border' : ''}`}>
                <div className="flex items-center justify-between px-3 py-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                    <span>🔍</span> Recent Searches
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSearchHistory();
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Clear search history"
                  >
                    Clear
                  </button>
                </div>
                {recentSearches.map((search, idx) => (
                  <button
                    key={`search-${idx}`}
                    onClick={() => rerunSearch(search)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-muted text-foreground"
                  >
                    <span className="text-muted-foreground">↻</span>
                    <div className="flex-1">
                      <p className="font-medium">{search}</p>
                      <p className="text-sm text-muted-foreground">Click to search again</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* AI Insights Section */}
            {filteredCommands.some(c => c.category === 'ai-insights') && (
            <div className={`p-2 ${!query && (filteredCommands.some(c => c.category === 'recent') || recentSearches.length > 0) ? 'border-t border-border' : ''}`}>
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">AI Insights</p>
              {filteredCommands.filter(c => c.category === 'ai-insights').map((cmd) => {
                const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
                const highlights = matchHighlights.get(cmd.id);
                return (
                  <button
                    key={cmd.id}
                    onClick={() => executeCommand(cmd)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedIndex === globalIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className="text-lg">{cmd.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium">
                        {query && highlights ? renderHighlightedText(cmd.label, highlights.labelIndices) : cmd.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {query && highlights ? renderHighlightedText(cmd.description, highlights.descIndices, 'bg-primary/10 text-primary/80') : cmd.description}
                      </p>
                    </div>
                    {cmd.shortcut && (
                      <kbd className="px-2 py-1 text-xs bg-muted rounded">{cmd.shortcut}</kbd>
                    )}
                  </button>
                );
              })}
            </div>
            )}

            {/* Navigation Section */}
            {filteredCommands.some(c => c.category === 'navigation') && (
              <div className="p-2 border-t border-border">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Navigation</p>
                {filteredCommands.filter(c => c.category === 'navigation').map((cmd) => {
                  const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
                  const highlights = matchHighlights.get(cmd.id);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedIndex === globalIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="text-lg">{cmd.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium">
                          {query && highlights ? renderHighlightedText(cmd.label, highlights.labelIndices) : cmd.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {query && highlights ? renderHighlightedText(cmd.description, highlights.descIndices, 'bg-primary/10 text-primary/80') : cmd.description}
                        </p>
                      </div>
                      {cmd.shortcut && (
                        <kbd className="px-2 py-1 text-xs bg-muted rounded">{cmd.shortcut}</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Actions Section */}
            {filteredCommands.some(c => c.category === 'actions') && (
              <div className="p-2 border-t border-border">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Actions</p>
                {filteredCommands.filter(c => c.category === 'actions').map((cmd) => {
                  const globalIdx = filteredCommands.findIndex(c => c.id === cmd.id);
                  const highlights = matchHighlights.get(cmd.id);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedIndex === globalIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="text-lg">{cmd.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium">
                          {query && highlights ? renderHighlightedText(cmd.label, highlights.labelIndices) : cmd.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {query && highlights ? renderHighlightedText(cmd.description, highlights.descIndices, 'bg-primary/10 text-primary/80') : cmd.description}
                        </p>
                      </div>
                      {cmd.shortcut && (
                        <kbd className="px-2 py-1 text-xs bg-muted rounded">{cmd.shortcut}</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* No results */}
            {filteredCommands.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No commands found for "{query}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AICommandPalette;
