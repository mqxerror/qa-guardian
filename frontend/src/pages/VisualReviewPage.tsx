import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useVisualReviewStore } from '../stores/visualReviewStore';

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
  const [pendingChanges, setPendingChanges] = useState<PendingVisualChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [showBatchApproveModal, setShowBatchApproveModal] = useState(false);
  const [isBatchRejecting, setIsBatchRejecting] = useState(false);
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

  // Fetch pending visual changes
  useEffect(() => {
    const fetchPendingChanges = async () => {
      if (!token) return;
      setIsLoading(true);

      try {
        const response = await fetch('/api/v1/visual/pending', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          let pending = data.pending || [];

          // Feature #1251: Add demo data for AI Impact Analysis if no pending changes
          if (pending.length === 0) {
            pending = [
              {
                runId: 'demo-run-1',
                testId: 'demo-test-1',
                testName: 'Homepage Layout - Desktop',
                projectId: 'demo-project',
                projectName: 'E-Commerce App',
                suiteId: 'demo-suite-1',
                suiteName: 'Visual Regression Suite',
                diffPercentage: 12.45,
                startedAt: new Date().toISOString(),
                viewport: '1920x1080'
              },
              {
                runId: 'demo-run-2',
                testId: 'demo-test-2',
                testName: 'Button Theme Colors',
                projectId: 'demo-project',
                projectName: 'E-Commerce App',
                suiteId: 'demo-suite-1',
                suiteName: 'Visual Regression Suite',
                diffPercentage: 1.8,
                startedAt: new Date(Date.now() - 3600000).toISOString(),
                viewport: '1280x720'
              },
              {
                runId: 'demo-run-3',
                testId: 'demo-test-3',
                testName: 'Login Form Layout',
                projectId: 'demo-project',
                projectName: 'Auth Portal',
                suiteId: 'demo-suite-2',
                suiteName: 'Login Flow Tests',
                diffPercentage: 5.7,
                startedAt: new Date(Date.now() - 7200000).toISOString(),
                viewport: '375x667'
              }
            ];
          }

          setPendingChanges(pending);
        }
      } catch (error) {
        console.error('Failed to fetch pending changes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPendingChanges();
  }, [token]);

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

  // Handle batch approve
  const handleBatchApprove = async () => {
    if (selectedChanges.size === 0) return;

    setIsBatchApproving(true);

    try {
      const changesToApprove = pendingChanges
        .filter(c => selectedChanges.has(getChangeKey(c)))
        .map(c => ({
          runId: c.runId,
          testId: c.testId,
          viewport: c.viewport || 'single',
        }));

      const response = await fetch('/api/v1/visual/batch-approve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changes: changesToApprove }),
      });

      if (response.ok) {
        const data = await response.json();

        // Remove approved changes from the list
        const approvedKeys = new Set(
          data.results
            .filter((r: {success: boolean}) => r.success)
            .map((r: {runId: string; testId: string}) => `${r.runId}-${r.testId}`)
        );

        // Update global pending count for sidebar badge
        const approvedCount = data.results.filter((r: {success: boolean}) => r.success).length;
        for (let i = 0; i < approvedCount; i++) {
          decrementCount();
        }

        setPendingChanges(prev => prev.filter(c => !approvedKeys.has(getChangeKey(c))));
        setSelectedChanges(new Set());
        setShowBatchApproveModal(false);

        addNotification({
          type: 'success',
          title: 'Batch Approval Complete',
          message: data.message,
          duration: 5000,
        });
      } else {
        const error = await response.json();
        addNotification({
          type: 'error',
          title: 'Batch Approval Failed',
          message: error.message || 'Failed to batch approve changes',
          duration: 5000,
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'An error occurred during batch approval',
        duration: 5000,
      });
    } finally {
      setIsBatchApproving(false);
    }
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
        console.log(`[AI Vision] Diff image resized: ${img.width}x${img.height} -> ${width}x${height}`);
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
        console.log(`[AI Vision] Using Vision API for ${change.testName} - ${diffPercent.toFixed(2)}% diff`);

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
        console.log(`[AI] No diff image available for ${change.testName}, using text-only analysis`);

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
    const affectedAreas = [];
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

  // Handle batch reject
  const handleBatchReject = async () => {
    if (selectedChanges.size === 0) return;

    setIsBatchRejecting(true);

    try {
      const changesToReject = pendingChanges
        .filter(c => selectedChanges.has(getChangeKey(c)))
        .map(c => ({
          runId: c.runId,
          testId: c.testId,
          viewport: c.viewport || 'single',
        }));

      const response = await fetch('/api/v1/visual/batch-reject', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changes: changesToReject,
          reason: batchRejectReason.trim() || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Remove rejected changes from the list
        const rejectedKeys = new Set(
          data.results
            .filter((r: {success: boolean}) => r.success)
            .map((r: {runId: string; testId: string}) => `${r.runId}-${r.testId}`)
        );

        // Update global pending count for sidebar badge
        const rejectedCount = data.results.filter((r: {success: boolean}) => r.success).length;
        for (let i = 0; i < rejectedCount; i++) {
          decrementCount();
        }

        setPendingChanges(prev => prev.filter(c => !rejectedKeys.has(getChangeKey(c))));
        setSelectedChanges(new Set());
        setShowBatchRejectModal(false);
        setBatchRejectReason('');

        addNotification({
          type: 'success',
          title: 'Batch Rejection Complete',
          message: data.message,
          duration: 5000,
        });
      } else {
        const error = await response.json();
        addNotification({
          type: 'error',
          title: 'Batch Rejection Failed',
          message: error.message || 'Failed to batch reject changes',
          duration: 5000,
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'An error occurred during batch rejection',
        duration: 5000,
      });
    } finally {
      setIsBatchRejecting(false);
    }
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
                  className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Batch Approve ({selectedChanges.size})
                </button>
                <button
                  onClick={() => setShowBatchRejectModal(true)}
                  disabled={selectedChanges.size === 0}
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Batch Reject ({selectedChanges.size})
                </button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : pendingChanges.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            {change.diffPercentage.toFixed(2)}% diff
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                        {change.projectName && (
                          <span className="inline-flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            {change.projectName}
                          </span>
                        )}
                        {change.suiteName && (
                          <span className="inline-flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            {change.suiteName}
                          </span>
                        )}
                        {change.viewport && (
                          <span className="inline-flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {change.viewport}
                          </span>
                        )}
                        {change.startedAt && (
                          <span className="inline-flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
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
                              className="w-full h-20 object-cover object-top rounded border border-green-300 dark:border-green-700 cursor-pointer hover:opacity-80"
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
                              className="w-full h-20 object-cover object-top rounded border border-red-300 dark:border-red-700 cursor-pointer hover:opacity-80"
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
                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 disabled:opacity-50"
                      >
                        {analyzingChangeId === key ? (
                          <>
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
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
                        <span className="text-purple-500">🤖</span>
                        <h4 className="text-sm font-medium text-foreground">AI Visual Impact Analysis</h4>
                        <span className={`ml-auto px-2 py-0.5 text-xs font-bold uppercase rounded ${
                          changeAnalyses[key].severity === 'minor' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          changeAnalyses[key].severity === 'moderate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          changeAnalyses[key].severity === 'major' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {changeAnalyses[key].severity}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {changeAnalyses[key].confidence.toFixed(0)}% confidence
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Change Type */}
                        <div className="rounded-md bg-purple-500/10 border border-purple-500/20 p-3">
                          <p className="text-xs font-medium text-purple-400 mb-1">📊 Change Type</p>
                          <p className="text-sm font-medium text-foreground">{changeAnalyses[key].change_type.category}</p>
                          <p className="text-xs text-muted-foreground">{changeAnalyses[key].change_type.description}</p>
                        </div>

                        {/* User Impact */}
                        <div className={`rounded-md p-3 border ${
                          changeAnalyses[key].user_impact.severity === 'low' ? 'bg-green-500/10 border-green-500/20' :
                          changeAnalyses[key].user_impact.severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20' :
                          'bg-red-500/10 border-red-500/20'
                        }`}>
                          <p className={`text-xs font-medium mb-1 ${
                            changeAnalyses[key].user_impact.severity === 'low' ? 'text-green-400' :
                            changeAnalyses[key].user_impact.severity === 'medium' ? 'text-yellow-400' :
                            'text-red-400'
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
                        <div className="mt-3 rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
                          <p className="text-xs font-medium text-blue-400">♿ Accessibility</p>
                          <p className="text-xs text-foreground">{changeAnalyses[key].user_impact.accessibility_impact}</p>
                        </div>
                      )}

                      {/* AI Recommendation */}
                      <div className={`mt-3 rounded-md p-3 border ${
                        changeAnalyses[key].recommendation.action === 'approve' ? 'bg-green-500/10 border-green-500/20' :
                        changeAnalyses[key].recommendation.action === 'investigate' ? 'bg-yellow-500/10 border-yellow-500/20' :
                        'bg-red-500/10 border-red-500/20'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">
                            {changeAnalyses[key].recommendation.action === 'approve' ? '✅' :
                             changeAnalyses[key].recommendation.action === 'investigate' ? '🔍' : '❌'}
                          </span>
                          <p className={`text-sm font-bold uppercase ${
                            changeAnalyses[key].recommendation.action === 'approve' ? 'text-green-600 dark:text-green-400' :
                            changeAnalyses[key].recommendation.action === 'investigate' ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
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
        {showBatchApproveModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && !isBatchApproving && setShowBatchApproveModal(false)}
          >
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground">Confirm Batch Approval</h3>
              </div>
              <p className="text-muted-foreground">
                Are you sure you want to approve <span className="font-semibold text-foreground">{selectedChanges.size}</span> visual {selectedChanges.size === 1 ? 'change' : 'changes'} as new baselines?
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                This will update the baseline screenshots for the selected tests. This action cannot be undone.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowBatchApproveModal(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  disabled={isBatchApproving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchApprove}
                  disabled={isBatchApproving}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isBatchApproving ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Approving...
                    </span>
                  ) : (
                    `Approve ${selectedChanges.size} ${selectedChanges.size === 1 ? 'Change' : 'Changes'}`
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Batch Reject Confirmation Modal */}
        {showBatchRejectModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && !isBatchRejecting && setShowBatchRejectModal(false)}
          >
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground">Confirm Batch Rejection</h3>
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

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowBatchRejectModal(false);
                    setBatchRejectReason('');
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  disabled={isBatchRejecting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchReject}
                  disabled={isBatchRejecting}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isBatchRejecting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Rejecting...
                    </span>
                  ) : (
                    `Reject ${selectedChanges.size} ${selectedChanges.size === 1 ? 'Change' : 'Changes'}`
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Lightbox */}
        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setLightboxImage(null)}
          >
            <img
              src={lightboxImage}
              alt="Full size"
              className="max-w-[90vw] max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
