/**
 * Shared hooks for Create Test Modal components
 * Feature #1786: Component extraction from TestSuitePage
 * Feature #1767: Connect Create Test modal to UnifiedAIService
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { TestFormData, DEFAULT_FORM_DATA, AICopilotSuggestion, TestType, VIEWPORT_PRESETS, ViewportPreset } from './types';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://qa.pixelcraftedmedia.com';

/**
 * Extract URL from natural language text
 */
export function extractUrlFromText(text: string): string | null {
  if (!text) return null;

  // Try to match full URLs first
  const fullUrlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  if (fullUrlMatch) {
    return fullUrlMatch[0].replace(/[.,;:!?)]+$/, '');
  }

  // Try to match domain patterns
  const domainMatch = text.match(
    /(?:^|\s)((?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|org|net|io|co|pa|dev|app|ai|me|us|uk|de|fr|es|it|nl|be|ch|at|au|nz|jp|kr|cn|in|br|mx|ar|cl|ru|pl|se|no|dk|fi|pt|gr|cz|hu|ro|bg|hr|sk|si|lt|lv|ee|is|ie|lu|mt|cy)[^\s<>"']*)(?:\s|$)/i
  );
  if (domainMatch) {
    const domain = domainMatch[1].replace(/[.,;:!?)]+$/, '');
    return `https://${domain}`;
  }

  return null;
}

/**
 * Extract test type from natural language description
 */
export function extractTestTypeFromText(text: string): TestType | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Visual/screenshot patterns
  if (
    lower.includes('visual') ||
    lower.includes('screenshot') ||
    lower.includes('snapshot') ||
    lower.includes('appearance') ||
    lower.includes('look') ||
    lower.includes('ui regression') ||
    lower.includes('regression test')
  ) {
    return 'visual_regression';
  }

  // Performance/lighthouse patterns
  if (
    lower.includes('performance') ||
    lower.includes('lighthouse') ||
    lower.includes('speed') ||
    lower.includes('core web vitals') ||
    lower.includes('lcp') ||
    lower.includes('cls') ||
    lower.includes('page speed')
  ) {
    return 'lighthouse';
  }

  // Load testing patterns
  if (
    lower.includes('load') ||
    lower.includes('stress') ||
    lower.includes('k6') ||
    lower.includes('concurrent') ||
    lower.includes('virtual users') ||
    lower.includes('scalability')
  ) {
    return 'load';
  }

  // Accessibility patterns
  if (
    lower.includes('accessibility') ||
    lower.includes('a11y') ||
    lower.includes('wcag') ||
    lower.includes('screen reader') ||
    lower.includes('aria')
  ) {
    return 'accessibility';
  }

  // E2E patterns (default if mentioned)
  if (
    lower.includes('e2e') ||
    lower.includes('end to end') ||
    lower.includes('end-to-end') ||
    lower.includes('functional') ||
    lower.includes('flow') ||
    lower.includes('user journey')
  ) {
    return 'e2e';
  }

  return null;
}

/**
 * Extract viewport from natural language text
 */
export function extractViewportFromText(
  text: string
): { width: number; height: number; preset: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  if (lower.includes('mobile') || lower.includes('phone') || lower.includes('iphone')) {
    return { ...VIEWPORT_PRESETS.mobile, preset: 'mobile' };
  }
  if (lower.includes('tablet') || lower.includes('ipad')) {
    return { ...VIEWPORT_PRESETS.tablet, preset: 'tablet' };
  }
  if (lower.includes('desktop') || lower.includes('laptop') || lower.includes('computer')) {
    return { ...VIEWPORT_PRESETS.desktop, preset: 'desktop' };
  }

  return null;
}

/**
 * Hook for managing test form state
 */
