/**
 * NetworkTab Component
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 *
 * Displays network waterfall visualization with HAR export functionality,
 * filtering by request type, search, and sort options.
 */

import React from 'react';
import {
  NetworkRequest,
  WaterfallRequest,
  NetworkStats,
  WaterfallBounds,
  NetworkSortBy,
} from './types';
import { formatBytes, formatDuration } from './utils';

// Network type filter configuration
const NETWORK_TYPE_FILTERS = [
  { id: 'xhr', label: 'XHR', color: 'blue' },
  { id: 'fetch', label: 'Fetch', color: 'indigo' },
  { id: 'script', label: 'JS', color: 'yellow' },
  { id: 'stylesheet', label: 'CSS', color: 'purple' },
  { id: 'image', label: 'Images', color: 'green' },
  { id: 'font', label: 'Fonts', color: 'pink' },
  { id: 'document', label: 'Doc', color: 'orange' },
  { id: 'other', label: 'Other', color: 'gray' },
] as const;

export interface NetworkTabProps {
  // Data
  networkRequests: NetworkRequest[];
  waterfallData: WaterfallRequest[];
  filteredNetworkRequests: WaterfallRequest[];
  networkStats: NetworkStats;
  waterfallBounds: WaterfallBounds;

  // Filter state
  networkTypeFilter: Set<string>;
  networkSearch: string;
  networkSortBy: NetworkSortBy;
  selectedNetworkRequest: number | null;

  // Handlers
  onToggleNetworkType: (type: string) => void;
  onNetworkSearchChange: (search: string) => void;
  onNetworkSortChange: (sort: NetworkSortBy) => void;
  onSelectNetworkRequest: (index: number | null) => void;
  onExportHAR: () => void;

  // Utility function
  getWaterfallPosition: (req: WaterfallRequest) => { left: number; width: number };
}

