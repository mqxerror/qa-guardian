import { ReactNode, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../stores/authStore';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  // Role-based menu visibility
  const canViewSettings = user?.role === 'owner' || user?.role === 'admin';
  const canViewTeam = user?.role === 'owner' || user?.role === 'admin';
  const canViewBilling = user?.role === 'owner';
  const canViewApiKeys = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Mobile Header */}
        <header className="md:hidden border-b border-border bg-card px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">QA Guardian</h1>
            <button
              className="p-2.5 min-w-[44px] min-h-[44px] rounded-md hover:bg-muted flex items-center justify-center"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile menu dropdown */}
          {mobileMenuOpen && (
            <div className="mt-4 pb-4 border-t border-border pt-4">
              <nav className="flex flex-col gap-1">
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm font-medium min-h-[44px] flex items-center px-3 rounded-md hover:bg-muted ${
                    isActive('/dashboard') ? 'bg-muted text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/projects"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm font-medium min-h-[44px] flex items-center px-3 rounded-md hover:bg-muted ${
                    isActive('/projects') ? 'bg-muted text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Projects
                </Link>
                <Link
                  to="/schedules"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm font-medium min-h-[44px] flex items-center px-3 rounded-md hover:bg-muted ${
                    isActive('/schedules') ? 'bg-muted text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Schedules
                </Link>
                <Link
                  to="/analytics"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm font-medium min-h-[44px] flex items-center px-3 rounded-md hover:bg-muted ${
                    isActive('/analytics') ? 'bg-muted text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Analytics
                </Link>
                <Link
                  to="/security"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm font-medium min-h-[44px] flex items-center px-3 rounded-md hover:bg-muted ${
                    isActive('/security') ? 'bg-muted text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Security
                </Link>
                {canViewTeam && (
                  <Link
                    to="/organization/members"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-sm font-medium min-h-[44px] flex items-center px-3 rounded-md hover:bg-muted ${
                      isActive('/organization/members') ? 'bg-muted text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Team
                  </Link>
                )}
                {canViewSettings && (
                  <Link
                    to="/organization/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-sm font-medium min-h-[44px] flex items-center px-3 rounded-md hover:bg-muted ${
                      isActive('/organization/settings') ? 'bg-muted text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Settings
                  </Link>
                )}
                {canViewBilling && (
                  <Link
                    to="/organization/billing"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-sm font-medium min-h-[44px] flex items-center px-3 rounded-md hover:bg-muted ${
                      isActive('/organization/billing') ? 'bg-muted text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Billing
                  </Link>
                )}
                {canViewApiKeys && (
                  <Link
                    to="/organization/api-keys"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-sm font-medium min-h-[44px] flex items-center px-3 rounded-md hover:bg-muted ${
                      isActive('/organization/api-keys') ? 'bg-muted text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    API Keys
                  </Link>
                )}
              </nav>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">{user?.name}</span>
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="rounded-md bg-muted min-h-[44px] px-4 text-sm font-medium text-foreground hover:bg-muted/80"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
