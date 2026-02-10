// Feature #104: Split VisualConfig.tsx into logical modules
// Barrel file for visual-config components

// Types
export type {
  ViewportConfig,
  CaptureMode,
  VisualConfigState,
  VisualConfigProps,
  DevicePreset,
  CaptureModeOption,
  IgnoreRegion,
  AntiAliasingTolerance,
} from './types';

// Constants
export {
  DEVICE_PRESETS,
  DEFAULT_VIEWPORTS,
  DEFAULT_CONFIG,
  CAPTURE_MODES,
  ANTI_ALIASING_OPTIONS,
} from './constants';

// Components
export { FormField } from './FormField';
export { DeviceCategoryPanel } from './DeviceCategoryPanel';
export { CustomViewportPanel } from './CustomViewportPanel';
export { DiffThresholdSlider } from './DiffThresholdSlider';
export { AdvancedSettingsPanel } from './AdvancedSettingsPanel';
