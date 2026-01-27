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
import { type TestTypeOption } from './shared';

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
  // Performance specific
  devicePreset?: 'desktop' | 'mobile';
  performanceThreshold?: number;
  // Accessibility specific
  wcagLevel?: 'A' | 'AA' | 'AAA';
  // Load specific
  virtualUsers?: number;
  duration?: number;
  rampUp?: number;
}

/**
 * Combined wizard configuration type
 */
export type WizardConfig = AIGeneratedConfig | ManualSetupConfig;

/**
 * Props for ReviewStep
 */
export interface ReviewStepProps {
  /** Configuration from previous steps */
  config: WizardConfig;
  /** Suite ID for API call */
  suiteId: string;
  /** Auth token for API call */
  token: string;
  /** Called to go back and edit */
  onEdit: () => void;
  /** Called when test is successfully created */
  onSuccess: (test: { id: string; name: string; runId?: string }) => void;
  /** Called when there's an error */
  onError?: (error: string) => void;
}

/**
 * Test type display configuration
 */
const TEST_TYPE_CONFIG: Record<TestTypeOption, { label: string; icon: string; color: string }> = {
  e2e: { label: 'E2E Test', icon: '🔄', color: 'blue' },
  visual: { label: 'Visual Regression', icon: '📸', color: 'purple' },
  performance: { label: 'Performance', icon: '⚡', color: 'orange' },
  load: { label: 'Load Test', icon: '📊', color: 'red' },
  accessibility: { label: 'Accessibility', icon: '♿', color: 'green' },
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
};

/**
 * Summary row component
 */
const SummaryRow: React.FC<{
  label: string;
  value: string | React.ReactNode;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <div className={`flex justify-between py-2 ${highlight ? 'bg-blue-50 dark:bg-blue-900/20 -mx-3 px-3 rounded' : ''}`}>
    <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
    <span className={`text-sm font-medium ${highlight ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
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
  token,
  onEdit,
  onSuccess,
  onError,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionPhase, setSubmissionPhase] = useState<SubmissionPhase>(null);
  const [error, setError] = useState<string | null>(null);

  // Get test type config
  const testType = config.testType;
  const typeConfig = testType ? TEST_TYPE_CONFIG[testType] : null;

  // Get display values based on config method
  const displayName = config.method === 'manual-setup'
    ? config.name
    : `${typeConfig?.label || 'Test'} - ${new URL(config.url || 'https://unknown-site.com').hostname}`;

  const displayUrl = config.method === 'manual-setup' ? config.targetUrl : config.url;
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
      }
      if (testType === 'performance') {
        requestBody.device_preset = config.devicePreset || 'desktop';
        requestBody.performance_threshold = config.performanceThreshold || 50;
      }
      if (testType === 'accessibility') {
        requestBody.wcag_level = config.wcagLevel || 'AA';
      }
      if (testType === 'load') {
        requestBody.virtual_users = config.virtualUsers || 10;
        requestBody.duration = config.duration || 60;
        requestBody.ramp_up = config.rampUp || 10;
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

  // Render type-specific settings
  const renderTypeSpecificSettings = () => {
    if (config.method !== 'manual-setup') {
      return (
        <SummaryRow
          label="Viewport"
          value={`${config.viewport.preset} (${config.viewport.width}×${config.viewport.height})`}
        />
      );
    }

    switch (testType) {
      case 'e2e':
        return config.steps ? (
          <SummaryRow label="Steps" value={`${config.steps.split('\n').filter(Boolean).length} steps defined`} />
        ) : null;

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
          </>
        );
      }

      case 'performance':
        return (
          <>
            <SummaryRow label="Device" value={config.devicePreset === 'mobile' ? 'Mobile' : 'Desktop'} />
            <SummaryRow label="Threshold" value={`Score ≥ ${config.performanceThreshold || 50}`} />
          </>
        );

      case 'accessibility':
        return (
          <SummaryRow label="WCAG Level" value={`Level ${config.wcagLevel || 'AA'}`} />
        );

      case 'load':
        return (
          <>
            <SummaryRow label="Virtual Users" value={`${config.virtualUsers || 10} VUs`} />
            <SummaryRow label="Duration" value={`${config.duration || 60} seconds`} />
            <SummaryRow label="Ramp-up" value={`${config.rampUp || 10} seconds`} />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Review Your Test
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Verify the configuration below before creating your test
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
        {/* Test Type Header */}
        {typeConfig && (
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-${typeConfig.color}-100 dark:bg-${typeConfig.color}-900/30`}>
              {typeConfig.icon}
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {displayName}
              </h4>
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-${typeConfig.color}-100 dark:bg-${typeConfig.color}-900/30 text-${typeConfig.color}-700 dark:text-${typeConfig.color}-300`}>
                {typeConfig.label}
              </span>
            </div>
          </div>
        )}

        {/* Configuration Summary */}
        <div className="space-y-1 divide-y divide-gray-100 dark:divide-gray-700/50">
          <SummaryRow label="Method" value={config.method === 'ai-generate' ? 'AI Generated' : 'Manual Setup'} />
          <SummaryRow label="Target URL" value={displayUrl || 'Not specified'} highlight />
          <SummaryRow label="Description" value={displayDescription} />
          {renderTypeSpecificSettings()}
        </div>

        {/* Edit Button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onEdit}
            disabled={isSubmitting}
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
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
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons - Feature #1985: Create & Run flow */}
      <div className="flex gap-3">
        {/* Create Test Button */}
        <button
          type="button"
          onClick={handleCreate}
          disabled={isSubmitting || !testType}
          className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600"
        >
          {isSubmitting && !submissionPhase ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submissionPhase ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {submissionPhase === 'creating' ? 'Creating test...' : 'Running test...'}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Create & Run
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;
