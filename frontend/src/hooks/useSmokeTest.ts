// Feature #718: Extract smoke test state from ProjectDetailPage
// Groups 6 useState calls + WebSocket integration for one-click smoke test

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { useSuiteRunSocket, type SuiteRun as SuiteRunSocket } from '../hooks/useSuiteRunSocket';

interface SmokeTestStep {
  phase: 'health' | 'pageload' | 'validation';
  stepIndex: number;
  totalSteps: number;
}

export function useSmokeTest(projectId: string | undefined, baseUrl: string | undefined) {
  const { token } = useAuthStore();

  const [isRunningQuickSmokeTest, setIsRunningQuickSmokeTest] = useState(false);
  const [smokeTestRunId, setSmokeTestRunId] = useState<string | null>(null);
  const [smokeTestTestId, setSmokeTestTestId] = useState<string | null>(null);
  const [smokeTestResult, setSmokeTestResult] = useState<'passed' | 'failed' | null>(null);
  const [smokeTestCurrentStep, setSmokeTestCurrentStep] = useState<SmokeTestStep | null>(null);
  const [smokeTestExpandedPhase, setSmokeTestExpandedPhase] = useState<string | null>(null);

  // WebSocket callbacks
  const handleSmokeTestRunUpdate = useCallback(() => {
    // Update handled by currentStep tracking
  }, []);

  const handleSmokeTestRunComplete = useCallback((completedRun: SuiteRunSocket) => {
    const passed = completedRun.status === 'passed';
    setSmokeTestResult(passed ? 'passed' : 'failed');
    setIsRunningQuickSmokeTest(false);
    setSmokeTestCurrentStep(null);

    if (passed) {
      toast.success('Site Healthy ✅ - All checks passed!', 5000);
    } else {
      toast.error('Issues Found ⚠️ - Some checks failed', 8000);
    }
  }, []);

  const handleSmokeTestScreenshot = useCallback(() => {}, []);
  const handleSmokeTestScreenshotHistory = useCallback(() => {}, []);

  // WebSocket for real-time progress
  const { currentStep: socketCurrentStep } = useSuiteRunSocket({
    runId: smokeTestRunId,
    token,
    onRunUpdate: handleSmokeTestRunUpdate,
    onRunComplete: handleSmokeTestRunComplete,
    onScreenshot: handleSmokeTestScreenshot,
    onScreenshotHistory: handleSmokeTestScreenshotHistory,
    enabled: isRunningQuickSmokeTest && !!smokeTestRunId,
  });

  // Map socket step progress to smoke test phases
  useEffect(() => {
    if (socketCurrentStep && isRunningQuickSmokeTest) {
      const stepIdx = socketCurrentStep.stepIndex;
      const phase: 'health' | 'pageload' | 'validation' =
        stepIdx === 0 ? 'health' : stepIdx === 1 ? 'pageload' : 'validation';
      setSmokeTestCurrentStep({
        phase,
        stepIndex: socketCurrentStep.stepIndex,
        totalSteps: socketCurrentStep.totalSteps,
      });
    }
  }, [socketCurrentStep, isRunningQuickSmokeTest]);

  // Start smoke test handler
  const handleQuickSmokeTest = useCallback(async () => {
    if (!baseUrl) {
      toast.error('No base URL configured for this project. Please set it in Settings.');
      return;
    }

    setIsRunningQuickSmokeTest(true);
    setSmokeTestRunId(null);
    setSmokeTestTestId(null);
    setSmokeTestResult(null);
    setSmokeTestCurrentStep({ phase: 'health', stepIndex: 0, totalSteps: 3 });
    setSmokeTestExpandedPhase(null);

    try {
      const testResponse = await fetch(`/api/v1/projects/${projectId}/quick-smoke-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_url: baseUrl,
        }),
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        throw new Error(errorData.message || 'Failed to run smoke test');
      }

      const testData = await testResponse.json();
      setSmokeTestRunId(testData.run_id);
      setSmokeTestTestId(testData.test_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run smoke test';
      toast.error(message);
      setIsRunningQuickSmokeTest(false);
      setSmokeTestCurrentStep(null);
    }
  }, [baseUrl, projectId, token]);

  // Dismiss result
  const dismissSmokeTestResult = useCallback(() => {
    setSmokeTestResult(null);
    setSmokeTestRunId(null);
    setSmokeTestTestId(null);
    setSmokeTestCurrentStep(null);
  }, []);

  return {
    isRunningQuickSmokeTest,
    smokeTestRunId,
    smokeTestTestId,
    smokeTestResult,
    smokeTestCurrentStep,
    smokeTestExpandedPhase,
    setSmokeTestExpandedPhase,
    handleQuickSmokeTest,
    dismissSmokeTestResult,
  };
}
