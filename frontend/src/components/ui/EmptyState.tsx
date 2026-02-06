/**
 * Feature #126: EmptyState Component
 * Provides consistent empty state UI with icon, message, and optional CTA
 */

import React from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  /** Icon component or emoji to display */
  icon?: React.ReactNode;
  /** Main title text */
  title: string;
  /** Description/subtitle text */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Standard icons for common empty states
 */
export const EmptyStateIcons = {
  // Projects / Folders
  folder: (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  // Tests / Checklist
  test: (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  // Runs / Play
  run: (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
    </svg>
  ),
  // Security / Shield
  security: (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  // Analytics / Chart
  analytics: (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  // Search / Magnifying glass
  search: (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  // Clock / History
  history: (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  // Bug / Issues
  bug: (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  // Users / Team
  users: (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  // Document / Files
  document: (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

const sizeClasses = {
  sm: 'py-6 px-4',
  md: 'py-8 px-6',
  lg: 'py-12 px-8',
};

const iconSizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

/**
 * EmptyState component for displaying when lists/pages have no data
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
  size = 'md',
}: EmptyStateProps) {
  const renderAction = (
    actionConfig: { label: string; onClick?: () => void; href?: string },
    isPrimary: boolean
  ) => {
    const baseClasses = isPrimary
      ? 'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors'
      : 'inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors';

    if (actionConfig.href) {
      return (
        <Link to={actionConfig.href} className={baseClasses}>
          {actionConfig.label}
          {isPrimary && (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </Link>
      );
    }

    return (
      <button onClick={actionConfig.onClick} className={baseClasses}>
        {actionConfig.label}
        {isPrimary && (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
    );
  };

  return (
    <div
      className={`rounded-lg border border-dashed border-border bg-card ${sizeClasses[size]} text-center ${className}`}
    >
      {/* Icon */}
      {icon && (
        <div className="flex justify-center mb-4 text-muted-foreground">
          {typeof icon === 'string' ? (
            <span className="text-4xl">{icon}</span>
          ) : (
            <div className={iconSizeClasses[size]}>{icon}</div>
          )}
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      {/* Description */}
      {description && (
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex items-center justify-center gap-3">
          {action && renderAction(action, true)}
          {secondaryAction && renderAction(secondaryAction, false)}
        </div>
      )}
    </div>
  );
}

/**
 * Pre-configured empty states for common scenarios
 */
export const EmptyStates = {
  /** No projects in organization */
  noProjects: (onCreateClick?: () => void) => (
    <EmptyState
      icon={EmptyStateIcons.folder}
      title="No projects yet"
      description="Create your first project to start organizing your test suites and running tests."
      action={onCreateClick ? { label: 'Create Project', onClick: onCreateClick } : { label: 'Create Project', href: '/projects/new' }}
    />
  ),

  /** No tests in suite */
  noTests: (onCreateClick?: () => void, onRecordClick?: () => void) => (
    <EmptyState
      icon={EmptyStateIcons.test}
      title="No tests yet"
      description="Create your first test in this suite using the test builder or recorder."
      action={onCreateClick ? { label: 'Create Test', onClick: onCreateClick } : undefined}
      secondaryAction={onRecordClick ? { label: 'Record Test', onClick: onRecordClick } : undefined}
    />
  ),

  /** No test runs */
  noRuns: (onRunClick?: () => void) => (
    <EmptyState
      icon={EmptyStateIcons.history}
      title="No runs yet"
      description="Run your first test to see results here. Test runs track execution status, screenshots, and performance."
      action={onRunClick ? { label: 'Run Tests', onClick: onRunClick } : undefined}
    />
  ),

  /** No security findings */
  noSecurityFindings: (onScanClick?: () => void) => (
    <EmptyState
      icon={EmptyStateIcons.security}
      title="No security findings"
      description="Great news! No security vulnerabilities have been found. Run a scan to check for potential issues."
      action={onScanClick ? { label: 'Run Scan', onClick: onScanClick } : undefined}
    />
  ),

  /** Search returned no results */
  noSearchResults: (query: string, onClearClick?: () => void) => (
    <EmptyState
      icon={EmptyStateIcons.search}
      title="No results found"
      description={`No items match your search "${query}". Try a different search term.`}
      action={onClearClick ? { label: 'Clear Search', onClick: onClearClick } : undefined}
    />
  ),

  /** No suites in project */
  noSuites: (onCreateClick?: () => void) => (
    <EmptyState
      icon={EmptyStateIcons.folder}
      title="No test suites yet"
      description="Create your first test suite to organize and run your tests."
      action={onCreateClick ? { label: 'Create Suite', onClick: onCreateClick } : undefined}
    />
  ),

  /** No analytics data */
  noAnalytics: () => (
    <EmptyState
      icon={EmptyStateIcons.analytics}
      title="No analytics data"
      description="Run some tests to see analytics and trends here."
    />
  ),

  /** No team members */
  noTeamMembers: (onInviteClick?: () => void) => (
    <EmptyState
      icon={EmptyStateIcons.users}
      title="No team members"
      description="Invite your team to collaborate on testing."
      action={onInviteClick ? { label: 'Invite Members', onClick: onInviteClick } : undefined}
    />
  ),
};

export default EmptyState;
