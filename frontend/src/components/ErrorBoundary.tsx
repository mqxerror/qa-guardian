/**
 * Error Boundary Component for catching and handling React errors
 * Feature #101: Add Error Boundaries to all route components
 * Feature #166: Report errors to backend for tracking
 *
 * Catches JavaScript errors in child component tree, logs them,
 * reports them to the backend, and displays a fallback UI.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorReported: boolean;
}

/**
 * Feature #166: Report error to backend API
 * Sends error details to /api/v1/errors for tracking and debugging
 */
async function reportErrorToBackend(
  error: Error,
  errorInfo: ErrorInfo | null
): Promise<void> {
  try {
    // Get auth token from localStorage if available
    const authStore = localStorage.getItem('qa-guardian-auth');
    const token = authStore ? JSON.parse(authStore).state?.token : null;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Collect environment info
    const screenResolution = `${window.screen.width}x${window.screen.height}`;

    await fetch('/api/v1/errors', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        screenResolution,
        metadata: {
          timestamp: new Date().toISOString(),
          errorName: error.name,
          pathname: window.location.pathname,
          search: window.location.search,
          referrer: document.referrer,
          // Performance timing if available
          loadTime: performance.timing?.loadEventEnd - performance.timing?.navigationStart,
        },
      }),
    });
  } catch (reportError) {
    // Don't let reporting errors cause more issues
    console.warn('[ErrorBoundary] Failed to report error to backend:', reportError);
  }
}

/**
 * Error Boundary class component for catching render errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorReported: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to console for debugging
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    // Feature #166: Report error to backend (only once per error)
    if (!this.state.errorReported) {
      this.setState({ errorReported: true });
      reportErrorToBackend(error, errorInfo);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorReported: false });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Error Fallback UI component with retry button and error details
 */
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo?: ErrorInfo | null;
  onReset?: () => void;
  title?: string;
}

export function ErrorFallback({
  error,
  errorInfo,
  onReset,
  title = 'Something went wrong',
}: ErrorFallbackProps): JSX.Element {
  const isDev = import.meta.env.DEV;

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center shadow-lg">
        {/* Error Icon */}
        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Title */}
        <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>

        {/* Error Message */}
        <p className="text-muted-foreground mb-4">
          {error?.message || 'An unexpected error occurred while rendering this page.'}
        </p>

        {/* Feature #166: Error has been reported notice */}
        <p className="text-xs text-muted-foreground mb-6">
          This error has been automatically reported to our team.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onReset && (
            <button
              onClick={onReset}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              Try Again
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors font-medium text-foreground"
          >
            Reload Page
          </button>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors font-medium text-foreground"
          >
            Go Back
          </button>
        </div>

        {/* Error Details (Dev Only) */}
        {isDev && error && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Show error details
            </summary>
            <div className="mt-2 p-4 bg-muted rounded-lg overflow-auto max-h-48">
              <pre className="text-xs text-destructive whitespace-pre-wrap break-words">
                {error.stack || error.toString()}
              </pre>
              {errorInfo?.componentStack && (
                <pre className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap break-words">
                  {errorInfo.componentStack}
                </pre>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Route Error Boundary - wraps lazy routes with both ErrorBoundary and QueryErrorResetBoundary
 * This handles both React render errors and React Query data fetching errors
 */
interface RouteErrorBoundaryProps {
  children: ReactNode;
}

export function RouteErrorBoundary({ children }: RouteErrorBoundaryProps): JSX.Element {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary onReset={reset}>
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

/**
 * Page Error Boundary - lightweight error boundary for individual page components
 */
export function PageErrorBoundary({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ErrorBoundary
      fallback={
        <ErrorFallback
          error={null}
          title="Failed to load this page"
          onReset={() => window.location.reload()}
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
