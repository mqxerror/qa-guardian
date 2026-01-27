/**
 * QuickTestPanel Component
 * Feature #1804: URL input + test type checkboxes with smart defaults
 *
 * Features:
 * - URLInput for target URL with validation
 * - 4 checkbox cards: Visual, Performance, Accessibility, E2E (+ Load)
 * - Smart defaults: Visual+Performance+A11y checked by default
 * - Run Tests button with batch creation
 * - Loading state during test creation
 */

import React, { useState, useCallback, useMemo } from 'react';
import { URLInput } from './URLInput';

/**
 * Test type configuration for checkbox cards
 */
interface TestTypeConfig {
  id: QuickTestType;
  label: string;
  description: string;
  icon: React.ReactNode;
  colorClasses: {
    selected: string;
    checkbox: string;
    text: string;
  };
}

/**
 * Quick test types that can be selected
 */
export type QuickTestType = 'e2e' | 'visual' | 'performance' | 'accessibility' | 'load';

/**
 * Selection state for quick tests
 */
export type QuickTestSelection = Record<QuickTestType, boolean>;

/**
 * Generated test preview item
 */
export interface GeneratedTestPreview {
  id: string;
  type: QuickTestType;
  name: string;
  status: 'pending' | 'creating' | 'created' | 'failed';
  error?: string;
  /** ID of created test for linking */
  createdTestId?: string;
}

/**
 * Test type configurations with colors and icons
 */
const TEST_TYPE_CONFIGS: TestTypeConfig[] = [
  {
    id: 'e2e',
    label: 'E2E',
    description: 'End-to-end test',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    colorClasses: {
      selected: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
      checkbox: 'border-blue-500 bg-blue-500',
      text: 'text-blue-700 dark:text-blue-400',
    },
  },
  {
    id: 'visual',
    label: 'Visual',
    description: 'Screenshot diff',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    colorClasses: {
      selected: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
      checkbox: 'border-purple-500 bg-purple-500',
      text: 'text-purple-700 dark:text-purple-400',
    },
  },
  {
    id: 'performance',
    label: 'Perf',
    description: 'Lighthouse',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    colorClasses: {
      selected: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
      checkbox: 'border-amber-500 bg-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
    },
  },
  {
    id: 'accessibility',
    label: 'A11y',
    description: 'WCAG check',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    colorClasses: {
      selected: 'border-green-500 bg-green-50 dark:bg-green-900/20',
      checkbox: 'border-green-500 bg-green-500',
      text: 'text-green-700 dark:text-green-400',
    },
  },
  {
    id: 'load',
    label: 'Load',
    description: 'K6 test',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    colorClasses: {
      selected: 'border-red-500 bg-red-50 dark:bg-red-900/20',
      checkbox: 'border-red-500 bg-red-500',
      text: 'text-red-700 dark:text-red-400',
    },
  },
];

/**
 * Default selection: Visual, Performance, Accessibility checked
 */
const DEFAULT_SELECTION: QuickTestSelection = {
  e2e: false,
  visual: true,
  performance: true,
  accessibility: true,
  load: false,
};

/**
 * Props for QuickTestPanel component
 */
export interface QuickTestPanelProps {
  /** Suite ID for creating test links */
  suiteId?: string;
  /** Project base URL for smart placeholder */
  projectBaseUrl?: string;
  /** Called when tests are generated */
  onGenerateTests: (url: string, types: QuickTestType[]) => Promise<void>;
  /** Generated tests preview list */
  generatedTests?: GeneratedTestPreview[];
  /** Loading state */
  isLoading?: boolean;
  /** URL error from parent */
  urlError?: string;
  /** CSS class name */
  className?: string;
  /** Callback when clicking view test link */
  onViewTest?: (testId: string) => void;
}

/**
 * QuickTestPanel - URL input with checkbox test type selection
 */
