/**
 * Encryption Service
 * Feature #217: Encrypt sensitive data at rest in PostgreSQL
 * Feature #423: LRU cache for PBKDF2 derived keys with TTL
 *
 * Provides AES-256-GCM encryption for sensitive data fields.
 * Key is derived from ENCRYPTION_KEY env var using PBKDF2.
 *
 * Future Migration Note (bcrypt):
 * The current implementation uses PBKDF2 for key derivation. For password hashing
 * (auth), consider migrating to bcrypt which has better resistance to GPU attacks.
 * PBKDF2 remains appropriate for encryption key derivation.
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, createHash } from 'node:crypto';
// Feature #439: Use structured logger instead of console.*
import { logger } from './logger.js';

// ============================================================================
// Configuration
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits - recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000;

// Prefix for encrypted data to identify encrypted values
const ENCRYPTED_PREFIX = 'enc:v1:';
// Feature #229: New prefix for random salt encryption (more secure)
const ENCRYPTED_PREFIX_V2 = 'enc:v2:';

// Cache the derived key to avoid repeated PBKDF2 calls (v1 format - single key)
let cachedKey: Buffer | null = null;
let cachedSalt: string | null = null;

// ============================================================================
// Feature #423: LRU Cache for PBKDF2 Derived Keys
// ============================================================================

interface CacheEntry {
  key: Buffer;
  createdAt: number;
}

// LRU cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 100; // Max entries before eviction

// LRU cache for v2 encryption keys (keyed by hash of salt)
const keyCache = new Map<string, CacheEntry>();

// Cache metrics for monitoring
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Feature #423: Get a cache key from the salt
 * Uses SHA-256 to create a fixed-length key from the salt buffer
 */
function getCacheKey(salt: Buffer): string {
  return createHash('sha256').update(salt).digest('hex').slice(0, 32);
}

/**
 * Feature #423: Get a cached derived key or null if not found/expired
 */
function getCachedKey(salt: Buffer): Buffer | null {
  const cacheKey = getCacheKey(salt);
  const entry = keyCache.get(cacheKey);

  if (!entry) {
    cacheMisses++;
    return null;
  }

  // Check TTL
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    keyCache.delete(cacheKey);
    cacheMisses++;
    return null;
  }

  cacheHits++;

  // Move to end for LRU ordering (delete and re-add)
  keyCache.delete(cacheKey);
  keyCache.set(cacheKey, entry);

  return entry.key;
}

/**
 * Feature #423: Cache a derived key with TTL
 */
function setCachedKey(salt: Buffer, key: Buffer): void {
  const cacheKey = getCacheKey(salt);

  // Evict oldest entries if at capacity (LRU eviction)
  if (keyCache.size >= CACHE_MAX_SIZE) {
    // Delete the first (oldest) entry
    const firstKey = keyCache.keys().next().value;
    if (firstKey) {
      keyCache.delete(firstKey);
    }
  }

  keyCache.set(cacheKey, {
    key,
    createdAt: Date.now(),
  });
}

/**
 * Feature #423: Get cache statistics for monitoring
 */
export function getCacheStats(): { hits: number; misses: number; size: number; hitRate: string } {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? ((cacheHits / total) * 100).toFixed(1) + '%' : 'N/A';
  return {
    hits: cacheHits,
    misses: cacheMisses,
    size: keyCache.size,
    hitRate,
  };
}

/**
 * Feature #423: Reset cache statistics (for testing)
 */
export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Feature #423: Clear the key cache (for testing or key rotation)
 */
export function clearKeyCache(): void {
  keyCache.clear();
  cachedKey = null;
  cachedSalt = null;
}

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Get the encryption key from environment, with validation
 */
function getEncryptionKeyFromEnv(): string | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    logger.warn('[Encryption] ENCRYPTION_KEY not set - sensitive data will NOT be encrypted');
    return null;
  }
  if (key.length < 32) {
    logger.warn('[Encryption] ENCRYPTION_KEY should be at least 32 characters for security');
  }
  return key;
}

/**
 * Derive a 256-bit key from the master key using PBKDF2
 * Uses a fixed salt derived from the key itself for deterministic derivation
 */
function deriveKey(): Buffer | null {
  const masterKey = getEncryptionKeyFromEnv();
  if (!masterKey) {
    return null;
  }

  // Use a fixed salt based on the key (deterministic but unique per key)
  const saltSource = masterKey.slice(0, 16);
  const salt = saltSource.padEnd(SALT_LENGTH, '0');

  // Check cache
  if (cachedKey && cachedSalt === salt) {
    return cachedKey;
  }

  // Derive key using PBKDF2
  cachedKey = pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  cachedSalt = salt;

  return cachedKey;
}

/**
 * Feature #229: Derive key using a random salt (more secure than fixed salt)
 * Feature #423: Now uses LRU cache with 5-minute TTL
 * Used for v2 encryption where salt is stored with ciphertext
 */
