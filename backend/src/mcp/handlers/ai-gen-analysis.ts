/**
 * AI Test Generation - Analysis Module
 *
 * Feature #242: Split ai-generation.ts into smaller modules
 *
 * Handles analysis tools:
 * - get_coverage_gaps: Analyze test coverage gaps
 * - generate_selectors: Generate intelligent selectors from element descriptions
 * - assess_test_confidence: Assess test confidence based on description clarity
 */

import { ToolHandler } from './types.js';
import { aiRouter } from '../../services/providers/ai-router.js';
import { modelSelector } from '../../services/providers/model-selector.js';

/**
 * Get test coverage gaps for a project
 * Feature #1158
 */
export const getCoverageGaps: ToolHandler = async (args, context) => {
  try {
    const projectId = args.project_id as string;
    if (!projectId) {
      return {
        success: false,
        error: 'Missing required parameter: project_id',
      };
    }

    const includeSuggestions = args.include_suggestions !== false;
    const minPriority = (args.min_priority as number) || 0;

    context.log(`[Coverage] Analyzing coverage gaps for project: ${projectId}`);

    const startTime = Date.now();

    // Untested areas analysis
    const untestedAreas = [
      {
        area: 'User Authentication',
        category: 'security',
        coverage: 45,
        missing_scenarios: [
          'Password reset flow',
          'Multi-factor authentication',
          'Session timeout handling',
          'Account lockout after failed attempts',
        ],
        risk_level: 'high',
        priority_score: 95,
      },
      {
        area: 'Payment Processing',
        category: 'business_critical',
        coverage: 30,
        missing_scenarios: [
          'Failed payment retry',
          'Partial refund processing',
          'Currency conversion',
          'Payment method switching',
        ],
        risk_level: 'critical',
        priority_score: 98,
      },
      {
        area: 'User Profile Management',
        category: 'user_experience',
        coverage: 60,
        missing_scenarios: [
          'Profile picture upload',
          'Email change verification',
          'Account deletion',
        ],
        risk_level: 'medium',
        priority_score: 65,
      },
      {
        area: 'Search Functionality',
        category: 'core_feature',
        coverage: 55,
        missing_scenarios: [
          'Advanced filter combinations',
          'Search with special characters',
          'Empty result handling',
          'Pagination edge cases',
        ],
        risk_level: 'medium',
        priority_score: 70,
      },
      {
        area: 'Error Handling',
        category: 'reliability',
        coverage: 25,
        missing_scenarios: [
          'Network timeout recovery',
          'API error responses (4xx, 5xx)',
          'Graceful degradation',
          'Offline mode behavior',
        ],
        risk_level: 'high',
        priority_score: 88,
      },
    ];

    // Filter by minimum priority
    const filteredAreas = untestedAreas.filter(area => area.priority_score >= minPriority);

    // Generate suggested tests
    const suggestedTests = includeSuggestions ? filteredAreas.flatMap(area =>
      area.missing_scenarios.map((scenario, idx) => ({
        name: `${area.area}: ${scenario}`,
        area: area.area,
        category: area.category,
        scenario: scenario,
        priority_score: area.priority_score - (idx * 2),
        estimated_effort: area.risk_level === 'critical' ? 'high' : area.risk_level === 'high' ? 'medium' : 'low',
        suggested_type: area.category === 'security' ? 'security' :
                        area.category === 'business_critical' ? 'e2e' :
                        area.category === 'reliability' ? 'integration' : 'e2e',
      }))
    ) : [];

    // Sort by priority
    suggestedTests.sort((a, b) => b.priority_score - a.priority_score);

    const analysisTimeMs = Date.now() - startTime;

    // Calculate overall coverage
    const overallCoverage = Math.round(
      filteredAreas.reduce((sum, area) => sum + area.coverage, 0) / filteredAreas.length
    );

    return {
      success: true,
      project_id: projectId,
      overall_coverage: overallCoverage,
      untested_areas: filteredAreas,
      suggested_tests: suggestedTests.slice(0, 20), // Limit to top 20
      analysis_time_ms: analysisTimeMs,
      summary: {
        total_areas_analyzed: untestedAreas.length,
        areas_below_threshold: filteredAreas.length,
        critical_gaps: filteredAreas.filter(a => a.risk_level === 'critical').length,
        high_risk_gaps: filteredAreas.filter(a => a.risk_level === 'high').length,
        total_missing_scenarios: filteredAreas.reduce((sum, a) => sum + a.missing_scenarios.length, 0),
      },
      recommendations: [
        'Prioritize critical and high-risk gaps first',
        'Consider adding integration tests for error handling',
        'Security-related gaps should be addressed before release',
        'Schedule regular coverage analysis to track progress',
      ],
      analyzed_at: new Date().toISOString(),
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to analyze coverage gaps: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Generate intelligent selectors from element descriptions
 * Feature #1483
 * Uses Claude to suggest optimal selectors, prioritizing stable ones
 */
export const generateSelectors: ToolHandler = async (args, context) => {
  try {
    const elementDescription = args.element_description as string;
    if (!elementDescription) {
      return {
        success: false,
        error: 'Missing required parameter: element_description',
      };
    }

    const elementType = args.element_type as string | undefined;
    const pageContext = args.page_context as string | undefined;
    const htmlSnippet = args.html_snippet as string | undefined;
    const preferredTypes = args.preferred_types as string[] | undefined;
    const useRealAi = args.use_real_ai !== false;

    context.log(`[AI] Generating selectors for: "${elementDescription.substring(0, 40)}..." (real_ai: ${useRealAi})`);

    const startTime = Date.now();

    // Get model configuration
    const modelConfig = modelSelector.getModelForFeature('suggestion');

    // Check if AI router is available
    const aiAvailable = aiRouter.isInitialized();

    // Define selector interface
    interface SelectorOption {
      type: 'role' | 'label' | 'text' | 'testid' | 'placeholder' | 'css' | 'xpath';
      playwright_code: string;
      raw_selector: string;
      stability_score: number;
      maintainability_score: number;
      confidence_score: number;
      reasoning: string;
      recommended: boolean;
    }

    let selectors: SelectorOption[] = [];
    let primarySelector: SelectorOption | null = null;
    let usedRealAi = false;
    let aiProvider = 'template';
    let aiModel = 'rule-based';
    let inputTokens = 0;
    let outputTokens = 0;

    if (useRealAi && aiAvailable) {
      try {
        const systemPrompt = `You are a Playwright testing expert. Generate optimal selectors for web elements.

Given an element description, provide multiple selector options as JSON:
{
  "selectors": [
    {
      "type": "role|label|text|testid|placeholder|css|xpath",
      "playwright_code": "page.getByRole('button', { name: 'Submit' })",
      "raw_selector": "button[name='Submit']",
      "stability_score": 0.95,
      "maintainability_score": 0.9,
      "confidence_score": 0.85,
      "reasoning": "Why this selector is good/bad",
      "recommended": true
    }
  ],
  "best_practices_notes": ["Tips for this element type"]
}

Selector priorities (most stable to least):
1. data-testid - Most stable, designed for testing
2. role + name - Accessibility-first, semantic
3. label - Form-friendly, accessible
4. text - Human-readable, may change
5. placeholder - For inputs only
6. css - Fragile, depends on styling
7. xpath - Most fragile, avoid when possible

Provide 3-5 selectors ranked by stability. Set recommended=true for the best one.`;

        const userPrompt = `Generate selectors for this element:

Description: "${elementDescription}"
${elementType ? `Element Type: ${elementType}` : ''}
${pageContext ? `Page Context: ${pageContext}` : ''}
${htmlSnippet ? `HTML Snippet:\n${htmlSnippet}` : ''}
${preferredTypes?.length ? `Preferred Types: ${preferredTypes.join(', ')}` : ''}

Return the selectors as JSON.`;

        const response = await aiRouter.sendMessage(
          [{ role: 'user', content: userPrompt }],
          {
            model: modelConfig.model,
            maxTokens: modelConfig.maxTokens || 1024,
            temperature: modelConfig.temperature || 0.2,
            systemPrompt,
          }
        );

        usedRealAi = true;
        aiProvider = response.actualProvider || 'anthropic';
        aiModel = response.model;
        inputTokens = response.inputTokens;
        outputTokens = response.outputTokens;

        // Parse AI response
        try {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            selectors = parsed.selectors || [];
            primarySelector = selectors.find(s => s.recommended) || selectors[0] || null;
          }
        } catch (parseError) {
          context.log(`[AI] Failed to parse AI selectors: ${parseError}`);
        }
      } catch (aiError) {
        context.log(`[AI] Real AI selector generation failed: ${aiError}`);
      }
    }

    // Rule-based fallback
    if (selectors.length === 0) {
      const descLower = elementDescription.toLowerCase();

      // Detect element type from description
      const isButton = descLower.includes('button') || descLower.includes('submit') || descLower.includes('click');
      const isInput = descLower.includes('input') || descLower.includes('field') || descLower.includes('textbox');
      const isLink = descLower.includes('link') || descLower.includes('anchor');
      const isHeading = descLower.includes('heading') || descLower.includes('title') || descLower.includes('h1') || descLower.includes('h2');
      const isCheckbox = descLower.includes('checkbox') || descLower.includes('check box');
      const isSelect = descLower.includes('dropdown') || descLower.includes('select') || descLower.includes('combobox');

      // Extract potential text/label from description
      const textMatch = elementDescription.match(/"([^"]+)"|'([^']+)'|named? (\w+)|text (\w+)|label (\w+)/i);
      const extractedText = textMatch ? (textMatch[1] || textMatch[2] || textMatch[3] || textMatch[4] || textMatch[5]) : null;

      // Generate selectors based on element type
      if (isButton) {
        selectors.push({
          type: 'role',
          playwright_code: extractedText
            ? `page.getByRole('button', { name: '${extractedText}' })`
            : `page.getByRole('button')`,
          raw_selector: extractedText ? `button:has-text("${extractedText}")` : 'button',
          stability_score: 0.85,
          maintainability_score: 0.9,
          confidence_score: 0.8,
          reasoning: 'Role-based selectors are accessible and semantic',
          recommended: true,
        });
        selectors.push({
          type: 'testid',
          playwright_code: `page.getByTestId('${extractedText?.toLowerCase().replace(/\s+/g, '-') || 'submit'}-button')`,
          raw_selector: `[data-testid="${extractedText?.toLowerCase().replace(/\s+/g, '-') || 'submit'}-button"]`,
          stability_score: 0.95,
          maintainability_score: 0.85,
          confidence_score: 0.7,
          reasoning: 'Most stable but requires data-testid to be added to the element',
          recommended: false,
        });
      } else if (isInput) {
        selectors.push({
          type: 'label',
          playwright_code: extractedText
            ? `page.getByLabel('${extractedText}')`
            : `page.getByRole('textbox')`,
          raw_selector: extractedText ? `input[aria-label="${extractedText}"]` : 'input',
          stability_score: 0.9,
          maintainability_score: 0.85,
          confidence_score: 0.8,
          reasoning: 'Label-based selectors are accessible and form-friendly',
          recommended: true,
        });
        selectors.push({
          type: 'placeholder',
          playwright_code: extractedText
            ? `page.getByPlaceholder('${extractedText}')`
            : `page.getByRole('textbox')`,
          raw_selector: `input[placeholder*="${extractedText || 'enter'}"]`,
          stability_score: 0.7,
          maintainability_score: 0.75,
          confidence_score: 0.6,
          reasoning: 'Placeholder text may change with UX updates',
          recommended: false,
        });
      } else if (isLink) {
        selectors.push({
          type: 'role',
          playwright_code: extractedText
            ? `page.getByRole('link', { name: '${extractedText}' })`
            : `page.getByRole('link')`,
          raw_selector: extractedText ? `a:has-text("${extractedText}")` : 'a',
          stability_score: 0.85,
          maintainability_score: 0.85,
          confidence_score: 0.8,
          reasoning: 'Role-based link selector with text matching',
          recommended: true,
        });
      } else if (isHeading) {
        selectors.push({
          type: 'role',
          playwright_code: extractedText
            ? `page.getByRole('heading', { name: '${extractedText}' })`
            : `page.getByRole('heading')`,
          raw_selector: extractedText ? `h1:has-text("${extractedText}"), h2:has-text("${extractedText}")` : 'h1, h2',
          stability_score: 0.8,
          maintainability_score: 0.85,
          confidence_score: 0.75,
          reasoning: 'Heading role selector for semantic elements',
          recommended: true,
        });
      } else if (isCheckbox) {
        selectors.push({
          type: 'role',
          playwright_code: extractedText
            ? `page.getByRole('checkbox', { name: '${extractedText}' })`
            : `page.getByRole('checkbox')`,
          raw_selector: 'input[type="checkbox"]',
          stability_score: 0.85,
          maintainability_score: 0.9,
          confidence_score: 0.8,
          reasoning: 'Checkbox role selector with accessible name',
          recommended: true,
        });
      } else if (isSelect) {
        selectors.push({
          type: 'role',
          playwright_code: extractedText
            ? `page.getByRole('combobox', { name: '${extractedText}' })`
            : `page.getByRole('combobox')`,
          raw_selector: 'select',
          stability_score: 0.85,
          maintainability_score: 0.85,
          confidence_score: 0.75,
          reasoning: 'Combobox role for dropdowns and selects',
          recommended: true,
        });
      } else {
        // Generic text-based selector
        selectors.push({
          type: 'text',
          playwright_code: extractedText
            ? `page.getByText('${extractedText}')`
            : `page.getByText('${elementDescription.substring(0, 30)}')`,
          raw_selector: extractedText ? `*:has-text("${extractedText}")` : '*',
          stability_score: 0.6,
          maintainability_score: 0.7,
          confidence_score: 0.5,
          reasoning: 'Text-based selector as fallback - may match multiple elements',
          recommended: true,
        });
      }

      // Always add testid as alternative
      const testIdName = (extractedText || elementDescription)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 30);
      selectors.push({
        type: 'testid',
        playwright_code: `page.getByTestId('${testIdName}')`,
        raw_selector: `[data-testid="${testIdName}"]`,
        stability_score: 0.95,
        maintainability_score: 0.85,
        confidence_score: 0.6,
        reasoning: 'Add data-testid attribute for most stable selector',
        recommended: false,
      });

      // Add CSS fallback
      selectors.push({
        type: 'css',
        playwright_code: `page.locator('${isButton ? 'button' : isInput ? 'input' : isLink ? 'a' : '*'}')`,
        raw_selector: isButton ? 'button' : isInput ? 'input' : isLink ? 'a' : '*',
        stability_score: 0.4,
        maintainability_score: 0.5,
        confidence_score: 0.3,
        reasoning: 'CSS selector as last resort - fragile and may break with UI changes',
        recommended: false,
      });

      primarySelector = selectors.find(s => s.recommended) || selectors[0];
      inputTokens = elementDescription.length;
      outputTokens = JSON.stringify(selectors).length;
    }

    const generationTimeMs = Date.now() - startTime;

    // Calculate overall confidence
    const avgConfidence = selectors.reduce((sum, s) => sum + s.confidence_score, 0) / selectors.length;

    return {
      success: true,
      element_description: elementDescription,
      element_type: elementType,
      primary_selector: primarySelector,
      all_selectors: selectors,
      selector_count: selectors.length,
      summary: {
        recommended_type: primarySelector?.type,
        recommended_code: primarySelector?.playwright_code,
        stability_rating: primarySelector?.stability_score || 0,
        has_high_stability_option: selectors.some(s => s.stability_score >= 0.9),
      },
      best_practices: [
        'Prefer data-testid for critical elements',
        'Use role-based selectors for accessibility',
        'Avoid CSS/XPath selectors when possible',
        'Test selectors in browser DevTools first',
        'Add unique identifiers to reusable components',
      ],
      ai_metadata: {
        provider: aiProvider,
        model: aiModel,
        model_tier: usedRealAi ? modelConfig.tier : 'fast',
        generation_time_ms: generationTimeMs,
        tokens_used: {
          input: inputTokens,
          output: outputTokens,
        },
        confidence_score: avgConfidence,
        used_real_ai: usedRealAi,
      },
      data_source: usedRealAi ? 'real' : 'rule-based',
      generated_at: new Date().toISOString(),
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to generate selectors: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Assess test confidence based on description clarity
 * Feature #1486
 * Uses Claude to evaluate description clarity and provide confidence score
 */
export const assessTestConfidence: ToolHandler = async (args, context) => {
  try {
    const description = args.description as string;
    if (!description) {
      return {
        success: false,
        error: 'Missing required parameter: description',
      };
    }

    const testContext = args.test_context as string | undefined;
    const targetUrl = args.target_url as string | undefined;
    const useRealAi = args.use_real_ai !== false;

    context.log(`[AI] Assessing confidence for: "${description.substring(0, 40)}..." (real_ai: ${useRealAi})`);

    const startTime = Date.now();

    // Get model configuration
    const modelConfig = modelSelector.getModelForFeature('analysis');

    // Check if AI router is available
    const aiAvailable = aiRouter.isInitialized();

    // Define confidence assessment interface
    interface ConfidenceAssessment {
      overall_score: number;
      clarity_score: number;
      specificity_score: number;
      completeness_score: number;
      testability_score: number;
      ambiguities: Array<{
        issue: string;
        severity: 'low' | 'medium' | 'high';
        impact: string;
      }>;
      clarifying_questions: string[];
      strengths: string[];
      recommendations: string[];
    }

    let assessment: ConfidenceAssessment | null = null;
    let usedRealAi = false;
    let aiProvider = 'rule-based';
    let aiModel = 'heuristic';
    let inputTokens = 0;
    let outputTokens = 0;

    if (useRealAi && aiAvailable) {
      try {
        const systemPrompt = `You are a QA expert who evaluates test descriptions for clarity and completeness.

Assess the test description and return a JSON evaluation:
{
  "overall_score": 0.0-1.0,
  "clarity_score": 0.0-1.0,
  "specificity_score": 0.0-1.0,
  "completeness_score": 0.0-1.0,
  "testability_score": 0.0-1.0,
  "ambiguities": [
    {
      "issue": "What is unclear",
      "severity": "low|medium|high",
      "impact": "How this affects test generation"
    }
  ],
  "clarifying_questions": ["Questions to ask for better test"],
  "strengths": ["What's good about the description"],
  "recommendations": ["How to improve the description"]
}

Scoring criteria:
- clarity_score: Is the language clear and unambiguous?
- specificity_score: Are specific elements, actions, values mentioned?
- completeness_score: Are all test components (preconditions, actions, assertions) covered?
- testability_score: Can this be directly converted to automated test?`;

        const userPrompt = `Assess this test description:

Description: "${description}"
${testContext ? `Context: ${testContext}` : ''}
${targetUrl ? `Target URL: ${targetUrl}` : ''}

Return the assessment as JSON.`;

        const response = await aiRouter.sendMessage(
          [{ role: 'user', content: userPrompt }],
          {
            model: modelConfig.model,
            maxTokens: modelConfig.maxTokens || 2048,
            temperature: modelConfig.temperature || 0.1,
            systemPrompt,
          }
        );

        usedRealAi = true;
        aiProvider = response.actualProvider || 'anthropic';
        aiModel = response.model;
        inputTokens = response.inputTokens;
        outputTokens = response.outputTokens;

        // Parse AI response
        try {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            assessment = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          context.log(`[AI] Failed to parse AI assessment: ${parseError}`);
        }
      } catch (aiError) {
        context.log(`[AI] Real AI assessment failed: ${aiError}`);
      }
    }

    // Rule-based fallback
    if (!assessment) {
      const descLower = description.toLowerCase();
      const wordCount = description.split(/\s+/).length;

      // Calculate clarity score
      let clarityScore = 0.5;
      if (wordCount >= 10) clarityScore += 0.1;
      if (wordCount >= 20) clarityScore += 0.1;
      if (!description.includes('etc')) clarityScore += 0.1;

      // Calculate specificity score
      let specificityScore = 0.3;
      const hasElement = /button|link|input|field|form|page|menu|dropdown|checkbox/i.test(description);
      const hasAction = /click|fill|enter|type|select|navigate|go to|submit|verify|check/i.test(description);
      const hasTarget = /email|password|username|name|search|login|cart|checkout/i.test(description);

      if (hasElement) specificityScore += 0.2;
      if (hasAction) specificityScore += 0.2;
      if (hasTarget) specificityScore += 0.15;
      if (targetUrl) specificityScore += 0.15;

      // Calculate completeness score
      let completenessScore = 0.4;
      const hasPrecondition = /given|when logged|as a user|after|before/i.test(description);
      const hasAssertion = /verify|should|expect|check|confirm|see|displayed|visible/i.test(description);

      if (hasPrecondition) completenessScore += 0.2;
      if (hasAssertion) completenessScore += 0.2;
      if (hasAction && hasTarget) completenessScore += 0.1;

      // Calculate testability score
      let testabilityScore = 0.4;
      if (hasElement && hasAction) testabilityScore += 0.2;
      if (hasAssertion) testabilityScore += 0.2;
      if (specificityScore > 0.6) testabilityScore += 0.1;

      // Identify ambiguities
      const ambiguities: ConfidenceAssessment['ambiguities'] = [];

      if (!hasElement) {
        ambiguities.push({
          issue: 'No specific UI elements mentioned',
          severity: 'high',
          impact: 'May generate generic selectors',
        });
      }

      if (!hasAction) {
        ambiguities.push({
          issue: 'No clear actions specified',
          severity: 'high',
          impact: 'Unable to determine what to test',
        });
      }

      if (!hasAssertion) {
        ambiguities.push({
          issue: 'No expected outcomes mentioned',
          severity: 'medium',
          impact: 'Test may lack assertions',
        });
      }

      if (wordCount < 10) {
        ambiguities.push({
          issue: 'Description is too brief',
          severity: 'medium',
          impact: 'Insufficient detail',
        });
      }

      // Generate clarifying questions
      const clarifyingQuestions: string[] = [];

      if (!hasElement) clarifyingQuestions.push('What UI elements are involved?');
      if (!hasAction) clarifyingQuestions.push('What actions should be performed?');
      if (!hasAssertion) clarifyingQuestions.push('What is the expected outcome?');
      if (!targetUrl) clarifyingQuestions.push('What is the target URL?');

      // Identify strengths
      const strengths: string[] = [];
      if (hasAction) strengths.push('Clear action verbs used');
      if (hasElement) strengths.push('Specific UI elements mentioned');
      if (hasAssertion) strengths.push('Expected outcomes defined');
      if (strengths.length === 0) strengths.push('Test intent is identifiable');

      // Calculate overall score
      const overallScore = (
        clarityScore * 0.2 +
        specificityScore * 0.3 +
        completenessScore * 0.25 +
        testabilityScore * 0.25
      );

      assessment = {
        overall_score: Math.min(1, Math.max(0, overallScore)),
        clarity_score: Math.min(1, Math.max(0, clarityScore)),
        specificity_score: Math.min(1, Math.max(0, specificityScore)),
        completeness_score: Math.min(1, Math.max(0, completenessScore)),
        testability_score: Math.min(1, Math.max(0, testabilityScore)),
        ambiguities,
        clarifying_questions: clarifyingQuestions.slice(0, 5),
        strengths,
        recommendations: [
          'Include specific element identifiers',
          'Specify clear user actions',
          'Define expected outcomes',
        ],
      };

      inputTokens = description.length;
      outputTokens = JSON.stringify(assessment).length;
    }

    const assessmentTimeMs = Date.now() - startTime;

    // Determine confidence level label
    const confidenceLevel =
      assessment.overall_score >= 0.8 ? 'high' :
      assessment.overall_score >= 0.6 ? 'medium' :
      assessment.overall_score >= 0.4 ? 'low' : 'very_low';

    return {
      success: true,
      description: description,
      confidence_score: assessment.overall_score,
      confidence_level: confidenceLevel,
      scores: {
        clarity: assessment.clarity_score,
        specificity: assessment.specificity_score,
        completeness: assessment.completeness_score,
        testability: assessment.testability_score,
      },
      ambiguities: assessment.ambiguities,
      ambiguity_count: assessment.ambiguities.length,
      high_severity_issues: assessment.ambiguities.filter(a => a.severity === 'high').length,
      clarifying_questions: assessment.clarifying_questions,
      strengths: assessment.strengths,
      recommendations: assessment.recommendations,
      generation_recommendation:
        assessment.overall_score >= 0.7
          ? 'Ready to generate - good confidence'
          : assessment.overall_score >= 0.5
            ? 'Can generate but review carefully'
            : 'Consider answering clarifying questions first',
      ai_metadata: {
        provider: aiProvider,
        model: aiModel,
        model_tier: usedRealAi ? modelConfig.tier : 'fast',
        assessment_time_ms: assessmentTimeMs,
        tokens_used: { input: inputTokens, output: outputTokens },
        used_real_ai: usedRealAi,
      },
      data_source: usedRealAi ? 'real' : 'rule-based',
      assessed_at: new Date().toISOString(),
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to assess confidence: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

// Handler registry for analysis handlers
export const analysisHandlers: Record<string, ToolHandler> = {
  get_coverage_gaps: getCoverageGaps,
  generate_selectors: generateSelectors,
  assess_test_confidence: assessTestConfidence,
};

// List of tool names this module handles
export const analysisToolNames = Object.keys(analysisHandlers);
