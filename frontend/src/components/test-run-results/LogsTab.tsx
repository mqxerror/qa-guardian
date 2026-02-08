/**
 * LogsTab Component
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 * Feature #113: Added virtual scrolling for large log lists
 *
 * Displays unified console logs and network requests with filtering,
 * searching, and export capabilities.
 */

import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ConsoleLog, NetworkRequest, LogsViewMode, LogsFilter, LogsExportFormat } from './types';

// Unified log entry interface for combining console logs and network requests
export interface UnifiedLogEntry {
 type: 'console' | 'network';
 timestamp: number;
 level?: 'log' | 'info' | 'warn' | 'error' | 'debug';
 message: string;
 location?: string;
 // Network-specific
 method?: string;
 url?: string;
 status?: number;
 duration_ms?: number;
 requestSize?: number;
 responseSize?: number;
 failed?: boolean;
 failureText?: string;
 resourceType?: string;
 requestBody?: string;
 responseBody?: string;
 originalIndex?: number;
}

// Log counts interface
export interface LogCounts {
 total: number;
 errors: number;
 warnings: number;
 info: number;
 debug: number;
 network: number;
 failedRequests: number;
}

export interface LogsTabProps {
 // Data
 consoleLogs: ConsoleLog[];
 networkRequests: NetworkRequest[];
 runId: string;

 // View mode state
 logsViewMode: LogsViewMode;
 setLogsViewMode: (mode: LogsViewMode) => void;

 // Filter state
 logsFilter: LogsFilter;
 setLogsFilter: React.Dispatch<React.SetStateAction<LogsFilter>>;

 // Search state
 logsSearch: string;
 setLogsSearch: (search: string) => void;

 // Expanded network items state
 expandedNetworkItems: Set<number>;
 toggleNetworkItem: (index: number) => void;

 // Expanded logs state
 expandedLogs: boolean;
 setExpandedLogs: (expanded: boolean) => void;

 // Export format state
 logsExportFormat: LogsExportFormat;
 setLogsExportFormat: (format: LogsExportFormat) => void;
}

