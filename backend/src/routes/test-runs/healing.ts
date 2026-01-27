/**
 * Test Runs - Healing Module
 * Feature #1055-1063: Auto-healing configuration and selector healing
 *
 * Extracted from test-runs.ts for code quality (#1356)
 */

import { Server as SocketIOServer } from 'socket.io';
import { tests } from '../test-suites';
import { getProjectHealingSettings } from '../projects';

// Socket.IO reference (set from test-runs.ts)
let io: SocketIOServer | null = null;

export function setHealingSocketIO(socketIO: SocketIOServer) {
  io = socketIO;
}

// Feature #1055: Auto-healing configuration
// Feature #1062: Project-level thresholds take precedence, this is the global fallback
const DEFAULT_AUTO_HEAL_CONFIDENCE_THRESHOLD = parseFloat(process.env.AUTO_HEAL_THRESHOLD || '0.85');
console.log(`[Healing] Default auto-heal confidence threshold: ${DEFAULT_AUTO_HEAL_CONFIDENCE_THRESHOLD}`);

// Feature #1062: Helper to get auto-heal threshold for a project
export function getAutoHealThreshold(projectId: string): number {
  const settings = getProjectHealingSettings(projectId);
  return settings.auto_heal_confidence_threshold ?? DEFAULT_AUTO_HEAL_CONFIDENCE_THRESHOLD;
}

// Feature #1063: Helper to check if a healing strategy is enabled for a project
export function isHealingStrategyEnabled(projectId: string, strategy: string): boolean {
  const settings = getProjectHealingSettings(projectId);
  // Map healing selector strategy names to project setting names
  const strategyMapping: Record<string, string[]> = {
    'id': ['selector_fallback'],
    'data-testid': ['selector_fallback'],
    'aria-label': ['selector_fallback'],
    'name': ['selector_fallback'],
    'text-content': ['text_match', 'selector_fallback'],
    'role': ['selector_fallback'],
    'css-path': ['selector_fallback', 'css_selector'],
    'xpath': ['xpath', 'selector_fallback'],
    'visual-match': ['visual_match'],
    'attribute_match': ['attribute_match'],
  };

  const requiredStrategies = strategyMapping[strategy] || [strategy];
  // Strategy is enabled if ANY of the required setting strategies are enabled
  return requiredStrategies.some(s => settings.healing_strategies.includes(s));
}

// Feature #1063: Get enabled healing strategies for logging
export function getEnabledStrategies(projectId: string): string[] {
  const settings = getProjectHealingSettings(projectId);
  return settings.healing_strategies;
}

// Feature #1056: Pending healing approval interface
export interface PendingHealingApproval {
  id: string;
  runId: string;
  testId: string;
  stepIndex: number;
  originalSelector: string;
  suggestedSelector: string;
  strategy: string;
  confidence: number;
  visualMatchLocation?: { x: number; y: number; width: number; height: number };
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedBy?: string;
  resolvedAt?: string;
}

// In-memory store for pending healing approvals
export const pendingHealingApprovals = new Map<string, PendingHealingApproval>();

// Promise resolvers for pending approvals (used to resume test execution)
const healingApprovalResolvers = new Map<string, {
  resolve: (approved: boolean) => void;
  timeout: NodeJS.Timeout;
}>();

// Feature #1056: Wait for manual healing approval with timeout
export async function waitForHealingApproval(
  approval: PendingHealingApproval,
  orgId: string,
  timeoutMs: number = 300000 // 5 minute default timeout
): Promise<boolean> {
  // Store the pending approval
  pendingHealingApprovals.set(approval.id, approval);

  // Emit event to frontend
  if (io) {
    io.to(`run:${approval.runId}`).emit('healing_approval_required', approval);
    io.to(`org:${orgId}`).emit('healing_approval_required', approval);
    console.log(`[HEALING] Approval required - emitted to run:${approval.runId} and org:${orgId}`);
  }

  // Create promise that resolves when approved/rejected or times out
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      // Timeout - treat as rejection
      healingApprovalResolvers.delete(approval.id);
      pendingHealingApprovals.delete(approval.id);
      console.log(`[HEALING] Approval timeout for ${approval.id}`);
      resolve(false);
    }, timeoutMs);

    healingApprovalResolvers.set(approval.id, { resolve, timeout });
  });
}

