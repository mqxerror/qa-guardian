/**
 * QA Guardian MCP CRON Utilities
 *
 * Utility functions for CRON expression parsing and scheduling.
 * Extracted from server.ts for better organization (Feature #1356).
 */

/**
 * Parse a cron field into an array of valid values
 */
function parseCronField(field: string, min: number, max: number): number[] {
  const values: number[] = [];

  for (const segment of field.split(',')) {
    if (segment === '*') {
      for (let i = min; i <= max; i++) values.push(i);
    } else if (segment.includes('/')) {
      const parts = segment.split('/');
      const base = parts[0] ?? '*';
      const step = parts[1] ?? '1';
      const stepNum = parseInt(step, 10);
      const start = base === '*' ? min : parseInt(base, 10);
      for (let i = start; i <= max; i += stepNum) values.push(i);
    } else if (segment.includes('-')) {
      const rangeParts = segment.split('-').map(n => parseInt(n, 10));
      const start = rangeParts[0] ?? min;
      const end = rangeParts[1] ?? max;
      for (let i = start; i <= end; i++) values.push(i);
    } else {
      values.push(parseInt(segment, 10));
    }
  }

  return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * Calculate next cron run time
 * @param cron CRON expression (5 fields: minute hour day month weekday)
 * @param _timezone Timezone (currently unused)
 * @returns Date of next scheduled run
 */
export function calculateNextCronRun(cron: string, _timezone: string): Date {
  const now = new Date();
  const parts = cron.split(/\s+/);
  const minutePart = parts[0] ?? '*';
  const hourPart = parts[1] ?? '*';
  const dayPart = parts[2] ?? '*';
  const monthPart = parts[3] ?? '*';
  const weekdayPart = parts[4] ?? '*';

  const minutes = parseCronField(minutePart, 0, 59);
  const hours = parseCronField(hourPart, 0, 23);
  const days = parseCronField(dayPart, 1, 31);
  const months = parseCronField(monthPart, 1, 12);
  const weekdays = parseCronField(weekdayPart, 0, 6);

  // Simple next run calculation (within next 7 days)
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const checkMonth = checkDate.getMonth() + 1;
    const checkDay = checkDate.getDate();
    const checkWeekday = checkDate.getDay();

    if (!months.includes(checkMonth)) continue;
    if (!days.includes(checkDay) && !weekdays.includes(checkWeekday)) continue;

    for (const hour of hours) {
      for (const minute of minutes) {
        const candidate = new Date(checkDate);
        candidate.setHours(hour, minute, 0, 0);

        if (candidate > now) {
          return candidate;
        }
      }
    }
  }

  // Fallback: return tomorrow at the first scheduled time
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(hours[0] || 0, minutes[0] || 0, 0, 0);
  return tomorrow;
}

/**
 * Generate human-readable cron description
 * @param cron CRON expression (5 fields)
 * @returns Human-readable description of the schedule
 */
export function describeCronExpression(cron: string): string {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, day, month, weekday] = parts;

  // Common patterns
  if (minute === '0' && hour === '0' && day === '*' && month === '*' && weekday === '*') {
    return 'Daily at midnight';
  }
  if (minute === '0' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return 'Every hour at :00';
  }
  if (minute === '*/5' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return 'Every 5 minutes';
  }
  if (minute === '*/15' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return 'Every 15 minutes';
  }
  if (minute === '*/30' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return 'Every 30 minutes';
  }
  if (minute === '0' && hour.includes('/') && day === '*' && month === '*' && weekday === '*') {
    const interval = hour.split('/')[1];
    return `Every ${interval} hours`;
  }
  if (minute === '0' && hour === '0' && day === '*' && month === '*' && weekday === '0') {
    return 'Every Sunday at midnight';
  }
  if (minute === '0' && hour === '0' && day === '*' && month === '*' && weekday === '1') {
    return 'Every Monday at midnight';
  }
  if (minute === '0' && hour === '0' && day === '1' && month === '*' && weekday === '*') {
    return 'First day of every month at midnight';
  }
  if (minute === '0' && /^\d+$/.test(hour) && day === '*' && month === '*' && weekday === '*') {
    return `Daily at ${hour.padStart(2, '0')}:00`;
  }
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && day === '*' && month === '*' && weekday === '*') {
    return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  if (minute === '0' && hour === '9' && day === '*' && month === '*' && weekday === '1-5') {
    return 'Weekdays at 9:00 AM';
  }

  // Generic description
  const parts_desc: string[] = [];
  if (minute !== '*') parts_desc.push(`minute ${minute}`);
  if (hour !== '*') parts_desc.push(`hour ${hour}`);
  if (day !== '*') parts_desc.push(`day ${day}`);
  if (month !== '*') parts_desc.push(`month ${month}`);
  if (weekday !== '*') {
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (/^\d$/.test(weekday)) {
      parts_desc.push(`on ${weekdayNames[parseInt(weekday, 10)]}`);
    } else {
      parts_desc.push(`weekday ${weekday}`);
    }
  }

  return parts_desc.length > 0 ? `At ${parts_desc.join(', ')}` : 'Custom schedule';
}
