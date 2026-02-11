/**
 * useAIGenerationState Hook
 * Feature #50: Extract AI generation state management from TestSuitePage.tsx
 *
 * This hook manages all state related to AI-powered test generation,
 * including text-to-test, screenshot analysis, user stories, Gherkin conversion, etc.
 */

import { useState, useCallback, useRef } from 'react';
// Import shared types from useModalState (canonical definitions)
import {
  GeneratedTestPreview,
  ScreenshotElement,
  ScreenshotTestStep,
  ScreenshotAnalysis,
} from './useModalState';

// Re-export for backward compatibility
export type { GeneratedTestPreview, ScreenshotElement, ScreenshotTestStep, ScreenshotAnalysis };

// AI generation mode types
export type AIGenMode = 'text' | 'screenshot' | 'user-story' | 'gherkin' | 'wizard' | 'openapi';

// AI wizard step type (numeric for 3-step AI generation wizard)
// Note: create-test/types.ts has a string-based WizardStep for different flow
export type AIWizardStep = 1 | 2 | 3;

// Annotation types for screenshot
export type AnnotationType = 'click' | 'type' | 'expect';

// Annotation interface
export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  expectation?: string;
}

// AI Copilot suggestion interface
export interface AICopilotSuggestion {
  id: string;
  type: 'selector' | 'assertion' | 'name' | 'description' | 'best_practice';
  message: string;
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
  field?: string;
}

// Generated test suite interface
export interface GeneratedTestFromSuite {
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
  tests: GeneratedTestFromSuite[];
  edge_case_tests: GeneratedTestFromSuite[];
  total_tests: number;
  estimated_total_duration_ms: number;
}

// Gherkin converted test interface
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

// OpenAPI endpoint interface
export interface OpenApiEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  selected: boolean;
  parameters?: Array<{ name: string; in: string; required: boolean; type: string }>;
  requestBody?: { contentType: string; schema: string };
  responses?: Array<{ status: string; description: string }>;
}

// Generated API test interface
export interface GeneratedApiTest {
  endpoint: string;
  method: string;
  test_name: string;
  code: string;
  test_type: 'valid' | 'invalid' | 'edge_case';
  description: string;
}

export interface UseAIGenerationStateReturn {
  // AI Copilot state
  showAICopilot: boolean;
  setShowAICopilot: (show: boolean) => void;
  aiCopilotSuggestions: AICopilotSuggestion[];
  setAICopilotSuggestions: (suggestions: AICopilotSuggestion[]) => void;
  isAICopilotAnalyzing: boolean;
  setIsAICopilotAnalyzing: (analyzing: boolean) => void;

  // AI Test Generator state
  showAITestGenerator: boolean;
  setShowAITestGenerator: (show: boolean) => void;
  isTestFromAI: boolean;
  setIsTestFromAI: (fromAI: boolean) => void;
  aiConfidenceScore: number | undefined;
  setAiConfidenceScore: (score: number | undefined) => void;
  aiTestDescription: string;
  setAITestDescription: (desc: string) => void;
  isGeneratingTest: boolean;
  setIsGeneratingTest: (generating: boolean) => void;
  generatedTestCode: string;
  setGeneratedTestCode: (code: string) => void;
  generatedTestPreview: GeneratedTestPreview | null;
  setGeneratedTestPreview: (preview: GeneratedTestPreview | null) => void;
  showGeneratedCodeModal: boolean;
  setShowGeneratedCodeModal: (show: boolean) => void;
  aiGenerationError: string;
  setAIGenerationError: (error: string) => void;

  // AI generation mode
  aiGenMode: AIGenMode;
  setAIGenMode: (mode: AIGenMode) => void;

  // Wizard state
  wizardStep: AIWizardStep;
  setWizardStep: (step: AIWizardStep) => void;
  wizardTestDescription: string;
  setWizardTestDescription: (desc: string) => void;
  wizardTargetUrl: string;
  setWizardTargetUrl: (url: string) => void;
  wizardGeneratedCode: string;
  setWizardGeneratedCode: (code: string) => void;
  wizardCustomizedCode: string;
  setWizardCustomizedCode: (code: string) => void;
  wizardTestName: string;
  setWizardTestName: (name: string) => void;
  isWizardGenerating: boolean;
  setIsWizardGenerating: (generating: boolean) => void;
  wizardError: string;
  setWizardError: (error: string) => void;

