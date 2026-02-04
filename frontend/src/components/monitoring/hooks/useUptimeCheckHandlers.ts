/**
 * useUptimeCheckHandlers Hook
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * Handles uptime check CRUD operations and related state
 */

import { useState, useCallback } from 'react';
import { toast } from '../../../stores/toastStore';
import type {
  UptimeCheck,
  CheckResult,
  SlaMetrics,
  IncidentData,
  HistoryData,
  MaintenanceData,
  MonitoringSummary,
  MonitoringLocationInfo,
  LocationResult,
  HistoryRange,
} from '../types';

export interface UseUptimeCheckHandlersReturn {
  // State
  checks: UptimeCheck[];
  selectedCheck: UptimeCheck | null;
  checkResults: CheckResult[];
  locationResults: LocationResult[];
  slaMetrics: SlaMetrics | null;
  incidentData: IncidentData | null;
  historyData: HistoryData | null;
  maintenanceData: MaintenanceData | null;
  summary: MonitoringSummary | null;
  availableLocations: MonitoringLocationInfo[];
  availableTags: string[];
  availableGroups: string[];

  // Loading states
  isLoading: boolean;
  isLoadingResults: boolean;
  isLoadingSla: boolean;
  isLoadingIncidents: boolean;
  isLoadingHistory: boolean;
  isLoadingMaintenance: boolean;

  // Setters
  setChecks: React.Dispatch<React.SetStateAction<UptimeCheck[]>>;
  setSelectedCheck: (check: UptimeCheck | null) => void;

  // Actions
  fetchData: () => Promise<void>;
  fetchCheckResults: (checkId: string) => Promise<void>;
  fetchLocationResults: (checkId: string) => Promise<void>;
  fetchSlaMetrics: (checkId: string) => Promise<void>;
  fetchIncidents: (checkId: string) => Promise<void>;
  fetchHistory: (checkId: string, range: HistoryRange) => Promise<void>;
  fetchMaintenance: (checkId: string) => Promise<void>;
  fetchLocations: () => Promise<void>;
  toggleCheck: (checkId: string) => Promise<void>;
  runCheck: (checkId: string) => Promise<void>;
  deleteCheck: (checkId: string) => Promise<void>;
  duplicateCheck: (checkId: string) => Promise<void>;
  bulkAction: (action: 'enable' | 'disable' | 'delete' | 'run', group: string) => Promise<void>;
  createMaintenanceWindow: (checkId: string, data: { name: string; start_time: string; end_time: string; reason?: string }) => Promise<void>;
  deleteMaintenanceWindow: (checkId: string, windowId: string) => Promise<void>;
}

