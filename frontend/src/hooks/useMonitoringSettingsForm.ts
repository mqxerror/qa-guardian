/**
 * Custom hook to manage settings form state for MonitoringPage
 * Feature #708: Extract useState groups from MonitoringPage god component
 *
 * This hook manages form inputs for settings that are locally edited before saving.
 * The actual data fetching is done via React Query hooks in useMonitoring.ts
 */

import { useState, useCallback } from 'react';
import type { MonitoringSettings } from './api/useMonitoring';

export interface SettingsFormState {
  // Retention settings form
  settingsRetentionDays: 30 | 90 | 365;
  settingsAutoCleanup: boolean;
  // Maintenance window form
  maintenanceName: string;
  maintenanceStartTime: string;
  maintenanceEndTime: string;
  maintenanceReason: string;
  // Global severity mapping
  globalSeverityMapping: {
    critical: string;
    high: string;
    medium: string;
    low: string;
    info: string;
  };
  // Rate limit config
  alertRateLimitConfig: {
    enabled: boolean;
    max_alerts_per_minute: number;
    time_window_seconds: number;
    suppression_mode: 'aggregate' | 'dedupe' | 'none';
    aggregate_threshold: number;
  };
  // Correlation config
  alertCorrelationConfig: {
    enabled: boolean;
    correlate_by_check: boolean;
    correlate_by_location: boolean;
    correlate_by_error_type: boolean;
    correlate_by_time_window: boolean;
    time_window_seconds: number;
    similarity_threshold: number;
  };
}

export interface UseSettingsFormReturn extends SettingsFormState {
  // Retention setters
  setSettingsRetentionDays: (days: 30 | 90 | 365) => void;
  setSettingsAutoCleanup: (enabled: boolean) => void;
  // Maintenance window setters
  setMaintenanceName: (name: string) => void;
  setMaintenanceStartTime: (time: string) => void;
  setMaintenanceEndTime: (time: string) => void;
  setMaintenanceReason: (reason: string) => void;
  resetMaintenanceForm: () => void;
  // Severity mapping setter
  setGlobalSeverityMapping: (mapping: SettingsFormState['globalSeverityMapping']) => void;
  // Rate limit setter
  setAlertRateLimitConfig: (config: SettingsFormState['alertRateLimitConfig']) => void;
  // Correlation setter
  setAlertCorrelationConfig: (config: SettingsFormState['alertCorrelationConfig']) => void;
  // Sync with fetched settings
  syncWithSettings: (settings: MonitoringSettings) => void;
}

const initialSeverityMapping = {
  critical: 'P1',
  high: 'P2',
  medium: 'P3',
  low: 'P4',
  info: 'P5',
};

const initialRateLimitConfig = {
  enabled: true,
  max_alerts_per_minute: 5,
  time_window_seconds: 60,
  suppression_mode: 'aggregate' as const,
  aggregate_threshold: 10,
};

const initialCorrelationConfig = {
  enabled: true,
  correlate_by_check: true,
  correlate_by_location: true,
  correlate_by_error_type: true,
  correlate_by_time_window: true,
  time_window_seconds: 300,
  similarity_threshold: 60,
};

const initialState: SettingsFormState = {
  settingsRetentionDays: 90,
  settingsAutoCleanup: true,
  maintenanceName: '',
  maintenanceStartTime: '',
  maintenanceEndTime: '',
  maintenanceReason: '',
  globalSeverityMapping: initialSeverityMapping,
  alertRateLimitConfig: initialRateLimitConfig,
  alertCorrelationConfig: initialCorrelationConfig,
};

export function useMonitoringSettingsForm(): UseSettingsFormReturn {
  const [state, setState] = useState<SettingsFormState>(initialState);

  // Retention setters
  const setSettingsRetentionDays = useCallback((days: 30 | 90 | 365) => {
    setState(prev => ({ ...prev, settingsRetentionDays: days }));
  }, []);

  const setSettingsAutoCleanup = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, settingsAutoCleanup: enabled }));
  }, []);

  // Maintenance window setters
  const setMaintenanceName = useCallback((name: string) => {
    setState(prev => ({ ...prev, maintenanceName: name }));
  }, []);

  const setMaintenanceStartTime = useCallback((time: string) => {
    setState(prev => ({ ...prev, maintenanceStartTime: time }));
  }, []);

  const setMaintenanceEndTime = useCallback((time: string) => {
    setState(prev => ({ ...prev, maintenanceEndTime: time }));
  }, []);

  const setMaintenanceReason = useCallback((reason: string) => {
    setState(prev => ({ ...prev, maintenanceReason: reason }));
  }, []);

  const resetMaintenanceForm = useCallback(() => {
    setState(prev => ({
      ...prev,
      maintenanceName: '',
      maintenanceStartTime: '',
      maintenanceEndTime: '',
      maintenanceReason: '',
    }));
  }, []);

  // Config setters
  const setGlobalSeverityMapping = useCallback((mapping: SettingsFormState['globalSeverityMapping']) => {
    setState(prev => ({ ...prev, globalSeverityMapping: mapping }));
  }, []);

  const setAlertRateLimitConfig = useCallback((config: SettingsFormState['alertRateLimitConfig']) => {
    setState(prev => ({ ...prev, alertRateLimitConfig: config }));
  }, []);

  const setAlertCorrelationConfig = useCallback((config: SettingsFormState['alertCorrelationConfig']) => {
    setState(prev => ({ ...prev, alertCorrelationConfig: config }));
  }, []);

  // Sync with fetched settings from API
  const syncWithSettings = useCallback((settings: MonitoringSettings) => {
    setState(prev => ({
      ...prev,
      settingsRetentionDays: settings.retention_days,
      settingsAutoCleanup: settings.auto_cleanup_enabled,
    }));
  }, []);

  return {
    ...state,
    setSettingsRetentionDays,
    setSettingsAutoCleanup,
    setMaintenanceName,
    setMaintenanceStartTime,
    setMaintenanceEndTime,
    setMaintenanceReason,
    resetMaintenanceForm,
    setGlobalSeverityMapping,
    setAlertRateLimitConfig,
    setAlertCorrelationConfig,
    syncWithSettings,
  };
}
