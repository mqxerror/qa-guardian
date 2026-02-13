import { ReactNode, useEffect } from 'react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { useSidebarStore } from '../stores/sidebarStore';
import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore';
// Feature #96: Real-time cache invalidation via WebSocket
import { useRealtimeCacheInvalidation } from '../hooks/api/useRealtimeCacheInvalidation';
// Feature #128: Command palette for quick navigation
import { CommandPalette, useCommandPalette } from './ui/CommandPalette';

interface LayoutProps {
  children: ReactNode;
}

// Feature #723: Removed USE_NEW_SIDEBAR constant and legacy Sidebar.tsx (646 lines of dead code)
// The AppSidebar component is now the only sidebar implementation

export function Layout({ children }: LayoutProps) {
  const { user } = useAuthStore();
  const { collapsed } = useSidebarStore();

  // Feature #128: Command palette for quick navigation (Cmd+K / Ctrl+K)
  const { isOpen: commandPaletteOpen, close: closeCommandPalette } = useCommandPalette();

  // Feature #96: Connect to WebSocket and join organization room for real-time updates
  const { connect, joinOrg, isConnected } = useSocketStore();

  useEffect(() => {
    // Connect to WebSocket when Layout mounts (user is authenticated)
    connect();
  }, [connect]);

  useEffect(() => {
    // Join organization room when connected and user has organization_id
    if (isConnected && user?.organization_id) {
      joinOrg(user.organization_id);
    }
  }, [isConnected, user?.organization_id, joinOrg]);

  // Feature #96: Enable real-time cache invalidation via WebSocket events
  useRealtimeCacheInvalidation();

  return (
    <SidebarProvider defaultOpen={!collapsed}>
      {/* Skip to main content link - visible only when focused */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* AppSidebar - shadcn/ui based sidebar */}
      <AppSidebar />

      {/* Main Content with SidebarInset */}
      <SidebarInset>
        {/* Mobile Header with SidebarTrigger */}
        <header className="md:hidden border-b border-border bg-card px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">QA Guardian</h1>
            <SidebarTrigger />
          </div>
        </header>

        {/* Main content */}
        <main id="main-content" className="flex-1 overflow-auto p-4" tabIndex={-1}>
          {children}
        </main>
      </SidebarInset>

      {/* Feature #128: Command palette for quick navigation */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={closeCommandPalette} />
    </SidebarProvider>
  );
}
