// Feature #515: Extracted from AnalyticsPage.tsx
// Browser-Specific Pass Rates Cards Component

import type { BrowserStats } from './types';

interface BrowserStatsCardsProps {
  browserStats: BrowserStats[];
  isLoading: boolean;
}

// Get browser display name
const getBrowserDisplayName = (browser: string) => {
  switch (browser) {
    case 'chromium': return 'Chrome';
    case 'firefox': return 'Firefox';
    case 'webkit': return 'Safari';
    default: return browser;
  }
};

// Get browser icon
const getBrowserIcon = (browser: string) => {
  switch (browser) {
    case 'chromium': return '🌐';
    case 'firefox': return '🦊';
    case 'webkit': return '🧭';
    default: return '📱';
  }
};

export function BrowserStatsCards({ browserStats, isLoading }: BrowserStatsCardsProps) {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-foreground mb-4">Browser-Specific Pass Rates</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Test results broken down by browser to identify browser-specific issues.
      </p>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Loading browser statistics...</p>
        </div>
      ) : browserStats.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No browser data available.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Run some tests to see browser-specific analytics.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {browserStats.map((stat) => (
            <div
              key={stat.browser}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{getBrowserIcon(stat.browser)}</span>
                <h4 className="text-lg font-semibold text-foreground">
                  {getBrowserDisplayName(stat.browser)}
                </h4>
              </div>

              {/* Pass Rate Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Pass Rate</span>
                  <span className={`font-medium ${
                    stat.pass_rate >= 80 ? 'text-success' :
                    stat.pass_rate >= 50 ? 'text-warning' :
                    'text-destructive'
                  }`}>
                    {stat.pass_rate}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      stat.pass_rate >= 80 ? 'bg-success' :
                      stat.pass_rate >= 50 ? 'bg-warning' :
                      'bg-destructive'
                    }`}
                    style={{ width: `${stat.pass_rate}%` }}
                  />
                </div>
              </div>

              {/* Stats breakdown */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-muted/30 rounded">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-semibold text-foreground">{stat.total_runs}</p>
                </div>
                <div className="p-2 bg-success/15 rounded">
                  <p className="text-xs text-success">Passed</p>
                  <p className="text-sm font-semibold text-success">{stat.passed}</p>
                </div>
                <div className="p-2 bg-destructive/15 rounded">
                  <p className="text-xs text-destructive">Failed</p>
                  <p className="text-sm font-semibold text-destructive">{stat.failed + stat.error}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Export helper functions for use by parent component if needed
export { getBrowserDisplayName, getBrowserIcon };
