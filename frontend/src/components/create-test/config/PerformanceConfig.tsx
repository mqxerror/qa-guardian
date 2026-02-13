/**
 * PerformanceConfig Component
 * Feature #1812: Performance (Lighthouse) Test Configuration Form
 *
 * Provides form fields specific to Performance/Lighthouse tests:
 * - Target URL
 * - Device preset (desktop/mobile)
 * - Performance threshold
 * - LCP threshold
 * - CLS threshold
 * - FID threshold
 */

import React, { useState, useCallback, memo } from 'react';

/**
 * Device preset options
 */
export type DevicePreset = 'desktop' | 'mobile';

/**
 * Performance test configuration state
 */
export interface PerformanceConfigState {
 name: string;
 description: string;
 targetUrl: string;
 devicePreset: DevicePreset;
 performanceThreshold: number;
 lcpThreshold: number; // Largest Contentful Paint in ms
 clsThreshold: number; // Cumulative Layout Shift
 fidThreshold: number; // First Input Delay in ms
 ttiThreshold: number; // Time to Interactive in ms
 categories: {
 performance: boolean;
 accessibility: boolean;
 bestPractices: boolean;
 seo: boolean;
 };
}

/**
 * Props for PerformanceConfig
 */
export interface PerformanceConfigProps {
 /** Initial configuration values */
 initialValues?: Partial<PerformanceConfigState>;
 /** Called when configuration changes */
 onChange?: (config: PerformanceConfigState) => void;
 /** Called when form validation state changes */
 onValidationChange?: (isValid: boolean) => void;
 /** Project base URL for smart defaults */
 projectBaseUrl?: string;
 /** CSS class name */
 className?: string;
}

/**
 * Default configuration values (based on Google's recommended thresholds)
 */
const DEFAULT_CONFIG: PerformanceConfigState = {
 name: '',
 description: '',
 targetUrl: '',
 devicePreset: 'desktop',
 performanceThreshold: 50,
 lcpThreshold: 2500, // Good: <2.5s
 clsThreshold: 0.1, // Good: <0.1
 fidThreshold: 100, // Good: <100ms
 ttiThreshold: 3800, // Good: <3.8s
 categories: {
 performance: true,
 accessibility: true,
 bestPractices: true,
 seo: true,
 },
};

/**
 * Device preset configurations
 */