// Feature #1056: Resolve a pending healing approval
export function resolveHealingApproval(approvalId: string, approved: boolean, userId?: string): boolean {
  const resolver = healingApprovalResolvers.get(approvalId);
  const approval = pendingHealingApprovals.get(approvalId);

  if (!resolver || !approval) {
    console.log(`[HEALING] No pending approval found for ${approvalId}`);
    return false;
  }

  // Clear timeout
  clearTimeout(resolver.timeout);

  // Update approval status
  approval.status = approved ? 'approved' : 'rejected';
  approval.resolvedBy = userId;
  approval.resolvedAt = new Date().toISOString();

  // Cleanup
  healingApprovalResolvers.delete(approvalId);
  pendingHealingApprovals.delete(approvalId);

  console.log(`[HEALING] Approval ${approvalId} ${approved ? 'APPROVED' : 'REJECTED'} by ${userId || 'system'}`);

  // Resolve the waiting promise
  resolver.resolve(approved);
  return true;
}

// Feature #1057: Successful healing record for updating test definitions
export interface HealingRecord {
  id: string;
  runId: string;
  testId: string;
  stepIndex: number;
  originalSelector: string;
  healedSelector: string;
  strategy: string;
  confidence: number;
  timestamp: string;
  status: 'pending' | 'applied' | 'dismissed';
  appliedBy?: string;
  appliedAt?: string;
}

// In-memory store for successful heals pending update
export const pendingHealingUpdates = new Map<string, HealingRecord>();

// Selector history for a test step
export interface SelectorHistoryEntry {
  selector: string;
  strategy: string;
  confidence: number;
  replacedAt: string;
  replacedBy: string;
  reason: 'healed' | 'manual_update';
}

// In-memory store for selector history (testId+stepIndex -> history)
export const selectorHistory = new Map<string, SelectorHistoryEntry[]>();

// Feature #1061: DOM change context for healing events
export interface DOMChangeContext {
  beforeHtml?: string;        // HTML snippet of the element area before change
  afterHtml?: string;         // HTML snippet of the element area after change
  changedAttributes?: Array<{
    name: string;
    oldValue?: string;
    newValue?: string;
  }>;
  parentPathBefore?: string;  // CSS path to parent before change
  parentPathAfter?: string;   // CSS path to parent after change
  siblingsBefore?: string[];  // Sibling element info before
  siblingsAfter?: string[];   // Sibling element info after
  changeType: 'attribute_changed' | 'element_moved' | 'element_removed' | 'parent_changed' | 'structure_changed' | 'unknown';
  changeDescription: string;  // Human-readable description
  relatedCommit?: {
    sha?: string;
    message?: string;
    author?: string;
    timestamp?: string;
    url?: string;
  };
}

// Feature #1058: Comprehensive healing event history
// Feature #1061: Extended with DOM change tracking
export interface HealingEventEntry {
  id: string;
  testId: string;
  stepIndex: number;
  runId: string;
  timestamp: string;
  originalSelector: string;
  healedSelector: string;
  strategy: string;
  confidence: number;
  applied: boolean; // Whether the heal was applied to test definition
  appliedBy?: string;
  appliedAt?: string;
  // Feature #1061: DOM change tracking
  domContext?: DOMChangeContext;
}

// In-memory store for all healing events (testId -> events)
const healingEventHistory = new Map<string, HealingEventEntry[]>();

