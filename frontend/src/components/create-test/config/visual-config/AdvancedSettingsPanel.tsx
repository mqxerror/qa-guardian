// Feature #104: Split VisualConfig.tsx into logical modules
// Advanced settings panel component extracted from VisualConfig.tsx

import React, { useState } from 'react';
import { FormField } from './FormField';

interface AdvancedSettingsPanelProps {
  waitForSelector: string;
  delay: number;
  hideSelectors: string[];
  onWaitForSelectorChange: (value: string) => void;
  onDelayChange: (value: number) => void;
  onHideSelectorsChange: (value: string[]) => void;
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
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
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
              value={waitForSelector}
              onChange={(e) => onWaitForSelectorChange(e.target.value)}
              placeholder="[data-loaded='true'], .content-ready"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
            />
          </FormField>
        </div>
      )}
    </div>
  );
};

export default AdvancedSettingsPanel;
