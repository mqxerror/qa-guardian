// Feature #338: Dark-first auth page with premium design
// Feature #402: Lazy-load framer-motion for reduced bundle size
// Feature #712: Migrated to React Query - useRegister mutation
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { LazyMotionWrapper, m } from '../components/LazyMotion';
import { getErrorMessage } from '../utils/errorHandling';
import { BackgroundBeams, Input } from '../components/aceternity';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // React Query mutation for registration
  const registerMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string }) => {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Registration failed');
      }
      return response.json();
    },
    onSuccess: () => {
      navigate('/login', { state: { message: 'Registration successful! Please login.' } });
    },
    onError: (err: Error) => {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    },
  });

  const isLoading = registerMutation.isPending;

  // Email validation helper
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation helper - returns error message or empty string
  const validatePassword = (pwd: string): string => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return '';
  };

  // Get password strength for visual indicator
  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-destructive' };
    if (score <= 4) return { score: 2, label: 'Medium', color: 'bg-warning' };
    return { score: 3, label: 'Strong', color: 'bg-success' };
  };

  // Validate email on blur
  const handleEmailBlur = () => {
    if (email && !isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  // Clear email error when typing valid email
  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError && isValidEmail(value)) {
      setEmailError('');
    }
  };

  // Validate password on blur
  const handlePasswordBlur = () => {
    if (password) {
      setPasswordError(validatePassword(password));
    }
  };

  // Clear password error when valid
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (passwordError && !validatePassword(value)) {
      setPasswordError('');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate email format
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password complexity
    const pwdError = validatePassword(password);
    if (pwdError) {
      setPasswordError(pwdError);
      return;
    }

    registerMutation.mutate({ name, email, password });
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <LazyMotionWrapper>
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background Effects */}
      <BackgroundBeams className="opacity-40" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Register Card */}
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-border bg-background/80 p-8 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <m.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-b from-white to-muted-foreground bg-clip-text text-3xl font-bold text-transparent"
            >
              Create Account
            </m.h2>
            <m.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-2 text-muted-foreground"
            >
              Join QA Guardian today
            </m.p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5" noValidate>
            {/* Error Alert */}
            {error && (
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </m.div>
            )}

            {/* Name Input */}
            <m.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Input
                id="register-name"
                type="text"
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoComplete="name"
              />
            </m.div>

            {/* Email Input */}
            <m.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Input
                id="register-email"
                type="email"
                label="Email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="you@example.com"
                required
                autoComplete="email"
                error={emailError}
                aria-describedby={emailError ? 'register-email-error' : undefined}
                aria-invalid={!!emailError}
              />
            </m.div>

            {/* Password Input */}
            <m.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Input
                id="register-password"
                type="password"
                label="Password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={handlePasswordBlur}
                placeholder="Minimum 8 characters"
                required
                autoComplete="new-password"
                error={passwordError}
                aria-describedby={passwordError ? 'register-password-error' : undefined}
                aria-invalid={!!passwordError}
              />
              {/* Password Strength Indicator */}
              {password && (
                <m.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-card rounded-full overflow-hidden">
                      <m.div
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
                    <div className={`flex items-center gap-1 ${password.length >= 8 ? 'text-success' : ''}`}>
                      <CheckCircle2 className={`h-3 w-3 ${password.length >= 8 ? 'text-success' : 'text-foreground'}`} />
                      8+ characters
                    </div>
                    <div className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-success' : ''}`}>
                      <CheckCircle2 className={`h-3 w-3 ${/[A-Z]/.test(password) ? 'text-success' : 'text-foreground'}`} />
                      Uppercase
                    </div>
                    <div className={`flex items-center gap-1 ${/[a-z]/.test(password) ? 'text-success' : ''}`}>
                      <CheckCircle2 className={`h-3 w-3 ${/[a-z]/.test(password) ? 'text-success' : 'text-foreground'}`} />
                      Lowercase
                    </div>
                    <div className={`flex items-center gap-1 ${/[0-9]/.test(password) ? 'text-success' : ''}`}>
                      <CheckCircle2 className={`h-3 w-3 ${/[0-9]/.test(password) ? 'text-success' : 'text-foreground'}`} />
                      Number
                    </div>
                  </div>
                </m.div>
              )}
            </m.div>

            {/* Confirm Password Input */}
            <m.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Input
                id="register-confirm-password"
                type="password"
                label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
                error={confirmPassword && password !== confirmPassword ? "Passwords don't match" : undefined}
              />
            </m.div>

            {/* Submit Button */}
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full py-3"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </Button>
            </m.div>
          </form>

          {/* Login Link */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center text-sm text-muted-foreground"
          >
            Already have an account?{' '}
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
