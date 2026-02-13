// Feature #717: Extract modal/panel state from FlakyTestsDashboardPage
// Follows useMonitoringModals pattern: consolidated modal management

import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { logger } from '../utils/logger';
import { type FlakyTest } from './api/useFlakyTests';

// Re-export FlakyTest so existing imports from this file continue to work
export type { FlakyTest };

export interface SuggestionsData {
 test_id: string;
 test_name: string;
 suite_name: string;
 project_name: string;
 analysis: {
   total_runs: number;
   pass_count: number;
   fail_count: number;
   flakiness_score: number;
   flakiness_percentage: number;
   is_retry_flaky: boolean;
   retry_success_rate: number;
   patterns_detected: string[];
 };
 suggestions: Array<{
   id: string;
   category: string;
   priority: 'high' | 'medium' | 'low';
   title: string;
   description: string;
   pattern_matched: string;
   confidence: number;
   code_example?: {
     before: string;
     after: string;
     language: string;
     explanation: string;
   };
   impact: string;
   implementation_steps: string[];
 }>;
 suggestions_count: number;
 high_priority_count: number;
 generated_at: string;
}

export interface AutoQuarantineResult {
 tests_quarantined: number;
 quarantined_tests: Array<{
   test_id: string;
   test_name: string;
   flakiness_score: number;
   quarantined_at: string;
 }>;
}

