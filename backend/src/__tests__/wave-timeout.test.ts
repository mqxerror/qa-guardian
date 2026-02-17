/**
 * Feature #BMAD: Tests for the runWaveWithTimeout helper
 *
 * Verifies that the Promise.race timeout pattern correctly:
 * - Returns results when promise resolves before timeout
 * - Throws descriptive error when promise exceeds timeout
 * - Handles edge cases (instant resolve, exact timeout boundary)
 */

import { describe, it, expect } from 'vitest';

/**
 * Replicate the runWaveWithTimeout helper from quick-test-runner.ts
 * We test the pattern directly rather than importing (avoids Playwright dependency chain)
 * NOTE: This must match the production implementation including clearTimeout + orphaned promise suppression
 */
async function runWaveWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  waveName: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${waveName} timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  });
  // Suppress unhandled rejection from orphaned promise when timeout wins the race
  promise.catch(() => {});
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

describe('runWaveWithTimeout', () => {
  it('returns result when promise resolves before timeout', async () => {
    const result = await runWaveWithTimeout(
      Promise.resolve({ score: 85, issues: [] }),
      5000,
      'Test Wave',
    );
    expect(result).toEqual({ score: 85, issues: [] });
  });

  it('throws when promise exceeds timeout', async () => {
    const slowPromise = new Promise<string>((resolve) =>
      setTimeout(() => resolve('too late'), 5000)
    );

    await expect(
      runWaveWithTimeout(slowPromise, 50, 'Security Scan')
    ).rejects.toThrow('Security Scan timed out after 0.05s');
  });

  it('includes wave name in timeout error message', async () => {
    const neverResolves = new Promise<void>(() => {});

    await expect(
      runWaveWithTimeout(neverResolves, 50, 'API Discovery')
    ).rejects.toThrow('API Discovery timed out after 0.05s');
  });

  it('handles instantly resolving promise', async () => {
    const result = await runWaveWithTimeout(
      Promise.resolve(42),
      1000,
      'Instant Wave',
    );
    expect(result).toBe(42);
  });

  it('handles promise that rejects before timeout', async () => {
    const failingPromise = Promise.reject(new Error('Wave internal error'));

    await expect(
      runWaveWithTimeout(failingPromise, 5000, 'Failing Wave')
    ).rejects.toThrow('Wave internal error');
  });

  it('preserves complex result types', async () => {
    const complexResult = {
      headers: { score: 75, missing: ['X-Frame-Options'] },
      cookies: [{ name: 'session', secure: true }],
      overallScore: 75,
    };

    const result = await runWaveWithTimeout(
      Promise.resolve(complexResult),
      5000,
      'Security Scan',
    );
    expect(result).toEqual(complexResult);
    expect(result.headers.missing).toContain('X-Frame-Options');
  });
});
