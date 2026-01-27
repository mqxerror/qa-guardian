/**
 * E2EConfig Component
 * Feature #1810: E2E Test Configuration Form
 * Feature #1822: StepBuilder with dropdown actions
 *
 * Provides form fields specific to E2E (End-to-End) tests:
 * - Test name
 * - Description
 * - Target URL
 * - Steps editor with structured step builder (dropdowns)
 */

import React, { useState, useCallback } from 'react';
import { StepBuilder, type Step } from './StepBuilder';

/**
 * E2E test configuration state
 */
export interface E2EConfigState {
  name: string;
  description: string;
  targetUrl: string;
  steps: string;
  /** Structured steps for step builder (Feature #1822) */
  structuredSteps?: Step[];
  timeout: number;
  retries: number;
  tags: string[];
}

/**
 * Props for E2EConfig
 */
export interface E2EConfigProps {
  /** Initial configuration values */
  initialValues?: Partial<E2EConfigState>;
  /** Called when configuration changes */
  onChange?: (config: E2EConfigState) => void;
  /** Called when form validation state changes */
  onValidationChange?: (isValid: boolean) => void;
  /** Project base URL for smart defaults */
  projectBaseUrl?: string;
  /** CSS class name */
  className?: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: E2EConfigState = {
  name: '',
  description: '',
  targetUrl: '',
  steps: '',
  timeout: 30000,
  retries: 0,
  tags: [],
};

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
 * E2EConfig - Configuration form for E2E tests
 */
export const E2EConfig: React.FC<E2EConfigProps> = ({
  initialValues,
  onChange,
  onValidationChange,
  projectBaseUrl,
  className = '',
}) => {
  const [config, setConfig] = useState<E2EConfigState>({
    ...DEFAULT_CONFIG,
    targetUrl: projectBaseUrl || '',
    ...initialValues,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof E2EConfigState, string>>>({});

  // Validate required fields
  const validate = useCallback((values: E2EConfigState): boolean => {
    const newErrors: Partial<Record<keyof E2EConfigState, string>> = {};

    if (!values.name.trim()) {
      newErrors.name = 'Test name is required';
    }

    if (!values.targetUrl.trim()) {
      newErrors.targetUrl = 'Target URL is required';
    } else if (!/^https?:\/\/.+/.test(values.targetUrl)) {
      newErrors.targetUrl = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    onValidationChange?.(isValid);
    return isValid;
  }, [onValidationChange]);

  // Update field
  const updateField = useCallback(<K extends keyof E2EConfigState>(
    field: K,
    value: E2EConfigState[K]
  ) => {
    setConfig(prev => {
      const newConfig = { ...prev, [field]: value };
      validate(newConfig);
      onChange?.(newConfig);
      return newConfig;
    });
  }, [onChange, validate]);

  // Parse tags from comma-separated string
  const handleTagsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const tagString = e.target.value;
    const tags = tagString.split(',').map(t => t.trim()).filter(Boolean);
    updateField('tags', tags);
  }, [updateField]);

  return (
    <div className={`e2e-config space-y-4 ${className}`}>
      {/* Test Name */}
      <FormField label="Test Name" required error={errors.name}>
        <input
          type="text"
          value={config.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Enter test name"
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            errors.name
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
          }`}
        />
      </FormField>

      {/* Target URL */}
      <FormField label="Target URL" required error={errors.targetUrl}>
        <input
          type="url"
          value={config.targetUrl}
          onChange={(e) => updateField('targetUrl', e.target.value)}
          placeholder={projectBaseUrl || 'https://your-site.com'}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            errors.targetUrl
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
          }`}
        />
      </FormField>

      {/* Description */}
      <FormField label="Description" hint="Optional description of what this test verifies">
        <textarea
          value={config.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Describe what this test does..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
        />
      </FormField>

      {/* Steps Editor - Feature #1822: StepBuilder with dropdowns */}
      <FormField
        label="Test Steps"
        hint="Define actions using the dropdowns. Drag to reorder steps."
      >
        <StepBuilder
          value={config.structuredSteps}
          onChange={(steps) => {
            // Convert steps to string for legacy support
            const stepsString = steps
              .map((step, index) => {
                let stepStr = `${index + 1}. ${step.action}`;
                if (step.selector) stepStr += ` "${step.selector}"`;
                if (step.value) stepStr += ` → ${step.value}`;
                return stepStr;
              })
              .join('\n');
            setConfig(prev => {
              const newConfig = { ...prev, steps: stepsString, structuredSteps: steps };
              validate(newConfig);
              onChange?.(newConfig);
              return newConfig;
            });
          }}
        />
      </FormField>

      {/* Advanced Settings */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Advanced Settings
        </h4>

        <div className="grid grid-cols-2 gap-4">
          {/* Timeout */}
          <FormField label="Timeout (ms)" hint="Maximum execution time">
            <input
              type="number"
              value={config.timeout}
              onChange={(e) => updateField('timeout', parseInt(e.target.value) || 30000)}
              min={1000}
              max={300000}
              step={1000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </FormField>

          {/* Retries */}
          <FormField label="Retries" hint="Retry on failure">
            <input
              type="number"
              value={config.retries}
              onChange={(e) => updateField('retries', parseInt(e.target.value) || 0)}
              min={0}
              max={5}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </FormField>
        </div>

        {/* Tags */}
        <div className="mt-4">
          <FormField label="Tags" hint="Comma-separated list of tags for filtering">
            <input
              type="text"
              defaultValue={config.tags.join(', ')}
              onChange={handleTagsChange}
              placeholder="smoke, regression, critical"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </FormField>
        </div>
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

export default E2EConfig;