export const QuickTestPanel: React.FC<QuickTestPanelProps> = ({
  suiteId,
  projectBaseUrl,
  onGenerateTests,
  generatedTests = [],
  isLoading = false,
  urlError,
  className = '',
  onViewTest,
}) => {
  // State
  const [targetUrl, setTargetUrl] = useState('');
  const [selection, setSelection] = useState<QuickTestSelection>(DEFAULT_SELECTION);
  const [localUrlError, setLocalUrlError] = useState<string | null>(null);

  // Toggle a test type
  const toggleType = useCallback((type: QuickTestType) => {
    setSelection(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  }, []);

  // Get selected types
  const selectedTypes = useMemo(() => {
    return (Object.entries(selection) as [QuickTestType, boolean][])
      .filter(([_, selected]) => selected)
      .map(([type]) => type);
  }, [selection]);

  const selectedCount = selectedTypes.length;

  // Handle URL change
  const handleUrlChange = useCallback((url: string) => {
    setTargetUrl(url);
    if (localUrlError) {
      setLocalUrlError(null);
    }
  }, [localUrlError]);

  // Handle run tests
  const handleRunTests = useCallback(async () => {
    const trimmedUrl = targetUrl.trim();

    if (!trimmedUrl) {
      setLocalUrlError('Please enter a URL');
      return;
    }

    if (selectedCount === 0) {
      return;
    }

    await onGenerateTests(trimmedUrl, selectedTypes);
  }, [targetUrl, selectedCount, selectedTypes, onGenerateTests]);

  // Combined error
  const displayError = urlError || localUrlError;

  return (
    <div className={`quick-test-panel ${className}`}>
      {/* URL Input */}
      <URLInput
        id="quick-test-url"
        label="Target URL"
        value={targetUrl}
        onChange={handleUrlChange}
        projectBaseUrl={projectBaseUrl}
        showFavicon={true}
        autoFocus={true}
        error={displayError || undefined}
        className="mb-4"
      />

      {/* Test Type Checkboxes */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Test Types ({selectedCount} selected)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TEST_TYPE_CONFIGS.map(config => {
            const isSelected = selection[config.id];
            return (
              <button
                key={config.id}
                type="button"
                onClick={() => toggleType(config.id)}
                aria-pressed={isSelected}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                  ${
                    isSelected
                      ? `${config.colorClasses.selected} ${config.colorClasses.text}`
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                  }
                `}
              >
                {/* Checkbox */}
                <div
                  className={`
                    w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                    ${
                      isSelected
                        ? config.colorClasses.checkbox
                        : 'border-gray-300 dark:border-gray-500'
                    }
                  `}
                >
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {/* Icon */}
                <span className={isSelected ? config.colorClasses.text : ''}>
                  {config.icon}
                </span>
                {/* Label */}
                <span className="text-sm font-medium">{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generated Tests Preview - Feature #1805 */}
      {generatedTests.length > 0 && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          {/* Success Summary */}
          {(() => {
            const created = generatedTests.filter(t => t.status === 'created').length;
            const failed = generatedTests.filter(t => t.status === 'failed').length;
            const pending = generatedTests.filter(t => t.status === 'pending' || t.status === 'creating').length;
            const isComplete = pending === 0;

            if (isComplete && created > 0) {
              return (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200 dark:border-gray-600">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    {created === generatedTests.length
                      ? `All ${created} test${created !== 1 ? 's' : ''} created successfully!`
                      : `${created} of ${generatedTests.length} tests created${failed > 0 ? ` (${failed} failed)` : ''}`}
                  </span>
                </div>
              );
            }
            return null;
          })()}

          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Generated Tests
          </h4>
          <ul className="space-y-2">
            {generatedTests.map(test => (
              <li
                key={test.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-800 dark:text-gray-200">{test.name}</span>
                <div className="flex items-center gap-2">
                  {/* View Test Link - Feature #1805 */}
                  {test.status === 'created' && test.createdTestId && (
                    <button
                      type="button"
                      onClick={() => onViewTest?.(test.createdTestId!)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium"
                    >
                      View
                    </button>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      test.status === 'created'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : test.status === 'creating'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : test.status === 'failed'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {test.status === 'created'
                      ? 'Created'
                      : test.status === 'creating'
                      ? 'Creating...'
                      : test.status === 'failed'
                      ? 'Failed'
                      : 'Pending'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Run Tests Button */}
      <button
        type="button"
        onClick={handleRunTests}
        disabled={isLoading || selectedCount === 0 || !targetUrl.trim()}
        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Running Tests...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Run {selectedCount} Test{selectedCount !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </button>
    </div>
  );
};

export default QuickTestPanel;
