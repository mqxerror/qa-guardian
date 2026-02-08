// Feature #104: Split VisualConfig.tsx into logical modules
// Custom viewport panel component extracted from VisualConfig.tsx

import React, { useState } from 'react';
import type { ViewportConfig, VisualConfigState } from './types';
import { DEVICE_PRESETS } from './constants';

interface CustomViewportPanelProps {
 viewports: ViewportConfig[];
 onAddViewport: (viewport: ViewportConfig) => void;
 onRemoveViewport: (index: number) => void;
 onToggleViewport: (index: number) => void;
}

/**
 * Panel for adding and managing custom viewports
 */
export const CustomViewportPanel: React.FC<CustomViewportPanelProps> = ({
 viewports,
 onAddViewport,
 onRemoveViewport,
 onToggleViewport,
}) => {
 const [showCustomViewport, setShowCustomViewport] = useState(false);
 const [customViewportName, setCustomViewportName] = useState('');
 const [customViewportWidth, setCustomViewportWidth] = useState(1280);
 const [customViewportHeight, setCustomViewportHeight] = useState(720);

 const customViewports = viewports.filter(vp => !DEVICE_PRESETS.find(d => d.name === vp.name));

 const handleAddViewport = () => {
 const name = customViewportName.trim() || `Custom ${customViewportWidth}×${customViewportHeight}`;
 onAddViewport({ name, width: customViewportWidth, height: customViewportHeight, enabled: true });
 // Reset form
 setShowCustomViewport(false);
 setCustomViewportName('');
 setCustomViewportWidth(1280);
 setCustomViewportHeight(720);
 };

 return (
 <>
 {/* Add Custom Viewport Button/Form */}
 <div className="pt-4 border-t border-gray-200">
 {!showCustomViewport ? (
 <button
 type="button"
 onClick={() => setShowCustomViewport(true)}
 className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-purple-400 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
 >
 <span>+</span> Add Custom Viewport
 </button>
 ) : (
 <div className="p-4 rounded-lg border border-purple-200 bg-purple-50/50 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-700">Custom Viewport</span>
 <button
 type="button"
 onClick={() => setShowCustomViewport(false)}
 className="text-gray-400 hover:text-gray-600"
 >
 ✕
 </button>
 </div>
 <input
 type="text"
 value={customViewportName}
 onChange={(e) => setCustomViewportName(e.target.value)}
 placeholder="Viewport name (e.g., Our Kiosk Display)"
 className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-input text-foreground"
 />
 <div className="flex items-center gap-2">
 <input
 type="number"
 value={customViewportWidth}
 onChange={(e) => setCustomViewportWidth(Math.min(3840, Math.max(320, parseInt(e.target.value) || 320)))}
 min={320}
 max={3840}
 className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-input text-foreground"
 placeholder="Width"
 />
 <span className="text-gray-400">×</span>
 <input
 type="number"
 value={customViewportHeight}
 onChange={(e) => setCustomViewportHeight(Math.min(2160, Math.max(240, parseInt(e.target.value) || 240)))}
 min={240}
 max={2160}
 className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-input text-foreground"
 placeholder="Height"
 />
 </div>
 <button
 type="button"
 onClick={handleAddViewport}
 className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
 >
 Add Viewport
 </button>
 </div>
 )}
 </div>

 {/* Display custom viewports that were added */}
 {customViewports.length > 0 && (
 <div className="mt-4">
 <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
 <span>⚙️</span> Custom Viewports
 </div>
 <div className="grid grid-cols-2 gap-2">
 {viewports.map((viewport, index) => {
 if (DEVICE_PRESETS.find(d => d.name === viewport.name)) return null;
 return (
 <div
 key={viewport.name}
 className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
 viewport.enabled
 ? 'border-purple-500 bg-purple-50'
 : 'border-gray-200'
 }`}
 >
 <label className="flex items-center gap-2 cursor-pointer flex-1">
 <input
 type="checkbox"
 checked={viewport.enabled}
 onChange={() => onToggleViewport(index)}
 className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
 />
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium text-gray-700 truncate">
 {viewport.name}
 </div>
 <div className="text-xs text-gray-500">
 {viewport.width}×{viewport.height}
 </div>
 </div>
 </label>
 <button
 type="button"
 onClick={() => onRemoveViewport(index)}
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
 </>
 );
};

export default CustomViewportPanel;
