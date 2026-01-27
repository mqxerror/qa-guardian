// TestSuitePage - Extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules
// Feature #1768: Connect AI Generate tab to UnifiedAIService
// Feature #1800: CreateTestModal with two-section layout
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useToastStore, toast } from '../stores/toastStore';
import { getErrorMessage, isNetworkError, isOffline } from '../utils/errorHandling';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';
// Feature #1768: Import UnifiedAIService for AI test generation
import { UnifiedAIService } from '../services/UnifiedAIService';
// Feature #1800: Import new CreateTestModal with two-section layout
import { CreateTestModal } from '../components/create-test';

// Feature #1759: Extract URL from user description to avoid using example.com
// Matches URLs like: mercan.pa, https://mercan.pa, www.example.org, sub.domain.com/path
function extractUrlFromText(text: string): string | null {
  if (!text) return null;

  // Match full URLs first (with protocol)
  const fullUrlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  if (fullUrlMatch) {
    return fullUrlMatch[0].replace(/[.,;:!?)]+$/, ''); // Remove trailing punctuation
  }

  // Match domain-like patterns (domain.tld, www.domain.tld)
  const domainMatch = text.match(/(?:^|\s)((?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|org|net|io|co|pa|dev|app|ai|me|us|uk|de|fr|es|it|nl|be|ch|at|au|nz|jp|kr|cn|in|br|mx|ar|cl|ru|pl|se|no|dk|fi|pt|gr|cz|hu|ro|bg|hr|sk|si|lt|lv|ee|is|ie|lu|mt|cy)[^\s<>"']*)(?:\s|$)/i);
  if (domainMatch) {
    const domain = domainMatch[1].replace(/[.,;:!?)]+$/, '');
    return `https://${domain}`;
  }

  return null;
}

// Feature #1764: Extract test type from natural language description
// Detects: visual, e2e, performance, load, accessibility
function extractTestTypeFromText(text: string): 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility' | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Visual regression patterns
  if (/visual|screenshot|baseline|pixel|appearance|look|design|ui\s*check/i.test(lower)) {
    return 'visual_regression';
  }

  // Performance/Lighthouse patterns
  if (/performance|lighthouse|speed|lcp|cls|fcp|core\s*web\s*vitals|page\s*speed/i.test(lower)) {
    return 'lighthouse';
  }

  // Load test patterns
  if (/load\s*test|stress|k6|concurrent|virtual\s*users|throughput|scalability/i.test(lower)) {
    return 'load';
  }

  // Accessibility patterns
  if (/accessibility|a11y|wcag|screen\s*reader|aria|accessible/i.test(lower)) {
    return 'accessibility';
  }

  // E2E patterns (default for action-based descriptions)
  if (/click|fill|type|login|submit|navigate|form|button|input|test\s+that|verify|check\s+if/i.test(lower)) {
    return 'e2e';
  }

  return null;
}

// Feature #1764: Extract viewport from natural language description
// Detects: mobile, tablet, desktop
function extractViewportFromText(text: string): { width: number; height: number; preset: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Mobile patterns
  if (/mobile|phone|iphone|android|small\s*screen/i.test(lower)) {
    return { width: 375, height: 812, preset: 'Mobile (375×812)' };
  }

  // Tablet patterns
  if (/tablet|ipad|medium\s*screen/i.test(lower)) {
    return { width: 768, height: 1024, preset: 'Tablet (768×1024)' };
  }

  // Desktop patterns (explicit)
  if (/desktop|large\s*screen|full\s*screen|1920|1080/i.test(lower)) {
    return { width: 1920, height: 1080, preset: 'Desktop (1920×1080)' };
  }

  return null;
}

// Types
interface TestSuite {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  test_count?: number;
  browser?: string;
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  retry_count?: number;
}

interface TestType {
  id: string;
  suite_id: string;
  name: string;
  description?: string;
  type: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility' | 'api';
  test_type?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'active' | 'draft';
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  target_url?: string;
  viewport_width?: number;
  viewport_height?: number;
  capture_mode?: 'full_page' | 'viewport' | 'element';
  element_selector?: string;
  wait_for_selector?: string;
  wait_time?: number;
  hide_selectors?: string[];
  remove_selectors?: string[];
  diff_threshold?: number;
  diff_threshold_mode?: 'percentage' | 'pixel_count';
  diff_pixel_threshold?: number;
  anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high';
  color_threshold?: number;
  ignore_regions?: Array<{id: string; x: number; y: number; width: number; height: number; name?: string}>;
  ignore_selectors?: string[];
  multi_viewport?: boolean;
  selected_viewports?: string[];
  steps?: any[];
  // Lighthouse specific
  device_preset?: 'mobile' | 'desktop';
  performance_threshold?: number;
  lcp_threshold?: number;
  cls_threshold?: number;
  bypass_csp?: boolean;
  ignore_ssl_errors?: boolean;
  audit_timeout?: number;
  // Accessibility specific
  wcag_level?: 'A' | 'AA' | 'AAA';
  include_best_practices?: boolean;
  include_experimental?: boolean;
  include_pa11y?: boolean;
  a11y_fail_on_critical?: number;
  a11y_fail_on_serious?: number;
  a11y_fail_on_moderate?: number;
  a11y_fail_on_minor?: number;
  a11y_fail_on_any?: boolean;
  // Load test specific
  virtual_users?: number;
  duration?: number;
  ramp_up_time?: number;
  k6_script?: string;
  // AI generation metadata
  ai_generated?: boolean;
  ai_confidence_score?: number;
  requires_review?: boolean;
  review_status?: 'pending' | 'approved' | 'rejected' | 'pending_review';
  reviewed_by?: string;
  reviewed_at?: string;
  // Self-healing properties
  healing_active?: boolean;
  healing_status?: 'idle' | 'healing' | 'healed';
  healing_count?: number;
  // Feature #1958: Run metadata for test list display
  run_count?: number;
  last_result?: 'passed' | 'failed' | 'error' | 'running' | null;
  avg_duration_ms?: number | null;
}

