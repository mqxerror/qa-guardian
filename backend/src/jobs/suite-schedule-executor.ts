/**
 * Feature #870: Test Suite Schedule Executor
 *
 * Polls the `schedules` table every 60s for enabled schedules
 * where next_run_at <= NOW(). Creates a test run for each due schedule
 * and enqueues it via the execution queue.
 *
 * Follows the same polling pattern as quick-test-scheduler.ts (Feature #684).
 */

import crypto from 'crypto';
import { isDatabaseConnected } from '../services/database.js';
import {
  type Schedule,
  getSchedulesDueToRun,
  updateSchedule,
} from '../services/repositories/schedules.js';
import { createTestRun } from '../services/repositories/test-runs.js';
import type { TestRun, BrowserType as TestRunBrowserType } from '../routes/test-runs/execution.js';
import { createLogger } from '../services/logger.js';
import { getNextRunTime } from '../utils/cron-parser.js';

const log = createLogger('suite-schedule-executor');

// Configuration
const POLL_INTERVAL_MS = parseInt(process.env.SUITE_SCHEDULER_INTERVAL || '60000', 10); // 60 seconds default
const MAX_CONCURRENT_RUNS = parseInt(process.env.SUITE_SCHEDULER_MAX_CONCURRENT || '3', 10);

// State
let pollInterval: NodeJS.Timeout | null = null;
let isProcessing = false;
const schedulerStats = {
  status: 'idle' as 'idle' | 'running' | 'stopped',
  lastPoll: null as Date | null,
  lastRunTriggered: null as Date | null,
  runsTriggered: 0,
  errors: 0,
};

/**
 * Initialize the suite schedule executor.
 * Starts polling for due test suite schedules.
 */
export function initializeSuiteScheduleExecutor(): void {
  log.info({ pollIntervalMs: POLL_INTERVAL_MS, maxConcurrent: MAX_CONCURRENT_RUNS }, 'Initializing Suite Schedule executor');

  schedulerStats.status = 'running';

  // Start polling
  pollInterval = setInterval(() => {
    processSchedules().catch(err => {
      log.error({ error: err }, 'Suite Schedule executor error');
      schedulerStats.errors++;
    });
  }, POLL_INTERVAL_MS);

  // Run initial poll after a short delay to let the server start up
  setTimeout(() => {
    processSchedules().catch(err => {
      log.error({ error: err }, 'Suite Schedule executor initial poll error');
      schedulerStats.errors++;
    });
  }, 8000); // Slightly later than quick-test-scheduler (5s) to stagger startup
}

/**
 * Stop the suite schedule executor
 */
export function stopSuiteScheduleExecutor(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    schedulerStats.status = 'stopped';
    log.info('Suite Schedule executor stopped');
  }
}

/**
 * Get current executor statistics
 */
export function getSuiteScheduleExecutorStats(): typeof schedulerStats {
  return { ...schedulerStats };
}

/**
 * Process due schedules.
 * Called every POLL_INTERVAL_MS.
 */
async function processSchedules(): Promise<void> {
  // Prevent concurrent processing
  if (isProcessing) {
    log.debug('Executor already processing, skipping poll');
    return;
  }

  // Check if database is connected
  if (!isDatabaseConnected()) {
    log.debug('Database not connected, skipping executor poll');
    return;
  }

  isProcessing = true;
  schedulerStats.lastPoll = new Date();

  try {
    // Get all due schedules from the schedules table
    const dueSchedules = await getSchedulesDueToRun();

    if (dueSchedules.length === 0) {
      log.debug('No due suite schedules found');
      return;
    }

    log.info({ count: dueSchedules.length }, 'Found due suite schedules to process');

    // Process schedules with concurrency limit
    const batches: Schedule[][] = [];
    for (let i = 0; i < dueSchedules.length; i += MAX_CONCURRENT_RUNS) {
      batches.push(dueSchedules.slice(i, i + MAX_CONCURRENT_RUNS));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(schedule => runScheduledSuite(schedule)));
    }

  } catch (error) {
    log.error({ error }, 'Failed to process due suite schedules');
    schedulerStats.errors++;
  } finally {
    isProcessing = false;
  }
}

/**
 * Run a scheduled test suite
 */
async function runScheduledSuite(schedule: Schedule): Promise<void> {
  const runId = crypto.randomUUID();

  log.info({
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    suiteId: schedule.suite_id,
    runId,
  }, 'Running scheduled test suite');

  try {
    // Create a test run linked to the schedule
    const run: TestRun = {
      id: runId,
      suite_id: schedule.suite_id,
      organization_id: schedule.organization_id,
      browser: (schedule.browsers[0] || 'chromium') as TestRunBrowserType,
      branch: 'main',
      status: 'pending',
      created_at: new Date(),
      schedule_id: schedule.id,
      triggered_by: 'schedule',
    };

    await createTestRun(run);

    // Enqueue or execute the test run (fire-and-forget)
    const { enqueueOrExecute } = await import('../services/execution-queue.js');
    enqueueOrExecute(runId, 'e2e', { triggeredBy: 'schedule' }).catch(err => {
      log.error({
        error: err,
        scheduleId: schedule.id,
        runId,
      }, 'Failed to enqueue scheduled suite run');
    });

    // Calculate next run time for recurring schedules
    let nextRunAt: Date | undefined;
    if (schedule.cron_expression) {
      const next = getNextRunTime(schedule.cron_expression);
      if (next) {
        nextRunAt = next;
      }
    }

    // Update the schedule with new run info and next run time
    await updateSchedule(schedule.id, {
      last_run_id: runId,
      run_count: (schedule.run_count || 0) + 1,
      ...(nextRunAt ? { next_run_at: nextRunAt } : {}),
      // For one-time schedules (run_at), disable after execution
      ...(!schedule.cron_expression && schedule.run_at ? { enabled: false } : {}),
    });

    schedulerStats.runsTriggered++;
    schedulerStats.lastRunTriggered = new Date();

    log.info({
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      suiteId: schedule.suite_id,
      runId,
      nextRunAt: nextRunAt?.toISOString(),
      totalRunsTriggered: schedulerStats.runsTriggered,
    }, 'Scheduled suite run triggered successfully');

  } catch (error) {
    log.error({
      error,
      scheduleId: schedule.id,
      suiteId: schedule.suite_id,
    }, 'Failed to run scheduled suite');
    schedulerStats.errors++;
  }
}

// Export for testing
export { processSchedules };
