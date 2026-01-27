/**
 * Types for Create Test Modal components
 * Feature #1800: CreateTestModal with two-section layout
 */

// Re-export base types from test-modals
export type { TestType, ViewportPreset, TestFormData, CreateTestModalProps } from '../test-modals/types';
export { DEFAULT_FORM_DATA, VIEWPORT_PRESETS, MULTI_VIEWPORT_CONFIGS } from '../test-modals/types';

/**
 * Quick Test selection configuration
 * Used for generating multiple tests from a single URL
 */
export interface QuickTestSelection {
  smoke: boolean;
  e2e: boolean;
  visual: boolean;
  accessibility: boolean;
  performance: boolean;
  load: boolean;
}

/**
 * Props for the QuickTestPanel section
 */
export interface QuickTestPanelProps {
  targetUrl: string;
  onUrlChange: (url: string) => void;
  testSelection: QuickTestSelection;
  onSelectionChange: (selection: QuickTestSelection) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  urlError?: string | null;
}

/**
 * Props for the CustomTestEntry section
 */
export interface CustomTestEntryProps {
  onStartWizard: () => void;
}

/**
 * Modal section that is currently active
 */
export type ModalSection = 'main' | 'wizard';

/**
 * Wizard step for custom test creation
 */
export type WizardStep = 'type' | 'url' | 'settings' | 'review';

/**
 * Generated test preview from quick generation
 */
export interface GeneratedTestPreview {
  id: string;
  type: string;
  name: string;
  targetUrl: string;
  estimatedDuration: string;
  status: 'pending' | 'creating' | 'created' | 'failed';
  error?: string;
}

/**
 * Default quick test selection
 */
export const DEFAULT_QUICK_SELECTION: QuickTestSelection = {
  smoke: false,
  e2e: true,
  visual: true,
  accessibility: true,
  performance: false,
  load: false,
};

/**
 * Test type display configurations
 */
export const TEST_TYPE_CONFIG = {
  smoke: {
    label: 'Smoke Test',
    description: 'Quick health check (<30s)',
    icon: 'fire',
    color: 'orange',
  },
  e2e: {
    label: 'E2E Test',
    description: 'End-to-end functional test',
    icon: 'play',
    color: 'blue',
  },
  visual: {
    label: 'Visual Regression',
    description: 'Screenshot comparison test',
    icon: 'eye',
    color: 'purple',
  },
  accessibility: {
    label: 'Accessibility',
    description: 'WCAG compliance check',
    icon: 'accessibility',
    color: 'green',
  },
  performance: {
    label: 'Performance',
    description: 'Lighthouse audit',
    icon: 'zap',
    color: 'amber',
  },
  load: {
    label: 'Load Test',
    description: 'K6 stress testing',
    icon: 'users',
    color: 'red',
  },
} as const;
