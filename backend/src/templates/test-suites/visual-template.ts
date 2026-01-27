/**
 * Visual Regression Test Suite Template
 * Feature #1731: Generates visual regression tests from site analysis
 *
 * Creates tests for:
 * - Homepage screenshot comparison
 * - Key pages visual verification
 * - Responsive design checks (desktop, tablet, mobile)
 */

import { TestSuiteTemplate, TemplateGeneratorOptions, GeneratedTest } from './types';

export function generateVisualTemplate(options: TemplateGeneratorOptions): TestSuiteTemplate {
  const { baseUrl, siteAnalysis, projectName } = options;
  const tests: GeneratedTest[] = [];

  // 1. Homepage visual test - desktop
  tests.push({
    name: 'Homepage - Desktop Visual',
    description: `Visual regression test for ${baseUrl} at 1280x720`,
    type: 'visual',
    target_url: baseUrl,
    config: {
      viewport_width: 1280,
      viewport_height: 720,
      diff_threshold: 5,
      capture_mode: 'full_page',
    },
  });

  // 2. Homepage visual test - tablet
  tests.push({
    name: 'Homepage - Tablet Visual',
    description: `Visual regression test for ${baseUrl} at 768x1024 (iPad)`,
    type: 'visual',
    target_url: baseUrl,
    config: {
      viewport_width: 768,
      viewport_height: 1024,
      diff_threshold: 5,
      capture_mode: 'full_page',
    },
  });

  // 3. Homepage visual test - mobile
  tests.push({
    name: 'Homepage - Mobile Visual',
    description: `Visual regression test for ${baseUrl} at 375x667 (iPhone)`,
    type: 'visual',
    target_url: baseUrl,
    config: {
      viewport_width: 375,
      viewport_height: 667,
      diff_threshold: 5,
      capture_mode: 'full_page',
    },
  });

  // 4. Key pages from navigation
  const keyPages = getKeyPagesFromAnalysis(siteAnalysis, baseUrl);
  keyPages.forEach(page => {
    tests.push({
      name: `${page.name} - Visual`,
      description: `Visual regression test for ${page.url}`,
      type: 'visual',
      target_url: page.url,
      config: {
        viewport_width: 1280,
        viewport_height: 720,
        diff_threshold: 5,
        capture_mode: 'full_page',
      },
    });
  });

  // 5. Header/navigation visual consistency
  if (siteAnalysis.navigation.hasHeader) {
    tests.push({
      name: 'Header Component - Visual',
      description: 'Visual regression test for header/navigation area',
      type: 'visual',
      target_url: baseUrl,
      config: {
        viewport_width: 1280,
        viewport_height: 200,
        diff_threshold: 3,
        capture_mode: 'element',
        element_selector: 'header, nav, [role="banner"]',
      },
    });
  }

  // 6. Footer visual consistency
  if (siteAnalysis.navigation.hasFooter) {
    tests.push({
      name: 'Footer Component - Visual',
      description: 'Visual regression test for footer area',
      type: 'visual',
      target_url: baseUrl,
      config: {
        viewport_width: 1280,
        viewport_height: 400,
        diff_threshold: 3,
        capture_mode: 'element',
        element_selector: 'footer, [role="contentinfo"]',
      },
    });
  }

  return {
    name: `${projectName || 'Site'} Visual Regression Tests`,
    description: `Screenshot comparison tests for ${baseUrl}`,
    type: 'visual',
    tests,
  };
}

interface KeyPage {
  name: string;
  url: string;
}

function getKeyPagesFromAnalysis(analysis: typeof import('../../services/crawl4ai').SiteAnalysis.prototype, baseUrl: string): KeyPage[] {
  const pages: KeyPage[] = [];
  const hostname = new URL(baseUrl).hostname;

  // Find important internal links
  const importantPatterns = [
    { pattern: /about/i, name: 'About Page' },
    { pattern: /contact/i, name: 'Contact Page' },
    { pattern: /products?|services?/i, name: 'Products Page' },
    { pattern: /pricing/i, name: 'Pricing Page' },
    { pattern: /blog|news/i, name: 'Blog Page' },
    { pattern: /faq|help/i, name: 'FAQ Page' },
  ];

  analysis.links.forEach(link => {
    if (link.isExternal) return;
    if (pages.length >= 5) return; // Limit to 5 key pages

    for (const { pattern, name } of importantPatterns) {
      if (pattern.test(link.href) || pattern.test(link.text)) {
        // Resolve relative URLs
        const fullUrl = link.href.startsWith('http')
          ? link.href
          : `${baseUrl.replace(/\/$/, '')}${link.href.startsWith('/') ? '' : '/'}${link.href}`;

        // Avoid duplicates
        if (!pages.some(p => p.url === fullUrl)) {
          pages.push({ name, url: fullUrl });
        }
        break;
      }
    }
  });

  return pages;
}

export default generateVisualTemplate;
