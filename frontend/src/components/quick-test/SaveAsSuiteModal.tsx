/**
 * SaveAsSuiteModal - Save Quick Test results as a Smoke Test Suite
 * Feature #532: Converts Quick Test wave results into reusable test suite
 */

import { useState, useEffect } from 'react';
import {
  Loader2,
  X,
  TestTube2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FolderPlus,
  Plus,
  Shield,
  Globe,
  Gauge,
  Accessibility,
  Network,
  Search,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
}

interface WaveInfo {
  wave: number;
  name: string;
  status: string;
  data?: Record<string, unknown>;
  duration?: number;
}

export interface SaveAsSuiteModalProps {
  isOpen: boolean;
  waves: WaveInfo[];
  targetUrl: string;
  onClose: () => void;
  token: string;
}

// Generate smoke test cases from wave results
function generateSmokeTests(waves: WaveInfo[], targetUrl: string) {
  const tests: Array<{
    name: string;
    description: string;
    testType: string;
    priority: number;
    steps: Array<{ action: string; value: string; order: number }>;
  }> = [];

  for (const wave of waves) {
    if (wave.status !== 'completed') continue;

    switch (wave.wave) {
      case 1: // Health Check
        tests.push({
          name: 'Health Check - DNS/HTTP/SSL Validation',
          description: `Verify that ${targetUrl} responds with valid DNS, HTTP status 200, and valid SSL certificate.`,
          testType: 'e2e',
          priority: 1,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'assert', value: 'Page loads successfully with HTTP 200', order: 1 },
            { action: 'assert', value: 'SSL certificate is valid', order: 2 },
          ],
        });
        break;
      case 2: // Visual + Performance
        tests.push({
          name: 'Performance Check - Core Web Vitals',
          description: `Verify that ${targetUrl} meets performance benchmarks including TTFB, FCP, and LCP.`,
          testType: 'lighthouse',
          priority: 2,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'assert', value: 'TTFB under 800ms', order: 1 },
            { action: 'assert', value: 'FCP under 1.8s', order: 2 },
            { action: 'screenshot', value: 'desktop', order: 3 },
          ],
        });
        break;
      case 3: // Security Scan
        tests.push({
          name: 'Security Scan - OWASP Headers & Vulnerabilities',
          description: `Verify that ${targetUrl} has proper security headers and no exposed sensitive paths.`,
          testType: 'e2e',
          priority: 1,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'assert', value: 'X-Content-Type-Options header present', order: 1 },
            { action: 'assert', value: 'No exposed admin paths', order: 2 },
            { action: 'assert', value: 'No mixed content', order: 3 },
          ],
        });
        break;
      case 5: // Accessibility
        tests.push({
          name: 'Accessibility Audit - WCAG 2.1 AA Compliance',
          description: `Verify that ${targetUrl} passes axe-core accessibility checks with no critical violations.`,
          testType: 'accessibility',
          priority: 2,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'assert', value: 'No critical accessibility violations', order: 1 },
            { action: 'assert', value: 'All images have alt text', order: 2 },
            { action: 'assert', value: 'Proper heading hierarchy', order: 3 },
          ],
        });
        break;
      case 6: // API Discovery
        tests.push({
          name: 'API Endpoint Discovery & Health Check',
          description: `Verify that API endpoints discovered on ${targetUrl} respond correctly.`,
          testType: 'e2e',
          priority: 3,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'assert', value: 'API endpoints respond with valid status codes', order: 1 },
            { action: 'assert', value: 'No exposed API keys or credentials', order: 2 },
          ],
        });
        break;
      case 7: // SEO Analysis
        tests.push({
          name: 'SEO Analysis - Meta Tags & Crawlability',
          description: `Verify that ${targetUrl} has proper SEO meta tags, heading hierarchy, and crawlability configuration.`,
          testType: 'e2e',
          priority: 2,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'assert', value: 'Page has valid title tag', order: 1 },
            { action: 'assert', value: 'Meta description present', order: 2 },
            { action: 'assert', value: 'Exactly one H1 tag', order: 3 },
            { action: 'assert', value: 'robots.txt accessible', order: 4 },
          ],
        });
        break;
    }
  }

  return tests;
}

