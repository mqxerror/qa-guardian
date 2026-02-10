// Feature #104: Split VisualConfig.tsx into logical modules
// Feature #590: Added antiAliasingTolerance, ignoreRegions, ignoreSelectors, customCSS, clipSelector, colorThreshold
// Advanced settings panel component extracted from VisualConfig.tsx

import React, { useState } from 'react';
import { FormField } from './FormField';
import type { IgnoreRegion, AntiAliasingTolerance } from './types';
import { ANTI_ALIASING_OPTIONS } from './constants';

interface AdvancedSettingsPanelProps {
 waitForSelector: string;
 delay: number;
 hideSelectors: string[];
 onWaitForSelectorChange: (value: string) => void;
 onDelayChange: (value: number) => void;
 onHideSelectorsChange: (value: string[]) => void;
 // Feature #590: New visual regression options
 antiAliasingTolerance: AntiAliasingTolerance;
 ignoreRegions: IgnoreRegion[];
 ignoreSelectors: string[];
 customCSS: string;
 clipSelector: string;
 colorThreshold: number;
 onAntiAliasingToleranceChange: (value: AntiAliasingTolerance) => void;
 onIgnoreRegionsChange: (value: IgnoreRegion[]) => void;
 onIgnoreSelectorsChange: (value: string[]) => void;
 onCustomCSSChange: (value: string) => void;
 onClipSelectorChange: (value: string) => void;
 onColorThresholdChange: (value: number) => void;
}

/**
 * Collapsible advanced settings panel for visual test configuration
 */
