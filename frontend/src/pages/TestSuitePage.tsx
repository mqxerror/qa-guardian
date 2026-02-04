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
import { io, Socket } from 'socket.io-client';
// Feature #1768: Import UnifiedAIService for AI test generation
import { UnifiedAIService } from '../services/UnifiedAIService';
// Feature #1800: Import new CreateTestModal with two-section layout
import { CreateTestModal } from '../components/create-test';
// Feature #36: Import device emulation types and component
import { DeviceConfig, DeviceEmulationPreset, DEVICE_PRESETS } from '../components/test-modals/types';
import { DeviceSelect } from '../components/create-test/shared/DeviceSelect';
// Feature #50: Import modular types, utilities, and hooks from suite-detail
import {
  TestSuite,
  TestType,
  TestTypeEnum,
  TestStatus,
  HealingStatus,
  IgnoreRegion,
  TestStep,
  AICopilotSuggestion,
  AITestGeneration,
  SortField,
  SortDirection,
  SortConfig,
  ViewportPreset,
  VIEWPORT_PRESETS,
  DEFAULT_K6_SCRIPT,
  Project,
  ReviewSettings,
  QuickAction,
  extractUrlFromText,
  extractTestTypeFromText,
  extractViewportFromText,
  formatRelativeTime,
  TestListItem,
  TestTypeBadge,
  TestStatusBadge,
  AIConfidenceBadge,
  ReviewStatusBadge,
  // Feature #50: Hooks for state management
  useSuiteState,
  useModalState,
  // Feature #50: Modals
  DeleteSuiteModal,
  DeleteTestModal,
  ImportTestsModal,
  EditSelectorModal,
  ExpandedScreenshotModal,
  InsertTemplateModal,
  GeneratedTestPreviewModal,
  RecordTestModal,
  ReviewRecordedTestModal,
  // Feature #50: Types
  EditSelectorModalState,
  TemplateType,
  // Feature #50: Panels
  ParallelizationPanel,
  // Feature #50: Header Components
  SuiteHeaderActions,
  // Feature #50: Review Panels
  HumanReviewPanel,
  // Feature #50: Results Display
  SuiteRunResults,
  // Feature #50: Test List
  TestListSection,
  // Feature #50: Utilities
  computeCodeDiff,
  calculateTestConfidence,
  validateTestName,
  // Feature #50: Recording Hook
  useRecordingState,
} from '../components/suite-detail';

