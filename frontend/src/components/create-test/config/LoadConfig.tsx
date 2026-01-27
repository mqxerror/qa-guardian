/**
 * LoadConfig Component
 * Feature #1813: Load (K6) Test Configuration Form
 *
 * Provides form fields specific to Load/Stress tests:
 * - Target URL/endpoint
 * - Virtual users count
 * - Duration
 * - Ramp-up time
 * - K6 script editor
 */

import React, { useState, useCallback } from 'react';

/**
 * Load test scenario type
 */
export type LoadScenario = 'constant' | 'ramping' | 'stages' | 'custom';

/**
 * Load test configuration state
 */
export interface LoadConfigState {
  name: string;
  description: string;
  targetUrl: string;
  virtualUsers: number;
  duration: number;  // in seconds
  rampUp: number;    // in seconds
  scenario: LoadScenario;
  k6Script: string;
  thresholds: {
    http_req_duration_p95: number;  // 95th percentile response time in ms
    http_req_failed: number;         // Max failure rate (0-1)
  };
  checks: string[];
}

/**
 * Props for LoadConfig
 */
export interface LoadConfigProps {
  /** Initial configuration values */
  initialValues?: Partial<LoadConfigState>;
  /** Called when configuration changes */
  onChange?: (config: LoadConfigState) => void;
  /** Called when form validation state changes */
  onValidationChange?: (isValid: boolean) => void;
  /** Project base URL for smart defaults */
  projectBaseUrl?: string;
  /** CSS class name */
  className?: string;
}

/**
 * Default K6 script template
 */
const DEFAULT_K6_SCRIPT = `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: {{VUS}},
  duration: '{{DURATION}}s',
};

export default function () {
  const res = http.get('{{URL}}');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}`;

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: LoadConfigState = {
  name: '',
  description: '',
  targetUrl: '',
  virtualUsers: 10,
  duration: 60,
  rampUp: 10,
  scenario: 'constant',
  k6Script: '',
  thresholds: {
    http_req_duration_p95: 500,
    http_req_failed: 0.01,
  },
  checks: [],
};

/**
 * Scenario options
 */
const SCENARIOS: { value: LoadScenario; label: string; description: string }[] = [
  {
    value: 'constant',
    label: 'Constant Load',
    description: 'Fixed number of VUs for the duration',
  },
  {
    value: 'ramping',
    label: 'Ramping Load',
    description: 'Gradually increase VUs over time',
  },
  {
    value: 'stages',
    label: 'Staged Load',
    description: 'Define multiple stages with different VU counts',
  },
  {
    value: 'custom',
    label: 'Custom Script',
    description: 'Write your own K6 script',
  },
];

/**
 * Form field component
 */
