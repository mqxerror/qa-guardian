/**
 * React Query hooks for Reports API
 * Feature #712: Create React Query hook to eliminate raw fetch() in ReportPage
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth';

// Types - matching backend response
interface ReportSection {
  e2e?: unknown;
  visual?: unknown;
  accessibility?: unknown;
  performance?: unknown;
  load?: unknown;
  security?: unknown;
}

interface ExecutiveSummary {
  overallScore: number;
  overallStatus: 'pass' | 'fail' | 'partial';
  highlights: string[];
  recommendations: string[];
}

export interface Report {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  sections: ReportSection;
  executiveSummary: ExecutiveSummary;
}

interface ReportResponse {
  report: Report;
}

// Query keys factory
export const reportKeys = {
  all: ['reports'] as const,
  detail: (id: string) => [...reportKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch a single report
 * Feature #712: React Query hook for report detail endpoint
 */
export function useReport(reportId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: reportKeys.detail(reportId || ''),
    queryFn: async () => {
      return fetchWithAuth(`/api/v1/reports/${reportId}`, token) as Promise<ReportResponse>;
    },
    enabled: !!token && !!reportId,
    staleTime: 60 * 1000, // 1 minute - reports don't change often
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to export a report
 * Feature #712: React Query mutation for report export
 */
export function useExportReport() {
  const token = useAuthStore(state => state.token);

  return useMutation({
    mutationFn: async ({ reportId, format }: { reportId: string; format: 'pdf' | 'json' | 'html' }) => {
      const response = await fetch(`/api/v1/reports/${reportId}/export?format=${format}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header or generate one
      const disposition = response.headers.get('Content-Disposition');
      let filename = `report-${reportId}.${format}`;
      if (disposition) {
        const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      return { blob, filename };
    },
  });
}
