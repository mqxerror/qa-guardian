/**
 * LoadingSpinner Component
 * Feature #1360: Code duplication detection
 *
 * Shared loading spinner component to replace duplicated loading UI code.
 * Used by ProtectedRoute, RoleProtectedRoute, and other components.
 */

import React from 'react';

interface LoadingSpinnerProps {
  /** Custom message to display below the spinner */
  message?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show full page centered spinner */
  fullPage?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-4',
  lg: 'h-12 w-12 border-4',
};

/**
 * A reusable loading spinner component with optional message.
 *
 * @example
 * // Basic usage
 * <LoadingSpinner />
 *
 * @example
 * // Full page centered spinner
 * <LoadingSpinner fullPage message="Authenticating..." />
 *
 * @example
 * // Small inline spinner
 * <LoadingSpinner size="sm" />
 */
export function LoadingSpinner({
  message = 'Loading...',
  size = 'md',
  fullPage = false,
  className = '',
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div
        className={`animate-spin rounded-full border-primary border-t-transparent ${sizeClasses[size]}`}
        role="status"
        aria-label="Loading"
      />
      {message && (
        <p className="text-muted-foreground text-sm">{message}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * A full-page loading overlay with spinner.
 * Useful for page transitions or initial data loading.
 */
export function FullPageLoader({
  message = 'Loading...',
}: {
  message?: string;
}) {
  return <LoadingSpinner fullPage message={message} />;
}

export default LoadingSpinner;
