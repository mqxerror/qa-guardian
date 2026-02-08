// ManagedIncidentModals - Feature #47: Extract from MonitoringPage.tsx
// All incident-related modals bundled together for modularity
// Feature #127: Mobile responsive design audit and fixes

import { useState } from 'react';
import { ManagedIncident, ManagedIncidentResponder } from '../../types';

// Helper functions
export const getIncidentStatusColor = (status: ManagedIncident['status']) => {
  switch (status) {
    case 'triggered': return 'bg-destructive/10 text-destructive';
    case 'acknowledged': return 'bg-warning/10 text-warning';
    case 'investigating': return 'bg-primary/10 text-primary';
    case 'identified': return 'bg-accent/10 text-accent';
    case 'monitoring': return 'bg-info/10 text-info';
    case 'resolved': return 'bg-success/10 text-success';
    default: return 'bg-muted text-foreground';
  }
};

export const getIncidentPriorityColor = (priority: ManagedIncident['priority']) => {
  switch (priority) {
    case 'P1': return 'bg-destructive text-white';
    case 'P2': return 'bg-warning text-white';
    case 'P3': return 'bg-warning text-white';
    case 'P4': return 'bg-primary text-white';
    case 'P5': return 'bg-muted-foreground text-white';
    default: return 'bg-muted-foreground text-white';
  }
};

// ============ Create Incident Modal ============
interface CreateManagedIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    priority: ManagedIncident['priority'];
    severity: ManagedIncident['severity'];
    tags?: string[];
    affected_services?: string[];
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function CreateManagedIncidentModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateManagedIncidentModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ManagedIncident['priority']>('P3');
  const [severity, setSeverity] = useState<ManagedIncident['severity']>('medium');
  const [tags, setTags] = useState('');
  const [affectedServices, setAffectedServices] = useState('');

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('P3');
    setSeverity('medium');
    setTags('');
    setAffectedServices('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      severity,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      affected_services: affectedServices ? affectedServices.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    });

    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-managed-incident-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4 sm:p-6 shadow-xl"
      >
        <h2 id="create-managed-incident-modal-title" className="text-lg font-semibold text-foreground mb-4">
          🔥 Declare Incident
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Incident Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="API Server Outage - US East"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the incident..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as ManagedIncident['priority'])}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - High</option>
                <option value="P3">P3 - Medium</option>
                <option value="P4">P4 - Low</option>
                <option value="P5">P5 - Minimal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as ManagedIncident['severity'])}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="database, api, production"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Affected Services (comma-separated)</label>
            <input
              type="text"
              value={affectedServices}
              onChange={e => setAffectedServices(e.target.value)}
              placeholder="user-service, auth-service, api-gateway"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex-1 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Declare Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ Incident Detail Modal ============
interface ManagedIncidentDetailModalProps {
  isOpen: boolean;
  incident: ManagedIncident | null;
  onClose: () => void;
  onUpdateStatus: (incidentId: string, newStatus: ManagedIncident['status']) => Promise<void>;
  onAddNote: (incidentId: string, content: string, visibility: 'internal' | 'public') => Promise<void>;
  onOpenResolveModal: () => void;
  onOpenAssignResponderModal: () => void;
}

