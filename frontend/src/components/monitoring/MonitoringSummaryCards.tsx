/**
 * MonitoringSummaryCards Component
 * Feature #47: Extracted from MonitoringPage.tsx
 * Displays summary statistics for monitoring
 */

import React from 'react';
import { MonitoringSummary } from './types';
import { formatUptime } from './utils';

interface MonitoringSummaryCardsProps {
 summary: MonitoringSummary | null;
 isLoading?: boolean;
}

const MonitoringSummaryCards: React.FC<MonitoringSummaryCardsProps> = ({
 summary,
 isLoading = false,
}) => {
 if (isLoading) {
 return (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 {[1, 2, 3, 4].map(i => (
 <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
 <div className="h-4 bg-muted rounded w-20 mb-2" />
 <div className="h-8 bg-muted rounded w-12" />
 </div>
 ))}
 </div>
 );
 }

 if (!summary) {
 return null;
 }

 return (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 {/* Total Checks */}
 <div className="bg-card border border-border rounded-lg p-4">
 <div className="text-sm text-muted-foreground mb-1">Total Checks</div>
 <div className="text-2xl font-bold text-foreground">{summary.total_checks}</div>
 <div className="text-xs text-muted-foreground mt-1">
 {summary.enabled_checks} enabled
 </div>
 </div>

 {/* Up */}
 <div className="bg-green-50 border border-green-200 rounded-lg p-4">
 <div className="text-sm text-green-700 mb-1">Up</div>
 <div className="text-2xl font-bold text-green-600">
 {summary.status_summary.up}
 </div>
 <div className="text-xs text-green-600/70 mt-1">
 services healthy
 </div>
 </div>

 {/* Down */}
 <div className={`rounded-lg p-4 border ${
 summary.status_summary.down > 0
 ? 'bg-red-50 border-red-200'
 : 'bg-card border-border'
 }`}>
 <div className={`text-sm mb-1 ${
 summary.status_summary.down > 0
 ? 'text-red-700'
 : 'text-muted-foreground'
 }`}>
 Down
 </div>
 <div className={`text-2xl font-bold ${
 summary.status_summary.down > 0
 ? 'text-red-600'
 : 'text-foreground'
 }`}>
 {summary.status_summary.down}
 </div>
 <div className={`text-xs mt-1 ${
 summary.status_summary.down > 0
 ? 'text-red-600/70'
 : 'text-muted-foreground'
 }`}>
 services down
 </div>
 </div>

 {/* Uptime */}
 <div className="bg-card border border-border rounded-lg p-4">
 <div className="text-sm text-muted-foreground mb-1">Uptime</div>
 <div className={`text-2xl font-bold ${
 summary.uptime_percentage >= 99.9
 ? 'text-green-600'
 : summary.uptime_percentage >= 99
 ? 'text-amber-600'
 : 'text-red-600'
 }`}>
 {formatUptime(summary.uptime_percentage)}
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 overall uptime
 </div>
 </div>
 </div>
 );
};

export default React.memo(MonitoringSummaryCards);
