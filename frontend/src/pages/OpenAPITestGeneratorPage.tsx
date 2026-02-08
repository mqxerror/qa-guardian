/**
 * OpenAPI Test Generator Page
 * Feature #324: Generate Playwright tests from OpenAPI/Swagger specifications
 *
 * Allows users to:
 * - Upload OpenAPI spec file (JSON or YAML)
 * - Paste spec URL for auto-fetch
 * - Preview parsed endpoints
 * - Generate Playwright tests for each endpoint
 * - Copy/save generated tests
 */

import React, { useState, useRef } from 'react';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';

interface GeneratedTest {
 path: string;
 method: string;
 operationId: string;
 summary: string;
 tags: string[];
 testName: string;
 testCode: string;
}

interface ParseResult {
 title: string;
 version: string;
 baseUrl: string;
 endpointCount: number;
 tags: Array<{ name: string; description?: string }>;
 paths: Array<{ path: string; methods: string[] }>;
}

interface GenerationResult {
 apiTitle: string;
 baseUrl: string;
 specVersion: string;
 summary: {
 total: number;
 byMethod: Record<string, number>;
 byTag: Record<string, number>;
 };
 tests: GeneratedTest[];
}

type TabType = 'upload' | 'url';

export function OpenAPITestGeneratorPage() {
 const { token } = useAuthStore();
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Input state
 const [activeTab, setActiveTab] = useState<TabType>('upload');
 const [specContent, setSpecContent] = useState('');
 const [specUrl, setSpecUrl] = useState('');
 const [customBaseUrl, setCustomBaseUrl] = useState('');
 const [fileName, setFileName] = useState('');

 // Loading/error state
 const [isParsing, setIsParsing] = useState(false);
 const [isGenerating, setIsGenerating] = useState(false);
 const [error, setError] = useState<string | null>(null);

 // Results state
 const [parseResult, setParseResult] = useState<ParseResult | null>(null);
 const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
 const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
 const [expandedTest, setExpandedTest] = useState<string | null>(null);
 const [copiedTest, setCopiedTest] = useState<string | null>(null);

 // Filter state
 const [methodFilter, setMethodFilter] = useState<string>('all');
 const [tagFilter, setTagFilter] = useState<string>('all');
 const [searchFilter, setSearchFilter] = useState('');

 const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (!file) return;

 setFileName(file.name);
 setError(null);

 try {
 const content = await file.text();
 setSpecContent(content);

 // Auto-parse on file select
 await parseSpec(content);
 } catch (err) {
 setError('Failed to read file');
 }
 };

 const parseSpec = async (content?: string) => {
 setIsParsing(true);
 setError(null);
 setParseResult(null);
 setGenerationResult(null);

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
 paths: data.paths || [],
 });
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to parse specification');
 } finally {
 setIsParsing(false);
 }
 };

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

 setGenerationResult({
 apiTitle: data.apiTitle,
 baseUrl: data.baseUrl,
 specVersion: data.specVersion,
 summary: data.summary,
 tests: data.tests,
 });

 // Select all tests by default
 setSelectedTests(new Set(data.tests.map((t: GeneratedTest) => t.operationId)));
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to generate tests');
 } finally {
 setIsGenerating(false);
 }
 };

 const copyToClipboard = async (text: string, testId: string) => {
 try {
 await navigator.clipboard.writeText(text);
 setCopiedTest(testId);
 setTimeout(() => setCopiedTest(null), 2000);
 } catch (err) {
 console.error('Failed to copy:', err);
 }
 };

 const copyAllSelected = async () => {
 if (!generationResult) return;

 const selectedCode = generationResult.tests
 .filter(t => selectedTests.has(t.operationId))
 .map(t => `// ${t.testName}\n${t.testCode}`)
 .join('\n\n// ===================================\n\n');

 await copyToClipboard(selectedCode, 'all');
 };

 const downloadAllSelected = () => {
 if (!generationResult) return;

 const selectedTestsList = generationResult.tests.filter(t => selectedTests.has(t.operationId));

 for (const test of selectedTestsList) {
 const blob = new Blob([test.testCode], { type: 'text/typescript' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = test.testName;
 a.click();
 URL.revokeObjectURL(url);
 }
 };

 const toggleTestSelection = (operationId: string) => {
 const newSelection = new Set(selectedTests);
 if (newSelection.has(operationId)) {
 newSelection.delete(operationId);
 } else {
 newSelection.add(operationId);
 }
 setSelectedTests(newSelection);
 };

 const selectAll = () => {
 if (!generationResult) return;
 setSelectedTests(new Set(filteredTests.map(t => t.operationId)));
 };

 const deselectAll = () => {
 setSelectedTests(new Set());
 };

 const reset = () => {
 setSpecContent('');
 setSpecUrl('');
 setFileName('');
 setParseResult(null);
 setGenerationResult(null);
 setSelectedTests(new Set());
 setError(null);
 if (fileInputRef.current) {
 fileInputRef.current.value = '';
 }
 };

 // Filter tests
 const filteredTests = generationResult?.tests.filter(test => {
 if (methodFilter !== 'all' && test.method !== methodFilter) return false;
 if (tagFilter !== 'all' && !test.tags.includes(tagFilter)) return false;
 if (searchFilter) {
 const search = searchFilter.toLowerCase();
 return (
 test.path.toLowerCase().includes(search) ||
 test.operationId.toLowerCase().includes(search) ||
 test.summary.toLowerCase().includes(search)
 );
 }
 return true;
 }) || [];

 const methodColors: Record<string, string> = {
 GET: 'bg-green-100 text-green-700',
 POST: 'bg-blue-100 text-blue-700',
 PUT: 'bg-amber-100 text-amber-700',
 PATCH: 'bg-purple-100 text-purple-700',
 DELETE: 'bg-red-100 text-red-700',
 };

 return (
 <Layout>
 <div className="p-8 max-w-7xl mx-auto">
 {/* Header */}
 <div className="mb-8">
 <h1 className="text-3xl font-bold text-foreground">OpenAPI Test Generator</h1>
 <p className="mt-2 text-muted-foreground">
 Generate Playwright API tests from your OpenAPI/Swagger specification.
 Supports OpenAPI 3.0, 3.1, and Swagger 2.0 in JSON or YAML format.
 </p>
 </div>

 {/* Input Section */}
 {!generationResult && (
 <div className="rounded-lg border border-border bg-card p-6 mb-8">
 {/* Tabs */}
 <div className="flex gap-2 mb-6">
 <button
 onClick={() => setActiveTab('upload')}
 className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
 activeTab === 'upload'
 ? 'bg-primary text-primary-foreground'
 : 'bg-muted text-muted-foreground hover:bg-muted/80'
 }`}
 >
 Upload File
 </button>
 <button
 onClick={() => setActiveTab('url')}
 className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
 activeTab === 'url'
 ? 'bg-primary text-primary-foreground'
 : 'bg-muted text-muted-foreground hover:bg-muted/80'
 }`}
 >
 Fetch from URL
 </button>
 </div>

 {activeTab === 'upload' && (
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 OpenAPI Specification File
 </label>
 <div className="flex items-center gap-4">
 <input
 ref={fileInputRef}
 type="file"
 accept=".json,.yaml,.yml"
 onChange={handleFileSelect}
 className="hidden"
 />
 <button
 onClick={() => fileInputRef.current?.click()}
 className="rounded-md border border-dashed border-border bg-muted px-4 py-8 w-full text-center hover:bg-muted/80 transition-colors"
 >
 <div className="text-muted-foreground">
 <svg className="mx-auto h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
 </svg>
 <p className="font-medium">Click to upload or drag and drop</p>
 <p className="text-sm">JSON or YAML file</p>
 </div>
 </button>
 </div>
 {fileName && (
 <p className="mt-2 text-sm text-muted-foreground">
 Selected: <span className="font-medium text-foreground">{fileName}</span>
 </p>
 )}
 </div>
 )}

 {activeTab === 'url' && (
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
 className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
 />
 <button
 onClick={() => parseSpec()}
 disabled={!specUrl || isParsing}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isParsing ? 'Fetching...' : 'Fetch'}
 </button>
 </div>
 </div>
 )}

 {/* Custom Base URL */}
 <div className="mt-4">
 <label className="block text-sm font-medium text-foreground mb-2">
 Override Base URL (optional)
 </label>
 <input
 type="url"
 value={customBaseUrl}
 onChange={(e) => setCustomBaseUrl(e.target.value)}
 placeholder="http://localhost:3000"
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
 />
 <p className="mt-1 text-xs text-muted-foreground">
 Override the base URL from the spec for local testing
 </p>
 </div>

 {/* Error */}
 {error && (
 <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-3">
 <p className="text-sm text-destructive">{error}</p>
 </div>
 )}

 {/* Parse Result Preview */}
 {parseResult && (
 <div className="mt-6 rounded-md border border-border bg-muted/50 p-4">
 <h3 className="font-semibold text-foreground mb-2">{parseResult.title}</h3>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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

 {/* Generate Button */}
 <div className="mt-4 flex gap-2">
 <button
 onClick={generateTests}
 disabled={isGenerating}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isGenerating ? 'Generating Tests...' : `Generate ${parseResult.endpointCount} Tests`}
 </button>
 <button
 onClick={reset}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 >
 Reset
 </button>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Generation Results */}
 {generationResult && (
 <div>
 {/* Summary */}
 <div className="rounded-lg border border-border bg-card p-6 mb-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h2 className="text-xl font-semibold text-foreground">{generationResult.apiTitle}</h2>
 <p className="text-sm text-muted-foreground">
 {generationResult.summary.total} tests generated • Base URL: {generationResult.baseUrl}
 </p>
 </div>
 <button
 onClick={reset}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 >
 New Spec
 </button>
 </div>

 {/* Method Stats */}
 <div className="flex flex-wrap gap-2 mb-4">
 {Object.entries(generationResult.summary.byMethod).map(([method, count]) => (
 <span key={method} className={`px-2 py-1 rounded text-xs font-medium ${methodColors[method] || 'bg-gray-100'}`}>
 {method}: {count}
 </span>
 ))}
 </div>

 {/* Actions */}
 <div className="flex flex-wrap gap-2">
 <button
 onClick={selectAll}
 className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80"
 >
 Select All ({filteredTests.length})
 </button>
 <button
 onClick={deselectAll}
 className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80"
 >
 Deselect All
 </button>
 <button
 onClick={copyAllSelected}
 disabled={selectedTests.size === 0}
 className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {copiedTest === 'all' ? 'Copied!' : `Copy Selected (${selectedTests.size})`}
 </button>
 <button
 onClick={downloadAllSelected}
 disabled={selectedTests.size === 0}
 className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
 >
 Download Selected
 </button>
 </div>
 </div>

 {/* Filters */}
 <div className="flex flex-wrap gap-4 mb-6">
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">Method</label>
 <select
 value={methodFilter}
 onChange={(e) => setMethodFilter(e.target.value)}
 className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
 >
 <option value="all">All Methods</option>
 {Object.keys(generationResult.summary.byMethod).map(method => (
 <option key={method} value={method}>{method}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-1">Tag</label>
 <select
 value={tagFilter}
 onChange={(e) => setTagFilter(e.target.value)}
 className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
 >
 <option value="all">All Tags</option>
 {Object.keys(generationResult.summary.byTag).map(tag => (
 <option key={tag} value={tag}>{tag}</option>
 ))}
 </select>
 </div>
 <div className="flex-1 min-w-[200px]">
 <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
 <input
 type="text"
 value={searchFilter}
 onChange={(e) => setSearchFilter(e.target.value)}
 placeholder="Search endpoints..."
 className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
 />
 </div>
 </div>

 {/* Tests List */}
 <div className="space-y-3">
 {filteredTests.map(test => (
 <div
 key={test.operationId}
 className={`rounded-lg border ${selectedTests.has(test.operationId) ? 'border-primary' : 'border-border'} bg-card transition-colors`}
 >
 {/* Test Header */}
 <div className="p-4 flex items-start gap-4">
 <input
 type="checkbox"
 checked={selectedTests.has(test.operationId)}
 onChange={() => toggleTestSelection(test.operationId)}
 className="mt-1 rounded border-gray-300"
 />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className={`px-2 py-0.5 rounded text-xs font-bold ${methodColors[test.method] || 'bg-gray-100'}`}>
 {test.method}
 </span>
 <code className="text-sm font-mono text-foreground truncate">{test.path}</code>
 </div>
 <p className="text-sm text-muted-foreground mt-1">{test.summary}</p>
 <div className="flex flex-wrap gap-1 mt-2">
 {test.tags.map(tag => (
 <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
 {tag}
 </span>
 ))}
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => copyToClipboard(test.testCode, test.operationId)}
 className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
 >
 {copiedTest === test.operationId ? 'Copied!' : 'Copy'}
 </button>
 <button
 onClick={() => setExpandedTest(expandedTest === test.operationId ? null : test.operationId)}
 className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
 >
 {expandedTest === test.operationId ? 'Hide' : 'View'}
 </button>
 </div>
 </div>

 {/* Expanded Code */}
 {expandedTest === test.operationId && (
 <div className="border-t border-border p-4 bg-muted/30">
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-medium text-muted-foreground">{test.testName}</span>
 <button
 onClick={() => copyToClipboard(test.testCode, test.operationId)}
 className="text-xs text-primary hover:underline"
 >
 Copy Code
 </button>
 </div>
 <pre className="bg-background border border-border rounded-md p-4 overflow-x-auto text-sm">
 <code>{test.testCode}</code>
 </pre>
 </div>
 )}
 </div>
 ))}

 {filteredTests.length === 0 && (
 <div className="text-center py-12 text-muted-foreground">
 No tests match your filters
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </Layout>
 );
}