// Removed inline type definitions and utility functions - now imported from suite-detail module (Feature #50)

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
  // Feature #36: Device emulation for recording
  const [recordingDeviceEnabled, setRecordingDeviceEnabled] = useState(false);
  const [recordingDeviceConfig, setRecordingDeviceConfig] = useState<DeviceConfig>({ preset: 'desktop-1280' });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [recordedSteps, setRecordedSteps] = useState<Array<{
    action: string;
    selector?: string;
    selectorStrategies?: Array<{ strategy: string; selector: string; confidence: number }>;
    value?: string;
    url?: string;
    text?: string;
    // Feature #37: Optional step support for cookie consent handling
    optional?: boolean;
    optionalReason?: 'cookie_consent' | 'popup_dismiss' | 'notification_close' | 'user_marked';
  }>>([]);
  const [recordingStatus, setRecordingStatus] = useState<string>('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [recordedTestName, setRecordedTestName] = useState('');
  const [recordedTestDescription, setRecordedTestDescription] = useState('');
  const [isSavingRecordedTest, setIsSavingRecordedTest] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingPopup, setRecordingPopup] = useState<Window | null>(null);
  // Feature #26: Live browser view state
  const [recordingFrame, setRecordingFrame] = useState<string | null>(null);
  const recordingSocketRef = useRef<Socket | null>(null);
  const browserViewRef = useRef<HTMLDivElement | null>(null);
  const browserImgRef = useRef<HTMLImageElement | null>(null);
  // Feature #28: Polish - URL nav, connection status, click ripple
  const [recordingCurrentUrl, setRecordingCurrentUrl] = useState('');
  const [recordingConnected, setRecordingConnected] = useState(false);
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  // Feature #33: Reconnection and stale frame detection state
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const [staleFrameWarning, setStaleFrameWarning] = useState<'none' | 'waiting' | 'unresponsive'>('none');
  const staleFrameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Feature #34: Debug overlay and coordinate calibration
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [debugCoords, setDebugCoords] = useState<{ cssX: number; cssY: number; vpX: number; vpY: number } | null>(null);
  const frameScaleRef = useRef<{ scaleX: number; scaleY: number }>({ scaleX: 1280, scaleY: 720 });
  // Feature #31: Step Templates state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [stepTemplates, setStepTemplates] = useState<Array<{ id: string; name: string; description?: string; steps: any[]; tags: string[]; created_at: string }>>([]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [insertTemplateForTest, setInsertTemplateForTest] = useState<string | null>(null);
  const frameRequestRef = useRef<number | null>(null);
  const pendingFrameRef = useRef<string | null>(null);

  // Feature #35: Live screenshot streaming during test execution
  const [liveScreenshot, setLiveScreenshot] = useState<{
    base64: string;
    testId: string;
    testName: string;
    stepIndex: number;
    stepAction: string;
    stepSelector?: string;
    timestamp: number;
  } | null>(null);
  const [screenshotHistory, setScreenshotHistory] = useState<Array<{
    base64: string;
    stepIndex: number;
    stepAction: string;
    timestamp: number;
  }>>([]);
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);

  const canCreateTest = user?.role !== 'viewer';
  const canDeleteSuite = user?.role === 'owner' || user?.role === 'admin';

  // Recording timer effect
  useEffect(() => {
    if (!isRecording || !recordingStartTime) return;
    const timer = setInterval(() => {
      setRecordingElapsed(Math.floor((Date.now() - recordingStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecording, recordingStartTime]);

  // Helper to format seconds as mm:ss
  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Helper to get action type icon
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'navigate': return '🌐';
      case 'click': return '👆';
      case 'fill': case 'type': case 'input': return '⌨️';
      case 'screenshot': return '📸';
      case 'assert_text': return '✅';
      case 'assert_url': return '🔗';
      case 'wait': return '⏱️';
      case 'hover': return '🖱️';
      case 'select': return '📋';
      case 'scroll': return '📜';
      case 'keypress': return '⌨️';
      default: return '🔹';
    }
  };

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
          setTests(prev => prev.map(t => updatedTestMap.has(t.id) ? (updatedTestMap.get(t.id) as TestType) : t));
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

  // Feature #50: computeCodeDiff, calculateTestConfidence, validateTestName moved to utils.ts

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

  // Start recording session - Feature #26: Playwright + Socket.IO streaming
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
    setRecordingStartTime(Date.now());
    setRecordingElapsed(0);
    setRecordingFrame(null);

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
          // Feature #36: Pass device config for mobile recording
          device_config: recordingDeviceEnabled ? recordingDeviceConfig : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start recording');
      }

      const data = await response.json();
      setRecordingSessionId(data.session_id);
      setRecordingStatus('Recording... Click on the browser view to interact');
      setRecordingCurrentUrl(recordTargetUrl);

      // Add initial navigate step
      setRecordedSteps([{ action: 'navigate', url: recordTargetUrl }]);

      // Connect Socket.IO for live streaming - connect directly to backend
      // In dev, Vite proxy handles /api but not WebSocket, so use backend port directly
      const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `http://${window.location.hostname}:3001`
        : window.location.origin;
      // Feature #33: Enable auto-reconnection with progressive delay
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
      recordingSocketRef.current = socket;

      // Reset reconnection state
      setReconnectAttempt(0);
      setReconnectFailed(false);
      setStaleFrameWarning('none');

      socket.on('connect', () => {
        console.log('[Recording] Socket connected:', socket.id);
        setRecordingConnected(true);
        setReconnectAttempt(0);
        setReconnectFailed(false);
        setStaleFrameWarning('none');
        socket.emit('recording:join', { sessionId: data.session_id });
      });

      socket.on('disconnect', (reason: string) => {
        console.log('[Recording] Socket disconnected:', reason);
        setRecordingConnected(false);
      });

      // Feature #33: Reconnection event handlers
      socket.io.on('reconnect_attempt' as any, (attempt: number) => {
        console.log(`[Recording] Reconnection attempt ${attempt}/10`);
        setReconnectAttempt(attempt);
      });

      socket.io.on('reconnect' as any, () => {
        console.log('[Recording] Socket reconnected, rejoining room');
        setRecordingConnected(true);
        setReconnectAttempt(0);
        setReconnectFailed(false);
        // Re-join the recording room after reconnection
        socket.emit('recording:join', { sessionId: data.session_id });
      });

      socket.io.on('reconnect_failed' as any, () => {
        console.log('[Recording] All reconnection attempts failed');
        setReconnectFailed(true);
        setReconnectAttempt(0);
      });

      // Feature #33: Wrap error handler to prevent React crashes
      socket.on('connect_error', (err: Error) => {
        console.warn('[Recording] Socket connection error (handled):', err.message);
        // Don't throw - just log. React ErrorBoundary won't be triggered.
      });

      socket.on('error', (err: any) => {
        console.warn('[Recording] Socket error (handled):', err);
      });

      // Receive live screenshot frames with smooth rendering
      let calibrated = false;
      socket.on('recording:frame', (frameData: { base64: string; width: number; height: number }) => {
        lastFrameTimeRef.current = Date.now();
        setStaleFrameWarning('none'); // Reset stale warning on new frame
        // Feature #34: Calibration check on first frame
        if (!calibrated && frameData.width && frameData.height) {
          frameScaleRef.current = { scaleX: frameData.width, scaleY: frameData.height };
          if (frameData.width !== 1280 || frameData.height !== 720) {
            console.warn(`[Recording] Frame dimensions ${frameData.width}x${frameData.height} differ from expected 1280x720 - adjusting scale`);
          }
          calibrated = true;
        }
        // Use requestAnimationFrame for smooth rendering
        pendingFrameRef.current = `data:image/jpeg;base64,${frameData.base64}`;
        if (!frameRequestRef.current) {
          frameRequestRef.current = requestAnimationFrame(() => {
            if (pendingFrameRef.current) {
              setRecordingFrame(pendingFrameRef.current);
              pendingFrameRef.current = null;
            }
            frameRequestRef.current = null;
          });
        }
      });

      // Feature #33: Stale frame detection interval
      if (staleFrameTimerRef.current) clearInterval(staleFrameTimerRef.current);
      staleFrameTimerRef.current = setInterval(() => {
        if (!lastFrameTimeRef.current || !recordingSocketRef.current?.connected) return;
        const elapsed = Date.now() - lastFrameTimeRef.current;
        if (elapsed > 10000) {
          setStaleFrameWarning('unresponsive');
        } else if (elapsed > 3000) {
          setStaleFrameWarning('waiting');
        }
      }, 1000);

      // Receive URL updates for URL bar sync
      socket.on('recording:url', (urlData: { url: string }) => {
        setRecordingCurrentUrl(urlData.url);
      });

      // Receive recorded actions
      socket.on('recording:action', (action: any) => {
        setRecordedSteps(prev => [...prev, action]);
      });

      // Handle recording stopped
      socket.on('recording:stopped', () => {
        setIsRecording(false);
        setRecordingStatus('');
      });

      toast.success('Recording started! Click on the browser view to interact.');
    } catch (err) {
      setIsRecording(false);
      setRecordingStatus('');
      toast.error(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  // Feature #34: Compute viewport coordinates from a mouse event on the browser viewer
  const computeViewportCoords = (clientX: number, clientY: number) => {
    const img = browserImgRef.current;
    const container = browserViewRef.current;
    if (!container) return null;
    // Always prefer the img element for precise mapping
    const targetRect = img ? img.getBoundingClientRect() : container.getBoundingClientRect();
    let imgWidth = targetRect.width;
    let imgHeight = targetRect.height;
    let imgLeft = targetRect.left;
    let imgTop = targetRect.top;
    if (!img) {
      const borderW = parseFloat(getComputedStyle(container).borderLeftWidth) || 0;
      const borderH = parseFloat(getComputedStyle(container).borderTopWidth) || 0;
      imgWidth -= borderW * 2;
      imgHeight -= borderH * 2;
      imgLeft += borderW;
      imgTop += borderH;
    }
    // Position relative to image
    const relX = clientX - imgLeft;
    const relY = clientY - imgTop;
    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(relX, imgWidth));
    const clampedY = Math.max(0, Math.min(relY, imgHeight));
    // Scale to actual viewport dimensions (calibrated from frame data)
    const vpW = frameScaleRef.current.scaleX;
    const vpH = frameScaleRef.current.scaleY;
    const x = Math.round(clampedX * (vpW / imgWidth));
    const y = Math.round(clampedY * (vpH / imgHeight));
    return { relX, relY, imgWidth, imgHeight, x, y };
  };

  // Handle click on the live browser view
  const handleBrowserViewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!recordingSessionId || !recordingSocketRef.current || !browserViewRef.current) return;
    const coords = computeViewportCoords(e.clientX, e.clientY);
    if (!coords) return;
    const { relX, imgWidth, imgHeight, x, y } = coords;
    console.log(`[Recording] Click: css(${Math.round(relX)},${Math.round(coords.relY)}) -> viewport(${x},${y}) img(${Math.round(imgWidth)}x${Math.round(imgHeight)}) scale(${frameScaleRef.current.scaleX}x${frameScaleRef.current.scaleY})`);
    recordingSocketRef.current.emit('recording:click', { sessionId: recordingSessionId, x, y });
    // Show click ripple effect at click position relative to container
    const containerRect = browserViewRef.current.getBoundingClientRect();
    const cssX = e.clientX - containerRect.left;
    const cssY = e.clientY - containerRect.top;
    setClickRipple({ x: cssX, y: cssY, id: Date.now() });
    setTimeout(() => setClickRipple(null), 600);
  };

  // Feature #34: Handle mouse move for debug overlay coordinate display
  const handleBrowserViewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showDebugOverlay || !browserViewRef.current) return;
    const coords = computeViewportCoords(e.clientX, e.clientY);
    if (!coords) return;
    const containerRect = browserViewRef.current.getBoundingClientRect();
    setDebugCoords({
      cssX: e.clientX - containerRect.left,
      cssY: e.clientY - containerRect.top,
      vpX: coords.x,
      vpY: coords.y,
    });
  };

  const handleBrowserViewMouseLeave = () => {
    setDebugCoords(null);
  };

  // Handle URL bar navigation
  const handleUrlBarNavigate = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !recordingSessionId || !recordingSocketRef.current) return;
    let url = recordingCurrentUrl.trim();
    if (url && !url.startsWith('http')) url = 'https://' + url;
    if (url) {
      recordingSocketRef.current.emit('recording:navigate', { sessionId: recordingSessionId, url });
    }
  };

  // Handle keyboard input on the live browser view
  const handleBrowserViewKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!recordingSessionId || !recordingSocketRef.current) return;
    e.preventDefault();
    const key = e.key;
    if (key.length === 1) {
      // Regular character
      recordingSocketRef.current.emit('recording:type', { sessionId: recordingSessionId, text: key });
    } else {
      // Special key (Enter, Tab, Backspace, etc.)
      recordingSocketRef.current.emit('recording:keypress', { sessionId: recordingSessionId, key });
    }
  };

  // Handle scroll on the live browser view
  const handleBrowserViewWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!recordingSessionId || !recordingSocketRef.current) return;
    recordingSocketRef.current.emit('recording:scroll', { sessionId: recordingSessionId, deltaX: e.deltaX, deltaY: e.deltaY });
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
        // Merge backend actions with any manual steps (assert, wait, hover, etc.)
        // that were added via the frontend UI but not recorded in the backend
        setRecordedSteps(prev => {
          const backendActions = data.actions as typeof prev;
          // Find manual steps that aren't in the backend (they have no timestamp or were added locally)
          const manualStepTypes = ['assert_text', 'assert_url', 'wait', 'screenshot', 'hover'];
          const manualSteps = prev.filter(s => manualStepTypes.includes(s.action));
          // Combine: backend actions first, then manual steps inserted at their original positions
          // Simple approach: append manual steps after backend actions
          return [...backendActions, ...manualSteps];
        });
      }

      setIsRecording(false);
      setRecordingStatus('');
      setRecordingDuration(recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0);
      setRecordingStartTime(null);
      setShowRecordModal(false);
      setShowReviewModal(true);
      setRecordedTestName(`Recorded Test ${new Date().toLocaleString()}`);

      // Cleanup Socket.IO connection
      if (recordingSocketRef.current) {
        recordingSocketRef.current.emit('recording:leave', { sessionId: recordingSessionId });
        recordingSocketRef.current.disconnect();
        recordingSocketRef.current = null;
      }
      setRecordingFrame(null);
      // Feature #33: Clean up stale frame timer and reconnection state
      if (staleFrameTimerRef.current) {
        clearInterval(staleFrameTimerRef.current);
        staleFrameTimerRef.current = null;
      }
      setStaleFrameWarning('none');
      setReconnectAttempt(0);
      setReconnectFailed(false);
      // Close the proxy browser tab (legacy)
      if (recordingPopup && !recordingPopup.closed) {
        recordingPopup.close();
      }
      setRecordingPopup(null);

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
      // Convert recorded steps to test step format (including selector strategies for healing)
      const steps = recordedSteps.map(step => {
        const base: any = {};
        // Include selectorStrategies if available (for test healing fallback)
        if (step.selectorStrategies && step.selectorStrategies.length > 0) {
          base.selectorStrategies = step.selectorStrategies;
        }
        // Feature #37: Include optional flag for cookie consent/popup handling
        if (step.optional) {
          base.optional = true;
          base.optionalReason = step.optionalReason || 'user_marked';
        }
        switch (step.action) {
          case 'navigate':
            return { ...base, action: 'navigate', value: step.url };
          case 'click':
            return { ...base, action: 'click', selector: step.selector };
          case 'fill':
          case 'type':
            return { ...base, action: step.action, selector: step.selector, value: step.value };
          case 'assert_text':
            return { ...base, action: 'assert_text', value: step.text };
          default:
            return { ...base, action: step.action, selector: step.selector, value: step.value };
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

  // Feature #31: Save recorded steps as a reusable template
  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (recordedSteps.length === 0) {
      toast.error('No steps to save as template');
      return;
    }
    setIsSavingTemplate(true);
    try {
      const steps = recordedSteps.map((step, i) => ({
        action: step.action,
        selector: step.selector,
        value: step.value || step.url || step.text,
        order: i,
      }));
      const response = await fetch('/api/v1/step-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: templateName.trim(),
          description: `Template from recorded steps`,
          steps,
          suite_id: suiteId,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save template');
      }
      toast.success(`Template "${templateName}" saved!`);
      setTemplateName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Feature #31: Load templates list
  const loadStepTemplates = async () => {
    try {
      const response = await fetch(`/api/v1/step-templates?suite_id=${suiteId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStepTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  // Feature #31: Insert template steps into an existing test
  const handleInsertTemplate = async (testId: string, template: { steps: any[] }) => {
    try {
      const response = await fetch(`/api/v1/tests/${testId}/append-steps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ steps: template.steps }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to insert template');
      }
      toast.success('Template steps inserted into test');
      setShowTemplateModal(false);
      setInsertTemplateForTest(null);
      // Refresh tests
      const refreshResponse = await fetch(`/api/v1/suites/${suiteId}/tests`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setTests(data.tests);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to insert template');
    }
  };

  // Feature #31: Delete a step template
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/v1/step-templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        setStepTemplates(prev => prev.filter(t => t.id !== templateId));
        toast.success('Template deleted');
      }
    } catch (err) {
      toast.error('Failed to delete template');
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
    // Cleanup Socket.IO connection
    if (recordingSocketRef.current) {
      if (recordingSessionId) {
        recordingSocketRef.current.emit('recording:leave', { sessionId: recordingSessionId });
      }
      recordingSocketRef.current.disconnect();
      recordingSocketRef.current = null;
    }
    // Close the proxy browser tab (legacy)
    if (recordingPopup && !recordingPopup.closed) {
      recordingPopup.close();
    }
    setRecordingPopup(null);
    setRecordingFrame(null);
    // Feature #33: Clean up stale frame timer and reconnection state
    if (staleFrameTimerRef.current) {
      clearInterval(staleFrameTimerRef.current);
      staleFrameTimerRef.current = null;
    }
    setStaleFrameWarning('none');
    setReconnectAttempt(0);
    setReconnectFailed(false);
    setIsRecording(false);
    setRecordingSessionId(null);
    setRecordedSteps([]);
    setRecordingStatus('');
    setShowRecordModal(false);
  };

  // Feature #33: Retry connection after all reconnection attempts failed
  const handleRetryConnection = () => {
    if (!recordingSocketRef.current || !recordingSessionId) return;
    setReconnectFailed(false);
    setReconnectAttempt(0);
    // Force reconnection by disconnecting and reconnecting
    recordingSocketRef.current.connect();
  };

  // Feature #33: Stop & Save on connection loss - save whatever we have
  const handleStopAndSave = async () => {
    if (!recordingSessionId) return;
    try {
      await fetch(`/api/v1/recording/${recordingSessionId}/stop`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => {});
    } catch { /* best effort */ }

    // Clean up socket
    if (recordingSocketRef.current) {
      recordingSocketRef.current.disconnect();
      recordingSocketRef.current = null;
    }
    if (staleFrameTimerRef.current) {
      clearInterval(staleFrameTimerRef.current);
      staleFrameTimerRef.current = null;
    }

    setIsRecording(false);
    setRecordingStatus('');
    setRecordingDuration(recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0);
    setRecordingStartTime(null);
    setShowRecordModal(false);
    setShowReviewModal(true);
    setRecordedTestName(`Recorded Test ${new Date().toLocaleString()}`);
    setRecordingFrame(null);
    setStaleFrameWarning('none');
    setReconnectAttempt(0);
    setReconnectFailed(false);
    toast.success('Recording saved with steps captured so far.');
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

  // Feature #35: Live screenshot streaming - connect to Socket.IO when run is active
  useEffect(() => {
    if (!suiteRunPolling || !suiteRun?.id) {
      // Clear screenshots when no run is active
      setLiveScreenshot(null);
      setScreenshotHistory([]);
      return;
    }

    // Connect to Socket.IO for live screenshot updates
    // Use backend URL (port 3001) for Socket.IO, not frontend port
    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
      : window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : window.location.origin;

    const screenshotSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
    });

    screenshotSocket.on('connect', () => {
      console.log('[LiveScreenshot] Connected, joining run room:', suiteRun.id);
      screenshotSocket.emit('join-run', suiteRun.id);
    });

    // Listen for step screenshots
    screenshotSocket.on('step:screenshot', (data: {
      runId: string;
      testId: string;
      testName: string;
      stepIndex: number;
      stepAction: string;
      stepSelector?: string;
      stepValue?: string;
      base64: string;
      width: number;
      height: number;
      timestamp: number;
    }) => {
      console.log(`[LiveScreenshot] Received screenshot for step ${data.stepIndex + 1}: ${data.stepAction}`);

      // Update current live screenshot
      setLiveScreenshot({
        base64: data.base64,
        testId: data.testId,
        testName: data.testName,
        stepIndex: data.stepIndex,
        stepAction: data.stepAction,
        stepSelector: data.stepSelector,
        timestamp: data.timestamp,
      });

      // Add to history (keep last 3)
      setScreenshotHistory(prev => {
        const newHistory = [
          ...prev,
          {
            base64: data.base64,
            stepIndex: data.stepIndex,
            stepAction: data.stepAction,
            timestamp: data.timestamp,
          }
        ].slice(-3); // Keep only last 3
        return newHistory;
      });
    });

    screenshotSocket.on('disconnect', () => {
      console.log('[LiveScreenshot] Disconnected');
    });

    screenshotSocket.on('connect_error', (err: Error) => {
      console.warn('[LiveScreenshot] Connection error:', err.message);
    });

    return () => {
      console.log('[LiveScreenshot] Cleaning up socket connection');
      screenshotSocket.emit('leave-run', suiteRun.id);
      screenshotSocket.disconnect();
    };
  }, [suiteRunPolling, suiteRun?.id]);

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
          {/* Feature #50: Extracted to SuiteHeaderActions component */}
          <SuiteHeaderActions
            suiteId={suiteId!}
            testsCount={tests.length}
            isRunningSuite={isRunningSuite}
            isAnalyzingParallel={isAnalyzingParallel}
            canCreateTest={canCreateTest}
            canDeleteSuite={canDeleteSuite}
            onRunWithParallelization={handleRunWithParallelization}
            onRunSuite={handleRunSuite}
            onExportTests={handleExportTests}
            onShowImportModal={() => setShowImportModal(true)}
            onShowRecordModal={() => setShowRecordModal(true)}
            onShowCreateTestModal={() => setShowNewCreateTestModal(true)}
            onShowDeleteSuiteModal={() => setShowDeleteSuiteModal(true)}
          />
        </div>

        {/* Feature #1151: Human Review Panel - Feature #50: Extracted to component */}
        <HumanReviewPanel
          tests={tests}
          requireHumanReview={requireHumanReview}
          showReviewPanel={showReviewPanel}
          reviewStats={reviewStats}
          selectedForReview={selectedForReview}
          isApproving={isApproving}
          onToggleHumanReview={handleToggleHumanReview}
          onToggleReviewPanel={() => setShowReviewPanel(!showReviewPanel)}
          onToggleTestSelection={toggleTestSelection}
          onToggleAllTestsSelection={toggleAllTestsSelection}
          onReviewTest={handleReviewTest}
          onBatchReview={handleBatchReview}
        />

        {/* Feature #1257: AI Parallelization Panel - Feature #50: Extracted to component */}
        {showParallelization && (
          <ParallelizationPanel
            isAnalyzing={isAnalyzingParallel}
            plan={parallelizationPlan}
            isRunningSuite={isRunningSuite}
            onClose={() => setShowParallelization(false)}
            onRunSuite={handleRunSuite}
          />
        )}

        {/* Delete Suite Confirmation Modal - Feature #50: Extracted to component */}
        {showDeleteSuiteModal && (
          <DeleteSuiteModal
            suiteName={suite?.name || ''}
            isDeleting={isDeletingSuite}
            onConfirm={handleDeleteSuite}
            onCancel={() => setShowDeleteSuiteModal(false)}
          />
        )}

        {/* Feature #1961: Delete Test Confirmation Modal - Feature #50: Extracted to component */}
        {showDeleteTestModal && (
          <DeleteTestModal
            isDeleting={isDeletingTest}
            onConfirm={() => handleDeleteTest(showDeleteTestModal)}
            onCancel={() => setShowDeleteTestModal(null)}
          />
        )}

        {/* Import Tests Modal - Feature #50: Extracted to component */}
        {showImportModal && (
          <ImportTestsModal
            importError={importError}
            isImporting={isImporting}
            onImport={handleImportTests}
            onClose={() => {
              setShowImportModal(false);
              setImportError('');
            }}
          />
        )}

        {/* Suite Run Results - Feature #50: Extracted to SuiteRunResults component */}
        <SuiteRunResults
          suiteRun={suiteRun}
          suite={suite}
          tests={tests}
          isCancellingSuite={isCancellingSuite}
          liveScreenshot={liveScreenshot}
          screenshotHistory={screenshotHistory}
          onCancelSuiteRun={handleCancelSuiteRun}
          onExpandScreenshot={(base64) => setExpandedScreenshot(base64)}
          onEditSelector={(state) => setEditSelectorModal(state)}
          onNavigate={navigate}
        />

        {/* Tests List - Feature #50: Extracted to TestListSection component */}
        <TestListSection
          tests={tests}
          filteredTests={filteredTests}
          sortedTests={sortedTests}
          searchQuery={searchQuery}
          sortField={sortField}
          sortDirection={sortDirection}
          suiteRun={suiteRun}
          openActionsDropdown={openActionsDropdown}
          runningTestId={runningTestId}
          canCreateTest={canCreateTest}
          onSearchChange={setSearchQuery}
          onSort={handleSort}
          onOpenCreateTestModal={() => setShowNewCreateTestModal(true)}
          onSetActionsDropdown={setOpenActionsDropdown}
          onRunSingleTest={handleRunSingleTest}
          onDuplicateTest={handleDuplicateTest}
          onShowTemplateModal={(testId) => {
            setInsertTemplateForTest(testId);
            setShowTemplateModal(true);
          }}
          onShowDeleteTestModal={setShowDeleteTestModal}
          loadStepTemplates={loadStepTemplates}
        />

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

        {/* Feature #1342: Generated Test Code Preview Modal - Extracted to component */}
        <GeneratedTestPreviewModal
          isOpen={showGeneratedCodeModal}
          onClose={() => setShowGeneratedCodeModal(false)}
          preview={generatedTestPreview!}
          generatedCode={generatedTestCode}
          previousCode={previousGeneratedCode}
          showDiffView={showDiffView}
          regenerationFeedback={regenerationFeedback}
          isRegenerating={isRegenerating}
          aiTestDescription={aiTestDescription}
          newTestTargetUrl={newTestTargetUrl}
          suiteId={suiteId || ''}
          token={token || ''}
          onSetGeneratedCode={setGeneratedTestCode}
          onSetPreview={setGeneratedTestPreview}
          onSetPreviousCode={setPreviousGeneratedCode}
          onSetShowDiffView={setShowDiffView}
          onSetRegenerationFeedback={setRegenerationFeedback}
          onSetIsRegenerating={setIsRegenerating}
          onUseTest={(testName, confidenceScore) => {
            if (testName) {
              setNewTestName(testName);
            }
            if (aiTestDescription) {
              setNewTestDescription(aiTestDescription);
            }
            setIsTestFromAI(true);
            if (confidenceScore !== undefined) {
              setAiConfidenceScore(confidenceScore);
            }
            setShowGeneratedCodeModal(false);
            setShowAITestGenerator(false);
            setGeneratedTestCode('');
            setGeneratedTestPreview(null);
            setAITestDescription('');
            setPreviousGeneratedCode(null);
            setShowDiffView(false);
            setRegenerationFeedback('');
          }}
        />

        {/* Record New Test Modal - Feature #26, #50: Extracted to RecordTestModal component */}
        <RecordTestModal
          isOpen={showRecordModal}
          isRecording={isRecording}
          onClose={() => setShowRecordModal(false)}
          recordTargetUrl={recordTargetUrl}
          onRecordTargetUrlChange={setRecordTargetUrl}
          recordedSteps={recordedSteps}
          onRecordedStepsChange={setRecordedSteps}
          recordingDeviceEnabled={recordingDeviceEnabled}
          onRecordingDeviceEnabledChange={setRecordingDeviceEnabled}
          recordingDeviceConfig={recordingDeviceConfig}
          onRecordingDeviceConfigChange={setRecordingDeviceConfig}
          recordingSessionId={recordingSessionId}
          onRecordingSessionIdChange={setRecordingSessionId}
          recordingElapsed={recordingElapsed}
          recordingFrame={recordingFrame}
          onRecordingFrameChange={setRecordingFrame}
          recordingConnected={recordingConnected}
          onRecordingConnectedChange={setRecordingConnected}
          recordingCurrentUrl={recordingCurrentUrl}
          onRecordingCurrentUrlChange={setRecordingCurrentUrl}
          reconnectAttempt={reconnectAttempt}
          onReconnectAttemptChange={setReconnectAttempt}
          reconnectFailed={reconnectFailed}
          onReconnectFailedChange={setReconnectFailed}
          staleFrameWarning={staleFrameWarning}
          onStaleFrameWarningChange={setStaleFrameWarning}
          showDebugOverlay={showDebugOverlay}
          onShowDebugOverlayChange={setShowDebugOverlay}
          clickRipple={clickRipple}
          onClickRippleChange={setClickRipple}
          recordingSocketRef={recordingSocketRef}
          browserViewRef={browserViewRef}
          browserImgRef={browserImgRef}
          frameScaleRef={frameScaleRef}
          lastFrameTimeRef={lastFrameTimeRef}
          staleFrameTimerRef={staleFrameTimerRef}
          frameRequestRef={frameRequestRef}
          pendingFrameRef={pendingFrameRef}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onCancelRecording={handleCancelRecording}
          onRetryConnection={handleRetryConnection}
          onStopAndSave={handleStopAndSave}
          projectBaseUrl={project?.base_url}
          token={token || ''}
          formatElapsed={formatElapsed}
          getActionIcon={getActionIcon}
        />

        {/* Review Recorded Test Modal - Feature #31, #37, #50: Extracted to component */}
        <ReviewRecordedTestModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          recordedSteps={recordedSteps}
          onRecordedStepsChange={setRecordedSteps}
          recordingDuration={recordingDuration}
          recordedTestName={recordedTestName}
          onRecordedTestNameChange={setRecordedTestName}
          recordedTestDescription={recordedTestDescription}
          onRecordedTestDescriptionChange={setRecordedTestDescription}
          isSavingRecordedTest={isSavingRecordedTest}
          onSaveRecordedTest={handleSaveRecordedTest}
          templateName={templateName}
          onTemplateNameChange={setTemplateName}
          isSavingTemplate={isSavingTemplate}
          onSaveAsTemplate={handleSaveAsTemplate}
          formatElapsed={formatElapsed}
          getActionIcon={getActionIcon}
        />

        {/* Feature #31: Insert Template Modal - Feature #50: Extracted to component */}
        {/* Feature #31: Insert Template Modal - Feature #50: Extracted to component */}
        <InsertTemplateModal
          isOpen={showTemplateModal}
          testId={insertTemplateForTest}
          templates={stepTemplates}
          onClose={() => {
            setShowTemplateModal(false);
            setInsertTemplateForTest(null);
          }}
          onInsertTemplate={handleInsertTemplate}
          onDeleteTemplate={handleDeleteTemplate}
        />

        {/* Feature #1065: Edit Selector Modal - Feature #50: Extracted to component */}
        <EditSelectorModal
          modalState={editSelectorModal}
          selectorValue={editSelectorValue}
          selectorNotes={editSelectorNotes}
          applyToTest={editSelectorApplyToTest}
          isSubmitting={isSubmittingSelector}
          onSelectorValueChange={setEditSelectorValue}
          onNotesChange={setEditSelectorNotes}
          onApplyToTestChange={setEditSelectorApplyToTest}
          onClose={() => {
            setEditSelectorModal({
              isOpen: false, runId: '', testId: '', stepId: '', currentSelector: '', originalSelector: '', wasHealed: false,
            });
            setEditSelectorValue('');
            setEditSelectorNotes('');
          }}
          onUpdateSelector={handleUpdateSelector}
          onAcceptHealed={handleAcceptHealed}
        />

        {/* Feature #35: Expanded Screenshot Modal - Feature #50: Extracted to component */}
        <ExpandedScreenshotModal
          screenshotBase64={expandedScreenshot}
          onClose={() => setExpandedScreenshot(null)}
        />
      </div>
    </Layout>
  );
}

export { TestSuitePage };
