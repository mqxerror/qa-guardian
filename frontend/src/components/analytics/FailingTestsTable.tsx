// Feature #515: Extracted from AnalyticsPage.tsx
// Most Failing Tests Table Component

import { useNavigate } from 'react-router-dom';
import type { FailingTest } from './types';

interface FailingTestsTableProps {
  failingTests: FailingTest[];
  isLoading: boolean;
}

export function FailingTestsTable({ failingTests, isLoading }: FailingTestsTableProps) {
  const navigate = useNavigate();

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-foreground mb-4">Most Failing Tests</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Tests with the highest failure counts, sorted by number of failures.
      </p>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Loading failing tests...</p>
        </div>
      ) : failingTests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-success/30 bg-gradient-to-br from-success/10 to-success/5 p-12 text-center animate-in fade-in duration-300 relative overflow-hidden">
          {/* Confetti animation */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-bounce"
                style={{
                  left: `${10 + (i * 7)}%`,
                  top: `${Math.random() * 30 + 10}%`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: `${1.5 + Math.random()}s`,
                }}
              >
                <span className="text-lg opacity-60">{['🎉', '✨', '⭐', '🌟'][i % 4]}</span>
              </div>
            ))}
          </div>
          {/* Happy checkmark character */}
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="w-full h-full rounded-full bg-success/20 flex items-center justify-center">
              <svg className="w-12 h-12 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 text-2xl">😊</div>
          </div>
          <h3 className="text-xl font-semibold text-success mb-2">All Tests Passing!</h3>
          <p className="text-success/80 max-w-md mx-auto">
            Your code is looking great. No failing tests found in the selected time period.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Test Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Suite / Project</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-foreground">Failures</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-foreground">Total Runs</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-foreground">Failure Rate</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Last Failure</th>
              </tr>
            </thead>
            <tbody>
              {failingTests.map((test, index) => (
                <tr
                  key={test.test_id}
                  className={`border-t border-border hover:bg-muted/30 cursor-pointer ${
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                  }`}
                  onClick={() => navigate(`/tests/${test.test_id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-foreground hover:text-primary">
                      {test.test_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <span className="text-foreground">{test.suite_name}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-muted-foreground">{test.project_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-sm font-bold text-destructive bg-destructive/15 rounded">
                      {test.failure_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-muted-foreground">{test.total_runs}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-medium ${
                      test.failure_percentage >= 80 ? 'text-destructive' :
                      test.failure_percentage >= 50 ? 'text-warning' :
                      'text-warning'
                    }`}>
                      {test.failure_percentage}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {test.last_failure
                        ? new Date(test.last_failure).toLocaleString()
                        : '-'
                      }
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
