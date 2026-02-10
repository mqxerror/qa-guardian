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
import { type Step } from './config/StepBuilder';
// Feature #513: Removed unused CaptureMode, ViewportConfig - using VisualConfigState instead
import { VisualConfig, type VisualConfigState } from './config/VisualConfig';
// Feature #584: Wire E2EConfig into wizard for full E2E configuration
import { E2EConfig, type E2EConfigState } from './config/E2EConfig';
// Feature #585: Wire LoadConfig into wizard for full load test configuration
import { LoadConfig, type LoadConfigState, type LoadScenario } from './config/LoadConfig';
// Feature #586: Wire PerformanceConfig into wizard for full performance test configuration
import { PerformanceConfig, type PerformanceConfigState } from './config/PerformanceConfig';
// Feature #587: Wire AccessibilityConfig into wizard for full accessibility test configuration
import { AccessibilityConfig, type AccessibilityConfigState, type Severity } from './config/AccessibilityConfig';
import { type DeviceConfig } from '../test-modals/types';

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
 /** Feature #584: Full E2E configuration from E2EConfig component */
 e2eConfig?: E2EConfigState;
 timeout: number;
 retries: number;
 tags: string[];
 deviceEmulationEnabled: boolean;
 deviceConfig: DeviceConfig;
 // Visual specific - Feature #1964: Enhanced with full VisualConfig support
 viewportWidth: number;
 viewportHeight: number;
 diffThreshold: number;
 visualConfig?: VisualConfigState; // Full visual configuration
 // Performance specific
 devicePreset: 'desktop' | 'mobile';
 performanceThreshold: number;
 /** Feature #586: Full performance test configuration from PerformanceConfig component */
 performanceConfig?: PerformanceConfigState;
 lcpThreshold: number;
 clsThreshold: number;
 fidThreshold: number;
 ttiThreshold: number;
 lighthouseCategories: {
 performance: boolean;
 accessibility: boolean;
 bestPractices: boolean;
 seo: boolean;
 };
 // Accessibility specific
 wcagLevel: 'A' | 'AA' | 'AAA';
 /** Feature #587: Full accessibility test configuration from AccessibilityConfig component */
 accessibilityConfig?: AccessibilityConfigState;
 a11yThresholds: Record<Severity, number>;
 includeIframes: boolean;
 waitForA11ySelector: string;
 excludeRules: string[];
 // Load specific
 virtualUsers: number;
 duration: number;
 rampUp: number;
 /** Feature #585: Full load test configuration from LoadConfig component */
 loadConfig?: LoadConfigState;
 loadScenario: LoadScenario;
 k6Script: string;
 loadThresholds: {
 http_req_duration_p95: number;
 http_req_failed: number;
 };
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
 // Feature #584: E2E config defaults
 timeout: 30000,
 retries: 0,
 tags: [],
 deviceEmulationEnabled: false,
 deviceConfig: { preset: 'desktop-1280' },
 viewportWidth: 1920,
 viewportHeight: 1080,
 diffThreshold: 0.1,
 devicePreset: 'desktop',
 performanceThreshold: 50,
 // Feature #586: Performance config defaults
 lcpThreshold: 2500,
 clsThreshold: 0.1,
 fidThreshold: 100,
 ttiThreshold: 3800,
 lighthouseCategories: {
 performance: true,
 accessibility: true,
 bestPractices: true,
 seo: true,
 },
 wcagLevel: 'AA',
 // Feature #587: Accessibility config defaults
 a11yThresholds: {
 critical: 0,
 serious: 0,
 moderate: 5,
 minor: 10,
 },
 includeIframes: false,
 waitForA11ySelector: '',
 excludeRules: [],
 virtualUsers: 10,
 duration: 60,
 rampUp: 10,
 // Feature #585: Load config defaults
 loadScenario: 'constant',
 k6Script: '',
 loadThresholds: {
 http_req_duration_p95: 500,
 http_req_failed: 0.01,
 },
};

/**
 * Collapsible section component — semantic tokens, hover states
 */
const CollapsibleSection: React.FC<{
 title: string;
 isOpen: boolean;
 onToggle: () => void;
 children: React.ReactNode;
}> = ({ title, isOpen, onToggle, children }) => (
 <div className="border border-border rounded-lg overflow-hidden bg-card">
 <button
 type="button"
 onClick={onToggle}
 className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted/80 transition-colors"
 >
 <span className="text-sm font-medium text-foreground">{title}</span>
 <svg
 className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 {isOpen && <div className="p-4 border-t border-border">{children}</div>}
 </div>
);

/**
 * Form field component — semantic tokens, tight spacing
 */
