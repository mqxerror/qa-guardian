/**
 * Device Select Component (Feature #36 - Mobile Device Emulation)
 *
 * Dropdown component for selecting device emulation presets.
 * Groups devices by category: Desktop, Laptop, Tablet, Mobile
 */

import React from 'react';
import {
 DeviceEmulationPreset,
 DeviceConfig,
 DEVICE_PRESETS,
} from '../../test-modals/types';

interface DeviceSelectProps {
 value: DeviceConfig;
 onChange: (config: DeviceConfig) => void;
 disabled?: boolean;
 className?: string;
}

// Category icons and labels
const CATEGORY_CONFIG = {
 desktop: { icon: '🖥️', label: 'Desktop' },
 laptop: { icon: '💻', label: 'Laptop' },
 tablet: { icon: '📱', label: 'Tablet' },
 mobile: { icon: '📲', label: 'Mobile' },
};

/**
 * Get grouped device presets by category
 */
function getGroupedPresets() {
 const groups: Record<string, Array<{ key: DeviceEmulationPreset; info: typeof DEVICE_PRESETS[DeviceEmulationPreset] }>> = {
 desktop: [],
 laptop: [],
 tablet: [],
 mobile: [],
 };

 for (const [key, info] of Object.entries(DEVICE_PRESETS)) {
 if (key !== 'custom') {
 groups[info.category].push({ key: key as DeviceEmulationPreset, info });
 }
 }

 return groups;
}

export const DeviceSelect: React.FC<DeviceSelectProps> = ({
 value,
 onChange,
 disabled = false,
 className = '',
}) => {
 const groupedPresets = getGroupedPresets();
 const currentPreset = DEVICE_PRESETS[value.preset];

 const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
 const preset = e.target.value as DeviceEmulationPreset;
 onChange({
 ...value,
 preset,
 });
 };

 return (
 <div className={`device-select ${className}`}>
 <label className="block text-sm font-medium text-foreground mb-1">
 Device
 </label>
 <div className="relative">
 <select
 value={value.preset}
 onChange={handlePresetChange}
 disabled={disabled}
 className="block w-full pl-3 pr-10 py-2 text-base border-border focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
 >
 {Object.entries(CATEGORY_CONFIG).map(([category, config]) => (
 <optgroup key={category} label={`${config.icon} ${config.label}`}>
 {groupedPresets[category].map(({ key, info }) => (
 <option key={key} value={key}>
 {info.displayName} ({info.viewport.width}x{info.viewport.height})
 </option>
 ))}
 </optgroup>
 ))}
 <optgroup label="⚙️ Custom">
 <option value="custom">Custom Device</option>
 </optgroup>
 </select>
 </div>

 {/* Device info badges */}
 <div className="mt-2 flex flex-wrap gap-2">
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
 📐 {currentPreset.viewport.width}x{currentPreset.viewport.height}
 </span>
 {currentPreset.isMobile && (
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
 📱 Mobile
 </span>
 )}
 {currentPreset.hasTouch && (
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
 👆 Touch
 </span>
 )}
 {currentPreset.deviceScaleFactor > 1 && (
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
 @{currentPreset.deviceScaleFactor}x
 </span>
 )}
 </div>

 {/* Custom device settings */}
 {value.preset === 'custom' && (
 <div className="mt-3 p-3 bg-muted rounded-md space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-foreground mb-1">
 Width
 </label>
 <input
 type="number"
 min={320}
 max={3840}
 value={value.customViewport?.width || 1280}
 onChange={(e) => onChange({
 ...value,
 customViewport: {
 width: parseInt(e.target.value) || 1280,
 height: value.customViewport?.height || 720,
 },
 })}
 className="block w-full px-2 py-1 text-sm border-border rounded-md"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-foreground mb-1">
 Height
 </label>
 <input
 type="number"
 min={320}
 max={2160}
 value={value.customViewport?.height || 720}
 onChange={(e) => onChange({
 ...value,
 customViewport: {
 width: value.customViewport?.width || 1280,
 height: parseInt(e.target.value) || 720,
 },
 })}
 className="block w-full px-2 py-1 text-sm border-border rounded-md"
 />
 </div>
 </div>
 <div className="flex gap-4">
 <label className="inline-flex items-center">
 <input
 type="checkbox"
 checked={value.customIsMobile || false}
 onChange={(e) => onChange({
 ...value,
 customIsMobile: e.target.checked,
 })}
 className="rounded border-border text-primary focus:ring-primary"
 />
 <span className="ml-2 text-xs text-foreground">Mobile mode</span>
 </label>
 <label className="inline-flex items-center">
 <input
 type="checkbox"
 checked={value.customHasTouch || false}
 onChange={(e) => onChange({
 ...value,
 customHasTouch: e.target.checked,
 })}
 className="rounded border-border text-primary focus:ring-primary"
 />
 <span className="ml-2 text-xs text-foreground">Touch enabled</span>
 </label>
 </div>
 <div>
 <label className="block text-xs font-medium text-foreground mb-1">
 Device Scale Factor
 </label>
 <select
 value={value.customDeviceScaleFactor || 1}
 onChange={(e) => onChange({
 ...value,
 customDeviceScaleFactor: parseFloat(e.target.value),
 })}
 className="block w-full px-2 py-1 text-sm border-border rounded-md"
 >
 <option value={1}>1x (Standard)</option>
 <option value={1.5}>1.5x</option>
 <option value={2}>2x (Retina)</option>
 <option value={2.625}>2.625x (Pixel)</option>
 <option value={3}>3x (iPhone Pro)</option>
 </select>
 </div>
 </div>
 )}
 </div>
 );
};

export default DeviceSelect;
