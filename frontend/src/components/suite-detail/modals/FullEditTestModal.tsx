/**
 * FullEditTestModal Component
 * Feature #595: Full-featured Edit Test modal
 * Feature #634: Migrated to Modal/ModalBody/ModalFooter
 *
 * A comprehensive test editing modal that allows modifying all test configuration
 * fields, shows a diff preview of changes, and saves via PATCH /api/v1/tests/:id
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Save, AlertCircle, Eye, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';
import type { TestType as Test, TestStep } from '../types';
import { type BrowserType } from '../../create-test/config/E2EConfig';
import { useAuthStore } from '../../../stores/authStore';

/**
 * Props for FullEditTestModal
 */
export interface FullEditTestModalProps {
  /** The test to edit */
  test: Test;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called after successful save */
  onSaved?: (updatedTest: Test) => void;
  /** Suite ID for cache invalidation */
  suiteId?: string;
}

/**
 * Change entry for diff preview
 */
interface ChangeEntry {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

/**
 * Editable test fields
 */
interface EditableFields {
  name: string;
  description: string;
  target_url: string;
  steps?: TestStep[];
  // E2E fields
  timeout?: number;
  retries?: number;
  browsers?: BrowserType[];
  // Visual fields
  viewport_width?: number;
  viewport_height?: number;
  diff_threshold?: number;
  capture_mode?: 'full_page' | 'viewport' | 'element';
  element_selector?: string;
  wait_for_selector?: string;
  wait_time?: number;
  // Performance fields
  device_preset?: 'mobile' | 'desktop';
  performance_threshold?: number;
  lcp_threshold?: number;
  cls_threshold?: number;
  bypass_csp?: boolean;
  ignore_ssl_errors?: boolean;
  audit_timeout?: number;
  // Accessibility fields
  wcag_level?: 'A' | 'AA' | 'AAA';
  include_best_practices?: boolean;
  include_experimental?: boolean;
  include_pa11y?: boolean;
  // Load fields
  virtual_users?: number;
  duration?: number;
  ramp_up_time?: number;
  k6_script?: string;
}

/**
 * Format value for display in diff
 */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '(not set)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '(none)';
    // For steps, show count
    if (value[0]?.action !== undefined) return `${value.length} step(s)`;
    return value.join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Map test type to display name
 */
const TEST_TYPE_LABELS: Record<string, string> = {
  e2e: 'E2E Test',
  visual_regression: 'Visual Regression',
  lighthouse: 'Performance (Lighthouse)',
  load: 'Load Test',
  accessibility: 'Accessibility',
};

/**
 * FullEditTestModal - Comprehensive test editing modal
 */
export const FullEditTestModal: React.FC<FullEditTestModalProps> = ({
  test,
  onClose,
  onSaved,
}) => {
  const token = useAuthStore(state => state.token);

  // Form state
  const [fields, setFields] = useState<EditableFields>(() => ({
    name: test.name,
    description: test.description || '',
    target_url: test.target_url || '',
    steps: test.steps,
    timeout: 30000,
    retries: 0,
    browsers: ['chromium'],
    viewport_width: test.viewport_width,
    viewport_height: test.viewport_height,
    diff_threshold: test.diff_threshold,
    capture_mode: test.capture_mode,
    element_selector: test.element_selector,
    wait_for_selector: test.wait_for_selector,
    wait_time: test.wait_time,
    device_preset: test.device_preset,
    performance_threshold: test.performance_threshold,
    lcp_threshold: test.lcp_threshold,
    cls_threshold: test.cls_threshold,
    bypass_csp: test.bypass_csp,
    ignore_ssl_errors: test.ignore_ssl_errors,
    audit_timeout: test.audit_timeout,
    wcag_level: test.wcag_level,
    include_best_practices: test.include_best_practices,
    include_experimental: test.include_experimental,
    include_pa11y: test.include_pa11y,
    virtual_users: test.virtual_users,
    duration: test.duration,
    ramp_up_time: test.ramp_up_time,
    k6_script: test.k6_script,
  }));

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate changes
  const changes = useMemo<ChangeEntry[]>(() => {
    const result: ChangeEntry[] = [];

    // Compare basic fields
    if (fields.name !== test.name) {
      result.push({ field: 'name', label: 'Test Name', oldValue: test.name, newValue: fields.name });
    }
    if (fields.description !== (test.description || '')) {
      result.push({ field: 'description', label: 'Description', oldValue: test.description || '', newValue: fields.description });
    }
    if (fields.target_url !== (test.target_url || '')) {
      result.push({ field: 'target_url', label: 'Target URL', oldValue: test.target_url || '', newValue: fields.target_url });
    }

    // Compare type-specific fields based on test type
    const testType = test.type || test.test_type;

    if (testType === 'e2e') {
      if (JSON.stringify(fields.steps) !== JSON.stringify(test.steps)) {
        result.push({ field: 'steps', label: 'Test Steps', oldValue: formatValue(test.steps), newValue: formatValue(fields.steps) });
      }
    }

    if (testType === 'visual_regression') {
      if (fields.viewport_width !== test.viewport_width) {
        result.push({ field: 'viewport_width', label: 'Viewport Width', oldValue: formatValue(test.viewport_width), newValue: formatValue(fields.viewport_width) });
      }
      if (fields.viewport_height !== test.viewport_height) {
        result.push({ field: 'viewport_height', label: 'Viewport Height', oldValue: formatValue(test.viewport_height), newValue: formatValue(fields.viewport_height) });
      }
      if (fields.diff_threshold !== test.diff_threshold) {
        result.push({ field: 'diff_threshold', label: 'Diff Threshold', oldValue: formatValue(test.diff_threshold), newValue: formatValue(fields.diff_threshold) });
      }
      if (fields.capture_mode !== test.capture_mode) {
        result.push({ field: 'capture_mode', label: 'Capture Mode', oldValue: formatValue(test.capture_mode), newValue: formatValue(fields.capture_mode) });
      }
    }

    if (testType === 'lighthouse') {
      if (fields.device_preset !== test.device_preset) {
        result.push({ field: 'device_preset', label: 'Device Preset', oldValue: formatValue(test.device_preset), newValue: formatValue(fields.device_preset) });
      }
      if (fields.performance_threshold !== test.performance_threshold) {
        result.push({ field: 'performance_threshold', label: 'Performance Threshold', oldValue: formatValue(test.performance_threshold), newValue: formatValue(fields.performance_threshold) });
      }
    }

    if (testType === 'accessibility') {
      if (fields.wcag_level !== test.wcag_level) {
        result.push({ field: 'wcag_level', label: 'WCAG Level', oldValue: formatValue(test.wcag_level), newValue: formatValue(fields.wcag_level) });
      }
    }

    if (testType === 'load') {
      if (fields.virtual_users !== test.virtual_users) {
        result.push({ field: 'virtual_users', label: 'Virtual Users', oldValue: formatValue(test.virtual_users), newValue: formatValue(fields.virtual_users) });
      }
      if (fields.duration !== test.duration) {
        result.push({ field: 'duration', label: 'Duration', oldValue: formatValue(test.duration), newValue: formatValue(fields.duration) });
      }
    }

    return result;
  }, [fields, test]);

  const hasChanges = changes.length > 0;

  // Update field
  const updateField = useCallback(<K extends keyof EditableFields>(
    field: K,
    value: EditableFields[K]
  ) => {
    setFields(prev => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  // Handle save
  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    // Validate required fields
    if (!fields.name.trim()) {
      setError('Test name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build update payload with only changed fields
      const payload: Record<string, unknown> = {};
      for (const change of changes) {
        payload[change.field] = fields[change.field as keyof EditableFields];
      }

      const response = await fetch(`/api/v1/tests/${test.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update test: ${response.status}`);
      }

      const data = await response.json();
      onSaved?.(data.test);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update test');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSaving]);

  const testType = test.type || test.test_type;

  return (
    <Modal isOpen onClose={onClose} title="Edit Test" size="xl" closeOnBackdrop={!isSaving}>
      {/* Custom Header with icon */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Edit2 className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Edit Test</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {TEST_TYPE_LABELS[testType || ''] || testType}
          </p>
        </div>
      </div>
      <ModalBody className="space-y-6">
        {/* Basic Fields */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Basic Information</h3>

            {/* Test Name */}
            <div className="space-y-1">
              <label htmlFor="edit-name" className="block text-sm font-medium text-foreground">
                Test Name <span className="text-destructive">*</span>
              </label>
              <input
                id="edit-name"
                type="text"
                value={fields.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Enter test name"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label htmlFor="edit-description" className="block text-sm font-medium text-foreground">
                Description
              </label>
              <textarea
                id="edit-description"
                value={fields.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                placeholder="Describe what this test does..."
              />
            </div>

            {/* Target URL */}
            <div className="space-y-1">
              <label htmlFor="edit-url" className="block text-sm font-medium text-foreground">
                Target URL
              </label>
              <input
                id="edit-url"
                type="url"
                value={fields.target_url}
                onChange={(e) => updateField('target_url', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="https://your-site.com"
              />
            </div>
          </div>

          {/* Type-Specific Fields */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Type-Specific Settings
            </button>

            {showAdvanced && (
              <div className="pl-4 border-l-2 border-border space-y-4">
                {/* E2E Fields */}
                {testType === 'e2e' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      E2E test configuration. Edit steps on the test detail page.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-foreground">Timeout (ms)</label>
                        <input
                          type="number"
                          value={fields.timeout || 30000}
                          onChange={(e) => updateField('timeout', parseInt(e.target.value) || 30000)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-foreground">Retries</label>
                        <input
                          type="number"
                          value={fields.retries || 0}
                          onChange={(e) => updateField('retries', parseInt(e.target.value) || 0)}
                          min={0}
                          max={5}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Visual Regression Fields */}
                {testType === 'visual_regression' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-foreground">Viewport Width</label>
                        <input
                          type="number"
                          value={fields.viewport_width || 1920}
                          onChange={(e) => updateField('viewport_width', parseInt(e.target.value) || 1920)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-foreground">Viewport Height</label>
                        <input
                          type="number"
                          value={fields.viewport_height || 1080}
                          onChange={(e) => updateField('viewport_height', parseInt(e.target.value) || 1080)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-foreground">Diff Threshold (%)</label>
                      <input
                        type="number"
                        value={fields.diff_threshold || 0}
                        onChange={(e) => updateField('diff_threshold', parseFloat(e.target.value) || 0)}
                        min={0}
                        max={100}
                        step={0.1}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                      />
                      <p className="text-xs text-muted-foreground">Acceptable visual difference percentage (0 = exact match)</p>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-foreground">Capture Mode</label>
                      <select
                        value={fields.capture_mode || 'full_page'}
                        onChange={(e) => updateField('capture_mode', e.target.value as 'full_page' | 'viewport' | 'element')}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                      >
                        <option value="full_page">Full Page</option>
                        <option value="viewport">Viewport Only</option>
                        <option value="element">Specific Element</option>
                      </select>
                    </div>
                    {fields.capture_mode === 'element' && (
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-foreground">Element Selector</label>
                        <input
                          type="text"
                          value={fields.element_selector || ''}
                          onChange={(e) => updateField('element_selector', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                          placeholder="#header, .main-content, etc."
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Performance Fields */}
                {testType === 'lighthouse' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-foreground">Device Preset</label>
                      <select
                        value={fields.device_preset || 'desktop'}
                        onChange={(e) => updateField('device_preset', e.target.value as 'mobile' | 'desktop')}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                      >
                        <option value="desktop">Desktop</option>
                        <option value="mobile">Mobile</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-foreground">Performance Threshold (0-100)</label>
                      <input
                        type="number"
                        value={fields.performance_threshold || 50}
                        onChange={(e) => updateField('performance_threshold', parseInt(e.target.value) || 50)}
                        min={0}
                        max={100}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                      />
                      <p className="text-xs text-muted-foreground">Minimum Lighthouse performance score to pass</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-foreground">LCP Threshold (ms)</label>
                        <input
                          type="number"
                          value={fields.lcp_threshold || 2500}
                          onChange={(e) => updateField('lcp_threshold', parseInt(e.target.value) || 2500)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-foreground">CLS Threshold</label>
                        <input
                          type="number"
                          value={fields.cls_threshold || 0.1}
                          onChange={(e) => updateField('cls_threshold', parseFloat(e.target.value) || 0.1)}
                          step={0.01}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Accessibility Fields */}
                {testType === 'accessibility' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-foreground">WCAG Level</label>
                      <select
                        value={fields.wcag_level || 'AA'}
                        onChange={(e) => updateField('wcag_level', e.target.value as 'A' | 'AA' | 'AAA')}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                      >
                        <option value="A">Level A (Basic)</option>
                        <option value="AA">Level AA (Recommended)</option>
                        <option value="AAA">Level AAA (Strict)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={fields.include_best_practices || false}
                          onChange={(e) => updateField('include_best_practices', e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-foreground">Include Best Practices</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={fields.include_experimental || false}
                          onChange={(e) => updateField('include_experimental', e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-foreground">Include Experimental Rules</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={fields.include_pa11y || false}
                          onChange={(e) => updateField('include_pa11y', e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-foreground">Run Pa11y Alongside axe-core</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Load Test Fields */}
                {testType === 'load' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-foreground">Virtual Users</label>
                        <input
                          type="number"
                          value={fields.virtual_users || 10}
                          onChange={(e) => updateField('virtual_users', parseInt(e.target.value) || 10)}
                          min={1}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-foreground">Duration (s)</label>
                        <input
                          type="number"
                          value={fields.duration || 60}
                          onChange={(e) => updateField('duration', parseInt(e.target.value) || 60)}
                          min={1}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-foreground">Ramp Up (s)</label>
                        <input
                          type="number"
                          value={fields.ramp_up_time || 10}
                          onChange={(e) => updateField('ramp_up_time', parseInt(e.target.value) || 10)}
                          min={0}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Edit custom K6 script on the test detail page.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Diff Preview */}
          {hasChanges && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowDiffPreview(!showDiffPreview)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Eye className="w-4 h-4" />
                {showDiffPreview ? 'Hide' : 'Show'} Changes Preview ({changes.length} change{changes.length !== 1 ? 's' : ''})
              </button>

              {showDiffPreview && (
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  {changes.map((change, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium text-foreground">{change.label}:</span>
                      <div className="ml-4 flex flex-col gap-1">
                        <span className="text-destructive line-through">- {change.oldValue || '(empty)'}</span>
                        <span className="text-success">+ {change.newValue || '(empty)'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
      </ModalBody>
      <ModalFooter className="bg-muted/30">
        <div className="flex items-center justify-between w-full">
          <div className="text-sm text-muted-foreground">
            {hasChanges ? (
              <span className="text-primary font-medium">{changes.length} unsaved change{changes.length !== 1 ? 's' : ''}</span>
            ) : (
              'No changes'
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !fields.name.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default FullEditTestModal;
