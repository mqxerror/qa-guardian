/**
 * SmokeTestSection - Inline smoke test wave visualization
 * Extracted from ProjectDetailPage.tsx for component decomposition (Agent 7)
 * Feature #550: Real-time wave visualization for smoke test
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { WaveProgressCard, type WaveProgressStatus } from '../ui/wave-progress-card';
import { Flame, Globe, FileCheck, CheckCircle2, XCircle } from 'lucide-react';

/** Props matching the return type of the useSmokeTest hook */
export interface SmokeTestSectionProps {
  smokeTest: {
    isRunningQuickSmokeTest: boolean;
    smokeTestResult: 'passed' | 'failed' | null;
    smokeTestCurrentStep: { phase: string; stepIndex: number } | null;
    smokeTestExpandedPhase: string | null;
    setSmokeTestExpandedPhase: (phase: string | null) => void;
    smokeTestTestId: string | null;
    dismissSmokeTestResult: () => void;
  };
}

export function SmokeTestSection({ smokeTest }: SmokeTestSectionProps) {
  // Only render when smoke test is running or has results
  if (!smokeTest.isRunningQuickSmokeTest && !smokeTest.smokeTestResult) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 border-l-4 border-l-warning">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Flame className="h-5 w-5 text-warning" />
          Smoke Test
        </h3>
        {smokeTest.smokeTestResult && (
          <Button
            variant="ghost"
            size="sm"
            onClick={smokeTest.dismissSmokeTestResult}
          >
            Dismiss
          </Button>
        )}
      </div>

      {/* Wave Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Health Check Wave */}
        <WaveProgressCard
          status={
            smokeTest.smokeTestResult === 'passed' ? 'completed' :
            smokeTest.smokeTestResult === 'failed' && smokeTest.smokeTestCurrentStep?.phase !== 'health' ? 'completed' :
            smokeTest.smokeTestResult === 'failed' && smokeTest.smokeTestCurrentStep?.phase === 'health' ? 'failed' :
            smokeTest.smokeTestCurrentStep?.phase === 'health' ? 'running' :
            (smokeTest.smokeTestCurrentStep?.stepIndex || 0) > 0 ? 'completed' :
            'waiting' as WaveProgressStatus
          }
          icon={Globe}
          title="Health Check"
          subtitle="DNS & SSL verification"
          expanded={smokeTest.smokeTestExpandedPhase === 'health'}
          onToggle={() => smokeTest.setSmokeTestExpandedPhase(
            smokeTest.smokeTestExpandedPhase === 'health' ? null : 'health'
          )}
          steps={[
            { name: 'DNS Resolution', status: (smokeTest.smokeTestCurrentStep?.stepIndex || 0) >= 1 || smokeTest.smokeTestResult ? 'completed' : smokeTest.smokeTestCurrentStep?.phase === 'health' ? 'running' : 'pending' },
            { name: 'SSL Certificate', status: (smokeTest.smokeTestCurrentStep?.stepIndex || 0) >= 1 || smokeTest.smokeTestResult ? 'completed' : 'pending' },
          ]}
          animate={smokeTest.smokeTestCurrentStep?.phase === 'health'}
        />

        {/* Page Load Wave */}
        <WaveProgressCard
          status={
            smokeTest.smokeTestResult === 'passed' ? 'completed' :
            smokeTest.smokeTestResult === 'failed' && smokeTest.smokeTestCurrentStep?.phase === 'validation' ? 'completed' :
            smokeTest.smokeTestResult === 'failed' && smokeTest.smokeTestCurrentStep?.phase === 'pageload' ? 'failed' :
            smokeTest.smokeTestCurrentStep?.phase === 'pageload' ? 'running' :
            (smokeTest.smokeTestCurrentStep?.stepIndex || 0) > 1 ? 'completed' :
            'waiting' as WaveProgressStatus
          }
          icon={FileCheck}
          title="Page Load"
          subtitle="HTTP response & timing"
          expanded={smokeTest.smokeTestExpandedPhase === 'pageload'}
          onToggle={() => smokeTest.setSmokeTestExpandedPhase(
            smokeTest.smokeTestExpandedPhase === 'pageload' ? null : 'pageload'
          )}
          steps={[
            { name: 'HTTP Status', status: (smokeTest.smokeTestCurrentStep?.stepIndex || 0) >= 2 || smokeTest.smokeTestResult ? 'completed' : smokeTest.smokeTestCurrentStep?.phase === 'pageload' ? 'running' : 'pending' },
            { name: 'Response Time', status: (smokeTest.smokeTestCurrentStep?.stepIndex || 0) >= 2 || smokeTest.smokeTestResult ? 'completed' : 'pending' },
          ]}
          animate={smokeTest.smokeTestCurrentStep?.phase === 'pageload'}
        />

        {/* Basic Validation Wave */}
        <WaveProgressCard
          status={
            smokeTest.smokeTestResult === 'passed' ? 'completed' :
            smokeTest.smokeTestResult === 'failed' && smokeTest.smokeTestCurrentStep?.phase === 'validation' ? 'failed' :
            smokeTest.smokeTestCurrentStep?.phase === 'validation' ? 'running' :
            'waiting' as WaveProgressStatus
          }
          icon={CheckCircle2}
          title="Validation"
          subtitle="Content & structure checks"
          expanded={smokeTest.smokeTestExpandedPhase === 'validation'}
          onToggle={() => smokeTest.setSmokeTestExpandedPhase(
            smokeTest.smokeTestExpandedPhase === 'validation' ? null : 'validation'
          )}
          steps={[
            { name: 'HTML Structure', status: smokeTest.smokeTestResult ? (smokeTest.smokeTestResult === 'passed' ? 'completed' : 'failed') : smokeTest.smokeTestCurrentStep?.phase === 'validation' ? 'running' : 'pending' },
            { name: 'Console Errors', status: smokeTest.smokeTestResult ? (smokeTest.smokeTestResult === 'passed' ? 'completed' : 'pending') : 'pending' },
          ]}
          animate={smokeTest.smokeTestCurrentStep?.phase === 'validation'}
        />
      </div>

      {/* Results Summary */}
      {smokeTest.smokeTestResult && (
        <div className={`mt-4 p-3 rounded-lg ${
          smokeTest.smokeTestResult === 'passed'
            ? 'bg-success/10 border border-success/20'
            : 'bg-destructive/10 border border-destructive/20'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {smokeTest.smokeTestResult === 'passed' ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span className={`font-medium ${
                smokeTest.smokeTestResult === 'passed' ? 'text-success' : 'text-destructive'
              }`}>
                {smokeTest.smokeTestResult === 'passed'
                  ? 'All checks passed!'
                  : 'Some checks failed'
                }
              </span>
            </div>
            {smokeTest.smokeTestTestId && (
              <Link
                to={`/tests/${smokeTest.smokeTestTestId}`}
                className="text-sm text-primary hover:underline"
              >
                View Details &rarr;
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
