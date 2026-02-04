/**
 * useManagedIncidentHandlers Hook
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * Handles all managed incident state and operations
 */

import { useState, useCallback } from 'react';
import { toast } from '../../../stores/toastStore';
import type { ManagedIncident, ManagedIncidentResponder } from '../types';

export interface UseManagedIncidentHandlersReturn {
  // State
  managedIncidents: ManagedIncident[];
  isLoadingManagedIncidents: boolean;
  showManagedIncidentModal: boolean;
  selectedManagedIncident: ManagedIncident | null;
  isSubmittingManagedIncident: boolean;
  showManagedIncidentDetailModal: boolean;
  showManagedAssignResponderModal: boolean;
  showManagedResolveModal: boolean;
  managedIncidentFilter: 'all' | 'active' | 'resolved';

  // Setters
  setShowManagedIncidentModal: (show: boolean) => void;
  setSelectedManagedIncident: (incident: ManagedIncident | null) => void;
  setShowManagedIncidentDetailModal: (show: boolean) => void;
  setShowManagedAssignResponderModal: (show: boolean) => void;
  setShowManagedResolveModal: (show: boolean) => void;
  setManagedIncidentFilter: (filter: 'all' | 'active' | 'resolved') => void;
  setManagedIncidents: React.Dispatch<React.SetStateAction<ManagedIncident[]>>;

  // Actions
  fetchManagedIncidents: () => Promise<void>;
  openManagedIncidentDetail: (incident: ManagedIncident) => Promise<void>;
  handleUpdateManagedIncidentStatus: (incidentId: string, newStatus: ManagedIncident['status']) => Promise<void>;
  handleCreateManagedIncidentFromModal: (data: {
    title: string;
    description?: string;
    priority: ManagedIncident['priority'];
    severity: ManagedIncident['severity'];
    tags?: string[];
    affected_services?: string[];
  }) => Promise<void>;
  handleAddNoteFromModal: (incidentId: string, content: string, visibility: 'internal' | 'public') => Promise<void>;
  handleAssignResponderFromModal: (incidentId: string, name: string, email: string, role: ManagedIncidentResponder['role']) => Promise<void>;
  handleResolveFromModal: (incidentId: string, resolutionSummary: string, postmortemUrl?: string, postmortemCompleted?: boolean) => Promise<void>;
}

