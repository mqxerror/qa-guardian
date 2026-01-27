/**
 * useAIParser Hook
 * Feature #1808: AIGenerateStep with useAIParser
 * Feature #1818: AI parser integration with UnifiedAIService
 *
 * Provides real-time parsing of natural language input to detect:
 * - Test type (e2e, visual, accessibility, performance, load)
 * - Target URL
 * - Viewport settings
 * - Confidence score
 *
 * When useAIService option is enabled, enhances local parsing with
 * UnifiedAIService.parseTestIntent() for better accuracy.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { UnifiedAIService, type ParsedTestIntent } from '../../../services/UnifiedAIService';

/**
 * Detected test type
 */
export type DetectedTestType = 'e2e' | 'visual' | 'accessibility' | 'performance' | 'load' | null;

/**
 * Viewport preset
 */
export type ViewportPreset = 'desktop' | 'tablet' | 'mobile' | 'custom';

/**
 * Parsed result from AI parser
 */
export interface ParsedResult {
  testType: DetectedTestType;
  testTypeConfidence: number;
  url: string | null;
  urlConfidence: number;
  viewport: {
    preset: ViewportPreset;
    width: number;
    height: number;
  };
  viewportConfidence: number;
  overallConfidence: number;
  suggestions: string[];
}

/**
 * Parser state
 */
export interface AIParserState {
  input: string;
  isParsing: boolean;
  result: ParsedResult | null;
  error: string | null;
}

/**
 * Default viewport dimensions
 */
const VIEWPORT_PRESETS: Record<ViewportPreset, { width: number; height: number }> = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
  custom: { width: 1280, height: 720 },
};

/**
 * Keywords for test type detection
 */
const TEST_TYPE_KEYWORDS: Record<Exclude<DetectedTestType, null>, string[]> = {
  e2e: ['e2e', 'end-to-end', 'end to end', 'functional', 'user flow', 'workflow', 'click', 'form', 'login', 'submit', 'navigate'],
  visual: ['visual', 'screenshot', 'appearance', 'looks', 'design', 'ui', 'layout', 'style', 'css', 'responsive'],
  accessibility: ['accessibility', 'a11y', 'wcag', 'aria', 'screen reader', 'alt text', 'keyboard', 'contrast', 'accessible'],
  performance: ['performance', 'lighthouse', 'speed', 'core web vitals', 'lcp', 'fcp', 'cls', 'fid', 'load time', 'fast', 'slow'],
  load: ['load', 'stress', 'capacity', 'concurrent', 'users', 'scalability', 'traffic', 'k6', 'benchmark'],
};

/**
 * Viewport keywords
 */
const VIEWPORT_KEYWORDS: Record<ViewportPreset, string[]> = {
  desktop: ['desktop', 'laptop', 'pc', 'computer', 'large screen', '1920', '1080'],
  tablet: ['tablet', 'ipad', '768', '1024', 'medium screen'],
  mobile: ['mobile', 'phone', 'iphone', 'android', 'smartphone', '375', '667', 'small screen', 'responsive'],
  custom: [],
};

/**
 * URL regex pattern
 */
