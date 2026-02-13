/**
 * useSastHandlers - SAST security scanning handlers for ProjectDetailPage
 * Feature #49: Extracted to reduce ProjectDetailPage line count
 * Feature #624: Converted to useMutation hooks for proper cache invalidation and deduplication
 */
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '../../stores/toastStore';
import {
  SASTConfig,
  SASTScanResult,
  SASTFinding,
  CustomRule,
  SecretPattern,
} from './types';

export interface UseSastHandlersProps {
  projectId: string | undefined;
  token: string | null;
  githubBranch?: string;
}

export interface SastState {
  sastConfig: SASTConfig;
  sastScans: SASTScanResult[];
  isLoadingSast: boolean;
  isUpdatingSast: boolean;
  isRunningScan: boolean;
  selectedScan: SASTScanResult | null;
  sastRulesets: Array<{ id: string; name: string; description: string }>;
  customRules: CustomRule[];
  isLoadingCustomRules: boolean;
  showAddCustomRuleModal: boolean;
  newCustomRuleName: string;
  newCustomRuleYaml: string;
  isAddingCustomRule: boolean;
  customRuleError: string | null;
  // Secret patterns
  secretPatterns: SecretPattern[];
  showAddSecretPatternModal: boolean;
  newPatternName: string;
  newPatternDescription: string;
  newPatternRegex: string;
  newPatternSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  isAddingPattern: boolean;
  patternError: string | null;
  patternTestInput: string;
  patternTestResult: { matches: boolean; matched?: string } | null;
  // False positives
  showFalsePositiveModal: boolean;
  selectedFinding: SASTFinding | null;
  fpReason: string;
  isMarkingFP: boolean;
  showFalsePositives: boolean;
  expandedRemediations: Set<string>;
}

