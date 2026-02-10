/**
 * SaveAsSuiteModal - Save Quick Test results as a Test Suite
 * Feature #599: Create test suite from completed Quick Test wave results
 *
 * Converts completed wave results into smoke tests that can be re-run.
 * Each wave generates appropriate test assertions based on its data.
 */

import { useState, useEffect } from 'react';
import {
  Loader2,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FolderPlus,
  Plus,
  Globe,
  Gauge,
  Shield,
  Brain,
  Accessibility,
  Network,
  Search,
} from 'lucide-react';
import type { WaveData } from './types';

// ============================================================
// Types
// ============================================================

interface SmokeTest {
  name: string;
  description: string;
  testType: string;
  priority: number;
  steps: Array<{ action: string; value: string; order: number }>;
  assertions: string[];
}

interface Project {
  id: string;
  name: string;
}

export interface SaveAsSuiteModalProps {
  isOpen: boolean;
  waves: WaveData[];
  targetUrl: string;
  onClose: () => void;
  token: string | null;
}

// ============================================================
// Wave Icons Mapping
// ============================================================

const waveIcons: Record<number, React.ElementType> = {
  1: Globe,       // Health Check
  2: Gauge,       // Visual + Performance
  3: Shield,      // Security Scan
  4: Brain,       // AI Analysis
  5: Accessibility, // Accessibility
  6: Network,     // API Discovery
  7: Search,      // SEO Analysis
};

// ============================================================
// Generate Smoke Tests from Wave Results
// ============================================================

function generateSmokeTests(waves: WaveData[], targetUrl: string): SmokeTest[] {
  const smokeTests: SmokeTest[] = [];

  for (const wave of waves) {
    if (wave.status !== 'completed') continue;

    const waveNumber = wave.wave;

    switch (waveNumber) {
      case 1: {
        // Wave 1: Health Check
        smokeTests.push({
          name: 'Health Check - DNS & HTTP Validation',
          description: 'Verify DNS resolution, HTTP response, and SSL certificate validity',
          testType: 'e2e',
          priority: 1,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'wait', value: '2000', order: 1 },
          ],
          assertions: [
            'DNS resolves successfully',
            'HTTP status code is 2xx or 3xx',
            'SSL certificate is valid',
            'Response time is under 5000ms',
          ],
        });
        break;
      }

      case 2: {
        // Wave 2: Visual + Performance
        const data = wave.data as Record<string, unknown>;
        const performanceScore = data?.performanceScore as number | undefined;
        smokeTests.push({
          name: 'Visual + Performance - Core Web Vitals',
          description: 'Verify visual rendering and Core Web Vitals metrics',
          testType: 'lighthouse',
          priority: 2,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'wait', value: '3000', order: 1 },
            { action: 'screenshot', value: 'desktop', order: 2 },
            { action: 'screenshot', value: 'mobile', order: 3 },
          ],
          assertions: [
            'Desktop screenshot captured successfully',
            'Mobile screenshot captured successfully',
            `Performance score is at least ${performanceScore ? Math.max(0, performanceScore - 10) : 50}`,
            'LCP is under 2.5s',
            'FID is under 100ms',
            'CLS is under 0.1',
          ],
        });
        break;
      }

      case 3: {
        // Wave 3: Security Scan
        smokeTests.push({
          name: 'Security Scan - Headers & Cookie Audit',
          description: 'Verify security headers are present and cookies are secure',
          testType: 'e2e',
          priority: 1,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'wait', value: '2000', order: 1 },
          ],
          assertions: [
            'X-Content-Type-Options header is present',
            'X-Frame-Options or CSP frame-ancestors is present',
            'Strict-Transport-Security header is present',
            'No mixed content detected',
            'Cookies have Secure and HttpOnly flags',
          ],
        });
        break;
      }

      case 4: {
        // Wave 4: AI Analysis - Page Insights & Recommendations
        const aiData = wave.data as Record<string, unknown>;
        const hasTestSuggestions = (aiData?.testSuggestions as unknown[])?.length > 0;
        const hasUxIssues = (aiData?.uxIssues as unknown[])?.length > 0;
        smokeTests.push({
          name: 'AI Analysis - Page Insights & Recommendations',
          description: 'Verify AI analysis generates insights and recommendations for the page',
          testType: 'e2e',
          priority: 2,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'wait', value: '3000', order: 1 },
            { action: 'ai_analyze', value: 'page', order: 2 },
          ],
          assertions: [
            'AI analysis results generated',
            'Page insights available',
            hasTestSuggestions ? 'Test suggestions provided by AI' : 'AI analysis completed',
            hasUxIssues ? 'UX issues identified' : 'No critical UX issues detected',
            'Summary generated',
          ],
        });
        break;
      }

      case 5: {
        // Wave 5: Accessibility
        const a11yData = wave.data as Record<string, unknown>;
        const a11yScore = a11yData?.score as number | undefined;
        smokeTests.push({
          name: 'Accessibility - WCAG 2.1 AA Compliance',
          description: 'Verify WCAG 2.1 AA accessibility compliance',
          testType: 'accessibility',
          priority: 1,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'wait', value: '2000', order: 1 },
            { action: 'axe_scan', value: 'full', order: 2 },
          ],
          assertions: [
            `Accessibility score is at least ${a11yScore ? Math.max(0, a11yScore - 10) : 70}`,
            'No critical accessibility violations',
            'No serious accessibility violations',
            'Images have alt text',
            'Form inputs have labels',
          ],
        });
        break;
      }

      case 6: {
        // Wave 6: API Discovery
        const apiData = wave.data as Record<string, unknown>;
        const endpointCount = (apiData?.endpoints as unknown[])?.length || 0;
        smokeTests.push({
          name: 'API Discovery - Endpoint Health & Auth',
          description: 'Verify discovered API endpoints are healthy and properly protected',
          testType: 'e2e',
          priority: 2,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'wait', value: '2000', order: 1 },
            { action: 'api_discovery', value: 'scan', order: 2 },
          ],
          assertions: [
            'API discovery completed',
            endpointCount > 0 ? `At least ${Math.max(1, Math.floor(endpointCount * 0.8))} endpoints healthy` : 'API endpoints checked',
            'Protected endpoints require authentication',
            'No sensitive endpoints publicly accessible',
          ],
        });
        break;
      }

      case 7: {
        // Wave 7: SEO Analysis
        const seoData = wave.data as Record<string, unknown>;
        const seoScore = seoData?.score as number | undefined;
        smokeTests.push({
          name: 'SEO Analysis - Meta Tags & Structured Data',
          description: 'Verify SEO meta tags, heading structure, and schema markup',
          testType: 'e2e',
          priority: 3,
          steps: [
            { action: 'navigate', value: targetUrl, order: 0 },
            { action: 'wait', value: '2000', order: 1 },
            { action: 'seo_scan', value: 'full', order: 2 },
          ],
          assertions: [
            `SEO score is at least ${seoScore ? Math.max(0, seoScore - 10) : 60}`,
            'Title tag is present and valid',
            'Meta description is present',
            'Canonical URL is set',
            'H1 heading exists and is unique',
            'robots.txt allows crawling',
          ],
        });
        break;
      }

      default:
        // Unknown wave number - skip
        break;
    }
  }

  return smokeTests;
}

