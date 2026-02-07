import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Feature #1509, #256: Sidebar section types
// Added 'settings' and 'developer-tools' for Feature #256 collapsible groups
export type SidebarSection = 'testing' | 'security' | 'ai-mcp' | 'settings' | 'developer-tools';

interface SidebarState {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
  // Feature #1509: Collapsed sections state
  collapsedSections: SidebarSection[];
  setCollapsedSections: (sections: SidebarSection[]) => void;
  toggleSection: (section: SidebarSection) => void;
  expandSection: (section: SidebarSection) => void;
  collapseSection: (section: SidebarSection) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,

      setCollapsed: (collapsed) => {
        set({ collapsed });
      },

      toggle: () => {
        set((state) => ({ collapsed: !state.collapsed }));
      },

      // Feature #1509, #256: Collapsed sections state
      // Per spec: security, ai-mcp, settings, developer-tools start collapsed; testing starts expanded
      collapsedSections: ['security', 'ai-mcp', 'settings', 'developer-tools'] as SidebarSection[],

      setCollapsedSections: (sections) => {
        set({ collapsedSections: sections });
      },

      // Feature #1549: Ensure safe array access with fallback
      toggleSection: (section) => {
        set((state) => {
          const sections = Array.isArray(state.collapsedSections) ? state.collapsedSections : [];
          return {
            collapsedSections: sections.includes(section)
              ? sections.filter(s => s !== section)
              : [...sections, section]
          };
        });
      },

      expandSection: (section) => {
        set((state) => {
          const sections = Array.isArray(state.collapsedSections) ? state.collapsedSections : [];
          return { collapsedSections: sections.filter(s => s !== section) };
        });
      },

      collapseSection: (section) => {
        set((state) => {
          const sections = Array.isArray(state.collapsedSections) ? state.collapsedSections : [];
          return {
            collapsedSections: sections.includes(section)
              ? sections
              : [...sections, section]
          };
        });
      },
    }),
    {
      name: 'qa-guardian-sidebar',
      version: 4, // Bump version for Feature #256 - new sections
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        // Ensure collapsedSections is always a valid array
        // Feature #1549: Fix for corrupted localStorage data
        // Feature #256: Added settings and developer-tools sections
        const validSections = ['testing', 'security', 'ai-mcp', 'settings', 'developer-tools'];
        const validatedSections = Array.isArray(state?.collapsedSections)
          ? state.collapsedSections.filter((s): s is SidebarSection =>
              typeof s === 'string' && validSections.includes(s)
            )
          : ['security', 'ai-mcp', 'settings', 'developer-tools'] as SidebarSection[];

        return {
          collapsed: typeof state?.collapsed === 'boolean' ? state.collapsed : false,
          collapsedSections: validatedSections,
        };
      },
    }
  )
);
