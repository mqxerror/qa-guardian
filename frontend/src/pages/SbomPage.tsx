// Feature #268: SBOM Generation Page
// Generates Software Bill of Materials in CycloneDX and SPDX formats

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Button } from '../components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { Loader2, FileText, CheckCircle, Download, Check, AlertTriangle } from 'lucide-react';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';

// Types
interface SbomSummary {
  total_components: number;
  production_components: number;
  dev_components: number;
  unique_licenses: number;
  license_distribution: Record<string, number>;
}

interface SbomDownload {
  url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

interface SbomCompliance {
  executive_order_14028: boolean;
  ntia_minimum_elements: boolean;
  missing_elements: string[];
}

interface SbomStorage {
  location: 'minio' | 'local' | 'memory';
  bucket?: string;
  key?: string;
  path?: string;
}

interface GeneratedSbom {
  sbom_id: string;
  project_id: string;
  project_name: string;
  format: 'cyclonedx' | 'spdx';
  spec_version: string;
  generated_at: string;
  generated_by: string;
  summary: SbomSummary;
  download: SbomDownload;
  sbom: Record<string, unknown>;
  storage: SbomStorage;
  compliance: SbomCompliance;
}

interface StoredSbom {
  id: string;
  format: 'cyclonedx' | 'spdx';
  spec_version: string;
  generated_at: string;
  generated_by: string;
  filename: string;
  size_bytes: number;
  component_count: number;
  download_url: string;
}

interface SbomListResponse {
  project_id: string;
  project_name: string;
  sboms: StoredSbom[];
  total: number;
}

interface Project {
  id: string;
  name: string;
  description?: string;
}

// API functions
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchProjects(): Promise<Project[]> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${API_BASE}/api/v1/projects`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }
  const data = await response.json();
  return data.projects || [];
}

async function fetchSbomList(projectId: string): Promise<SbomListResponse> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/sbom`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch SBOM list');
  }
  return response.json();
}

async function generateSbom(
  projectId: string,
  format: 'cyclonedx' | 'spdx',
  includeDevDeps: boolean
): Promise<GeneratedSbom> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/sbom/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      format,
      include_dev_dependencies: includeDevDeps,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate SBOM');
  }
  return response.json();
}