  // User story state
  userStoryInput: string;
  setUserStoryInput: (input: string) => void;
  isGeneratingTestSuite: boolean;
  setIsGeneratingTestSuite: (generating: boolean) => void;
  generatedTestSuite: GeneratedTestSuite | null;
  setGeneratedTestSuite: (suite: GeneratedTestSuite | null) => void;
  showTestSuitePreview: boolean;
  setShowTestSuitePreview: (show: boolean) => void;
  selectedTestFromSuite: number | null;
  setSelectedTestFromSuite: (index: number | null) => void;
  includeEdgeCases: boolean;
  setIncludeEdgeCases: (include: boolean) => void;

  // Gherkin conversion state
  gherkinInput: string;
  setGherkinInput: (input: string) => void;
  isConvertingGherkin: boolean;
  setIsConvertingGherkin: (converting: boolean) => void;
  convertedGherkinTest: ConvertedGherkinTest | null;
  setConvertedGherkinTest: (test: ConvertedGherkinTest | null) => void;

  // OpenAPI state
  openApiSpecInput: string;
  setOpenApiSpecInput: (input: string) => void;
  parsedOpenApiEndpoints: OpenApiEndpoint[];
  setParsedOpenApiEndpoints: (endpoints: OpenApiEndpoint[]) => void;
  isParsingOpenApi: boolean;
  setIsParsingOpenApi: (parsing: boolean) => void;
  openApiParseError: string;
  setOpenApiParseError: (error: string) => void;
  isGeneratingApiTests: boolean;
  setIsGeneratingApiTests: (generating: boolean) => void;
  generatedApiTests: GeneratedApiTest[] | null;
  setGeneratedApiTests: (tests: GeneratedApiTest[] | null) => void;

  // Human review state
  requireHumanReview: boolean;
  setRequireHumanReview: (require: boolean) => void;
  pendingReviewTests: GeneratedTestPreview[];
  setPendingReviewTests: (tests: GeneratedTestPreview[]) => void;

  // Screenshot analysis state
  screenshotFile: File | null;
  setScreenshotFile: (file: File | null) => void;
  screenshotPreview: string | null;
  setScreenshotPreview: (preview: string | null) => void;
  screenshotContext: string;
  setScreenshotContext: (context: string) => void;
  isAnalyzingScreenshot: boolean;
  setIsAnalyzingScreenshot: (analyzing: boolean) => void;
  screenshotAnalysis: ScreenshotAnalysis | null;
  setScreenshotAnalysis: (analysis: ScreenshotAnalysis | null) => void;
  screenshotInputRef: React.RefObject<HTMLInputElement>;

  // Code diff state
  regenerationFeedback: string;
  setRegenerationFeedback: (feedback: string) => void;
  isRegenerating: boolean;
  setIsRegenerating: (regenerating: boolean) => void;
  previousGeneratedCode: string | null;
  setPreviousGeneratedCode: (code: string | null) => void;
  showDiffView: boolean;
  setShowDiffView: (show: boolean) => void;

  // Screenshot annotation state
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  currentAnnotationTool: AnnotationType | null;
  setCurrentAnnotationTool: (tool: AnnotationType | null) => void;
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;
  drawStart: { x: number; y: number } | null;
  setDrawStart: (start: { x: number; y: number } | null) => void;
  pendingAnnotation: Partial<Annotation> | null;
  setPendingAnnotation: (annotation: Partial<Annotation> | null) => void;
  annotationLabelInput: string;
  setAnnotationLabelInput: (label: string) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  imageRef: React.RefObject<HTMLImageElement>;

  // Reset function
  resetAIGenerationState: () => void;
}

/**
 * Hook that provides AI generation state management
 */
