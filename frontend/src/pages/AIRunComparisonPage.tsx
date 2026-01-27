// AIRunComparisonPage - Compare failed test runs with prior successful runs
// Feature #1268: AI Run Comparison Tool
// Extracted from App.tsx for code quality compliance (Feature #1357)
// Feature #1986: Shows demo/mock data - real AI integration coming soon

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';

// Types for Run Comparison
interface RunComparisonFailedRun {
  runId: string;
  testId: string;
  testName: string;
  timestamp: Date;
  duration: number;
  error: string;
  failedStep: number;
  totalSteps: number;
}

interface RunComparisonSuccessfulRun {
  runId: string;
  timestamp: Date;
  duration: number;
  totalSteps: number;
}

interface WhatChangedItem {
  category: 'code' | 'selector' | 'timing' | 'environment';
  description: string;
  severity: 'high' | 'medium' | 'low';
  details: string;
}

interface DivergencePoint {
  step: number;
  action: string;
  successfulResult: string;
  failedResult: string;
  divergenceReason: string;
}

interface LikelyCause {
  summary: string;
  confidence: number;
  evidence: string[];
  suggestedFix: string;
  relatedChanges?: Array<{
    file: string;
    change: string;
    commitHash?: string;
  }>;
}

interface StepComparison {
  stepNumber: number;
  action: string;
  successfulDuration: number;
  failedDuration: number;
  successfulResult: string;
  failedResult: 'passed' | 'failed' | 'skipped';
  isDivergence: boolean;
}

interface RunComparison {
  failedRun: RunComparisonFailedRun;
  successfulRun: RunComparisonSuccessfulRun;
  aiAnalysis: {
    whatChanged: WhatChangedItem[];
    divergencePoint: DivergencePoint;
    likelyCause: LikelyCause;
  };
  stepComparison: StepComparison[];
}

interface PriorRun {
  runId: string;
  timestamp: Date;
  status: 'passed' | 'failed';
  duration: number;
}

