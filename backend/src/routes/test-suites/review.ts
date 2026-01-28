// Test Suites Module - Human Review Workflow Routes
// Feature #1151: Human review workflow for AI-generated tests

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { Test } from './types';
import { getTestSuite, getTest, updateTest, updateTestSuite, listTests } from './stores';

// Review action body interface
interface ReviewTestBody {
  action: 'approve' | 'reject';
  notes?: string;
}

// Bulk review body interface
interface BulkReviewBody {
  test_ids: string[];
  action: 'approve' | 'reject';
  notes?: string;
}

export async function reviewRoutes(app: FastifyInstance) {
  // Feature #1151: Human review workflow for AI tests
  // Get all tests pending review
  app.get<{ Params: { suiteId: string } }>('/api/v1/suites/:suiteId/tests/pending-review', {
    preHandler: [authenticate],
  }, async (request) => {
    const { suiteId } = request.params;
    const suiteTests = await listTests(suiteId);
    const pendingTests = suiteTests.filter(t => t.review_status === 'pending_review');

    return {
      tests: pendingTests,
      total: pendingTests.length,
      suite_id: suiteId,
    };
  });

  // Approve or reject an AI-generated test
  app.post<{ Params: { testId: string }; Body: ReviewTestBody }>('/api/v1/tests/:testId/review', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['approve', 'reject'] },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { testId } = request.params;
    const { action, notes } = request.body;
    const user = request.user as { id: string; email: string; name?: string };

    const test = await getTest(testId);
    if (!test) {
      throw { statusCode: 404, message: 'Test not found' };
    }

    // Verify the test is pending review
    if (test.review_status !== 'pending_review') {
      throw { statusCode: 400, message: 'Test is not pending review' };
    }

    // Update review status
    const updatedTest = await updateTest(testId, {
      review_status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date(),
      review_notes: notes,
      status: action === 'approve' ? 'active' : test.status,
      updated_at: new Date(),
    });

    return {
      test: updatedTest,
      message: `Test ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    };
  });

  // Bulk approve/reject tests
  app.post<{ Body: BulkReviewBody }>('/api/v1/tests/bulk-review', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['test_ids', 'action'],
        properties: {
          test_ids: { type: 'array', items: { type: 'string' } },
          action: { type: 'string', enum: ['approve', 'reject'] },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { test_ids, action, notes } = request.body;
    const user = request.user as { id: string; email: string; name?: string };

    const reviewedTests: Test[] = [];
    const errors: { test_id: string; error: string }[] = [];

    for (const testId of test_ids) {
      const test = await getTest(testId);
      if (!test) {
        errors.push({ test_id: testId, error: 'Test not found' });
        continue;
      }

      if (test.review_status !== 'pending_review') {
        errors.push({ test_id: testId, error: 'Test is not pending review' });
        continue;
      }

      // Update review status
      const updatedTest = await updateTest(testId, {
        review_status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date(),
        review_notes: notes,
        status: action === 'approve' ? 'active' : test.status,
        updated_at: new Date(),
      });
      if (updatedTest) {
        reviewedTests.push(updatedTest);
      }
    }

    return {
      reviewed: reviewedTests.length,
      failed: errors.length,
      errors,
      message: `${reviewedTests.length} test(s) ${action === 'approve' ? 'approved' : 'rejected'}`,
    };
  });

  // Update suite's require_human_review setting
  app.patch<{ Params: { suiteId: string }; Body: { require_human_review: boolean } }>('/api/v1/suites/:suiteId/review-settings', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['require_human_review'],
        properties: {
          require_human_review: { type: 'boolean' },
        },
      },
    },
  }, async (request) => {
    const { suiteId } = request.params;
    const { require_human_review } = request.body;

    const suite = await getTestSuite(suiteId);
    if (!suite) {
      throw { statusCode: 404, message: 'Test suite not found' };
    }

    const updatedSuite = await updateTestSuite(suiteId, {
      require_human_review,
      updated_at: new Date(),
    });

    return {
      suite: updatedSuite,
      message: `Human review requirement ${require_human_review ? 'enabled' : 'disabled'}`,
    };
  });

  // Get suite's review settings
  app.get<{ Params: { suiteId: string } }>('/api/v1/suites/:suiteId/review-settings', {
    preHandler: [authenticate],
  }, async (request) => {
    const { suiteId } = request.params;

    const suite = await getTestSuite(suiteId);
    if (!suite) {
      throw { statusCode: 404, message: 'Test suite not found' };
    }

    // Count pending review tests
    const suiteTests = await listTests(suiteId);
    const pendingReview = suiteTests.filter(t => t.review_status === 'pending_review').length;
    const approved = suiteTests.filter(t => t.review_status === 'approved').length;
    const rejected = suiteTests.filter(t => t.review_status === 'rejected').length;
    const aiGenerated = suiteTests.filter(t => t.ai_generated).length;

    return {
      require_human_review: suite.require_human_review || false,
      stats: {
        total_tests: suiteTests.length,
        ai_generated: aiGenerated,
        pending_review: pendingReview,
        approved,
        rejected,
      },
    };
  });
}
