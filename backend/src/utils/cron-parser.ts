/**
 * Feature #685: Cron Expression Parser
 *
 * A lightweight cron expression parser that calculates the next run time
 * from a standard 5-field cron expression.
 *
 * Format: minute hour day-of-month month day-of-week
 * - minute: 0-59
 * - hour: 0-23
 * - day-of-month: 1-31
 * - month: 1-12
 * - day-of-week: 0-6 (Sunday=0)
 *
 * Supports:
 * - Single values: 5
 * - Ranges: 1-5
 * - Lists: 1,3,5
 * - Steps: star/5, 0-30/10
 * - Wildcards: star (*)
 */

export interface CronValidationResult {
  valid: boolean;
  error?: string;
}

export interface CronField {
  values: number[];
  min: number;
  max: number;
}

const FIELD_CONFIGS = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 6 },
} as const;

/**
 * Parse a single cron field (e.g., "star/5", "1-10", "0,15,30,45")
 */
function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  // Handle comma-separated list
  const parts = field.split(',');

  for (const part of parts) {
    // Handle step values (e.g., "*/5" or "0-30/5")
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step < 1) {
        throw new Error(`Invalid step value: ${stepStr}`);
      }

      let start = min;
      let end = max;

      if (range !== '*') {
        if (range.includes('-')) {
          const [startStr, endStr] = range.split('-');
          start = parseInt(startStr, 10);
          end = parseInt(endStr, 10);
        } else {
          start = parseInt(range, 10);
          end = max;
        }
      }

      for (let i = start; i <= end; i += step) {
        if (i >= min && i <= max) {
          values.add(i);
        }
      }
    }
    // Handle range (e.g., "1-5")
    else if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid range: ${part}`);
      }

      for (let i = start; i <= end; i++) {
        if (i >= min && i <= max) {
          values.add(i);
        }
      }
    }
    // Handle wildcard
    else if (part === '*') {
      for (let i = min; i <= max; i++) {
        values.add(i);
      }
    }
    // Handle single value
    else {
      const val = parseInt(part, 10);
      if (isNaN(val)) {
        throw new Error(`Invalid value: ${part}`);
      }
      if (val >= min && val <= max) {
        values.add(val);
      }
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

/**
 * Validate a cron expression and return validation result
 */
export function validateCronExpression(expression: string): CronValidationResult {
  if (!expression || typeof expression !== 'string') {
    return { valid: false, error: 'Cron expression is required' };
  }

  const trimmed = expression.trim();
  const fields = trimmed.split(/\s+/);

  if (fields.length !== 5) {
    return {
      valid: false,
      error: `Cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}`,
    };
  }

  const fieldNames = ['minute', 'hour', 'day-of-month', 'month', 'day-of-week'] as const;
  const configs = [
    FIELD_CONFIGS.minute,
    FIELD_CONFIGS.hour,
    FIELD_CONFIGS.dayOfMonth,
    FIELD_CONFIGS.month,
    FIELD_CONFIGS.dayOfWeek,
  ];

  for (let i = 0; i < 5; i++) {
    try {
      const values = parseField(fields[i], configs[i].min, configs[i].max);
      if (values.length === 0) {
        return {
          valid: false,
          error: `No valid values in ${fieldNames[i]} field: "${fields[i]}"`,
        };
      }
    } catch (err) {
      return {
        valid: false,
        error: `Invalid ${fieldNames[i]} field "${fields[i]}": ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Parse a cron expression into its component fields
 */
