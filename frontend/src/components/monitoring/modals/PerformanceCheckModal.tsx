/**
 * PerformanceCheckModal Component
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 * Feature #127: Mobile responsive design audit and fixes
 * Feature #635: Migrated to Modal/ModalBody/ModalFooter
 *
 * Handles creating performance (Lighthouse) checks
 */

import { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';
import { PerformanceCheck } from '../types';
import { toast } from '../../../stores/toastStore';

export interface PerformanceCheckModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onPerformanceCheckCreated: (check: PerformanceCheck) => void;
}

export default function PerformanceCheckModal({
  isOpen,
  token,
  onClose,
  onPerformanceCheckCreated,
}: PerformanceCheckModalProps) {
  // Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setInterval] = useState(1800);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setName('');
    setUrl('');
    setInterval(1800);
    setDevice('desktop');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/monitoring/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          url,
          interval,
          device,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Performance check created successfully');
        onPerformanceCheckCreated(data.check);
        onClose();
      } else {
        toast.error(data.error || 'Failed to create performance check');
      }
    } catch (error) {
      console.error('Error creating performance check:', error);
      toast.error('Failed to create performance check');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={onClose} title="Create Performance Check" size="md">
      <form id="performance-form" onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Homepage Performance"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Interval</label>
              <select
                value={interval}
                onChange={e => setInterval(parseInt(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value={300}>5 min</option>
                <option value={900}>15 min</option>
                <option value={1800}>30 min</option>
                <option value={3600}>1 hour</option>
                <option value={21600}>6 hours</option>
                <option value={86400}>24 hours</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Device</label>
              <select
                value={device}
                onChange={e => setDevice(e.target.value as 'desktop' | 'mobile')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <strong>Metrics Tracked:</strong> LCP, FID, CLS, TTFB, FCP, TTI, TBT, Speed Index, Page Size, Request Count, DOM Elements
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="performance-form"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Performance Check'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