// Wave icon mapping
const waveIcons: Record<number, typeof Globe> = {
  1: Globe,
  2: Gauge,
  3: Shield,
  5: Accessibility,
  6: Network,
  7: Search,
};

export function SaveAsSuiteModal({
  isOpen,
  waves,
  targetUrl,
  onClose,
  token,
}: SaveAsSuiteModalProps) {
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

  const smokeTests = generateSmokeTests(waves, targetUrl);

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
          const projectList = data.projects || data.data || [];
          setProjects(projectList);
          if (projectList.length > 0) {
            setSelectedProjectId(projectList[0].id);
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
      setSuiteName(`Smoke Test - ${hostname} - ${date}`);
    } catch {
      setSuiteName(`Smoke Test - ${new Date().toISOString().split('T')[0]}`);
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
    if (smokeTests.length === 0) {
      setError('No completed waves to create test cases from');
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
        setProgress({ step: 'Creating project...', current: 0, total: smokeTests.length + 2 });

        const projectResponse = await fetch('/api/v1/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newProjectName.trim(),
            description: `Created from Quick Test Smoke Suite on ${new URL(targetUrl).hostname}`,
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
      setProgress({ step: 'Creating smoke test suite...', current: 1, total: smokeTests.length + 2 });

      const suiteResponse = await fetch(`/api/v1/projects/${projectId}/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: suiteName.trim(),
          description: `Smoke Test Suite generated from Quick Test analysis of ${targetUrl}. Contains ${smokeTests.length} test cases covering health, performance, security, accessibility, API, and SEO checks.`,
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

      // Step 3: Create test cases from wave results
      for (let i = 0; i < smokeTests.length; i++) {
        const test = smokeTests[i];
        setProgress({
          step: `Creating test ${i + 1}/${smokeTests.length}: ${test.name}`,
          current: i + 2,
          total: smokeTests.length + 2,
        });

        const testResponse = await fetch(`/api/v1/suites/${suiteId}/tests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: test.name,
            description: test.description,
            test_type: test.testType,
            target_url: targetUrl,
            priority: test.priority,
            ai_generated: true,
            ai_confidence_score: 0.9,
            steps: test.steps,
          }),
        });

        if (!testResponse.ok) {
          console.warn(`Failed to create test: ${test.name}`);
        }
      }

      setProgress({ step: 'Done!', current: smokeTests.length + 2, total: smokeTests.length + 2 });
      setSuccess({ suiteId, projectId });

      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create smoke test suite');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <div className="flex items-center gap-2">
            <TestTube2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Save as Smoke Test Suite</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Test Cases Preview */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-2 rounded">
              <TestTube2 className="w-4 h-4" />
              <span>{smokeTests.length} smoke test cases from completed waves</span>
            </div>
            <div className="flex flex-wrap gap-1.5 px-1 pt-1">
              {smokeTests.map((test, i) => {
                const waveNum = waves.find(w => test.name.toLowerCase().includes(w.name.toLowerCase().split(' ')[0]))?.wave || 0;
                const Icon = waveIcons[waveNum] || TestTube2;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                  >
                    <Icon className="w-3 h-3" />
                    {test.name.split(' - ')[0]}
                  </span>
                );
              })}
            </div>
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
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Suite Name</label>
            <input
              type="text"
              value={suiteName}
              onChange={(e) => setSuiteName(e.target.value)}
              placeholder="Enter smoke test suite name"
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
                Smoke test suite created with {smokeTests.length} tests!
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-3 p-4 border-t border-border sticky bottom-0 bg-card">
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
              disabled={isLoading || success !== null || smokeTests.length === 0}
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
                  Create {smokeTests.length} Tests
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
