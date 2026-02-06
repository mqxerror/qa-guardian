// Feature #104: Split VisualConfig.tsx into logical modules
// Device category panel component extracted from VisualConfig.tsx

import React from 'react';
import type { ViewportConfig } from './types';
import { DEVICE_PRESETS } from './constants';

interface DeviceCategoryPanelProps {
  category: 'mobile' | 'tablet' | 'desktop';
  categoryIcon: string;
  categoryLabel: string;
  viewports: ViewportConfig[];
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleViewport: (index: number) => void;
  onToggleOrientation: (index: number) => void;
  onToggleCategoryAll: (enable: boolean) => void;
  selectedCount: number;
  totalCount: number;
}

/**
 * Collapsible device category panel with viewport checkboxes
 * Used for Mobile, Tablet, and Desktop device groups
 */
export const DeviceCategoryPanel: React.FC<DeviceCategoryPanelProps> = ({
  category,
  categoryIcon,
  categoryLabel,
  viewports,
  expanded,
  onToggleExpand,
  onToggleViewport,
  onToggleOrientation,
  onToggleCategoryAll,
  selectedCount,
  totalCount,
}) => {
  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{expanded ? '▼' : '▶'}</span>
          <span className="text-sm">{categoryIcon}</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{categoryLabel}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({selectedCount}/{totalCount})
          </span>
        </div>
        <label
          className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selectedCount === totalCount}
            onChange={(e) => onToggleCategoryAll(e.target.checked)}
            className="w-3 h-3 text-purple-600 rounded focus:ring-purple-500"
          />
          All
        </label>
      </button>
      {expanded && (
        <div className="grid grid-cols-2 gap-2 p-2">
          {viewports.map((viewport, index) => {
            const preset = DEVICE_PRESETS.find(d => d.name === viewport.name);
            if (preset?.category !== category) return null;
            const showOrientationToggle = category !== 'desktop' && viewport.enabled;

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
                  onChange={() => onToggleViewport(index)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {viewport.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    {viewport.width}×{viewport.height}
                    {showOrientationToggle && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleOrientation(index);
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
  );
};

export default DeviceCategoryPanel;
