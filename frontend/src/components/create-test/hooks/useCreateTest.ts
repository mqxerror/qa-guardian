/**
 * useCreateTest Zustand Store
 * Feature #1801: Single source of truth for all test creation state
 *
 * Manages:
 * - Quick Test mode (URL + multi-test selection)
 * - Custom Test wizard steps
 * - Form validation
 * - API calls for test creation
 */

import { create } from 'zustand';
import { TestType, TestFormData, DEFAULT_FORM_DATA, QuickTestSelection } from '../types';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://qa.pixelcraftedmedia.com';

/**
 * Modal section types
 */
export type ModalSection = 'quick' | 'wizard';

/**
 * Wizard steps for custom test creation
 */
export type WizardStep = 'type' | 'url' | 'settings' | 'review';

/**
 * Generated test preview
 */
export interface GeneratedTestPreview {
  id: string;
  type: string;
  name: string;
  targetUrl: string;
  status: 'pending' | 'creating' | 'created' | 'failed';
  error?: string;
  createdTestId?: string;
}

/**
 * Created test info for links
 */
export interface CreatedTestInfo {
  id: string;
  name: string;
  type: string;
}

/**
 * Batch creation summary - Feature #1805
 */
export interface BatchCreationSummary {
  created: number;
  failed: number;
  total: number;
  isComplete: boolean;
  allSucceeded: boolean;
  createdTests: CreatedTestInfo[];
}

/**
 * Validation errors
 */
export interface ValidationErrors {
  quickUrl?: string;
  quickTests?: string;
  name?: string;
  targetUrl?: string;
  type?: string;
  [key: string]: string | undefined;
}

/**
 * Store state interface
 */
interface CreateTestState {
  // Modal state
  isOpen: boolean;
  suiteId: string | null;
  token: string | null;

  // Active section
  activeSection: ModalSection;
  wizardStep: WizardStep;

  // Quick Test state
  quickUrl: string;
  quickTests: QuickTestSelection;
  generatedPreviews: GeneratedTestPreview[];

  // Custom Test / Wizard state
  selectedType: TestType;
  formData: TestFormData;
  aiInput: string;

  // Submission state
  isSubmitting: boolean;
  isGeneratingQuick: boolean;

  // Validation
  errors: ValidationErrors;

  // Actions - Modal
  openModal: (suiteId: string, token: string) => void;
  closeModal: () => void;

  // Actions - Section navigation
  setActiveSection: (section: ModalSection) => void;
  setWizardStep: (step: WizardStep) => void;
  nextWizardStep: () => void;
  prevWizardStep: () => void;

  // Actions - Quick Test
  setQuickUrl: (url: string) => void;
  setQuickTests: (tests: QuickTestSelection) => void;
  toggleQuickTest: (type: keyof QuickTestSelection) => void;
  generateQuickTests: () => Promise<GeneratedTestPreview[]>;

  // Actions - Custom Test
  setSelectedType: (type: TestType) => void;
  updateFormData: (updates: Partial<TestFormData>) => void;
  setAiInput: (input: string) => void;
  createCustomTest: () => Promise<{ id: string; name: string } | null>;

  // Actions - Validation
  validateQuickTest: () => boolean;
  validateCustomTest: () => boolean;
  clearError: (field: string) => void;
  setError: (field: string, message: string) => void;

  // Actions - Summary
  getCreatedTestsSummary: () => BatchCreationSummary;

  // Actions - Reset
  reset: () => void;
  resetQuickTest: () => void;
  resetCustomTest: () => void;
}

/**
 * Default quick test selection
 */
const DEFAULT_QUICK_TESTS: QuickTestSelection = {
  smoke: false,
  e2e: true,
  visual: true,
  accessibility: true,
  performance: false,
  load: false,
};

/**
 * Wizard step order
 */
const WIZARD_STEPS: WizardStep[] = ['type', 'url', 'settings', 'review'];

/**
 * URL validation regex
 */
