/**
 * VisualConfig Component
 * Feature #1811: Visual Regression Test Configuration Form
 * Feature #104: Refactored - extracted sub-components to visual-config/
 *
 * Provides form fields specific to Visual Regression tests:
 * - Target URL
 * - Viewport presets (desktop/tablet/mobile checkboxes)
 * - Capture mode (full_page, viewport, element)
 * - Diff threshold slider
 */

import React, { useState, useCallback } from 'react';

// Import types
import type {
 ViewportConfig,
 CaptureMode,
 VisualConfigState,
 VisualConfigProps,
} from './visual-config';

// Import constants
import {
 DEVICE_PRESETS,
 DEFAULT_CONFIG,
 CAPTURE_MODES,
} from './visual-config';

// Import components
import {
 FormField,
 DeviceCategoryPanel,
 CustomViewportPanel,
 DiffThresholdSlider,
 AdvancedSettingsPanel,
} from './visual-config';

// Re-export types for backwards compatibility
export type { ViewportConfig, CaptureMode, VisualConfigState, VisualConfigProps };

/**
 * VisualConfig - Configuration form for Visual Regression tests
 */
export const VisualConfig: React.FC<VisualConfigProps> = ({
 initialValues,
 onChange,
 onValidationChange,
 projectBaseUrl,
 className = '',
}) => {
 const [config, setConfig] = useState<VisualConfigState>({
 ...DEFAULT_CONFIG,
 targetUrl: projectBaseUrl || '',
 ...initialValues,
 });

 const [errors, setErrors] = useState<Partial<Record<keyof VisualConfigState, string>>>({});

 // Feature #1923: Category expand/collapse state
 const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
 mobile: true,
 tablet: true,
 desktop: true,
 });

 // Feature #1923: Toggle category expand/collapse
 const toggleCategory = useCallback((category: string) => {
 setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
 }, []);

 // Feature #1923: Get selected count per category
 const getCategoryCount = useCallback((category: 'mobile' | 'tablet' | 'desktop') => {
 return config.viewports.filter((v) => {
 const preset = DEVICE_PRESETS.find(d => d.name === v.name);
 return preset?.category === category && v.enabled;
 }).length;
 }, [config.viewports]);

 // Feature #1923: Get total count per category
 const getCategoryTotal = useCallback((category: 'mobile' | 'tablet' | 'desktop') => {
 return DEVICE_PRESETS.filter(d => d.category === category).length;
 }, []);

 // Feature #1923: Toggle all in category
 const toggleCategoryAll = useCallback((category: 'mobile' | 'tablet' | 'desktop', enable: boolean) => {
 setConfig(prev => {
 const newViewports = prev.viewports.map((v) => {
 const preset = DEVICE_PRESETS.find(d => d.name === v.name);
 if (preset?.category === category) {
 return { ...v, enabled: enable };
 }
 return v;
 });
 const newConfig = { ...prev, viewports: newViewports };
 onChange?.(newConfig);
 return newConfig;
 });
 }, [onChange]);

 // Validate required fields
 const validate = useCallback((values: VisualConfigState): boolean => {
 const newErrors: Partial<Record<keyof VisualConfigState, string>> = {};

 if (!values.name.trim()) {
 newErrors.name = 'Test name is required';
 }

 if (!values.targetUrl.trim()) {
 newErrors.targetUrl = 'Target URL is required';
 } else if (!/^https?:\/\/.+/.test(values.targetUrl)) {
 newErrors.targetUrl = 'Please enter a valid URL';
 }

 if (!values.viewports.some(v => v.enabled)) {
 newErrors.viewports = 'At least one viewport must be selected';
 }

 if (values.captureMode === 'element' && !values.elementSelector.trim()) {
 newErrors.elementSelector = 'Element selector is required for element capture mode';
 }

 setErrors(newErrors);
 const isValid = Object.keys(newErrors).length === 0;
 onValidationChange?.(isValid);
 return isValid;
 }, [onValidationChange]);

 // Update field
 const updateField = useCallback(<K extends keyof VisualConfigState>(
 field: K,
 value: VisualConfigState[K]
 ) => {
 setConfig(prev => {
 const newConfig = { ...prev, [field]: value };
 validate(newConfig);
 onChange?.(newConfig);
 return newConfig;
 });
 }, [onChange, validate]);

 // Toggle viewport
 const toggleViewport = useCallback((index: number) => {
 setConfig(prev => {
 const newViewports = prev.viewports.map((v, i) =>
 i === index ? { ...v, enabled: !v.enabled } : v
 );
 const newConfig = { ...prev, viewports: newViewports };
 validate(newConfig);
 onChange?.(newConfig);
 return newConfig;
 });
 }, [onChange, validate]);

 // Feature #1922: Toggle device orientation (portrait/landscape)
 const toggleOrientation = useCallback((index: number) => {
 setConfig(prev => {
 const newViewports = prev.viewports.map((v, i) => {
 if (i !== index) return v;
 const preset = DEVICE_PRESETS.find(d => d.name === v.name);
 if (!preset || preset.category === 'desktop') return v; // Only mobile/tablet

 const isPortrait = !v.orientation || v.orientation === 'portrait';
 const baseW = v.baseWidth || preset.width;
 const baseH = v.baseHeight || preset.height;

 return {
 ...v,
 width: isPortrait ? baseH : baseW, // Swap for landscape
 height: isPortrait ? baseW : baseH,
 orientation: isPortrait ? 'landscape' as const : 'portrait' as const,
 baseWidth: baseW,
 baseHeight: baseH,
 };
 });
 const newConfig = { ...prev, viewports: newViewports };
 onChange?.(newConfig);
 return newConfig;
 });
 }, [onChange]);

 // Add custom viewport
 const handleAddViewport = useCallback((viewport: ViewportConfig) => {
 setConfig(prev => {
 const newConfig = {
 ...prev,
 viewports: [...prev.viewports, viewport]
 };
 onChange?.(newConfig);
 return newConfig;
 });
 }, [onChange]);

 // Remove custom viewport
 const handleRemoveViewport = useCallback((index: number) => {
 setConfig(prev => {
 const newConfig = {
 ...prev,
 viewports: prev.viewports.filter((_, i) => i !== index)
 };
 onChange?.(newConfig);
 return newConfig;
 });
 }, [onChange]);

 return (
 <div className={`visual-config space-y-4 ${className}`}>
 {/* Test Name */}
 <FormField label="Test Name" required error={errors.name}>
 <input
 type="text"
 value={config.name}
 onChange={(e) => updateField('name', e.target.value)}
 placeholder="Visual Test - Homepage"
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
 placeholder="Describe what this visual test verifies..."
 rows={2}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground resize-none"
 />
 </FormField>

 {/* Feature #1920: Device presets with Select All/Clear All */}
 <FormField label="Device Viewports" required error={errors.viewports as string}>
 {/* Header with selection controls */}
 <div className="flex items-center justify-between mb-3">
 <span className="text-sm text-foreground">
 {config.viewports.filter(v => v.enabled).length} device{config.viewports.filter(v => v.enabled).length !== 1 ? 's' : ''} selected
 </span>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => {
 setConfig(prev => {
 const newConfig = {
 ...prev,
 viewports: prev.viewports.map(v => ({ ...v, enabled: true }))
 };
 onChange?.(newConfig);
 return newConfig;
 });
 }}
 className="text-xs px-2 py-1 text-accent hover:bg-accent/5 rounded transition-colors"
 >
 Select All
 </button>
 <button
 type="button"
 onClick={() => {
 setConfig(prev => {
 const newConfig = {
 ...prev,
 viewports: prev.viewports.map(v => ({ ...v, enabled: false }))
 };
 onChange?.(newConfig);
 return newConfig;
 });
 }}
 className="text-xs px-2 py-1 text-foreground hover:bg-muted rounded transition-colors"
 >
 Clear All
 </button>
 </div>
 </div>

 {/* Grouped device presets */}
 <div className="space-y-4">
 {/* Mobile */}
 <DeviceCategoryPanel
 category="mobile"
 categoryIcon="📱"
 categoryLabel="Mobile"
 viewports={config.viewports}
 expanded={expandedCategories.mobile}
 onToggleExpand={() => toggleCategory('mobile')}
 onToggleViewport={toggleViewport}
 onToggleOrientation={toggleOrientation}
 onToggleCategoryAll={(enable) => toggleCategoryAll('mobile', enable)}
 selectedCount={getCategoryCount('mobile')}
 totalCount={getCategoryTotal('mobile')}
 />

 {/* Tablet */}
 <DeviceCategoryPanel
 category="tablet"
 categoryIcon="📟"
 categoryLabel="Tablet"
 viewports={config.viewports}
 expanded={expandedCategories.tablet}
 onToggleExpand={() => toggleCategory('tablet')}
 onToggleViewport={toggleViewport}
 onToggleOrientation={toggleOrientation}
 onToggleCategoryAll={(enable) => toggleCategoryAll('tablet', enable)}
 selectedCount={getCategoryCount('tablet')}
 totalCount={getCategoryTotal('tablet')}
 />

 {/* Desktop */}
 <DeviceCategoryPanel
 category="desktop"
 categoryIcon="🖥️"
 categoryLabel="Desktop"
 viewports={config.viewports}
 expanded={expandedCategories.desktop}
 onToggleExpand={() => toggleCategory('desktop')}
 onToggleViewport={toggleViewport}
 onToggleOrientation={toggleOrientation}
 onToggleCategoryAll={(enable) => toggleCategoryAll('desktop', enable)}
 selectedCount={getCategoryCount('desktop')}
 totalCount={getCategoryTotal('desktop')}
 />

 {/* Custom Viewport Panel */}
 <CustomViewportPanel
 viewports={config.viewports}
 onAddViewport={handleAddViewport}
 onRemoveViewport={handleRemoveViewport}
 onToggleViewport={toggleViewport}
 />
 </div>
 </FormField>

 {/* Capture Mode */}
 <FormField label="Capture Mode">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
 {CAPTURE_MODES.map((mode) => (
 <button
 key={mode.value}
 type="button"
 onClick={() => updateField('captureMode', mode.value)}
 className={`flex flex-col items-start p-3 rounded-lg border text-left transition-colors ${
 config.captureMode === mode.value
 ? 'border-accent bg-accent/5'
 : 'border-border hover:border-border'
 }`}
 >
 <span className="font-medium text-sm text-foreground">
 {mode.label}
 </span>
 <span className="text-xs text-muted-foreground">
 {mode.description}
 </span>
 </button>
 ))}
 </div>
 </FormField>

 {/* Element Selector (shown when capture mode is element) */}
 {config.captureMode === 'element' && (
 <FormField label="Element Selector" required error={errors.elementSelector}>
 <input
 type="text"
 value={config.elementSelector}
 onChange={(e) => updateField('elementSelector', e.target.value)}
 placeholder="#header, .main-content, [data-testid='hero']"
 className={`w-full px-3 py-2 border rounded-lg bg-input text-foreground font-mono text-sm ${
 errors.elementSelector
 ? 'border-destructive focus:ring-destructive'
 : 'border-border focus:ring-primary'
 }`}
 />
 </FormField>
 )}

 {/* Feature #1964: Wait Time Input (prominent, in seconds) */}
 <FormField
 label="Wait Time"
 hint="Wait for dynamic content to load before capturing"
 >
 <div className="flex items-center gap-3">
 <input
 type="range"
 value={config.delay / 1000}
 onChange={(e) => updateField('delay', parseFloat(e.target.value) * 1000)}
 min={0}
 max={10}
 step={0.5}
 className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
 />
 <div className="flex items-center gap-1 min-w-[80px]">
 <input
 type="number"
 value={config.delay / 1000}
 onChange={(e) => updateField('delay', Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)) * 1000)}
 min={0}
 max={10}
 step={0.5}
 className="w-16 px-2 py-1 text-sm border border-border rounded bg-input text-foreground text-center"
 />
 <span className="text-sm text-muted-foreground">sec</span>
 </div>
 </div>
 <div className="flex justify-between text-xs text-muted-foreground mt-1">
 <span>0s (instant)</span>
 <span>10s (slow pages)</span>
 </div>
 </FormField>

 {/* Diff Threshold Slider */}
 <DiffThresholdSlider
 value={config.diffThreshold}
 onChange={(value) => updateField('diffThreshold', value)}
 />

 {/* Advanced Settings */}
 <AdvancedSettingsPanel
 waitForSelector={config.waitForSelector}
 delay={config.delay}
 hideSelectors={config.hideSelectors}
 onWaitForSelectorChange={(value) => updateField('waitForSelector', value)}
 onDelayChange={(value) => updateField('delay', value)}
 onHideSelectorsChange={(value) => updateField('hideSelectors', value)}
 />

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

export default VisualConfig;
