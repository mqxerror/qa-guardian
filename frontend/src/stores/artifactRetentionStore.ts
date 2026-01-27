import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ArtifactRetentionSettings {
  retentionDays: number; // Number of days to keep artifacts
}

interface ArtifactRetentionState {
  settings: ArtifactRetentionSettings;
  setRetentionDays: (days: number) => void;
}

const initialSettings: ArtifactRetentionSettings = {
  retentionDays: 30, // Default to 30 days
};

export const useArtifactRetentionStore = create<ArtifactRetentionState>()(
  persist(
    (set) => ({
      settings: initialSettings,

      setRetentionDays: (days: number) => {
        set((state) => ({
          settings: {
            ...state.settings,
            retentionDays: days,
          },
        }));
      },
    }),
    {
      name: 'qa-guardian-artifact-retention',
      version: 1,
    }
  )
);
