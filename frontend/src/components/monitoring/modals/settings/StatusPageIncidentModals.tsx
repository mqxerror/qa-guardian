/**
 * Status Page Incident Modals
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 * Feature #127: Mobile responsive design audit and fixes
 *
 * Contains 3 modals:
 * 1. IncidentManagementPanel - Panel for viewing/managing incidents on a status page
 * 2. CreateStatusPageIncidentModal - Create new incident for status page
 * 3. AddIncidentUpdateModal - Add update to existing incident
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from '../../../../stores/toastStore';
import type { StatusPage, StatusPageIncident } from '../../types';

// ============================================================
// Incident Management Panel
// ============================================================

export interface IncidentManagementPanelProps {
  isOpen: boolean;
  statusPage: StatusPage | null;
  token: string;
  onClose: () => void;
}

export const IncidentManagementPanel: React.FC<IncidentManagementPanelProps> = ({
  isOpen,
  statusPage,
  token,
  onClose,
}) => {
  const [incidents, setIncidents] = useState<StatusPageIncident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<StatusPageIncident | null>(null);

  // Fetch incidents when panel opens
  const fetchIncidents = useCallback(async () => {
    if (!token || !statusPage) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${statusPage.id}/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setIncidents(data.incidents || []);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, statusPage]);

  useEffect(() => {
    if (isOpen && statusPage) {
      fetchIncidents();
    } else {
      setIncidents([]);
    }
  }, [isOpen, statusPage, fetchIncidents]);

  const handleDeleteIncident = async (incidentId: string) => {
    if (!token || !statusPage || !confirm('Are you sure you want to delete this incident?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${statusPage.id}/incidents/${incidentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Incident deleted');
        fetchIncidents();
      } else {
        toast.error('Failed to delete incident');
      }
    } catch (error) {
      console.error('Failed to delete incident:', error);
      toast.error('Failed to delete incident');
    }
  };

  const openAddUpdateModal = (incident: StatusPageIncident) => {
    setSelectedIncident(incident);
    setShowUpdateModal(true);
  };

  if (!isOpen || !statusPage) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black/50">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="incident-management-panel-title"
          className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4 sm:p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="incident-management-panel-title" className="text-lg font-semibold text-foreground">
                📢 Incident Management - {statusPage.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Create and manage incident communications for your status page
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center justify-end mb-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              + Create Incident
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            </div>
          ) : incidents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <div className="text-4xl mb-3">📣</div>
              <h4 className="font-medium text-foreground mb-2">No incidents</h4>
              <p className="text-sm text-muted-foreground mb-4">
                No active or recent incidents on this status page
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map(incident => (
                <div key={incident.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        incident.impact === 'critical' ? 'bg-red-100 text-red-800' :
                        incident.impact === 'major' ? 'bg-orange-100 text-orange-800' :
                        incident.impact === 'minor' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {incident.impact.toUpperCase()}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        incident.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        incident.status === 'monitoring' ? 'bg-blue-100 text-blue-800' :
                        incident.status === 'identified' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openAddUpdateModal(incident)}
                        className="rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                      >
                        Add Update
                      </button>
                      <button
                        onClick={() => handleDeleteIncident(incident.id)}
                        className="rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <h4 className="font-medium text-foreground mt-2">{incident.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created: {new Date(incident.created_at).toLocaleString()}
                    {incident.resolved_at && ` • Resolved: ${new Date(incident.resolved_at).toLocaleString()}`}
                  </p>

                  {incident.updates.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-border space-y-2">
                      {incident.updates.slice().reverse().map((update, idx) => (
                        <div key={update.id || idx} className="text-sm">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={`font-medium ${
                              update.status === 'resolved' ? 'text-green-600' :
                              update.status === 'monitoring' ? 'text-blue-600' :
                              update.status === 'identified' ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {update.status.charAt(0).toUpperCase() + update.status.slice(1)}
                            </span>
                            <span>•</span>
                            <span>{new Date(update.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-foreground mt-1">{update.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-border mt-4">
            <button
              onClick={onClose}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Nested modals */}
      <CreateStatusPageIncidentModal
        isOpen={showCreateModal}
        statusPage={statusPage}
        token={token}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchIncidents}
      />

      <AddIncidentUpdateModal
        isOpen={showUpdateModal}
        statusPage={statusPage}
        incident={selectedIncident}
        token={token}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedIncident(null);
        }}
        onSuccess={fetchIncidents}
      />
    </>
  );
};

