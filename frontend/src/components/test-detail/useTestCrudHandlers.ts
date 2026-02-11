/**
 * Feature #48: useTestCrudHandlers - Custom hook for test CRUD handlers
 * Extracts delete, edit, duplicate handlers from TestDetailPage.tsx
 * Note: Run handlers are kept inline due to complex socket/polling dependencies
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TestType } from './types';

export interface UseTestCrudHandlersProps {
  testId: string | undefined;
  token: string | null;
  suite: { id: string } | null;
  test: TestType | null;
  // State setters
  setIsDeleting: (value: boolean) => void;
  setDeleteError: (value: string) => void;
  setIsEditing: (value: boolean) => void;
  setEditError: (value: string) => void;
  setShowEditModal: (value: boolean) => void;
  setTest: (test: TestType | null) => void;
  setIsDirty: (value: boolean) => void;
  setIsDuplicating: (value: boolean) => void;
  setDuplicateError: (value: string) => void;
}

export interface TestCrudHandlers {
  handleDelete: () => Promise<void>;
  handleEdit: (editName: string, editDescription: string) => Promise<void>;
  handleDuplicate: () => Promise<void>;
}

export function useTestCrudHandlers({
  testId,
  token,
  suite,
  test,
  setIsDeleting,
  setDeleteError,
  setIsEditing,
  setEditError,
  setShowEditModal,
  setTest,
  setIsDirty,
  setIsDuplicating,
  setDuplicateError,
}: UseTestCrudHandlersProps): TestCrudHandlers {
  const navigate = useNavigate();

  // Delete test handler
  const handleDelete = useCallback(async () => {
    if (!testId || !token) return;

    setDeleteError('');
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete test');
      }

      // Navigate to parent suite page after successful deletion
      if (suite) {
        navigate(`/suites/${suite.id}`);
      } else {
        navigate('/projects');
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete test');
    } finally {
      setIsDeleting(false);
    }
  }, [testId, token, suite, navigate, setDeleteError, setIsDeleting]);

  // Edit test handler
  const handleEdit = useCallback(async (editName: string, editDescription: string) => {
    if (!testId || !token) return;

    setEditError('');
    setIsEditing(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update test');
      }

      const data = await response.json();
      setTest(data.test);
      setIsDirty(false);
      setShowEditModal(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update test');
    } finally {
      setIsEditing(false);
    }
  }, [testId, token, setEditError, setIsEditing, setTest, setIsDirty, setShowEditModal]);

  // Duplicate test handler
  const handleDuplicate = useCallback(async () => {
    if (!test || !suite || !token) return;

    setDuplicateError('');
    setIsDuplicating(true);
    try {
      // Create a new test with the same properties but "(Copy)" suffix
      const response = await fetch(`/api/v1/suites/${suite.id}/tests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${test.name} (Copy)`,
          description: test.description,
          steps: test.steps,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to duplicate test');
      }

      const data = await response.json();
      // Navigate to the new test
      navigate(`/tests/${data.test.id}`);
    } catch (err) {
      setDuplicateError(err instanceof Error ? err.message : 'Failed to duplicate test');
    } finally {
      setIsDuplicating(false);
    }
  }, [test, suite, token, navigate, setDuplicateError, setIsDuplicating]);

  return {
    handleDelete,
    handleEdit,
    handleDuplicate,
  };
}
