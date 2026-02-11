/**
 * EscalationPolicyModal - Extracted from MonitoringPage.tsx for Feature #47
 * Feature #127: Mobile responsive design audit and fixes
 * Feature #635: Migrated to Modal/ModalBody/ModalFooter
 * Handles creation and editing of escalation policies with multi-level targets
 */

import { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '../../../ui/Modal';
import { toast } from '../../../../stores/toastStore';
import { EscalationPolicy, EscalationTarget, OnCallSchedule } from '../../types';

export interface EscalationPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  editingPolicy: EscalationPolicy | null;
  onCallSchedules: OnCallSchedule[];
  onSuccess: () => void;
}

type EscalationLevel = {
  escalate_after_minutes: number;
  targets: Omit<EscalationTarget, 'id'>[];
};

export function EscalationPolicyModal({
  isOpen,
  onClose,
  token,
  editingPolicy,
  onCallSchedules,
  onSuccess,
}: EscalationPolicyModalProps) {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [repeatPolicy, setRepeatPolicy] = useState<'once' | 'repeat_until_acknowledged'>('once');
  const [repeatInterval, setRepeatInterval] = useState(30);
  const [levels, setLevels] = useState<EscalationLevel[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when editing or reset when closed
  useEffect(() => {
    if (isOpen) {
      if (editingPolicy) {
        setName(editingPolicy.name);
        setDescription(editingPolicy.description || '');
        setIsDefault(editingPolicy.is_default);
        setRepeatPolicy(editingPolicy.repeat_policy);
        setRepeatInterval(editingPolicy.repeat_interval_minutes || 30);
        setLevels(editingPolicy.levels.map(l => ({
          escalate_after_minutes: l.escalate_after_minutes,
          targets: l.targets.map(t => ({
            type: t.type,
            user_email: t.user_email,
            user_name: t.user_name,
            schedule_id: t.schedule_id,
            webhook_url: t.webhook_url,
            phone: t.phone,
          })),
        })));
      } else {
        // Reset form for new policy
        setName('');
        setDescription('');
        setIsDefault(false);
        setRepeatPolicy('once');
        setRepeatInterval(30);
        setLevels([]);
      }
    }
  }, [editingPolicy, isOpen]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsDefault(false);
    setRepeatPolicy('once');
    setRepeatInterval(30);
    setLevels([]);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim() || levels.length === 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        is_default: isDefault,
        repeat_policy: repeatPolicy,
        repeat_interval_minutes: repeatPolicy === 'repeat_until_acknowledged' ? repeatInterval : undefined,
        levels: levels.map((level, i) => ({
          escalate_after_minutes: i === 0 ? 0 : level.escalate_after_minutes,
          targets: level.targets,
        })),
      };

      const url = editingPolicy
        ? `/api/v1/monitoring/escalation-policies/${editingPolicy.id}`
        : '/api/v1/monitoring/escalation-policies';

      const response = await fetch(url, {
        method: editingPolicy ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingPolicy ? 'Escalation policy updated' : 'Escalation policy created');
        resetForm();
        onClose();
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save escalation policy');
      }
    } catch (error) {
      console.error('Failed to save escalation policy:', error);
      toast.error('Failed to save escalation policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addLevel = () => {
    setLevels([...levels, { escalate_after_minutes: 15, targets: [] }]);
  };

  const removeLevel = (index: number) => {
    setLevels(levels.filter((_, i) => i !== index));
  };

  const addTargetToLevel = (levelIndex: number, target: Omit<EscalationTarget, 'id'>) => {
    const newLevels = [...levels];
    newLevels[levelIndex].targets.push(target);
    setLevels(newLevels);
  };

  const removeTargetFromLevel = (levelIndex: number, targetIndex: number) => {
    const newLevels = [...levels];
    newLevels[levelIndex].targets = newLevels[levelIndex].targets.filter((_, i) => i !== targetIndex);
    setLevels(newLevels);
  };

  return (
    <Modal
      isOpen
      onClose={() => {
        resetForm();
        onClose();
      }}
      title={editingPolicy ? 'Edit Escalation Policy' : 'Create Escalation Policy'}
      size="xl"
    >
      <form id="escalation-policy-form" onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Policy Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Primary Escalation"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-foreground">Set as default policy</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description of this escalation policy..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Repeat Policy</label>
              <select
                value={repeatPolicy}
                onChange={e => setRepeatPolicy(e.target.value as 'once' | 'repeat_until_acknowledged')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="once">Escalate once</option>
                <option value="repeat_until_acknowledged">Repeat until acknowledged</option>
              </select>
            </div>
            {repeatPolicy === 'repeat_until_acknowledged' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Repeat Interval (minutes)</label>
                <input
                  type="number"
                  value={repeatInterval}
                  onChange={e => setRepeatInterval(parseInt(e.target.value) || 30)}
                  min={5}
                  max={120}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-foreground">
                Escalation Levels ({levels.length})
              </label>
              <button
                type="button"
                onClick={addLevel}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                + Add Level
              </button>
            </div>

            {levels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No escalation levels. Click "Add Level" to create one.</p>
            ) : (
              <div className="space-y-4">
                {levels.map((level, levelIndex) => (
                  <EscalationLevelCard
                    key={levelIndex}
                    level={level}
                    levelIndex={levelIndex}
                    totalLevels={levels.length}
                    onCallSchedules={onCallSchedules}
                    onUpdateMinutes={(minutes) => {
                      const newLevels = [...levels];
                      newLevels[levelIndex].escalate_after_minutes = minutes;
                      setLevels(newLevels);
                    }}
                    onRemoveLevel={() => removeLevel(levelIndex)}
                    onAddTarget={(target) => addTargetToLevel(levelIndex, target)}
                    onRemoveTarget={(targetIndex) => removeTargetFromLevel(levelIndex, targetIndex)}
                  />
                ))}
              </div>
            )}
          </div>

        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="escalation-policy-form"
            disabled={isSubmitting || !name.trim() || levels.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : editingPolicy ? 'Update' : 'Create'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// Sub-component for escalation level
interface EscalationLevelCardProps {
  level: EscalationLevel;
  levelIndex: number;
  totalLevels: number;
  onCallSchedules: OnCallSchedule[];
  onUpdateMinutes: (minutes: number) => void;
  onRemoveLevel: () => void;
  onAddTarget: (target: Omit<EscalationTarget, 'id'>) => void;
  onRemoveTarget: (targetIndex: number) => void;
}

function EscalationLevelCard({
  level,
  levelIndex,
  totalLevels,
  onCallSchedules,
  onUpdateMinutes,
  onRemoveLevel,
  onAddTarget,
  onRemoveTarget,
}: EscalationLevelCardProps) {
  return (
    <div className="border border-border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary rounded-full text-sm font-bold">
            {levelIndex + 1}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Level {levelIndex + 1}</p>
            {levelIndex > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Escalate after</span>
                <input
                  type="number"
                  value={level.escalate_after_minutes}
                  onChange={e => onUpdateMinutes(parseInt(e.target.value) || 0)}
                  min={1}
                  max={120}
                  className="w-16 rounded border border-input bg-background px-2 py-1 text-xs"
                />
                <span className="text-xs text-muted-foreground">minutes</span>
              </div>
            )}
          </div>
        </div>
        {totalLevels > 1 && (
          <button
            type="button"
            onClick={onRemoveLevel}
            className="text-destructive hover:text-destructive text-sm"
          >
            ✕ Remove
          </button>
        )}
      </div>

      {/* Targets for this level */}
      <div className="mt-3">
        <p className="text-xs font-medium text-foreground mb-2">Targets ({level.targets.length})</p>
        {level.targets.length > 0 && (
          <div className="space-y-2 mb-3">
            {level.targets.map((target, targetIndex) => (
              <div key={targetIndex} className="flex items-center justify-between bg-background rounded p-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs">
                    {target.type === 'user' && '👤'}
                    {target.type === 'on_call_schedule' && '📞'}
                    {target.type === 'email' && '✉️'}
                    {target.type === 'webhook' && '🔗'}
                  </span>
                  <span className="text-sm text-foreground">
                    {target.type === 'user' && `${target.user_name} (${target.user_email})`}
                    {target.type === 'on_call_schedule' && `On-Call: ${onCallSchedules.find(s => s.id === target.schedule_id)?.name || 'Unknown'}`}
                    {target.type === 'email' && target.user_email}
                    {target.type === 'webhook' && target.webhook_url}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveTarget(targetIndex)}
                  className="text-destructive hover:text-destructive text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add target buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const name = prompt('Enter user name:');
              const email = prompt('Enter user email:');
              if (name && email) {
                onAddTarget({ type: 'user', user_name: name, user_email: email });
              }
            }}
            className="rounded px-2 py-1 text-xs bg-muted text-foreground hover:bg-muted/80"
          >
            + User
          </button>
          {onCallSchedules.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const scheduleId = prompt(`Enter schedule ID (${onCallSchedules.map(s => s.id).join(', ')}):`);
                if (scheduleId && onCallSchedules.find(s => s.id === scheduleId)) {
                  onAddTarget({ type: 'on_call_schedule', schedule_id: scheduleId });
                }
              }}
              className="rounded px-2 py-1 text-xs bg-muted text-foreground hover:bg-muted/80"
            >
              + On-Call Schedule
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const email = prompt('Enter email address:');
              if (email) {
                onAddTarget({ type: 'email', user_email: email });
              }
            }}
            className="rounded px-2 py-1 text-xs bg-muted text-foreground hover:bg-muted/80"
          >
            + Email
          </button>
          <button
            type="button"
            onClick={() => {
              const url = prompt('Enter webhook URL:');
              if (url) {
                onAddTarget({ type: 'webhook', webhook_url: url });
              }
            }}
            className="rounded px-2 py-1 text-xs bg-muted text-foreground hover:bg-muted/80"
          >
            + Webhook
          </button>
        </div>
      </div>
    </div>
  );
}

export default EscalationPolicyModal;
