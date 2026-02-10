/**
 * OpenAPIMode - OpenAPI specification parser and test generator
 * Feature #593: Parse OpenAPI spec and generate tests
 * Feature #610: Extracted from AIGenerateStep.tsx
 */
import React, { useState, useRef } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import {
  METHOD_COLORS,
  type OpenAPIInputMethod,
  type OpenAPIGeneratedTest,
  type OpenAPIParseResult,
} from './types';

/**
 * Props for OpenAPIMode
 */
export interface OpenAPIModeProps {
  projectBaseUrl?: string;
  onTestsGenerated: (tests: OpenAPIGeneratedTest[]) => void;
  onValidityChange: (isValid: boolean) => void;
}

/**
 * OpenAPIMode component
 * Allows parsing OpenAPI specs via paste, upload, or URL and generating tests
 */
export const OpenAPIMode: React.FC<OpenAPIModeProps> = ({
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

OpenAPIMode.displayName = 'OpenAPIMode';
