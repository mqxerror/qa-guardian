/**
 * useNetworkAnalysisState - Custom hook for network analysis state management
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 *
 * This hook manages:
 * 1. Network waterfall states (waterfallData, networkStats, waterfallBounds)
 * 2. Network filter/sort states (networkSortBy, networkTypeFilter, networkSearch)
 * 3. HAR viewer states
 * 4. Network export functions
 * 5. Selected network request state
 */

import { useState, useMemo, useCallback } from 'react';
import {
  TestRun,
  NetworkRequest,
  WaterfallRequest,
  NetworkStats,
  WaterfallBounds,
  NetworkSortBy,
} from '../components/test-run-results';

// Default network types for filtering
const DEFAULT_NETWORK_TYPES = new Set(['xhr', 'fetch', 'script', 'stylesheet', 'image', 'font', 'document', 'other']);

// Known network resource types for categorization
const KNOWN_NETWORK_TYPES = ['xhr', 'fetch', 'script', 'stylesheet', 'image', 'font', 'document'];

export interface UseNetworkAnalysisStateProps {
  run: TestRun | null;
  runId?: string;
}

export interface UseNetworkAnalysisStateReturn {
  // Raw network requests from run results
  networkRequests: NetworkRequest[];

  // Waterfall data with timing breakdown
  waterfallData: WaterfallRequest[];

  // Filtered and sorted network requests
  filteredNetworkRequests: WaterfallRequest[];

  // Waterfall timeline bounds
  waterfallBounds: WaterfallBounds;

  // Network statistics
  networkStats: NetworkStats;

  // Filter states
  networkTypeFilter: Set<string>;
  networkSearch: string;
  networkSortBy: NetworkSortBy;

  // Selected request state
  selectedNetworkRequest: number | null;

  // Setters
  setNetworkTypeFilter: React.Dispatch<React.SetStateAction<Set<string>>>;
  setNetworkSearch: React.Dispatch<React.SetStateAction<string>>;
  setNetworkSortBy: React.Dispatch<React.SetStateAction<NetworkSortBy>>;
  setSelectedNetworkRequest: React.Dispatch<React.SetStateAction<number | null>>;

  // Helper functions
  toggleNetworkType: (type: string) => void;
  getWaterfallPosition: (req: WaterfallRequest) => { left: number; width: number };
  exportHAR: () => void;
}

