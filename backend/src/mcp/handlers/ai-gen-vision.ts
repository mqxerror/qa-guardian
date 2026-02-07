/**
 * AI Generation Handlers - Vision Module
 *
 * This module contains vision-based AI generation handlers for analyzing
 * screenshots and generating tests from annotated images.
 *
 * Handlers in this module:
 * - analyzeScreenshot: Analyze UI screenshots to identify testable elements
 * - generateTestFromAnnotatedScreenshot: Generate tests from annotated screenshots
 *
 * @module ai-gen-vision
 */

import type { ToolHandler, HandlerModule } from './types.js';
import { aiRouter } from '../../services/providers/ai-router.js';
import { modelSelector } from '../../services/providers/model-selector.js';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Interface for identified elements from vision analysis
 */
interface IdentifiedElement {
  type: string;
  label: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selectors: {
    getByRole?: string;
    getByLabel?: string;
    getByText?: string;
    getByTestId?: string;
    css?: string;
  };
  interactive: boolean;
  confidence: number;
  suggested_action: string;
  notes?: string;
}

/**
 * Interface for annotation markers on screenshots
 */
interface AnnotationMarker {
  /** Marker number or ID (e.g., "1", "2", "3" or "A", "B", "C") */
  marker_id: string;
  /** Type of action: click, fill, select, verify, hover */
  action: 'click' | 'fill' | 'select' | 'verify' | 'hover' | 'scroll' | 'wait' | 'navigate';
  /** Optional value for fill/select actions */
  value?: string;
  /** Optional description of what this step does */
  description?: string;
}

/**
 * Interface for parsed annotation steps from vision analysis
 */