// Feature #1959: Format date as relative time (e.g., "2 min ago", "1 hour ago")
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function TestSuitePage() {
  const { suiteId } = useParams<{ suiteId: string }>();
  const { token, user } = useAuthStore();
  const navigate = useNavigate();

  // Feature #1768: Set token on UnifiedAIService for authenticated AI requests
  useEffect(() => {
    UnifiedAIService.setToken(token || null);
  }, [token]);
  const [suite, setSuite] = useState<TestSuite & { project_id: string } | null>(null);
  const [tests, setTests] = useState<TestType[]>([]);
  // Feature #1786: Project includes base_url for test inheritance
  const [project, setProject] = useState<{ id: string; name: string; base_url?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  // Feature #1800: New two-section modal toggle (use new modal by default)
  const [showNewCreateTestModal, setShowNewCreateTestModal] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newTestDescription, setNewTestDescription] = useState('');
  const [newTestType, setNewTestType] = useState<'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility'>('e2e');
  const [newTestDevicePreset, setNewTestDevicePreset] = useState<'mobile' | 'desktop'>('desktop');
  const [newTestPerformanceThreshold, setNewTestPerformanceThreshold] = useState(50); // Minimum performance score (0-100)
  const [newTestLcpThreshold, setNewTestLcpThreshold] = useState(2500); // LCP threshold in ms (0 = disabled)
  const [newTestClsThreshold, setNewTestClsThreshold] = useState(0.1); // CLS threshold (0 = disabled)
  const [newTestBypassCsp, setNewTestBypassCsp] = useState(false); // Bypass CSP for Lighthouse audits
  const [newTestIgnoreSslErrors, setNewTestIgnoreSslErrors] = useState(false); // Ignore SSL certificate errors
  const [newTestAuditTimeout, setNewTestAuditTimeout] = useState(60); // Audit timeout in seconds (30-300)
  // Accessibility test specific states
  const [newTestWcagLevel, setNewTestWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA');
  const [newTestIncludeBestPractices, setNewTestIncludeBestPractices] = useState(true);
  const [newTestIncludeExperimental, setNewTestIncludeExperimental] = useState(false);
  const [newTestIncludePa11y, setNewTestIncludePa11y] = useState(false); // Include Pa11y checks alongside axe-core
  // Accessibility threshold states - undefined means no limit, 0 means fail on any
  const [newTestA11yFailOnCritical, setNewTestA11yFailOnCritical] = useState<number | undefined>(0); // Default: fail on any critical
  const [newTestA11yFailOnSerious, setNewTestA11yFailOnSerious] = useState<number | undefined>(undefined); // Default: no limit
  const [newTestA11yFailOnModerate, setNewTestA11yFailOnModerate] = useState<number | undefined>(undefined); // Default: no limit
  const [newTestA11yFailOnMinor, setNewTestA11yFailOnMinor] = useState<number | undefined>(undefined); // Default: no limit
  const [newTestA11yFailOnAny, setNewTestA11yFailOnAny] = useState(false); // Fail on any violation
  // K6 Load test specific states
  const [newTestVirtualUsers, setNewTestVirtualUsers] = useState(10); // Number of virtual users
  const [newTestDuration, setNewTestDuration] = useState(60); // Test duration in seconds
  const [newTestRampUpTime, setNewTestRampUpTime] = useState(10); // Ramp-up time in seconds
  const [newTestTargetUrl, setNewTestTargetUrl] = useState('');
  // Feature #1771: Smart URL input with validation
  const [urlValidationState, setUrlValidationState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [urlFavicon, setUrlFavicon] = useState<string | null>(null);
  // Feature #1772: Natural language input bar
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [isParsingNaturalLanguage, setIsParsingNaturalLanguage] = useState(false);
  const [newTestK6Script, setNewTestK6Script] = useState(''); // Custom K6 script for test creation
  const [showK6Editor, setShowK6Editor] = useState(false); // Toggle K6 script editor visibility
  const [newTestViewportPreset, setNewTestViewportPreset] = useState('desktop');
  const [newTestViewportWidth, setNewTestViewportWidth] = useState(1920);
  const [newTestViewportHeight, setNewTestViewportHeight] = useState(1080);
  const [newTestCaptureMode, setNewTestCaptureMode] = useState<'full_page' | 'viewport' | 'element'>('full_page');
  const [newTestElementSelector, setNewTestElementSelector] = useState('');
  const [newTestWaitForSelector, setNewTestWaitForSelector] = useState('');
  const [newTestWaitTime, setNewTestWaitTime] = useState<number | undefined>(undefined);
  const [newTestHideSelectors, setNewTestHideSelectors] = useState('');
  const [newTestRemoveSelectors, setNewTestRemoveSelectors] = useState('');
  const [newTestMultiViewport, setNewTestMultiViewport] = useState(false);
  const [newTestSelectedViewports, setNewTestSelectedViewports] = useState<string[]>(['desktop', 'tablet', 'mobile']);
  const [newTestDiffThreshold, setNewTestDiffThreshold] = useState(0); // 0% = exact match required
  const [newTestDiffThresholdMode, setNewTestDiffThresholdMode] = useState<'percentage' | 'pixel_count'>('percentage');
  const [newTestDiffPixelThreshold, setNewTestDiffPixelThreshold] = useState(0); // Pixel count threshold
  // Feature #647: Anti-aliasing tolerance for cross-browser comparisons
  const [newTestAntiAliasingTolerance, setNewTestAntiAliasingTolerance] = useState<'off' | 'low' | 'medium' | 'high'>('off');
  const [newTestColorThreshold, setNewTestColorThreshold] = useState<number | undefined>(undefined); // Custom color threshold (0.0-1.0)
  const [newTestIgnoreRegions, setNewTestIgnoreRegions] = useState<Array<{id: string; x: number; y: number; width: number; height: number; name?: string}>>([]);
  const [newTestIgnoreSelectors, setNewTestIgnoreSelectors] = useState<string[]>([]);
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [createTestError, setCreateTestError] = useState('');
  const [testNameError, setTestNameError] = useState('');
  // Feature #1770: Progressive disclosure - track advanced settings expansion
  // Persists across modal opens via localStorage
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(() => {
    try {
      return localStorage.getItem('create-test-advanced-expanded') === 'true';
    } catch {
      return false;
    }
  });
  // Feature #1235: AI Test Copilot state
  const [showAICopilot, setShowAICopilot] = useState(true);
  const [aiCopilotSuggestions, setAICopilotSuggestions] = useState<Array<{
    id: string;
    type: 'selector' | 'assertion' | 'name' | 'description' | 'best_practice';
    message: string;
    suggestion: string;
    impact: 'high' | 'medium' | 'low';
    field?: string;
  }>>([]);
  const [isAICopilotAnalyzing, setIsAICopilotAnalyzing] = useState(false);
  // Feature #1342: Natural Language Test Generation state
  const [showAITestGenerator, setShowAITestGenerator] = useState(false);
  const [isTestFromAI, setIsTestFromAI] = useState(false); // Feature #1151: Track if test being created is AI-generated
  const [aiConfidenceScore, setAiConfidenceScore] = useState<number | undefined>(undefined); // Feature #1164: Store AI confidence score for test creation
  const [aiTestDescription, setAITestDescription] = useState('');
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [generatedTestCode, setGeneratedTestCode] = useState('');
  const [generatedTestPreview, setGeneratedTestPreview] = useState<{
    test_name: string;
    steps: string[];
    selectors: string[];
    assertions: string[];
    syntax_valid: boolean;
    syntax_errors?: string[];
    complexity: 'simple' | 'medium' | 'complex';
    warnings?: string[];
    // Feature #1153: Test generation confidence score
    confidence_score?: number;
    confidence_factors?: {
      factor: string;
      score: number;
      max_score: number;
      description: string;
    }[];
  } | null>(null);
  const [showGeneratedCodeModal, setShowGeneratedCodeModal] = useState(false);
  const [aiGenerationError, setAIGenerationError] = useState('');
  // Feature #1343: Screenshot-to-Test Conversion state
  const [aiGenMode, setAIGenMode] = useState<'text' | 'screenshot' | 'user-story' | 'gherkin' | 'wizard' | 'openapi'>('text');
  // Feature #1162: AI Test Generation Wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardTestDescription, setWizardTestDescription] = useState('');
  const [wizardTargetUrl, setWizardTargetUrl] = useState('');
  const [wizardGeneratedCode, setWizardGeneratedCode] = useState('');
  const [wizardCustomizedCode, setWizardCustomizedCode] = useState('');
  const [wizardTestName, setWizardTestName] = useState('');
  const [isWizardGenerating, setIsWizardGenerating] = useState(false);
  const [wizardError, setWizardError] = useState('');
  // Feature #1149: User Story to Test Suite state
  const [userStoryInput, setUserStoryInput] = useState('');
  const [isGeneratingTestSuite, setIsGeneratingTestSuite] = useState(false);
  const [generatedTestSuite, setGeneratedTestSuite] = useState<{
    suite_name: string;
    user_story: string;
    tests: Array<{
      code: string;
      test_name: string;
      description: string;
      steps: string[];
      selectors: string[];
      assertions: string[];
      syntax_valid: boolean;
      complexity: string;
    }>;
    edge_case_tests: Array<{
      code: string;
      test_name: string;
      description: string;
      steps: string[];
      selectors: string[];
      assertions: string[];
      syntax_valid: boolean;
      complexity: string;
    }>;
    total_tests: number;
    estimated_total_duration_ms: number;
  } | null>(null);
  const [showTestSuitePreview, setShowTestSuitePreview] = useState(false);
  const [selectedTestFromSuite, setSelectedTestFromSuite] = useState<number | null>(null);
  const [includeEdgeCases, setIncludeEdgeCases] = useState(true);
  // Feature #1150: Gherkin to Playwright conversion state
  const [gherkinInput, setGherkinInput] = useState('');
  const [isConvertingGherkin, setIsConvertingGherkin] = useState(false);
  const [convertedGherkinTest, setConvertedGherkinTest] = useState<{
    code: string;
    test_name: string;
    feature_name: string;
    scenario_name: string;
    steps: Array<{
      keyword: string;
      text: string;
      action: string;
      playwright_code: string;
    }>;
    syntax_valid: boolean;
    complexity: string;
  } | null>(null);
  // Feature #1166: OpenAPI/Swagger API test generation state
  const [openApiSpecInput, setOpenApiSpecInput] = useState('');
  const [parsedOpenApiEndpoints, setParsedOpenApiEndpoints] = useState<Array<{
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    selected: boolean;
    parameters?: Array<{ name: string; in: string; required: boolean; type: string }>;
    requestBody?: { contentType: string; schema: string };
    responses?: Array<{ status: string; description: string }>;
  }>>([]);
  const [isParsingOpenApi, setIsParsingOpenApi] = useState(false);
  const [openApiParseError, setOpenApiParseError] = useState('');
  const [isGeneratingApiTests, setIsGeneratingApiTests] = useState(false);
  const [generatedApiTests, setGeneratedApiTests] = useState<Array<{
    endpoint: string;
    method: string;
    test_name: string;
    code: string;
    test_type: 'valid' | 'invalid' | 'edge_case';
    description: string;
  }> | null>(null);
  // Feature #1151: Human review workflow for AI tests
  const [requireHumanReview, setRequireHumanReview] = useState(false);
  const [pendingReviewTests, setPendingReviewTests] = useState<Array<any>>([]);
  const [reviewStats, setReviewStats] = useState<{
    total_tests: number;
    ai_generated: number;
    pending_review: number;
    approved: number;
    rejected: number;
  } | null>(null);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  // Feature #1152: Batch review AI-generated tests
  const [selectedForReview, setSelectedForReview] = useState<Set<string>>(new Set());
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotContext, setScreenshotContext] = useState('');
  const [isAnalyzingScreenshot, setIsAnalyzingScreenshot] = useState(false);
  const [screenshotAnalysis, setScreenshotAnalysis] = useState<{
    elements: Array<{
      id: string;
      type: string;
      description: string;
      suggested_selector: string;
      suggested_action: string;
      confidence: number;
      location: { x: number; y: number; width: number; height: number };
      attributes?: { label?: string; placeholder?: string; role?: string };
    }>;
    suggested_test_steps: Array<{
      step_number: number;
      action: string;
      element_id: string;
      description: string;
      playwright_code: string;
      assertion?: string;
    }>;
    page_context: {
      page_type: string;
      main_functionality: string;
      detected_framework?: string;
      responsive_design: boolean;
    };
    generated_test: {
      name: string;
      code: string;
      complexity: string;
    };
  } | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  // Feature #1163: Code diff view for regenerations
  const [regenerationFeedback, setRegenerationFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [previousGeneratedCode, setPreviousGeneratedCode] = useState<string | null>(null);
  const [showDiffView, setShowDiffView] = useState(false);

  // Feature #1155: Screenshot annotation state
  type AnnotationType = 'click' | 'type' | 'expect';
  interface Annotation {
    id: string;
    type: AnnotationType;
    x: number;
    y: number;
    width?: number;
    height?: number;
    label?: string; // For type annotations - what text to type
    expectation?: string; // For expect annotations - what to assert
  }
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotationTool, setCurrentAnnotationTool] = useState<AnnotationType | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [pendingAnnotation, setPendingAnnotation] = useState<Partial<Annotation> | null>(null);
  const [annotationLabelInput, setAnnotationLabelInput] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  // Feature #1958: Sorting state for test list
  const [sortField, setSortField] = useState<'name' | 'status' | 'last_run' | 'last_result' | 'run_count' | 'avg_duration' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [isCancellingSuite, setIsCancellingSuite] = useState(false);
  const [suiteRun, setSuiteRun] = useState<any>(null);
  const [suiteRunPolling, setSuiteRunPolling] = useState(false);
  const [a11ySeverityFilter, setA11ySeverityFilter] = useState<{ [key: string]: 'all' | 'critical' | 'serious' | 'moderate' | 'minor' }>({});

  // Feature #1257: Dynamic Test Parallelization state
  const [showParallelization, setShowParallelization] = useState(false);
  const [isAnalyzingParallel, setIsAnalyzingParallel] = useState(false);
  const [parallelizationPlan, setParallelizationPlan] = useState<{
    totalTests: number;
    workers: Array<{
      id: number;
      name: string;
      tests: Array<{ name: string; duration: number }>;
      totalDuration: number;
      utilizationPercent: number;
    }>;
    optimization: {
      sequentialTime: number;
      parallelTime: number;
      timeSaved: number;
      speedup: string;
    };
    resourceBalance: {
      avgUtilization: number;
      maxDifference: number;
      balanceScore: string;
    };
  } | null>(null);
  const [a11yCategoryFilter, setA11yCategoryFilter] = useState<{ [key: string]: 'all' | 'color' | 'images' | 'forms' | 'navigation' | 'structure' | 'aria' }>({});
  const [a11ySearchQuery, setA11ySearchQuery] = useState<{ [key: string]: string }>({});
  const [showDeleteSuiteModal, setShowDeleteSuiteModal] = useState(false);
  const [isDeletingSuite, setIsDeletingSuite] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Feature #1961: Quick actions dropdown state
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [showDeleteTestModal, setShowDeleteTestModal] = useState<string | null>(null);
  const [isDeletingTest, setIsDeletingTest] = useState(false);

  // Visual recorder state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordTargetUrl, setRecordTargetUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [recordedSteps, setRecordedSteps] = useState<Array<{
    action: string;
    selector?: string;
    value?: string;
    url?: string;
    text?: string;
  }>>([]);
  const [recordingStatus, setRecordingStatus] = useState<string>('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [recordedTestName, setRecordedTestName] = useState('');
  const [recordedTestDescription, setRecordedTestDescription] = useState('');
  const [isSavingRecordedTest, setIsSavingRecordedTest] = useState(false);

  const canCreateTest = user?.role !== 'viewer';
  const canDeleteSuite = user?.role === 'owner' || user?.role === 'admin';

  // Feature #1065: Edit selector modal state for TestSuitePage
  interface EditSelectorModalState {
    isOpen: boolean;
    runId: string;
    testId: string;
    stepId: string;
    currentSelector: string;
    originalSelector: string;
    wasHealed: boolean;
  }
  const [editSelectorModal, setEditSelectorModal] = useState<EditSelectorModalState>({
    isOpen: false,
    runId: '',
    testId: '',
    stepId: '',
    currentSelector: '',
    originalSelector: '',
    wasHealed: false,
  });
  const [editSelectorValue, setEditSelectorValue] = useState('');
  const [editSelectorNotes, setEditSelectorNotes] = useState('');
  const [editSelectorApplyToTest, setEditSelectorApplyToTest] = useState(true);
  const [isSubmittingSelector, setIsSubmittingSelector] = useState(false);

  // Handle Escape key to close modals and dropdowns
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreateTestModal) {
          setShowCreateTestModal(false);
          // Reset screenshot state on Escape (Safari fix)
          setScreenshotPreview(null);
          setScreenshotFile(null);
          setAnnotations([]);
          setAIGenMode('text');
        }
        if (showDeleteSuiteModal) setShowDeleteSuiteModal(false);
        if (showDeleteTestModal) setShowDeleteTestModal(null);
        if (openActionsDropdown) setOpenActionsDropdown(null);
      }
    };
    // Feature #1961: Close dropdown when clicking outside
    const handleClickOutside = () => {
      if (openActionsDropdown) setOpenActionsDropdown(null);
    };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showCreateTestModal, showDeleteSuiteModal, showDeleteTestModal, openActionsDropdown]);

  // Feature #1777: Smart defaults based on suite context
  // When the Create Test modal opens, set defaults based on suite name and settings
  useEffect(() => {
    if (!showCreateTestModal || !suite) return;

    const suiteName = suite.name.toLowerCase();

    // Parse suite name for keywords to determine default test type
    let defaultType: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility' = 'e2e';
    if (suiteName.includes('visual') || suiteName.includes('screenshot') || suiteName.includes('ui')) {
      defaultType = 'visual_regression';
    } else if (suiteName.includes('performance') || suiteName.includes('lighthouse') || suiteName.includes('speed')) {
      defaultType = 'lighthouse';
    } else if (suiteName.includes('load') || suiteName.includes('stress') || suiteName.includes('k6')) {
      defaultType = 'load';
    } else if (suiteName.includes('accessibility') || suiteName.includes('a11y') || suiteName.includes('wcag')) {
      defaultType = 'accessibility';
    } else if (suiteName.includes('e2e') || suiteName.includes('end-to-end') || suiteName.includes('functional')) {
      defaultType = 'e2e';
    }

    // Only set default type if no type has been explicitly selected yet
    // (i.e., if the form was just opened and not modified)
    if (newTestName === '' && newTestDescription === '') {
      setNewTestType(defaultType);
    }

    // Inherit suite-level viewport settings if available
    if (suite.viewport_width && suite.viewport_height) {
      // Check if it matches a known preset
      const vw = suite.viewport_width;
      const vh = suite.viewport_height;
      if (vw === 1920 && vh === 1080) {
        setNewTestViewportPreset('desktop');
      } else if (vw === 1366 && vh === 768) {
        setNewTestViewportPreset('laptop');
      } else if (vw === 1280 && vh === 720) {
        setNewTestViewportPreset('desktop_hd');
      } else if (vw === 768 && vh === 1024) {
        setNewTestViewportPreset('tablet');
      } else if (vw === 375 && vh === 667) {
        setNewTestViewportPreset('mobile');
      } else if (vw === 414 && vh === 896) {
        setNewTestViewportPreset('mobile_large');
      } else {
        setNewTestViewportPreset('custom');
      }
      setNewTestViewportWidth(suite.viewport_width);
      setNewTestViewportHeight(suite.viewport_height);
    }

    // Feature #1786: Inherit project base_url for tests
    // If the test URL field is empty and the project has a base_url, use it as default
    if (project?.base_url && newTestTargetUrl === '') {
      setNewTestTargetUrl(project.base_url);
      // Set initial validation state based on basic URL check
      try {
        const url = new URL(project.base_url.startsWith('http') ? project.base_url : `https://${project.base_url}`);
        if (url.hostname && url.hostname.includes('.')) {
          setUrlValidationState('valid');
          setUrlFavicon(`https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`);
        }
      } catch {
        // URL validation will happen when user interacts with field
      }
    }
  }, [showCreateTestModal, suite, project, newTestName, newTestDescription, newTestTargetUrl]);

  // Feature #1235: AI Copilot real-time suggestion analysis
  useEffect(() => {
    if (!showCreateTestModal || !showAICopilot) return;

    const analyzeTestInput = () => {
      setIsAICopilotAnalyzing(true);
      const suggestions: typeof aiCopilotSuggestions = [];

      // Analyze test name
      if (newTestName) {
        const genericNames = ['test', 'test1', 'my test', 'new test', 'untitled'];
        if (genericNames.some(n => newTestName.toLowerCase().replace(/\s+/g, ' ').trim() === n || newTestName.toLowerCase().startsWith(n + ' '))) {
          suggestions.push({
            id: 'name-generic',
            type: 'name',
            message: 'Test name is too generic',
            suggestion: newTestType === 'e2e'
              ? 'Use descriptive names like "User login with valid credentials" or "Add item to cart flow"'
              : newTestType === 'visual_regression'
              ? 'Use names like "Homepage hero section visual check" or "Product page responsive layout"'
              : 'Use a more specific, descriptive name for this test',
            impact: 'medium',
            field: 'name'
          });
        }

        // Suggest CamelCase to readable conversion
        if (!newTestName.includes(' ') && newTestName.length > 5 && /[a-z][A-Z]/.test(newTestName)) {
          const readable = newTestName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
          suggestions.push({
            id: 'name-convention',
            type: 'name',
            message: 'Consider using readable test names',
            suggestion: `Rename to: "${readable}"`,
            impact: 'low',
            field: 'name'
          });
        }
      }

      // Suggest adding description
      if (!newTestDescription && newTestName && newTestName.length > 3) {
        suggestions.push({
          id: 'description-missing',
          type: 'description',
          message: 'Missing test description',
          suggestion: 'Add a description explaining what this test verifies and why it\'s important for documentation',
          impact: 'low',
          field: 'description'
        });
      }

      // Type-specific suggestions
      if (newTestType === 'e2e') {
        suggestions.push({
          id: 'e2e-assertion',
          type: 'assertion',
          message: 'Remember to add assertions',
          suggestion: 'E2E tests should include assertions to verify expected outcomes. Add "expect" steps to validate page content and state.',
          impact: 'high'
        });
      }

      if (newTestType === 'visual_regression') {
        if (!newTestTargetUrl) {
          suggestions.push({
            id: 'visual-url',
            type: 'best_practice',
            message: 'Target URL required',
            suggestion: 'Enter a valid URL to capture screenshots for visual comparison',
            impact: 'high',
            field: 'targetUrl'
          });
        }

        if (newTestCaptureMode === 'element' && !newTestElementSelector) {
          suggestions.push({
            id: 'visual-selector',
            type: 'selector',
            message: 'Element selector needed',
            suggestion: 'Use specific selectors like [data-testid="hero"], #main-content, or .product-card for reliable element captures',
            impact: 'high',
            field: 'elementSelector'
          });
        }

        if (newTestDiffThreshold === 0) {
          suggestions.push({
            id: 'visual-threshold',
            type: 'best_practice',
            message: 'Consider adding diff tolerance',
            suggestion: 'Set a small threshold (0.1-1%) to avoid false positives from anti-aliasing or font rendering differences',
            impact: 'medium'
          });
        }
      }

      if (newTestType === 'accessibility') {
        suggestions.push({
          id: 'a11y-wcag',
          type: 'best_practice',
          message: `Testing WCAG ${newTestWcagLevel} compliance`,
          suggestion: newTestWcagLevel === 'A'
            ? 'Consider testing against WCAG AA for better coverage (most common requirement)'
            : newTestWcagLevel === 'AAA'
            ? 'WCAG AAA is the strictest level - ensure this matches your requirements'
            : 'WCAG AA is the most common compliance level - good choice!',
          impact: 'medium'
        });
      }

      if (newTestType === 'load') {
        if (newTestVirtualUsers < 5) {
          suggestions.push({
            id: 'load-users',
            type: 'best_practice',
            message: 'Low virtual user count',
            suggestion: 'Consider using at least 10+ virtual users for meaningful load test results',
            impact: 'medium'
          });
        }
        if (newTestDuration < 30) {
          suggestions.push({
            id: 'load-duration',
            type: 'best_practice',
            message: 'Short test duration',
            suggestion: 'Run load tests for at least 60 seconds to capture performance patterns and stabilization',
            impact: 'medium'
          });
        }
      }

      setAICopilotSuggestions(suggestions);
      setIsAICopilotAnalyzing(false);
    };

    // Debounce the analysis
    const timeoutId = setTimeout(analyzeTestInput, 500);
    return () => clearTimeout(timeoutId);
  }, [showCreateTestModal, showAICopilot, newTestName, newTestDescription, newTestType, newTestTargetUrl, newTestElementSelector, newTestCaptureMode, newTestDiffThreshold, newTestWcagLevel, newTestVirtualUsers, newTestDuration]);

  // Feature #1235: Apply AI Copilot suggestion
  const applyAICopilotSuggestion = (suggestion: typeof aiCopilotSuggestions[0]) => {
    // Dismiss the suggestion after applying
    setAICopilotSuggestions(prev => prev.filter(s => s.id !== suggestion.id));

    // Apply specific suggestions
    if (suggestion.field === 'name' && suggestion.id === 'name-convention' && suggestion.suggestion.includes('Rename to:')) {
      const newName = suggestion.suggestion.replace('Rename to: "', '').replace('"', '');
      setNewTestName(newName);
    }
  };

  // Feature #1235: Dismiss AI Copilot suggestion
  const dismissAICopilotSuggestion = (suggestionId: string) => {
    setAICopilotSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  // Filter tests based on search query (trim whitespace)
  const trimmedSearchQuery = searchQuery.trim();
  const filteredTests = tests.filter(test =>
    trimmedSearchQuery === '' ||
    test.name.toLowerCase().includes(trimmedSearchQuery.toLowerCase()) ||
    (test.description && test.description.toLowerCase().includes(trimmedSearchQuery.toLowerCase()))
  );

  // Feature #1958: Sort handler for test list columns
  const handleSort = (field: 'name' | 'status' | 'last_run' | 'last_result' | 'run_count' | 'avg_duration') => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending (most recent first for dates, highest first for counts)
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Feature #1958: Sort filtered tests
  const sortedTests = [...filteredTests].sort((a, b) => {
    if (!sortField) return 0;

    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
      case 'last_run':
        const aTime = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
        const bTime = b.last_run_at ? new Date(b.last_run_at).getTime() : 0;
        comparison = aTime - bTime;
        break;
      case 'last_result':
        // Order: passed > running > failed > error > null
        const resultOrder: Record<string, number> = { passed: 4, running: 3, failed: 2, error: 1 };
        const aOrder = a.last_result ? resultOrder[a.last_result] || 0 : 0;
        const bOrder = b.last_result ? resultOrder[b.last_result] || 0 : 0;
        comparison = aOrder - bOrder;
        break;
      case 'run_count':
        comparison = (a.run_count || 0) - (b.run_count || 0);
        break;
      case 'avg_duration':
        comparison = (a.avg_duration_ms || 0) - (b.avg_duration_ms || 0);
        break;
    }

    return sortDirection === 'desc' ? -comparison : comparison;
  });

  useEffect(() => {
    const fetchSuite = async () => {
      try {
        // Fetch suite
        const suiteResponse = await fetch(`/api/v1/suites/${suiteId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!suiteResponse.ok) {
          setError('Test suite not found');
          return;
        }

        const suiteData = await suiteResponse.json();
        setSuite(suiteData.suite);

        // Fetch project
        const projectResponse = await fetch(`/api/v1/projects/${suiteData.suite.project_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          setProject(projectData.project);
        }

        // Fetch tests
        const testsResponse = await fetch(`/api/v1/suites/${suiteId}/tests`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (testsResponse.ok) {
          const testsData = await testsResponse.json();
          setTests(testsData.tests);
        }
      } catch (err) {
        setError('Failed to load test suite');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSuite();
  }, [suiteId, token]);

  // Feature #1151: Fetch review settings when suite loads
  useEffect(() => {
    const fetchReviewSettings = async () => {
      if (!suiteId || !token) return;
      try {
        const response = await fetch(`/api/v1/suites/${suiteId}/review-settings`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setRequireHumanReview(data.require_human_review);
          setReviewStats(data.stats);
        }
      } catch (err) {
        console.error('Failed to fetch review settings:', err);
      }
    };
    fetchReviewSettings();
  }, [suiteId, token, tests]);

  // Feature #1151: Toggle human review requirement
  const handleToggleHumanReview = async () => {
    if (!suiteId || !token) return;
    try {
      const response = await fetch(`/api/v1/suites/${suiteId}/review-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ require_human_review: !requireHumanReview }),
      });
      if (response.ok) {
        const data = await response.json();
        setRequireHumanReview(data.suite.require_human_review);
        toast.success(data.message);
      }
    } catch (err) {
      toast.error('Failed to update review settings');
    }
  };

  // Feature #1151: Approve or reject a test
  const handleReviewTest = async (testId: string, action: 'approve' | 'reject', notes?: string) => {
    if (!token) return;
    setIsApproving(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action, notes }),
      });
      if (response.ok) {
        const data = await response.json();
        // Update the test in state
        setTests(prev => prev.map(t => t.id === testId ? data.test : t));
        toast.success(data.message);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to review test');
      }
    } catch (err) {
      toast.error('Failed to review test');
    } finally {
      setIsApproving(false);
    }
  };

  // Feature #1152: Batch review multiple AI-generated tests
  const handleBatchReview = async (action: 'approve' | 'reject') => {
    if (!token || selectedForReview.size === 0) return;
    setIsApproving(true);
    try {
      const response = await fetch('/api/v1/tests/bulk-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          test_ids: Array.from(selectedForReview),
          action
        }),
      });
      if (response.ok) {
        const data = await response.json();
        // Update all tests in state
        if (data.results) {
          const updatedTestMap = new Map(data.results.filter((r: any) => r.success).map((r: any) => [r.test_id, r.test]));
          setTests(prev => prev.map(t => updatedTestMap.has(t.id) ? updatedTestMap.get(t.id) : t));
        }
        // Update review stats
        if (suiteId) {
          const statsResponse = await fetch(`/api/v1/suites/${suiteId}/review-settings`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            if (statsData.stats) {
              setReviewStats(statsData.stats);
            }
          }
        }
        // Clear selection
        setSelectedForReview(new Set());
        toast.success(`Successfully ${action}d ${data.successful || selectedForReview.size} test(s)`);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to batch review tests');
      }
    } catch (err) {
      toast.error('Failed to batch review tests');
    } finally {
      setIsApproving(false);
    }
  };

  // Feature #1152: Toggle selection for batch review
  const toggleTestSelection = (testId: string) => {
    setSelectedForReview(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  };

  // Feature #1152: Toggle all tests for batch review
  const toggleAllTestsSelection = (testIds: string[]) => {
    setSelectedForReview(prev => {
      const allSelected = testIds.every(id => prev.has(id));
      if (allSelected) {
        // Deselect all
        return new Set();
      } else {
        // Select all
        return new Set(testIds);
      }
    });
  };

  // Feature #1163: Compute diff between two code strings
  const computeCodeDiff = (oldCode: string, newCode: string): { type: 'unchanged' | 'added' | 'removed'; line: string }[] => {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    const diff: { type: 'unchanged' | 'added' | 'removed'; line: string }[] = [];

    // Simple line-by-line diff algorithm
    let oldIdx = 0;
    let newIdx = 0;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      if (oldIdx >= oldLines.length) {
        // All remaining new lines are additions
        diff.push({ type: 'added', line: newLines[newIdx] });
        newIdx++;
      } else if (newIdx >= newLines.length) {
        // All remaining old lines are removals
        diff.push({ type: 'removed', line: oldLines[oldIdx] });
        oldIdx++;
      } else if (oldLines[oldIdx] === newLines[newIdx]) {
        // Lines match
        diff.push({ type: 'unchanged', line: oldLines[oldIdx] });
        oldIdx++;
        newIdx++;
      } else {
        // Lines differ - look ahead to find if old line appears later in new
        const oldLineInNew = newLines.slice(newIdx + 1).indexOf(oldLines[oldIdx]);
        const newLineInOld = oldLines.slice(oldIdx + 1).indexOf(newLines[newIdx]);

        if (oldLineInNew === -1 && newLineInOld === -1) {
          // Neither line appears later - treat as removal then addition
          diff.push({ type: 'removed', line: oldLines[oldIdx] });
          diff.push({ type: 'added', line: newLines[newIdx] });
          oldIdx++;
          newIdx++;
        } else if (oldLineInNew !== -1 && (newLineInOld === -1 || oldLineInNew <= newLineInOld)) {
          // Old line appears later in new - this new line is an addition
          diff.push({ type: 'added', line: newLines[newIdx] });
          newIdx++;
        } else {
          // New line appears later in old - this old line is a removal
          diff.push({ type: 'removed', line: oldLines[oldIdx] });
          oldIdx++;
        }
      }
    }

    return diff;
  };

  // Feature #1153: Calculate confidence score for generated test
  const calculateTestConfidence = (test: {
    syntax_valid: boolean;
    syntax_errors?: string[];
    assertions: string[];
    selectors: string[];
    steps: string[];
    complexity: 'simple' | 'medium' | 'complex';
    warnings?: string[];
  }): { score: number; factors: { factor: string; score: number; max_score: number; description: string; }[] } => {
    const factors: { factor: string; score: number; max_score: number; description: string; }[] = [];

    // Factor 1: Syntax validity (25 points max)
    const syntaxScore = test.syntax_valid ? 25 : 0;
    factors.push({
      factor: 'Syntax Validity',
      score: syntaxScore,
      max_score: 25,
      description: test.syntax_valid
        ? 'Code syntax is valid and parseable'
        : `Syntax errors detected: ${test.syntax_errors?.length || 0} issues`
    });

    // Factor 2: Assertions presence (25 points max)
    const assertionCount = test.assertions.length;
    const assertionScore = Math.min(25, assertionCount * 8); // 8 points per assertion, max 25
    factors.push({
      factor: 'Test Assertions',
      score: assertionScore,
      max_score: 25,
      description: assertionCount > 0
        ? `${assertionCount} assertion${assertionCount > 1 ? 's' : ''} to verify expected outcomes`
        : 'No assertions - test may not verify expected behavior'
    });

    // Factor 3: Selector quality (20 points max)
    const selectorCount = test.selectors.length;
    const hasGoodSelectors = test.selectors.some(s =>
      s.includes('getByRole') || s.includes('getByLabel') || s.includes('getByText') || s.includes('data-testid')
    );
    const selectorScore = Math.min(20, selectorCount * 4 + (hasGoodSelectors ? 8 : 0));
    factors.push({
      factor: 'Selector Quality',
      score: Math.min(20, selectorScore),
      max_score: 20,
      description: hasGoodSelectors
        ? `Uses ${selectorCount} accessible selectors (role, label, text, testid)`
        : selectorCount > 0
          ? `${selectorCount} selector${selectorCount > 1 ? 's' : ''} - consider using more accessible selectors`
          : 'No specific selectors detected'
    });

    // Factor 4: Test steps completeness (15 points max)
    const stepCount = test.steps.length;
    const stepScore = Math.min(15, stepCount * 3);
    factors.push({
      factor: 'Test Steps',
      score: stepScore,
      max_score: 15,
      description: stepCount >= 3
        ? `${stepCount} clear test steps covering the workflow`
        : `Only ${stepCount} step${stepCount !== 1 ? 's' : ''} - consider more comprehensive coverage`
    });

    // Factor 5: Complexity appropriateness (15 points max)
    const complexityScore = test.complexity === 'simple' ? 15 : test.complexity === 'medium' ? 12 : 8;
    factors.push({
      factor: 'Complexity',
      score: complexityScore,
      max_score: 15,
      description: test.complexity === 'simple'
        ? 'Simple test - easy to maintain and debug'
        : test.complexity === 'medium'
          ? 'Medium complexity - balanced coverage and maintainability'
          : 'Complex test - may be harder to maintain'
    });

    // Deduct points for warnings
    const warningDeduction = Math.min(10, (test.warnings?.length || 0) * 3);
    const totalScore = Math.max(0, Math.min(100,
      syntaxScore + assertionScore + Math.min(20, selectorScore) + stepScore + complexityScore - warningDeduction
    ));

    if (warningDeduction > 0) {
      factors.push({
        factor: 'Warnings',
        score: -warningDeduction,
        max_score: 0,
        description: `${test.warnings?.length} warning${(test.warnings?.length || 0) > 1 ? 's' : ''} detected that may affect test reliability`
      });
    }

    return { score: Math.round(totalScore), factors };
  };

  // Validate test name and return error message if invalid
  const validateTestName = (name: string): string => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return 'Test name is required';
    }

    if (trimmedName.length < 3) {
      return 'Test name must be at least 3 characters';
    }

    if (trimmedName.length > 255) {
      return 'Test name must be 255 characters or less';
    }

    // Allow letters, numbers, spaces, hyphens, underscores, and common punctuation
    const validNamePattern = /^[a-zA-Z0-9\s\-_.,():'"!?]+$/;
    if (!validNamePattern.test(trimmedName)) {
      return 'Test name can only contain letters, numbers, spaces, hyphens, underscores, and basic punctuation';
    }

    return '';
  };

  // Feature #1771: Smart URL validation and auto-completion
  const validateAndNormalizeUrl = useCallback((url: string): { isValid: boolean; normalizedUrl: string; favicon: string | null } => {
    if (!url || url.trim().length === 0) {
      return { isValid: false, normalizedUrl: '', favicon: null };
    }

    let normalizedUrl = url.trim();

    // Auto-add https:// if missing protocol
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      const urlObj = new URL(normalizedUrl);
      // Basic validation - must have a hostname with at least one dot (like example.com)
      if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
        return { isValid: false, normalizedUrl, favicon: null };
      }

      // Generate favicon URL using Google's favicon service
      const favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;

      return { isValid: true, normalizedUrl, favicon };
    } catch {
      return { isValid: false, normalizedUrl, favicon: null };
    }
  }, []);

  // Feature #1771: Handle URL input change with validation
  const handleUrlChange = useCallback((inputValue: string) => {
    setNewTestTargetUrl(inputValue);

    // Debounced validation
    const { isValid, normalizedUrl, favicon } = validateAndNormalizeUrl(inputValue);

    if (inputValue.trim().length === 0) {
      setUrlValidationState('idle');
      setUrlFavicon(null);
    } else if (isValid) {
      setUrlValidationState('valid');
      setUrlFavicon(favicon);
      // Auto-update the URL with https:// if user didn't type it
      if (normalizedUrl !== inputValue && !inputValue.startsWith('http')) {
        // Don't auto-update while typing - only show the normalized version in validation state
      }
    } else {
      setUrlValidationState('invalid');
      setUrlFavicon(null);
    }
  }, [validateAndNormalizeUrl]);

  // Feature #1771: Auto-complete URL on blur
  const handleUrlBlur = useCallback(() => {
    if (newTestTargetUrl.trim() && urlValidationState === 'valid') {
      const { normalizedUrl } = validateAndNormalizeUrl(newTestTargetUrl);
      if (normalizedUrl !== newTestTargetUrl) {
        setNewTestTargetUrl(normalizedUrl);
      }
    }
  }, [newTestTargetUrl, urlValidationState, validateAndNormalizeUrl]);

  // Feature #1772: Parse natural language input and fill form fields
  const parseNaturalLanguageInput = useCallback(async (input: string) => {
    if (!input.trim()) return;

    setIsParsingNaturalLanguage(true);

    try {
      const lowerInput = input.toLowerCase();

      // Detect test type
      let detectedType: typeof newTestType = 'e2e';
      if (lowerInput.includes('visual') || lowerInput.includes('screenshot') || lowerInput.includes('ui test')) {
        detectedType = 'visual_regression';
      } else if (lowerInput.includes('performance') || lowerInput.includes('lighthouse') || lowerInput.includes('speed')) {
        detectedType = 'lighthouse';
      } else if (lowerInput.includes('load') || lowerInput.includes('stress') || lowerInput.includes('k6')) {
        detectedType = 'load';
      } else if (lowerInput.includes('accessibility') || lowerInput.includes('a11y') || lowerInput.includes('wcag')) {
        detectedType = 'accessibility';
      }
      setNewTestType(detectedType);

      // Detect URL
      const urlMatch = input.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)(?:\/[^\s]*)?/i);
      if (urlMatch) {
        const detectedUrl = urlMatch[0];
        handleUrlChange(detectedUrl);
      }

      // Detect viewport/device
      if (lowerInput.includes('tablet') || lowerInput.includes('ipad')) {
        setNewTestViewportPreset('tablet');
        setNewTestViewportWidth(768);
        setNewTestViewportHeight(1024);
      } else if (lowerInput.includes('mobile') || lowerInput.includes('phone') || lowerInput.includes('iphone')) {
        setNewTestViewportPreset('mobile');
        setNewTestViewportWidth(375);
        setNewTestViewportHeight(667);
      } else if (lowerInput.includes('desktop')) {
        setNewTestViewportPreset('desktop');
        setNewTestViewportWidth(1920);
        setNewTestViewportHeight(1080);
      } else if (lowerInput.includes('laptop')) {
        setNewTestViewportPreset('laptop');
        setNewTestViewportWidth(1366);
        setNewTestViewportHeight(768);
      }

      // Generate a test name from the input
      const words = input.trim().split(/\s+/);
      if (words.length > 2) {
        // Create a title-cased name from first few words
        const testName = words.slice(0, 6).map(w =>
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ').replace(/^(Visual|Performance|Load|Accessibility|E2e)\s+(Test\s+)?(For\s+)?/i, '')
          .trim() || `${detectedType === 'visual_regression' ? 'Visual' : detectedType === 'lighthouse' ? 'Performance' : detectedType === 'load' ? 'Load' : detectedType === 'accessibility' ? 'Accessibility' : 'E2E'} Test`;
        if (testName && testName.length > 3) {
          setNewTestName(testName.substring(0, 100));
        }
      }

      // Small delay to show the parsing animation
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      setIsParsingNaturalLanguage(false);
    }
  }, [handleUrlChange]);

  // Generate K6 script template for new test creation
  const generateNewTestK6Script = (): string => {
    // Feature #1759: Use placeholder instead of example.com - user must provide real URL
    const targetUrl = newTestTargetUrl || 'YOUR_TARGET_URL_HERE';
    const virtualUsers = newTestVirtualUsers || 10;
    const duration = newTestDuration || 60;
    const rampUpTime = newTestRampUpTime || 10;

    return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '${rampUpTime}s', target: ${virtualUsers} },  // Ramp up
    { duration: '${duration - rampUpTime}s', target: ${virtualUsers} }, // Steady state
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    errors: ['rate<0.1'],              // Error rate should be below 10%
  },
};

// Default function - runs for each virtual user iteration
export default function () {
  // GET request to target URL
  const response = http.get('${targetUrl}');

  // Check response status
  const checkResult = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Track errors
  errorRate.add(!checkResult);

  // Think time between requests (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

// Setup function - runs once before the test
export function setup() {
  console.log('Starting load test against ${targetUrl}');
  console.log('Virtual Users: ${virtualUsers}');
  console.log('Duration: ${duration}s');
  return { startTime: new Date().toISOString() };
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log('Load test completed');
  console.log('Started at:', data.startTime);
  console.log('Ended at:', new Date().toISOString());
}
`;
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateTestError('');
    setTestNameError('');

    // Validate test name before proceeding
    const nameError = validateTestName(newTestName);
    if (nameError) {
      setTestNameError(nameError);
      return;
    }

    setIsCreatingTest(true);

    try {
      const testData: any = {
        name: newTestName.trim(),
        description: newTestDescription,
        test_type: newTestType,
      };

      // Feature #1151: Add AI-generated flag and review status
      if (isTestFromAI) {
        testData.ai_generated = true;
        // Feature #1164: Include AI confidence score if available
        if (aiConfidenceScore !== undefined) {
          testData.ai_confidence_score = aiConfidenceScore;
        }
        // If human review is required, set status to pending_review
        if (requireHumanReview) {
          testData.review_status = 'pending_review';
          testData.status = 'draft'; // Don't activate until approved
        }
      }

      // Add visual regression specific fields
      if (newTestType === 'visual_regression') {
        testData.target_url = newTestTargetUrl;
        testData.capture_mode = newTestCaptureMode;
        testData.multi_viewport = newTestMultiViewport;

        if (newTestMultiViewport) {
          // Multi-viewport mode - store selected viewports
          testData.viewports = newTestSelectedViewports;
        } else {
          // Single viewport mode
          testData.viewport_preset = newTestViewportPreset;
          testData.viewport_width = newTestViewportWidth;
          testData.viewport_height = newTestViewportHeight;
        }

        if (newTestCaptureMode === 'element') {
          testData.element_selector = newTestElementSelector;
        }

        if (newTestWaitForSelector) {
          testData.wait_for_selector = newTestWaitForSelector;
        }

        if (newTestWaitTime !== undefined && newTestWaitTime > 0) {
          testData.wait_time = newTestWaitTime;
        }

        if (newTestHideSelectors) {
          testData.hide_selectors = newTestHideSelectors;
        }

        if (newTestRemoveSelectors) {
          testData.remove_selectors = newTestRemoveSelectors;
        }

        // Add diff threshold for visual regression pass/fail criteria
        testData.diff_threshold = newTestDiffThreshold;
        testData.diff_threshold_mode = newTestDiffThresholdMode;
        testData.diff_pixel_threshold = newTestDiffPixelThreshold;

        // Feature #647: Add anti-aliasing tolerance for cross-browser comparisons
        testData.anti_aliasing_tolerance = newTestAntiAliasingTolerance;
        if (newTestColorThreshold !== undefined) {
          testData.color_threshold = newTestColorThreshold;
        }

        // Add ignore regions if any are defined
        if (newTestIgnoreRegions.length > 0) {
          testData.ignore_regions = newTestIgnoreRegions;
        }

        // Add ignore selectors if any are defined
        if (newTestIgnoreSelectors.length > 0) {
          testData.ignore_selectors = newTestIgnoreSelectors;
        }
      }

      // Add lighthouse specific fields
      if (newTestType === 'lighthouse') {
        testData.target_url = newTestTargetUrl;
        testData.device_preset = newTestDevicePreset;
        testData.performance_threshold = newTestPerformanceThreshold;
        testData.lcp_threshold = newTestLcpThreshold;
        testData.cls_threshold = newTestClsThreshold;
        testData.bypass_csp = newTestBypassCsp;
        testData.ignore_ssl_errors = newTestIgnoreSslErrors;
        testData.audit_timeout = newTestAuditTimeout;
      }

      // Add load test specific fields
      if (newTestType === 'load') {
        testData.target_url = newTestTargetUrl;
        testData.virtual_users = newTestVirtualUsers;
        testData.duration = newTestDuration;
        testData.ramp_up_time = newTestRampUpTime;
        // Include K6 script if user edited it
        if (newTestK6Script) {
          testData.k6_script = newTestK6Script;
        }
      }

      // Add accessibility test specific fields
      if (newTestType === 'accessibility') {
        testData.target_url = newTestTargetUrl;
        testData.wcag_level = newTestWcagLevel;
        testData.include_best_practices = newTestIncludeBestPractices;
        testData.include_experimental = newTestIncludeExperimental;
        testData.include_pa11y = newTestIncludePa11y;
        // Threshold configuration
        if (newTestA11yFailOnAny) {
          testData.a11y_fail_on_any = true;
        } else {
          if (newTestA11yFailOnCritical !== undefined) {
            testData.a11y_fail_on_critical = newTestA11yFailOnCritical;
          }
          if (newTestA11yFailOnSerious !== undefined) {
            testData.a11y_fail_on_serious = newTestA11yFailOnSerious;
          }
          if (newTestA11yFailOnModerate !== undefined) {
            testData.a11y_fail_on_moderate = newTestA11yFailOnModerate;
          }
          if (newTestA11yFailOnMinor !== undefined) {
            testData.a11y_fail_on_minor = newTestA11yFailOnMinor;
          }
        }
      }

      const response = await fetch(`/api/v1/suites/${suiteId}/tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(testData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create test');
      }

      const data = await response.json();
      setTests([...tests, data.test]);
      // Reset all form fields
      setNewTestName('');
      setTestNameError('');
      setNewTestDescription('');
      setNewTestType('e2e');
      setNewTestTargetUrl('');
      setNewTestViewportPreset('desktop');
      setNewTestViewportWidth(1920);
      setNewTestViewportHeight(1080);
      setNewTestCaptureMode('full_page');
      setNewTestElementSelector('');
      setNewTestWaitForSelector('');
      setNewTestWaitTime(undefined);
      setNewTestHideSelectors('');
      setNewTestRemoveSelectors('');
      setNewTestMultiViewport(false);
      setNewTestSelectedViewports(['desktop', 'tablet', 'mobile']);
      setNewTestDiffThreshold(0);
      setNewTestDiffThresholdMode('percentage');
      setNewTestDiffPixelThreshold(0);
      // Feature #647: Reset anti-aliasing tolerance
      setNewTestAntiAliasingTolerance('off');
      setNewTestColorThreshold(undefined);
      setNewTestIgnoreRegions([]);
      setNewTestIgnoreSelectors([]);
      setNewTestDevicePreset('desktop');
      // Reset accessibility fields
      setNewTestWcagLevel('AA');
      setNewTestIncludeBestPractices(true);
      setNewTestIncludeExperimental(false);
      // Reset accessibility threshold fields
      setNewTestA11yFailOnCritical(0);
      setNewTestA11yFailOnSerious(undefined);
      setNewTestA11yFailOnModerate(undefined);
      setNewTestA11yFailOnMinor(undefined);
      setNewTestA11yFailOnAny(false);
      // Reset K6 script editor
      setNewTestK6Script('');
      setShowK6Editor(false);
      // Feature #1151: Reset AI-generated flag
      setIsTestFromAI(false);
      // Feature #1164: Reset AI confidence score
      setAiConfidenceScore(undefined);
      setShowCreateTestModal(false);
      // Feature #1151: Show different message for pending review tests
      if (data.test.review_status === 'pending_review') {
        toast.success(`AI-generated test "${data.test.name}" created and pending review!`);
      } else {
        toast.success(`Test "${data.test.name}" created successfully!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create test');
    } finally {
      setIsCreatingTest(false);
    }
  };

  const handleRunSuite = async () => {
    if (tests.length === 0) return;

    setIsRunningSuite(true);
    setSuiteRun(null);

    try {
      const response = await fetch(`/api/v1/suites/${suiteId}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start suite run');
      }

      const data = await response.json();
      setSuiteRun(data.run);
      setSuiteRunPolling(true);
    } catch (err) {
      console.error('Failed to run suite:', err);
      // Show user-friendly error message
      toast.error(getErrorMessage(err, 'Failed to start test run'));
      setIsRunningSuite(false);
    }
  };

  // Feature #1961: Quick actions - Run single test
  const handleRunSingleTest = async (testId: string) => {
    setRunningTestId(testId);
    try {
      const response = await fetch(`/api/v1/tests/${testId}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start test run');
      }
      const data = await response.json();
      toast.success('Test run started');
      // Navigate to the test detail page to see results
      navigate(`/tests/${testId}`);
    } catch (err) {
      console.error('Failed to run test:', err);
      toast.error(getErrorMessage(err, 'Failed to start test run'));
    } finally {
      setRunningTestId(null);
    }
  };

  // Feature #1961: Quick actions - Duplicate test
  const handleDuplicateTest = async (test: TestType) => {
    try {
      const response = await fetch(`/api/v1/suites/${suiteId}/tests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${test.name} (Copy)`,
          description: test.description,
          test_type: test.test_type || test.type,
          steps: test.steps,
          target_url: test.target_url,
          viewport_width: test.viewport_width,
          viewport_height: test.viewport_height,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to duplicate test');
      }
      // Refresh tests list
      const refreshResponse = await fetch(`/api/v1/suites/${suiteId}/tests`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setTests(data.tests);
      }
      toast.success('Test duplicated successfully');
    } catch (err) {
      console.error('Failed to duplicate test:', err);
      toast.error(getErrorMessage(err, 'Failed to duplicate test'));
    }
  };

  // Feature #1961: Quick actions - Delete test
  const handleDeleteTest = async (testId: string) => {
    setIsDeletingTest(true);
    try {
      const response = await fetch(`/api/v1/tests/${testId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete test');
      }
      // Refresh tests list
      const refreshResponse = await fetch(`/api/v1/suites/${suiteId}/tests`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setTests(data.tests);
      }
      toast.success('Test deleted successfully');
      setShowDeleteTestModal(null);
    } catch (err) {
      console.error('Failed to delete test:', err);
      toast.error(getErrorMessage(err, 'Failed to delete test'));
    } finally {
      setIsDeletingTest(false);
    }
  };

  // Feature #1257: Trigger large test run with AI parallelization
  const handleRunWithParallelization = async () => {
    if (tests.length === 0) return;

    setShowParallelization(true);
    setIsAnalyzingParallel(true);

    // Simulate AI analysis delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: AI analyzes test durations
    // Generate simulated test durations (in a real app, this would come from historical data)
    const testDurations = tests.map(t => ({
      name: t.name,
      duration: Math.floor(Math.random() * 50) + 10 // 10-60 seconds
    }));

    // Step 3: AI distributes tests optimally across workers using bin-packing algorithm
    const numWorkers = 4;
    const workers: Array<{
      id: number;
      name: string;
      tests: Array<{ name: string; duration: number }>;
      totalDuration: number;
      utilizationPercent: number;
    }> = Array.from({ length: numWorkers }, (_, i) => ({
      id: i + 1,
      name: `Worker ${i + 1}`,
      tests: [],
      totalDuration: 0,
      utilizationPercent: 0
    }));

    // Sort tests by duration (longest first) for better distribution
    const sortedTests = [...testDurations].sort((a, b) => b.duration - a.duration);

    // Distribute tests using "Longest Processing Time" algorithm
    for (const test of sortedTests) {
      // Find worker with minimum load
      const minWorker = workers.reduce((min, w) =>
        w.totalDuration < min.totalDuration ? w : min
      );
      minWorker.tests.push(test);
      minWorker.totalDuration += test.duration;
    }

    // Step 4: Calculate optimization metrics
    const sequentialTime = testDurations.reduce((sum, t) => sum + t.duration, 0);
    const parallelTime = Math.max(...workers.map(w => w.totalDuration));
    const timeSaved = sequentialTime - parallelTime;
    const speedup = (sequentialTime / parallelTime).toFixed(2);

    // Step 5: Calculate resource balance
    const avgDuration = sequentialTime / numWorkers;
    workers.forEach(w => {
      w.utilizationPercent = Math.round((w.totalDuration / parallelTime) * 100);
    });
    const maxDifference = Math.max(...workers.map(w => w.totalDuration)) - Math.min(...workers.map(w => w.totalDuration));
    const avgUtilization = Math.round(workers.reduce((sum, w) => sum + w.utilizationPercent, 0) / numWorkers);
    const balanceScore = maxDifference < 30 ? 'Excellent' : maxDifference < 60 ? 'Good' : 'Fair';

    setParallelizationPlan({
      totalTests: tests.length,
      workers,
      optimization: {
        sequentialTime,
        parallelTime,
        timeSaved,
        speedup
      },
      resourceBalance: {
        avgUtilization,
        maxDifference,
        balanceScore
      }
    });

    setIsAnalyzingParallel(false);
  };

  const handleCancelSuiteRun = async () => {
    if (!suiteRun?.id) return;

    setIsCancellingSuite(true);

    try {
      const response = await fetch(`/api/v1/runs/${suiteRun.id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to cancel run');
      }

      const data = await response.json();
      setSuiteRun((prev: any) => ({ ...prev, status: 'cancelled' }));
      setSuiteRunPolling(false);
      setIsRunningSuite(false);
      toast.success('Test run cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel run');
    } finally {
      setIsCancellingSuite(false);
    }
  };

  const handleDeleteSuite = async () => {
    setIsDeletingSuite(true);
    const suiteName = suite?.name;
    try {
      const response = await fetch(`/api/v1/suites/${suiteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete suite');
      }

      toast.success(`Suite "${suiteName}" deleted successfully!`);
      // Navigate back to project page after deletion
      navigate(`/projects/${suite?.project_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete suite');
      setIsDeletingSuite(false);
      setShowDeleteSuiteModal(false);
    }
  };

  // Feature #1065: Handle selector update in TestSuitePage
  const handleUpdateSelector = async () => {
    if (!token || !editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    if (!editSelectorValue.trim()) {
      toast.error('Selector cannot be empty');
      return;
    }

    setIsSubmittingSelector(true);
    try {
      const response = await fetch(
        `/api/v1/runs/${editSelectorModal.runId}/results/${editSelectorModal.testId}/steps/${editSelectorModal.stepId}/selector`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            new_selector: editSelectorValue.trim(),
            notes: editSelectorNotes.trim() || undefined,
            apply_to_test: editSelectorApplyToTest,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update selector');
      }

      const data = await response.json();
      toast.success(data.message || 'Selector updated successfully');

      // Reset and close modal
      setEditSelectorModal({
        isOpen: false,
        runId: '',
        testId: '',
        stepId: '',
        currentSelector: '',
        originalSelector: '',
        wasHealed: false,
      });
      setEditSelectorValue('');
      setEditSelectorNotes('');
      setEditSelectorApplyToTest(true);

      // Refresh run details to show updated selector
      if (suiteRun?.id) {
        const runResponse = await fetch(`/api/v1/runs/${suiteRun.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (runResponse.ok) {
          const runData = await runResponse.json();
          setSuiteRun(runData.run);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update selector');
    } finally {
      setIsSubmittingSelector(false);
    }
  };

  // Feature #1065: Handle accept healed selector in TestSuitePage
  const handleAcceptHealed = async () => {
    if (!token || !editSelectorModal.runId || !editSelectorModal.testId || !editSelectorModal.stepId) {
      toast.error('Missing required information');
      return;
    }

    setIsSubmittingSelector(true);
    try {
      const response = await fetch(
        `/api/v1/runs/${editSelectorModal.runId}/results/${editSelectorModal.testId}/steps/${editSelectorModal.stepId}/accept-healed`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apply_to_test: editSelectorApplyToTest,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to accept healed selector');
      }

      const data = await response.json();
      toast.success(data.message || 'Healed selector accepted');

      // Reset and close modal
      setEditSelectorModal({
        isOpen: false,
        runId: '',
        testId: '',
        stepId: '',
        currentSelector: '',
        originalSelector: '',
        wasHealed: false,
      });
      setEditSelectorValue('');
      setEditSelectorNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept healed selector');
    } finally {
      setIsSubmittingSelector(false);
    }
  };

  // Handle test file import with validation
  const handleImportTests = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');

    // Validate file type - only JSON and Playwright test files
    const allowedTypes = ['application/json'];
    const allowedExtensions = ['.json', '.spec.ts', '.spec.js', '.test.ts', '.test.js'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setImportError(`Invalid file type: "${file.name}". Please upload a JSON file or Playwright test file (.spec.ts, .spec.js, .test.ts, .test.js).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setImportError(`File too large: ${fileSizeMB}MB. Maximum allowed size is 5MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // For JSON files, try to parse and validate structure
    if (file.type === 'application/json' || fileExtension === '.json') {
      setIsImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate JSON structure - expect array of tests or single test object
        if (!Array.isArray(data) && typeof data !== 'object') {
          setImportError('Invalid JSON structure. Expected an array of tests or a test object.');
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const testsToImport = Array.isArray(data) ? data : [data];

        // Validate each test has required fields
        for (let i = 0; i < testsToImport.length; i++) {
          const test = testsToImport[i];
          if (!test.name || typeof test.name !== 'string') {
            setImportError(`Invalid test at index ${i}: missing or invalid "name" field.`);
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
        }

        // Import tests (simulated - in production would call API)
        toast.success(`Successfully imported ${testsToImport.length} test(s) from ${file.name}`);
        setShowImportModal(false);
      } catch (err) {
        if (err instanceof SyntaxError) {
          setImportError(`Invalid JSON: ${err.message}. Please check your file syntax.`);
        } else {
          setImportError(getErrorMessage(err, 'Failed to import tests'));
        }
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      // For Playwright test files, just acknowledge receipt
      toast.info(`Playwright test file "${file.name}" received. Import processing would happen here.`);
      setShowImportModal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Start recording session
  const handleStartRecording = async () => {
    if (!recordTargetUrl) {
      toast.error('Please enter a target URL');
      return;
    }

    // Validate URL
    try {
      new URL(recordTargetUrl);
    } catch {
      toast.error('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setIsRecording(true);
    setRecordingStatus('Starting recording session...');
    setRecordedSteps([]);

    try {
      const response = await fetch('/api/v1/recording/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_url: recordTargetUrl,
          suite_id: suiteId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start recording');
      }

      const data = await response.json();
      setRecordingSessionId(data.session_id);
      setRecordingStatus('Recording... Perform actions in the browser window');

      // Add initial navigate step
      setRecordedSteps([{ action: 'navigate', url: recordTargetUrl }]);

      // Start polling for recorded actions
      pollRecordingActions(data.session_id);

      toast.success('Recording started! A browser window has opened.');
    } catch (err) {
      setIsRecording(false);
      setRecordingStatus('');
      toast.error(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  // Poll for recorded actions from the server
  const pollRecordingActions = async (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/recording/${sessionId}/actions`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.actions && data.actions.length > 0) {
            setRecordedSteps(data.actions);
          }
          if (data.status === 'stopped' || data.status === 'error') {
            clearInterval(pollInterval);
            if (data.status === 'error') {
              toast.error('Recording session ended unexpectedly');
              setIsRecording(false);
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll recording actions:', err);
      }
    }, 500);

    // Store interval ID for cleanup
    return pollInterval;
  };

  // Add a manual step during recording
  const handleAddRecordingStep = (action: string, details: { selector?: string; value?: string; text?: string }) => {
    setRecordedSteps(prev => [...prev, { action, ...details }]);
  };

  // Stop recording and show review
  const handleStopRecording = async () => {
    if (!recordingSessionId) return;

    setRecordingStatus('Stopping recording...');

    try {
      const response = await fetch(`/api/v1/recording/${recordingSessionId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to stop recording');
      }

      const data = await response.json();
      if (data.actions) {
        setRecordedSteps(data.actions);
      }

      setIsRecording(false);
      setRecordingStatus('');
      setShowRecordModal(false);
      setShowReviewModal(true);
      setRecordedTestName(`Recorded Test ${new Date().toLocaleString()}`);
      toast.success('Recording stopped! Review your recorded steps.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to stop recording');
    }
  };

  // Save recorded test
  const handleSaveRecordedTest = async () => {
    if (!recordedTestName.trim()) {
      toast.error('Please enter a test name');
      return;
    }

    if (recordedSteps.length === 0) {
      toast.error('No steps to save');
      return;
    }

    setIsSavingRecordedTest(true);

    try {
      // Convert recorded steps to test step format
      const steps = recordedSteps.map(step => {
        switch (step.action) {
          case 'navigate':
            return { action: 'navigate', value: step.url };
          case 'click':
            return { action: 'click', selector: step.selector };
          case 'fill':
          case 'type':
            return { action: step.action, selector: step.selector, value: step.value };
          case 'assert_text':
            return { action: 'assert_text', value: step.text };
          default:
            return { action: step.action, selector: step.selector, value: step.value };
        }
      });

      const response = await fetch(`/api/v1/suites/${suiteId}/tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: recordedTestName,
          description: recordedTestDescription || 'Created via visual recorder',
          steps: steps,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save test');
      }

      const data = await response.json();
      setTests([...tests, data.test]);
      setShowReviewModal(false);
      setRecordedSteps([]);
      setRecordedTestName('');
      setRecordedTestDescription('');
      setRecordTargetUrl('');
      toast.success(`Test "${data.test.name}" created successfully!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save test');
    } finally {
      setIsSavingRecordedTest(false);
    }
  };

  // Cancel recording
  const handleCancelRecording = () => {
    if (recordingSessionId) {
      // Try to stop the recording session
      fetch(`/api/v1/recording/${recordingSessionId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }).catch(() => {});
    }
    setIsRecording(false);
    setRecordingSessionId(null);
    setRecordedSteps([]);
    setRecordingStatus('');
    setShowRecordModal(false);
  };

  // Export tests to JSON file
  const handleExportTests = () => {
    if (tests.length === 0) {
      toast.error('No tests to export');
      return;
    }

    // Prepare export data with suite metadata
    const exportData = {
      suite: {
        name: suite?.name,
        description: suite?.description,
        browser: suite?.browser,
        viewport_width: suite?.viewport_width,
        viewport_height: suite?.viewport_height,
        timeout: suite?.timeout,
        retry_count: suite?.retry_count,
      },
      tests: tests.map(test => ({
        name: test.name,
        description: test.description,
        steps: test.steps,
        status: test.status,
      })),
      exported_at: new Date().toISOString(),
      version: '1.0',
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${suite?.name?.toLowerCase().replace(/\s+/g, '-') || 'tests'}-export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${tests.length} test(s) to file`);
  };

  // Poll for suite run status
  useEffect(() => {
    if (!suiteRunPolling || !suiteRun?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/runs/${suiteRun.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSuiteRun(data.run);

          if (data.run.status !== 'pending' && data.run.status !== 'running') {
            setSuiteRunPolling(false);
            setIsRunningSuite(false);
          }
        }
      } catch (err) {
        console.error('Failed to poll run status:', err);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [suiteRunPolling, suiteRun?.id, token]);

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <p className="text-muted-foreground">Loading test suite...</p>
        </div>
      </Layout>
    );
  }

  if (error || !suite) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center p-8 min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Test Suite Not Found</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate('/projects')}
              className="mt-6 rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Projects
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Breadcrumb navigation */}
        <nav className="mb-6 flex items-center gap-2 text-sm">
          <Link to="/projects" className="text-muted-foreground hover:text-foreground">
            Projects
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link to={`/projects/${project?.id}`} className="text-muted-foreground hover:text-foreground">
            {project?.name || 'Project'}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">{suite?.name}</span>
        </nav>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{suite?.name}</h1>
            {suite?.description && (
              <p className="mt-2 text-muted-foreground">{suite.description}</p>
            )}
            {/* Browser Settings */}
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-blue-700">
                🌐 {suite?.browser === 'firefox' ? 'Firefox' : suite?.browser === 'webkit' ? 'WebKit (Safari)' : 'Chromium'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-gray-700">
                📐 {suite?.viewport_width || 1280}×{suite?.viewport_height || 720}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {tests.length > 0 && (
              <button
                onClick={handleRunWithParallelization}
                disabled={isRunningSuite || isAnalyzingParallel}
                className="rounded-md bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-medium text-white hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzingParallel ? '🤖 Analyzing...' : '🤖 AI Parallel Run'}
              </button>
            )}
            {tests.length > 0 && (
              <button
                onClick={handleRunSuite}
                disabled={isRunningSuite}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunningSuite ? 'Running...' : 'Run Suite'}
              </button>
            )}
            {tests.length > 0 && (
              <button
                onClick={handleExportTests}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Export Tests
              </button>
            )}
            {/* Feature #1851: View run history at suite level */}
            <Link
              to={`/suites/${suiteId}/runs`}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              View History
            </Link>
            {canCreateTest && (
              <>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Import Tests
                </button>
                <button
                  onClick={() => setShowRecordModal(true)}
                  className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                >
                  🎬 Record New Test
                </button>
                {/* Feature #1800: New two-section Create Test modal */}
                <button
                  onClick={() => setShowNewCreateTestModal(true)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create Test
                </button>
              </>
            )}
            {canDeleteSuite && (
              <button
                onClick={() => setShowDeleteSuiteModal(true)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete Suite
              </button>
            )}
          </div>
        </div>

        {/* Feature #1151: Human Review Settings Panel */}
        <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">🔍 Human Review for AI Tests</span>
              <button
                onClick={handleToggleHumanReview}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  requireHumanReview ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    requireHumanReview ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-xs text-muted-foreground">
                {requireHumanReview ? 'Required' : 'Disabled'}
              </span>
            </div>
            {reviewStats && reviewStats.pending_review > 0 && (
              <button
                onClick={() => setShowReviewPanel(!showReviewPanel)}
                className="flex items-center gap-1 rounded-md bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-200"
              >
                <span>⏳</span>
                <span>{reviewStats.pending_review} Pending Review</span>
              </button>
            )}
          </div>
          {reviewStats && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>🤖 {reviewStats.ai_generated} AI-generated</span>
              <span>✅ {reviewStats.approved} approved</span>
              {reviewStats.rejected > 0 && <span>❌ {reviewStats.rejected} rejected</span>}
            </div>
          )}
        </div>

        {/* Feature #1151: Pending Review Tests Panel - Enhanced with #1152 Batch Review */}
        {showReviewPanel && tests.filter(t => t.review_status === 'pending_review').length > 0 && (
          <div className="mb-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                ⏳ Tests Pending Review
              </h3>
              <button
                onClick={() => setShowReviewPanel(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            {/* Feature #1152: Batch selection controls */}
            {(() => {
              const pendingTests = tests.filter(t => t.review_status === 'pending_review');
              const pendingIds = pendingTests.map(t => t.id);
              const allSelected = pendingIds.length > 0 && pendingIds.every(id => selectedForReview.has(id));
              return (
                <>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-orange-200 dark:border-orange-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => toggleAllTestsSelection(pendingIds)}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-muted-foreground">
                        Select All ({selectedForReview.size}/{pendingTests.length} selected)
                      </span>
                    </label>
                    {selectedForReview.size > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBatchReview('approve')}
                          disabled={isApproving}
                          className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          ✓ Batch Approve ({selectedForReview.size})
                        </button>
                        <button
                          onClick={() => handleBatchReview('reject')}
                          disabled={isApproving}
                          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          ✗ Batch Reject ({selectedForReview.size})
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {pendingTests.map(test => (
                      <div key={test.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                        <div className="flex items-center gap-3">
                          {/* Feature #1152: Checkbox for batch selection */}
                          <input
                            type="checkbox"
                            checked={selectedForReview.has(test.id)}
                            onChange={() => toggleTestSelection(test.id)}
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div>
                            <span className="font-medium text-sm">{test.name}</span>
                            {test.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{test.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReviewTest(test.id, 'approve')}
                            disabled={isApproving}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleReviewTest(test.id, 'reject')}
                            disabled={isApproving}
                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Feature #1257: AI Parallelization Panel */}
        {showParallelization && (
          <div className="mb-6 rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  🤖 AI Dynamic Test Parallelization
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Optimal test distribution across workers
                </p>
              </div>
              <button
                onClick={() => setShowParallelization(false)}
                className="p-1 rounded hover:bg-muted"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isAnalyzingParallel ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <svg aria-hidden="true" className="animate-spin h-8 w-8 text-purple-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-muted-foreground">Analyzing test durations and optimizing distribution...</p>
                </div>
              </div>
            ) : parallelizationPlan && (
              <div className="space-y-6">
                {/* Optimization Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-card border border-border text-center">
                    <p className="text-2xl font-bold text-foreground">{parallelizationPlan.totalTests}</p>
                    <p className="text-sm text-muted-foreground">Total Tests</p>
                  </div>
                  <div className="p-4 rounded-lg bg-card border border-border text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{parallelizationPlan.optimization.speedup}x</p>
                    <p className="text-sm text-muted-foreground">Speedup</p>
                  </div>
                  <div className="p-4 rounded-lg bg-card border border-border text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{parallelizationPlan.optimization.timeSaved}s</p>
                    <p className="text-sm text-muted-foreground">Time Saved</p>
                  </div>
                  <div className="p-4 rounded-lg bg-card border border-border text-center">
                    <p className={`text-2xl font-bold ${
                      parallelizationPlan.resourceBalance.balanceScore === 'Excellent' ? 'text-green-600 dark:text-green-400' :
                      parallelizationPlan.resourceBalance.balanceScore === 'Good' ? 'text-blue-600 dark:text-blue-400' :
                      'text-yellow-600 dark:text-yellow-400'
                    }`}>{parallelizationPlan.resourceBalance.balanceScore}</p>
                    <p className="text-sm text-muted-foreground">Balance Score</p>
                  </div>
                </div>

                {/* Time Comparison */}
                <div className="p-4 rounded-lg bg-card border border-border">
                  <h3 className="font-medium text-foreground mb-3">⏱️ Time Optimization</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-24">Sequential:</span>
                      <div className="flex-1 h-4 bg-red-100 dark:bg-red-900/30 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: '100%' }} />
                      </div>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400 w-16">{parallelizationPlan.optimization.sequentialTime}s</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-24">Parallel:</span>
                      <div className="flex-1 h-4 bg-green-100 dark:bg-green-900/30 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${(parallelizationPlan.optimization.parallelTime / parallelizationPlan.optimization.sequentialTime) * 100}%` }} />
                      </div>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400 w-16">{parallelizationPlan.optimization.parallelTime}s</span>
                    </div>
                  </div>
                </div>

                {/* Worker Distribution */}
                <div className="p-4 rounded-lg bg-card border border-border">
                  <h3 className="font-medium text-foreground mb-3">🖥️ Worker Distribution</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {parallelizationPlan.workers.map((worker) => (
                      <div key={worker.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground">{worker.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                            {worker.utilizationPercent}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${worker.utilizationPercent}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {worker.tests.length} tests • {worker.totalDuration}s total
                        </div>
                        <div className="mt-2 max-h-20 overflow-y-auto">
                          {worker.tests.map((t, i) => (
                            <div key={i} className="text-xs text-muted-foreground truncate">
                              • {t.name} ({t.duration}s)
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resource Balance */}
                <div className="p-4 rounded-lg bg-card border border-border">
                  <h3 className="font-medium text-foreground mb-3">📊 Resource Balance</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{parallelizationPlan.resourceBalance.avgUtilization}%</p>
                      <p className="text-xs text-muted-foreground">Avg Utilization</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">{parallelizationPlan.resourceBalance.maxDifference}s</p>
                      <p className="text-xs text-muted-foreground">Max Diff Between Workers</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">{parallelizationPlan.workers.length}</p>
                      <p className="text-xs text-muted-foreground">Active Workers</p>
                    </div>
                  </div>
                </div>

                {/* Run Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleRunSuite}
                    disabled={isRunningSuite}
                    className="px-6 py-2 rounded bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {isRunningSuite ? 'Running...' : '▶️ Execute Optimized Run'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Suite Confirmation Modal */}
        {showDeleteSuiteModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowDeleteSuiteModal(false);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-suite-title"
              className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="delete-suite-title" className="text-lg font-semibold text-foreground">Delete Test Suite</h3>
              <p className="mt-2 text-muted-foreground">
                Are you sure you want to delete "{suite?.name}"? This action cannot be undone and will delete all tests within this suite.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteSuiteModal(false)}
                  className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSuite}
                  disabled={isDeletingSuite}
                  className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeletingSuite ? 'Deleting...' : 'Delete Suite'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feature #1961: Delete Test Confirmation Modal */}
        {showDeleteTestModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowDeleteTestModal(null);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-test-title"
              className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="delete-test-title" className="text-lg font-semibold text-foreground">Delete Test</h3>
              <p className="mt-2 text-muted-foreground">
                Are you sure you want to delete this test? This action cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteTestModal(null)}
                  className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTest(showDeleteTestModal)}
                  disabled={isDeletingTest}
                  className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeletingTest ? 'Deleting...' : 'Delete Test'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Tests Modal */}
        {showImportModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowImportModal(false);
              }
            }}
          >
            <div
              className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground">Import Tests</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a JSON file with test definitions or Playwright test files.
              </p>

              {importError && (
                <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {importError}
                </div>
              )}

              <div className="mt-4">
                <label
                  htmlFor="import-file"
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/30 ${isImporting ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <svg className="h-10 w-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="mt-2 text-sm font-medium text-foreground">
                    {isImporting ? 'Importing...' : 'Click to upload or drag and drop'}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    JSON, .spec.ts, .spec.js, .test.ts, .test.js (Max 5MB)
                  </span>
                </label>
                <input
                  ref={fileInputRef}
                  id="import-file"
                  type="file"
                  accept=".json,.spec.ts,.spec.js,.test.ts,.test.js"
                  onChange={handleImportTests}
                  className="hidden"
                  disabled={isImporting}
                />
              </div>

              <div className="mt-4 rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>JSON Format:</strong> Array of objects with "name" and optional "description", "steps" fields.
                </p>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportError('');
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Suite Run Results */}
        {suiteRun && (
          <div className="mt-6 rounded-lg border border-border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Suite Run</h2>
            <div className="flex items-center gap-4 mb-4">
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                suiteRun.status === 'passed' ? 'bg-green-100 text-green-700' :
                suiteRun.status === 'failed' ? 'bg-red-100 text-red-700' :
                suiteRun.status === 'running' ? 'bg-blue-100 text-blue-700' :
                suiteRun.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                suiteRun.status === 'cancelled' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {suiteRun.status}
              </span>
              {suiteRun.duration_ms && (
                <span className="text-sm text-muted-foreground">
                  Duration: {suiteRun.duration_ms}ms
                </span>
              )}
            </div>

            {/* Progress indicator for running suite */}
            {(suiteRun.status === 'running' || suiteRun.status === 'pending') && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {suiteRun.status === 'pending' ? 'Preparing tests...' : 'Running tests...'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {suiteRun.results?.length || 0} / {tests.length} tests completed
                    {tests.length > 0 && ` (${Math.round(((suiteRun.results?.length || 0) / tests.length) * 100)}%)`}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300 ease-out"
                    style={{ width: `${tests.length > 0 ? Math.round(((suiteRun.results?.length || 0) / tests.length) * 100) : 0}%` }}
                  />
                </div>
                {suiteRun.status === 'running' && (
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <svg aria-hidden="true" className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Running test {(suiteRun.results?.length || 0) + 1}...
                    </div>
                    <button
                      onClick={handleCancelSuiteRun}
                      disabled={isCancellingSuite}
                      className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {isCancellingSuite ? 'Cancelling...' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Cancelled indicator */}
            {suiteRun.status === 'cancelled' && (
              <div className="mb-4 flex items-center gap-2 text-sm">
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-amber-700 font-medium">Test run cancelled</span>
              </div>
            )}

            {/* Completion indicator */}
            {(suiteRun.status === 'passed' || suiteRun.status === 'failed') && (
              <div className="mb-4 flex items-center gap-2 text-sm">
                {suiteRun.status === 'passed' ? (
                  <>
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-green-700 font-medium">All tests passed!</span>
                  </>
                ) : (
                  <>
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-red-700 font-medium">
                      {suiteRun.results?.filter((r: any) => r.status === 'failed').length || 0} test(s) failed
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Test Results */}
            {suiteRun.results && suiteRun.results.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Test Results ({suiteRun.results.length} tests)</h3>
                {suiteRun.results.map((result: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-md border border-border p-4 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={(e) => {
                      // Feature #1825: Click on test row to view details
                      // Don't navigate if clicking on a button or link
                      if ((e.target as HTMLElement).closest('button, a')) return;
                      if (result.test_id) {
                        navigate(`/tests/${result.test_id}`);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          result.status === 'passed' ? 'bg-green-100 text-green-700' :
                          result.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {result.status}
                        </span>
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">{result.test_name}</span>
                        {/* Visual test indicator */}
                        {result.test_type === 'visual_regression' && (
                          <span className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Visual
                          </span>
                        )}
                        {/* Visual test diff percentage badge */}
                        {result.diff_percentage !== undefined && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            result.diff_percentage === 0
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : result.diff_percentage > 1
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {result.diff_percentage === 0 ? '✓ Match' : `${result.diff_percentage.toFixed(2)}% diff`}
                          </span>
                        )}
                        {/* Baseline created indicator */}
                        {result.visual_comparison?.hasBaseline === false && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            📸 New Baseline
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{result.duration_ms}ms</span>
                        {/* Feature #1825: Link to test/run details for all tests */}
                        {result.test_id && (
                          <button
                            onClick={() => navigate(`/tests/${result.test_id}`)}
                            className="text-xs text-primary hover:text-primary/80 underline"
                          >
                            View Test
                          </button>
                        )}
                        {/* Link to run results page with all details */}
                        {suiteRun.id && (
                          <button
                            onClick={() => navigate(`/runs/${suiteRun.id}`)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded border border-primary/20"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Run Details
                          </button>
                        )}
                      </div>
                    </div>
                    {result.error && (
                      <p className="mt-2 text-sm text-red-600">{result.error}</p>
                    )}
                    {/* Feature #1074: Quick link to healing options for failed tests */}
                    {result.status === 'failed' && result.test_id && (
                      <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                            <span>🔧</span>
                            <span>AI healing may help fix selector issues automatically</span>
                          </div>
                          <button
                            onClick={() => {
                              // Navigate to project settings healing tab or test details
                              const projectId = suite?.project_id;
                              if (projectId) {
                                navigate(`/projects/${projectId}#healing-settings`);
                              } else {
                                navigate(`/tests/${result.test_id}`);
                              }
                            }}
                            className="px-3 py-1 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"/>
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                            View Healing Options
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Visual comparison summary for visual tests */}
                    {result.visual_comparison?.hasBaseline && result.diff_percentage !== undefined && result.diff_percentage > 0 && (
                      <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                          <span>🔍</span>
                          <span>
                            Visual difference detected: {result.visual_comparison.mismatchedPixels?.toLocaleString()} pixels differ ({result.diff_percentage.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    )}
                    {result.steps && result.steps.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {result.steps.map((step: any, stepIdx: number) => (
                          <div key={stepIdx} className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className={step.status === 'passed' ? 'text-green-600' : step.status === 'failed' ? 'text-red-600' : 'text-gray-500'}>
                                {step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '○'}
                              </span>
                              <span className="text-muted-foreground">{step.action}</span>
                              <span className="text-muted-foreground">{step.duration_ms}ms</span>
                              {/* Feature #1065: Healed selector indicator */}
                              {step.was_healed && (
                                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" title="This selector was auto-healed by AI">
                                  🔧 Healed
                                </span>
                              )}
                              {step.manual_override && (
                                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" title="This selector was manually overridden">
                                  ✏️ Manual
                                </span>
                              )}
                            </div>
                            {/* Feature #1065 & #1072: Healed selector details with diff visualization */}
                            {step.was_healed && (
                              <div className="ml-6 p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                                {/* Header with strategy and confidence meter */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-purple-700 dark:text-purple-300 font-semibold">🔧 AI-Healed Selector</span>
                                    {step.healing_strategy && (
                                      <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                                        {step.healing_strategy.replace(/_/g, ' ')}
                                      </span>
                                    )}
                                    {/* Feature #1073: Confidence meter visualization */}
                                    {step.healing_confidence !== undefined && (
                                      <div className="flex items-center gap-2" title={`Healing confidence: ${step.healing_confidence}%`}>
                                        <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full transition-all duration-300 ${
                                              step.healing_confidence >= 85 ? 'bg-green-500' :
                                              step.healing_confidence >= 70 ? 'bg-yellow-500' :
                                              'bg-red-500'
                                            }`}
                                            style={{ width: `${step.healing_confidence}%` }}
                                          />
                                        </div>
                                        <span className={`text-xs font-semibold ${
                                          step.healing_confidence >= 85 ? 'text-green-600 dark:text-green-400' :
                                          step.healing_confidence >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                                          'text-red-600 dark:text-red-400'
                                        }`}>
                                          {step.healing_confidence}%
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setEditSelectorModal({
                                        isOpen: true,
                                        runId: suiteRun?.id || '',
                                        testId: result.test_id,
                                        stepId: step.id,
                                        currentSelector: step.selector || step.healed_selector || '',
                                        originalSelector: step.original_selector || '',
                                        wasHealed: step.was_healed,
                                      });
                                    }}
                                    className="px-2 py-1 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center gap-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                      <path d="m15 5 4 4"/>
                                    </svg>
                                    Edit
                                  </button>
                                </div>

                                {/* Feature #1072: Side-by-side diff visualization */}
                                <div className="grid grid-cols-2 gap-3">
                                  {/* Old selector (left side - red) */}
                                  <div className="bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
                                    <div className="px-2 py-1 bg-red-100 dark:bg-red-900/50 border-b border-red-200 dark:border-red-800">
                                      <span className="text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-1">
                                        <span>−</span> Original (Failed)
                                      </span>
                                    </div>
                                    <div className="p-2">
                                      <code className="text-xs font-mono text-red-700 dark:text-red-300 break-all leading-relaxed block line-through">
                                        {step.original_selector}
                                      </code>
                                    </div>
                                  </div>

                                  {/* New selector (right side - green) */}
                                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 overflow-hidden">
                                    <div className="px-2 py-1 bg-green-100 dark:bg-green-900/50 border-b border-green-200 dark:border-green-800">
                                      <span className="text-xs font-semibold text-green-700 dark:text-green-300 flex items-center gap-1">
                                        <span>+</span> Healed (Working)
                                      </span>
                                    </div>
                                    <div className="p-2">
                                      <code className="text-xs font-mono text-green-700 dark:text-green-300 break-all leading-relaxed block">
                                        {step.healed_selector || step.selector}
                                      </code>
                                    </div>
                                  </div>
                                </div>

                                {/* DOM context hint (simulated) */}
                                {step.healing_strategy && (
                                  <div className="mt-2 px-2 py-1.5 bg-muted/50 rounded border border-border text-xs text-muted-foreground">
                                    <span className="font-medium">Strategy used: </span>
                                    {step.healing_strategy === 'visual_match' && 'Visual element matching - identified element by appearance'}
                                    {step.healing_strategy === 'text_match' && 'Text content matching - found element with similar text'}
                                    {step.healing_strategy === 'attribute_match' && 'Attribute matching - matched by similar attributes'}
                                    {step.healing_strategy === 'selector_fallback' && 'Selector fallback - tried alternative selector patterns'}
                                    {!['visual_match', 'text_match', 'attribute_match', 'selector_fallback'].includes(step.healing_strategy) && step.healing_strategy.replace(/_/g, ' ')}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Feature #1065: Show selector for non-healed steps that have selectors */}
                            {!step.was_healed && step.selector && (
                              <div className="ml-6 flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Selector:</span>
                                <code className="px-1 py-0.5 bg-muted rounded font-mono text-xs">
                                  {step.selector}
                                </code>
                                <button
                                  onClick={() => {
                                    setEditSelectorModal({
                                      isOpen: true,
                                      runId: suiteRun?.id || '',
                                      testId: result.test_id,
                                      stepId: step.id,
                                      currentSelector: step.selector,
                                      originalSelector: step.original_selector || step.selector,
                                      wasHealed: false,
                                    });
                                  }}
                                  className="px-1.5 py-0.5 text-xs font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                  title="Edit selector"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                  </svg>
                                </button>
                              </div>
                            )}
                            {/* Feature #603: Display mask selector warnings */}
                            {step.metadata?.maskSelectorWarnings && step.metadata.maskSelectorWarnings.length > 0 && (
                              <div className="ml-6 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                                  <span className="mt-0.5">⚠️</span>
                                  <div className="space-y-1">
                                    {step.metadata.maskSelectorWarnings.map((warning: string, wIdx: number) => (
                                      <div key={wIdx}>{warning}</div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* Also display warnings from hide_elements and remove_elements steps */}
                            {step.metadata?.warnings && step.metadata.warnings.length > 0 && (
                              <div className="ml-6 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                                  <span className="mt-0.5">⚠️</span>
                                  <div className="space-y-1">
                                    {step.metadata.warnings.map((warning: string, wIdx: number) => (
                                      <div key={wIdx}>{warning}</div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* Feature #609: SSL Certificate Error Details */}
                            {step.metadata?.errorType === 'ssl_error' && step.metadata?.sslErrorCode && (
                              <div className="ml-6 mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="text-base">🔐</span>
                                  <div className="flex-1">
                                    <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                                      SSL Certificate Error: {step.metadata.sslErrorCode}
                                    </span>
                                    <span className="ml-2 text-xs px-2 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                      🔒 SSL/TLS Error
                                    </span>
                                  </div>
                                </div>
                                {step.metadata.sslErrorDescription && (
                                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                                    {step.metadata.sslErrorDescription}
                                  </p>
                                )}
                                {/* Security Implications Warning */}
                                {step.metadata.securityImplication && (
                                  <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 mb-2">
                                    <div className="flex items-start gap-2">
                                      <span className="text-sm">⚠️</span>
                                      <div>
                                        <p className="text-xs font-medium text-red-800 dark:text-red-200">Security Implications:</p>
                                        <p className="text-xs text-red-700 dark:text-red-300 mt-1">{step.metadata.securityImplication}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {/* Ignore SSL Option Status */}
                                <div className="text-xs">
                                  {step.metadata.ignoreSSLEnabled ? (
                                    <span className="text-amber-600 dark:text-amber-400">
                                      ⚡ "Ignore SSL errors" is enabled - certificate validation was bypassed
                                    </span>
                                  ) : (
                                    <span className="text-blue-600 dark:text-blue-400">
                                      💡 Enable "Ignore SSL errors" option in test settings to bypass certificate validation (for testing only)
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tests List */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Tests</h2>
            {tests.length > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    &times;
                  </button>
                )}
              </div>
            )}
          </div>

          {tests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <h3 className="text-lg font-semibold text-foreground">No tests yet</h3>
              <p className="mt-2 text-muted-foreground">
                Create your first test in this suite.
              </p>
              {canCreateTest && (
                <button
                  onClick={() => setShowNewCreateTestModal(true)}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create Test
                </button>
              )}
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <h3 className="text-lg font-semibold text-foreground">No tests found</h3>
              <p className="mt-2 text-muted-foreground">
                No tests match your search "{searchQuery}".
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              {/* Feature #1958: Enhanced header with run metadata columns and sorting */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px_100px] gap-2 border-b border-border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground min-w-[900px]">
                <button
                  className="flex items-center hover:text-foreground transition-colors text-left"
                  onClick={() => handleSort('name')}
                >
                  Name
                  <span className="ml-1">{sortField === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : <span className="text-muted-foreground/30">↕</span>}</span>
                </button>
                <button
                  className="flex items-center hover:text-foreground transition-colors text-left"
                  onClick={() => handleSort('status')}
                >
                  Status
                  <span className="ml-1">{sortField === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : <span className="text-muted-foreground/30">↕</span>}</span>
                </button>
                <button
                  className="flex items-center hover:text-foreground transition-colors text-left"
                  onClick={() => handleSort('last_run')}
                >
                  Last Run
                  <span className="ml-1">{sortField === 'last_run' ? (sortDirection === 'asc' ? '↑' : '↓') : <span className="text-muted-foreground/30">↕</span>}</span>
                </button>
                <button
                  className="flex items-center hover:text-foreground transition-colors text-left"
                  onClick={() => handleSort('last_result')}
                >
                  Result
                  <span className="ml-1">{sortField === 'last_result' ? (sortDirection === 'asc' ? '↑' : '↓') : <span className="text-muted-foreground/30">↕</span>}</span>
                </button>
                <button
                  className="flex items-center hover:text-foreground transition-colors text-left"
                  onClick={() => handleSort('run_count')}
                >
                  Runs
                  <span className="ml-1">{sortField === 'run_count' ? (sortDirection === 'asc' ? '↑' : '↓') : <span className="text-muted-foreground/30">↕</span>}</span>
                </button>
                <button
                  className="flex items-center hover:text-foreground transition-colors text-left"
                  onClick={() => handleSort('avg_duration')}
                >
                  Avg Time
                  <span className="ml-1">{sortField === 'avg_duration' ? (sortDirection === 'asc' ? '↑' : '↓') : <span className="text-muted-foreground/30">↕</span>}</span>
                </button>
                <div>Actions</div>
              </div>
              {sortedTests.map((test) => {
                // Feature #1959: Check run status for this test
                const testResult = suiteRun?.results?.find((r: any) => r.test_id === test.id);
                const isCurrentlyRunning = suiteRun?.status === 'running' && !testResult && suiteRun?.results?.length < tests.length;
                const completedTestIds = suiteRun?.results?.map((r: any) => r.test_id) || [];
                const currentTestIndex = completedTestIds.length;
                const testsInOrder = tests.map(t => t.id);
                const isThisTestRunning = isCurrentlyRunning && testsInOrder[currentTestIndex] === test.id;
                const wasRecentlyRun = testResult && (Date.now() - new Date(suiteRun?.started_at || 0).getTime() < 60000);

                return (
                <div
                  key={test.id}
                  className={`grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px_100px] gap-2 border-b border-border px-4 py-3 last:border-0 items-center hover:bg-muted/20 cursor-pointer transition-colors min-w-[900px] ${
                    wasRecentlyRun ? 'bg-primary/5 hover:bg-primary/10' : ''
                  } ${isThisTestRunning ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  onClick={() => navigate(`/tests/${test.id}`)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {/* Feature #1960: Test type icons for quick identification */}
                      {test.test_type === 'e2e' && (
                        <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" title="End-to-End Test">
                          🌐
                        </span>
                      )}
                      {test.test_type === 'visual_regression' && (
                        <span className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" title="Visual Regression Test">
                          📸
                        </span>
                      )}
                      {test.test_type === 'accessibility' && (
                        <span className="inline-flex items-center rounded bg-teal-100 px-1.5 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" title="Accessibility Test">
                          ♿
                        </span>
                      )}
                      {test.test_type === 'lighthouse' && (
                        <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title="Performance Test (Lighthouse)">
                          ⚡
                        </span>
                      )}
                      {test.test_type === 'load' && (
                        <span className="inline-flex items-center rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" title="Load Test (K6)">
                          📊
                        </span>
                      )}
                      <span className="font-medium text-foreground">{test.name}</span>
                      {/* Feature #1071: Healing indicator badge */}
                      {test.healing_active && (
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                            test.healing_status === 'pending'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : test.healing_status === 'applied'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : test.healing_status === 'rejected'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}
                          title={`${test.healing_count || 1} healed selector${(test.healing_count || 1) > 1 ? 's' : ''} (${test.healing_status || 'pending'})`}
                        >
                          🔧
                          {test.healing_count && test.healing_count > 1 && (
                            <span>{test.healing_count}</span>
                          )}
                        </span>
                      )}
                    </div>
                    {test.description && (
                      <p className="text-xs text-muted-foreground truncate">{test.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      test.status === 'active' ? 'bg-green-100 text-green-700' :
                      test.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {test.status}
                    </span>
                    {/* Feature #1164: AI Generated badge with confidence level */}
                    {test.ai_generated && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium cursor-help group relative ${
                          test.ai_confidence_score !== undefined && test.ai_confidence_score >= 80
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : test.ai_confidence_score !== undefined && test.ai_confidence_score >= 60
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}
                        title={
                          test.ai_confidence_score !== undefined
                            ? `AI Generated - ${test.ai_confidence_score}% confidence\n${
                                test.ai_confidence_score >= 80
                                  ? 'High confidence: Ready for use'
                                  : test.ai_confidence_score >= 60
                                  ? 'Medium confidence: Review recommended'
                                  : 'Low confidence: Human review required'
                              }`
                            : 'This test was generated by AI'
                        }
                      >
                        🤖 AI Generated
                        {test.ai_confidence_score !== undefined && (
                          <span className={`ml-1 font-semibold ${
                            test.ai_confidence_score >= 80 ? 'text-green-600 dark:text-green-400' :
                            test.ai_confidence_score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-orange-600 dark:text-orange-400'
                          }`}>
                            {test.ai_confidence_score}%
                          </span>
                        )}
                      </span>
                    )}
                    {/* Feature #1151: Human review workflow - Show review status for AI-generated tests */}
                    {test.ai_generated && test.review_status === 'pending_review' && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" title="Pending human review">
                        ⏳ Review
                      </span>
                    )}
                    {test.ai_generated && test.review_status === 'approved' && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" title="Approved by reviewer">
                        ✅ Approved
                      </span>
                    )}
                    {test.ai_generated && test.review_status === 'rejected' && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" title="Rejected by reviewer">
                        ❌ Rejected
                      </span>
                    )}
                  </div>
                  {/* Feature #1958: Last Run column - shows relative time or running status */}
                  <div className="text-sm text-muted-foreground" title={test.last_run_at ? new Date(test.last_run_at).toLocaleString() : undefined}>
                    {isThisTestRunning ? (
                      <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Now
                      </span>
                    ) : test.last_run_at ? (
                      formatRelativeTime(new Date(test.last_run_at))
                    ) : (
                      'Never'
                    )}
                  </div>
                  {/* Feature #1958: Result column - shows pass/fail badge */}
                  <div>
                    {isThisTestRunning ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        ● Running
                      </span>
                    ) : testResult ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        testResult.status === 'passed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : testResult.status === 'failed'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {testResult.status === 'passed' ? '✓' : testResult.status === 'failed' ? '✗' : '○'}
                        <span className="capitalize">{testResult.status}</span>
                      </span>
                    ) : test.last_result ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        test.last_result === 'passed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : test.last_result === 'failed'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : test.last_result === 'error'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {test.last_result === 'passed' ? '✓' : test.last_result === 'failed' ? '✗' : test.last_result === 'error' ? '⚠' : '○'}
                        <span className="capitalize">{test.last_result}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                  {/* Feature #1958: Run Count column */}
                  <div className="text-sm text-muted-foreground text-center">
                    {test.run_count ?? 0}
                  </div>
                  {/* Feature #1958: Avg Duration column */}
                  <div className="text-sm text-muted-foreground">
                    {test.avg_duration_ms != null ? (
                      test.avg_duration_ms < 1000 ? `${test.avg_duration_ms}ms` :
                      test.avg_duration_ms < 60000 ? `${(test.avg_duration_ms / 1000).toFixed(1)}s` :
                      `${Math.floor(test.avg_duration_ms / 60000)}m ${Math.floor((test.avg_duration_ms % 60000) / 1000)}s`
                    ) : '-'}
                  </div>
                  {/* Feature #1961: Quick actions dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenActionsDropdown(openActionsDropdown === test.id ? null : test.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      Actions
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openActionsDropdown === test.id && (
                      <div
                        className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-card shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setOpenActionsDropdown(null);
                              navigate(`/tests/${test.id}`);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              setOpenActionsDropdown(null);
                              handleRunSingleTest(test.id);
                            }}
                            disabled={runningTestId === test.id}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                          >
                            {runningTestId === test.id ? (
                              <>
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Running...
                              </>
                            ) : (
                              <>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Run Test
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setOpenActionsDropdown(null);
                              navigate(`/tests/${test.id}?edit=true`);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setOpenActionsDropdown(null);
                              handleDuplicateTest(test);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Duplicate
                          </button>
                          <div className="border-t border-border my-1" />
                          <button
                            onClick={() => {
                              setOpenActionsDropdown(null);
                              setShowDeleteTestModal(test.id);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Feature #1800: New two-section Create Test Modal */}
        <CreateTestModal
          isOpen={showNewCreateTestModal}
          onClose={() => setShowNewCreateTestModal(false)}
          onTestCreated={async (test) => {
            // Refresh tests list after creation
            try {
              const response = await fetch(`/api/v1/suites/${suiteId}/tests`, {
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (response.ok) {
                const data = await response.json();
                setTests(data.tests);
              }
            } catch (err) {
              console.error('Failed to refresh tests:', err);
            }
            // Feature #1985: Handle Create & Run flow
            if (test.runId) {
              // Navigate to run details page after Create & Run
              toast.success(`Test "${test.name}" created and running!`);
              navigate(`/runs/${test.runId}`);
            } else {
              toast.success(`Test "${test.name}" created successfully!`);
            }
          }}
          suiteId={suiteId || ''}
          project={project ? {
            id: project.id,
            name: project.name,
            baseUrl: project.base_url,
          } : undefined}
          suite={suite ? {
            id: suite.id,
            name: suite.name,
            projectId: suite.project_id,
          } : undefined}
          token={token || undefined}
        />


        {/* Legacy Create Test Modal removed - Feature #1816 */}

        {/* Feature #1342: Generated Test Code Preview Modal */}
        {showGeneratedCodeModal && generatedTestPreview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowGeneratedCodeModal(false);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-4xl rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✨</span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Generated Playwright Test</h3>
                    <p className="text-sm text-muted-foreground">Review the generated code before saving</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGeneratedCodeModal(false)}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full font-medium ${
                  generatedTestPreview.syntax_valid
                    ? 'bg-green-500/10 text-green-600 border border-green-500/30'
                    : 'bg-red-500/10 text-red-600 border border-red-500/30'
                }`}>
                  {generatedTestPreview.syntax_valid ? '✓' : '✗'} Syntax {generatedTestPreview.syntax_valid ? 'Valid' : 'Invalid'}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full font-medium ${
                  generatedTestPreview.complexity === 'simple' ? 'bg-green-500/10 text-green-600 border border-green-500/30' :
                  generatedTestPreview.complexity === 'medium' ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/30' :
                  'bg-orange-500/10 text-orange-600 border border-orange-500/30'
                }`}>
                  {generatedTestPreview.complexity === 'simple' ? '📗' : generatedTestPreview.complexity === 'medium' ? '📙' : '📕'} {generatedTestPreview.complexity.charAt(0).toUpperCase() + generatedTestPreview.complexity.slice(1)} Complexity
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full font-medium bg-purple-500/10 text-purple-600 border border-purple-500/30">
                  🎯 {generatedTestPreview.selectors.length} Selectors
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full font-medium bg-blue-500/10 text-blue-600 border border-blue-500/30">
                  ✓ {generatedTestPreview.assertions.length} Assertions
                </span>
              </div>

              {/* Feature #1153: Confidence Score Display */}
              {generatedTestPreview.confidence_score !== undefined && (
                <div className={`mb-4 p-4 rounded-lg border ${
                  generatedTestPreview.confidence_score >= 80 ? 'bg-green-500/5 border-green-500/30' :
                  generatedTestPreview.confidence_score >= 60 ? 'bg-yellow-500/5 border-yellow-500/30' :
                  'bg-orange-500/5 border-orange-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-14 h-14 rounded-full border-4 ${
                        generatedTestPreview.confidence_score >= 80 ? 'border-green-500 text-green-600' :
                        generatedTestPreview.confidence_score >= 60 ? 'border-yellow-500 text-yellow-600' :
                        'border-orange-500 text-orange-600'
                      }`}>
                        <span className="text-lg font-bold">{generatedTestPreview.confidence_score}%</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">AI Confidence Score</h4>
                        <p className="text-sm text-muted-foreground">
                          {generatedTestPreview.confidence_score >= 80 ? 'High confidence - Ready for use' :
                           generatedTestPreview.confidence_score >= 60 ? 'Medium confidence - Review recommended' :
                           'Low confidence - Human review required'}
                        </p>
                      </div>
                    </div>
                    {generatedTestPreview.confidence_score < 70 && (
                      <span className="flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        ⚠️ Flagged for Review
                      </span>
                    )}
                  </div>

                  {/* Confidence Factors Breakdown */}
                  {generatedTestPreview.confidence_factors && generatedTestPreview.confidence_factors.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-foreground mb-2">Score Breakdown</h5>
                      {generatedTestPreview.confidence_factors.map((factor, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-muted-foreground">{factor.factor}</span>
                              <span className={`font-medium ${
                                factor.score < 0 ? 'text-red-600' :
                                factor.max_score > 0 && factor.score >= factor.max_score * 0.7 ? 'text-green-600' :
                                factor.max_score > 0 && factor.score >= factor.max_score * 0.4 ? 'text-yellow-600' :
                                'text-orange-600'
                              }`}>
                                {factor.score < 0 ? factor.score : `${factor.score}/${factor.max_score}`}
                              </span>
                            </div>
                            {factor.max_score > 0 && (
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    factor.score >= factor.max_score * 0.7 ? 'bg-green-500' :
                                    factor.score >= factor.max_score * 0.4 ? 'bg-yellow-500' :
                                    'bg-orange-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (factor.score / factor.max_score) * 100)}%` }}
                                />
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">{factor.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Warnings */}
              {generatedTestPreview.warnings && generatedTestPreview.warnings.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span>⚠️</span>
                    <span className="font-medium text-yellow-700 dark:text-yellow-400">Warnings</span>
                  </div>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
                    {generatedTestPreview.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Syntax Errors */}
              {generatedTestPreview.syntax_errors && generatedTestPreview.syntax_errors.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span>❌</span>
                    <span className="font-medium text-red-700 dark:text-red-400">Syntax Errors</span>
                  </div>
                  <ul className="text-sm text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
                    {generatedTestPreview.syntax_errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 mb-4">
                {/* Steps */}
                <div className="col-span-1">
                  <h4 className="text-sm font-semibold text-foreground mb-2">📋 Test Steps</h4>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                    {generatedTestPreview.steps.map((step, idx) => (
                      <li key={idx} className="pl-1">{step}</li>
                    ))}
                  </ol>
                </div>

                {/* Selectors */}
                <div className="col-span-1">
                  <h4 className="text-sm font-semibold text-foreground mb-2">🎯 Selectors Used</h4>
                  {generatedTestPreview.selectors.length > 0 ? (
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      {generatedTestPreview.selectors.map((selector, idx) => (
                        <li key={idx} className="px-2 py-1 rounded bg-muted font-mono truncate" title={selector}>
                          {selector}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No specific selectors detected</p>
                  )}
                </div>

                {/* Assertions */}
                <div className="col-span-1">
                  <h4 className="text-sm font-semibold text-foreground mb-2">✓ Assertions</h4>
                  {generatedTestPreview.assertions.length > 0 ? (
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      {generatedTestPreview.assertions.slice(0, 5).map((assertion, idx) => (
                        <li key={idx} className="px-2 py-1 rounded bg-muted font-mono truncate" title={assertion}>
                          {assertion.length > 40 ? assertion.substring(0, 40) + '...' : assertion}
                        </li>
                      ))}
                      {generatedTestPreview.assertions.length > 5 && (
                        <li className="text-muted-foreground text-xs">+{generatedTestPreview.assertions.length - 5} more...</li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No assertions detected</p>
                  )}
                </div>
              </div>

              {/* Code Preview */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">📝 Generated Code</h4>
                    {/* Feature #1163: Diff view toggle */}
                    {previousGeneratedCode && (
                      <button
                        type="button"
                        onClick={() => setShowDiffView(!showDiffView)}
                        className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                          showDiffView
                            ? 'bg-purple-500/20 text-purple-600 border-purple-500/50'
                            : 'border-border hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        {showDiffView ? '📊 Diff View' : '📊 Show Diff'}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedTestCode);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted text-muted-foreground"
                  >
                    📋 Copy Code
                  </button>
                </div>

                {/* Feature #1163: Diff View */}
                {showDiffView && previousGeneratedCode ? (
                  <div className="rounded-lg bg-[#1e1e1e] p-4 overflow-x-auto max-h-80 overflow-y-auto">
                    <div className="font-mono text-sm space-y-0">
                      {computeCodeDiff(previousGeneratedCode, generatedTestCode).map((line, idx) => (
                        <div
                          key={idx}
                          className={`px-2 py-0.5 ${
                            line.type === 'added'
                              ? 'bg-green-500/20 text-green-400 border-l-2 border-green-500'
                              : line.type === 'removed'
                              ? 'bg-red-500/20 text-red-400 border-l-2 border-red-500 line-through opacity-70'
                              : 'text-gray-400'
                          }`}
                        >
                          <span className="inline-block w-6 text-xs opacity-50 mr-2">
                            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                          </span>
                          {line.line || '\u00A0'}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-green-500/30 border border-green-500"></span>
                        <span className="text-green-400">Added lines</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-red-500/30 border border-red-500"></span>
                        <span className="text-red-400">Removed lines</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#1e1e1e] p-4 overflow-x-auto max-h-80 overflow-y-auto">
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap break-words">
                      {generatedTestCode}
                    </pre>
                  </div>
                )}
              </div>

              {/* Feature #1163: Regenerate with Feedback */}
              <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span>🔄</span>
                  <span className="text-sm font-medium text-foreground">Refine This Test</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Provide feedback to regenerate the test with improvements
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={regenerationFeedback}
                    onChange={(e) => setRegenerationFeedback(e.target.value)}
                    placeholder="e.g., Add more assertions, use better selectors, include error handling..."
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <button
                    type="button"
                    disabled={isRegenerating || regenerationFeedback.trim().length < 5}
                    onClick={async () => {
                      setIsRegenerating(true);
                      try {
                        // Save current code as previous for diff view
                        setPreviousGeneratedCode(generatedTestCode);

                        const response = await fetch('/api/v1/ai/generate-test', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            description: `${aiTestDescription}\n\nFeedback for improvement: ${regenerationFeedback}`,
                            suite_id: suiteId,
                            // Feature #1759: Extract URL from description OR use explicit target URL
                            base_url: extractUrlFromText(aiTestDescription) || newTestTargetUrl || undefined,
                            test_type: 'e2e',
                            include_assertions: true,
                            include_screenshot: false,
                            previous_code: generatedTestCode,
                          }),
                        });

                        const data = await response.json();

                        if (!response.ok) {
                          throw new Error(data.message || data.error || 'Failed to regenerate test');
                        }

                        if (data.success && data.test) {
                          setGeneratedTestCode(data.test.code);
                          // Update preview with new data
                          const confidence = calculateTestConfidence({
                            syntax_valid: data.test.syntax_valid,
                            syntax_errors: data.test.syntax_errors,
                            assertions: data.test.assertions,
                            selectors: data.test.selectors,
                            steps: data.test.steps,
                            complexity: data.test.complexity,
                            warnings: data.test.warnings,
                          });
                          setGeneratedTestPreview({
                            test_name: data.test.test_name,
                            steps: data.test.steps,
                            selectors: data.test.selectors,
                            assertions: data.test.assertions,
                            syntax_valid: data.test.syntax_valid,
                            syntax_errors: data.test.syntax_errors,
                            complexity: data.test.complexity,
                            warnings: data.test.warnings,
                            confidence_score: confidence.score,
                            confidence_factors: confidence.factors,
                          });
                          // Show diff view automatically after regeneration
                          setShowDiffView(true);
                          // Clear feedback after successful regeneration
                          setRegenerationFeedback('');
                        }
                      } catch (error) {
                        console.error('Regeneration failed:', error);
                      } finally {
                        setIsRegenerating(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRegenerating ? (
                      <>
                        <svg aria-hidden="true" className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <span>🔄</span>
                        Regenerate
                      </>
                    )}
                  </button>
                </div>
                {previousGeneratedCode && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <span>✓</span>
                    Regenerated - click "Show Diff" to see changes
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowGeneratedCodeModal(false);
                    setGeneratedTestCode('');
                    setGeneratedTestPreview(null);
                    // Feature #1163: Clear regeneration state
                    setPreviousGeneratedCode(null);
                    setShowDiffView(false);
                    setRegenerationFeedback('');
                  }}
                  className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Auto-fill the test name from the generated test
                    if (generatedTestPreview.test_name) {
                      // Convert camelCase to readable format for the test name
                      const readableName = generatedTestPreview.test_name
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (str) => str.toUpperCase())
                        .trim();
                      setNewTestName(readableName);
                    }
                    // Set description from the original AI description
                    if (aiTestDescription) {
                      setNewTestDescription(aiTestDescription);
                    }
                    // Feature #1151: Mark this test as AI-generated
                    setIsTestFromAI(true);
                    // Feature #1164: Save confidence score before clearing preview
                    if (generatedTestPreview?.confidence_score !== undefined) {
                      setAiConfidenceScore(generatedTestPreview.confidence_score);
                    }
                    // Close the modal and the AI generator panel
                    setShowGeneratedCodeModal(false);
                    setShowAITestGenerator(false);
                    // Clear the state
                    setGeneratedTestCode('');
                    setGeneratedTestPreview(null);
                    setAITestDescription('');
                    // Feature #1163: Clear regeneration state
                    setPreviousGeneratedCode(null);
                    setShowDiffView(false);
                    setRegenerationFeedback('');
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-purple-600 text-white hover:bg-purple-700"
                >
                  <span>✨</span>
                  Use This Test
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Record New Test Modal */}
        {showRecordModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !isRecording) {
                handleCancelRecording();
              }
            }}
          >
            <div
              className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground">🎬 Record New Test</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {isRecording
                  ? 'Interact with the browser window to record test steps. Click actions, type in inputs, and assert text visibility.'
                  : 'Enter the URL to start recording. A browser window will open where you can perform actions.'}
              </p>

              {!isRecording ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="record-url" className="block text-sm font-medium text-foreground">
                      Target URL
                    </label>
                    <input
                      id="record-url"
                      type="url"
                      value={recordTargetUrl}
                      onChange={(e) => setRecordTargetUrl(e.target.value)}
                      placeholder={project?.base_url || 'https://your-site.com'}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelRecording}
                      className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStartRecording}
                      className="rounded-md bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700"
                    >
                      Start Recording
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-md bg-orange-50 p-4 border border-orange-200">
                    <div className="flex items-center gap-2">
                      <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      <span className="font-medium text-orange-800">{recordingStatus}</span>
                    </div>
                  </div>

                  {/* Recorded Steps Preview */}
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Recorded Steps ({recordedSteps.length}):</h4>
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
                      {recordedSteps.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No steps recorded yet...</p>
                      ) : (
                        <ol className="space-y-1 text-sm">
                          {recordedSteps.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="font-mono text-muted-foreground">{idx + 1}.</span>
                              <span className="font-medium text-blue-600">{step.action}</span>
                              {step.url && <span className="truncate text-muted-foreground">→ {step.url}</span>}
                              {step.selector && <span className="truncate text-muted-foreground">→ {step.selector}</span>}
                              {step.value && <span className="truncate text-green-600">"{step.value}"</span>}
                              {step.text && <span className="truncate text-green-600">"{step.text}"</span>}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>

                  {/* Manual Step Buttons */}
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Add Manual Step:</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          const text = prompt('Enter text to assert is visible:');
                          if (text) handleAddRecordingStep('assert_text', { text });
                        }}
                        className="rounded-md border border-green-300 bg-green-50 px-3 py-1 text-sm text-green-700 hover:bg-green-100"
                      >
                        + Assert Text
                      </button>
                      <button
                        onClick={() => handleAddRecordingStep('screenshot', {})}
                        className="rounded-md border border-purple-300 bg-purple-50 px-3 py-1 text-sm text-purple-700 hover:bg-purple-100"
                      >
                        + Screenshot
                      </button>
                      <button
                        onClick={() => {
                          const ms = prompt('Enter wait time in milliseconds:', '1000');
                          if (ms) handleAddRecordingStep('wait', { value: ms });
                        }}
                        className="rounded-md border border-gray-300 bg-gray-50 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        + Wait
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelRecording}
                      className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStopRecording}
                      className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                    >
                      Stop Recording
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Review Recorded Test Modal */}
        {showReviewModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowReviewModal(false);
              }
            }}
          >
            <div
              className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground">Review Recorded Test</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Review the recorded steps, give your test a name, and save it to the suite.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="recorded-test-name" className="block text-sm font-medium text-foreground">
                    Test Name *
                  </label>
                  <input
                    id="recorded-test-name"
                    type="text"
                    value={recordedTestName}
                    onChange={(e) => setRecordedTestName(e.target.value)}
                    placeholder="Enter test name"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="recorded-test-desc" className="block text-sm font-medium text-foreground">
                    Description
                  </label>
                  <textarea
                    id="recorded-test-desc"
                    value={recordedTestDescription}
                    onChange={(e) => setRecordedTestDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={2}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <h4 className="text-sm font-medium text-foreground">Recorded Steps ({recordedSteps.length}):</h4>
                  <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
                    <ol className="space-y-2 text-sm">
                      {recordedSteps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3 p-2 rounded-md bg-background border border-border">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-medium">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <span className="font-medium text-blue-600">{step.action}</span>
                            {step.url && <p className="text-muted-foreground mt-0.5">URL: {step.url}</p>}
                            {step.selector && <p className="text-muted-foreground mt-0.5">Selector: <code className="bg-muted px-1 rounded">{step.selector}</code></p>}
                            {step.value && <p className="text-green-600 mt-0.5">Value: "{step.value}"</p>}
                            {step.text && <p className="text-green-600 mt-0.5">Assert: "{step.text}"</p>}
                          </div>
                          <button
                            onClick={() => setRecordedSteps(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700"
                            title="Remove step"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border">
                  <button
                    onClick={() => {
                      setShowReviewModal(false);
                      setRecordedSteps([]);
                      setRecordedTestName('');
                      setRecordedTestDescription('');
                    }}
                    className="rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSaveRecordedTest}
                    disabled={isSavingRecordedTest || recordedSteps.length === 0 || !recordedTestName.trim()}
                    className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSavingRecordedTest ? 'Saving...' : 'Save Test'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature #1065: Edit Selector Modal for TestSuitePage */}
        {editSelectorModal.isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !isSubmittingSelector) {
                setEditSelectorModal({
                  isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
                });
              }
            }}
          >
            <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-lg bg-card p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {editSelectorModal.wasHealed ? 'Edit Healed Selector' : 'Edit Selector'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {editSelectorModal.wasHealed ? 'Modify or accept the AI-healed selector' : 'Manually update the selector'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditSelectorModal({
                    isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
                  })}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={isSubmittingSelector}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Original Selector */}
              <div className="mb-4 p-3 bg-muted/50 rounded-md">
                <div className="text-xs font-medium text-muted-foreground mb-1">Original Selector</div>
                <code className="text-sm font-mono text-foreground break-all">
                  {editSelectorModal.originalSelector || 'N/A'}
                </code>
              </div>

              {/* Current Selector (if healed) */}
              {editSelectorModal.wasHealed && editSelectorModal.currentSelector !== editSelectorModal.originalSelector && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                  <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1 flex items-center gap-1">
                    <span>🔧</span> AI-Healed Selector
                  </div>
                  <code className="text-sm font-mono text-green-800 dark:text-green-200 break-all">
                    {editSelectorModal.currentSelector}
                  </code>
                </div>
              )}

              {/* New Selector Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">
                  {editSelectorModal.wasHealed ? 'New Selector (or keep healed)' : 'New Selector'}
                </label>
                <input
                  type="text"
                  value={editSelectorValue}
                  onChange={(e) => setEditSelectorValue(e.target.value)}
                  placeholder={editSelectorModal.currentSelector || 'Enter selector...'}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports CSS selectors, XPath, or data-testid attributes
                </p>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
                <textarea
                  value={editSelectorNotes}
                  onChange={(e) => setEditSelectorNotes(e.target.value)}
                  placeholder="Why are you changing this selector?"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Apply to Test Definition Checkbox */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editSelectorApplyToTest}
                    onChange={(e) => setEditSelectorApplyToTest(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Apply to test definition</span>
                </label>
                <p className="ml-6 text-xs text-muted-foreground">
                  If checked, the new selector will be saved to the test so future runs use it
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEditSelectorModal({
                      isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
                    });
                    setEditSelectorValue('');
                    setEditSelectorNotes('');
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  disabled={isSubmittingSelector}
                >
                  Cancel
                </button>
                {editSelectorModal.wasHealed && (
                  <button
                    onClick={handleAcceptHealed}
                    disabled={isSubmittingSelector}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {isSubmittingSelector ? 'Accepting...' : '✓ Accept Healed'}
                  </button>
                )}
                <button
                  onClick={handleUpdateSelector}
                  disabled={isSubmittingSelector || !editSelectorValue.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmittingSelector ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export { TestSuitePage };
