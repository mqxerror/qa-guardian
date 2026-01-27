/**
 * VisualConfig Component
 * Feature #1811: Visual Regression Test Configuration Form
 *
 * Provides form fields specific to Visual Regression tests:
 * - Target URL
 * - Viewport presets (desktop/tablet/mobile checkboxes)
 * - Capture mode (full_page, viewport, element)
 * - Diff threshold slider
 */

import React, { useState, useCallback } from 'react';

/**
 * Viewport configuration
 */
export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  enabled: boolean;
  // Feature #1922: Orientation support for mobile/tablet
  orientation?: 'portrait' | 'landscape';
  baseWidth?: number; // Original width before orientation swap
  baseHeight?: number; // Original height before orientation swap
}

/**
 * Capture mode options
 */
export type CaptureMode = 'full_page' | 'viewport' | 'element';

/**
 * Visual test configuration state
 */
export interface VisualConfigState {
  name: string;
  description: string;
  targetUrl: string;
  viewports: ViewportConfig[];
  captureMode: CaptureMode;
  elementSelector: string;
  diffThreshold: number;
  hideSelectors: string[];
  waitForSelector: string;
  delay: number;
}

/**
 * Props for VisualConfig
 */
export interface VisualConfigProps {
  /** Initial configuration values */
  initialValues?: Partial<VisualConfigState>;
  /** Called when configuration changes */
  onChange?: (config: VisualConfigState) => void;
  /** Called when form validation state changes */
  onValidationChange?: (isValid: boolean) => void;
  /** Project base URL for smart defaults */
  projectBaseUrl?: string;
  /** CSS class name */
  className?: string;
}

/**
 * Feature #1920: Extended device presets with real device dimensions
 */
const DEVICE_PRESETS: Array<ViewportConfig & { icon: string; category: 'mobile' | 'tablet' | 'desktop' }> = [
  // Mobile devices
  { name: 'iPhone 14', width: 390, height: 844, enabled: false, icon: '📱', category: 'mobile' },
  { name: 'iPhone SE', width: 375, height: 667, enabled: false, icon: '📱', category: 'mobile' },
  { name: 'Pixel 7', width: 412, height: 915, enabled: false, icon: '📱', category: 'mobile' },
  { name: 'Galaxy S21', width: 360, height: 800, enabled: false, icon: '📱', category: 'mobile' },
  // Tablet devices
  { name: 'iPad', width: 768, height: 1024, enabled: false, icon: '📟', category: 'tablet' },
  { name: 'iPad Pro', width: 1024, height: 1366, enabled: false, icon: '📟', category: 'tablet' },
  // Desktop devices
  { name: 'MacBook 13"', width: 1440, height: 900, enabled: false, icon: '💻', category: 'desktop' },
  { name: 'Desktop HD', width: 1920, height: 1080, enabled: true, icon: '🖥️', category: 'desktop' },
  { name: 'Desktop 4K', width: 3840, height: 2160, enabled: false, icon: '🖥️', category: 'desktop' },
];

/**
 * Default viewport presets (backwards compatible)
 */
const DEFAULT_VIEWPORTS: ViewportConfig[] = DEVICE_PRESETS.map(({ icon, category, ...vp }) => vp);

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: VisualConfigState = {
  name: '',
  description: '',
  targetUrl: '',
  viewports: DEFAULT_VIEWPORTS,
  captureMode: 'full_page',
  elementSelector: '',
  diffThreshold: 0.1,
  hideSelectors: [],
  waitForSelector: '',
  delay: 0,
};

/**
 * Capture mode options
 */