export default function LogsTab({
 consoleLogs,
 networkRequests,
 runId,
 logsViewMode,
 setLogsViewMode,
 logsFilter,
 setLogsFilter,
 logsSearch,
 setLogsSearch,
 expandedNetworkItems,
 toggleNetworkItem,
 expandedLogs,
 setExpandedLogs,
 logsExportFormat,
 setLogsExportFormat,
}: LogsTabProps) {

 // Create unified log entries from console logs and network requests
 const getUnifiedLogs = useMemo((): UnifiedLogEntry[] => {
 const entries: UnifiedLogEntry[] = [];

 // Add console logs
 consoleLogs.forEach(log => {
 entries.push({
 type: 'console',
 timestamp: log.timestamp,
 level: log.level,
 message: log.message,
 location: log.location,
 });
 });

 // Add network requests
 networkRequests.forEach((req, idx) => {
 const statusLevel = !req.status ? 'warn' :
 req.status >= 400 ? 'error' :
 req.status >= 300 ? 'warn' : 'info';

 entries.push({
 type: 'network',
 timestamp: req.timestamp,
 level: statusLevel as 'info' | 'warn' | 'error',
 message: `${req.method} ${req.url}`,
 method: req.method,
 url: req.url,
 status: req.status,
 duration_ms: req.duration_ms,
 requestSize: req.requestSize,
 responseSize: req.responseSize,
 failed: req.failed,
 failureText: req.failureText,
 resourceType: req.resourceType,
 originalIndex: idx,
 });
 });

 // Sort by timestamp
 return entries.sort((a, b) => a.timestamp - b.timestamp);
 }, [consoleLogs, networkRequests]);

 // Filter logs based on current filter state
 const filteredLogs = useMemo(() => {
 return getUnifiedLogs.filter(log => {
 // Apply type filter
 if (log.type === 'console') {
 if (log.level === 'error' && !logsFilter.errors) return false;
 if (log.level === 'warn' && !logsFilter.warnings) return false;
 if (log.level === 'info' && !logsFilter.info) return false;
 if ((log.level === 'log' || log.level === 'debug') && !logsFilter.debug) return false;
 } else if (log.type === 'network') {
 if (!logsFilter.network) return false;
 if (log.failed && !logsFilter.failedRequests) return false;
 }

 // Apply search filter
 if (logsSearch.trim()) {
 const searchLower = logsSearch.toLowerCase();
 const matchMessage = log.message.toLowerCase().includes(searchLower);
 const matchUrl = log.url?.toLowerCase().includes(searchLower);
 const matchLocation = log.location?.toLowerCase().includes(searchLower);
 if (!matchMessage && !matchUrl && !matchLocation) return false;
 }

 return true;
 });
 }, [getUnifiedLogs, logsFilter, logsSearch]);

 // Get log counts by type
 const logCounts = useMemo((): LogCounts => {
 const counts = {
 total: getUnifiedLogs.length,
 errors: 0,
 warnings: 0,
 info: 0,
 debug: 0,
 network: 0,
 failedRequests: 0,
 };

 getUnifiedLogs.forEach(log => {
 if (log.type === 'console') {
 if (log.level === 'error') counts.errors++;
 else if (log.level === 'warn') counts.warnings++;
 else if (log.level === 'info') counts.info++;
 else counts.debug++;
 } else if (log.type === 'network') {
 counts.network++;
 if (log.failed || (log.status && log.status >= 400)) counts.failedRequests++;
 }
 });

 return counts;
 }, [getUnifiedLogs]);

 // Export logs function
 const exportLogs = (format: LogsExportFormat) => {
 const dataToExport = filteredLogs.map(log => ({
 type: log.type,
 timestamp: new Date(log.timestamp).toISOString(),
 level: log.level,
 message: log.message,
 ...(log.type === 'network' && {
 method: log.method,
 url: log.url,
 status: log.status,
 duration_ms: log.duration_ms,
 resourceType: log.resourceType,
 failed: log.failed,
 failureText: log.failureText,
 }),
 ...(log.type === 'console' && log.location && { location: log.location }),
 }));

 let content: string;
 let filename: string;
 let mimeType: string;

 if (format === 'json') {
 content = JSON.stringify(dataToExport, null, 2);
 filename = `logs-${runId}-${Date.now()}.json`;
 mimeType = 'application/json';
 } else {
 content = dataToExport.map(log => {
 const timestamp = log.timestamp;
 const level = (log.level || 'info').toUpperCase().padEnd(5);
 const type = log.type.toUpperCase().padEnd(7);
 let line = `[${timestamp}] [${type}] [${level}] ${log.message}`;
 if (log.type === 'network') {
 line += ` | Status: ${log.status || 'N/A'} | Duration: ${log.duration_ms || '-'}ms`;
 }
 if (log.location) {
 line += ` @ ${log.location}`;
 }
 return line;
 }).join('\n');
 filename = `logs-${runId}-${Date.now()}.txt`;
 mimeType = 'text/plain';
 }

 const blob = new Blob([content], { type: mimeType });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 };

 return (
 <div>
 {/* Header with title and stats */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <h2 className="text-lg font-semibold text-foreground">Logs & Network</h2>
 <div className="flex items-center gap-2 text-sm">
 <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
 {logCounts.total} total
 </span>
 {logCounts.errors > 0 && (
 <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">
 {logCounts.errors} errors
 </span>
 )}
 {logCounts.warnings > 0 && (
 <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
 {logCounts.warnings} warnings
 </span>
 )}
 </div>
 </div>

 {/* Export buttons */}
 <div className="flex items-center gap-2">
 <select
 value={logsExportFormat}
 onChange={(e) => setLogsExportFormat(e.target.value as LogsExportFormat)}
 className="px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
 >
 <option value="json">JSON</option>
 <option value="txt">Text</option>
 </select>
 <button
 onClick={() => exportLogs(logsExportFormat)}
 className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
 disabled={filteredLogs.length === 0}
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
 </svg>
 Export
 </button>
 </div>
 </div>

 {/* View Mode and Filters */}
 <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
 {/* View Mode Selector */}
 <div className="flex items-center gap-2">
 <span className="text-sm text-muted-foreground">View:</span>
 <div className="flex rounded-md overflow-hidden border border-border">
 {(['unified', 'console', 'network'] as const).map(mode => (
 <button
 key={mode}
 onClick={() => setLogsViewMode(mode)}
 className={`px-3 py-1.5 text-sm capitalize ${
 logsViewMode === mode
 ? 'bg-primary text-primary-foreground'
 : 'bg-background text-foreground hover:bg-muted'
 }`}
 >
 {mode}
 </button>
 ))}
 </div>
 </div>

 {/* Search */}
 <div className="flex-1 min-w-[200px] max-w-md">
 <div className="relative">
 <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 <input
 type="text"
 placeholder="Search logs..."
 value={logsSearch}
 onChange={(e) => setLogsSearch(e.target.value)}
 className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground"
 />
 {logsSearch && (
 <button
 onClick={() => setLogsSearch('')}
 className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
 >
 <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 )}
 </div>
 </div>

 {/* Filters */}
 <div className="flex flex-wrap items-center gap-2">
 <span className="text-sm text-muted-foreground">Filter:</span>
 <button
 onClick={() => setLogsFilter(f => ({ ...f, errors: !f.errors }))}
 className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
 logsFilter.errors
 ? 'bg-red-100 border-red-300 text-red-700'
 : 'bg-muted border-border text-muted-foreground line-through'
 }`}
 >
 <span className="w-2 h-2 rounded-full bg-red-500"></span>
 Errors ({logCounts.errors})
 </button>
 <button
 onClick={() => setLogsFilter(f => ({ ...f, warnings: !f.warnings }))}
 className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
 logsFilter.warnings
 ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
 : 'bg-muted border-border text-muted-foreground line-through'
 }`}
 >
 <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
 Warnings ({logCounts.warnings})
 </button>
 <button
 onClick={() => setLogsFilter(f => ({ ...f, info: !f.info }))}
 className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
 logsFilter.info
 ? 'bg-blue-100 border-blue-300 text-blue-700'
 : 'bg-muted border-border text-muted-foreground line-through'
 }`}
 >
 <span className="w-2 h-2 rounded-full bg-blue-500"></span>
 Info ({logCounts.info})
 </button>
 <button
 onClick={() => setLogsFilter(f => ({ ...f, network: !f.network }))}
 className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
 logsFilter.network
 ? 'bg-purple-100 border-purple-300 text-purple-700'
 : 'bg-muted border-border text-muted-foreground line-through'
 }`}
 >
 <span className="w-2 h-2 rounded-full bg-purple-500"></span>
 Network ({logCounts.network})
 </button>
 </div>
 </div>

 {/* Filtered results count */}
 {(logsSearch || !Object.values(logsFilter).every(v => v)) && (
 <div className="mb-3 text-sm text-muted-foreground">
 Showing {filteredLogs.length} of {logCounts.total} logs
 {logsSearch && <span> matching "{logsSearch}"</span>}
 </div>
 )}

 {/* Unified Log View */}
 {(logsViewMode === 'unified' || logsViewMode === 'console') && (
 <div className="mb-6">
 {logsViewMode === 'console' && (
 <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
 <span>📝</span> Console Logs ({consoleLogs.length})
 </h3>
 )}

 {filteredLogs.filter(l => logsViewMode === 'unified' || l.type === 'console').length === 0 ? (
 <div className="p-8 text-center bg-muted/30 rounded-lg">
 <svg className="w-12 h-12 mx-auto text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 <p className="text-muted-foreground">No logs match your current filters.</p>
 </div>
 ) : (
 <VirtualizedLogList
 logs={filteredLogs.filter(l => logsViewMode === 'unified' || l.type === 'console')}
 expandedLogs={expandedLogs}
 setExpandedLogs={setExpandedLogs}
 expandedNetworkItems={expandedNetworkItems}
 toggleNetworkItem={toggleNetworkItem}
 />
 )}
 </div>
 )}

 {/* Network Requests Table View */}
 {logsViewMode === 'network' && (
 <div>
 <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
 <span>🌐</span> Network Requests ({networkRequests.length})
 </h3>

 {networkRequests.length === 0 ? (
 <div className="p-8 text-center bg-muted/30 rounded-lg">
 <svg className="w-12 h-12 mx-auto text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
 </svg>
 <p className="text-muted-foreground">No network requests captured.</p>
 </div>
 ) : (
 <VirtualizedNetworkTable
 networkRequests={networkRequests}
 logsFilter={logsFilter}
 logsSearch={logsSearch}
 expandedNetworkItems={expandedNetworkItems}
 toggleNetworkItem={toggleNetworkItem}
 />
 )}
 </div>
 )}

 {/* Summary Stats */}
 <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="p-4 bg-muted/30 rounded-lg">
 <div className="text-sm text-muted-foreground">Console Logs</div>
 <div className="text-2xl font-bold text-foreground">{consoleLogs.length}</div>
 {logCounts.errors > 0 && (
 <div className="text-xs text-red-500 mt-1">{logCounts.errors} errors</div>
 )}
 </div>
 <div className="p-4 bg-muted/30 rounded-lg">
 <div className="text-sm text-muted-foreground">Network Requests</div>
 <div className="text-2xl font-bold text-foreground">{networkRequests.length}</div>
 {logCounts.failedRequests > 0 && (
 <div className="text-xs text-red-500 mt-1">{logCounts.failedRequests} failed</div>
 )}
 </div>
 <div className="p-4 bg-muted/30 rounded-lg">
 <div className="text-sm text-muted-foreground">Warnings</div>
 <div className="text-2xl font-bold text-yellow-600">{logCounts.warnings}</div>
 </div>
 <div className="p-4 bg-muted/30 rounded-lg">
 <div className="text-sm text-muted-foreground">Errors</div>
 <div className="text-2xl font-bold text-red-600">{logCounts.errors}</div>
 </div>
 </div>
 </div>
 );
}