interface ParsedAnnotationStep {
  step_number: number;
  marker_id: string;
  action: string;
  element_type: string;
  element_label: string;
  selector: string;
  value?: string;
  playwright_code: string;
  comment: string;
  confidence: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate Playwright code snippets for identified elements
 */
function generatePlaywrightSnippets(elements: IdentifiedElement[]): Record<string, string> {
  const snippets: Record<string, string> = {};

  elements.forEach((element, index) => {
    const key = `${element.type}_${index}_${element.label.replace(/\s+/g, '_').toLowerCase().substring(0, 20)}`;
    const selectors = element.selectors;

    // Choose the best available selector
    const preferredSelector =
      selectors.getByRole ||
      selectors.getByLabel ||
      selectors.getByText ||
      selectors.getByTestId ||
      selectors.css;

    if (!preferredSelector) return;

    let snippet = '';
    switch (element.suggested_action) {
      case 'click':
        snippet = `await page.${preferredSelector}.click();`;
        break;
      case 'fill':
        snippet = `await page.${preferredSelector}.fill('your-value-here');`;
        break;
      case 'select':
        snippet = `await page.${preferredSelector}.selectOption('option-value');`;
        break;
      case 'check':
        snippet = `await page.${preferredSelector}.check();`;
        break;
      case 'hover':
        snippet = `await page.${preferredSelector}.hover();`;
        break;
      default:
        snippet = `// Element: ${element.label}\nawait expect(page.${preferredSelector}).toBeVisible();`;
    }

    snippets[key] = snippet;
  });

  return snippets;
}

/**
 * Generate complete Playwright test code from parsed annotation steps
 */
function generateAnnotatedTestCode(params: {
  testName: string;
  targetUrl?: string;
  steps: ParsedAnnotationStep[];
  assertions?: { step_after: number; playwright_code: string; comment: string }[];
  includeComments: boolean;
  includeAssertions: boolean;
  language: string;
}): string {
  const { testName, targetUrl, steps, assertions = [], includeComments, includeAssertions, language } = params;

  const imports = language === 'typescript'
    ? `import { test, expect } from '@playwright/test';`
    : `const { test, expect } = require('@playwright/test');`;

  const header = includeComments
    ? `/**
 * Test: ${testName}
 * Generated from annotated screenshot by QA Guardian AI
 * Steps: ${steps.length}
 */
`
    : '';

  // Build step code with interspersed assertions
  const stepLines: string[] = [];

  // Add navigation if URL provided
  if (targetUrl) {
    if (includeComments) stepLines.push(`  // Navigate to the page`);
    stepLines.push(`  await page.goto('${targetUrl}');`);
    stepLines.push('');
  }

  steps.forEach((step, index) => {
    // Add comment
    if (includeComments) {
      stepLines.push(`  // Step ${step.step_number}: ${step.comment}`);
    }

    // Add the playwright code
    stepLines.push(`  ${step.playwright_code}`);

    // Add any assertions that should come after this step
    if (includeAssertions) {
      const stepAssertions = assertions.filter(a => a.step_after === step.step_number);
      stepAssertions.forEach(assertion => {
        if (includeComments) {
          stepLines.push(`  // ${assertion.comment}`);
        }
        stepLines.push(`  ${assertion.playwright_code}`);
      });
    }

    // Add blank line between steps
    if (index < steps.length - 1) {
      stepLines.push('');
    }
  });

  return `${imports}

${header}test('${testName}', async ({ page }) => {
${stepLines.join('\n')}
});
`;
}

/**
 * Generate a fallback test when vision is unavailable
 */
function generateFallbackAnnotatedTest(testName: string, targetUrl?: string, language?: string): string {
  const imports = language === 'typescript'
    ? `import { test, expect } from '@playwright/test';`
    : `const { test, expect } = require('@playwright/test');`;

  return `${imports}

/**
 * Test: ${testName}
 * Note: This is a placeholder test generated without vision analysis.
 * Re-run with a valid Anthropic API key for full screenshot analysis.
 */
test('${testName}', async ({ page }) => {
  // Navigate to the page
  // Feature #1718: Use placeholder instead of hardcoded example.com
  await page.goto('${targetUrl || 'YOUR_TARGET_URL_HERE'}');

  // TODO: Add test steps based on annotated screenshot
  // Vision analysis was unavailable when this test was generated

  // Example step - replace with actual test actions
  await expect(page).toHaveTitle(/./);
});
`;
}

// ============================================================================
// Handler: analyzeScreenshot
// ============================================================================

/**
 * Analyze UI screenshots to identify testable elements using Claude Vision
 * Feature #1488: Screenshot → Element Detection + Selector Suggestions
 *
 * Uses vision capabilities to identify UI elements in screenshots
 * and suggests appropriate Playwright selectors for testing.
 */
const analyzeScreenshot: ToolHandler = async (args, context) => {
  try {
    // Get the base64 image data
    const imageBase64 = args.image_base64 as string;
    if (!imageBase64) {
      return {
        success: false,
        error: 'Missing required parameter: image_base64 (base64 encoded screenshot)',
      };
    }

    // Get optional parameters
    const mediaType = (args.media_type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif') || 'image/png';
    const targetUrl = args.target_url as string | undefined;
    const focusArea = (args.focus_area as string) || 'all'; // all, forms, navigation, interactive
    const includePositions = args.include_positions !== false; // Default true
    const maxElements = (args.max_elements as number) || 50;
    const generateCode = args.generate_code === true; // Generate Playwright code snippets

    context.log(`[AI Vision] Analyzing screenshot (focus: ${focusArea}, max: ${maxElements})`);

    const startTime = Date.now();

    // Get model configuration for vision/analysis
    const modelConfig = modelSelector.getModelForFeature('analysis');

    // Check if vision is available
    if (!aiRouter.isVisionAvailable()) {
      // Fall back to template response if no AI available
      return {
        success: true,
        elements: [],
        element_count: 0,
        page_type: 'unknown',
        page_description: 'Vision analysis unavailable - no Anthropic API key configured',
        suggested_test_flow: [],
        ai_metadata: {
          provider: 'none',
          model: 'none',
          model_tier: 'none',
          vision_used: false,
          analysis_time_ms: Date.now() - startTime,
        },
        data_source: 'unavailable',
        analyzed_at: new Date().toISOString(),
      };
    }

    // Build the vision prompt
    const systemPrompt = `You are an expert UI/UX analyst and QA engineer. Analyze the screenshot to identify testable UI elements.

For each element you identify, provide:
1. Element type (button, link, input, checkbox, select, etc.)
2. Label or text content visible
3. Approximate position (x%, y% from top-left, width%, height%)
4. Suggested Playwright selectors (getByRole, getByLabel, getByText, getByTestId)
5. Whether it's interactive
6. Suggested test action

Focus area: ${focusArea === 'all' ? 'Identify all interactive and important elements' :
             focusArea === 'forms' ? 'Focus on form fields, inputs, and submit buttons' :
             focusArea === 'navigation' ? 'Focus on navigation menus, links, and buttons' :
             'Focus on clickable and interactive elements'}

Return your analysis as valid JSON in this exact format:
{
  "page_type": "login|dashboard|form|list|detail|search|checkout|landing|settings|other",
  "page_description": "Brief description of what this page does",
  "elements": [
    {
      "type": "button|link|input|checkbox|radio|select|textarea|image|text|form|menu|other",
      "label": "Visible text or accessible label",
      "position": { "x": 50, "y": 30, "width": 20, "height": 5 },
      "selectors": {
        "getByRole": "getByRole('button', { name: 'Submit' })",
        "getByLabel": "getByLabel('Email')",
        "getByText": "getByText('Sign In')",
        "getByTestId": "getByTestId('login-btn')"
      },
      "interactive": true,
      "confidence": 0.95,
      "suggested_action": "click|fill|select|check|hover|none",
      "notes": "Primary CTA button"
    }
  ],
  "suggested_test_flow": [
    "Step description for a logical test sequence"
  ],
  "accessibility_issues": ["Any potential a11y issues noticed"],
  "overall_confidence": 0.85
}

Important:
- Position values are percentages (0-100)
- Provide multiple selector options ranked by stability (role > label > text > testId > css)
- Maximum ${maxElements} elements
- Be precise about element types and positions`;

    const userPrompt = `Analyze this screenshot and identify all testable UI elements.
${targetUrl ? `Target URL context: ${targetUrl}` : ''}

Provide the analysis as JSON.`;

    // Build the multimodal message with image
    const messages = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text' as const,
            text: userPrompt,
          },
        ],
      },
    ];

    // Send to Claude Vision via the router
    const response = await aiRouter.sendVisionMessage(messages, {
      model: modelConfig.model,
      maxTokens: modelConfig.maxTokens || 4096,
      temperature: modelConfig.temperature || 0.1,
      systemPrompt,
    });

    // Parse the AI response
    let analysisResult: {
      page_type: string;
      page_description: string;
      elements: IdentifiedElement[];
      suggested_test_flow: string[];
      accessibility_issues?: string[];
      overall_confidence: number;
    };

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      context.log(`[AI Vision] Failed to parse AI response: ${parseError}`);
      return {
        success: false,
        error: 'Failed to parse vision analysis response',
        raw_response: response.content.substring(0, 500),
      };
    }

    // Optionally generate Playwright code snippets for each element
    let codeSnippets: Record<string, string> = {};
    if (generateCode && analysisResult.elements.length > 0) {
      codeSnippets = generatePlaywrightSnippets(analysisResult.elements);
    }

    const analysisTimeMs = Date.now() - startTime;

    return {
      success: true,
      page_type: analysisResult.page_type,
      page_description: analysisResult.page_description,
      elements: analysisResult.elements,
      element_count: analysisResult.elements.length,
      interactive_count: analysisResult.elements.filter(e => e.interactive).length,
      suggested_test_flow: analysisResult.suggested_test_flow,
      accessibility_issues: analysisResult.accessibility_issues || [],
      overall_confidence: analysisResult.overall_confidence,
      code_snippets: generateCode ? codeSnippets : undefined,
      element_summary: {
        buttons: analysisResult.elements.filter(e => e.type === 'button').length,
        links: analysisResult.elements.filter(e => e.type === 'link').length,
        inputs: analysisResult.elements.filter(e => e.type === 'input' || e.type === 'textarea').length,
        forms: analysisResult.elements.filter(e => e.type === 'form').length,
        other: analysisResult.elements.filter(e => !['button', 'link', 'input', 'textarea', 'form'].includes(e.type)).length,
      },
      ai_metadata: {
        provider: response.actualProvider,
        model: response.model,
        model_tier: modelConfig.tier,
        vision_used: true,
        tokens_used: {
          input: response.inputTokens,
          output: response.outputTokens,
        },
        analysis_time_ms: analysisTimeMs,
      },
      data_source: 'real',
      analyzed_at: new Date().toISOString(),
    };

  } catch (error) {
    return {
      success: false,
      error: `Vision analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Handler: generateTestFromAnnotatedScreenshot
// ============================================================================

/**
 * Generate test code from annotated screenshots using Claude Vision
 * Feature #1489: Generate test code from annotated screenshots
 *
 * Users can draw numbered markers (1, 2, 3...) on screenshots to indicate
 * the test flow. This handler interprets those annotations and generates
 * ordered Playwright test code.
 */
const generateTestFromAnnotatedScreenshot: ToolHandler = async (args, context) => {
  try {
    // Get the annotated screenshot
    const imageBase64 = args.image_base64 as string;
    if (!imageBase64) {
      return {
        success: false,
        error: 'Missing required parameter: image_base64 (base64 encoded annotated screenshot)',
      };
    }

    // Get annotation markers (optional - Claude will detect from screenshot)
    const annotationLegend = args.annotations as AnnotationMarker[] | undefined;

    // Get other parameters
    const mediaType = (args.media_type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif') || 'image/png';
    const targetUrl = args.target_url as string | undefined;
    const testName = (args.test_name as string) || 'Annotated Screenshot Test';
    const includeComments = args.include_comments !== false;
    const includeAssertions = args.include_assertions !== false;
    const language = (args.language as string) || 'typescript';

    context.log(`[AI Vision] Generating test from annotated screenshot: ${testName}`);

    const startTime = Date.now();

    // Get model configuration for vision/analysis
    const modelConfig = modelSelector.getModelForFeature('analysis');

    // Check if vision is available
    if (!aiRouter.isVisionAvailable()) {
      return {
        success: true,
        test_name: testName,
        test_code: generateFallbackAnnotatedTest(testName, targetUrl, language),
        steps: [],
        step_count: 0,
        ai_metadata: {
          provider: 'none',
          model: 'none',
          model_tier: 'none',
          vision_used: false,
          generation_time_ms: Date.now() - startTime,
        },
        data_source: 'unavailable',
        message: 'Vision analysis unavailable - generated placeholder test',
        generated_at: new Date().toISOString(),
      };
    }

    // Build the annotation legend for the prompt
    let legendDescription = '';
    if (annotationLegend && annotationLegend.length > 0) {
      legendDescription = `\n\nAnnotation Legend provided by user:\n${annotationLegend.map(a =>
        `- Marker "${a.marker_id}": ${a.action}${a.value ? ` with value "${a.value}"` : ''}${a.description ? ` - ${a.description}` : ''}`
      ).join('\n')}`;
    }

    // Build the vision prompt for annotated screenshots
    const systemPrompt = `You are an expert QA engineer analyzing an annotated screenshot to generate Playwright test code.

The screenshot has numbered/labeled markers (like 1, 2, 3 or A, B, C or arrows/circles) indicating a test flow sequence.

Your job is to:
1. Identify all annotation markers in the screenshot
2. Determine what element each marker points to
3. Infer the intended action for each marker (click, fill, verify, etc.)
4. Generate the corresponding Playwright code in the correct sequence
${legendDescription}

Return your analysis as valid JSON:
{
  "test_name": "Descriptive test name",
  "page_context": "What type of page this is (login, form, dashboard, etc.)",
  "steps": [
    {
      "step_number": 1,
      "marker_id": "1",
      "action": "click|fill|select|verify|hover|scroll|wait|navigate",
      "element_type": "button|input|link|checkbox|etc.",
      "element_label": "Visible text or label",
      "selector": "getByRole('button', { name: 'Submit' })",
      "value": "optional value for fill/select",
      "playwright_code": "await page.getByRole('button', { name: 'Submit' }).click();",
      "comment": "Click the submit button",
      "confidence": 0.95
    }
  ],
  "assertions": [
    {
      "step_after": 3,
      "playwright_code": "await expect(page).toHaveURL('/dashboard');",
      "comment": "Verify navigation to dashboard"
    }
  ],
  "overall_confidence": 0.85,
  "notes": ["Any observations about the annotation quality"]
}

Important:
- Order steps by their marker numbers/sequence
- Use modern Playwright selectors (getByRole, getByLabel, getByText)
- Generate assertions at logical points (after form submissions, navigation, etc.)
- If a marker is unclear, make a best guess and note lower confidence
- Include helpful comments explaining each step`;

    const userPrompt = `Analyze this annotated screenshot and generate a Playwright test.

${targetUrl ? `Target URL: ${targetUrl}` : ''}
Test name: ${testName}

Identify all numbered/labeled markers in the image and generate the test steps in sequence.`;

    // Build the multimodal message with image
    const messages = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text' as const,
            text: userPrompt,
          },
        ],
      },
    ];

    // Send to Claude Vision via the router
    const response = await aiRouter.sendVisionMessage(messages, {
      model: modelConfig.model,
      maxTokens: modelConfig.maxTokens || 4096,
      temperature: modelConfig.temperature || 0.1,
      systemPrompt,
    });

    // Parse the AI response
    let analysisResult: {
      test_name: string;
      page_context: string;
      steps: ParsedAnnotationStep[];
      assertions?: { step_after: number; playwright_code: string; comment: string }[];
      overall_confidence: number;
      notes?: string[];
    };

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      context.log(`[AI Vision] Failed to parse AI response: ${parseError}`);
      return {
        success: false,
        error: 'Failed to parse vision analysis response',
        raw_response: response.content.substring(0, 500),
      };
    }

    // Generate the complete test code
    const generatedTestCode = generateAnnotatedTestCode({
      testName: analysisResult.test_name || testName,
      targetUrl,
      steps: analysisResult.steps,
      assertions: analysisResult.assertions,
      includeComments,
      includeAssertions,
      language,
    });

    const generationTimeMs = Date.now() - startTime;

    return {
      success: true,
      test_name: analysisResult.test_name || testName,
      page_context: analysisResult.page_context,
      steps: analysisResult.steps,
      step_count: analysisResult.steps.length,
      assertions: analysisResult.assertions || [],
      assertion_count: (analysisResult.assertions || []).length,
      test_code: generatedTestCode,
      overall_confidence: analysisResult.overall_confidence,
      notes: analysisResult.notes || [],
      step_summary: {
        click_actions: analysisResult.steps.filter(s => s.action === 'click').length,
        fill_actions: analysisResult.steps.filter(s => s.action === 'fill').length,
        verify_actions: analysisResult.steps.filter(s => s.action === 'verify').length,
        other_actions: analysisResult.steps.filter(s => !['click', 'fill', 'verify'].includes(s.action)).length,
      },
      ai_metadata: {
        provider: response.actualProvider,
        model: response.model,
        model_tier: modelConfig.tier,
        vision_used: true,
        tokens_used: {
          input: response.inputTokens,
          output: response.outputTokens,
        },
        generation_time_ms: generationTimeMs,
      },
      data_source: 'real',
      generated_at: new Date().toISOString(),
    };

  } catch (error) {
    return {
      success: false,
      error: `Annotated screenshot test generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

// ============================================================================
// Handler Registry & Exports
// ============================================================================

/**
 * Vision handlers for AI-powered screenshot analysis and test generation
 */
export const visionHandlers: Record<string, ToolHandler> = {
  analyze_screenshot: analyzeScreenshot,
  generate_test_from_annotated_screenshot: generateTestFromAnnotatedScreenshot,
};

/**
 * List of tool names this module handles
 */
export const visionToolNames = Object.keys(visionHandlers);

/**
 * Export as a handler module for use with the registry
 */
export const aiGenVisionModule: HandlerModule = {
  handlers: visionHandlers,
  toolNames: visionToolNames,
};
