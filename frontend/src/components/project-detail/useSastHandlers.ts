/**
 * useSastHandlers - SAST security scanning handlers for ProjectDetailPage
 * Feature #49: Extracted to reduce ProjectDetailPage line count
 */
import { useState, useCallback } from 'react';
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
  // SAST config state
  const [sastConfig, setSastConfig] = useState<SASTConfig>({
    enabled: false,
    ruleset: 'default',
    severityThreshold: 'MEDIUM',
    autoScan: false,
  });
  const [sastScans, setSastScans] = useState<SASTScanResult[]>([]);
  const [isLoadingSast, setIsLoadingSast] = useState(false);
  const [isUpdatingSast, setIsUpdatingSast] = useState(false);
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [selectedScan, setSelectedScan] = useState<SASTScanResult | null>(null);
  const [sastRulesets, setSastRulesets] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [isLoadingCustomRules, setIsLoadingCustomRules] = useState(false);
  const [showAddCustomRuleModal, setShowAddCustomRuleModal] = useState(false);
  const [newCustomRuleName, setNewCustomRuleName] = useState('');
  const [newCustomRuleYaml, setNewCustomRuleYaml] = useState('');
  const [isAddingCustomRule, setIsAddingCustomRule] = useState(false);
  const [customRuleError, setCustomRuleError] = useState<string | null>(null);

  // Secret patterns state
  const [secretPatterns, setSecretPatterns] = useState<SecretPattern[]>([]);
  const [showAddSecretPatternModal, setShowAddSecretPatternModal] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternDescription, setNewPatternDescription] = useState('');
  const [newPatternRegex, setNewPatternRegex] = useState('');
  const [newPatternSeverity, setNewPatternSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [isAddingPattern, setIsAddingPattern] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);
  const [patternTestInput, setPatternTestInput] = useState('');
  const [patternTestResult, setPatternTestResult] = useState<{ matches: boolean; matched?: string } | null>(null);

  // False positive state
  const [showFalsePositiveModal, setShowFalsePositiveModal] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<SASTFinding | null>(null);
  const [fpReason, setFpReason] = useState('');
  const [isMarkingFP, setIsMarkingFP] = useState(false);
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

  const handleUpdateSastConfig = useCallback(async (updates: Partial<SASTConfig>) => {
    setIsUpdatingSast(true);
    try {
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

      const data = await response.json();
      setSastConfig(data.config);
      toast.success('SAST configuration updated');
    } catch (err) {
      toast.error('Failed to update SAST configuration');
    } finally {
      setIsUpdatingSast(false);
    }
  }, [projectId, token]);

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

  const handleAddCustomRule = useCallback(async () => {
    if (!newCustomRuleName.trim() || !newCustomRuleYaml.trim()) {
      setCustomRuleError('Name and YAML are required');
      return;
    }

    setIsAddingCustomRule(true);
    setCustomRuleError(null);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/custom-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newCustomRuleName,
          yaml: newCustomRuleYaml,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add custom rule');
      }

      const data = await response.json();
      setCustomRules(prev => [...prev, data.rule]);
      setShowAddCustomRuleModal(false);
      setNewCustomRuleName('');
      setNewCustomRuleYaml('');
      toast.success('Custom rule added successfully');
    } catch (err) {
      setCustomRuleError(err instanceof Error ? err.message : 'Failed to add custom rule');
    } finally {
      setIsAddingCustomRule(false);
    }
  }, [projectId, token, newCustomRuleName, newCustomRuleYaml]);

  const handleToggleCustomRule = useCallback(async (ruleId: string, enabled: boolean) => {
    try {
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

      const data = await response.json();
      setCustomRules(prev => prev.map(r => r.id === ruleId ? data.rule : r));
      toast.success(`Custom rule ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error('Failed to update custom rule');
    }
  }, [projectId, token]);

  const handleDeleteCustomRule = useCallback(async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this custom rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/custom-rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete custom rule');
      }

      setCustomRules(prev => prev.filter(r => r.id !== ruleId));
      toast.success('Custom rule deleted');
    } catch (err) {
      toast.error('Failed to delete custom rule');
    }
  }, [projectId, token]);

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

    setIsAddingPattern(true);
    setPatternError(null);

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newPatternName.trim(),
          description: newPatternDescription.trim(),
          pattern: newPatternRegex.trim(),
          severity: newPatternSeverity,
          category: 'custom',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add pattern');
      }

      const data = await response.json();
      setSecretPatterns(prev => [...prev, data]);
      setShowAddSecretPatternModal(false);
      setNewPatternName('');
      setNewPatternDescription('');
      setNewPatternRegex('');
      setNewPatternSeverity('HIGH');
      setPatternTestInput('');
      setPatternTestResult(null);
      toast.success('Custom secret pattern added');
    } catch (err) {
      setPatternError(err instanceof Error ? err.message : 'Failed to add pattern');
    } finally {
      setIsAddingPattern(false);
    }
  }, [projectId, token, newPatternName, newPatternDescription, newPatternRegex, newPatternSeverity]);

  const handleToggleSecretPattern = useCallback(async (patternId: string, enabled: boolean) => {
    try {
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

      setSecretPatterns(prev => prev.map(p => p.id === patternId ? { ...p, enabled } : p));
      toast.success(`Pattern ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error('Failed to update pattern');
    }
  }, [projectId, token]);

  const handleDeleteSecretPattern = useCallback(async (patternId: string) => {
    if (!confirm('Are you sure you want to delete this secret pattern?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/patterns/${patternId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete pattern');
      }

      setSecretPatterns(prev => prev.filter(p => p.id !== patternId));
      toast.success('Secret pattern deleted');
    } catch (err) {
      toast.error('Failed to delete pattern');
    }
  }, [projectId, token]);

  const handleMarkFalsePositive = useCallback(async () => {
    if (!selectedFinding || !fpReason.trim()) {
      return;
    }

    setIsMarkingFP(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/sast/false-positives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ruleId: selectedFinding.ruleId,
          filePath: selectedFinding.filePath,
          line: selectedFinding.line,
          snippet: selectedFinding.snippet,
          reason: fpReason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark as false positive');
      }

      // Update the finding in the scan results
      if (selectedScan) {
        const updatedFindings = selectedScan.findings.map(f =>
          f.id === selectedFinding.id ? { ...f, isFalsePositive: true } : f
        );
        setSastScans(prev => prev.map(s =>
          s.id === selectedScan.id ? { ...s, findings: updatedFindings } : s
        ));
        setSelectedScan({ ...selectedScan, findings: updatedFindings });
      }

      setShowFalsePositiveModal(false);
      setSelectedFinding(null);
      setFpReason('');
      toast.success('Finding marked as false positive');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark as false positive');
    } finally {
      setIsMarkingFP(false);
    }
  }, [projectId, token, selectedFinding, fpReason, selectedScan]);

  const state: SastState = {
    sastConfig,
    sastScans,
    isLoadingSast,
    isUpdatingSast,
    isRunningScan,
    selectedScan,
    sastRulesets,
    customRules,
    isLoadingCustomRules,
    showAddCustomRuleModal,
    newCustomRuleName,
    newCustomRuleYaml,
    isAddingCustomRule,
    customRuleError,
    secretPatterns,
    showAddSecretPatternModal,
    newPatternName,
    newPatternDescription,
    newPatternRegex,
    newPatternSeverity,
    isAddingPattern,
    patternError,
    patternTestInput,
    patternTestResult,
    showFalsePositiveModal,
    selectedFinding,
    fpReason,
    isMarkingFP,
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
