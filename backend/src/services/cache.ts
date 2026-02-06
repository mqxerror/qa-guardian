/**
 * Redis Cache Service
 * Feature #60: Redis cache service for backend
 *
 * Provides centralized caching functionality using Redis (ioredis).
 * Falls back to in-memory caching if Redis is not available.
 */

import { Redis } from 'ioredis';
import { CacheTTL } from './cache-keys.js';

// Cache service singleton
let cacheInstance: CacheService | null = null;

export interface CacheConfig {
  redisUrl?: string;
  defaultTTL?: number;
  keyPrefix?: string;
  enableFallback?: boolean;
}

export class CacheService {
  private redis: Redis | null = null;
  private memoryCache: Map<string, { value: string; expiresAt: number }> = new Map();
  private defaultTTL: number;
  private keyPrefix: string;
  private connected: boolean = false;
  private enableFallback: boolean;

  constructor(config: CacheConfig = {}) {
    this.defaultTTL = config.defaultTTL || CacheTTL.STANDARD;
    this.keyPrefix = config.keyPrefix || 'qa-guardian:';
    this.enableFallback = config.enableFallback !== false; // Default to true

    const redisUrl = config.redisUrl || process.env.REDIS_URL;

    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              console.warn('[CacheService] Redis connection failed after 3 retries, using memory fallback');
              return null; // Stop retrying
            }
            return Math.min(times * 100, 2000); // Exponential backoff
          },
          lazyConnect: true, // Don't connect immediately
        });

        this.redis.on('connect', () => {
          this.connected = true;
          console.log('[CacheService] Connected to Redis');
        });

        this.redis.on('error', (err) => {
          console.warn('[CacheService] Redis error:', err.message);
          this.connected = false;
        });

        this.redis.on('close', () => {
          this.connected = false;
          console.log('[CacheService] Redis connection closed');
        });
      } catch (err) {
        console.warn('[CacheService] Failed to initialize Redis:', err);
        this.redis = null;
      }
    } else {
      console.log('[CacheService] No REDIS_URL configured, using in-memory cache');
    }

    // Cleanup expired memory cache entries periodically
    setInterval(() => this.cleanupMemoryCache(), 60 * 1000);
  }

  /**
   * Connect to Redis (if configured)
   */
  async connect(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      await this.redis.connect();
      return true;
    } catch (err) {
      console.warn('[CacheService] Failed to connect to Redis:', err);
      return false;
    }
  }

  /**
   * Check if cache service is available
   */
  isAvailable(): boolean {
    return this.connected || this.enableFallback;
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.connected;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.keyPrefix + key;

    // Try Redis first
    if (this.redis && this.connected) {
      try {
        const value = await this.redis.get(fullKey);
        if (value) {
          return JSON.parse(value) as T;
        }
      } catch (err) {
        console.warn(`[CacheService] Redis get error for key ${key}:`, err);
      }
    }

    // Fall back to memory cache
    if (this.enableFallback) {
      const entry = this.memoryCache.get(fullKey);
      if (entry && entry.expiresAt > Date.now()) {
        return JSON.parse(entry.value) as T;
      }
      // Remove expired entry
      if (entry) {
        this.memoryCache.delete(fullKey);
      }
    }

    return null;
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    const fullKey = this.keyPrefix + key;
    const ttlSeconds = ttl || this.defaultTTL;
    const serialized = JSON.stringify(value);

    // Try Redis first
    if (this.redis && this.connected) {
      try {
        await this.redis.setex(fullKey, ttlSeconds, serialized);
        return true;
      } catch (err) {
        console.warn(`[CacheService] Redis set error for key ${key}:`, err);
      }
    }

    // Fall back to memory cache
    if (this.enableFallback) {
      this.memoryCache.set(fullKey, {
        value: serialized,
        expiresAt: Date.now() + (ttlSeconds * 1000),
      });
      return true;
    }

    return false;
  }

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.keyPrefix + key;

    let deleted = false;

    // Delete from Redis
    if (this.redis && this.connected) {
      try {
        const result = await this.redis.del(fullKey);
        deleted = result > 0;
      } catch (err) {
        console.warn(`[CacheService] Redis delete error for key ${key}:`, err);
      }
    }

    // Delete from memory cache
    if (this.enableFallback) {
      deleted = this.memoryCache.delete(fullKey) || deleted;
    }

    return deleted;
  }

  /**
   * Invalidate all keys matching a pattern
   * Pattern uses Redis SCAN with MATCH for efficiency
   */
  async invalidate(pattern: string): Promise<number> {
    const fullPattern = this.keyPrefix + pattern;
    let count = 0;

    // Invalidate from Redis using SCAN (non-blocking)
    if (this.redis && this.connected) {
      try {
        let cursor = '0';
        do {
          const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
          cursor = newCursor;

          if (keys.length > 0) {
            const deleted = await this.redis.del(...keys);
            count += deleted;
          }
        } while (cursor !== '0');
      } catch (err) {
        console.warn(`[CacheService] Redis invalidate error for pattern ${pattern}:`, err);
      }
    }

    // Invalidate from memory cache
    if (this.enableFallback) {
      const regex = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.keyPrefix + key;

    // Check Redis first
    if (this.redis && this.connected) {
      try {
        const result = await this.redis.exists(fullKey);
        if (result > 0) return true;
      } catch (err) {
        console.warn(`[CacheService] Redis exists error for key ${key}:`, err);
      }
    }

    // Check memory cache
    if (this.enableFallback) {
      const entry = this.memoryCache.get(fullKey);
      return entry !== undefined && entry.expiresAt > Date.now();
    }

    return false;
  }

  /**
   * Get or set a value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const value = await fetchFn();

    // Store in cache
    await this.set(key, value, ttl);

    return value;
  }

  /**
   * Clear all cache (use with caution)
   */
  async clear(): Promise<void> {
    // Clear Redis keys with our prefix
    if (this.redis && this.connected) {
      try {
        let cursor = '0';
        do {
          const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', this.keyPrefix + '*', 'COUNT', 100);
          cursor = newCursor;

          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } while (cursor !== '0');
      } catch (err) {
        console.warn('[CacheService] Redis clear error:', err);
      }
    }

    // Clear memory cache
    this.memoryCache.clear();
  }

  /**
   * Feature #158: Enhanced cache statistics with memory usage
   */
  async stats(): Promise<{
    redisConnected: boolean;
    memoryCacheSize: number;
    redisKeyCount?: number;
    // Feature #158: Redis memory stats
    redisMemory?: {
      usedBytes: number;
      usedHuman: string;
      peakBytes: number;
      peakHuman: string;
      maxBytes: number | null;
      maxHuman: string | null;
      usedPercent: number | null;
    };
  }> {
    const stats: {
      redisConnected: boolean;
      memoryCacheSize: number;
      redisKeyCount?: number;
      redisMemory?: {
        usedBytes: number;
        usedHuman: string;
        peakBytes: number;
        peakHuman: string;
        maxBytes: number | null;
        maxHuman: string | null;
        usedPercent: number | null;
      };
    } = {
      redisConnected: this.connected,
      memoryCacheSize: this.memoryCache.size,
      redisKeyCount: undefined,
      redisMemory: undefined,
    };

    if (this.redis && this.connected) {
      try {
        // Get key count
        let count = 0;
        let cursor = '0';
        do {
          const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', this.keyPrefix + '*', 'COUNT', 1000);
          cursor = newCursor;
          count += keys.length;
        } while (cursor !== '0');
        stats.redisKeyCount = count;

        // Feature #158: Get memory stats from Redis INFO
        const info = await this.redis.info('memory');
        const usedMatch = info.match(/used_memory:(\d+)/);
        const peakMatch = info.match(/used_memory_peak:(\d+)/);
        const usedHumanMatch = info.match(/used_memory_human:([^\r\n]+)/);
        const peakHumanMatch = info.match(/used_memory_peak_human:([^\r\n]+)/);
        const maxMatch = info.match(/maxmemory:(\d+)/);
        const maxHumanMatch = info.match(/maxmemory_human:([^\r\n]+)/);

        if (usedMatch && peakMatch) {
          const usedBytes = parseInt(usedMatch[1], 10);
          const peakBytes = parseInt(peakMatch[1], 10);
          const maxBytes = maxMatch ? parseInt(maxMatch[1], 10) : null;

          stats.redisMemory = {
            usedBytes,
            usedHuman: usedHumanMatch?.[1]?.trim() || `${Math.round(usedBytes / 1024 / 1024)}MB`,
            peakBytes,
            peakHuman: peakHumanMatch?.[1]?.trim() || `${Math.round(peakBytes / 1024 / 1024)}MB`,
            maxBytes: maxBytes && maxBytes > 0 ? maxBytes : null,
            maxHuman: maxHumanMatch?.[1]?.trim() || null,
            usedPercent: maxBytes && maxBytes > 0 ? Math.round((usedBytes / maxBytes) * 100) : null,
          };
        }
      } catch (err) {
        console.warn('[CacheService] Redis stats error:', err);
      }
    }

    return stats;
  }

  /**
   * Feature #214: Increment a counter (for rate limiting)
   * Uses Redis INCR + EXPIRE for distributed rate limiting
   * Falls back to in-memory counter if Redis is unavailable
   * @returns The new count after incrementing
   */
  async incr(key: string, ttlSeconds: number): Promise<number> {
    const fullKey = this.keyPrefix + key;

    // Try Redis first
    if (this.redis && this.connected) {
      try {
        // Use MULTI/EXEC for atomic INCR + EXPIRE
        const result = await this.redis.multi()
          .incr(fullKey)
          .expire(fullKey, ttlSeconds)
          .exec();

        if (result && result[0] && result[0][1] !== null) {
          return result[0][1] as number;
        }
      } catch (err) {
        console.warn(`[CacheService] Redis incr error for key ${key}:`, err);
      }
    }

    // Fall back to memory counter
    if (this.enableFallback) {
      const entry = this.memoryCache.get(fullKey);
      const now = Date.now();

      if (entry && entry.expiresAt > now) {
        // Increment existing counter
        const currentValue = parseInt(entry.value, 10) || 0;
        const newValue = currentValue + 1;
        entry.value = String(newValue);
        return newValue;
      } else {
        // Start new counter
        this.memoryCache.set(fullKey, {
          value: '1',
          expiresAt: now + (ttlSeconds * 1000),
        });
        return 1;
      }
    }

    return 0;
  }

  /**
   * Feature #214: Get a counter value without incrementing
   * @returns The current count, or 0 if not found
   */
  async getCount(key: string): Promise<number> {
    const fullKey = this.keyPrefix + key;

    // Try Redis first
    if (this.redis && this.connected) {
      try {
        const value = await this.redis.get(fullKey);
        if (value) {
          return parseInt(value, 10) || 0;
        }
      } catch (err) {
        console.warn(`[CacheService] Redis getCount error for key ${key}:`, err);
      }
    }

    // Fall back to memory counter
    if (this.enableFallback) {
      const entry = this.memoryCache.get(fullKey);
      if (entry && entry.expiresAt > Date.now()) {
        return parseInt(entry.value, 10) || 0;
      }
    }

    return 0;
  }

  /**
   * Close the cache service connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.connected = false;
    }
    this.memoryCache.clear();
  }

  /**
   * Clean up expired memory cache entries
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt < now) {
        this.memoryCache.delete(key);
      }
    }
  }
}

/**
 * Get the singleton cache service instance
 */
export function getCache(): CacheService {
  if (!cacheInstance) {
    cacheInstance = new CacheService();
  }
  return cacheInstance;
}

/**
 * Initialize the cache service (call on startup)
 */
export async function initializeCache(config?: CacheConfig): Promise<CacheService> {
  if (cacheInstance) {
    await cacheInstance.close();
  }
  cacheInstance = new CacheService(config);
  await cacheInstance.connect();
  return cacheInstance;
}

/**
 * Close the cache service (call on shutdown)
 */
export async function closeCache(): Promise<void> {
  if (cacheInstance) {
    await cacheInstance.close();
    cacheInstance = null;
  }
}

// Export the CacheTTL and CacheKeys for convenience
export { CacheTTL, CacheKeys } from './cache-keys.js';
