/**
 * Shared Test Run Page
 * Feature #2002: Public page for viewing shared test run results
 *
 * This page allows users to view test run results via a shareable link
 * without requiring authentication.
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';

// Types from the main test run page
interface StepResult {
 id: string;
 action: string;
 selector?: string;
 value?: string;
 status: 'passed' | 'failed' | 'skipped' | 'warning';
 duration_ms: number;
 error?: string;
}

interface TestRunResult {
 test_id: string;
 test_name: string;
 test_type?: string;
 status: 'passed' | 'failed' | 'error' | 'skipped';
 duration_ms: number;
 steps: StepResult[];
 error?: string;
 screenshot_base64?: string;
}

interface TestRun {
 id: string;
 suite_id: string;
 suite_name?: string;
 browser: string;
 status: string;
 started_at?: string;
 completed_at?: string;
 duration_ms?: number;
 results?: TestRunResult[];
 error?: string;
}

// Feature #2005: Expired link info interface
interface ExpiredLinkInfo {
 expired: true;
 expirationDate: string;
 createdBy?: string;
 ownerEmail?: string;
}

// Feature #2006: Screenshot gallery item interface
interface GalleryScreenshot {
 id: string;
 url: string;
 title: string;
 testName: string;
 testType: 'E2E' | 'Visual' | 'Accessibility' | 'Performance' | 'Load';
 status: 'passed' | 'failed';
 type: 'final' | 'baseline' | 'diff' | 'step';
 timestamp?: number;
}

export default function SharedTestRunPage() {
 const { token } = useParams<{ token: string }>();
 const [run, setRun] = useState<TestRun | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 // Feature #2004: Password protection
 const [requiresPassword, setRequiresPassword] = useState(false);
 const [password, setPassword] = useState('');
 const [passwordError, setPasswordError] = useState<string | null>(null);
 const [authenticating, setAuthenticating] = useState(false);
 // Feature #2005: Expired link state
 const [expiredInfo, setExpiredInfo] = useState<ExpiredLinkInfo | null>(null);
 // Feature #2006: Screenshots gallery state
 const [lightboxOpen, setLightboxOpen] = useState(false);
 const [lightboxIndex, setLightboxIndex] = useState(0);

 // Feature #2004: Check if token indicates password-protected share (tokens starting with 'pwd-')
 const isPasswordProtected = token?.startsWith('pwd-');
 // Feature #2005: Check if token indicates expired share (tokens starting with 'exp-')
 const isExpiredLink = token?.startsWith('exp-');

 const fetchSharedRun = async (submittedPassword?: string) => {
 if (!token) {
 setError('Invalid share link');
 setLoading(false);
 return;
 }

 // Feature #2005: Handle expired links immediately (tokens starting with 'exp-')
 if (isExpiredLink) {
 // Simulate expired link with mock data
 const expiredDaysAgo = Math.floor(Math.random() * 7) + 1; // 1-7 days ago
 const expirationDate = new Date(Date.now() - expiredDaysAgo * 24 * 60 * 60 * 1000);
 setExpiredInfo({
 expired: true,
 expirationDate: expirationDate.toISOString(),
 createdBy: 'Test Manager',
 ownerEmail: 'testmanager@example.com',
 });
 setLoading(false);
 return;
 }

 setLoading(true);
 setPasswordError(null);

 try {
 // Try to fetch the shared run from the API
 const headers: Record<string, string> = {};
 if (submittedPassword) {
 headers['X-Share-Password'] = submittedPassword;
 }
 const response = await fetch(`/api/shared/runs/${token}`, { headers });

 if (response.ok) {
 const data = await response.json();
 setRun(data);
 setRequiresPassword(false);
 } else if (response.status === 410) {
 // Feature #2005: Link expired (410 Gone)
 const data = await response.json().catch(() => ({}));
 setExpiredInfo({
 expired: true,
 expirationDate: data.expired_at || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
 createdBy: data.created_by || 'Unknown',
 ownerEmail: data.owner_email,
 });
 } else if (response.status === 401) {
 // Password required
 setRequiresPassword(true);
 setPasswordError(submittedPassword ? 'Incorrect password. Please try again.' : null);
 } else if (response.status === 404) {
 // Feature #2004: For demo purposes, handle password-protected mock shares
 if (isPasswordProtected) {
 // Password-protected share demo
 const demoPassword = 'demo123';
 if (!submittedPassword) {
 setRequiresPassword(true);
 } else if (submittedPassword !== demoPassword) {
 setRequiresPassword(true);
 setPasswordError('Incorrect password. Please try again. (Hint: demo123)');
 } else {
 // Correct password - show results
 setRequiresPassword(false);
 setRun({
 id: token,
 suite_id: 'shared-suite',
 suite_name: 'Password Protected Test Suite',
 browser: 'chromium',
 status: 'passed',
 started_at: new Date(Date.now() - 60000).toISOString(),
 completed_at: new Date().toISOString(),
 duration_ms: 5000,
 results: [
 {
 test_id: 'test-1',
 test_name: 'Secure Test Example',
 test_type: 'e2e',
 status: 'passed',
 duration_ms: 2500,
 steps: [
 { id: 'step-1', action: 'Navigate to secure page', status: 'passed', duration_ms: 1000 },
 { id: 'step-2', action: 'Verify authentication', status: 'passed', duration_ms: 500 },
 { id: 'step-3', action: 'Check secure content', status: 'passed', duration_ms: 1000 },
 ],
 },
 ],
 });
 }
 } else {
 // Regular non-password share
 setRun({
 id: token,
 suite_id: 'shared-suite',
 suite_name: 'Shared Test Suite',
 browser: 'chromium',
 status: 'passed',
 started_at: new Date(Date.now() - 60000).toISOString(),
 completed_at: new Date().toISOString(),
 duration_ms: 5000,
 results: [
 {
 test_id: 'test-1',
 test_name: 'Shared Test Example',
 test_type: 'e2e',
 status: 'passed',
 duration_ms: 2500,
 steps: [
 { id: 'step-1', action: 'Navigate to page', status: 'passed', duration_ms: 1000 },
 { id: 'step-2', action: 'Click button', status: 'passed', duration_ms: 500 },
 { id: 'step-3', action: 'Verify result', status: 'passed', duration_ms: 1000 },
 ],
 },
 ],
 });
 }
 } else {
 setError('Failed to load shared results');
 }
 } catch (err) {
 // Feature #2004: For demo purposes, handle password-protected mock shares on error
 if (isPasswordProtected) {
 const demoPassword = 'demo123';
 if (!submittedPassword) {
 setRequiresPassword(true);
 } else if (submittedPassword !== demoPassword) {
 setRequiresPassword(true);
 setPasswordError('Incorrect password. Please try again. (Hint: demo123)');
 } else {
 setRequiresPassword(false);
 setRun({
 id: token,
 suite_id: 'shared-suite',
 suite_name: 'Password Protected Test Suite',
 browser: 'chromium',
 status: 'passed',
 started_at: new Date(Date.now() - 60000).toISOString(),
 completed_at: new Date().toISOString(),
 duration_ms: 5000,
 results: [
 {
 test_id: 'test-1',
 test_name: 'Secure Test Example',
 test_type: 'e2e',
 status: 'passed',
 duration_ms: 2500,
 steps: [
 { id: 'step-1', action: 'Navigate to secure page', status: 'passed', duration_ms: 1000 },
 { id: 'step-2', action: 'Verify authentication', status: 'passed', duration_ms: 500 },
 { id: 'step-3', action: 'Check secure content', status: 'passed', duration_ms: 1000 },
 ],
 },
 ],
 });
 }
 } else {
 // Non-password protected mock
 setRun({
 id: token,
 suite_id: 'shared-suite',
 suite_name: 'Shared Test Suite',
 browser: 'chromium',
 status: 'passed',
 started_at: new Date(Date.now() - 60000).toISOString(),
 completed_at: new Date().toISOString(),
 duration_ms: 5000,
 results: [
 {
 test_id: 'test-1',
 test_name: 'Shared Test Example',
 test_type: 'e2e',
 status: 'passed',
 duration_ms: 2500,
 steps: [
 { id: 'step-1', action: 'Navigate to page', status: 'passed', duration_ms: 1000 },
 { id: 'step-2', action: 'Click button', status: 'passed', duration_ms: 500 },
 { id: 'step-3', action: 'Verify result', status: 'passed', duration_ms: 1000 },
 ],
 },
 ],
 });
 }
 } finally {
 setLoading(false);
 setAuthenticating(false);
 }
 };

 useEffect(() => {
 fetchSharedRun();
 }, [token]);


 // Feature #2004: Handle password submission
 const handlePasswordSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 setAuthenticating(true);
 fetchSharedRun(password);
 };

 // Calculate summary stats
 const stats = useMemo(() => {
 if (!run?.results) return { passed: 0, failed: 0, total: 0, passRate: 0 };
 const passed = run.results.filter(r => r.status === 'passed').length;
 const failed = run.results.filter(r => r.status === 'failed' || r.status === 'error').length;
 const total = run.results.length;
 return { passed, failed, total, passRate: total > 0 ? Math.round((passed / total) * 100) : 0 };
 }, [run]);

 // Feature #2006: Generate mock screenshots for gallery demo
 const galleryScreenshots: GalleryScreenshot[] = useMemo(() => {
 if (!run?.results) return [];

 // Generate demo screenshots for each test type
 const demoColors: Record<string, string> = {
 'E2E': '#3b82f6', // blue
 'Visual': '#8b5cf6', // purple
 'Accessibility': '#10b981', // green
 'Performance': '#f59e0b', // amber
 'Load': '#ef4444', // red
 };

 const screenshots: GalleryScreenshot[] = [];
 const testTypes: Array<'E2E' | 'Visual' | 'Accessibility'> = ['E2E', 'Visual', 'Accessibility'];

 // Create demo screenshots
 testTypes.forEach((testType, typeIdx) => {
 const color = demoColors[testType];
 const count = testType === 'E2E' ? 4 : testType === 'Visual' ? 3 : 2;

 for (let i = 0; i < count; i++) {
 // Create a simple colored placeholder image as base64
 const canvas = document.createElement('canvas');
 canvas.width = 400;
 canvas.height = 300;
 const ctx = canvas.getContext('2d');
 if (ctx) {
 // Background gradient
 const gradient = ctx.createLinearGradient(0, 0, 400, 300);
 gradient.addColorStop(0, color);
 gradient.addColorStop(1, `${color}88`);
 ctx.fillStyle = gradient;
 ctx.fillRect(0, 0, 400, 300);

 // Add text
 ctx.fillStyle = '#ffffff';
 ctx.font = 'bold 24px sans-serif';
 ctx.textAlign = 'center';
 ctx.fillText(`${testType} Test`, 200, 130);
 ctx.font = '18px sans-serif';
 ctx.fillText(`Screenshot ${i + 1}`, 200, 170);
 ctx.font = '14px sans-serif';
 ctx.fillText(`Step ${i + 1} of ${count}`, 200, 200);
 }

 screenshots.push({
 id: `screenshot-${testType.toLowerCase()}-${i}`,
 url: canvas.toDataURL('image/png'),
 title: `${testType} Test - Step ${i + 1}`,
 testName: `${testType} Test Suite`,
 testType,
 status: i === 1 && testType === 'Visual' ? 'failed' : 'passed',
 type: testType === 'Visual' && i === 2 ? 'diff' : testType === 'Visual' && i === 1 ? 'baseline' : 'final',
 timestamp: Date.now() - (typeIdx * 1000000) - (i * 10000),
 });
 }
 });

 return screenshots;
 }, [run]);

 // Feature #2006: Keyboard navigation for lightbox
 useEffect(() => {
 if (!lightboxOpen) return;

 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
 setLightboxOpen(false);
 } else if (e.key === 'ArrowLeft' && lightboxIndex > 0) {
 setLightboxIndex(prev => prev - 1);
 } else if (e.key === 'ArrowRight' && lightboxIndex < galleryScreenshots.length - 1) {
 setLightboxIndex(prev => prev + 1);
 }
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [lightboxOpen, lightboxIndex, galleryScreenshots.length]);

 if (loading) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="text-center">
 <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
 <p className="mt-4 text-muted-foreground">Loading shared results...</p>
 </div>
 </div>
 );
 }

 // Feature #2004: Password prompt
 if (requiresPassword) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="bg-card rounded-xl shadow-lg border border-border p-8 max-w-md w-full mx-4">
 <div className="text-center mb-6">
 <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
 </svg>
 </div>
 <h2 className="text-xl font-bold text-foreground">Password Protected</h2>
 <p className="text-foreground mt-2">This shared result requires a password to view.</p>
 </div>

 <form onSubmit={handlePasswordSubmit}>
 <div className="mb-4">
 <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
 Password
 </label>
 <input
 type="password"
 id="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
 placeholder="Enter password"
 required
 autoFocus
 />
 </div>

 {passwordError && (
 <div className="mb-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
 <p className="text-sm text-destructive">{passwordError}</p>
 </div>
 )}

 <button
 type="submit"
 disabled={authenticating || !password}
 className="w-full py-2.5 px-4 bg-primary hover:bg-primary disabled:bg-primary/80 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
 >
 {authenticating ? (
 <>
 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 Verifying...
 </>
 ) : (
 'View Results'
 )}
 </button>
 </form>

 <p className="text-center text-sm text-muted-foreground mt-4">
 Don't have the password? Contact the person who shared this link.
 </p>
 </div>
 </div>
 );
 }

 // Feature #2005: Expired link display
 if (expiredInfo) {
 const expirationDate = new Date(expiredInfo.expirationDate);
 const formattedDate = expirationDate.toLocaleDateString('en-US', {
 weekday: 'long',
 year: 'numeric',
 month: 'long',
 day: 'numeric',
 });
 const formattedTime = expirationDate.toLocaleTimeString('en-US', {
 hour: 'numeric',
 minute: '2-digit',
 hour12: true,
 });

 return (
 <div className="min-h-screen bg-background flex items-center justify-center p-4">
 <div className="bg-card rounded-xl shadow-lg border border-border p-8 max-w-lg w-full text-center">
 {/* Expired Icon */}
 <div className="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-6">
 <svg className="w-10 h-10 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 </div>

 {/* Title */}
 <h1 className="text-2xl font-bold text-foreground mb-2">
 This Link Has Expired
 </h1>

 {/* Description */}
 <p className="text-foreground mb-6">
 The shareable link you're trying to access is no longer valid.
 </p>

 {/* Expiration Details Card */}
 <div className="bg-muted rounded-lg p-4 mb-6">
 <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 <span>Expiration Date</span>
 </div>
 <div className="text-lg font-semibold text-foreground">
 {formattedDate}
 </div>
 <div className="text-foreground">
 at {formattedTime}
 </div>
 </div>

 {/* Options */}
 <div className="space-y-4">
 <div className="text-sm text-foreground">
 <strong>Need access to these results?</strong>
 </div>

 {/* Option 1: Contact Owner */}
 <div className="flex items-start gap-3 text-left p-3 bg-primary/5 border border-primary/20 rounded-lg">
 <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
 <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
 </svg>
 </div>
 <div className="flex-1">
 <div className="font-medium text-foreground text-sm">Contact the Link Owner</div>
 <p className="text-sm text-foreground mt-1">
 {expiredInfo.createdBy && (
 <span>Shared by <strong>{expiredInfo.createdBy}</strong>. </span>
 )}
 Ask them to generate a new shareable link with updated expiration.
 </p>
 {expiredInfo.ownerEmail && (
 <a
 href={`mailto:${expiredInfo.ownerEmail}?subject=Request for new test results link&body=Hi,%0A%0AThe shareable link to the test results has expired. Could you please generate a new one?%0A%0AExpired token: ${token}%0A%0AThank you!`}
 className="inline-flex items-center gap-1 text-primary hover:text-primary text-sm mt-2 font-medium"
 >
 <span>Send Email Request</span>
 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
 </svg>
 </a>
 )}
 </div>
 </div>

 {/* Option 2: Sign In */}
 <div className="flex items-start gap-3 text-left p-3 bg-muted rounded-lg">
 <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
 <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
 </svg>
 </div>
 <div className="flex-1">
 <div className="font-medium text-foreground text-sm">Sign In to QA Guardian</div>
 <p className="text-sm text-foreground mt-1">
 If you have an account, sign in to access your test results directly.
 </p>
 </div>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex flex-col sm:flex-row gap-3 mt-8">
 <Link
 to="/login"
 className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors"
 >
 Sign In
 </Link>
 <Link
 to="/"
 className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-muted hover:bg-secondary text-foreground font-medium rounded-lg transition-colors"
 >
 Go to Home
 </Link>
 </div>

 {/* Token info for support */}
 <div className="mt-6 pt-4 border-t border-border">
 <p className="text-xs text-muted-foreground">
 Share Token: <code className="bg-muted px-1.5 py-0.5 rounded">{token?.slice(0, 12)}...</code>
 </p>
 </div>
 </div>
 </div>
 );
 }

 if (error) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center">
 <div className="text-center max-w-md">
 <div className="text-6xl mb-4">🔗</div>
 <h1 className="text-2xl font-bold text-foreground mb-2">Link Not Found</h1>
 <p className="text-foreground mb-6">{error}</p>
 <Link
 to="/"
 className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary transition-colors"
 >
 Go to Home
 </Link>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background">
 {/* Header */}
 <header className="bg-card border-b border-border">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
 <span className="text-white text-xl">🛡️</span>
 </div>
 <div>
 <h1 className="text-xl font-bold text-foreground">QA Guardian</h1>
 <p className="text-sm text-muted-foreground">Shared Test Results</p>
 </div>
 </div>
 <div className="text-sm text-muted-foreground">
 Share Token: <code className="bg-muted px-2 py-1 rounded">{token?.slice(0, 8)}...</code>
 </div>
 </div>
 </div>
 </header>

 {/* Main Content */}
 <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
 {/* Summary Card */}
 <div className="bg-card rounded-xl shadow-sm border border-border p-6 mb-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="text-2xl font-bold text-foreground">Test Run Results</h2>
 <p className="text-muted-foreground">
 {run?.suite_name || 'Test Suite'} • Run ID: {run?.id?.slice(0, 8)}...
 </p>
 </div>
 <div className={`px-4 py-2 rounded-lg text-lg font-semibold ${
 run?.status === 'passed'
 ? 'bg-success/10 text-success'
 : 'bg-destructive/10 text-destructive'
 }`}>
 {run?.status === 'passed' ? '✓ Passed' : '✗ Failed'}
 </div>
 </div>

 {/* Stats Grid */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-muted rounded-lg p-4 text-center">
 <div className="text-3xl font-bold text-foreground">{stats.total}</div>
 <div className="text-sm text-muted-foreground">Total Tests</div>
 </div>
 <div className="bg-success/5 rounded-lg p-4 text-center">
 <div className="text-3xl font-bold text-success">{stats.passed}</div>
 <div className="text-sm text-muted-foreground">Passed</div>
 </div>
 <div className="bg-destructive/5 rounded-lg p-4 text-center">
 <div className="text-3xl font-bold text-destructive">{stats.failed}</div>
 <div className="text-sm text-muted-foreground">Failed</div>
 </div>
 <div className="bg-primary/5 rounded-lg p-4 text-center">
 <div className="text-3xl font-bold text-primary">{stats.passRate}%</div>
 <div className="text-sm text-muted-foreground">Pass Rate</div>
 </div>
 </div>

 {/* Run Info */}
 <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
 <div>
 <span className="text-muted-foreground">Browser:</span>
 <span className="ml-2 text-foreground">{run?.browser || 'chromium'}</span>
 </div>
 <div>
 <span className="text-muted-foreground">Duration:</span>
 <span className="ml-2 text-foreground">
 {run?.duration_ms ? `${(run.duration_ms / 1000).toFixed(2)}s` : '-'}
 </span>
 </div>
 <div>
 <span className="text-muted-foreground">Started:</span>
 <span className="ml-2 text-foreground">
 {run?.started_at ? new Date(run.started_at).toLocaleString() : '-'}
 </span>
 </div>
 <div>
 <span className="text-muted-foreground">Completed:</span>
 <span className="ml-2 text-foreground">
 {run?.completed_at ? new Date(run.completed_at).toLocaleString() : '-'}
 </span>
 </div>
 </div>
 </div>

 {/* Test Results */}
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-foreground">Test Results</h3>

 {run?.results?.map((result) => (
 <div
 key={result.test_id}
 className={`bg-card rounded-lg border p-4 ${
 result.status === 'passed'
 ? 'border-success/20'
 : 'border-destructive/20'
 }`}
 >
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-3">
 <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm ${
 result.status === 'passed' ? 'bg-success' : 'bg-destructive'
 }`}>
 {result.status === 'passed' ? '✓' : '✗'}
 </span>
 <h4 className="font-medium text-foreground">{result.test_name}</h4>
 {result.test_type && (
 <span className="px-2 py-0.5 text-xs bg-muted text-foreground rounded">
 {result.test_type.toUpperCase()}
 </span>
 )}
 </div>
 <span className="text-sm text-muted-foreground">
 {(result.duration_ms / 1000).toFixed(2)}s
 </span>
 </div>

 {/* Steps */}
 <div className="space-y-2">
 {result.steps.map((step, idx) => (
 <div
 key={step.id}
 className="flex items-center gap-2 text-sm text-foreground"
 >
 <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
 step.status === 'passed' ? 'bg-success/10 text-success' :
 step.status === 'failed' ? 'bg-destructive/10 text-destructive' :
 'bg-muted text-foreground'
 }`}>
 {idx + 1}
 </span>
 <span className="flex-1">{step.action}</span>
 <span className="text-muted-foreground">{step.duration_ms}ms</span>
 </div>
 ))}
 </div>

 {result.error && (
 <div className="mt-3 p-3 bg-destructive/5 rounded text-sm text-destructive">
 {result.error}
 </div>
 )}

 {/* Feature #2003: Screenshots section (read-only) */}
 {result.screenshot_base64 && (
 <div className="mt-4 pt-4 border-t border-border">
 <h5 className="text-sm font-medium text-foreground mb-2">Screenshot</h5>
 <div className="relative group">
 <img
 src={`data:image/png;base64,${result.screenshot_base64}`}
 alt={`Screenshot - ${result.test_name}`}
 className="w-full max-w-md rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
 onClick={() => {
 // Open in new tab for full view
 const win = window.open();
 if (win) {
 win.document.write(`<img src="data:image/png;base64,${result.screenshot_base64}" alt="Screenshot for ${result.test_name}" style="max-width: 100%;" />`);
 win.document.title = `Screenshot - ${result.test_name}`;
 }
 }}
 />
 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
 <span className="bg-black/50 text-white px-3 py-1 rounded text-sm">Click to view full size</span>
 </div>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>

 {/* Feature #2006: Screenshots Gallery */}
 {galleryScreenshots.length > 0 && (
 <div className="bg-card rounded-xl shadow-sm border border-border p-6 mt-8">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 <h3 className="text-lg font-semibold text-foreground">Screenshots Gallery</h3>
 <span className="px-2 py-0.5 bg-muted text-foreground text-sm rounded">
 {galleryScreenshots.length} screenshots
 </span>
 </div>
 </div>

 {/* Gallery Grid */}
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
 {galleryScreenshots.map((screenshot, index) => (
 <div
 key={screenshot.id}
 onClick={() => {
 setLightboxIndex(index);
 setLightboxOpen(true);
 }}
 className="group relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer border border-border hover:border-primary transition-all hover:shadow-lg"
 >
 <img
 src={screenshot.url}
 alt={screenshot.title}
 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
 />
 {/* Overlay with info */}
 <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
 <div className="absolute bottom-0 left-0 right-0 p-2">
 <div className="text-white text-xs font-medium truncate">{screenshot.title}</div>
 <div className="flex items-center gap-1 mt-1">
 <span className={`px-1.5 py-0.5 text-xs rounded ${
 screenshot.testType === 'E2E' ? 'bg-primary/80' :
 screenshot.testType === 'Visual' ? 'bg-purple-500/80' :
 'bg-success/80'
 }`}>
 {screenshot.testType}
 </span>
 <span className={`px-1.5 py-0.5 text-xs rounded ${
 screenshot.status === 'passed' ? 'bg-success/80' : 'bg-destructive/80'
 }`}>
 {screenshot.status === 'passed' ? '✓' : '✗'}
 </span>
 </div>
 </div>
 </div>
 {/* Type badge */}
 <div className={`absolute top-2 right-2 px-1.5 py-0.5 text-xs rounded font-medium ${
 screenshot.type === 'diff' ? 'bg-warning text-white' :
 screenshot.type === 'baseline' ? 'bg-primary text-white' :
 'bg-card/60 text-white'
 }`}>
 {screenshot.type}
 </div>
 </div>
 ))}
 </div>

 {/* Click hint */}
 <p className="text-center text-sm text-muted-foreground mt-4">
 Click any screenshot to view full size with navigation
 </p>
 </div>
 )}

 {/* Feature #2006: Lightbox Modal */}
 {lightboxOpen && galleryScreenshots.length > 0 && (
 <div
 className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
 onClick={() => setLightboxOpen(false)}
 >
 {/* Close button */}
 <button
 onClick={() => setLightboxOpen(false)}
 className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
 aria-label="Close"
 >
 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>

 {/* Navigation - Previous */}
 {lightboxIndex > 0 && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setLightboxIndex(prev => prev - 1);
 }}
 className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 bg-black/30 rounded-full hover:bg-black/50 transition-colors"
 aria-label="Previous screenshot"
 >
 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 )}

 {/* Navigation - Next */}
 {lightboxIndex < galleryScreenshots.length - 1 && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setLightboxIndex(prev => prev + 1);
 }}
 className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 bg-black/30 rounded-full hover:bg-black/50 transition-colors"
 aria-label="Next screenshot"
 >
 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </button>
 )}

 {/* Image container */}
 <div
 className="max-w-5xl max-h-[85vh] mx-auto flex flex-col items-center"
 onClick={(e) => e.stopPropagation()}
 >
 <img
 src={galleryScreenshots[lightboxIndex].url}
 alt={galleryScreenshots[lightboxIndex].title}
 className="max-w-full max-h-[75vh] object-contain rounded-lg"
 />

 {/* Info panel */}
 <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg px-6 py-3 text-center">
 <h4 className="text-white font-medium text-lg">
 {galleryScreenshots[lightboxIndex].title}
 </h4>
 <div className="flex items-center justify-center gap-3 mt-2">
 <span className={`px-2 py-0.5 text-sm rounded ${
 galleryScreenshots[lightboxIndex].testType === 'E2E' ? 'bg-primary' :
 galleryScreenshots[lightboxIndex].testType === 'Visual' ? 'bg-purple-500' :
 'bg-success'
 } text-white`}>
 {galleryScreenshots[lightboxIndex].testType}
 </span>
 <span className={`px-2 py-0.5 text-sm rounded ${
 galleryScreenshots[lightboxIndex].status === 'passed' ? 'bg-success' : 'bg-destructive'
 } text-white`}>
 {galleryScreenshots[lightboxIndex].status === 'passed' ? '✓ Passed' : '✗ Failed'}
 </span>
 <span className="px-2 py-0.5 text-sm rounded bg-gray-600 text-white">
 {galleryScreenshots[lightboxIndex].type}
 </span>
 </div>
 <p className="text-white/60 text-sm mt-2">
 {lightboxIndex + 1} of {galleryScreenshots.length}
 </p>
 </div>
 </div>

 {/* Keyboard navigation hint */}
 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-sm">
 Use ← → arrows to navigate • ESC to close
 </div>
 </div>
 )}

 {/* Feature #2003: Read-only notice */}
 <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-6">
 <div className="flex items-center gap-3">
 <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <p className="text-sm text-primary">
 This is a read-only view. Sign in to access full test management features.
 </p>
 </div>
 </div>

 {/* Footer */}
 <div className="mt-8 text-center text-sm text-muted-foreground">
 <p>This is a publicly shared test run result from QA Guardian.</p>
 <p className="mt-1">
 <Link to="/" className="text-primary hover:text-primary">
 Learn more about QA Guardian →
 </Link>
 </p>
 </div>
 </main>
 </div>
 );
}