const URL_REGEX = /^https?:\/\/[^\s<>"']+$/i;

/**
 * Create the zustand store
 */
export const useCreateTest = create<CreateTestState>((set, get) => ({
  // Initial state
  isOpen: false,
  suiteId: null,
  token: null,
  activeSection: 'quick',
  wizardStep: 'type',
  quickUrl: '',
  quickTests: { ...DEFAULT_QUICK_TESTS },
  generatedPreviews: [],
  selectedType: 'e2e',
  formData: { ...DEFAULT_FORM_DATA },
  aiInput: '',
  isSubmitting: false,
  isGeneratingQuick: false,
  errors: {},

  // Modal actions
  openModal: (suiteId: string, token: string) => {
    set({
      isOpen: true,
      suiteId,
      token,
      activeSection: 'quick',
      wizardStep: 'type',
      quickUrl: '',
      quickTests: { ...DEFAULT_QUICK_TESTS },
      generatedPreviews: [],
      selectedType: 'e2e',
      formData: { ...DEFAULT_FORM_DATA },
      aiInput: '',
      isSubmitting: false,
      isGeneratingQuick: false,
      errors: {},
    });
  },

  closeModal: () => {
    set({ isOpen: false });
  },

  // Section navigation
  setActiveSection: (section: ModalSection) => {
    set({ activeSection: section, errors: {} });
  },

  setWizardStep: (step: WizardStep) => {
    set({ wizardStep: step });
  },

  nextWizardStep: () => {
    const { wizardStep } = get();
    const currentIndex = WIZARD_STEPS.indexOf(wizardStep);
    if (currentIndex < WIZARD_STEPS.length - 1) {
      set({ wizardStep: WIZARD_STEPS[currentIndex + 1] });
    }
  },

  prevWizardStep: () => {
    const { wizardStep } = get();
    const currentIndex = WIZARD_STEPS.indexOf(wizardStep);
    if (currentIndex > 0) {
      set({ wizardStep: WIZARD_STEPS[currentIndex - 1] });
    }
  },

  // Quick Test actions
  setQuickUrl: (url: string) => {
    set({ quickUrl: url });
    // Clear URL error when typing
    if (get().errors.quickUrl) {
      set((state) => ({
        errors: { ...state.errors, quickUrl: undefined },
      }));
    }
  },

  setQuickTests: (tests: QuickTestSelection) => {
    set({ quickTests: tests });
  },

  toggleQuickTest: (type: keyof QuickTestSelection) => {
    set((state) => ({
      quickTests: {
        ...state.quickTests,
        [type]: !state.quickTests[type],
      },
    }));
  },

  generateQuickTests: async () => {
    const { quickUrl, quickTests, suiteId, token, validateQuickTest } = get();

    // Validate first
    if (!validateQuickTest()) {
      return [];
    }

    if (!suiteId || !token) {
      set((state) => ({
        errors: { ...state.errors, quickTests: 'Authentication required' },
      }));
      return [];
    }

    set({ isGeneratingQuick: true, generatedPreviews: [] });

    // Normalize URL
    let url = quickUrl.trim();
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    // Map selection to test types
    // Feature #1972: Smoke test maps to e2e with special steps
    const typeMap: Record<keyof QuickTestSelection, TestType> = {
      smoke: 'e2e', // Smoke test uses e2e type with auto-generated health check steps
      e2e: 'e2e',
      visual: 'visual_regression',
      accessibility: 'accessibility',
      performance: 'lighthouse',
      load: 'load',
    };

    // Create preview entries
    const baseTime = Date.now();
    const previews: GeneratedTestPreview[] = Object.entries(quickTests)
      .filter(([_, selected]) => selected)
      .map(([key], index) => {
        const hostname = new URL(url).hostname;
        const labels: Record<string, string> = {
          e2e: 'E2E Test',
          visual: 'Visual Regression',
          accessibility: 'Accessibility',
          performance: 'Performance',
          load: 'Load Test',
        };
        return {
          id: `preview-${key}-${baseTime}-${index}`,
          type: key,
          name: `${labels[key]} - ${hostname}`,
          targetUrl: url,
          status: 'pending' as const,
        };
      });

    set({ generatedPreviews: previews });

    const results: GeneratedTestPreview[] = [...previews];

    // Create tests one by one
    for (let i = 0; i < previews.length; i++) {
      const preview = previews[i];
      const testType = typeMap[preview.type as keyof typeof typeMap];

      // Update status to creating
      results[i] = { ...results[i], status: 'creating' };
      set({ generatedPreviews: [...results] });

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/suites/${suiteId}/tests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: preview.name,
            description: `Auto-generated ${preview.type} test for ${url}`,
            test_type: testType,  // Fix: backend expects 'test_type' not 'type'
            target_url: url,
            // Default settings for visual tests
            ...(testType === 'visual_regression' && {
              viewport_width: 1920,
              viewport_height: 1080,
              diff_threshold: 0.1,
            }),
            // Default settings for lighthouse
            ...(testType === 'lighthouse' && {
              device_preset: 'desktop',
              performance_threshold: 50,
            }),
            // Default settings for accessibility
            ...(testType === 'accessibility' && {
              wcag_level: 'AA',
            }),
            // Default settings for load test
            ...(testType === 'load' && {
              virtual_users: 10,
              duration: 60,
            }),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create test');
        }

        const data = await response.json();
        results[i] = {
          ...results[i],
          status: 'created',
          createdTestId: data.test.id,
        };
      } catch (err) {
        results[i] = {
          ...results[i],
          status: 'failed',
          error: err instanceof Error ? err.message : 'Creation failed',
        };
      }

      set({ generatedPreviews: [...results] });
    }

    set({ isGeneratingQuick: false });
    return results;
  },

  // Custom Test actions
  setSelectedType: (type: TestType) => {
    set({ selectedType: type });
    // Also update form data type
    set((state) => ({
      formData: { ...state.formData, type },
    }));
  },

  updateFormData: (updates: Partial<TestFormData>) => {
    set((state) => ({
      formData: { ...state.formData, ...updates },
    }));
  },

  setAiInput: (input: string) => {
    set({ aiInput: input });
  },

  createCustomTest: async () => {
    const { formData, suiteId, token, validateCustomTest } = get();

    if (!validateCustomTest()) {
      return null;
    }

    if (!suiteId || !token) {
      set((state) => ({
        errors: { ...state.errors, name: 'Authentication required' },
      }));
      return null;
    }

    set({ isSubmitting: true });

    try {
      // Build request body based on test type
      const body: Record<string, unknown> = {
        name: formData.name,
        description: formData.description,
        test_type: formData.type,  // Fix: backend expects 'test_type' not 'type'
        target_url: formData.targetUrl,
      };

      // Add type-specific fields
      if (formData.type === 'visual_regression') {
        body.viewport_width = formData.viewportWidth;
        body.viewport_height = formData.viewportHeight;
        body.capture_mode = formData.captureMode;
        body.diff_threshold = formData.diffThreshold;
        if (formData.elementSelector) body.element_selector = formData.elementSelector;
        if (formData.waitForSelector) body.wait_for_selector = formData.waitForSelector;
        if (formData.waitTime) body.wait_time = formData.waitTime;
      }

      if (formData.type === 'lighthouse') {
        body.device_preset = formData.devicePreset;
        body.performance_threshold = formData.performanceThreshold;
        if (formData.lcpThreshold) body.lcp_threshold = formData.lcpThreshold;
        if (formData.clsThreshold) body.cls_threshold = formData.clsThreshold;
      }

      if (formData.type === 'accessibility') {
        body.wcag_level = formData.wcagLevel;
        body.include_best_practices = formData.includeBestPractices;
        body.include_experimental = formData.includeExperimental;
      }

      if (formData.type === 'load') {
        body.virtual_users = formData.virtualUsers;
        body.duration = formData.duration;
        body.ramp_up_time = formData.rampUpTime;
        if (formData.k6Script) body.k6_script = formData.k6Script;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/suites/${suiteId}/tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create test');
      }

      const data = await response.json();
      set({ isSubmitting: false });
      return { id: data.test.id, name: data.test.name };
    } catch (err) {
      set({
        isSubmitting: false,
        errors: {
          name: err instanceof Error ? err.message : 'Failed to create test',
        },
      });
      return null;
    }
  },

  // Validation
  validateQuickTest: () => {
    const { quickUrl, quickTests } = get();
    const errors: ValidationErrors = {};

    // Validate URL
    const trimmedUrl = quickUrl.trim();
    if (!trimmedUrl) {
      errors.quickUrl = 'Please enter a URL';
    } else {
      let urlToTest = trimmedUrl;
      if (!urlToTest.startsWith('http')) {
        urlToTest = `https://${urlToTest}`;
      }
      if (!URL_REGEX.test(urlToTest)) {
        errors.quickUrl = 'Please enter a valid URL';
      }
    }

    // Validate at least one test type selected
    const selectedCount = Object.values(quickTests).filter(Boolean).length;
    if (selectedCount === 0) {
      errors.quickTests = 'Please select at least one test type';
    }

    set({ errors });
    return Object.keys(errors).length === 0;
  },

  validateCustomTest: () => {
    const { formData } = get();
    const errors: ValidationErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Test name is required';
    }

    if (!formData.targetUrl.trim()) {
      errors.targetUrl = 'Target URL is required';
    } else if (!URL_REGEX.test(formData.targetUrl)) {
      errors.targetUrl = 'Please enter a valid URL';
    }

    set({ errors });
    return Object.keys(errors).length === 0;
  },

  clearError: (field: string) => {
    set((state) => ({
      errors: { ...state.errors, [field]: undefined },
    }));
  },

  setError: (field: string, message: string) => {
    set((state) => ({
      errors: { ...state.errors, [field]: message },
    }));
  },

  // Batch creation summary helpers
  getCreatedTestsSummary: () => {
    const { generatedPreviews } = get();
    const created = generatedPreviews.filter((p) => p.status === 'created');
    const failed = generatedPreviews.filter((p) => p.status === 'failed');
    const total = generatedPreviews.length;

    return {
      created: created.length,
      failed: failed.length,
      total,
      isComplete: created.length + failed.length === total,
      allSucceeded: created.length === total && total > 0,
      createdTests: created.map((p) => ({
        id: p.createdTestId!,
        name: p.name,
        type: p.type,
      })),
    };
  },

  // Reset
  reset: () => {
    set({
      isOpen: false,
      suiteId: null,
      token: null,
      activeSection: 'quick',
      wizardStep: 'type',
      quickUrl: '',
      quickTests: { ...DEFAULT_QUICK_TESTS },
      generatedPreviews: [],
      selectedType: 'e2e',
      formData: { ...DEFAULT_FORM_DATA },
      aiInput: '',
      isSubmitting: false,
      isGeneratingQuick: false,
      errors: {},
    });
  },

  resetQuickTest: () => {
    set({
      quickUrl: '',
      quickTests: { ...DEFAULT_QUICK_TESTS },
      generatedPreviews: [],
      errors: {},
    });
  },

  resetCustomTest: () => {
    set({
      wizardStep: 'type',
      selectedType: 'e2e',
      formData: { ...DEFAULT_FORM_DATA },
      aiInput: '',
      errors: {},
    });
  },
}));

export default useCreateTest;
