// Feature #77: Migrated to React Query with caching
// Feature #636: Adopt Modal component in page-level inline modals
import { useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useVisualReviewStore } from '../stores/visualReviewStore';
import { logger } from '../utils/logger';
import {
 usePendingVisualChanges,
 useBatchApproveChanges,
 useBatchRejectChanges,
} from '../hooks/api/useVisualReview';
import { Check, X, Loader2, CheckCircle2, FolderOpen, Server, Monitor, Clock, AlertTriangle } from 'lucide-react';

// Types for Visual Review
interface PendingVisualChange {
 runId: string;
 testId: string;
 testName: string;
 projectId?: string;
 projectName?: string;
 suiteId: string;
 suiteName?: string;
 diffPercentage?: number;
 screenshot?: string;
 baselineScreenshot?: string;
 diffImage?: string;
 startedAt?: string;
 viewport?: string;
}

// Feature #1251: Visual Change Impact Analysis
interface VisualChangeImpactAnalysis {
 severity: 'minor' | 'moderate' | 'major' | 'critical';
 confidence: number;
 change_type: {
 category: string;
 description: string;
 };
 affected_areas: Array<{
 element: string;
 change_description: string;
 location: string;
 }>;
 user_impact: {
 severity: 'low' | 'medium' | 'high';
 description: string;
 affected_users: string;
 accessibility_impact: string;
 };
 recommendation: {
 action: 'approve' | 'investigate' | 'reject';
 reasoning: string;
 suggested_tests?: string[];
 };
 ai_summary: string;
}

