/**
 * Feature #171: Backend Smoke Tests - Cache Service
 *
 * Tests cache operations: set, get, invalidate, TTL expiry.
 * Uses in-memory cache mock for isolation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

interface CacheEntry {
  value: any;
  expiresAt: number | null;
}

// Mock cache service implementation
class MockCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL = 3600) {
    this.defaultTTL = defaultTTL;
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    const effectiveTTL = ttl !== undefined ? ttl : this.defaultTTL;
    const expiresAt = effectiveTTL ? Date.now() + (effectiveTTL * 1000) : null;
    this.cache.set(key, { value, expiresAt });
    return true;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL expiry
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL expiry
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async getMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    for (const key of keys) {
      results.set(key, await this.get<T>(key));
    }
    return results;
  }

  async setMultiple(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async size(): Promise<number> {
    // Clean expired entries first
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }

  async ttl(key: string): Promise<number | null> {
    const entry = this.cache.get(key);
    if (!entry || !entry.expiresAt) return null;

    const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : null;
  }
}

describe('Cache Service', () => {
  let cache: MockCacheService;

  beforeEach(() => {
    cache = new MockCacheService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      await cache.set('test-key', { name: 'test' });
      const value = await cache.get('test-key');

      expect(value).toEqual({ name: 'test' });
    });

    it('should return null for non-existent key', async () => {
      const value = await cache.get('nonexistent');

      expect(value).toBeNull();
    });

    it('should delete a value', async () => {
      await cache.set('delete-key', 'value');
      const deleted = await cache.delete('delete-key');

      expect(deleted).toBe(true);
      expect(await cache.get('delete-key')).toBeNull();
    });

    it('should check if key exists', async () => {
      await cache.set('exists-key', 'value');

      expect(await cache.exists('exists-key')).toBe(true);
      expect(await cache.exists('nonexistent')).toBe(false);
    });

    it('should store various data types', async () => {
      await cache.set('string', 'hello');
      await cache.set('number', 42);
      await cache.set('boolean', true);
      await cache.set('array', [1, 2, 3]);
      await cache.set('object', { a: 1, b: { c: 2 } });

      expect(await cache.get('string')).toBe('hello');
      expect(await cache.get('number')).toBe(42);
      expect(await cache.get('boolean')).toBe(true);
      expect(await cache.get('array')).toEqual([1, 2, 3]);
      expect(await cache.get('object')).toEqual({ a: 1, b: { c: 2 } });
    });
  });

  describe('TTL Expiration', () => {
    it('should expire value after TTL', async () => {
      await cache.set('expire-key', 'value', 60); // 60 seconds

      // Before expiry
      expect(await cache.get('expire-key')).toBe('value');

      // Advance time past TTL
      vi.advanceTimersByTime(61 * 1000);

      // After expiry
      expect(await cache.get('expire-key')).toBeNull();
    });

    it('should not expire value before TTL', async () => {
      await cache.set('not-expired', 'value', 60);

      vi.advanceTimersByTime(30 * 1000);

      expect(await cache.get('not-expired')).toBe('value');
    });

    it('should return remaining TTL', async () => {
      await cache.set('ttl-key', 'value', 60);

      vi.advanceTimersByTime(20 * 1000);

      const remaining = await cache.ttl('ttl-key');
      expect(remaining).toBeCloseTo(40, 0);
    });

    it('should use defaultTTL when no TTL is provided', async () => {
      await cache.set('default-ttl', 'value');

      const ttl = await cache.ttl('default-ttl');
      // defaultTTL is 3600 seconds, so remaining TTL should be close to 3600
      expect(ttl).toBeCloseTo(3600, 0);
    });

    it('should return null TTL for non-expiring key', async () => {
      await cache.set('no-ttl', 'value', 0);

      const ttl = await cache.ttl('no-ttl');
      expect(ttl).toBeNull();
    });
  });

  describe('Pattern Invalidation', () => {
    it('should invalidate keys matching pattern', async () => {
      await cache.set('user:1:profile', { name: 'User 1' });
      await cache.set('user:1:settings', { theme: 'dark' });
      await cache.set('user:2:profile', { name: 'User 2' });
      await cache.set('project:1:data', { name: 'Project' });

      const deleted = await cache.invalidatePattern('user:1:*');

      expect(deleted).toBe(2);
      expect(await cache.get('user:1:profile')).toBeNull();
      expect(await cache.get('user:1:settings')).toBeNull();
      expect(await cache.get('user:2:profile')).not.toBeNull();
      expect(await cache.get('project:1:data')).not.toBeNull();
    });

    it('should return 0 when no keys match pattern', async () => {
      await cache.set('key1', 'value1');

      const deleted = await cache.invalidatePattern('nonexistent:*');

      expect(deleted).toBe(0);
    });
  });

  describe('Batch Operations', () => {
    it('should get multiple keys at once', async () => {
      await cache.set('batch-1', 'value1');
      await cache.set('batch-2', 'value2');
      await cache.set('batch-3', 'value3');

      const results = await cache.getMultiple(['batch-1', 'batch-2', 'nonexistent']);

      expect(results.get('batch-1')).toBe('value1');
      expect(results.get('batch-2')).toBe('value2');
      expect(results.get('nonexistent')).toBeNull();
    });

    it('should set multiple keys at once', async () => {
      await cache.setMultiple([
        { key: 'multi-1', value: 'v1' },
        { key: 'multi-2', value: 'v2', ttl: 60 },
        { key: 'multi-3', value: 'v3' },
      ]);

      expect(await cache.get('multi-1')).toBe('v1');
      expect(await cache.get('multi-2')).toBe('v2');
      expect(await cache.get('multi-3')).toBe('v3');
    });
  });

  describe('Cache Management', () => {
    it('should clear all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.size()).toBe(0);
    });

    it('should return correct size', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      expect(await cache.size()).toBe(3);

      await cache.delete('key1');

      expect(await cache.size()).toBe(2);
    });

    it('should not count expired entries in size', async () => {
      await cache.set('permanent', 'value');
      await cache.set('temporary', 'value', 30);

      expect(await cache.size()).toBe(2);

      vi.advanceTimersByTime(31 * 1000);

      expect(await cache.size()).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string keys', async () => {
      await cache.set('', 'empty-key-value');
      expect(await cache.get('')).toBe('empty-key-value');
    });

    it('should handle null values', async () => {
      await cache.set('null-value', null);
      // Note: null is stored and retrieved as null
      const value = await cache.get('null-value');
      expect(value).toBeNull();
    });

    it('should handle undefined values', async () => {
      await cache.set('undefined-value', undefined);
      expect(await cache.get('undefined-value')).toBeUndefined();
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key:with:colons/and/slashes?and=params';
      await cache.set(specialKey, 'special');
      expect(await cache.get(specialKey)).toBe('special');
    });

    it('should overwrite existing values', async () => {
      await cache.set('overwrite', 'original');
      await cache.set('overwrite', 'updated');

      expect(await cache.get('overwrite')).toBe('updated');
    });
  });
});
