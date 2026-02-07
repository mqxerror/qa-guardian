// Feature #338: Dark-first auth page with premium design
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BackgroundBeams, Input } from '../components/aceternity';
import { ArrowLeft, KeyRound, CheckCircle, XCircle, CheckCircle2 } from 'lucide-react';
import { useReducedMotion } from '../components/ui';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const prefersReducedMotion = useReducedMotion();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Get password strength for visual indicator
  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { score: 2, label: 'Medium', color: 'bg-yellow-500' };
    return { score: 3, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  // Invalid token state
  if (!token) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <BackgroundBeams className="opacity-40" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-sm">
            <div className="text-center">
              <motion.div
                initial={prefersReducedMotion ? {} : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20"
              >
                <XCircle className="h-8 w-8 text-red-400" />
              </motion.div>
              <motion.h2
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-2xl font-bold text-transparent"
              >
                Invalid Reset Link
              </motion.h2>
              <motion.p
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-3 text-muted-foreground"
              >
                This password reset link is invalid or has expired.
              </motion.p>
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Link
                  to="/forgot-password"
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 font-medium text-white transition-all hover:from-blue-500 hover:to-blue-400"
                >
                  Request New Link
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
        <BackgroundBeams className="opacity-40" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-sm">
            <div className="text-center">
              <motion.div
                initial={prefersReducedMotion ? {} : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20"
              >
                <CheckCircle className="h-8 w-8 text-green-400" />
              </motion.div>
              <motion.h2
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-2xl font-bold text-transparent"
              >
                Password Reset!
              </motion.h2>
              <motion.p
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-3 text-muted-foreground"
              >
                Your password has been successfully reset.
              </motion.p>
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Link
                  to="/login"
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 font-medium text-white transition-all hover:from-blue-500 hover:to-blue-400"
                >
                  Login with New Password
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main reset form
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <BackgroundBeams className="opacity-40" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <motion.div
              initial={prefersReducedMotion ? {} : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20"
            >
              <KeyRound className="h-6 w-6 text-blue-400" />
            </motion.div>
            <motion.h2
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-3xl font-bold text-transparent"
            >
              Reset Password
            </motion.h2>
            <motion.p
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-2 text-muted-foreground"
            >
              Enter your new password below
            </motion.p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                role="alert"
                className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}

            {/* Password Input */}
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Input
                id="password"
                type="password"
                label="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
                autoComplete="new-password"
              />
              {/* Password Strength Indicator */}
              {password && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(passwordStrength.score / 3) * 100}%` }}
                        className={`h-full ${passwordStrength.color}`}
                      />
                    </div>
                    <span className={`text-xs ${passwordStrength.color.replace('bg-', 'text-')}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <div className={`flex items-center gap-1 ${password.length >= 8 ? 'text-green-400' : ''}`}>
                      <CheckCircle2 className={`h-3 w-3 ${password.length >= 8 ? 'text-green-400' : 'text-muted-foreground/50'}`} />
                      8+ characters
                    </div>
                    <div className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-green-400' : ''}`}>
                      <CheckCircle2 className={`h-3 w-3 ${/[A-Z]/.test(password) ? 'text-green-400' : 'text-muted-foreground/50'}`} />
                      Uppercase
                    </div>
                    <div className={`flex items-center gap-1 ${/[a-z]/.test(password) ? 'text-green-400' : ''}`}>
                      <CheckCircle2 className={`h-3 w-3 ${/[a-z]/.test(password) ? 'text-green-400' : 'text-muted-foreground/50'}`} />
                      Lowercase
                    </div>
                    <div className={`flex items-center gap-1 ${/[0-9]/.test(password) ? 'text-green-400' : ''}`}>
                      <CheckCircle2 className={`h-3 w-3 ${/[0-9]/.test(password) ? 'text-green-400' : 'text-muted-foreground/50'}`} />
                      Number
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Confirm Password Input */}
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Input
                id="confirmPassword"
                type="password"
                label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                autoComplete="new-password"
                error={confirmPassword && password !== confirmPassword ? "Passwords don't match" : undefined}
              />
            </motion.div>

            {/* Submit Button */}
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 font-medium text-white transition-all hover:from-blue-500 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Resetting...</span>
                    </>
                  ) : (
                    <span>Reset Password</span>
                  )}
                </span>
              </button>
            </motion.div>
          </form>

          {/* Back to Login */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center"
          >
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-blue-400 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
