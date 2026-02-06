/**
 * Feature #128: Command Palette (Cmd+K)
 * Quick navigation for power users with fuzzy search
 *
 * Features:
 * - Cmd+K / Ctrl+K to open
 * - Fuzzy search for pages, projects, suites, tests
 * - Recent items section
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Action commands (create project, run tests, etc.)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/api/useProjects';

// Types
interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  category: 'page' | 'project' | 'suite' | 'test' | 'action' | 'recent';
  path?: string;
  action?: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// Icons
const Icons = {
  search: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  dashboard: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  folder: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  test: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  play: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  analytics: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  security: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  ai: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  recent: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// Static pages
const staticPages: CommandItem[] = [
  { id: 'dashboard', title: 'Dashboard', path: '/dashboard', category: 'page', icon: Icons.dashboard, keywords: ['home', 'main', 'overview'] },
  { id: 'projects', title: 'Projects', path: '/projects', category: 'page', icon: Icons.folder, keywords: ['list', 'all'] },
  { id: 'analytics', title: 'Analytics', path: '/analytics', category: 'page', icon: Icons.analytics, keywords: ['stats', 'metrics', 'reports'] },
  { id: 'security', title: 'Security Dashboard', path: '/security', category: 'page', icon: Icons.security, keywords: ['vulnerabilities', 'sast', 'dast'] },
  { id: 'runs', title: 'Run History', path: '/runs', category: 'page', icon: Icons.clock, keywords: ['history', 'executions', 'results'] },
  { id: 'schedules', title: 'Schedules', path: '/schedules', category: 'page', icon: Icons.clock, keywords: ['cron', 'automation', 'recurring'] },
  { id: 'mcp-chat', title: 'MCP Chat', path: '/mcp-chat', category: 'page', icon: Icons.ai, keywords: ['ai', 'assistant', 'help'] },
  { id: 'settings', title: 'Settings', path: '/settings', category: 'page', icon: Icons.settings, keywords: ['preferences', 'config'] },
  { id: 'org-settings', title: 'Organization Settings', path: '/organization/settings', category: 'page', icon: Icons.settings, keywords: ['org', 'team'] },
  { id: 'org-members', title: 'Team Members', path: '/organization/members', category: 'page', icon: Icons.settings, keywords: ['users', 'team', 'invite'] },
];

// Simple fuzzy search
function fuzzySearch(query: string, text: string): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Direct substring match
  if (lowerText.includes(lowerQuery)) return true;

  // Fuzzy match - all characters in sequence
  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === lowerQuery.length;
}

// Recent items storage key
const RECENT_ITEMS_KEY = 'command_palette_recent';

function getRecentItems(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_ITEMS_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentItem(id: string) {
  const recent = getRecentItems().filter(r => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(recent.slice(0, 5)));
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch projects for search
  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects || [];

  // Build searchable items
  const allItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [...staticPages];

    // Add projects
    projects.forEach((project: any) => {
      items.push({
        id: `project-${project.id}`,
        title: project.name,
        subtitle: 'Project',
        path: `/projects/${project.id}`,
        category: 'project',
        icon: Icons.folder,
        keywords: [project.description || ''],
      });
    });

    // Add action commands
    items.push({
      id: 'action-create-project',
      title: 'Create New Project',
      category: 'action',
      icon: Icons.plus,
      path: '/projects?create=true',
      keywords: ['new', 'add'],
    });

    return items;
  }, [projects]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query) {
      // Show recent items first when no query
      const recentIds = getRecentItems();
      const recent = recentIds
        .map(id => allItems.find(item => item.id === id))
        .filter(Boolean) as CommandItem[];

      // Add recent category marker
      const recentWithCategory = recent.map(item => ({ ...item, category: 'recent' as const }));

      // Then show pages
      const pages = allItems.filter(item => item.category === 'page' && !recentIds.includes(item.id));

      return [...recentWithCategory, ...pages].slice(0, 10);
    }

    return allItems.filter(item => {
      const searchText = [item.title, item.subtitle, ...(item.keywords || [])].join(' ');
      return fuzzySearch(query, searchText);
    }).slice(0, 10);
  }, [query, allItems]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Execute selected item
  const executeItem = useCallback((item: CommandItem) => {
    addRecentItem(item.id);
    onClose();

    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  }, [navigate, onClose]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  // Group items by category
  const groupedItems: { category: string; items: CommandItem[] }[] = [];
  let currentCategory = '';

  filteredItems.forEach((item, index) => {
    const cat = item.category === 'recent' ? 'Recent' :
                item.category === 'page' ? 'Pages' :
                item.category === 'project' ? 'Projects' :
                item.category === 'action' ? 'Actions' : 'Other';

    if (cat !== currentCategory) {
      currentCategory = cat;
      groupedItems.push({ category: cat, items: [] });
    }
    groupedItems[groupedItems.length - 1].items.push({ ...item, id: item.id + '-' + index });
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-muted-foreground">{Icons.search}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, projects, or type a command..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
            aria-label="Search command palette"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-muted rounded border border-border">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No results found for "{query}"
            </div>
          ) : (
            groupedItems.map(({ category, items }) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {category}
                </div>
                {items.map((item, itemIndex) => {
                  const globalIndex = filteredItems.findIndex(fi => fi.id === item.id.replace(/-\d+$/, ''));
                  const isSelected = globalIndex === selectedIndex;

                  return (
                    <button
                      key={item.id}
                      data-index={globalIndex}
                      onClick={() => executeItem(filteredItems[globalIndex])}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className={isSelected ? 'text-primary' : 'text-muted-foreground'}>
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground bg-muted rounded">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd>
              to select
            </span>
          </div>
          <span className="hidden sm:inline">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to use command palette
 * Returns isOpen state and toggle function
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    setIsOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}

export default CommandPalette;
