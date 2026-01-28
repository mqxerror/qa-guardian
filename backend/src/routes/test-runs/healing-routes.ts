/**
 * Test Runs - Healing Routes Module
 * Feature #1055-1063: HTTP endpoints for auto-healing functionality
 *
 * Extracted from test-runs.ts for code quality (#1356)
 *
 * This module contains the HTTP route handlers for healing operations.
 * Core healing logic is in ./healing.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { getTest, getTestSuite, getTestsMap, updateTest } from '../test-suites';
import {
  // Types
  PendingHealingApproval,
  HealingRecord,
  DOMChangeContext,
  // In-Memory Stores
  pendingHealingApprovals,
  pendingHealingUpdates,
  selectorHistory,
  // Functions
  resolveHealingApproval,
  applyHealedSelector,
  dismissHealingUpdate,
  getSelectorHistory,
  getHealingHistory,
  getHealingStats,
} from './healing';
import { testRuns, TestRun } from './execution';
import { getTestRun } from '../../services/repositories/test-runs';

/**
 * Get a test run with fallback: check in-memory Map first (for in-flight runs), then DB.
 */
async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const memRun = testRuns.get(runId);
  if (memRun) return memRun;
  return await getTestRun(runId);
}

// Reference for healing event history - import from healing module
const healingEventHistory = new Map<string, any[]>();
export { healingEventHistory };

// Initialize from healing module's getHealingHistory function
function getHealingHistoryForTest(testId: string): any[] {
  return healingEventHistory.get(testId) || [];
}

/**
 * Generate DOM diff highlights for healing event display
 */
function generateDomDiffHighlights(context: DOMChangeContext): {
  added: string[];
  removed: string[];
  changed: string[];
  summary: string;
} {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  // Attribute changes
  if (context.changedAttributes) {
    for (const attr of context.changedAttributes) {
      if (!attr.oldValue && attr.newValue) {
        added.push(`Added attribute: ${attr.name}="${attr.newValue}"`);
      } else if (attr.oldValue && !attr.newValue) {
        removed.push(`Removed attribute: ${attr.name}="${attr.oldValue}"`);
      } else if (attr.oldValue !== attr.newValue) {
        changed.push(`Changed ${attr.name}: "${attr.oldValue}" -> "${attr.newValue}"`);
      }
    }
  }

  // Parent path changes
  if (context.parentPathBefore !== context.parentPathAfter) {
    if (context.parentPathBefore && context.parentPathAfter) {
      changed.push(`Parent path changed: "${context.parentPathBefore}" -> "${context.parentPathAfter}"`);
    }
  }

  // Sibling changes
  const siblingsBefore = new Set(context.siblingsBefore || []);
  const siblingsAfter = new Set(context.siblingsAfter || []);

  for (const sib of siblingsAfter) {
    if (!siblingsBefore.has(sib)) {
      added.push(`New sibling: ${sib}`);
    }
  }
  for (const sib of siblingsBefore) {
    if (!siblingsAfter.has(sib)) {
      removed.push(`Removed sibling: ${sib}`);
    }
  }

  // Generate summary
  const parts: string[] = [];
  if (added.length > 0) parts.push(`${added.length} addition${added.length === 1 ? '' : 's'}`);
  if (removed.length > 0) parts.push(`${removed.length} removal${removed.length === 1 ? '' : 's'}`);
  if (changed.length > 0) parts.push(`${changed.length} change${changed.length === 1 ? '' : 's'}`);

  return {
    added,
    removed,
    changed,
    summary: parts.length > 0 ? parts.join(', ') : 'No specific changes detected',
  };
}

/**
 * Calculate fragility score based on selector strategy
 */
function getSelectorFragility(selector: string): { strategy: string; fragility: number } {
  if (selector.startsWith('#') && !selector.includes(' ')) {
    return { strategy: 'id', fragility: 0.0 }; // Most stable
  }
  if (selector.includes('data-testid=')) {
    return { strategy: 'data-testid', fragility: 0.05 };
  }
  if (selector.includes('aria-label=')) {
    return { strategy: 'aria-label', fragility: 0.1 };
  }
  if (selector.includes('name=')) {
    return { strategy: 'name', fragility: 0.15 };
  }
  if (selector.includes('text=') || selector.includes(':has-text(')) {
    return { strategy: 'text-content', fragility: 0.2 };
  }
  if (selector.includes('role=')) {
    return { strategy: 'role', fragility: 0.25 };
  }
  if (selector.startsWith('xpath=') || selector.startsWith('//')) {
    return { strategy: 'xpath', fragility: 0.35 };
  }
  if (selector.includes('nth-child') || selector.includes(':nth-of-type')) {
    return { strategy: 'positional', fragility: 0.7 };
  }
  if (selector.includes('>') && selector.split('>').length > 3) {
    return { strategy: 'deep-css', fragility: 0.6 };
  }
  // Default to css-path strategy
  return { strategy: 'css-path', fragility: 0.3 };
}