const URL_REGEX = /https?:\/\/[^\s<>"']+/i;
const DOMAIN_REGEX = /\b([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/i;

/**
 * Parse natural language input to extract test configuration
 */
function parseInput(input: string): ParsedResult {
  const lowerInput = input.toLowerCase();
  const suggestions: string[] = [];

  // Detect test type
  let testType: DetectedTestType = null;
  let testTypeConfidence = 0;
  let maxMatches = 0;

  for (const [type, keywords] of Object.entries(TEST_TYPE_KEYWORDS)) {
    const matches = keywords.filter(kw => lowerInput.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      testType = type as DetectedTestType;
      testTypeConfidence = Math.min(0.3 + matches * 0.2, 0.95);
    }
  }

  // Default to e2e if no type detected but input exists
  if (!testType && input.trim().length > 10) {
    testType = 'e2e';
    testTypeConfidence = 0.4;
    suggestions.push('Consider specifying the test type (e.g., "visual test", "accessibility check")');
  }

  // Detect URL
  let url: string | null = null;
  let urlConfidence = 0;

  const urlMatch = input.match(URL_REGEX);
  if (urlMatch) {
    url = urlMatch[0];
    urlConfidence = 0.95;
  } else {
    const domainMatch = input.match(DOMAIN_REGEX);
    if (domainMatch) {
      url = `https://${domainMatch[0]}`;
      urlConfidence = 0.75;
    }
  }

  if (!url && input.trim().length > 0) {
    suggestions.push('Include a target URL (e.g., "https://your-site.com")');
  }

  // Detect viewport
  let viewportPreset: ViewportPreset = 'desktop';
  let viewportConfidence = 0.5; // Default confidence

  for (const [preset, keywords] of Object.entries(VIEWPORT_KEYWORDS)) {
    if (keywords.some(kw => lowerInput.includes(kw))) {
      viewportPreset = preset as ViewportPreset;
      viewportConfidence = 0.85;
      break;
    }
  }

  // Check for custom dimensions
  const dimensionMatch = input.match(/(\d{3,4})\s*[xX×]\s*(\d{3,4})/);
  if (dimensionMatch) {
    viewportPreset = 'custom';
    viewportConfidence = 0.9;
  }

  const viewport = {
    preset: viewportPreset,
    ...(dimensionMatch
      ? { width: parseInt(dimensionMatch[1]), height: parseInt(dimensionMatch[2]) }
      : VIEWPORT_PRESETS[viewportPreset]),
  };

  // Calculate overall confidence
  const confidences = [testTypeConfidence, urlConfidence, viewportConfidence].filter(c => c > 0);
  const overallConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  return {
    testType,
    testTypeConfidence,
    url,
    urlConfidence,
    viewport,
    viewportConfidence,
    overallConfidence,
    suggestions,
  };
}

/**
 * useAIParser hook options
 */
export interface UseAIParserOptions {
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Minimum input length to trigger parsing */
  minInputLength?: number;
  /** Use UnifiedAIService for enhanced parsing (requires API) */
  useAIService?: boolean;
}

/**
 * Convert UnifiedAIService ParsedTestIntent to our ParsedResult format
 */
function convertAIIntentToResult(intent: ParsedTestIntent, localResult: ParsedResult): ParsedResult {
  // Map test types between formats (service uses 'visual', we use 'visual')
  const testTypeMap: Record<string, DetectedTestType> = {
    e2e: 'e2e',
    visual: 'visual',
    accessibility: 'accessibility',
    performance: 'performance',
    load: 'load',
    security: null, // Not supported in create test wizard
  };

  // Use AI service results to enhance local parsing
  const aiTestType = intent.testType ? testTypeMap[intent.testType] : null;
  const aiUrl = intent.targetUrl || null;
  const aiConfidence = intent.confidence;

  // Blend AI results with local parsing results
  // Prefer AI results when they have higher confidence
  return {
    ...localResult,
    testType: aiTestType || localResult.testType,
    testTypeConfidence: aiTestType ? Math.max(aiConfidence, localResult.testTypeConfidence) : localResult.testTypeConfidence,
    url: aiUrl || localResult.url,
    urlConfidence: aiUrl ? Math.max(0.9, localResult.urlConfidence) : localResult.urlConfidence,
    // Recalculate overall confidence as weighted average
    overallConfidence: Math.max(aiConfidence, localResult.overallConfidence),
    // Keep local suggestions but note AI was used
    suggestions: localResult.suggestions.length > 0 ? localResult.suggestions : [],
  };
}

/**
 * useAIParser hook
 * Provides debounced parsing of natural language input
 * Feature #1818: Optionally uses UnifiedAIService for enhanced parsing
 */
export function useAIParser(options: UseAIParserOptions = {}) {
  const { debounceMs = 300, minInputLength = 5, useAIService = false } = options;

  const [state, setState] = useState<AIParserState>({
    input: '',
    isParsing: false,
    result: null,
    error: null,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Set input and trigger parsing
  const setInput = useCallback((input: string) => {
    setState(prev => ({ ...prev, input, isParsing: true }));

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Abort any in-flight AI requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check minimum length
    if (input.trim().length < minInputLength) {
      setState(prev => ({
        ...prev,
        isParsing: false,
        result: null,
        error: null,
      }));
      return;
    }

    // Debounce parsing
    debounceRef.current = setTimeout(async () => {
      try {
        // Always do local parsing first (fast, no network)
        const localResult = parseInput(input);

        // If AI service is enabled, enhance with AI parsing
        if (useAIService) {
          // Create abort controller for this request
          abortControllerRef.current = new AbortController();

          try {
            // Call UnifiedAIService for enhanced parsing
            const aiIntent = await UnifiedAIService.parseTestIntent(input);

            // Check if request was aborted
            if (abortControllerRef.current?.signal.aborted) {
              return;
            }

            // Merge AI results with local parsing
            const enhancedResult = convertAIIntentToResult(aiIntent, localResult);

            setState(prev => ({
              ...prev,
              isParsing: false,
              result: enhancedResult,
              error: null,
            }));
          } catch (aiError) {
            // If AI service fails, fall back to local parsing
            console.warn('[useAIParser] AI service failed, using local parsing:', aiError);
            setState(prev => ({
              ...prev,
              isParsing: false,
              result: localResult,
              error: null,
            }));
          }
        } else {
          // Use local parsing only
          setState(prev => ({
            ...prev,
            isParsing: false,
            result: localResult,
            error: null,
          }));
        }
      } catch (err) {
        setState(prev => ({
          ...prev,
          isParsing: false,
          error: 'Failed to parse input',
        }));
      }
    }, debounceMs);
  }, [debounceMs, minInputLength, useAIService]);

  // Reset parser state
  const reset = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      input: '',
      isParsing: false,
      result: null,
      error: null,
    });
  }, []);

  // Update specific parsed values manually
  const updateResult = useCallback((updates: Partial<ParsedResult>) => {
    setState(prev => ({
      ...prev,
      result: prev.result ? { ...prev.result, ...updates } : null,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    input: state.input,
    isParsing: state.isParsing,
    result: state.result,
    error: state.error,
    setInput,
    reset,
    updateResult,
    isReady: state.result !== null && state.result.overallConfidence > 0.3,
  };
}

export default useAIParser;
