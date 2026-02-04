/**
 * useAccessibilityState Hook
 * Feature #46: Extract accessibility state from TestRunResultPage
 *
 * Manages all accessibility-related state including:
 * - View mode (grouped/list)
 * - Expanded severities and violations
 * - AI analysis state (loading, results, errors)
 */

import { useState, useCallback } from 'react';
import { A11yViewMode } from '../components/test-run-results/types';

/**
 * Accessibility AI analysis result keyed by test name
 */
export type A11yAIResults = Record<string, string>;

/**
 * Return type for useAccessibilityState hook
 */
export interface UseAccessibilityStateReturn {
  // View mode state
  a11yViewMode: A11yViewMode;
  setA11yViewMode: React.Dispatch<React.SetStateAction<A11yViewMode>>;

  // Expanded severities state (critical, serious, moderate, minor)
  a11yExpandedSeverities: Set<string>;
  setA11yExpandedSeverities: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleA11ySeverity: (severity: string) => void;

  // Expanded violations state (by violation ID)
  a11yExpandedViolations: Set<string>;
  setA11yExpandedViolations: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleA11yViolation: (violationId: string) => void;

  // AI analysis state
  a11yAIAnalysisOpen: string | null;
  setA11yAIAnalysisOpen: React.Dispatch<React.SetStateAction<string | null>>;
  a11yAILoading: boolean;
  setA11yAILoading: React.Dispatch<React.SetStateAction<boolean>>;
  a11yAIResult: A11yAIResults;
  setA11yAIResult: React.Dispatch<React.SetStateAction<A11yAIResults>>;
  a11yAIError: string | null;
  setA11yAIError: React.Dispatch<React.SetStateAction<string | null>>;

  // AI analysis function
  analyzeAccessibilityResults: (testName: string, a11y: AccessibilityData, token: string) => Promise<void>;

  // Reset function
  resetAccessibilityState: () => void;
}

/**
 * Accessibility data structure from test results
 */
export interface AccessibilityData {
  violations: Array<{
    id: string;
    impact: string;
    description: string;
    help: string;
    helpUrl: string;
    wcagTags?: string[];
    nodes?: Array<{
      html?: string;
      target?: string[];
      failureSummary?: string;
    }>;
  }>;
  passes: number;
  incomplete?: number;
  inapplicable?: number;
}

/**
 * Initial expanded severities - critical and serious are expanded by default
 */
const DEFAULT_EXPANDED_SEVERITIES = new Set(['critical', 'serious']);

/**
 * Custom hook for managing accessibility testing state
 *
 * @returns Accessibility state and handlers
 */
export function useAccessibilityState(): UseAccessibilityStateReturn {
  // Feature #1838: Accessibility view mode (grouped by severity or flat list)
  const [a11yViewMode, setA11yViewMode] = useState<A11yViewMode>('grouped');

  // Feature #1838: Expanded severity groups (critical and serious expanded by default)
  const [a11yExpandedSeverities, setA11yExpandedSeverities] = useState<Set<string>>(
    new Set(DEFAULT_EXPANDED_SEVERITIES)
  );

  // Feature #1838: Expanded individual violations
  const [a11yExpandedViolations, setA11yExpandedViolations] = useState<Set<string>>(new Set());

  // Feature #1936: AI analysis state
  const [a11yAIAnalysisOpen, setA11yAIAnalysisOpen] = useState<string | null>(null);
  const [a11yAILoading, setA11yAILoading] = useState(false);
  const [a11yAIResult, setA11yAIResult] = useState<A11yAIResults>({});
  const [a11yAIError, setA11yAIError] = useState<string | null>(null);

  /**
   * Toggle expansion of a severity group
   */
  const toggleA11ySeverity = useCallback((severity: string) => {
    setA11yExpandedSeverities(prev => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  }, []);

  /**
   * Toggle expansion of an individual violation
   */
  const toggleA11yViolation = useCallback((violationId: string) => {
    setA11yExpandedViolations(prev => {
      const next = new Set(prev);
      if (next.has(violationId)) {
        next.delete(violationId);
      } else {
        next.add(violationId);
      }
      return next;
    });
  }, []);

  /**
   * Feature #1936: AI analysis for accessibility violations with fix examples
   */
  const analyzeAccessibilityResults = useCallback(async (
    testName: string,
    a11y: AccessibilityData,
    token: string
  ) => {
    if (!token || !a11y) return;

    setA11yAILoading(true);
    setA11yAIError(null);
    setA11yAIAnalysisOpen(testName);

    // Format violations for AI
    const violationsSummary = a11y.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      wcagTags: v.wcagTags,
      affectedElements: v.nodes?.slice(0, 3).map((n) => ({
        html: n.html?.slice(0, 200),
        target: n.target,
        failureSummary: n.failureSummary,
      })),
    }));

    const prompt = `Analyze these accessibility violations and provide detailed, actionable fixes.

**Test: ${testName}**
**Total Violations: ${a11y.violations.length}**
**Passed Rules: ${a11y.passes}**

**Violations:**
${JSON.stringify(violationsSummary, null, 2)}

Please provide:
1. **Plain English Summary**: Explain each violation so a non-technical person can understand
2. **Real-World Impact**: Describe how each issue affects users with disabilities (e.g., "Screen reader users cannot navigate this form", "Color-blind users won't see the error message")
3. **Priority Order**: List fixes by severity - CRITICAL first, then SERIOUS, MODERATE, MINOR
4. **Code Fixes**: For each violation, provide:
   - BEFORE: The problematic code
   - AFTER: The corrected code
   - EXPLANATION: Why this fix works
5. **Quick Wins**: Easy fixes that take less than 5 minutes
6. **WCAG Compliance**: Which WCAG guidelines are violated and what level (A, AA, AAA)

Format your response with clear sections using **bold headers** and code blocks for HTML examples.`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch('/api/v1/mcp/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: prompt, context: [] }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.result?.response || data.response || data.message || 'No analysis available';

      setA11yAIResult(prev => ({ ...prev, [testName]: analysis }));
    } catch (err) {
      let errorMsg = err instanceof Error ? err.message : 'Failed to analyze accessibility';
      if (errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
        errorMsg = 'Accessibility analysis timed out. Please try again.';
      }
      setA11yAIError(errorMsg);
    } finally {
      setA11yAILoading(false);
    }
  }, []);

  /**
   * Reset all accessibility state to initial values
   */
  const resetAccessibilityState = useCallback(() => {
    setA11yViewMode('grouped');
    setA11yExpandedSeverities(new Set(DEFAULT_EXPANDED_SEVERITIES));
    setA11yExpandedViolations(new Set());
    setA11yAIAnalysisOpen(null);
    setA11yAILoading(false);
    setA11yAIResult({});
    setA11yAIError(null);
  }, []);

  return {
    // View mode
    a11yViewMode,
    setA11yViewMode,

    // Expanded severities
    a11yExpandedSeverities,
    setA11yExpandedSeverities,
    toggleA11ySeverity,

    // Expanded violations
    a11yExpandedViolations,
    setA11yExpandedViolations,
    toggleA11yViolation,

    // AI analysis state
    a11yAIAnalysisOpen,
    setA11yAIAnalysisOpen,
    a11yAILoading,
    setA11yAILoading,
    a11yAIResult,
    setA11yAIResult,
    a11yAIError,
    setA11yAIError,

    // Functions
    analyzeAccessibilityResults,
    resetAccessibilityState,
  };
}

export default useAccessibilityState;