export function useManagedIncidentHandlers(token: string | null): UseManagedIncidentHandlersReturn {
  const [managedIncidents, setManagedIncidents] = useState<ManagedIncident[]>([]);
  const [isLoadingManagedIncidents, setIsLoadingManagedIncidents] = useState(false);
  const [showManagedIncidentModal, setShowManagedIncidentModal] = useState(false);
  const [selectedManagedIncident, setSelectedManagedIncident] = useState<ManagedIncident | null>(null);
  const [isSubmittingManagedIncident, setIsSubmittingManagedIncident] = useState(false);
  const [showManagedIncidentDetailModal, setShowManagedIncidentDetailModal] = useState(false);
  const [showManagedAssignResponderModal, setShowManagedAssignResponderModal] = useState(false);
  const [showManagedResolveModal, setShowManagedResolveModal] = useState(false);
  const [managedIncidentFilter, setManagedIncidentFilter] = useState<'all' | 'active' | 'resolved'>('active');

  // Fetch incidents
  const fetchManagedIncidents = useCallback(async () => {
    if (!token) return;
    setIsLoadingManagedIncidents(true);
    try {
      const statusFilter = managedIncidentFilter === 'active'
        ? 'triggered,acknowledged,investigating,identified,monitoring'
        : managedIncidentFilter === 'resolved'
          ? 'resolved'
          : '';
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`/api/v1/monitoring/incidents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setManagedIncidents(data.incidents || []);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setIsLoadingManagedIncidents(false);
    }
  }, [token, managedIncidentFilter]);

  // Open incident detail
  const openManagedIncidentDetail = useCallback(async (incident: ManagedIncident) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incident.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedManagedIncident(data);
        setShowManagedIncidentDetailModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch incident details:', error);
      setSelectedManagedIncident(incident);
      setShowManagedIncidentDetailModal(true);
    }
  }, [token]);

  // Update incident status
  const handleUpdateManagedIncidentStatus = useCallback(async (incidentId: string, newStatus: ManagedIncident['status']) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Incident status updated to ${newStatus}`);
        setSelectedManagedIncident(data);
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Failed to update incident status:', error);
      toast.error('Failed to update status');
    }
  }, [token, fetchManagedIncidents]);

  // Create incident from modal
  const handleCreateManagedIncidentFromModal = useCallback(async (data: {
    title: string;
    description?: string;
    priority: ManagedIncident['priority'];
    severity: ManagedIncident['severity'];
    tags?: string[];
    affected_services?: string[];
  }) => {
    if (!token) return;
    setIsSubmittingManagedIncident(true);
    try {
      const response = await fetch('/api/v1/monitoring/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...data, source: 'manual' }),
      });
      if (response.ok) {
        toast.success('Incident created');
        setShowManagedIncidentModal(false);
        fetchManagedIncidents();
      } else {
        const responseData = await response.json();
        toast.error(responseData.error || 'Failed to create incident');
      }
    } catch (error) {
      console.error('Failed to create incident:', error);
      toast.error('Failed to create incident');
    } finally {
      setIsSubmittingManagedIncident(false);
    }
  }, [token, fetchManagedIncidents]);

  // Add note from modal
  const handleAddNoteFromModal = useCallback(async (incidentId: string, content: string, visibility: 'internal' | 'public') => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, visibility }),
      });
      if (response.ok) {
        const data = await response.json();
        toast.success('Note added');
        setSelectedManagedIncident(data.incident);
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to add note');
      }
    } catch (error) {
      console.error('Failed to add note:', error);
      toast.error('Failed to add note');
    }
  }, [token, fetchManagedIncidents]);

  // Assign responder from modal
  const handleAssignResponderFromModal = useCallback(async (incidentId: string, name: string, email: string, role: ManagedIncidentResponder['role']) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/responders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_name: name, user_email: email, role }),
      });
      if (response.ok) {
        const data = await response.json();
        toast.success('Responder assigned');
        setSelectedManagedIncident(data.incident);
        setShowManagedAssignResponderModal(false);
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to assign responder');
      }
    } catch (error) {
      console.error('Failed to assign responder:', error);
      toast.error('Failed to assign responder');
    }
  }, [token, fetchManagedIncidents]);

  // Resolve incident from modal
  const handleResolveFromModal = useCallback(async (incidentId: string, resolutionSummary: string, postmortemUrl?: string, postmortemCompleted?: boolean) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resolution_summary: resolutionSummary,
          postmortem_url: postmortemUrl,
          postmortem_completed: postmortemCompleted,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        toast.success('Incident resolved');
        setSelectedManagedIncident(data);
        setShowManagedResolveModal(false);
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to resolve incident');
      }
    } catch (error) {
      console.error('Failed to resolve incident:', error);
      toast.error('Failed to resolve incident');
    }
  }, [token, fetchManagedIncidents]);

  return {
    // State
    managedIncidents,
    isLoadingManagedIncidents,
    showManagedIncidentModal,
    selectedManagedIncident,
    isSubmittingManagedIncident,
    showManagedIncidentDetailModal,
    showManagedAssignResponderModal,
    showManagedResolveModal,
    managedIncidentFilter,

    // Setters
    setShowManagedIncidentModal,
    setSelectedManagedIncident,
    setShowManagedIncidentDetailModal,
    setShowManagedAssignResponderModal,
    setShowManagedResolveModal,
    setManagedIncidentFilter,
    setManagedIncidents,

    // Actions
    fetchManagedIncidents,
    openManagedIncidentDetail,
    handleUpdateManagedIncidentStatus,
    handleCreateManagedIncidentFromModal,
    handleAddNoteFromModal,
    handleAssignResponderFromModal,
    handleResolveFromModal,
  };
}

export default useManagedIncidentHandlers;
