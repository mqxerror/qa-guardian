/**
 * AIGenerateStep Component
 * Feature #1808: AIGenerateStep with useAIParser
 * Feature #593: OpenAPI mode for generating tests from OpenAPI/Swagger specs
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

import React, { useState, useCallback, useRef } from 'react';
import { useAIParser, type DetectedTestType, type ViewportPreset } from './hooks';
import { useAuthStore } from '../../stores/authStore';

/** AI Generation mode - text (natural language) or openapi */
type AIGenInputMode = 'text' | 'openapi';

/** OpenAPI input method */
type OpenAPIInputMethod = 'paste' | 'upload' | 'url';

/** Generated test from OpenAPI spec */
interface OpenAPIGeneratedTest {
  path: string;
  method: string;
  operationId: string;
  summary: string;
  tags: string[];
  testName: string;
  testCode: string;
  selected: boolean;
}

/** OpenAPI parse result */
interface OpenAPIParseResult {
  title: string;
  version: string;
  baseUrl: string;
  endpointCount: number;
  tags: Array<{ name: string; description?: string }>;
}

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

/** HTTP method color mapping */
const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-success/10 text-success',
  POST: 'bg-primary/10 text-primary',
  PUT: 'bg-warning/10 text-warning',
  PATCH: 'bg-accent/10 text-accent',
  DELETE: 'bg-destructive/10 text-destructive',
};

/**
 * OpenAPI Mode Component
 * Feature #593: Parse OpenAPI spec and generate tests
 */
interface OpenAPIModeProps {
  projectBaseUrl?: string;
  onTestsGenerated: (tests: OpenAPIGeneratedTest[]) => void;
  onValidityChange: (isValid: boolean) => void;
}

