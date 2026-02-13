// ============================================================================
// FEATURE #1495: AI Test Generator Page
// FEATURE #1497: Test regeneration with feedback
// FEATURE #1499: Add test generation history and versioning
// Allows users to generate Playwright tests from natural language descriptions
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Button } from '@/components/ui/button';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStates, EmptyStateIcons } from '../components/ui/EmptyState';
import { CodeDiffView } from '../components/diff';
import { ConfidenceBreakdown, MonacoTestEditor } from '../components/ai';

interface ConfidenceDetails {
 level: 'high' | 'medium' | 'low';
 score: number;
 reasons?: string[];
 suggestions?: string[];
}

interface GeneratedTest {
 test_name: string;
 test_code: string;
 language: string;
 confidence_score?: number;
 confidence_details?: ConfidenceDetails;
 suggested_variations?: string[];
 improvement_suggestions?: string[];
 ai_metadata?: {
 provider: string;
 model: string;
 used_real_ai: boolean;
 };
 data_source: string;
 version?: number;
}

interface VersionHistory {
 version: number;
 code: string;
 feedback?: string;
 timestamp: Date;
}

interface GenerationOptions {
 language: 'typescript' | 'javascript';
 includeComments: boolean;
 includeAssertions: boolean;
 targetUrl: string;
 testFramework: string;
}

// Feature #1499: Saved generation from history API
// Feature #1500: Approval workflow
interface ApprovalInfo {
 status: 'pending' | 'approved' | 'rejected';
 reviewed_by?: string;
 reviewed_by_name?: string;
 reviewed_at?: string;
 review_comment?: string;
}

interface SavedGeneration {
 id: string;
 description: string;
 test_name: string;
 generated_code: string;
 language: string;
 confidence_score: number;
 confidence_level: 'high' | 'medium' | 'low';
 version: number;
 feedback?: string;
 ai_metadata?: {
 provider: string;
 model: string;
 used_real_ai: boolean;
 };
 approval?: ApprovalInfo;
 created_at: string;
}

