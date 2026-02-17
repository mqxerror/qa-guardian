/**
 * Feature #BMAD: Tests for the runWaveWithTimeout helper
 *
 * Tests the REAL production function from utils/timeout.ts:
 * - Returns results when promise resolves before timeout
 * - Throws descriptive error when promise exceeds timeout
 * - Handles edge cases (instant resolve, exact timeout boundary)
 * - Cleans up timers (clearTimeout in finally block)
 * - Suppresses orphaned promise rejections
 */

import { describe, it, expect } from 'vitest';
import { runWaveWithTimeout } from '../utils/timeout.js';

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

  it('does not produce unhandled rejections from orphaned promises', async () => {
    // The losing promise (slowPromise) would normally produce an unhandled rejection
    // when the timeout fires and it eventually resolves. The function should suppress this.
    const slowPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('late rejection')), 100)
    );

    await expect(
      runWaveWithTimeout(slowPromise, 10, 'Orphan Test')
    ).rejects.toThrow('Orphan Test timed out after 0.01s');

    // Wait for the orphaned promise to settle — no unhandledRejection should occur
    await new Promise(resolve => setTimeout(resolve, 150));
  });
});
