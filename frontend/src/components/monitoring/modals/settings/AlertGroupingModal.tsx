/**
 * Alert Grouping Modal
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 * Feature #127: Mobile responsive design audit and fixes
 *
 * Handles creation and editing of alert grouping rules with:
 * - Rule name and description
 * - Group by criteria selection
 * - Time window and notification delay settings
 * - Deduplication toggle
 */

import React, { useState, useEffect } from 'react';
import { toast } from '../../../../stores/toastStore';
import type { AlertGroupingRule } from '../../types';

export interface AlertGroupingModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  editingRule: AlertGroupingRule | null;
  onSuccess: () => void;
}

type GroupByCriterion = 'check_name' | 'check_type' | 'location' | 'error_type' | 'tag';

export const AlertGroupingModal: React.FC<AlertGroupingModalProps> = ({
  isOpen,
  onClose,
  token,
  editingRule,
  onSuccess,
}) => {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByCriterion[]>(['check_type']);
  const [timeWindow, setTimeWindow] = useState(5);
  const [deduplication, setDeduplication] = useState(true);
  const [notificationDelay, setNotificationDelay] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes or editing rule changes
  useEffect(() => {
    if (isOpen && editingRule) {
      setName(editingRule.name);
      setDescription(editingRule.description || '');
      setGroupBy(editingRule.group_by);
      setTimeWindow(editingRule.time_window_minutes);
      setDeduplication(editingRule.deduplication_enabled);
      setNotificationDelay(editingRule.notification_delay_seconds);
    } else if (isOpen && !editingRule) {
      resetForm();
    }
  }, [isOpen, editingRule]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setGroupBy(['check_type']);
    setTimeWindow(5);
    setDeduplication(true);
    setNotificationDelay(30);
  };

  const toggleGroupByCriterion = (criterion: GroupByCriterion) => {
    if (groupBy.includes(criterion)) {
      setGroupBy(groupBy.filter(c => c !== criterion));
    } else {
      setGroupBy([...groupBy, criterion]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim() || groupBy.length === 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        group_by: groupBy,
        time_window_minutes: timeWindow,
        deduplication_enabled: deduplication,
        notification_delay_seconds: notificationDelay,
        max_alerts_per_group: 100,
        is_active: true,
      };

      const url = editingRule
        ? `/api/v1/monitoring/alert-grouping/rules/${editingRule.id}`
        : '/api/v1/monitoring/alert-grouping/rules';

      const response = await fetch(url, {
        method: editingRule ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingRule ? 'Alert grouping rule updated' : 'Alert grouping rule created');
        onClose();
        resetForm();
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save alert grouping rule');
      }
    } catch (error) {
      console.error('Failed to save alert grouping rule:', error);
      toast.error('Failed to save alert grouping rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-grouping-modal-title"
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4 sm:p-6 shadow-xl"
      >
        <h2 id="alert-grouping-modal-title" className="text-lg font-semibold text-foreground mb-4">
          {editingRule ? 'Edit Alert Grouping Rule' : 'Create Alert Grouping Rule'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Rule Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Group by check type"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description of this grouping rule..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Group Alerts By *</label>
            <div className="flex flex-wrap gap-2">
              {(['check_type', 'check_name', 'location', 'error_type', 'tag'] as const).map(criterion => (
                <button
                  key={criterion}
                  type="button"
                  onClick={() => toggleGroupByCriterion(criterion)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    groupBy.includes(criterion)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  {criterion.replace('_', ' ')}
                </button>
              ))}
            </div>
            {groupBy.length === 0 && (
              <p className="text-xs text-destructive mt-1">Select at least one criterion</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Time Window (minutes)</label>
              <input
                type="number"
                value={timeWindow}
                onChange={e => setTimeWindow(Number(e.target.value))}
                min={1}
                max={60}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Group alerts within this window</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notification Delay (sec)</label>
              <input
                type="number"
                value={notificationDelay}
                onChange={e => setNotificationDelay(Number(e.target.value))}
                min={0}
                max={300}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Delay to collect more alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="deduplication"
              checked={deduplication}
              onChange={e => setDeduplication(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="deduplication" className="text-sm text-foreground">
              Enable deduplication (suppress identical alerts)
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => {
                onClose();
                resetForm();
              }}
              className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || groupBy.length === 0}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingRule ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlertGroupingModal;
