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
// Feature #229: New prefix for random salt encryption (more secure)
const ENCRYPTED_PREFIX_V2 = 'enc:v2:';

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

/**
 * Feature #229: Derive key using a random salt (more secure than fixed salt)
 * Used for v2 encryption where salt is stored with ciphertext
 */
function deriveKeyWithSalt(salt: Buffer): Buffer | null {
  const masterKey = getEncryptionKeyFromEnv();
  if (!masterKey) {
    return null;
  }

  // Derive key using PBKDF2 with the provided random salt
  return pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
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
        console.error('[Encryption] Cannot decrypt v2 - ENCRYPTION_KEY not set');
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
      console.error('[Encryption] v2 decryption failed:', error);
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
    console.error('[Encryption] Cannot decrypt v1 - ENCRYPTION_KEY not set');
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
    console.error('[Encryption] v1 decryption failed:', error);
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
    console.error('[Encryption] Failed to migrate v1 to v2:', error);
    throw error;
  }
}
