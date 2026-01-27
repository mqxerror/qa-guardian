/**
 * ManualSetupStep Component
 * Feature #1809: ManualSetupStep with type-specific forms
 * Feature #1819: Form validation and error display
 * Feature #1822: StepBuilder for E2E test steps
 * Feature #1964: Enhanced visual test custom mode with device and capture options
 *
 * Step 2B of the CustomTestWizard when Manual Setup method is selected.
 * Features:
 * - TestTypeCards for selecting test type
 * - Dynamic form based on selected test type
 * - Collapsible Advanced Settings section
 * - Form fields appropriate for each test type
 * - Inline error display for validation
 * - StepBuilder with dropdowns for E2E test steps
 * - Enhanced VisualConfig with device presets, capture modes, and advanced options
 */

import React, { useState, useCallback } from 'react';
import { TestTypeCards, type TestTypeOption } from './shared';
import { StepBuilder, type Step } from './config/StepBuilder';
import { VisualConfig, type VisualConfigState, type CaptureMode, type ViewportConfig } from './config/VisualConfig';

/**
 * Form state for all test types
 */
export interface ManualSetupFormState {
  testType: TestTypeOption | null;
  name: string;
  description: string;
  targetUrl: string;
  // E2E specific
  steps: string;
  /** Structured steps for StepBuilder (Feature #1822) */
  structuredSteps?: Step[];
  // Visual specific - Feature #1964: Enhanced with full VisualConfig support
  viewportWidth: number;
  viewportHeight: number;
  diffThreshold: number;
  visualConfig?: VisualConfigState; // Full visual configuration
  // Performance specific
  devicePreset: 'desktop' | 'mobile';
  performanceThreshold: number;
  // Accessibility specific
  wcagLevel: 'A' | 'AA' | 'AAA';
  // Load specific
  virtualUsers: number;
  duration: number;
  rampUp: number;
}

/**
 * Props for ManualSetupStep
 */
export interface ManualSetupStepProps {
  /** Called when form is complete and ready to continue */
  onContinue: (formState: ManualSetupFormState) => void;
  /** Called when form state changes */
  onChange?: (formState: ManualSetupFormState, isValid: boolean) => void;
  /** Project base URL for smart defaults */
  projectBaseUrl?: string;
}

/**
 * Default form values
 */
const DEFAULT_FORM_STATE: ManualSetupFormState = {
  testType: null,
  name: '',
  description: '',
  targetUrl: '',
  steps: '',
  viewportWidth: 1920,
  viewportHeight: 1080,
  diffThreshold: 0.1,
  devicePreset: 'desktop',
  performanceThreshold: 50,
  wcagLevel: 'AA',
  virtualUsers: 10,
  duration: 60,
  rampUp: 10,
};

/**
 * Collapsible section component
 */
const CollapsibleSection: React.FC<{
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, isOpen, onToggle, children }) => (
  <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
      <svg
        className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {isOpen && <div className="p-4 border-t border-gray-200 dark:border-gray-600">{children}</div>}
  </div>
);

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
 * ManualSetupStep component
 */
/**
 * Form validation errors
 */
interface FormErrors {
  name?: string;
  targetUrl?: string;
  testType?: string;
}

/**
 * URL validation regex
 */
