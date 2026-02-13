// Feature #718: Extract delete modal + project defaults state from ProjectDetailPage
// Groups 6 useState calls for modal and project-level settings

import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

export function useProjectDetailModals(projectId: string | undefined, onDeleteSuccess: () => void) {
  const { token } = useAuthStore();

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Project defaults state
  const [projectDefaultBrowser, setProjectDefaultBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [projectViewportProfiles, setProjectViewportProfiles] = useState<Array<{name: string; width: number; height: number}>>([
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 },
  ]);
  const [isSavingProjectDefaults, setIsSavingProjectDefaults] = useState(false);

  const handleDeleteProject = useCallback(async () => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete project');
      }

      onDeleteSuccess();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  }, [projectId, token, onDeleteSuccess]);

  return {
    // Delete modal
    showDeleteModal,
    setShowDeleteModal,
    isDeleting,
    deleteError,
    handleDeleteProject,
    // Project defaults
    projectDefaultBrowser,
    setProjectDefaultBrowser,
    projectViewportProfiles,
    setProjectViewportProfiles,
    isSavingProjectDefaults,
    setIsSavingProjectDefaults,
  };
}
