/**
 * Feature #48: useStepHandlers - Custom hook for step management handlers
 * Extracts step drag/drop, code editing, and step order handlers from TestDetailPage.tsx
 */

import { useCallback } from 'react';
import { toast } from '../../stores/toastStore';
import { generatePlaywrightCode } from './codeGenUtils';
import { TestType } from './types';
import { TestExplanation } from './modals/AIExplainModal';

export interface AddStepData {
  action: string;
  selector?: string;
  value?: string;
  checkpointName?: string;
  checkpointThreshold?: string;
  a11yWcagLevel?: 'A' | 'AA' | 'AAA';
  a11yFailOnAny?: boolean;
  a11yFailOnCritical?: boolean;
  a11yThreshold?: string;
}

export interface UseStepHandlersProps {
  testId: string | undefined;
  token: string | null;
  test: TestType | null;
  setTest: (test: TestType) => void;
  draggedStepIndex: number | null;
  setDraggedStepIndex: (index: number | null) => void;
  setDragOverIndex: (index: number | null) => void;
  setHasReorderedSteps: (value: boolean) => void;
  hasReorderedSteps: boolean;
  setIsSavingStepOrder: (value: boolean) => void;
  editedCode: string;
  setEditedCode: (code: string) => void;
  setIsSavingCode: (value: boolean) => void;
  setCodeError: (error: string) => void;
  setIsEditingCode: (value: boolean) => void;
  setIsExplainingTest: (value: boolean) => void;
  setShowExplainModal: (value: boolean) => void;
  setTestExplanation: (explanation: TestExplanation | null) => void;
  // Add step handlers
  setIsAddingStep?: (value: boolean) => void;
  setAddStepError?: (error: string) => void;
  setShowAddStepModal?: (value: boolean) => void;
}

export interface StepHandlers {
  handleStepDragStart: (e: React.DragEvent, index: number) => void;
  handleStepDragEnd: (e: React.DragEvent) => void;
  handleStepDragOver: (e: React.DragEvent, index: number) => void;
  handleStepDrop: (e: React.DragEvent, dropIndex: number) => void;
  handleSaveStepOrder: () => Promise<void>;
  handleSaveCode: () => Promise<void>;
  handleRevertToSteps: () => Promise<void>;
  handleStartEditCode: () => void;
  handleCancelEditCode: () => void;
  handleExplainTest: () => Promise<void>;
  handleAddStep: (e: React.FormEvent, stepData: AddStepData) => Promise<void>;
}