function deriveKeyWithSalt(salt: Buffer): Buffer | null {
  const masterKey = getEncryptionKeyFromEnv();
  if (!masterKey) {
    return null;
  }

  // Feature #423: Check cache first
  const cached = getCachedKey(salt);
  if (cached) {
    return cached;
  }

  // Derive key using PBKDF2 with the provided random salt
  const derivedKey = pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');

  // Feature #423: Cache the derived key
  setCachedKey(salt, derivedKey);

  return derivedKey;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if encryption is available (ENCRYPTION_KEY is set)
 */
export function isEncryptionEnabled(): boolean {
  return !!getEncryptionKeyFromEnv();
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Feature #229: Now uses random salt stored with ciphertext (v2 format)
 *
 * @param plaintext - The data to encrypt
 * @returns Encrypted data as base64 string with prefix, or original if encryption disabled
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  // Feature #229: Generate random salt for each encryption (more secure)
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKeyWithSalt(salt);
  if (!key) {
    // Encryption not configured - return plaintext (with warning logged above)
    return plaintext;
  }

  // Generate random IV for each encryption
  const iv = randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Encrypt the data
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // Get the auth tag
  const authTag = cipher.getAuthTag();

  // Feature #229: Combine: Salt + IV + AuthTag + Encrypted data (v2 format)
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  // Return with v2 prefix for identification
  return ENCRYPTED_PREFIX_V2 + combined.toString('base64');
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 * Feature #229: Supports both v1 (fixed salt) and v2 (random salt) formats
 *
 * @param ciphertext - The encrypted data (with prefix)
 * @returns Decrypted plaintext, or original if not encrypted or decryption fails
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    return ciphertext;
  }

  // Feature #229: Check for v2 format first (random salt)
  if (ciphertext.startsWith(ENCRYPTED_PREFIX_V2)) {
    try {
      // Remove prefix and decode base64
      const combined = Buffer.from(ciphertext.slice(ENCRYPTED_PREFIX_V2.length), 'base64');

      // Extract components: Salt + IV + AuthTag + Encrypted data
      const salt = combined.subarray(0, SALT_LENGTH);
      const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

      // Derive key using the stored salt
      const key = deriveKeyWithSalt(salt);
      if (!key) {
        logger.error('[Encryption] Cannot decrypt v2 - ENCRYPTION_KEY not set');
        throw new Error('Encryption key not configured');
      }

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);

      // Decrypt the data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      logger.error({ error }, '[Encryption] v2 decryption failed');
      throw new Error('Failed to decrypt data - key may have changed');
    }
  }

  // v1 format (legacy - fixed salt derived from key)
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    // Not encrypted - return as-is (for backwards compatibility with existing data)
    return ciphertext;
  }

  const key = deriveKey();
  if (!key) {
    logger.error('[Encryption] Cannot decrypt v1 - ENCRYPTION_KEY not set');
    throw new Error('Encryption key not configured');
  }

  try {
    // Remove prefix and decode base64
    const combined = Buffer.from(ciphertext.slice(ENCRYPTED_PREFIX.length), 'base64');

    // Extract components: IV + AuthTag + Encrypted data (no salt in v1)
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    logger.error({ error }, '[Encryption] v1 decryption failed');
    throw new Error('Failed to decrypt data - key may have changed');
  }
}

/**
 * Check if a value appears to be encrypted
 * Feature #229: Checks both v1 and v2 prefixes
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  return value.startsWith(ENCRYPTED_PREFIX) || value.startsWith(ENCRYPTED_PREFIX_V2);
}

/**
 * Encrypt a value only if it's not already encrypted
 */
export function encryptIfNeeded(value: string): string {
  if (!value || isEncrypted(value)) {
    return value;
  }
  return encrypt(value);
}

/**
 * Generate a secure random key for ENCRYPTION_KEY
 * Use this to generate a key for production
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Feature #236: Check if a value uses the old v1 encryption format
 */
export function isV1Encrypted(value: string): boolean {
  if (!value) return false;
  return value.startsWith(ENCRYPTED_PREFIX) && !value.startsWith(ENCRYPTED_PREFIX_V2);
}

/**
 * Feature #236: Migrate a v1 encrypted value to v2 format
 * Decrypts the v1 value and re-encrypts with v2 (random salt)
 *
 * @param v1Ciphertext - The v1 encrypted value (enc:v1:...)
 * @returns The re-encrypted v2 value (enc:v2:...), or original if not v1 or migration fails
 */
export function migrateV1ToV2(v1Ciphertext: string): string {
  if (!v1Ciphertext || !isV1Encrypted(v1Ciphertext)) {
    return v1Ciphertext;
  }

  try {
    // Decrypt using v1 format
    const plaintext = decrypt(v1Ciphertext);
    // Re-encrypt using v2 format (which uses random salt)
    return encrypt(plaintext);
  } catch (error) {
    logger.error({ error }, '[Encryption] Failed to migrate v1 to v2');
    throw error;
  }
}