const OpenAPIMode: React.FC<OpenAPIModeProps> = ({
  projectBaseUrl,
  onTestsGenerated,
  onValidityChange,
}) => {
  const { token } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input state
  const [inputMethod, setInputMethod] = useState<OpenAPIInputMethod>('paste');
  const [specContent, setSpecContent] = useState('');
  const [specUrl, setSpecUrl] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState(projectBaseUrl || '');
  const [fileName, setFileName] = useState('');

  // Loading/error state
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results state
  const [parseResult, setParseResult] = useState<OpenAPIParseResult | null>(null);
  const [generatedTests, setGeneratedTests] = useState<OpenAPIGeneratedTest[]>([]);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  // Filter state
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // File upload handler
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    try {
      const content = await file.text();
      setSpecContent(content);
      await parseSpec(content);
    } catch {
      setError('Failed to read file');
    }
  };

  // Parse OpenAPI spec
  const parseSpec = async (content?: string) => {
    setIsParsing(true);
    setError(null);
    setParseResult(null);
    setGeneratedTests([]);
    onValidityChange(false);

    try {
      const response = await fetch('/api/v1/ai/openapi-parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          spec: content || specContent || undefined,
          specUrl: (!content && !specContent) ? specUrl : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse specification');
      }

      setParseResult({
        title: data.title,
        version: data.version,
        baseUrl: data.baseUrl,
        endpointCount: data.endpointCount,
        tags: data.tags || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse specification');
    } finally {
      setIsParsing(false);
    }
  };

  // Generate tests from spec
  const generateTests = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/ai/openapi-to-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          spec: specContent || undefined,
          specUrl: !specContent ? specUrl : undefined,
          baseUrl: customBaseUrl || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate tests');
      }

      const tests: OpenAPIGeneratedTest[] = data.tests.map((t: OpenAPIGeneratedTest) => ({
        ...t,
        selected: true, // Select all by default
      }));

      setGeneratedTests(tests);
      onTestsGenerated(tests);
      onValidityChange(tests.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tests');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle test selection
  const toggleTestSelection = (operationId: string) => {
    const updated = generatedTests.map(t =>
      t.operationId === operationId ? { ...t, selected: !t.selected } : t
    );
    setGeneratedTests(updated);
    onTestsGenerated(updated);
    onValidityChange(updated.some(t => t.selected));
  };

  // Select/deselect all
  const selectAll = () => {
    const updated = filteredTests.map(t => ({ ...t, selected: true }));
    // Merge with non-filtered tests
    const allUpdated = generatedTests.map(t => {
      const filtered = updated.find(u => u.operationId === t.operationId);
      return filtered || t;
    });
    setGeneratedTests(allUpdated);
    onTestsGenerated(allUpdated);
    onValidityChange(true);
  };

  const deselectAll = () => {
    const updated = generatedTests.map(t => ({ ...t, selected: false }));
    setGeneratedTests(updated);
    onTestsGenerated(updated);
    onValidityChange(false);
  };

  // Reset state
  const reset = () => {
    setSpecContent('');
    setSpecUrl('');
    setFileName('');
    setParseResult(null);
    setGeneratedTests([]);
    setError(null);
    onValidityChange(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filter tests
  const filteredTests = generatedTests.filter(test => {
    if (methodFilter !== 'all' && test.method !== methodFilter) return false;
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      return (
        test.path.toLowerCase().includes(search) ||
        test.operationId.toLowerCase().includes(search) ||
        test.summary.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const selectedCount = generatedTests.filter(t => t.selected).length;
  const uniqueMethods = [...new Set(generatedTests.map(t => t.method))];

  return (
    <div className="space-y-4">
      {/* Input Method Tabs */}
      {!generatedTests.length && (
        <>
          <div className="flex gap-2 mb-4">
            {(['paste', 'upload', 'url'] as const).map((method) => (
              <button
                key={method}
                onClick={() => setInputMethod(method)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  inputMethod === method
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {method === 'paste' ? '📋 Paste' : method === 'upload' ? '📁 Upload' : '🔗 URL'}
              </button>
            ))}
          </div>

          {/* Paste Input */}
          {inputMethod === 'paste' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                OpenAPI Specification (JSON or YAML)
              </label>
              <textarea
                value={specContent}
                onChange={(e) => setSpecContent(e.target.value)}
                placeholder={'{\n  "openapi": "3.0.0",\n  "info": { "title": "My API", "version": "1.0" },\n  "paths": { ... }\n}'}
                className="w-full h-40 px-4 py-3 border border-border rounded-xl bg-muted/50 text-foreground placeholder-muted-foreground resize-none font-mono text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => parseSpec()}
                  disabled={!specContent.trim() || isParsing}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isParsing ? 'Parsing...' : 'Parse Spec'}
                </button>
              </div>
            </div>
          )}

          {/* Upload Input */}
          {inputMethod === 'upload' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Upload OpenAPI File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                className="w-full rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center hover:bg-muted/50 transition-colors"
              >
                <div className="text-muted-foreground">
                  <svg className="mx-auto h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="font-medium">Click to upload</p>
                  <p className="text-sm">JSON or YAML file</p>
                </div>
              </button>
              {fileName && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{fileName}</span>
                </p>
              )}
            </div>
          )}

          {/* URL Input */}
          {inputMethod === 'url' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                OpenAPI Specification URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={specUrl}
                  onChange={(e) => setSpecUrl(e.target.value)}
                  placeholder="https://api.example.com/openapi.json"
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground"
                />
                <button
                  onClick={() => parseSpec()}
                  disabled={!specUrl.trim() || isParsing}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {isParsing ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
            </div>
          )}

          {/* Custom Base URL Override */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Override Base URL <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder={projectBaseUrl || 'http://localhost:3000'}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Override the base URL from the spec for local testing
            </p>
          </div>
        </>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        </div>
      )}

      {/* Parse Result Preview */}
      {parseResult && !generatedTests.length && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <h4 className="font-semibold text-foreground mb-2">{parseResult.title}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <span className="text-muted-foreground">Version:</span>{' '}
              <span className="font-medium">{parseResult.version}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Endpoints:</span>{' '}
              <span className="font-medium">{parseResult.endpointCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Base URL:</span>{' '}
              <span className="font-medium font-mono text-xs">{parseResult.baseUrl || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Tags:</span>{' '}
              <span className="font-medium">{parseResult.tags.length}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={generateTests}
              disabled={isGenerating}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isGenerating ? 'Generating Tests...' : `Generate ${parseResult.endpointCount} Tests`}
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Generated Tests List */}
      {generatedTests.length > 0 && (
        <div className="space-y-4">
          {/* Summary Header */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-foreground">
                Generated Tests ({selectedCount}/{generatedTests.length} selected)
              </h4>
              <p className="text-sm text-muted-foreground">
                Select tests to add to your test suite
              </p>
            </div>
            <button
              onClick={reset}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              New Spec
            </button>
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-input text-foreground"
            >
              <option value="all">All Methods</option>
              {uniqueMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search endpoints..."
              className="flex-1 min-w-[150px] px-3 py-1.5 text-sm border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground"
            />
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Deselect All
            </button>
          </div>

          {/* Tests List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {filteredTests.map(test => (
              <div
                key={test.operationId}
                className={`rounded-lg border ${test.selected ? 'border-primary bg-primary/5' : 'border-border bg-card'} transition-colors`}
              >
                <div className="p-3 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={test.selected}
                    onChange={() => toggleTestSelection(test.operationId)}
                    className="mt-1 rounded border-border"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[test.method] || 'bg-muted'}`}>
                        {test.method}
                      </span>
                      <code className="text-sm font-mono text-foreground truncate">{test.path}</code>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{test.summary}</p>
                  </div>
                  <button
                    onClick={() => setExpandedTest(expandedTest === test.operationId ? null : test.operationId)}
                    className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  >
                    {expandedTest === test.operationId ? 'Hide' : 'View'}
                  </button>
                </div>

                {/* Expanded Code Preview */}
                {expandedTest === test.operationId && (
                  <div className="border-t border-border p-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">{test.testName}</span>
                    </div>
                    <pre className="bg-muted/50 border border-border rounded-lg p-3 overflow-x-auto text-xs font-mono">
                      <code>{test.testCode}</code>
                    </pre>
                  </div>
                )}
              </div>
            ))}

            {filteredTests.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No tests match your filters
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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
 * Feature #593: Added OpenAPI mode toggle
 */
export const AIGenerateStep: React.FC<AIGenerateStepProps> = ({
 onContinue: _onContinue, // Feature #513: prefixed - continuation handled via onChange callback
 onChange,
 initialDescription: _initialDescription = '', // Feature #513: prefixed - not used, input starts empty
 projectBaseUrl,
}) => {
 // Feature #593: Mode toggle between text and openapi
 const [inputMode, setInputMode] = useState<AIGenInputMode>('text');
 const [openAPITests, setOpenAPITests] = useState<OpenAPIGeneratedTest[]>([]);

 // Feature #513: isReady check moved to useEffect, prefixing unused
 // Feature #588: Enable useAIService to call backend /api/v1/ai/parse-intent for real AI parsing
 const { input, isParsing, result, setInput, isReady: _isReady, updateResult, error } = useAIParser({
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
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
 </svg>
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
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
 </svg>
 OpenAPI Spec
 </button>
 </div>

 {/* Feature #593: Conditional rendering based on mode */}
 {inputMode === 'text' ? (
 <>
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
   {/* Feature #588: Show AI analyzing when using backend service */}
   AI Analyzing...
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

 {/* Feature #588: Error Display */}
 {error && (
 <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
  <p className="text-sm text-destructive flex items-center gap-2">
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  {error}
  </p>
  <p className="text-xs text-muted-foreground mt-1">
  Using local parsing as fallback. Your test configuration may have reduced accuracy.
  </p>
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
