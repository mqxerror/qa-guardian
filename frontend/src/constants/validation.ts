/**
 * Validation constants for URL, email, and input validation
 * Feature #116: Extract magic numbers and strings to constants files
 *
 * All exports are named for tree-shaking compatibility
 */

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validates complete URLs with protocol (http:// or https://)
 * Used for strict URL validation in form inputs
 * @example "https://example.com/path" - valid
 * @example "example.com" - invalid (no protocol)
 */
export const URL_REGEX = /^https?:\/\/[^\s<>"']+$/i;

/**
 * Validates domain names without protocol
 * Accepts: subdomain.example.com, example.co.uk, my-site.org
 * Used for lenient URL input that auto-prepends https://
 */
export const DOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z]{2,})+(?:\/[^\s]*)?$/i;

/**
 * Extracts URLs from text (for AI parsing)
 * More lenient - finds URLs anywhere in text
 */
export const URL_EXTRACT_REGEX = /https?:\/\/[^\s<>"']+/i;

/**
 * Extracts domain names from text (for AI parsing)
 * Finds domains like example.com even without protocol
 */
export const DOMAIN_EXTRACT_REGEX = /\b([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/i;

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Standard email validation pattern
 * Validates common email formats
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================================
// UUID Validation
// ============================================================================

/**
 * Validates UUID v4 format
 * Used for validating IDs from backend
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ============================================================================
// Input Validation Helpers
// ============================================================================

/**
 * Validates and normalizes URL input
 * Returns valid URL or null if invalid
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Already a valid URL
  if (URL_REGEX.test(trimmed)) {
    return trimmed;
  }

  // Domain without protocol - add https://
  if (DOMAIN_REGEX.test(trimmed)) {
    const fixed = `https://${trimmed}`;
    if (URL_REGEX.test(fixed)) {
      return fixed;
    }
  }

  return null;
}

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(input: string): boolean {
  return URL_REGEX.test(input.trim());
}

/**
 * Validates if a string is a valid UUID v4
 */
export function isValidUUID(input: string): boolean {
  return UUID_REGEX.test(input);
}

/**
 * Validates if a string is a valid email
 */
export function isValidEmail(input: string): boolean {
  return EMAIL_REGEX.test(input.trim());
}

// ============================================================================
// Input Length Limits
// ============================================================================

/** Maximum URL length */
export const MAX_URL_LENGTH = 2048;

/** Maximum name length for projects, suites, tests */
export const MAX_NAME_LENGTH = 255;

/** Maximum description length */
export const MAX_DESCRIPTION_LENGTH = 5000;

/** Minimum password length */
export const MIN_PASSWORD_LENGTH = 8;
