/**
 * CreateTestModal - Two-section layout for test creation
 * Feature #1800: CreateTestModal with two-section layout
 * Feature #1802: URLInput component integration
 * Feature #1807: CustomTestWizard integration
 *
 * Layout:
 * - Quick Test section: Enter URL and select test types to generate multiple tests
 * - Custom Test section: Entry point to the full test creation wizard
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
 QuickTestSelection,
 DEFAULT_QUICK_SELECTION,
 TEST_TYPE_CONFIG,
 GeneratedTestPreview,
} from './types';
import { CreateTestModalProps, TestType } from '../test-modals/types';
// Feature #513: Removed unused QuickTestPanel, QuickTestType - wizard handles test type selection
import { URLInput } from './shared';
import { CustomTestWizard } from './CustomTestWizard';
// Feature #97: Toast for run started notification
import { toast } from '../../stores/toastStore';
import { devLog } from '../../utils/logger';
import { URL_REGEX, normalizeUrl as normalizeUrlBase } from '../../constants/validation';
// Feature #615: Lucide icons for test types (replacing emoji icons)
import {
 Flame,
 Globe,
 Camera,
 Accessibility,
 Zap,
 BarChart3,
 type LucideIcon,
} from 'lucide-react';

// Feature #609: Static icon and color maps moved to module scope for reusability
const TEST_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  smoke: Flame,
  e2e: Globe,
  visual: Camera,
  accessibility: Accessibility,
  performance: Zap,
  load: BarChart3,
};

const TEST_TYPE_COLOR_MAP: Record<string, { selected: string; checkbox: string }> = {
  blue: { selected: 'border-primary bg-primary/5 text-primary', checkbox: 'border-primary bg-primary' },
  purple: { selected: 'border-accent bg-accent/5 text-accent', checkbox: 'border-accent bg-accent' },
  green: { selected: 'border-success bg-success/5 text-success', checkbox: 'border-success bg-success' },
  amber: { selected: 'border-warning bg-warning/5 text-warning', checkbox: 'border-warning bg-warning' },
  orange: { selected: 'border-warning bg-warning/5 text-warning', checkbox: 'border-warning bg-warning' },
  red: { selected: 'border-destructive bg-destructive/5 text-destructive', checkbox: 'border-destructive bg-destructive' },
};

/**
 * Feature #609: TestTypeGrid - Extracted from IIFE for better readability and memoization
 * Displays a grid of test type checkboxes with icons and semantic colors
 */
interface TestTypeGridProps {
  testSelection: QuickTestSelection;
  toggleTestType: (type: keyof QuickTestSelection) => void;
}

const TestTypeGrid: React.FC<TestTypeGridProps> = ({ testSelection, toggleTestType }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
    {(Object.entries(TEST_TYPE_CONFIG) as [keyof QuickTestSelection, typeof TEST_TYPE_CONFIG.e2e][]).map(
      ([key, config]) => {
        const Icon = TEST_TYPE_ICON_MAP[key];
        return (
          <button
            key={key}
            onClick={() => toggleTestType(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
              testSelection[key]
                ? (TEST_TYPE_COLOR_MAP[config.color] || TEST_TYPE_COLOR_MAP.blue).selected
                : 'border-border text-foreground hover:border-border'
            }`}
            type="button"
            aria-pressed={testSelection[key]}
            title={config.description}
          >
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                testSelection[key]
                  ? (TEST_TYPE_COLOR_MAP[config.color] || TEST_TYPE_COLOR_MAP.blue).checkbox
                  : 'border-border'
              }`}
            >
              {testSelection[key] && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{config.label}</span>
          </button>
        );
      }
    )}
  </div>
);
TestTypeGrid.displayName = 'TestTypeGrid';

/**
 * Feature #609: GeneratedTestsSummary - Extracted from IIFE for better readability
 * Displays success summary with Run Now button after tests are generated
 */
interface GeneratedTestsSummaryProps {
  generatedTests: GeneratedTestPreview[];
  runStatus: 'idle' | 'running' | 'started' | 'error';
  isRunningTests: boolean;
  handleRunNow: () => void;
}

const GeneratedTestsSummary: React.FC<GeneratedTestsSummaryProps> = ({
  generatedTests,
  runStatus,
  isRunningTests,
  handleRunNow,
}) => {
  const createdCount = generatedTests.filter(t => t.status === 'created').length;
  const pendingCount = generatedTests.filter(t => t.status === 'pending' || t.status === 'creating').length;
  const isComplete = pendingCount === 0;

  if (!isComplete || createdCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
      <div className="flex items-center gap-2">
        {runStatus === 'started' ? (
          <>
            <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-success">
              Tests running! Closing...
            </span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-success">
              {createdCount} test{createdCount !== 1 ? 's' : ''} created!
            </span>
          </>
        )}
      </div>
      {/* Run Now Button */}
      <button
        type="button"
        onClick={handleRunNow}
        disabled={isRunningTests || runStatus === 'started'}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-success hover:bg-success disabled:bg-success/80 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
      >
        {isRunningTests ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Starting...</span>
          </>
        ) : runStatus === 'started' ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Running</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Run Now</span>
          </>
        )}
      </button>
    </div>
  );
};
GeneratedTestsSummary.displayName = 'GeneratedTestsSummary';

