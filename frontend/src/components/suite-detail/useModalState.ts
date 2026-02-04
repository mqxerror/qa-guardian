/**
 * useModalState Hook
 * Feature #50: Extract modal state management from TestSuitePage.tsx
 *
 * This hook manages all modal-related state for the test suite page.
 */

import { useState } from 'react';
import { EditSelectorModalState, IgnoreRegion, AnnotationType, Annotation } from './types';

// Screenshot analysis types
export interface ScreenshotElement {
  id: string;
  type: string;
  description: string;
  suggested_selector: string;
  suggested_action: string;
  confidence: number;
  location: { x: number; y: number; width: number; height: number };
  attributes?: { label?: string; placeholder?: string; role?: string };
}

export interface ScreenshotTestStep {
  step_number: number;
  action: string;
  element_id: string;
  description: string;
  playwright_code: string;
  assertion?: string;
}

export interface ScreenshotAnalysis {
  elements: ScreenshotElement[];
  suggested_test_steps: ScreenshotTestStep[];
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
}

// Generated test preview type
export interface GeneratedTestPreview {
  test_name: string;
  steps: string[];
  selectors: string[];
  assertions: string[];
  syntax_valid: boolean;
  syntax_errors?: string[];
  complexity: 'simple' | 'medium' | 'complex';
  warnings?: string[];
  confidence_score?: number;
  confidence_factors?: {
    factor: string;
    score: number;
    max_score: number;
    description: string;
  }[];
}

// Generated test suite type
export interface GeneratedTestSuiteTest {
  code: string;
  test_name: string;
  description: string;
  steps: string[];
  selectors: string[];
  assertions: string[];
  syntax_valid: boolean;
  complexity: string;
}

export interface GeneratedTestSuite {
  suite_name: string;
  user_story: string;
  tests: GeneratedTestSuiteTest[];
  edge_case_tests: GeneratedTestSuiteTest[];
  total_tests: number;
  estimated_total_duration_ms: number;
}

// Converted Gherkin test type
export interface ConvertedGherkinTest {
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
}

// OpenAPI endpoint type
export interface ParsedOpenApiEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  selected: boolean;
  parameters?: Array<{ name: string; in: string; required: boolean; type: string }>;
  requestBody?: { contentType: string; schema: string };
  responses?: Array<{ status: string; description: string }>;
}

// Generated API test type
export interface GeneratedApiTest {
  endpoint: string;
  method: string;
  test_name: string;
  code: string;
  test_type: 'valid' | 'invalid' | 'edge_case';
  description: string;
}

/**
 * Hook that provides modal-related state management
 */
