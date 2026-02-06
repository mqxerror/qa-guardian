/**
 * Status Page Modal
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 * Feature #127: Mobile responsive design audit and fixes
 *
 * Handles creation and editing of public status pages with:
 * - Name, slug, description
 * - Brand color and visibility options
 * - Check selection for display
 */

import React, { useState, useEffect } from 'react';
import { toast } from '../../../../stores/toastStore';
import type { StatusPage, AvailableCheck } from '../../types';

export interface StatusPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  editingStatusPage: StatusPage | null;
  availableChecks: AvailableCheck[];
  onSuccess: () => void;
}

export const StatusPageModal: React.FC<StatusPageModalProps> = ({
  isOpen,
  onClose,
  token,
  editingStatusPage,
  availableChecks,
  onSuccess,
}) => {
  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2563EB');
  const [isPublic, setIsPublic] = useState(true);
  const [showUptime, setShowUptime] = useState(true);
  const [showResponseTime, setShowResponseTime] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [selectedChecks, setSelectedChecks] = useState<{ id: string; type: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes or editing status page changes
  useEffect(() => {
    if (isOpen && editingStatusPage) {
      setName(editingStatusPage.name);
      setSlug(editingStatusPage.slug);
      setDescription(editingStatusPage.description || '');
      setColor(editingStatusPage.primary_color || '#2563EB');
      setIsPublic(editingStatusPage.is_public);
      setShowUptime(editingStatusPage.show_uptime_percentage);
      setShowResponseTime(editingStatusPage.show_response_time);
      setShowIncidents(editingStatusPage.show_incidents);
      // Map checks back to selected format
      const selected = editingStatusPage.checks.map(c => {
        const check = availableChecks.find(ac => ac.id === c.check_id);
        return { id: c.check_id, type: c.check_type, name: check?.name || c.display_name || 'Unknown' };
      });
      setSelectedChecks(selected);
    } else if (isOpen && !editingStatusPage) {
      resetForm();
    }
  }, [isOpen, editingStatusPage, availableChecks]);

  const resetForm = () => {
    setName('');
    setSlug('');
    setDescription('');
    setColor('#2563EB');
    setIsPublic(true);
    setShowUptime(true);
    setShowResponseTime(true);
    setShowIncidents(true);
    setSelectedChecks([]);
  };

  const toggleCheck = (check: AvailableCheck) => {
    setSelectedChecks(prev => {
      const exists = prev.find(c => c.id === check.id);
      if (exists) {
        return prev.filter(c => c.id !== check.id);
      } else {
        return [...prev, { id: check.id, type: check.type, name: check.name }];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        custom_slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        primary_color: color,
        is_public: isPublic,
        show_uptime_percentage: showUptime,
        show_response_time: showResponseTime,
        show_incidents: showIncidents,
        checks: selectedChecks.map((c, index) => ({
          check_id: c.id,
          check_type: c.type as 'uptime' | 'transaction' | 'performance' | 'dns' | 'tcp',
          order: index,
        })),
      };

      const url = editingStatusPage
        ? `/api/v1/monitoring/status-pages/${editingStatusPage.id}`
        : '/api/v1/monitoring/status-pages';
      const method = editingStatusPage ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingStatusPage ? 'Status page updated' : 'Status page created');
        onClose();
        resetForm();
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save status page');
      }
    } catch (error) {
      console.error('Failed to save status page:', error);
      toast.error('Failed to save status page');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-page-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4 sm:p-6 shadow-xl"
      >
        <h2 id="status-page-modal-title" className="text-lg font-semibold text-foreground mb-4">
          {editingStatusPage ? 'Edit Status Page' : 'Create Status Page'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="My Service Status"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">URL Slug</label>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-1">/status/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="my-service"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Leave empty to auto-generate from name</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Current status of our services..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Brand Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-10 h-10 rounded border border-input cursor-pointer"
                />
                <input
                  type="text"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-foreground">Public (accessible without login)</span>
              </label>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="block text-sm font-medium text-foreground mb-2">Display Options</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showUptime}
                  onChange={e => setShowUptime(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-foreground">Show uptime %</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showResponseTime}
                  onChange={e => setShowResponseTime(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-foreground">Show response time</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showIncidents}
                  onChange={e => setShowIncidents(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-foreground">Show incidents</span>
              </label>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Checks to Display ({selectedChecks.length} selected)
            </label>
            {availableChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No checks available. Create some monitoring checks first.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-2">
                {availableChecks.map(check => (
                  <label
                    key={check.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChecks.some(c => c.id === check.id)}
                      onChange={() => toggleCheck(check)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-sm">
                      {check.type === 'uptime' && '🌐'}
                      {check.type === 'transaction' && '🔄'}
                      {check.type === 'performance' && '⚡'}
                      {check.type === 'dns' && '🌍'}
                      {check.type === 'tcp' && '🔌'}
                    </span>
                    <span className="text-sm text-foreground">{check.name}</span>
                    <span className="text-xs text-muted-foreground">({check.type})</span>
                    {!check.enabled && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">disabled</span>
                    )}
                  </label>
                ))}
              </div>
            )}
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
              disabled={isSubmitting || !name.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingStatusPage ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StatusPageModal;
