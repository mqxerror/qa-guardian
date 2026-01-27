// ============================================================================
// FEATURE #1500: AI Test Review Queue Page
// Review and approve/reject AI-generated tests before adding to test suites
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';

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

export function AITestReviewPage() {
  const [queueData, setQueueData] = useState<ReviewQueueData | null>(null);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState<PendingTest | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');

  const fetchQueueData = async () => {
    setIsLoading(true);
    try {
      const [queueRes, statsRes] = await Promise.all([
        fetch('/api/v1/ai/review-queue'),
        fetch('/api/v1/ai/approval-stats'),
      ]);

      const queueResult = await queueRes.json();
      const statsResult = await statsRes.json();

      if (queueResult.success) {
        setQueueData(queueResult);
      }
      if (statsResult.success) {
        setStats(statsResult.stats);
      }
    } catch (err) {
      setError('Failed to load review queue');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  const handleApprove = async (testId: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/ai/generation-history/${testId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          comment: reviewComment,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSelectedTest(null);
        setReviewComment('');
        fetchQueueData();
      } else {
        setError(result.error || 'Failed to approve test');
      }
    } catch (err) {
      setError('Failed to approve test');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (testId: string) => {
    if (!reviewComment.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/ai/generation-history/${testId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          comment: reviewComment,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSelectedTest(null);
        setReviewComment('');
        fetchQueueData();
      } else {
        setError(result.error || 'Failed to reject test');
      }
    } catch (err) {
      setError('Failed to reject test');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'rejected':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <span className="text-2xl">📋</span>
              AI Test Review Queue
            </h1>
            <p className="text-muted-foreground mt-1">
              Review and approve AI-generated tests before adding to test suites
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.pending}
              </div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.approved}
              </div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
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
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
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
                <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
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
                          <span className="text-blue-600 dark:text-blue-400">AI Generated</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {(activeTab === 'pending' ? queueData?.pending : queueData?.recently_reviewed)?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {activeTab === 'pending' ? 'No tests pending review' : 'No recently reviewed tests'}
                  </div>
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
                        className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
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
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
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
