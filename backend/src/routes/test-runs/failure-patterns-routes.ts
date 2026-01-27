/**
 * Failure Patterns Routes Module (Feature #1356 - Code Quality)
 *
 * Extracted from test-runs.ts for better maintainability.
 * Contains routes for:
 * - Common failure patterns analysis
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { testSuites } from '../test-suites';
import { testRuns } from './execution';

// Type definitions for failure pattern analysis
interface FailurePattern {
  pattern_id: string;
  category: string;
  error_signature: string;
  description: string;
  frequency: number;
  affected_tests: Set<string>;
  affected_test_names: string[];
  affected_suites: Set<string>;
  affected_runs: Set<string>;
  first_seen: Date;
  last_seen: Date;
  example_error: string;
  common_selectors: string[];
  common_urls: string[];
  fix_suggestions: string[];
}

interface FailurePatternsQueryParams {
  project_id?: string;
  suite_id?: string;
  days?: string;
  limit?: string;
  min_frequency?: string;
}

/**
 * Helper to categorize error and create signature
 */
function categorizeError(errorMessage: string): {
  category: string;
  signature: string;
  description: string;
  suggestions: string[];
} {
  // Normalize error message for signature generation
  const normalizedError = errorMessage
    .replace(/\d+/g, 'N') // Replace numbers
    .replace(/['"`]([^'"`]*?)['"`]/g, '"X"') // Replace quoted strings
    .replace(/at\s+\S+:\d+:\d+/g, 'at FILE:LINE') // Replace file locations
    .replace(/\b[a-f0-9]{8,}\b/gi, 'HASH') // Replace hex hashes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 200); // Limit signature length

  // Network errors
  if (
    errorMessage.includes('net::ERR_') ||
    errorMessage.includes('ERR_CONNECTION') ||
    errorMessage.includes('ERR_NAME_NOT_RESOLVED')
  ) {
    return {
      category: 'network',
      signature: `network:${normalizedError.substring(0, 50)}`,
      description: 'Network connectivity or DNS resolution failure',
      suggestions: [
        'Verify target URL is accessible from the test environment',
        'Check for DNS resolution issues',
        'Ensure the server is running and accepting connections',
        'Review proxy/firewall settings',
      ],
    };
  }

  // Timeout errors
  if (
    errorMessage.includes('Timeout') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('exceeded')
  ) {
    return {
      category: 'timeout',
      signature: `timeout:${normalizedError.substring(0, 50)}`,
      description: 'Test operation timed out waiting for element or response',
      suggestions: [
        'Increase timeout values for slow operations',
        'Check page load performance',
        'Verify element selectors are still valid',
        'Consider adding explicit waits',
      ],
    };
  }

  // Selector/locator errors
  if (
    errorMessage.includes('waiting for selector') ||
    errorMessage.includes('locator resolved to') ||
    (errorMessage.includes('element') &&
      (errorMessage.includes('not found') || errorMessage.includes('no longer visible')))
  ) {
    return {
      category: 'selector',
      signature: `selector:${normalizedError.substring(0, 50)}`,
      description: 'Element selector failed to locate target element',
      suggestions: [
        'Update selectors to match current page structure',
        'Use more resilient selectors (data-testid, role)',
        'Check if element is dynamically loaded',
        'Verify element is visible before interaction',
      ],
    };
  }

  // Assertion errors
  if (
    errorMessage.includes('expect') ||
    errorMessage.includes('assertion') ||
    errorMessage.includes('to be') ||
    errorMessage.includes('to have') ||
    errorMessage.includes('to equal')
  ) {
    return {
      category: 'assertion',
      signature: `assertion:${normalizedError.substring(0, 50)}`,
      description: 'Test assertion failed - actual value did not match expected',
      suggestions: [
        'Review expected values for correctness',
        'Check if application behavior has changed intentionally',
        'Verify test data is in expected state',
        'Consider if test needs updating for new features',
      ],
    };
  }

  // Click/interaction errors
  if (
    errorMessage.includes('click') ||
    errorMessage.includes('fill') ||
    errorMessage.includes('type') ||
    errorMessage.includes('intercept') ||
    errorMessage.includes('obscured')
  ) {
    return {
      category: 'interaction',
      signature: `interaction:${normalizedError.substring(0, 50)}`,
      description: 'Failed to interact with element (click, fill, etc.)',
      suggestions: [
        'Ensure element is visible and enabled',
        'Check for overlapping elements',
        'Scroll element into view before interaction',
        'Wait for animations to complete',
      ],
    };
  }

  // Authentication/authorization errors
  if (
    errorMessage.includes('401') ||
    errorMessage.includes('403') ||
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('Forbidden')
  ) {
    return {
      category: 'authentication',
      signature: `auth:${normalizedError.substring(0, 50)}`,
      description: 'Authentication or authorization failure',
      suggestions: [
        'Verify login credentials are valid',
        'Check if session has expired',
        'Ensure user has required permissions',
        'Review authentication flow in test setup',
      ],
    };
  }

  // JavaScript runtime errors
  if (
    errorMessage.includes('TypeError') ||
    errorMessage.includes('ReferenceError') ||
    errorMessage.includes('SyntaxError') ||
    errorMessage.includes('undefined is not')
  ) {
    return {
      category: 'javascript_error',
      signature: `js_error:${normalizedError.substring(0, 50)}`,
      description: 'JavaScript runtime error in application code',
      suggestions: [
        'Check application code for null/undefined handling',
        'Review recent code changes for regressions',
        'Verify all required data is loaded before access',
        'Check browser console for additional error details',
      ],
    };
  }

  // API/Server errors
  if (
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503') ||
    errorMessage.includes('Internal Server Error') ||
    errorMessage.includes('Bad Gateway')
  ) {
    return {
      category: 'server_error',
      signature: `server:${normalizedError.substring(0, 50)}`,
      description: 'Server-side error occurred during test execution',
      suggestions: [
        'Check server logs for error details',
        'Verify backend services are healthy',
        'Review API endpoint implementation',
        'Check database connectivity and queries',
      ],
    };
  }

  // Visual regression errors
  if (
    errorMessage.includes('visual') ||
    errorMessage.includes('diff') ||
    errorMessage.includes('baseline') ||
    errorMessage.includes('screenshot mismatch')
  ) {
    return {
      category: 'visual_regression',
      signature: `visual:${normalizedError.substring(0, 50)}`,
      description: 'Visual difference detected from baseline screenshot',
      suggestions: [
        'Review screenshot diff to identify changes',
        'Update baseline if changes are intentional',
        'Check for dynamic content affecting screenshots',
        'Verify consistent viewport and resolution',
      ],
    };
  }

  // Default/unknown category
  return {
    category: 'unknown',
    signature: `unknown:${normalizedError.substring(0, 50)}`,
    description: 'Unclassified error - requires manual investigation',
    suggestions: [
      'Review full error message and stack trace',
      'Check test execution video and screenshots',
      'Open Playwright trace for detailed analysis',
      'Compare with previous passing runs',
    ],
  };
}

/**
 * Helper to extract selector from error message
 */
function extractSelector(errorMessage: string): string | null {
  // Look for common selector patterns
  const patterns = [
    /selector\s+['"]([^'"]+)['"]/i,
    /locator\(['"]([^'"]+)['"]\)/i,
    /getBy\w+\(['"]([^'"]+)['"]\)/i,
    /data-testid=['"]([^'"]+)['"]/i,
    /\#([\w-]+)/,
    /\.([\w-]+)/,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Helper to extract URL from error message
 */
function extractUrl(errorMessage: string): string | null {
  const urlMatch = errorMessage.match(/https?:\/\/[^\s'"]+/);
  return urlMatch ? urlMatch[0] : null;
}

/**
 * Register failure patterns routes
 */
export async function failurePatternsRoutes(app: FastifyInstance) {
  // Feature #911: Get common failure patterns across test results
  // AI agent can identify common failure patterns to help with root cause analysis
  app.get<{ Querystring: FailurePatternsQueryParams }>(
    '/api/v1/failure-patterns',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const projectId = request.query.project_id;
      const suiteId = request.query.suite_id;
      const days = parseInt(request.query.days || '30', 10);
      const limit = Math.min(parseInt(request.query.limit || '10', 10), 50);
      const minFrequency = parseInt(request.query.min_frequency || '1', 10);
      const orgId = getOrganizationId(request);

      // Calculate date threshold
      const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Collect all failure patterns from test runs
      const patterns: Map<string, FailurePattern> = new Map();

      // Process all test runs
      for (const [runId, run] of testRuns) {
        // Filter by organization
        if (run.organization_id !== orgId) continue;

        // Filter by date
        if (run.created_at < dateThreshold) continue;

        // Filter by project/suite if specified
        if (projectId) {
          // Get suite to check project_id
          const suite = testSuites.get(run.suite_id);
          if (!suite || suite.project_id !== projectId) continue;
        }
        if (suiteId && run.suite_id !== suiteId) continue;

        // Process results
        if (!run.results) continue;

        for (const result of run.results) {
          // Only process failures
          if (result.status !== 'failed' && result.status !== 'error') continue;

          const errorMessage = result.error || 'Unknown error';
          const { category, signature, description, suggestions } = categorizeError(errorMessage);

          // Get or create pattern
          let pattern = patterns.get(signature);
          if (!pattern) {
            pattern = {
              pattern_id: signature,
              category,
              error_signature: signature,
              description,
              frequency: 0,
              affected_tests: new Set(),
              affected_test_names: [],
              affected_suites: new Set(),
              affected_runs: new Set(),
              first_seen: run.created_at,
              last_seen: run.created_at,
              example_error: errorMessage.substring(0, 500),
              common_selectors: [],
              common_urls: [],
              fix_suggestions: suggestions,
            };
            patterns.set(signature, pattern);
          }

          // Update pattern
          pattern.frequency++;
          pattern.affected_tests.add(result.test_id);
          if (!pattern.affected_test_names.includes(result.test_name)) {
            pattern.affected_test_names.push(result.test_name);
          }
          pattern.affected_suites.add(run.suite_id);
          pattern.affected_runs.add(runId);

          // Update date range
          if (run.created_at < pattern.first_seen) {
            pattern.first_seen = run.created_at;
          }
          if (run.created_at > pattern.last_seen) {
            pattern.last_seen = run.created_at;
          }

          // Extract and accumulate selectors
          const selector = extractSelector(errorMessage);
          if (selector && !pattern.common_selectors.includes(selector)) {
            pattern.common_selectors.push(selector);
          }

          // Extract and accumulate URLs
          const url = extractUrl(errorMessage);
          if (url && !pattern.common_urls.includes(url)) {
            pattern.common_urls.push(url);
          }
        }
      }

      // Convert to array and filter/sort
      const patternArray = Array.from(patterns.values())
        .filter((p) => p.frequency >= minFrequency)
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, limit)
        .map((p) => ({
          pattern_id: p.pattern_id,
          category: p.category,
          description: p.description,
          frequency: p.frequency,
          affected_tests: Array.from(p.affected_tests),
          affected_test_names: p.affected_test_names.slice(0, 10), // Limit to 10 names
          affected_suites_count: p.affected_suites.size,
          affected_runs_count: p.affected_runs.size,
          first_seen: p.first_seen.toISOString(),
          last_seen: p.last_seen.toISOString(),
          example_error: p.example_error,
          common_selectors: p.common_selectors.slice(0, 5),
          common_urls: p.common_urls.slice(0, 5),
          fix_suggestions: p.fix_suggestions,
          severity:
            p.frequency >= 10
              ? 'critical'
              : p.frequency >= 5
              ? 'high'
              : p.frequency >= 2
              ? 'medium'
              : 'low',
        }));

      // Calculate summary statistics
      const totalFailures = patternArray.reduce((sum, p) => sum + p.frequency, 0);
      const uniqueTests = new Set(patternArray.flatMap((p) => p.affected_tests)).size;
      const categoryBreakdown: Record<string, number> = {};
      for (const pattern of patternArray) {
        categoryBreakdown[pattern.category] =
          (categoryBreakdown[pattern.category] || 0) + pattern.frequency;
      }

      return {
        patterns: patternArray,
        summary: {
          total_patterns: patternArray.length,
          total_failures_analyzed: totalFailures,
          unique_tests_affected: uniqueTests,
          date_range: {
            from: dateThreshold.toISOString(),
            to: new Date().toISOString(),
            days,
          },
          category_breakdown: categoryBreakdown,
          most_common_category:
            Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
        },
        filters_applied: {
          project_id: projectId || null,
          suite_id: suiteId || null,
          days,
          limit,
          min_frequency: minFrequency,
        },
        analysis_timestamp: new Date().toISOString(),
      };
    }
  );
}
