/**
 * Organization Switcher Component
 *
 * Allows users to switch between organizations they have access to.
 * Extracted from Sidebar.tsx for Feature #104.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

// Organization Switcher Icon
export const OrgSwitcherIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

export const ChevronDownIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export const CheckIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

interface OrganizationSwitcherProps {
  collapsed: boolean;
}

export function OrganizationSwitcher({ collapsed }: OrganizationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, organizations, fetchOrganizations, switchOrganization } = useAuthStore();

  // Fetch organizations on mount
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentOrg = organizations.find(org => org.is_current) || organizations.find(org => org.id === user?.organization_id);

  const handleSwitch = async (orgId: string) => {
    if (orgId === user?.organization_id) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      await switchOrganization(orgId);
      setIsOpen(false);
      // Navigate to dashboard to refresh data for the new organization
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to switch organization:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if only one organization
  if (organizations.length <= 1) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative px-2 mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        title={collapsed ? currentOrg?.name || 'Switch Organization' : undefined}
        className={`flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors ${
          collapsed ? 'justify-center' : ''
        } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
      >
        <OrgSwitcherIcon />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate text-foreground">
              {currentOrg?.name || 'Select Org'}
            </span>
            <ChevronDownIcon />
          </>
        )}
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-1 rounded-md border border-border bg-card shadow-lg ${
          collapsed ? 'left-full ml-2 w-56' : 'left-2 right-2'
        }`}>
          <div className="p-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground">Switch Organization</p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                disabled={isLoading}
                className={`flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-left transition-colors ${
                  org.is_current || org.id === user?.organization_id
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <span className="flex-1 truncate">{org.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{org.role}</span>
                {(org.is_current || org.id === user?.organization_id) && (
                  <CheckIcon />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
