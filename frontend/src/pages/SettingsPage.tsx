// SettingsPage - Unified settings page with tabbed navigation
// Feature #1832: Consolidate Admin menu into single Settings page
// Feature #451: Tab contents extracted to components/settings/

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import {
  TeamTab,
  GeneralTab,
  BillingTab,
  APIKeysTab,
  WebhooksTab,
  AuditLogsTab,
  NotificationsTab,
  AIConfigurationTab,
} from '../components/settings';

// Tab types for the settings page
type SettingsTab = 'team' | 'general' | 'ai-config' | 'billing' | 'api-keys' | 'webhooks' | 'audit-logs' | 'notifications';

// Tab configuration
const TABS: { id: SettingsTab; label: string; icon: React.ReactNode; requiredRole?: string[] }[] = [
  {
    id: 'team',
    label: 'Team',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'ai-config',
    label: 'AI Configuration',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    requiredRole: ['owner']
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    requiredRole: ['developer', 'admin', 'owner']
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    requiredRole: ['admin', 'owner']
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    )
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
        {/* Page Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground">Manage your organization settings and preferences.</p>
        </div>

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

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {renderTabContent()}
        </div>
      </div>
    </Layout>
  );
}
