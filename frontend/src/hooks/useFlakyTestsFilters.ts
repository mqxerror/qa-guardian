// Feature #717: Extract filter/sort state from FlakyTestsDashboardPage
// Follows useMonitoringFilters pattern: grouped useState with setters

import { useState, useMemo, useCallback } from 'react';
import { type FlakyTest } from './api/useFlakyTests';

export type SeverityFilter = 'all' | 'high' | 'medium' | 'low';
export type SortByOption = 'score' | 'name' | 'runs';
export type SortOrder = 'asc' | 'desc';

interface Suite {
 id: string;
 name: string;
 project_id: string;
}

export interface FlakyTestsFiltersState {
 projectFilter: string;
 suiteFilter: string;
 severityFilter: SeverityFilter;
 sortBy: SortByOption;
 sortOrder: SortOrder;
}

export function useFlakyTestsFilters(
 flakyTests: FlakyTest[],
 suites: Suite[],
) {
 const [projectFilter, setProjectFilter] = useState<string>('all');
 const [suiteFilter, setSuiteFilter] = useState<string>('all');
 const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
 const [sortBy, setSortBy] = useState<SortByOption>('score');
 const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

 const handleProjectChange = useCallback((value: string) => {
   setProjectFilter(value);
   setSuiteFilter('all'); // Reset suite when project changes
 }, []);

 const toggleSortOrder = useCallback(() => {
   setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
 }, []);

 // Available suites based on project filter
 const availableSuites = useMemo(
   () => projectFilter === 'all' ? suites : suites.filter(s => s.project_id === projectFilter),
   [projectFilter, suites],
 );

 // Filter and sort tests
 const filteredTests = useMemo(() => {
   return flakyTests
     .filter((t) => {
       if (projectFilter !== 'all' && t.project_id !== projectFilter) return false;
       if (suiteFilter !== 'all' && t.suite_id !== suiteFilter) return false;
       if (severityFilter !== 'all') {
         const score = t.flakiness_score || t.flakiness_percentage / 100;
         if (severityFilter === 'high' && score < 0.7) return false;
         if (severityFilter === 'medium' && (score < 0.4 || score >= 0.7)) return false;
         if (severityFilter === 'low' && score >= 0.4) return false;
       }
       return true;
     })
     .sort((a, b) => {
       let comparison = 0;
       if (sortBy === 'score') {
         comparison = (a.flakiness_score || a.flakiness_percentage / 100) - (b.flakiness_score || b.flakiness_percentage / 100);
       } else if (sortBy === 'name') {
         comparison = a.test_name.localeCompare(b.test_name);
       } else if (sortBy === 'runs') {
         comparison = a.total_runs - b.total_runs;
       }
       return sortOrder === 'asc' ? comparison : -comparison;
     });
 }, [flakyTests, projectFilter, suiteFilter, severityFilter, sortBy, sortOrder]);

 return {
   // State
   projectFilter,
   suiteFilter,
   severityFilter,
   sortBy,
   sortOrder,
   // Derived
   filteredTests,
   availableSuites,
   // Setters
   setProjectFilter: handleProjectChange,
   setSuiteFilter,
   setSeverityFilter,
   setSortBy,
   setSortOrder,
   toggleSortOrder,
 };
}