// ============================================================
// Component
// ============================================================

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

  // Generate smoke tests from completed waves
  const smokeTests = generateSmokeTests(waves, targetUrl);
  const completedWaves = waves.filter(w => w.status === 'completed');

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
      setSuiteName(`Quick Test Smoke Suite - ${hostname} - ${date}`);
    } catch {
      setSuiteName(`Quick Test Smoke Suite - ${new Date().toISOString().split('T')[0]}`);
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
      setError('No completed waves to convert to tests');
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
      setProgress({ step: 'Creating test suite...', current: 1, total: smokeTests.length + 2 });

      const suiteResponse = await fetch(`/api/v1/projects/${projectId}/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: suiteName.trim(),
          description: `Generated Smoke Tests from Quick Test results for ${targetUrl}`,
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

      // Step 3: Create test cases from smoke tests
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
            ai_confidence_score: 0.9, // High confidence for smoke tests derived from actual results
            steps: test.steps,
            // Store assertions in metadata for reference
            metadata: {
              source: 'quick_test_smoke',
              assertions: test.assertions,
            },
          }),
        });

        if (!testResponse.ok) {
          console.warn(`Failed to create test: ${test.name}`);
          // Continue with other tests even if one fails
        }
      }

      setProgress({ step: 'Done!', current: smokeTests.length + 2, total: smokeTests.length + 2 });
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
            <Save className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Save as Test Suite</h2>
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
          {/* Completed Waves Summary */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Completed Waves</div>
            <div className="flex flex-wrap gap-2">
              {completedWaves.map((wave) => {
                const Icon = waveIcons[wave.wave] || Globe;
                return (
                  <div
                    key={wave.wave}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-success/10 text-success text-xs"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{wave.name}</span>
                  </div>
                );
              })}
            </div>
            {completedWaves.length === 0 && (
              <div className="text-sm text-muted-foreground italic">
                No waves completed yet. Run a Quick Test first.
              </div>
            )}
          </div>

          {/* Test Count */}
          <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-2 rounded">
            <CheckCircle2 className="w-4 h-4" />
            <span>{smokeTests.length} smoke tests will be created from {completedWaves.length} completed waves</span>
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
                {/* Existing projects dropdown */}
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
                Test suite created with {smokeTests.length} smoke tests!
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
                  Create {smokeTests.length} Smoke Tests
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SaveAsSuiteModal;