const FormField: React.FC<{
 label: string;
 required?: boolean;
 children: React.ReactNode;
 hint?: string;
 error?: string;
}> = ({ label, required, children, hint, error }) => (
 <div className="space-y-1">
 <label className="block text-sm font-medium text-foreground">
 {label}
 {required && <span className="text-destructive ml-0.5">*</span>}
 </label>
 {children}
 {hint && !error && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
 {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
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
 onContinue: _onContinue, // Feature #513: prefixed - continuation handled via onChange callback
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
 const { [field as keyof FormErrors]: _removed, ...rest } = prevErrors;
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
 // Feature #584: Use full E2EConfig component with step builder,
 // device emulation, timeout, retries, and tags
 return (
 <div className="space-y-4 -mt-4">
 <E2EConfig
 initialValues={{
 name: formState.name,
 description: formState.description,
 targetUrl: formState.targetUrl,
 steps: formState.steps,
 structuredSteps: formState.structuredSteps,
 timeout: formState.timeout,
 retries: formState.retries,
 tags: formState.tags,
 deviceEmulationEnabled: formState.deviceEmulationEnabled,
 deviceConfig: formState.deviceConfig as E2EConfigState['deviceConfig'],
 }}
 onChange={(e2eConfig) => {
 // Sync E2E config back to form state
 setFormState(prev => ({
 ...prev,
 name: e2eConfig.name || prev.name,
 description: e2eConfig.description || prev.description,
 targetUrl: e2eConfig.targetUrl || prev.targetUrl,
 steps: e2eConfig.steps,
 structuredSteps: e2eConfig.structuredSteps,
 timeout: e2eConfig.timeout,
 retries: e2eConfig.retries,
 tags: e2eConfig.tags,
 deviceEmulationEnabled: e2eConfig.deviceEmulationEnabled,
 deviceConfig: e2eConfig.deviceConfig,
 e2eConfig: e2eConfig,
 }));
 }}
 onValidationChange={(_isValid) => {
 // Feature #584: E2E config validation handled separately
 }}
 projectBaseUrl={projectBaseUrl}
 className="e2e-config-embedded"
 />
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
 onValidationChange={(_isValid) => {
 // Feature #513: prefixed - visual config validation handled separately
 }}
 projectBaseUrl={projectBaseUrl}
 className="visual-config-embedded"
 />
 </div>
 );

 case 'performance':
 // Feature #586: Use full PerformanceConfig component with Core Web Vitals,
 // category toggles, and device presets
 return (
 <div className="space-y-4 -mt-4">
 <PerformanceConfig
 initialValues={{
 name: formState.name,
 description: formState.description,
 targetUrl: formState.targetUrl,
 devicePreset: formState.devicePreset,
 performanceThreshold: formState.performanceThreshold,
 lcpThreshold: formState.lcpThreshold,
 clsThreshold: formState.clsThreshold,
 fidThreshold: formState.fidThreshold,
 ttiThreshold: formState.ttiThreshold,
 categories: formState.lighthouseCategories,
 }}
 onChange={(perfConfig) => {
 // Sync performance config back to form state
 setFormState(prev => ({
 ...prev,
 name: perfConfig.name || prev.name,
 description: perfConfig.description || prev.description,
 targetUrl: perfConfig.targetUrl || prev.targetUrl,
 devicePreset: perfConfig.devicePreset,
 performanceThreshold: perfConfig.performanceThreshold,
 lcpThreshold: perfConfig.lcpThreshold,
 clsThreshold: perfConfig.clsThreshold,
 fidThreshold: perfConfig.fidThreshold,
 ttiThreshold: perfConfig.ttiThreshold,
 lighthouseCategories: perfConfig.categories,
 performanceConfig: perfConfig,
 }));
 }}
 onValidationChange={(_isValid) => {
 // Feature #586: Performance config validation handled separately
 }}
 projectBaseUrl={projectBaseUrl}
 className="performance-config-embedded"
 />
 </div>
 );

 case 'accessibility':
 // Feature #587: Use full AccessibilityConfig component with WCAG levels,
 // severity thresholds, and advanced options
 return (
 <div className="space-y-4 -mt-4">
 <AccessibilityConfig
 initialValues={{
 name: formState.name,
 description: formState.description,
 targetUrl: formState.targetUrl,
 wcagLevel: formState.wcagLevel,
 thresholds: formState.a11yThresholds,
 includeIframes: formState.includeIframes,
 waitForSelector: formState.waitForA11ySelector,
 excludeRules: formState.excludeRules,
 }}
 onChange={(a11yConfig) => {
 // Sync accessibility config back to form state
 setFormState(prev => ({
 ...prev,
 name: a11yConfig.name || prev.name,
 description: a11yConfig.description || prev.description,
 targetUrl: a11yConfig.targetUrl || prev.targetUrl,
 wcagLevel: a11yConfig.wcagLevel,
 a11yThresholds: a11yConfig.thresholds,
 includeIframes: a11yConfig.includeIframes,
 waitForA11ySelector: a11yConfig.waitForSelector,
 excludeRules: a11yConfig.excludeRules,
 accessibilityConfig: a11yConfig,
 }));
 }}
 onValidationChange={(_isValid) => {
 // Feature #587: Accessibility config validation handled separately
 }}
 projectBaseUrl={projectBaseUrl}
 className="accessibility-config-embedded"
 />
 </div>
 );

 case 'load':
 // Feature #585: Use full LoadConfig component with scenario selection,
 // thresholds, k6 script editor, and advanced options
 return (
 <div className="space-y-4 -mt-4">
 <LoadConfig
 initialValues={{
 name: formState.name,
 description: formState.description,
 targetUrl: formState.targetUrl,
 virtualUsers: formState.virtualUsers,
 duration: formState.duration,
 rampUp: formState.rampUp,
 scenario: formState.loadScenario,
 k6Script: formState.k6Script,
 thresholds: formState.loadThresholds,
 }}
 onChange={(loadConfig) => {
 // Sync load config back to form state
 setFormState(prev => ({
 ...prev,
 name: loadConfig.name || prev.name,
 description: loadConfig.description || prev.description,
 targetUrl: loadConfig.targetUrl || prev.targetUrl,
 virtualUsers: loadConfig.virtualUsers,
 duration: loadConfig.duration,
 rampUp: loadConfig.rampUp,
 loadScenario: loadConfig.scenario,
 k6Script: loadConfig.k6Script,
 loadThresholds: loadConfig.thresholds,
 loadConfig: loadConfig,
 }));
 }}
 onValidationChange={(_isValid) => {
 // Feature #585: Load config validation handled separately
 }}
 projectBaseUrl={projectBaseUrl}
 className="load-config-embedded"
 />
 </div>
 );

 default:
 return null;
 }
 };

 return (
 <div className="space-y-4">
 {/* Step 1: Select Test Type */}
 <div>
 <h3 className="text-xl font-semibold text-foreground mb-1">
 Select Test Type
 </h3>
 <p className="text-sm text-muted-foreground mb-3">
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
 <div className="space-y-3 pt-3 border-t border-border">
 <h4 className="text-sm font-medium text-foreground">
 Test Configuration
 </h4>

 {/* Skip common fields for visual/e2e/load/performance tests - dedicated config components render them */}
 {formState.testType !== 'visual' && formState.testType !== 'e2e' && formState.testType !== 'load' && formState.testType !== 'performance' && formState.testType !== 'accessibility' && (
 <>
 <FormField label="Test Name" required error={touched.name ? errors.name : undefined}>
 <input
 type="text"
 value={formState.name}
 onChange={(e) => updateField('name', e.target.value)}
 onBlur={() => handleBlur('name')}
 placeholder="Enter test name"
 className={`w-full px-3 py-2 border rounded-lg bg-input text-foreground ${
 touched.name && errors.name
 ? 'border-destructive focus:ring-destructive'
 : 'border-border focus:ring-primary'
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
 className={`w-full px-3 py-2 border rounded-lg bg-input text-foreground ${
 touched.targetUrl && errors.targetUrl
 ? 'border-destructive focus:ring-destructive'
 : 'border-border focus:ring-primary'
 }`}
 />
 </FormField>

 <FormField label="Description">
 <textarea
 value={formState.description}
 onChange={(e) => updateField('description', e.target.value)}
 placeholder="Describe what this test does..."
 rows={2}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground resize-none"
 />
 </FormField>
 </>
 )}

 {/* Type-specific fields */}
 {renderTypeSpecificFields()}

 {/* Advanced Settings - skip for visual/e2e/load/performance tests (dedicated config components have their own) */}
 {formState.testType !== 'visual' && formState.testType !== 'e2e' && formState.testType !== 'load' && formState.testType !== 'performance' && formState.testType !== 'accessibility' && (
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
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 </FormField>

 <FormField label="Timeout (ms)" hint="Maximum time for test execution">
 <input
 type="number"
 defaultValue={30000}
 min={1000}
 max={300000}
 step={1000}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 </FormField>

 <FormField label="Retries" hint="Number of retry attempts on failure">
 <input
 type="number"
 defaultValue={0}
 min={0}
 max={5}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 </FormField>
 </div>
 </CollapsibleSection>
 )}
 </div>
 )}

 {/* Validation Summary */}
 {formState.testType && !isFormValid && Object.keys(validationErrors).length > 0 && (
 <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
 <p className="text-xs text-destructive">
 Please fix the errors above to continue.
 </p>
 </div>
 )}
 {formState.testType === null && (
 <p className="text-xs text-muted-foreground">
 Please select a test type to continue.
 </p>
 )}
 </div>
 );
};

export default ManualSetupStep;