export const AdvancedSettingsPanel: React.FC<AdvancedSettingsPanelProps> = ({
 waitForSelector,
 delay,
 hideSelectors,
 onWaitForSelectorChange,
 onDelayChange,
 onHideSelectorsChange,
 // Feature #590: New visual regression options
 antiAliasingTolerance,
 ignoreRegions,
 ignoreSelectors,
 customCSS,
 clipSelector,
 colorThreshold,
 onAntiAliasingToleranceChange,
 onIgnoreRegionsChange,
 onIgnoreSelectorsChange,
 onCustomCSSChange,
 onClipSelectorChange,
 onColorThresholdChange,
}) => {
 const [showAdvanced, setShowAdvanced] = useState(false);
 // Feature #590: Local state for new ignore region form
 const [newRegion, setNewRegion] = useState<IgnoreRegion>({ x: 0, y: 0, width: 100, height: 100 });

 const handleAddRegion = () => {
  if (newRegion.width > 0 && newRegion.height > 0) {
   onIgnoreRegionsChange([...ignoreRegions, { ...newRegion }]);
   setNewRegion({ x: 0, y: 0, width: 100, height: 100 });
  }
 };

 const handleRemoveRegion = (index: number) => {
  onIgnoreRegionsChange(ignoreRegions.filter((_, i) => i !== index));
 };

 return (
 <div className="border border-border rounded-lg overflow-hidden">
 <button
 type="button"
 onClick={() => setShowAdvanced(!showAdvanced)}
 className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted transition-colors"
 >
 <span className="text-sm font-medium text-foreground">
 Advanced Settings
 </span>
 <svg
 className={`w-5 h-5 text-muted-foreground transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>

 {showAdvanced && (
 <div className="p-4 border-t border-border space-y-4">
 {/* Wait for Selector */}
 <FormField label="Wait for Selector" hint="Wait for this element before capturing">
 <input
 type="text"
 value={waitForSelector}
 onChange={(e) => onWaitForSelectorChange(e.target.value)}
 placeholder="[data-loaded='true'], .content-ready"
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
 />
 </FormField>

 {/* Delay */}
 <FormField label="Delay (ms)" hint="Additional wait time before capture">
 <input
 type="number"
 value={delay}
 onChange={(e) => onDelayChange(parseInt(e.target.value) || 0)}
 min={0}
 max={10000}
 step={100}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 </FormField>

 {/* Hide Selectors */}
 <FormField label="Hide Elements" hint="CSS selectors of elements to hide before capture">
 <input
 type="text"
 defaultValue={hideSelectors.join(', ')}
 onChange={(e) => {
 const selectors = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
 onHideSelectorsChange(selectors);
 }}
 placeholder=".ad-banner, .cookie-popup, [data-dynamic]"
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
 />
 </FormField>

 {/* Feature #590: Divider */}
 <div className="border-t border-border pt-4">
  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
   Comparison Options
  </p>
 </div>

 {/* Feature #590: Anti-aliasing Tolerance Selector */}
 <FormField
  label="Anti-aliasing Tolerance"
  hint="Ignore differences caused by anti-aliasing rendering across platforms"
 >
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
   {ANTI_ALIASING_OPTIONS.map((option) => (
    <button
     key={option.value}
     type="button"
     onClick={() => onAntiAliasingToleranceChange(option.value)}
     className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors ${
      antiAliasingTolerance === option.value
       ? 'border-accent bg-accent/5'
       : 'border-border hover:border-border'
     }`}
    >
     <span className="font-medium text-sm text-foreground">
      {option.label}
     </span>
     <span className="text-xs text-muted-foreground line-clamp-2">
      {option.description}
     </span>
    </button>
   ))}
  </div>
 </FormField>

 {/* Feature #590: Color Threshold */}
 <FormField
  label={`Color Threshold: ${(colorThreshold * 100).toFixed(0)}%`}
  hint="Maximum color difference to consider pixels as matching (0 = exact match)"
 >
  <div className="flex items-center gap-3">
   <input
    type="range"
    value={colorThreshold * 100}
    onChange={(e) => onColorThresholdChange(parseInt(e.target.value) / 100)}
    min={0}
    max={50}
    step={1}
    className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
   />
   <div className="flex items-center gap-1 min-w-[60px]">
    <input
     type="number"
     value={Math.round(colorThreshold * 100)}
     onChange={(e) => onColorThresholdChange(Math.min(0.5, Math.max(0, (parseInt(e.target.value) || 0) / 100)))}
     min={0}
     max={50}
     className="w-14 px-2 py-1 text-sm border border-border rounded bg-input text-foreground text-center"
    />
    <span className="text-sm text-muted-foreground">%</span>
   </div>
  </div>
  <div className="flex justify-between text-xs text-muted-foreground mt-1">
   <span>0% (exact colors)</span>
   <span>50% (lenient)</span>
  </div>
 </FormField>

 {/* Feature #590: Ignore Regions */}
 <FormField
  label="Ignore Regions"
  hint="Define rectangular areas to exclude from visual comparison (e.g., ads, timestamps)"
 >
  {/* Existing regions */}
  {ignoreRegions.length > 0 && (
   <div className="space-y-2 mb-3">
    {ignoreRegions.map((region, index) => (
     <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border">
      <span className="text-xs font-mono text-foreground flex-1">
       Region {index + 1}: x={region.x}, y={region.y}, {region.width}×{region.height}
      </span>
      <button
       type="button"
       onClick={() => handleRemoveRegion(index)}
       className="text-destructive hover:text-destructive/80 p-1 rounded transition-colors"
       title="Remove region"
      >
       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
       </svg>
      </button>
     </div>
    ))}
   </div>
  )}

  {/* Add new region form */}
  <div className="grid grid-cols-4 gap-2">
   <div>
    <label className="block text-xs text-muted-foreground mb-1">X</label>
    <input
     type="number"
     value={newRegion.x}
     onChange={(e) => setNewRegion(prev => ({ ...prev, x: parseInt(e.target.value) || 0 }))}
     min={0}
     className="w-full px-2 py-1.5 text-sm border border-border rounded bg-input text-foreground"
    />
   </div>
   <div>
    <label className="block text-xs text-muted-foreground mb-1">Y</label>
    <input
     type="number"
     value={newRegion.y}
     onChange={(e) => setNewRegion(prev => ({ ...prev, y: parseInt(e.target.value) || 0 }))}
     min={0}
     className="w-full px-2 py-1.5 text-sm border border-border rounded bg-input text-foreground"
    />
   </div>
   <div>
    <label className="block text-xs text-muted-foreground mb-1">Width</label>
    <input
     type="number"
     value={newRegion.width}
     onChange={(e) => setNewRegion(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
     min={1}
     className="w-full px-2 py-1.5 text-sm border border-border rounded bg-input text-foreground"
    />
   </div>
   <div>
    <label className="block text-xs text-muted-foreground mb-1">Height</label>
    <input
     type="number"
     value={newRegion.height}
     onChange={(e) => setNewRegion(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
     min={1}
     className="w-full px-2 py-1.5 text-sm border border-border rounded bg-input text-foreground"
    />
   </div>
  </div>
  <button
   type="button"
   onClick={handleAddRegion}
   className="mt-2 flex items-center gap-1 text-sm text-accent hover:text-accent/80 transition-colors"
  >
   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
   </svg>
   Add Region
  </button>
 </FormField>

 {/* Feature #590: Ignore Selectors */}
 <FormField
  label="Ignore Selectors"
  hint="CSS selectors of elements to exclude from comparison (e.g., timestamps, avatars)"
 >
  <input
   type="text"
   defaultValue={ignoreSelectors.join(', ')}
   onChange={(e) => {
    const selectors = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    onIgnoreSelectorsChange(selectors);
   }}
   placeholder=".timestamp, .avatar, [data-dynamic], .ad-slot"
   className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
  />
 </FormField>

 {/* Feature #590: Custom CSS */}
 <FormField
  label="Custom CSS"
  hint="CSS to inject before capture — useful for hiding dynamic content, animations, or cursors"
 >
  <textarea
   value={customCSS}
   onChange={(e) => onCustomCSSChange(e.target.value)}
   placeholder={`/* Hide blinking cursors and animations */\n* { animation: none !important; }\n.cursor { visibility: hidden; }`}
   rows={4}
   className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm resize-y"
   spellCheck={false}
  />
 </FormField>

 {/* Feature #590: Clip Selector */}
 <FormField
  label="Clip Selector"
  hint="CSS selector to screenshot only a specific element instead of the full page"
 >
  <input
   type="text"
   value={clipSelector}
   onChange={(e) => onClipSelectorChange(e.target.value)}
   placeholder="#main-content, .hero-section, [data-testid='card']"
   className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
  />
 </FormField>
 </div>
 )}
 </div>
 );
};

export default AdvancedSettingsPanel;
