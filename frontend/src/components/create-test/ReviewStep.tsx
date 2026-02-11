/**
 * ReviewStep Component
 * Feature #1815: ReviewStep with create submission
 *
 * Step 3 of the CustomTestWizard.
 * Features:
 * - Summary card with all configured values
 * - Test type icon, name, URL, key settings
 * - Edit button navigates back to configure step
 * - Create Test button calls API
 * - Loading state during submission
 * - Success closes modal and shows toast
 */

import React, { useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { type TestTypeOption } from './shared';
import { type DeviceConfig } from '../test-modals/types';
// Feature #596: Schedule picker for Create & Schedule flow
import { SchedulePicker, DEFAULT_SCHEDULE, type ScheduleConfig } from './SchedulePicker';

/**
 * Configuration from AI Generate step
 */
export interface AIGeneratedConfig {
 method: 'ai-generate';
 testType: TestTypeOption | null;
 url: string;
 viewport: { preset: string; width: number; height: number };
 description: string;
}

/**
 * Viewport configuration for visual tests (Feature #1983)
 */
export interface ViewportConfig {
 name: string;
 width: number;
 height: number;
 enabled: boolean;
 orientation?: 'portrait' | 'landscape';
}

/**
 * Configuration from Manual Setup step
 */
/**
 * Step interface for structured steps
 */
export interface Step {
 id?: string;
 action: string;
 selector?: string;
 value?: string;
 order?: number;
}

export interface ManualSetupConfig {
 method: 'manual-setup';
 testType: TestTypeOption | null;
 name: string;
 description: string;
 targetUrl: string;
 // E2E specific
 steps?: string;
 structuredSteps?: Step[];
 /** Feature #584: E2E config fields from E2EConfig component */
 timeout?: number;
 retries?: number;
 tags?: string[];
 deviceEmulationEnabled?: boolean;
 deviceConfig?: DeviceConfig;
 // Feature #594: Cross-browser testing
 browsers?: ('chromium' | 'firefox' | 'webkit')[];
 // Visual specific
 viewportWidth?: number;
 viewportHeight?: number;
 diffThreshold?: number;
 // Feature #1983: Support multiple viewports for visual tests
 viewports?: ViewportConfig[];
 captureMode?: 'full_page' | 'viewport' | 'element';
 elementSelector?: string;
 waitTime?: number;
 hideSelectors?: string[];
 waitForSelector?: string;
 /** Feature #590: Additional visual regression options */
 antiAliasingTolerance?: 'off' | 'low' | 'medium' | 'high';
 ignoreRegions?: Array<{ x: number; y: number; width: number; height: number }>;
 ignoreSelectors?: string[];
 customCSS?: string;
 clipSelector?: string;
 colorThreshold?: number;
 // Performance specific
 devicePreset?: 'desktop' | 'mobile';
 performanceThreshold?: number;
 /** Feature #586: PerformanceConfig fields */
 lcpThreshold?: number;
 clsThreshold?: number;
 fidThreshold?: number;
 ttiThreshold?: number;
 lighthouseCategories?: {
 performance: boolean;
 accessibility: boolean;
 bestPractices: boolean;
 seo: boolean;
 };
 // Accessibility specific
 wcagLevel?: 'A' | 'AA' | 'AAA';
 /** Feature #587: AccessibilityConfig fields */
 a11yThresholds?: Record<'critical' | 'serious' | 'moderate' | 'minor', number>;
 includeIframes?: boolean;
 waitForA11ySelector?: string;
 excludeRules?: string[];
 // Load specific
 virtualUsers?: number;
 duration?: number;
 rampUp?: number;
 /** Feature #585: LoadConfig fields */
 loadScenario?: 'constant' | 'ramping' | 'stages' | 'custom';
 k6Script?: string;
 loadThresholds?: {
 http_req_duration_p95: number;
 http_req_failed: number;
 };
 // Feature #591: Security specific
 scanType?: 'sast' | 'dependency' | 'secrets' | 'dast' | 'full';
 targetPath?: string;
 failOnSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
 severityThreshold?: 'critical' | 'high' | 'medium' | 'low' | 'info';
 ignorePatterns?: string[];
 excludePaths?: string[];
 maxFindings?: number;
}

/**
 * Recording step interface
 * Feature #592: Recording wizard method
 */
export interface RecordingStepData {
 action: string;
 selector?: string;
 value?: string;
 text?: string;
 url?: string;
 timestamp?: number;
}

/**
 * Configuration from Record step
 * Feature #592: Recording wizard method
 */
export interface RecordConfig {
 method: 'record';
 testType: 'e2e';
 name: string;
 description: string;
 targetUrl: string;
 steps: RecordingStepData[];
 deviceConfig?: DeviceConfig;
}

/**
 * Combined wizard configuration type
 */
export type WizardConfig = AIGeneratedConfig | ManualSetupConfig | RecordConfig;

/**
 * Props for ReviewStep
 */
export interface ReviewStepProps {
 /** Configuration from previous steps */
 config: WizardConfig;
 /** Suite ID for API call */
 suiteId: string;
 /** Called to go back and edit */
 onEdit: () => void;
 /** Called when test is successfully created */
 onSuccess: (test: { id: string; name: string; runId?: string }) => void;
 /** Called when there's an error */
 onError?: (error: string) => void;
}

/**
 * Test type display configuration — Feature #614: Use semantic tokens
 */
const TEST_TYPE_CONFIG: Record<TestTypeOption, { label: string; icon: string; iconBg: string; badgeCls: string }> = {
 e2e: { label: 'E2E Test', icon: '🔄', iconBg: 'bg-method-manual/10', badgeCls: 'bg-method-manual/10 text-method-manual' },
 visual: { label: 'Visual Regression', icon: '📸', iconBg: 'bg-method-ai/10', badgeCls: 'bg-method-ai/10 text-method-ai' },
 performance: { label: 'Performance', icon: '⚡', iconBg: 'bg-warning/10', badgeCls: 'bg-warning/10 text-warning' },
 load: { label: 'Load Test', icon: '📊', iconBg: 'bg-destructive/10', badgeCls: 'bg-destructive/10 text-destructive' },
 accessibility: { label: 'Accessibility', icon: '♿', iconBg: 'bg-success/10', badgeCls: 'bg-success/10 text-success' },
 // Feature #591: Security test type
 security: { label: 'Security', icon: '🛡️', iconBg: 'bg-primary/10', badgeCls: 'bg-primary/10 text-primary' },
};

/**
 * Map UI test type to backend API test type
 * Feature #1976: Fix visual regression saving as E2E
 */
const UI_TO_API_TEST_TYPE: Record<TestTypeOption, string> = {
 e2e: 'e2e',
 visual: 'visual_regression',
 performance: 'lighthouse',
 load: 'load',
 accessibility: 'accessibility',
 // Feature #591: Security test type
 security: 'security',
};

/**
 * Summary row component — semantic tokens, tight spacing
 */
const SummaryRow: React.FC<{
 label: string;
 value: string | React.ReactNode;
 highlight?: boolean;
}> = ({ label, value, highlight }) => (
 <div className={`flex justify-between items-start py-2 ${highlight ? 'bg-primary/5 -mx-3 px-3 rounded-md' : ''}`}>
 <span className="text-xs text-muted-foreground">{label}</span>
 <span className={`text-sm font-medium text-right max-w-[60%] ${highlight ? 'text-primary' : 'text-foreground'}`}>
 {value}
 </span>
 </div>
);

/**
 * ReviewStep component
 */
/**
 * Submission phase type for Create & Run flow
 * Feature #1985: Create and Run test flow
 */
type SubmissionPhase = 'creating' | 'running' | null;

export const ReviewStep: React.FC<ReviewStepProps> = ({
 config,
 suiteId,
 onEdit,
 onSuccess,
 onError,
}) => {
 // Get token from auth store instead of props
 const { token } = useAuthStore();

 const [isSubmitting, setIsSubmitting] = useState(false);
 const [submissionPhase, setSubmissionPhase] = useState<SubmissionPhase>(null);
 const [error, setError] = useState<string | null>(null);
 // Feature #596: Schedule configuration state
 const [showSchedulePicker, setShowSchedulePicker] = useState(false);
 const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE);

 // Get test type config
 const testType = config.testType;
 const typeConfig = testType ? TEST_TYPE_CONFIG[testType] : null;

 // Get display values based on config method
 const displayName = config.method === 'manual-setup' || config.method === 'record'
 ? config.name
 : `${typeConfig?.label || 'Test'} - ${new URL(config.url || 'https://unknown-site.com').hostname}`;

 const displayUrl = config.method === 'manual-setup' || config.method === 'record' ? config.targetUrl : config.url;
 const displayDescription = config.description || 'No description provided';

 // Build request body for test creation (shared between create and create+run)
 const buildRequestBody = useCallback((): Record<string, unknown> | null => {
 if (!testType) return null;

 // Feature #1976: Map UI test type to backend API test type
 const apiTestType = UI_TO_API_TEST_TYPE[testType];
 const requestBody: Record<string, unknown> = {
 name: displayName,
 description: displayDescription,
 test_type: apiTestType,
 target_url: displayUrl,
 status: 'draft',
 };

 // Add type-specific fields
 if (config.method === 'manual-setup') {
 // Feature #589: Common fields sent for ALL test types (not just E2E)
 if (config.timeout && config.timeout !== 30000) {
 requestBody.timeout = config.timeout;
 }
 if (config.retries && config.retries > 0) {
 requestBody.retries = config.retries;
 }
 if (config.tags && config.tags.length > 0) {
 requestBody.tags = config.tags;
 }
 if (config.deviceEmulationEnabled && config.deviceConfig) {
 requestBody.device_emulation = true;
 requestBody.device_config = config.deviceConfig;
 }

 if (testType === 'e2e') {
 // Use structuredSteps (array) if available, otherwise try to parse steps string
 if (config.structuredSteps && config.structuredSteps.length > 0) {
 requestBody.steps = config.structuredSteps;
 } else if (config.steps) {
 // Legacy: steps is a string, parse it if possible
 try {
 const parsed = JSON.parse(config.steps);
 if (Array.isArray(parsed)) {
 requestBody.steps = parsed;
 }
 } catch {
 // If parsing fails, don't include steps - backend will auto-generate
 }
 }
 // Feature #594: Cross-browser testing - send browsers array
 if (config.browsers && config.browsers.length > 0) {
 requestBody.browsers = config.browsers;
 }
 }
 if (testType === 'visual') {
 // Feature #1983: Support multiple viewports for visual tests
 const enabledViewports = config.viewports?.filter(v => v.enabled) || [];
 if (enabledViewports.length > 1) {
 // Multi-viewport mode: send all enabled viewports
 // Feature #1987: Backend expects array of viewport preset names (strings), not objects
 requestBody.multi_viewport = true;
 requestBody.viewports = enabledViewports.map(v => v.name);
 } else if (enabledViewports.length === 1) {
 // Single viewport mode
 requestBody.viewport_width = enabledViewports[0].width;
 requestBody.viewport_height = enabledViewports[0].height;
 } else {
 // Fallback to legacy single viewport
 requestBody.viewport_width = config.viewportWidth || 1920;
 requestBody.viewport_height = config.viewportHeight || 1080;
 }
 requestBody.diff_threshold = config.diffThreshold || 0.1;
 // Pass additional visual config options
 if (config.captureMode) {
 requestBody.capture_mode = config.captureMode;
 }
 if (config.elementSelector) {
 requestBody.element_selector = config.elementSelector;
 }
 if (config.waitTime) {
 requestBody.wait_time = config.waitTime;
 }
 if (config.waitForSelector) {
 requestBody.wait_for_selector = config.waitForSelector;
 }
 if (config.hideSelectors && config.hideSelectors.length > 0) {
 requestBody.hide_selectors = config.hideSelectors;
 }
 // Feature #590: Additional visual regression options
 if (config.antiAliasingTolerance && config.antiAliasingTolerance !== 'off') {
 requestBody.anti_aliasing_tolerance = config.antiAliasingTolerance;
 }
 if (config.ignoreRegions && config.ignoreRegions.length > 0) {
 requestBody.ignore_regions = config.ignoreRegions;
 }
 if (config.ignoreSelectors && config.ignoreSelectors.length > 0) {
 requestBody.ignore_selectors = config.ignoreSelectors;
 }
 if (config.customCSS) {
 requestBody.custom_css = config.customCSS;
 }
 if (config.clipSelector) {
 requestBody.clip_selector = config.clipSelector;
 }
 if (config.colorThreshold && config.colorThreshold !== 0.1) {
 requestBody.color_threshold = config.colorThreshold;
 }
 }
 if (testType === 'performance') {
 requestBody.device_preset = config.devicePreset || 'desktop';
 requestBody.performance_threshold = config.performanceThreshold || 50;
 // Feature #586: Include PerformanceConfig fields from PerformanceConfig component
 if (config.lcpThreshold) {
 requestBody.lcp_threshold = config.lcpThreshold;
 }
 if (config.clsThreshold) {
 requestBody.cls_threshold = config.clsThreshold;
 }
 if (config.fidThreshold) {
 requestBody.fid_threshold = config.fidThreshold;
 }
 if (config.ttiThreshold) {
 requestBody.tti_threshold = config.ttiThreshold;
 }
 if (config.lighthouseCategories) {
 requestBody.lighthouse_categories = {
 performance: config.lighthouseCategories.performance,
 accessibility: config.lighthouseCategories.accessibility,
 best_practices: config.lighthouseCategories.bestPractices,
 seo: config.lighthouseCategories.seo,
 };
 }
 }
 if (testType === 'accessibility') {
 requestBody.wcag_level = config.wcagLevel || 'AA';
 // Feature #587: Include AccessibilityConfig fields from AccessibilityConfig component
 if (config.a11yThresholds) {
 requestBody.thresholds = {
 critical: config.a11yThresholds.critical,
 serious: config.a11yThresholds.serious,
 moderate: config.a11yThresholds.moderate,
 minor: config.a11yThresholds.minor,
 };
 }
 if (config.includeIframes !== undefined) {
 requestBody.include_iframes = config.includeIframes;
 }
 if (config.waitForA11ySelector) {
 requestBody.wait_for_selector = config.waitForA11ySelector;
 }
 if (config.excludeRules && config.excludeRules.length > 0) {
 requestBody.exclude_rules = config.excludeRules;
 }
 }
 if (testType === 'load') {
 requestBody.virtual_users = config.virtualUsers || 10;
 requestBody.duration = config.duration || 60;
 requestBody.ramp_up = config.rampUp || 10;
 // Feature #585: Include LoadConfig fields from LoadConfig component
 if (config.loadScenario) {
 requestBody.scenario = config.loadScenario;
 }
 if (config.k6Script) {
 requestBody.k6_script = config.k6Script;
 }
 if (config.loadThresholds) {
 requestBody.thresholds = {
 http_req_duration_p95: config.loadThresholds.http_req_duration_p95,
 http_req_failed: config.loadThresholds.http_req_failed,
 };
 }
 }
 // Feature #591: Security test fields
 if (testType === 'security') {
 requestBody.scan_type = config.scanType || 'full';
 requestBody.target_path = config.targetPath || './';
 requestBody.fail_on_severity = config.failOnSeverity || 'high';
 requestBody.severity_threshold = config.severityThreshold || 'low';
 if (config.excludePaths && config.excludePaths.length > 0) {
 requestBody.exclude_paths = config.excludePaths;
 }
 if (config.ignorePatterns && config.ignorePatterns.length > 0) {
 requestBody.ignore_patterns = config.ignorePatterns;
 }
 if (config.maxFindings) {
 requestBody.max_findings = config.maxFindings;
 }
 }
 } else if (config.method === 'record') {
 // Feature #592: Recording wizard method - convert recorded steps to test steps
 if (config.steps && config.steps.length > 0) {
 // Convert recording steps to structured test steps
 requestBody.steps = config.steps.map((step, index) => ({
  id: `step-${index + 1}`,
  action: step.action,
  selector: step.selector,
  value: step.value || step.text || step.url,
  order: index,
 }));
 }
 // Include device config if used during recording
 if (config.deviceConfig) {
 requestBody.device_emulation = true;
 requestBody.device_config = config.deviceConfig;
 }
 } else {
 // AI Generated config
 requestBody.viewport_width = config.viewport.width;
 requestBody.viewport_height = config.viewport.height;
 }

 return requestBody;
 }, [config, testType, displayName, displayUrl, displayDescription]);

 // Create test API call
 const handleCreate = useCallback(async () => {
 const requestBody = buildRequestBody();
 if (!requestBody) {
 setError('Test type is required');
 return;
 }

 setIsSubmitting(true);
 setError(null);

 try {
 const response = await fetch(`/api/v1/suites/${suiteId}/tests`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify(requestBody),
 });

 if (!response.ok) {
 const errorData = await response.json().catch(() => ({}));
 throw new Error(errorData.message || `Failed to create test (${response.status})`);
 }

 const data = await response.json();
 // Handle both { test: { id } } and { id } response formats
 const testId = data.test?.id || data.id || data.test_id;
 onSuccess({ id: testId, name: displayName });
 } catch (err) {
 const errorMessage = err instanceof Error ? err.message : 'Failed to create test';
 setError(errorMessage);
 onError?.(errorMessage);
 } finally {
 setIsSubmitting(false);
 }
 }, [buildRequestBody, suiteId, token, displayName, onSuccess, onError]);

 /**
 * Feature #1985: Create & Run test flow
 * Creates the test, then immediately triggers execution
 */
 const handleCreateAndRun = useCallback(async () => {
 const requestBody = buildRequestBody();
 if (!requestBody) {
 setError('Test type is required');
 return;
 }

 setIsSubmitting(true);
 setSubmissionPhase('creating');
 setError(null);

 try {
 // Step 1: Create the test
 const createResponse = await fetch(`/api/v1/suites/${suiteId}/tests`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify(requestBody),
 });

 if (!createResponse.ok) {
 const errorData = await createResponse.json().catch(() => ({}));
 throw new Error(errorData.message || `Failed to create test (${createResponse.status})`);
 }

 const createData = await createResponse.json();
 // Handle both { test: { id } } and { id } response formats
 const testId = createData.test?.id || createData.id || createData.test_id;

 // Step 2: Run the test
 setSubmissionPhase('running');

 const runResponse = await fetch(`/api/v1/tests/${testId}/runs`, {
 method: 'POST',
 headers: {
 Authorization: `Bearer ${token}`,
 },
 });

 if (!runResponse.ok) {
 // Test was created but run failed - still call success with test info
 const errorData = await runResponse.json().catch(() => ({}));
 console.error('Test created but run failed:', errorData);
 // Still report success for test creation, but include error info
 onSuccess({ id: testId, name: displayName });
 onError?.(`Test created, but failed to start run: ${errorData.message || 'Unknown error'}`);
 return;
 }

 const runData = await runResponse.json();
 const runId = runData.run_id || runData.id;

 // Success! Pass both test id and run id
 onSuccess({ id: testId, name: displayName, runId });
 } catch (err) {
 const errorMessage = err instanceof Error ? err.message : 'Failed to create and run test';
 setError(errorMessage);
 onError?.(errorMessage);
 } finally {
 setIsSubmitting(false);
 setSubmissionPhase(null);
 }
 }, [buildRequestBody, suiteId, token, displayName, onSuccess, onError]);

 /**
 * Feature #596: Create & Schedule test flow
 * Creates the test, then creates a recurring schedule for the suite
 */
 const handleCreateAndSchedule = useCallback(async () => {
 const requestBody = buildRequestBody();
 if (!requestBody) {
 setError('Test type is required');
 return;
 }

 setIsSubmitting(true);
 setSubmissionPhase('creating');
 setError(null);

 try {
 // Step 1: Create the test
 const createResponse = await fetch(`/api/v1/suites/${suiteId}/tests`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify(requestBody),
 });

 if (!createResponse.ok) {
 const errorData = await createResponse.json().catch(() => ({}));
 throw new Error(errorData.message || `Failed to create test (${createResponse.status})`);
 }

 const data = await createResponse.json();
 const testId = data.test?.id || data.id || data.test_id;

 // Step 2: Create the schedule for the suite
 setSubmissionPhase('running'); // Reuse running phase for "scheduling"

 const scheduleResponse = await fetch('/api/v1/schedules', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 },
 body: JSON.stringify({
 suite_id: suiteId,
 name: `${displayName} Schedule`,
 description: `Auto-created schedule for ${displayName}`,
 cron_expression: scheduleConfig.cronExpression,
 timezone: scheduleConfig.timezone,
 enabled: scheduleConfig.enabled,
 notify_on_failure: scheduleConfig.notifyOnFailure,
 }),
 });

 if (!scheduleResponse.ok) {
 // Test was created but schedule failed - still report success with warning
 const errorData = await scheduleResponse.json().catch(() => ({}));
 onError?.(`Test created, but schedule failed: ${errorData.message || 'Unknown error'}`);
 onSuccess({ id: testId, name: displayName });
 return;
 }

 // Success!
 onSuccess({ id: testId, name: displayName });
 } catch (err) {
 const errorMessage = err instanceof Error ? err.message : 'Failed to create and schedule test';
 setError(errorMessage);
 onError?.(errorMessage);
 } finally {
 setIsSubmitting(false);
 setSubmissionPhase(null);
 }
 }, [buildRequestBody, suiteId, token, displayName, scheduleConfig, onSuccess, onError]);

 // Feature #589: Render common settings (timeout, retries, tags) for all test types
 const renderCommonSettings = () => {
 if (config.method !== 'manual-setup') return null;
 return (
 <>
 {config.timeout && config.timeout !== 30000 && (
 <SummaryRow label="Timeout" value={`${(config.timeout / 1000).toFixed(0)}s`} />
 )}
 {config.retries !== undefined && config.retries > 0 && (
 <SummaryRow label="Retries" value={`${config.retries}`} />
 )}
 {config.tags && config.tags.length > 0 && (
 <SummaryRow label="Tags" value={config.tags.join(', ')} />
 )}
 {config.deviceEmulationEnabled && (
 <SummaryRow label="Device" value={config.deviceConfig?.preset || 'Custom'} />
 )}
 </>
 );
 };

 // Render type-specific settings
 const renderTypeSpecificSettings = () => {
 if (config.method === 'ai-generate') {
 return (
 <SummaryRow
 label="Viewport"
 value={`${config.viewport.preset} (${config.viewport.width}×${config.viewport.height})`}
 />
 );
 }

 // Feature #592: Recording shows recorded steps count
 if (config.method === 'record') {
 return (
 <SummaryRow
 label="Recorded Steps"
 value={`${config.steps.length} step${config.steps.length !== 1 ? 's' : ''}`}
 />
 );
 }

 switch (testType) {
 case 'e2e': {
 // Feature #584: Show all E2EConfig fields in review
 // Feature #594: Show browser selection
 const browserLabels: Record<string, string> = {
 chromium: 'Chrome',
 firefox: 'Firefox',
 webkit: 'Safari',
 };
 const browserDisplay = config.browsers && config.browsers.length > 0
 ? config.browsers.map(b => browserLabels[b] || b).join(', ')
 : 'Chrome';
 return (
 <>
 {config.steps && (
 <SummaryRow label="Steps" value={`${config.steps.split('\n').filter(Boolean).length} steps defined`} />
 )}
 <SummaryRow label="Browsers" value={browserDisplay} />
 {config.browsers && config.browsers.length > 1 && (
 <SummaryRow label="Cross-Browser" value={`${config.browsers.length} browsers selected`} />
 )}
 </>
 );
 }

 case 'visual': {
 // Feature #1983: Display all enabled viewports
 const enabledViewports = config.viewports?.filter(v => v.enabled) || [];
 const viewportDisplay = enabledViewports.length > 1
 ? `${enabledViewports.length} viewports (${enabledViewports.map(v => v.name).join(', ')})`
 : enabledViewports.length === 1
 ? `${enabledViewports[0].name} (${enabledViewports[0].width}×${enabledViewports[0].height})`
 : `${config.viewportWidth}×${config.viewportHeight}`;
 return (
 <>
 <SummaryRow label="Viewports" value={viewportDisplay} />
 <SummaryRow label="Diff Threshold" value={`${Math.round((config.diffThreshold || 0.1) * 100)}%`} />
 {config.captureMode && (
 <SummaryRow label="Capture Mode" value={config.captureMode.replace('_', ' ')} />
 )}
 {/* Feature #590: Display additional visual regression options */}
 {config.antiAliasingTolerance && config.antiAliasingTolerance !== 'off' && (
 <SummaryRow label="Anti-aliasing" value={config.antiAliasingTolerance} />
 )}
 {config.colorThreshold !== undefined && config.colorThreshold !== 0.1 && (
 <SummaryRow label="Color Threshold" value={`${Math.round(config.colorThreshold * 100)}%`} />
 )}
 {config.ignoreRegions && config.ignoreRegions.length > 0 && (
 <SummaryRow label="Ignore Regions" value={`${config.ignoreRegions.length} region(s)`} />
 )}
 {config.ignoreSelectors && config.ignoreSelectors.length > 0 && (
 <SummaryRow label="Ignore Selectors" value={config.ignoreSelectors.join(', ')} />
 )}
 {config.customCSS && (
 <SummaryRow label="Custom CSS" value="Applied" />
 )}
 {config.clipSelector && (
 <SummaryRow label="Clip Selector" value={config.clipSelector} />
 )}
 </>
 );
 }

 case 'performance': {
 // Feature #586: Display PerformanceConfig fields in review
 const enabledCategories = config.lighthouseCategories
 ? Object.entries(config.lighthouseCategories)
  .filter(([, enabled]) => enabled)
  .map(([cat]) => cat === 'bestPractices' ? 'Best Practices' : cat.charAt(0).toUpperCase() + cat.slice(1))
 : ['Performance', 'Accessibility', 'Best Practices', 'SEO'];
 return (
 <>
 <SummaryRow label="Device" value={config.devicePreset === 'mobile' ? 'Mobile' : 'Desktop'} />
 <SummaryRow label="Threshold" value={`Score ≥ ${config.performanceThreshold || 50}`} />
 {(config.lcpThreshold || config.clsThreshold) && (
 <SummaryRow
  label="Core Web Vitals"
  value={`LCP ≤ ${config.lcpThreshold || 2500}ms, CLS ≤ ${config.clsThreshold || 0.1}`}
 />
 )}
 {enabledCategories.length < 4 && (
 <SummaryRow label="Categories" value={enabledCategories.join(', ')} />
 )}
 </>
 );
 }

 case 'accessibility': {
 // Feature #587: Display AccessibilityConfig fields in review
 const strictMode = config.a11yThresholds &&
 config.a11yThresholds.critical === 0 &&
 config.a11yThresholds.serious === 0 &&
 config.a11yThresholds.moderate === 0;
 return (
 <>
 <SummaryRow label="WCAG Level" value={`Level ${config.wcagLevel || 'AA'}`} />
 {config.a11yThresholds && (
 <SummaryRow
  label="Thresholds"
  value={strictMode ? 'Strict (Zero Tolerance)' :
  `Critical: ${config.a11yThresholds.critical}, Serious: ${config.a11yThresholds.serious}`}
 />
 )}
 {config.includeIframes && (
 <SummaryRow label="Iframes" value="Included" />
 )}
 {config.excludeRules && config.excludeRules.length > 0 && (
 <SummaryRow label="Excluded Rules" value={`${config.excludeRules.length} rules`} />
 )}
 </>
 );
 }

 case 'load': {
 // Feature #585: Display LoadConfig fields in review
 const scenarioLabel = config.loadScenario === 'constant' ? 'Constant Load'
 : config.loadScenario === 'ramping' ? 'Ramping Load'
 : config.loadScenario === 'stages' ? 'Staged Load'
 : config.loadScenario === 'custom' ? 'Custom Script'
 : 'Constant Load';
 return (
 <>
 <SummaryRow label="Virtual Users" value={`${config.virtualUsers || 10} VUs`} />
 <SummaryRow label="Duration" value={`${config.duration || 60} seconds`} />
 <SummaryRow label="Ramp-up" value={`${config.rampUp || 10} seconds`} />
 {config.loadScenario && (
 <SummaryRow label="Scenario" value={scenarioLabel} />
 )}
 {config.loadThresholds && (
 <SummaryRow
 label="Thresholds"
 value={`P95 ≤ ${config.loadThresholds.http_req_duration_p95}ms, Error ≤ ${Math.round(config.loadThresholds.http_req_failed * 100)}%`}
 />
 )}
 </>
 );
 }

 // Feature #591: Security test type review display
 case 'security': {
 const scanTypeLabels: Record<string, string> = {
 full: 'Full Scan',
 sast: 'SAST Only',
 dependency: 'Dependency Scan',
 secrets: 'Secret Detection',
 dast: 'DAST Scan',
 };
 const scanLabel = scanTypeLabels[config.scanType || 'full'] || 'Full Scan';
 return (
 <>
 <SummaryRow label="Scan Type" value={scanLabel} />
 {config.scanType !== 'dast' && (
 <SummaryRow label="Target Path" value={config.targetPath || './'} />
 )}
 <SummaryRow
 label="Fail On"
 value={`${(config.failOnSeverity || 'high').charAt(0).toUpperCase()}${(config.failOnSeverity || 'high').slice(1)} severity or above`}
 />
 {config.excludePaths && config.excludePaths.length > 0 && (
 <SummaryRow label="Excluded Paths" value={`${config.excludePaths.length} paths`} />
 )}
 {config.ignorePatterns && config.ignorePatterns.length > 0 && (
 <SummaryRow label="Ignore Patterns" value={`${config.ignorePatterns.length} patterns`} />
 )}
 </>
 );
 }

 default:
 return null;
 }
 };

 return (
 <div className="space-y-4">
 <div>
 <h3 className="text-xl font-semibold text-foreground mb-1">
 Review Your Test
 </h3>
 <p className="text-sm text-muted-foreground">
 Verify the configuration below before creating your test
 </p>
 </div>

 {/* Summary Card */}
 <div className="bg-card border border-border rounded-xl p-5 space-y-3">
 {/* Test Type Header */}
 {typeConfig && (
 <div className="flex items-center gap-3 pb-3 border-b border-border">
 <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${typeConfig.iconBg}`}>
 {typeConfig.icon}
 </div>
 <div>
 <h4 className="text-lg font-semibold text-foreground">
 {displayName}
 </h4>
 <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${typeConfig.badgeCls}`}>
 {typeConfig.label}
 </span>
 </div>
 </div>
 )}

 {/* Configuration Summary */}
 <div className="space-y-0.5 divide-y divide-border/50">
 <SummaryRow label="Method" value={config.method === 'ai-generate' ? 'AI Generated' : 'Manual Setup'} />
 <SummaryRow label="Target URL" value={displayUrl || 'Not specified'} highlight />
 <SummaryRow label="Description" value={displayDescription} />
 {renderTypeSpecificSettings()}
 </div>

 {/* Edit Button */}
 <div className="pt-3 border-t border-border">
 <button
 type="button"
 onClick={onEdit}
 disabled={isSubmitting}
 className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 disabled:opacity-50 transition-colors rounded-md px-2 py-1 -ml-2 hover:bg-muted/80"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 Edit Configuration
 </button>
 </div>
 </div>

 {/* Error Message */}
 {error && (
 <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
 <div className="flex items-center gap-2">
 <svg className="w-5 h-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <p className="text-sm text-destructive">{error}</p>
 </div>
 </div>
 )}

 {/* Feature #596: Schedule Picker (shown when Create & Schedule is selected) */}
 {showSchedulePicker && (
 <SchedulePicker
 value={scheduleConfig}
 onChange={setScheduleConfig}
 onClose={() => setShowSchedulePicker(false)}
 />
 )}

 {/* Action Buttons - Feature #1985: Create & Run flow, Feature #596: Create & Schedule */}
 <div className="space-y-3">
 {/* Primary Row: Create & Run */}
 <div className="flex gap-3">
 {/* Create Test Button */}
 <button
 type="button"
 onClick={handleCreate}
 disabled={isSubmitting || !testType}
 className="flex-1 py-2.5 bg-muted hover:bg-muted/80 disabled:bg-muted/50 text-foreground text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-border"
 >
 {isSubmitting && !submissionPhase && !showSchedulePicker ? (
 <>
 <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 Creating...
 </>
 ) : (
 <>
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
 </svg>
 Create Test
 </>
 )}
 </button>

 {/* Create & Run Button - Feature #1985 */}
 <button
 type="button"
 onClick={handleCreateAndRun}
 disabled={isSubmitting || !testType}
 className="flex-1 py-2.5 bg-success hover:bg-success/90 disabled:bg-muted/50 text-success-foreground text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {submissionPhase && !showSchedulePicker ? (
 <>
 <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 {submissionPhase === 'creating' ? 'Creating test...' : 'Running test...'}
 </>
 ) : (
 <>
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 Create & Run
 </>
 )}
 </button>
 </div>

 {/* Secondary Row: Create & Schedule - Feature #596 */}
 <div className="flex gap-3">
 {!showSchedulePicker ? (
 <button
 type="button"
 onClick={() => setShowSchedulePicker(true)}
 disabled={isSubmitting || !testType}
 className="flex-1 py-2 bg-primary/10 hover:bg-primary/20 disabled:bg-muted/50 text-primary text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-primary/20"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 Create & Schedule
 </button>
 ) : (
 <button
 type="button"
 onClick={handleCreateAndSchedule}
 disabled={isSubmitting || !testType}
 className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted/50 text-primary-foreground text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {submissionPhase ? (
 <>
 <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 {submissionPhase === 'creating' ? 'Creating test...' : 'Creating schedule...'}
 </>
 ) : (
 <>
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 Confirm Create & Schedule
 </>
 )}
 </button>
 )}
 </div>
 </div>
 </div>
 );
};

export default ReviewStep;
