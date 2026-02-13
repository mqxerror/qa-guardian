// Feature #338: Dark-first auth page with premium design
// Feature #402: Lazy-load framer-motion for reduced bundle size
// Feature #711: Migrated to React Query - useForgotPassword mutation
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { LazyMotionWrapper, m } from '../components/LazyMotion';
import { BackgroundBeams, Input } from '../components/aceternity';
import { ArrowLeft, Mail, CheckCircle, Loader2 } from 'lucide-react';
import { useReducedMotion } from '../components/ui';
import { Button } from '@/components/ui/button';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const prefersReducedMotion = useReducedMotion();

  // React Query mutation for forgot password
  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send reset link');
      }

      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to send reset link');
    },
  });

  const isLoading = forgotPasswordMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    forgotPasswordMutation.mutate(email);
  };

  if (isSubmitted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        {/* Background Effects */}
        <BackgroundBeams className="opacity-40" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        <m.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-sm">
            <div className="text-center">
              <m.div
                initial={prefersReducedMotion ? {} : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/20"
              >
                <CheckCircle className="h-8 w-8 text-success" />
              </m.div>
              <m.h2
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-2xl font-bold text-transparent"
              >
                Check Your Email
              </m.h2>
              <m.p
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-3 text-muted-foreground"
              >
                If an account with that email exists, we've sent a password reset link.
              </m.p>
              <m.p
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning"
              >
                <strong>Development Mode:</strong> Check the backend console for the reset link.
              </m.p>
              <m.div
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Link
                  to="/login"
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:from-primary hover:to-primary/80"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>
              </m.div>
            </div>
          </div>
        </m.div>
      </div>
    );
  }

  return (
    <LazyMotionWrapper>
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background Effects */}
      <BackgroundBeams className="opacity-40" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <m.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <m.div
              initial={prefersReducedMotion ? {} : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"
            >
              <Mail className="h-6 w-6 text-primary" />
            </m.div>
            <m.h2
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-3xl font-bold text-transparent"
            >
              Forgot Password
            </m.h2>
            <m.p
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-2 text-muted-foreground"
            >
              Enter your email and we'll send you a reset link
            </m.p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Error Alert */}
            {error && (
              <m.div
                initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
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
              transition={{ delay: 0.4 }}
            >
              <Input
                id="email"
                type="email"
                label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </m.div>

            {/* Submit Button */}
            <m.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full py-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </Button>
            </m.div>
          </form>

          {/* Back to Login */}
          <m.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center text-sm text-muted-foreground"
          >
            Remember your password?{' '}
            <Link to="/login" className="text-primary hover:text-primary/70 transition-colors font-medium">
              Sign in
            </Link>
          </m.div>
        </div>
      </m.div>
    </div>
    </LazyMotionWrapper>
  );
}
