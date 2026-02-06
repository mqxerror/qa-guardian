/**
 * Encryption Service
 * Feature #217: Encrypt sensitive data at rest in PostgreSQL
 *
 * Provides AES-256-GCM encryption for sensitive data fields.
 * Key is derived from ENCRYPTION_KEY env var using PBKDF2.
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto';

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

// Cache the derived key to avoid repeated PBKDF2 calls
let cachedKey: Buffer | null = null;
let cachedSalt: string | null = null;

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Get the encryption key from environment, with validation
 */
function getEncryptionKeyFromEnv(): string | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn('[Encryption] ENCRYPTION_KEY not set - sensitive data will NOT be encrypted');
    return null;
  }
  if (key.length < 32) {
    console.warn('[Encryption] ENCRYPTION_KEY should be at least 32 characters for security');
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
 *
 * @param plaintext - The data to encrypt
 * @returns Encrypted data as base64 string with prefix, or original if encryption disabled
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  const key = deriveKey();
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

  // Combine: IV + AuthTag + Encrypted data
  const combined = Buffer.concat([iv, authTag, encrypted]);

  // Return with prefix for identification
  return ENCRYPTED_PREFIX + combined.toString('base64');
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 *
 * @param ciphertext - The encrypted data (with prefix)
 * @returns Decrypted plaintext, or original if not encrypted or decryption fails
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    return ciphertext;
  }

  // Check if this is encrypted data
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    // Not encrypted - return as-is (for backwards compatibility with existing data)
    return ciphertext;
  }

  const key = deriveKey();
  if (!key) {
    console.error('[Encryption] Cannot decrypt - ENCRYPTION_KEY not set');
    throw new Error('Encryption key not configured');
  }

  try {
    // Remove prefix and decode base64
    const combined = Buffer.from(ciphertext.slice(ENCRYPTED_PREFIX.length), 'base64');

    // Extract components
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
    console.error('[Encryption] Decryption failed:', error);
    throw new Error('Failed to decrypt data - key may have changed');
  }
}

/**
 * Check if a value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith(ENCRYPTED_PREFIX) ?? false;
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
