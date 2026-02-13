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

import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate, JwtPayload, ApiKeyPayload, InternalServicePayload } from '../../middleware/auth.js';
import { sendError } from '../../utils/errors.js';
import {
  AIGeneratedTest,
  SaveGeneratedTestBody,
  GenerationHistoryQuery,
  GenerationHistoryResponse,
  VersionChain,
  ApproveTestBody,
  ReviewQueueResponse,
  ApprovalStatus,
} from './types.js';
import {
  getAiGeneratedTest,
  updateAiGeneratedTest,
  deleteAiGeneratedTest,
  generateTestId,
  indexTest,
  getTestsByUser,
  getTestsByProjectId,
  getVersionChain,
  getLatestVersion,
  updateApprovalStatusIndex,
  getTestsByApprovalStatus,
} from './stores.js';

// Helper to get user info from authenticated request
function getUserFromRequest(request: FastifyRequest): { userId: string; organizationId: string; userName?: string } {
  const user = request.user as JwtPayload | ApiKeyPayload | InternalServicePayload;

  // Handle internal service token
  if ('type' in user && user.type === 'internal_service') {
    return {
      userId: 'internal-service',
      organizationId: 'system',
      userName: 'Internal Service',
    };
  }

  // Handle API key
  if ('type' in user && user.type === 'api_key') {
    return {
      userId: user.id,
      organizationId: user.organization_id,
      userName: 'API User',
    };
  }

  // Handle JWT user
  const jwtUser = user as JwtPayload;
  return {
    userId: jwtUser.id,
    organizationId: jwtUser.organization_id,
    userName: jwtUser.email,
  };
}