// ============================================================
// Create Status Page Incident Modal
// ============================================================

export interface CreateStatusPageIncidentModalProps {
  isOpen: boolean;
  statusPage: StatusPage | null;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateStatusPageIncidentModal: React.FC<CreateStatusPageIncidentModalProps> = ({
  isOpen,
  statusPage,
  token,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'investigating' | 'identified' | 'monitoring' | 'resolved'>('investigating');
  const [impact, setImpact] = useState<'none' | 'minor' | 'major' | 'critical'>('major');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setStatus('investigating');
    setImpact('major');
    setMessage('');
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !statusPage || !title.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${statusPage.id}/incidents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          status,
          impact,
          message: message.trim() || `We are currently investigating this issue.`,
        }),
      });

      if (response.ok) {
        toast.success('Incident created');
        onClose();
        resetForm();
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create incident');
      }
    } catch (error) {
      console.error('Failed to create incident:', error);
      toast.error('Failed to create incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !statusPage) return null;

  return (
    <div className="fixed inset-0 z-[60] p-4 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-status-page-incident-modal-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4 sm:p-6 shadow-xl"
      >
        <h2 id="create-status-page-incident-modal-title" className="text-lg font-semibold text-foreground mb-4">Create New Incident</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Incident Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Service degradation on API endpoints"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'investigating' | 'identified' | 'monitoring' | 'resolved')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="investigating">Investigating</option>
                <option value="identified">Identified</option>
                <option value="monitoring">Monitoring</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Impact</label>
              <select
                value={impact}
                onChange={e => setImpact(e.target.value as 'none' | 'minor' | 'major' | 'critical')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="none">None</option>
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Initial Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="We are currently investigating this issue..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => {
                onClose();
                resetForm();
              }}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================
// Add Incident Update Modal
// ============================================================

export interface AddIncidentUpdateModalProps {
  isOpen: boolean;
  statusPage: StatusPage | null;
  incident: StatusPageIncident | null;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddIncidentUpdateModal: React.FC<AddIncidentUpdateModalProps> = ({
  isOpen,
  statusPage,
  incident,
  token,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<'investigating' | 'identified' | 'monitoring' | 'resolved'>('investigating');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setStatus('investigating');
    setMessage('');
  };

  useEffect(() => {
    if (isOpen && incident) {
      setStatus(incident.status);
      setMessage('');
    }
  }, [isOpen, incident]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !statusPage || !incident || !message.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${statusPage.id}/incidents/${incident.id}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          message: message.trim(),
        }),
      });

      if (response.ok) {
        toast.success('Incident updated');
        onClose();
        resetForm();
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update incident');
      }
    } catch (error) {
      console.error('Failed to update incident:', error);
      toast.error('Failed to update incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !statusPage || !incident) return null;

  return (
    <div className="fixed inset-0 z-[60] p-4 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-incident-update-modal-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4 sm:p-6 shadow-xl"
      >
        <h2 id="add-incident-update-modal-title" className="text-lg font-semibold text-foreground mb-4">Add Incident Update</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Incident: {incident.title}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">New Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as 'investigating' | 'identified' | 'monitoring' | 'resolved')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            >
              <option value="investigating">Investigating</option>
              <option value="identified">Identified</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Update Message *</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe the current status and any actions taken..."
              rows={3}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => {
                onClose();
                resetForm();
              }}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Post Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncidentManagementPanel;
