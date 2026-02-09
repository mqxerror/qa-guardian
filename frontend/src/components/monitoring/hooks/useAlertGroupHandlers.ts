/**
 * useAlertGroupHandlers Hook
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * Handles all alert grouping state and operations
 */

import { useState, useCallback } from 'react';
import { toast } from '../../../stores/toastStore';
import { devLog } from '../../../utils/logger';
import type { AlertGroupingRule, AlertGroup } from '../types'; // GroupedAlert unused

export interface UseAlertGroupHandlersReturn {
  // State
  alertGroupingRules: AlertGroupingRule[];
  alertGroups: AlertGroup[];
  isLoadingAlertGrouping: boolean;
  showAlertGroupingModal: boolean;
  editingAlertGroupingRule: AlertGroupingRule | null;

  // Setters
  setShowAlertGroupingModal: (show: boolean) => void;
  setEditingAlertGroupingRule: (rule: AlertGroupingRule | null) => void;
  setAlertGroupingRules: React.Dispatch<React.SetStateAction<AlertGroupingRule[]>>;
  setAlertGroups: React.Dispatch<React.SetStateAction<AlertGroup[]>>;

  // Actions
  fetchAlertGroupingRules: () => Promise<void>;
  fetchAlertGroups: () => Promise<void>;
  openEditAlertGroupingRule: (rule: AlertGroupingRule) => void;
  handleDeleteAlertGroupingRule: (ruleId: string) => Promise<void>;
  handleSimulateAlertGrouping: () => Promise<void>;
  createIncidentFromAlertGroup: (group: AlertGroup) => Promise<void>;
  acknowledgeAlertGroup: (group: AlertGroup) => Promise<void>;
  resolveAlertGroup: (group: AlertGroup, resolutionNotes?: string) => Promise<void>;
  snoozeAlertGroup: (group: AlertGroup, durationHours: number) => Promise<void>;
  unsnoozeAlertGroup: (group: AlertGroup) => Promise<void>;
}

