/**
 * EditModal - Manual test configuration editor
 * Feature #610: Extracted from AIGenerateStep.tsx
 */
import React, { useState } from 'react';
import {
  TEST_TYPE_CONFIG,
  VIEWPORT_CONFIG,
  VIEWPORT_DIMENSIONS,
  type DetectedTestType,
  type ViewportPreset,
} from './types';

/**
 * Props for EditModal
 */
export interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  testType: DetectedTestType;
  url: string | null;
  viewport: { preset: ViewportPreset; width: number; height: number };
  onSave: (updates: {
    testType: DetectedTestType;
    url: string;
    viewport: { preset: ViewportPreset; width: number; height: number };
  }) => void;
  /** Project base URL for placeholder (no example.com) */
  projectBaseUrl?: string;
}

/**
 * EditModal component
 * Allows manual adjustment of detected test configuration
 */
export const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  testType,
  url,
  viewport,
  onSave,
  projectBaseUrl,
}) => {
  const [editTestType, setEditTestType] = useState<DetectedTestType>(testType);
  const [editUrl, setEditUrl] = useState(url || '');
  const [editViewport, setEditViewport] = useState(viewport);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      testType: editTestType,
      url: editUrl,
      viewport: editViewport,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Edit Test Configuration
        </h3>

        {/* Test Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Test Type
          </label>
          <select
            value={editTestType || ''}
            onChange={(e) => setEditTestType(e.target.value as DetectedTestType)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
          >
            <option value="">Select type...</option>
            {Object.entries(TEST_TYPE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.icon} {config.label}</option>
            ))}
          </select>
        </div>

        {/* URL */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Target URL
          </label>
          <input
            type="url"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            placeholder={projectBaseUrl || 'https://your-site.com'}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
          />
        </div>

        {/* Viewport */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Viewport
          </label>
          <select
            value={editViewport.preset}
            onChange={(e) => {
              const preset = e.target.value as ViewportPreset;
              const dimensions = preset === 'custom'
                ? { width: editViewport.width, height: editViewport.height }
                : VIEWPORT_DIMENSIONS[preset];
              setEditViewport({ preset, ...dimensions });
            }}
            className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
          >
            {Object.entries(VIEWPORT_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.icon} {config.label}</option>
            ))}
          </select>
          {editViewport.preset === 'custom' && (
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                value={editViewport.width}
                onChange={(e) => setEditViewport({ ...editViewport, width: parseInt(e.target.value) || 0 })}
                placeholder="Width"
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-input text-foreground"
              />
              <span className="py-2 text-muted-foreground">×</span>
              <input
                type="number"
                value={editViewport.height}
                onChange={(e) => setEditViewport({ ...editViewport, height: parseInt(e.target.value) || 0 })}
                placeholder="Height"
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-input text-foreground"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!editTestType || !editUrl}
            className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-lg disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

EditModal.displayName = 'EditModal';
