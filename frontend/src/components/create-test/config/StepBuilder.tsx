/**
 * StepBuilder Component
 * Feature #1822: E2E Test Steps dropdown instead of textarea
 *
 * Provides structured step builder with dropdowns for test actions.
 * Each step has: action dropdown, selector input, value input, delete button.
 * Supports drag-drop reordering.
 */

import React, { useState, useCallback, useRef } from 'react';

/**
 * Available step action types
 */
export type StepAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'
  | 'wait'
  | 'assert'
  | 'scroll'
  | 'hover'
  | 'press'
  | 'screenshot';

/**
 * Step configuration
 */
export interface Step {
  id: string;
  action: StepAction;
  selector: string;
  value: string;
}

/**
 * Action configuration with metadata
 */
interface ActionConfig {
  label: string;
  icon: string;
  placeholder: {
    selector: string;
    value: string;
  };
  requiresSelector: boolean;
  requiresValue: boolean;
}

/**
 * Action configurations
 */
const ACTION_CONFIG: Record<StepAction, ActionConfig> = {
  navigate: {
    label: 'Navigate',
    icon: '🔗',
    placeholder: { selector: '', value: '/page' },
    requiresSelector: false,
    requiresValue: true,
  },
  click: {
    label: 'Click',
    icon: '👆',
    placeholder: { selector: 'button.submit, #login-btn', value: '' },
    requiresSelector: true,
    requiresValue: false,
  },
  type: {
    label: 'Type',
    icon: '⌨️',
    placeholder: { selector: 'input[name="email"]', value: 'your-value' },
    requiresSelector: true,
    requiresValue: true,
  },
  select: {
    label: 'Select',
    icon: '📋',
    placeholder: { selector: 'select#country', value: 'USA' },
    requiresSelector: true,
    requiresValue: true,
  },
  wait: {
    label: 'Wait',
    icon: '⏳',
    placeholder: { selector: '.loading-spinner', value: '5000' },
    requiresSelector: false,
    requiresValue: true,
  },
  assert: {
    label: 'Assert',
    icon: '✅',
    placeholder: { selector: 'h1.title', value: 'Welcome' },
    requiresSelector: true,
    requiresValue: true,
  },
  scroll: {
    label: 'Scroll',
    icon: '📜',
    placeholder: { selector: '#footer', value: '' },
    requiresSelector: true,
    requiresValue: false,
  },
  hover: {
    label: 'Hover',
    icon: '🎯',
    placeholder: { selector: '.dropdown-menu', value: '' },
    requiresSelector: true,
    requiresValue: false,
  },
  press: {
    label: 'Press Key',
    icon: '⏎',
    placeholder: { selector: '', value: 'Enter' },
    requiresSelector: false,
    requiresValue: true,
  },
  screenshot: {
    label: 'Screenshot',
    icon: '📸',
    placeholder: { selector: '', value: 'step-screenshot' },
    requiresSelector: false,
    requiresValue: true,
  },
};

/**
 * Generate unique ID
 */