async function downloadSbom(projectId: string, sbomId: string, filename: string): Promise<void> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/sbom/${sbomId}/download`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to download SBOM');
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function SbomPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<'cyclonedx' | 'spdx'>('cyclonedx');
  const [includeDevDeps, setIncludeDevDeps] = useState(false);
  const [generatedSbom, setGeneratedSbom] = useState<GeneratedSbom | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Fetch projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  // Fetch SBOM list for selected project
  const { data: sbomList, isLoading: isLoadingSboms, refetch: refetchSboms } = useQuery({
    queryKey: ['sbom-list', selectedProject],
    queryFn: () => fetchSbomList(selectedProject),
    enabled: !!selectedProject,
  });

  // Generate SBOM mutation
  const generateMutation = useMutation({
    mutationFn: () => generateSbom(selectedProject, selectedFormat, includeDevDeps),
    onSuccess: (data) => {
      setGeneratedSbom(data);
      queryClient.invalidateQueries({ queryKey: ['sbom-list', selectedProject] });
    },
  });

  // Handle download
  const handleDownload = async (sbomId: string, filename: string) => {
    setDownloadingId(sbomId);
    try {
      await downloadSbom(selectedProject, sbomId, filename);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Feature #639: PageHeader component */}
        <PageHeader
          title="SBOM Generation"
          description="Generate Software Bill of Materials in CycloneDX or SPDX format"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'SBOM' }]}
        />

        {/* Generation Form */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Generate New SBOM</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Project Selection */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setGeneratedSbom(null);
                }}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoadingProjects}
              >
                <option value="">Select a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Format
              </label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as 'cyclonedx' | 'spdx')}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="cyclonedx">CycloneDX 1.5</option>
                <option value="spdx">SPDX 2.3</option>
              </select>
            </div>

            {/* Include Dev Dependencies */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDevDeps}
                  onChange={(e) => setIncludeDevDeps(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm">Include dev dependencies</span>
              </label>
            </div>

            {/* Generate Button */}
            <div className="flex items-end">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!selectedProject || generateMutation.isPending}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Generate SBOM
                  </>
                )}
              </Button>
            </div>
          </div>

          {generateMutation.isError && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
              {(generateMutation.error as Error).message}
            </div>
          )}
        </div>

        {/* Generated SBOM Result */}
        {generatedSbom && (
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-success flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                SBOM Generated Successfully
              </h3>
              <Button
                onClick={() => handleDownload(generatedSbom.sbom_id, generatedSbom.download.filename)}
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-foreground">
                  {generatedSbom.summary?.total_components ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Components</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-foreground">
                  {generatedSbom.summary?.production_components ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">Production</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-foreground">
                  {generatedSbom.summary?.dev_components ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">Development</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-foreground">
                  {generatedSbom.summary?.unique_licenses ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">Unique Licenses</div>
              </div>
            </div>

            {/* Compliance Status */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                generatedSbom.compliance?.executive_order_14028
                  ? 'bg-success/10 text-success'
                  : 'bg-warning/10 text-warning'
              }`}>
                {generatedSbom.compliance?.executive_order_14028 ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                EO 14028
              </span>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                generatedSbom.compliance?.ntia_minimum_elements
                  ? 'bg-success/10 text-success'
                  : 'bg-warning/10 text-warning'
              }`}>
                {generatedSbom.compliance?.ntia_minimum_elements ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                NTIA Minimum
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                {generatedSbom.format?.toUpperCase() || 'N/A'} {generatedSbom.spec_version || ''}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                {formatBytes(generatedSbom.download?.size_bytes ?? 0)}
              </span>
            </div>

            {/* License Distribution */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">License Distribution</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(generatedSbom.summary?.license_distribution || {})
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([license, count]) => (
                    <span
                      key={license}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted"
                    >
                      <span className="font-medium">{license}</span>
                      <span className="text-muted-foreground">({count})</span>
                    </span>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* SBOM History */}
        {selectedProject && (
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">SBOM History</h3>
              <Button
                onClick={() => refetchSboms()}
                variant="ghost"
                size="sm"
              >
                Refresh
              </Button>
            </div>

            {isLoadingSboms ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : !sbomList || sbomList.sboms.length === 0 ? (
              /* Feature #728: EmptyState adoption */
              <EmptyState
                icon={EmptyStateIcons.document}
                title="No SBOMs generated yet"
                description="Generate your first SBOM using the form above."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Filename</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Format</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Components</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Size</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Generated</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">By</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sbomList.sboms.map((sbom) => (
                      <tr key={sbom.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-4 font-mono text-xs">{sbom.filename}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-muted">
                            {sbom.format.toUpperCase()} {sbom.spec_version}
                          </span>
                        </td>
                        <td className="py-3 px-4">{sbom.component_count}</td>
                        <td className="py-3 px-4">{formatBytes(sbom.size_bytes)}</td>
                        <td className="py-3 px-4 text-muted-foreground">{formatDate(sbom.generated_at)}</td>
                        <td className="py-3 px-4 text-muted-foreground">{sbom.generated_by}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            onClick={() => handleDownload(sbom.id, sbom.filename)}
                            disabled={downloadingId === sbom.id}
                            size="sm"
                          >
                            {downloadingId === sbom.id ? (
                              <Loader2 className="animate-spin h-3 w-3" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">About SBOM</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">What is an SBOM?</h4>
              <p className="text-sm text-muted-foreground">
                A Software Bill of Materials (SBOM) is a formal, machine-readable inventory of software components
                and dependencies. It enables organizations to understand their software supply chain, identify
                vulnerabilities, and ensure license compliance.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Supported Formats</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">CycloneDX 1.5</span>
                  <span>Lightweight, security-focused format designed for use in software supply chain and security analysis.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">SPDX 2.3</span>
                  <span>ISO standard for communicating software license information. Widely adopted for compliance and legal review.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
