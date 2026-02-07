// AIRouterStats - Extracted from AIRouterPage.tsx for Feature #328
// Stats grid showing router metrics

import type { RouterStats } from './ai-types';

interface AIRouterStatsProps {
  stats: RouterStats | null;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function AIRouterStats({ stats }: AIRouterStatsProps) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <div className="bg-white rounded-lg shadow p-3 text-center">
        <div className="text-2xl font-bold text-blue-600">{formatNumber(stats.total_requests)}</div>
        <div className="text-xs text-gray-600">Total Requests</div>
      </div>
      <div className="bg-white rounded-lg shadow p-3 text-center">
        <div className="text-2xl font-bold text-green-600">{stats.primary_success_rate}%</div>
        <div className="text-xs text-gray-600">Primary Success</div>
      </div>
      <div className="bg-white rounded-lg shadow p-3 text-center">
        <div className="text-2xl font-bold text-amber-600">{formatNumber(stats.fallback_requests)}</div>
        <div className="text-xs text-gray-600">Fallbacks</div>
      </div>
      <div className="bg-white rounded-lg shadow p-3 text-center">
        <div className="text-2xl font-bold text-purple-600">{stats.fallback_success_rate}%</div>
        <div className="text-xs text-gray-600">Fallback Success</div>
      </div>
      <div className="bg-white rounded-lg shadow p-3 text-center">
        <div className="text-2xl font-bold text-cyan-600">{stats.avg_latency_ms}ms</div>
        <div className="text-xs text-gray-600">Avg Latency</div>
      </div>
      <div className="bg-white rounded-lg shadow p-3 text-center">
        <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
        <div className="text-xs text-gray-600">Errors</div>
      </div>
    </div>
  );
}

export default AIRouterStats;