export function useTestFormState(initialData: Partial<TestFormData> = {}) {
  const [formData, setFormData] = useState<TestFormData>({
    ...DEFAULT_FORM_DATA,
    ...initialData,
  });

  const updateField = useCallback(<K extends keyof TestFormData>(
    field: K,
    value: TestFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateFields = useCallback((updates: Partial<TestFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({ ...DEFAULT_FORM_DATA, ...initialData });
  }, [initialData]);

  return {
    formData,
    updateField,
    updateFields,
    resetForm,
    setFormData,
  };
}

/**
 * Hook for AI Copilot suggestions
 */
export function useAICopilot(
  formData: TestFormData,
  isEnabled: boolean,
  token?: string
) {
  const [suggestions, setSuggestions] = useState<AICopilotSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeSuggestions = useCallback(async () => {
    if (!isEnabled || !token) return;

    // Clear suggestions if form is empty
    if (!formData.name && !formData.description && !formData.targetUrl) {
      setSuggestions([]);
      return;
    }

    setIsAnalyzing(true);
    try {
      // Analyze description for type, URL, viewport
      const newSuggestions: AICopilotSuggestion[] = [];

      // Analyze combined text
      const combinedText = `${formData.name} ${formData.description}`;

      // Check for test type suggestion
      const detectedType = extractTestTypeFromText(combinedText);
      if (detectedType && detectedType !== formData.type) {
        newSuggestions.push({
          field: 'type',
          value: detectedType,
          reason: `Description suggests this is a ${detectedType.replace('_', ' ')} test`,
          confidence: 0.8,
        });
      }

      // Check for URL suggestion
      const detectedUrl = extractUrlFromText(combinedText);
      if (detectedUrl && !formData.targetUrl) {
        newSuggestions.push({
          field: 'targetUrl',
          value: detectedUrl,
          reason: `URL detected: ${detectedUrl}`,
          confidence: 0.9,
        });
      }

      // Check for viewport suggestion (only for visual tests)
      if (formData.type === 'visual_regression') {
        const detectedViewport = extractViewportFromText(combinedText);
        if (detectedViewport && detectedViewport.preset !== formData.viewportPreset) {
          newSuggestions.push({
            field: 'viewportPreset',
            value: detectedViewport.preset,
            reason: `Description mentions ${detectedViewport.preset} viewport`,
            confidence: 0.85,
          });
        }
      }

      setSuggestions(newSuggestions);
    } finally {
      setIsAnalyzing(false);
    }
  }, [formData, isEnabled, token]);

  const applySuggestion = useCallback((suggestion: AICopilotSuggestion) => {
    setSuggestions((prev) => prev.filter((s) => s.field !== suggestion.field));
    return { [suggestion.field]: suggestion.value };
  }, []);

  const dismissSuggestion = useCallback((field: string) => {
    setSuggestions((prev) => prev.filter((s) => s.field !== field));
  }, []);

  return {
    suggestions,
    isAnalyzing,
    analyzeSuggestions,
    applySuggestion,
    dismissSuggestion,
  };
}

/**
 * Hook for AI-powered intent parsing using UnifiedAIService
 * Feature #1767: Connect Create Test modal to UnifiedAIService
 *
 * This hook debounces input changes and calls the parse-intent API
 * to auto-fill form fields based on natural language description
 */
export function useAIIntentParsing(
  onIntentParsed: (intent: ParsedIntent) => void,
  debounceMs: number = 500
) {
  const [isParsing, setIsParsing] = useState(false);
  const [lastParsedText, setLastParsedText] = useState<string>('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const parseIntent = useCallback(
    async (text: string) => {
      // Don't re-parse the same text
      if (text === lastParsedText || text.length < 3) {
        return;
      }

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set a new debounced call
      debounceTimerRef.current = setTimeout(async () => {
        setIsParsing(true);
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/ai/parse-intent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.intent) {
              setLastParsedText(text);
              onIntentParsed(data.intent);
            }
          }
        } catch (error) {
          console.error('Failed to parse intent:', error);
        } finally {
          setIsParsing(false);
        }
      }, debounceMs);
    },
    [debounceMs, lastParsedText, onIntentParsed]
  );

  const reset = useCallback(() => {
    setLastParsedText('');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    parseIntent,
    isParsing,
    reset,
  };
}

