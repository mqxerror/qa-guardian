/**
 * Custom hook to manage filter/search state for MonitoringPage
 * Feature #708: Extract useState groups from MonitoringPage god component
 */

import { useState, useCallback } from 'react';

export interface MonitoringFiltersState {
  // Uptime check filters
  filterTag: string;
  filterGroup: string;
  // Alert history filters
  alertHistorySeverityFilter: string;
  alertHistorySourceFilter: string;
  // History range for check detail
  historyRange: '24h' | '7d' | '30d';
}

export interface UseMonitoringFiltersReturn extends MonitoringFiltersState {
  // Uptime check filter setters
  setFilterTag: (tag: string) => void;
  setFilterGroup: (group: string) => void;
  // Alert history filter setters
  setAlertHistorySeverityFilter: (severity: string) => void;
  setAlertHistorySourceFilter: (source: string) => void;
  // History range setter
  setHistoryRange: (range: '24h' | '7d' | '30d') => void;
  // Reset all filters
  resetFilters: () => void;
}

const initialState: MonitoringFiltersState = {
  filterTag: '',
  filterGroup: '',
  alertHistorySeverityFilter: '',
  alertHistorySourceFilter: '',
  historyRange: '24h',
};

export function useMonitoringFilters(): UseMonitoringFiltersReturn {
  const [filters, setFilters] = useState<MonitoringFiltersState>(initialState);

  const setFilterTag = useCallback((tag: string) => {
    setFilters(prev => ({ ...prev, filterTag: tag }));
  }, []);

  const setFilterGroup = useCallback((group: string) => {
    setFilters(prev => ({ ...prev, filterGroup: group }));
  }, []);

  const setAlertHistorySeverityFilter = useCallback((severity: string) => {
    setFilters(prev => ({ ...prev, alertHistorySeverityFilter: severity }));
  }, []);

  const setAlertHistorySourceFilter = useCallback((source: string) => {
    setFilters(prev => ({ ...prev, alertHistorySourceFilter: source }));
  }, []);

  const setHistoryRange = useCallback((range: '24h' | '7d' | '30d') => {
    setFilters(prev => ({ ...prev, historyRange: range }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialState);
  }, []);

  return {
    ...filters,
    setFilterTag,
    setFilterGroup,
    setAlertHistorySeverityFilter,
    setAlertHistorySourceFilter,
    setHistoryRange,
    resetFilters,
  };
}