export function AITestGeneratorPage() {
 const [description, setDescription] = useState('');
 const [options, setOptions] = useState<GenerationOptions>({
 language: 'typescript',
 includeComments: true,
 includeAssertions: true,
 targetUrl: '',
 testFramework: 'playwright-test',
 });
 const [isGenerating, setIsGenerating] = useState(false);
 const [isRegenerating, setIsRegenerating] = useState(false);
 const [generatedTest, setGeneratedTest] = useState<GeneratedTest | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [copied, setCopied] = useState(false);
 const [feedback, setFeedback] = useState('');
 const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([]);

 // Feature #326: Code diff view state for regeneration
 const [showDiffView, setShowDiffView] = useState(false);
 const [originalCodeBeforeRegen, setOriginalCodeBeforeRegen] = useState<string | null>(null);
 const [pendingNewCode, setPendingNewCode] = useState<string | null>(null);

 // Feature #1499: History panel state
 const [savedHistory, setSavedHistory] = useState<SavedGeneration[]>([]);
 const [showHistory, setShowHistory] = useState(false);
 const [isLoadingHistory, setIsLoadingHistory] = useState(false);
 const [historySearch, setHistorySearch] = useState('');

 // Example descriptions for quick start
 const exampleDescriptions = [
 'Test that a user can login with valid email and password, then see the dashboard',
 'Verify that adding an item to cart updates the cart count and shows the item in the cart page',
 'Test the search functionality by entering a query and verifying results are displayed',
 'Ensure the contact form validates required fields and shows success message on submit',
 ];

 // Helper function to calculate confidence details from score
 const getConfidenceDetails = (score: number): ConfidenceDetails => {
 let level: 'high' | 'medium' | 'low';
 let reasons: string[] = [];
 let suggestions: string[] = [];

 if (score >= 0.8) {
 level = 'high';
 reasons = [
 'Description is clear and specific',
 'Actions and expected outcomes are well-defined',
 'Test scenario is common and well-understood',
 ];
 } else if (score >= 0.5) {
 level = 'medium';
 reasons = [
 'Some details may be ambiguous',
 'Expected outcomes could be more specific',
 'Additional context might improve accuracy',
 ];
 suggestions = [
 'Add specific element identifiers (e.g., button text, field labels)',
 'Clarify the expected success/failure criteria',
 'Include URL paths or page names if applicable',
 ];
 } else {
 level = 'low';
 reasons = [
 'Description lacks specific details',
 'Test scope is unclear or too broad',
 'Missing critical information about expected behavior',
 ];
 suggestions = [
 'Break down into smaller, more specific test cases',
 'Add concrete examples of user actions',
 'Specify exactly what elements to interact with',
 'Define clear success criteria',
 ];
 }

 return { level, score, reasons, suggestions };
 };

 // State for showing confidence tooltip
 const [showConfidenceTooltip, setShowConfidenceTooltip] = useState(false);

 const handleGenerate = async () => {
 if (!description.trim()) {
 setError('Please enter a test description');
 return;
 }

 setIsGenerating(true);
 setError(null);
 setGeneratedTest(null);

 try {
 // Call the MCP API to generate test via the execute endpoint
 const response = await fetch('/api/v1/mcp/execute', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 tool_name: 'generate_test',
 args: {
 description: description.trim(),
 target_url: options.targetUrl || undefined,
 language: options.language,
 include_comments: options.includeComments,
 include_assertions: options.includeAssertions,
 test_framework: options.testFramework,
 },
 use_real_ai: true,
 }),
 });

 const apiResponse = await response.json();

 if (apiResponse.success && apiResponse.result) {
 // Extract the tool result from the execute endpoint response
 const result = apiResponse.result;
 const confidenceScore = result.confidence_score ?? 0.85;
 const confidenceDetails = getConfidenceDetails(confidenceScore);
 const newTest = {
 test_name: result.test_name,
 test_code: result.generated_code,
 language: result.language,
 confidence_score: confidenceScore,
 confidence_details: confidenceDetails,
 suggested_variations: result.suggested_variations,
 improvement_suggestions: result.improvement_suggestions || confidenceDetails.suggestions,
 ai_metadata: result.ai_metadata || apiResponse.metadata,
 data_source: result.data_source,
 version: 1,
 };
 setGeneratedTest(newTest);
 // Initialize version history with first version
 setVersionHistory([{
 version: 1,
 code: result.generated_code,
 timestamp: new Date(),
 }]);
 setFeedback('');
 } else {
 setError(apiResponse.error || 'Failed to generate test');
 }
 } catch (err) {
 setError(`Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
 } finally {
 setIsGenerating(false);
 }
 };

 const handleCopy = async () => {
 if (generatedTest?.test_code) {
 await navigator.clipboard.writeText(generatedTest.test_code);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 }
 };

 const handleDownload = () => {
 if (generatedTest?.test_code) {
 const extension = options.language === 'typescript' ? 'ts' : 'js';
 const filename = `${generatedTest.test_name.replace(/\s+/g, '-').toLowerCase()}.spec.${extension}`;
 const blob = new Blob([generatedTest.test_code], { type: 'text/plain' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 }
 };

 const handleUseExample = (example: string) => {
 setDescription(example);
 setGeneratedTest(null);
 setError(null);
 setVersionHistory([]);
 setFeedback('');
 };

 const handleRegenerate = async () => {
 if (!generatedTest || !feedback.trim()) {
 setError('Please provide feedback for regeneration');
 return;
 }

 setIsRegenerating(true);
 setError(null);

 // Feature #326: Store original code before regeneration
 const originalCode = generatedTest.test_code;

 try {
 // Call the MCP API to regenerate test with feedback via the execute endpoint
 const response = await fetch('/api/v1/mcp/execute', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 tool_name: 'generate_test',
 args: {
 description: description.trim(),
 target_url: options.targetUrl || undefined,
 language: options.language,
 include_comments: options.includeComments,
 include_assertions: options.includeAssertions,
 test_framework: options.testFramework,
 // Include feedback and previous code for regeneration
 feedback: feedback.trim(),
 previous_code: generatedTest.test_code,
 version: generatedTest.version || 1,
 },
 use_real_ai: true,
 }),
 });

 const apiResponse = await response.json();

 if (apiResponse.success && apiResponse.result) {
 const result = apiResponse.result;
 const newVersion = (generatedTest.version || 1) + 1;
 const confidenceScore = result.confidence_score ?? 0.85;
 const confidenceDetails = getConfidenceDetails(confidenceScore);

 // Feature #326: Store original and new code for diff view
 setOriginalCodeBeforeRegen(originalCode);
 setPendingNewCode(result.generated_code);
 setShowDiffView(true);

 // Store the new test metadata (code will be applied after diff review)
 setGeneratedTest({
 ...generatedTest,
 test_name: result.test_name,
 // Keep original code until diff is accepted
 test_code: originalCode,
 language: result.language,
 confidence_score: confidenceScore,
 confidence_details: confidenceDetails,
 suggested_variations: result.suggested_variations,
 improvement_suggestions: result.improvement_suggestions || confidenceDetails.suggestions,
 ai_metadata: result.ai_metadata || apiResponse.metadata,
 data_source: result.data_source,
 version: newVersion,
 });

 // Prepare version history entry (will be added after diff is accepted)
 setFeedback(feedback.trim()); // Keep feedback for version history
 } else {
 setError(apiResponse.error || 'Failed to regenerate test');
 }
 } catch (err) {
 setError(`Regeneration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
 } finally {
 setIsRegenerating(false);
 }
 };

 // Feature #326: Handle diff view accept - apply merged code
 const handleDiffApply = (mergedCode: string) => {
 if (generatedTest) {
 // Update test with merged code
 setGeneratedTest({
 ...generatedTest,
 test_code: mergedCode,
 });

 // Add to version history
 setVersionHistory(prev => [...prev, {
 version: generatedTest.version || 1,
 code: mergedCode,
 feedback: feedback,
 timestamp: new Date(),
 }]);

 // Clear diff state
 setShowDiffView(false);
 setOriginalCodeBeforeRegen(null);
 setPendingNewCode(null);
 setFeedback('');
 }
 };

 // Feature #326: Handle diff view cancel - keep original code
 const handleDiffCancel = () => {
 if (generatedTest && originalCodeBeforeRegen) {
 // Revert version and keep original code
 setGeneratedTest({
 ...generatedTest,
 version: (generatedTest.version || 2) - 1,
 test_code: originalCodeBeforeRegen,
 });
 }

 // Clear diff state
 setShowDiffView(false);
 setOriginalCodeBeforeRegen(null);
 setPendingNewCode(null);
 };

 const handleRestoreVersion = (version: VersionHistory) => {
 if (generatedTest) {
 setGeneratedTest({
 ...generatedTest,
 test_code: version.code,
 version: version.version,
 });
 }
 };

 // Feature #1499: Fetch history from API
 const fetchHistory = async () => {
 setIsLoadingHistory(true);
 try {
 const params = new URLSearchParams();
 if (historySearch) {
 params.set('description_search', historySearch);
 }
 params.set('limit', '20');

 const response = await fetch(`/api/v1/ai/generation-history?${params.toString()}`);
 const result = await response.json();

 if (result.items) {
 setSavedHistory(result.items);
 }
 } catch (err) {
 console.error('Failed to fetch history:', err);
 } finally {
 setIsLoadingHistory(false);
 }
 };

 // Feature #1499: Save generated test to history
 const saveToHistory = async () => {
 if (!generatedTest) return;

 try {
 await fetch('/api/v1/ai/generation-history', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 description: description.trim(),
 generated_code: generatedTest.test_code,
 test_name: generatedTest.test_name,
 language: generatedTest.language,
 confidence_score: generatedTest.confidence_score || 0.85,
 version: generatedTest.version || 1,
 ai_metadata: generatedTest.ai_metadata,
 options: {
 target_url: options.targetUrl,
 include_comments: options.includeComments,
 include_assertions: options.includeAssertions,
 test_framework: options.testFramework,
 },
 suggested_variations: generatedTest.suggested_variations,
 improvement_suggestions: generatedTest.improvement_suggestions,
 }),
 });
 // Refresh history after saving
 if (showHistory) {
 fetchHistory();
 }
 } catch (err) {
 console.error('Failed to save to history:', err);
 }
 };

 // Feature #1499: Load a saved generation from history
 const loadFromHistory = (saved: SavedGeneration) => {
 setDescription(saved.description);
 const confidenceDetails = getConfidenceDetails(saved.confidence_score);
 setGeneratedTest({
 test_name: saved.test_name,
 test_code: saved.generated_code,
 language: saved.language,
 confidence_score: saved.confidence_score,
 confidence_details: confidenceDetails,
 ai_metadata: saved.ai_metadata,
 data_source: 'history',
 version: saved.version,
 });
 setVersionHistory([{
 version: saved.version,
 code: saved.generated_code,
 timestamp: new Date(saved.created_at),
 feedback: saved.feedback,
 }]);
 setShowHistory(false);
 setFeedback('');
 };

 // Fetch history when panel opens or search changes
 useEffect(() => {
 if (showHistory) {
 fetchHistory();
 }
 }, [showHistory, historySearch]);

 return (
 <Layout>
 <div className="max-w-6xl mx-auto p-6 space-y-6">
 {/* Feature #640: PageHeader component */}
 <PageHeader
   title="AI Test Generator"
   description="Generate Playwright tests from natural language descriptions using Claude AI"
   breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'AI Features', href: '/ai-insights' }, { label: 'Test Generator' }]}
   actions={
     <Button
       variant={showHistory ? 'default' : 'outline'}
       onClick={() => setShowHistory(!showHistory)}
       className="flex items-center gap-2"
     >
       History
     </Button>
   }
 />

 {/* History Panel - Feature #1499 */}
 {showHistory && (
 <div className="bg-card rounded-lg border border-border p-4 space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="font-medium text-foreground flex items-center gap-2">
 <span>📜</span>
 Generation History
 </h3>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => setShowHistory(false)}
 className="text-muted-foreground hover:text-foreground h-8 w-8"
 >
 ✕
 </Button>
 </div>

 {/* Search */}
 <input
 type="text"
 value={historySearch}
 onChange={(e) => setHistorySearch(e.target.value)}
 placeholder="Search by description or test name..."
 className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
 />

 {/* History List */}
 <div className="space-y-2 max-h-80 overflow-y-auto">
 {isLoadingHistory ? (
 <div className="text-center py-4 text-muted-foreground">
 <Loader2 className="animate-spin h-5 w-5 mx-auto mb-2" />
 Loading history...
 </div>
 ) : savedHistory.length === 0 ? (
 /* Feature #728: EmptyState adoption */
 historySearch
 ? EmptyStates.noSearchResults(historySearch)
 : <EmptyState icon={EmptyStateIcons.test} title="No saved tests yet" description="Generate a test to see it in your history." size="sm" />
 ) : (
 savedHistory.map((item) => (
 <div
 key={item.id}
 onClick={() => loadFromHistory(item)}
 className="p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
 >
 <div className="flex items-center justify-between mb-1">
 <span className="font-medium text-foreground text-sm truncate max-w-[60%]">
 {item.test_name}
 </span>
 <div className="flex items-center gap-2">
 <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
 item.confidence_level === 'high'
 ? 'bg-success/10 text-success'
 : item.confidence_level === 'medium'
 ? 'bg-warning/10 text-warning'
 : 'bg-destructive/10 text-destructive'
 }`}>
 {Math.round(item.confidence_score * 100)}%
 </span>
 <span className="text-xs text-muted-foreground">
 v{item.version}
 </span>
 </div>
 </div>
 <p className="text-xs text-muted-foreground truncate">
 {item.description}
 </p>
 <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
 <span>{new Date(item.created_at).toLocaleDateString()}</span>
 <span>•</span>
 <span>{item.language}</span>
 {item.approval && (
 <>
 <span>•</span>
 <span className={`${
 item.approval.status === 'approved'
 ? 'text-success'
 : item.approval.status === 'rejected'
 ? 'text-destructive'
 : 'text-warning'
 }`}>
 {item.approval.status === 'approved' ? '✓ Approved' :
 item.approval.status === 'rejected' ? '✕ Rejected' :
 '⏳ Pending'}
 </span>
 </>
 )}
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Input Section */}
 <div className="space-y-4">
 {/* Description Input */}
 <div className="bg-card rounded-lg border border-border p-4 space-y-4">
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Test Description
 </label>
 <textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Describe the test you want to create in natural language...

Example: Test that a user can login with valid credentials and see the welcome message on the dashboard"
 className="w-full h-40 px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
 />
 <p className="text-xs text-muted-foreground mt-1">
 Be specific about the actions, elements, and expected outcomes
 </p>
 </div>

 {/* Quick Examples */}
 <div>
 <label className="block text-xs font-medium text-muted-foreground mb-2">
 Quick Examples
 </label>
 <div className="flex flex-wrap gap-2">
 {exampleDescriptions.map((example, index) => (
 <Button
 key={index}
 variant="secondary"
 size="sm"
 onClick={() => handleUseExample(example)}
 className="text-xs rounded-full truncate max-w-[200px]"
 title={example}
 >
 {example.substring(0, 30)}...
 </Button>
 ))}
 </div>
 </div>
 </div>

 {/* Options */}
 <div className="bg-card rounded-lg border border-border p-4 space-y-4">
 <h3 className="font-medium text-foreground">Generation Options</h3>

 {/* Target URL */}
 <div>
 <label className="block text-sm font-medium text-muted-foreground mb-1">
 Target URL (optional)
 </label>
 <input
 type="text"
 value={options.targetUrl}
 onChange={(e) => setOptions({ ...options, targetUrl: e.target.value })}
 placeholder="https://example.com"
 className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
 />
 </div>

 {/* Language */}
 <div>
 <label className="block text-sm font-medium text-muted-foreground mb-1">
 Language
 </label>
 <select
 value={options.language}
 onChange={(e) => setOptions({ ...options, language: e.target.value as 'typescript' | 'javascript' })}
 className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
 >
 <option value="typescript">TypeScript</option>
 <option value="javascript">JavaScript</option>
 </select>
 </div>

 {/* Checkboxes */}
 <div className="flex flex-wrap gap-4">
 <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
 <input
 type="checkbox"
 checked={options.includeComments}
 onChange={(e) => setOptions({ ...options, includeComments: e.target.checked })}
 className="rounded border-input"
 />
 Include comments
 </label>
 <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
 <input
 type="checkbox"
 checked={options.includeAssertions}
 onChange={(e) => setOptions({ ...options, includeAssertions: e.target.checked })}
 className="rounded border-input"
 />
 Include assertions
 </label>
 </div>
 </div>

 {/* Generate Button */}
 <Button
 onClick={handleGenerate}
 disabled={isGenerating || !description.trim()}
 className="w-full py-3 flex items-center justify-center gap-2"
 size="lg"
 >
 {isGenerating ? (
 <>
 <Loader2 className="animate-spin h-5 w-5" />
 Generating with AI...
 </>
 ) : (
 'Generate Test'
 )}
 </Button>

 {/* Error Message */}
 {error && (
 <div role="alert" className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
 {error}
 </div>
 )}
 </div>

 {/* Output Section */}
 <div className="space-y-4">
 {generatedTest ? (
 <>
 {/* Test Info */}
 <div className="bg-card rounded-lg border border-border p-4 space-y-3">
 <div className="flex items-center justify-between">
 <h3 className="font-medium text-foreground">{generatedTest.test_name}</h3>
 <div className="flex items-center gap-2">
 {/* Confidence Badge with Tooltip */}
 {generatedTest.confidence_score !== undefined && (
 <div className="relative">
 <Button
 variant="ghost"
 size="sm"
 onMouseEnter={() => setShowConfidenceTooltip(true)}
 onMouseLeave={() => setShowConfidenceTooltip(false)}
 onClick={() => setShowConfidenceTooltip(!showConfidenceTooltip)}
 className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-help h-auto ${
 generatedTest.confidence_score >= 0.8
 ? 'bg-success/10 text-success hover:bg-success/20'
 : generatedTest.confidence_score >= 0.5
 ? 'bg-warning/10 text-warning hover:bg-warning/20'
 : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
 }`}
 >
 <span>{
 generatedTest.confidence_score >= 0.8 ? '✓' :
 generatedTest.confidence_score >= 0.5 ? '!' : '⚠'
 }</span>
 <span>
 {generatedTest.confidence_details?.level.charAt(0).toUpperCase()}
 {generatedTest.confidence_details?.level.slice(1) || (
 generatedTest.confidence_score >= 0.8 ? 'High' :
 generatedTest.confidence_score >= 0.5 ? 'Medium' : 'Low'
 )} ({Math.round(generatedTest.confidence_score * 100)}%)
 </span>
 </Button>
 {/* Confidence Tooltip */}
 {showConfidenceTooltip && (
 <div className="absolute z-50 top-full right-0 mt-2 w-72 p-3 rounded-lg bg-popover border border-border shadow-lg">
 <div className="space-y-2">
 <div className="text-sm font-medium text-foreground">
 Confidence Score: {Math.round(generatedTest.confidence_score * 100)}%
 </div>
 <div className="text-xs text-muted-foreground">
 Based on description clarity, specificity of actions, and expected outcomes.
 </div>
 {generatedTest.confidence_details?.reasons && generatedTest.confidence_details.reasons.length > 0 && (
 <div className="pt-2 border-t border-border">
 <div className="text-xs font-medium text-muted-foreground mb-1">Why this score:</div>
 <ul className="space-y-1">
 {generatedTest.confidence_details.reasons.map((reason, idx) => (
 <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
 <span className={generatedTest.confidence_score! >= 0.8 ? 'text-success' : generatedTest.confidence_score! >= 0.5 ? 'text-warning' : 'text-destructive'}>•</span>
 {reason}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 )}
 <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
 {generatedTest.language}
 </span>
 </div>
 </div>

 {/* AI Metadata */}
 {generatedTest.ai_metadata && (
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <span>🤖</span>
 <span>Generated by {generatedTest.ai_metadata.provider}</span>
 {generatedTest.ai_metadata.used_real_ai && (
 <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">
 Real AI
 </span>
 )}
 </div>
 )}

 {/* Confidence Suggestions - Show when confidence is low or medium */}
 {generatedTest.confidence_score !== undefined && generatedTest.confidence_score < 0.8 && (
 <div className={`p-3 rounded-lg ${
 generatedTest.confidence_score >= 0.5
 ? 'bg-warning/5 border border-warning/20'
 : 'bg-destructive/5 border border-destructive/20'
 }`}>
 <div className="flex items-start gap-2">
 <span className={`text-sm ${
 generatedTest.confidence_score >= 0.5 ? 'text-warning' : 'text-destructive'
 }`}>💡</span>
 <div className="flex-1">
 <div className={`text-xs font-medium mb-1 ${
 generatedTest.confidence_score >= 0.5 ? 'text-warning' : 'text-destructive'
 }`}>
 Suggestions to improve test accuracy:
 </div>
 <ul className="space-y-0.5">
 {(generatedTest.improvement_suggestions || generatedTest.confidence_details?.suggestions || []).map((suggestion, idx) => (
 <li key={idx} className={`text-xs ${
 generatedTest.confidence_score! >= 0.5 ? 'text-warning' : 'text-destructive'
 }`}>
 • {suggestion}
 </li>
 ))}
 </ul>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Feature #331: AI Confidence Sub-scores Breakdown */}
 {generatedTest.confidence_score !== undefined && (
 <ConfidenceBreakdown
 overallScore={generatedTest.confidence_score}
 className="mt-4"
 />
 )}

 {/* Generated Code - Feature #325: Monaco Editor Integration */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-muted-foreground">Generated Code</span>
 <Button
 variant="outline"
 size="sm"
 onClick={saveToHistory}
 className="text-xs flex items-center gap-1"
 title="Save to history"
 >
 Save to History
 </Button>
 </div>
 <MonacoTestEditor
 code={generatedTest.test_code}
 language={options.language}
 onChange={(newCode) => {
 // Allow editing the generated code
 setGeneratedTest({
 ...generatedTest,
 test_code: newCode,
 });
 }}
 readOnly={false}
 theme="auto"
 height="400px"
 showMinimap={true}
 showLineNumbers={true}
 wordWrap="on"
 fontSize={14}
 onSave={saveToHistory}
 onCopy={() => {
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 }}
 onDownload={handleDownload}
 />
 {copied && (
 <div className="text-xs text-success flex items-center gap-1">
 <span>✓</span> Copied to clipboard!
 </div>
 )}
 </div>

 {/* Feature #326: Code Diff View for Regeneration */}
 {showDiffView && originalCodeBeforeRegen && pendingNewCode && (
 <div className="bg-card rounded-lg border-2 border-primary/50 overflow-hidden">
 <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-primary/30">
 <span className="text-sm font-medium text-foreground flex items-center gap-2">
 <span>🔄</span>
 Review Changes Before Applying
 </span>
 <span className="text-xs text-muted-foreground">
 Accept or reject individual changes
 </span>
 </div>
 <CodeDiffView
 originalCode={originalCodeBeforeRegen}
 newCode={pendingNewCode}
 onApply={handleDiffApply}
 onCancel={handleDiffCancel}
 />
 </div>
 )}

 {/* Suggested Variations */}
 {generatedTest.suggested_variations && generatedTest.suggested_variations.length > 0 && (
 <div className="bg-card rounded-lg border border-border p-4 space-y-2">
 <h4 className="text-sm font-medium text-foreground">Suggested Test Variations</h4>
 <ul className="space-y-1">
 {generatedTest.suggested_variations.map((variation, index) => (
 <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
 <span className="text-primary">•</span>
 {variation}
 </li>
 ))}
 </ul>
 </div>
 )}

 {/* Regenerate with Feedback Section - Hidden during diff review */}
 {!showDiffView && (
 <div className="bg-card rounded-lg border border-border p-4 space-y-4">
 <div className="flex items-center justify-between">
 <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
 <span>🔄</span>
 Regenerate with Feedback
 </h4>
 {generatedTest.version && generatedTest.version > 1 && (
 <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
 Version {generatedTest.version}
 </span>
 )}
 </div>
 <p className="text-xs text-muted-foreground">
 Not satisfied with the generated test? Provide feedback and regenerate.
 </p>
 <textarea
 value={feedback}
 onChange={(e) => setFeedback(e.target.value)}
 placeholder="Example: Add more assertions for error handling, use data-testid selectors, make the test more robust..."
 className="w-full h-24 px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
 />
 <Button
 variant="secondary"
 onClick={handleRegenerate}
 disabled={isRegenerating || !feedback.trim()}
 className="w-full flex items-center justify-center gap-2 text-sm"
 >
 {isRegenerating ? (
 <>
 <Loader2 className="animate-spin h-4 w-4" />
 Regenerating...
 </>
 ) : (
 'Regenerate Test'
 )}
 </Button>
 </div>
 )}

 {/* Version History */}
 {versionHistory.length > 1 && (
 <div className="bg-card rounded-lg border border-border p-4 space-y-3">
 <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
 <span>📜</span>
 Version History
 </h4>
 <div className="space-y-2 max-h-48 overflow-y-auto">
 {versionHistory.map((version, index) => (
 <div
 key={version.version}
 className={`p-3 rounded-lg border ${
 generatedTest.version === version.version
 ? 'border-primary bg-primary/5'
 : 'border-border hover:bg-muted/50'
 } cursor-pointer transition-colors`}
 onClick={() => handleRestoreVersion(version)}
 >
 <div className="flex items-center justify-between mb-1">
 <span className="text-sm font-medium text-foreground">
 Version {version.version}
 {generatedTest.version === version.version && (
 <span className="ml-2 text-xs text-primary">(Current)</span>
 )}
 </span>
 <span className="text-xs text-muted-foreground">
 {version.timestamp.toLocaleTimeString()}
 </span>
 </div>
 {version.feedback && (
 <p className="text-xs text-muted-foreground truncate">
 Feedback: {version.feedback}
 </p>
 )}
 {index === 0 && (
 <p className="text-xs text-muted-foreground italic">
 Initial generation
 </p>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </>
 ) : (
 /* Placeholder */
 <div className="bg-card rounded-lg border border-border p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
 <div className="text-4xl mb-4">🧪</div>
 <h3 className="text-lg font-medium text-foreground mb-2">
 Generated Test Will Appear Here
 </h3>
 <p className="text-sm text-muted-foreground max-w-sm">
 Enter a description of the test you want to create and click "Generate Test" to see the result.
 </p>
 </div>
 )}
 </div>
 </div>
 </div>
 </Layout>
 );
}

export default AITestGeneratorPage;
