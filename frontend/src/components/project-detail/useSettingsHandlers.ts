/**
 * useSettingsHandlers - Settings tab handlers for ProjectDetailPage
 * Feature #49: Extracted to reduce ProjectDetailPage line count
 *
 * Includes: Members, Alert Channels, Environment Variables, Healing Settings
 */
import { useState, useCallback } from 'react';
import { toast } from '../../stores/toastStore';
import {
  ProjectMember,
  OrgMember,
  AlertChannel,
  // AlertChannelType, // Unused
  AlertCondition,
  AlertHistoryEntry,
  EnvironmentVariable,
  HealingSettings,
  DEFAULT_HEALING_SETTINGS,
  EditSelectorModalState,
  VisionHealingResult,
  SlackChannel,
} from './types';

export interface UseSettingsHandlersProps {
  projectId: string | undefined;
  token: string | null;
}

export interface SettingsState {
  // Members
  projectMembers: ProjectMember[];
  orgMembers: OrgMember[];
  showAddMemberModal: boolean;
  selectedUserId: string;
  selectedMemberRole: 'developer' | 'viewer';
  isAddingMember: boolean;
  addMemberError: string;
  // Alerts
  alertChannels: AlertChannel[];
  showCreateAlertModal: boolean;
  newAlertType: 'email' | 'slack' | 'webhook';
  newAlertName: string;
  newAlertCondition: AlertCondition;
  newAlertThreshold: number;
  newAlertEmails: string;
  newAlertWebhookUrl: string;
  newAlertSlackChannel: string;
  slackChannels: SlackChannel[];
  newAlertSuppressOnRetry: boolean;
  isCreatingAlert: boolean;
  createAlertError: string;
  alertHistory: AlertHistoryEntry[];
  showAlertHistory: boolean;
  // Environment Variables
  envVars: EnvironmentVariable[];
  showAddEnvModal: boolean;
  newEnvKey: string;
  newEnvValue: string;
  newEnvIsSecret: boolean;
  isAddingEnv: boolean;
  addEnvError: string;
  editingEnvId: string | null;
  editEnvValue: string;
  // Healing Settings
  healingSettings: HealingSettings;
  isSavingHealingSettings: boolean;
  healingSettingsMessage: { type: 'success' | 'error'; text: string } | null;
  // Selector Editor Modal
  editSelectorModal: EditSelectorModalState;
  editSelectorValue: string;
  editSelectorNotes: string;
  editSelectorApplyToTest: boolean;
  isSubmittingSelector: boolean;
  // Vision Healing
  isHealingWithVision: boolean;
  visionHealingResult: VisionHealingResult | null;
}

export interface SettingsHandlers {
  // Members
  setProjectMembers: (members: ProjectMember[]) => void;
  setOrgMembers: (members: OrgMember[]) => void;
  setShowAddMemberModal: (show: boolean) => void;
  setSelectedUserId: (id: string) => void;
  setSelectedMemberRole: (role: 'developer' | 'viewer') => void;
  handleAddMember: (e: React.FormEvent) => Promise<void>;
  handleRemoveMember: (memberId: string) => Promise<void>;
  // Alerts
  setAlertChannels: (channels: AlertChannel[]) => void;
  setShowCreateAlertModal: (show: boolean) => void;
  setNewAlertType: (type: 'email' | 'slack' | 'webhook') => void;
  setNewAlertName: (name: string) => void;
  setNewAlertCondition: (condition: AlertCondition) => void;
  setNewAlertThreshold: (threshold: number) => void;
  setNewAlertEmails: (emails: string) => void;
  setNewAlertWebhookUrl: (url: string) => void;
  setNewAlertSlackChannel: (channel: string) => void;
  setSlackChannels: (channels: SlackChannel[]) => void;
  setNewAlertSuppressOnRetry: (suppress: boolean) => void;
  setAlertHistory: (history: AlertHistoryEntry[]) => void;
  setShowAlertHistory: (show: boolean) => void;
  handleCreateAlert: (e: React.FormEvent) => Promise<void>;
  handleToggleAlert: (channelId: string, currentEnabled: boolean) => Promise<void>;
  handleDeleteAlert: (channelId: string) => Promise<void>;
  // Environment Variables
  setEnvVars: (vars: EnvironmentVariable[]) => void;
  setShowAddEnvModal: (show: boolean) => void;
  setNewEnvKey: (key: string) => void;
  setNewEnvValue: (value: string) => void;
  setNewEnvIsSecret: (isSecret: boolean) => void;
  setAddEnvError: (error: string) => void;
  setEditingEnvId: (id: string | null) => void;
  setEditEnvValue: (value: string) => void;
  handleAddEnvVar: (e: React.FormEvent) => Promise<void>;
  handleUpdateEnvVar: (varId: string) => Promise<void>;
  handleDeleteEnvVar: (varId: string) => Promise<void>;
  // Healing Settings
  setHealingSettings: (settings: HealingSettings) => void;
  handleSaveHealingSettings: () => Promise<void>;
  // Selector Editor Modal
  setEditSelectorModal: (modal: EditSelectorModalState) => void;
  setEditSelectorValue: (value: string) => void;
  setEditSelectorNotes: (notes: string) => void;
  setEditSelectorApplyToTest: (apply: boolean) => void;
  handleUpdateSelector: () => Promise<void>;
  handleAcceptHealed: () => Promise<void>;
  handleHealWithVision: () => Promise<void>;
}

