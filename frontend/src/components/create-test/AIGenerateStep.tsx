/**
 * AIGenerateStep Component
 * Feature #1808: AIGenerateStep with useAIParser
 *
 * Step 2A of the CustomTestWizard when AI Generate method is selected.
 * Features:
 * - Large textarea for natural language input
 * - Real-time parsing with debounced useAIParser hook
 * - Preview card showing detected: testType, URL, viewport
 * - Confidence score indicator
 * - Edit Details button to manually adjust values
 */

import React, { useState, useCallback } from 'react';
import { useAIParser, type DetectedTestType, type ViewportPreset } from './hooks';

/**
 * Test type display config — safe color mapping (no dynamic Tailwind)
 */
const TEST_TYPE_CONFIG: Record<Exclude<DetectedTestType, null>, { label: string; icon: string; iconBg: string }> = {
 e2e: { label: 'E2E Test', icon: '🔄', iconBg: 'bg-blue-100 dark:bg-blue-900/40' },
 visual: { label: 'Visual Regression', icon: '📸', iconBg: 'bg-purple-100 dark:bg-purple-900/40' },
 accessibility: { label: 'Accessibility', icon: '♿', iconBg: 'bg-green-100 dark:bg-green-900/40' },
 performance: { label: 'Performance', icon: '⚡', iconBg: 'bg-orange-100 dark:bg-orange-900/40' },
 load: { label: 'Load Test', icon: '📊', iconBg: 'bg-red-100 dark:bg-red-900/40' },
};

/**
 * Viewport preset display config
 */
const VIEWPORT_CONFIG: Record<ViewportPreset, { label: string; icon: string }> = {
 desktop: { label: 'Desktop', icon: '🖥️' },
 tablet: { label: 'Tablet', icon: '📱' },
 mobile: { label: 'Mobile', icon: '📲' },
 custom: { label: 'Custom', icon: '⚙️' },
};

/**
 * Confidence level indicator
 */
const getConfidenceLevel = (confidence: number): { label: string; color: string } => {
 if (confidence >= 0.8) return { label: 'High', color: 'green' };
 if (confidence >= 0.5) return { label: 'Medium', color: 'yellow' };
 if (confidence >= 0.3) return { label: 'Low', color: 'orange' };
 return { label: 'Very Low', color: 'red' };
};

/**
 * Props for AIGenerateStep
 */
export interface AIGenerateStepProps {
 /** Called when ready to continue */
 onContinue: (config: {
 testType: DetectedTestType;
 url: string;
 viewport: { preset: ViewportPreset; width: number; height: number };
 description: string;
 }) => void;
 /** Called when form validity changes (Feature #1820 fix) */
 onChange?: (config: {
 testType: DetectedTestType;
 url: string | null;
 viewport: { preset: ViewportPreset; width: number; height: number };
 description: string;
 } | null, isValid: boolean) => void;
 /** Initial description if any */
 initialDescription?: string;
 /** Project base URL for dynamic placeholders (no example.com) */
 projectBaseUrl?: string;
}

/**
 * Edit modal for manual adjustments
 */
interface EditModalProps {
 isOpen: boolean;
 onClose: () => void;
 testType: DetectedTestType;
 url: string | null;
 viewport: { preset: ViewportPreset; width: number; height: number };
 onSave: (updates: {
 testType: DetectedTestType;
 url: string;
 viewport: { preset: ViewportPreset; width: number; height: number };
 }) => void;
 /** Project base URL for placeholder (no example.com) */
 projectBaseUrl?: string;
}

