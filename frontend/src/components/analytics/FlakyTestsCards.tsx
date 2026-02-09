// Feature #515: Extracted from AnalyticsPage.tsx
// Flaky Tests Cards Component

import { useNavigate } from 'react-router-dom';
import type { FlakyTest } from './types';

interface FlakyTestsCardsProps {
  flakyTests: FlakyTest[];
  isLoading: boolean;
}

export function FlakyTestsCards({ flakyTests, isLoading }: FlakyTestsCardsProps) {
  const navigate = useNavigate();

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-foreground mb-4">Flaky Tests</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Tests with inconsistent results (sometimes pass, sometimes fail). These tests need attention to improve reliability.
      </p>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Loading flaky tests...</p>
        </div>
      ) : flakyTests.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground font-medium">No flaky tests detected!</p>
          <p className="text-sm text-muted-foreground mt-2">
            Your tests are running consistently. Keep up the good work!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {flakyTests.slice(0, 5).map((test) => (
            <div
              key={test.test_id}
              className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/tests/${test.test_id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-foreground">{test.test_name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {test.suite_name} / {test.project_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-warning/15 text-warning">
                    Flaky
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    test.flakiness_percentage >= 70 ? 'bg-destructive/15 text-destructive' :
                    test.flakiness_percentage >= 40 ? 'bg-warning/15 text-warning' :
                    'bg-warning/10 text-warning/80'
                  }`}>
                    {test.flakiness_percentage}% flaky
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Runs:</span>
                  <span className="text-sm font-medium text-foreground">{test.total_runs}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Pass Rate:</span>
                  <span className={`text-sm font-medium ${
                    test.pass_rate >= 70 ? 'text-success' :
                    test.pass_rate >= 40 ? 'text-warning' :
                    'text-destructive'
                  }`}>{test.pass_rate}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">{test.pass_count} passed</span>
                  <span className="text-sm text-destructive">{test.fail_count} failed</span>
                </div>
              </div>

              {/* Recommendation */}
              <div className="bg-muted/30 rounded-md p-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Recommendation:</span>{' '}
                  {test.recommendation}
                </p>
              </div>
            </div>
          ))}
          {flakyTests.length > 5 && (
            <div className="text-center">
              <button
                onClick={() => navigate('/flaky-tests')}
                className="text-sm text-primary hover:underline"
              >
                View all {flakyTests.length} flaky tests
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
