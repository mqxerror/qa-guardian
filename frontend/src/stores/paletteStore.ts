/**
 * Feature #396: Theme Palette Store
 * Manages the global color palette selection for the application.
 * Palettes override --primary and related CSS variables.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePalette = 'blue' | 'purple' | 'emerald' | 'orange' | 'rose' | 'mono';

export interface PaletteInfo {
  id: ThemePalette;
  name: string;
  color: string; // Primary color hex for display
  description: string;
}

export const PALETTE_OPTIONS: PaletteInfo[] = [
  { id: 'blue', name: 'Default Blue', color: '#4D8BF5', description: 'Classic professional blue' },
  { id: 'purple', name: 'Purple Haze', color: '#A855F7', description: 'Bold and creative' },
  { id: 'emerald', name: 'Emerald', color: '#10B981', description: 'Fresh and natural' },
  { id: 'orange', name: 'Sunset Orange', color: '#F97316', description: 'Warm and energetic' },
  { id: 'rose', name: 'Rose', color: '#F43F5E', description: 'Elegant and vibrant' },
  { id: 'mono', name: 'Monochrome', color: '#9CA3AF', description: 'Clean and minimal' },
];

interface PaletteState {
  palette: ThemePalette;
  setPalette: (palette: ThemePalette) => void;
  getPaletteInfo: () => PaletteInfo;
}

// Apply palette to document
const applyPalette = (palette: ThemePalette) => {
  const root = document.documentElement;

  // Remove all palette attributes first
  root.removeAttribute('data-theme-palette');

  // Apply new palette (blue is default, no attribute needed)
  if (palette !== 'blue') {
    root.setAttribute('data-theme-palette', palette);
  }
};

export const usePaletteStore = create<PaletteState>()(
  persist(
    (set, get) => ({
      palette: 'blue', // Default to blue

      setPalette: (palette: ThemePalette) => {
        set({ palette });
        applyPalette(palette);
      },

      getPaletteInfo: () => {
        const { palette } = get();
        return PALETTE_OPTIONS.find(p => p.id === palette) || PALETTE_OPTIONS[0];
      },
    }),
    {
      name: 'qa-guardian-palette',
      version: 1,
      onRehydrateStorage: () => {
        return (state) => {
          // Apply palette after rehydration
          if (state) {
            applyPalette(state.palette);
          }
        };
      },
    }
  )
);

// Initialize palette on load
if (typeof window !== 'undefined') {
  const storedPalette = localStorage.getItem('qa-guardian-palette');
  if (storedPalette) {
    try {
      const parsed = JSON.parse(storedPalette);
      applyPalette(parsed.state?.palette || 'blue');
    } catch {
      applyPalette('blue');
    }
  }
}