export function parseCronExpression(expression: string): {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
} {
  const trimmed = expression.trim();
  const fields = trimmed.split(/\s+/);

  if (fields.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${fields.length}`);
  }

  return {
    minutes: parseField(fields[0], FIELD_CONFIGS.minute.min, FIELD_CONFIGS.minute.max),
    hours: parseField(fields[1], FIELD_CONFIGS.hour.min, FIELD_CONFIGS.hour.max),
    daysOfMonth: parseField(fields[2], FIELD_CONFIGS.dayOfMonth.min, FIELD_CONFIGS.dayOfMonth.max),
    months: parseField(fields[3], FIELD_CONFIGS.month.min, FIELD_CONFIGS.month.max),
    daysOfWeek: parseField(fields[4], FIELD_CONFIGS.dayOfWeek.min, FIELD_CONFIGS.dayOfWeek.max),
  };
}

/**
 * Check if a given date matches a cron expression's day constraints
 * (handles the day-of-month / day-of-week interaction)
 */
function matchesDayConstraints(
  date: Date,
  daysOfMonth: number[],
  daysOfWeek: number[],
  dayOfMonthWildcard: boolean,
  dayOfWeekWildcard: boolean
): boolean {
  const dayOfMonth = date.getDate();
  const dayOfWeek = date.getDay();

  // If both are wildcards, any day matches
  if (dayOfMonthWildcard && dayOfWeekWildcard) {
    return true;
  }

  // If one is a wildcard and the other is specific, use the specific one
  if (dayOfMonthWildcard) {
    return daysOfWeek.includes(dayOfWeek);
  }
  if (dayOfWeekWildcard) {
    return daysOfMonth.includes(dayOfMonth);
  }

  // If both are specific (non-wildcard), match if EITHER matches (OR semantics)
  // This is standard cron behavior for when both day fields are specified
  return daysOfMonth.includes(dayOfMonth) || daysOfWeek.includes(dayOfWeek);
}

/**
 * Calculate the next run time from a cron expression
 *
 * @param expression - A 5-field cron expression
 * @param fromDate - The date to start searching from (defaults to now)
 * @param maxIterations - Maximum iterations to prevent infinite loops
 * @returns The next matching date, or null if none found within limits
 */
export function getNextRunTime(
  expression: string,
  fromDate: Date = new Date(),
  maxIterations: number = 366 * 24 * 60 // ~1 year of minutes
): Date | null {
  const parsed = parseCronExpression(expression);
  const { minutes, hours, daysOfMonth, months, daysOfWeek } = parsed;

  // Check if fields are wildcards (original expression)
  const fields = expression.trim().split(/\s+/);
  const dayOfMonthWildcard = fields[2] === '*';
  const dayOfWeekWildcard = fields[4] === '*';

  // Start from the next minute
  const next = new Date(fromDate);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    // Check month
    const month = next.getMonth() + 1; // JavaScript months are 0-indexed
    if (!months.includes(month)) {
      // Move to first day of next matching month
      let foundMonth = false;
      for (const m of months) {
        if (m > month) {
          next.setMonth(m - 1, 1);
          next.setHours(hours[0], minutes[0], 0, 0);
          foundMonth = true;
          break;
        }
      }
      if (!foundMonth) {
        // Wrap to next year
        next.setFullYear(next.getFullYear() + 1);
        next.setMonth(months[0] - 1, 1);
        next.setHours(hours[0], minutes[0], 0, 0);
      }
      continue;
    }

    // Check day constraints
    if (!matchesDayConstraints(next, daysOfMonth, daysOfWeek, dayOfMonthWildcard, dayOfWeekWildcard)) {
      // Move to next day
      next.setDate(next.getDate() + 1);
      next.setHours(hours[0], minutes[0], 0, 0);
      continue;
    }

    // Check hour
    const hour = next.getHours();
    if (!hours.includes(hour)) {
      let foundHour = false;
      for (const h of hours) {
        if (h > hour) {
          next.setHours(h, minutes[0], 0, 0);
          foundHour = true;
          break;
        }
      }
      if (!foundHour) {
        // Move to next day
        next.setDate(next.getDate() + 1);
        next.setHours(hours[0], minutes[0], 0, 0);
      }
      continue;
    }

    // Check minute
    const minute = next.getMinutes();
    if (!minutes.includes(minute)) {
      let foundMinute = false;
      for (const m of minutes) {
        if (m > minute) {
          next.setMinutes(m, 0, 0);
          foundMinute = true;
          break;
        }
      }
      if (!foundMinute) {
        // Move to next hour
        const nextHourIdx = hours.indexOf(hour) + 1;
        if (nextHourIdx < hours.length) {
          next.setHours(hours[nextHourIdx], minutes[0], 0, 0);
        } else {
          // Move to next day
          next.setDate(next.getDate() + 1);
          next.setHours(hours[0], minutes[0], 0, 0);
        }
      }
      continue;
    }

    // All constraints match!
    return next;
  }

  // No match found within iteration limit
  return null;
}

/**
 * Get a human-readable description of a cron expression
 */
export function describeCronExpression(expression: string): string {
  const validation = validateCronExpression(expression);
  if (!validation.valid) {
    return `Invalid: ${validation.error}`;
  }

  const fields = expression.trim().split(/\s+/);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

  // Handle common patterns
  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every hour, at the start of the hour';
  }
  if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every day at midnight';
  }
  if (minute.includes('/')) {
    const step = minute.split('/')[1];
    return `Every ${step} minutes`;
  }
  if (hour.includes('/')) {
    const step = hour.split('/')[1];
    return `Every ${step} hours`;
  }

  // Generic description
  const parts: string[] = [];

  if (minute !== '*') parts.push(`minute ${minute}`);
  if (hour !== '*') parts.push(`hour ${hour}`);
  if (dayOfMonth !== '*') parts.push(`day ${dayOfMonth}`);
  if (month !== '*') parts.push(`month ${month}`);
  if (dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (/^\d$/.test(dayOfWeek)) {
      parts.push(days[parseInt(dayOfWeek, 10)] || `day-of-week ${dayOfWeek}`);
    } else {
      parts.push(`day-of-week ${dayOfWeek}`);
    }
  }

  return parts.length > 0 ? `At ${parts.join(', ')}` : 'Every minute';
}

export default {
  validateCronExpression,
  parseCronExpression,
  getNextRunTime,
  describeCronExpression,
};
