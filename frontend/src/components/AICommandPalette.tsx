// AICommandPalette - AI-powered command palette
// Feature #452: Extracted from App.tsx for better maintainability
// Feature #1278: AI Insights Command Palette
// Agent 7: Sub-components & hook extracted to ai-command-palette/

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { AICommandResult } from './ai-command-palette';
import {
  getCommandScore,
  useCommandPaletteCommands,
  CommandSection,
  AIResultDisplay,
  RecentPagesSection,
  RecentSearchesSection,
} from './ai-command-palette';

export function AICommandPalette() {
  const location = useLocation();
  // Feature #1418: Get auth state to hide palette for logged-out users
  const { token } = useAuthStore();
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

  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 3) return;
    const trimmed = searchQuery.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5);
      try { localStorage.setItem('qa-guardian-recent-searches', JSON.stringify(updated)); } catch { /* storage unavailable */ }
      return updated;
    });
  };

  const clearSearchHistory = () => {
    setRecentSearches([]);
    try { localStorage.removeItem('qa-guardian-recent-searches'); } catch { /* storage unavailable */ }
  };

  // Feature #1366: Track recent pages
  const [recentPages, setRecentPages] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('qa-guardian-recent-pages');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath && currentPath !== '/login' && currentPath !== '/register') {
      setRecentPages(prev => {
        const filtered = prev.filter(p => p !== currentPath);
        const updated = [currentPath, ...filtered].slice(0, 5);
        try { localStorage.setItem('qa-guardian-recent-pages', JSON.stringify(updated)); } catch { /* storage unavailable */ }
        return updated;
      });
    }
  }, [location.pathname]);

  // Stable close callback for the commands hook
  const closePalette = useCallback(() => setIsOpen(false), []);

  // Agent 7: All command definitions extracted to useCommandPaletteCommands hook
  const allCommands = useCommandPaletteCommands({
    close: closePalette,
    setIsProcessing,
    setAiResult,
    recentPages,
  });

  // Feature #1507: Use fuzzy matching with scoring and sorting
  const { filteredCommands, matchHighlights } = useMemo(() => {
    if (!query) {
      return { filteredCommands: allCommands, matchHighlights: new Map<string, { labelIndices: number[]; descIndices: number[] }>() };
    }
    const scoredCommands: Array<{ cmd: (typeof allCommands)[number]; score: number; labelIndices: number[]; descIndices: number[] }> = [];
    const newHighlights = new Map<string, { labelIndices: number[]; descIndices: number[] }>();
    for (const cmd of allCommands) {
      const { score, labelIndices, descIndices } = getCommandScore(cmd, query);
      if (score > 0) {
        scoredCommands.push({ cmd, score, labelIndices, descIndices });
        newHighlights.set(cmd.id, { labelIndices, descIndices });
      }
    }
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
          result.push(isHighlighted ? <span key={`h-${i}`} className={className}>{currentChunk}</span> : currentChunk);
        }
        currentChunk = text[i];
        isHighlighted = shouldHighlight;
      } else {
        currentChunk += text[i];
      }
    }
    if (currentChunk) {
      result.push(isHighlighted ? <span key="h-end" className={className}>{currentChunk}</span> : currentChunk);
    }
    return <>{result}</>;
  };

  // Feature #1506: Execute command and save search history
  const executeCommand = (cmd: (typeof allCommands)[number]) => {
    if (query) saveRecentSearch(query);
    cmd.action();
  };

  const rerunSearch = (searchQuery: string) => { setQuery(searchQuery); setSelectedIndex(0); };

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!token) return;
        setIsOpen(prev => !prev);
        setQuery(''); setSelectedIndex(0); setAiResult(null);
      }
      if (e.key === 'Escape' && isOpen) { setIsOpen(false); setQuery(''); setAiResult(null); }
      if (isOpen && !aiResult) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)); }
        if (e.key === 'Enter' && filteredCommands[selectedIndex]) { e.preventDefault(); executeCommand(filteredCommands[selectedIndex]); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, aiResult, token, query, saveRecentSearch]);

  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);
  useEffect(() => { setSelectedIndex(0); }, [query]);

  if (!isOpen) return null;

  const hasRecent = filteredCommands.some(c => c.category === 'recent');

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setIsOpen(false); setAiResult(null); }} />

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
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-4" />
            <p className="text-muted-foreground">AI is analyzing...</p>
          </div>
        )}

        {/* Agent 7: AI result display extracted to AIResultDisplay component */}
        {aiResult && !isProcessing && (
          <AIResultDisplay result={aiResult} onNewCommand={() => setAiResult(null)} onClose={() => { setIsOpen(false); setAiResult(null); }} />
        )}

        {/* Commands List */}
        {!isProcessing && !aiResult && (
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Agent 7: Recent pages & searches extracted to sub-components */}
            {!query && <RecentPagesSection filteredCommands={filteredCommands} selectedIndex={selectedIndex} onExecute={executeCommand} />}
            {!query && <RecentSearchesSection recentSearches={recentSearches} borderTop={hasRecent} onClearHistory={clearSearchHistory} onRerunSearch={rerunSearch} />}

            {/* Agent 7: Category sections using extracted CommandSection component */}
            <CommandSection title="AI Insights" category="ai-insights" filteredCommands={filteredCommands} selectedIndex={selectedIndex} query={query} matchHighlights={matchHighlights} onExecute={executeCommand} renderHighlightedText={renderHighlightedText} borderTop={!query && (hasRecent || recentSearches.length > 0)} />
            <CommandSection title="Navigation" category="navigation" filteredCommands={filteredCommands} selectedIndex={selectedIndex} query={query} matchHighlights={matchHighlights} onExecute={executeCommand} renderHighlightedText={renderHighlightedText} borderTop />
            <CommandSection title="Actions" category="actions" filteredCommands={filteredCommands} selectedIndex={selectedIndex} query={query} matchHighlights={matchHighlights} onExecute={executeCommand} renderHighlightedText={renderHighlightedText} borderTop />

            {filteredCommands.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No commands found for &quot;{query}&quot;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AICommandPalette;
