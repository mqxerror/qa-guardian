/**
 * Feature #126: EmptyState Component
 * Provides consistent empty state UI with icon, message, and optional CTA
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Folder,
  ClipboardCheck,
  Play,
  ShieldCheck,
  BarChart3,
  Search,
  Clock,
  AlertTriangle,
  Users,
  FileText,
  ChevronRight
} from 'lucide-react';

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
  folder: <Folder className="h-12 w-12" strokeWidth={1.5} />,
  // Tests / Checklist
  test: <ClipboardCheck className="h-12 w-12" strokeWidth={1.5} />,
  // Runs / Play
  run: <Play className="h-12 w-12" strokeWidth={1.5} />,
  // Security / Shield
  security: <ShieldCheck className="h-12 w-12" strokeWidth={1.5} />,
  // Analytics / Chart
  analytics: <BarChart3 className="h-12 w-12" strokeWidth={1.5} />,
  // Search / Magnifying glass
  search: <Search className="h-12 w-12" strokeWidth={1.5} />,
  // Clock / History
  history: <Clock className="h-12 w-12" strokeWidth={1.5} />,
  // Bug / Issues
  bug: <AlertTriangle className="h-12 w-12" strokeWidth={1.5} />,
  // Users / Team
  users: <Users className="h-12 w-12" strokeWidth={1.5} />,
  // Document / Files
  document: <FileText className="h-12 w-12" strokeWidth={1.5} />,
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
          {isPrimary && <ChevronRight className="h-4 w-4" />}
        </Link>
      );
    }

    return (
      <button onClick={actionConfig.onClick} className={baseClasses}>
        {actionConfig.label}
        {isPrimary && <ChevronRight className="h-4 w-4" />}
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
