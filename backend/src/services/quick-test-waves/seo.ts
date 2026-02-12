/**
 * Quick Test Wave 7: SEO Analysis
 * Feature #682: Extracted from quick-test-runner.ts
 *
 * Meta tags, heading hierarchy, robots.txt, sitemap.xml (5-15s)
 * Feature #527: SEO Analysis check
 * Feature #528: Schema Markup Detection
 * Feature #529: Navigation Visibility Check
 * Feature #530: Tracking Scripts Detection
 * Feature #534: Check inline script content for tracking patterns
 * Feature #541: Optimized page load timing for dynamic/SPA sites
 * Feature #545: Added depth limit to prevent stack overflow on malicious nested @graph
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import type { Browser, BrowserContext, Page } from 'playwright';
import { createLogger } from '../logger.js';
import type { SeoAnalysisResult } from './types.js';

const log = createLogger('quick-test-seo');

/**
 * Feature #527: SEO Analysis check
 * Checks meta tags, heading hierarchy, robots.txt, sitemap.xml
 */
export async function runSeoAnalysis(url: string, browser: Browser): Promise<SeoAnalysisResult> {
  const result: SeoAnalysisResult = {
    score: 0,
    metaTags: {
      title: { name: 'title', content: null, present: false, valid: false },
      description: { name: 'meta description', content: null, present: false, valid: false },
      canonical: { name: 'canonical', content: null, present: false, valid: false },
      ogTitle: { name: 'og:title', content: null, present: false, valid: false },
      ogDescription: { name: 'og:description', content: null, present: false, valid: false },
      ogImage: { name: 'og:image', content: null, present: false, valid: false },
      twitterCard: { name: 'twitter:card', content: null, present: false, valid: false },
      twitterTitle: { name: 'twitter:title', content: null, present: false, valid: false },
      twitterDescription: { name: 'twitter:description', content: null, present: false, valid: false },
      viewport: { name: 'viewport', content: null, present: false, valid: false },
      robots: { name: 'robots', content: null, present: false, valid: false },
    },
    headingStructure: {
      h1Count: 0,
      h1Texts: [],
      hasMultipleH1: false,
      headingHierarchy: [],
      hierarchyValid: true,
      issues: [],
    },
    crawlability: {
      robotsTxt: { present: false, url: '', allowsCrawling: true },
      sitemap: { present: false, url: '' },
    },
    // Feature #528: Schema Markup Detection
    schemaMarkup: {
      jsonLdScripts: [],
      microdataItems: [],
      detectedTypes: [],
      hasStructuredData: false,
      issues: [],
    },
    // Feature #529: Navigation Visibility Check
    navigation: {
      hasNavElement: false,
      hasHeader: false,
      hasFooter: false,
      hasBreadcrumbs: false,
      hasMobileMenuToggle: false,
      navElements: [],
      issues: [],
    },
    // Feature #530: Tracking Scripts Detection
    tracking: {
      scripts: [],
      hasGTM: false,
      hasGA4: false,
      hasFBPixel: false,
      hasHotjar: false,
      hasLinkedIn: false,
      summary: 'No tracking scripts detected',
    },
    issues: [],
    recommendations: [],
  };

  const parsedUrl = new URL(url);
  const baseUrl = parsedUrl.origin;

  let page: Page | null = null;
  let context: BrowserContext | null = null;

  try {
    // Step 1: Navigate to page and extract meta tags
    // Feature #541: Optimized page load timing for dynamic/SPA sites
    const pageLoadStart = Date.now();
    context = await browser.newContext();
    page = await context.newPage();

    // Feature #541: Try networkidle first with 30s timeout.
    // If it times out (slow sites), fall back to domcontentloaded so we at least get the DOM.
    let loadWarning: string | undefined;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (navError) {
      const isTimeout = navError instanceof Error && navError.message.includes('Timeout');
      if (isTimeout) {
        loadWarning = 'Page load timed out waiting for networkidle; used domcontentloaded fallback';
        log.warn({ url, elapsed: Date.now() - pageLoadStart }, 'SEO: networkidle timeout, falling back to domcontentloaded');
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch {
          // If even domcontentloaded fails, proceed with whatever DOM we have
          log.warn({ url }, 'SEO: domcontentloaded fallback also failed, proceeding with current DOM state');
          loadWarning = 'Page load failed; analysis based on partial DOM state';
        }
      } else {
        throw navError; // Re-throw non-timeout errors
      }
    }

    // Feature #541: Post-load delay (2s) for SPA hydration - allows
    // frameworks like React/Vue/Angular to finish client-side rendering
    await page.waitForTimeout(2000);
    const pageLoadMs = Date.now() - pageLoadStart;
    log.info({ url, pageLoadMs, loadWarning }, 'SEO: Page loaded for analysis');

    if (loadWarning) {
      result.issues.push(loadWarning);
    }

    // Feature #541: Time the DOM extraction sub-check
    const domExtractStart = Date.now();

    // Extract all SEO-relevant data from the DOM
    // NOTE: page.evaluate runs in browser context. Avoid named function declarations
    // inside the callback because tsx/esbuild adds __name() wrappers that don't exist
    // in the browser. Use inline expressions instead.
    const seoData = await page.evaluate(() => {
      // Get title
      const titleEl = document.querySelector('title');
      const title = titleEl?.textContent?.trim() || null;

      // Get canonical
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;

      // Sort headings by their position in DOM
      const allHeadingEls = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const orderedHeadings: Array<{ level: number; text: string }> = [];
      allHeadingEls.forEach(h => {
        const level = parseInt(h.tagName.substring(1));
        const text = h.textContent?.trim() || '';
        if (text) {
          orderedHeadings.push({ level, text: text.substring(0, 100) });
        }
      });

      // Count H1s
      const h1Elements = document.querySelectorAll('h1');
      const h1Texts: string[] = [];
      h1Elements.forEach(h => {
        const text = h.textContent?.trim();
        if (text) h1Texts.push(text.substring(0, 100));
      });

      // Feature #528: Schema Markup Detection
      // Find all JSON-LD scripts
      const jsonLdScripts: Array<{ raw: string }> = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        const content = script.textContent?.trim();
        if (content) {
          jsonLdScripts.push({ raw: content.substring(0, 5000) });
        }
      });

      // Find Microdata items
      const microdataItems: Array<{ type: string; count: number }> = [];
      const itemscopeElements = document.querySelectorAll('[itemscope]');
      const typeCount: Record<string, number> = {};
      itemscopeElements.forEach(el => {
        const itemtype = el.getAttribute('itemtype');
        if (itemtype) {
          const typeName = itemtype.split('/').pop() || itemtype;
          typeCount[typeName] = (typeCount[typeName] || 0) + 1;
        }
      });
      for (const [type, count] of Object.entries(typeCount)) {
        microdataItems.push({ type, count });
      }

      // Feature #529: Navigation Visibility Check
      // All visibility checks inlined to avoid tsx __name issue in page.evaluate
      const navElements: Array<{ type: string; visible: boolean; ariaLabel?: string }> = [];

      document.querySelectorAll('nav').forEach(nav => {
        const cs = window.getComputedStyle(nav);
        navElements.push({
          type: 'nav',
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && (nav as HTMLElement).offsetParent !== null,
          ariaLabel: nav.getAttribute('aria-label') || undefined,
        });
      });

      document.querySelectorAll('[role="navigation"]').forEach(el => {
        if (el.tagName.toLowerCase() !== 'nav') {
          const cs = window.getComputedStyle(el);
          navElements.push({
            type: 'role-navigation',
            visible: cs.display !== 'none' && cs.visibility !== 'hidden' && (el as HTMLElement).offsetParent !== null,
            ariaLabel: el.getAttribute('aria-label') || undefined,
          });
        }
      });

      // Check for header/footer
      const hasHeader = document.querySelector('header') !== null;
      const hasFooter = document.querySelector('footer') !== null;

      if (hasHeader) {
        const header = document.querySelector('header')!;
        const cs = window.getComputedStyle(header);
        navElements.push({
          type: 'header',
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && (header as HTMLElement).offsetParent !== null,
        });
      }
      if (hasFooter) {
        const footer = document.querySelector('footer')!;
        const cs = window.getComputedStyle(footer);
        navElements.push({
          type: 'footer',
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && (footer as HTMLElement).offsetParent !== null,
        });
      }

      // Check for breadcrumbs
      const hasBreadcrumbs = document.querySelector('[aria-label*="breadcrumb" i], [aria-label*="Breadcrumb" i], nav.breadcrumb, .breadcrumbs, .breadcrumb') !== null ||
        jsonLdScripts.some(s => s.raw.includes('BreadcrumbList'));

      // Check for mobile menu toggle (hamburger button)
      const mobileMenuSelectors = [
        'button[aria-label*="menu" i]',
        'button[aria-label*="Menu" i]',
        'button.hamburger',
        'button.mobile-menu',
        '.menu-toggle',
        '[class*="hamburger"]',
        '[class*="mobile-nav"]',
      ];
      const hasMobileMenuToggle = mobileMenuSelectors.some(sel => document.querySelector(sel) !== null);

      // Feature #530: Tracking Scripts Detection
      const trackingScripts: Array<{ name: string; type: string; id?: string; source: string }> = [];

      // Check script src attributes for tracking scripts
      document.querySelectorAll('script[src]').forEach(script => {
        const src = script.getAttribute('src') || '';

        // Google Tag Manager
        const gtmMatch = src.match(/gtm\.js\?id=(GTM-[A-Z0-9]+)/);
        if (gtmMatch) {
          trackingScripts.push({ name: 'Google Tag Manager', type: 'gtm', id: gtmMatch[1], source: 'script_src' });
        }

        // Google Analytics GA4
        const ga4Match = src.match(/gtag\/js\?id=(G-[A-Z0-9]+)/);
        if (ga4Match) {
          trackingScripts.push({ name: 'Google Analytics 4', type: 'ga4', id: ga4Match[1], source: 'script_src' });
        }

        // Facebook Pixel
        if (src.includes('connect.facebook.net') && src.includes('fbevents.js')) {
          trackingScripts.push({ name: 'Facebook Pixel', type: 'fb_pixel', source: 'script_src' });
        }

        // Hotjar
        const hotjarMatch = src.match(/static\.hotjar\.com\/c\/hotjar-(\d+)\.js/);
        if (hotjarMatch) {
          trackingScripts.push({ name: 'Hotjar', type: 'hotjar', id: hotjarMatch[1], source: 'script_src' });
        }

        // LinkedIn Insight Tag
        if (src.includes('snap.licdn.com') || src.includes('linkedin.com/insight')) {
          trackingScripts.push({ name: 'LinkedIn Insight Tag', type: 'linkedin', source: 'script_src' });
        }
      });

      // Feature #534: Check inline script content for tracking patterns
      document.querySelectorAll('script:not([src])').forEach(script => {
        const content = script.textContent || '';
        if (!content.trim()) return;

        // GTM bootstrap pattern: (window,document,'script','dataLayer','GTM-XXXXXX')
        const gtmInlineMatch = content.match(/['"]GTM-([A-Z0-9]+)['"]/);
        if (gtmInlineMatch && !trackingScripts.some(s => s.type === 'gtm')) {
          trackingScripts.push({ name: 'Google Tag Manager', type: 'gtm', id: 'GTM-' + gtmInlineMatch[1], source: 'inline' });
        }

        // GA4 gtag inline: gtag('config', 'G-XXXXXX')
        const ga4InlineMatch = content.match(/gtag\s*\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)['"]/);
        if (ga4InlineMatch && !trackingScripts.some(s => s.type === 'ga4')) {
          trackingScripts.push({ name: 'Google Analytics 4', type: 'ga4', id: ga4InlineMatch[1], source: 'inline' });
        }
        // Also check for GoogleAnalyticsObject or ga() calls (Universal Analytics)
        if ((content.includes('GoogleAnalyticsObject') || content.match(/\bga\s*\(\s*['"]create['"]/)) && !trackingScripts.some(s => s.type === 'ga4')) {
          trackingScripts.push({ name: 'Google Analytics', type: 'ga4', source: 'inline' });
        }

        // Facebook Pixel: fbq('init', ...) or fbevents.js reference
        if ((content.includes('fbq(') || content.includes('fbevents.js')) && !trackingScripts.some(s => s.type === 'fb_pixel')) {
          const fbIdMatch = content.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/);
          trackingScripts.push({ name: 'Facebook Pixel', type: 'fb_pixel', id: fbIdMatch ? fbIdMatch[1] : undefined, source: 'inline' });
        }

        // Hotjar inline: (function(h,o,t,j,a,r){ h.hj=...
        if (content.includes('hotjar') || content.match(/h\.hj\s*=/) || content.match(/hj\s*\(\s*['"]/)) {
          if (!trackingScripts.some(s => s.type === 'hotjar')) {
            const hjIdMatch = content.match(/hjid\s*:\s*(\d+)/i) || content.match(/hotjar-(\d+)/);
            trackingScripts.push({ name: 'Hotjar', type: 'hotjar', id: hjIdMatch ? hjIdMatch[1] : undefined, source: 'inline' });
          }
        }

        // LinkedIn Insight: _linkedin_partner_id or snap.licdn.com
        if ((content.includes('_linkedin_partner_id') || content.includes('snap.licdn.com')) && !trackingScripts.some(s => s.type === 'linkedin')) {
          const liIdMatch = content.match(/_linkedin_partner_id\s*=\s*["']?(\d+)["']?/);
          trackingScripts.push({ name: 'LinkedIn Insight Tag', type: 'linkedin', id: liIdMatch ? liIdMatch[1] : undefined, source: 'inline' });
        }
      });

      // Feature #534: Check noscript iframes for GTM
      document.querySelectorAll('noscript').forEach(noscript => {
        const html = noscript.innerHTML || '';
        if (html.includes('googletagmanager.com/ns.html')) {
          const gtmNoscriptMatch = html.match(/id=(GTM-[A-Z0-9]+)/);
          if (gtmNoscriptMatch && !trackingScripts.some(s => s.type === 'gtm')) {
            trackingScripts.push({ name: 'Google Tag Manager', type: 'gtm', id: gtmNoscriptMatch[1], source: 'inline' });
          }
        }
      });

      // Check window globals for tracking scripts (cast window to any for tracking globals)
      const win = window as unknown as Record<string, unknown>;

      // GTM dataLayer check
      if (Array.isArray(win.dataLayer)) {
        const hasGtmEntry = (win.dataLayer as Array<Record<string, unknown>>).some(
          (entry: Record<string, unknown>) => entry['gtm.start'] !== undefined
        );
        if (hasGtmEntry && !trackingScripts.some(s => s.type === 'gtm')) {
          trackingScripts.push({ name: 'Google Tag Manager', type: 'gtm', source: 'window_global' });
        }
      }

      // GA4 gtag check
      if (typeof win.gtag === 'function') {
        if (!trackingScripts.some(s => s.type === 'ga4')) {
          trackingScripts.push({ name: 'Google Analytics 4', type: 'ga4', source: 'window_global' });
        }
      }

      // Facebook Pixel fbq check
      if (typeof win.fbq === 'function') {
        if (!trackingScripts.some(s => s.type === 'fb_pixel')) {
          trackingScripts.push({ name: 'Facebook Pixel', type: 'fb_pixel', source: 'window_global' });
        }
      }

      // Hotjar hj check
      if (typeof win.hj === 'function') {
        if (!trackingScripts.some(s => s.type === 'hotjar')) {
          trackingScripts.push({ name: 'Hotjar', type: 'hotjar', source: 'window_global' });
        }
      }

      // LinkedIn _linkedin_partner_id check
      if (win._linkedin_partner_id) {
        if (!trackingScripts.some(s => s.type === 'linkedin')) {
          trackingScripts.push({ name: 'LinkedIn Insight Tag', type: 'linkedin', id: String(win._linkedin_partner_id), source: 'window_global' });
        }
      }

      return {
        title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null,
        canonical,
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || null,
        ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || null,
        ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim() || null,
        twitterCard: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')?.trim() || null,
        twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')?.trim() || null,
        twitterDescription: document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')?.trim() || null,
        viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content')?.trim() || null,
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content')?.trim() || null,
        h1Count: document.querySelectorAll('h1').length,
        h1Texts,
        headingHierarchy: orderedHeadings,
        // Feature #528: Schema data
        jsonLdScripts,
        microdataItems,
        // Feature #529: Navigation data
        navElements,
        hasHeader,
        hasFooter,
        hasBreadcrumbs,
        hasMobileMenuToggle,
        // Feature #530: Tracking scripts data
        trackingScripts,
      };
    });

    // Close page context
    await context.close();
    context = null;
    page = null;

    const domExtractMs = Date.now() - domExtractStart;
    log.info({ url, domExtractMs }, 'SEO: DOM extraction completed');

    // Feature #541: Time the meta tags + headings + schema + nav + tracking processing
    const processingStart = Date.now();

    // Process title
    if (seoData.title) {
      result.metaTags.title = {
        name: 'title',
        content: seoData.title,
        present: true,
        valid: seoData.title.length >= 10 && seoData.title.length <= 70,
        issue: seoData.title.length < 10 ? 'Title too short (min 10 chars)' :
               seoData.title.length > 70 ? 'Title too long (max 70 chars)' : undefined,
      };
    } else {
      result.issues.push('Missing page title');
      result.recommendations.push('Add a descriptive <title> tag (10-70 characters)');
    }

    // Process meta description
    if (seoData.description) {
      result.metaTags.description = {
        name: 'meta description',
        content: seoData.description,
        present: true,
        valid: seoData.description.length >= 50 && seoData.description.length <= 160,
        issue: seoData.description.length < 50 ? 'Description too short (min 50 chars)' :
               seoData.description.length > 160 ? 'Description too long (max 160 chars)' : undefined,
      };
    } else {
      result.issues.push('Missing meta description');
      result.recommendations.push('Add a meta description (50-160 characters)');
    }

    // Process canonical
    if (seoData.canonical) {
      result.metaTags.canonical = {
        name: 'canonical',
        content: seoData.canonical,
        present: true,
        valid: seoData.canonical.startsWith('http'),
      };
    } else {
      result.issues.push('Missing canonical URL');
      result.recommendations.push('Add a canonical link to prevent duplicate content issues');
    }

    // Process Open Graph tags
    if (seoData.ogTitle) {
      result.metaTags.ogTitle = { name: 'og:title', content: seoData.ogTitle, present: true, valid: true };
    } else {
      result.issues.push('Missing og:title');
    }

    if (seoData.ogDescription) {
      result.metaTags.ogDescription = { name: 'og:description', content: seoData.ogDescription, present: true, valid: true };
    } else {
      result.issues.push('Missing og:description');
    }

    if (seoData.ogImage) {
      result.metaTags.ogImage = { name: 'og:image', content: seoData.ogImage, present: true, valid: true };
    } else {
      result.issues.push('Missing og:image for social sharing');
      result.recommendations.push('Add og:image for better social media sharing previews');
    }

    // Process Twitter Card tags
    if (seoData.twitterCard) {
      result.metaTags.twitterCard = { name: 'twitter:card', content: seoData.twitterCard, present: true, valid: true };
    }
    if (seoData.twitterTitle) {
      result.metaTags.twitterTitle = { name: 'twitter:title', content: seoData.twitterTitle, present: true, valid: true };
    }
    if (seoData.twitterDescription) {
      result.metaTags.twitterDescription = { name: 'twitter:description', content: seoData.twitterDescription, present: true, valid: true };
    }

    // Process viewport
    if (seoData.viewport) {
      result.metaTags.viewport = { name: 'viewport', content: seoData.viewport, present: true, valid: true };
    } else {
      result.issues.push('Missing viewport meta tag');
      result.recommendations.push('Add viewport meta tag for mobile responsiveness');
    }

    // Process robots
    if (seoData.robots) {
      result.metaTags.robots = { name: 'robots', content: seoData.robots, present: true, valid: true };
    }

    // Process heading structure
    result.headingStructure.h1Count = seoData.h1Count;
    result.headingStructure.h1Texts = seoData.h1Texts;
    result.headingStructure.hasMultipleH1 = seoData.h1Count > 1;
    result.headingStructure.headingHierarchy = seoData.headingHierarchy;

    if (seoData.h1Count === 0) {
      result.headingStructure.issues.push('No H1 tag found');
      result.issues.push('Missing H1 tag');
      result.recommendations.push('Add exactly one H1 tag for the main page heading');
    } else if (seoData.h1Count > 1) {
      result.headingStructure.issues.push(`Multiple H1 tags found (${seoData.h1Count})`);
      result.issues.push(`Multiple H1 tags (${seoData.h1Count} found, should be 1)`);
      result.recommendations.push('Use only one H1 tag per page');
    }

    // Check heading hierarchy (H1 should come before H2, etc.)
    let lastLevel = 0;
    for (const heading of seoData.headingHierarchy) {
      if (heading.level > lastLevel + 1 && lastLevel > 0) {
        result.headingStructure.hierarchyValid = false;
        result.headingStructure.issues.push(`Heading level skipped: H${lastLevel} → H${heading.level}`);
      }
      lastLevel = heading.level;
    }

    if (!result.headingStructure.hierarchyValid) {
      result.issues.push('Heading hierarchy has skipped levels');
      result.recommendations.push('Use heading levels in order (H1 → H2 → H3)');
    }

    // Feature #528: Process Schema Markup
    const detectedTypes: string[] = [];

    // Process JSON-LD scripts
    for (const script of seoData.jsonLdScripts) {
      try {
        const parsed = JSON.parse(script.raw);
        // Extract @type from JSON-LD
        // Feature #545: Added depth limit (max 10) to prevent stack overflow on malicious nested @graph
        const MAX_JSONLD_DEPTH = 10;
        const extractTypes = (obj: unknown, depth = 0): string[] => {
          if (depth > MAX_JSONLD_DEPTH) return [];
          const types: string[] = [];
          if (typeof obj === 'object' && obj !== null) {
            const o = obj as Record<string, unknown>;
            if (o['@type']) {
              const t = Array.isArray(o['@type']) ? o['@type'] : [o['@type']];
              types.push(...t.map(String));
            }
            // Check for @graph array
            if (Array.isArray(o['@graph'])) {
              for (const item of o['@graph']) {
                types.push(...extractTypes(item, depth + 1));
              }
            }
          }
          return types;
        };
        const types = extractTypes(parsed);
        result.schemaMarkup.jsonLdScripts.push({
          type: types[0] || 'Unknown',
          raw: script.raw.substring(0, 500), // Truncate for storage
          valid: true,
        });
        detectedTypes.push(...types);
      } catch {
        result.schemaMarkup.jsonLdScripts.push({
          type: 'Invalid',
          raw: script.raw.substring(0, 200),
          valid: false,
          error: 'Invalid JSON syntax',
        });
        result.schemaMarkup.issues.push('Invalid JSON-LD syntax detected');
      }
    }

    // Process Microdata
    for (const item of seoData.microdataItems) {
      result.schemaMarkup.microdataItems.push({
        type: item.type,
        itemCount: item.count,
      });
      detectedTypes.push(item.type);
    }

    // Deduplicate and store detected types
    result.schemaMarkup.detectedTypes = [...new Set(detectedTypes)];
    result.schemaMarkup.hasStructuredData = detectedTypes.length > 0;

    // Check for common schema types
    if (!result.schemaMarkup.hasStructuredData) {
      result.recommendations.push('Add structured data (JSON-LD or Microdata) for better search engine visibility');
    } else {
      // Check if important types are present
      const hasOrg = detectedTypes.some(t => t === 'Organization' || t === 'LocalBusiness');
      const hasBreadcrumbs = detectedTypes.includes('BreadcrumbList');
      if (!hasOrg) {
        result.recommendations.push('Consider adding Organization or LocalBusiness schema');
      }
      if (!hasBreadcrumbs) {
        result.recommendations.push('Consider adding BreadcrumbList schema for navigation');
      }
    }

    // Feature #529: Process Navigation data
    result.navigation.hasNavElement = seoData.navElements.some(n => n.type === 'nav' || n.type === 'role-navigation');
    result.navigation.hasHeader = seoData.hasHeader;
    result.navigation.hasFooter = seoData.hasFooter;
    result.navigation.hasBreadcrumbs = seoData.hasBreadcrumbs;
    result.navigation.hasMobileMenuToggle = seoData.hasMobileMenuToggle;
    result.navigation.navElements = seoData.navElements.map(n => ({
      type: n.type as 'nav' | 'role-navigation' | 'header' | 'footer' | 'breadcrumb',
      visible: n.visible,
      ariaLabel: n.ariaLabel,
    }));

    // Check navigation issues
    if (!result.navigation.hasNavElement) {
      result.navigation.issues.push('No <nav> or role="navigation" element found');
      result.recommendations.push('Add semantic <nav> elements for better accessibility');
    }
    if (!result.navigation.hasHeader) {
      result.navigation.issues.push('No <header> element found');
    }
    if (!result.navigation.hasFooter) {
      result.navigation.issues.push('No <footer> element found');
    }
    if (!result.navigation.hasBreadcrumbs) {
      result.recommendations.push('Consider adding breadcrumb navigation for better UX');
    }

    // Check for hidden nav elements
    const hiddenNavs = seoData.navElements.filter(n => !n.visible && (n.type === 'nav' || n.type === 'role-navigation'));
    if (hiddenNavs.length > 0) {
      result.navigation.issues.push(`${hiddenNavs.length} navigation element(s) are hidden from view`);
    }

    // Feature #530: Process Tracking Scripts data
    result.tracking.scripts = seoData.trackingScripts.map(s => ({
      name: s.name,
      type: s.type as 'gtm' | 'ga4' | 'fb_pixel' | 'hotjar' | 'linkedin' | 'other',
      id: s.id,
      source: s.source as 'script_src' | 'window_global' | 'inline',
    }));
    result.tracking.hasGTM = seoData.trackingScripts.some(s => s.type === 'gtm');
    result.tracking.hasGA4 = seoData.trackingScripts.some(s => s.type === 'ga4');
    result.tracking.hasFBPixel = seoData.trackingScripts.some(s => s.type === 'fb_pixel');
    result.tracking.hasHotjar = seoData.trackingScripts.some(s => s.type === 'hotjar');
    result.tracking.hasLinkedIn = seoData.trackingScripts.some(s => s.type === 'linkedin');

    // Generate tracking summary
    if (seoData.trackingScripts.length === 0) {
      result.tracking.summary = 'No tracking scripts detected';
    } else {
      const trackerNames = [...new Set(seoData.trackingScripts.map(s => s.name))];
      result.tracking.summary = `${trackerNames.length} tracker${trackerNames.length !== 1 ? 's' : ''}: ${trackerNames.join(', ')}`;
    }

    const processingMs = Date.now() - processingStart;
    log.info({ url, processingMs }, 'SEO: Meta/heading/schema/nav/tracking processing completed');

    // Feature #541: Time crawlability checks (robots.txt + sitemap.xml)
    const crawlCheckStart = Date.now();

    // Step 2: Check robots.txt
    try {
      const robotsUrl = `${baseUrl}/robots.txt`;
      result.crawlability.robotsTxt.url = robotsUrl;

      const robotsResponse = await new Promise<{ status: number; body: string }>((resolve) => {
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const req = client.request(robotsUrl, { method: 'GET', timeout: 5000 }, (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => resolve({ status: res.statusCode || 0, body }));
        });
        req.on('error', () => resolve({ status: 0, body: '' }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
        req.end();
      });

      if (robotsResponse.status === 200) {
        result.crawlability.robotsTxt.present = true;
        result.crawlability.robotsTxt.content = robotsResponse.body.substring(0, 1000);
        // Check if it blocks crawling
        const lowerBody = robotsResponse.body.toLowerCase();
        if (lowerBody.includes('disallow: /') && !lowerBody.includes('disallow: /\n')) {
          result.crawlability.robotsTxt.allowsCrawling = false;
          result.issues.push('robots.txt may block crawling');
        }
      } else {
        result.recommendations.push('Consider adding a robots.txt file');
      }
    } catch {
      // robots.txt check failed, non-critical
    }

    // Step 3: Check sitemap.xml
    try {
      const sitemapUrl = `${baseUrl}/sitemap.xml`;
      result.crawlability.sitemap.url = sitemapUrl;

      const sitemapResponse = await new Promise<{ status: number; body: string }>((resolve) => {
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const req = client.request(sitemapUrl, { method: 'GET', timeout: 5000 }, (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk.toString().substring(0, 5000); }); // Limit body size
          res.on('end', () => resolve({ status: res.statusCode || 0, body }));
        });
        req.on('error', () => resolve({ status: 0, body: '' }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
        req.end();
      });

      if (sitemapResponse.status === 200 && sitemapResponse.body.includes('<urlset')) {
        result.crawlability.sitemap.present = true;
        // Count URLs in sitemap (rough estimate)
        const urlMatches = sitemapResponse.body.match(/<loc>/g);
        result.crawlability.sitemap.urlCount = urlMatches?.length || 0;
      } else {
        result.recommendations.push('Consider adding a sitemap.xml for better indexing');
      }
    } catch {
      // sitemap check failed, non-critical
    }

    const crawlCheckMs = Date.now() - crawlCheckStart;
    log.info({ url, crawlCheckMs, robotsTxt: result.crawlability.robotsTxt.present, sitemap: result.crawlability.sitemap.present }, 'SEO: Crawlability checks completed');

    // Calculate SEO score
    let score = 100;

    // Essential tags (high impact)
    if (!result.metaTags.title.present) score -= 15;
    else if (!result.metaTags.title.valid) score -= 5;

    if (!result.metaTags.description.present) score -= 12;
    else if (!result.metaTags.description.valid) score -= 4;

    if (!result.metaTags.canonical.present) score -= 8;
    if (!result.metaTags.viewport.present) score -= 10;

    // Heading structure
    if (result.headingStructure.h1Count === 0) score -= 10;
    else if (result.headingStructure.h1Count > 1) score -= 5;
    if (!result.headingStructure.hierarchyValid) score -= 5;

    // Social tags (moderate impact)
    if (!result.metaTags.ogTitle.present) score -= 4;
    if (!result.metaTags.ogDescription.present) score -= 4;
    if (!result.metaTags.ogImage.present) score -= 5;

    // Crawlability (moderate impact)
    if (!result.crawlability.robotsTxt.present) score -= 3;
    if (!result.crawlability.sitemap.present) score -= 5;
    if (!result.crawlability.robotsTxt.allowsCrawling) score -= 10;

    // Feature #528: Schema markup (moderate impact)
    if (!result.schemaMarkup.hasStructuredData) score -= 5;
    if (result.schemaMarkup.issues.length > 0) score -= 3; // Invalid JSON-LD penalty

    // Feature #529: Navigation (moderate impact)
    if (!result.navigation.hasNavElement) score -= 4;
    if (!result.navigation.hasHeader) score -= 2;
    if (!result.navigation.hasFooter) score -= 2;

    result.score = Math.max(0, Math.min(100, score));

    const totalMs = Date.now() - pageLoadStart;
    log.info({
      url,
      score: result.score,
      h1Count: result.headingStructure.h1Count,
      issueCount: result.issues.length,
      robotsTxt: result.crawlability.robotsTxt.present,
      sitemap: result.crawlability.sitemap.present,
      schemaTypes: result.schemaMarkup.detectedTypes.length,
      hasNav: result.navigation.hasNavElement,
      trackingScriptsCount: result.tracking.scripts.length,
      // Feature #541: Timing breakdown for debugging
      timing: { pageLoadMs, domExtractMs, processingMs, crawlCheckMs, totalMs },
    }, 'SEO Analysis complete');

  } catch (err) {
    log.error({ error: err }, 'SEO Analysis wave error');
    if (context) {
      await context.close().catch(() => {});
    }
    throw err;
  }

  return result;
}