export function useUptimeCheckHandlers(
  token: string | null,
  filterTag: string,
  filterGroup: string,
  openEditModal: (check: UptimeCheck) => void
): UseUptimeCheckHandlersReturn {
  const [checks, setChecks] = useState<UptimeCheck[]>([]);
  const [selectedCheck, setSelectedCheck] = useState<UptimeCheck | null>(null);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<SlaMetrics | null>(null);
  const [incidentData, setIncidentData] = useState<IncidentData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData | null>(null);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [availableLocations, setAvailableLocations] = useState<MonitoringLocationInfo[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isLoadingSla, setIsLoadingSla] = useState(false);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(false);

  // Fetch checks and summary
  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTag) params.set('tag', filterTag);
      if (filterGroup) params.set('group', filterGroup);
      const queryString = params.toString();

      const [checksRes, summaryRes] = await Promise.all([
        fetch(`/api/v1/monitoring/checks${queryString ? `?${queryString}` : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/monitoring/summary', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (checksRes.ok) {
        const data = await checksRes.json();
        setChecks(data.checks || []);
        if (data.filters) {
          setAvailableTags(data.filters.tags || []);
          setAvailableGroups(data.filters.groups || []);
        }
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, filterTag, filterGroup]);

  // Fetch available locations
  const fetchLocations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/locations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableLocations(data.locations || []);
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  }, [token]);

  // Fetch check results
  const fetchCheckResults = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingResults(true);
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/results?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCheckResults(data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch check results:', error);
    } finally {
      setIsLoadingResults(false);
    }
  }, [token]);

  // Fetch results by location for a check
  const fetchLocationResults = useCallback(async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/results/by-location`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLocationResults(data.locations || []);
      }
    } catch (error) {
      console.error('Failed to fetch location results:', error);
    }
  }, [token]);

  // Fetch SLA metrics
  const fetchSlaMetrics = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingSla(true);
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/sla`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSlaMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch SLA metrics:', error);
    } finally {
      setIsLoadingSla(false);
    }
  }, [token]);

  // Fetch incidents
  const fetchIncidents = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingIncidents(true);
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setIncidentData(data);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setIsLoadingIncidents(false);
    }
  }, [token]);

  // Fetch history
  const fetchHistory = useCallback(async (checkId: string, range: HistoryRange) => {
    if (!token) return;
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/history?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setHistoryData(data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token]);

  // Fetch maintenance windows
  const fetchMaintenance = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingMaintenance(true);
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/maintenance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMaintenanceData(data);
      }
    } catch (error) {
      console.error('Failed to fetch maintenance windows:', error);
    } finally {
      setIsLoadingMaintenance(false);
    }
  }, [token]);

  // Toggle check enabled/disabled
  const toggleCheck = useCallback(async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to toggle check');
    }
  }, [token, fetchData]);

  // Run check manually
  const runCheck = useCallback(async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Check executed');
        fetchData();
        if (selectedCheck?.id === checkId) {
          fetchCheckResults(checkId);
        }
      }
    } catch (error) {
      toast.error('Failed to run check');
    }
  }, [token, selectedCheck, fetchData, fetchCheckResults]);

  // Delete check
  const deleteCheck = useCallback(async (checkId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this check?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Check deleted');
        if (selectedCheck?.id === checkId) {
          setSelectedCheck(null);
        }
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to delete check');
    }
  }, [token, selectedCheck, fetchData]);

  // Duplicate check
  const duplicateCheck = useCallback(async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/duplicate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Check duplicated as "${data.check.name}"`);
        fetchData();
        if (data.check) {
          openEditModal(data.check);
        }
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to duplicate check');
      }
    } catch (error) {
      toast.error('Failed to duplicate check');
    }
  }, [token, fetchData, openEditModal]);

  // Bulk operations on checks by group
  const bulkAction = useCallback(async (action: 'enable' | 'disable' | 'delete' | 'run', group: string) => {
    if (!token || !group) return;
    const actionLabels = { enable: 'enable', disable: 'disable', delete: 'delete', run: 'run' };
    if (action === 'delete' && !confirm(`Are you sure you want to ${actionLabels[action]} all checks in group "${group}"?`)) return;

    try {
      const response = await fetch('/api/v1/monitoring/checks/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, group }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Bulk ${action} completed: ${data.affected} checks affected`);
        setSelectedCheck(null);
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || `Failed to bulk ${action}`);
      }
    } catch (error) {
      toast.error(`Failed to bulk ${action}`);
    }
  }, [token, fetchData]);

  // Create maintenance window
  const createMaintenanceWindow = useCallback(async (
    checkId: string,
    data: { name: string; start_time: string; end_time: string; reason?: string }
  ) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        toast.success('Maintenance window created');
        fetchMaintenance(checkId);
      } else {
        toast.error('Failed to create maintenance window');
      }
    } catch (error) {
      console.error('Failed to create maintenance window:', error);
      toast.error('Failed to create maintenance window');
    }
  }, [token, fetchMaintenance]);

  // Delete maintenance window
  const deleteMaintenanceWindow = useCallback(async (checkId: string, windowId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this maintenance window?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/maintenance/${windowId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Maintenance window deleted');
        fetchMaintenance(checkId);
      } else {
        toast.error('Failed to delete maintenance window');
      }
    } catch (error) {
      console.error('Failed to delete maintenance window:', error);
      toast.error('Failed to delete maintenance window');
    }
  }, [token, fetchMaintenance]);

  return {
    // State
    checks,
    selectedCheck,
    checkResults,
    locationResults,
    slaMetrics,
    incidentData,
    historyData,
    maintenanceData,
    summary,
    availableLocations,
    availableTags,
    availableGroups,

    // Loading states
    isLoading,
    isLoadingResults,
    isLoadingSla,
    isLoadingIncidents,
    isLoadingHistory,
    isLoadingMaintenance,

    // Setters
    setChecks,
    setSelectedCheck,

    // Actions
    fetchData,
    fetchCheckResults,
    fetchLocationResults,
    fetchSlaMetrics,
    fetchIncidents,
    fetchHistory,
    fetchMaintenance,
    fetchLocations,
    toggleCheck,
    runCheck,
    deleteCheck,
    duplicateCheck,
    bulkAction,
    createMaintenanceWindow,
    deleteMaintenanceWindow,
  };
}

export default useUptimeCheckHandlers;