export function ManagedIncidentDetailModal({
  isOpen,
  incident,
  onClose,
  onUpdateStatus,
  onAddNote,
  onOpenResolveModal,
  onOpenAssignResponderModal,
}: ManagedIncidentDetailModalProps) {
  const [noteContent, setNoteContent] = useState('');
  const [noteVisibility, setNoteVisibility] = useState<'internal' | 'public'>('internal');

  const handleAddNote = async () => {
    if (!incident || !noteContent.trim()) return;
    await onAddNote(incident.id, noteContent, noteVisibility);
    setNoteContent('');
  };

  if (!isOpen || !incident) return null;

  return (
    <div className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="managed-incident-detail-modal-title"
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4 sm:p-6 shadow-xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${getIncidentPriorityColor(incident.priority)}`}>
                {incident.priority}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded ${getIncidentStatusColor(incident.status)}`}>
                {incident.status}
              </span>
            </div>
            <h2 id="managed-incident-detail-modal-title" className="text-xl font-semibold text-foreground">{incident.title}</h2>
            {incident.description && (
              <p className="text-muted-foreground mt-1">{incident.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Status Actions */}
        {incident.status !== 'resolved' && (
          <div className="flex flex-wrap gap-2 mb-6 p-4 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground mr-2">Update Status:</span>
            {['acknowledged', 'investigating', 'identified', 'monitoring'].map(status => (
              <button
                key={status}
                onClick={() => onUpdateStatus(incident.id, status as ManagedIncident['status'])}
                disabled={incident.status === status}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  incident.status === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-input hover:bg-muted'
                }`}
              >
                {status}
              </button>
            ))}
            <button
              onClick={onOpenResolveModal}
              className="px-3 py-1 text-xs rounded-full bg-success text-white hover:bg-success"
            >
              Resolve
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Info & Responders */}
          <div className="space-y-6">
            {/* Info */}
            <div className="p-4 rounded-lg border border-border">
              <h3 className="font-medium text-foreground mb-3">Incident Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Severity:</span>
                  <span className="text-foreground">{incident.severity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source:</span>
                  <span className="text-foreground">{incident.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="text-foreground">{new Date(incident.created_at).toLocaleString()}</span>
                </div>
                {incident.acknowledged_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Acknowledged:</span>
                    <span className="text-foreground">{new Date(incident.acknowledged_at).toLocaleString()}</span>
                  </div>
                )}
                {incident.resolved_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolved:</span>
                    <span className="text-foreground">{new Date(incident.resolved_at).toLocaleString()}</span>
                  </div>
                )}
                {incident.time_to_acknowledge_seconds && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time to Acknowledge:</span>
                    <span className="text-foreground">{Math.round(incident.time_to_acknowledge_seconds / 60)} min</span>
                  </div>
                )}
                {incident.time_to_resolve_seconds && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time to Resolve:</span>
                    <span className="text-foreground">{Math.round(incident.time_to_resolve_seconds / 60)} min</span>
                  </div>
                )}
              </div>
            </div>

            {/* Responders */}
            <div className="p-4 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-foreground">Responders</h3>
                {incident.status !== 'resolved' && (
                  <button
                    onClick={onOpenAssignResponderModal}
                    className="text-xs text-primary hover:underline"
                  >
                    + Assign
                  </button>
                )}
              </div>
              {incident.responders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No responders assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {incident.responders.map(responder => (
                    <div key={responder.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <div>
                        <span className="text-sm font-medium text-foreground">{responder.user_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({responder.role})</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{responder.user_email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resolution (if resolved) */}
            {incident.status === 'resolved' && incident.resolution_summary && (
              <div className="p-4 rounded-lg border border-success/30 bg-success/5">
                <h3 className="font-medium text-success mb-2">Resolution</h3>
                <p className="text-sm text-success">{incident.resolution_summary}</p>
                {incident.postmortem_url && (
                  <a
                    href={incident.postmortem_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm text-success hover:underline"
                  >
                    📄 View Postmortem
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right column - Notes & Timeline */}
          <div className="space-y-6">
            {/* Add Note */}
            {incident.status !== 'resolved' && (
              <div className="p-4 rounded-lg border border-border">
                <h3 className="font-medium text-foreground mb-3">Add Note</h3>
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder="Add investigation notes, updates, or findings..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm"
                />
                <div className="flex items-center justify-between mt-2">
                  <select
                    value={noteVisibility}
                    onChange={e => setNoteVisibility(e.target.value as 'internal' | 'public')}
                    className="text-xs rounded border border-input bg-background px-2 py-1"
                  >
                    <option value="internal">Internal only</option>
                    <option value="public">Public (visible on status page)</option>
                  </select>
                  <button
                    onClick={handleAddNote}
                    disabled={!noteContent.trim()}
                    className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Add Note
                  </button>
                </div>
              </div>
            )}

            {/* Notes */}
            {incident.notes.length > 0 && (
              <div className="p-4 rounded-lg border border-border">
                <h3 className="font-medium text-foreground mb-3">Notes ({incident.notes.length})</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {incident.notes.map(note => (
                    <div key={note.id} className="p-3 rounded bg-muted/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">{note.author_name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${note.visibility === 'public' ? 'bg-success/10 text-success' : 'bg-muted text-foreground'}`}>
                            {note.visibility}
                          </span>
                          <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="p-4 rounded-lg border border-border">
              <h3 className="font-medium text-foreground mb-3">Timeline ({incident.timeline.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {incident.timeline.map(event => (
                  <div key={event.id} className="flex gap-3 text-sm">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                    <span className="text-foreground">{event.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Assign Responder Modal ============
interface AssignResponderModalProps {
  isOpen: boolean;
  incidentId: string | null;
  onClose: () => void;
  onAssign: (incidentId: string, name: string, email: string, role: ManagedIncidentResponder['role']) => Promise<void>;
}

export function AssignResponderModal({
  isOpen,
  incidentId,
  onClose,
  onAssign,
}: AssignResponderModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ManagedIncidentResponder['role']>('primary');

  const handleClose = () => {
    setName('');
    setEmail('');
    setRole('primary');
    onClose();
  };

  const handleAssign = async () => {
    if (!incidentId || !name.trim() || !email.trim()) return;
    await onAssign(incidentId, name, email, role);
    handleClose();
  };

  if (!isOpen || !incidentId) return null;

  return (
    <div className="fixed inset-0 z-[60] p-4 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-responder-modal-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4 sm:p-6 shadow-xl"
      >
        <h2 id="assign-responder-modal-title" className="text-lg font-semibold text-foreground mb-4">Assign Responder</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as ManagedIncidentResponder['role'])}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="observer">Observer</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!name.trim() || !email.trim()}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Assign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Resolve Incident Modal ============
interface ResolveIncidentModalProps {
  isOpen: boolean;
  incidentId: string | null;
  onClose: () => void;
  onResolve: (incidentId: string, resolutionSummary: string, postmortemUrl?: string, postmortemCompleted?: boolean) => Promise<void>;
}

export function ResolveIncidentModal({
  isOpen,
  incidentId,
  onClose,
  onResolve,
}: ResolveIncidentModalProps) {
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [postmortemUrl, setPostmortemUrl] = useState('');
  const [postmortemCompleted, setPostmortemCompleted] = useState(false);

  const handleClose = () => {
    setResolutionSummary('');
    setPostmortemUrl('');
    setPostmortemCompleted(false);
    onClose();
  };

  const handleResolve = async () => {
    if (!incidentId || !resolutionSummary.trim()) return;
    await onResolve(incidentId, resolutionSummary, postmortemUrl || undefined, postmortemCompleted);
    handleClose();
  };

  if (!isOpen || !incidentId) return null;

  return (
    <div className="fixed inset-0 z-[60] p-4 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolve-incident-modal-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4 sm:p-6 shadow-xl"
      >
        <h2 id="resolve-incident-modal-title" className="text-lg font-semibold text-foreground mb-4">Resolve Incident</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Resolution Summary *</label>
            <textarea
              value={resolutionSummary}
              onChange={e => setResolutionSummary(e.target.value)}
              placeholder="Describe how the incident was resolved..."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Postmortem URL</label>
            <input
              type="url"
              value={postmortemUrl}
              onChange={e => setPostmortemUrl(e.target.value)}
              placeholder="https://docs.company.com/postmortems/inc-123"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="postmortemCompleted"
              checked={postmortemCompleted}
              onChange={e => setPostmortemCompleted(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="postmortemCompleted" className="text-sm text-foreground">
              Postmortem has been completed
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={!resolutionSummary.trim()}
              className="flex-1 rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success disabled:opacity-50"
            >
              Resolve Incident
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
