// ============================================================================
// FEATURE #1500: AI Test Review Queue Page
// Review and approve/reject AI-generated tests before adding to test suites
// FEATURE #711: Migrated to React Query hooks (useReviewQueue, useApprovalStats, useReviewTest)
// ============================================================================

import React, { useState } from 'react';
import { Loader2, ClipboardCheck, CheckCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../stores/authStore';
import { fetchWithAuth } from '../hooks/api/fetchWithAuth';

interface ApprovalInfo {
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_comment?: string;
  added_to_suite_id?: string;
}

interface PendingTest {
  id: string;
  description: string;
  test_name: string;
  generated_code: string;
  language: string;
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  version: number;
  ai_metadata?: {
    provider: string;
    model: string;
    used_real_ai: boolean;
  };
  approval: ApprovalInfo;
  created_at: string;
}

interface ReviewQueueData {
  pending: PendingTest[];
  total_pending: number;
  recently_reviewed: PendingTest[];
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  approval_rate: string;
}

// Query keys for cache management
const reviewKeys = {
  queue: ['ai', 'review-queue'] as const,
  stats: ['ai', 'approval-stats'] as const,
};

export function AITestReviewPage() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  const [selectedTest, setSelectedTest] = useState<PendingTest | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');

  // React Query: Fetch review queue
  const {
    data: queueData,
    isLoading: isQueueLoading,
    error: queueError,
  } = useQuery({
    queryKey: reviewKeys.queue,
    queryFn: async () => {
      const result = await fetchWithAuth('/api/v1/ai/review-queue', token);
      if (result.success) {
        return result as ReviewQueueData;
      }
      throw new Error(result.error || 'Failed to load review queue');
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
  });

  // React Query: Fetch approval stats
  const {
    data: stats,
    isLoading: isStatsLoading,
    error: statsError,
  } = useQuery({
    queryKey: reviewKeys.stats,
    queryFn: async () => {
      const result = await fetchWithAuth('/api/v1/ai/approval-stats', token);
      if (result.success) {
        return result.stats as ApprovalStats;
      }
      throw new Error(result.error || 'Failed to load stats');
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
  });

  // React Query: Review test mutation (approve/reject)
  const reviewMutation = useMutation({
    mutationFn: async ({ testId, action, comment }: { testId: string; action: 'approve' | 'reject'; comment: string }) => {
      const result = await fetchWithAuth(`/api/v1/ai/generation-history/${testId}/approve`, token, {
        method: 'POST',
        body: JSON.stringify({ action, comment }),
      });
      if (!result.success) {
        throw new Error(result.error || `Failed to ${action} test`);
      }
      return result;
    },
    onSuccess: () => {
      setSelectedTest(null);
      setReviewComment('');
      setError(null);
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: reviewKeys.queue });
      queryClient.invalidateQueries({ queryKey: reviewKeys.stats });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const isLoading = isQueueLoading || isStatsLoading;
  const isSubmitting = reviewMutation.isPending;

  // Set error from query errors
  React.useEffect(() => {
    if (queueError) setError((queueError as Error).message);
    else if (statsError) setError((statsError as Error).message);
  }, [queueError, statsError]);

  const handleApprove = (testId: string) => {
    setError(null);
    reviewMutation.mutate({ testId, action: 'approve', comment: reviewComment });
  };

  const handleReject = (testId: string) => {
    if (!reviewComment.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }
    setError(null);
    reviewMutation.mutate({ testId, action: 'reject', comment: reviewComment });
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-success/20 text-success';
      case 'medium':
        return 'bg-warning/20 text-warning';
      default:
        return 'bg-destructive/20 text-destructive';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success/20 text-success';
      case 'rejected':
        return 'bg-destructive/20 text-destructive';
      default:
        return 'bg-warning/20 text-warning';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Feature #640: PageHeader component */}
        <PageHeader
          title="AI Test Review Queue"
          description="Review and approve AI-generated tests before adding to test suites"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'AI Features', href: '/ai-insights' }, { label: 'Test Review' }]}
        />

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-2xl font-bold text-warning">
                {stats.pending}
              </div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-2xl font-bold text-success">
                {stats.approved}
              </div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-2xl font-bold text-destructive">
                {stats.rejected}
              </div>
              <div className="text-sm text-muted-foreground">Rejected</div>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-2xl font-bold text-primary">
                {stats.approval_rate}%
              </div>
              <div className="text-sm text-muted-foreground">Approval Rate</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'pending'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pending ({queueData?.total_pending || 0})
          </button>
          <button
            onClick={() => setActiveTab('reviewed')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'reviewed'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Recently Reviewed
          </button>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test List */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground">
              {activeTab === 'pending' ? 'Tests Awaiting Review' : 'Recently Reviewed Tests'}
            </h3>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" />
                Loading...
              </div>
            ) : (
              <div className="space-y-2">
                {(activeTab === 'pending' ? queueData?.pending : queueData?.recently_reviewed)?.map((test) => (
                  <div
                    key={test.id}
                    onClick={() => setSelectedTest(test)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedTest?.id === test.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-foreground">{test.test_name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(test.confidence_level)}`}>
                          {Math.round(test.confidence_score * 100)}%
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(test.approval.status)}`}>
                          {test.approval.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{test.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{new Date(test.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{test.language}</span>
                      {test.ai_metadata?.used_real_ai && (
                        <>
                          <span>•</span>
                          <span className="text-primary">AI Generated</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {(activeTab === 'pending' ? queueData?.pending : queueData?.recently_reviewed)?.length === 0 && (
                  <EmptyState
                    icon={activeTab === 'pending' ? <ClipboardCheck className="h-12 w-12" strokeWidth={1.5} /> : <CheckCircle className="h-12 w-12" strokeWidth={1.5} />}
                    title={activeTab === 'pending' ? 'No tests pending review' : 'No recently reviewed tests'}
                    description={activeTab === 'pending' ? 'AI-generated tests will appear here for your review.' : 'Tests you review will appear here.'}
                    size="sm"
                  />
                )}
              </div>
            )}
          </div>

          {/* Test Details */}
          <div className="space-y-4">
            {selectedTest ? (
              <>
                <div className="bg-card rounded-lg border border-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground">{selectedTest.test_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTest.approval.status)}`}>
                      {selectedTest.approval.status}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">{selectedTest.description}</p>

                  {/* Code Preview */}
                  <div className="bg-muted/30 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-muted/50 border-b border-border text-xs text-muted-foreground">
                      Generated Code ({selectedTest.language})
                    </div>
                    <pre className="p-3 overflow-x-auto text-xs max-h-64">
                      <code className="text-foreground">{selectedTest.generated_code}</code>
                    </pre>
                  </div>

                  {/* Review Info (for already reviewed) */}
                  {selectedTest.approval.status !== 'pending' && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground mb-1">
                        Reviewed by {selectedTest.approval.reviewed_by_name || 'Unknown'} on{' '}
                        {selectedTest.approval.reviewed_at
                          ? new Date(selectedTest.approval.reviewed_at).toLocaleString()
                          : 'Unknown'}
                      </div>
                      {selectedTest.approval.review_comment && (
                        <div className="text-sm text-foreground">
                          Comment: {selectedTest.approval.review_comment}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Review Actions (only for pending) */}
                {selectedTest.approval.status === 'pending' && (
                  <div className="bg-card rounded-lg border border-border p-4 space-y-4">
                    <h4 className="font-medium text-foreground">Review Actions</h4>

                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Add a comment (required for rejection)..."
                      className="w-full h-20 px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(selectedTest.id)}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 rounded-lg bg-success hover:bg-success text-primary-foreground font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : (
                          <>
                            <span>✓</span>
                            Approve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleReject(selectedTest.id)}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : (
                          <>
                            <span>✕</span>
                            Reject
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-card rounded-lg border border-border p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                <div className="text-4xl mb-4">📋</div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Select a Test to Review
                </h3>
                <p className="text-sm text-muted-foreground">
                  Click on a test from the list to view details and approve or reject it.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default AITestReviewPage;
