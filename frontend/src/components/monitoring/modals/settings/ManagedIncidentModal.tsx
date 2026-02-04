// ManagedIncidentModal - Feature #47: Extract from MonitoringPage.tsx
// Modal for creating new managed incidents

import { useState } from 'react';
import { ManagedIncident } from '../../types';

interface ManagedIncidentModalProps {
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

export function ManagedIncidentModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: ManagedIncidentModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          🔥 Declare Incident
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Declare Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
