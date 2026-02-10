/**
 * useDastHandlers - DAST security scanning handlers for ProjectDetailPage
 * Feature #49: Extracted to reduce ProjectDetailPage line count
 * Feature #624: Converted to useMutation hooks for proper cache invalidation
 */
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '../../stores/toastStore';
import {
  DASTConfig,
  DASTScanResult,
  OpenAPISpec,
} from './types';

export interface UseDastHandlersProps {
  projectId: string | undefined;
  token: string | null;
}

export interface DastState {
  dastConfig: DASTConfig;
  dastScans: DASTScanResult[];
  isLoadingDast: boolean;
  isUpdatingDast: boolean;
  isRunningDastScan: boolean;
  selectedDastScan: DASTScanResult | null;
  dastTargetUrl: string;
  openApiSpec: OpenAPISpec | null;
  isUploadingSpec: boolean;
  specUploadError: string | null;
  dastSchedules: any[];
}

export interface DastHandlers {
  // State setters
  setDastConfig: (config: DASTConfig) => void;
  setDastScans: (scans: DASTScanResult[]) => void;
  setIsLoadingDast: (loading: boolean) => void;
  setSelectedDastScan: (scan: DASTScanResult | null) => void;
  setDastTargetUrl: (url: string) => void;
  setOpenApiSpec: (spec: OpenAPISpec | null) => void;
  setDastSchedules: (schedules: any[]) => void;
  // Handlers
  handleUpdateDastConfig: (updates: Partial<DASTConfig>) => Promise<void>;
  handleTriggerDastScan: () => Promise<void>;
  handleUploadOpenApiSpec: (content: string) => Promise<void>;
  handleDeleteOpenApiSpec: () => Promise<void>;
}

