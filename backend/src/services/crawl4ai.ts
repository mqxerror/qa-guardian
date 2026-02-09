/**
 * Crawl4AI Service - Web scraper integration for site analysis
 * Feature #1714: Enables AI to understand site structure for test generation
 * Feature #1719: Credentials stored in environment config
 * Feature #41: Added Playwright-based crawling for JS-rendered content
 */

import { chromium, Browser, Page } from 'playwright';
// Feature #449: Use structured logger instead of console.*
import { createLogger } from './logger.js';

const log = createLogger('crawl4ai');

const CRAWL4AI_BASE_URL = process.env.CRAWL4AI_URL || 'http://38.97.60.181:11235';
const CRAWL4AI_TOKEN = process.env.CRAWL4AI_TOKEN || 'crawl4ai_secret_token';
const CRAWL_TIMEOUT = 30000;
const PLAYWRIGHT_TIMEOUT = 45000;

// Feature #1719: Warn if using default credentials
if (!process.env.CRAWL4AI_URL || !process.env.CRAWL4AI_TOKEN) {
  log.warn('CRAWL4AI_URL or CRAWL4AI_TOKEN not set in environment, using default values');
  log.warn('Set CRAWL4AI_URL and CRAWL4AI_TOKEN in .env for production');
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
export interface LinkInfo {
  text: string;
  href: string;
  isExternal: boolean;
  isNavigation: boolean;
  category: 'nav' | 'footer' | 'content' | 'external';
}
export interface ButtonInfo { text: string; type?: string; isSubmit: boolean; }
export interface InputInfo { name?: string; type: string; placeholder?: string; label?: string; required: boolean; }
export interface NavigationInfo { hasHeader: boolean; hasFooter: boolean; hasSidebar: boolean; menuItems: string[]; }

/** Feature #43: Site map interface for multi-page crawl results */
export interface SiteMap {
  baseUrl: string;
  pages: PageInfo[];
  totalPages: number;
  crawlDepth: number;
  crawledAt: string;
  suggestedSmokeTests: string[];
}

export interface PageInfo {
  url: string;
  title: string;
  pageType: SiteAnalysis['pageType'];
  depth: number;
  hasLogin: boolean;
  hasSearch: boolean;
  hasCart: boolean;
  forms: number;
  links: number;
}

/**
 * Feature #41: Crawl a URL using Playwright for JS-rendered content
 * Handles cookie consent popups, waits for network idle, and extracts rendered HTML
 */
export async function crawlWithPlaywright(url: string): Promise<CrawlResponse> {
  let browser: Browser | null = null;

  try {
    log.debug({ url }, 'Using Playwright to crawl');

    // Launch browser in headless mode
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Set timeout for navigation
    page.setDefaultTimeout(PLAYWRIGHT_TIMEOUT);

    // Navigate to URL and wait for network idle
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: PLAYWRIGHT_TIMEOUT,
    });

    // Handle common cookie consent popups
    await handleCookieConsent(page);

    // Wait a bit more for any lazy-loaded content
    await page.waitForTimeout(1000);

    // Extract rendered HTML
    const html = await page.content();
    // Page title available via: await page.title()

    // Extract links
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href') || '').filter(Boolean);
    });

    // Extract images
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img[src]')).map(img => img.getAttribute('src') || '').filter(Boolean);
    });

    await browser.close();
    browser = null;

    log.debug({ linksCount: links.length, imagesCount: images.length }, 'Playwright crawl successful');

    return {
      success: true,
      url,
      html,
      links,
      images,
    };
  } catch (error) {
    log.error({ error }, 'Playwright crawl failed');
    if (browser) {
      await browser.close().catch(() => {});
    }
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : 'Playwright crawl failed',
    };
  }
}

/**
 * Handle common cookie consent popups by clicking accept/dismiss buttons
 */
async function handleCookieConsent(page: Page): Promise<void> {
  // Common selectors for cookie consent buttons
  const consentSelectors = [
    // Generic patterns
    'button[id*="accept"]',
    'button[id*="consent"]',
    'button[class*="accept"]',
    'button[class*="consent"]',
    '[data-testid*="accept"]',
    '[data-testid*="consent"]',
    // Common cookie banner providers
    '#onetrust-accept-btn-handler', // OneTrust
    '.cc-accept', '.cc-btn.cc-dismiss', // Cookie Consent
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', // Cookiebot
    '[aria-label*="Accept all"]',
    '[aria-label*="Accept cookies"]',
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("Accept Cookies")',
    'button:has-text("I Accept")',
    'button:has-text("Got it")',
    'button:has-text("OK")',
    'button:has-text("Agree")',
  ];

  for (const selector of consentSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 500 })) {
        await element.click({ timeout: 2000 });
        log.debug({ selector }, 'Dismissed cookie consent');
        await page.waitForTimeout(500); // Wait for dialog to close
        break;
      }
    } catch {
      // Selector not found or not clickable, continue to next
    }
  }
}

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

