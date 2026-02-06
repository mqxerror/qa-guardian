/**
 * Constants index - re-exports all constants for convenient importing
 * Feature #116: Extract magic numbers and strings to constants files
 *
 * Usage:
 *   import { URL_REGEX, DEFAULT_TEST_TIMEOUT_MS } from '../constants';
 *
 * Or import from specific files for better tree-shaking:
 *   import { URL_REGEX } from '../constants/validation';
 */

export * from './validation';
export * from './timeouts';
export * from './thresholds';