export function useFlakyTestsModals() {
 const { token } = useAuthStore();

 // Panel visibility
 const [showImpactReport, setShowImpactReport] = useState(true);
 const [showAutoQuarantineSettings, setShowAutoQuarantineSettings] = useState(false);
 const [showRetryStrategySettings, setShowRetryStrategySettings] = useState(false);

 // Auto-quarantine run state
 const [isLoadingAutoQuarantine, setIsLoadingAutoQuarantine] = useState(false);
 const [autoQuarantineResult, setAutoQuarantineResult] = useState<AutoQuarantineResult | null>(null);

 // Suggestions modal state
 const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
 const [selectedTestForSuggestions, setSelectedTestForSuggestions] = useState<string | null>(null);
 const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
 const [suggestions, setSuggestions] = useState<SuggestionsData | null>(null);

 // Flakiness analysis modal state
 const [showFlakinessAnalysisModal, setShowFlakinessAnalysisModal] = useState(false);
 const [selectedTestForAnalysis, setSelectedTestForAnalysis] = useState<FlakyTest | null>(null);
 const [isLoadingFlakinessAnalysis, setIsLoadingFlakinessAnalysis] = useState(false);
 const [flakinessAnalysis, setFlakinessAnalysis] = useState<string | null>(null);
 const [flakinessAnalysisCache, setFlakinessAnalysisCache] = useState<Record<string, { analysis: string; timestamp: number }>>({});

 // Release quarantine modal state
 const [showReleaseConfirmModal, setShowReleaseConfirmModal] = useState(false);
 const [testToRelease, setTestToRelease] = useState<{ test_id: string; test_name: string } | null>(null);
 const [isReleasingFromQuarantine, setIsReleasingFromQuarantine] = useState(false);

 // Handlers
 const openSuggestionsModal = useCallback(async (testId: string) => {
   if (!token) return;
   setSelectedTestForSuggestions(testId);
   setShowSuggestionsModal(true);
   setIsLoadingSuggestions(true);
   setSuggestions(null);

   try {
     const response = await fetch(`/api/v1/ai-insights/flaky-tests/${testId}/suggestions?include_code_examples=true`, {
       headers: { Authorization: `Bearer ${token}` },
     });
     if (response.ok) {
       const data = await response.json();
       setSuggestions(data);
     } else {
       toast.error('Failed to load AI suggestions');
     }
   } catch (error) {
     console.error('Failed to get suggestions:', error);
     toast.error('Failed to load AI suggestions');
   } finally {
     setIsLoadingSuggestions(false);
   }
 }, [token]);

 const openFlakinessAnalysis = useCallback(async (test: FlakyTest) => {
   if (!token) return;

   // Check cache first (24hr TTL)
   const cached = flakinessAnalysisCache[test.test_id];
   if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
     setSelectedTestForAnalysis(test);
     setFlakinessAnalysis(cached.analysis);
     setShowFlakinessAnalysisModal(true);
     logger.ai.debug('Using cached flakiness analysis for:', test.test_name);
     return;
   }

   setSelectedTestForAnalysis(test);
   setShowFlakinessAnalysisModal(true);
   setIsLoadingFlakinessAnalysis(true);
   setFlakinessAnalysis(null);

   const historySummary = {
     test_name: test.test_name,
     suite_name: test.suite_name,
     project_name: test.project_name,
     total_runs: test.total_runs,
     pass_count: test.pass_count,
     fail_count: test.fail_count,
     pass_rate: test.pass_rate,
     flakiness_score: test.flakiness_score,
     is_retry_flaky: test.is_retry_flaky,
     retry_success_rate: test.retry_success_rate,
     has_time_pattern: test.has_time_pattern,
     time_pattern_summary: test.time_pattern_summary,
     peak_failure_hours: test.peak_failure_hours?.slice(0, 3),
     has_environment_pattern: test.has_environment_pattern,
     environment_pattern_summary: test.environment_pattern_summary,
     is_browser_specific: test.is_browser_specific,
     is_os_specific: test.is_os_specific,
     fails_more_on_ci: test.fails_more_on_ci,
     recent_runs: test.recent_runs?.slice(-10).map(r => r.result),
   };

   try {
     const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/mcp-tools/chat`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Authorization: `Bearer ${token}`,
       },
       body: JSON.stringify({
         message: `Analyze why this test is flaky. Identify patterns (time-based, environment-based, data-based) and provide actionable fix suggestions.

Test Data:
${JSON.stringify(historySummary, null, 2)}

Please provide:
1. What patterns indicate this test is flaky
2. Most likely root cause(s)
3. Specific actionable recommendations to fix it
4. Priority: should this be quarantined, fixed, or monitored?`,
         complexity: 'simple',
       }),
     });

     if (response.ok) {
       const data = await response.json();
       const analysis = data.response || data.content || 'No analysis available';
       setFlakinessAnalysis(analysis);
       setFlakinessAnalysisCache(prev => ({
         ...prev,
         [test.test_id]: { analysis, timestamp: Date.now() },
       }));
       logger.ai.debug('Flakiness analysis triggered for:', test.test_name);
     } else {
       toast.error('Failed to analyze flakiness');
       setFlakinessAnalysis('Failed to get AI analysis. Please try again.');
     }
   } catch (error) {
     console.error('Failed to analyze flakiness:', error);
     toast.error('Failed to analyze flakiness');
     setFlakinessAnalysis('Error connecting to AI service. Please try again.');
   } finally {
     setIsLoadingFlakinessAnalysis(false);
   }
 }, [token, flakinessAnalysisCache]);

 const refreshFlakinessAnalysis = useCallback((test: FlakyTest) => {
   setFlakinessAnalysisCache(prev => {
     const next = { ...prev };
     delete next[test.test_id];
     return next;
   });
   openFlakinessAnalysis(test);
 }, [openFlakinessAnalysis]);

 const openReleaseConfirmModal = useCallback((testId: string, testName: string) => {
   setTestToRelease({ test_id: testId, test_name: testName });
   setShowReleaseConfirmModal(true);
 }, []);

 const closeReleaseConfirmModal = useCallback(() => {
   setShowReleaseConfirmModal(false);
   setTestToRelease(null);
 }, []);

 return {
   // Panel visibility
   showImpactReport,
   setShowImpactReport,
   showAutoQuarantineSettings,
   setShowAutoQuarantineSettings,
   showRetryStrategySettings,
   setShowRetryStrategySettings,

   // Auto-quarantine run
   isLoadingAutoQuarantine,
   setIsLoadingAutoQuarantine,
   autoQuarantineResult,
   setAutoQuarantineResult,

   // Suggestions modal
   showSuggestionsModal,
   setShowSuggestionsModal,
   selectedTestForSuggestions,
   isLoadingSuggestions,
   suggestions,
   openSuggestionsModal,

   // Flakiness analysis modal
   showFlakinessAnalysisModal,
   setShowFlakinessAnalysisModal,
   selectedTestForAnalysis,
   isLoadingFlakinessAnalysis,
   flakinessAnalysis,
   flakinessAnalysisCache,
   openFlakinessAnalysis,
   refreshFlakinessAnalysis,

   // Release confirm modal
   showReleaseConfirmModal,
   testToRelease,
   isReleasingFromQuarantine,
   setIsReleasingFromQuarantine,
   openReleaseConfirmModal,
   closeReleaseConfirmModal,
 };
}
