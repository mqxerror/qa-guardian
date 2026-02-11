/**
 * On-Call Schedule Modal
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 * Feature #127: Mobile responsive design audit and fixes
 * Feature #635: Migrated to Modal/ModalBody/ModalFooter
 *
 * Handles creation and editing of on-call schedules with:
 * - Schedule name, description, timezone
 * - Rotation type (daily/weekly/custom) and interval
 * - Team member management
 */

import React, { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '../../../ui/Modal';
import { toast } from '../../../../stores/toastStore';
import type { OnCallSchedule, OnCallMember } from '../../types';

export interface OnCallScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  editingSchedule: OnCallSchedule | null;
  onSuccess: () => void;
}

export const OnCallScheduleModal: React.FC<OnCallScheduleModalProps> = ({
  isOpen,
  onClose,
  token,
  editingSchedule,
  onSuccess,
}) => {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [rotationType, setRotationType] = useState<'daily' | 'weekly' | 'custom'>('weekly');
  const [rotationInterval, setRotationInterval] = useState(7);
  const [members, setMembers] = useState<OnCallMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New member form state
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  // Reset form when modal opens/closes or editing schedule changes
  useEffect(() => {
    if (isOpen && editingSchedule) {
      setName(editingSchedule.name);
      setDescription(editingSchedule.description || '');
      setTimezone(editingSchedule.timezone);
      setRotationType(editingSchedule.rotation_type);
      setRotationInterval(editingSchedule.rotation_interval_days);
      setMembers([...editingSchedule.members]);
    } else if (isOpen && !editingSchedule) {
      resetForm();
    }
  }, [isOpen, editingSchedule]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setTimezone('UTC');
    setRotationType('weekly');
    setRotationInterval(7);
    setMembers([]);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
  };

  const addMember = () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    const newMember: OnCallMember = {
      id: `temp-${Date.now()}`,
      user_id: `temp-user-${Date.now()}`,
      user_name: newMemberName.trim(),
      user_email: newMemberEmail.trim(),
      phone: newMemberPhone.trim() || undefined,
      order: members.length,
    };
    setMembers([...members, newMember]);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
  };

  const removeMember = (memberId: string) => {
    setMembers(members.filter(m => m.id !== memberId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        timezone,
        rotation_type: rotationType,
        rotation_interval_days: rotationInterval,
        members: members.map((m, index) => ({
          user_name: m.user_name,
          user_email: m.user_email,
          phone: m.phone,
          order: index,
        })),
      };

      const url = editingSchedule
        ? `/api/v1/monitoring/on-call/${editingSchedule.id}`
        : '/api/v1/monitoring/on-call';

      const response = await fetch(url, {
        method: editingSchedule ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingSchedule ? 'On-call schedule updated' : 'On-call schedule created');
        onClose();
        resetForm();
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save on-call schedule');
      }
    } catch (error) {
      console.error('Failed to save on-call schedule:', error);
      toast.error('Failed to save on-call schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={() => {
        onClose();
        resetForm();
      }}
      title={editingSchedule ? 'Edit On-Call Schedule' : 'Create On-Call Schedule'}
      size="lg"
    >
      <form id="on-call-schedule-form" onSubmit={handleSubmit} noValidate>
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Schedule Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Primary On-Call"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description of this on-call schedule..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Rotation Type</label>
              <select
                value={rotationType}
                onChange={e => {
                  const type = e.target.value as 'daily' | 'weekly' | 'custom';
                  setRotationType(type);
                  if (type === 'daily') setRotationInterval(1);
                  else if (type === 'weekly') setRotationInterval(7);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Rotation Interval (days)</label>
              <input
                type="number"
                value={rotationInterval}
                onChange={e => setRotationInterval(parseInt(e.target.value) || 1)}
                min={1}
                max={90}
                disabled={rotationType !== 'custom'}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground disabled:opacity-50"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              Team Members ({members.length})
            </label>

            {/* Add member form */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <input
                type="text"
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                placeholder="Name"
                className="rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm"
              />
              <input
                type="email"
                value={newMemberEmail}
                onChange={e => setNewMemberEmail(e.target.value)}
                placeholder="Email"
                className="rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm"
              />
              <input
                type="tel"
                value={newMemberPhone}
                onChange={e => setNewMemberPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm"
              />
              <button
                type="button"
                onClick={addMember}
                disabled={!newMemberName.trim() || !newMemberEmail.trim()}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
            </div>

            {/* Members list */}
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members added yet. Add at least one member.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-2">
                {members.map((member, index) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded-full text-xs font-medium">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.user_name}</p>
                        <p className="text-xs text-muted-foreground">{member.user_email} {member.phone && `• ${member.phone}`}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      className="text-destructive hover:text-destructive text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </ModalBody>
        <ModalFooter>
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
            form="on-call-schedule-form"
            disabled={isSubmitting || !name.trim() || members.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : editingSchedule ? 'Update' : 'Create'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default OnCallScheduleModal;