// Feature #1058: Record healing event in history
// Feature #1061: Extended to accept DOM context
export function recordHealingEvent(
  testId: string,
  stepIndex: number,
  runId: string,
  originalSelector: string,
  healedSelector: string,
  strategy: string,
  confidence: number,
  domContext?: DOMChangeContext
): HealingEventEntry {
  const id = `heal-event-${testId}-${stepIndex}-${Date.now()}`;
  const entry: HealingEventEntry = {
    id,
    testId,
    stepIndex,
    runId,
    timestamp: new Date().toISOString(),
    originalSelector,
    healedSelector,
    strategy,
    confidence,
    applied: false,
    domContext,
  };

  const history = healingEventHistory.get(testId) || [];
  history.push(entry);
  healingEventHistory.set(testId, history);

  console.log(`[HEALING] Event recorded for test ${testId} step ${stepIndex}: ${strategy}${domContext ? ` (${domContext.changeType})` : ''}`);
  return entry;
}

// Feature #1057: Record a successful heal for potential test update
export function recordSuccessfulHeal(
  runId: string,
  testId: string,
  stepIndex: number,
  originalSelector: string,
  healedSelector: string,
  strategy: string,
  confidence: number,
  orgId: string
): HealingRecord {
  const id = `heal-update-${testId}-${stepIndex}-${Date.now()}`;
  const record: HealingRecord = {
    id,
    runId,
    testId,
    stepIndex,
    originalSelector,
    healedSelector,
    strategy,
    confidence,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };

  pendingHealingUpdates.set(id, record);

  // Feature #1058: Also record in healing event history
  recordHealingEvent(testId, stepIndex, runId, originalSelector, healedSelector, strategy, confidence);

  // Emit event to notify UI
  if (io) {
    io.to(`run:${runId}`).emit('healing_update_available', record);
    io.to(`org:${orgId}`).emit('healing_update_available', record);
    console.log(`[HEALING] Update available - emitted for test ${testId} step ${stepIndex}`);
  }

  return record;
}

// Feature #1057: Apply healed selector to test definition
export function applyHealedSelector(
  healingId: string,
  userId?: string
): { success: boolean; error?: string } {
  const record = pendingHealingUpdates.get(healingId);
  if (!record) {
    return { success: false, error: 'Healing record not found' };
  }

  if (record.status !== 'pending') {
    return { success: false, error: `Healing already ${record.status}` };
  }

  const test = tests.get(record.testId);
  if (!test) {
    return { success: false, error: 'Test not found' };
  }

  // Get the step to update
  if (!test.steps || record.stepIndex >= test.steps.length) {
    return { success: false, error: 'Invalid step index' };
  }

  const step = test.steps[record.stepIndex];

  // Store old selector in history
  const historyKey = `${record.testId}-${record.stepIndex}`;
  const history = selectorHistory.get(historyKey) || [];
  history.push({
    selector: record.originalSelector,
    strategy: 'original',
    confidence: 1.0,
    replacedAt: new Date().toISOString(),
    replacedBy: userId || 'system',
    reason: 'healed',
  });
  selectorHistory.set(historyKey, history);

  // Update the step's selector
  step.selector = record.healedSelector;

  // Update the test
  tests.set(record.testId, test);

  // Update record status
  record.status = 'applied';
  record.appliedBy = userId;
  record.appliedAt = new Date().toISOString();
  pendingHealingUpdates.set(healingId, record);

  console.log(`[HEALING] Applied healed selector to test ${record.testId} step ${record.stepIndex}`);
  console.log(`[HEALING] Old: ${record.originalSelector} -> New: ${record.healedSelector}`);

  return { success: true };
}

// Feature #1057: Dismiss a healing update
export function dismissHealingUpdate(healingId: string): boolean {
  const record = pendingHealingUpdates.get(healingId);
  if (!record || record.status !== 'pending') {
    return false;
  }

  record.status = 'dismissed';
  pendingHealingUpdates.set(healingId, record);
  return true;
}

// Feature #1057: Get selector history for a test step
export function getSelectorHistory(testId: string, stepIndex: number): SelectorHistoryEntry[] {
  return selectorHistory.get(`${testId}-${stepIndex}`) || [];
}

