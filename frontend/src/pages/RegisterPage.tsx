import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../utils/errorHandling';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleRegister = async (e: React.FormEvent) => {
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

    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Registration failed');
      }

      // Redirect to login on success
      navigate('/login', { state: { message: 'Registration successful! Please login.' } });
    } catch (err) {
      // Use enhanced error handling for network errors
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-foreground">Register</h2>
          <p className="mt-2 text-muted-foreground">
            Create your QA Guardian account
          </p>
        </div>
        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="register-name" className="mb-1 block text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              autoComplete="name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="register-email" className="mb-1 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              placeholder="you@example.com"
              required
              aria-describedby={emailError ? 'register-email-error' : undefined}
              aria-invalid={!!emailError}
              className={`w-full rounded-md border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 ${
                emailError
                  ? 'border-destructive focus:border-destructive focus:ring-destructive'
                  : 'border-input focus:border-primary focus:ring-primary'
              }`}
            />
            {emailError && (
              <p id="register-email-error" role="alert" className="mt-1 text-sm text-destructive">{emailError}</p>
            )}
          </div>
          <div>
            <label htmlFor="register-password" className="mb-1 block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onBlur={handlePasswordBlur}
              placeholder="Minimum 8 characters"
              required
              autoComplete="new-password"
              aria-describedby={passwordError ? 'register-password-error' : undefined}
              aria-invalid={!!passwordError}
              className={`w-full rounded-md border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 ${
                passwordError
                  ? 'border-destructive focus:border-destructive focus:ring-destructive'
                  : 'border-input focus:border-primary focus:ring-primary'
              }`}
            />
            {passwordError && (
              <p id="register-password-error" role="alert" className="mt-1 text-sm text-destructive">{passwordError}</p>
            )}
          </div>
          <div>
            <label htmlFor="register-confirm-password" className="mb-1 block text-sm font-medium text-foreground">
              Confirm Password
            </label>
            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              autoComplete="new-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
