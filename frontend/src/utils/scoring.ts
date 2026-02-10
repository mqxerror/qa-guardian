/**
 * Shared Health Score Utilities
 * Feature #577: Extracted from suite-detail/utils.ts to shared location
 *
 * Used by both suite-level and test-level pages.
 *
 * BMAD R24.1 Recommended Weights:
 * - Pass Rate: 50% (primary reliability signal)
 * - Flakiness: 20% (consistency matters)
 * - Recency: 20% (stale tests lose confidence)
 * - Duration Stability: 10% (less critical, informational)
 *
 * Recency: 14-day exponential decay (gentler on weekly suites)
 */

// =============================================================================
// Types
// =============================================================================

export interface HealthBreakdown {
 /** Overall weighted health score (0-100) */
 overall: number;
 /** Pass rate score (0-100) - weight: 50% */
 passRate: number;
 /** Duration stability score (0-100) - weight: 10% */
 durationStability: number;
 /** Flakiness inverse score (0-100) - weight: 20% */
 flakiness: number;
 /** Recency score (0-100) - weight: 20% */
 recency: number;
}

/** Backwards-compatible alias */
export type SuiteHealthBreakdown = HealthBreakdown;

// =============================================================================
// Constants
// =============================================================================

const WEIGHTS = {
 PASS_RATE: 0.50,
 FLAKINESS: 0.20,
 RECENCY: 0.20,
 DURATION_STABILITY: 0.10,
} as const;

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Exponential recency decay over 14 days.
 * Returns 100 at age=0, ~37 at 14 days, ~14 at 28 days.
 */