export function useStepHandlers({
  testId,
  token,
  test,
  setTest,
  draggedStepIndex,
  setDraggedStepIndex,
  setDragOverIndex,
  setHasReorderedSteps,
  hasReorderedSteps,
  setIsSavingStepOrder,
  editedCode,
  setEditedCode,
  setIsSavingCode,
  setCodeError,
  setIsEditingCode,
  setIsExplainingTest,
  setShowExplainModal,
  setTestExplanation,
  setIsAddingStep,
  setAddStepError,
  setShowAddStepModal,
}: UseStepHandlersProps): StepHandlers {

  // Handle step drag start
  const handleStepDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedStepIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, [setDraggedStepIndex]);

  // Handle step drag end
  const handleStepDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedStepIndex(null);
    setDragOverIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, [setDraggedStepIndex, setDragOverIndex]);

  // Handle step drag over
  const handleStepDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, [setDragOverIndex]);

  // Handle step drop
  const handleStepDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = draggedStepIndex;
    if (fromIndex === null || fromIndex === dropIndex || !test) return;

    // Reorder steps
    const newSteps = [...test.steps];
    const [movedStep] = newSteps.splice(fromIndex, 1);
    newSteps.splice(dropIndex, 0, movedStep);

    // Update test with new step order
    setTest({ ...test, steps: newSteps });
    setHasReorderedSteps(true);
    setDraggedStepIndex(null);
    setDragOverIndex(null);
  }, [draggedStepIndex, test, setTest, setHasReorderedSteps, setDraggedStepIndex, setDragOverIndex]);

  // Save reordered steps to server
  const handleSaveStepOrder = useCallback(async () => {
    if (!test || !hasReorderedSteps) return;

    setIsSavingStepOrder(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}/steps/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ steps: test.steps }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save step order');
      }

      setHasReorderedSteps(false);
      toast.success('Step order saved successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save step order');
    } finally {
      setIsSavingStepOrder(false);
    }
  }, [test, hasReorderedSteps, testId, token, setIsSavingStepOrder, setHasReorderedSteps]);

  // Save custom Playwright code for advanced users
  const handleSaveCode = useCallback(async () => {
    if (!test || !editedCode.trim()) return;

    setIsSavingCode(true);
    setCodeError('');
    try {
      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          playwright_code: editedCode,
          use_custom_code: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save code');
      }

      const data = await response.json();
      setTest(data.test);
      setIsEditingCode(false);
      toast.success('Custom Playwright code saved successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save code';
      setCodeError(message);
      toast.error(message);
    } finally {
      setIsSavingCode(false);
    }
  }, [test, editedCode, testId, token, setIsSavingCode, setCodeError, setTest, setIsEditingCode]);

  // Revert to generated code (use steps instead of custom code)
  const handleRevertToSteps = useCallback(async () => {
    if (!test) return;

    setIsSavingCode(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          use_custom_code: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to revert to steps');
      }

      const data = await response.json();
      setTest(data.test);
      setIsEditingCode(false);
      toast.success('Reverted to generated code from steps');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revert to steps');
    } finally {
      setIsSavingCode(false);
    }
  }, [test, testId, token, setIsSavingCode, setTest, setIsEditingCode]);

  // Start editing custom code
  const handleStartEditCode = useCallback(() => {
    // Initialize with existing custom code or generate from steps
    const initialCode = test?.playwright_code || generatePlaywrightCode(test?.steps, test?.name);
    setEditedCode(initialCode);
    setCodeError('');
    setIsEditingCode(true);
  }, [test, setEditedCode, setCodeError, setIsEditingCode]);

  // Cancel editing custom code
  const handleCancelEditCode = useCallback(() => {
    setIsEditingCode(false);
    setEditedCode('');
    setCodeError('');
  }, [setIsEditingCode, setEditedCode, setCodeError]);

  // Add new step to test
  const handleAddStep = useCallback(async (e: React.FormEvent, stepData: AddStepData) => {
    e.preventDefault();
    if (!test || !setAddStepError || !setIsAddingStep || !setShowAddStepModal) return;

    setAddStepError('');
    setIsAddingStep(true);

    try {
      // Build new step object
      const newStep: {
        id: string;
        action: string;
        selector?: string;
        value?: string;
        order: number;
        checkpointName?: string;
        checkpointThreshold?: number;
        a11y_wcag_level?: 'A' | 'AA' | 'AAA';
        a11y_fail_on_any?: boolean;
        a11y_fail_on_critical?: boolean;
        a11y_threshold?: number;
      } = {
        id: String(Date.now()),
        action: stepData.action,
        selector: stepData.selector || undefined,
        value: stepData.value || undefined,
        order: test?.steps?.length || 0,
      };

      // Add visual checkpoint configuration
      if (stepData.action === 'visual_checkpoint') {
        newStep.checkpointName = stepData.checkpointName || `checkpoint-${Date.now()}`;
        newStep.checkpointThreshold = parseFloat(stepData.checkpointThreshold || '0.1') || 0.1;
      }

      // Add accessibility check configuration
      if (stepData.action === 'accessibility_check') {
        newStep.a11y_wcag_level = stepData.a11yWcagLevel;
        newStep.a11y_fail_on_any = stepData.a11yFailOnAny;
        newStep.a11y_fail_on_critical = stepData.a11yFailOnCritical;
        newStep.a11y_threshold = parseInt(stepData.a11yThreshold || '0', 10) || 0;
      }

      const updatedSteps = [...(test?.steps || []), newStep];

      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ steps: updatedSteps }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add step');
      }

      const data = await response.json();
      setTest(data.test);
      setShowAddStepModal(false);
      toast.success('Step added successfully!');
    } catch (err) {
      setAddStepError(err instanceof Error ? err.message : 'Failed to add step');
    } finally {
      setIsAddingStep(false);
    }
  }, [test, testId, token, setTest, setAddStepError, setIsAddingStep, setShowAddStepModal]);

  // AI Explain Test Code
  const handleExplainTest = useCallback(async () => {
    if (!test) return;

    setIsExplainingTest(true);
    setShowExplainModal(true);
    setTestExplanation(null);

    try {
      const code = test.use_custom_code && test.playwright_code
        ? test.playwright_code
        : generatePlaywrightCode(test.steps, test.name);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/ai/explain-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          testName: test.name,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to explain test');
      }

      const data = await response.json();
      setTestExplanation(data.explanation);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to explain test');
      setShowExplainModal(false);
    } finally {
      setIsExplainingTest(false);
    }
  }, [test, token, setIsExplainingTest, setShowExplainModal, setTestExplanation]);

  return {
    handleStepDragStart,
    handleStepDragEnd,
    handleStepDragOver,
    handleStepDrop,
    handleSaveStepOrder,
    handleSaveCode,
    handleRevertToSteps,
    handleStartEditCode,
    handleCancelEditCode,
    handleExplainTest,
    handleAddStep,
  };
}