export default async function aiTestGeneratorRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/ai/generation-history
   * Save a generated test to history
   * Feature #312: Requires authentication
   */
  fastify.post<{
    Body: SaveGeneratedTestBody;
  }>('/generation-history', {
    preHandler: [authenticate],
  }, async (request, reply) => {
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

      // Feature #312: Get user from authenticated request
      const { userId, organizationId } = getUserFromRequest(request);

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
      const latestVersion = await getLatestVersion(userId, description);
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
      await indexTest(test);

      return reply.status(201).send({
        success: true,
        test,
      });
    } catch (error) {
      request.log.error(error, 'Failed to save generated test');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to save generated test');
    }
  });

  /**
   * GET /api/v1/ai/generation-history
   * Get generation history for the current user
   * Feature #312: Requires authentication
   */
  fastify.get<{
    Querystring: GenerationHistoryQuery;
  }>('/generation-history', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const {
        project_id,
        limit = 20,
        offset = 0,
        description_search,
        approval_status,
      } = request.query;

      // Feature #312: Get user from authenticated request
      const { userId } = getUserFromRequest(request);

      // Get tests based on filters
      let tests: AIGeneratedTest[];
      if (project_id) {
        tests = await getTestsByProjectId(project_id);
        // Filter by user
        tests = tests.filter(t => t.user_id === userId);
      } else {
        tests = await getTestsByUser(userId);
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
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to get generation history');
    }
  });

  /**
   * GET /api/v1/ai/generation-history/:testId
   * Get a specific generated test by ID
   * Feature #312: Requires authentication
   */
  fastify.get<{
    Params: { testId: string };
  }>('/generation-history/:testId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { testId } = request.params;

      const test = await getAiGeneratedTest(testId);
      if (!test) {
        return sendError(reply, 404, 'NOT_FOUND', 'Generated test not found');
      }

      return reply.send({
        success: true,
        test,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get generated test');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to get generated test');
    }
  });

  /**
   * GET /api/v1/ai/generation-history/versions
   * Get version chain for a specific description
   * Feature #312: Requires authentication
   */
  fastify.get<{
    Querystring: { description: string };
  }>('/generation-history/versions', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { description } = request.query;

      if (!description) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Description is required');
      }

      // Feature #312: Get user from authenticated request
      const { userId } = getUserFromRequest(request);

      const versions = await getVersionChain(userId, description);
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
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to get version chain');
    }
  });

  /**
   * DELETE /api/v1/ai/generation-history/:testId
   * Delete a generated test from history
   * Feature #312: Requires authentication
   */
  fastify.delete<{
    Params: { testId: string };
  }>('/generation-history/:testId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { testId } = request.params;

      const test = await getAiGeneratedTest(testId);
      if (!test) {
        return sendError(reply, 404, 'NOT_FOUND', 'Generated test not found');
      }

      // Remove from store
      await deleteAiGeneratedTest(testId);

      return reply.send({
        success: true,
        message: 'Generated test deleted',
      });
    } catch (error) {
      request.log.error(error, 'Failed to delete generated test');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete generated test');
    }
  });

  // ========================================
  // Feature #1500: Approval Workflow Routes
  // ========================================

  /**
   * GET /api/v1/ai/review-queue
   * Get the review queue with pending tests and recently reviewed
   * Feature #312: Requires authentication
   */
  fastify.get('/review-queue', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const pendingTests = await getTestsByApprovalStatus('pending');
      const allApprovedTests = await getTestsByApprovalStatus('approved');
      const allRejectedTests = await getTestsByApprovalStatus('rejected');
      const approvedTests = allApprovedTests.slice(0, 10);
      const rejectedTests = allRejectedTests.slice(0, 10);

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
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to get review queue');
    }
  });

  /**
   * POST /api/v1/ai/generation-history/:testId/approve
   * Approve or reject a generated test
   * Feature #312: Requires authentication
   */
  fastify.post<{
    Params: { testId: string };
    Body: ApproveTestBody;
  }>('/generation-history/:testId/approve', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { testId } = request.params;
      const { action, comment, add_to_suite_id } = request.body;

      const test = await getAiGeneratedTest(testId);
      if (!test) {
        return sendError(reply, 404, 'NOT_FOUND', 'Generated test not found');
      }

      // Feature #312: Get user from authenticated request
      const { userId, userName } = getUserFromRequest(request);

      const oldStatus = test.approval.status;
      const newStatus: ApprovalStatus = action === 'approve' ? 'approved' : 'rejected';

      // Update approval info via async DB
      await updateAiGeneratedTest(testId, {
        approval: {
          status: newStatus,
          reviewed_by: userId,
          reviewed_by_name: userName,
          reviewed_at: new Date(),
          review_comment: comment,
          added_to_suite_id: action === 'approve' ? add_to_suite_id : undefined,
        },
        updated_at: new Date(),
      });

      // Re-fetch updated test
      test.approval = {
        status: newStatus,
        reviewed_by: userId,
        reviewed_by_name: userName,
        reviewed_at: new Date(),
        review_comment: comment,
        added_to_suite_id: action === 'approve' ? add_to_suite_id : undefined,
      };
      test.updated_at = new Date();

      // Update the approval status index
      await updateApprovalStatusIndex(testId, oldStatus, newStatus);

      return reply.send({
        success: true,
        test,
        message: `Test ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });
    } catch (error) {
      request.log.error(error, 'Failed to approve/reject test');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to process approval');
    }
  });

  /**
   * GET /api/v1/ai/approval-stats
   * Get statistics about approval workflow
   * Feature #312: Requires authentication
   */
  fastify.get('/approval-stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const pendingTests = await getTestsByApprovalStatus('pending');
      const approvedTests = await getTestsByApprovalStatus('approved');
      const rejectedTests = await getTestsByApprovalStatus('rejected');
      const pending = pendingTests.length;
      const approved = approvedTests.length;
      const rejected = rejectedTests.length;
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
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to get approval stats');
    }
  });

  // ========================================
  // Feature #1766: Parse Intent Endpoint
  // ========================================

  /**
   * POST /api/v1/ai/parse-intent
   * Parse natural language and return structured test configuration
   * Feature #312: Requires authentication
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
  }>('/parse-intent', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { text } = request.body;

      if (!text || typeof text !== 'string') {
        return sendError(reply, 400, 'BAD_REQUEST', 'Text is required and must be a string');
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
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to parse intent');
    }
  });

  /**
   * POST /api/v1/ai/openapi-to-tests
   * Parse OpenAPI/Swagger spec and generate Playwright tests
   * Feature #324: OpenAPI to Playwright test generation
   */
  fastify.post<{
    Body: {
      spec?: string; // OpenAPI spec as string (JSON or YAML)
      specUrl?: string; // URL to fetch spec from
      baseUrl?: string; // Override base URL for tests
    };
  }>('/openapi-to-tests', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { spec: specContent, specUrl, baseUrl } = request.body;

      // Need either spec content or URL
      if (!specContent && !specUrl) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Either "spec" (OpenAPI content) or "specUrl" (URL to fetch) is required');
      }

      let content = specContent;

      // Fetch spec from URL if provided
      if (specUrl && !specContent) {
        try {
          const response = await fetch(specUrl, {
            headers: {
              'Accept': 'application/json, application/yaml, text/yaml, text/plain',
            },
            signal: AbortSignal.timeout(30000),
          });

          if (!response.ok) {
            return sendError(reply, 400, 'BAD_REQUEST', `Failed to fetch spec from URL: HTTP ${response.status}`);
          }

          content = await response.text();
        } catch (fetchError) {
          return sendError(reply, 400, 'BAD_REQUEST', `Failed to fetch spec from URL: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        }
      }

      if (!content) {
        return sendError(reply, 400, 'BAD_REQUEST', 'No spec content available');
      }

      // Import the parser dynamically to avoid circular dependencies
      const { parseAndGenerateTests, parseOpenAPISpec } = await import('../../services/openapi-parser.js');

      // Parse the spec first to get metadata
      const parseResult = parseOpenAPISpec(content);
      if (!parseResult.success) {
        return sendError(reply, 400, 'BAD_REQUEST', parseResult.error || 'Failed to parse OpenAPI spec');
      }

      // Generate tests
      const result = parseAndGenerateTests(content, baseUrl);

      if (!result.success) {
        return sendError(reply, 400, 'BAD_REQUEST', result.error || 'Failed to generate tests');
      }

      return reply.send({
        success: true,
        apiTitle: result.apiTitle,
        baseUrl: result.baseUrl,
        specVersion: parseResult.version,
        summary: result.summary,
        tests: result.tests.map(t => ({
          path: t.path,
          method: t.method,
          operationId: t.operationId,
          summary: t.summary,
          tags: t.tags,
          testName: t.testName,
          testCode: t.testCode,
        })),
      });
    } catch (error) {
      request.log.error(error, 'Failed to generate tests from OpenAPI spec');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to generate tests from OpenAPI spec');
    }
  });

  /**
   * POST /api/v1/ai/openapi-parse
   * Parse OpenAPI/Swagger spec without generating tests (for validation/preview)
   * Feature #324: OpenAPI parsing endpoint
   */
  fastify.post<{
    Body: {
      spec?: string;
      specUrl?: string;
    };
  }>('/openapi-parse', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { spec: specContent, specUrl } = request.body;

      if (!specContent && !specUrl) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Either "spec" (OpenAPI content) or "specUrl" (URL to fetch) is required');
      }

      let content = specContent;

      if (specUrl && !specContent) {
        try {
          const response = await fetch(specUrl, {
            headers: {
              'Accept': 'application/json, application/yaml, text/yaml, text/plain',
            },
            signal: AbortSignal.timeout(30000),
          });

          if (!response.ok) {
            return sendError(reply, 400, 'BAD_REQUEST', `Failed to fetch spec from URL: HTTP ${response.status}`);
          }

          content = await response.text();
        } catch (fetchError) {
          return sendError(reply, 400, 'BAD_REQUEST', `Failed to fetch spec from URL: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        }
      }

      if (!content) {
        return sendError(reply, 400, 'BAD_REQUEST', 'No spec content available');
      }

      const { parseOpenAPISpec } = await import('../../services/openapi-parser.js');
      const result = parseOpenAPISpec(content);

      if (!result.success) {
        return sendError(reply, 400, 'BAD_REQUEST', result.error || 'Failed to parse OpenAPI spec');
      }

      return reply.send({
        success: true,
        title: result.title,
        version: result.version,
        baseUrl: result.baseUrl,
        endpointCount: result.endpoints,
        tags: result.spec?.tags?.map(t => ({ name: t.name, description: t.description })) || [],
        paths: Object.entries(result.spec?.paths || {}).map(([path, item]) => {
          const methods: string[] = [];
          if (item.get) methods.push('GET');
          if (item.post) methods.push('POST');
          if (item.put) methods.push('PUT');
          if (item.patch) methods.push('PATCH');
          if (item.delete) methods.push('DELETE');
          return { path, methods };
        }),
      });
    } catch (error) {
      request.log.error(error, 'Failed to parse OpenAPI spec');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to parse OpenAPI spec');
    }
  });
}
