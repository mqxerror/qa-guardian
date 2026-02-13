/**
 * React Query hooks for services API
 * Feature #712: Create React Query hook to eliminate raw fetch() in ServicesPage
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth';

// Types
export interface ServiceCapability {
  name: string;
  status: 'implemented' | 'simulated' | 'planned' | 'not_available';
}

export interface ContainerInfo {
  container_name: string;
  container_status: string;
  uptime: string;
  ports: string;
  image: string;
}

export interface ServiceInfo {
  name: string;
  category: string;
  status: 'healthy' | 'degraded' | 'unavailable' | 'not_configured';
  latency_ms: number | null;
  version: string | null;
  last_checked: string;
  error?: string;
  capabilities: ServiceCapability[];
  config_hints?: string[];
  details?: { label: string; value: string }[];
  container?: ContainerInfo | null;
}

export interface ServicesResponse {
  overall_status: string;
  total_services: number;
  healthy_count: number;
  degraded_count: number;
  unavailable_count: number;
  not_configured_count: number;
  checked_at: string;
  services: ServiceInfo[];
}

// Query keys factory
export const servicesKeys = {
  all: ['services'] as const,
  status: () => [...servicesKeys.all, 'status'] as const,
};

/**
 * Hook to fetch services status
 * Feature #712: React Query hook for services status endpoint
 */
export function useServicesStatus(options?: {
  enabled?: boolean;
  refetchInterval?: number | false;
}) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: servicesKeys.status(),
    queryFn: () => fetchWithAuth('/api/v1/services/status', token) as Promise<ServicesResponse>,
    enabled: options?.enabled !== false && !!token,
    staleTime: 10 * 1000, // 10 seconds - services status changes frequently
    gcTime: 30 * 1000, // 30 seconds
    refetchInterval: options?.refetchInterval,
    refetchIntervalInBackground: false, // Don't refetch when tab is not visible
  });
}

/**
 * Hook to invalidate services queries
 */
export function useInvalidateServices() {
  const queryClient = useQueryClient();

  return {
    invalidateStatus: () => queryClient.invalidateQueries({ queryKey: servicesKeys.status() }),
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: servicesKeys.all }),
  };
}
