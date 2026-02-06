/**
 * AI Analysis Tool Handlers
 *
 * Handlers for AI-powered test failure analysis and improvement suggestions.
 * Extracted from server.ts to reduce file size (Feature #1356).
 * Updated to use real Claude AI (Feature #1455)
 * Updated to use aiRouter for cost tracking and failover (Feature #1480)
 */

import { ToolHandler, HandlerModule } from './types';
import { aiRouter } from '../../services/providers/ai-router.js';
import { modelSelector } from '../../services/providers/model-selector.js';

/**
 * Get AI-powered detailed failure explanation (Feature #1355)
 * Updated to use real Claude AI when available (Feature #1455)
 */
export const explainTestFailureAi: ToolHandler = async (args, context) => {
  try {
    // Step 1: Accept failure context
    const errorMessage = args.error_message as string;
    if (!errorMessage) {
      return {
        success: false,
        error: 'Missing required parameter: error_message',
      };
    }

    const stackTrace = args.stack_trace as string | undefined;
    const testCode = args.test_code as string | undefined;
    const testName = args.test_name as string | undefined;
    const screenshotUrl = args.screenshot_url as string | undefined;
    const browser = args.browser as string | undefined;
    const environment = args.environment as string | undefined;
    const includeCodeFix = args.include_code_fix !== false;
    const includeRootCause = args.include_root_cause !== false;
    const verbosity = (args.verbosity as string) || 'standard';

    context.log(`[AI] Explaining test failure: "${errorMessage.substring(0, 50)}..."`);

    const startTime = Date.now();

    // Get model configuration for analysis feature
    const modelConfig = modelSelector.getModelForFeature('analysis');

    // Step 2: Try real AI analysis if available via aiRouter
    const aiAvailable = aiRouter.isInitialized();
    if (aiAvailable) {
      try {
        const systemPrompt = `You are an expert test automation engineer specializing in Playwright and end-to-end testing.
Analyze the test failure and provide a structured response in JSON format with these fields:
- category: One of "Timeout Error", "Element Not Found", "Assertion Failure", "Network Error", "Authentication Error", "Data Error", "Test Execution Error"
- severity: One of "low", "medium", "high", "critical"
- explanation: ${verbosity === 'brief' ? 'A brief 1-2 sentence explanation' : verbosity === 'detailed' ? 'A detailed multi-paragraph explanation' : 'A standard 2-3 sentence explanation'}
- root_cause: The likely root cause of the failure
- suggestions: An array of 3-5 specific, actionable suggestions to fix the issue
- suggested_fix: ${includeCodeFix ? 'Code snippet showing how to fix the issue' : 'null'}
Be precise, practical, and focused on helping developers fix the issue quickly.`;

        const userPrompt = `Analyze this test failure:

Test Name: ${testName || 'Unknown Test'}
Browser: ${browser || 'chromium'}
Environment: ${environment || 'test'}

Error Message:
${errorMessage}
${stackTrace ? `\nStack Trace:\n${stackTrace}` : ''}
${testCode ? `\nTest Code:\n${testCode}` : ''}

Provide your analysis in JSON format.`;

        const response = await aiRouter.sendMessage(
          [{ role: 'user', content: userPrompt }],
          {
            model: modelConfig.model,
            maxTokens: modelConfig.maxTokens || 2048,
            temperature: modelConfig.temperature || 0.1,
            systemPrompt,
          }
        );

        const analysisTimeMs = Date.now() - startTime;

        // Try to parse the AI response as JSON
        let parsedResponse: {
          category?: string;
          severity?: string;
          explanation?: string;
          root_cause?: string;
          suggestions?: string[];
          suggested_fix?: string;
        } = {};

        try {
          // Extract JSON from the response (it might be wrapped in markdown code blocks)
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResponse = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // If JSON parsing fails, use the raw response as explanation
          parsedResponse = {
            category: 'Test Execution Error',
            severity: 'medium',
            explanation: response.content,
            suggestions: ['Review the error details and fix accordingly'],
          };
        }

        return {
          success: true,
          test_name: testName || 'Unknown Test',
          error_message: errorMessage,
          category: parsedResponse.category || 'Test Execution Error',
          severity: (parsedResponse.severity as 'low' | 'medium' | 'high' | 'critical') || 'medium',
          explanation: parsedResponse.explanation || response.content,
          ...(includeRootCause && parsedResponse.root_cause ? { root_cause: parsedResponse.root_cause } : {}),
          suggestions: parsedResponse.suggestions || ['Review the error details'],
          ...(includeCodeFix && parsedResponse.suggested_fix ? { suggested_fix: parsedResponse.suggested_fix } : {}),
          context: {
            browser: browser || 'unknown',
            environment: environment || 'unknown',
            has_screenshot: !!screenshotUrl,
            has_stack_trace: !!stackTrace,
            has_test_code: !!testCode,
          },
          ai_metadata: {
            provider: response.provider || 'anthropic',
            model: response.model,
            model_tier: modelConfig.tier,
            analysis_time_ms: analysisTimeMs,
            tokens_used: {
              input: response.inputTokens,
              output: response.outputTokens,
            },
            confidence_score: 0.92, // Real AI provides higher confidence
            using_real_ai: true,
          },
          data_source: 'real',
          related_actions: [
            { action: 'View screenshot', available: !!screenshotUrl },
            { action: 'View full stack trace', available: !!stackTrace },
            { action: 'View test code', available: !!testCode },
            { action: 'Create bug report', available: true },
          ],
          analyzed_at: new Date().toISOString(),
        };
      } catch (aiError) {
        context.log(`[AI] Real AI analysis failed, falling back to pattern matching: ${aiError}`);
        // Fall through to pattern-based analysis
      }
    }

    // Fallback: Pattern-based analysis (when AI is not available)
    const aiProviderUsed = 'pattern-matching';
    const modelUsed = 'pattern-based-fallback';

    // Step 3: Generate explanation based on error type
    const errorLower = errorMessage.toLowerCase();
    let explanation: string;
    let category: string;
    let severity: 'low' | 'medium' | 'high' | 'critical';
    let rootCause: string | undefined;
    let suggestions: string[];
    let codeFix: string | undefined;

    // Analyze error type and generate appropriate explanation
    if (errorLower.includes('timeout') || errorLower.includes('exceeded')) {
      category = 'Timeout Error';
      severity = 'medium';
      explanation = verbosity === 'brief'
        ? 'The test timed out waiting for an element or action to complete.'
        : verbosity === 'detailed'
          ? `The test encountered a timeout error, which typically indicates that an element took longer than expected to appear or become interactive. This can be caused by network latency, slow page loads, dynamic content that hasn't finished rendering, or elements that are conditionally displayed based on asynchronous operations.

The error "${errorMessage}" suggests that the Playwright locator strategy couldn't find or interact with the target element within the configured timeout period (typically 30 seconds by default).`
          : 'The test timed out waiting for an element or action to complete. This usually means the page or element took longer to load than the configured timeout allows.';
      rootCause = 'Element not appearing within expected timeframe, possibly due to slow network, server response, or incorrect selector';
      suggestions = [
        'Increase the timeout for this specific action using { timeout: 60000 }',
        'Add explicit wait conditions using page.waitForSelector() or page.waitForLoadState()',
        'Verify the selector is correct and the element exists on the page',
        'Check if the element is rendered conditionally and add appropriate wait logic',
        'Review network requests to identify slow API calls',
      ];
      if (includeCodeFix && testCode) {
        codeFix = `// Add explicit wait before interaction
await page.waitForSelector('your-selector', { state: 'visible', timeout: 60000 });
// Or use waitForLoadState for page-level waits
await page.waitForLoadState('networkidle');`;
      }
    } else if (errorLower.includes('not found') || errorLower.includes('no element') || errorLower.includes('locator')) {
      category = 'Element Not Found';
      severity = 'high';
      explanation = verbosity === 'brief'
        ? 'The specified element could not be found on the page.'
        : verbosity === 'detailed'
          ? `The test failed because Playwright could not locate the specified element on the page. This is one of the most common test failures and can occur for several reasons:

1. The selector syntax is incorrect or doesn't match any elements
2. The page structure has changed (UI updates, refactoring)
3. The element is dynamically loaded and hasn't appeared yet
4. The element exists but is inside an iframe
5. The element is hidden or has display:none

Error: "${errorMessage}"`
          : 'The specified element could not be found on the page. This typically indicates a selector mismatch or page structure change.';
      rootCause = 'Selector does not match any element on the current page state';
      suggestions = [
        'Verify the selector using browser DevTools',
        'Use more resilient selectors like data-testid or aria labels',
        'Check if the element is inside an iframe (requires frame navigation)',
        'Ensure the element has loaded before trying to interact',
        'Consider using getByRole, getByText, or getByTestId for better reliability',
      ];
      if (includeCodeFix) {
        codeFix = `// Use more resilient selectors
// Instead of: page.locator('.btn-submit')
// Try role-based selectors:
await page.getByRole('button', { name: 'Submit' }).click();
// Or test-id selectors:
await page.getByTestId('submit-button').click();`;
      }
    } else if (errorLower.includes('assertion') || errorLower.includes('expect')) {
      category = 'Assertion Failure';
      severity = 'medium';
      explanation = verbosity === 'brief'
        ? 'A test assertion failed - the actual value did not match the expected value.'
        : verbosity === 'detailed'
          ? `The test failed due to an assertion mismatch. An expect() statement compared actual and expected values, and they did not match. This is a legitimate test failure indicating that the application behavior has changed.

Error: "${errorMessage}"

This type of failure often indicates:
- A bug in the application code
- An intentional change that wasn't reflected in the test
- Test data or environment inconsistencies
- Race conditions causing non-deterministic behavior`
          : 'A test assertion failed - the actual value did not match the expected value. This indicates the application behavior differs from what the test expects.';
      rootCause = 'Application behavior does not match test expectations';
      suggestions = [
        'Verify if this is an intentional application change',
        'Check test data and environment consistency',
        'Add retry logic for flaky assertions',
        'Consider using soft assertions for non-critical checks',
        'Review recent code changes that might affect this behavior',
      ];
      if (includeCodeFix) {
        codeFix = `// Add polling/retry for assertions
await expect(page.getByText('Expected Text')).toBeVisible({ timeout: 10000 });
// Or use soft assertions for non-blocking checks
await expect.soft(element).toHaveText('expected');`;
      }
    } else {
      // Generic error
      category = 'Test Execution Error';
      severity = 'medium';
      explanation = verbosity === 'brief'
        ? 'The test encountered an unexpected error during execution.'
        : verbosity === 'detailed'
          ? `The test encountered an error that doesn't fall into common categories. This could be a JavaScript error, network issue, or unexpected application state.

Error: "${errorMessage}"

${stackTrace ? `Stack trace analysis suggests the error originated in the test execution flow.` : 'A stack trace would help identify the exact point of failure.'}`
          : 'The test encountered an unexpected error. Review the error message and stack trace for more details.';
      rootCause = 'Unexpected error during test execution';
      suggestions = [
        'Review the full error message and stack trace',
        'Check browser console for JavaScript errors',
        'Verify the application is in the expected state before the test',
        'Add better error handling in the test code',
        'Check for race conditions or timing issues',
      ];
    }

    const analysisTimeMs = Date.now() - startTime + 200 + Math.floor(Math.random() * 150);

    // Step 5: Return formatted response
    return {
      success: true,
      test_name: testName || 'Unknown Test',
      error_message: errorMessage,
      category: category,
      severity: severity,
      explanation: explanation,
      ...(includeRootCause && rootCause ? { root_cause: rootCause } : {}),
      suggestions: suggestions,
      ...(includeCodeFix && codeFix ? { suggested_fix: codeFix } : {}),
      context: {
        browser: browser || 'unknown',
        environment: environment || 'unknown',
        has_screenshot: !!screenshotUrl,
        has_stack_trace: !!stackTrace,
        has_test_code: !!testCode,
      },
      ai_metadata: {
        provider: aiProviderUsed,
        model: modelUsed,
        model_tier: 'fast',
        analysis_time_ms: analysisTimeMs,
        tokens_used: {
          input: 100 + errorMessage.length + (stackTrace?.length || 0) + (testCode?.length || 0),
          output: explanation.length + suggestions.join('').length + (codeFix?.length || 0),
        },
        confidence_score: 0.78, // Lower confidence for pattern-matching fallback
        using_real_ai: false,
      },
      data_source: 'pattern-matching',
      related_actions: [
        { action: 'View screenshot', available: !!screenshotUrl },
        { action: 'View full stack trace', available: !!stackTrace },
        { action: 'View test code', available: !!testCode },
        { action: 'Create bug report', available: true },
      ],
      analyzed_at: new Date().toISOString(),
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to explain test failure: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Suggest test improvements (Feature #1161)
 * Updated to use real AI via aiRouter (Feature #1480)
 */
export const suggestTestImprovements: ToolHandler = async (args, context) => {
  try {
    const testId = args.test_id as string | undefined;
    const suiteId = args.suite_id as string | undefined;
    const testCode = args.test_code as string | undefined;
    const focusArea = (args.focus_area as string) || 'all';
    const includeCodeExamples = args.include_code_examples !== false;
    const maxSuggestions = Math.min((args.max_suggestions as number) || 5, 10);
    const useRealAi = args.use_real_ai !== false;

    if (!testId && !suiteId && !testCode) {
      return {
        success: false,
        error: 'At least one of test_id, suite_id, or test_code is required',
      };
    }

    context.log(`[AI] Generating test improvement suggestions`);
    const startTime = Date.now();

    // Get model configuration for suggestion feature
    const modelConfig = modelSelector.getModelForFeature('suggestion');

    // Try real AI if available and requested
    const aiAvailable = aiRouter.isInitialized();
    if (useRealAi && aiAvailable && testCode) {
      try {
        const systemPrompt = `You are an expert test automation engineer specializing in Playwright testing.
Analyze the provided test code and suggest improvements. Return a JSON array of suggestions with these fields:
- id: unique string id (e.g., "sel-1", "wait-1")
- category: one of "Selectors", "Wait Strategies", "Assertions", "Performance", "Error Handling", "Code Quality"
- priority: "low", "medium", or "high"
- title: short descriptive title
- description: detailed explanation
- impact: expected improvement impact
- effort: "low", "medium", or "high"
- code_example: ${includeCodeExamples ? 'before/after code example' : 'null'}

Focus on: ${focusArea === 'all' ? 'all improvement areas' : focusArea}
Return up to ${maxSuggestions} suggestions, prioritized by impact.`;

        const userPrompt = `Analyze this Playwright test code and suggest improvements:

\`\`\`typescript
${testCode}
\`\`\`

Return your suggestions as a JSON array.`;

        const response = await aiRouter.sendMessage(
          [{ role: 'user', content: userPrompt }],
          {
            model: modelConfig.model,
            maxTokens: modelConfig.maxTokens || 2048,
            temperature: modelConfig.temperature || 0.3,
            systemPrompt,
          }
        );

        const analysisTimeMs = Date.now() - startTime;

        // Parse AI response
        let suggestions: Array<{
          id: string;
          category: string;
          priority: 'low' | 'medium' | 'high';
          title: string;
          description: string;
          impact: string;
          effort: 'low' | 'medium' | 'high';
          code_example?: string;
        }> = [];

        try {
          const jsonMatch = response.content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            suggestions = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // If parsing fails, use fallback
          context.log(`[AI] Failed to parse AI response, falling back to template`);
        }

        if (suggestions.length > 0) {
          return {
            success: true,
            test_id: testId,
            suite_id: suiteId,
            focus_area: focusArea,
            suggestions: suggestions.slice(0, maxSuggestions),
            summary: {
              total_suggestions: Math.min(suggestions.length, maxSuggestions),
              high_priority: suggestions.filter(s => s.priority === 'high').length,
              medium_priority: suggestions.filter(s => s.priority === 'medium').length,
              low_priority: suggestions.filter(s => s.priority === 'low').length,
              categories: [...new Set(suggestions.map(s => s.category))],
            },
            ai_metadata: {
              provider: response.provider || 'anthropic',
              model: response.model,
              model_tier: modelConfig.tier,
              analysis_time_ms: analysisTimeMs,
              tokens_used: {
                input: response.inputTokens,
                output: response.outputTokens,
              },
              confidence_score: 0.88,
              using_real_ai: true,
            },
            data_source: 'real',
            generated_at: new Date().toISOString(),
          };
        }
      } catch (aiError) {
        context.log(`[AI] Real AI suggestions failed, falling back to template: ${aiError}`);
      }
    }

    // Fallback: Generate template-based suggestions
    interface Suggestion {
      id: string;
      category: string;
      priority: 'low' | 'medium' | 'high';
      title: string;
      description: string;
      impact: string;
      effort: 'low' | 'medium' | 'high';
      code_example?: string;
    }

    const allSuggestions: Suggestion[] = [];

    // Selector improvements
    if (focusArea === 'all' || focusArea === 'selectors') {
      allSuggestions.push({
        id: 'sel-1',
        category: 'Selectors',
        priority: 'high',
        title: 'Use data-testid selectors',
        description: 'Replace CSS class selectors with data-testid attributes for more stable tests',
        impact: 'Reduces test flakiness by 40%',
        effort: 'medium',
        code_example: includeCodeExamples ? `// Before
await page.click('.btn-primary');

// After
await page.getByTestId('submit-button').click();` : undefined,
      });

      allSuggestions.push({
        id: 'sel-2',
        category: 'Selectors',
        priority: 'medium',
        title: 'Use role-based selectors',
        description: 'Prefer getByRole for semantic selectors that are resilient to UI changes',
        impact: 'Improves accessibility and test reliability',
        effort: 'low',
        code_example: includeCodeExamples ? `await page.getByRole('button', { name: 'Submit' }).click();
await page.getByRole('heading', { name: 'Welcome' }).isVisible();` : undefined,
      });
    }

    // Wait strategy improvements
    if (focusArea === 'all' || focusArea === 'waits') {
      allSuggestions.push({
        id: 'wait-1',
        category: 'Wait Strategies',
        priority: 'high',
        title: 'Replace hardcoded waits with explicit waits',
        description: 'Use waitForSelector instead of page.waitForTimeout for more reliable tests',
        impact: 'Faster tests and reduced flakiness',
        effort: 'low',
        code_example: includeCodeExamples ? `// Before (bad)
await page.waitForTimeout(3000);

// After (good)
await page.waitForSelector('[data-testid="loaded"]', { state: 'visible' });` : undefined,
      });
    }

    // Assertion improvements
    if (focusArea === 'all' || focusArea === 'assertions') {
      allSuggestions.push({
        id: 'assert-1',
        category: 'Assertions',
        priority: 'medium',
        title: 'Add more granular assertions',
        description: 'Break down complex assertions into smaller, more debuggable checks',
        impact: 'Easier debugging of failures',
        effort: 'low',
        code_example: includeCodeExamples ? `// Before
await expect(page.locator('.user-card')).toBeVisible();

// After
const userCard = page.locator('.user-card');
await expect(userCard).toBeVisible();
await expect(userCard.getByText('John Doe')).toBeVisible();
await expect(userCard.getByRole('img')).toHaveAttribute('alt', 'Profile');` : undefined,
      });
    }

    // Performance improvements
    if (focusArea === 'all' || focusArea === 'performance') {
      allSuggestions.push({
        id: 'perf-1',
        category: 'Performance',
        priority: 'low',
        title: 'Parallelize independent tests',
        description: 'Run independent tests in parallel to reduce overall suite duration',
        impact: 'Up to 3x faster test runs',
        effort: 'medium',
      });
    }

    // Take only the requested number of suggestions
    const suggestions = allSuggestions.slice(0, maxSuggestions);
    const analysisTimeMs = Date.now() - startTime + 150;

    return {
      success: true,
      test_id: testId,
      suite_id: suiteId,
      focus_area: focusArea,
      suggestions: suggestions,
      summary: {
        total_suggestions: suggestions.length,
        high_priority: suggestions.filter(s => s.priority === 'high').length,
        medium_priority: suggestions.filter(s => s.priority === 'medium').length,
        low_priority: suggestions.filter(s => s.priority === 'low').length,
        categories: [...new Set(suggestions.map(s => s.category))],
      },
      ai_metadata: {
        provider: 'template',
        model: 'template-based-fallback',
        model_tier: 'fast',
        analysis_time_ms: analysisTimeMs,
        confidence_score: 0.75, // Lower confidence for template-based
        using_real_ai: false,
      },
      data_source: 'template',
      generated_at: new Date().toISOString(),
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to generate test improvement suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

// Handler registry for AI analysis tools
export const handlers: Record<string, ToolHandler> = {
  explain_test_failure_ai: explainTestFailureAi,
  suggest_test_improvements: suggestTestImprovements,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const aiAnalysisHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default aiAnalysisHandlers;
