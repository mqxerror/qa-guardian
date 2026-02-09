// Feature #515: Extracted from AnalyticsPage.tsx
// Project Comparison Table Component

import { useNavigate } from 'react-router-dom';
import type { ProjectComparisonStats } from './types';

interface ProjectComparisonTableProps {
  projectStats: ProjectComparisonStats[];
  isLoading: boolean;
}

export function ProjectComparisonTable({ projectStats, isLoading }: ProjectComparisonTableProps) {
  const navigate = useNavigate();

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-foreground mb-4">Project Comparison</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Compare test statistics across all projects in your organization.
      </p>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Loading project statistics...</p>
        </div>
      ) : projectStats.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No projects found.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create projects and run tests to see comparison analytics.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Project</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Suites</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Tests</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Runs</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Pass Rate</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Passed</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projectStats.map((project) => (
                <tr
                  key={project.project_id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/projects/${project.project_id}`)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{project.project_name}</p>
                      <p className="text-xs text-muted-foreground">{project.project_slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-foreground">{project.suite_count}</td>
                  <td className="px-4 py-3 text-center text-foreground">{project.test_count}</td>
                  <td className="px-4 py-3 text-center text-foreground">{project.total_runs}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            project.pass_rate >= 80 ? 'bg-success' :
                            project.pass_rate >= 50 ? 'bg-warning' :
                            project.total_runs === 0 ? 'bg-muted' :
                            'bg-destructive'
                          }`}
                          style={{ width: `${project.pass_rate}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${
                        project.pass_rate >= 80 ? 'text-success' :
                        project.pass_rate >= 50 ? 'text-warning' :
                        project.total_runs === 0 ? 'text-muted-foreground' :
                        'text-destructive'
                      }`}>
                        {project.total_runs === 0 ? '-' : `${project.pass_rate}%`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full bg-success/15 text-success text-sm font-medium">
                      {project.passed_runs}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-sm font-medium ${
                      project.failed_runs > 0 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
                    }`}>
                      {project.failed_runs}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
