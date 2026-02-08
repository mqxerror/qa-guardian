/**
 * SummaryCards Component
 * Feature #46: Extracted from TestRunResultPage.tsx
 * Shows quick stats like total tests, passed, failed, duration
 */

import React from 'react';
import { ResultSummary } from './types';
import { formatDuration, formatDateTime } from './utils';

interface SummaryCardsProps {
 resultSummary: ResultSummary;
 durationMs?: number;
 startedAt?: string;
 completedAt?: string;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({
 resultSummary,
 durationMs,
 startedAt,
 completedAt,
}) => {
 return (
 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
 <div className="bg-muted/50 rounded-lg p-4">
 <div className="text-2xl font-bold text-foreground">{resultSummary.total}</div>
 <div className="text-sm text-muted-foreground">Total Tests</div>
 </div>
 <div className="bg-success/5 rounded-lg p-4">
 <div className="text-2xl font-bold text-success">{resultSummary.passed}</div>
 <div className="text-sm text-success/70">Passed</div>
 </div>
 <div className="bg-destructive/5 rounded-lg p-4">
 <div className="text-2xl font-bold text-destructive">{resultSummary.failed}</div>
 <div className="text-sm text-destructive/70">Failed</div>
 </div>
 <div className="bg-muted/50 rounded-lg p-4">
 <div className="text-2xl font-bold text-foreground">{formatDuration(durationMs)}</div>
 <div className="text-sm text-muted-foreground">Duration</div>
 </div>
 <div className="bg-muted/50 rounded-lg p-4">
 <div className="text-sm font-medium text-foreground">{formatDateTime(startedAt)}</div>
 <div className="text-sm text-muted-foreground">Started</div>
 </div>
 <div className="bg-muted/50 rounded-lg p-4">
 <div className="text-sm font-medium text-foreground">{formatDateTime(completedAt)}</div>
 <div className="text-sm text-muted-foreground">Completed</div>
 </div>
 </div>
 );
};

export default React.memo(SummaryCards);
