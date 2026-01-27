import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TestDefaults {
  defaultTimeout: number; // in milliseconds
  defaultBrowser: 'chromium' | 'firefox' | 'webkit';
  defaultRetries: number;
}

interface TestDefaultsState {
  defaults: TestDefaults;
  setDefault: <K extends keyof TestDefaults>(key: K, value: TestDefaults[K]) => void;
  setAllDefaults: (defaults: Partial<TestDefaults>) => void;
}

const initialDefaults: TestDefaults = {
  defaultTimeout: 30000, // 30 seconds
  defaultBrowser: 'chromium',
  defaultRetries: 0,
};

export const useTestDefaultsStore = create<TestDefaultsState>()(
  persist(
    (set) => ({
      defaults: initialDefaults,

      setDefault: (key, value) => {
        set((state) => ({
          defaults: {
            ...state.defaults,
            [key]: value,
          },
        }));
      },

      setAllDefaults: (newDefaults) => {
        set((state) => ({
          defaults: {
            ...state.defaults,
            ...newDefaults,
          },
        }));
      },
    }),
    {
      name: 'qa-guardian-test-defaults',
      version: 1,
    }
  )
);
