// Feature #1357: Extracted ProjectsPage for code quality compliance (400 line limit)
// Feature #636: Adopt Modal component in page-level inline modals
// Feature #71: Migrated to React Query for caching
// Feature #126: Added empty states with CTA
// Feature #337: Dark-first design system redesign
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { getErrorMessage, isNetworkError, isOffline } from '../utils/errorHandling';
// Feature #71: Import React Query hooks for caching
import { useProjects, useCreateProject, useInvalidateProjects } from '../hooks/api/useProjects';
// Feature #126: Empty state component
import { EmptyStates } from '../components/ui/EmptyState';
// Feature #337: Design system components
import {
  PageHeader,
  AnimatedCard,
  StatusPill,
  CardContent,
  useReducedMotion,
} from '../components/ui';
import { Plus, Archive, RotateCcw, Loader2 } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';

interface Project {
  id: string;
  name: string;
  description?: string;
  slug: string;
  created_at: string;
  archived?: boolean;
  archived_at?: string;
}

export function ProjectsPage() {
  const { token, user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectBaseUrl, setNewProjectBaseUrl] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [nameError, setNameError] = useState('');
  const [urlError, setUrlError] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [archivingProjectId, setArchivingProjectId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Feature #71: React Query hooks for caching - projects load instantly on revisit
  const { data: projectsData, isLoading, refetch: refetchProjects } = useProjects(showArchived);
  const createProjectMutation = useCreateProject();
  const { invalidateLists } = useInvalidateProjects();

  // Derive projects from React Query data
  const projects = (projectsData?.projects || []) as Project[];

  // URL validation helper
  const isValidUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid (optional field)
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Validate URL on blur
  const handleUrlBlur = () => {
    if (newProjectBaseUrl && !isValidUrl(newProjectBaseUrl)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)');
    } else {
      setUrlError('');
    }
  };

  // Clear URL error when valid
  const handleUrlChange = (value: string) => {
    setNewProjectBaseUrl(value);
    if (urlError && isValidUrl(value)) {
      setUrlError('');
    }
  };

  const canCreateProject = user?.role !== 'viewer';

  // Filter projects based on dropdown selection
  const filteredProjects = selectedProjectFilter === 'all'
    ? projects
    : projects.filter(p => p.id === selectedProjectFilter);

  // Feature #71: React Query handles fetching automatically based on showArchived
  // No manual useEffect needed - query key changes when showArchived changes

  // Handle archive/unarchive - Feature #71: Invalidate cache after archive
  const handleArchiveProject = async (projectId: string, archive: boolean) => {
    setArchivingProjectId(projectId);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ archived: archive }),
      });
      if (response.ok) {
        // Feature #71: Invalidate cache to refetch with updated data
        invalidateLists();
      }
    } catch (err) {
      console.error('Failed to archive project:', err);
    } finally {
      setArchivingProjectId(null);
    }
  };

  // Escape key handling moved to Modal component

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setNameError('');
    setUrlError('');

    // Validate name field
    if (!newProjectName.trim()) {
      setNameError('Project name is required');
      return;
    }
    if (newProjectName.length < 2) {
      setNameError('Project name must be at least 2 characters');
      return;
    }
    if (newProjectName.length > 100) {
      setNameError('Project name must be less than 100 characters');
      return;
    }

    // Validate URL if provided
    if (newProjectBaseUrl && !isValidUrl(newProjectBaseUrl)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    // Feature #71: Use React Query mutation for optimistic updates and cache management
    createProjectMutation.mutate(
      {
        name: newProjectName,
        description: newProjectDescription,
        repository_url: newProjectBaseUrl || undefined,
      },
      {
        onSuccess: (data) => {
          setNewProjectName('');
          setNewProjectDescription('');
          setNewProjectBaseUrl('');
          setShowCreateModal(false);
          toast.success(`Project "${data.project.name}" created successfully!`);
          // Navigate after a brief delay
          setTimeout(() => {
            navigate(`/projects/${data.project.id}`);
          }, 1500);
        },
        onError: (err) => {
          // Use enhanced error handling for better user messages
          const errorMessage = getErrorMessage(err, 'Failed to create project');
          const isRetriable = isNetworkError(err) || isOffline();

          if (isRetriable) {
            toast.error(`${errorMessage} You can retry when the connection is restored.`);
          } else {
            toast.error(errorMessage);
          }
        },
      }
    );
  };

  // Feature #337: Check for reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Feature #337: PageHeader with action buttons */}
        <PageHeader
          title="Projects"
          description="Manage your test projects"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Projects' }]}
          actions={
            <div className="flex items-center gap-4">
              {/* Show Archived Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">Show Archived</span>
              </label>
              {/* Project Filter Dropdown */}
              <select
                id="projectFilter"
                value={selectedProjectFilter}
                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="all">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}{project.archived ? ' (Archived)' : ''}
                  </option>
                ))}
              </select>
              {canCreateProject && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create Project
                </button>
              )}
            </div>
          }
        />

        {/* Projects list */}
        <div>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-40 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            /* Feature #126: Reusable empty state with CTA */
            projects.length === 0 ? (
              EmptyStates.noProjects(canCreateProject ? () => setShowCreateModal(true) : undefined)
            ) : (
              EmptyStates.noSearchResults(selectedProjectFilter, () => setSelectedProjectFilter('all'))
            )
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project, index) => (
                <AnimatedCard
                  key={project.id}
                  variant="interactive"
                  staggerIndex={index < 8 ? index : undefined}
                  className={project.archived ? 'border-warning/30 opacity-75' : ''}
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-foreground truncate">{project.name}</h3>
                          {project.archived && (
                            <StatusPill status="warning">Archived</StatusPill>
                          )}
                        </div>
                        {project.description && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>
                      {(user?.role === 'admin' || user?.role === 'owner') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveProject(project.id, !project.archived);
                          }}
                          disabled={archivingProjectId === project.id}
                          className={`shrink-0 rounded-md p-2 transition-colors ${
                            project.archived
                              ? 'text-success hover:bg-success/10'
                              : 'text-warning hover:bg-warning/10'
                          } disabled:opacity-50`}
                          title={project.archived ? 'Unarchive project' : 'Archive project'}
                        >
                          {archivingProjectId === project.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : project.archived ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">
                      ID: {project.id}
                      {project.archived_at && (
                        <span className="ml-2">
                          · Archived {new Date(project.archived_at).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </CardContent>
                </AnimatedCard>
              ))}
            </div>
          )}
        </div>

        {/* Create Project Modal - Feature #636: Using Modal component */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create Project"
          size="md"
        >
          <form onSubmit={handleCreateProject}>
            <ModalBody className="space-y-4">
              <div>
                <label htmlFor="project-name" className="mb-1 block text-sm font-medium text-foreground">
                  Project Name
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => {
                    setNewProjectName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  placeholder="My Test Project"
                  maxLength={100}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-foreground ${
                    nameError ? 'border-destructive' : 'border-input'
                  }`}
                />
                <div className="mt-1 flex justify-between">
                  {nameError ? (
                    <p className="text-sm text-destructive" role="alert" aria-live="polite">{nameError}</p>
                  ) : (
                    <span />
                  )}
                  <span className={`text-xs ${newProjectName.length > 90 ? 'text-warning' : 'text-muted-foreground'}`}>
                    {newProjectName.length}/100
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="project-description" className="mb-1 block text-sm font-medium text-foreground">
                  Description (optional)
                </label>
                <textarea
                  id="project-description"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Describe your project..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label htmlFor="project-base-url" className="mb-1 block text-sm font-medium text-foreground">
                  Base URL (optional)
                </label>
                <input
                  id="project-base-url"
                  type="url"
                  value={newProjectBaseUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onBlur={handleUrlBlur}
                  placeholder="https://example.com"
                  aria-describedby={urlError ? 'project-url-error' : undefined}
                  aria-invalid={!!urlError}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-foreground ${
                    urlError
                      ? 'border-destructive focus:border-destructive focus:ring-destructive'
                      : 'border-input focus:border-primary focus:ring-primary'
                  }`}
                />
                {urlError && (
                  <p id="project-url-error" role="alert" className="mt-1 text-sm text-destructive">{urlError}</p>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createProjectMutation.isPending}
                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {createProjectMutation.isPending && (
                  <Loader2 aria-hidden="true" className="animate-spin h-4 w-4" />
                )}
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
              </button>
            </ModalFooter>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