/**
 * Generate selector suggestions for fragile selectors
 */
function generateSuggestions(
  selector: string,
  stepAction: string
): Array<{ selector: string; strategy: string; confidence: number; reason: string }> {
  const suggestions: Array<{ selector: string; strategy: string; confidence: number; reason: string }> = [];

  // Suggest data-testid if not present
  if (!selector.includes('data-testid=')) {
    suggestions.push({
      selector: `[data-testid="<meaningful-name>"]`,
      strategy: 'data-testid',
      confidence: 0.95,
      reason: 'data-testid attributes are stable and developer-controlled',
    });
  }

  // Suggest aria-label for interactive elements
  if (['click', 'fill', 'type'].includes(stepAction) && !selector.includes('aria-label=')) {
    suggestions.push({
      selector: `[aria-label="<accessible-name>"]`,
      strategy: 'aria-label',
      confidence: 0.9,
      reason: 'aria-label is accessible and semantically meaningful',
    });
  }

  // Suggest role-based selector
  if (['click'].includes(stepAction) && !selector.includes('role=')) {
    suggestions.push({
      selector: `[role="button"]` + (selector.includes('text') ? `` : `:has-text("<button-text>")`),
      strategy: 'role',
      confidence: 0.85,
      reason: 'Role-based selectors are semantic and stable',
    });
  }

  // If using positional selectors, suggest alternatives
  if (selector.includes('nth-child') || selector.includes(':nth-of-type')) {
    suggestions.push({
      selector: `Use unique identifier instead of position`,
      strategy: 'id-or-testid',
      confidence: 1.0,
      reason: 'Positional selectors break when DOM order changes',
    });
  }

  // If using deep CSS path, suggest simpler selector
  if (selector.includes('>') && selector.split('>').length > 3) {
    suggestions.push({
      selector: `Simplify to direct selector with unique attribute`,
      strategy: 'simplified-css',
      confidence: 0.8,
      reason: 'Deep CSS paths are fragile to DOM structure changes',
    });
  }

  return suggestions;
}

// Interface definitions
interface HealingSuggestionsQuery {
  suite_id?: string;
  project_id?: string;
  min_fragility_score?: string;
  include_suggestions?: string;
}

interface SelectorFragilityInfo {
  test_id: string;
  test_name: string;
  suite_id: string;
  suite_name: string;
  step_index: number;
  step_action: string;
  current_selector: string;
  current_strategy: string;
  fragility_score: number;
  healing_count: number;
  last_healed_at?: string;
  suggestions: Array<{
    selector: string;
    strategy: string;
    confidence: number;
    reason: string;
  }>;
}

interface BulkHealingUpdate {
  updates: Array<{
    test_id: string;
    step_index: number;
    new_selector: string;
  }>;
}

/**
 * Register healing routes with the Fastify application
 */
