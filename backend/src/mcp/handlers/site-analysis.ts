/**
 * Site Analysis MCP Tool Handler
 * Feature #1715: MCP tool that uses Crawl4AI to analyze websites for test generation
 */

import { ToolHandler, HandlerModule } from './types.js';
import { analyzeSite, type SiteAnalysis } from '../../services/crawl4ai.js';

/**
 * Analyze a website to understand its structure for test generation
 */
export const analyze_site: ToolHandler = async (args) => {
  const url = args.url as string;
  const includeLinks = args.include_links !== false;
  const includeForms = args.include_forms !== false;

  if (!url) {
    return { error: 'url is required', hint: 'Provide a URL to analyze (e.g., https://example.com)' };
  }

  // Normalize URL
  let normalizedUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    normalizedUrl = `https://${url}`;
  }

  try {
    const analysis = await analyzeSite(normalizedUrl);

    // Build response based on options
    const response: Record<string, unknown> = {
      url: analysis.url,
      title: analysis.title,
      pageType: analysis.pageType,
      hasLoginForm: analysis.hasLogin,
      hasSearchForm: analysis.hasSearch,
      hasCart: analysis.hasCart,
      hasForms: analysis.forms.length > 0,
      formCount: analysis.forms.length,
      navigation: {
        hasHeader: analysis.navigation.hasHeader,
        hasFooter: analysis.navigation.hasFooter,
        hasSidebar: analysis.navigation.hasSidebar,
        menuItems: analysis.navigation.menuItems.slice(0, 10),
      },
      inputFields: analysis.inputs.slice(0, 15).map(i => ({
        name: i.name, type: i.type, required: i.required,
      })),
      suggestedTests: analysis.suggestedTests,
      crawledAt: analysis.crawledAt,
    };

    if (includeForms && analysis.forms.length > 0) {
      response.forms = analysis.forms.slice(0, 5).map(f => ({
        id: f.id, action: f.action, method: f.method,
        fields: f.fields.slice(0, 10), submitButton: f.submitButton,
      }));
    }

    if (includeLinks) {
      response.links = {
        total: analysis.links.length,
        navigation: analysis.links.filter(l => l.isNavigation).slice(0, 10).map(l => l.text),
        external: analysis.links.filter(l => l.isExternal).length,
      };
    }

    response.buttons = analysis.buttons.slice(0, 10).map(b => b.text).filter(Boolean);

    return {
      success: true,
      crawler: 'Crawl4AI',  // Feature #1746: Explicitly mention Crawl4AI in response
      analysis: response,
      message: `🔍 Crawl4AI Analysis of ${normalizedUrl}: Found ${analysis.forms.length} forms, ${analysis.links.length} links, ${analysis.buttons.length} buttons.`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to analyze site: ${errorMessage}`,
      url: normalizedUrl,
    };
  }
};

// Handler registry
export const handlers: Record<string, ToolHandler> = {
  analyze_site,
};

export const toolNames = Object.keys(handlers);

export const siteAnalysisHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default siteAnalysisHandlers;