export function useNetworkAnalysisState({
  run,
  runId,
}: UseNetworkAnalysisStateProps): UseNetworkAnalysisStateReturn {
  // Filter and sort state
  const [networkTypeFilter, setNetworkTypeFilter] = useState<Set<string>>(new Set(DEFAULT_NETWORK_TYPES));
  const [networkSearch, setNetworkSearch] = useState('');
  const [networkSortBy, setNetworkSortBy] = useState<NetworkSortBy>('time');

  // Selected network request state
  const [selectedNetworkRequest, setSelectedNetworkRequest] = useState<number | null>(null);

  // Get raw network requests from run results
  const networkRequests = useMemo((): NetworkRequest[] => {
    if (!run?.results) return [];
    return run.results.flatMap(r => r.network_requests || []);
  }, [run]);

  // Feature #1840: Network waterfall data with timing breakdown
  const waterfallData = useMemo((): WaterfallRequest[] => {
    if (!run?.results) return [];

    const requests: WaterfallRequest[] = [];
    run.results.forEach(result => {
      (result.network_requests || []).forEach((req, idx) => {
        // Simulate timing breakdown if not available (based on total duration)
        const totalDuration = req.duration_ms || 0;
        const timing = {
          dns: Math.round(totalDuration * 0.05), // 5% DNS
          connect: Math.round(totalDuration * 0.1), // 10% Connect
          ssl: req.url?.startsWith('https') ? Math.round(totalDuration * 0.1) : 0, // 10% SSL if HTTPS
          ttfb: Math.round(totalDuration * 0.4), // 40% TTFB
          download: Math.round(totalDuration * 0.35), // 35% Download
        };

        requests.push({
          index: idx,
          method: req.method,
          url: req.url,
          resourceType: req.resourceType,
          status: req.status,
          statusText: req.statusText,
          duration_ms: req.duration_ms,
          requestSize: req.requestSize,
          responseSize: req.responseSize,
          failed: req.failed,
          failureText: req.failureText,
          timestamp: req.timestamp,
          timing,
        });
      });
    });

    return requests.sort((a, b) => a.timestamp - b.timestamp);
  }, [run]);

  // Feature #1840: Calculate waterfall timeline bounds
  const waterfallBounds = useMemo((): WaterfallBounds => {
    if (waterfallData.length === 0) return { start: 0, end: 0, duration: 0 };

    const startTime = Math.min(...waterfallData.map(r => r.timestamp));
    const endTime = Math.max(...waterfallData.map(r => r.timestamp + (r.duration_ms || 0)));

    return {
      start: startTime,
      end: endTime,
      duration: endTime - startTime,
    };
  }, [waterfallData]);

  // Feature #1840: Network statistics
  const networkStats = useMemo((): NetworkStats => {
    return {
      totalRequests: networkRequests.length,
      totalSize: networkRequests.reduce((sum, r) => sum + (r.responseSize || 0), 0),
      totalDuration: waterfallBounds.duration,
      failedRequests: networkRequests.filter(r => r.failed || (r.status && r.status >= 400)).length,
      byType: networkRequests.reduce((acc, r) => {
        const type = r.resourceType?.toLowerCase() || 'other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [networkRequests, waterfallBounds]);

  // Feature #1840: Filter and sort network requests
  const filteredNetworkRequests = useMemo(() => {
    return waterfallData.filter(req => {
      // Apply type filter
      const type = req.resourceType?.toLowerCase() || 'other';
      const normalizedType = type === 'xmlhttprequest' ? 'xhr' : type;
      if (!networkTypeFilter.has(normalizedType) && !networkTypeFilter.has('other')) {
        // Check if we should show it as 'other'
        if (!KNOWN_NETWORK_TYPES.includes(normalizedType) && !networkTypeFilter.has('other')) {
          return false;
        }
        if (KNOWN_NETWORK_TYPES.includes(normalizedType) && !networkTypeFilter.has(normalizedType)) {
          return false;
        }
      }

      // Apply search filter
      if (networkSearch.trim()) {
        const searchLower = networkSearch.toLowerCase();
        return req.url.toLowerCase().includes(searchLower) ||
          req.method.toLowerCase().includes(searchLower);
      }

      return true;
    }).sort((a, b) => {
      switch (networkSortBy) {
        case 'duration':
          return (b.duration_ms || 0) - (a.duration_ms || 0);
        case 'size':
          return (b.responseSize || 0) - (a.responseSize || 0);
        default:
          return a.timestamp - b.timestamp;
      }
    });
  }, [waterfallData, networkTypeFilter, networkSearch, networkSortBy]);

  // Feature #1840: Toggle network type filter
  const toggleNetworkType = useCallback((type: string) => {
    setNetworkTypeFilter(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Feature #1840: Get waterfall bar position and width
  const getWaterfallPosition = useCallback((req: WaterfallRequest) => {
    if (waterfallBounds.duration === 0) return { left: 0, width: 0 };

    const left = ((req.timestamp - waterfallBounds.start) / waterfallBounds.duration) * 100;
    const width = ((req.duration_ms || 0) / waterfallBounds.duration) * 100;

    return { left: Math.max(0, left), width: Math.max(0.5, width) };
  }, [waterfallBounds]);

  // Feature #1840: Export HAR file
  const exportHAR = useCallback(() => {
    const harData = {
      log: {
        version: '1.2',
        creator: {
          name: 'QA Guardian',
          version: '1.0',
        },
        entries: waterfallData.map(req => ({
          startedDateTime: new Date(req.timestamp).toISOString(),
          time: req.duration_ms || 0,
          request: {
            method: req.method,
            url: req.url,
            httpVersion: 'HTTP/1.1',
            headers: [],
            queryString: [],
            cookies: [],
            headersSize: req.requestSize || -1,
            bodySize: req.requestSize || -1,
          },
          response: {
            status: req.status || 0,
            statusText: req.statusText || '',
            httpVersion: 'HTTP/1.1',
            headers: [],
            cookies: [],
            content: {
              size: req.responseSize || 0,
              mimeType: '',
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: req.responseSize || -1,
          },
          cache: {},
          timings: {
            dns: req.timing?.dns || -1,
            connect: req.timing?.connect || -1,
            ssl: req.timing?.ssl || -1,
            send: 0,
            wait: req.timing?.ttfb || -1,
            receive: req.timing?.download || -1,
          },
        })),
      },
    };

    const blob = new Blob([JSON.stringify(harData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-${runId || 'unknown'}-${Date.now()}.har`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [waterfallData, runId]);

  return {
    // Data
    networkRequests,
    waterfallData,
    filteredNetworkRequests,
    waterfallBounds,
    networkStats,

    // Filter states
    networkTypeFilter,
    networkSearch,
    networkSortBy,

    // Selected request
    selectedNetworkRequest,

    // Setters
    setNetworkTypeFilter,
    setNetworkSearch,
    setNetworkSortBy,
    setSelectedNetworkRequest,

    // Helper functions
    toggleNetworkType,
    getWaterfallPosition,
    exportHAR,
  };
}

export default useNetworkAnalysisState;