/**
 * Validate and normalize URL with error message
 * Feature #116: Uses constants from validation.ts
 */
function normalizeUrlWithError(input: string): { url: string | null; error: string | null } {
 const trimmed = input.trim();

 if (!trimmed) {
 return { url: null, error: null };
 }

 const normalized = normalizeUrlBase(trimmed);
 if (normalized) {
 return { url: normalized, error: null };
 }

 // Check if it looks like a URL with typo
 if (trimmed.includes('.') && !trimmed.includes(' ')) {
 let fixed = trimmed;
 if (!fixed.startsWith('http')) {
 fixed = `https://${fixed}`;
 }
 if (URL_REGEX.test(fixed)) {
 return { url: fixed, error: null };
 }
 }

 return { url: null, error: 'Please enter a valid URL (e.g., https://your-site.com)' };
}

/**
 * CreateTestModal component
 */
export const CreateTestModal: React.FC<CreateTestModalProps> = ({
 isOpen,
 onClose,
 onTestCreated,
 suiteId,
 project,
 suite,
 token,
}) => {
 // Quick Test state
 const [quickUrl, setQuickUrl] = useState('');
 const [urlError, setUrlError] = useState<string | null>(null);
 const [testSelection, setTestSelection] = useState<QuickTestSelection>(DEFAULT_QUICK_SELECTION);
 const [isGenerating, setIsGenerating] = useState(false);
 const [generatedTests, setGeneratedTests] = useState<GeneratedTestPreview[]>([]);

 // Feature #2008: Bundle preset state
 const [activeBundle, setActiveBundle] = useState<'starter' | 'full' | 'speed' | null>(null);
 const [animatingBundle, setAnimatingBundle] = useState<string | null>(null);

 // Feature #1806: Quick test run immediately option
 const [isRunningTests, setIsRunningTests] = useState(false);
 const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'started' | 'error'>('idle');

 // Custom wizard state
 const [showWizard, setShowWizard] = useState(false);

 // Refs
 const urlInputRef = useRef<HTMLInputElement>(null);
 const modalRef = useRef<HTMLDivElement>(null);

 // Focus URL input on open
 useEffect(() => {
 if (isOpen && urlInputRef.current) {
 setTimeout(() => urlInputRef.current?.focus(), 100);
 }
 }, [isOpen]);

 // Reset state when modal closes, pre-fill URL when modal opens
 useEffect(() => {
 if (!isOpen) {
 setQuickUrl('');
 setUrlError(null);
 setTestSelection(DEFAULT_QUICK_SELECTION);
 setIsGenerating(false);
 setGeneratedTests([]);
 setShowWizard(false);
 // Feature #1806: Reset run state
 setIsRunningTests(false);
 setRunStatus('idle');
 // Feature #2008: Reset bundle state
 setActiveBundle(null);
 setAnimatingBundle(null);
 } else {
 // Feature #2008: Pre-fill URL with project's baseUrl when modal opens
 if (project?.baseUrl && !quickUrl) {
 setQuickUrl(project.baseUrl);
 }
 }
 }, [isOpen, project?.baseUrl]);

 // Handle URL change from URLInput component - Feature #1802
 const handleUrlChange = useCallback((url: string) => {
 setQuickUrl(url);
 // Clear error when user starts typing - URLInput handles validation visually
 if (urlError) {
 setUrlError(null);
 }
 }, [urlError]);

 // Toggle test type selection
 const toggleTestType = useCallback((type: keyof QuickTestSelection) => {
 setTestSelection(prev => ({
 ...prev,
 [type]: !prev[type],
 }));
 // Clear active bundle when manually selecting
 setActiveBundle(null);
 }, []);

 // Feature #2008: Bundle preset definitions
 const bundlePresets = {
 starter: {
 label: 'Starter Pack',
 icon: '🚀',
 description: 'Smoke + Visual',
 selection: { smoke: true, e2e: false, visual: true, accessibility: false, performance: false, load: false },
 },
 full: {
 label: 'Full Coverage',
 icon: '🔒',
 description: 'All 6 test types',
 selection: { smoke: true, e2e: true, visual: true, accessibility: true, performance: true, load: true },
 },
 speed: {
 label: 'Speed Check',
 icon: '⚡',
 description: 'Performance + Load',
 selection: { smoke: false, e2e: false, visual: false, accessibility: false, performance: true, load: true },
 },
 };

 // Feature #2008: Apply bundle preset
 const applyBundlePreset = useCallback((bundleKey: 'starter' | 'full' | 'speed') => {
 const bundle = bundlePresets[bundleKey];
 setTestSelection(bundle.selection);
 setActiveBundle(bundleKey);
 // Trigger animation
 setAnimatingBundle(bundleKey);
 setTimeout(() => setAnimatingBundle(null), 200);
 }, []);

 // Get selected test count
 const selectedCount = Object.values(testSelection).filter(Boolean).length;

 // Generate tests from URL
 const handleGenerateTests = useCallback(async () => {
 const { url, error } = normalizeUrlWithError(quickUrl);

 if (error || !url) {
 setUrlError(error || 'Please enter a URL');
 return;
 }

 if (selectedCount === 0) {
 return;
 }

 setIsGenerating(true);
 setGeneratedTests([]);

 // Map selection to test types
 // Smoke test is created as 'e2e' with special steps for quick health check
 const typeMap: Record<keyof QuickTestSelection, TestType> = {
 smoke: 'e2e', // Smoke test uses e2e type with auto-generated health check steps
 e2e: 'e2e',
 visual: 'visual_regression',
 accessibility: 'accessibility',
 performance: 'lighthouse',
 load: 'load',
 };

 // Create preview entries for each selected type with unique IDs
 const baseTime = Date.now();
 const previews: GeneratedTestPreview[] = Object.entries(testSelection)
 .filter(([_key, selected]) => selected)
 .map(([key], index) => {
 const config = TEST_TYPE_CONFIG[key as keyof typeof TEST_TYPE_CONFIG];
 return {
 id: `preview-${key}-${baseTime}-${index}`,
 type: key,
 name: `${config.label} - ${new URL(url).hostname}`,
 targetUrl: url,
 estimatedDuration: key === 'load' ? '~60s' : key === 'performance' ? '~30s' : '~5s',
 status: 'pending' as const,
 };
 });

 setGeneratedTests(previews);

 // Create tests one by one
 for (let i = 0; i < previews.length; i++) {
 const preview = previews[i];
 const testType = typeMap[preview.type as keyof typeof typeMap];

 // Update status to creating
 setGeneratedTests(prev =>
 prev.map(p => (p.id === preview.id ? { ...p, status: 'creating' as const } : p))
 );

 try {
 // Use relative URL for Vite proxy or absolute URL for production
 const apiUrl = import.meta.env.VITE_API_URL
 ? `${import.meta.env.VITE_API_URL}/api/v1/suites/${suiteId}/tests`
 : `/api/v1/suites/${suiteId}/tests`;

 // Feature #1972: Smoke test auto-generates health check steps
 const isSmokeTest = preview.type === 'smoke';
 const smokeTestSteps = isSmokeTest ? [
 { action: 'navigate', value: url },
 { action: 'wait', value: '1000' }, // Wait for page to stabilize
 { action: 'screenshot', value: 'smoke_test_page' },
 { action: 'assert_no_console_errors', value: 'critical' }, // Check for critical JS errors
 ] : undefined;

 const response = await fetch(apiUrl, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({
 name: preview.name,
 description: isSmokeTest
 ? `Quick health check for ${url} - verifies page loads, no critical issues`
 : `Auto-generated ${preview.type} test for ${url}`,
 test_type: testType, // Fix: backend expects 'test_type' not 'type'
 target_url: url,
 // Feature #1972: Smoke test steps for quick health check
 ...(isSmokeTest && {
 steps: smokeTestSteps,
 is_smoke_test: true, // Flag for special handling
 }),
 // Default settings for visual tests
 ...(testType === 'visual_regression' && {
 viewport_width: 1920,
 viewport_height: 1080,
 diff_threshold: 0.1,
 }),
 // Default settings for lighthouse
 ...(testType === 'lighthouse' && {
 device_preset: 'desktop',
 performance_threshold: 50,
 }),
 // Default settings for accessibility
 ...(testType === 'accessibility' && {
 wcag_level: 'AA',
 }),
 // Default settings for load test
 ...(testType === 'load' && {
 virtual_users: 10,
 duration: 60,
 }),
 }),
 }
 );

 if (!response.ok) {
 throw new Error(`Failed to create test: ${response.status} ${response.statusText}`);
 }

 const data = await response.json();
 devLog('[CreateTestModal] Test created successfully:', data);

 // Update status to created
 setGeneratedTests(prev =>
 prev.map(p => (p.id === preview.id ? { ...p, status: 'created' as const } : p))
 );

 // Notify parent (handle both direct test object and wrapped response)
 const test = data.test || data;
 if (test.id && test.name) {
 onTestCreated({ id: test.id, name: test.name });
 }
 } catch (err) {
 console.error('[CreateTestModal] Failed to create test:', err);
 // Update status to failed
 setGeneratedTests(prev =>
 prev.map(p =>
 p.id === preview.id
 ? { ...p, status: 'failed' as const, error: 'Creation failed' }
 : p
 )
 );
 }
 }

 setIsGenerating(false);
 }, [quickUrl, testSelection, selectedCount, suiteId, token, onTestCreated]);

 // Feature #1806: Run all created tests immediately
 const handleRunNow = useCallback(async () => {
 // Get all successfully created tests
 const createdTests = generatedTests.filter(t => t.status === 'created');

 if (createdTests.length === 0) {
 return;
 }

 setIsRunningTests(true);
 setRunStatus('running');

 try {
 // Trigger a suite run (runs all tests in the suite)
 // This is more efficient than running tests individually
 // Use relative URL for Vite proxy or absolute URL for production
 const runApiUrl = import.meta.env.VITE_API_URL
 ? `${import.meta.env.VITE_API_URL}/api/v1/suites/${suiteId}/runs`
 : `/api/v1/suites/${suiteId}/runs`;

 const response = await fetch(runApiUrl, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({
 browser: 'chromium',
 branch: 'main',
 }),
 }
 );

 if (!response.ok) {
 throw new Error('Failed to start test run');
 }

 // Feature #513: Response data used for logging only
 await response.json();
 setRunStatus('started');

 // Feature #97: Close modal immediately and show toast
 // No need to wait - the toast provides feedback
 const testCount = generatedTests.filter(t => t.status === 'created').length;
 toast.success(`Running ${testCount} test${testCount !== 1 ? 's' : ''}! Check the run history for progress.`);
 onClose();

 } catch (err) {
 console.error('Failed to run tests:', err);
 setRunStatus('error');
 setIsRunningTests(false);
 toast.error('Failed to start test run. Please try again.');
 }
 }, [generatedTests, suiteId, token, onClose]);

 // Handle keyboard shortcuts
 const handleKeyDown = useCallback(
 (e: React.KeyboardEvent) => {
 if (e.key === 'Escape') {
 onClose();
 } else if (e.key === 'Enter' && e.metaKey) {
 handleGenerateTests();
 }
 },
 [onClose, handleGenerateTests]
 );

 // Don't render if not open
 if (!isOpen) {
 return null;
 }

 return (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
 role="dialog"
 aria-modal="true"
 aria-labelledby="create-test-modal-title"
 onKeyDown={handleKeyDown}
 >
 {/* Backdrop click to close */}
 <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

 {/* Modal content - fixed width max-w-2xl */}
 <div
 ref={modalRef}
 className="relative z-10 w-full max-w-2xl bg-card rounded-xl shadow-2xl overflow-hidden"
 role="document"
 >
 {/* Header */}
 <div className="px-6 py-4 border-b border-border">
 <div className="flex items-center justify-between">
 <h2
 id="create-test-modal-title"
 className="text-xl font-semibold text-foreground"
 >
 Create Test
 </h2>
 <button
 onClick={onClose}
 className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
 aria-label="Close modal"
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 {suite && (
 <p className="mt-1 text-sm text-muted-foreground">
 Adding to: <span className="font-medium">{suite.name}</span>
 </p>
 )}
 </div>

 {/* Body - Two sections */}
 <div className="p-6 space-y-6">
 {/* Section 1: Quick Test */}
 <section aria-labelledby="quick-test-heading">
 <div className="flex items-center gap-2 mb-4">
 <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
 <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 </div>
 <h3 id="quick-test-heading" className="text-lg font-medium text-foreground">
 Quick Test
 </h3>
 <span className="px-2 py-0.5 text-xs font-medium text-primary bg-primary/10 rounded-full">
 Recommended
 </span>
 </div>

 <p className="text-sm text-foreground mb-4">
 Enter a URL and select test types to generate multiple tests at once.
 </p>

 {/* URL Input - Feature #1802 */}
 <URLInput
 id="quick-url"
 label="Target URL"
 value={quickUrl}
 onChange={handleUrlChange}
 projectBaseUrl={project?.baseUrl}
 showFavicon={true}
 autoFocus={true}
 error={urlError || undefined}
 className="mb-4"
 />

 {/* Feature #2008: Bundle Presets */}
 <div className="mb-4">
 <label className="block text-sm font-medium text-foreground mb-2">
 Quick Bundles
 </label>
 <div className="flex gap-2 flex-wrap">
 {(Object.entries(bundlePresets) as ['starter' | 'full' | 'speed', typeof bundlePresets.starter][]).map(([key, bundle]) => (
 <button
 key={key}
 onClick={() => applyBundlePreset(key)}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
 activeBundle === key
 ? 'border-primary bg-primary/5 text-primary'
 : 'border-border text-foreground hover:border-primary/30 hover:bg-muted'
 } ${animatingBundle === key ? 'scale-110' : ''}`}
 style={{ transition: 'all 0.15s ease-out' }}
 type="button"
 title={bundle.description}
 >
 <span>{bundle.icon}</span>
 <span>{bundle.label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Test Type Selection */}
 <div className="mb-4">
 <label className="block text-sm font-medium text-foreground mb-2">
 Select Test Types ({selectedCount} selected)
 </label>
 {/* Feature #609: Extracted TestTypeGrid component (was IIFE) */}
 <TestTypeGrid testSelection={testSelection} toggleTestType={toggleTestType} />
 </div>

 {/* Generated Tests Preview */}
 {generatedTests.length > 0 && (
 <div className="mt-4 p-4 bg-muted rounded-lg">
 {/* Feature #609: Extracted GeneratedTestsSummary component (was IIFE) */}
 <GeneratedTestsSummary
 generatedTests={generatedTests}
 runStatus={runStatus}
 isRunningTests={isRunningTests}
 handleRunNow={handleRunNow}
 />

 <h4 className="text-sm font-medium text-foreground mb-2">
 Generated Tests
 </h4>
 <ul className="space-y-2">
 {generatedTests.map(test => (
 <li
 key={test.id}
 className="flex items-center justify-between text-sm"
 >
 <span className="text-foreground">{test.name}</span>
 <span
 className={`px-2 py-0.5 rounded text-xs font-medium ${
 test.status === 'created'
 ? 'bg-success/10 text-success'
 : test.status === 'creating'
 ? 'bg-primary/10 text-primary'
 : test.status === 'failed'
 ? 'bg-destructive/10 text-destructive'
 : 'bg-muted text-foreground'
 }`}
 >
 {test.status === 'created'
 ? 'Created'
 : test.status === 'creating'
 ? 'Creating...'
 : test.status === 'failed'
 ? 'Failed'
 : 'Pending'}
 </span>
 </li>
 ))}
 </ul>

 {/* Feature #1806: Error message if run failed */}
 {runStatus === 'error' && (
 <div className="mt-3 p-2 bg-destructive/5 rounded text-sm text-destructive">
 Failed to start test run. Please try again.
 </div>
 )}
 </div>
 )}

 {/* Generate Button */}
 <button
 onClick={handleGenerateTests}
 disabled={isGenerating || selectedCount === 0 || !quickUrl.trim()}
 className="w-full mt-4 px-4 py-2.5 bg-primary hover:bg-primary disabled:bg-muted text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
 type="button"
 >
 {isGenerating ? (
 <>
 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path
 className="opacity-75"
 fill="currentColor"
 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
 />
 </svg>
 <span>Generating Tests...</span>
 </>
 ) : (
 <>
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 <span>
 {/* Feature #2008: Show bundle name if active */}
 {activeBundle
 ? `Generate ${bundlePresets[activeBundle].label}`
 : `Generate ${selectedCount} Test${selectedCount !== 1 ? 's' : ''}`
 }
 </span>
 </>
 )}
 </button>
 </section>

 {/* Divider */}
 <div className="relative">
 <div className="absolute inset-0 flex items-center">
 <div className="w-full border-t border-border" />
 </div>
 <div className="relative flex justify-center">
 <span className="px-4 text-sm text-muted-foreground bg-card">or</span>
 </div>
 </div>

 {/* Section 2: Custom Test Entry */}
 <section aria-labelledby="custom-test-heading">
 <div className="flex items-center gap-2 mb-4">
 <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
 <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
 </div>
 <h3 id="custom-test-heading" className="text-lg font-medium text-foreground">
 Custom Test
 </h3>
 </div>

 <p className="text-sm text-foreground mb-4">
 Create a fully customized test with advanced settings using the step-by-step wizard.
 </p>

 <button
 onClick={() => setShowWizard(true)}
 className="w-full px-4 py-2.5 border-2 border-dashed border-border text-foreground hover:border-accent/40 hover:text-accent font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
 type="button"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 <span>Open Test Wizard</span>
 </button>
 </section>
 </div>

 {/* Footer */}
 <div className="px-6 py-4 bg-muted border-t border-border flex items-center justify-between">
 <p className="text-xs text-muted-foreground">
 <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">Cmd+Enter</kbd>{' '}
 to generate tests
 </p>
 <button
 onClick={onClose}
 className="px-4 py-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
 type="button"
 >
 Cancel
 </button>
 </div>
 </div>

 {/* Custom Test Wizard Modal - Feature #1807: CustomTestWizard with MethodSelection */}
 {/* Feature #97: Close both wizard and parent modal on test creation */}
 {showWizard && (
 <CustomTestWizard
 onClose={() => setShowWizard(false)}
 onTestCreated={(test) => {
 // Feature #97: Close parent modal when test is created from wizard
 onTestCreated?.(test);
 // Close this modal after wizard reports success
 // The wizard already calls onClose() internally, but we also need to close the parent
 onClose();
 }}
 suiteId={suiteId}
 projectBaseUrl={project?.baseUrl}
 />
 )}
 </div>
 );
};

export default CreateTestModal;
