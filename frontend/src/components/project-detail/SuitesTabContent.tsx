/**
 * SuitesTabContent - Test suites listing with search and DataTable
 * Extracted from ProjectDetailPage.tsx for component decomposition (Agent 7)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimezoneStore } from '../../stores/timezoneStore';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { EmptyStates } from '../ui';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { TestSuite } from './types';

interface SuitesTabContentProps {
  suites: TestSuite[];
  canCreateSuite: boolean;
  onCreateSuite: () => void;
}

export function SuitesTabContent({ suites, canCreateSuite, onCreateSuite }: SuitesTabContentProps) {
  const navigate = useNavigate();
  const { formatDate } = useTimezoneStore();
  const [suiteSearchQuery, setSuiteSearchQuery] = useState('');

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">Test Suites</h2>
        <div className="flex items-center gap-2">
          {/* Suite search filter */}
          {suites.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={suiteSearchQuery}
                onChange={(e) => setSuiteSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setSuiteSearchQuery(''); }}
                placeholder="Search suites..."
                className="h-9 w-48 rounded-md border border-input bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {suiteSearchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSuiteSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
          {canCreateSuite && (
            <Button
              size="sm"
              onClick={onCreateSuite}
            >
              Create Suite
            </Button>
          )}
        </div>
      </div>

      {suites.length === 0 ? (
        EmptyStates.noSuites(canCreateSuite ? onCreateSuite : undefined)
      ) : (() => {
        const query = suiteSearchQuery.toLowerCase().trim();
        const filteredSuites = query
          ? suites.filter((s) => {
              const suite = s as TestSuite;
              return (
                (suite.name || '').toLowerCase().includes(query) ||
                (suite.description || '').toLowerCase().includes(query)
              );
            })
          : suites;

        if (filteredSuites.length === 0) {
          return EmptyStates.noSearchResults(suiteSearchQuery);
        }

        return (
          <DataTable
            data={filteredSuites as (TestSuite & Record<string, unknown>)[]}
            columns={[
              {
                key: 'name',
                header: 'Suite Name',
                sortable: true,
                render: (item) => {
                  const s = item as unknown as TestSuite;
                  return (
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{s.name}</span>
                      {s.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">{s.description}</p>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'test_count',
                header: 'Tests',
                sortable: true,
                width: '80px',
                render: (item) => (
                  <span className="text-sm tabular-nums">
                    {(item as unknown as TestSuite).test_count ?? 0}
                  </span>
                ),
              },
              {
                key: 'browser',
                header: 'Browser',
                hideOnMobile: true,
                width: '100px',
                render: (item) => {
                  const browser = (item as unknown as TestSuite).browser;
                  const icon = browser === 'firefox' ? '\uD83E\uDD8A' : browser === 'webkit' ? '\uD83E\uDDED' : '\uD83C\uDF10';
                  return (
                    <span className="text-sm">
                      {icon} {browser || 'chromium'}
                    </span>
                  );
                },
              },
              {
                key: 'created_at',
                header: 'Created',
                hideOnMobile: true,
                width: '140px',
                sortable: true,
                render: (item) => (
                  <span className="text-xs text-muted-foreground">
                    {(item as unknown as TestSuite).created_at
                      ? formatDate((item as unknown as TestSuite).created_at!)
                      : '\u2014'}
                  </span>
                ),
              },
            ] as DataTableColumn<TestSuite & Record<string, unknown>>[]}
            keyExtractor={(item) => (item as unknown as TestSuite).id}
            onRowClick={(item) => navigate(`/suites/${(item as unknown as TestSuite).id}`)}
            hoverable
            compact
          />
        );
      })()}
    </div>
  );
}