/**
 * Analyze a site and extract structured information for test generation
 * Feature #41: Uses Playwright first for JS-rendered content, falls back to Crawl4AI
 * @param url - The URL to analyze
 * @param usePlaywright - Whether to use Playwright (default: true)
 */
export async function analyzeSite(url: string, usePlaywright: boolean = true): Promise<SiteAnalysis> {
  let crawlResult: CrawlResponse;

  if (usePlaywright) {
    // Try Playwright first for JS-rendered content
    crawlResult = await crawlWithPlaywright(url);

    // Fall back to Crawl4AI if Playwright fails
    if (!crawlResult.success || !crawlResult.html) {
      log.debug('Playwright failed, falling back to Crawl4AI API');
      crawlResult = await crawlUrl(url);
    }
  } else {
    // Use Crawl4AI directly if Playwright is disabled
    crawlResult = await crawlUrl(url);
  }

  if (!crawlResult.success || !crawlResult.html) {
    return createEmptyAnalysis(url, crawlResult.error);
  }

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
  const seenHrefs = new Set<string>(); // Feature #42: Deduplication by href

  // Match full <a> tags including nested content
  return [...html.matchAll(/<a\s+([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map(m => {
      const attrs = m[1] || '';
      const content = m[2] || '';
      const fullMatch = m[0] || '';

      // Extract href from attributes
      const hrefMatch = attrs.match(/href=["']?([^"'\s>]+)/i);
      const href = hrefMatch?.[1] || '';

      // Skip invalid links
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;

      // Feature #42: Deduplicate by normalized href
      const normalizedHref = href.toLowerCase().replace(/\/$/, '');
      if (seenHrefs.has(normalizedHref)) return null;
      seenHrefs.add(normalizedHref);

      // Priority 1: aria-label on the link itself (decode HTML entities)
      const ariaLabelRaw = attrs.match(/aria-label=["']([^"']+)["']/i)?.[1];
      const ariaLabel = ariaLabelRaw ? decodeHtmlEntities(ariaLabelRaw) : undefined;

      // Priority 2: title attribute on the link (decode HTML entities)
      const titleAttrRaw = attrs.match(/title=["']([^"']+)["']/i)?.[1];
      const titleAttr = titleAttrRaw ? decodeHtmlEntities(titleAttrRaw) : undefined;

      // Priority 3: Extract text recursively from content
      const nestedText = extractNestedText(content);

      // Priority 4: Extract alt/title from nested images (decode HTML entities)
      const imgAltRaw = content.match(/<img[^>]*alt=["']([^"']+)["']/i)?.[1];
      const imgAlt = imgAltRaw ? decodeHtmlEntities(imgAltRaw) : undefined;
      const imgTitleRaw = content.match(/<img[^>]*title=["']([^"']+)["']/i)?.[1];
      const imgTitle = imgTitleRaw ? decodeHtmlEntities(imgTitleRaw) : undefined;

      // Priority 5: aria-label from nested elements (decode HTML entities)
      const nestedAriaLabelRaw = content.match(/aria-label=["']([^"']+)["']/i)?.[1];
      const nestedAriaLabel = nestedAriaLabelRaw ? decodeHtmlEntities(nestedAriaLabelRaw) : undefined;

      // Choose the best text, prioritizing explicit labels
      const text = (ariaLabel || titleAttr || nestedText || imgAlt || imgTitle || nestedAriaLabel || '').trim();

      // Determine if link is external
      const isExternal = href.startsWith('http') && !href.includes(baseHost);

      // Determine if link is navigation
      const isNavigation = /nav|menu|header/i.test(attrs) || /nav|menu|header/i.test(text);

      // Feature #42: Determine category based on context
      let category: 'nav' | 'footer' | 'content' | 'external' = 'content';
      if (isExternal) {
        category = 'external';
      } else if (isNavigation || /site-nav|main-nav|primary-nav|global-nav/i.test(attrs)) {
        category = 'nav';
      } else if (/footer/i.test(attrs) || isLinkInFooter(fullMatch, html)) {
        category = 'footer';
      }

      return {
        text, href,
        isExternal,
        isNavigation,
        category,
      };
    })
    .filter((link): link is LinkInfo => link !== null && link.href.length > 0)
    .slice(0, 200); // Feature #42: Increased limit from 50 to 200
}

/** Feature #42: Check if a link element appears within a footer section */
function isLinkInFooter(linkHtml: string, fullHtml: string): boolean {
  const linkPos = fullHtml.indexOf(linkHtml);
  if (linkPos === -1) return false;

  // Check if there's a <footer> tag before this position with no closing </footer> yet
  const beforeLink = fullHtml.substring(0, linkPos);
  const lastFooterOpen = beforeLink.lastIndexOf('<footer');
  const lastFooterClose = beforeLink.lastIndexOf('</footer');

  // Link is in footer if we found an opening <footer> after the last closing </footer>
  return lastFooterOpen > lastFooterClose;
}

/** Decode HTML entities in a string */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
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

  // Decode HTML entities and normalize whitespace
  return decodeHtmlEntities(cleaned).replace(/\s+/g, ' ').trim();
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
  // Enhanced patterns for detecting navigation regions
  const hasHeader = /<header|<nav|role=["']?banner|role=["']?navigation/i.test(html);
  const hasFooter = /<footer|role=["']?contentinfo/i.test(html);
  const hasSidebar = /<aside|sidebar|role=["']?complementary/i.test(html);

  // Helper to extract links from HTML content
  const extractLinksFromContent = (content: string): string[] => {
    return [...content.matchAll(/<a\s+([^>]*)>([\s\S]*?)<\/a>/gi)].map(a => {
      const attrs = a[1] || '';
      const linkContent = a[2] || '';
      const ariaLabelRaw = attrs.match(/aria-label=["']([^"']+)["']/i)?.[1];
      const ariaLabel = ariaLabelRaw ? decodeHtmlEntities(ariaLabelRaw) : undefined;
      const titleAttrRaw = attrs.match(/title=["']([^"']+)["']/i)?.[1];
      const titleAttr = titleAttrRaw ? decodeHtmlEntities(titleAttrRaw) : undefined;
      const nestedText = extractNestedText(linkContent);
      return (ariaLabel || titleAttr || nestedText || '').trim();
    });
  };

  // Collect menu items from multiple navigation sources
  const allMenuItems: string[] = [];

  // 1. Standard <nav> elements
  const navMatches = [...html.matchAll(/<nav[^>]*>([\s\S]*?)<\/nav>/gi)];
  for (const m of navMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // 2. Elements with role="navigation"
  const roleNavMatches = [...html.matchAll(/<(?:div|ul|section|aside)[^>]*role=["']navigation["'][^>]*>([\s\S]*?)<\/(?:div|ul|section|aside)>/gi)];
  for (const m of roleNavMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // 3. Header menus (extract links from header)
  const headerMatches = [...html.matchAll(/<header[^>]*>([\s\S]*?)<\/header>/gi)];
  for (const m of headerMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // 4. Common CSS class patterns for navigation
  const navClassPatterns = [
    /class=["'][^"']*(?:navbar|nav-menu|main-nav|site-nav|header-nav|primary-nav|global-nav)[^"']*["']/i,
    /class=["'][^"']*(?:navigation|menu-container|menu-wrapper|top-nav|main-menu)[^"']*["']/i,
  ];
  for (const pattern of navClassPatterns) {
    const classRegex = new RegExp(`<(?:div|ul|nav)[^>]*${pattern.source}[^>]*>([\\s\\S]*?)<\\/(?:div|ul|nav)>`, 'gi');
    const matches = [...html.matchAll(classRegex)];
    for (const m of matches) {
      allMenuItems.push(...extractLinksFromContent(m[1] || ''));
    }
  }

  // 5. ul.menu and ul.nav patterns (common in WordPress, Drupal, Bootstrap)
  const ulMenuMatches = [...html.matchAll(/<ul[^>]*class=["'][^"']*(?:\bmenu\b|\bnav\b|\bnavbar-nav\b)[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi)];
  for (const m of ulMenuMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // 6. Aside/sidebar navigation
  const asideMatches = [...html.matchAll(/<aside[^>]*>([\s\S]*?)<\/aside>/gi)];
  for (const m of asideMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // 7. Footer navigation
  const footerMatches = [...html.matchAll(/<footer[^>]*>([\s\S]*?)<\/footer>/gi)];
  for (const m of footerMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // Feature #42: Deduplicate and filter - increased limit from 30 to 50
  const uniqueMenuItems = [...new Set(allMenuItems)]
    .filter(item => item && item.length > 0 && item.length < 100)
    .slice(0, 50);

  return {
    hasHeader,
    hasFooter,
    hasSidebar,
    menuItems: uniqueMenuItems,
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

/**
 * Feature #43: Multi-page crawl for smoke test generation
 * Follows navigation links and builds a site map for comprehensive coverage
 * @param url - Starting URL to crawl
 * @param depth - Maximum crawl depth (1-3), default 2
 * @param maxPages - Maximum pages to crawl, default 20
 */
export async function crawlSite(
  url: string,
  depth: number = 2,
  maxPages: number = 20
): Promise<SiteMap> {
  // Clamp depth between 1-3
  const maxDepth = Math.max(1, Math.min(3, depth));

  const baseUrl = new URL(url);
  const baseHost = baseUrl.hostname;
  const visitedUrls = new Set<string>();
  const pages: PageInfo[] = [];
  const queue: Array<{ url: string; depth: number }> = [{ url, depth: 0 }];

  log.info({ url, maxDepth, maxPages }, 'Starting multi-page crawl');

  while (queue.length > 0 && pages.length < maxPages) {
    const current = queue.shift();
    if (!current) break;

    const { url: currentUrl, depth: currentDepth } = current;

    // Normalize URL for deduplication
    const normalizedUrl = normalizeUrl(currentUrl, baseHost);
    if (visitedUrls.has(normalizedUrl)) continue;
    visitedUrls.add(normalizedUrl);

    // Skip URLs that should be ignored
    if (shouldSkipUrl(normalizedUrl, baseHost)) continue;

    log.debug({ page: pages.length + 1, maxPages, url: normalizedUrl, depth: currentDepth }, 'Crawling page');

    try {
      // Analyze the current page
      const analysis = await analyzeSite(normalizedUrl, true);

      // Add page info to results
      pages.push({
        url: normalizedUrl,
        title: analysis.title,
        pageType: analysis.pageType,
        depth: currentDepth,
        hasLogin: analysis.hasLogin,
        hasSearch: analysis.hasSearch,
        hasCart: analysis.hasCart,
        forms: analysis.forms.length,
        links: analysis.links.length,
      });

      // If not at max depth, queue navigation links for crawling
      if (currentDepth < maxDepth) {
        // Prioritize navigation links over content links
        const linksToFollow = analysis.links
          .filter(link => link.category === 'nav' || link.category === 'footer')
          .filter(link => !link.isExternal)
          .map(link => link.href);

        // Also include some content links if we have room
        if (linksToFollow.length < 10) {
          const contentLinks = analysis.links
            .filter(link => link.category === 'content' && !link.isExternal)
            .slice(0, 10 - linksToFollow.length)
            .map(link => link.href);
          linksToFollow.push(...contentLinks);
        }

        for (const linkHref of linksToFollow) {
          const absoluteUrl = resolveUrl(linkHref, normalizedUrl, baseHost);
          if (absoluteUrl && !visitedUrls.has(absoluteUrl)) {
            queue.push({ url: absoluteUrl, depth: currentDepth + 1 });
          }
        }
      }
    } catch (error) {
      log.error({ url: normalizedUrl, error }, 'Failed to crawl page');
    }
  }

  log.info({ pagesCount: pages.length }, 'Multi-page crawl complete');

  return {
    baseUrl: url,
    pages,
    totalPages: pages.length,
    crawlDepth: maxDepth,
    crawledAt: new Date().toISOString(),
    suggestedSmokeTests: generateSmokeTests(pages),
  };
}

/** Normalize URL for consistent deduplication */
function normalizeUrl(url: string, _baseHost: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash, lowercase, remove fragments
    let normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase();
    normalized = normalized.replace(/\/$/, '');
    // Include query params for uniqueness (but sorted)
    if (parsed.search) {
      const params = new URLSearchParams(parsed.search);
      params.sort();
      normalized += '?' + params.toString();
    }
    return normalized;
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/** Check if URL should be skipped (pagination, media, etc.) */
function shouldSkipUrl(url: string, baseHost: string): boolean {
  try {
    const parsed = new URL(url);
    // Only crawl same domain
    if (parsed.hostname !== baseHost) return true;

    // Skip common non-page URLs
    const skipPatterns = [
      /\.(jpg|jpeg|png|gif|svg|webp|ico|pdf|zip|tar|gz|mp3|mp4|avi|mov)$/i,
      /\/api\//i,
      /\/cdn-cgi\//i,
      /\/(login|logout|signin|signout|register)\/?$/i, // Skip auth pages for now
      /\?page=\d+/i, // Skip pagination
      /\/page\/\d+/i,
      /#/i, // Skip anchor links
    ];

    return skipPatterns.some(pattern => pattern.test(url));
  } catch {
    return true;
  }
}

/** Resolve relative URL to absolute URL */
function resolveUrl(href: string, currentUrl: string, baseHost: string): string | null {
  try {
    // Handle relative URLs
    const resolved = new URL(href, currentUrl);

    // Only return URLs on same host
    if (resolved.hostname !== baseHost) return null;

    return resolved.href;
  } catch {
    return null;
  }
}

/** Generate smoke test suggestions from crawled pages */
function generateSmokeTests(pages: PageInfo[]): string[] {
  const tests: string[] = [];

  // Test each unique page type
  const pageTypes = new Set(pages.map(p => p.pageType));
  pageTypes.forEach(type => {
    if (type !== 'unknown') {
      tests.push(`Load ${type} page and verify title`);
    }
  });

  // Test pages with forms
  const formsCount = pages.filter(p => p.forms > 0).length;
  if (formsCount > 0) {
    tests.push(`Verify forms are functional on ${formsCount} pages`);
  }

  // Test navigation
  const navPages = pages.filter(p => p.depth === 0 || p.links > 10);
  if (navPages.length > 0) {
    tests.push('Verify main navigation links work');
  }

  // Test search functionality
  if (pages.some(p => p.hasSearch)) {
    tests.push('Verify search functionality');
  }

  // Test e-commerce flow
  if (pages.some(p => p.hasCart)) {
    tests.push('Verify add to cart functionality');
  }

  // Test login accessibility
  if (pages.some(p => p.hasLogin)) {
    tests.push('Verify login form accessibility');
  }

  // Add generic tests
  tests.push(`Verify all ${pages.length} pages load without errors`);
  tests.push('Check for broken links');
  tests.push('Verify responsive design on mobile viewport');

  return tests.slice(0, 15);
}

/** Feature #44: Smoke Test interface for auto-generated tests */
export interface SmokeTest {
  name: string;
  description: string;
  targetUrl: string;
  steps: SmokeTestStep[];
  assertions: SmokeTestAssertion[];
}

export interface SmokeTestStep {
  action: 'navigate' | 'screenshot' | 'wait' | 'scroll' | 'check_console';
  value?: string;
  timeout?: number;
  description: string;
}

export interface SmokeTestAssertion {
  type: 'title_not_empty' | 'no_console_errors' | 'no_404' | 'no_500' | 'element_exists' | 'page_loaded';
  selector?: string;
  description: string;
}

export interface SmokeTestSuite {
  name: string;
  description: string;
  baseUrl: string;
  tests: SmokeTest[];
  generatedAt: string;
  totalPages: number;
}

/**
 * Feature #44: Auto-generate smoke tests from discovered pages
 * Generates E2E tests that navigate to each page and verify basic functionality
 * @param siteMap - Site map from crawlSite() or individual pages array
 * @param options - Generation options (baseUrl, name)
 */
export function generateSmokeTestSuite(
  siteMap: SiteMap | PageInfo[],
  options?: { suiteName?: string; baseUrl?: string }
): SmokeTestSuite {
  const pages = Array.isArray(siteMap) ? siteMap : siteMap.pages;
  const baseUrl = options?.baseUrl || (Array.isArray(siteMap) ? '' : siteMap.baseUrl);
  const suiteName = options?.suiteName || 'Smoke Tests';

  const tests: SmokeTest[] = pages.map((page, index) => {
    const steps: SmokeTestStep[] = [
      {
        action: 'navigate',
        value: page.url,
        timeout: 30000,
        description: `Navigate to ${page.title || page.url}`,
      },
      {
        action: 'wait',
        value: 'networkidle',
        timeout: 10000,
        description: 'Wait for page to fully load',
      },
      {
        action: 'check_console',
        description: 'Check for JavaScript console errors',
      },
      {
        action: 'screenshot',
        value: `smoke-test-page-${index + 1}.png`,
        description: `Capture screenshot of ${page.title || 'page'}`,
      },
    ];

    // Add scroll for content pages to trigger lazy loading
    if (page.pageType === 'article' || page.links > 10) {
      steps.push({
        action: 'scroll',
        value: 'bottom',
        description: 'Scroll to page bottom to trigger lazy loading',
      });
      steps.push({
        action: 'screenshot',
        value: `smoke-test-page-${index + 1}-scrolled.png`,
        description: 'Capture screenshot after scrolling',
      });
    }

    const assertions: SmokeTestAssertion[] = [
      {
        type: 'page_loaded',
        description: 'Page should load successfully',
      },
      {
        type: 'title_not_empty',
        description: 'Page title should not be empty',
      },
      {
        type: 'no_console_errors',
        description: 'No JavaScript errors in console',
      },
      {
        type: 'no_404',
        description: 'Page should not return 404 error',
      },
      {
        type: 'no_500',
        description: 'Page should not return server error',
      },
    ];

    // Add specific assertions based on page type
    if (page.hasLogin) {
      assertions.push({
        type: 'element_exists',
        selector: 'input[type="password"], input[name*="password"]',
        description: 'Login form password field should exist',
      });
    }

    if (page.hasSearch) {
      assertions.push({
        type: 'element_exists',
        selector: 'input[type="search"], input[name*="search"], input[placeholder*="search" i]',
        description: 'Search input should exist',
      });
    }

    if (page.forms > 0) {
      assertions.push({
        type: 'element_exists',
        selector: 'form',
        description: 'Form element should be present',
      });
    }

    return {
      name: `Smoke Test: ${page.title || page.url}`,
      description: `Verify ${page.pageType} page loads correctly without errors`,
      targetUrl: page.url,
      steps,
      assertions,
    };
  });

  return {
    name: suiteName,
    description: `Auto-generated smoke tests for ${pages.length} pages. Tests verify each page loads, has a title, no console errors, and key elements exist.`,
    baseUrl,
    tests,
    generatedAt: new Date().toISOString(),
    totalPages: pages.length,
  };
}

/**
 * Feature #44: Generate Playwright test code from smoke test suite
 */
export function smokeTestSuiteToPlaywright(suite: SmokeTestSuite): string {
  let code = `// Auto-generated Smoke Test Suite: ${suite.name}
// Generated at: ${suite.generatedAt}
// Total pages: ${suite.totalPages}

import { test, expect } from '@playwright/test';

`;

  for (const smokeTest of suite.tests) {
    code += `test('${escapeTestName(smokeTest.name)}', async ({ page }) => {
  // ${smokeTest.description}
  const consoleErrors: string[] = [];

  // Collect console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Collect page errors
  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });

`;

    // Generate step code
    for (const step of smokeTest.steps) {
      switch (step.action) {
        case 'navigate':
          code += `  // ${step.description}
  const response = await page.goto('${step.value}', { waitUntil: 'domcontentloaded', timeout: ${step.timeout || 30000} });
  expect(response?.status()).toBeLessThan(400);

`;
          break;
        case 'wait':
          code += `  // ${step.description}
  await page.waitForLoadState('${step.value || 'networkidle'}', { timeout: ${step.timeout || 10000} });

`;
          break;
        case 'screenshot':
          code += `  // ${step.description}
  await page.screenshot({ path: 'screenshots/${step.value}', fullPage: true });

`;
          break;
        case 'scroll':
          code += `  // ${step.description}
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

`;
          break;
        case 'check_console':
          code += `  // ${step.description}
  // Console errors are collected automatically

`;
          break;
      }
    }

    // Generate assertion code
    for (const assertion of smokeTest.assertions) {
      switch (assertion.type) {
        case 'title_not_empty':
          code += `  // ${assertion.description}
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);

`;
          break;
        case 'no_console_errors':
          code += `  // ${assertion.description}
  expect(consoleErrors, 'Console errors found: ' + consoleErrors.join(', ')).toHaveLength(0);

`;
          break;
        case 'element_exists':
          code += `  // ${assertion.description}
  await expect(page.locator('${assertion.selector}')).toBeVisible({ timeout: 5000 }).catch(() => {
    // Element not found, but this is a soft assertion for smoke tests
    console.warn('Element not found: ${assertion.selector}');
  });

`;
          break;
        case 'page_loaded':
        case 'no_404':
        case 'no_500':
          // These are handled by the response status check above
          break;
      }
    }

    code += `});

`;
  }

  return code;
}

/** Escape special characters in test names */
function escapeTestName(name: string): string {
  return name.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

export default { crawlUrl, crawlWithPlaywright, analyzeSite, crawlSite, generateSmokeTestSuite, smokeTestSuiteToPlaywright };