function computeRecencyScore(ageMs: number): number {
 // Exponential decay: score = 100 * e^(-age / halfLife)
 // halfLife chosen so score ≈ 37 at 14 days (natural decay constant)
 const score = 100 * Math.exp(-ageMs / FOURTEEN_DAYS_MS);
 return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Compute duration stability from coefficient of variation.
 * CV of 0 = perfect (100), CV of 1+ = unstable (0).
 */
function computeDurationStability(durationsMs: number[]): number {
 if (durationsMs.length < 2) return 100;
 const mean = durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length;
 if (mean <= 0) return 100;
 const variance = durationsMs.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durationsMs.length;
 const stdDev = Math.sqrt(variance);
 const cv = stdDev / mean;
 return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
}

// =============================================================================
// Suite Health Score
// =============================================================================

/**
 * Test type expected by suite health score — minimal subset of suite-detail TestType
 */
export interface SuiteTestInput {
 last_result?: string | null;
 avg_duration_ms?: number | null;
 run_count?: number | null;
 last_run_at?: string | null;
}

/**
 * Compute a weighted Suite Health Score (0-100) from test data.
 *
 * BMAD R24.1 Weights: Pass Rate 50%, Flakiness 20%, Recency 20%, Duration Stability 10%
 * Recency: 14-day exponential decay (less harsh on weekly suites)
 */
export function computeSuiteHealthScore(tests: SuiteTestInput[]): HealthBreakdown {
 if (tests.length === 0) {
  return { overall: 0, passRate: 0, durationStability: 0, flakiness: 0, recency: 0 };
 }

 // 1. Pass Rate (50%)
 const testsWithResults = tests.filter(t => t.last_result);
 const passedTests = tests.filter(t => t.last_result === 'passed').length;
 const passRate = testsWithResults.length > 0
  ? Math.round((passedTests / testsWithResults.length) * 100)
  : 0;

 // 2. Duration Stability (10%)
 const durationsMs = tests
  .map(t => t.avg_duration_ms)
  .filter((d): d is number => d != null && d > 0);
 const durationStability = computeDurationStability(durationsMs);

 // 3. Flakiness Inverse (20%)
 const testsWithRuns = tests.filter(t => (t.run_count || 0) > 1);
 let flakinessPercent = 0;
 if (testsWithRuns.length > 0) {
  const potentiallyFlaky = testsWithRuns.filter(
   t => t.last_result === 'failed' || t.last_result === 'error'
  ).length;
  flakinessPercent = Math.round((potentiallyFlaky / testsWithRuns.length) * 100);
 }
 const flakiness = 100 - flakinessPercent;

 // 4. Recency (20%): 14-day exponential decay
 const now = Date.now();
 const lastRunTimes = tests
  .map(t => t.last_run_at ? new Date(t.last_run_at).getTime() : 0)
  .filter(t => t > 0);

 let recency = 0;
 if (lastRunTimes.length > 0) {
  const mostRecentRun = Math.max(...lastRunTimes);
  recency = computeRecencyScore(now - mostRecentRun);
 }

 const overall = Math.round(
  passRate * WEIGHTS.PASS_RATE +
  durationStability * WEIGHTS.DURATION_STABILITY +
  flakiness * WEIGHTS.FLAKINESS +
  recency * WEIGHTS.RECENCY
 );

 return { overall, passRate, durationStability, flakiness, recency };
}

// =============================================================================
// Test Health Score
// =============================================================================

/**
 * Test run input for health score calculation
 */
export interface TestRunInput {
 status: 'passed' | 'failed' | 'running' | 'pending' | 'skipped' | string;
 duration_ms?: number | null;
 completed_at?: string | null;
 created_at?: string;
}

/**
 * Compute a weighted Test Health Score (0-100) from run history.
 *
 * BMAD R24.1 Weights: Pass Rate 50%, Flakiness 20%, Recency 20%, Duration Stability 10%
 * Recency: 14-day exponential decay (less harsh on weekly suites)
 */
export function computeTestHealthScore(runs: TestRunInput[]): HealthBreakdown {
 if (runs.length === 0) {
  return { overall: 0, passRate: 0, durationStability: 0, flakiness: 0, recency: 0 };
 }

 // 1. Pass Rate (50%)
 const completedRuns = runs.filter(r => r.status !== 'running' && r.status !== 'pending');
 const passedRuns = completedRuns.filter(r => r.status === 'passed').length;
 const passRate = completedRuns.length > 0
  ? Math.round((passedRuns / completedRuns.length) * 100)
  : 0;

 // 2. Duration Stability (10%)
 const durationsMs = runs
  .map(r => r.duration_ms)
  .filter((d): d is number => d != null && d > 0);
 const durationStability = computeDurationStability(durationsMs);

 // 3. Flakiness Inverse (20%): detect alternating pass/fail patterns
 let flakinessPercent = 0;
 if (completedRuns.length >= 2) {
  const sortedRuns = [...completedRuns].sort((a, b) => {
   const dateA = a.completed_at || a.created_at || '';
   const dateB = b.completed_at || b.created_at || '';
   return dateB.localeCompare(dateA);
  });

  let alternations = 0;
  for (let i = 1; i < sortedRuns.length; i++) {
   if (sortedRuns[i].status !== sortedRuns[i - 1].status) {
    alternations++;
   }
  }

  const maxAlternations = sortedRuns.length - 1;
  flakinessPercent = Math.round((alternations / maxAlternations) * 100);
 }
 const flakiness = 100 - flakinessPercent;

 // 4. Recency (20%): 14-day exponential decay
 const now = Date.now();
 const runTimes = runs
  .map(r => r.completed_at || r.created_at)
  .filter((t): t is string => !!t)
  .map(t => new Date(t).getTime());

 let recency = 0;
 if (runTimes.length > 0) {
  const mostRecentRun = Math.max(...runTimes);
  recency = computeRecencyScore(now - mostRecentRun);
 }

 const overall = Math.round(
  passRate * WEIGHTS.PASS_RATE +
  durationStability * WEIGHTS.DURATION_STABILITY +
  flakiness * WEIGHTS.FLAKINESS +
  recency * WEIGHTS.RECENCY
 );

 return { overall, passRate, durationStability, flakiness, recency };
}