export interface SastHandlers {
  // State setters
  setSastConfig: (config: SASTConfig) => void;
  setSastScans: (scans: SASTScanResult[]) => void;
  setIsLoadingSast: (loading: boolean) => void;
  setSelectedScan: (scan: SASTScanResult | null) => void;
  setSastRulesets: (rulesets: Array<{ id: string; name: string; description: string }>) => void;
  setCustomRules: (rules: CustomRule[]) => void;
  setShowAddCustomRuleModal: (show: boolean) => void;
  setNewCustomRuleName: (name: string) => void;
  setNewCustomRuleYaml: (yaml: string) => void;
  setCustomRuleError: (error: string | null) => void;
  setSecretPatterns: (patterns: SecretPattern[]) => void;
  setShowAddSecretPatternModal: (show: boolean) => void;
  setNewPatternName: (name: string) => void;
  setNewPatternDescription: (desc: string) => void;
  setNewPatternRegex: (regex: string) => void;
  setNewPatternSeverity: (severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') => void;
  setPatternError: (error: string | null) => void;
  setPatternTestInput: (input: string) => void;
  setPatternTestResult: (result: { matches: boolean; matched?: string } | null) => void;
  setShowFalsePositiveModal: (show: boolean) => void;
  setSelectedFinding: (finding: SASTFinding | null) => void;
  setFpReason: (reason: string) => void;
  setShowFalsePositives: (show: boolean) => void;
  toggleRemediation: (findingId: string) => void;
  // Handlers
  handleUpdateSastConfig: (updates: Partial<SASTConfig>) => Promise<void>;
  handleTriggerScan: () => Promise<void>;
  handleAddCustomRule: () => Promise<void>;
  handleToggleCustomRule: (ruleId: string, enabled: boolean) => Promise<void>;
  handleDeleteCustomRule: (ruleId: string) => Promise<void>;
  handleTestPattern: () => void;
  handleAddSecretPattern: () => Promise<void>;
  handleToggleSecretPattern: (patternId: string, enabled: boolean) => Promise<void>;
  handleDeleteSecretPattern: (patternId: string) => Promise<void>;
  handleMarkFalsePositive: () => Promise<void>;
}

export function useSastHandlers({
  projectId,
  token,
  githubBranch = 'main',
}: UseSastHandlersProps): [SastState, SastHandlers] {
  // Feature #624: QueryClient for cache invalidation after mutations
  const queryClient = useQueryClient();

  // SAST config state
  const [sastConfig, setSastConfig] = useState<SASTConfig>({
    enabled: false,
    ruleset: 'default',
    severityThreshold: 'MEDIUM',
    autoScan: false,
  });
  const [sastScans, setSastScans] = useState<SASTScanResult[]>([]);
  const [isLoadingSast, setIsLoadingSast] = useState(false);
  // Feature #624: isUpdatingSast now comes from updateSastConfigMutation.isPending
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [selectedScan, setSelectedScan] = useState<SASTScanResult | null>(null);
  const [sastRulesets, setSastRulesets] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [isLoadingCustomRules] = useState(false);
  const [showAddCustomRuleModal, setShowAddCustomRuleModal] = useState(false);
  const [newCustomRuleName, setNewCustomRuleName] = useState('');
  const [newCustomRuleYaml, setNewCustomRuleYaml] = useState('');
  // Feature #624: isAddingCustomRule now comes from addCustomRuleMutation.isPending
  const [customRuleError, setCustomRuleError] = useState<string | null>(null);

  // Secret patterns state
  const [secretPatterns, setSecretPatterns] = useState<SecretPattern[]>([]);
  const [showAddSecretPatternModal, setShowAddSecretPatternModal] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternDescription, setNewPatternDescription] = useState('');
  const [newPatternRegex, setNewPatternRegex] = useState('');
  const [newPatternSeverity, setNewPatternSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  // Feature #624: isAddingPattern now comes from addSecretPatternMutation.isPending
  const [patternError, setPatternError] = useState<string | null>(null);
  const [patternTestInput, setPatternTestInput] = useState('');
  const [patternTestResult, setPatternTestResult] = useState<{ matches: boolean; matched?: string } | null>(null);

  // False positive state
  const [showFalsePositiveModal, setShowFalsePositiveModal] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<SASTFinding | null>(null);
  const [fpReason, setFpReason] = useState('');
  // Feature #624: isMarkingFP now comes from markFalsePositiveMutation.isPending
  const [showFalsePositives, setShowFalsePositives] = useState(true);
  const [expandedRemediations, setExpandedRemediations] = useState<Set<string>>(new Set());

  const toggleRemediation = useCallback((findingId: string) => {
    setExpandedRemediations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(findingId)) {
        newSet.delete(findingId);
      } else {
        newSet.add(findingId);
      }
      return newSet;
    });
  }, []);

  // Feature #624: useMutation for SAST config update with cache invalidation
  const updateSastConfigMutation = useMutation({
    mutationFn: async (updates: Partial<SASTConfig>) => {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error('Failed to update SAST configuration');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSastConfig(data.config);
      toast.success('SAST configuration updated');
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['sast', projectId] });
    },
    onError: () => {
      toast.error('Failed to update SAST configuration');
    },
  });

  const handleUpdateSastConfig = useCallback(async (updates: Partial<SASTConfig>) => {
    updateSastConfigMutation.mutate(updates);
  }, [updateSastConfigMutation]);

  const handleTriggerScan = useCallback(async () => {
    setIsRunningScan(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ branch: githubBranch }),
      });

      if (!response.ok) {
        throw new Error('Failed to start SAST scan');
      }

      const data = await response.json();
      toast.success('SAST scan started');

      // Poll for scan completion
      const pollScan = async (scanId: string) => {
        const scanResponse = await fetch(`/api/v1/projects/${projectId}/sast/scans/${scanId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (scanResponse.ok) {
          const scanData = await scanResponse.json();
          if (scanData.scan.status === 'completed' || scanData.scan.status === 'failed') {
            // Refresh scans list
            const scansResponse = await fetch(`/api/v1/projects/${projectId}/sast/scans?limit=10`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (scansResponse.ok) {
              const scansData = await scansResponse.json();
              setSastScans(scansData.scans);
            }
            setIsRunningScan(false);
            if (scanData.scan.status === 'completed') {
              toast.success(`SAST scan completed: ${scanData.scan.summary.total} findings`);
            } else {
              toast.error('SAST scan failed');
            }
          } else {
            setTimeout(() => pollScan(scanId), 2000);
          }
        }
      };

      setTimeout(() => pollScan(data.scanId), 2000);
    } catch (err) {
      toast.error('Failed to start SAST scan');
      setIsRunningScan(false);
    }
  }, [projectId, token, githubBranch]);

  // Feature #624: useMutation for adding custom rules
  const addCustomRuleMutation = useMutation({
    mutationFn: async ({ name, yaml }: { name: string; yaml: string }) => {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/custom-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name, yaml }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add custom rule');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCustomRules(prev => [...prev, data.rule]);
      setShowAddCustomRuleModal(false);
      setNewCustomRuleName('');
      setNewCustomRuleYaml('');
      toast.success('Custom rule added successfully');
      queryClient.invalidateQueries({ queryKey: ['sast', 'rules', projectId] });
    },
    onError: (err: Error) => {
      setCustomRuleError(err.message);
    },
  });

  const handleAddCustomRule = useCallback(async () => {
    if (!newCustomRuleName.trim() || !newCustomRuleYaml.trim()) {
      setCustomRuleError('Name and YAML are required');
      return;
    }
    setCustomRuleError(null);
    addCustomRuleMutation.mutate({ name: newCustomRuleName, yaml: newCustomRuleYaml });
  }, [newCustomRuleName, newCustomRuleYaml, addCustomRuleMutation]);

  // Feature #624: useMutation for toggling custom rules
  const toggleCustomRuleMutation = useMutation({
    mutationFn: async ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/custom-rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        throw new Error('Failed to update custom rule');
      }
      return { ...(await response.json()), ruleId, enabled };
    },
    onSuccess: (data) => {
      setCustomRules(prev => prev.map(r => r.id === data.ruleId ? data.rule : r));
      toast.success(`Custom rule ${data.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: () => {
      toast.error('Failed to update custom rule');
    },
  });

  const handleToggleCustomRule = useCallback(async (ruleId: string, enabled: boolean) => {
    toggleCustomRuleMutation.mutate({ ruleId, enabled });
  }, [toggleCustomRuleMutation]);

  // Feature #624: useMutation for deleting custom rules
  const deleteCustomRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/custom-rules/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to delete custom rule');
      }
      return ruleId;
    },
    onSuccess: (ruleId) => {
      setCustomRules(prev => prev.filter(r => r.id !== ruleId));
      toast.success('Custom rule deleted');
      queryClient.invalidateQueries({ queryKey: ['sast', 'rules', projectId] });
    },
    onError: () => {
      toast.error('Failed to delete custom rule');
    },
  });

  const handleDeleteCustomRule = useCallback(async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this custom rule?')) {
      return;
    }
    deleteCustomRuleMutation.mutate(ruleId);
  }, [deleteCustomRuleMutation]);

  const handleTestPattern = useCallback(() => {
    if (!newPatternRegex || !patternTestInput) {
      setPatternTestResult(null);
      return;
    }
    try {
      const regex = new RegExp(newPatternRegex);
      const match = regex.exec(patternTestInput);
      if (match) {
        setPatternTestResult({ matches: true, matched: match[0] });
      } else {
        setPatternTestResult({ matches: false });
      }
      setPatternError(null);
    } catch (err) {
      setPatternError(err instanceof Error ? `Invalid regex: ${err.message}` : 'Invalid regex pattern');
      setPatternTestResult(null);
    }
  }, [newPatternRegex, patternTestInput]);

  // Feature #624: useMutation for adding secret patterns
  const addSecretPatternMutation = useMutation({
    mutationFn: async (params: {
      name: string;
      description: string;
      pattern: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    }) => {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ...params, category: 'custom' }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add pattern');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSecretPatterns(prev => [...prev, data]);
      setShowAddSecretPatternModal(false);
      setNewPatternName('');
      setNewPatternDescription('');
      setNewPatternRegex('');
      setNewPatternSeverity('HIGH');
      setPatternTestInput('');
      setPatternTestResult(null);
      toast.success('Custom secret pattern added');
      queryClient.invalidateQueries({ queryKey: ['sast', 'patterns', projectId] });
    },
    onError: (err: Error) => {
      setPatternError(err.message);
    },
  });

  const handleAddSecretPattern = useCallback(async () => {
    if (!newPatternName.trim() || !newPatternRegex.trim()) {
      setPatternError('Name and pattern are required');
      return;
    }
    // Validate regex
    try {
      new RegExp(newPatternRegex);
    } catch (err) {
      setPatternError(err instanceof Error ? `Invalid regex: ${err.message}` : 'Invalid regex pattern');
      return;
    }
    setPatternError(null);
    addSecretPatternMutation.mutate({
      name: newPatternName.trim(),
      description: newPatternDescription.trim(),
      pattern: newPatternRegex.trim(),
      severity: newPatternSeverity,
    });
  }, [addSecretPatternMutation, newPatternName, newPatternDescription, newPatternRegex, newPatternSeverity]);

  // Feature #624: useMutation for toggling secret patterns
  const toggleSecretPatternMutation = useMutation({
    mutationFn: async ({ patternId, enabled }: { patternId: string; enabled: boolean }) => {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/patterns/${patternId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        throw new Error('Failed to update pattern');
      }
      return { patternId, enabled };
    },
    onSuccess: ({ patternId, enabled }) => {
      setSecretPatterns(prev => prev.map(p => p.id === patternId ? { ...p, enabled } : p));
      toast.success(`Pattern ${enabled ? 'enabled' : 'disabled'}`);
    },
    onError: () => {
      toast.error('Failed to update pattern');
    },
  });

  const handleToggleSecretPattern = useCallback(async (patternId: string, enabled: boolean) => {
    toggleSecretPatternMutation.mutate({ patternId, enabled });
  }, [toggleSecretPatternMutation]);

  // Feature #624: useMutation for deleting secret patterns
  const deleteSecretPatternMutation = useMutation({
    mutationFn: async (patternId: string) => {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/patterns/${patternId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to delete pattern');
      }
      return patternId;
    },
    onSuccess: (patternId) => {
      setSecretPatterns(prev => prev.filter(p => p.id !== patternId));
      toast.success('Secret pattern deleted');
      queryClient.invalidateQueries({ queryKey: ['sast', 'patterns', projectId] });
    },
    onError: () => {
      toast.error('Failed to delete pattern');
    },
  });

  const handleDeleteSecretPattern = useCallback(async (patternId: string) => {
    if (!confirm('Are you sure you want to delete this secret pattern?')) {
      return;
    }
    deleteSecretPatternMutation.mutate(patternId);
  }, [deleteSecretPatternMutation]);

  // Feature #624: useMutation for marking false positives
  const markFalsePositiveMutation = useMutation({
    mutationFn: async (params: {
      finding: SASTFinding;
      reason: string;
      scan: SASTScanResult | null;
    }) => {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/false-positives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ruleId: params.finding.ruleId,
          filePath: params.finding.filePath,
          line: params.finding.line,
          snippet: params.finding.snippet,
          reason: params.reason,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark as false positive');
      }
      return params;
    },
    onSuccess: (params) => {
      // Update the finding in the scan results
      if (params.scan) {
        const updatedFindings = params.scan.findings.map(f =>
          f.id === params.finding.id ? { ...f, isFalsePositive: true } : f
        );
        setSastScans(prev => prev.map(s =>
          s.id === params.scan!.id ? { ...s, findings: updatedFindings } : s
        ));
        setSelectedScan({ ...params.scan, findings: updatedFindings });
      }
      setShowFalsePositiveModal(false);
      setSelectedFinding(null);
      setFpReason('');
      toast.success('Finding marked as false positive');
      queryClient.invalidateQueries({ queryKey: ['sast', 'false-positives', projectId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleMarkFalsePositive = useCallback(async () => {
    if (!selectedFinding || !fpReason.trim()) {
      return;
    }
    markFalsePositiveMutation.mutate({
      finding: selectedFinding,
      reason: fpReason,
      scan: selectedScan,
    });
  }, [markFalsePositiveMutation, selectedFinding, fpReason, selectedScan]);

  const state: SastState = {
    sastConfig,
    sastScans,
    isLoadingSast,
    isUpdatingSast: updateSastConfigMutation.isPending, // Feature #624: Use mutation state
    isRunningScan,
    selectedScan,
    sastRulesets,
    customRules,
    isLoadingCustomRules,
    showAddCustomRuleModal,
    newCustomRuleName,
    newCustomRuleYaml,
    isAddingCustomRule: addCustomRuleMutation.isPending, // Feature #624: Use mutation state
    customRuleError,
    secretPatterns,
    showAddSecretPatternModal,
    newPatternName,
    newPatternDescription,
    newPatternRegex,
    newPatternSeverity,
    isAddingPattern: addSecretPatternMutation.isPending, // Feature #624: Use mutation state
    patternError,
    patternTestInput,
    patternTestResult,
    showFalsePositiveModal,
    selectedFinding,
    fpReason,
    isMarkingFP: markFalsePositiveMutation.isPending, // Feature #624: Use mutation state
    showFalsePositives,
    expandedRemediations,
  };

  const handlers: SastHandlers = {
    setSastConfig,
    setSastScans,
    setIsLoadingSast,
    setSelectedScan,
    setSastRulesets,
    setCustomRules,
    setShowAddCustomRuleModal,
    setNewCustomRuleName,
    setNewCustomRuleYaml,
    setCustomRuleError,
    setSecretPatterns,
    setShowAddSecretPatternModal,
    setNewPatternName,
    setNewPatternDescription,
    setNewPatternRegex,
    setNewPatternSeverity,
    setPatternError,
    setPatternTestInput,
    setPatternTestResult,
    setShowFalsePositiveModal,
    setSelectedFinding,
    setFpReason,
    setShowFalsePositives,
    toggleRemediation,
    handleUpdateSastConfig,
    handleTriggerScan,
    handleAddCustomRule,
    handleToggleCustomRule,
    handleDeleteCustomRule,
    handleTestPattern,
    handleAddSecretPattern,
    handleToggleSecretPattern,
    handleDeleteSecretPattern,
    handleMarkFalsePositive,
  };

  return [state, handlers];
}
