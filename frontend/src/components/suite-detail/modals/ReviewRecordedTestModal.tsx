/**
 * ReviewRecordedTestModal Component
 * Feature #50: Extracted from TestSuitePage.tsx
 * Feature #31: Save as Template support
 * Feature #37: Optional step support for cookie consent handling
 */

import React from 'react';
import { RecordingStep } from '../useSuiteState';

interface ReviewRecordedTestModalProps {
  // Control
  isOpen: boolean;
  onClose: () => void;

  // Recording data
  recordedSteps: RecordingStep[];
  onRecordedStepsChange: (steps: RecordingStep[] | ((prev: RecordingStep[]) => RecordingStep[])) => void;
  recordingDuration: number;

  // Test details
  recordedTestName: string;
  onRecordedTestNameChange: (name: string) => void;
  recordedTestDescription: string;
  onRecordedTestDescriptionChange: (description: string) => void;

  // Save state
  isSavingRecordedTest: boolean;
  onSaveRecordedTest: () => Promise<void>;

  // Template state
  templateName: string;
  onTemplateNameChange: (name: string) => void;
  isSavingTemplate: boolean;
  onSaveAsTemplate: () => Promise<void>;

  // Helper functions
  formatElapsed: (seconds: number) => string;
  getActionIcon: (action: string) => string;
}