export async function healingRoutes(app: FastifyInstance) {
  // Feature #1056: Resolve pending healing approval
  app.post<{
    Params: { approvalId: string };
    Body: { approved: boolean };
  }>('/api/v1/healing/approvals/:approvalId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { approvalId } = request.params;
    const { approved } = request.body;
    const user = request.user as JwtPayload;
    const userId = user?.email || user?.id;

    if (typeof approved !== 'boolean') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Request body must include "approved" boolean field',
      });
    }

    const success = resolveHealingApproval(approvalId, approved, userId);
    if (!success) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Pending healing approval not found or already resolved',
      });
    }

    return {
      approval_id: approvalId,
      status: approved ? 'approved' : 'rejected',
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
      message: `Healing suggestion ${approved ? 'approved' : 'rejected'} successfully`,
    };
  });

  // Feature #1056: Get pending healing approvals for a run
  app.get<{ Params: { runId: string } }>('/api/v1/runs/:runId/healing/pending', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Filter pending approvals for this run
    const pending: PendingHealingApproval[] = [];
    for (const approval of pendingHealingApprovals.values()) {
      if (approval.runId === runId && approval.status === 'pending') {
        pending.push(approval);
      }
    }

    return {
      run_id: runId,
      pending_approvals: pending,
      count: pending.length,
    };
  });

  // Feature #1057: Apply a healed selector to test definition
  app.post<{
    Params: { healingId: string };
  }>('/api/v1/healing/updates/:healingId/apply', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { healingId } = request.params;
    const user = request.user as JwtPayload;
    const userId = user?.email || user?.id;

    const result = await applyHealedSelector(healingId, userId);
    if (!result.success) {
      return reply.status(404).send({
        error: 'Error',
        message: result.error || 'Failed to apply healing update',
      });
    }

    const record = pendingHealingUpdates.get(healingId);
    return {
      healing_id: healingId,
      status: 'applied',
      applied_by: userId,
      applied_at: record?.appliedAt,
      message: 'Healed selector applied to test definition successfully',
    };
  });

  // Feature #1057: Dismiss a healing update
  app.post<{
    Params: { healingId: string };
  }>('/api/v1/healing/updates/:healingId/dismiss', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { healingId } = request.params;

    const success = dismissHealingUpdate(healingId);
    if (!success) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Pending healing update not found or already resolved',
      });
    }

    return {
      healing_id: healingId,
      status: 'dismissed',
      message: 'Healing update dismissed',
    };
  });

  // Feature #1057: Get pending healing updates for a test
  app.get<{ Params: { testId: string } }>('/api/v1/tests/:testId/healing/pending', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);

    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    // Filter pending updates for this test
    const pending: HealingRecord[] = [];
    for (const update of pendingHealingUpdates.values()) {
      if (update.testId === testId && update.status === 'pending') {
        pending.push(update);
      }
    }

    return {
      test_id: testId,
      pending_updates: pending,
      count: pending.length,
    };
  });

  // Feature #1057: Get selector history for a test step
  app.get<{ Params: { testId: string; stepIndex: string } }>('/api/v1/tests/:testId/steps/:stepIndex/selector-history', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId, stepIndex } = request.params;
    const orgId = getOrganizationId(request);

    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    const history = getSelectorHistory(testId, parseInt(stepIndex, 10));
    return {
      test_id: testId,
      step_index: parseInt(stepIndex, 10),
      history,
      count: history.length,
    };
  });

  // Feature #1058: Get complete healing history for a test
  // Feature #1061: Extended to include DOM change tracking
  app.get<{ Params: { testId: string } }>('/api/v1/tests/:testId/healing/history', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);

    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    const history = getHealingHistory(testId);

    // Sort by timestamp descending (most recent first)
    const sortedHistory = [...history].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      test_id: testId,
      test_name: test.name,
      healing_events: sortedHistory.map(event => ({
        id: event.id,
        date: event.timestamp,
        step_index: event.stepIndex,
        run_id: event.runId,
        old_selector: event.originalSelector,
        new_selector: event.healedSelector,
        strategy: event.strategy,
        confidence: event.confidence,
        confidence_percent: Math.round(event.confidence * 100),
        applied: event.applied,
        applied_by: event.appliedBy,
        applied_at: event.appliedAt,
        // Feature #1061: DOM change summary
        dom_change: event.domContext ? {
          change_type: event.domContext.changeType,
          change_description: event.domContext.changeDescription,
          has_commit_link: !!event.domContext.relatedCommit?.sha,
        } : null,
      })),
      total_heals: history.length,
      applied_heals: history.filter((e: any) => e.applied).length,
    };
  });

  // Feature #1061: Get detailed healing event with DOM diff
  app.get<{ Params: { testId: string; eventId: string } }>('/api/v1/tests/:testId/healing/events/:eventId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId, eventId } = request.params;
    const orgId = getOrganizationId(request);

    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    const history = getHealingHistory(testId);
    const event = history.find((e: any) => e.id === eventId);

    if (!event) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Healing event not found',
      });
    }

    // Generate DOM diff highlights
    const domDiff = event.domContext ? generateDomDiffHighlights(event.domContext) : null;

    return {
      id: event.id,
      test_id: event.testId,
      test_name: test.name,
      step_index: event.stepIndex,
      step_name: `Step ${event.stepIndex + 1}`,
      run_id: event.runId,
      timestamp: event.timestamp,
      selectors: {
        original: event.originalSelector,
        healed: event.healedSelector,
      },
      healing: {
        strategy: event.strategy,
        confidence: event.confidence,
        confidence_percent: Math.round(event.confidence * 100),
        applied: event.applied,
        applied_by: event.appliedBy,
        applied_at: event.appliedAt,
      },
      // Feature #1061: Full DOM change context
      dom_change: event.domContext ? {
        change_type: event.domContext.changeType,
        change_description: event.domContext.changeDescription,
        before_html: event.domContext.beforeHtml,
        after_html: event.domContext.afterHtml,
        changed_attributes: event.domContext.changedAttributes,
        parent_path: {
          before: event.domContext.parentPathBefore,
          after: event.domContext.parentPathAfter,
        },
        siblings: {
          before: event.domContext.siblingsBefore,
          after: event.domContext.siblingsAfter,
        },
        diff_highlights: domDiff,
      } : null,
      // Feature #1061: Related commit info
      related_commit: event.domContext?.relatedCommit || null,
    };
  });

  // Feature #1061: Link commit to healing event
  app.post<{ Params: { testId: string; eventId: string }; Body: {
    sha: string;
    message?: string;
    author?: string;
    timestamp?: string;
    url?: string;
  } }>('/api/v1/tests/:testId/healing/events/:eventId/link-commit', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId, eventId } = request.params;
    const { sha, message, author, timestamp, url } = request.body;
    const orgId = getOrganizationId(request);

    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    if (!sha) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'sha is required',
      });
    }

    const history = healingEventHistory.get(testId);
    if (!history) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Healing event not found',
      });
    }

    const event = history.find(e => e.id === eventId);
    if (!event) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Healing event not found',
      });
    }

    // Initialize domContext if needed
    if (!event.domContext) {
      event.domContext = {
        changeType: 'unknown',
        changeDescription: 'DOM change detected during healing',
      };
    }

    // Link the commit
    event.domContext.relatedCommit = {
      sha,
      message,
      author,
      timestamp,
      url,
    };

    console.log(`[HEALING] Linked commit ${sha} to healing event ${eventId}`);

    return {
      success: true,
      event_id: eventId,
      linked_commit: event.domContext.relatedCommit,
    };
  });

  // Feature #1059: Get healing success rate dashboard
  app.get('/api/v1/healing/stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const stats = getHealingStats();

    return {
      ...stats,
      // Add additional dashboard-friendly metrics
      healing_effectiveness: stats.success_rate >= 80 ? 'excellent' :
        stats.success_rate >= 60 ? 'good' :
        stats.success_rate >= 40 ? 'moderate' : 'needs_improvement',
      most_effective_strategy: stats.by_strategy[0]?.strategy || 'none',
      most_effective_strategy_rate: stats.by_strategy[0]?.success_rate || 0,
    };
  });

  // Feature #1060: Generate healing suggestions report
  app.get<{ Querystring: HealingSuggestionsQuery }>('/api/v1/healing/suggestions-report', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { suite_id, project_id, min_fragility_score, include_suggestions } = request.query;
    const minFragility = parseFloat(min_fragility_score || '0.3');
    const includeSuggestions = include_suggestions !== 'false';

    const fragilityReport: SelectorFragilityInfo[] = [];

    // Iterate through all tests for the organization
    for (const [testId, test] of (await getTestsMap()).entries()) {
      if (test.organization_id !== orgId) continue;

      // Filter by project if specified
      if (project_id) {
        const suite = await getTestSuite(test.suite_id);
        if (!suite || suite.project_id !== project_id) continue;
      }

      // Filter by suite if specified
      if (suite_id && test.suite_id !== suite_id) continue;

      if (!test.steps || test.steps.length === 0) continue;

      const suite = await getTestSuite(test.suite_id);
      const suiteName = suite?.name || 'Unknown Suite';

      // Get healing history for this test
      const testHealingHistory = getHealingHistory(testId);

      // Analyze each step's selector
      test.steps.forEach((step: any, stepIndex: number) => {
        if (!step.selector) return;

        const { strategy, fragility } = getSelectorFragility(step.selector);

        // Count how many times this step needed healing
        const stepHealings = testHealingHistory.filter((h: any) => h.stepIndex === stepIndex);
        const healingCount = stepHealings.length;

        // Adjust fragility based on healing history (more heals = more fragile)
        const adjustedFragility = Math.min(1.0, fragility + (healingCount * 0.1));

        // Only include if meets minimum fragility threshold
        if (adjustedFragility < minFragility) return;

        const lastHealing = stepHealings.sort((a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];

        const info: SelectorFragilityInfo = {
          test_id: testId,
          test_name: test.name,
          suite_id: test.suite_id,
          suite_name: suiteName,
          step_index: stepIndex,
          step_action: step.action || 'unknown',
          current_selector: step.selector,
          current_strategy: strategy,
          fragility_score: Math.round(adjustedFragility * 100) / 100,
          healing_count: healingCount,
          last_healed_at: lastHealing?.timestamp,
          suggestions: includeSuggestions ? generateSuggestions(step.selector, step.action || '') : [],
        };

        fragilityReport.push(info);
      });
    }

    // Sort by fragility score (most fragile first)
    fragilityReport.sort((a, b) => b.fragility_score - a.fragility_score);

    // Calculate summary statistics
    const totalFragileSelectors = fragilityReport.length;
    const criticalCount = fragilityReport.filter(f => f.fragility_score >= 0.7).length;
    const warningCount = fragilityReport.filter(f => f.fragility_score >= 0.4 && f.fragility_score < 0.7).length;
    const minorCount = fragilityReport.filter(f => f.fragility_score < 0.4).length;
    const totalHealingsNeeded = fragilityReport.reduce((sum, f) => sum + f.healing_count, 0);

    // Group by test for bulk update support
    const byTest: Record<string, SelectorFragilityInfo[]> = {};
    fragilityReport.forEach(item => {
      if (!byTest[item.test_id]) {
        byTest[item.test_id] = [];
      }
      byTest[item.test_id]!.push(item);
    });

    return {
      report_generated_at: new Date().toISOString(),
      organization_id: orgId,
      filters: {
        suite_id: suite_id || null,
        project_id: project_id || null,
        min_fragility_score: minFragility,
      },
      summary: {
        total_fragile_selectors: totalFragileSelectors,
        critical_fragility: criticalCount,
        warning_fragility: warningCount,
        minor_fragility: minorCount,
        total_healings_needed: totalHealingsNeeded,
        tests_affected: Object.keys(byTest).length,
      },
      fragile_selectors: fragilityReport,
      // Bulk update data - grouped by test for easier processing
      bulk_update_available: true,
      by_test: Object.entries(byTest).map(([testId, selectors]) => ({
        test_id: testId,
        test_name: selectors[0]?.test_name,
        fragile_selector_count: selectors.length,
        selectors: selectors.map(s => ({
          step_index: s.step_index,
          current_selector: s.current_selector,
          fragility_score: s.fragility_score,
          suggestions: s.suggestions,
        })),
      })),
    };
  });

  // Feature #1060: Bulk update fragile selectors
  app.post<{ Body: BulkHealingUpdate }>('/api/v1/healing/bulk-update', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;
    const { updates } = request.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'updates array is required and must not be empty',
      });
    }

    const results: Array<{
      test_id: string;
      step_index: number;
      success: boolean;
      error?: string;
      old_selector?: string;
      new_selector?: string;
    }> = [];

    for (const update of updates) {
      const { test_id, step_index, new_selector } = update;

      // Validate the test exists and belongs to the organization
      const test = await getTest(test_id);
      if (!test || test.organization_id !== orgId) {
        results.push({
          test_id,
          step_index,
          success: false,
          error: 'Test not found or access denied',
        });
        continue;
      }

      // Validate step index
      if (!test.steps || step_index >= test.steps.length || step_index < 0) {
        results.push({
          test_id,
          step_index,
          success: false,
          error: 'Invalid step index',
        });
        continue;
      }

      const step = test.steps[step_index];
      if (!step) {
        results.push({
          test_id,
          step_index,
          success: false,
          error: 'Step not found',
        });
        continue;
      }
      const oldSelector = step.selector || '';

      // Store old selector in history
      const historyKey = `${test_id}-${step_index}`;
      const history = selectorHistory.get(historyKey) || [];
      history.push({
        selector: oldSelector,
        strategy: 'original',
        confidence: 1.0,
        replacedAt: new Date().toISOString(),
        replacedBy: user.id || 'system',
        reason: 'manual_update',
      });
      selectorHistory.set(historyKey, history);

      // Update the selector
      step.selector = new_selector;
      await updateTest(test_id, test);

      results.push({
        test_id,
        step_index,
        success: true,
        old_selector: oldSelector,
        new_selector: new_selector,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return {
      updated_at: new Date().toISOString(),
      updated_by: user.id || user.email,
      summary: {
        total_updates: updates.length,
        successful: successCount,
        failed: failureCount,
      },
      results,
    };
  });

  console.log('[HEALING-ROUTES] Healing routes registered');
}
