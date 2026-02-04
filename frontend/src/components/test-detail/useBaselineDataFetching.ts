/**
 * Feature #48: useBaselineDataFetching - Custom hook for baseline data fetching
 * Extracts baseline-related useEffects from TestDetailPage.tsx
 */

import { useEffect } from 'react';

export interface BaselineDataResult {
  hasBaseline: boolean;
  image?: string;
  createdAt?: string;
  size?: number;
  approvedBy?: string;
  approvedByUserId?: string;
  approvedAt?: string;
  sourceRunId?: string;
}

export interface BaselineHistoryEntry {
  id: string;
  testId: string;
  viewportId: string;
  version: number;
  approvedBy: string;
  approvedByUserId: string;
  approvedAt: string;
  sourceRunId?: string;
  filename: string;
}

export interface MergeableBranch {
  branch: string;
  updatedAt: string;
  approvedBy?: string;
  isNewer: boolean;
  hasBaseline: boolean;
}

export interface UseBaselineDataFetchingProps {
  testId: string | undefined;
  token: string | null;
  testType?: string;
  activeTab: string;
  selectedBranch: string;
  baselineData: BaselineDataResult | null;
  selectedHistoryVersion: string | null;
  // State setters
  setLoadingBaseline: (value: boolean) => void;
  setBaselineData: (value: BaselineDataResult | null) => void;
  setLoadingBranches: (value: boolean) => void;
  setAvailableBranches: (value: string[]) => void;
  setLoadingMergeableBranches: (value: boolean) => void;
  setMergeableBranches: (value: MergeableBranch[]) => void;
  setLoadingBaselineHistory: (value: boolean) => void;
  setBaselineHistory: (value: BaselineHistoryEntry[]) => void;
  setLoadingHistoryImage: (value: boolean) => void;
  setHistoryVersionImage: (value: string | null) => void;
}

export function useBaselineDataFetching({
  testId,
  token,
  testType,
  activeTab,
  selectedBranch,
  baselineData,
  selectedHistoryVersion,
  setLoadingBaseline,
  setBaselineData,
  setLoadingBranches,
  setAvailableBranches,
  setLoadingMergeableBranches,
  setMergeableBranches,
  setLoadingBaselineHistory,
  setBaselineHistory,
  setLoadingHistoryImage,
  setHistoryVersionImage,
}: UseBaselineDataFetchingProps): void {

  // Fetch available branches when viewing a visual regression test
  useEffect(() => {
    if (!testType || testType !== 'visual_regression') {
      return;
    }

    const fetchBranches = async () => {
      setLoadingBranches(true);
      try {
        const response = await fetch(`/api/v1/tests/${testId}/baseline/branches`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const branches = data.branches || [];
          // Always include 'main' and ensure it's first
          if (!branches.includes('main')) {
            branches.unshift('main');
          }
          setAvailableBranches(branches);
        }
      } catch (err) {
        console.error('Failed to fetch branches:', err);
        setAvailableBranches(['main']);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [testId, token, testType, setLoadingBranches, setAvailableBranches]);

  // Fetch mergeable baselines from other branches (for baseline merge after branch merge)
  useEffect(() => {
    if (!testType || testType !== 'visual_regression') {
      return;
    }

    const fetchMergeableBranches = async () => {
      setLoadingMergeableBranches(true);
      try {
        const response = await fetch(`/api/v1/tests/${testId}/baseline/mergeable?targetBranch=${encodeURIComponent(selectedBranch)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setMergeableBranches(data.mergeableBranches || []);
        } else {
          setMergeableBranches([]);
        }
      } catch (err) {
        console.error('Failed to fetch mergeable branches:', err);
        setMergeableBranches([]);
      } finally {
        setLoadingMergeableBranches(false);
      }
    };

    fetchMergeableBranches();
  }, [testId, token, testType, selectedBranch, baselineData, setLoadingMergeableBranches, setMergeableBranches]);

  // Fetch baseline when baseline tab is selected (for visual regression tests)
  useEffect(() => {
    if (activeTab !== 'baseline' || !testType || testType !== 'visual_regression') {
      return;
    }

    const fetchBaseline = async () => {
      setLoadingBaseline(true);
      try {
        const response = await fetch(`/api/v1/tests/${testId}/baseline?branch=${encodeURIComponent(selectedBranch)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setBaselineData(data);
        } else if (response.status === 404) {
          setBaselineData({ hasBaseline: false });
        }
      } catch (err) {
        console.error('Failed to fetch baseline:', err);
        setBaselineData({ hasBaseline: false });
      } finally {
        setLoadingBaseline(false);
      }
    };

    fetchBaseline();
  }, [activeTab, testId, token, testType, selectedBranch, setLoadingBaseline, setBaselineData]);

  // Fetch baseline history when baseline tab is selected (for visual regression tests)
  useEffect(() => {
    if (activeTab !== 'baseline' || !testType || testType !== 'visual_regression') {
      return;
    }

    const fetchBaselineHistory = async () => {
      setLoadingBaselineHistory(true);
      try {
        const response = await fetch(`/api/v1/tests/${testId}/baseline/history?branch=${encodeURIComponent(selectedBranch)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setBaselineHistory(data.history || []);
        } else {
          setBaselineHistory([]);
        }
      } catch (err) {
        console.error('Failed to fetch baseline history:', err);
        setBaselineHistory([]);
      } finally {
        setLoadingBaselineHistory(false);
      }
    };

    fetchBaselineHistory();
  }, [activeTab, testId, token, testType, selectedBranch, setLoadingBaselineHistory, setBaselineHistory]);

  // Fetch baseline history version image when selected
  useEffect(() => {
    if (!selectedHistoryVersion || !testId || !token) {
      setHistoryVersionImage(null);
      return;
    }

    const fetchHistoryImage = async () => {
      setLoadingHistoryImage(true);
      try {
        const response = await fetch(`/api/v1/tests/${testId}/baseline/history/${selectedHistoryVersion}?format=json`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setHistoryVersionImage(data.image || null);
        } else {
          setHistoryVersionImage(null);
        }
      } catch (err) {
        console.error('Failed to fetch baseline history image:', err);
        setHistoryVersionImage(null);
      } finally {
        setLoadingHistoryImage(false);
      }
    };

    fetchHistoryImage();
  }, [selectedHistoryVersion, testId, token, setLoadingHistoryImage, setHistoryVersionImage]);
}
