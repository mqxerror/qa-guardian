/**
 * Feature #432: 404 Not Found Page
 * Polished dark-first design with helpful navigation options
 */
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Frown, ArrowLeft, Home } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const isAuthenticated = !!token;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center">
        {/* 404 with subtle animation */}
        <div className="relative mb-6">
          <h1
            className="text-[10rem] font-bold leading-none text-transparent bg-clip-text bg-gradient-to-b from-muted-foreground/30 to-muted-foreground/10 select-none"
            aria-hidden="true"
          >
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
              <Frown className="h-12 w-12 text-muted-foreground mx-auto" strokeWidth={1.5} aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-semibold text-foreground mb-3">
          Page not found
        </h2>

        {/* Description */}
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Sorry, we couldn't find the page you're looking for. It may have been moved,
          deleted, or perhaps never existed.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-6 py-3 border border-border rounded-lg font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go Back
          </button>

          <Link
            to={isAuthenticated ? '/dashboard' : '/'}
            className="w-full sm:w-auto px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            {isAuthenticated ? 'Go to Dashboard' : 'Go Home'}
          </Link>
        </div>

        {/* Quick links for authenticated users */}
        {isAuthenticated && (
          <div className="border-t border-border pt-6">
            <p className="text-sm text-muted-foreground mb-4">Or try one of these pages:</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <Link
                to="/projects"
                className="text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                Projects
              </Link>
              <span className="text-muted-foreground/50">•</span>
              <Link
                to="/analytics"
                className="text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                Analytics
              </Link>
              <span className="text-muted-foreground/50">•</span>
              <Link
                to="/security"
                className="text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                Security
              </Link>
              <span className="text-muted-foreground/50">•</span>
              <Link
                to="/settings"
                className="text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                Settings
              </Link>
            </div>
          </div>
        )}

        {/* Report link */}
        <p className="mt-8 text-xs text-muted-foreground">
          If you believe this is an error, please{' '}
          <a
            href="mailto:support@qa-guardian.io"
            className="text-primary hover:underline"
          >
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}