const generateId = (): string => `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Props for StepBuilder
 */
export interface StepBuilderProps {
  /** Current steps */
  value?: Step[];
  /** Called when steps change */
  onChange?: (steps: Step[]) => void;
  /** Maximum number of steps */
  maxSteps?: number;
  /** CSS class name */
  className?: string;
}

/**
 * Single step row component
 */
const StepRow: React.FC<{
  step: Step;
  index: number;
  onUpdate: (id: string, updates: Partial<Step>) => void;
  onDelete: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
}> = ({
  step,
  index,
  onUpdate,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
  isDragging,
  isDropTarget,
}) => {
  const config = ACTION_CONFIG[step.action];

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnter={() => onDragEnter(index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`step-row flex items-center gap-2 p-2 rounded-lg transition-all ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${
        isDropTarget ? 'border-2 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
      }`}
    >
      {/* Drag Handle */}
      <div className="cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
        </svg>
      </div>

      {/* Step Number */}
      <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 rounded-full">
        {index + 1}
      </span>

      {/* Action Dropdown */}
      <select
        value={step.action}
        onChange={(e) => onUpdate(step.id, { action: e.target.value as StepAction })}
        className="w-32 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        title="Select action"
      >
        {(Object.entries(ACTION_CONFIG) as [StepAction, ActionConfig][]).map(([action, cfg]) => (
          <option key={action} value={action}>
            {cfg.icon} {cfg.label}
          </option>
        ))}
      </select>

      {/* Selector Input */}
      <input
        type="text"
        value={step.selector}
        onChange={(e) => onUpdate(step.id, { selector: e.target.value })}
        placeholder={config.placeholder.selector || 'Selector (optional)'}
        disabled={!config.requiresSelector && !step.selector}
        className={`flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono ${
          !config.requiresSelector && !step.selector ? 'opacity-50' : ''
        }`}
        title="CSS selector"
      />

      {/* Value Input */}
      <input
        type="text"
        value={step.value}
        onChange={(e) => onUpdate(step.id, { value: e.target.value })}
        placeholder={config.placeholder.value || 'Value (optional)'}
        disabled={!config.requiresValue && !step.value}
        className={`w-40 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
          !config.requiresValue && !step.value ? 'opacity-50' : ''
        }`}
        title="Value"
      />

      {/* Delete Button */}
      <button
        type="button"
        onClick={() => onDelete(step.id)}
        className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
        title="Delete step"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
};

/**
 * StepBuilder - Structured test step builder with drag-drop support
 */
export const StepBuilder: React.FC<StepBuilderProps> = ({
  value = [],
  onChange,
  maxSteps = 50,
  className = '',
}) => {
  const [steps, setSteps] = useState<Step[]>(value.length > 0 ? value : [
    { id: generateId(), action: 'navigate', selector: '', value: '' },
  ]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Update internal and external state
  const updateSteps = useCallback((newSteps: Step[]) => {
    setSteps(newSteps);
    onChange?.(newSteps);
  }, [onChange]);

  // Add new step
  const addStep = useCallback(() => {
    if (steps.length >= maxSteps) return;
    const newStep: Step = {
      id: generateId(),
      action: 'click',
      selector: '',
      value: '',
    };
    updateSteps([...steps, newStep]);
  }, [steps, maxSteps, updateSteps]);

  // Update step
  const updateStep = useCallback((id: string, updates: Partial<Step>) => {
    updateSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  }, [steps, updateSteps]);

  // Delete step
  const deleteStep = useCallback((id: string) => {
    if (steps.length <= 1) {
      // Keep at least one step, but clear it
      updateSteps([{ id: generateId(), action: 'navigate', selector: '', value: '' }]);
    } else {
      updateSteps(steps.filter(s => s.id !== id));
    }
  }, [steps, updateSteps]);

  // Drag handlers
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      setDropIndex(index);
    }
  }, [dragIndex]);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const newSteps = [...steps];
      const [draggedStep] = newSteps.splice(dragIndex, 1);
      newSteps.splice(dropIndex, 0, draggedStep);
      updateSteps(newSteps);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex, steps, updateSteps]);

  // Convert steps to string format for legacy support
  const stepsToString = useCallback((): string => {
    return steps
      .map((step, index) => {
        const config = ACTION_CONFIG[step.action];
        let stepStr = `${index + 1}. ${config.label}`;
        if (step.selector) stepStr += ` "${step.selector}"`;
        if (step.value) stepStr += ` → ${step.value}`;
        return stepStr;
      })
      .join('\n');
  }, [steps]);

  return (
    <div className={`step-builder ${className}`}>
      {/* Steps List */}
      <div className="space-y-2 mb-3">
        {steps.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            index={index}
            onUpdate={updateStep}
            onDelete={deleteStep}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            onDragEnd={handleDragEnd}
            isDragging={dragIndex === index}
            isDropTarget={dropIndex === index}
          />
        ))}
      </div>

      {/* Add Step Button */}
      <button
        type="button"
        onClick={addStep}
        disabled={steps.length >= maxSteps}
        className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Step
        {steps.length >= maxSteps && ` (max ${maxSteps} reached)`}
      </button>

      {/* Step Count */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
        {steps.length} step{steps.length !== 1 ? 's' : ''} defined
      </div>
    </div>
  );
};

export default StepBuilder;
