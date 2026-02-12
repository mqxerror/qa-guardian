/**
 * Quick Test Wave 4: AI Analysis
 * Feature #679: Extracted from quick-test-runner.ts
 *
 * AI-powered test suggestions, UX issues, accessibility recommendations (5-10s)
 * Feature #467: Optional vision capability with screenshot analysis
 * Feature #520: Graceful degradation when AI provider not configured
 */

import { aiService } from '../ai-service.js';
import { createLogger } from '../logger.js';
import type { HealthCheckResult, VisualPerformanceResult, SecurityScanResult, AIAnalysisResult } from './types.js';

const log = createLogger('quick-test-ai-analysis');

/**
 * Feature #467: Run AI analysis with optional vision capability
 * If desktop screenshot is available, passes it to Claude Vision for
 * dramatically better UX and visual analysis recommendations.
 */
export async function runAIAnalysis(
  url: string,
  healthResult: HealthCheckResult,
  visualResult: VisualPerformanceResult,
  securityResult: SecurityScanResult
): Promise<AIAnalysisResult> {
  const result: AIAnalysisResult = {
    testSuggestions: [],
    uxIssues: [],
    accessibilityRecommendations: [],
    summary: '',
    visionAnalysisIncluded: false,
  };

  try {
    // Feature #520: Graceful degradation when AI provider not configured
    if (!aiService.isConfigured()) {
      log.info('AI provider not configured - skipping AI analysis wave');
      result.summary = 'AI provider not configured. Add an AI API key in Settings → AI Configuration to enable AI-powered analysis.';
      (result as unknown as Record<string, unknown>).skipped = true;
      (result as unknown as Record<string, unknown>).skipReason = 'no_api_key';
      return result;
    }

    if (!aiService.isInitialized()) {
      log.warn('AI service not initialized despite having config - skipping AI analysis wave');
      result.summary = 'AI service could not initialize. Check your API key configuration in Settings → AI Configuration.';
      (result as unknown as Record<string, unknown>).skipped = true;
      (result as unknown as Record<string, unknown>).skipReason = 'initialization_failed';
      return result;
    }

    // Feature #467: Check if we have a desktop screenshot for vision analysis
    const hasScreenshot = !!visualResult.screenshots.desktop;

    // Build the metrics-based context (always included)
    const metricsContext = `## URL Analyzed
${url}

## Health Check Results
- DNS Resolution: ${healthResult.dns.resolved ? 'Success' : 'Failed'}
- HTTP Status: ${healthResult.http.status} ${healthResult.http.statusText}
- SSL Valid: ${healthResult.ssl?.valid ?? 'N/A'}
- Response Time: ${healthResult.totalDurationMs}ms

## Performance Results
- Load Time: ${visualResult.loadTime}ms
- TTFB: ${visualResult.coreWebVitals?.ttfb ?? 'N/A'}ms
- FCP: ${visualResult.coreWebVitals?.fcp ?? 'N/A'}ms
- LCP: ${visualResult.coreWebVitals?.lcp ?? 'N/A'}ms
- Performance Score: ${visualResult.performanceScores?.performance ?? 'N/A'}

## Security Results
- Security Header Score: ${securityResult.headers.score}/100
- Missing Headers: ${securityResult.headers.missing.join(', ') || 'None'}
- Cookies with Issues: ${securityResult.cookies.filter(c => c.issues.length > 0).length}
- Mixed Content: ${securityResult.mixedContent.detected ? 'Detected' : 'None'}
- Exposed Paths: ${securityResult.exposedPaths.filter(p => p.accessible).map(p => p.path).join(', ') || 'None'}`;

    // Feature #467: Build prompt with vision-specific instructions if screenshot available
    const visionInstructions = hasScreenshot ? `
## IMPORTANT: Visual Analysis Instructions
I'm providing a screenshot of this webpage. Please analyze it visually and identify:
1. **Visual Hierarchy Issues**: Poor contrast, hard-to-read text, unclear CTAs, confusing layout
2. **UX Problems**: Cluttered interface, missing visual feedback, poor spacing, accessibility concerns
3. **Layout Anomalies**: Misaligned elements, broken layouts, overlapping content, responsive issues
4. **Design Recommendations**: Improvements for user experience based on what you see

When providing recommendations, include "source": "vision" for insights based on the screenshot visual analysis, and "source": "metrics" for insights based on the performance/security data above.` : '';

    const outputFormat = `
## Required JSON Response Format
Respond with ONLY valid JSON (no markdown, no explanation):
{
  "testSuggestions": [
    {"type": "e2e"|"visual"|"accessibility"|"performance", "name": "string", "description": "string", "priority": "high"|"medium"|"low", "source": "vision"|"metrics"}
  ],
  "uxIssues": [
    {"severity": "critical"|"major"|"minor", "issue": "string", "recommendation": "string", "source": "vision"|"metrics"}
  ],
  "accessibilityRecommendations": [
    {"recommendation": "string", "source": "vision"|"metrics"}
  ],
  "summary": "Brief summary of findings (1-2 sentences)"
}`;

    const prompt = `Analyze this website and provide test recommendations and UX insights.

${metricsContext}
${visionInstructions}
${outputFormat}`;

    // Feature #467: Build message content with optional vision
    let messageContent: string | Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } }>;

    if (hasScreenshot && visualResult.screenshots.desktop) {
      log.info({ url }, 'Including desktop screenshot in AI analysis (vision mode)');
      messageContent = [
        {
          type: 'text' as const,
          text: prompt,
        },
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: 'image/png' as const,
            data: visualResult.screenshots.desktop,
          },
        },
      ];
      result.visionAnalysisIncluded = true;
    } else {
      log.info({ url }, 'No screenshot available, using metrics-only AI analysis');
      messageContent = prompt;
    }

    const response = await aiService.sendMessage([
      { role: 'user', content: messageContent }
    ], {
      maxTokens: 2000, // Increased for vision analysis
    });

    if (response.content) {
      try {
        // Try to parse as JSON
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          // Process test suggestions with source tagging
          result.testSuggestions = (parsed.testSuggestions || []).map((s: {
            type: 'e2e' | 'visual' | 'accessibility' | 'performance';
            name: string;
            description: string;
            priority: 'high' | 'medium' | 'low';
            source?: 'vision' | 'metrics';
          }) => ({
            ...s,
            source: s.source || 'metrics', // Default to metrics if not specified
          }));

          // Process UX issues with source tagging
          result.uxIssues = (parsed.uxIssues || []).map((u: {
            severity: 'critical' | 'major' | 'minor';
            issue: string;
            recommendation: string;
            source?: 'vision' | 'metrics';
          }) => ({
            ...u,
            source: u.source || 'metrics',
          }));

          // Process accessibility recommendations (handle both array of strings and objects)
          const rawAccessibility = parsed.accessibilityRecommendations || [];
          result.accessibilityRecommendations = rawAccessibility.map((r: string | { recommendation: string; source?: 'vision' | 'metrics' }) => {
            if (typeof r === 'string') {
              return { recommendation: r, source: 'metrics' as const };
            }
            return { ...r, source: r.source || 'metrics' };
          });

          result.summary = parsed.summary || '';
        }
      } catch (parseError) {
        // If JSON parsing fails, use the response as summary
        log.warn({ error: parseError }, 'Failed to parse AI response as JSON');
        result.summary = response.content.substring(0, 200);
      }
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    log.error({ error: err }, 'AI analysis wave error');
    // Feature #520: User-friendly error messages
    if (errMsg.includes('401') || errMsg.includes('unauthorized') || errMsg.includes('invalid_api_key')) {
      result.summary = 'AI API key is invalid or expired. Update your key in Settings → AI Configuration.';
    } else if (errMsg.includes('429') || errMsg.includes('rate_limit')) {
      result.summary = 'AI provider rate limit reached. Please wait a moment and try again.';
    } else if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) {
      result.summary = 'AI provider timed out. The service may be temporarily slow.';
    } else {
      result.summary = `AI analysis encountered an error: ${errMsg.substring(0, 100)}`;
    }
  }

  return result;
}
