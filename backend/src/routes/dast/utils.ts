// DAST Utility Functions

import { DASTConfig, OpenAPISpec } from './types';
import { dastConfigs, DEFAULT_DAST_CONFIG, openApiSpecs } from './stores';

// Generate unique ID
export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

// Get DAST config for a project
export function getDASTConfig(projectId: string): DASTConfig {
  return dastConfigs.get(projectId) || { ...DEFAULT_DAST_CONFIG };
}

// Update DAST config for a project
export function updateDASTConfig(projectId: string, config: Partial<DASTConfig>): DASTConfig {
  const current = getDASTConfig(projectId);
  const updated: DASTConfig = { ...current, ...config };
  dastConfigs.set(projectId, updated);
  return updated;
}

// Get OpenAPI spec for a project
export function getOpenAPISpec(projectId: string): OpenAPISpec | undefined {
  for (const [, spec] of openApiSpecs) {
    if (spec.projectId === projectId) {
      return spec;
    }
  }
  return undefined;
}

// Match URL against a pattern (supports * wildcard)
export function matchUrlPattern(url: string, pattern: string): boolean {
  // Convert wildcard pattern to regex
  // Escape special regex characters except *
  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${escapedPattern}$`, 'i');
  return regex.test(url);
}

// Check if URL is in scan scope based on include/exclude patterns
export function isUrlInScope(
  url: string,
  includeUrls?: string[],
  excludeUrls?: string[]
): boolean {
  // If no include patterns specified, include all by default
  let included = true;
  if (includeUrls && includeUrls.length > 0) {
    included = includeUrls.some(pattern => matchUrlPattern(url, pattern));
  }

  // Check if URL matches any exclude pattern
  if (excludeUrls && excludeUrls.length > 0) {
    const excluded = excludeUrls.some(pattern => matchUrlPattern(url, pattern));
    if (excluded) {
      return false;
    }
  }

  return included;
}

// Generate cron expression from frequency settings
export function generateCronExpression(
  frequency: 'hourly' | 'daily' | 'nightly' | 'weekly' | 'monthly',
  hour: number = 2,
  minute: number = 0,
  dayOfWeek: number = 1,  // 0=Sunday, 1=Monday, etc.
  dayOfMonth: number = 1
): string {
  // Cron format: minute hour day-of-month month day-of-week
  switch (frequency) {
    case 'hourly':
      return `${minute} * * * *`;  // Every hour at the specified minute
    case 'daily':
      return `${minute} ${hour} * * *`;  // Daily at specified time
    case 'nightly':
      return `0 2 * * *`;  // Every night at 2:00 AM
    case 'weekly':
      return `${minute} ${hour} * * ${dayOfWeek}`;  // Weekly on specified day
    case 'monthly':
      return `${minute} ${hour} ${dayOfMonth} * *`;  // Monthly on specified day
    default:
      return `0 2 * * *`;  // Default to nightly at 2 AM
  }
}

// Parse cron expression and calculate next run time
export function calculateDASTNextRun(cronExpression: string, timezone: string): Date | undefined {
  // Simple cron parsing for common patterns
  // Format: minute hour day-of-month month day-of-week
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) return undefined;

  const minute = parts[0] || '*';
  const hour = parts[1] || '*';
  const dayOfMonth = parts[2] || '*';
  const dayOfWeek = parts[4] || '*';
  const now = new Date();
  const next = new Date(now);

  // Set the minute
  if (minute !== '*') {
    next.setMinutes(parseInt(minute, 10));
    next.setSeconds(0);
    next.setMilliseconds(0);
  }

  // Set the hour (if specified)
  if (hour !== '*') {
    next.setHours(parseInt(hour, 10));
    // If we've already passed this time today, move to next occurrence
    if (minute !== '*' && next <= now) {
      // Check if it's a specific day schedule or daily
      if (dayOfWeek === '*' && dayOfMonth === '*') {
        // Daily schedule - move to tomorrow
        next.setDate(next.getDate() + 1);
      }
    }
  } else {
    // Hourly schedule - if we've passed this minute, move to next hour
    if (minute !== '*' && next <= now) {
      next.setHours(next.getHours() + 1);
    }
  }

  // Handle weekly schedules (day-of-week: 0=Sunday, 1=Monday, etc.)
  if (dayOfWeek !== '*') {
    const targetDay = parseInt(dayOfWeek, 10);
    const currentDay = next.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd < 0 || (daysToAdd === 0 && next <= now)) {
      daysToAdd += 7;
    }
    next.setDate(next.getDate() + daysToAdd);
  }

  // Handle monthly schedules (day-of-month)
  if (dayOfMonth !== '*') {
    const targetDate = parseInt(dayOfMonth, 10);
    next.setDate(targetDate);
    // If we've already passed this date this month, move to next month
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
  }

  return next;
}

// Helper to escape HTML
export function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
