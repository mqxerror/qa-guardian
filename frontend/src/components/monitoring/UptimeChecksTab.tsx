/**
 * UptimeChecksTab Component
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * Displays uptime check list, detail panel, and check management functionality
 */

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
 UptimeCheck,
 CheckResult,
 MonitoringLocation,
 LocationResult,
 SlaMetrics,
 IncidentData,
 Incident,
 HistoryData,
 MaintenanceData,
 DetailTab,
 HistoryRange,
} from './types';
import { StatusBadge } from './';

export interface UptimeChecksTabProps {
 // Data
 checks: UptimeCheck[];
 selectedCheck: UptimeCheck | null;
 checkResults: CheckResult[];
 locationResults: LocationResult[];
 slaMetrics: SlaMetrics | null;
 incidentData: IncidentData | null;
 historyData: HistoryData | null;
 maintenanceData: MaintenanceData | null;

 // Loading states
 isLoading: boolean;
 isLoadingResults: boolean;
 isLoadingSla: boolean;
 isLoadingIncidents: boolean;
 isLoadingHistory: boolean;
 isLoadingMaintenance: boolean;

 // Filters
 availableTags: string[];
 availableGroups: string[];
 filterTag: string;
 filterGroup: string;
 setFilterTag: (tag: string) => void;
 setFilterGroup: (group: string) => void;

 // Detail tab state
 activeDetailTab: DetailTab;
 setActiveDetailTab: (tab: DetailTab) => void;
 historyRange: HistoryRange;
 setHistoryRange: (range: HistoryRange) => void;

 // Actions
 setSelectedCheck: (check: UptimeCheck | null) => void;
 setShowCreateModal: (show: boolean) => void;
 setShowMaintenanceModal: (show: boolean) => void;
 runCheck: (checkId: string) => Promise<void>;
 toggleCheck: (checkId: string) => Promise<void>;
 deleteCheck: (checkId: string) => Promise<void>;
 duplicateCheck: (checkId: string) => Promise<void>;
 openEditModal: (check: UptimeCheck) => void;
 bulkAction: (action: 'run' | 'disable' | 'enable' | 'delete', group: string) => Promise<void>;
 deleteMaintenanceWindow: (windowId: string) => Promise<void>;

 // Helper function for status badge (passed from parent)
 getStatusBadge: (status: UptimeCheck['latest_status']) => React.ReactNode;
}

