// Feature #1350: AI Test Improvement Analyzer
// Extracted from App.tsx for code quality compliance

import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

// Types for test improvement analysis
interface TestImprovementAnalysis {
  overall_score: number;
  summary: string;
  best_practices: Array<{
    category: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    suggestion: string;
    code_example?: string;
    line_number?: number;
  }>;
  selector_improvements: Array<{
    original_selector: string;
    issue: string;
    suggested_selector: string;
    reason: string;
    confidence: number;
  }>;
  assertion_suggestions: Array<{
    location: string;
    current_assertion?: string;
    suggested_assertion: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  flakiness_risks: Array<{
    risk: string;
    severity: 'low' | 'medium' | 'high';
    location?: string;
    mitigation: string;
    code_example?: string;
  }>;
}

export function TestImprovementAnalyzerPage() {
  const { token } = useAuthStore();
  const [testCode, setTestCode] = useState<string>(`test('user can login successfully', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.fill('.email-input', 'user@example.com');
  await page.fill('.password-input', 'password123');
  await page.click('.login-button');
  await page.waitForTimeout(2000);
  const welcomeText = await page.textContent('.welcome-message');
  console.log('Welcome:', welcomeText);
});`);
  const [testName, setTestName] = useState<string>('user can login successfully');
  const [testType, setTestType] = useState<'e2e' | 'unit' | 'integration' | 'visual' | 'api'>('e2e');
  const [framework, setFramework] = useState<'playwright' | 'cypress' | 'selenium' | 'jest' | 'mocha'>('playwright');
  const [analysis, setAnalysis] = useState<TestImprovementAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'best-practices' | 'selectors' | 'assertions' | 'flakiness'>('best-practices');

  const analyzeTest = async () => {
    if (!testCode.trim()) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/v1/ai/analyze-test-improvements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          test_code: testCode,
          test_name: testName,
          test_type: testType,
          framework,
          include_best_practices: true,
          include_selector_analysis: true,
          include_assertion_suggestions: true,
          include_flakiness_analysis: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze test');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      console.error('Error analyzing test:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'low': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-amber-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 90) return 'from-green-500 to-emerald-500';
    if (score >= 75) return 'from-amber-500 to-yellow-500';
    if (score >= 60) return 'from-orange-500 to-amber-500';
    return 'from-red-500 to-orange-500';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>🔍</span> AI Test Improvement Analyzer
          </h1>
          <p className="text-muted-foreground mt-1">Analyze your tests for best practices, selectors, assertions, and flakiness risks</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="rounded-lg border bg-card p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Test Name</label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full p-2 rounded-md border border-input bg-background text-foreground"
              placeholder="Test name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Test Type</label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value as any)}
              className="w-full p-2 rounded-md border border-input bg-background text-foreground"
            >
              <option value="e2e">End-to-End</option>
              <option value="unit">Unit</option>
              <option value="integration">Integration</option>
              <option value="visual">Visual</option>
              <option value="api">API</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Framework</label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value as any)}
              className="w-full p-2 rounded-md border border-input bg-background text-foreground"
            >
              <option value="playwright">Playwright</option>
              <option value="cypress">Cypress</option>
              <option value="selenium">Selenium</option>
              <option value="jest">Jest</option>
              <option value="mocha">Mocha</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={analyzeTest}
              disabled={isAnalyzing || !testCode.trim()}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>🤖 Analyze Test</>
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Test Code</label>
          <textarea
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
            className="w-full h-64 p-4 rounded-md border border-input bg-background text-foreground font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Paste your test code here..."
          />
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Score Card */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Analysis Results</h2>
                <p className="text-muted-foreground text-sm mt-1">{analysis.summary}</p>
              </div>
              <div className={`text-center p-4 rounded-lg bg-gradient-to-br ${getScoreGradient(analysis.overall_score)} bg-opacity-10`}>
                <div className={`text-4xl font-bold ${getScoreColor(analysis.overall_score)}`}>
                  {analysis.overall_score}
                </div>
                <div className="text-sm text-muted-foreground">Quality Score</div>
              </div>
            </div>

            {/* Issue Summary */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold text-foreground">{analysis.best_practices.length}</div>
                <div className="text-sm text-muted-foreground">Best Practice Issues</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold text-foreground">{analysis.selector_improvements.length}</div>
                <div className="text-sm text-muted-foreground">Selector Improvements</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold text-foreground">{analysis.assertion_suggestions.length}</div>
                <div className="text-sm text-muted-foreground">Assertion Suggestions</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold text-foreground">{analysis.flakiness_risks.length}</div>
                <div className="text-sm text-muted-foreground">Flakiness Risks</div>
              </div>
            </div>
          </div>

          {/* Tabbed Content */}
          <div className="rounded-lg border bg-card">
            <div className="border-b border-border">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('best-practices')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'best-practices'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🏆 Best Practices ({analysis.best_practices.length})
                </button>
                <button
                  onClick={() => setActiveTab('selectors')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'selectors'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🎯 Selectors ({analysis.selector_improvements.length})
                </button>
                <button
                  onClick={() => setActiveTab('assertions')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'assertions'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ✅ Assertions ({analysis.assertion_suggestions.length})
                </button>
                <button
                  onClick={() => setActiveTab('flakiness')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'flakiness'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ⚡ Flakiness ({analysis.flakiness_risks.length})
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Best Practices Tab */}
              {activeTab === 'best-practices' && (
                <div className="space-y-4">
                  {analysis.best_practices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <span className="text-4xl">✅</span>
                      <p className="mt-2">No best practice issues found!</p>
                    </div>
                  ) : (
                    analysis.best_practices.map((practice, index) => (
                      <div key={index} className="p-4 rounded-lg border border-border">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadge(practice.severity)}`}>
                                {practice.severity.toUpperCase()}
                              </span>
                              <span className="text-sm font-medium text-muted-foreground">{practice.category}</span>
                            </div>
                            <h3 className="font-medium text-foreground mt-1">{practice.issue}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{practice.suggestion}</p>
                          </div>
                        </div>
                        {practice.code_example && (
                          <pre className="mt-3 p-3 rounded-md bg-muted/50 text-sm font-mono text-foreground overflow-x-auto">
                            {practice.code_example}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Selectors Tab */}
              {activeTab === 'selectors' && (
                <div className="space-y-4">
                  {analysis.selector_improvements.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <span className="text-4xl">🎯</span>
                      <p className="mt-2">Selectors look good!</p>
                    </div>
                  ) : (
                    analysis.selector_improvements.map((selector, index) => (
                      <div key={index} className="p-4 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">{selector.issue}</span>
                          <span className="text-xs text-muted-foreground">Confidence: {selector.confidence}%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs text-red-600 font-medium">ORIGINAL</span>
                            <code className="block mt-1 p-2 rounded bg-red-50 dark:bg-red-900/20 text-sm font-mono text-red-700 dark:text-red-300">
                              {selector.original_selector}
                            </code>
                          </div>
                          <div>
                            <span className="text-xs text-green-600 font-medium">SUGGESTED</span>
                            <code className="block mt-1 p-2 rounded bg-green-50 dark:bg-green-900/20 text-sm font-mono text-green-700 dark:text-green-300">
                              {selector.suggested_selector}
                            </code>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{selector.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Assertions Tab */}
              {activeTab === 'assertions' && (
                <div className="space-y-4">
                  {analysis.assertion_suggestions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <span className="text-4xl">✅</span>
                      <p className="mt-2">Assertions look comprehensive!</p>
                    </div>
                  ) : (
                    analysis.assertion_suggestions.map((assertion, index) => (
                      <div key={index} className="p-4 rounded-lg border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(assertion.priority)}`}>
                            {assertion.priority.toUpperCase()} PRIORITY
                          </span>
                          <span className="text-sm text-muted-foreground">{assertion.location}</span>
                        </div>
                        <p className="text-sm text-foreground font-medium">{assertion.reason}</p>
                        <code className="block mt-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20 text-sm font-mono text-blue-700 dark:text-blue-300">
                          {assertion.suggested_assertion}
                        </code>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Flakiness Tab */}
              {activeTab === 'flakiness' && (
                <div className="space-y-4">
                  {analysis.flakiness_risks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <span className="text-4xl">⚡</span>
                      <p className="mt-2">No flakiness risks detected!</p>
                    </div>
                  ) : (
                    analysis.flakiness_risks.map((risk, index) => (
                      <div key={index} className="p-4 rounded-lg border border-border">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadge(risk.severity)}`}>
                                {risk.severity.toUpperCase()} RISK
                              </span>
                              {risk.location && (
                                <span className="text-xs text-muted-foreground">{risk.location}</span>
                              )}
                            </div>
                            <h3 className="font-medium text-foreground mt-1">{risk.risk}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              <span className="font-medium">Mitigation:</span> {risk.mitigation}
                            </p>
                          </div>
                        </div>
                        {risk.code_example && (
                          <pre className="mt-3 p-3 rounded-md bg-muted/50 text-sm font-mono text-foreground overflow-x-auto">
                            {risk.code_example}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