/**
 * Parsed intent from the AI parse-intent API
 */
export interface ParsedIntent {
  action: 'create' | 'run' | 'analyze' | 'generate' | 'unknown';
  testType?: 'e2e' | 'visual' | 'accessibility' | 'performance' | 'load' | 'security';
  targetUrl?: string;
  viewport?: { width: number; height: number };
  testName?: string;
  parameters?: Record<string, unknown>;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  suggestions: string[];
  originalText: string;
}

/**
 * Map API test types to form test types
 */
function mapTestTypeToFormType(apiType: string | undefined): TestType | undefined {
  if (!apiType) return undefined;
  const typeMap: Record<string, TestType> = {
    e2e: 'e2e',
    visual: 'visual_regression',
    accessibility: 'accessibility',
    performance: 'lighthouse',
    load: 'load',
    security: 'e2e', // Map security to e2e as there's no dedicated security type
  };
  return typeMap[apiType];
}

/**
 * Map viewport dimensions to preset name
 */
function getViewportPreset(
  viewport: { width: number; height: number } | undefined
): ViewportPreset | undefined {
  if (!viewport) return undefined;
  if (viewport.width === 375) return 'mobile';
  if (viewport.width === 768) return 'tablet';
  if (viewport.width === 1280) return 'laptop';
  if (viewport.width === 1920) return 'desktop';
  return 'custom';
}

/**
 * Hook for enhanced AI Copilot with intent parsing
 * Feature #1767: Connect Create Test modal to UnifiedAIService
 */
export function useEnhancedAICopilot(
  formData: TestFormData,
  updateFields: (updates: Partial<TestFormData>) => void,
  isEnabled: boolean,
  token?: string
) {
  const [suggestions, setSuggestions] = useState<AICopilotSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

  // Handle parsed intent from AI
  const handleIntentParsed = useCallback(
    (intent: ParsedIntent) => {
      if (!isEnabled) return;

      const newSuggestions: AICopilotSuggestion[] = [];
      const autoFillUpdates: Partial<TestFormData> = {};
      const fieldsToMark: string[] = [];

      // Auto-fill test type if not already set and confidence is high
      const mappedType = mapTestTypeToFormType(intent.testType);
      if (mappedType && formData.type === 'e2e' && mappedType !== 'e2e' && intent.confidence >= 0.6) {
        autoFillUpdates.type = mappedType;
        fieldsToMark.push('type');
        newSuggestions.push({
          field: 'type',
          value: mappedType,
          reason: `AI detected ${intent.testType} test type`,
          confidence: intent.confidence,
        });
      }

      // Auto-fill target URL if detected and not already set
      if (intent.targetUrl && !formData.targetUrl) {
        autoFillUpdates.targetUrl = intent.targetUrl;
        fieldsToMark.push('targetUrl');
        newSuggestions.push({
          field: 'targetUrl',
          value: intent.targetUrl,
          reason: 'URL extracted from description',
          confidence: 0.95,
        });
      }

      // Auto-fill viewport if detected (for visual tests)
      if (intent.viewport && formData.type === 'visual_regression') {
        const presetName = getViewportPreset(intent.viewport);
        if (presetName && presetName !== formData.viewportPreset) {
          autoFillUpdates.viewportWidth = intent.viewport.width;
          autoFillUpdates.viewportHeight = intent.viewport.height;
          autoFillUpdates.viewportPreset = presetName;
          fieldsToMark.push('viewport');
          newSuggestions.push({
            field: 'viewportPreset',
            value: presetName,
            reason: `AI detected ${presetName} viewport`,
            confidence: 0.85,
          });
        }
      }

      // Auto-fill test name if detected and current name looks auto-generated
      if (intent.testName && intent.testName !== formData.name) {
        const isDefaultName = !formData.name ||
          formData.name.startsWith('New ') ||
          formData.name === 'Untitled Test';
        if (isDefaultName) {
          autoFillUpdates.name = intent.testName;
          fieldsToMark.push('name');
        } else {
          // Just suggest, don't auto-fill if user has typed something
          newSuggestions.push({
            field: 'name',
            value: intent.testName,
            reason: 'AI-suggested test name',
            confidence: 0.7,
          });
        }
      }

      // Apply auto-fill updates
      if (Object.keys(autoFillUpdates).length > 0) {
        updateFields(autoFillUpdates);
        setAutoFilledFields(prev => {
          const next = new Set(prev);
          fieldsToMark.forEach(f => next.add(f));
          return next;
        });
      }

      // Update suggestions
      setSuggestions(newSuggestions);
    },
    [isEnabled, formData.type, formData.targetUrl, formData.name, formData.viewportPreset, updateFields]
  );

  // Use the intent parsing hook
  const { parseIntent, isParsing, reset: resetParsing } = useAIIntentParsing(
    handleIntentParsed,
    600 // 600ms debounce
  );

  // Trigger parsing when description changes
  const onDescriptionChange = useCallback(
    (description: string) => {
      if (isEnabled && description.length >= 5) {
        parseIntent(description);
      }
    },
    [isEnabled, parseIntent]
  );

  // Combined analyzing state
  useEffect(() => {
    setIsAnalyzing(isParsing);
  }, [isParsing]);

  const applySuggestion = useCallback(
    (suggestion: AICopilotSuggestion) => {
      setSuggestions(prev => prev.filter(s => s.field !== suggestion.field));
      return { [suggestion.field]: suggestion.value };
    },
    []
  );

  const dismissSuggestion = useCallback((field: string) => {
    setSuggestions(prev => prev.filter(s => s.field !== field));
  }, []);

  const resetAutoFill = useCallback(() => {
    setAutoFilledFields(new Set());
    setSuggestions([]);
    resetParsing();
  }, [resetParsing]);

  return {
    suggestions,
    isAnalyzing,
    autoFilledFields,
    onDescriptionChange,
    applySuggestion,
    dismissSuggestion,
    resetAutoFill,
  };
}

