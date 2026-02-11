// Feature #338: Dark-first auth page with premium design
// Feature #402: Lazy-load framer-motion for reduced bundle size
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LazyMotionWrapper, m } from '../components/LazyMotion';
import { useAuthStore } from '../stores/authStore';
import { getErrorMessage } from '../utils/errorHandling';
import { BackgroundBeams, Input } from '../components/aceternity';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useReducedMotion } from '../components/ui';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  // Get the page user was trying to access and session expired flag
  const locationState = location.state as { from?: { pathname: string }; sessionExpired?: boolean } | null;
  const from = locationState?.from?.pathname || '/dashboard';
  const sessionExpired = locationState?.sessionExpired || false;

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      // Use enhanced error handling for network errors
      setError(getErrorMessage(err, 'Login failed. Please check your credentials and try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LazyMotionWrapper>
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background Effects */}
      <BackgroundBeams className="opacity-40" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Login Card */}
      <m.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <m.h2
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.05 }}
              className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-3xl font-bold text-transparent"
            >
              Welcome Back
            </m.h2>
            <m.p
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.08 }}
              className="mt-2 text-muted-foreground"
            >
              Sign in to QA Guardian
            </m.p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Session Expired Alert */}
            {sessionExpired && (
              <m.div
                initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : undefined}
                className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning"
              >
                Your session has expired. Please log in again.
              </m.div>
            )}

            {/* Error Alert */}
            {error && (
              <m.div
                initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : undefined}
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </m.div>
            )}

            {/* Email Input */}
            <m.div
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1 }}
            >
              <Input
                id="email"
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </m.div>

            {/* Password Input */}
            <m.div
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.13 }}
            >
              <Input
                id="password"
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </m.div>

            {/* Submit Button */}
            <m.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.16 }}
            >
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-primary to-primary px-4 py-3 font-medium text-primary-foreground transition-all hover:from-primary hover:to-primary/80 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </button>
            </m.div>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border"></div>
            <span className="text-sm text-muted-foreground">or continue with</span>
            <div className="h-px flex-1 bg-border"></div>
          </div>

          {/* Google OAuth */}
          <m.button
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.19 }}
            onClick={() => {
              window.location.href = `${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/auth/google`;
            }}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 font-medium text-foreground transition-colors hover:border-muted-foreground/50 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </m.button>

          {/* Forgot Password */}
          <m.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.22 }}
            className="mt-4 text-center"
          >
            <Link to="/forgot-password" className="text-sm text-primary hover:text-primary/70 transition-colors">
              Forgot your password?
            </Link>
          </m.div>

          {/* Test Accounts */}
          <m.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.25 }}
            className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground"
          >
            <p className="font-medium mb-2 text-muted-foreground">Test accounts (Org 1):</p>
            <p>owner@example.com / Owner123!</p>
            <p>admin@example.com / Admin123!</p>
            <p>developer@example.com / Developer123!</p>
            <p>viewer@example.com / Viewer123!</p>
            <p className="font-medium mt-3 mb-2 text-muted-foreground">Test account (Org 2):</p>
            <p>otherowner@example.com / Other123!</p>
          </m.div>

          {/* Register Link */}
          <m.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.28 }}
            className="mt-6 text-center text-sm text-muted-foreground"
          >
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:text-primary/70 transition-colors font-medium">
              Create account
            </Link>
          </m.div>
        </div>
      </m.div>
    </div>
    </LazyMotionWrapper>
  );
}