export function useSettingsHandlers({
  projectId,
  token,
}: UseSettingsHandlersProps): [SettingsState, SettingsHandlers] {
  // Members state
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedMemberRole, setSelectedMemberRole] = useState<'developer' | 'viewer'>('developer');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  // Alerts state
  const [alertChannels, setAlertChannels] = useState<AlertChannel[]>([]);
  const [showCreateAlertModal, setShowCreateAlertModal] = useState(false);
  const [newAlertType, setNewAlertType] = useState<'email' | 'slack' | 'webhook'>('email');
  const [newAlertName, setNewAlertName] = useState('');
  const [newAlertCondition, setNewAlertCondition] = useState<AlertCondition>('any_failure');
  const [newAlertThreshold, setNewAlertThreshold] = useState(50);
  const [newAlertEmails, setNewAlertEmails] = useState('');
  const [newAlertWebhookUrl, setNewAlertWebhookUrl] = useState('');
  const [newAlertSlackChannel, setNewAlertSlackChannel] = useState('');
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [newAlertSuppressOnRetry, setNewAlertSuppressOnRetry] = useState(false);
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [createAlertError, setCreateAlertError] = useState('');
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([]);
  const [showAlertHistory, setShowAlertHistory] = useState(false);

  // Environment Variables state
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [showAddEnvModal, setShowAddEnvModal] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [newEnvIsSecret, setNewEnvIsSecret] = useState(false);
  const [isAddingEnv, setIsAddingEnv] = useState(false);
  const [addEnvError, setAddEnvError] = useState('');
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [editEnvValue, setEditEnvValue] = useState('');

  // Healing Settings state
  const [healingSettings, setHealingSettings] = useState<HealingSettings>(DEFAULT_HEALING_SETTINGS);
  const [isSavingHealingSettings, setIsSavingHealingSettings] = useState(false);
  const [healingSettingsMessage, setHealingSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selector Editor Modal state
  const [editSelectorModal, setEditSelectorModal] = useState<EditSelectorModalState>({
    isOpen: false,
    runId: '',
    testId: '',
    stepId: '',
    currentSelector: '',
    originalSelector: '',
    wasHealed: false,
  });
  const [editSelectorValue, setEditSelectorValue] = useState('');
  const [editSelectorNotes, setEditSelectorNotes] = useState('');
  const [editSelectorApplyToTest, setEditSelectorApplyToTest] = useState(true);
  const [isSubmittingSelector, setIsSubmittingSelector] = useState(false);

  // Vision Healing state
  const [isHealingWithVision, setIsHealingWithVision] = useState(false);
  const [visionHealingResult, setVisionHealingResult] = useState<VisionHealingResult | null>(null);

  // Member handlers
  const handleAddMember = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMemberError('');
    setIsAddingMember(true);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: selectedMemberRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add member');
      }

      const data = await response.json();
      setProjectMembers(prev => [...prev, data.member]);
      setSelectedUserId('');
      setSelectedMemberRole('developer');
      setShowAddMemberModal(false);
      toast.success('Member added to project successfully');
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  }, [projectId, token, selectedUserId, selectedMemberRole]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    if (!confirm('Remove this member from the project?')) return;

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to remove member');
      }

      setProjectMembers(prev => prev.filter(m => m.user_id !== memberId));
      toast.success('Member removed from project');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }, [projectId, token]);

  // Alert handlers
  const handleCreateAlert = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAlertError('');
    setIsCreatingAlert(true);

    // Validate based on type
    if (newAlertType === 'email') {
      const emailAddresses = newAlertEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'));

      if (emailAddresses.length === 0) {
        setCreateAlertError('Please enter at least one valid email address');
        setIsCreatingAlert(false);
        return;
      }
    } else if (newAlertType === 'webhook') {
      if (!newAlertWebhookUrl || !newAlertWebhookUrl.startsWith('http')) {
        setCreateAlertError('Please enter a valid webhook URL (must start with http:// or https://)');
        setIsCreatingAlert(false);
        return;
      }
    } else if (newAlertType === 'slack') {
      if (!newAlertSlackChannel) {
        setCreateAlertError('Please select a Slack channel');
        setIsCreatingAlert(false);
        return;
      }
    }

    try {
      const bodyData: Record<string, unknown> = {
        name: newAlertName,
        type: newAlertType,
        condition: newAlertCondition,
        threshold_percent: newAlertCondition === 'threshold' ? newAlertThreshold : undefined,
        suppress_on_retry_success: newAlertSuppressOnRetry,
        enabled: true,
      };

      if (newAlertType === 'email') {
        bodyData.email_addresses = newAlertEmails
          .split(',')
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'));
      } else if (newAlertType === 'webhook') {
        bodyData.webhook_url = newAlertWebhookUrl;
      } else if (newAlertType === 'slack') {
        bodyData.slack_channel = newAlertSlackChannel;
      }

      const response = await fetch(`/api/v1/projects/${projectId}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create alert channel');
      }

      const data = await response.json();
      setAlertChannels(prev => [...prev, data.channel]);
      setNewAlertName('');
      setNewAlertType('email');
      setNewAlertCondition('any_failure');
      setNewAlertThreshold(50);
      setNewAlertEmails('');
      setNewAlertWebhookUrl('');
      setNewAlertSlackChannel('');
      setNewAlertSuppressOnRetry(false);
      setShowCreateAlertModal(false);
      const alertTypeName = newAlertType === 'email' ? 'Email' : newAlertType === 'slack' ? 'Slack' : 'Webhook';
      toast.success(`${alertTypeName} alert channel created successfully`);
    } catch (err) {
      setCreateAlertError(err instanceof Error ? err.message : 'Failed to create alert channel');
    } finally {
      setIsCreatingAlert(false);
    }
  }, [projectId, token, newAlertType, newAlertName, newAlertCondition, newAlertThreshold, newAlertEmails, newAlertWebhookUrl, newAlertSlackChannel, newAlertSuppressOnRetry]);

  const handleToggleAlert = useCallback(async (channelId: string, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/alerts/${channelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: !currentEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update alert channel');
      }

      setAlertChannels(prev => prev.map(ch =>
        ch.id === channelId ? { ...ch, enabled: !currentEnabled } : ch
      ));
      toast.success(`Alert ${currentEnabled ? 'disabled' : 'enabled'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update alert');
    }
  }, [projectId, token]);

  const handleDeleteAlert = useCallback(async (channelId: string) => {
    if (!confirm('Are you sure you want to delete this alert channel?')) return;

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/alerts/${channelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete alert channel');
      }

      setAlertChannels(prev => prev.filter(ch => ch.id !== channelId));
      toast.success('Alert channel deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete alert');
    }
  }, [projectId, token]);

  // Environment variable handlers
  const handleAddEnvVar = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAddEnvError('');
    setIsAddingEnv(true);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/env`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: newEnvKey,
          value: newEnvValue,
          is_secret: newEnvIsSecret,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add environment variable');
      }

      const data = await response.json();
      setEnvVars(prev => [...prev, data.env_var]);
      setNewEnvKey('');
      setNewEnvValue('');
      setNewEnvIsSecret(false);
      setShowAddEnvModal(false);
      toast.success('Environment variable added');
    } catch (err) {
      setAddEnvError(err instanceof Error ? err.message : 'Failed to add environment variable');
    } finally {
      setIsAddingEnv(false);
    }
  }, [projectId, token, newEnvKey, newEnvValue, newEnvIsSecret]);

  const handleUpdateEnvVar = useCallback(async (varId: string) => {
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/env/${varId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          value: editEnvValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update environment variable');
      }

      const data = await response.json();
      setEnvVars(prev => prev.map(v => v.id === varId ? data.env_var : v));
      setEditingEnvId(null);
      setEditEnvValue('');
      toast.success('Environment variable updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update environment variable');
    }
  }, [projectId, token, editEnvValue]);

  const handleDeleteEnvVar = useCallback(async (varId: string) => {
    if (!confirm('Are you sure you want to delete this environment variable?')) return;

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/env/${varId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete environment variable');
      }

      setEnvVars(prev => prev.filter(v => v.id !== varId));
      toast.success('Environment variable deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete environment variable');
    }
  }, [projectId, token]);

  // Healing settings handler
  const handleSaveHealingSettings = useCallback(async () => {
    setIsSavingHealingSettings(true);
    setHealingSettingsMessage(null);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/healing-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(healingSettings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update healing settings');
      }

      const data = await response.json();
      setHealingSettings(data.healing_settings);
      setHealingSettingsMessage({ type: 'success', text: 'Healing settings saved successfully' });
      toast.success('Healing settings saved successfully');
    } catch (err) {
      setHealingSettingsMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save healing settings' });
      toast.error(err instanceof Error ? err.message : 'Failed to save healing settings');
    } finally {
      setIsSavingHealingSettings(false);
    }
  }, [projectId, token, healingSettings]);

  // Selector editor handlers
  const handleUpdateSelector = useCallback(async () => {
    if (!token || !editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    if (!editSelectorValue.trim()) {
      toast.error('Selector cannot be empty');
      return;
    }

    setIsSubmittingSelector(true);
    try {
      const response = await fetch(
        `/api/v1/runs/${editSelectorModal.runId}/results/${editSelectorModal.testId}/steps/${editSelectorModal.stepId}/selector`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            new_selector: editSelectorValue.trim(),
            notes: editSelectorNotes.trim() || undefined,
            apply_to_test: editSelectorApplyToTest,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update selector');
      }

      const data = await response.json();
      toast.success(data.message || 'Selector updated successfully');

      // Reset and close modal
      setEditSelectorModal({
        isOpen: false,
        runId: '',
        testId: '',
        stepId: '',
        currentSelector: '',
        originalSelector: '',
        wasHealed: false,
      });
      setEditSelectorValue('');
      setEditSelectorNotes('');
      setEditSelectorApplyToTest(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update selector');
    } finally {
      setIsSubmittingSelector(false);
    }
  }, [token, editSelectorModal, editSelectorValue, editSelectorNotes, editSelectorApplyToTest]);

  const handleAcceptHealed = useCallback(async () => {
    if (!token || !editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    setIsSubmittingSelector(true);
    try {
      const response = await fetch(
        `/api/v1/runs/${editSelectorModal.runId}/results/${editSelectorModal.testId}/steps/${editSelectorModal.stepId}/accept-healed`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apply_to_test: editSelectorApplyToTest,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to accept healed selector');
      }

      const data = await response.json();
      toast.success(data.message || 'Healed selector accepted');

      // Reset and close modal
      setEditSelectorModal({
        isOpen: false,
        runId: '',
        testId: '',
        stepId: '',
        currentSelector: '',
        originalSelector: '',
        wasHealed: false,
      });
      setEditSelectorValue('');
      setEditSelectorNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept healed selector');
    } finally {
      setIsSubmittingSelector(false);
    }
  }, [token, editSelectorModal, editSelectorApplyToTest]);

  const handleHealWithVision = useCallback(async () => {
    if (!token || !editSelectorModal.originalSelector) {
      toast.error('Missing required information');
      return;
    }

    setIsHealingWithVision(true);
    setVisionHealingResult(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/ai/heal-with-vision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_selector: editSelectorModal.originalSelector,
          page_screenshot: '',
          element_context: {
            tag_name: editSelectorModal.originalSelector.includes('button') ? 'button' :
                      editSelectorModal.originalSelector.includes('input') ? 'input' :
                      editSelectorModal.originalSelector.includes('a') ? 'a' : undefined,
            text_content: editSelectorModal.currentSelector !== editSelectorModal.originalSelector
              ? undefined : undefined,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to heal with vision');
      }

      const data = await response.json();
      setVisionHealingResult(data.healing);

      if (data.healing.suggested_selectors?.length > 0) {
        const topSuggestion = data.healing.suggested_selectors[0];
        setEditSelectorValue(topSuggestion.selector);
        toast.success(`Found ${data.healing.suggested_selectors.length} alternative selectors (${Math.round(topSuggestion.confidence * 100)}% confidence)`);
      } else {
        toast.warning('No alternative selectors found');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to heal with vision');
    } finally {
      setIsHealingWithVision(false);
    }
  }, [token, editSelectorModal]);

  const state: SettingsState = {
    projectMembers,
    orgMembers,
    showAddMemberModal,
    selectedUserId,
    selectedMemberRole,
    isAddingMember,
    addMemberError,
    alertChannels,
    showCreateAlertModal,
    newAlertType,
    newAlertName,
    newAlertCondition,
    newAlertThreshold,
    newAlertEmails,
    newAlertWebhookUrl,
    newAlertSlackChannel,
    slackChannels,
    newAlertSuppressOnRetry,
    isCreatingAlert,
    createAlertError,
    alertHistory,
    showAlertHistory,
    envVars,
    showAddEnvModal,
    newEnvKey,
    newEnvValue,
    newEnvIsSecret,
    isAddingEnv,
    addEnvError,
    editingEnvId,
    editEnvValue,
    healingSettings,
    isSavingHealingSettings,
    healingSettingsMessage,
    editSelectorModal,
    editSelectorValue,
    editSelectorNotes,
    editSelectorApplyToTest,
    isSubmittingSelector,
    isHealingWithVision,
    visionHealingResult,
  };

  const handlers: SettingsHandlers = {
    setProjectMembers,
    setOrgMembers,
    setShowAddMemberModal,
    setSelectedUserId,
    setSelectedMemberRole,
    handleAddMember,
    handleRemoveMember,
    setAlertChannels,
    setShowCreateAlertModal,
    setNewAlertType,
    setNewAlertName,
    setNewAlertCondition,
    setNewAlertThreshold,
    setNewAlertEmails,
    setNewAlertWebhookUrl,
    setNewAlertSlackChannel,
    setSlackChannels,
    setNewAlertSuppressOnRetry,
    setAlertHistory,
    setShowAlertHistory,
    handleCreateAlert,
    handleToggleAlert,
    handleDeleteAlert,
    setEnvVars,
    setShowAddEnvModal,
    setNewEnvKey,
    setNewEnvValue,
    setNewEnvIsSecret,
    setAddEnvError,
    setEditingEnvId,
    setEditEnvValue,
    handleAddEnvVar,
    handleUpdateEnvVar,
    handleDeleteEnvVar,
    setHealingSettings,
    handleSaveHealingSettings,
    setEditSelectorModal,
    setEditSelectorValue,
    setEditSelectorNotes,
    setEditSelectorApplyToTest,
    handleUpdateSelector,
    handleAcceptHealed,
    handleHealWithVision,
  };

  return [state, handlers];
}
