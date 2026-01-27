import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimezoneState {
  timezone: string;
  setTimezone: (timezone: string) => void;
  formatDate: (date: string | Date) => string;
  formatDateTime: (date: string | Date) => string;
}

export const useTimezoneStore = create<TimezoneState>()(
  persist(
    (set, get) => ({
      timezone: 'UTC', // Default to UTC

      setTimezone: (timezone: string) => {
        set({ timezone });
      },

      // Format date only (e.g., "1/13/2026")
      formatDate: (date: string | Date) => {
        const { timezone } = get();
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleDateString('en-US', {
          timeZone: timezone,
        });
      },

      // Format date and time (e.g., "1/13/2026, 2:30:00 PM")
      formatDateTime: (date: string | Date) => {
        const { timezone } = get();
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleString('en-US', {
          timeZone: timezone,
        });
      },
    }),
    {
      name: 'qa-guardian-timezone',
      version: 1,
    }
  )
);
