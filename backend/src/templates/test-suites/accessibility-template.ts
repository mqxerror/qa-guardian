/**
 * Accessibility Test Suite Template
 * Feature #1731: Generates accessibility (a11y) tests from site analysis
 *
 * Creates tests for:
 * - WCAG 2.1 Level AA compliance
 * - Color contrast
 * - Keyboard navigation
 * - Screen reader compatibility
 * - Form labels and ARIA
 */

import { TestSuiteTemplate, TemplateGeneratorOptions, GeneratedTest } from './types';
import type { SiteAnalysis } from '../../services/crawl4ai';

export function generateAccessibilityTemplate(options: TemplateGeneratorOptions): TestSuiteTemplate {
  const { baseUrl, siteAnalysis, projectName } = options;
  const tests: GeneratedTest[] = [];

  // 1. Homepage accessibility scan
  tests.push({
    name: 'Homepage - Full Accessibility Audit',
    description: `WCAG 2.1 AA compliance check for ${baseUrl}`,
    type: 'accessibility',
    target_url: baseUrl,
    config: {
      standard: 'WCAG2AA',
      include_rules: ['color-contrast', 'image-alt', 'label', 'link-name', 'button-name'],
      viewport_width: 1280,
      viewport_height: 720,
    },
  });

  // 2. Mobile accessibility scan
  tests.push({
    name: 'Homepage - Mobile Accessibility',
    description: `Mobile accessibility check for ${baseUrl}`,
    type: 'accessibility',
    target_url: baseUrl,
    config: {
      standard: 'WCAG2AA',
      viewport_width: 375,
      viewport_height: 667,
    },
  });

  // 3. Form accessibility tests
  if (siteAnalysis.forms.length > 0) {
    tests.push({
      name: 'Forms - Label and Input Accessibility',
      description: 'Verify all form inputs have proper labels and ARIA attributes',
      type: 'accessibility',
      target_url: baseUrl,
      config: {
        standard: 'WCAG2AA',
        include_rules: ['label', 'label-title-only', 'autocomplete-valid', 'form-field-multiple-labels'],
        focus_on_forms: true,
      },
    });
  }

  // 4. Navigation accessibility
  if (siteAnalysis.navigation.menuItems.length > 0) {
    tests.push({
      name: 'Navigation - Keyboard Accessibility',
      description: 'Verify navigation is accessible via keyboard',
      type: 'accessibility',
      target_url: baseUrl,
      config: {
        standard: 'WCAG2AA',
        include_rules: ['tabindex', 'focus-order-semantics', 'bypass', 'skip-link'],
        check_keyboard_nav: true,
      },
    });
  }

  // 5. Image accessibility
  if (siteAnalysis.links.some(l => l.href.match(/\.(jpg|jpeg|png|gif|webp|svg)/i))) {
    tests.push({
      name: 'Images - Alt Text Verification',
      description: 'Verify all images have meaningful alt text',
      type: 'accessibility',
      target_url: baseUrl,
      config: {
        standard: 'WCAG2AA',
        include_rules: ['image-alt', 'image-redundant-alt', 'svg-img-alt'],
      },
    });
  }

  // 6. Color contrast check
  tests.push({
    name: 'Color Contrast - WCAG AA',
    description: 'Verify text meets minimum color contrast requirements (4.5:1 for normal text)',
    type: 'accessibility',
    target_url: baseUrl,
    config: {
      standard: 'WCAG2AA',
      include_rules: ['color-contrast'],
      contrast_ratio: 4.5,
    },
  });

  // 7. Heading structure
  tests.push({
    name: 'Heading Structure',
    description: 'Verify proper heading hierarchy (h1-h6)',
    type: 'accessibility',
    target_url: baseUrl,
    config: {
      standard: 'WCAG2AA',
      include_rules: ['heading-order', 'page-has-heading-one', 'empty-heading'],
    },
  });

  // 8. Link accessibility
  tests.push({
    name: 'Links - Descriptive Text',
    description: 'Verify links have descriptive text (no "click here")',
    type: 'accessibility',
    target_url: baseUrl,
    config: {
      standard: 'WCAG2AA',
      include_rules: ['link-name', 'link-in-text-block', 'identical-links-same-purpose'],
    },
  });

  // 9. Key pages accessibility (limit to 3)
  const keyPageUrls = getKeyPageUrls(siteAnalysis, baseUrl).slice(0, 3);
  keyPageUrls.forEach((pageUrl, index) => {
    tests.push({
      name: `Key Page ${index + 1} - Accessibility Audit`,
      description: `WCAG 2.1 AA check for ${pageUrl}`,
      type: 'accessibility',
      target_url: pageUrl,
      config: {
        standard: 'WCAG2AA',
      },
    });
  });

  return {
    name: `${projectName || 'Site'} Accessibility Tests`,
    description: `WCAG 2.1 Level AA compliance tests for ${baseUrl}`,
    type: 'accessibility',
    tests,
  };
}

function getKeyPageUrls(analysis: SiteAnalysis, baseUrl: string): string[] {
  const urls: string[] = [];

  analysis.links.forEach(link => {
    if (link.isExternal || urls.length >= 5) return;

    // Only include internal pages
    if (link.href && !link.href.startsWith('#') && !link.href.startsWith('javascript:')) {
      const fullUrl = link.href.startsWith('http')
        ? link.href
        : `${baseUrl.replace(/\/$/, '')}${link.href.startsWith('/') ? '' : '/'}${link.href}`;

      if (!urls.includes(fullUrl) && fullUrl !== baseUrl) {
        urls.push(fullUrl);
      }
    }
  });

  return urls;
}

export default generateAccessibilityTemplate;
