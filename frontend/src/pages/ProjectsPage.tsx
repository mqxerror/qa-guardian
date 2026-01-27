// Feature #1357: Extracted ProjectsPage for code quality compliance (400 line limit)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { getErrorMessage, isNetworkError, isOffline } from '../utils/errorHandling';

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectBaseUrl, setNewProjectBaseUrl] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [nameError, setNameError] = useState('');
  const [urlError, setUrlError] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [archivingProjectId, setArchivingProjectId] = useState<string | null>(null);
  const navigate = useNavigate();

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

  // Fetch projects on mount and when archive filter changes
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (showArchived) {
          params.set('include_archived', 'true');
        }
        const response = await fetch(`/api/v1/projects?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setProjects(data.projects);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, [token, showArchived]);

  // Handle archive/unarchive
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
        const data = await response.json();
        setProjects(prev => prev.map(p => p.id === projectId ? data.project : p));
      }
    } catch (err) {
      console.error('Failed to archive project:', err);
    } finally {
      setArchivingProjectId(null);
    }
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateModal) {
        setShowCreateModal(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showCreateModal]);

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

    setIsCreating(true);

    try {
      const response = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription,
          base_url: newProjectBaseUrl || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create project');
      }

      const data = await response.json();
      setProjects([...projects, data.project]);
      setNewProjectName('');
      setNewProjectDescription('');
      setNewProjectBaseUrl('');
      setShowCreateModal(false);
      toast.success(`Project "${data.project.name}" created successfully!`);
      // Navigate after a brief delay
      setTimeout(() => {
        navigate(`/projects/${data.project.id}`);
      }, 1500);
    } catch (err) {
      // Use enhanced error handling for better user messages
      const errorMessage = getErrorMessage(err, 'Failed to create project');
      const isRetriable = isNetworkError(err) || isOffline();

      if (isRetriable) {
        toast.error(`${errorMessage} You can retry when the connection is restored.`);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Projects</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your test projects
            </p>
          </div>
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
            {/* Project Filter Dropdown - populated from database */}
            <div className="flex items-center gap-2">
              <label htmlFor="projectFilter" className="text-sm text-muted-foreground">
                Filter:
              </label>
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
            </div>
            {canCreateProject && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
              >
                Create Project
              </button>
            )}
          </div>
        </div>

        {/* Projects list */}
        <div className="mt-8">
          {isLoading ? (
            <p className="text-muted-foreground">Loading projects...</p>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <h3 className="text-lg font-semibold text-foreground">
                {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {projects.length === 0
                  ? 'Create your first project to start testing.'
                  : 'Try selecting a different filter.'}
              </p>
              {canCreateProject && projects.length === 0 && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create Project
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className={`rounded-lg border bg-card p-6 transition-shadow hover:shadow-md ${
                    project.archived ? 'border-amber-300 dark:border-amber-600 opacity-75' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="cursor-pointer flex-1 min-w-0"
                      title={project.name}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground truncate">{project.name}</h3>
                        {project.archived && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            Archived
                          </span>
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
                        className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          project.archived
                            ? 'text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30'
                            : 'text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30'
                        } disabled:opacity-50`}
                        title={project.archived ? 'Unarchive project' : 'Archive project'}
                      >
                        {archivingProjectId === project.id ? (
                          <span className="flex items-center gap-1">
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </span>
                        ) : project.archived ? (
                          'Restore'
                        ) : (
                          'Archive'
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Project Modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-project-title"
              className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="create-project-title" className="text-lg font-semibold text-foreground">Create Project</h3>
              <form onSubmit={handleCreateProject} className="mt-4 space-y-4">
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
                      nameError ? 'border-red-500' : 'border-input'
                    }`}
                  />
                  <div className="mt-1 flex justify-between">
                    {nameError ? (
                      <p className="text-sm text-red-500" role="alert" aria-live="polite">{nameError}</p>
                    ) : (
                      <span />
                    )}
                    <span className={`text-xs ${newProjectName.length > 90 ? 'text-orange-500' : 'text-muted-foreground'}`}>
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
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreating && (
                      <svg aria-hidden="true" className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isCreating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
