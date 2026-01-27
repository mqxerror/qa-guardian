// ============================================================================
// FEATURE #1280: AI Thinking Indicator & Demo Page
// Extracted from App.tsx for code quality compliance (Feature #1357)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';

// Types
interface AIThinkingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  duration?: number;
}

interface AIThinkingIndicatorProps {
  isThinking: boolean;
  steps?: AIThinkingStep[];
  currentStep?: string;
  progress?: number;
  onCancel?: () => void;
}

// AI Thinking Indicator Component
export function AIThinkingIndicator({
  isThinking,
  steps = [],
  currentStep,
  progress,
  onCancel
}: AIThinkingIndicatorProps) {
  const [dots, setDots] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);

  // Animated dots
  useEffect(() => {
    if (!isThinking) {
      setDots('');
      return;
    }
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, [isThinking]);

  // Elapsed time counter
  useEffect(() => {
    if (!isThinking) {
      setElapsedTime(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedTime(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isThinking]);

  if (!isThinking) return null;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Animated Brain Icon */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xl animate-pulse">🧠</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            </div>
          </div>
          <div>
            <p className="font-medium text-foreground">AI is thinking{dots}</p>
            <p className="text-xs text-muted-foreground">Elapsed: {formatTime(elapsedTime)}</p>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm border border-border rounded hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Current Step */}
      {currentStep && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded bg-muted/50">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-foreground">{currentStep}</p>
        </div>
      )}

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps List */}
      {steps.length > 0 && (
        <div className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-2 text-sm ${
                step.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                step.status === 'active' ? 'text-primary' :
                step.status === 'error' ? 'text-red-600 dark:text-red-400' :
                'text-muted-foreground'
              }`}
            >
              {step.status === 'completed' && <span>✓</span>}
              {step.status === 'active' && (
                <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              )}
              {step.status === 'pending' && <span className="w-3 h-3 rounded-full border border-muted-foreground" />}
              {step.status === 'error' && <span>✗</span>}
              <span className={step.status === 'active' ? 'font-medium' : ''}>{step.label}</span>
              {step.duration && step.status === 'completed' && (
                <span className="text-xs text-muted-foreground ml-auto">{step.duration}ms</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact AI Thinking Spinner
export function AIThinkingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-primary">
      <div className="relative">
        <div className="w-5 h-5 rounded-full border-2 border-primary/30" />
        <div className="absolute top-0 left-0 w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
      <span className="text-sm">{message || 'AI is thinking...'}</span>
    </div>
  );
}

// AI Thinking Demo Page
export function AIThinkingDemoPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<AIThinkingStep[]>([]);

  const startAnalysis = () => {
    setIsAnalyzing(true);
    setProgress(0);
    setSteps([
      { id: '1', label: 'Loading test history', status: 'pending' },
      { id: '2', label: 'Analyzing failure patterns', status: 'pending' },
      { id: '3', label: 'Comparing with similar tests', status: 'pending' },
      { id: '4', label: 'Generating recommendations', status: 'pending' },
      { id: '5', label: 'Building confidence score', status: 'pending' },
    ]);

    // Simulate AI processing with step updates
    const stepDurations = [800, 1200, 1500, 1000, 600];
    let currentStepIndex = 0;

    const processStep = () => {
      if (currentStepIndex >= 5) {
        setIsAnalyzing(false);
        setCurrentStep('');
        return;
      }

      // Update current step to active
      setSteps(prev => prev.map((s, i) => ({
        ...s,
        status: i === currentStepIndex ? 'active' : i < currentStepIndex ? 'completed' : 'pending',
        duration: i < currentStepIndex ? stepDurations[i] : undefined
      })));

      const stepMessages = [
        'Loading test history from the last 30 days...',
        'Analyzing failure patterns using ML models...',
        'Comparing with 1,247 similar test cases...',
        'Generating actionable recommendations...',
        'Building confidence score from evidence...'
      ];
      setCurrentStep(stepMessages[currentStepIndex]);
      setProgress((currentStepIndex + 1) * 20);

      setTimeout(() => {
        // Mark current step as completed
        setSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i <= currentStepIndex ? 'completed' : s.status,
          duration: i === currentStepIndex ? stepDurations[i] : s.duration
        })));
        currentStepIndex++;
        processStep();
      }, stepDurations[currentStepIndex]);
    };

    processStep();
  };

  const cancelAnalysis = () => {
    setIsAnalyzing(false);
    setCurrentStep('');
    setProgress(0);
    setSteps([]);
  };

  return (
    <Layout>
      <div className="p-6 space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🧠 AI Thinking Indicator</h1>
          <p className="text-muted-foreground mt-1">Shows when AI is processing and what it's doing</p>
        </div>

        {/* Demo Controls */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold text-lg text-foreground mb-4">Demo Controls</h2>
          <div className="flex gap-3">
            <button
              onClick={startAnalysis}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              Start AI Analysis
            </button>
            <button
              onClick={cancelAnalysis}
              disabled={!isAnalyzing}
              className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Full Thinking Indicator */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold text-lg text-foreground mb-4">Full Thinking Indicator</h2>
          <p className="text-sm text-muted-foreground mb-4">Shows detailed progress with steps and timing</p>

          {isAnalyzing ? (
            <AIThinkingIndicator
              isThinking={isAnalyzing}
              currentStep={currentStep}
              progress={progress}
              steps={steps}
              onCancel={cancelAnalysis}
            />
          ) : (
            <div className="p-4 rounded-lg bg-muted/30 text-center text-muted-foreground">
              Click "Start AI Analysis" to see the thinking indicator in action
            </div>
          )}
        </div>

        {/* Compact Spinner Variants */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold text-lg text-foreground mb-4">Compact Spinner Variants</h2>
          <p className="text-sm text-muted-foreground mb-4">For inline use and smaller spaces</p>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-32">Default:</span>
              <AIThinkingSpinner />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-32">Custom message:</span>
              <AIThinkingSpinner message="Analyzing test results..." />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-32">In button:</span>
              <button className="px-4 py-2 bg-primary/10 text-primary rounded-md flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Processing...
              </button>
            </div>
          </div>
        </div>

        {/* Example Usage in Context */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold text-lg text-foreground mb-4">Example: AI Analysis Card</h2>

          <div className="p-4 rounded-lg border border-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-medium text-foreground">Test Failure Analysis</h3>
                <p className="text-sm text-muted-foreground">checkout-flow.spec.ts:45</p>
              </div>
              {isAnalyzing && (
                <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Analyzing
                </span>
              )}
            </div>

            {isAnalyzing ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-primary">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  {currentStep || 'Starting analysis...'}
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Analysis complete. Click "Start AI Analysis" to see the indicator.
              </div>
            )}
          </div>
        </div>

        {/* Step Updates Explanation */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold text-lg text-foreground mb-4">How It Works</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>The AI thinking indicator provides real-time feedback on what the AI is doing:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Brain animation</strong> - Visual indicator that AI is active</li>
              <li><strong>Elapsed timer</strong> - Shows how long the analysis has been running</li>
              <li><strong>Current step</strong> - Describes what the AI is currently working on</li>
              <li><strong>Progress bar</strong> - Visual representation of overall progress</li>
              <li><strong>Step list</strong> - Detailed breakdown of each processing step with timing</li>
              <li><strong>Cancel button</strong> - Allows user to abort the analysis if needed</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