const NetworkTab: React.FC<NetworkTabProps> = ({
  networkRequests,
  waterfallData,
  filteredNetworkRequests,
  networkStats,
  waterfallBounds,
  networkTypeFilter,
  networkSearch,
  networkSortBy,
  selectedNetworkRequest,
  onToggleNetworkType,
  onNetworkSearchChange,
  onNetworkSortChange,
  onSelectNetworkRequest,
  onExportHAR,
  getWaterfallPosition,
}) => {
  return (
    <div>
      {/* Header with stats and export */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">Network Waterfall</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {networkStats.totalRequests} requests
            </span>
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {formatBytes(networkStats.totalSize)}
            </span>
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {formatDuration(networkStats.totalDuration)}
            </span>
            {networkStats.failedRequests > 0 && (
              <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                {networkStats.failedRequests} failed
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onExportHAR}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          disabled={networkRequests.length === 0}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export HAR
        </button>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
        {/* Type Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Type:</span>
          {NETWORK_TYPE_FILTERS.map(type => (
            <button
              key={type.id}
              onClick={() => onToggleNetworkType(type.id)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                networkTypeFilter.has(type.id)
                  ? `bg-${type.color}-100 dark:bg-${type.color}-900/30 border-${type.color}-300 dark:border-${type.color}-700 text-${type.color}-700 dark:text-${type.color}-400`
                  : 'bg-muted border-border text-muted-foreground line-through'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search URL..."
              value={networkSearch}
              onChange={(e) => onNetworkSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort:</span>
          <select
            value={networkSortBy}
            onChange={(e) => onNetworkSortChange(e.target.value as NetworkSortBy)}
            className="px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
          >
            <option value="time">By Time</option>
            <option value="duration">By Duration</option>
            <option value="size">By Size</option>
          </select>
        </div>
      </div>

      {networkRequests.length === 0 ? (
        <div className="p-12 text-center bg-muted/30 rounded-lg">
          <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <p className="text-lg font-medium text-foreground mb-2">No network requests captured</p>
          <p className="text-muted-foreground">Network activity will appear here when tests are run.</p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Main Waterfall View */}
          <div className={`${selectedNetworkRequest !== null ? 'flex-1' : 'w-full'} border border-border rounded-lg overflow-hidden`}>
            {/* Timeline header */}
            <div className="bg-muted/50 px-4 py-2 border-b border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0ms</span>
                <span>{formatDuration(waterfallBounds.duration / 4)}</span>
                <span>{formatDuration(waterfallBounds.duration / 2)}</span>
                <span>{formatDuration((waterfallBounds.duration * 3) / 4)}</span>
                <span>{formatDuration(waterfallBounds.duration)}</span>
              </div>
            </div>

            {/* Waterfall rows */}
            <div className="max-h-[600px] overflow-auto">
              {filteredNetworkRequests.slice(0, 200).map((req, idx) => {
                const position = getWaterfallPosition(req);
                const isSelected = selectedNetworkRequest === req.index;

                return (
                  <div
                    key={idx}
                    onClick={() => onSelectNetworkRequest(isSelected ? null : req.index)}
                    className={`flex items-stretch border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10' : ''
                    } ${req.failed ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                  >
                    {/* Request info - left side */}
                    <div className="w-1/3 p-2 border-r border-border flex-shrink-0">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Status badge */}
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                          !req.status ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' :
                          req.status >= 200 && req.status < 300 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          req.status >= 300 && req.status < 400 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          req.status >= 400 && req.status < 500 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                          'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          {req.status || 'ERR'}
                        </span>

                        {/* Method */}
                        <span className={`text-xs font-mono font-medium ${
                          req.method === 'GET' ? 'text-green-600 dark:text-green-400' :
                          req.method === 'POST' ? 'text-blue-600 dark:text-blue-400' :
                          req.method === 'PUT' ? 'text-yellow-600 dark:text-yellow-400' :
                          req.method === 'DELETE' ? 'text-red-600 dark:text-red-400' :
                          'text-foreground'
                        }`}>
                          {req.method}
                        </span>

                        {/* Type badge */}
                        <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                          {req.resourceType}
                        </span>
                      </div>

                      {/* URL */}
                      <div className="text-sm text-foreground truncate" title={req.url}>
                        {req.url.split('/').pop() || req.url}
                      </div>

                      {/* Size and duration */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatBytes(req.responseSize || 0)}</span>
                        <span>{req.duration_ms ? `${req.duration_ms}ms` : '-'}</span>
                      </div>
                    </div>

                    {/* Waterfall bar - right side */}
                    <div className="flex-1 p-2 relative min-h-[60px]">
                      {/* Background grid lines */}
                      <div className="absolute inset-0 flex">
                        {[0, 1, 2, 3, 4].map(i => (
                          <div key={i} className="flex-1 border-r border-border/30" />
                        ))}
                      </div>

                      {/* Waterfall bar */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-4 rounded-sm overflow-hidden flex"
                        style={{
                          left: `${position.left}%`,
                          width: `${Math.max(position.width, 1)}%`,
                          minWidth: '4px',
                        }}
                      >
                        {/* Timing breakdown */}
                        {req.timing && (
                          <>
                            <div
                              className="bg-gray-400 h-full"
                              style={{ width: `${((req.timing.dns || 0) / (req.duration_ms || 1)) * 100}%` }}
                              title={`DNS: ${req.timing.dns}ms`}
                            />
                            <div
                              className="bg-orange-400 h-full"
                              style={{ width: `${((req.timing.connect || 0) / (req.duration_ms || 1)) * 100}%` }}
                              title={`Connect: ${req.timing.connect}ms`}
                            />
                            {(req.timing.ssl || 0) > 0 && (
                              <div
                                className="bg-purple-400 h-full"
                                style={{ width: `${((req.timing.ssl || 0) / (req.duration_ms || 1)) * 100}%` }}
                                title={`SSL: ${req.timing.ssl}ms`}
                              />
                            )}
                            <div
                              className="bg-green-400 h-full"
                              style={{ width: `${((req.timing.ttfb || 0) / (req.duration_ms || 1)) * 100}%` }}
                              title={`TTFB: ${req.timing.ttfb}ms`}
                            />
                            <div
                              className="bg-blue-400 h-full"
                              style={{ width: `${((req.timing.download || 0) / (req.duration_ms || 1)) * 100}%` }}
                              title={`Download: ${req.timing.download}ms`}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredNetworkRequests.length > 200 && (
              <div className="p-3 bg-muted/30 text-center text-sm text-muted-foreground border-t border-border">
                Showing first 200 of {filteredNetworkRequests.length} requests
              </div>
            )}
          </div>

          {/* Request Details Panel */}
          {selectedNetworkRequest !== null && (
            <div className="w-80 border border-border rounded-lg overflow-hidden flex-shrink-0">
              <div className="bg-muted/50 p-3 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-foreground">Request Details</h3>
                <button
                  onClick={() => onSelectNetworkRequest(null)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {(() => {
                const req = waterfallData.find(r => r.index === selectedNetworkRequest);
                if (!req) return null;

                return (
                  <div className="p-4 max-h-[500px] overflow-auto space-y-4">
                    {/* General Info */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">General</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Method</span>
                          <span className="font-medium text-foreground">{req.method}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status</span>
                          <span className={`font-medium ${
                            req.status && req.status >= 200 && req.status < 300 ? 'text-green-600' :
                            req.status && req.status >= 400 ? 'text-red-600' : 'text-foreground'
                          }`}>
                            {req.status} {req.statusText}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type</span>
                          <span className="font-medium text-foreground">{req.resourceType}</span>
                        </div>
                      </div>
                    </div>

                    {/* URL */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">URL</h4>
                      <div className="p-2 bg-muted rounded text-xs font-mono break-all text-foreground">
                        {req.url}
                      </div>
                    </div>

                    {/* Size */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Size</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Request</span>
                          <div className="font-medium text-foreground">{formatBytes(req.requestSize || 0)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Response</span>
                          <div className="font-medium text-foreground">{formatBytes(req.responseSize || 0)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Timing Breakdown */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Timing</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-gray-400"></div>
                            <span className="text-muted-foreground">DNS Lookup</span>
                          </div>
                          <span className="font-medium text-foreground">{req.timing?.dns}ms</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-orange-400"></div>
                            <span className="text-muted-foreground">Connect</span>
                          </div>
                          <span className="font-medium text-foreground">{req.timing?.connect}ms</span>
                        </div>
                        {(req.timing?.ssl || 0) > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded bg-purple-400"></div>
                              <span className="text-muted-foreground">SSL</span>
                            </div>
                            <span className="font-medium text-foreground">{req.timing?.ssl}ms</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-green-400"></div>
                            <span className="text-muted-foreground">TTFB</span>
                          </div>
                          <span className="font-medium text-foreground">{req.timing?.ttfb}ms</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-blue-400"></div>
                            <span className="text-muted-foreground">Download</span>
                          </div>
                          <span className="font-medium text-foreground">{req.timing?.download}ms</span>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                          <span className="font-medium text-muted-foreground">Total</span>
                          <span className="font-bold text-foreground">{req.duration_ms}ms</span>
                        </div>
                      </div>
                    </div>

                    {/* Error info if failed */}
                    {req.failed && (
                      <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <h4 className="text-xs font-medium text-red-700 dark:text-red-400 uppercase mb-1">Error</h4>
                        <p className="text-sm text-red-600 dark:text-red-300">
                          {req.failureText || 'Request failed'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-muted-foreground font-medium">Timing Legend:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-400"></div>
            <span className="text-muted-foreground">DNS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-400"></div>
            <span className="text-muted-foreground">Connect</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-purple-400"></div>
            <span className="text-muted-foreground">SSL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-400"></div>
            <span className="text-muted-foreground">TTFB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-400"></div>
            <span className="text-muted-foreground">Download</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="text-sm text-muted-foreground">Total Requests</div>
          <div className="text-2xl font-bold text-foreground">{networkStats.totalRequests}</div>
        </div>
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="text-sm text-muted-foreground">Total Size</div>
          <div className="text-2xl font-bold text-foreground">{formatBytes(networkStats.totalSize)}</div>
        </div>
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="text-sm text-muted-foreground">Load Time</div>
          <div className="text-2xl font-bold text-foreground">{formatDuration(networkStats.totalDuration)}</div>
        </div>
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="text-sm text-muted-foreground">Failed Requests</div>
          <div className={`text-2xl font-bold ${networkStats.failedRequests > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {networkStats.failedRequests}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkTab;