export function ReviewRecordedTestModal({
  isOpen,
  onClose,
  recordedSteps,
  onRecordedStepsChange,
  recordingDuration,
  recordedTestName,
  onRecordedTestNameChange,
  recordedTestDescription,
  onRecordedTestDescriptionChange,
  isSavingRecordedTest,
  onSaveRecordedTest,
  templateName,
  onTemplateNameChange,
  isSavingTemplate,
  onSaveAsTemplate,
  formatElapsed,
  getActionIcon,
}: ReviewRecordedTestModalProps) {
  if (!isOpen) {
    return null;
  }

  const handleDiscard = () => {
    onClose();
    onRecordedStepsChange([]);
    onRecordedTestNameChange('');
    onRecordedTestDescriptionChange('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
            <span className="text-xl">✅</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Review Recorded Test</h3>
            <p className="text-sm text-muted-foreground">
              Review the recorded steps, give your test a name, and save it to the suite.
            </p>
          </div>
        </div>

        {/* Recording Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{recordedSteps.length}</div>
            <div className="text-xs text-muted-foreground">Steps Recorded</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{formatElapsed(recordingDuration)}</div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className="text-2xl font-bold text-foreground">
              {new Set(recordedSteps.map(s => s.action)).size}
            </div>
            <div className="text-xs text-muted-foreground">Action Types</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="recorded-test-name" className="block text-sm font-medium text-foreground">
              Test Name *
            </label>
            <input
              id="recorded-test-name"
              type="text"
              value={recordedTestName}
              onChange={(e) => onRecordedTestNameChange(e.target.value)}
              placeholder="Enter test name"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="recorded-test-desc" className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="recorded-test-desc"
              value={recordedTestDescription}
              onChange={(e) => onRecordedTestDescriptionChange(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Test Steps Preview</h4>
            <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border max-h-64 overflow-y-auto">
              {recordedSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors group">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-background border border-border text-sm shrink-0 mt-0.5">
                    {getActionIcon(step.action)}
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-medium shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">{step.action}</span>
                    {step.url && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        URL: <input
                          type="text"
                          defaultValue={step.url}
                          onBlur={(e) => {
                            const newSteps = [...recordedSteps];
                            newSteps[idx] = { ...newSteps[idx], url: e.target.value };
                            onRecordedStepsChange(newSteps);
                          }}
                          className="bg-muted px-1 rounded text-xs w-full border border-transparent hover:border-border focus:border-blue-400 focus:outline-none"
                        />
                      </p>
                    )}
                    {step.selector && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Selector: <input
                          type="text"
                          defaultValue={step.selector}
                          onBlur={(e) => {
                            const newSteps = [...recordedSteps];
                            newSteps[idx] = { ...newSteps[idx], selector: e.target.value };
                            onRecordedStepsChange(newSteps);
                          }}
                          className="bg-muted px-1 rounded text-xs font-mono w-full border border-transparent hover:border-border focus:border-blue-400 focus:outline-none"
                        />
                      </p>
                    )}
                    {step.value && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Value: <input
                          type="text"
                          defaultValue={step.value}
                          onBlur={(e) => {
                            const newSteps = [...recordedSteps];
                            newSteps[idx] = { ...newSteps[idx], value: e.target.value };
                            onRecordedStepsChange(newSteps);
                          }}
                          className="bg-muted px-1 rounded text-xs w-full border border-transparent hover:border-border focus:border-blue-400 focus:outline-none text-green-700"
                        />
                      </p>
                    )}
                    {step.text && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Assert: <input
                          type="text"
                          defaultValue={step.text}
                          onBlur={(e) => {
                            const newSteps = [...recordedSteps];
                            newSteps[idx] = { ...newSteps[idx], text: e.target.value };
                            onRecordedStepsChange(newSteps);
                          }}
                          className="bg-muted px-1 rounded text-xs w-full border border-transparent hover:border-border focus:border-blue-400 focus:outline-none text-green-700"
                        />
                      </p>
                    )}
                    {/* Feature #37: Optional step toggle for cookie consent/popup handling */}
                    <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={step.optional || false}
                        onChange={(e) => {
                          const newSteps = [...recordedSteps];
                          newSteps[idx] = {
                            ...newSteps[idx],
                            optional: e.target.checked,
                            optionalReason: e.target.checked ? 'user_marked' : undefined,
                          };
                          onRecordedStepsChange(newSteps);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3 w-3"
                      />
                      <span className="text-xs text-muted-foreground" title="Enable for elements that may not always appear (popups, consent dialogs)">
                        Optional
                        {step.optional && step.optionalReason && step.optionalReason !== 'user_marked' && (
                          <span className="ml-1 px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px]">
                            ⚡ {step.optionalReason.replace('_', ' ')}
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                    {idx > 0 && (
                      <button
                        onClick={() => {
                          const newSteps = [...recordedSteps];
                          [newSteps[idx - 1], newSteps[idx]] = [newSteps[idx], newSteps[idx - 1]];
                          onRecordedStepsChange(newSteps);
                        }}
                        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                        title="Move up"
                      >
                        ▲
                      </button>
                    )}
                    {idx < recordedSteps.length - 1 && (
                      <button
                        onClick={() => {
                          const newSteps = [...recordedSteps];
                          [newSteps[idx], newSteps[idx + 1]] = [newSteps[idx + 1], newSteps[idx]];
                          onRecordedStepsChange(newSteps);
                        }}
                        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                        title="Move down"
                      >
                        ▼
                      </button>
                    )}
                    <button
                      onClick={() => onRecordedStepsChange(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      title="Remove step"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature #31: Save as Template */}
          <div className="rounded-lg border border-dashed border-purple-300 bg-purple-50/50 dark:bg-purple-900/10 p-3">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">📋 Save as Reusable Template</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => onTemplateNameChange(e.target.value)}
                placeholder="Template name..."
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
              <button
                onClick={onSaveAsTemplate}
                disabled={isSavingTemplate || !templateName.trim() || recordedSteps.length === 0}
                className="rounded-md bg-purple-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-600 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {isSavingTemplate ? 'Saving...' : '📋 Save Template'}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button
              onClick={handleDiscard}
              className="rounded-lg border border-border px-4 py-2 font-medium text-foreground hover:bg-muted transition-colors"
            >
              Discard
            </button>
            <button
              onClick={onSaveRecordedTest}
              disabled={isSavingRecordedTest || recordedSteps.length === 0 || !recordedTestName.trim()}
              className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2 font-semibold text-white hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none"
            >
              {isSavingRecordedTest ? 'Saving...' : '💾 Save Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewRecordedTestModal;