export default function UptimeChecksTab({
 checks,
 selectedCheck,
 checkResults,
 locationResults,
 slaMetrics,
 incidentData,
 historyData,
 maintenanceData,
 isLoading,
 isLoadingResults,
 isLoadingSla,
 isLoadingIncidents,
 isLoadingHistory,
 isLoadingMaintenance,
 availableTags,
 availableGroups,
 filterTag,
 filterGroup,
 setFilterTag,
 setFilterGroup,
 activeDetailTab,
 setActiveDetailTab,
 historyRange,
 setHistoryRange,
 setSelectedCheck,
 setShowCreateModal,
 setShowMaintenanceModal,
 runCheck,
 toggleCheck,
 deleteCheck,
 duplicateCheck,
 openEditModal,
 bulkAction,
 deleteMaintenanceWindow,
 getStatusBadge,
}: UptimeChecksTabProps) {
 // Filter checks based on selected tag and group
 const filteredChecks = checks.filter(check => {
 if (filterTag && (!check.tags || !check.tags.includes(filterTag))) return false;
 if (filterGroup && check.group !== filterGroup) return false;
 return true;
 });

 if (isLoading) {
 return (
 <div className="flex items-center justify-center py-12">
 <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
 </div>
 );
 }

 if (checks.length === 0) {
 return (
 <div className="rounded-lg border border-dashed border-border bg-gradient-to-br from-card to-muted/30 p-12 text-center animate-in fade-in duration-500">
 {/* Radar/pulse icon illustration */}
 <div className="relative mx-auto w-28 h-28 mb-6">
 <svg className="w-full h-full text-primary/20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
 {/* Outer rings (radar effect) */}
 <circle cx="50" cy="50" r="45" className="animate-ping opacity-20" style={{ animationDuration: '3s' }} />
 <circle cx="50" cy="50" r="35" className="animate-ping opacity-30" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
 <circle cx="50" cy="50" r="25" className="animate-ping opacity-40" style={{ animationDuration: '2s', animationDelay: '1s' }} />
 {/* Center point */}
 <circle cx="50" cy="50" r="8" fill="currentColor" className="text-primary/50" />
 {/* Scanning line */}
 <line x1="50" y1="50" x2="50" y2="10" className="text-primary origin-center animate-spin" style={{ animationDuration: '4s' }} />
 </svg>
 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
 <span className="text-3xl">📡</span>
 </div>
 </div>
 <h3 className="text-xl font-semibold text-foreground mb-2">No Monitors Yet</h3>
 <p className="text-muted-foreground mb-2 max-w-md mx-auto">
 Start monitoring your endpoints in seconds
 </p>
 <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
 Get instant alerts when your APIs, websites, or services go down. Track response times and uptime percentage.
 </p>
 <button
 onClick={() => setShowCreateModal(true)}
 className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Create Your First Monitor
 </button>
 </div>
 );
 }

 return (
 <>
 {/* Filter Controls */}
 {(availableTags.length > 0 || availableGroups.length > 0) && (
 <div className="mb-4 flex flex-wrap items-center gap-4 p-4 rounded-lg border border-border bg-card">
 <span className="text-sm font-medium text-foreground">🔍 Filters:</span>
 {availableTags.length > 0 && (
 <div className="flex items-center gap-2">
 <label className="text-sm text-muted-foreground">Tag:</label>
 <select
 value={filterTag}
 onChange={e => setFilterTag(e.target.value)}
 className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
 >
 <option value="">All Tags</option>
 {availableTags.map(tag => (
 <option key={tag} value={tag}>{tag}</option>
 ))}
 </select>
 </div>
 )}
 {availableGroups.length > 0 && (
 <div className="flex items-center gap-2">
 <label className="text-sm text-muted-foreground">Group:</label>
 <select
 value={filterGroup}
 onChange={e => setFilterGroup(e.target.value)}
 className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
 >
 <option value="">All Groups</option>
 {availableGroups.map(group => (
 <option key={group} value={group}>{group}</option>
 ))}
 </select>
 </div>
 )}
 {(filterTag || filterGroup) && (
 <button
 onClick={() => { setFilterTag(''); setFilterGroup(''); }}
 className="text-sm text-primary hover:underline"
 >
 Clear Filters
 </button>
 )}
 {filterGroup && (
 <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
 <span className="text-sm text-muted-foreground">Bulk Actions:</span>
 <button
 onClick={() => bulkAction('run', filterGroup)}
 className="rounded px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
 >
 ▶️ Run All
 </button>
 <button
 onClick={() => bulkAction('disable', filterGroup)}
 className="rounded px-2 py-1 text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
 >
 ⏸️ Disable All
 </button>
 <button
 onClick={() => bulkAction('enable', filterGroup)}
 className="rounded px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200"
 >
 ▶️ Enable All
 </button>
 <button
 onClick={() => bulkAction('delete', filterGroup)}
 className="rounded px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200"
 >
 🗑️ Delete All
 </button>
 </div>
 )}
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Checks List */}
 <div className="lg:col-span-2">
 <div className="rounded-lg border border-border bg-card overflow-hidden">
 <table className="w-full">
 <thead className="bg-muted/50">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Response</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Interval</th>
 <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {filteredChecks.map(check => (
 <tr
 key={check.id}
 className={`hover:bg-muted/30 cursor-pointer ${selectedCheck?.id === check.id ? 'bg-primary/5' : ''}`}
 onClick={() => setSelectedCheck(check)}
 >
 <td className="px-4 py-3">
 <div className="font-medium text-foreground">{check.name}</div>
 <div className="text-xs text-muted-foreground truncate max-w-[200px]">{check.url}</div>
 {(check.tags && check.tags.length > 0 || check.group) && (
 <div className="flex flex-wrap gap-1 mt-1">
 {check.group && (
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700">
 📁 {check.group}
 </span>
 )}
 {check.tags?.slice(0, 3).map(tag => (
 <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-foreground">
 {tag}
 </span>
 ))}
 {check.tags && check.tags.length > 3 && (
 <span className="text-[10px] text-muted-foreground">+{check.tags.length - 3}</span>
 )}
 </div>
 )}
 </td>
 <td className="px-4 py-3">
 {getStatusBadge(check.latest_status)}
 </td>
 <td className="px-4 py-3 text-sm text-muted-foreground">
 {check.latest_response_time ? `${check.latest_response_time}ms` : '-'}
 </td>
 <td className="px-4 py-3 text-sm text-muted-foreground">
 {check.interval}s
 </td>
 <td className="px-4 py-3 text-right">
 <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
 <button
 onClick={() => runCheck(check.id)}
 title="Run now"
 className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 ▶️
 </button>
 <button
 onClick={() => openEditModal(check)}
 title="Edit"
 className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 ✏️
 </button>
 <button
 onClick={() => duplicateCheck(check.id)}
 title="Duplicate"
 className="rounded p-1.5 text-muted-foreground hover:bg-blue-100 hover:text-blue-600"
 >
 📋
 </button>
 <button
 onClick={() => toggleCheck(check.id)}
 title={check.enabled ? 'Disable' : 'Enable'}
 className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 {check.enabled ? '⏸️' : '▶️'}
 </button>
 <button
 onClick={() => deleteCheck(check.id)}
 title="Delete"
 className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
 >
 🗑️
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Check Details Panel */}
 <div className="lg:col-span-1">
 {selectedCheck ? (
 <CheckDetailPanel
 selectedCheck={selectedCheck}
 checkResults={checkResults}
 locationResults={locationResults}
 slaMetrics={slaMetrics}
 incidentData={incidentData}
 historyData={historyData}
 maintenanceData={maintenanceData}
 isLoadingResults={isLoadingResults}
 isLoadingSla={isLoadingSla}
 isLoadingIncidents={isLoadingIncidents}
 isLoadingHistory={isLoadingHistory}
 isLoadingMaintenance={isLoadingMaintenance}
 activeDetailTab={activeDetailTab}
 setActiveDetailTab={setActiveDetailTab}
 historyRange={historyRange}
 setHistoryRange={setHistoryRange}
 setShowMaintenanceModal={setShowMaintenanceModal}
 deleteMaintenanceWindow={deleteMaintenanceWindow}
 getStatusBadge={getStatusBadge}
 />
 ) : (
 <div className="rounded-lg border border-dashed border-border p-8 text-center">
 <div className="text-4xl mb-3">👈</div>
 <p className="text-muted-foreground">Select a monitor to view details</p>
 </div>
 )}
 </div>
 </div>
 </>
 );
}

// Sub-component for the detail panel
interface CheckDetailPanelProps {
 selectedCheck: UptimeCheck;
 checkResults: CheckResult[];
 locationResults: LocationResult[];
 slaMetrics: SlaMetrics | null;
 incidentData: IncidentData | null;
 historyData: HistoryData | null;
 maintenanceData: MaintenanceData | null;
 isLoadingResults: boolean;
 isLoadingSla: boolean;
 isLoadingIncidents: boolean;
 isLoadingHistory: boolean;
 isLoadingMaintenance: boolean;
 activeDetailTab: DetailTab;
 setActiveDetailTab: (tab: DetailTab) => void;
 historyRange: HistoryRange;
 setHistoryRange: (range: HistoryRange) => void;
 setShowMaintenanceModal: (show: boolean) => void;
 deleteMaintenanceWindow: (windowId: string) => Promise<void>;
 getStatusBadge: (status: UptimeCheck['latest_status']) => React.ReactNode;
}

function CheckDetailPanel({
 selectedCheck,
 checkResults,
 locationResults,
 slaMetrics,
 incidentData,
 historyData,
 maintenanceData,
 isLoadingResults,
 isLoadingSla,
 isLoadingIncidents,
 isLoadingHistory,
 isLoadingMaintenance,
 activeDetailTab,
 setActiveDetailTab,
 historyRange,
 setHistoryRange,
 setShowMaintenanceModal,
 deleteMaintenanceWindow,
 getStatusBadge,
}: CheckDetailPanelProps) {
 return (
 <div className="rounded-lg border border-border bg-card p-4">
 <h3 className="font-semibold text-foreground mb-2">{selectedCheck.name}</h3>

 {/* Tab Navigation */}
 <div className="flex gap-2 mb-4 border-b border-border pb-2">
 <button
 onClick={() => setActiveDetailTab('details')}
 className={`px-3 py-1 text-sm rounded-md transition-colors ${
 activeDetailTab === 'details'
 ? 'bg-primary text-primary-foreground'
 : 'text-muted-foreground hover:text-foreground hover:bg-muted'
 }`}
 >
 Details
 </button>
 <button
 onClick={() => setActiveDetailTab('history')}
 className={`px-3 py-1 text-sm rounded-md transition-colors ${
 activeDetailTab === 'history'
 ? 'bg-primary text-primary-foreground'
 : 'text-muted-foreground hover:text-foreground hover:bg-muted'
 }`}
 >
 History
 </button>
 <button
 onClick={() => setActiveDetailTab('incidents')}
 className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
 activeDetailTab === 'incidents'
 ? 'bg-primary text-primary-foreground'
 : 'text-muted-foreground hover:text-foreground hover:bg-muted'
 }`}
 >
 Incidents
 {incidentData && incidentData.total_incidents > 0 && (
 <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs rounded-full bg-red-500 text-white">
 {incidentData.total_incidents}
 </span>
 )}
 </button>
 <button
 onClick={() => setActiveDetailTab('maintenance')}
 className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
 activeDetailTab === 'maintenance'
 ? 'bg-primary text-primary-foreground'
 : 'text-muted-foreground hover:text-foreground hover:bg-muted'
 }`}
 >
 Maintenance
 {maintenanceData?.in_maintenance && (
 <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs rounded-full bg-yellow-500 text-black">
 🔧
 </span>
 )}
 </button>
 </div>

 {/* Details Tab Content */}
 {activeDetailTab === 'details' && (
 <DetailsTabContent
 selectedCheck={selectedCheck}
 checkResults={checkResults}
 locationResults={locationResults}
 slaMetrics={slaMetrics}
 isLoadingSla={isLoadingSla}
 getStatusBadge={getStatusBadge}
 />
 )}

 {/* History Tab Content */}
 {activeDetailTab === 'history' && (
 <HistoryTabContent
 historyData={historyData}
 historyRange={historyRange}
 setHistoryRange={setHistoryRange}
 isLoadingHistory={isLoadingHistory}
 />
 )}

 {/* Incidents Tab Content */}
 {activeDetailTab === 'incidents' && (
 <IncidentsTabContent
 incidentData={incidentData}
 isLoadingIncidents={isLoadingIncidents}
 />
 )}

 {/* Maintenance Tab Content */}
 {activeDetailTab === 'maintenance' && (
 <MaintenanceTabContent
 maintenanceData={maintenanceData}
 isLoadingMaintenance={isLoadingMaintenance}
 setShowMaintenanceModal={setShowMaintenanceModal}
 deleteMaintenanceWindow={deleteMaintenanceWindow}
 />
 )}
 </div>
 );
}

// Details Tab Content
interface DetailsTabContentProps {
 selectedCheck: UptimeCheck;
 checkResults: CheckResult[];
 locationResults: LocationResult[];
 slaMetrics: SlaMetrics | null;
 isLoadingSla: boolean;
 getStatusBadge: (status: UptimeCheck['latest_status']) => React.ReactNode;
}

function DetailsTabContent({
 selectedCheck,
 checkResults,
 locationResults,
 slaMetrics,
 isLoadingSla,
 getStatusBadge,
}: DetailsTabContentProps) {
 return (
 <>
 <dl className="space-y-3 text-sm">
 <div>
 <dt className="text-muted-foreground">URL</dt>
 <dd className="font-mono text-foreground break-all">{selectedCheck.url}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Method</dt>
 <dd className="text-foreground">{selectedCheck.method}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Interval</dt>
 <dd className="text-foreground">{selectedCheck.interval} seconds</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Timeout</dt>
 <dd className="text-foreground">{selectedCheck.timeout}ms</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Expected Status</dt>
 <dd className="text-foreground">{selectedCheck.expected_status}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Status</dt>
 <dd>{getStatusBadge(selectedCheck.latest_status)}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Locations</dt>
 <dd className="flex flex-wrap gap-1">
 {selectedCheck.locations?.map(loc => (
 <span key={loc} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
 {loc}
 </span>
 ))}
 </dd>
 </div>
 {selectedCheck.headers && Object.keys(selectedCheck.headers).length > 0 && (
 <div>
 <dt className="text-muted-foreground">Headers</dt>
 <dd className="font-mono text-xs text-foreground">
 {Object.entries(selectedCheck.headers).map(([key, value]) => (
 <div key={key}>{key}: {value}</div>
 ))}
 </dd>
 </div>
 )}
 {selectedCheck.body && (
 <div>
 <dt className="text-muted-foreground">Body</dt>
 <dd className="font-mono text-xs text-foreground break-all max-h-20 overflow-y-auto">{selectedCheck.body}</dd>
 </div>
 )}
 </dl>

 {/* Results by Location */}
 {locationResults.length > 0 && (
 <div className="mt-6">
 <h4 className="font-medium text-foreground mb-2">📍 Results by Location</h4>
 <div className="space-y-2">
 {locationResults.map(loc => (
 <div key={loc.location} className="rounded-md border border-border p-3">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2">
 <span className="font-medium text-sm">{loc.location_name}</span>
 {loc.latest_result && (
 <>
 {loc.latest_result.status === 'up' && <span className="text-green-500">●</span>}
 {loc.latest_result.status === 'down' && <span className="text-red-500">●</span>}
 {loc.latest_result.status === 'degraded' && <span className="text-yellow-500">●</span>}
 </>
 )}
 </div>
 <span className="text-xs text-muted-foreground">{loc.total_checks} checks</span>
 </div>
 <div className="grid grid-cols-2 gap-2 text-xs">
 <div>
 <span className="text-muted-foreground">Avg Response:</span>{' '}
 <span className="text-foreground font-medium">{loc.avg_response_time}ms</span>
 </div>
 <div>
 <span className="text-muted-foreground">Uptime:</span>{' '}
 <span className={`font-medium ${loc.uptime_percentage >= 99 ? 'text-green-500' : loc.uptime_percentage >= 95 ? 'text-yellow-500' : 'text-red-500'}`}>
 {loc.uptime_percentage}%
 </span>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* SSL Certificate Info */}
 {checkResults.length > 0 && checkResults[0].ssl_info && (
 <div className="mt-6">
 <h4 className="font-medium text-foreground mb-2">🔒 SSL Certificate</h4>
 <div className="rounded-lg border border-border p-3 bg-muted/30">
 <div className="grid grid-cols-2 gap-2 text-sm">
 <div>
 <span className="text-muted-foreground">Issuer:</span>
 <span className="ml-2 text-foreground">{checkResults[0].ssl_info.issuer}</span>
 </div>
 <div>
 <span className="text-muted-foreground">Subject:</span>
 <span className="ml-2 text-foreground">{checkResults[0].ssl_info.subject}</span>
 </div>
 <div>
 <span className="text-muted-foreground">Valid From:</span>
 <span className="ml-2 text-foreground">{new Date(checkResults[0].ssl_info.valid_from).toLocaleDateString()}</span>
 </div>
 <div>
 <span className="text-muted-foreground">Valid To:</span>
 <span className="ml-2 text-foreground">{new Date(checkResults[0].ssl_info.valid_to).toLocaleDateString()}</span>
 </div>
 <div className="col-span-2">
 <span className="text-muted-foreground">Expires In:</span>
 <span className={`ml-2 font-medium ${
 checkResults[0].ssl_info.days_until_expiry <= 7 ? 'text-red-500' :
 checkResults[0].ssl_info.days_until_expiry <= 30 ? 'text-yellow-500' :
 'text-green-500'
 }`}>
 {checkResults[0].ssl_info.days_until_expiry} days
 {checkResults[0].ssl_info.days_until_expiry <= 30 && ' ⚠️'}
 </span>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* SLA Metrics */}
 <div className="mt-6">
 <h4 className="font-medium text-foreground mb-2">📊 SLA Report</h4>
 {isLoadingSla ? (
 <div className="text-center py-4">
 <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
 </div>
 ) : slaMetrics ? (
 <div className="grid grid-cols-2 gap-3">
 {[
 { label: 'Last 24 Hours', data: slaMetrics.sla.last_24h },
 { label: 'Last 7 Days', data: slaMetrics.sla.last_7d },
 { label: 'Last 30 Days', data: slaMetrics.sla.last_30d },
 { label: 'All Time', data: slaMetrics.sla.all_time },
 ].map(({ label, data }) => (
 <div key={label} className="rounded-lg border border-border p-3 bg-muted/20">
 <div className="text-xs text-muted-foreground mb-1">{label}</div>
 <div className={`text-xl font-bold ${
 data.uptime_percentage >= 99.9 ? 'text-green-500' :
 data.uptime_percentage >= 99 ? 'text-yellow-500' :
 'text-red-500'
 }`}>
 {data.uptime_percentage}%
 </div>
 <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
 <div className="flex justify-between">
 <span>Total checks:</span>
 <span className="text-foreground">{data.total_checks}</span>
 </div>
 <div className="flex justify-between">
 <span>Successful:</span>
 <span className="text-green-500">{data.successful_checks}</span>
 </div>
 <div className="flex justify-between">
 <span>Failed:</span>
 <span className="text-red-500">{data.failed_checks}</span>
 </div>
 <div className="flex justify-between">
 <span>Avg Response:</span>
 <span className="text-foreground">{data.avg_response_time}ms</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">No SLA data available</p>
 )}
 </div>
 </>
 );
}

// History Tab Content
interface HistoryTabContentProps {
 historyData: HistoryData | null;
 historyRange: HistoryRange;
 setHistoryRange: (range: HistoryRange) => void;
 isLoadingHistory: boolean;
}

function HistoryTabContent({
 historyData,
 historyRange,
 setHistoryRange,
 isLoadingHistory,
}: HistoryTabContentProps) {
 if (isLoadingHistory) {
 return (
 <div className="text-center py-8">
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
 <p className="text-sm text-muted-foreground mt-2">Loading history...</p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Range Selector */}
 <div className="flex gap-2">
 {(['1h', '6h', '24h', '7d', '30d'] as HistoryRange[]).map(range => (
 <button
 key={range}
 onClick={() => setHistoryRange(range)}
 className={`px-3 py-1 text-xs rounded-md ${
 historyRange === range
 ? 'bg-primary text-primary-foreground'
 : 'bg-muted text-muted-foreground hover:bg-muted/80'
 }`}
 >
 {range}
 </button>
 ))}
 </div>

 {/* Response Time Chart */}
 {historyData && historyData.chart_data.length > 0 ? (
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={historyData.chart_data}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis
 dataKey="timestamp"
 tick={{ fontSize: 10 }}
 tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 />
 <YAxis tick={{ fontSize: 10 }} />
 <Tooltip
 labelFormatter={(value) => new Date(value).toLocaleString()}
 formatter={(value: number) => [`${value}ms`, 'Response Time']}
 />
 <Line
 type="monotone"
 dataKey="avg_response_time"
 stroke="#2563eb"
 strokeWidth={2}
 dot={false}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 ) : (
 <div className="text-center py-8">
 <p className="text-sm text-muted-foreground">No history data available</p>
 </div>
 )}

 {/* Status Timeline */}
 {historyData && historyData.status_history.length > 0 && (
 <div className="mt-4">
 <h5 className="text-sm font-medium text-foreground mb-2">Recent Status</h5>
 <div className="space-y-1 max-h-40 overflow-y-auto">
 {historyData.status_history.slice(0, 20).map((entry, idx) => (
 <div key={idx} className="flex items-center gap-2 text-xs">
 <span className={`w-2 h-2 rounded-full ${
 entry.status === 'up' ? 'bg-green-500' :
 entry.status === 'down' ? 'bg-red-500' :
 'bg-yellow-500'
 }`} />
 <span className="text-muted-foreground">
 {new Date(entry.timestamp).toLocaleTimeString()}
 </span>
 <span className="text-foreground">{entry.response_time}ms</span>
 <span className="text-muted-foreground">• {entry.location}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}

// Incidents Tab Content
interface IncidentsTabContentProps {
 incidentData: IncidentData | null;
 isLoadingIncidents: boolean;
}

function IncidentsTabContent({
 incidentData,
 isLoadingIncidents,
}: IncidentsTabContentProps) {
 if (isLoadingIncidents) {
 return (
 <div className="text-center py-8">
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
 <p className="text-sm text-muted-foreground mt-2">Loading incidents...</p>
 </div>
 );
 }

 if (!incidentData || incidentData.incidents.length === 0) {
 return (
 <div className="text-center py-8">
 <div className="text-3xl mb-2">✅</div>
 <p className="text-sm text-muted-foreground">No incidents recorded</p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Active Incident Banner */}
 {incidentData.active_incident && (
 <div className="p-3 rounded-lg bg-red-100 border border-red-200">
 <div className="flex items-center gap-2 mb-1">
 <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
 <span className="font-medium text-red-700">Active Incident</span>
 </div>
 <p className="text-sm text-red-600">
 Started: {new Date(incidentData.active_incident.started_at).toLocaleString()}
 </p>
 {incidentData.active_incident.error && (
 <p className="text-xs text-red-500 mt-1">{incidentData.active_incident.error}</p>
 )}
 </div>
 )}

 {/* Incident List */}
 <div className="space-y-2 max-h-60 overflow-y-auto">
 {incidentData.incidents.map((incident) => (
 <div
 key={incident.id}
 className={`p-3 rounded-lg border ${
 incident.is_active
 ? 'border-red-200 bg-red-50'
 : 'border-border bg-muted/30'
 }`}
 >
 <div className="flex items-center justify-between mb-1">
 <span className={`text-xs font-medium px-2 py-0.5 rounded ${
 incident.status === 'down'
 ? 'bg-red-100 text-red-700'
 : 'bg-yellow-100 text-yellow-700'
 }`}>
 {incident.status.toUpperCase()}
 </span>
 <span className="text-xs text-muted-foreground">{incident.duration_formatted}</span>
 </div>
 <p className="text-xs text-muted-foreground">
 {new Date(incident.started_at).toLocaleString()}
 {incident.ended_at && ` - ${new Date(incident.ended_at).toLocaleString()}`}
 </p>
 {incident.error && (
 <p className="text-xs text-red-500 mt-1 truncate">{incident.error}</p>
 )}
 {incident.affected_locations.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-1">
 {incident.affected_locations.map(loc => (
 <span key={loc} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
 {loc}
 </span>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 );
}

// Maintenance Tab Content
interface MaintenanceTabContentProps {
 maintenanceData: MaintenanceData | null;
 isLoadingMaintenance: boolean;
 setShowMaintenanceModal: (show: boolean) => void;
 deleteMaintenanceWindow: (windowId: string) => Promise<void>;
}

function MaintenanceTabContent({
 maintenanceData,
 isLoadingMaintenance,
 setShowMaintenanceModal,
 deleteMaintenanceWindow,
}: MaintenanceTabContentProps) {
 if (isLoadingMaintenance) {
 return (
 <div className="text-center py-8">
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
 <p className="text-sm text-muted-foreground mt-2">Loading maintenance...</p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* In Maintenance Banner */}
 {maintenanceData?.in_maintenance && maintenanceData.active_window && (
 <div className="p-3 rounded-lg bg-yellow-100 border border-yellow-200">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-lg">🔧</span>
 <span className="font-medium text-yellow-700">In Maintenance</span>
 </div>
 <p className="text-sm text-yellow-600">
 {maintenanceData.active_window.name}
 </p>
 <p className="text-xs text-yellow-500 mt-1">
 Until: {new Date(maintenanceData.active_window.end_time).toLocaleString()}
 </p>
 </div>
 )}

 {/* Schedule Maintenance Button */}
 <button
 onClick={() => setShowMaintenanceModal(true)}
 className="w-full rounded-md border border-dashed border-border py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
 >
 + Schedule Maintenance Window
 </button>

 {/* Scheduled Windows */}
 {maintenanceData && maintenanceData.scheduled_windows.length > 0 ? (
 <div className="space-y-2">
 <h5 className="text-sm font-medium text-foreground">Scheduled Windows</h5>
 {maintenanceData.scheduled_windows.map((window) => {
 const now = new Date();
 const startTime = new Date(window.start_time);
 const endTime = new Date(window.end_time);
 const isActive = now >= startTime && now <= endTime;
 return (
 <div key={window.id} className="p-3 rounded-lg border border-border bg-muted/30">
 <div className="flex items-center justify-between mb-1">
 <span className="font-medium text-sm text-foreground">{window.name}</span>
 <div className="flex items-center gap-2">
 <span className={`text-xs px-2 py-0.5 rounded ${
 isActive
 ? 'bg-yellow-100 text-yellow-700'
 : 'bg-muted text-muted-foreground'
 }`}>
 {isActive ? 'Active' : 'Scheduled'}
 </span>
 <button
 onClick={() => deleteMaintenanceWindow(window.id)}
 className="text-xs text-red-500 hover:text-red-700"
 title="Delete"
 >
 🗑️
 </button>
 </div>
 </div>
 <p className="text-xs text-muted-foreground">
 {new Date(window.start_time).toLocaleString()} - {new Date(window.end_time).toLocaleString()}
 </p>
 {window.reason && (
 <p className="text-xs text-muted-foreground mt-1">{window.reason}</p>
 )}
 </div>
 );
 })}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground text-center">No maintenance windows scheduled</p>
 )}
 </div>
 );
}