export function AIRunComparisonPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [activeTab, setActiveTab] = useState<'changes' | 'divergence' | 'cause'>('changes');
  const [priorRuns, setPriorRuns] = useState<PriorRun[]>([]);
  const [selectedPriorRun, setSelectedPriorRun] = useState<string | null>(null);

  useEffect(() => {
    // Load initial data - failed run and prior successful runs
    const loadRunData = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock prior runs - some passed, some failed
      const mockPriorRuns: PriorRun[] = [
        { runId: 'run_prev_1', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), status: 'passed', duration: 4200 },
        { runId: 'run_prev_2', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), status: 'passed', duration: 4100 },
        { runId: 'run_prev_3', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), status: 'failed', duration: 8500 },
        { runId: 'run_prev_4', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), status: 'passed', duration: 4050 },
        { runId: 'run_prev_5', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), status: 'passed', duration: 4180 },
      ];
      setPriorRuns(mockPriorRuns);
      setIsLoading(false);
    };

    loadRunData();
  }, [runId]);

  const handleCompareWithRun = async (priorRunId: string) => {
    setSelectedPriorRun(priorRunId);
    setIsAnalyzing(true);

    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 2500));

    const mockComparison: RunComparison = {
      failedRun: {
        runId: runId || 'run_current',
        testId: 'test_checkout_123',
        testName: 'Checkout Flow - Complete Purchase',
        timestamp: new Date(),
        duration: 12500,
        error: 'TimeoutError: Waiting for selector ".payment-confirmation" exceeded 30000ms',
        failedStep: 8,
        totalSteps: 10,
      },
      successfulRun: {
        runId: priorRunId,
        timestamp: priorRuns.find(r => r.runId === priorRunId)?.timestamp || new Date(),
        duration: priorRuns.find(r => r.runId === priorRunId)?.duration || 4200,
        totalSteps: 10,
      },
      aiAnalysis: {
        whatChanged: [
          {
            category: 'code',
            description: 'Payment API endpoint changed',
            severity: 'high',
            details: 'The payment processing endpoint was updated from /api/v1/payment to /api/v2/payment. The new endpoint has different response timing.',
          },
          {
            category: 'selector',
            description: 'Confirmation element class renamed',
            severity: 'high',
            details: 'The CSS class ".payment-confirmation" was renamed to ".payment-success-banner" in a recent frontend update.',
          },
          {
            category: 'timing',
            description: 'API response time increased',
            severity: 'medium',
            details: 'The payment API response time increased from ~800ms to ~2400ms, potentially causing timeouts with the current 30s wait.',
          },
          {
            category: 'environment',
            description: 'Test data state changed',
            severity: 'low',
            details: 'The test user account had a payment method removed, requiring additional steps to complete checkout.',
          },
        ],
        divergencePoint: {
          step: 8,
          action: 'waitForSelector(".payment-confirmation")',
          successfulResult: 'Element found in 1.2s, payment confirmation displayed',
          failedResult: 'Timeout after 30s, element never appeared on page',
          divergenceReason: 'The selector ".payment-confirmation" no longer exists in the DOM. The element was renamed to ".payment-success-banner" in commit abc123.',
        },
        likelyCause: {
          summary: 'The test failure is caused by a selector mismatch. The CSS class ".payment-confirmation" was renamed to ".payment-success-banner" in a recent frontend deploy.',
          confidence: 94,
          evidence: [
            'Selector ".payment-confirmation" exists in successful run DOM snapshot',
            'Selector ".payment-confirmation" NOT found in failed run DOM',
            'New selector ".payment-success-banner" found in failed run DOM',
            'Git commit abc123 shows class rename in PaymentConfirmation.tsx',
          ],
          suggestedFix: 'Update the test selector from ".payment-confirmation" to ".payment-success-banner" or use a more stable selector like [data-testid="payment-confirmation"]',
          relatedChanges: [
            { file: 'src/components/PaymentConfirmation.tsx', change: 'Renamed CSS class', commitHash: 'abc123' },
            { file: 'src/styles/checkout.css', change: 'Updated class names for consistency', commitHash: 'abc123' },
          ],
        },
      },
      stepComparison: [
        { stepNumber: 1, action: 'navigate("/checkout")', successfulDuration: 450, failedDuration: 520, successfulResult: 'passed', failedResult: 'passed', isDivergence: false },
        { stepNumber: 2, action: 'fill("#email", "test@example.com")', successfulDuration: 120, failedDuration: 135, successfulResult: 'passed', failedResult: 'passed', isDivergence: false },
        { stepNumber: 3, action: 'fill("#card-number", "4242...")', successfulDuration: 180, failedDuration: 195, successfulResult: 'passed', failedResult: 'passed', isDivergence: false },
        { stepNumber: 4, action: 'fill("#cvv", "123")', successfulDuration: 90, failedDuration: 88, successfulResult: 'passed', failedResult: 'passed', isDivergence: false },
        { stepNumber: 5, action: 'fill("#expiry", "12/28")', successfulDuration: 95, failedDuration: 102, successfulResult: 'passed', failedResult: 'passed', isDivergence: false },
        { stepNumber: 6, action: 'click("#submit-payment")', successfulDuration: 85, failedDuration: 92, successfulResult: 'passed', failedResult: 'passed', isDivergence: false },
        { stepNumber: 7, action: 'waitForResponse("/api/v*/payment")', successfulDuration: 820, failedDuration: 2450, successfulResult: 'passed', failedResult: 'passed', isDivergence: false },
        { stepNumber: 8, action: 'waitForSelector(".payment-confirmation")', successfulDuration: 1200, failedDuration: 30000, successfulResult: 'passed', failedResult: 'failed', isDivergence: true },
        { stepNumber: 9, action: 'expect(text).toContain("Success")', successfulDuration: 50, failedDuration: 0, successfulResult: 'passed', failedResult: 'skipped', isDivergence: false },
        { stepNumber: 10, action: 'screenshot("confirmation")', successfulDuration: 350, failedDuration: 0, successfulResult: 'passed', failedResult: 'skipped', isDivergence: false },
      ],
    };

    setComparison(mockComparison);
    setIsAnalyzing(false);
  };

  const passedPriorRuns = priorRuns.filter(r => r.status === 'passed');

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading test run history...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Feature #1986: Demo Mode Banner */}
        <div className="rounded-lg border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚧</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-amber-800 dark:text-amber-300">Demo Mode - Mock Data</h3>
                <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-medium rounded-full">
                  Coming Soon
                </span>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                This feature demonstrates the AI Run Comparison concept with simulated data.
                Real AI-powered analysis will be available in a future release.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">{'\u2190'}</button>
              <h1 className="text-2xl font-bold text-foreground">{'\u{1F50D}'} AI Run Comparison</h1>
              <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded">
                Failed Run: {runId}
              </span>
            </div>
            <p className="text-muted-foreground mt-1">Compare failed test execution with prior successful runs</p>
          </div>
        </div>

        {/* Prior Runs Selection */}
        {!comparison && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-semibold text-lg text-foreground mb-4">Prior Successful Runs</h2>
            <p className="text-sm text-muted-foreground mb-4">Select a successful run to compare against the current failure</p>

            {passedPriorRuns.length === 0 ? (
              <p className="text-muted-foreground">No prior successful runs found for this test.</p>
            ) : (
              <div className="space-y-3">
                {passedPriorRuns.map((run, index) => (
                  <div key={run.runId} className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">
                        {'\u2713'} Passed
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{run.runId}</p>
                        <p className="text-sm text-muted-foreground">
                          {run.timestamp.toLocaleString()} {'\u2022'} {(run.duration / 1000).toFixed(1)}s
                        </p>
                      </div>
                      {index === 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                          Most Recent
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCompareWithRun(run.runId)}
                      disabled={isAnalyzing}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isAnalyzing && selectedPriorRun === run.runId ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Analyzing...
                        </span>
                      ) : (
                        'Compare with Last Success'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Analysis Results */}
        {comparison && (
          <>
            {/* Run Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-600 dark:text-red-400 text-lg">{'\u274C'}</span>
                  <h3 className="font-semibold text-red-700 dark:text-red-400">Failed Run</h3>
                </div>
                <p className="font-medium text-foreground">{comparison.failedRun.testName}</p>
                <p className="text-sm text-muted-foreground mt-1">{comparison.failedRun.timestamp.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Duration: {(comparison.failedRun.duration / 1000).toFixed(1)}s</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">Failed at step {comparison.failedRun.failedStep}/{comparison.failedRun.totalSteps}</p>
              </div>
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600 dark:text-green-400 text-lg">{'\u2713'}</span>
                  <h3 className="font-semibold text-green-700 dark:text-green-400">Successful Run</h3>
                </div>
                <p className="font-medium text-foreground">{comparison.failedRun.testName}</p>
                <p className="text-sm text-muted-foreground mt-1">{comparison.successfulRun.timestamp.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Duration: {(comparison.successfulRun.duration / 1000).toFixed(1)}s</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">All {comparison.successfulRun.totalSteps} steps passed</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-border">
              <div className="flex gap-4">
                {(['changes', 'divergence', 'cause'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 px-1 font-medium text-sm transition-colors ${
                      activeTab === tab
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab === 'changes' && '\u{1F4CB} What Changed'}
                    {tab === 'divergence' && '\u{1F500} Where Diverged'}
                    {tab === 'cause' && '\u{1F3AF} Likely Cause'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="rounded-lg border border-border bg-card p-6">
              {activeTab === 'changes' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                    <span>{'\u{1F4CB}'}</span> What Changed Between Runs
                  </h3>
                  <div className="space-y-3">
                    {comparison.aiAnalysis.whatChanged.map((change, idx) => (
                      <div key={idx} className={`p-4 rounded-lg border ${
                        change.severity === 'high' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' :
                        change.severity === 'medium' ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10' :
                        'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              change.category === 'code' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                              change.category === 'selector' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                              change.category === 'timing' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                              change.category === 'environment' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                              'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                            }`}>
                              {change.category.toUpperCase()}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              change.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                              change.severity === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                              'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                            }`}>
                              {change.severity} severity
                            </span>
                          </div>
                        </div>
                        <p className="font-medium text-foreground mt-2">{change.description}</p>
                        <p className="text-sm text-muted-foreground mt-1">{change.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'divergence' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                    <span>{'\u{1F500}'}</span> Where Executions Diverged
                  </h3>

                  {/* Divergence Point Highlight */}
                  <div className="p-4 rounded-lg border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{'\u26A0\uFE0F'}</span>
                      <h4 className="font-semibold text-red-700 dark:text-red-400">Divergence Point: Step {comparison.aiAnalysis.divergencePoint.step}</h4>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Action</p>
                        <code className="text-sm px-2 py-1 bg-muted rounded">{comparison.aiAnalysis.divergencePoint.action}</code>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="p-3 rounded border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
                          <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">{'\u2713'} Successful Run Result</p>
                          <p className="text-sm text-foreground">{comparison.aiAnalysis.divergencePoint.successfulResult}</p>
                        </div>
                        <div className="p-3 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
                          <p className="text-xs text-red-700 dark:text-red-400 font-medium mb-1">{'\u274C'} Failed Run Result</p>
                          <p className="text-sm text-foreground">{comparison.aiAnalysis.divergencePoint.failedResult}</p>
                        </div>
                      </div>
                      <div className="mt-4 p-3 rounded bg-muted">
                        <p className="text-xs text-muted-foreground mb-1">AI Analysis</p>
                        <p className="text-sm text-foreground">{comparison.aiAnalysis.divergencePoint.divergenceReason}</p>
                      </div>
                    </div>
                  </div>

                  {/* Step-by-Step Comparison */}
                  <div className="mt-6">
                    <h4 className="font-medium text-foreground mb-3">Step-by-Step Comparison</h4>
                    <div className="space-y-2">
                      {comparison.stepComparison.map((step) => (
                        <div key={step.stepNumber} className={`flex items-center gap-4 p-3 rounded ${
                          step.isDivergence ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-muted/30'
                        }`}>
                          <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium ${
                            step.isDivergence ? 'bg-red-500 text-white' :
                            step.failedResult === 'passed' ? 'bg-green-500 text-white' :
                            'bg-gray-400 text-white'
                          }`}>
                            {step.stepNumber}
                          </span>
                          <div className="flex-1">
                            <code className="text-sm">{step.action}</code>
                          </div>
                          <div className="text-right text-sm">
                            <span className="text-green-600 dark:text-green-400">{step.successfulDuration}ms</span>
                            <span className="text-muted-foreground mx-2">{'\u2192'}</span>
                            <span className={step.failedResult === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
                              {step.failedResult === 'skipped' ? 'skipped' : `${step.failedDuration}ms`}
                            </span>
                          </div>
                          {step.isDivergence && <span className="text-red-600 font-medium">{'\u2190'} DIVERGED</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'cause' && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                    <span>{'\u{1F3AF}'}</span> This is Likely the Cause
                  </h3>

                  {/* Main Cause Card */}
                  <div className="p-6 rounded-lg border-2 border-primary bg-primary/5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-foreground text-lg">Root Cause Analysis</h4>
                      <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm">
                        {comparison.aiAnalysis.likelyCause.confidence}% confidence
                      </span>
                    </div>
                    <p className="text-foreground text-lg leading-relaxed">{comparison.aiAnalysis.likelyCause.summary}</p>

                    {/* Evidence */}
                    <div className="mt-6">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Evidence</p>
                      <ul className="space-y-2">
                        {comparison.aiAnalysis.likelyCause.evidence.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">{'\u2713'}</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Related Changes */}
                    {comparison.aiAnalysis.likelyCause.relatedChanges && (
                      <div className="mt-6">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Related Code Changes</p>
                        <div className="space-y-2">
                          {comparison.aiAnalysis.likelyCause.relatedChanges.map((change, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded bg-muted">
                              <span className="text-blue-600 dark:text-blue-400">{'\u{1F4C4}'}</span>
                              <code className="text-xs">{change.file}</code>
                              <span className="text-muted-foreground">{'\u2022'}</span>
                              <span className="text-foreground">{change.change}</span>
                              {change.commitHash && (
                                <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">{change.commitHash}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested Fix */}
                    <div className="mt-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">{'\u{1F4A1}'} Suggested Fix</p>
                      <p className="text-foreground">{comparison.aiAnalysis.likelyCause.suggestedFix}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-4">
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                      Apply AI Fix
                    </button>
                    <button className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted">
                      View in AI Debugger
                    </button>
                    <button className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted">
                      Create Issue
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Compare with Different Run */}
            <div className="text-center">
              <button
                onClick={() => { setComparison(null); setSelectedPriorRun(null); }}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Compare with a different successful run
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
