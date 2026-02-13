/**
 * AIGenerateStep Component
 * Feature #1808: AIGenerateStep with useAIParser
 * Feature #593: OpenAPI mode for generating tests from OpenAPI/Swagger specs
 * Feature #610: Decomposed with sub-components in ai-generate/
 *
 * Step 2A of the CustomTestWizard when AI Generate method is selected.
 * Features:
 * - Tab toggle between Text (natural language) and OpenAPI modes
 * - Text mode: Large textarea for natural language input with AI parsing
 * - OpenAPI mode: Paste JSON/YAML, upload file, or enter spec URL
 * - Preview card showing detected: testType, URL, viewport
 * - Confidence score indicator
 * - Edit Details button to manually adjust values
 */

import React, { useState, useCallback } from 'react';
import { Lightbulb, Code2 } from 'lucide-react';
import { useAIParser, type DetectedTestType, type ViewportPreset } from './hooks';
// Feature #610: Import extracted types and components
import {
  EditModal,
  OpenAPIMode,
  AIPromptSection,
  AIResultsPanel,
  type AIGenInputMode,
  type OpenAPIGeneratedTest,
} from './ai-generate';

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

// Feature #610: OpenAPIMode and EditModal now imported from ai-generate/

/**
 * AIGenerateStep component
 * Feature #593: Added OpenAPI mode toggle
 */
export const AIGenerateStep: React.FC<AIGenerateStepProps> = ({
 onChange,
 projectBaseUrl,
}) => {
 // Feature #593: Mode toggle between text and openapi
 const [inputMode, setInputMode] = useState<AIGenInputMode>('text');
 const [openAPITests, setOpenAPITests] = useState<OpenAPIGeneratedTest[]>([]);

 // Feature #513: isReady check moved to useEffect
 // Feature #588: Enable useAIService to call backend /api/v1/ai/parse-intent for real AI parsing
 const { input, isParsing, result, setInput, updateResult, error } = useAIParser({
 debounceMs: 400,
 minInputLength: 5,
 useAIService: true, // Feature #588: Use backend AI for enhanced parsing
 });

 const [showEditModal, setShowEditModal] = useState(false);

 // Feature #1820: Notify parent when validity changes
 // isReady is true when result has confidence > 50% AND has testType and url
 React.useEffect(() => {
 if (onChange) {
 // For text mode: check if we have valid config
 if (inputMode === 'text') {
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
 // For openapi mode: validity is handled by onValidityChange callback
 }
 }, [result, input, onChange, inputMode]);

 // Feature #593: Handle OpenAPI tests generated
 const handleOpenAPITestsGenerated = useCallback((tests: OpenAPIGeneratedTest[]) => {
 setOpenAPITests(tests);
 // For OpenAPI mode, we pass a special config with the generated tests
 if (onChange && tests.some(t => t.selected)) {
 // Use e2e as the test type for OpenAPI-generated tests
 onChange({
 testType: 'e2e',
 url: tests[0]?.path || null,
 viewport: { preset: 'desktop', width: 1920, height: 1080 },
 description: `OpenAPI tests: ${tests.filter(t => t.selected).length} endpoints selected`,
 // @ts-expect-error - Adding custom property for OpenAPI mode
 openAPITests: tests.filter(t => t.selected),
 }, true);
 }
 }, [onChange]);

 // Feature #593: Handle OpenAPI validity changes
 const handleOpenAPIValidityChange = useCallback((isValid: boolean) => {
 if (onChange && inputMode === 'openapi') {
 if (isValid && openAPITests.some(t => t.selected)) {
 onChange({
  testType: 'e2e',
  url: openAPITests[0]?.path || null,
  viewport: { preset: 'desktop', width: 1920, height: 1080 },
  description: `OpenAPI tests: ${openAPITests.filter(t => t.selected).length} endpoints selected`,
  // @ts-expect-error - Adding custom property for OpenAPI mode
  openAPITests: openAPITests.filter(t => t.selected),
 }, true);
 } else {
 onChange(null, false);
 }
 }
 }, [onChange, inputMode, openAPITests]);

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
 {inputMode === 'text' ? 'Describe your test' : 'Generate from OpenAPI'}
 </h3>
 <p className="text-sm text-muted-foreground">
 {inputMode === 'text'
 ? "Tell us what you want to test in natural language. We'll automatically detect the test type, URL, and settings."
 : "Paste your OpenAPI/Swagger specification to generate API tests automatically."}
 </p>
 </div>

 {/* Feature #593: Mode Toggle */}
 <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
 <button
 onClick={() => setInputMode('text')}
 className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
 inputMode === 'text'
  ? 'bg-card text-foreground shadow-sm'
  : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 <Lightbulb className="w-4 h-4" />
 Natural Language
 </button>
 <button
 onClick={() => setInputMode('openapi')}
 className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
 inputMode === 'openapi'
  ? 'bg-card text-foreground shadow-sm'
  : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 <Code2 className="w-4 h-4" />
 OpenAPI Spec
 </button>
 </div>

 {/* Feature #593: Conditional rendering based on mode */}
 {inputMode === 'text' ? (
 <>
 {/* Feature #610: AIPromptSection - textarea, examples, and error display */}
 <AIPromptSection
  input={input}
  isParsing={isParsing}
  onInputChange={handleInputChange}
  setInput={setInput}
  examples={examples}
  error={error}
 />

 {/* Feature #610: AIResultsPanel - detected configuration preview */}
 {result && (
 <AIResultsPanel
  result={result}
  onEditClick={() => setShowEditModal(true)}
 />
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
 </>
 ) : (
 /* Feature #593: OpenAPI Mode */
 <OpenAPIMode
  projectBaseUrl={projectBaseUrl}
  onTestsGenerated={handleOpenAPITestsGenerated}
  onValidityChange={handleOpenAPIValidityChange}
 />
 )}
 </div>
 );
};

export default AIGenerateStep;
