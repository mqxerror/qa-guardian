import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationPreferences {
  emailNotifications: boolean;
  testFailureAlerts: boolean;
  scheduleCompletionAlerts: boolean;
  weeklyDigest: boolean;
}

// In-app notification type
export interface InAppNotification {
  id: string;
  type: 'test_complete' | 'test_failed' | 'schedule_triggered' | 'alert' | 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  runId?: string;
  testId?: string;
  suiteId?: string;
  duration?: number;
}

interface NotificationState {
  preferences: NotificationPreferences;
  notifications: InAppNotification[];
  unreadCount: number;
  setPreference: <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => void;
  setAllPreferences: (prefs: Partial<NotificationPreferences>) => void;
  addNotification: (notification: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const defaultPreferences: NotificationPreferences = {
  emailNotifications: true,
  testFailureAlerts: true,
  scheduleCompletionAlerts: true,
  weeklyDigest: false,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      notifications: [],
      unreadCount: 0,

      setPreference: (key, value) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            [key]: value,
          },
        }));
      },

      setAllPreferences: (prefs) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...prefs,
          },
        }));
      },

      addNotification: (notification) => {
        const newNotification: InAppNotification = {
          ...notification,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          read: false,
        };
        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep max 50
          unreadCount: state.unreadCount + 1,
        }));
      },

      markAsRead: (id) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === id);
          if (!notification || notification.read) return state;
          return {
            notifications: state.notifications.map(n =>
              n.id === id ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      clearNotifications: () => {
        set({ notifications: [], unreadCount: 0 });
      },
    }),
    {
      name: 'qa-guardian-notifications',
      version: 2, // Increment version for new structure
    }
  )
);