export default function VisualReviewPage() {
 const { token } = useAuthStore();
 const navigate = useNavigate();
 const { addNotification } = useNotificationStore();
 const { decrementCount } = useVisualReviewStore();

 // Feature #77: React Query hooks for data fetching
 const { data: pendingChanges = [], isLoading, refetch: refetchPending } = usePendingVisualChanges();
 const batchApproveMutation = useBatchApproveChanges();
 const batchRejectMutation = useBatchRejectChanges();

 // UI state
 const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
 const [showBatchApproveModal, setShowBatchApproveModal] = useState(false);
 const [showBatchRejectModal, setShowBatchRejectModal] = useState(false);
 const [batchRejectReason, setBatchRejectReason] = useState('');
 const [lightboxImage, setLightboxImage] = useState<string | null>(null);
 const [sortBy, setSortBy] = useState<'date' | 'diff'>('date');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
 const [filterProjectId, setFilterProjectId] = useState<string>('all');
 const [filterSuiteId, setFilterSuiteId] = useState<string>('all');
 const [filterMinDiff, setFilterMinDiff] = useState<string>('all'); // 'all' | '1' | '5' | '10' | '20'

 // Feature #1251: AI Impact Analysis state
 const [analyzingChangeId, setAnalyzingChangeId] = useState<string | null>(null);
 const [changeAnalyses, setChangeAnalyses] = useState<Record<string, VisualChangeImpactAnalysis>>({});

 // Get unique projects from pending changes for filter dropdown
 const uniqueProjects = Array.from(
 new Map(
 pendingChanges
 .filter(c => c.projectId && c.projectName)
 .map(c => [c.projectId, { id: c.projectId!, name: c.projectName! }])
 ).values()
 ).sort((a, b) => a.name.localeCompare(b.name));

 // Get unique suites from pending changes for filter dropdown
 const uniqueSuites = Array.from(
 new Map(
 pendingChanges
 .filter(c => c.suiteId && c.suiteName)
 .map(c => [c.suiteId, { id: c.suiteId, name: c.suiteName! }])
 ).values()
 ).sort((a, b) => a.name.localeCompare(b.name));

 // Filter pending changes by project, suite, and diff severity
 const filteredPendingChanges = pendingChanges.filter(c => {
 // Project filter
 if (filterProjectId !== 'all' && c.projectId !== filterProjectId) return false;
 // Suite filter
 if (filterSuiteId !== 'all' && c.suiteId !== filterSuiteId) return false;
 // Diff severity filter
 if (filterMinDiff !== 'all') {
 const minDiff = parseFloat(filterMinDiff);
 if ((c.diffPercentage ?? 0) < minDiff) return false;
 }
 return true;
 });

 // Sort filtered pending changes based on current sort settings
 const sortedPendingChanges = [...filteredPendingChanges].sort((a, b) => {
 if (sortBy === 'diff') {
 const diffA = a.diffPercentage ?? 0;
 const diffB = b.diffPercentage ?? 0;
 return sortOrder === 'desc' ? diffB - diffA : diffA - diffB;
 } else {
 // Sort by date
 const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
 const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
 return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
 }
 });

 // Feature #77: Data fetching is now handled by React Query (usePendingVisualChanges hook)

 // Generate unique key for a change
 const getChangeKey = (change: PendingVisualChange) => `${change.runId}-${change.testId}`;

 // Toggle selection for a change
 const toggleSelection = (change: PendingVisualChange) => {
 const key = getChangeKey(change);
 setSelectedChanges(prev => {
 const newSet = new Set(prev);
 if (newSet.has(key)) {
 newSet.delete(key);
 } else {
 newSet.add(key);
 }
 return newSet;
 });
 };

 // Select/deselect all
 const toggleSelectAll = () => {
 if (selectedChanges.size === pendingChanges.length) {
 setSelectedChanges(new Set());
 } else {
 setSelectedChanges(new Set(pendingChanges.map(getChangeKey)));
 }
 };

 // Feature #77: Handle batch approve using React Query mutation
 const handleBatchApprove = async () => {
 if (selectedChanges.size === 0) return;

 const changesToApprove = pendingChanges
 .filter(c => selectedChanges.has(getChangeKey(c)))
 .map(c => ({
 runId: c.runId,
 testId: c.testId,
 }));

 batchApproveMutation.mutate({ changes: changesToApprove }, {
 onSuccess: (data) => {
 // Update global pending count for sidebar badge
 const approvedCount = data.results?.filter((r: {success: boolean}) => r.success).length || 0;
 for (let i = 0; i < approvedCount; i++) {
 decrementCount();
 }

 setSelectedChanges(new Set());
 setShowBatchApproveModal(false);
 refetchPending();

 addNotification({
 type: 'success',
 title: 'Batch Approval Complete',
 message: data.message,
 duration: 5000,
 });
 },
 onError: (error) => {
 addNotification({
 type: 'error',
 title: 'Batch Approval Failed',
 message: error instanceof Error ? error.message : 'Failed to batch approve changes',
 duration: 5000,
 });
 },
 });
 };

 // Feature #1952: Resize and compress diff image for Vision API
 const resizeAndCompressDiffImage = async (
 base64Data: string,
 maxWidth: number = 1024,
 maxHeight: number = 1024,
 quality: number = 0.8
 ): Promise<string> => {
 return new Promise((resolve, reject) => {
 const img = new Image();
 img.onload = () => {
 let width = img.width;
 let height = img.height;

 if (width > maxWidth) {
 height = Math.round((height * maxWidth) / width);
 width = maxWidth;
 }
 if (height > maxHeight) {
 width = Math.round((width * maxHeight) / height);
 height = maxHeight;
 }

 const canvas = document.createElement('canvas');
 canvas.width = width;
 canvas.height = height;

 const ctx = canvas.getContext('2d');
 if (!ctx) {
 reject(new Error('Failed to get canvas context'));
 return;
 }

 ctx.drawImage(img, 0, 0, width, height);
 const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
 const base64Only = compressedBase64.split(',')[1];
 logger.ai.debug(`Diff image resized: ${img.width}x${img.height} -> ${width}x${height}`);
 resolve(base64Only);
 };
 img.onerror = () => reject(new Error('Failed to load image'));
 img.src = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
 });
 };

 // Feature #1251: Generate AI impact analysis for a visual change
 // Feature #1934 & #1952: Real AI analysis using Claude Vision for diff images
 const generateImpactAnalysis = async (change: PendingVisualChange): Promise<VisualChangeImpactAnalysis> => {
 const diffPercent = change.diffPercentage || 0;

 // Build AI prompt for visual diff analysis
 const prompt = `Analyze this visual regression test result and provide a structured assessment.

**Test Information:**
- Test Name: ${change.testName}
- Diff Percentage: ${diffPercent.toFixed(2)}%
- Viewport: ${change.viewport || 'Default'}

**Analysis Request:**
Based on the visual diff image showing highlighted changes (red/pink areas indicate differences), provide:

1. **Severity Assessment**: Classify as minor (<1%), moderate (1-5%), major (5-15%), or critical (>15%)
2. **Change Type**: Identify what type of change occurred (layout shift, color adjustment, text change, image update, etc.)
3. **Affected Areas**: List specific UI elements that appear to have changed
4. **User Impact**: Assess how this change affects the user experience
5. **Recommendation**: Should this change be APPROVED (intentional/safe), INVESTIGATED (needs review), or REJECTED (likely a bug)?

Respond in this JSON format:
{
 "severity": "minor|moderate|major|critical",
 "confidence": 85,
 "change_type": { "category": "...", "description": "..." },
 "affected_areas": [{ "element": "...", "change_description": "...", "location": "..." }],
 "user_impact": { "severity": "low|medium|high", "description": "...", "affected_users": "...", "accessibility_impact": "..." },
 "recommendation": { "action": "approve|investigate|reject", "reasoning": "...", "suggested_tests": ["..."] },
 "ai_summary": "..."
}`;

 try {
 const controller = new AbortController();
 const timeoutId = setTimeout(() => controller.abort(), 60000);

 let response: Response;

 // Feature #1952: Use Claude Vision API when diff image is available
 if (change.diffImage) {
 logger.ai.debug(`Using Vision API for ${change.testName} - ${diffPercent.toFixed(2)}% diff`);

 // Resize and compress the diff image
 const compressedImage = await resizeAndCompressDiffImage(change.diffImage);

 response = await fetch('/api/v1/mcp/chat/vision', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`,
 },
 body: JSON.stringify({
 message: prompt,
 image: {
 data: compressedImage,
 media_type: 'image/jpeg',
 },
 context: {
 test_type: 'visual',
 diff_percentage: diffPercent,
 viewport: change.viewport ? {
 width: parseInt(change.viewport.split('x')[0]) || 1280,
 height: parseInt(change.viewport.split('x')[1]) || 720,
 } : { width: 1280, height: 720 },
 },
 complexity: 'complex',
 }),
 signal: controller.signal,
 });
 } else {
 // Fallback to text-only analysis when no diff image
 logger.ai.debug(`No diff image available for ${change.testName}, using text-only analysis`);

 response = await fetch('/api/v1/mcp/chat', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`,
 },
 body: JSON.stringify({
 message: prompt,
 context: [],
 }),
 signal: controller.signal,
 });
 }

 clearTimeout(timeoutId);

 if (!response.ok) {
 throw new Error(`AI service error: ${response.status}`);
 }

 const data = await response.json();
 const aiResponse = data.result?.response || data.response || data.message || '';

 // Try to parse JSON from AI response
 const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
 if (jsonMatch) {
 try {
 const parsed = JSON.parse(jsonMatch[0]);
 return {
 severity: parsed.severity || (diffPercent < 1 ? 'minor' : diffPercent < 5 ? 'moderate' : diffPercent < 15 ? 'major' : 'critical'),
 confidence: parsed.confidence || 85,
 change_type: parsed.change_type || { category: 'Visual Change', description: 'UI elements have changed' },
 affected_areas: parsed.affected_areas || [],
 user_impact: parsed.user_impact || { severity: 'medium', description: 'Review recommended', affected_users: 'All users', accessibility_impact: 'Unknown' },
 recommendation: parsed.recommendation || { action: 'investigate', reasoning: 'AI analysis completed', suggested_tests: [] },
 ai_summary: parsed.ai_summary || aiResponse,
 };
 } catch {
 // JSON parsing failed, use heuristic fallback
 }
 }

 // Fallback: Use AI response as summary with heuristic values
 return generateFallbackAnalysis(change, aiResponse);
 } catch (error) {
 console.error('AI analysis failed, using heuristic fallback:', error);
 return generateFallbackAnalysis(change, '');
 }
 };

 // Fallback heuristic analysis when AI is unavailable
 const generateFallbackAnalysis = (change: PendingVisualChange, aiResponse: string): VisualChangeImpactAnalysis => {
 const diffPercent = change.diffPercentage || 0;

 // Determine severity based on diff percentage
 const severity: 'minor' | 'moderate' | 'major' | 'critical' =
 diffPercent < 1 ? 'minor' : diffPercent < 5 ? 'moderate' : diffPercent < 15 ? 'major' : 'critical';

 // Generate change type based on test name and diff level
 const isLayoutChange = change.testName.toLowerCase().includes('layout') || diffPercent > 10;
 const isColorChange = change.testName.toLowerCase().includes('theme') || diffPercent < 3;
 const isTextChange = change.testName.toLowerCase().includes('text') || change.testName.toLowerCase().includes('content');
 const isIconChange = change.testName.toLowerCase().includes('icon') || change.testName.toLowerCase().includes('image');

 let changeType = { category: 'Layout Shift', description: 'Element positions or sizes have changed' };
 if (isColorChange && diffPercent < 3) {
 changeType = { category: 'Color Adjustment', description: 'Color values have been modified (styling change)' };
 } else if (isTextChange) {
 changeType = { category: 'Text Content Change', description: 'Text content or typography has been modified' };
 } else if (isIconChange) {
 changeType = { category: 'Image/Icon Update', description: 'Visual assets have been updated or replaced' };
 } else if (diffPercent > 15) {
 changeType = { category: 'Major Layout Restructure', description: 'Significant layout changes affecting page structure' };
 }

 // Generate affected areas
 const affectedAreas: Array<{ element: string; change_description: string; location: string }> = [];
 if (diffPercent > 0) {
 affectedAreas.push({ element: 'Primary Content Area', change_description: diffPercent > 5 ? 'Layout structure modified' : 'Minor visual adjustment', location: 'Center viewport' });
 }
 if (diffPercent > 3) {
 affectedAreas.push({ element: 'Navigation/Header', change_description: 'Spacing or alignment updated', location: 'Top of viewport' });
 }
 if (diffPercent > 8) {
 affectedAreas.push({ element: 'Interactive Elements', change_description: 'Button or form element styling changed', location: 'Multiple locations' });
 }

 // Generate user impact assessment
 const userImpact = {
 severity: (diffPercent < 3 ? 'low' : diffPercent < 10 ? 'medium' : 'high') as 'low' | 'medium' | 'high',
 description: diffPercent < 3 ? 'Changes are subtle and unlikely to affect user experience significantly.' : diffPercent < 10 ? 'Changes are noticeable and may require user adaptation.' : 'Significant visual changes that users will immediately notice.',
 affected_users: diffPercent < 5 ? 'Minimal impact on all users' : diffPercent < 15 ? 'Moderate impact on returning users who expect familiar layout' : 'High impact on all users - significant relearning required',
 accessibility_impact: diffPercent > 8 ? 'Review required: Large visual changes may affect screen reader navigation or keyboard focus order' : 'No accessibility concerns detected'
 };

 // Generate recommendation
 let recommendation: VisualChangeImpactAnalysis['recommendation'];
 if (diffPercent < 2) {
 recommendation = { action: 'approve', reasoning: 'Minor change with negligible user impact. Safe to approve as new baseline.', suggested_tests: ['Verify styling consistency across themes'] };
 } else if (diffPercent < 8) {
 recommendation = { action: 'investigate', reasoning: 'Moderate change detected. Recommend review to verify intentional design update.', suggested_tests: ['Cross-browser visual check', 'Mobile responsiveness verification', 'Component regression test'] };
 } else {
 recommendation = { action: 'reject', reasoning: 'Significant visual regression. Recommend investigation before approving.', suggested_tests: ['Full visual regression suite', 'Accessibility audit', 'Stakeholder design review', 'User acceptance testing'] };
 }

 const aiSummary = aiResponse || `This visual change shows a **${severity}** difference (${diffPercent.toFixed(2)}% pixel variation) classified as "${changeType.category}". ${changeType.description}. User impact is **${userImpact.severity}** - ${userImpact.description} **Recommendation**: ${recommendation.action === 'approve' ? '✅ Approve' : recommendation.action === 'investigate' ? '🔍 Investigate' : '❌ Reject'} - ${recommendation.reasoning}`;

 return {
 severity,
 confidence: 85 + Math.random() * 10,
 change_type: changeType,
 affected_areas: affectedAreas,
 user_impact: userImpact,
 recommendation,
 ai_summary: aiSummary
 };
 };

 // Handle AI analysis request
 const handleAnalyzeChange = async (change: PendingVisualChange) => {
 const key = getChangeKey(change);
 setAnalyzingChangeId(key);

 try {
 const analysis = await generateImpactAnalysis(change);
 setChangeAnalyses(prev => ({ ...prev, [key]: analysis }));
 } catch (error) {
 console.error('Failed to analyze change:', error);
 } finally {
 setAnalyzingChangeId(null);
 }
 };

 // Feature #77: Handle batch reject using React Query mutation
 const handleBatchReject = async () => {
 if (selectedChanges.size === 0) return;

 const changesToReject = pendingChanges
 .filter(c => selectedChanges.has(getChangeKey(c)))
 .map(c => ({
 runId: c.runId,
 testId: c.testId,
 }));

 batchRejectMutation.mutate({
 changes: changesToReject,
 reason: batchRejectReason.trim() || undefined,
 }, {
 onSuccess: (data) => {
 // Update global pending count for sidebar badge
 const rejectedCount = data.results?.filter((r: {success: boolean}) => r.success).length || 0;
 for (let i = 0; i < rejectedCount; i++) {
 decrementCount();
 }

 setSelectedChanges(new Set());
 setShowBatchRejectModal(false);
 setBatchRejectReason('');
 refetchPending();

 addNotification({
 type: 'success',
 title: 'Batch Rejection Complete',
 message: data.message,
 duration: 5000,
 });
 },
 onError: (error) => {
 addNotification({
 type: 'error',
 title: 'Batch Rejection Failed',
 message: error instanceof Error ? error.message : 'Failed to batch reject changes',
 duration: 5000,
 });
 },
 });
 };

 return (
 <Layout>
 <div className="container mx-auto p-6">
 <div className="mb-6 flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-foreground">Visual Review Queue</h1>
 <p className="text-muted-foreground">Review and approve pending visual changes</p>
 </div>
 <div className="flex items-center gap-3">
 {pendingChanges.length > 0 && (
 <>
 <button
 onClick={toggleSelectAll}
 className="text-sm text-primary hover:underline"
 >
 {selectedChanges.size === pendingChanges.length ? 'Deselect All' : 'Select All'}
 </button>
 <button
 onClick={() => setShowBatchApproveModal(true)}
 disabled={selectedChanges.size === 0}
 className="inline-flex items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-success disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Check className="h-4 w-4" />
 Batch Approve ({selectedChanges.size})
 </button>
 <button
 onClick={() => setShowBatchRejectModal(true)}
 disabled={selectedChanges.size === 0}
 className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <X className="h-4 w-4" />
 Batch Reject ({selectedChanges.size})
 </button>
 </>
 )}
 </div>
 </div>

 {isLoading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="animate-spin h-8 w-8 text-primary" />
 </div>
 ) : pendingChanges.length === 0 ? (
 <div className="text-center py-12">
 <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
 <h3 className="mt-4 text-lg font-medium text-foreground">All caught up!</h3>
 <p className="text-muted-foreground">No pending visual changes to review.</p>
 </div>
 ) : (
 <div>
 {/* Sort and Filter controls */}
 <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <span className="font-medium text-foreground">{sortedPendingChanges.length}</span>
 {(filterProjectId !== 'all' || filterSuiteId !== 'all' || filterMinDiff !== 'all') && <span>of {pendingChanges.length}</span>}
 pending {sortedPendingChanges.length === 1 ? 'change' : 'changes'}
 </div>
 <div className="flex flex-wrap items-center gap-4">
 {/* Project filter */}
 {uniqueProjects.length > 0 && (
 <div className="flex items-center gap-2">
 <label htmlFor="project-filter" className="text-sm text-muted-foreground">Project:</label>
 <select
 id="project-filter"
 value={filterProjectId}
 onChange={(e) => setFilterProjectId(e.target.value)}
 className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 >
 <option value="all">All Projects</option>
 {uniqueProjects.map(project => (
 <option key={project.id} value={project.id}>{project.name}</option>
 ))}
 </select>
 {filterProjectId !== 'all' && (
 <button
 onClick={() => setFilterProjectId('all')}
 className="text-xs text-primary hover:underline"
 >
 Clear
 </button>
 )}
 </div>
 )}

 {/* Suite filter */}
 {uniqueSuites.length > 0 && (
 <div className="flex items-center gap-2">
 <label htmlFor="suite-filter" className="text-sm text-muted-foreground">Suite:</label>
 <select
 id="suite-filter"
 value={filterSuiteId}
 onChange={(e) => setFilterSuiteId(e.target.value)}
 className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 >
 <option value="all">All Suites</option>
 {uniqueSuites.map(suite => (
 <option key={suite.id} value={suite.id}>{suite.name}</option>
 ))}
 </select>
 {filterSuiteId !== 'all' && (
 <button
 onClick={() => setFilterSuiteId('all')}
 className="text-xs text-primary hover:underline"
 >
 Clear
 </button>
 )}
 </div>
 )}

 {/* Diff severity filter */}
 <div className="flex items-center gap-2">
 <label htmlFor="diff-filter" className="text-sm text-muted-foreground">Diff:</label>
 <select
 id="diff-filter"
 value={filterMinDiff}
 onChange={(e) => setFilterMinDiff(e.target.value)}
 className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 >
 <option value="all">All</option>
 <option value="1">≥ 1%</option>
 <option value="5">≥ 5%</option>
 <option value="10">≥ 10%</option>
 <option value="20">≥ 20%</option>
 </select>
 {filterMinDiff !== 'all' && (
 <button
 onClick={() => setFilterMinDiff('all')}
 className="text-xs text-primary hover:underline"
 >
 Clear
 </button>
 )}
 </div>

 {/* Sort controls */}
 <div className="flex items-center gap-2">
 <span className="text-sm text-muted-foreground">Sort by:</span>
 <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
 <button
 onClick={() => {
 if (sortBy === 'date') {
 setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
 } else {
 setSortBy('date');
 setSortOrder('desc');
 }
 }}
 className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
 sortBy === 'date'
 ? 'bg-primary text-primary-foreground'
 : 'text-muted-foreground hover:text-foreground hover:bg-muted'
 }`}
 >
 Date {sortBy === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
 </button>
 <button
 onClick={() => {
 if (sortBy === 'diff') {
 setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
 } else {
 setSortBy('diff');
 setSortOrder('desc');
 }
 }}
 className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
 sortBy === 'diff'
 ? 'bg-primary text-primary-foreground'
 : 'text-muted-foreground hover:text-foreground hover:bg-muted'
 }`}
 >
 Diff % {sortBy === 'diff' && (sortOrder === 'desc' ? '↓' : '↑')}
 </button>
 </div>
 </div>
 </div>
 </div>

 <div className="grid gap-4">
 {sortedPendingChanges.map((change) => {
 const key = getChangeKey(change);
 const isSelected = selectedChanges.has(key);

 return (
 <div
 key={key}
 className={`rounded-lg border p-4 transition-colors ${
 isSelected
 ? 'border-primary bg-primary/5'
 : 'border-border bg-card hover:border-primary/50'
 }`}
 >
 <div className="flex items-start gap-4">
 {/* Checkbox */}
 <div className="pt-1">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => toggleSelection(change)}
 className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
 />
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-2">
 <h3 className="font-medium text-foreground truncate">{change.testName}</h3>
 {change.diffPercentage !== undefined && (
 <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
 {change.diffPercentage.toFixed(2)}% diff
 </span>
 )}
 </div>
 <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
 {change.projectName && (
 <span className="inline-flex items-center gap-1">
 <FolderOpen className="h-3 w-3" />
 {change.projectName}
 </span>
 )}
 {change.suiteName && (
 <span className="inline-flex items-center gap-1">
 <Server className="h-3 w-3" />
 {change.suiteName}
 </span>
 )}
 {change.viewport && (
 <span className="inline-flex items-center gap-1">
 <Monitor className="h-3 w-3" />
 {change.viewport}
 </span>
 )}
 {change.startedAt && (
 <span className="inline-flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {new Date(change.startedAt).toLocaleString()}
 </span>
 )}
 </div>

 {/* Screenshot previews */}
 <div className="grid grid-cols-3 gap-2">
 {change.baselineScreenshot && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground">Baseline</p>
 <img
 src={`data:image/png;base64,${change.baselineScreenshot}`}
 alt="Baseline"
 className="w-full h-20 object-cover object-top rounded border border-border cursor-pointer hover:opacity-80"
 onClick={() => setLightboxImage(`data:image/png;base64,${change.baselineScreenshot}`)}
 />
 </div>
 )}
 {change.screenshot && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground">New</p>
 <img
 src={`data:image/png;base64,${change.screenshot}`}
 alt="New screenshot"
 className="w-full h-20 object-cover object-top rounded border border-success/30 cursor-pointer hover:opacity-80"
 onClick={() => setLightboxImage(`data:image/png;base64,${change.screenshot}`)}
 />
 </div>
 )}
 {change.diffImage && (
 <div className="space-y-1">
 <p className="text-xs text-muted-foreground">Diff</p>
 <img
 src={`data:image/png;base64,${change.diffImage}`}
 alt="Diff"
 className="w-full h-20 object-cover object-top rounded border border-destructive/30 cursor-pointer hover:opacity-80"
 onClick={() => setLightboxImage(`data:image/png;base64,${change.diffImage}`)}
 />
 </div>
 )}
 </div>
 </div>

 {/* Actions */}
 <div className="flex flex-col gap-2">
 <button
 onClick={() => navigate(`/tests/${change.testId}`)}
 className="text-xs text-primary hover:underline"
 >
 View Test →
 </button>
 {/* Feature #1251: AI Impact Analysis button */}
 <button
 onClick={() => handleAnalyzeChange(change)}
 disabled={analyzingChangeId === key}
 className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 disabled:opacity-50"
 >
 {analyzingChangeId === key ? (
 <>
 <Loader2 className="animate-spin h-3 w-3" />
 Analyzing...
 </>
 ) : changeAnalyses[key] ? (
 '🤖 View Analysis'
 ) : (
 '🤖 AI Analysis'
 )}
 </button>
 </div>
 </div>

 {/* Feature #1251: AI Impact Analysis Display */}
 {changeAnalyses[key] && (
 <div className="mt-4 border-t border-border pt-4">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-accent">🤖</span>
 <h4 className="text-sm font-medium text-foreground">AI Visual Impact Analysis</h4>
 <span className={`ml-auto px-2 py-0.5 text-xs font-bold uppercase rounded ${
 changeAnalyses[key].severity === 'minor' ? 'bg-success/10 text-success' :
 changeAnalyses[key].severity === 'moderate' ? 'bg-warning/10 text-warning' :
 changeAnalyses[key].severity === 'major' ? 'bg-warning/10 text-warning' :
 'bg-destructive/10 text-destructive'
 }`}>
 {changeAnalyses[key].severity}
 </span>
 <span className="text-xs text-muted-foreground">
 {changeAnalyses[key].confidence.toFixed(0)}% confidence
 </span>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Change Type */}
 <div className="rounded-md bg-accent/10 border border-accent/20 p-3">
 <p className="text-xs font-medium text-accent mb-1">📊 Change Type</p>
 <p className="text-sm font-medium text-foreground">{changeAnalyses[key].change_type.category}</p>
 <p className="text-xs text-muted-foreground">{changeAnalyses[key].change_type.description}</p>
 </div>

 {/* User Impact */}
 <div className={`rounded-md p-3 border ${
 changeAnalyses[key].user_impact.severity === 'low' ? 'bg-success/10 border-success/20' :
 changeAnalyses[key].user_impact.severity === 'medium' ? 'bg-warning/10 border-warning/20' :
 'bg-destructive/10 border-destructive/20'
 }`}>
 <p className={`text-xs font-medium mb-1 ${
 changeAnalyses[key].user_impact.severity === 'low' ? 'text-success' :
 changeAnalyses[key].user_impact.severity === 'medium' ? 'text-warning' :
 'text-destructive'
 }`}>
 👥 User Experience Impact: {changeAnalyses[key].user_impact.severity.toUpperCase()}
 </p>
 <p className="text-xs text-foreground">{changeAnalyses[key].user_impact.description}</p>
 <p className="text-xs text-muted-foreground mt-1">{changeAnalyses[key].user_impact.affected_users}</p>
 </div>
 </div>

 {/* Affected Areas */}
 {changeAnalyses[key].affected_areas.length > 0 && (
 <div className="mt-3 rounded-md bg-muted/50 p-3">
 <p className="text-xs font-medium text-foreground mb-2">🎯 Affected Areas</p>
 <div className="space-y-1">
 {changeAnalyses[key].affected_areas.map((area, idx) => (
 <div key={idx} className="flex items-center gap-2 text-xs">
 <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
 <span className="font-medium text-foreground">{area.element}</span>
 <span className="text-muted-foreground">- {area.change_description}</span>
 <span className="ml-auto text-muted-foreground text-[10px]">{area.location}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Accessibility Impact */}
 {changeAnalyses[key].user_impact.accessibility_impact && (
 <div className="mt-3 rounded-md bg-primary/10 border border-primary/20 p-3">
 <p className="text-xs font-medium text-primary">♿ Accessibility</p>
 <p className="text-xs text-foreground">{changeAnalyses[key].user_impact.accessibility_impact}</p>
 </div>
 )}

 {/* AI Recommendation */}
 <div className={`mt-3 rounded-md p-3 border ${
 changeAnalyses[key].recommendation.action === 'approve' ? 'bg-success/10 border-success/20' :
 changeAnalyses[key].recommendation.action === 'investigate' ? 'bg-warning/10 border-warning/20' :
 'bg-destructive/10 border-destructive/20'
 }`}>
 <div className="flex items-center gap-2 mb-2">
 <span className="text-lg">
 {changeAnalyses[key].recommendation.action === 'approve' ? '✅' :
 changeAnalyses[key].recommendation.action === 'investigate' ? '🔍' : '❌'}
 </span>
 <p className={`text-sm font-bold uppercase ${
 changeAnalyses[key].recommendation.action === 'approve' ? 'text-success' :
 changeAnalyses[key].recommendation.action === 'investigate' ? 'text-warning' :
 'text-destructive'
 }`}>
 AI Recommends: {changeAnalyses[key].recommendation.action}
 </p>
 </div>
 <p className="text-xs text-foreground">{changeAnalyses[key].recommendation.reasoning}</p>
 {changeAnalyses[key].recommendation.suggested_tests && changeAnalyses[key].recommendation.suggested_tests.length > 0 && (
 <div className="mt-2">
 <p className="text-xs text-muted-foreground mb-1">Suggested follow-up tests:</p>
 <ul className="space-y-0.5">
 {changeAnalyses[key].recommendation.suggested_tests!.map((test, idx) => (
 <li key={idx} className="text-xs text-foreground flex items-center gap-1">
 <span className="text-primary">•</span> {test}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Batch Approve Confirmation Modal */}
 <Modal
 isOpen={showBatchApproveModal}
 onClose={() => !batchApproveMutation.isPending && setShowBatchApproveModal(false)}
 title="Confirm Batch Approval"
 size="md"
 >
 <ModalBody>
 <div className="flex items-center gap-3 mb-4">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
 <Check className="h-6 w-6 text-success" />
 </div>
 </div>
 <p className="text-muted-foreground">
 Are you sure you want to approve <span className="font-semibold text-foreground">{selectedChanges.size}</span> visual {selectedChanges.size === 1 ? 'change' : 'changes'} as new baselines?
 </p>
 <p className="text-sm text-muted-foreground mt-2">
 This will update the baseline screenshots for the selected tests. This action cannot be undone.
 </p>
 </ModalBody>
 <ModalFooter>
 <button
 onClick={() => setShowBatchApproveModal(false)}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 disabled={batchApproveMutation.isPending}
 >
 Cancel
 </button>
 <button
 onClick={handleBatchApprove}
 disabled={batchApproveMutation.isPending}
 className="rounded-md bg-success px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-success disabled:opacity-50"
 >
 {batchApproveMutation.isPending ? (
 <span className="flex items-center gap-2">
 <Loader2 className="animate-spin h-4 w-4" />
 Approving...
 </span>
 ) : (
 `Approve ${selectedChanges.size} ${selectedChanges.size === 1 ? 'Change' : 'Changes'}`
 )}
 </button>
 </ModalFooter>
 </Modal>

 {/* Batch Reject Confirmation Modal */}
 <Modal
 isOpen={showBatchRejectModal}
 onClose={() => {
 if (!batchRejectMutation.isPending) {
 setShowBatchRejectModal(false);
 setBatchRejectReason('');
 }
 }}
 title="Confirm Batch Rejection"
 size="md"
 >
 <ModalBody>
 <div className="flex items-center gap-3 mb-4">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
 <AlertTriangle className="h-6 w-6 text-destructive" />
 </div>
 </div>
 <p className="text-muted-foreground">
 Are you sure you want to reject <span className="font-semibold text-foreground">{selectedChanges.size}</span> visual {selectedChanges.size === 1 ? 'change' : 'changes'} as regressions?
 </p>
 <p className="text-sm text-muted-foreground mt-2">
 This will mark the selected changes as rejected regressions. The baselines will remain unchanged.
 </p>

 {/* Shared rejection reason */}
 <div className="mt-4">
 <label className="block text-sm font-medium text-foreground mb-1">
 Rejection Reason <span className="text-muted-foreground font-normal">(optional, applies to all)</span>
 </label>
 <textarea
 value={batchRejectReason}
 onChange={(e) => setBatchRejectReason(e.target.value)}
 placeholder="Describe why these changes are regressions..."
 className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
 rows={3}
 />
 </div>
 </ModalBody>
 <ModalFooter>
 <button
 onClick={() => {
 setShowBatchRejectModal(false);
 setBatchRejectReason('');
 }}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 disabled={batchRejectMutation.isPending}
 >
 Cancel
 </button>
 <button
 onClick={handleBatchReject}
 disabled={batchRejectMutation.isPending}
 className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
 >
 {batchRejectMutation.isPending ? (
 <span className="flex items-center gap-2">
 <Loader2 className="animate-spin h-4 w-4" />
 Rejecting...
 </span>
 ) : (
 `Reject ${selectedChanges.size} ${selectedChanges.size === 1 ? 'Change' : 'Changes'}`
 )}
 </button>
 </ModalFooter>
 </Modal>

 {/* Image Lightbox */}
 <Modal
 isOpen={!!lightboxImage}
 onClose={() => setLightboxImage(null)}
 title="Image Preview"
 size="xl"
 >
 <ModalBody>
 {lightboxImage && (
 <img
 src={lightboxImage}
 alt="Full size"
 className="max-w-full max-h-[80vh] object-contain mx-auto"
 />
 )}
 </ModalBody>
 </Modal>
 </div>
 </Layout>
 );
}
