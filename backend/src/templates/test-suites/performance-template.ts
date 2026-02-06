/**
 * Performance Test Suite Template
 * Feature #1731: Generates Lighthouse performance tests from site analysis
 *
 * Creates tests for:
 * - Core Web Vitals (LCP, FID, CLS)
 * - Performance score threshold
 * - Mobile performance
 * - Key page performance
 */

import { TestSuiteTemplate, TemplateGeneratorOptions, GeneratedTest } from './types';
import type { SiteAnalysis } from '../../services/crawl4ai';

export function generatePerformanceTemplate(options: TemplateGeneratorOptions): TestSuiteTemplate {
  const { baseUrl, siteAnalysis, projectName } = options;
  const tests: GeneratedTest[] = [];

  // 1. Homepage - Desktop Performance
  tests.push({
    name: 'Homepage - Desktop Performance',
    description: `Lighthouse performance audit for ${baseUrl} (Desktop)`,
    type: 'performance',
    target_url: baseUrl,
    config: {
      device: 'desktop',
      categories: ['performance', 'best-practices'],
      performance_threshold: 80,
      lcp_threshold: 2500,  // ms - Good: <2.5s
      cls_threshold: 0.1,   // Good: <0.1
      fid_threshold: 100,   // ms - Good: <100ms
    },
  });

  // 2. Homepage - Mobile Performance
  tests.push({
    name: 'Homepage - Mobile Performance',
    description: `Lighthouse performance audit for ${baseUrl} (Mobile)`,
    type: 'performance',
    target_url: baseUrl,
    config: {
      device: 'mobile',
      categories: ['performance', 'best-practices'],
      performance_threshold: 70,  // Lower threshold for mobile
      lcp_threshold: 4000,        // More lenient for mobile
      cls_threshold: 0.25,
      fid_threshold: 300,
    },
  });

  // 3. Full Lighthouse audit - Desktop
  tests.push({
    name: 'Homepage - Full Lighthouse Audit',
    description: 'Complete Lighthouse audit including performance, accessibility, best practices, SEO',
    type: 'performance',
    target_url: baseUrl,
    config: {
      device: 'desktop',
      categories: ['performance', 'accessibility', 'best-practices', 'seo'],
      performance_threshold: 70,
      accessibility_threshold: 90,
      best_practices_threshold: 80,
      seo_threshold: 80,
    },
  });

  // 4. Key pages performance (limit to 3)
  const keyPages = getKeyPagesForPerformance(siteAnalysis, baseUrl).slice(0, 3);
  keyPages.forEach((page, index) => {
    tests.push({
      name: `${page.name} - Performance`,
      description: `Performance audit for ${page.url}`,
      type: 'performance',
      target_url: page.url,
      config: {
        device: 'desktop',
        categories: ['performance'],
        performance_threshold: 70,
        lcp_threshold: 3000,
      },
    });
  });

  // 5. Time to Interactive test
  tests.push({
    name: 'Homepage - Time to Interactive',
    description: 'Measure time until page becomes fully interactive',
    type: 'performance',
    target_url: baseUrl,
    config: {
      device: 'desktop',
      categories: ['performance'],
      metrics_focus: ['interactive', 'first-contentful-paint', 'speed-index'],
      tti_threshold: 5000,  // Time to Interactive < 5s
    },
  });

  // 6. Resource loading test
  tests.push({
    name: 'Homepage - Resource Loading',
    description: 'Analyze resource loading and bundle sizes',
    type: 'performance',
    target_url: baseUrl,
    config: {
      device: 'desktop',
      categories: ['performance'],
      metrics_focus: ['total-byte-weight', 'dom-size', 'render-blocking-resources'],
      max_total_size_kb: 3000,  // 3MB max page weight
    },
  });

  // 7. Forms/interactive page performance (if forms exist)
  if (siteAnalysis.hasLogin || siteAnalysis.forms.length > 0) {
    tests.push({
      name: 'Interactive Page - Performance',
      description: 'Performance test for pages with forms/interactivity',
      type: 'performance',
      target_url: baseUrl,
      config: {
        device: 'desktop',
        categories: ['performance'],
        interaction_ready_threshold: 3000,
      },
    });
  }

  return {
    name: `${projectName || 'Site'} Performance Tests`,
    description: `Lighthouse performance audits for ${baseUrl}`,
    type: 'performance',
    tests,
  };
}

interface KeyPage {
  name: string;
  url: string;
}

function getKeyPagesForPerformance(analysis: SiteAnalysis, baseUrl: string): KeyPage[] {
  const pages: KeyPage[] = [];

  // Important pages for performance testing
  const importantPatterns = [
    { pattern: /products?|catalog|shop/i, name: 'Products Page' },
    { pattern: /search|results/i, name: 'Search Results' },
    { pattern: /blog|articles?|news/i, name: 'Blog/Content Page' },
    { pattern: /checkout|cart/i, name: 'Checkout Page' },
  ];

  analysis.links.forEach(link => {
    if (link.isExternal || pages.length >= 5) return;

    for (const { pattern, name } of importantPatterns) {
      if (pattern.test(link.href) || pattern.test(link.text)) {
        const fullUrl = link.href.startsWith('http')
          ? link.href
          : `${baseUrl.replace(/\/$/, '')}${link.href.startsWith('/') ? '' : '/'}${link.href}`;

        if (!pages.some(p => p.url === fullUrl)) {
          pages.push({ name, url: fullUrl });
        }
        break;
      }
    }
  });

  return pages;
}

export default generatePerformanceTemplate;
