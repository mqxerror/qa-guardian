// SettingsPage - Unified settings page with tabbed navigation
// Feature #1832: Consolidate Admin menu into single Settings page
// Feature #451: Tab contents extracted to components/settings/
// Feature #623: React.lazy for tab components to improve initial load

import { useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { Users, Settings, Monitor, CreditCard, Key, Bell, FileText } from 'lucide-react';

// Feature #623: Lazy-load tab components - only the active tab is loaded
const TeamTab = lazy(() => import('../components/settings/TeamTab').then(m => ({ default: m.TeamTab })));
const GeneralTab = lazy(() => import('../components/settings/GeneralTab').then(m => ({ default: m.GeneralTab })));
const BillingTab = lazy(() => import('../components/settings/BillingTab').then(m => ({ default: m.BillingTab })));
const APIKeysTab = lazy(() => import('../components/settings/APIKeysTab').then(m => ({ default: m.APIKeysTab })));
const WebhooksTab = lazy(() => import('../components/settings/WebhooksTab').then(m => ({ default: m.WebhooksTab })));
const AuditLogsTab = lazy(() => import('../components/settings/AuditLogsTab').then(m => ({ default: m.AuditLogsTab })));
const NotificationsTab = lazy(() => import('../components/settings/NotificationsTab').then(m => ({ default: m.NotificationsTab })));
const AIConfigurationTab = lazy(() => import('../components/settings/AIConfigurationTab').then(m => ({ default: m.AIConfigurationTab })));

// Tab types for the settings page
type SettingsTab = 'team' | 'general' | 'ai-config' | 'billing' | 'api-keys' | 'webhooks' | 'audit-logs' | 'notifications';

// Tab configuration
const TABS: { id: SettingsTab; label: string; icon: React.ReactNode; requiredRole?: string[] }[] = [
  {
    id: 'team',
    label: 'Team',
    icon: <Users className="h-5 w-5" />,
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'general',
    label: 'General',
    icon: <Settings className="h-5 w-5" />,
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'ai-config',
    label: 'AI Configuration',
    icon: <Monitor className="h-5 w-5" />,
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: <CreditCard className="h-5 w-5" />,
    requiredRole: ['owner']
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: <Key className="h-5 w-5" />,
    requiredRole: ['developer', 'admin', 'owner']
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: <Bell className="h-5 w-5" />,
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    icon: <FileText className="h-5 w-5" />,
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell className="h-5 w-5" />
  }
];

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  // Get active tab from URL or default to 'team'
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'team';

  // Filter tabs based on user role
  const visibleTabs = TABS.filter(tab => {
    if (!tab.requiredRole) return true;
    return tab.requiredRole.includes(user?.role || '');
  });

  // Set active tab in URL
  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  // If current tab is not visible for user's role, redirect to first visible tab
  useEffect(() => {
    const tabIsVisible = visibleTabs.some(t => t.id === activeTab);
    if (!tabIsVisible && visibleTabs.length > 0) {
      setSearchParams({ tab: visibleTabs[0].id });
    }
  }, [activeTab, visibleTabs, setSearchParams]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'team':
        return <TeamTab />;
      case 'general':
        return <GeneralTab />;
      case 'ai-config':
        return <AIConfigurationTab />;
      case 'billing':
        return <BillingTab />;
      case 'api-keys':
        return <APIKeysTab />;
      case 'webhooks':
        return <WebhooksTab />;
      case 'audit-logs':
        return <AuditLogsTab />;
      case 'notifications':
        return <NotificationsTab />;
      default:
        return <GeneralTab />;
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <PageHeader
          title="Settings"
          description="Manage your organization settings and preferences."
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Settings' }
          ]}
        />

        {/* Tabs Navigation */}
        <div className="border-b border-border mb-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content - Feature #623: Suspense boundary for lazy-loaded tabs */}
        <div className="min-h-[400px]">
          <Suspense fallback={
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-32 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          }>
            {renderTabContent()}
          </Suspense>
        </div>
      </div>
    </Layout>
  );
}
