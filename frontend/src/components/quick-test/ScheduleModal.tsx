/**
 * ScheduleModal - Schedule recurring Quick Test
 * Feature #514: Extracted from QuickTestPage.tsx
 */

import {
  Loader2,
  X,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Bell,
  BellOff,
} from 'lucide-react';

interface ScheduleModalProps {
  isOpen: boolean;
  url: string;
  frequency: '1h' | '6h' | '12h' | '24h' | 'weekly';
  notifyOnDrop: boolean;
  threshold: number;
  isSubmitting: boolean;
  error: string | null;
  success: boolean;
  onFrequencyChange: (freq: '1h' | '6h' | '12h' | '24h' | 'weekly') => void;
  onNotifyChange: (notify: boolean) => void;
  onThresholdChange: (threshold: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function ScheduleModal({
  isOpen,
  url,
  frequency,
  notifyOnDrop,
  threshold,
  isSubmitting,
  error,
  success,
  onFrequencyChange,
  onNotifyChange,
  onThresholdChange,
  onSubmit,
  onClose,
}: ScheduleModalProps) {
  if (!isOpen) return null;

  const frequencies = [
    { value: '1h' as const, label: 'Every Hour' },
    { value: '6h' as const, label: 'Every 6 Hours' },
    { value: '12h' as const, label: 'Every 12 Hours' },
    { value: '24h' as const, label: 'Daily' },
    { value: 'weekly' as const, label: 'Weekly' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Schedule Recurring Test</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* URL Display */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">URL to Monitor</label>
            <div className="mt-1 p-2 rounded bg-muted text-sm font-mono truncate" title={url}>
              {url}
            </div>
          </div>

          {/* Frequency Selection */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Check Frequency</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {frequencies.map((freq) => (
                <button
                  key={freq.value}
                  onClick={() => onFrequencyChange(freq.value)}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    frequency === freq.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notification Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {notifyOnDrop ? (
                <Bell className="w-4 h-4 text-primary" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Alert on Score Drop</span>
            </div>
            <button
              onClick={() => onNotifyChange(!notifyOnDrop)}
              className={`w-12 h-6 rounded-full transition-colors ${
                notifyOnDrop ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                  notifyOnDrop ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Threshold Input */}
          {notifyOnDrop && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Alert Threshold (score below)
              </label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="5"
                  value={threshold}
                  onChange={(e) => onThresholdChange(parseInt(e.target.value, 10))}
                  className="flex-1"
                />
                <span className="w-10 text-center font-medium text-foreground">{threshold}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm p-2 rounded bg-destructive/10">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 text-success text-sm p-2 rounded bg-success/10">
              <CheckCircle2 className="w-4 h-4" />
              Schedule created successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting || success}
            className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Created!
              </>
            ) : (
              <>
                <CalendarClock className="w-4 h-4" />
                Create Schedule
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
