// Utility functions for API keys module

import crypto from 'crypto';

// Generate a secure API key
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  // Generate a random 32-byte key
  const randomBytes = crypto.randomBytes(32);
  const key = `qg_${randomBytes.toString('base64url')}`;

  // Create prefix for display (first 12 chars after qg_)
  const prefix = `qg_${key.substring(3, 11)}...`;

  // Hash the key for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  return { key, prefix, hash };
}

// Re-export formatDuration from shared utils for backward compatibility
export { formatDuration } from '../../utils/index.js';
