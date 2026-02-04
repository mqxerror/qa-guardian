/**
 * Crawl4AI Service - Web scraper integration for site analysis
 * Feature #1714: Enables AI to understand site structure for test generation
 * Feature #1719: Credentials stored in environment config
 */

const CRAWL4AI_BASE_URL = process.env.CRAWL4AI_URL || 'http://38.97.60.181:11235';
const CRAWL4AI_TOKEN = process.env.CRAWL4AI_TOKEN || 'crawl4ai_secret_token';
const CRAWL_TIMEOUT = 30000;

// Feature #1719: Warn if using default credentials
if (!process.env.CRAWL4AI_URL || !process.env.CRAWL4AI_TOKEN) {
  console.warn('[Crawl4AI] Warning: CRAWL4AI_URL or CRAWL4AI_TOKEN not set in environment. Using default values.');
  console.warn('[Crawl4AI] Set these in .env for production: CRAWL4AI_URL, CRAWL4AI_TOKEN');
}

export interface CrawlResponse {
  success: boolean; url: string; html?: string; markdown?: string;
  links?: string[]; images?: string[]; error?: string;
}

export interface SiteAnalysis {
  url: string; title: string; forms: FormInfo[]; links: LinkInfo[];
  buttons: ButtonInfo[]; inputs: InputInfo[]; navigation: NavigationInfo;
  hasLogin: boolean; hasSearch: boolean; hasCart: boolean;
  pageType: 'homepage' | 'login' | 'signup' | 'product' | 'checkout' | 'search' | 'article' | 'unknown';
  suggestedTests: string[]; crawledAt: string;
}

export interface FormInfo { id: string; action: string; method: string; fields: string[]; submitButton: string; }
export interface LinkInfo { text: string; href: string; isExternal: boolean; isNavigation: boolean; }
export interface ButtonInfo { text: string; type?: string; isSubmit: boolean; }
export interface InputInfo { name?: string; type: string; placeholder?: string; label?: string; required: boolean; }
export interface NavigationInfo { hasHeader: boolean; hasFooter: boolean; hasSidebar: boolean; menuItems: string[]; }

