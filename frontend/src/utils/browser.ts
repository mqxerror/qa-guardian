/**
 * Shared browser display utility functions
 *
 * Consolidates duplicated browser name and icon functions
 * from across the frontend codebase.
 */

/**
 * Get a human-readable display name for a Playwright browser engine.
 *
 * @param browser - Playwright browser engine name (chromium, firefox, webkit)
 * @returns Human-friendly name (Chrome, Firefox, Safari)
 */
export function getBrowserDisplayName(browser: string): string {
  switch (browser) {
    case 'chromium': return 'Chrome';
    case 'firefox': return 'Firefox';
    case 'webkit': return 'Safari';
    default: return browser;
  }
}

/**
 * Get an emoji icon for a browser engine.
 *
 * @param browser - Browser engine name (chromium, firefox, webkit, or display names)
 * @returns Emoji string representing the browser
 */
export function getBrowserIcon(browser?: string): string {
  switch (browser) {
    case 'chromium':
    case 'Chrome':
      return '\u{1F310}'; // globe with meridians
    case 'firefox':
    case 'Firefox':
      return '\u{1F98A}'; // fox face
    case 'webkit':
    case 'Safari':
      return '\u{1F9ED}'; // compass
    case 'Edge':
      return '\u{1F300}'; // cyclone
    default:
      return '\u{1F310}'; // globe with meridians
  }
}
