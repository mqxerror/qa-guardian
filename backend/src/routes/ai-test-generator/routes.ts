/**
 * AI Test Generator Routes
 * Feature #1499: Add test generation history and versioning
 * Feature #1500: Implement approval workflow for generated tests
 *
 * Provides API endpoints for:
 * - Saving generated tests to history
 * - Retrieving generation history
 * - Getting version chains for specific descriptions
 * - Restoring previous versions
 * - Approval workflow (approve/reject tests)
 * - Review queue for pending tests
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  AIGeneratedTest,
  SaveGeneratedTestBody,
  GenerationHistoryQuery,
  GenerationHistoryResponse,
  VersionChain,
  ApproveTestBody,
  ReviewQueueResponse,
  ApprovalStatus,
} from './types';
import {
  aiGeneratedTests,
  generateTestId,
  indexTest,
  getTestsByUser,
  getTestsByProjectId,
  getVersionChain,
  getLatestVersion,
  updateApprovalStatusIndex,
  getTestsByApprovalStatus,
} from './stores';

export default async function aiTestGeneratorRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/ai/generation-history
   * Save a generated test to history
   */
  fastify.post<{
    Body: SaveGeneratedTestBody;
  }>('/generation-history', async (request, reply) => {
    try {
      const {
        description,
        generated_code,
        test_name,
        language,
        confidence_score,
        version,
        parent_version_id,
        feedback,
        ai_metadata,
        options,
        suggested_variations,
        improvement_suggestions,
        project_id,
      } = request.body;

      // Get user from auth context (mock for development)
      const userId = (request as any).user?.id || 'demo-user';
      const organizationId = (request as any).user?.organization_id || 'demo-org';

      // Determine confidence level
      let confidenceLevel: 'high' | 'medium' | 'low';
      if (confidence_score >= 0.8) {
        confidenceLevel = 'high';
      } else if (confidence_score >= 0.5) {
        confidenceLevel = 'medium';
      } else {
        confidenceLevel = 'low';
      }

      // Determine version number
      const latestVersion = getLatestVersion(userId, description);
      const newVersion = version || latestVersion + 1;

      const now = new Date();
      const test: AIGeneratedTest = {
        id: generateTestId(),
        user_id: userId,
        organization_id: organizationId,
        project_id,
        description,
        generated_code,
        test_name,
        language,
        confidence_score,
        confidence_level: confidenceLevel,
        version: newVersion,
        parent_version_id,
        feedback,
        ai_metadata,
        options,
        suggested_variations,
        improvement_suggestions,
        // Feature #1500: Default to pending approval
        approval: {
          status: 'pending',
        },
        created_at: now,
        updated_at: now,
      };

      // Save to store
      indexTest(test);

      return reply.status(201).send({
        success: true,
        test,
      });
    } catch (error) {
      request.log.error(error, 'Failed to save generated test');
      return reply.status(500).send({
        success: false,
        error: 'Failed to save generated test',
      });
    }
  });

  /**
   * GET /api/v1/ai/generation-history
   * Get generation history for the current user
   */
  fastify.get<{
    Querystring: GenerationHistoryQuery;
  }>('/generation-history', async (request, reply) => {
    try {
      const {
        project_id,
        limit = 20,
        offset = 0,
        description_search,
        approval_status,
      } = request.query;

      // Get user from auth context (mock for development)
      const userId = (request as any).user?.id || 'demo-user';

      // Get tests based on filters
      let tests: AIGeneratedTest[];
      if (project_id) {
        tests = getTestsByProjectId(project_id);
        // Filter by user
        tests = tests.filter(t => t.user_id === userId);
      } else {
        tests = getTestsByUser(userId);
      }

      // Feature #1500: Apply approval status filter
      if (approval_status) {
        tests = tests.filter(t => t.approval?.status === approval_status);
      }

      // Apply description search filter
      if (description_search) {
        const searchLower = description_search.toLowerCase();
        tests = tests.filter(t =>
          t.description.toLowerCase().includes(searchLower) ||
          t.test_name.toLowerCase().includes(searchLower)
        );
      }

      // Get total count before pagination
      const total = tests.length;

      // Apply pagination
      const paginatedTests = tests.slice(offset, offset + limit);

      const response: GenerationHistoryResponse = {
        items: paginatedTests,
        total,
        limit,
        offset,
      };

      return reply.send(response);
    } catch (error) {
      request.log.error(error, 'Failed to get generation history');
      return reply.status(500).send({
        success: false,
        error: 'Failed to get generation history',
      });
    }
  });

  /**
   * GET /api/v1/ai/generation-history/:testId
   * Get a specific generated test by ID
   */
  fastify.get<{
    Params: { testId: string };
  }>('/generation-history/:testId', async (request, reply) => {
    try {
      const { testId } = request.params;

      const test = aiGeneratedTests.get(testId);
      if (!test) {
        return reply.status(404).send({
          success: false,
          error: 'Generated test not found',
        });
      }

      return reply.send({
        success: true,
        test,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get generated test');
      return reply.status(500).send({
        success: false,
        error: 'Failed to get generated test',
      });
    }
  });

  /**
   * GET /api/v1/ai/generation-history/versions
   * Get version chain for a specific description
   */
  fastify.get<{
    Querystring: { description: string };
  }>('/generation-history/versions', async (request, reply) => {
    try {
      const { description } = request.query;

      if (!description) {
        return reply.status(400).send({
          success: false,
          error: 'Description is required',
        });
      }

      // Get user from auth context (mock for development)
      const userId = (request as any).user?.id || 'demo-user';

      const versions = getVersionChain(userId, description);
      const latestVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) : 0;

      const response: VersionChain = {
        description,
        versions,
        latest_version: latestVersion,
      };

      return reply.send({
        success: true,
        ...response,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get version chain');
      return reply.status(500).send({
        success: false,
        error: 'Failed to get version chain',
      });
    }
  });

  /**
   * DELETE /api/v1/ai/generation-history/:testId
   * Delete a generated test from history
   */
  fastify.delete<{
    Params: { testId: string };
  }>('/generation-history/:testId', async (request, reply) => {
    try {
      const { testId } = request.params;

      const test = aiGeneratedTests.get(testId);
      if (!test) {
        return reply.status(404).send({
          success: false,
          error: 'Generated test not found',
        });
      }

      // Remove from store
      aiGeneratedTests.delete(testId);

      return reply.send({
        success: true,
        message: 'Generated test deleted',
      });
    } catch (error) {
      request.log.error(error, 'Failed to delete generated test');
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete generated test',
      });
    }
  });

  // ========================================
  // Feature #1500: Approval Workflow Routes
  // ========================================

  /**
   * GET /api/v1/ai/review-queue
   * Get the review queue with pending tests and recently reviewed
   */
  fastify.get('/review-queue', async (request, reply) => {
    try {
      const pendingTests = getTestsByApprovalStatus('pending');
      const approvedTests = getTestsByApprovalStatus('approved').slice(0, 10);
      const rejectedTests = getTestsByApprovalStatus('rejected').slice(0, 10);

      // Combine and sort recently reviewed by review date
      const recentlyReviewed = [...approvedTests, ...rejectedTests]
        .filter(t => t.approval.reviewed_at)
        .sort((a, b) => {
          const aDate = a.approval.reviewed_at ? new Date(a.approval.reviewed_at).getTime() : 0;
          const bDate = b.approval.reviewed_at ? new Date(b.approval.reviewed_at).getTime() : 0;
          return bDate - aDate;
        })
        .slice(0, 10);

      const response: ReviewQueueResponse = {
        pending: pendingTests,
        total_pending: pendingTests.length,
        recently_reviewed: recentlyReviewed,
      };

      return reply.send({
        success: true,
        ...response,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get review queue');
      return reply.status(500).send({
        success: false,
        error: 'Failed to get review queue',
      });
    }
  });

  /**
   * POST /api/v1/ai/generation-history/:testId/approve
   * Approve or reject a generated test
   */
  fastify.post<{
    Params: { testId: string };
    Body: ApproveTestBody;
  }>('/generation-history/:testId/approve', async (request, reply) => {
    try {
      const { testId } = request.params;
      const { action, comment, add_to_suite_id } = request.body;

      const test = aiGeneratedTests.get(testId);
      if (!test) {
        return reply.status(404).send({
          success: false,
          error: 'Generated test not found',
        });
      }

      // Get user from auth context (mock for development)
      const userId = (request as any).user?.id || 'demo-user';
      const userName = (request as any).user?.name || 'Demo User';

      const oldStatus = test.approval.status;
      const newStatus: ApprovalStatus = action === 'approve' ? 'approved' : 'rejected';

      // Update approval info
      test.approval = {
        status: newStatus,
        reviewed_by: userId,
        reviewed_by_name: userName,
        reviewed_at: new Date(),
        review_comment: comment,
        added_to_suite_id: action === 'approve' ? add_to_suite_id : undefined,
      };
      test.updated_at = new Date();

      // Update the store
      aiGeneratedTests.set(testId, test);

      // Update the approval status index
      updateApprovalStatusIndex(testId, oldStatus, newStatus);

      return reply.send({
        success: true,
        test,
        message: `Test ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });
    } catch (error) {
      request.log.error(error, 'Failed to approve/reject test');
      return reply.status(500).send({
        success: false,
        error: 'Failed to process approval',
      });
    }
  });

  /**
   * GET /api/v1/ai/approval-stats
   * Get statistics about approval workflow
   */
  fastify.get('/approval-stats', async (request, reply) => {
    try {
      const pending = getTestsByApprovalStatus('pending').length;
      const approved = getTestsByApprovalStatus('approved').length;
      const rejected = getTestsByApprovalStatus('rejected').length;
      const total = pending + approved + rejected;

      return reply.send({
        success: true,
        stats: {
          pending,
          approved,
          rejected,
          total,
          approval_rate: total > 0 ? (approved / (approved + rejected) * 100).toFixed(1) : 0,
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to get approval stats');
      return reply.status(500).send({
        success: false,
        error: 'Failed to get approval stats',
      });
    }
  });

  // ========================================
  // Feature #1766: Parse Intent Endpoint
  // ========================================

  /**
   * POST /api/v1/ai/parse-intent
   * Parse natural language and return structured test configuration
   *
   * Accepts: { text: string, context?: object }
   * Returns: { testType, targetUrl, viewport, testName, confidence }
   */
  fastify.post<{
    Body: {
      text: string;
      context?: {
        currentPage?: string;
        projectId?: string;
        suiteId?: string;
        recentTests?: string[];
      };
    };
  }>('/parse-intent', async (request, reply) => {
    try {
      const { text, context } = request.body;

      if (!text || typeof text !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Text is required and must be a string',
        });
      }

      const input = text.toLowerCase().trim();

      // Determine action from text
      let action: 'create' | 'run' | 'analyze' | 'generate' | 'unknown' = 'unknown';
      if (input.includes('create') || input.includes('new') || input.includes('add')) {
        action = 'create';
      } else if (input.includes('run') || input.includes('execute') || input.includes('start') || input.includes('trigger')) {
        action = 'run';
      } else if (input.includes('analyze') || input.includes('check') || input.includes('review') || input.includes('debug')) {
        action = 'analyze';
      } else if (input.includes('generate') || input.includes('write') || input.includes('make')) {
        action = 'generate';
      }

      // Determine test type from keywords
      let testType: 'e2e' | 'visual' | 'accessibility' | 'performance' | 'load' | 'security' | undefined;
      if (input.includes('visual') || input.includes('screenshot') || input.includes('ui regression') || input.includes('appearance')) {
        testType = 'visual';
      } else if (input.includes('accessibility') || input.includes('a11y') || input.includes('wcag') || input.includes('screen reader')) {
        testType = 'accessibility';
      } else if (input.includes('performance') || input.includes('lighthouse') || input.includes('speed') || input.includes('core web vitals')) {
        testType = 'performance';
      } else if (input.includes('load') || input.includes('stress') || input.includes('k6') || input.includes('concurrent')) {
        testType = 'load';
      } else if (input.includes('security') || input.includes('dast') || input.includes('vulnerability') || input.includes('owasp')) {
        testType = 'security';
      } else if (input.includes('e2e') || input.includes('end-to-end') || input.includes('functional') || input.includes('flow')) {
        testType = 'e2e';
      }

      // Extract URL if present
      const urlMatch = input.match(/https?:\/\/[^\s"'<>]+/);
      const targetUrl = urlMatch ? urlMatch[0] : undefined;

      // Extract test name patterns
      let testName: string | undefined;
      const namePatterns = [
        /(?:called|named)\s+["']([^"']+)["']/i,
        /(?:test|create|make)\s+(?:a\s+)?["']([^"']+)["']/i,
        /["']([^"']+)["']\s+test/i,
        /test\s+(?:for\s+)?(\w[\w\s]+?)(?:\s+on|\s+at|\s+with|$)/i,
      ];
      for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match) {
          testName = match[1].trim();
          break;
        }
      }

      // Default test name based on URL or test type
      if (!testName) {
        if (targetUrl) {
          try {
            const url = new URL(targetUrl);
            testName = `Test ${url.hostname}${url.pathname !== '/' ? url.pathname : ''}`;
          } catch {
            testName = `Test ${targetUrl.slice(0, 30)}`;
          }
        } else if (testType) {
          const typeNames: Record<string, string> = {
            e2e: 'E2E Test',
            visual: 'Visual Regression Test',
            accessibility: 'Accessibility Audit',
            performance: 'Performance Test',
            load: 'Load Test',
            security: 'Security Scan',
          };
          testName = typeNames[testType] || 'New Test';
        }
      }

      // Determine viewport from text
      let viewport: { width: number; height: number } | undefined;
      if (input.includes('mobile') || input.includes('phone') || input.includes('iphone')) {
        viewport = { width: 375, height: 667 };
      } else if (input.includes('tablet') || input.includes('ipad')) {
        viewport = { width: 768, height: 1024 };
      } else if (input.includes('desktop') || input.includes('full') || input.includes('1920')) {
        viewport = { width: 1920, height: 1080 };
      } else if (input.includes('laptop') || input.includes('1280')) {
        viewport = { width: 1280, height: 720 };
      }

      // Extract additional parameters
      const parameters: Record<string, unknown> = {};

      // Check for browser preferences
      if (input.includes('chrome') || input.includes('chromium')) {
        parameters.browser = 'chromium';
      } else if (input.includes('firefox')) {
        parameters.browser = 'firefox';
      } else if (input.includes('safari') || input.includes('webkit')) {
        parameters.browser = 'webkit';
      }

      // Check for load test parameters
      if (testType === 'load') {
        const vusMatch = input.match(/(\d+)\s*(?:users?|vus?|virtual\s*users?|concurrent)/i);
        if (vusMatch) {
          parameters.virtualUsers = parseInt(vusMatch[1], 10);
        }
        const durationMatch = input.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
        if (durationMatch) {
          parameters.duration = `${durationMatch[1]}m`;
        }
      }

      // Check for visual test threshold
      if (testType === 'visual') {
        const thresholdMatch = input.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:threshold|diff|difference)/i);
        if (thresholdMatch) {
          parameters.diffThreshold = parseFloat(thresholdMatch[1]) / 100;
        }
      }

      // Calculate confidence score
      let confidence = 0.3; // Base confidence
      if (action !== 'unknown') confidence += 0.15;
      if (testType) confidence += 0.2;
      if (targetUrl) confidence += 0.2;
      if (testName && !testName.startsWith('New ') && !testName.startsWith('Test ')) confidence += 0.1;
      if (viewport) confidence += 0.05;
      if (Object.keys(parameters).length > 0) confidence += 0.1;
      confidence = Math.min(confidence, 1);

      // Determine confidence level
      let confidenceLevel: 'high' | 'medium' | 'low';
      if (confidence >= 0.7) {
        confidenceLevel = 'high';
      } else if (confidence >= 0.45) {
        confidenceLevel = 'medium';
      } else {
        confidenceLevel = 'low';
      }

      // Generate suggestions based on what's missing
      const suggestions: string[] = [];
      if (!testType) {
        suggestions.push('Specify test type: e2e, visual, accessibility, performance, load, or security');
      }
      if (!targetUrl) {
        suggestions.push('Add a target URL (e.g., https://example.com)');
      }
      if (!testName || testName.startsWith('New ') || testName.startsWith('Test ')) {
        suggestions.push('Give your test a descriptive name');
      }
      if (testType === 'visual' && !viewport) {
        suggestions.push('Specify viewport size: mobile (375x667), tablet (768x1024), or desktop (1920x1080)');
      }

      return reply.send({
        success: true,
        intent: {
          action,
          testType,
          targetUrl,
          viewport,
          testName,
          parameters,
          confidence,
          confidenceLevel,
          suggestions,
          originalText: text,
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to parse intent');
      return reply.status(500).send({
        success: false,
        error: 'Failed to parse intent',
      });
    }
  });
}