const FormField: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}> = ({ label, required, children, hint, error }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

/**
 * LoadConfig - Configuration form for K6 Load tests
 */
export const LoadConfig: React.FC<LoadConfigProps> = ({
  initialValues,
  onChange,
  onValidationChange,
  projectBaseUrl,
  className = '',
}) => {
  const [config, setConfig] = useState<LoadConfigState>({
    ...DEFAULT_CONFIG,
    targetUrl: projectBaseUrl || '',
    ...initialValues,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof LoadConfigState, string>>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generate K6 script from configuration
  const generateScript = useCallback((cfg: LoadConfigState): string => {
    return DEFAULT_K6_SCRIPT
      .replace('{{VUS}}', String(cfg.virtualUsers))
      .replace('{{DURATION}}', String(cfg.duration))
      .replace('{{URL}}', cfg.targetUrl || projectBaseUrl || 'https://your-site.com');
  }, [projectBaseUrl]);

  // Validate required fields
  const validate = useCallback((values: LoadConfigState): boolean => {
    const newErrors: Partial<Record<keyof LoadConfigState, string>> = {};

    if (!values.name.trim()) {
      newErrors.name = 'Test name is required';
    }

    if (!values.targetUrl.trim()) {
      newErrors.targetUrl = 'Target URL is required';
    } else if (!/^https?:\/\/.+/.test(values.targetUrl)) {
      newErrors.targetUrl = 'Please enter a valid URL';
    }

    if (values.virtualUsers < 1) {
      newErrors.virtualUsers = 'At least 1 virtual user is required';
    }

    if (values.duration < 10) {
      newErrors.duration = 'Duration must be at least 10 seconds';
    }

    if (values.scenario === 'custom' && !values.k6Script.trim()) {
      newErrors.k6Script = 'Custom K6 script is required';
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    onValidationChange?.(isValid);
    return isValid;
  }, [onValidationChange]);

  // Update field
  const updateField = useCallback(<K extends keyof LoadConfigState>(
    field: K,
    value: LoadConfigState[K]
  ) => {
    setConfig(prev => {
      const newConfig = { ...prev, [field]: value };
      // Auto-generate script if not custom mode
      if (field !== 'k6Script' && newConfig.scenario !== 'custom') {
        newConfig.k6Script = generateScript(newConfig);
      }
      validate(newConfig);
      onChange?.(newConfig);
      return newConfig;
    });
  }, [onChange, validate, generateScript]);

  // Update threshold
  const updateThreshold = useCallback((
    key: keyof LoadConfigState['thresholds'],
    value: number
  ) => {
    setConfig(prev => {
      const newThresholds = { ...prev.thresholds, [key]: value };
      const newConfig = { ...prev, thresholds: newThresholds };
      onChange?.(newConfig);
      return newConfig;
    });
  }, [onChange]);

  return (
    <div className={`load-config space-y-4 ${className}`}>
      {/* Test Name */}
      <FormField label="Test Name" required error={errors.name}>
        <input
          type="text"
          value={config.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Load Test - API Endpoint"
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            errors.name
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
          }`}
        />
      </FormField>

      {/* Target URL */}
      <FormField label="Target URL/Endpoint" required error={errors.targetUrl}>
        <input
          type="url"
          value={config.targetUrl}
          onChange={(e) => updateField('targetUrl', e.target.value)}
          placeholder={projectBaseUrl ? `${projectBaseUrl}/api` : 'https://your-site.com/api'}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            errors.targetUrl
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
          }`}
        />
      </FormField>

      {/* Description */}
      <FormField label="Description">
        <textarea
          value={config.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Describe what this load test measures..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
        />
      </FormField>

      {/* Load Configuration */}
      <div className="grid grid-cols-3 gap-4">
        {/* Virtual Users */}
        <FormField
          label="Virtual Users"
          required
          error={errors.virtualUsers}
          hint="Concurrent users"
        >
          <input
            type="number"
            value={config.virtualUsers}
            onChange={(e) => updateField('virtualUsers', parseInt(e.target.value) || 1)}
            min={1}
            max={10000}
            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
              errors.virtualUsers
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
        </FormField>

        {/* Duration */}
        <FormField
          label="Duration (sec)"
          required
          error={errors.duration}
          hint="Test length"
        >
          <input
            type="number"
            value={config.duration}
            onChange={(e) => updateField('duration', parseInt(e.target.value) || 60)}
            min={10}
            max={3600}
            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
              errors.duration
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
        </FormField>

        {/* Ramp Up */}
        <FormField label="Ramp-up (sec)" hint="Warm-up time">
          <input
            type="number"
            value={config.rampUp}
            onChange={(e) => updateField('rampUp', parseInt(e.target.value) || 0)}
            min={0}
            max={300}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </FormField>
      </div>

      {/* Load Estimate */}
      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Estimated Load: ~{Math.round(config.virtualUsers * (60 / 1))} requests/minute
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              Total: ~{Math.round(config.virtualUsers * config.duration)} requests over {config.duration}s
            </p>
          </div>
        </div>
      </div>

      {/* Scenario */}
      <FormField label="Load Scenario">
        <div className="grid grid-cols-2 gap-2">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.value}
              type="button"
              onClick={() => updateField('scenario', scenario.value)}
              className={`flex flex-col items-start p-3 rounded-lg border text-left transition-colors ${
                config.scenario === scenario.value
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <span className="font-medium text-sm text-gray-900 dark:text-white">
                {scenario.label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {scenario.description}
              </span>
            </button>
          ))}
        </div>
      </FormField>

      {/* K6 Script Editor (for custom scenario) */}
      {config.scenario === 'custom' && (
        <FormField
          label="K6 Script"
          required
          error={errors.k6Script}
          hint="Write your custom K6 load test script"
        >
          <textarea
            value={config.k6Script}
            onChange={(e) => updateField('k6Script', e.target.value)}
            placeholder={DEFAULT_K6_SCRIPT}
            rows={12}
            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm resize-none ${
              errors.k6Script
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
        </FormField>
      )}

      {/* Advanced Settings */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Thresholds & Advanced
          </span>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-600 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* P95 Response Time Threshold */}
              <FormField
                label="P95 Response Time (ms)"
                hint="95th percentile max response time"
              >
                <input
                  type="number"
                  value={config.thresholds.http_req_duration_p95}
                  onChange={(e) => updateThreshold('http_req_duration_p95', parseInt(e.target.value) || 500)}
                  min={0}
                  max={30000}
                  step={100}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </FormField>

              {/* Max Failure Rate */}
              <FormField
                label="Max Failure Rate (%)"
                hint="Maximum acceptable error rate"
              >
                <input
                  type="number"
                  value={config.thresholds.http_req_failed * 100}
                  onChange={(e) => updateThreshold('http_req_failed', (parseFloat(e.target.value) || 0) / 100)}
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </FormField>
            </div>

            {/* Generated Script Preview (non-custom) */}
            {config.scenario !== 'custom' && (
              <FormField label="Generated K6 Script" hint="Auto-generated based on your configuration">
                <pre className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                  {generateScript(config)}
                </pre>
              </FormField>
            )}
          </div>
        )}
      </div>

      {/* Validation Summary */}
      {Object.keys(errors).length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            Please fix the errors above to continue.
          </p>
        </div>
      )}
    </div>
  );
};

export default LoadConfig;
