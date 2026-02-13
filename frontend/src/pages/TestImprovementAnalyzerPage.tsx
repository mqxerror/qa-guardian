// Feature #1350: AI Test Improvement Analyzer
// Extracted from App.tsx for code quality compliance
// Feature #712: Migrated to React Query - useAnalyzeTestImprovements mutation

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { fetchWithAuth } from '../hooks/api/fetchWithAuth';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Button } from '@/components/ui/button';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';

import type { TestImprovementAnalysis } from '@/types/tests';

export function TestImprovementAnalyzerPage() {
 const token = useAuthStore(state => state.token);
 const [testCode, setTestCode] = useState<string>(`test('user can login successfully', async ({ page }) => {
 await page.goto('https://example.com/login');
 await page.fill('.email-input', 'user@example.com');
 await page.fill('.password-input', 'password123');
 await page.click('.login-button');
 await page.waitForTimeout(2000);
 const welcomeText = await page.textContent('.welcome-message');
 devLog('Welcome:', welcomeText);
});`);
 const [testName, setTestName] = useState<string>('user can login successfully');
 const [testType, setTestType] = useState<'e2e' | 'unit' | 'integration' | 'visual' | 'api'>('e2e');
 const [framework, setFramework] = useState<'playwright' | 'cypress' | 'selenium' | 'jest' | 'mocha'>('playwright');
 const [analysis, setAnalysis] = useState<TestImprovementAnalysis | null>(null);
 const [activeTab, setActiveTab] = useState<'best-practices' | 'selectors' | 'assertions' | 'flakiness'>('best-practices');

 // React Query mutation for test analysis
 const analyzeMutation = useMutation({
   mutationFn: async (data: {
     test_code: string;
     test_name: string;
     test_type: string;
     framework: string;
   }) => {
     const response = await fetchWithAuth('/api/v1/ai/analyze-test-improvements', token, {
       method: 'POST',
       body: JSON.stringify({
         ...data,
         include_best_practices: true,
         include_selector_analysis: true,
         include_assertion_suggestions: true,
         include_flakiness_analysis: true,
       }),
     });
     return response;
   },
   onSuccess: (data: { analysis: TestImprovementAnalysis }) => {
     setAnalysis(data.analysis);
   },
   onError: (error: Error) => {
     console.error('Error analyzing test:', error);
   },
 });

 const isAnalyzing = analyzeMutation.isPending;

 const analyzeTest = () => {
   if (!testCode.trim()) return;
   analyzeMutation.mutate({
     test_code: testCode,
     test_name: testName,
     test_type: testType,
     framework,
   });
 };

 const getSeverityBadge = (severity: string) => {
 switch (severity) {
 case 'high': return 'bg-destructive/20 text-destructive';
 case 'medium': return 'bg-warning/20 text-warning';
 case 'low': return 'bg-success/20 text-success';
 default: return 'bg-muted text-muted-foreground';
 }
 };

 const getPriorityBadge = (priority: string) => {
 switch (priority) {
 case 'high': return 'bg-destructive/20 text-destructive';
 case 'medium': return 'bg-warning/20 text-warning';
 case 'low': return 'bg-primary/20 text-primary';
 default: return 'bg-muted text-muted-foreground';
 }
 };

 const getScoreColor = (score: number) => {
 if (score >= 90) return 'text-success';
 if (score >= 75) return 'text-warning';
 if (score >= 60) return 'text-warning';
 return 'text-destructive';
 };

 const getScoreGradient = (score: number) => {
 if (score >= 90) return 'from-success to-success';
 if (score >= 75) return 'from-warning to-warning';
 if (score >= 60) return 'from-warning to-warning';
 return 'from-destructive to-warning';
 };

 return (
 <Layout>
 <div className="space-y-6 p-6">
 {/* Feature #640: PageHeader component */}
 <PageHeader
   title="🔍 AI Test Improvement Analyzer"
   description="Analyze your tests for best practices, selectors, assertions, and flakiness risks"
   breadcrumbs={[
     { label: 'Home', href: '/' },
     { label: 'AI Features', href: '/ai/flaky-tests' },
     { label: 'Test Analyzer' }
   ]}
 />

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
 onChange={(e) => setTestType(e.target.value as 'e2e' | 'unit' | 'integration' | 'visual' | 'api')}
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
 onChange={(e) => setFramework(e.target.value as 'playwright' | 'cypress' | 'selenium' | 'jest' | 'mocha')}
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
 <Button
 onClick={analyzeTest}
 disabled={isAnalyzing || !testCode.trim()}
 className="w-full"
 >
 {isAnalyzing ? (
 <>
 <Loader2 className="animate-spin h-4 w-4" />
 Analyzing...
 </>
 ) : (
 <>🤖 Analyze Test</>
 )}
 </Button>
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
 <Button
 variant="ghost"
 onClick={() => setActiveTab('best-practices')}
 className={`px-4 py-3 text-sm font-medium border-b-2 rounded-none ${
 activeTab === 'best-practices'
 ? 'border-primary text-primary'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 }`}
 >
 🏆 Best Practices ({analysis.best_practices.length})
 </Button>
 <Button
 variant="ghost"
 onClick={() => setActiveTab('selectors')}
 className={`px-4 py-3 text-sm font-medium border-b-2 rounded-none ${
 activeTab === 'selectors'
 ? 'border-primary text-primary'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 }`}
 >
 🎯 Selectors ({analysis.selector_improvements.length})
 </Button>
 <Button
 variant="ghost"
 onClick={() => setActiveTab('assertions')}
 className={`px-4 py-3 text-sm font-medium border-b-2 rounded-none ${
 activeTab === 'assertions'
 ? 'border-primary text-primary'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 }`}
 >
 ✅ Assertions ({analysis.assertion_suggestions.length})
 </Button>
 <Button
 variant="ghost"
 onClick={() => setActiveTab('flakiness')}
 className={`px-4 py-3 text-sm font-medium border-b-2 rounded-none ${
 activeTab === 'flakiness'
 ? 'border-primary text-primary'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 }`}
 >
 ⚡ Flakiness ({analysis.flakiness_risks.length})
 </Button>
 </nav>
 </div>

 <div className="p-6">
 {/* Best Practices Tab */}
 {activeTab === 'best-practices' && (
 <div className="space-y-4">
 {/* Feature #728: EmptyState adoption */}
 {analysis.best_practices.length === 0 ? (
 <EmptyState icon={EmptyStateIcons.test} title="No best practice issues found!" description="Your tests follow all recommended best practices." size="sm" />
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
 <span className="text-xs text-destructive font-medium">ORIGINAL</span>
 <code className="block mt-1 p-2 rounded bg-destructive/5 text-sm font-mono text-destructive">
 {selector.original_selector}
 </code>
 </div>
 <div>
 <span className="text-xs text-success font-medium">SUGGESTED</span>
 <code className="block mt-1 p-2 rounded bg-success/5 text-sm font-mono text-success">
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
 <code className="block mt-2 p-2 rounded bg-primary/5 text-sm font-mono text-primary">
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
 </Layout>
 );
}
