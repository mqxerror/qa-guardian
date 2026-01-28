// Store Sync Bridge - Feature #2101
// Populates empty in-memory Maps from PostgreSQL on startup and refreshes every 30 seconds.
// This is a TEMPORARY bridge that makes the app work immediately while route files
// are migrated to async DB calls.
//
// Maps populated:
//   - projects (from projects/maps.ts)
//   - testSuites, tests (from test-suites/maps.ts)
//   - testRuns (from test-runs/execution.ts) - careful: preserve running state
//
// NOT populated (no DB map functions available yet):
//   - projectMembers, projectEnvVars, projectVisualSettings, projectHealingSettings

import { projects } from './routes/projects/maps';
import { testSuites, tests } from './routes/test-suites/maps';
import { testRuns } from './routes/test-runs/execution';
import { getProjectsMap } from './services/repositories/projects';
import { getTestSuitesMap, getTestsMap } from './services/repositories/test-suites';
import { isDatabaseConnected } from './services/database';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

const SYNC_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Sync a source Map into a target Map.
 * For testRuns, preserves entries with status 'running' or 'paused' (in-flight state).
 */
function syncMap<K, V>(target: Map<K, V>, source: Map<K, V>, preserveRunning = false): void {
  if (preserveRunning) {
    // Preserve in-flight test run state
    const preservedEntries = new Map<K, V>();
    for (const [key, value] of target.entries()) {
      const run = value as any;
      if (run && (run.status === 'running' || run.status === 'paused')) {
        preservedEntries.set(key, value);
      }
    }
    target.clear();
    // Restore DB data
    for (const [key, value] of source.entries()) {
      target.set(key, value);
    }
    // Overlay preserved running/paused entries
    for (const [key, value] of preservedEntries.entries()) {
      target.set(key, value);
    }
  } else {
    target.clear();
    for (const [key, value] of source.entries()) {
      target.set(key, value);
    }
  }
}

/**
 * Perform a single sync cycle: load all data from PostgreSQL into Maps.
 */
async function doSync(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    if (!isDatabaseConnected()) {
      return; // No DB, nothing to sync
    }

    // Sync projects
    const projectsData = await getProjectsMap();
    syncMap(projects, projectsData);

    // Sync test suites
    const suitesData = await getTestSuitesMap();
    syncMap(testSuites, suitesData);

    // Sync tests
    const testsData = await getTestsMap();
    syncMap(tests, testsData);

    // Note: testRuns has no DB map function yet, so we skip it for now.
    // When getTestRunsMap() is available, uncomment:
    // const runsData = await getTestRunsMap();
    // syncMap(testRuns, runsData, true); // preserve running state

    console.log(`[StoreSync] Synced: ${projects.size} projects, ${testSuites.size} suites, ${tests.size} tests`);
  } catch (err) {
    console.error('[StoreSync] Error during sync:', err);
  } finally {
    isSyncing = false;
  }
}

/**
 * Initialize store sync: perform initial load and set up periodic refresh.
 * Call this after database connection is established.
 */
export async function initializeStoreSync(): Promise<void> {
  console.log('[StoreSync] Initializing store sync bridge...');

  // Initial sync
  await doSync();

  // Set up periodic refresh
  syncInterval = setInterval(() => {
    doSync().catch(err => {
      console.error('[StoreSync] Periodic sync error:', err);
    });
  }, SYNC_INTERVAL_MS);

  console.log(`[StoreSync] Store sync initialized (refresh every ${SYNC_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the periodic sync. Call this during server shutdown.
 */
export function stopStoreSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[StoreSync] Store sync stopped');
  }
}