/**
 * Feature #113: VirtualizedLogList - Virtualized rendering for large log lists
 * Uses @tanstack/react-virtual for efficient rendering of 100+ log entries
 */
interface VirtualizedLogListProps {
 logs: UnifiedLogEntry[];
 expandedLogs: boolean;
 setExpandedLogs: (expanded: boolean) => void;
 expandedNetworkItems: Set<number>;
 toggleNetworkItem: (index: number) => void;
}

function VirtualizedLogList({
 logs,
 expandedLogs,
 setExpandedLogs,
 expandedNetworkItems,
 toggleNetworkItem,
}: VirtualizedLogListProps) {
 const parentRef = useRef<HTMLDivElement>(null);
 const displayLogs = expandedLogs ? logs : logs.slice(0, 100);
 const useVirtual = displayLogs.length > 50;
 const ROW_HEIGHT = 36; // Estimated height per log entry

 const virtualizer = useVirtualizer({
 count: displayLogs.length,
 getScrollElement: () => parentRef.current,
 estimateSize: (index) => {
 // Expanded network items are taller
 const log = displayLogs[index];
 if (log.type === 'network' && log.originalIndex !== undefined && expandedNetworkItems.has(log.originalIndex)) {
 return 150;
 }
 return ROW_HEIGHT;
 },
 overscan: 10,
 });

 return (
 <div className="bg-gray-900 rounded-lg overflow-hidden">
 {useVirtual ? (
 <div
 ref={parentRef}
 className="overflow-auto p-4 font-mono text-sm"
 style={{ height: '600px' }}
 >
 <div
 style={{
 height: `${virtualizer.getTotalSize()}px`,
 width: '100%',
 position: 'relative',
 }}
 >
 {virtualizer.getVirtualItems().map((virtualRow) => {
 const log = displayLogs[virtualRow.index];
 return (
 <div
 key={virtualRow.key}
 data-index={virtualRow.index}
 ref={virtualizer.measureElement}
 style={{
 position: 'absolute',
 top: 0,
 left: 0,
 width: '100%',
 transform: `translateY(${virtualRow.start}px)`,
 }}
 >
 <LogEntry
 log={log}
 expandedNetworkItems={expandedNetworkItems}
 toggleNetworkItem={toggleNetworkItem}
 />
 </div>
 );
 })}
 </div>
 </div>
 ) : (
 <div className="max-h-[600px] overflow-auto p-4 font-mono text-sm">
 {displayLogs.map((log, idx) => (
 <LogEntry
 key={idx}
 log={log}
 expandedNetworkItems={expandedNetworkItems}
 toggleNetworkItem={toggleNetworkItem}
 />
 ))}
 </div>
 )}

 {/* Show more/less button */}
 {!expandedLogs && logs.length > 100 && (
 <button
 onClick={() => setExpandedLogs(true)}
 className="w-full p-3 bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
 >
 Show all {logs.length} logs
 </button>
 )}
 {expandedLogs && logs.length > 100 && (
 <button
 onClick={() => setExpandedLogs(false)}
 className="w-full p-3 bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
 >
 Show less
 </button>
 )}
 </div>
 );
}

