/**
 * Feature #48: useStepHandlers - Custom hook for step management handlers
 * Extracts step drag/drop, code editing, and step order handlers from TestDetailPage.tsx
 */

import { useCallback } from 'react';
import { toast } from '../../stores/toastStore';
import { generatePlaywrightCode } from './codeGenUtils';

export interface UseStepHandlersProps {
  testId: string | undefined;
  token: string | null;
  test: any;
  setTest: (test: any) => void;
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
  setTestExplanation: (explanation: any) => void;
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
  };
}