// Feature #1058: Get healing history for a test
export function getHealingHistory(testId: string): HealingEventEntry[] {
  return healingEventHistory.get(testId) || [];
}

// Feature #1058: Mark healing event as applied
export function markHealingEventApplied(testId: string, stepIndex: number, healingId: string, userId?: string): boolean {
  const history = healingEventHistory.get(testId);
  if (!history) return false;

  // Find the most recent event for this step that matches
  const event = history.find(e => e.id === healingId);
  if (!event) return false;

  event.applied = true;
  event.appliedBy = userId;
  event.appliedAt = new Date().toISOString();
  return true;
}

// Feature #1059: Healing statistics tracking
interface HealingStats {
  totalAttempts: number;
  successfulHeals: number;
  failedHeals: number;
  byStrategy: Record<string, { attempts: number; successes: number; failures: number }>;
  byProject: Record<string, { attempts: number; successes: number; failures: number }>;
}

// Global healing statistics (reset on server restart, could persist to file)
const healingStats: HealingStats = {
  totalAttempts: 0,
  successfulHeals: 0,
  failedHeals: 0,
  byStrategy: {},
  byProject: {},
};

// Feature #1059: Track healing attempt (called when healing is initiated)
export function trackHealingAttempt(projectId: string): void {
  healingStats.totalAttempts++;
  if (!healingStats.byProject[projectId]) {
    healingStats.byProject[projectId] = { attempts: 0, successes: 0, failures: 0 };
  }
  healingStats.byProject[projectId].attempts++;
}

// Feature #1059: Track successful heal
export function trackHealingSuccess(projectId: string, strategy: string): void {
  healingStats.successfulHeals++;

  if (!healingStats.byStrategy[strategy]) {
    healingStats.byStrategy[strategy] = { attempts: 0, successes: 0, failures: 0 };
  }
  healingStats.byStrategy[strategy].attempts++;
  healingStats.byStrategy[strategy].successes++;

  if (!healingStats.byProject[projectId]) {
    healingStats.byProject[projectId] = { attempts: 0, successes: 0, failures: 0 };
  }
  healingStats.byProject[projectId].successes++;
}

// Feature #1059: Track failed heal
export function trackHealingFailure(projectId: string): void {
  healingStats.failedHeals++;

  if (!healingStats.byProject[projectId]) {
    healingStats.byProject[projectId] = { attempts: 0, successes: 0, failures: 0 };
  }
  healingStats.byProject[projectId].failures++;
}

// Feature #1059: Get healing statistics
export function getHealingStats(): {
  total_attempts: number;
  successful_heals: number;
  failed_heals: number;
  success_rate: number;
  by_strategy: Array<{ strategy: string; attempts: number; successes: number; failures: number; success_rate: number }>;
  by_project: Array<{ project_id: string; attempts: number; successes: number; failures: number; success_rate: number }>;
} {
  const byStrategy = Object.entries(healingStats.byStrategy).map(([strategy, stats]) => ({
    strategy,
    attempts: stats.attempts,
    successes: stats.successes,
    failures: stats.failures,
    success_rate: stats.attempts > 0 ? Math.round((stats.successes / stats.attempts) * 100) : 0,
  }));

  const byProject = Object.entries(healingStats.byProject).map(([project_id, stats]) => ({
    project_id,
    attempts: stats.attempts,
    successes: stats.successes,
    failures: stats.failures,
    success_rate: stats.attempts > 0 ? Math.round((stats.successes / stats.attempts) * 100) : 0,
  }));

  return {
    total_attempts: healingStats.totalAttempts,
    successful_heals: healingStats.successfulHeals,
    failed_heals: healingStats.failedHeals,
    success_rate: healingStats.totalAttempts > 0
      ? Math.round((healingStats.successfulHeals / healingStats.totalAttempts) * 100)
      : 0,
    by_strategy: byStrategy.sort((a, b) => b.successes - a.successes),
    by_project: byProject.sort((a, b) => b.attempts - a.attempts),
  };
}
