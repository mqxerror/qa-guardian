// Feature #104: Split VisualConfig.tsx into logical modules
// Types and interfaces extracted from VisualConfig.tsx

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
 * Device preset with category and icon
 */
export interface DevicePreset extends ViewportConfig {
  icon: string;
  category: 'mobile' | 'tablet' | 'desktop';
}

/**
 * Capture mode option for UI display
 */
export interface CaptureModeOption {
  value: CaptureMode;
  label: string;
  description: string;
}
