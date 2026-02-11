/**
 * CreateTestSuiteModal - Create test suite from AI suggestions
 * Feature #514: Extracted from QuickTestPage.tsx
 * Feature #637: Migrated to use Modal component from ui/Modal
 */

import { useState, useEffect } from 'react';
import {
  Loader2,
  Wand2,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FolderPlus,
  Plus,
} from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../ui/Modal';
import { useAuthStore } from '../../stores/authStore';
import type { CreateTestSuiteModalProps, TestSuggestion } from './types';

interface Project {
  id: string;
  name: string;
}

export function CreateTestSuiteModal({
  isOpen,
  testSuggestions,
  targetUrl,
  onClose,
}: CreateTestSuiteModalProps) {
  // Get token from auth store instead of props
  const { token } = useAuthStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [createNewProject, setCreateNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [suiteName, setSuiteName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; current: number; total: number } | null>(null);
  const [success, setSuccess] = useState<{ suiteId: string; projectId: string } | null>(null);

  // Load projects on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const response = await fetch('/api/v1/projects', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setProjects(data.projects || data.data || []);
          // Auto-select first project if available
          if ((data.projects || data.data || []).length > 0) {
            setSelectedProjectId((data.projects || data.data)[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();

    // Generate default suite name
    try {
      const hostname = new URL(targetUrl).hostname;
      const date = new Date().toISOString().split('T')[0];
      setSuiteName(`Quick Test - ${hostname} - ${date}`);
    } catch {
      setSuiteName(`Quick Test - ${new Date().toISOString().split('T')[0]}`);
    }
  }, [isOpen, token, targetUrl]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedProjectId('');
      setCreateNewProject(false);
      setNewProjectName('');
      setSuiteName('');
      setError(null);
      setProgress(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!testSuggestions || testSuggestions.length === 0) {
      setError('No test suggestions available');
      return;
    }

    if (!createNewProject && !selectedProjectId) {
      setError('Please select a project');
      return;
    }

    if (createNewProject && !newProjectName.trim()) {
      setError('Please enter a project name');
      return;
    }

    if (!suiteName.trim()) {
      setError('Please enter a suite name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let projectId = selectedProjectId;

      // Step 1: Create new project if needed
      if (createNewProject) {
        setProgress({ step: 'Creating project...', current: 0, total: testSuggestions.length + 2 });

        const projectResponse = await fetch('/api/v1/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newProjectName.trim(),
            description: `Created from Quick Test on ${new URL(targetUrl).hostname}`,
          }),
        });

        if (!projectResponse.ok) {
          const errData = await projectResponse.json();
          throw new Error(errData.message || 'Failed to create project');
        }

        const projectData = await projectResponse.json();
        projectId = projectData.project?.id || projectData.id;
      }

      // Step 2: Create test suite
      setProgress({ step: 'Creating test suite...', current: 1, total: testSuggestions.length + 2 });

      const suiteResponse = await fetch(`/api/v1/projects/${projectId}/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: suiteName.trim(),
          description: `Generated from Quick Test AI Analysis of ${targetUrl}`,
          type: 'e2e',
          base_url: targetUrl,
        }),
      });

      if (!suiteResponse.ok) {
        const errData = await suiteResponse.json();
        throw new Error(errData.message || 'Failed to create test suite');
      }

      const suiteData = await suiteResponse.json();
      const suiteId = suiteData.suite?.id || suiteData.id;

      // Step 3: Create test cases from suggestions
      for (let i = 0; i < testSuggestions.length; i++) {
        const suggestion = testSuggestions[i];
        setProgress({
          step: `Creating test ${i + 1}/${testSuggestions.length}: ${suggestion.name}`,
          current: i + 2,
          total: testSuggestions.length + 2,
        });

        // Map suggestion type to test_type
        const testTypeMap: Record<string, string> = {
          e2e: 'e2e',
          visual: 'visual_regression',
          performance: 'lighthouse',
          accessibility: 'accessibility',
          security: 'e2e', // Security tests are typically E2E tests
          api: 'e2e', // API tests are also E2E type
          load: 'load',
        };

        // Map priority to numeric value (1=high, 2=medium, 3=low)
        const priorityMap: Record<string, number> = {
          high: 1,
          medium: 2,
          low: 3,
        };

        const testResponse = await fetch(`/api/v1/suites/${suiteId}/tests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: suggestion.name,
            description: suggestion.description,
            test_type: testTypeMap[suggestion.type.toLowerCase()] || 'e2e',
            target_url: targetUrl,
            priority: priorityMap[suggestion.priority.toLowerCase()] || 2,
            ai_generated: true,
            ai_confidence_score: 0.8, // Default confidence for Quick Test suggestions
            steps: [
              { action: 'navigate', value: targetUrl, order: 0 },
              { action: 'wait', value: '2000', order: 1 },
            ],
          }),
        });

        if (!testResponse.ok) {
          console.warn(`Failed to create test: ${suggestion.name}`);
          // Continue with other tests even if one fails
        }
      }

      setProgress({ step: 'Done!', current: testSuggestions.length + 2, total: testSuggestions.length + 2 });
      setSuccess({ suiteId, projectId });

      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test suite');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Test Suite from AI Suggestions" size="lg">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" />
          <span>Create Test Suite from AI Suggestions</span>
        </div>
      </ModalHeader>

      <ModalBody className="space-y-4">
          {/* Test Count */}
          <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-2 rounded">
            <Lightbulb className="w-4 h-4" />
            <span>{testSuggestions?.length || 0} AI-generated test suggestions will be created</span>
          </div>

          {/* Project Selection */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Project</label>

            {isLoadingProjects ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading projects...
              </div>
            ) : (
              <div className="space-y-2">
                {/* Existing projects radio buttons */}
                {projects.length > 0 && !createNewProject && (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-muted border border-border text-foreground"
                    disabled={isLoading}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Create new project toggle */}
                <button
                  onClick={() => setCreateNewProject(!createNewProject)}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded border transition-colors ${
                    createNewProject
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted border-border text-muted-foreground hover:border-primary/50'
                  }`}
                  disabled={isLoading}
                >
                  <FolderPlus className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {createNewProject ? 'Creating new project' : 'Create new project instead'}
                  </span>
                </button>

                {/* New project name input */}
                {createNewProject && (
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="New project name"
                    className="w-full px-3 py-2 rounded bg-muted border border-border text-foreground placeholder:text-muted-foreground"
                    disabled={isLoading}
                  />
                )}
              </div>
            )}
          </div>

          {/* Suite Name */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Test Suite Name</label>
            <input
              type="text"
              value={suiteName}
              onChange={(e) => setSuiteName(e.target.value)}
              placeholder="Enter test suite name"
              className="w-full px-3 py-2 rounded bg-muted border border-border text-foreground placeholder:text-muted-foreground"
              disabled={isLoading}
            />
          </div>

          {/* Target URL Display */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Target URL</label>
            <div className="px-3 py-2 rounded bg-muted text-sm font-mono text-foreground/80 truncate">
              {targetUrl}
            </div>
          </div>

          {/* Progress */}
          {progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{progress.step}</span>
                <span className="text-foreground font-medium">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm p-2 rounded bg-destructive/10">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 text-success text-sm p-2 rounded bg-success/10">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Test suite created with {testSuggestions?.length || 0} tests!
              </span>
            </div>
          )}
      </ModalBody>

      <ModalFooter className="flex-row justify-between">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          disabled={isLoading}
        >
          Cancel
        </button>
        <div className="flex gap-2">
          {success && (
            <a
              href={`/suites/${success.suiteId}`}
              className="px-4 py-2 rounded bg-muted text-foreground hover:bg-muted/80 transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Suite
            </a>
          )}
          <button
            onClick={handleSubmit}
            disabled={isLoading || success !== null}
            className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Created!
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create {testSuggestions?.length || 0} Tests
              </>
            )}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
