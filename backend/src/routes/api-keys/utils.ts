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

// Helper to format duration in human-readable format
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