const DEVICE_PRESETS: { value: DevicePreset; label: string; description: string; icon: string }[] = [
 {
 value: 'desktop',
 label: 'Desktop',
 description: 'Emulates a desktop browser on a fast network',
 icon: '🖥️',
 },
 {
 value: 'mobile',
 label: 'Mobile',
 description: 'Emulates a mobile device on a 4G network',
 icon: '📱',
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
 * Threshold indicator component
 * Feature #622: React.memo for performance optimization
 */
interface ThresholdIndicatorProps {
 value: number;
 goodMax: number;
 poorMin: number;
 unit?: string;
}

const ThresholdIndicator = memo<ThresholdIndicatorProps>(function ThresholdIndicator({ value, goodMax, poorMin, unit = '' }) {
 const level = value <= goodMax ? 'good' : value >= poorMin ? 'poor' : 'needs-improvement';
 const colors = {
   good: 'bg-success',
   'needs-improvement': 'bg-warning',
   poor: 'bg-destructive',
 };
 const labels = {
   good: 'Good',
   'needs-improvement': 'Needs Improvement',
   poor: 'Poor',
 };

 return (
   <div className="flex items-center gap-2 mt-1">
     <div className={`w-2 h-2 rounded-full ${colors[level]}`} />
     <span className={`text-xs ${
       level === 'good' ? 'text-success' :
       level === 'poor' ? 'text-destructive' :
       'text-warning'
     }`}>
       {labels[level]} ({value}{unit})
     </span>
   </div>
 );
});
ThresholdIndicator.displayName = 'ThresholdIndicator';

/**
 * PerformanceConfig - Configuration form for Lighthouse/Performance tests
 */
export const PerformanceConfig: React.FC<PerformanceConfigProps> = ({
 initialValues,
 onChange,
 onValidationChange,
 projectBaseUrl,
 className = '',
}) => {
 const [config, setConfig] = useState<PerformanceConfigState>({
 ...DEFAULT_CONFIG,
 targetUrl: projectBaseUrl || '',
 ...initialValues,
 });

 const [errors, setErrors] = useState<Partial<Record<keyof PerformanceConfigState, string>>>({});

 // Validate required fields
 const validate = useCallback((values: PerformanceConfigState): boolean => {
 const newErrors: Partial<Record<keyof PerformanceConfigState, string>> = {};

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
 const updateField = useCallback(<K extends keyof PerformanceConfigState>(
 field: K,
 value: PerformanceConfigState[K]
 ) => {
 setConfig(prev => {
 const newConfig = { ...prev, [field]: value };
 validate(newConfig);
 onChange?.(newConfig);
 return newConfig;
 });
 }, [onChange, validate]);

 // Toggle category
 const toggleCategory = useCallback((category: keyof PerformanceConfigState['categories']) => {
 setConfig(prev => {
 const newCategories = { ...prev.categories, [category]: !prev.categories[category] };
 const newConfig = { ...prev, categories: newCategories };
 onChange?.(newConfig);
 return newConfig;
 });
 }, [onChange]);

 return (
 <div className={`performance-config space-y-4 ${className}`}>
 {/* Test Name */}
 <FormField label="Test Name" required error={errors.name}>
 <input
 type="text"
 value={config.name}
 onChange={(e) => updateField('name', e.target.value)}
 placeholder="Performance Audit - Homepage"
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
 placeholder="Describe what this performance test measures..."
 rows={2}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground resize-none"
 />
 </FormField>

 {/* Device Preset */}
 <FormField label="Device Preset">
 <div className="grid grid-cols-2 gap-3">
 {DEVICE_PRESETS.map((preset) => (
 <button
 key={preset.value}
 type="button"
 onClick={() => updateField('devicePreset', preset.value)}
 className={`flex items-center gap-3 p-4 rounded-lg border text-left transition-colors ${
 config.devicePreset === preset.value
 ? 'border-warning bg-warning/5'
 : 'border-border hover:border-border'
 }`}
 >
 <span className="text-2xl">{preset.icon}</span>
 <div>
 <span className="font-medium text-sm text-foreground block">
 {preset.label}
 </span>
 <span className="text-xs text-muted-foreground">
 {preset.description}
 </span>
 </div>
 </button>
 ))}
 </div>
 </FormField>

 {/* Performance Threshold */}
 <FormField
 label={`Performance Score Threshold: ${config.performanceThreshold}`}
 hint="Minimum Lighthouse performance score (0-100) for test to pass"
 >
 <div className="flex items-center gap-4">
 <input
 type="range"
 value={config.performanceThreshold}
 onChange={(e) => updateField('performanceThreshold', parseInt(e.target.value))}
 min={0}
 max={100}
 step={5}
 className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-amber-600"
 />
 <span className="w-12 text-right text-sm font-medium text-foreground">
 {config.performanceThreshold}
 </span>
 </div>
 <div className="flex justify-between text-xs text-muted-foreground mt-1">
 <span>0 (Any)</span>
 <span className="text-destructive">49</span>
 <span className="text-warning">89</span>
 <span className="text-success">100</span>
 </div>
 </FormField>

 {/* Core Web Vitals */}
 <div className="p-4 bg-muted rounded-lg">
 <h4 className="text-sm font-medium text-foreground mb-3">
 Core Web Vitals Thresholds
 </h4>
 <div className="grid grid-cols-2 gap-4">
 {/* LCP */}
 <FormField label="LCP Threshold (ms)" hint="Largest Contentful Paint">
 <input
 type="number"
 value={config.lcpThreshold}
 onChange={(e) => updateField('lcpThreshold', parseInt(e.target.value) || 2500)}
 min={0}
 max={10000}
 step={100}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 <ThresholdIndicator value={config.lcpThreshold} goodMax={2500} poorMin={4000} unit="ms" />
 </FormField>

 {/* CLS */}
 <FormField label="CLS Threshold" hint="Cumulative Layout Shift">
 <input
 type="number"
 value={config.clsThreshold}
 onChange={(e) => updateField('clsThreshold', parseFloat(e.target.value) || 0.1)}
 min={0}
 max={1}
 step={0.01}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 <ThresholdIndicator value={config.clsThreshold} goodMax={0.1} poorMin={0.25} />
 </FormField>

 {/* FID */}
 <FormField label="FID Threshold (ms)" hint="First Input Delay">
 <input
 type="number"
 value={config.fidThreshold}
 onChange={(e) => updateField('fidThreshold', parseInt(e.target.value) || 100)}
 min={0}
 max={500}
 step={10}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 <ThresholdIndicator value={config.fidThreshold} goodMax={100} poorMin={300} unit="ms" />
 </FormField>

 {/* TTI */}
 <FormField label="TTI Threshold (ms)" hint="Time to Interactive">
 <input
 type="number"
 value={config.ttiThreshold}
 onChange={(e) => updateField('ttiThreshold', parseInt(e.target.value) || 3800)}
 min={0}
 max={15000}
 step={100}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 <ThresholdIndicator value={config.ttiThreshold} goodMax={3800} poorMin={7300} unit="ms" />
 </FormField>
 </div>
 </div>

 {/* Audit Categories */}
 <FormField label="Lighthouse Categories" hint="Select which categories to audit">
 <div className="grid grid-cols-2 gap-2">
 {[
 { key: 'performance', label: 'Performance', icon: '⚡' },
 { key: 'accessibility', label: 'Accessibility', icon: '♿' },
 { key: 'bestPractices', label: 'Best Practices', icon: '✅' },
 { key: 'seo', label: 'SEO', icon: '🔍' },
 ].map(({ key, label, icon }) => (
 <label
 key={key}
 className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
 config.categories[key as keyof typeof config.categories]
 ? 'border-warning bg-warning/5'
 : 'border-border'
 }`}
 >
 <input
 type="checkbox"
 checked={config.categories[key as keyof typeof config.categories]}
 onChange={() => toggleCategory(key as keyof typeof config.categories)}
 className="w-4 h-4 text-warning rounded focus:ring-warning"
 />
 <span className="text-lg">{icon}</span>
 <span className="text-sm font-medium text-foreground">
 {label}
 </span>
 </label>
 ))}
 </div>
 </FormField>

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

export default PerformanceConfig;