export function useAIGenerationState(): UseAIGenerationStateReturn {
  // AI Copilot state
  const [showAICopilot, setShowAICopilot] = useState(true);
  const [aiCopilotSuggestions, setAICopilotSuggestions] = useState<AICopilotSuggestion[]>([]);
  const [isAICopilotAnalyzing, setIsAICopilotAnalyzing] = useState(false);

  // AI Test Generator state
  const [showAITestGenerator, setShowAITestGenerator] = useState(false);
  const [isTestFromAI, setIsTestFromAI] = useState(false);
  const [aiConfidenceScore, setAiConfidenceScore] = useState<number | undefined>(undefined);
  const [aiTestDescription, setAITestDescription] = useState('');
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [generatedTestCode, setGeneratedTestCode] = useState('');
  const [generatedTestPreview, setGeneratedTestPreview] = useState<GeneratedTestPreview | null>(null);
  const [showGeneratedCodeModal, setShowGeneratedCodeModal] = useState(false);
  const [aiGenerationError, setAIGenerationError] = useState('');

  // AI generation mode
  const [aiGenMode, setAIGenMode] = useState<AIGenMode>('text');

  // Wizard state
  const [wizardStep, setWizardStep] = useState<AIWizardStep>(1);
  const [wizardTestDescription, setWizardTestDescription] = useState('');
  const [wizardTargetUrl, setWizardTargetUrl] = useState('');
  const [wizardGeneratedCode, setWizardGeneratedCode] = useState('');
  const [wizardCustomizedCode, setWizardCustomizedCode] = useState('');
  const [wizardTestName, setWizardTestName] = useState('');
  const [isWizardGenerating, setIsWizardGenerating] = useState(false);
  const [wizardError, setWizardError] = useState('');

  // User story state
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

  // OpenAPI state
  const [openApiSpecInput, setOpenApiSpecInput] = useState('');
  const [parsedOpenApiEndpoints, setParsedOpenApiEndpoints] = useState<OpenApiEndpoint[]>([]);
  const [isParsingOpenApi, setIsParsingOpenApi] = useState(false);
  const [openApiParseError, setOpenApiParseError] = useState('');
  const [isGeneratingApiTests, setIsGeneratingApiTests] = useState(false);
  const [generatedApiTests, setGeneratedApiTests] = useState<GeneratedApiTest[] | null>(null);

  // Human review state
  const [requireHumanReview, setRequireHumanReview] = useState(false);
  const [pendingReviewTests, setPendingReviewTests] = useState<GeneratedTestPreview[]>([]);

  // Screenshot analysis state
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotContext, setScreenshotContext] = useState('');
  const [isAnalyzingScreenshot, setIsAnalyzingScreenshot] = useState(false);
  const [screenshotAnalysis, setScreenshotAnalysis] = useState<ScreenshotAnalysis | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  // Code diff state
  const [regenerationFeedback, setRegenerationFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [previousGeneratedCode, setPreviousGeneratedCode] = useState<string | null>(null);
  const [showDiffView, setShowDiffView] = useState(false);

  // Screenshot annotation state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotationTool, setCurrentAnnotationTool] = useState<AnnotationType | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [pendingAnnotation, setPendingAnnotation] = useState<Partial<Annotation> | null>(null);
  const [annotationLabelInput, setAnnotationLabelInput] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset function
  const resetAIGenerationState = useCallback(() => {
    setShowAICopilot(true);
    setAICopilotSuggestions([]);
    setIsAICopilotAnalyzing(false);
    setShowAITestGenerator(false);
    setIsTestFromAI(false);
    setAiConfidenceScore(undefined);
    setAITestDescription('');
    setIsGeneratingTest(false);
    setGeneratedTestCode('');
    setGeneratedTestPreview(null);
    setShowGeneratedCodeModal(false);
    setAIGenerationError('');
    setAIGenMode('text');
    setWizardStep(1);
    setWizardTestDescription('');
    setWizardTargetUrl('');
    setWizardGeneratedCode('');
    setWizardCustomizedCode('');
    setWizardTestName('');
    setIsWizardGenerating(false);
    setWizardError('');
    setUserStoryInput('');
    setIsGeneratingTestSuite(false);
    setGeneratedTestSuite(null);
    setShowTestSuitePreview(false);
    setSelectedTestFromSuite(null);
    setIncludeEdgeCases(true);
    setGherkinInput('');
    setIsConvertingGherkin(false);
    setConvertedGherkinTest(null);
    setOpenApiSpecInput('');
    setParsedOpenApiEndpoints([]);
    setIsParsingOpenApi(false);
    setOpenApiParseError('');
    setIsGeneratingApiTests(false);
    setGeneratedApiTests(null);
    setRequireHumanReview(false);
    setPendingReviewTests([]);
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setScreenshotContext('');
    setIsAnalyzingScreenshot(false);
    setScreenshotAnalysis(null);
    setRegenerationFeedback('');
    setIsRegenerating(false);
    setPreviousGeneratedCode(null);
    setShowDiffView(false);
    setAnnotations([]);
    setCurrentAnnotationTool(null);
    setIsDrawing(false);
    setDrawStart(null);
    setPendingAnnotation(null);
    setAnnotationLabelInput('');
  }, []);

  return {
    // AI Copilot state
    showAICopilot,
    setShowAICopilot,
    aiCopilotSuggestions,
    setAICopilotSuggestions,
    isAICopilotAnalyzing,
    setIsAICopilotAnalyzing,

    // AI Test Generator state
    showAITestGenerator,
    setShowAITestGenerator,
    isTestFromAI,
    setIsTestFromAI,
    aiConfidenceScore,
    setAiConfidenceScore,
    aiTestDescription,
    setAITestDescription,
    isGeneratingTest,
    setIsGeneratingTest,
    generatedTestCode,
    setGeneratedTestCode,
    generatedTestPreview,
    setGeneratedTestPreview,
    showGeneratedCodeModal,
    setShowGeneratedCodeModal,
    aiGenerationError,
    setAIGenerationError,

    // AI generation mode
    aiGenMode,
    setAIGenMode,

    // Wizard state
    wizardStep,
    setWizardStep,
    wizardTestDescription,
    setWizardTestDescription,
    wizardTargetUrl,
    setWizardTargetUrl,
    wizardGeneratedCode,
    setWizardGeneratedCode,
    wizardCustomizedCode,
    setWizardCustomizedCode,
    wizardTestName,
    setWizardTestName,
    isWizardGenerating,
    setIsWizardGenerating,
    wizardError,
    setWizardError,

    // User story state
    userStoryInput,
    setUserStoryInput,
    isGeneratingTestSuite,
    setIsGeneratingTestSuite,
    generatedTestSuite,
    setGeneratedTestSuite,
    showTestSuitePreview,
    setShowTestSuitePreview,
    selectedTestFromSuite,
    setSelectedTestFromSuite,
    includeEdgeCases,
    setIncludeEdgeCases,

    // Gherkin conversion state
    gherkinInput,
    setGherkinInput,
    isConvertingGherkin,
    setIsConvertingGherkin,
    convertedGherkinTest,
    setConvertedGherkinTest,

    // OpenAPI state
    openApiSpecInput,
    setOpenApiSpecInput,
    parsedOpenApiEndpoints,
    setParsedOpenApiEndpoints,
    isParsingOpenApi,
    setIsParsingOpenApi,
    openApiParseError,
    setOpenApiParseError,
    isGeneratingApiTests,
    setIsGeneratingApiTests,
    generatedApiTests,
    setGeneratedApiTests,

    // Human review state
    requireHumanReview,
    setRequireHumanReview,
    pendingReviewTests,
    setPendingReviewTests,

    // Screenshot analysis state
    screenshotFile,
    setScreenshotFile,
    screenshotPreview,
    setScreenshotPreview,
    screenshotContext,
    setScreenshotContext,
    isAnalyzingScreenshot,
    setIsAnalyzingScreenshot,
    screenshotAnalysis,
    setScreenshotAnalysis,
    screenshotInputRef,

    // Code diff state
    regenerationFeedback,
    setRegenerationFeedback,
    isRegenerating,
    setIsRegenerating,
    previousGeneratedCode,
    setPreviousGeneratedCode,
    showDiffView,
    setShowDiffView,

    // Screenshot annotation state
    annotations,
    setAnnotations,
    currentAnnotationTool,
    setCurrentAnnotationTool,
    isDrawing,
    setIsDrawing,
    drawStart,
    setDrawStart,
    pendingAnnotation,
    setPendingAnnotation,
    annotationLabelInput,
    setAnnotationLabelInput,
    canvasRef,
    imageRef,

    // Reset function
    resetAIGenerationState,
  };
}