/**
 * Single log entry component extracted for reuse
 */
function LogEntry({
 log,
 expandedNetworkItems,
 toggleNetworkItem,
}: {
 log: UnifiedLogEntry;
 expandedNetworkItems: Set<number>;
 toggleNetworkItem: (index: number) => void;
}) {
 return (
 <div
 className={`py-1.5 border-l-2 pl-3 mb-1 ${
 log.type === 'network'
 ? 'border-purple-500 hover:bg-purple-500/10'
 : log.level === 'error'
 ? 'border-red-500 hover:bg-red-500/10'
 : log.level === 'warn'
 ? 'border-yellow-500 hover:bg-yellow-500/10'
 : log.level === 'info'
 ? 'border-blue-500 hover:bg-blue-500/10'
 : 'border-gray-500 hover:bg-gray-500/10'
 } transition-colors cursor-pointer rounded-r`}
 onClick={() => log.type === 'network' && log.originalIndex !== undefined && toggleNetworkItem(log.originalIndex)}
 >
 <div className="flex items-start gap-2">
 {/* Timestamp */}
 <span className="text-gray-500 flex-shrink-0">
 [{new Date(log.timestamp).toISOString().split('T')[1].slice(0, 12)}]
 </span>

 {/* Type badge */}
 <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs rounded uppercase ${
 log.type === 'network'
 ? 'bg-purple-800 text-purple-200'
 : log.level === 'error'
 ? 'bg-red-800 text-red-200'
 : log.level === 'warn'
 ? 'bg-yellow-800 text-yellow-200'
 : log.level === 'info'
 ? 'bg-blue-800 text-blue-200'
 : 'bg-gray-700 text-gray-300'
 }`}>
 {log.type === 'network' ? 'NET' : log.level?.slice(0, 3) || 'LOG'}
 </span>

 {/* Network: Method + Status */}
 {log.type === 'network' && (
 <>
 <span className="font-semibold text-purple-400 flex-shrink-0">{log.method}</span>
 <span className={`flex-shrink-0 px-1.5 py-0.5 text-xs rounded ${
 !log.status ? 'bg-gray-700 text-gray-300' :
 log.status >= 200 && log.status < 300 ? 'bg-green-800 text-green-200' :
 log.status >= 300 && log.status < 400 ? 'bg-blue-800 text-blue-200' :
 log.status >= 400 && log.status < 500 ? 'bg-yellow-800 text-yellow-200' :
 'bg-red-800 text-red-200'
 }`}>
 {log.status || 'N/A'}
 </span>
 </>
 )}

 {/* Message/URL */}
 <span className={`break-all ${
 log.type === 'network'
 ? 'text-purple-300'
 : log.level === 'error'
 ? 'text-red-400'
 : log.level === 'warn'
 ? 'text-yellow-400'
 : log.level === 'info'
 ? 'text-blue-400'
 : 'text-gray-200'
 }`}>
 {log.type === 'network' ? log.url : log.message}
 </span>

 {/* Duration for network */}
 {log.type === 'network' && log.duration_ms && (
 <span className="text-gray-500 flex-shrink-0 ml-auto">
 {log.duration_ms}ms
 </span>
 )}

 {/* Location for console */}
 {log.type === 'console' && log.location && (
 <span className="text-gray-500 text-xs flex-shrink-0 ml-auto">@ {log.location}</span>
 )}
 </div>

 {/* Expanded network details */}
 {log.type === 'network' && log.originalIndex !== undefined && expandedNetworkItems.has(log.originalIndex) && (
 <div className="mt-2 ml-6 p-3 bg-gray-800 rounded-lg text-xs space-y-2">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <span className="text-gray-500">Resource Type:</span>{' '}
 <span className="text-gray-300">{log.resourceType || 'unknown'}</span>
 </div>
 <div>
 <span className="text-gray-500">Duration:</span>{' '}
 <span className="text-gray-300">{log.duration_ms ? `${log.duration_ms}ms` : '-'}</span>
 </div>
 <div>
 <span className="text-gray-500">Request Size:</span>{' '}
 <span className="text-gray-300">{log.requestSize ? `${(log.requestSize / 1024).toFixed(1)}KB` : '-'}</span>
 </div>
 <div>
 <span className="text-gray-500">Response Size:</span>{' '}
 <span className="text-gray-300">{log.responseSize ? `${(log.responseSize / 1024).toFixed(1)}KB` : '-'}</span>
 </div>
 </div>
 {log.failed && (
 <div className="text-red-400">
 <span className="text-gray-500">Error:</span> {log.failureText || 'Request failed'}
 </div>
 )}
 <div className="mt-2">
 <span className="text-gray-500">Full URL:</span>
 <div className="mt-1 p-2 bg-gray-900 rounded break-all text-gray-300">{log.url}</div>
 </div>
 </div>
 )}
 </div>
 );
}

/**
 * Feature #113: VirtualizedNetworkTable - Virtualized network request table
 */
interface VirtualizedNetworkTableProps {
 networkRequests: NetworkRequest[];
 logsFilter: LogsFilter;
 logsSearch: string;
 expandedNetworkItems: Set<number>;
 toggleNetworkItem: (index: number) => void;
}

function VirtualizedNetworkTable({
 networkRequests,
 logsFilter,
 logsSearch,
 expandedNetworkItems,
 toggleNetworkItem,
}: VirtualizedNetworkTableProps) {
 const filteredRequests = useMemo(() => {
 return networkRequests.filter(req => {
 if (!logsFilter.network) return false;
 if (req.failed && !logsFilter.failedRequests) return false;
 if (logsSearch.trim()) {
 const searchLower = logsSearch.toLowerCase();
 return req.url.toLowerCase().includes(searchLower) ||
 req.method.toLowerCase().includes(searchLower);
 }
 return true;
 });
 }, [networkRequests, logsFilter, logsSearch]);

 const parentRef = useRef<HTMLDivElement>(null);
 const useVirtual = filteredRequests.length > 50;
 const ROW_HEIGHT = 48;

 const virtualizer = useVirtualizer({
 count: filteredRequests.length,
 getScrollElement: () => parentRef.current,
 estimateSize: (index) => {
 // Expanded rows are taller
 if (expandedNetworkItems.has(index)) {
 return 200;
 }
 return ROW_HEIGHT;
 },
 overscan: 5,
 });

 return (
 <div className="border border-border rounded-lg overflow-hidden">
 {/* Header */}
 <div className="grid grid-cols-8 gap-2 p-3 bg-muted/50 text-sm font-medium text-foreground sticky top-0 z-10 border-b border-border">
 <div className="w-8"></div>
 <div>Status</div>
 <div>Method</div>
 <div className="col-span-2">URL</div>
 <div>Type</div>
 <div>Duration</div>
 <div>Size</div>
 </div>

 {/* Virtual or standard rendering */}
 {useVirtual ? (
 <div
 ref={parentRef}
 className="overflow-auto"
 style={{ height: '500px' }}
 >
 <div
 style={{
 height: `${virtualizer.getTotalSize()}px`,
 width: '100%',
 position: 'relative',
 }}
 >
 {virtualizer.getVirtualItems().map((virtualRow) => {
 const req = filteredRequests[virtualRow.index];
 const idx = virtualRow.index;
 return (
 <div
 key={virtualRow.key}
 data-index={virtualRow.index}
 ref={virtualizer.measureElement}
 style={{
 position: 'absolute',
 top: 0,
 left: 0,
 width: '100%',
 transform: `translateY(${virtualRow.start}px)`,
 }}
 >
 <NetworkRow
 req={req}
 idx={idx}
 expanded={expandedNetworkItems.has(idx)}
 toggleNetworkItem={toggleNetworkItem}
 />
 </div>
 );
 })}
 </div>
 </div>
 ) : (
 <div className="max-h-[500px] overflow-auto">
 {filteredRequests.slice(0, 100).map((req, idx) => (
 <NetworkRow
 key={idx}
 req={req}
 idx={idx}
 expanded={expandedNetworkItems.has(idx)}
 toggleNetworkItem={toggleNetworkItem}
 />
 ))}
 </div>
 )}

 {filteredRequests.length > 100 && !useVirtual && (
 <div className="p-3 bg-muted/30 text-center text-sm text-muted-foreground border-t border-border">
 Showing first 100 of {filteredRequests.length} requests
 </div>
 )}
 </div>
 );
}

/**
 * Single network request row component
 */
function NetworkRow({
 req,
 idx,
 expanded,
 toggleNetworkItem,
}: {
 req: NetworkRequest;
 idx: number;
 expanded: boolean;
 toggleNetworkItem: (index: number) => void;
}) {
 return (
 <div className={`border-b border-border ${req.failed ? 'bg-red-50' : ''}`}>
 <div
 className="grid grid-cols-8 gap-2 p-3 items-center hover:bg-muted/30 cursor-pointer transition-colors"
 onClick={() => toggleNetworkItem(idx)}
 >
 <div className="w-8">
 <svg
 className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
 fill="none" viewBox="0 0 24 24" stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </div>
 <div>
 <span className={`px-2 py-0.5 text-xs rounded font-medium ${
 !req.status ? 'bg-gray-100 text-gray-700' :
 req.status >= 200 && req.status < 300 ? 'bg-green-100 text-green-700' :
 req.status >= 400 ? 'bg-red-100 text-red-700' :
 'bg-yellow-100 text-yellow-700'
 }`}>
 {req.status || (req.failed ? 'ERR' : 'N/A')}
 </span>
 </div>
 <div>
 <span className={`font-mono font-medium ${
 req.method === 'GET' ? 'text-green-600' :
 req.method === 'POST' ? 'text-blue-600' :
 req.method === 'DELETE' ? 'text-red-600' :
 'text-foreground'
 }`}>
 {req.method}
 </span>
 </div>
 <div className="col-span-2 text-sm text-muted-foreground truncate" title={req.url}>
 {req.url}
 </div>
 <div className="text-xs">
 <span className="px-1.5 py-0.5 bg-muted rounded">{req.resourceType}</span>
 </div>
 <div className="text-sm text-muted-foreground">
 {req.duration_ms ? `${req.duration_ms}ms` : '-'}
 </div>
 <div className="text-sm text-muted-foreground">
 {req.responseSize ? `${(req.responseSize / 1024).toFixed(1)}KB` : '-'}
 </div>
 </div>

 {/* Expanded details */}
 {expanded && (
 <div className="p-4 bg-muted/20 border-t border-border">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
 <div>
 <span className="text-xs text-muted-foreground block mb-1">Request Size</span>
 <span className="font-medium text-foreground">
 {req.requestSize ? `${(req.requestSize / 1024).toFixed(2)} KB` : 'N/A'}
 </span>
 </div>
 <div>
 <span className="text-xs text-muted-foreground block mb-1">Response Size</span>
 <span className="font-medium text-foreground">
 {req.responseSize ? `${(req.responseSize / 1024).toFixed(2)} KB` : 'N/A'}
 </span>
 </div>
 <div>
 <span className="text-xs text-muted-foreground block mb-1">Resource Type</span>
 <span className="font-medium text-foreground">{req.resourceType || 'unknown'}</span>
 </div>
 <div>
 <span className="text-xs text-muted-foreground block mb-1">Status Text</span>
 <span className="font-medium text-foreground">{req.statusText || '-'}</span>
 </div>
 </div>
 {req.failed && (
 <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg">
 <span className="text-red-700 font-medium">Request Failed</span>
 {req.failureText && (
 <p className="text-sm text-red-600 mt-1">{req.failureText}</p>
 )}
 </div>
 )}
 <div>
 <span className="text-xs text-muted-foreground block mb-1">Full URL</span>
 <div className="p-2 bg-muted rounded-lg font-mono text-sm break-all text-foreground">
 {req.url}
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

