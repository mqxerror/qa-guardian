/**
 * AccessibilityConfig Component
 * Feature #1814: Accessibility (axe-core) Test Configuration Form
 *
 * Provides form fields specific to Accessibility tests:
 * - Target URL
 * - WCAG level selector (A/AA/AAA)
 * - Fail thresholds by severity (critical/serious/moderate/minor)
 */

import React, { useState, useCallback } from 'react';

/**
 * WCAG compliance level
 */
export type WCAGLevel = 'A' | 'AA' | 'AAA';

/**
 * Issue severity levels
 */
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Accessibility test configuration state
 */
export interface AccessibilityConfigState {
  name: string;
  description: string;
  targetUrl: string;
  wcagLevel: WCAGLevel;
  thresholds: Record<Severity, number>;
  includeRules: string[];
  excludeRules: string[];
  waitForSelector: string;
  includeIframes: boolean;
  runOnly: {
    type: 'tag' | 'rule';
    values: string[];
  } | null;
}

/**
 * Props for AccessibilityConfig
 */
export interface AccessibilityConfigProps {
  /** Initial configuration values */
  initialValues?: Partial<AccessibilityConfigState>;
  /** Called when configuration changes */
  onChange?: (config: AccessibilityConfigState) => void;
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
const DEFAULT_CONFIG: AccessibilityConfigState = {
  name: '',
  description: '',
  targetUrl: '',
  wcagLevel: 'AA',
  thresholds: {
    critical: 0,
    serious: 0,
    moderate: 5,
    minor: 10,
  },
  includeRules: [],
  excludeRules: [],
  waitForSelector: '',
  includeIframes: false,
  runOnly: null,
};

/**
 * WCAG level options
 */
const WCAG_LEVELS: { value: WCAGLevel; label: string; description: string }[] = [
  {
    value: 'A',
    label: 'Level A',
    description: 'Minimum level - essential requirements',
  },
  {
    value: 'AA',
    label: 'Level AA',
    description: 'Recommended level - covers most accessibility needs',
  },
  {
    value: 'AAA',
    label: 'Level AAA',
    description: 'Highest level - enhanced accessibility',
  },
];

/**
 * Severity configuration
 */
const SEVERITY_CONFIG: { key: Severity; label: string; color: string; description: string }[] = [
  {
    key: 'critical',
    label: 'Critical',
    color: 'red',
    description: 'Blocks access for users with disabilities',
  },
  {
    key: 'serious',
    label: 'Serious',
    color: 'orange',
    description: 'Significantly impacts accessibility',
  },
  {
    key: 'moderate',
    label: 'Moderate',
    color: 'yellow',
    description: 'Creates some barriers for users',
  },
  {
    key: 'minor',
    label: 'Minor',
    color: 'blue',
    description: 'Minor inconveniences',
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
 * AccessibilityConfig - Configuration form for Accessibility tests
 */
export const AccessibilityConfig: React.FC<AccessibilityConfigProps> = ({
  initialValues,
  onChange,
  onValidationChange,
  projectBaseUrl,
  className = '',
}) => {
  const [config, setConfig] = useState<AccessibilityConfigState>({
    ...DEFAULT_CONFIG,
    targetUrl: projectBaseUrl || '',
    ...initialValues,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AccessibilityConfigState, string>>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Validate required fields
  const validate = useCallback((values: AccessibilityConfigState): boolean => {
    const newErrors: Partial<Record<keyof AccessibilityConfigState, string>> = {};

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
  const updateField = useCallback(<K extends keyof AccessibilityConfigState>(
    field: K,
    value: AccessibilityConfigState[K]
  ) => {
    setConfig(prev => {
      const newConfig = { ...prev, [field]: value };
      validate(newConfig);
      onChange?.(newConfig);
      return newConfig;
    });
  }, [onChange, validate]);

  // Update threshold
  const updateThreshold = useCallback((severity: Severity, value: number) => {
    setConfig(prev => {
      const newThresholds = { ...prev.thresholds, [severity]: value };
      const newConfig = { ...prev, thresholds: newThresholds };
      onChange?.(newConfig);
      return newConfig;
    });
  }, [onChange]);

  return (
    <div className={`accessibility-config space-y-4 ${className}`}>
      {/* Test Name */}
      <FormField label="Test Name" required error={errors.name}>
        <input
          type="text"
          value={config.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Accessibility Audit - Homepage"
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
      <FormField label="Description">
        <textarea
          value={config.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Describe what this accessibility test checks..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
        />
      </FormField>

      {/* WCAG Level */}
      <FormField label="WCAG Compliance Level">
        <div className="grid grid-cols-3 gap-2">
          {WCAG_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => updateField('wcagLevel', level.value)}
              className={`flex flex-col items-center p-3 rounded-lg border text-center transition-colors ${
                config.wcagLevel === level.value
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <span className={`text-2xl font-bold ${
                config.wcagLevel === level.value
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-400'
              }`}>
                {level.value}
              </span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">
                {level.label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {level.description}
              </span>
            </button>
          ))}
        </div>
      </FormField>

      {/* Fail Thresholds by Severity */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Fail Thresholds by Severity
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Test fails if issues exceed these thresholds. Set to 0 for zero tolerance.
        </p>

        <div className="space-y-3">
          {SEVERITY_CONFIG.map((severity) => (
            <div
              key={severity.key}
              className="flex items-center gap-4"
            >
              <div className={`w-3 h-3 rounded-full ${
                severity.color === 'red' ? 'bg-red-500' :
                severity.color === 'orange' ? 'bg-orange-500' :
                severity.color === 'yellow' ? 'bg-yellow-500' :
                'bg-blue-500'
              }`} />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {severity.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  ({severity.description})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.thresholds[severity.key]}
                  onChange={(e) => updateThreshold(severity.key, parseInt(e.target.value) || 0)}
                  min={0}
                  max={100}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                />
                <span className="text-xs text-gray-500">max issues</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Threshold Presets */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            updateField('thresholds', { critical: 0, serious: 0, moderate: 0, minor: 0 });
          }}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Strict (Zero Tolerance)
        </button>
        <button
          type="button"
          onClick={() => {
            updateField('thresholds', { critical: 0, serious: 0, moderate: 5, minor: 10 });
          }}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Standard
        </button>
        <button
          type="button"
          onClick={() => {
            updateField('thresholds', { critical: 0, serious: 5, moderate: 20, minor: 50 });
          }}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Lenient
        </button>
      </div>

      {/* Advanced Settings */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Advanced Settings
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
            {/* Wait for Selector */}
            <FormField label="Wait for Selector" hint="Wait for this element before running audit">
              <input
                type="text"
                value={config.waitForSelector}
                onChange={(e) => updateField('waitForSelector', e.target.value)}
                placeholder="[data-loaded='true'], .content-ready"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
            </FormField>

            {/* Include Iframes */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.includeIframes}
                onChange={(e) => updateField('includeIframes', e.target.checked)}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include iframes in audit
              </span>
            </label>

            {/* Exclude Rules */}
            <FormField label="Exclude Rules" hint="Comma-separated rule IDs to skip">
              <input
                type="text"
                defaultValue={config.excludeRules.join(', ')}
                onChange={(e) => {
                  const rules = e.target.value.split(',').map(r => r.trim()).filter(Boolean);
                  updateField('excludeRules', rules);
                }}
                placeholder="color-contrast, html-has-lang"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
            </FormField>
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

export default AccessibilityConfig;
