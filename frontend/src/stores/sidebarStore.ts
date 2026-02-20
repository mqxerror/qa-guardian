import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Phase 2: Simplified sidebar - 2 collapsible groups (tools + admin)
// Legacy sections kept for migration compatibility
export type SidebarSection = 'testing' | 'security' | 'ai-mcp' | 'settings' | 'developer-tools' | 'tools' | 'admin';

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

      // Phase 2: Simplified sidebar - tools and admin start collapsed
      collapsedSections: ['tools', 'admin', 'security', 'ai-mcp', 'settings', 'developer-tools'] as SidebarSection[],

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
      version: 5, // Bump version for Phase 2 - simplified sidebar
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        // Ensure collapsedSections is always a valid array
        // Feature #1549: Fix for corrupted localStorage data
        // Feature #256: Added settings and developer-tools sections
        const validSections = ['testing', 'security', 'ai-mcp', 'settings', 'developer-tools', 'tools', 'admin'];
        const validatedSections = Array.isArray(state?.collapsedSections)
          ? state.collapsedSections.filter((s): s is SidebarSection =>
              typeof s === 'string' && validSections.includes(s)
            )
          : ['tools', 'admin', 'security', 'ai-mcp', 'settings', 'developer-tools'] as SidebarSection[];

        return {
          collapsed: typeof state?.collapsed === 'boolean' ? state.collapsed : false,
          collapsedSections: validatedSections,
        };
      },
    }
  )
);
