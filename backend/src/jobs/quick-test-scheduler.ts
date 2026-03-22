/**
 * Feature #684: Quick Test Cron Scheduler Worker
 *
 * Polls quick_test_schedules table every 60s for enabled schedules
 * where next_run_at <= NOW(). Triggers runQuickTest() for each due schedule
 * and updates last_run_at/next_run_at/run_count.
 */

import { v4 as uuidv4 } from 'uuid';
import { isDatabaseConnected } from '../services/database.js';
import {
  getDueQuickTestSchedules,
  markScheduleRun,
  createQuickTestResult,
  type QuickTestSchedule,
} from '../services/repositories/quick-test.js';
import { queueQuickTest } from '../services/execution-queue.js';
import { validateWebhookURLWithDNS } from '../utils/index.js';
import { createLogger } from '../services/logger.js';

const log = createLogger('quick-test-scheduler');

// Configuration
const POLL_INTERVAL_MS = parseInt(process.env.QUICK_TEST_SCHEDULER_INTERVAL || '60000', 10); // 60 seconds default
const MAX_CONCURRENT_RUNS = parseInt(process.env.QUICK_TEST_SCHEDULER_MAX_CONCURRENT || '3', 10);

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
 * Initialize the quick test scheduler
 * Starts polling for due schedules
 */
export function initializeQuickTestScheduler(): void {
  log.info({ pollIntervalMs: POLL_INTERVAL_MS, maxConcurrent: MAX_CONCURRENT_RUNS }, 'Initializing Quick Test scheduler');

  schedulerStats.status = 'running';

  // Start polling
  pollInterval = setInterval(() => {
    processSchedules().catch(err => {
      log.error({ error: err }, 'Quick Test scheduler error');
      schedulerStats.errors++;
    });
  }, POLL_INTERVAL_MS);

  // Run initial poll after a short delay to let the server start up
  setTimeout(() => {
    processSchedules().catch(err => {
      log.error({ error: err }, 'Quick Test scheduler initial poll error');
      schedulerStats.errors++;
    });
  }, 5000);
}

/**
 * Stop the quick test scheduler
 */
export function stopQuickTestScheduler(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    schedulerStats.status = 'stopped';
    log.info('Quick Test scheduler stopped');
  }
}

/**
 * Get current scheduler statistics
 */
export function getQuickTestSchedulerStats(): typeof schedulerStats {
  return { ...schedulerStats };
}

/**
 * Process due schedules
 * Called every POLL_INTERVAL_MS
 */
async function processSchedules(): Promise<void> {
  // Prevent concurrent processing
  if (isProcessing) {
    log.debug('Scheduler already processing, skipping poll');
    return;
  }

  // Check if database is connected
  if (!isDatabaseConnected()) {
    log.debug('Database not connected, skipping scheduler poll');
    return;
  }

  isProcessing = true;
  schedulerStats.lastPoll = new Date();

  try {
    // Get all due schedules
    const dueSchedules = await getDueQuickTestSchedules();

    if (dueSchedules.length === 0) {
      log.debug('No due schedules found');
      return;
    }

    log.info({ count: dueSchedules.length }, 'Found due schedules to process');

    // Process schedules with concurrency limit
    const batches: QuickTestSchedule[][] = [];
    for (let i = 0; i < dueSchedules.length; i += MAX_CONCURRENT_RUNS) {
      batches.push(dueSchedules.slice(i, i + MAX_CONCURRENT_RUNS));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(schedule => runScheduledTest(schedule)));
    }

  } catch (error) {
    log.error({ error }, 'Failed to process due schedules');
    schedulerStats.errors++;
  } finally {
    isProcessing = false;
  }
}

/**
 * Run a scheduled quick test
 */
async function runScheduledTest(schedule: QuickTestSchedule): Promise<void> {
  const runId = uuidv4();

  log.info({
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    url: schedule.url,
    runId,
  }, 'Running scheduled quick test');

  try {
    // Feature #BMAD: Re-validate URL at execution time to prevent DNS rebinding attacks.
    // The URL was validated at schedule creation, but DNS records can change between runs.
    const ssrfCheck = await validateWebhookURLWithDNS(schedule.url, { allowLocalhost: false });
    if (!ssrfCheck.safe) {
      log.warn({
        scheduleId: schedule.id,
        url: schedule.url,
        error: ssrfCheck.error,
      }, 'Scheduled quick test blocked by SSRF validation - URL may have changed DNS records');
      schedulerStats.errors++;
      return;
    }

    // Create the DB record before queuing so results are queryable immediately
    const initialWaves = [
      { wave: 1, name: 'Health Check', status: 'pending' as const },
      { wave: 2, name: 'Visual + Performance', status: 'pending' as const },
      { wave: 3, name: 'Security Scan', status: 'pending' as const },
      { wave: 4, name: 'AI Analysis', status: 'pending' as const },
      { wave: 5, name: 'Accessibility', status: 'pending' as const },
      { wave: 6, name: 'API Discovery', status: 'pending' as const },
      { wave: 7, name: 'SEO Analysis', status: 'pending' as const },
    ];
    await createQuickTestResult(runId, schedule.organizationId, schedule.userId, schedule.url, initialWaves);

    // Route through BullMQ worker instead of fire-and-forget
    const jobId = await queueQuickTest({
      runId,
      url: schedule.url,
      orgId: schedule.organizationId,
      userId: schedule.userId,
      browser: 'chromium', // Scheduled tests always use chromium
    });

    if (!jobId) {
      log.error({
        scheduleId: schedule.id,
        runId,
      }, 'Quick test queue unavailable - scheduled test cannot be processed');
      schedulerStats.errors++;
      return;
    }

    // Update the schedule with the new run info
    await markScheduleRun(schedule.id, runId, schedule.cronExpression);

    schedulerStats.runsTriggered++;
    schedulerStats.lastRunTriggered = new Date();

    log.info({
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      runId,
      totalRunsTriggered: schedulerStats.runsTriggered,
    }, 'Scheduled quick test triggered successfully');

  } catch (error) {
    log.error({
      error,
      scheduleId: schedule.id,
      url: schedule.url,
    }, 'Failed to run scheduled quick test');
    schedulerStats.errors++;
  }
}

// Export for testing
export { processSchedules };