/**
 * Hook for test creation API call
 */
export function useTestCreation(suiteId: string, token?: string) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTest = useCallback(
    async (formData: TestFormData, playwrightCode?: string) => {
      if (!token) {
        setError('Authentication required');
        return null;
      }

      setIsCreating(true);
      setError(null);

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
          if (formData.hideSelectors) body.hide_selectors = formData.hideSelectors;
          if (formData.removeSelectors) body.remove_selectors = formData.removeSelectors;
        }

        if (formData.type === 'lighthouse') {
          body.device_preset = formData.devicePreset;
          body.performance_threshold = formData.performanceThreshold;
          if (formData.lcpThreshold) body.lcp_threshold = formData.lcpThreshold;
          if (formData.clsThreshold) body.cls_threshold = formData.clsThreshold;
          body.bypass_csp = formData.bypassCsp;
          body.ignore_ssl_errors = formData.ignoreSslErrors;
          body.audit_timeout = formData.auditTimeout;
        }

        if (formData.type === 'accessibility') {
          body.wcag_level = formData.wcagLevel;
          body.include_best_practices = formData.includeBestPractices;
          body.include_experimental = formData.includeExperimental;
          body.include_pa11y = formData.includePa11y;
          if (formData.a11yFailOnCritical !== undefined) body.fail_on_critical = formData.a11yFailOnCritical;
          if (formData.a11yFailOnSerious !== undefined) body.fail_on_serious = formData.a11yFailOnSerious;
        }

        if (formData.type === 'load') {
          body.virtual_users = formData.virtualUsers;
          body.duration = formData.duration;
          body.ramp_up_time = formData.rampUpTime;
          if (formData.k6Script) body.k6_script = formData.k6Script;
        }

        // Add Playwright code if provided
        if (playwrightCode) {
          body.playwright_code = playwrightCode;
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/suites/${suiteId}/tests`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to create test');
        }

        const data = await response.json();
        return data.test;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create test';
        setError(message);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [suiteId, token]
  );

  return {
    createTest,
    isCreating,
    error,
    clearError: () => setError(null),
  };
}