export function useDastHandlers({
  projectId,
  token,
}: UseDastHandlersProps): [DastState, DastHandlers] {
  // Feature #624: QueryClient for cache invalidation
  const queryClient = useQueryClient();

  // DAST state
  const [dastConfig, setDastConfig] = useState<DASTConfig>({
    enabled: false,
    targetUrl: '',
    scanProfile: 'baseline',
    alertThreshold: 'LOW',
    autoScan: false,
  });
  const [dastScans, setDastScans] = useState<DASTScanResult[]>([]);
  const [isLoadingDast, setIsLoadingDast] = useState(false);
  // Feature #624: isUpdatingDast now comes from updateDastConfigMutation.isPending
  const [isRunningDastScan, setIsRunningDastScan] = useState(false);
  const [selectedDastScan, setSelectedDastScan] = useState<DASTScanResult | null>(null);
  const [dastTargetUrl, setDastTargetUrl] = useState('');
  const [openApiSpec, setOpenApiSpec] = useState<OpenAPISpec | null>(null);
  // Feature #624: isUploadingSpec now comes from uploadOpenApiSpecMutation.isPending
  const [specUploadError, setSpecUploadError] = useState<string | null>(null);
  const [dastSchedules, setDastSchedules] = useState<any[]>([]);

  // Feature #624: useMutation for DAST config update
  const updateDastConfigMutation = useMutation({
    mutationFn: async (updates: Partial<DASTConfig>) => {
      const response = await fetch(`/api/v1/projects/${projectId}/dast/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error('Failed to update DAST configuration');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setDastConfig(data.config);
      toast.success('DAST configuration updated');
      queryClient.invalidateQueries({ queryKey: ['dast', projectId] });
    },
    onError: () => {
      toast.error('Failed to update DAST configuration');
    },
  });

  const handleUpdateDastConfig = useCallback(async (updates: Partial<DASTConfig>) => {
    updateDastConfigMutation.mutate(updates);
  }, [updateDastConfigMutation]);

  const handleTriggerDastScan = useCallback(async () => {
    const urlToScan = dastTargetUrl || dastConfig.targetUrl;
    if (!urlToScan) {
      toast.error('Please configure a target URL first');
      return;
    }

    // Validate URL
    try {
      new URL(urlToScan);
    } catch {
      toast.error('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setIsRunningDastScan(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/dast/scans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUrl: urlToScan,
          scanProfile: dastConfig.scanProfile,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start DAST scan');
      }

      const data = await response.json();
      toast.success('DAST scan started');

      // Poll for scan completion
      const pollScan = async (scanId: string) => {
        const scanResponse = await fetch(`/api/v1/projects/${projectId}/dast/scans/${scanId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (scanResponse.ok) {
          const scanData = await scanResponse.json();
          if (scanData.scan.status === 'completed' || scanData.scan.status === 'failed') {
            // Refresh scans list
            const scansResponse = await fetch(`/api/v1/projects/${projectId}/dast/scans?limit=10`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (scansResponse.ok) {
              const scansData = await scansResponse.json();
              setDastScans(scansData.scans);
            }
            setIsRunningDastScan(false);
            if (scanData.scan.status === 'completed') {
              toast.success(`DAST scan completed: ${scanData.scan.summary.total} alerts`);
            } else {
              toast.error('DAST scan failed');
            }
          } else {
            // Still running, poll again after 2 seconds
            setTimeout(() => pollScan(scanId), 2000);
          }
        }
      };

      // Start polling
      setTimeout(() => pollScan(data.scan.id), 2000);
    } catch (err) {
      toast.error('Failed to start DAST scan');
      setIsRunningDastScan(false);
    }
  }, [projectId, token, dastTargetUrl, dastConfig.targetUrl, dastConfig.scanProfile]);

  // Feature #624: useMutation for uploading OpenAPI spec
  const uploadOpenApiSpecMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/v1/projects/${projectId}/dast/openapi-spec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload OpenAPI specification');
      }
      const data = await response.json();
      // Fetch the updated spec
      const specResponse = await fetch(`/api/v1/projects/${projectId}/dast/openapi-spec`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (specResponse.ok) {
        const specData = await specResponse.json();
        return { uploadData: data, spec: specData.spec };
      }
      return { uploadData: data, spec: null };
    },
    onSuccess: (result) => {
      toast.success(`OpenAPI specification uploaded: ${result.uploadData.spec.endpointCount} endpoints found`);
      if (result.spec) {
        setOpenApiSpec(result.spec);
      }
      queryClient.invalidateQueries({ queryKey: ['dast', 'openapi', projectId] });
    },
    onError: (err: Error) => {
      setSpecUploadError(err.message);
      toast.error(err.message);
    },
  });

  const handleUploadOpenApiSpec = useCallback(async (content: string) => {
    setSpecUploadError(null);
    uploadOpenApiSpecMutation.mutate(content);
  }, [uploadOpenApiSpecMutation]);

  // Feature #624: useMutation for deleting OpenAPI spec
  const deleteOpenApiSpecMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/projects/${projectId}/dast/openapi-spec`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to delete OpenAPI specification');
      }
    },
    onSuccess: () => {
      setOpenApiSpec(null);
      toast.success('OpenAPI specification deleted');
      queryClient.invalidateQueries({ queryKey: ['dast', 'openapi', projectId] });
    },
    onError: () => {
      toast.error('Failed to delete OpenAPI specification');
    },
  });

  const handleDeleteOpenApiSpec = useCallback(async () => {
    deleteOpenApiSpecMutation.mutate();
  }, [deleteOpenApiSpecMutation]);

  const state: DastState = {
    dastConfig,
    dastScans,
    isLoadingDast,
    isUpdatingDast: updateDastConfigMutation.isPending, // Feature #624: Use mutation state
    isRunningDastScan,
    selectedDastScan,
    dastTargetUrl,
    openApiSpec,
    isUploadingSpec: uploadOpenApiSpecMutation.isPending, // Feature #624: Use mutation state
    specUploadError,
    dastSchedules,
  };

  const handlers: DastHandlers = {
    setDastConfig,
    setDastScans,
    setIsLoadingDast,
    setSelectedDastScan,
    setDastTargetUrl,
    setOpenApiSpec,
    setDastSchedules,
    handleUpdateDastConfig,
    handleTriggerDastScan,
    handleUploadOpenApiSpec,
    handleDeleteOpenApiSpec,
  };

  return [state, handlers];
}
