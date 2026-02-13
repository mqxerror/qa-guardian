// Feature #718: Extract create-suite modal state from ProjectDetailPage
// Groups 10 useState calls for the suite creation form

import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTestDefaultsStore } from '../stores/testDefaultsStore';
import { toast } from '../stores/toastStore';
import { useInvalidateSuites } from '../hooks/api';
import { getDevicePresetDimensions, getErrorMessage } from '../components/project-detail';

export function useCreateSuiteModal(projectId: string | undefined) {
  const { token } = useAuthStore();
  const { defaults: testDefaults } = useTestDefaultsStore();
  const { invalidateByProject } = useInvalidateSuites();

  const [showCreateSuiteModal, setShowCreateSuiteModal] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDescription, setNewSuiteDescription] = useState('');
  const [newSuiteBrowser, setNewSuiteBrowser] = useState<'chromium' | 'firefox' | 'webkit'>(testDefaults.defaultBrowser);
  const [newSuiteViewportWidth, setNewSuiteViewportWidth] = useState(1280);
  const [newSuiteViewportHeight, setNewSuiteViewportHeight] = useState(720);
  const [newSuiteTimeout, setNewSuiteTimeout] = useState(testDefaults.defaultTimeout / 1000);
  const [newSuiteRetryCount, setNewSuiteRetryCount] = useState(testDefaults.defaultRetries);
  const [devicePreset, setDevicePreset] = useState('desktop');
  const [isCreatingSuite, setIsCreatingSuite] = useState(false);
  const [createSuiteError, setCreateSuiteError] = useState('');

  const handleDevicePresetChange = useCallback((preset: string) => {
    setDevicePreset(preset);
    const dimensions = getDevicePresetDimensions(preset);
    if (dimensions) {
      setNewSuiteViewportWidth(dimensions.width);
      setNewSuiteViewportHeight(dimensions.height);
    }
  }, []);

  const handleCreateSuite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSuiteError('');
    setIsCreatingSuite(true);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newSuiteName,
          description: newSuiteDescription,
          browser: newSuiteBrowser,
          viewport_width: newSuiteViewportWidth,
          viewport_height: newSuiteViewportHeight,
          timeout: newSuiteTimeout,
          retry_count: newSuiteRetryCount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create test suite');
      }

      const data = await response.json();
      invalidateByProject(projectId || '');
      setNewSuiteName('');
      setNewSuiteDescription('');
      setNewSuiteBrowser(testDefaults.defaultBrowser);
      setNewSuiteViewportWidth(1280);
      setNewSuiteViewportHeight(720);
      setNewSuiteTimeout(testDefaults.defaultTimeout / 1000);
      setNewSuiteRetryCount(testDefaults.defaultRetries);
      setShowCreateSuiteModal(false);
      toast.success(`Test suite "${data.suite.name}" created successfully!`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create test suite'));
    } finally {
      setIsCreatingSuite(false);
    }
  }, [projectId, token, newSuiteName, newSuiteDescription, newSuiteBrowser, newSuiteViewportWidth, newSuiteViewportHeight, newSuiteTimeout, newSuiteRetryCount, testDefaults, invalidateByProject]);

  return {
    showCreateSuiteModal,
    setShowCreateSuiteModal,
    newSuiteName,
    setNewSuiteName,
    newSuiteDescription,
    setNewSuiteDescription,
    newSuiteBrowser,
    setNewSuiteBrowser,
    newSuiteViewportWidth,
    setNewSuiteViewportWidth,
    newSuiteViewportHeight,
    setNewSuiteViewportHeight,
    newSuiteTimeout,
    setNewSuiteTimeout,
    newSuiteRetryCount,
    setNewSuiteRetryCount,
    devicePreset,
    setDevicePreset,
    isCreatingSuite,
    createSuiteError,
    handleDevicePresetChange,
    handleCreateSuite,
  };
}
