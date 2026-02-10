/**
 * SchedulePicker Component
 * Feature #596: Inline schedule picker for Create & Schedule flow
 *
 * Provides a simple schedule configuration UI with:
 * - Frequency selector (hourly, daily, weekly, monthly, custom)
 * - Time picker for daily/weekly/monthly
 * - Day-of-week selector for weekly
 * - Preview of next 3 scheduled runs
 */

import React, { useState, useMemo } from 'react';
import { Calendar, Clock, ChevronDown, ChevronUp, Info } from 'lucide-react';

/**
 * Schedule frequency options
 */
export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

/**
 * Day of week options
 */
const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', short: 'S' },
  { value: 1, label: 'Mon', short: 'M' },
  { value: 2, label: 'Tue', short: 'T' },
  { value: 3, label: 'Wed', short: 'W' },
  { value: 4, label: 'Thu', short: 'T' },
  { value: 5, label: 'Fri', short: 'F' },
  { value: 6, label: 'Sat', short: 'S' },
];

/**
 * Schedule configuration state
 */
export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  time: string; // HH:MM format
  daysOfWeek: number[]; // 0-6 for weekly
  dayOfMonth: number; // 1-31 for monthly
  cronExpression: string; // For custom
  timezone: string;
  enabled: boolean;
  notifyOnFailure: boolean;
}

/**
 * Props for SchedulePicker
 */
export interface SchedulePickerProps {
  value: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
  onClose?: () => void;
}

/**
 * Default schedule config
 */
export const DEFAULT_SCHEDULE: ScheduleConfig = {
  frequency: 'daily',
  time: '09:00',
  daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  dayOfMonth: 1,
  cronExpression: '0 9 * * *',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  enabled: true,
  notifyOnFailure: true,
};

/**
 * Generate cron expression from config
 */
function generateCronExpression(config: ScheduleConfig): string {
  const [hour, minute] = config.time.split(':').map(Number);

  switch (config.frequency) {
    case 'hourly':
      return `${minute} * * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly': {
      const days = config.daysOfWeek.length > 0 ? config.daysOfWeek.join(',') : '*';
      return `${minute} ${hour} * * ${days}`;
    }
    case 'monthly':
      return `${minute} ${hour} ${config.dayOfMonth} * *`;
    case 'custom':
      return config.cronExpression;
    default:
      return `${minute} ${hour} * * *`;
  }
}

/**
 * Calculate next run times from cron expression (simplified)
 */
function getNextRunTimes(cronExpression: string, count: number = 3): Date[] {
  const now = new Date();
  const runs: Date[] = [];
  const parts = cronExpression.split(' ');

  if (parts.length !== 5) return runs;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  const targetMinute = minute === '*' ? now.getMinutes() : parseInt(minute);
  const targetHour = hour === '*' ? now.getHours() : parseInt(hour);

  const current = new Date(now);
  current.setSeconds(0);
  current.setMilliseconds(0);

  // Simple next run calculation (not a full cron parser)
  for (let i = 0; i < 30 && runs.length < count; i++) {
    const testDate = new Date(current);
    testDate.setDate(testDate.getDate() + i);
    testDate.setHours(targetHour);
    testDate.setMinutes(targetMinute);

    if (testDate > now) {
      // Check day of week constraint
      if (dayOfWeek !== '*') {
        const allowedDays = dayOfWeek.split(',').map(Number);
        if (!allowedDays.includes(testDate.getDay())) continue;
      }

      // Check day of month constraint
      if (dayOfMonth !== '*') {
        if (testDate.getDate() !== parseInt(dayOfMonth)) continue;
      }

      runs.push(testDate);
    }
  }

  return runs;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * SchedulePicker component
 */
export const SchedulePicker: React.FC<SchedulePickerProps> = ({
  value,
  onChange,
  onClose,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update field helper
  const updateField = <K extends keyof ScheduleConfig>(
    field: K,
    newValue: ScheduleConfig[K]
  ) => {
    const updated = { ...value, [field]: newValue };
    // Regenerate cron expression when changing frequency-related fields
    if (field !== 'cronExpression' && value.frequency !== 'custom') {
      updated.cronExpression = generateCronExpression(updated);
    }
    onChange(updated);
  };

  // Calculate next runs
  const nextRuns = useMemo(() => {
    const cron = value.frequency === 'custom' ? value.cronExpression : generateCronExpression(value);
    return getNextRunTimes(cron, 3);
  }, [value]);

  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-4 border border-border">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Schedule Configuration
        </h4>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Frequency Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-foreground">Frequency</label>
        <div className="grid grid-cols-5 gap-1">
          {(['hourly', 'daily', 'weekly', 'monthly', 'custom'] as ScheduleFrequency[]).map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() => updateField('frequency', freq)}
              className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                value.frequency === freq
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
            >
              {freq.charAt(0).toUpperCase() + freq.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Time Picker (for daily/weekly/monthly) */}
      {value.frequency !== 'hourly' && value.frequency !== 'custom' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Time
          </label>
          <input
            type="time"
            value={value.time}
            onChange={(e) => updateField('time', e.target.value)}
            className="w-32 px-2 py-1.5 text-sm border border-border rounded-md bg-input text-foreground"
          />
        </div>
      )}

      {/* Day of Week Selector (for weekly) */}
      {value.frequency === 'weekly' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-foreground">Days of Week</label>
          <div className="flex gap-1">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => {
                  const newDays = value.daysOfWeek.includes(day.value)
                    ? value.daysOfWeek.filter((d) => d !== day.value)
                    : [...value.daysOfWeek, day.value].sort((a, b) => a - b);
                  updateField('daysOfWeek', newDays);
                }}
                className={`w-8 h-8 text-xs rounded-full transition-colors ${
                  value.daysOfWeek.includes(day.value)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
                title={day.label}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day of Month Selector (for monthly) */}
      {value.frequency === 'monthly' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-foreground">Day of Month</label>
          <select
            value={value.dayOfMonth}
            onChange={(e) => updateField('dayOfMonth', parseInt(e.target.value))}
            className="w-32 px-2 py-1.5 text-sm border border-border rounded-md bg-input text-foreground"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Custom Cron Expression */}
      {value.frequency === 'custom' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-foreground">Cron Expression</label>
          <input
            type="text"
            value={value.cronExpression}
            onChange={(e) => updateField('cronExpression', e.target.value)}
            placeholder="0 9 * * *"
            className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-input text-foreground font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Format: minute hour day month weekday (e.g., 0 9 * * 1-5 = 9am Mon-Fri)
          </p>
        </div>
      )}

      {/* Next Runs Preview */}
      {nextRuns.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-foreground">Next Scheduled Runs</label>
          <div className="bg-card rounded-md p-2 space-y-1">
            {nextRuns.map((run, index) => (
              <div key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">
                  {index + 1}
                </span>
                {formatDate(run)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Options */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Advanced Options
      </button>

      {showAdvanced && (
        <div className="space-y-3 pl-4 border-l-2 border-border">
          {/* Timezone */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-foreground">Timezone</label>
            <input
              type="text"
              value={value.timezone}
              onChange={(e) => updateField('timezone', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-input text-foreground"
            />
          </div>

          {/* Notify on Failure */}
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={value.notifyOnFailure}
              onChange={(e) => updateField('notifyOnFailure', e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-foreground">Notify on test failure</span>
          </label>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <span>
          The schedule will run all tests in this test suite. Individual tests can be enabled/disabled in the suite settings.
        </span>
      </div>
    </div>
  );
};

export default SchedulePicker;
