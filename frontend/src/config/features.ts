/**
 * Feature Flags Configuration
 *
 * Simple feature toggle system for enabling/disabling features.
 *
 * Usage:
 *   import { isFeatureEnabled, FeatureFlag } from '@/config/features';
 *
 *   if (isFeatureEnabled('MY_FEATURE')) {
 *     // Feature is enabled
 *   }
 *
 * To add a new feature flag:
 *   1. Add the flag name to FeatureFlag type
 *   2. Add it to FEATURE_FLAGS with default value
 *   3. Override with env var VITE_FEATURE_<FLAG_NAME>=true/false
 *
 * Feature #1396: Initial feature flags setup
 */

// Available feature flags
export type FeatureFlag =
  | 'EXAMPLE_FEATURE' // Placeholder - replace with real features as needed
  ;

// Default feature flag values
// These can be overridden by environment variables: VITE_FEATURE_<FLAG_NAME>
const FEATURE_FLAGS: Record<FeatureFlag, boolean> = {
  EXAMPLE_FEATURE: false,
};

/**
 * Check if a feature is enabled
 *
 * Checks environment variable first (VITE_FEATURE_<flag>),
 * then falls back to default configuration.
 *
 * @param flag - The feature flag to check
 * @returns true if the feature is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  // Check for environment variable override
  const envVar = `VITE_FEATURE_${flag}`;
  const envValue = import.meta.env[envVar];

  if (envValue !== undefined) {
    return envValue === 'true' || envValue === true;
  }

  // Fall back to default configuration
  return FEATURE_FLAGS[flag] ?? false;
}

/**
 * Get all feature flags and their current values
 * Useful for debugging and admin views
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags = {} as Record<FeatureFlag, boolean>;

  for (const flag of Object.keys(FEATURE_FLAGS) as FeatureFlag[]) {
    flags[flag] = isFeatureEnabled(flag);
  }

  return flags;
}
