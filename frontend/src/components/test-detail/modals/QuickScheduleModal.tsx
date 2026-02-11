// QuickScheduleModal - Extracted from TestDetailPage.tsx
// Feature #48: Split TestDetailPage.tsx into modular components
// Feature #633: Migrated to Modal/ModalHeader/ModalBody/ModalFooter

import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';

interface QuickScheduleModalProps {
 show: boolean;
 testName: string;
 isCreating: boolean;
 error: string;
 onClose: () => void;
 onSubmit: (data: {
 name: string;
 type: 'recurring' | 'one-time';
 cron: string;
 runAt: string;
 timezone: string;
 }) => void;
}

export function QuickScheduleModal({
 show,
 testName,
 isCreating,
 error,
 onClose,
 onSubmit,
}: QuickScheduleModalProps) {
 const [name, setName] = useState('');
 const [type, setType] = useState<'recurring' | 'one-time'>('recurring');
 const [cron, setCron] = useState('0 9 * * *');
 const [runAt, setRunAt] = useState('');
 const [timezone, setTimezone] = useState('America/New_York');

 if (!show) return null;

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 onSubmit({
 name: name || `${testName} Schedule`,
 type,
 cron,
 runAt,
 timezone,
 });
 };

 return (
 <Modal isOpen onClose={onClose} title="Schedule Test" size="lg" closeOnBackdrop={!isCreating}>
 {/* Custom Header with icon */}
 <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-border">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
 <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 </div>
 <h2 className="text-lg font-semibold text-foreground">Schedule Test</h2>
 </div>
 <ModalBody>
 <p className="text-muted-foreground mb-4">
 Create a schedule to run "{testName}" automatically.
 </p>

 {error && (
 <div role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} id="quick-schedule-form" className="space-y-4">
 {/* Schedule Name */}
 <div>
 <label htmlFor="quick-schedule-name" className="mb-1 block text-sm font-medium text-foreground">
 Schedule Name
 </label>
 <input
 id="quick-schedule-name"
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder={`${testName} Schedule`}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
 />
 </div>

 {/* Schedule Type */}
 <div>
 <span className="mb-2 block text-sm font-medium text-foreground">Schedule Type</span>
 <div className="flex gap-4">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="quickScheduleType"
 checked={type === 'recurring'}
 onChange={() => setType('recurring')}
 className="h-4 w-4"
 />
 <span className="text-sm text-foreground">Recurring</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="quickScheduleType"
 checked={type === 'one-time'}
 onChange={() => setType('one-time')}
 className="h-4 w-4"
 />
 <span className="text-sm text-foreground">One-time</span>
 </label>
 </div>
 </div>

 {/* Schedule Frequency/Time */}
 {type === 'recurring' ? (
 <div>
 <label className="mb-2 block text-sm font-medium text-foreground">Frequency</label>
 <div className="flex flex-wrap gap-2 mb-2">
 {[
 { cronValue: '0 * * * *', label: 'Hourly' },
 { cronValue: '0 9 * * *', label: 'Daily (9 AM)' },
 { cronValue: '0 2 * * *', label: 'Nightly (2 AM)' },
 { cronValue: '0 9 * * 1', label: 'Weekly (Mon)' },
 ].map(({ cronValue, label }) => (
 <button
 key={cronValue}
 type="button"
 onClick={() => setCron(cronValue)}
 className={`rounded-md px-3 py-1.5 text-sm border transition-colors ${
 cron === cronValue
 ? 'bg-primary text-primary-foreground border-primary'
 : 'bg-background text-foreground border-border hover:border-primary'
 }`}
 >
 {label}
 </button>
 ))}
 </div>
 <div className="mt-3">
 <label htmlFor="quick-schedule-cron" className="mb-1 block text-sm text-muted-foreground">
 Custom cron expression
 </label>
 <input
 id="quick-schedule-cron"
 type="text"
 value={cron}
 onChange={(e) => setCron(e.target.value)}
 placeholder="0 2 * * *"
 className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground"
 />
 <p className="mt-1 text-xs text-muted-foreground">
 Format: minute hour day month weekday (e.g., "0 2 * * *" = every night at 2 AM)
 </p>
 </div>
 </div>
 ) : (
 <div>
 <label htmlFor="quick-schedule-datetime" className="mb-1 block text-sm font-medium text-foreground">
 Run At
 </label>
 <input
 id="quick-schedule-datetime"
 type="datetime-local"
 value={runAt}
 onChange={(e) => setRunAt(e.target.value)}
 required={type === 'one-time'}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
 />
 </div>
 )}

 {/* Timezone */}
 <div>
 <label htmlFor="quick-schedule-timezone" className="mb-1 block text-sm font-medium text-foreground">
 Timezone
 </label>
 <select
 id="quick-schedule-timezone"
 value={timezone}
 onChange={(e) => setTimezone(e.target.value)}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
 >
 <option value="America/New_York">America/New_York (ET)</option>
 <option value="America/Chicago">America/Chicago (CT)</option>
 <option value="America/Denver">America/Denver (MT)</option>
 <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
 <option value="Europe/London">Europe/London (GMT)</option>
 <option value="Europe/Paris">Europe/Paris (CET)</option>
 <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
 <option value="UTC">UTC</option>
 </select>
 </div>

 </form>
 </ModalBody>
 {/* Action Buttons */}
 <ModalFooter>
 <button
 type="button"
 onClick={onClose}
 disabled={isCreating}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
 >
 Cancel
 </button>
 <button
 type="submit"
 form="quick-schedule-form"
 disabled={isCreating || (type === 'one-time' && !runAt)}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isCreating ? 'Creating...' : 'Create Schedule'}
 </button>
 </ModalFooter>
 </Modal>
 );
}