export function useModalState() {
  // Delete modals
  const [showDeleteSuiteModal, setShowDeleteSuiteModal] = useState(false);
  const [isDeletingSuite, setIsDeletingSuite] = useState(false);
  const [showDeleteTestModal, setShowDeleteTestModal] = useState<string | null>(null);
  const [isDeletingTest, setIsDeletingTest] = useState(false);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Create test modal state
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [showNewCreateTestModal, setShowNewCreateTestModal] = useState(false);

  // New test form state
  const [newTestName, setNewTestName] = useState('');
  const [newTestDescription, setNewTestDescription] = useState('');
  const [newTestType, setNewTestType] = useState<'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility'>('e2e');
  const [newTestDevicePreset, setNewTestDevicePreset] = useState<'mobile' | 'desktop'>('desktop');
  const [newTestTargetUrl, setNewTestTargetUrl] = useState('');
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [createTestError, setCreateTestError] = useState('');
  const [testNameError, setTestNameError] = useState('');

  // Lighthouse test settings
  const [newTestPerformanceThreshold, setNewTestPerformanceThreshold] = useState(50);
  const [newTestLcpThreshold, setNewTestLcpThreshold] = useState(2500);
  const [newTestClsThreshold, setNewTestClsThreshold] = useState(0.1);
  const [newTestBypassCsp, setNewTestBypassCsp] = useState(false);
  const [newTestIgnoreSslErrors, setNewTestIgnoreSslErrors] = useState(false);
  const [newTestAuditTimeout, setNewTestAuditTimeout] = useState(60);

  // Accessibility test settings
  const [newTestWcagLevel, setNewTestWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA');
  const [newTestIncludeBestPractices, setNewTestIncludeBestPractices] = useState(true);
  const [newTestIncludeExperimental, setNewTestIncludeExperimental] = useState(false);
  const [newTestIncludePa11y, setNewTestIncludePa11y] = useState(false);
  const [newTestA11yFailOnCritical, setNewTestA11yFailOnCritical] = useState<number | undefined>(0);
  const [newTestA11yFailOnSerious, setNewTestA11yFailOnSerious] = useState<number | undefined>(undefined);
  const [newTestA11yFailOnModerate, setNewTestA11yFailOnModerate] = useState<number | undefined>(undefined);
  const [newTestA11yFailOnMinor, setNewTestA11yFailOnMinor] = useState<number | undefined>(undefined);
  const [newTestA11yFailOnAny, setNewTestA11yFailOnAny] = useState(false);

  // K6 load test settings
  const [newTestVirtualUsers, setNewTestVirtualUsers] = useState(10);
  const [newTestDuration, setNewTestDuration] = useState(60);
  const [newTestRampUpTime, setNewTestRampUpTime] = useState(10);
  const [newTestK6Script, setNewTestK6Script] = useState('');
  const [showK6Editor, setShowK6Editor] = useState(false);

  // Visual regression test settings
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
  const [newTestDiffThreshold, setNewTestDiffThreshold] = useState(0);
  const [newTestDiffThresholdMode, setNewTestDiffThresholdMode] = useState<'percentage' | 'pixel_count'>('percentage');
  const [newTestDiffPixelThreshold, setNewTestDiffPixelThreshold] = useState(0);
  const [newTestAntiAliasingTolerance, setNewTestAntiAliasingTolerance] = useState<'off' | 'low' | 'medium' | 'high'>('off');
  const [newTestColorThreshold, setNewTestColorThreshold] = useState<number | undefined>(undefined);
  const [newTestIgnoreRegions, setNewTestIgnoreRegions] = useState<IgnoreRegion[]>([]);
  const [newTestIgnoreSelectors, setNewTestIgnoreSelectors] = useState<string[]>([]);

  // URL validation state
  const [urlValidationState, setUrlValidationState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [urlFavicon, setUrlFavicon] = useState<string | null>(null);

  // Natural language input
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [isParsingNaturalLanguage, setIsParsingNaturalLanguage] = useState(false);

  // Advanced settings
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(() => {
    try {
      return localStorage.getItem('create-test-advanced-expanded') === 'true';
    } catch {
      return false;
    }
  });

  // AI Copilot state
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

  // AI test generation state
  const [showAITestGenerator, setShowAITestGenerator] = useState(false);
  const [isTestFromAI, setIsTestFromAI] = useState(false);
  const [aiConfidenceScore, setAiConfidenceScore] = useState<number | undefined>(undefined);
  const [aiTestDescription, setAITestDescription] = useState('');
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [generatedTestCode, setGeneratedTestCode] = useState('');
  const [generatedTestPreview, setGeneratedTestPreview] = useState<GeneratedTestPreview | null>(null);
  const [showGeneratedCodeModal, setShowGeneratedCodeModal] = useState(false);
  const [aiGenerationError, setAIGenerationError] = useState('');
  const [aiGenMode, setAIGenMode] = useState<'text' | 'screenshot' | 'user-story' | 'gherkin' | 'wizard' | 'openapi'>('text');

  // AI Wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardTestDescription, setWizardTestDescription] = useState('');
  const [wizardTargetUrl, setWizardTargetUrl] = useState('');
  const [wizardGeneratedCode, setWizardGeneratedCode] = useState('');
  const [wizardCustomizedCode, setWizardCustomizedCode] = useState('');
  const [wizardTestName, setWizardTestName] = useState('');
  const [isWizardGenerating, setIsWizardGenerating] = useState(false);
  const [wizardError, setWizardError] = useState('');

  // User story to test suite state
  const [userStoryInput, setUserStoryInput] = useState('');
  const [isGeneratingTestSuite, setIsGeneratingTestSuite] = useState(false);
  const [generatedTestSuite, setGeneratedTestSuite] = useState<GeneratedTestSuite | null>(null);
  const [showTestSuitePreview, setShowTestSuitePreview] = useState(false);
  const [selectedTestFromSuite, setSelectedTestFromSuite] = useState<number | null>(null);
  const [includeEdgeCases, setIncludeEdgeCases] = useState(true);

  // Gherkin conversion state
  const [gherkinInput, setGherkinInput] = useState('');
  const [isConvertingGherkin, setIsConvertingGherkin] = useState(false);
  const [convertedGherkinTest, setConvertedGherkinTest] = useState<ConvertedGherkinTest | null>(null);

  // OpenAPI/Swagger state
  const [openApiSpecInput, setOpenApiSpecInput] = useState('');
  const [parsedOpenApiEndpoints, setParsedOpenApiEndpoints] = useState<ParsedOpenApiEndpoint[]>([]);
  const [isParsingOpenApi, setIsParsingOpenApi] = useState(false);
  const [openApiParseError, setOpenApiParseError] = useState('');
  const [isGeneratingApiTests, setIsGeneratingApiTests] = useState(false);
  const [generatedApiTests, setGeneratedApiTests] = useState<GeneratedApiTest[] | null>(null);

  // Screenshot analysis state
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotContext, setScreenshotContext] = useState('');
  const [isAnalyzingScreenshot, setIsAnalyzingScreenshot] = useState(false);
  const [screenshotAnalysis, setScreenshotAnalysis] = useState<ScreenshotAnalysis | null>(null);

  // Screenshot annotation state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotationTool, setCurrentAnnotationTool] = useState<AnnotationType | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [pendingAnnotation, setPendingAnnotation] = useState<Partial<Annotation> | null>(null);
  const [annotationLabelInput, setAnnotationLabelInput] = useState('');

  // Code diff state
  const [regenerationFeedback, setRegenerationFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [previousGeneratedCode, setPreviousGeneratedCode] = useState<string | null>(null);
  const [showDiffView, setShowDiffView] = useState(false);

  // Edit selector modal state
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

  // Reset create test form
  const resetCreateTestForm = () => {
    setNewTestName('');
    setNewTestDescription('');
    setNewTestType('e2e');
    setNewTestDevicePreset('desktop');
    setNewTestTargetUrl('');
    setCreateTestError('');
    setTestNameError('');
    setNewTestPerformanceThreshold(50);
    setNewTestLcpThreshold(2500);
    setNewTestClsThreshold(0.1);
    setNewTestBypassCsp(false);
    setNewTestIgnoreSslErrors(false);
    setNewTestAuditTimeout(60);
    setNewTestWcagLevel('AA');
    setNewTestIncludeBestPractices(true);
    setNewTestIncludeExperimental(false);
    setNewTestIncludePa11y(false);
    setNewTestA11yFailOnCritical(0);
    setNewTestA11yFailOnSerious(undefined);
    setNewTestA11yFailOnModerate(undefined);
    setNewTestA11yFailOnMinor(undefined);
    setNewTestA11yFailOnAny(false);
    setNewTestVirtualUsers(10);
    setNewTestDuration(60);
    setNewTestRampUpTime(10);
    setNewTestK6Script('');
    setShowK6Editor(false);
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
    setNewTestAntiAliasingTolerance('off');
    setNewTestColorThreshold(undefined);
    setNewTestIgnoreRegions([]);
    setNewTestIgnoreSelectors([]);
    setUrlValidationState('idle');
    setUrlFavicon(null);
    setNaturalLanguageInput('');
    setIsParsingNaturalLanguage(false);
    setAICopilotSuggestions([]);
    setIsTestFromAI(false);
    setAiConfidenceScore(undefined);
  };

  return {
    // Delete modals
    showDeleteSuiteModal, setShowDeleteSuiteModal,
    isDeletingSuite, setIsDeletingSuite,
    showDeleteTestModal, setShowDeleteTestModal,
    isDeletingTest, setIsDeletingTest,

    // Import modal
    showImportModal, setShowImportModal,
    importError, setImportError,
    isImporting, setIsImporting,

    // Create test modal
    showCreateTestModal, setShowCreateTestModal,
    showNewCreateTestModal, setShowNewCreateTestModal,

    // New test form
    newTestName, setNewTestName,
    newTestDescription, setNewTestDescription,
    newTestType, setNewTestType,
    newTestDevicePreset, setNewTestDevicePreset,
    newTestTargetUrl, setNewTestTargetUrl,
    isCreatingTest, setIsCreatingTest,
    createTestError, setCreateTestError,
    testNameError, setTestNameError,

    // Lighthouse settings
    newTestPerformanceThreshold, setNewTestPerformanceThreshold,
    newTestLcpThreshold, setNewTestLcpThreshold,
    newTestClsThreshold, setNewTestClsThreshold,
    newTestBypassCsp, setNewTestBypassCsp,
    newTestIgnoreSslErrors, setNewTestIgnoreSslErrors,
    newTestAuditTimeout, setNewTestAuditTimeout,

    // Accessibility settings
    newTestWcagLevel, setNewTestWcagLevel,
    newTestIncludeBestPractices, setNewTestIncludeBestPractices,
    newTestIncludeExperimental, setNewTestIncludeExperimental,
    newTestIncludePa11y, setNewTestIncludePa11y,
    newTestA11yFailOnCritical, setNewTestA11yFailOnCritical,
    newTestA11yFailOnSerious, setNewTestA11yFailOnSerious,
    newTestA11yFailOnModerate, setNewTestA11yFailOnModerate,
    newTestA11yFailOnMinor, setNewTestA11yFailOnMinor,
    newTestA11yFailOnAny, setNewTestA11yFailOnAny,

    // K6 settings
    newTestVirtualUsers, setNewTestVirtualUsers,
    newTestDuration, setNewTestDuration,
    newTestRampUpTime, setNewTestRampUpTime,
    newTestK6Script, setNewTestK6Script,
    showK6Editor, setShowK6Editor,

    // Visual regression settings
    newTestViewportPreset, setNewTestViewportPreset,
    newTestViewportWidth, setNewTestViewportWidth,
    newTestViewportHeight, setNewTestViewportHeight,
    newTestCaptureMode, setNewTestCaptureMode,
    newTestElementSelector, setNewTestElementSelector,
    newTestWaitForSelector, setNewTestWaitForSelector,
    newTestWaitTime, setNewTestWaitTime,
    newTestHideSelectors, setNewTestHideSelectors,
    newTestRemoveSelectors, setNewTestRemoveSelectors,
    newTestMultiViewport, setNewTestMultiViewport,
    newTestSelectedViewports, setNewTestSelectedViewports,
    newTestDiffThreshold, setNewTestDiffThreshold,
    newTestDiffThresholdMode, setNewTestDiffThresholdMode,
    newTestDiffPixelThreshold, setNewTestDiffPixelThreshold,
    newTestAntiAliasingTolerance, setNewTestAntiAliasingTolerance,
    newTestColorThreshold, setNewTestColorThreshold,
    newTestIgnoreRegions, setNewTestIgnoreRegions,
    newTestIgnoreSelectors, setNewTestIgnoreSelectors,

    // URL validation
    urlValidationState, setUrlValidationState,
    urlFavicon, setUrlFavicon,

    // Natural language
    naturalLanguageInput, setNaturalLanguageInput,
    isParsingNaturalLanguage, setIsParsingNaturalLanguage,

    // Advanced settings
    showAdvancedSettings, setShowAdvancedSettings,

    // AI Copilot
    showAICopilot, setShowAICopilot,
    aiCopilotSuggestions, setAICopilotSuggestions,
    isAICopilotAnalyzing, setIsAICopilotAnalyzing,

    // AI test generation
    showAITestGenerator, setShowAITestGenerator,
    isTestFromAI, setIsTestFromAI,
    aiConfidenceScore, setAiConfidenceScore,
    aiTestDescription, setAITestDescription,
    isGeneratingTest, setIsGeneratingTest,
    generatedTestCode, setGeneratedTestCode,
    generatedTestPreview, setGeneratedTestPreview,
    showGeneratedCodeModal, setShowGeneratedCodeModal,
    aiGenerationError, setAIGenerationError,
    aiGenMode, setAIGenMode,

    // AI Wizard
    wizardStep, setWizardStep,
    wizardTestDescription, setWizardTestDescription,
    wizardTargetUrl, setWizardTargetUrl,
    wizardGeneratedCode, setWizardGeneratedCode,
    wizardCustomizedCode, setWizardCustomizedCode,
    wizardTestName, setWizardTestName,
    isWizardGenerating, setIsWizardGenerating,
    wizardError, setWizardError,

    // User story
    userStoryInput, setUserStoryInput,
    isGeneratingTestSuite, setIsGeneratingTestSuite,
    generatedTestSuite, setGeneratedTestSuite,
    showTestSuitePreview, setShowTestSuitePreview,
    selectedTestFromSuite, setSelectedTestFromSuite,
    includeEdgeCases, setIncludeEdgeCases,

    // Gherkin
    gherkinInput, setGherkinInput,
    isConvertingGherkin, setIsConvertingGherkin,
    convertedGherkinTest, setConvertedGherkinTest,

    // OpenAPI
    openApiSpecInput, setOpenApiSpecInput,
    parsedOpenApiEndpoints, setParsedOpenApiEndpoints,
    isParsingOpenApi, setIsParsingOpenApi,
    openApiParseError, setOpenApiParseError,
    isGeneratingApiTests, setIsGeneratingApiTests,
    generatedApiTests, setGeneratedApiTests,

    // Screenshot analysis
    screenshotFile, setScreenshotFile,
    screenshotPreview, setScreenshotPreview,
    screenshotContext, setScreenshotContext,
    isAnalyzingScreenshot, setIsAnalyzingScreenshot,
    screenshotAnalysis, setScreenshotAnalysis,

    // Annotations
    annotations, setAnnotations,
    currentAnnotationTool, setCurrentAnnotationTool,
    isDrawing, setIsDrawing,
    drawStart, setDrawStart,
    pendingAnnotation, setPendingAnnotation,
    annotationLabelInput, setAnnotationLabelInput,

    // Code diff
    regenerationFeedback, setRegenerationFeedback,
    isRegenerating, setIsRegenerating,
    previousGeneratedCode, setPreviousGeneratedCode,
    showDiffView, setShowDiffView,

    // Edit selector modal
    editSelectorModal, setEditSelectorModal,
    editSelectorValue, setEditSelectorValue,
    editSelectorNotes, setEditSelectorNotes,
    editSelectorApplyToTest, setEditSelectorApplyToTest,
    isSubmittingSelector, setIsSubmittingSelector,

    // Reset form
    resetCreateTestForm,
  };
}

export type ModalState = ReturnType<typeof useModalState>;