/** Crawl a URL using Crawl4AI API */
export async function crawlUrl(url: string): Promise<CrawlResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT);
  try {
    const response = await fetch(`${CRAWL4AI_BASE_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CRAWL4AI_TOKEN}` },
      body: JSON.stringify({ urls: [url], include_raw_html: true, word_count_threshold: 10, bypass_cache: false }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Crawl4AI API error: ${response.status}`);
    const data = await response.json();
    return {
      success: true, url,
      html: data.results?.[0]?.html || data.html,
      markdown: data.results?.[0]?.markdown || data.markdown,
      links: data.results?.[0]?.links || [],
      images: data.results?.[0]?.images || [],
    };
  } catch (error) {
    clearTimeout(timeout);
    return { success: false, url, error: error instanceof Error ? error.message : 'Unknown crawl error' };
  }
}

/** Analyze a site and extract structured information for test generation */
export async function analyzeSite(url: string): Promise<SiteAnalysis> {
  const crawlResult = await crawlUrl(url);
  if (!crawlResult.success || !crawlResult.html) return createEmptyAnalysis(url, crawlResult.error);
  return parseHtmlForAnalysis(crawlResult.html, url);
}

function parseHtmlForAnalysis(html: string, url: string): SiteAnalysis {
  const analysis: SiteAnalysis = {
    url, title: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || 'Untitled',
    forms: extractForms(html), links: extractLinks(html, url),
    buttons: extractButtons(html), inputs: extractInputs(html),
    navigation: extractNavigation(html),
    hasLogin: /login|sign.?in|log.?in/i.test(html),
    hasSearch: /search/i.test(html) && /<input[^>]*type=["']?search/i.test(html),
    hasCart: /cart|basket|checkout|add.to.cart/i.test(html),
    pageType: detectPageType(url), suggestedTests: [], crawledAt: new Date().toISOString(),
  };
  analysis.suggestedTests = generateTestSuggestions(analysis);
  return analysis;
}

function extractForms(html: string): FormInfo[] {
  return [...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/gi)].slice(0, 10).map(m => {
    const formContent = m[1] || '';
    return {
      id: m[0].match(/id=["']?([^"'\s>]+)/)?.[1] || '',
      action: m[0].match(/action=["']?([^"'\s>]+)/)?.[1] || '',
      method: m[0].match(/method=["']?([^"'\s>]+)/i)?.[1] || 'GET',
      fields: [...formContent.matchAll(/<input[^>]*name=["']?([^"'\s>]+)/gi)].map(i => i[1] || '').filter(Boolean),
      submitButton: formContent.match(/<button[^>]*type=["']?submit[^>]*>([^<]*)/i)?.[1] || '',
    };
  });
}

function extractLinks(html: string, baseUrl: string): LinkInfo[] {
  const baseHost = new URL(baseUrl).hostname;
  // Match full <a> tags including nested content
  return [...html.matchAll(/<a\s+([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map(m => {
      const attrs = m[1] || '';
      const content = m[2] || '';

      // Extract href from attributes
      const hrefMatch = attrs.match(/href=["']?([^"'\s>]+)/i);
      const href = hrefMatch?.[1] || '';

      // Skip invalid links
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;

      // Priority 1: aria-label on the link itself
      const ariaLabel = attrs.match(/aria-label=["']([^"']+)["']/i)?.[1];

      // Priority 2: title attribute on the link
      const titleAttr = attrs.match(/title=["']([^"']+)["']/i)?.[1];

      // Priority 3: Extract text recursively from content
      const nestedText = extractNestedText(content);

      // Priority 4: Extract alt/title from nested images
      const imgAlt = content.match(/<img[^>]*alt=["']([^"']+)["']/i)?.[1];
      const imgTitle = content.match(/<img[^>]*title=["']([^"']+)["']/i)?.[1];

      // Priority 5: aria-label from nested elements
      const nestedAriaLabel = content.match(/aria-label=["']([^"']+)["']/i)?.[1];

      // Choose the best text, prioritizing explicit labels
      const text = (ariaLabel || titleAttr || nestedText || imgAlt || imgTitle || nestedAriaLabel || '').trim();

      return {
        text, href,
        isExternal: href.startsWith('http') && !href.includes(baseHost),
        isNavigation: /nav|menu|header/i.test(attrs) || /nav|menu|header/i.test(text),
      };
    })
    .filter((link): link is LinkInfo => link !== null && link.href.length > 0)
    .slice(0, 50);
}

/** Recursively extract visible text from HTML content, handling nested spans, divs, etc. */
function extractNestedText(html: string): string {
  // Remove script and style tags completely
  let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Remove SVG icons (common in modern menus)
  cleaned = cleaned.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  // Remove HTML tags but keep text content
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  // Normalize whitespace
  return cleaned.replace(/\s+/g, ' ').trim();
}

function extractButtons(html: string): ButtonInfo[] {
  return [...html.matchAll(/<button[^>]*>([^<]*)/gi)].slice(0, 20).map(m => ({
    text: m[1]?.trim() || '', isSubmit: /type=["']?submit/i.test(m[0]),
  }));
}

function extractInputs(html: string): InputInfo[] {
  return [...html.matchAll(/<input[^>]*/gi)].slice(0, 30).map(m => ({
    name: m[0].match(/name=["']?([^"'\s>]+)/)?.[1],
    type: m[0].match(/type=["']?([^"'\s>]+)/)?.[1] || 'text',
    placeholder: m[0].match(/placeholder=["']?([^"'>]+)/)?.[1],
    required: /required/i.test(m[0]),
  }));
}

function extractNavigation(html: string): NavigationInfo {
  return {
    hasHeader: /<header|<nav|role=["']?banner/i.test(html),
    hasFooter: /<footer|role=["']?contentinfo/i.test(html),
    hasSidebar: /<aside|sidebar/i.test(html),
    menuItems: [...html.matchAll(/<nav[^>]*>([\s\S]*?)<\/nav>/gi)]
      .flatMap(m => {
        const navContent = m[1] || '';
        // Extract full link content including nested elements
        return [...navContent.matchAll(/<a\s+([^>]*)>([\s\S]*?)<\/a>/gi)].map(a => {
          const attrs = a[1] || '';
          const content = a[2] || '';
          // Check aria-label first, then title, then nested text
          const ariaLabel = attrs.match(/aria-label=["']([^"']+)["']/i)?.[1];
          const titleAttr = attrs.match(/title=["']([^"']+)["']/i)?.[1];
          const nestedText = extractNestedText(content);
          return (ariaLabel || titleAttr || nestedText || '').trim();
        });
      })
      .filter(Boolean).slice(0, 20),
  };
}

function detectPageType(url: string): SiteAnalysis['pageType'] {
  const u = url.toLowerCase();
  if (/login|signin/i.test(u)) return 'login';
  if (/signup|register/i.test(u)) return 'signup';
  if (/product|item/i.test(u)) return 'product';
  if (/checkout|cart/i.test(u)) return 'checkout';
  if (/search/i.test(u)) return 'search';
  if (/article|blog|post/i.test(u)) return 'article';
  if (u.endsWith('/') || /\.(com|org|net|io)$/.test(u)) return 'homepage';
  return 'unknown';
}

function generateTestSuggestions(a: SiteAnalysis): string[] {
  const s = ['Page load and title verification'];
  if (a.hasLogin) s.push('Login form validation', 'Login with valid credentials', 'Login error handling');
  if (a.hasSearch) s.push('Search functionality', 'Search with no results');
  if (a.hasCart) s.push('Add to cart', 'Cart quantity update');
  if (a.forms.length > 0) s.push('Form submission', 'Form validation');
  if (a.navigation.menuItems.length > 0) s.push('Navigation menu links');
  return s.slice(0, 10);
}

function createEmptyAnalysis(url: string, error?: string): SiteAnalysis {
  return {
    url, title: error || 'Analysis Failed', forms: [], links: [], buttons: [], inputs: [],
    navigation: { hasHeader: false, hasFooter: false, hasSidebar: false, menuItems: [] },
    hasLogin: false, hasSearch: false, hasCart: false, pageType: 'unknown',
    suggestedTests: ['Manual page inspection required'], crawledAt: new Date().toISOString(),
  };
}

export default { crawlUrl, analyzeSite };
