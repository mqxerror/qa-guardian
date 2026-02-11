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
import { PlayCircle, Eye, Zap, Accessibility, Users, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { URLInput } from './URLInput';
import { GeneratedTestPreview } from '../types';

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

// Re-export GeneratedTestPreview for backward compatibility
export type { GeneratedTestPreview };

/**
 * Test type configurations with colors and icons
 */
const TEST_TYPE_CONFIGS: TestTypeConfig[] = [
 {
 id: 'e2e',
 label: 'E2E',
 description: 'End-to-end test',
 icon: <PlayCircle className="w-4 h-4" />,
 colorClasses: {
 selected: 'border-primary bg-primary/5',
 checkbox: 'border-primary bg-primary',
 text: 'text-primary',
 },
 },
 {
 id: 'visual',
 label: 'Visual',
 description: 'Screenshot diff',
 icon: <Eye className="w-4 h-4" />,
 colorClasses: {
 selected: 'border-accent bg-accent/5',
 checkbox: 'border-accent bg-accent/50',
 text: 'text-accent',
 },
 },
 {
 id: 'performance',
 label: 'Perf',
 description: 'Lighthouse',
 icon: <Zap className="w-4 h-4" />,
 colorClasses: {
 selected: 'border-warning bg-warning/5',
 checkbox: 'border-warning bg-warning',
 text: 'text-warning',
 },
 },
 {
 id: 'accessibility',
 label: 'A11y',
 description: 'WCAG check',
 icon: <Accessibility className="w-4 h-4" />,
 colorClasses: {
 selected: 'border-success bg-success/5',
 checkbox: 'border-success bg-success',
 text: 'text-success',
 },
 },
 {
 id: 'load',
 label: 'Load',
 description: 'K6 test',
 icon: <Users className="w-4 h-4" />,
 colorClasses: {
 selected: 'border-destructive bg-destructive/5',
 checkbox: 'border-destructive bg-destructive',
 text: 'text-destructive',
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
 <label className="block text-sm font-medium text-foreground mb-2">
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
 : 'border-border text-foreground hover:border-border'
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
 : 'border-border'
 }
 `}
 >
 {isSelected && (
 <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
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
 <div className="mb-4 p-4 bg-muted rounded-lg">
 {/* Success Summary */}
 {(() => {
 const created = generatedTests.filter(t => t.status === 'created').length;
 const failed = generatedTests.filter(t => t.status === 'failed').length;
 const pending = generatedTests.filter(t => t.status === 'pending' || t.status === 'creating').length;
 const isComplete = pending === 0;

 if (isComplete && created > 0) {
 return (
 <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
 <CheckCircle2 className="w-5 h-5 text-success" />
 <span className="text-sm font-medium text-success">
 {created === generatedTests.length
 ? `All ${created} test${created !== 1 ? 's' : ''} created successfully!`
 : `${created} of ${generatedTests.length} tests created${failed > 0 ? ` (${failed} failed)` : ''}`}
 </span>
 </div>
 );
 }
 return null;
 })()}

 <h4 className="text-sm font-medium text-foreground mb-2">
 Generated Tests
 </h4>
 <ul className="space-y-2">
 {generatedTests.map(test => (
 <li
 key={test.id}
 className="flex items-center justify-between text-sm"
 >
 <span className="text-foreground">{test.name}</span>
 <div className="flex items-center gap-2">
 {/* View Test Link - Feature #1805 */}
 {test.status === 'created' && test.createdTestId && (
 <button
 type="button"
 onClick={() => onViewTest?.(test.createdTestId!)}
 className="text-primary hover:underline text-xs font-medium"
 >
 View
 </button>
 )}
 <span
 className={`px-2 py-0.5 rounded text-xs font-medium ${
 test.status === 'created'
 ? 'bg-success/10 text-success'
 : test.status === 'creating'
 ? 'bg-primary/10 text-primary'
 : test.status === 'failed'
 ? 'bg-destructive/10 text-destructive'
 : 'bg-muted text-foreground'
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
 className="w-full px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {isLoading ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 <span>Running Tests...</span>
 </>
 ) : (
 <>
 <PlayCircle className="w-4 h-4" />
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