export function useAlertGroupHandlers(
  token: string | null,
  fetchManagedIncidents: () => Promise<void>
): UseAlertGroupHandlersReturn {
  const [alertGroupingRules, setAlertGroupingRules] = useState<AlertGroupingRule[]>([]);
  const [alertGroups, setAlertGroups] = useState<AlertGroup[]>([]);
  const [isLoadingAlertGrouping, setIsLoadingAlertGrouping] = useState(false);
  const [showAlertGroupingModal, setShowAlertGroupingModal] = useState(false);
  const [editingAlertGroupingRule, setEditingAlertGroupingRule] = useState<AlertGroupingRule | null>(null);

  // Fetch alert grouping rules
  const fetchAlertGroupingRules = useCallback(async () => {
    if (!token) return;
    setIsLoadingAlertGrouping(true);
    try {
      const response = await fetch('/api/v1/monitoring/alert-grouping/rules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertGroupingRules(data.rules || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert grouping rules:', error);
    } finally {
      setIsLoadingAlertGrouping(false);
    }
  }, [token]);

  // Fetch alert groups
  const fetchAlertGroups = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/alert-grouping/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert groups:', error);
    }
  }, [token]);

  // Open edit alert grouping rule modal
  const openEditAlertGroupingRule = useCallback((rule: AlertGroupingRule) => {
    setEditingAlertGroupingRule(rule);
    setShowAlertGroupingModal(true);
  }, []);

  // Delete alert grouping rule
  const handleDeleteAlertGroupingRule = useCallback(async (ruleId: string) => {
    if (!token || !confirm('Are you sure you want to delete this alert grouping rule?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Alert grouping rule deleted');
        fetchAlertGroupingRules();
      } else {
        toast.error('Failed to delete alert grouping rule');
      }
    } catch (error) {
      console.error('Failed to delete alert grouping rule:', error);
      toast.error('Failed to delete alert grouping rule');
    }
  }, [token, fetchAlertGroupingRules]);

  // Simulate alert grouping
  const handleSimulateAlertGrouping = useCallback(async () => {
    if (!token) return;

    // Simulate 5 related alerts
    const simulatedAlerts = [
      { check_name: 'API Server', check_type: 'uptime' as const, location: 'us-east', error_message: 'Connection timeout' },
      { check_name: 'API Server', check_type: 'uptime' as const, location: 'us-west', error_message: 'Connection timeout' },
      { check_name: 'Database Check', check_type: 'uptime' as const, location: 'us-east', error_message: 'Connection refused' },
      { check_name: 'API Server', check_type: 'uptime' as const, location: 'us-east', error_message: 'Connection timeout' },
      { check_name: 'CDN Health', check_type: 'uptime' as const, location: 'europe', error_message: 'Slow response' },
    ];

    try {
      const response = await fetch('/api/v1/monitoring/alert-grouping/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ alerts: simulatedAlerts }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        devLog('[Alert Grouping Simulation]', data);
        fetchAlertGroups();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to simulate alerts');
      }
    } catch (error) {
      console.error('Failed to simulate alerts:', error);
      toast.error('Failed to simulate alerts');
    }
  }, [token, fetchAlertGroups]);

  // Create incident from alert group
  const createIncidentFromAlertGroup = useCallback(async (group: AlertGroup) => {
    if (!token) return;

    try {
      // Determine severity based on alert group
      const severity = group.alerts.length > 5 ? 'critical' :
                       group.alerts.length > 3 ? 'high' : 'medium';

      // Create a title from the grouped alerts
      const uniqueCheckNames = [...new Set(group.alerts.map(a => a.check_name))];
      const title = uniqueCheckNames.length === 1
        ? `Alert: ${uniqueCheckNames[0]}`
        : `Alert: Multiple checks (${uniqueCheckNames.length})`;

      // Build description from alerts
      const description = `Auto-created from alert group.\n\nGrouped alerts:\n${
        group.alerts.slice(0, 5).map(a => `- ${a.check_name}: ${a.error_message || 'Failed'}`).join('\n')
      }${group.alerts.length > 5 ? `\n... and ${group.alerts.length - 5} more` : ''}`;

      const payload = {
        title,
        description,
        priority: severity === 'critical' ? 'P1' : severity === 'high' ? 'P2' : 'P3' as 'P1' | 'P2' | 'P3',
        severity,
        source: 'alert',
        source_alert_id: group.id,
        tags: ['auto-created', 'alert-group'],
        affected_services: uniqueCheckNames,
      };

      const response = await fetch('/api/v1/monitoring/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Incident created from alert group');
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create incident');
      }
    } catch (error) {
      console.error('Failed to create incident from alert:', error);
      toast.error('Failed to create incident');
    }
  }, [token, fetchManagedIncidents]);

  // Acknowledge an alert group (stops escalation)
  const acknowledgeAlertGroup = useCallback(async (group: AlertGroup) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${group.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success('Alert group acknowledged - escalation stopped');
        fetchAlertGroups();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to acknowledge alert group');
      }
    } catch (error) {
      console.error('Failed to acknowledge alert group:', error);
      toast.error('Failed to acknowledge alert group');
    }
  }, [token, fetchAlertGroups]);

  // Resolve an alert group with resolution notes
  const resolveAlertGroup = useCallback(async (group: AlertGroup, resolutionNotes?: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${group.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resolution_notes: resolutionNotes || 'Resolved via UI' }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Alert group resolved - Resolution time: ${data.resolution_time_seconds}s`);
        fetchAlertGroups();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to resolve alert group');
      }
    } catch (error) {
      console.error('Failed to resolve alert group:', error);
      toast.error('Failed to resolve alert group');
    }
  }, [token, fetchAlertGroups]);

  // Snooze an alert group (temporarily silence notifications)
  const snoozeAlertGroup = useCallback(async (group: AlertGroup, durationHours: number) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${group.id}/snooze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ duration_hours: durationHours }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Alert group snoozed for ${durationHours}h - until ${new Date(data.snoozed_until).toLocaleTimeString()}`);
        fetchAlertGroups();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to snooze alert group');
      }
    } catch (error) {
      console.error('Failed to snooze alert group:', error);
      toast.error('Failed to snooze alert group');
    }
  }, [token, fetchAlertGroups]);

  // Unsnooze an alert group (resume notifications)
  const unsnoozeAlertGroup = useCallback(async (group: AlertGroup) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${group.id}/unsnooze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success('Alert group unsnoozed - notifications will resume');
        fetchAlertGroups();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to unsnooze alert group');
      }
    } catch (error) {
      console.error('Failed to unsnooze alert group:', error);
      toast.error('Failed to unsnooze alert group');
    }
  }, [token, fetchAlertGroups]);

  return {
    // State
    alertGroupingRules,
    alertGroups,
    isLoadingAlertGrouping,
    showAlertGroupingModal,
    editingAlertGroupingRule,

    // Setters
    setShowAlertGroupingModal,
    setEditingAlertGroupingRule,
    setAlertGroupingRules,
    setAlertGroups,

    // Actions
    fetchAlertGroupingRules,
    fetchAlertGroups,
    openEditAlertGroupingRule,
    handleDeleteAlertGroupingRule,
    handleSimulateAlertGrouping,
    createIncidentFromAlertGroup,
    acknowledgeAlertGroup,
    resolveAlertGroup,
    snoozeAlertGroup,
    unsnoozeAlertGroup,
  };
}

export default useAlertGroupHandlers;
