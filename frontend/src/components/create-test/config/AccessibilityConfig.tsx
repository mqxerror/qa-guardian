/**
 * AccessibilityConfig Component
 * Feature #1814: Accessibility (axe-core) Test Configuration Form
 *
 * Provides form fields specific to Accessibility tests:
 * - Target URL
 * - WCAG level selector (A/AA/AAA)
 * - Fail thresholds by severity (critical/serious/moderate/minor)
 */

import React, { useState, useCallback, memo } from 'react';
import { ChevronDown } from 'lucide-react';

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
 * Feature #622: React.memo for performance optimization
 */
interface FormFieldProps {
 label: string;
 required?: boolean;
 children: React.ReactNode;
 hint?: string;
 error?: string;
}

const FormField = memo<FormFieldProps>(function FormField({ label, required, children, hint, error }) {
 return (
   <div className="space-y-1">
     <label className="block text-sm font-medium text-foreground">
       {label}
       {required && <span className="text-destructive ml-1">*</span>}
     </label>
     {children}
     {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
     {error && <p className="text-xs text-destructive">{error}</p>}
   </div>
 );
});
FormField.displayName = 'FormField';

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
 className={`w-full px-3 py-2 border rounded-lg bg-input text-foreground ${
 errors.name
 ? 'border-destructive focus:ring-destructive'
 : 'border-border focus:ring-primary'
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
 className={`w-full px-3 py-2 border rounded-lg bg-input text-foreground ${
 errors.targetUrl
 ? 'border-destructive focus:ring-destructive'
 : 'border-border focus:ring-primary'
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
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground resize-none"
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
 ? 'border-success bg-success/5'
 : 'border-border hover:border-border'
 }`}
 >
 <span className={`text-2xl font-bold ${
 config.wcagLevel === level.value
 ? 'text-success'
 : 'text-muted-foreground'
 }`}>
 {level.value}
 </span>
 <span className="text-xs font-medium text-foreground mt-1">
 {level.label}
 </span>
 <span className="text-xs text-muted-foreground">
 {level.description}
 </span>
 </button>
 ))}
 </div>
 </FormField>

 {/* Fail Thresholds by Severity */}
 <div className="p-4 bg-muted rounded-lg">
 <h4 className="text-sm font-medium text-foreground mb-3">
 Fail Thresholds by Severity
 </h4>
 <p className="text-xs text-muted-foreground mb-4">
 Test fails if issues exceed these thresholds. Set to 0 for zero tolerance.
 </p>

 <div className="space-y-3">
 {SEVERITY_CONFIG.map((severity) => (
 <div
 key={severity.key}
 className="flex items-center gap-4"
 >
 <div className={`w-3 h-3 rounded-full ${
 severity.color === 'red' ? 'bg-destructive' :
 severity.color === 'orange' ? 'bg-warning' :
 severity.color === 'yellow' ? 'bg-warning' :
 'bg-primary'
 }`} />
 <div className="flex-1">
 <span className="text-sm font-medium text-foreground">
 {severity.label}
 </span>
 <span className="text-xs text-muted-foreground ml-2">
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
 className="w-20 px-2 py-1 text-sm border border-border rounded bg-input text-foreground text-center"
 />
 <span className="text-xs text-muted-foreground">max issues</span>
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
 className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted"
 >
 Strict (Zero Tolerance)
 </button>
 <button
 type="button"
 onClick={() => {
 updateField('thresholds', { critical: 0, serious: 0, moderate: 5, minor: 10 });
 }}
 className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted"
 >
 Standard
 </button>
 <button
 type="button"
 onClick={() => {
 updateField('thresholds', { critical: 0, serious: 5, moderate: 20, minor: 50 });
 }}
 className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted"
 >
 Lenient
 </button>
 </div>

 {/* Advanced Settings */}
 <div className="border border-border rounded-lg overflow-hidden">
 <button
 type="button"
 onClick={() => setShowAdvanced(!showAdvanced)}
 className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted transition-colors"
 >
 <span className="text-sm font-medium text-foreground">
 Advanced Settings
 </span>
 <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
 </button>

 {showAdvanced && (
 <div className="p-4 border-t border-border space-y-4">
 {/* Wait for Selector */}
 <FormField label="Wait for Selector" hint="Wait for this element before running audit">
 <input
 type="text"
 value={config.waitForSelector}
 onChange={(e) => updateField('waitForSelector', e.target.value)}
 placeholder="[data-loaded='true'], .content-ready"
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
 />
 </FormField>

 {/* Include Iframes */}
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={config.includeIframes}
 onChange={(e) => updateField('includeIframes', e.target.checked)}
 className="w-4 h-4 text-success rounded focus:ring-success"
 />
 <span className="text-sm text-foreground">
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
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
 />
 </FormField>
 </div>
 )}
 </div>

 {/* Validation Summary */}
 {Object.keys(errors).length > 0 && (
 <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
 <p className="text-sm text-destructive">
 Please fix the errors above to continue.
 </p>
 </div>
 )}
 </div>
 );
};

export default AccessibilityConfig;
