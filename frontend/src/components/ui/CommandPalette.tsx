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
import { useProjects, type Project } from '../../hooks/api/useProjects';
import {
  Search,
  LayoutDashboard,
  Folder,
  ClipboardCheck,
  PlayCircle,
  BarChart3,
  ShieldCheck,
  Clock,
  Settings,
  Plus,
  Lightbulb,
  History
} from 'lucide-react';

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

// Icons using Lucide
const Icons = {
  search: <Search className="w-5 h-5" />,
  dashboard: <LayoutDashboard className="w-4 h-4" />,
  folder: <Folder className="w-4 h-4" />,
  test: <ClipboardCheck className="w-4 h-4" />,
  play: <PlayCircle className="w-4 h-4" />,
  analytics: <BarChart3 className="w-4 h-4" />,
  security: <ShieldCheck className="w-4 h-4" />,
  clock: <Clock className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
  plus: <Plus className="w-4 h-4" />,
  ai: <Lightbulb className="w-4 h-4" />,
  recent: <History className="w-4 h-4" />,
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
    projects.forEach((project: Project) => {
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