const URL_REGEX = /^https?:\/\/[^\s<>"']+$/i;

export const ManualSetupStep: React.FC<ManualSetupStepProps> = ({
  onContinue,
  onChange,
  projectBaseUrl,
}) => {
  const [formState, setFormState] = useState<ManualSetupFormState>({
    ...DEFAULT_FORM_STATE,
    targetUrl: projectBaseUrl || '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validate form fields
  const validate = useCallback((values: ManualSetupFormState): FormErrors => {
    const newErrors: FormErrors = {};

    if (!values.name.trim()) {
      newErrors.name = 'Test name is required';
    }

    if (!values.targetUrl.trim()) {
      newErrors.targetUrl = 'Target URL is required';
    } else if (!URL_REGEX.test(values.targetUrl)) {
      newErrors.targetUrl = 'Please enter a valid URL (e.g., https://your-site.com)';
    }

    return newErrors;
  }, []);

  // Update form field
  const updateField = useCallback(<K extends keyof ManualSetupFormState>(
    field: K,
    value: ManualSetupFormState[K]
  ) => {
    setFormState(prev => {
      const newState = { ...prev, [field]: value };
      // Clear error for this field when user types
      if (errors[field as keyof FormErrors]) {
        setErrors(prevErrors => {
          const { [field as keyof FormErrors]: _, ...rest } = prevErrors;
          return rest;
        });
      }
      return newState;
    });
    // Mark field as touched
    setTouched(prev => ({ ...prev, [field]: true }));
  }, [errors]);

  // Handle blur to trigger validation
  const handleBlur = useCallback((field: keyof FormErrors) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const validationErrors = validate(formState);
    if (validationErrors[field]) {
      setErrors(prev => ({ ...prev, [field]: validationErrors[field] }));
    }
  }, [formState, validate]);

  // Handle test type selection
  const handleTypeSelect = useCallback((type: TestTypeOption) => {
    setFormState(prev => ({
      ...prev,
      testType: type,
      // Auto-generate name based on type
      name: prev.name || `${type.charAt(0).toUpperCase() + type.slice(1)} Test`,
    }));
  }, []);

  // Check if form is valid
  const validationErrors = validate(formState);
  const isFormValid = formState.testType !== null && Object.keys(validationErrors).length === 0;

  // Notify parent of form state changes
  React.useEffect(() => {
    onChange?.(formState, isFormValid);
  }, [formState, isFormValid, onChange]);

  // Render type-specific form fields
  const renderTypeSpecificFields = () => {
    if (!formState.testType) return null;

    switch (formState.testType) {
      case 'e2e':
        return (
          <div className="space-y-4">
            <FormField label="Test Steps" hint="Define actions using dropdowns. Drag to reorder steps.">
              <StepBuilder
                value={formState.structuredSteps}
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
                  setFormState(prev => ({ ...prev, steps: stepsString, structuredSteps: steps }));
                }}
              />
            </FormField>
          </div>
        );

      case 'visual':
        // Feature #1964: Use full VisualConfig component with device presets,
        // capture modes, wait time, and enhanced diff threshold slider
        return (
          <div className="space-y-4 -mt-4">
            <VisualConfig
              initialValues={{
                name: formState.name,
                description: formState.description,
                targetUrl: formState.targetUrl,
                diffThreshold: formState.diffThreshold,
              }}
              onChange={(visualConfig) => {
                // Sync visual config back to form state
                setFormState(prev => ({
                  ...prev,
                  name: visualConfig.name || prev.name,
                  description: visualConfig.description || prev.description,
                  targetUrl: visualConfig.targetUrl || prev.targetUrl,
                  diffThreshold: visualConfig.diffThreshold,
                  viewportWidth: visualConfig.viewports.find(v => v.enabled)?.width || prev.viewportWidth,
                  viewportHeight: visualConfig.viewports.find(v => v.enabled)?.height || prev.viewportHeight,
                  visualConfig: visualConfig, // Store full config
                }));
              }}
              onValidationChange={(isValid) => {
                // Visual config has its own validation
              }}
              projectBaseUrl={projectBaseUrl}
              className="visual-config-embedded"
            />
          </div>
        );

      case 'performance':
        return (
          <div className="space-y-4">
            <FormField label="Device Preset" required>
              <select
                value={formState.devicePreset}
                onChange={(e) => updateField('devicePreset', e.target.value as 'desktop' | 'mobile')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
              </select>
            </FormField>
            <FormField label="Performance Threshold" hint="Minimum Lighthouse score (0-100)">
              <input
                type="number"
                value={formState.performanceThreshold}
                onChange={(e) => updateField('performanceThreshold', parseInt(e.target.value) || 50)}
                min={0}
                max={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </FormField>
          </div>
        );

      case 'accessibility':
        return (
          <div className="space-y-4">
            <FormField label="WCAG Level" required hint="Web Content Accessibility Guidelines level">
              <select
                value={formState.wcagLevel}
                onChange={(e) => updateField('wcagLevel', e.target.value as 'A' | 'AA' | 'AAA')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="A">Level A (Minimum)</option>
                <option value="AA">Level AA (Recommended)</option>
                <option value="AAA">Level AAA (Maximum)</option>
              </select>
            </FormField>
          </div>
        );

      case 'load':
        return (
          <div className="space-y-4">
            <FormField label="Virtual Users" required hint="Number of concurrent users to simulate">
              <input
                type="number"
                value={formState.virtualUsers}
                onChange={(e) => updateField('virtualUsers', parseInt(e.target.value) || 10)}
                min={1}
                max={10000}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Duration (seconds)" required>
                <input
                  type="number"
                  value={formState.duration}
                  onChange={(e) => updateField('duration', parseInt(e.target.value) || 60)}
                  min={10}
                  max={3600}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </FormField>
              <FormField label="Ramp-up (seconds)">
                <input
                  type="number"
                  value={formState.rampUp}
                  onChange={(e) => updateField('rampUp', parseInt(e.target.value) || 10)}
                  min={0}
                  max={300}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </FormField>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Select Test Type */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Select Test Type
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose the type of test you want to create
        </p>
        <TestTypeCards
          selectedType={formState.testType}
          onSelect={handleTypeSelect}
          ariaLabel="Select test type for manual setup"
        />
      </div>

      {/* Step 2: Basic Info (shown when type is selected) */}
      {formState.testType && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-white">
            Test Configuration
          </h4>

          <FormField label="Test Name" required error={touched.name ? errors.name : undefined}>
            <input
              type="text"
              value={formState.name}
              onChange={(e) => updateField('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              placeholder="Enter test name"
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                touched.name && errors.name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
            />
          </FormField>

          <FormField label="Target URL" required error={touched.targetUrl ? errors.targetUrl : undefined}>
            <input
              type="url"
              value={formState.targetUrl}
              onChange={(e) => updateField('targetUrl', e.target.value)}
              onBlur={() => handleBlur('targetUrl')}
              placeholder={projectBaseUrl || 'https://your-site.com'}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                touched.targetUrl && errors.targetUrl
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
            />
          </FormField>

          <FormField label="Description">
            <textarea
              value={formState.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe what this test does..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </FormField>

          {/* Type-specific fields */}
          {renderTypeSpecificFields()}

          {/* Advanced Settings */}
          <CollapsibleSection
            title="Advanced Settings"
            isOpen={showAdvanced}
            onToggle={() => setShowAdvanced(!showAdvanced)}
          >
            <div className="space-y-4">
              <FormField label="Tags" hint="Comma-separated list of tags">
                <input
                  type="text"
                  placeholder="smoke, regression, critical"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </FormField>

              <FormField label="Timeout (ms)" hint="Maximum time for test execution">
                <input
                  type="number"
                  defaultValue={30000}
                  min={1000}
                  max={300000}
                  step={1000}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </FormField>

              <FormField label="Retries" hint="Number of retry attempts on failure">
                <input
                  type="number"
                  defaultValue={0}
                  min={0}
                  max={5}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </FormField>
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* Validation Summary */}
      {formState.testType && !isFormValid && Object.keys(validationErrors).length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            Please fix the errors above to continue.
          </p>
        </div>
      )}
      {formState.testType === null && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Please select a test type to continue.
        </p>
      )}
    </div>
  );
};

export default ManualSetupStep;