const CAPTURE_MODES: { value: CaptureMode; label: string; description: string }[] = [
  { value: 'full_page', label: 'Full Page', description: 'Capture the entire scrollable page' },
  { value: 'viewport', label: 'Viewport Only', description: 'Capture only the visible viewport' },
  { value: 'element', label: 'Specific Element', description: 'Capture a specific DOM element' },
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Feature #1921: Custom viewport state
  const [showCustomViewport, setShowCustomViewport] = useState(false);
  const [customViewportName, setCustomViewportName] = useState('');
  const [customViewportWidth, setCustomViewportWidth] = useState(1280);
  const [customViewportHeight, setCustomViewportHeight] = useState(720);

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
    return config.viewports.filter((v, i) => {
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
      const newViewports = prev.viewports.map((v, i) => {
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

  // Update viewport dimensions
  const updateViewportDimension = useCallback((
    index: number,
    dimension: 'width' | 'height',
    value: number
  ) => {
    setConfig(prev => {
      const newViewports = prev.viewports.map((v, i) =>
        i === index ? { ...v, [dimension]: value } : v
      );
      const newConfig = { ...prev, viewports: newViewports };
      onChange?.(newConfig);
      return newConfig;
    });
  }, [onChange]);

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

  return (
    <div className={`visual-config space-y-4 ${className}`}>
      {/* Test Name */}
      <FormField label="Test Name" required error={errors.name}>
        <input
          type="text"
          value={config.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Visual Test - Homepage"
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
          placeholder="Describe what this visual test verifies..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
        />
      </FormField>

      {/* Feature #1920: Device presets with Select All/Clear All */}
      <FormField label="Device Viewports" required error={errors.viewports as string}>
        {/* Header with selection controls */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">
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
              className="text-xs px-2 py-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
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
              className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Grouped device presets */}
        <div className="space-y-4">
          {/* Mobile */}
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory('mobile')}
              className="w-full flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{expandedCategories.mobile ? '▼' : '▶'}</span>
                <span className="text-sm">📱</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mobile</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({getCategoryCount('mobile')}/{getCategoryTotal('mobile')})
                </span>
              </div>
              <label
                className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={getCategoryCount('mobile') === getCategoryTotal('mobile')}
                  onChange={(e) => toggleCategoryAll('mobile', e.target.checked)}
                  className="w-3 h-3 text-purple-600 rounded focus:ring-purple-500"
                />
                All
              </label>
            </button>
            {expandedCategories.mobile && (
              <div className="grid grid-cols-2 gap-2 p-2">
                {config.viewports.map((viewport, index) => {
                  const preset = DEVICE_PRESETS.find(d => d.name === viewport.name);
                  if (preset?.category !== 'mobile') return null;
                  return (
                    <label
                      key={viewport.name}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        viewport.enabled
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={viewport.enabled}
                        onChange={() => toggleViewport(index)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {viewport.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          {viewport.width}×{viewport.height}
                          {viewport.enabled && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleOrientation(index);
                              }}
                              className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title={`Switch to ${viewport.orientation === 'landscape' ? 'portrait' : 'landscape'}`}
                            >
                              {viewport.orientation === 'landscape' ? '↔️' : '↕️'}
                            </button>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tablet */}
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory('tablet')}
              className="w-full flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{expandedCategories.tablet ? '▼' : '▶'}</span>
                <span className="text-sm">📟</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tablet</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({getCategoryCount('tablet')}/{getCategoryTotal('tablet')})
                </span>
              </div>
              <label
                className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={getCategoryCount('tablet') === getCategoryTotal('tablet')}
                  onChange={(e) => toggleCategoryAll('tablet', e.target.checked)}
                  className="w-3 h-3 text-purple-600 rounded focus:ring-purple-500"
                />
                All
              </label>
            </button>
            {expandedCategories.tablet && (
              <div className="grid grid-cols-2 gap-2 p-2">
                {config.viewports.map((viewport, index) => {
                  const preset = DEVICE_PRESETS.find(d => d.name === viewport.name);
                  if (preset?.category !== 'tablet') return null;
                  return (
                    <label
                      key={viewport.name}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        viewport.enabled
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={viewport.enabled}
                        onChange={() => toggleViewport(index)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {viewport.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          {viewport.width}×{viewport.height}
                          {viewport.enabled && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleOrientation(index);
                              }}
                              className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title={`Switch to ${viewport.orientation === 'landscape' ? 'portrait' : 'landscape'}`}
                            >
                              {viewport.orientation === 'landscape' ? '↔️' : '↕️'}
                            </button>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop */}
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory('desktop')}
              className="w-full flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{expandedCategories.desktop ? '▼' : '▶'}</span>
                <span className="text-sm">🖥️</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Desktop</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({getCategoryCount('desktop')}/{getCategoryTotal('desktop')})
                </span>
              </div>
              <label
                className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={getCategoryCount('desktop') === getCategoryTotal('desktop')}
                  onChange={(e) => toggleCategoryAll('desktop', e.target.checked)}
                  className="w-3 h-3 text-purple-600 rounded focus:ring-purple-500"
                />
                All
              </label>
            </button>
            {expandedCategories.desktop && (
              <div className="grid grid-cols-2 gap-2 p-2">
                {config.viewports.map((viewport, index) => {
                  const preset = DEVICE_PRESETS.find(d => d.name === viewport.name);
                  if (preset?.category !== 'desktop') return null;
                  return (
                    <label
                      key={viewport.name}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        viewport.enabled
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={viewport.enabled}
                        onChange={() => toggleViewport(index)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {viewport.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {viewport.width}×{viewport.height}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Feature #1921: Custom Viewport */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
            {!showCustomViewport ? (
              <button
                type="button"
                onClick={() => setShowCustomViewport(true)}
                className="w-full py-2 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center justify-center gap-2"
              >
                <span>+</span> Add Custom Viewport
              </button>
            ) : (
              <div className="p-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom Viewport</span>
                  <button
                    type="button"
                    onClick={() => setShowCustomViewport(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  value={customViewportName}
                  onChange={(e) => setCustomViewportName(e.target.value)}
                  placeholder="Viewport name (e.g., Our Kiosk Display)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={customViewportWidth}
                    onChange={(e) => setCustomViewportWidth(Math.min(3840, Math.max(320, parseInt(e.target.value) || 320)))}
                    min={320}
                    max={3840}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Width"
                  />
                  <span className="text-gray-400">×</span>
                  <input
                    type="number"
                    value={customViewportHeight}
                    onChange={(e) => setCustomViewportHeight(Math.min(2160, Math.max(240, parseInt(e.target.value) || 240)))}
                    min={240}
                    max={2160}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Height"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const name = customViewportName.trim() || `Custom ${customViewportWidth}×${customViewportHeight}`;
                    setConfig(prev => {
                      const newConfig = {
                        ...prev,
                        viewports: [
                          ...prev.viewports,
                          { name, width: customViewportWidth, height: customViewportHeight, enabled: true }
                        ]
                      };
                      onChange?.(newConfig);
                      return newConfig;
                    });
                    // Reset form
                    setShowCustomViewport(false);
                    setCustomViewportName('');
                    setCustomViewportWidth(1280);
                    setCustomViewportHeight(720);
                  }}
                  className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  Add Viewport
                </button>
              </div>
            )}
          </div>

          {/* Display custom viewports that were added */}
          {config.viewports.filter(vp => !DEVICE_PRESETS.find(d => d.name === vp.name)).length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                <span>⚙️</span> Custom Viewports
              </div>
              <div className="grid grid-cols-2 gap-2">
                {config.viewports.map((viewport, index) => {
                  if (DEVICE_PRESETS.find(d => d.name === viewport.name)) return null;
                  return (
                    <div
                      key={viewport.name}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                        viewport.enabled
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={viewport.enabled}
                          onChange={() => toggleViewport(index)}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {viewport.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {viewport.width}×{viewport.height}
                          </div>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setConfig(prev => {
                            const newConfig = {
                              ...prev,
                              viewports: prev.viewports.filter((_, i) => i !== index)
                            };
                            onChange?.(newConfig);
                            return newConfig;
                          });
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove custom viewport"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <span className="font-medium text-sm text-gray-900 dark:text-white">
                {mode.label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
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
            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm ${
              errors.elementSelector
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
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
            className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
          <div className="flex items-center gap-1 min-w-[80px]">
            <input
              type="number"
              value={config.delay / 1000}
              onChange={(e) => updateField('delay', Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)) * 1000)}
              min={0}
              max={10}
              step={0.5}
              className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">sec</span>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0s (instant)</span>
          <span>10s (slow pages)</span>
        </div>
      </FormField>

      {/* Diff Threshold Slider - Feature #1964: Enhanced with strictness preview */}
      <FormField
        label={`Diff Threshold: ${Math.round(config.diffThreshold * 100)}%`}
        hint="Maximum allowed visual difference before test fails"
      >
        <div className="flex items-center gap-4">
          <input
            type="range"
            value={config.diffThreshold * 100}
            onChange={(e) => updateField('diffThreshold', parseInt(e.target.value) / 100)}
            min={0}
            max={100}
            step={1}
            className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
          <span className="w-12 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
            {Math.round(config.diffThreshold * 100)}%
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Strict</span>
          <span>Lenient</span>
        </div>
        {/* Feature #1964: Strictness Preview */}
        <div className="mt-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-lg ${
              config.diffThreshold <= 0.01 ? '🔒' :
              config.diffThreshold <= 0.05 ? '🎯' :
              config.diffThreshold <= 0.1 ? '✅' :
              config.diffThreshold <= 0.2 ? '⚡' : '🔓'
            }`}>
              {config.diffThreshold <= 0.01 ? '🔒' :
               config.diffThreshold <= 0.05 ? '🎯' :
               config.diffThreshold <= 0.1 ? '✅' :
               config.diffThreshold <= 0.2 ? '⚡' : '🔓'}
            </span>
            <span className={`text-sm font-medium ${
              config.diffThreshold <= 0.01 ? 'text-red-600 dark:text-red-400' :
              config.diffThreshold <= 0.05 ? 'text-orange-600 dark:text-orange-400' :
              config.diffThreshold <= 0.1 ? 'text-green-600 dark:text-green-400' :
              config.diffThreshold <= 0.2 ? 'text-blue-600 dark:text-blue-400' :
              'text-gray-600 dark:text-gray-400'
            }`}>
              {config.diffThreshold <= 0.01 ? 'Pixel Perfect' :
               config.diffThreshold <= 0.05 ? 'Very Strict' :
               config.diffThreshold <= 0.1 ? 'Balanced (Recommended)' :
               config.diffThreshold <= 0.2 ? 'Lenient' : 'Very Lenient'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {config.diffThreshold <= 0.01 ? 'Catches every minor change. Best for static content with no animations.' :
             config.diffThreshold <= 0.05 ? 'Catches most changes while allowing minor anti-aliasing differences.' :
             config.diffThreshold <= 0.1 ? 'Good balance between catching real issues and ignoring rendering differences.' :
             config.diffThreshold <= 0.2 ? 'More forgiving. Good for pages with subtle animations or dynamic content.' :
             'Only catches major visual changes. Use for highly dynamic pages.'}
          </p>
        </div>
      </FormField>

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
            <FormField label="Wait for Selector" hint="Wait for this element before capturing">
              <input
                type="text"
                value={config.waitForSelector}
                onChange={(e) => updateField('waitForSelector', e.target.value)}
                placeholder="[data-loaded='true'], .content-ready"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
            </FormField>

            {/* Delay */}
            <FormField label="Delay (ms)" hint="Additional wait time before capture">
              <input
                type="number"
                value={config.delay}
                onChange={(e) => updateField('delay', parseInt(e.target.value) || 0)}
                min={0}
                max={10000}
                step={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </FormField>

            {/* Hide Selectors */}
            <FormField label="Hide Elements" hint="CSS selectors of elements to hide before capture">
              <input
                type="text"
                defaultValue={config.hideSelectors.join(', ')}
                onChange={(e) => {
                  const selectors = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateField('hideSelectors', selectors);
                }}
                placeholder=".ad-banner, .cookie-popup, [data-dynamic]"
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

export default VisualConfig;