const EditModal: React.FC<EditModalProps> = ({
 isOpen,
 onClose,
 testType,
 url,
 viewport,
 onSave,
 projectBaseUrl,
}) => {
 const [editTestType, setEditTestType] = useState<DetectedTestType>(testType);
 const [editUrl, setEditUrl] = useState(url || '');
 const [editViewport, setEditViewport] = useState(viewport);

 if (!isOpen) return null;

 const handleSave = () => {
 onSave({
 testType: editTestType,
 url: editUrl,
 viewport: editViewport,
 });
 onClose();
 };

 return (
 <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
 <div className="bg-card rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
 <h3 className="text-lg font-semibold text-foreground mb-4">
 Edit Test Configuration
 </h3>

 {/* Test Type */}
 <div className="mb-4">
 <label className="block text-sm font-medium text-foreground mb-2">
 Test Type
 </label>
 <select
 value={editTestType || ''}
 onChange={(e) => setEditTestType(e.target.value as DetectedTestType)}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 >
 <option value="">Select type...</option>
 {Object.entries(TEST_TYPE_CONFIG).map(([key, config]) => (
 <option key={key} value={key}>{config.icon} {config.label}</option>
 ))}
 </select>
 </div>

 {/* URL */}
 <div className="mb-4">
 <label className="block text-sm font-medium text-foreground mb-2">
 Target URL
 </label>
 <input
 type="url"
 value={editUrl}
 onChange={(e) => setEditUrl(e.target.value)}
 placeholder={projectBaseUrl || 'https://your-site.com'}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 </div>

 {/* Viewport */}
 <div className="mb-6">
 <label className="block text-sm font-medium text-foreground mb-2">
 Viewport
 </label>
 <select
 value={editViewport.preset}
 onChange={(e) => {
 const preset = e.target.value as ViewportPreset;
 const presetDimensions: Record<ViewportPreset, { width: number; height: number }> = {
 desktop: { width: 1920, height: 1080 },
 tablet: { width: 768, height: 1024 },
 mobile: { width: 375, height: 667 },
 custom: { width: editViewport.width, height: editViewport.height },
 };
 setEditViewport({ preset, ...presetDimensions[preset] });
 }}
 className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 >
 {Object.entries(VIEWPORT_CONFIG).map(([key, config]) => (
 <option key={key} value={key}>{config.icon} {config.label}</option>
 ))}
 </select>
 {editViewport.preset === 'custom' && (
 <div className="flex gap-2 mt-2">
 <input
 type="number"
 value={editViewport.width}
 onChange={(e) => setEditViewport({ ...editViewport, width: parseInt(e.target.value) || 0 })}
 placeholder="Width"
 className="flex-1 px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 <span className="py-2 text-muted-foreground">×</span>
 <input
 type="number"
 value={editViewport.height}
 onChange={(e) => setEditViewport({ ...editViewport, height: parseInt(e.target.value) || 0 })}
 placeholder="Height"
 className="flex-1 px-3 py-2 border border-border rounded-lg bg-input text-foreground"
 />
 </div>
 )}
 </div>

 {/* Actions */}
 <div className="flex gap-3">
 <button
 onClick={onClose}
 className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted"
 >
 Cancel
 </button>
 <button
 onClick={handleSave}
 disabled={!editTestType || !editUrl}
 className="flex-1 px-4 py-2 bg-primary hover:bg-primary disabled:bg-muted text-white rounded-lg disabled:cursor-not-allowed"
 >
 Save Changes
 </button>
 </div>
 </div>
 </div>
 );
};

/**
 * AIGenerateStep component
 */
