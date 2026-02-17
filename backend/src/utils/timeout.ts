/**
 * Feature #BMAD: Promise timeout utility for bounding async operations.
 *
 * Extracted from quick-test-runner.ts to enable direct testing without
 * pulling in Playwright dependency chains.
 */

/**
 * Wraps a promise in a timeout. If the promise doesn't resolve
 * within timeoutMs, throws an error instead of blocking indefinitely.
 *
 * Safety features:
 * - Clears timer on success to prevent event loop leak
 * - Suppresses unhandled rejection from the orphaned promise
 */
export async function runWaveWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  waveName: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${waveName} timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  });

  // Suppress unhandled rejection from the losing promise (whichever loses the race)
  promise.catch(() => {});

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}
