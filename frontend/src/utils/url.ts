/**
 * Shared URL utility functions
 *
 * Consolidates duplicated URL validation and manipulation functions
 * from across the frontend codebase.
 */

/**
 * Validate that a string is a well-formed URL with http or https protocol.
 *
 * @param url - The URL string to validate
 * @returns true if the URL is valid and uses http/https protocol
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Auto-complete a URL with https:// if no protocol is present.
 *
 * @param url - The URL string, possibly without protocol
 * @returns The URL with https:// prepended if needed
 */
export function autoCompleteUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}