export const AIGenerateStep: React.FC<AIGenerateStepProps> = ({
 onContinue: _onContinue, // Feature #513: prefixed - continuation handled via onChange callback
 onChange,
 initialDescription: _initialDescription = '', // Feature #513: prefixed - not used, input starts empty
 projectBaseUrl,
}) => {
 // Feature #513: isReady check moved to useEffect, prefixing unused
 const { input, isParsing, result, setInput, isReady: _isReady, updateResult } = useAIParser({
 debounceMs: 400,
 minInputLength: 5,
 });

 const [showEditModal, setShowEditModal] = useState(false);

 // Feature #1820: Notify parent when validity changes
 // isReady is true when result has confidence > 50% AND has testType and url
 React.useEffect(() => {
 if (onChange) {
 // Check if we have valid config: testType detected, URL detected, confidence > 50%
 const hasValidConfig = result !== null &&
 result.testType !== null &&
 result.url !== null &&
 result.overallConfidence > 0.5;

 if (hasValidConfig && result) {
 onChange({
 testType: result.testType,
 url: result.url,
 viewport: result.viewport,
 description: input,
 }, true);
 } else {
 onChange(null, false);
 }
 }
 }, [result, input, onChange]);

 // Handle textarea change
 const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
 setInput(e.target.value);
 }, [setInput]);

 // Handle manual edits
 const handleEditSave = useCallback((updates: {
 testType: DetectedTestType;
 url: string;
 viewport: { preset: ViewportPreset; width: number; height: number };
 }) => {
 updateResult({
 testType: updates.testType,
 testTypeConfidence: 1,
 url: updates.url,
 urlConfidence: 1,
 viewport: updates.viewport,
 viewportConfidence: 1,
 overallConfidence: 1,
 suggestions: [],
 });
 }, [updateResult]);

 // Placeholder examples - use projectBaseUrl if available (no example.com)
 const baseUrl = projectBaseUrl || 'https://your-site.com';
 const baseDomain = (() => {
 try {
 return new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`).hostname;
 } catch {
 return 'your-site.com';
 }
 })();

 const examples = [
 `Test the login flow on ${baseUrl} with mobile viewport`,
 `Visual regression test for the homepage at ${baseDomain}`,
 `Check accessibility compliance on ${baseUrl}/shop`,
 `Run a load test with 100 concurrent users on ${baseDomain}/api`,
 `Performance audit for ${baseUrl} on desktop`,
 ];

 return (
 <div className="space-y-4">
 {/* Header */}
 <div>
 <h3 className="text-xl font-semibold text-foreground mb-1">
 Describe your test
 </h3>
 <p className="text-sm text-muted-foreground">
 Tell us what you want to test in natural language. We'll automatically detect the test type, URL, and settings.
 </p>
 </div>

 {/* Textarea */}
 <div>
 <textarea
 value={input}
 onChange={handleInputChange}
 placeholder="Example: Test the login form on https://myapp.com using mobile viewport..."
 className="w-full h-32 px-4 py-3 border border-border rounded-xl bg-muted/50 text-foreground placeholder-muted-foreground resize-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
 autoFocus
 />
 <div className="flex items-center justify-between mt-1.5">
 <span className="text-xs text-muted-foreground">
 {input.length} characters
 </span>
 {isParsing && (
 <span className="flex items-center gap-1.5 text-xs text-primary">
 <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 Analyzing...
 </span>
 )}
 </div>
 </div>

 {/* Examples */}
 {!input && (
 <div className="bg-muted/50 rounded-lg p-4 border border-border">
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
 Try one of these examples:
 </p>
 <div className="space-y-0.5">
 {examples.slice(0, 3).map((example, i) => (
 <button
 key={i}
 onClick={() => setInput(example)}
 className="block w-full text-left text-sm text-foreground hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/80 transition-colors"
 >
 "{example}"
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Preview Card */}
 {result && (
 <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
 <div className="flex items-center justify-between mb-3">
 <h4 className="text-sm font-medium text-foreground">
 Detected Configuration
 </h4>
 <div className="flex items-center gap-2">
 {/* Confidence Score */}
 <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
 getConfidenceLevel(result.overallConfidence).color === 'green'
 ? 'bg-success/10 text-success'
 : getConfidenceLevel(result.overallConfidence).color === 'yellow'
 ? 'bg-warning/10 text-warning'
 : getConfidenceLevel(result.overallConfidence).color === 'orange'
 ? 'bg-warning/10 text-warning'
 : 'bg-destructive/10 text-destructive'
 }`}>
 <span>{Math.round(result.overallConfidence * 100)}%</span>
 <span>confidence</span>
 </div>
 {/* Edit Button */}
 <button
 onClick={() => setShowEditModal(true)}
 className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-muted/80 rounded-md transition-colors"
 >
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 Edit
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
 {/* Test Type */}
 <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
 <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
 result.testType
 ? TEST_TYPE_CONFIG[result.testType].iconBg
 : 'bg-muted'
 }`}>
 {result.testType ? TEST_TYPE_CONFIG[result.testType].icon : '?'}
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Test Type</p>
 <p className="text-sm font-medium text-foreground">
 {result.testType ? TEST_TYPE_CONFIG[result.testType].label : 'Not detected'}
 </p>
 </div>
 </div>

 {/* URL */}
 <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
 <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-primary/10">
 🌐
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-xs text-muted-foreground">Target URL</p>
 <p className="text-sm font-medium text-foreground truncate">
 {result.url || 'Not detected'}
 </p>
 </div>
 </div>

 {/* Viewport */}
 <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
 <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-muted">
 {VIEWPORT_CONFIG[result.viewport.preset].icon}
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Viewport</p>
 <p className="text-sm font-medium text-foreground">
 {VIEWPORT_CONFIG[result.viewport.preset].label} ({result.viewport.width}×{result.viewport.height})
 </p>
 </div>
 </div>
 </div>

 {/* Suggestions */}
 {result.suggestions.length > 0 && (
 <div className="mt-3 pt-3 border-t border-border">
 <p className="text-xs font-medium text-warning mb-1.5">
 Suggestions to improve detection:
 </p>
 <ul className="space-y-1">
 {result.suggestions.map((suggestion, i) => (
 <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
 <span className="text-warning mt-0.5">•</span>
 {suggestion}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}

 {/* Edit Modal */}
 <EditModal
 isOpen={showEditModal}
 onClose={() => setShowEditModal(false)}
 testType={result?.testType || null}
 url={result?.url || null}
 viewport={result?.viewport || { preset: 'desktop', width: 1920, height: 1080 }}
 onSave={handleEditSave}
 projectBaseUrl={projectBaseUrl}
 />
 </div>
 );
};

export default AIGenerateStep;
