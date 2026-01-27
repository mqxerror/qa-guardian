/**
 * Accessibility Testing Helper Functions
 *
 * This module contains helper functions and type definitions for accessibility testing.
 * Extracted from test-runs.ts as part of Feature #1356 to reduce file size.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Accessibility violation impact levels
 */
export type A11yImpact = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Accessibility violation definition
 */
export interface A11yViolationType {
  id: string;
  impact: A11yImpact;
  description: string;
  help: string;
  wcagTags: string[];
}

/**
 * Accessibility violation with nodes and source
 */
export interface A11yViolation extends A11yViolationType {
  helpUrl: string;
  nodes: Array<{ html: string; target: string[]; shadowHost?: string; inShadowDom?: boolean }>;
  source: 'axe-core' | 'pa11y';
  inShadowDom?: boolean;
}

/**
 * Shadow DOM scanning results
 */
export interface ShadowDomInfo {
  openShadowRoots: Array<{
    hostSelector: string;
    hostTagName: string;
    elementCount: number;
  }>;
  closedShadowRoots: Array<{
    hostSelector: string;
    hostTagName: string;
  }>;
  totalOpenElements: number;
  canScanAllShadowDom: boolean;
  warnings: string[];
}

/**
 * Iframe scanning results
 */
export interface IframeInfo {
  totalIframes: number;
  sameOriginIframes: Array<{
    selector: string;
    src: string;
    origin: string;
    title: string;
    canScan: boolean;
  }>;
  crossOriginIframes: Array<{
    selector: string;
    src: string;
    origin: string;
    title: string;
    canScan: boolean;
  }>;
  warnings: string[];
  canScanAllIframes: boolean;
}

/**
 * DOM size analysis results
 */
export interface DomSizeInfo {
  totalNodes: number;
  textNodes: number;
  totalNodesFormatted: string;
  isLargeDom: boolean;
  isVeryLargeDom: boolean;
  isExtremelyLargeDom: boolean;
  performanceImpact: 'none' | 'moderate' | 'high' | 'critical';
  estimatedScanTimeMs: number;
  recommendedTimeoutSeconds: number;
  warnings: string[];
  analysisTimeMs: number;
}

/**
 * Accessibility scan configuration
 */
export interface A11yConfig {
  wcagLevel: 'A' | 'AA' | 'AAA';
  includeBestPractices: boolean;
  includeExperimental: boolean;
  includePa11y: boolean;
  javascriptDisabled: boolean;
}

/**
 * Accessibility scan results
 */
export interface A11yScanResults {
  url: string;
  wcag_level: string;
  timestamp: string;
  score: number;
  violations: {
    count: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    items: A11yViolation[];
  };
  passes: {
    count: number;
    categories: string[];
  };
  incomplete: {
    count: number;
    items: Array<{ id: string; description: string }>;
  };
  inapplicable: {
    count: number;
  };
  test_engine: {
    name: string;
    version: string;
    engines?: Array<{ name: string; version: string }>;
  };
  configuration: A11yConfig;
  javascriptDisabled?: {
    enabled: boolean;
    warning?: string;
    limitedScope: boolean;
    scanType: string;
    note: string;
  };
  shadowDom?: {
    scanned: boolean;
    openShadowRoots: number;
    closedShadowRoots: number;
    totalOpenElements: number;
    canScanAllShadowDom: boolean;
    openHosts: Array<{
      selector: string;
      tagName: string;
      elementCount: number;
      scanned: boolean;
    }>;
    closedHosts: Array<{
      selector: string;
      tagName: string;
      scanned: boolean;
      reason: string;
    }>;
    warnings: string[];
    violationsInShadowDom: number;
  };
  iframes?: {
    scanned: boolean;
    totalIframes: number;
    sameOriginCount: number;
    crossOriginCount: number;
    canScanAllIframes: boolean;
    sameOrigin: Array<{
      selector: string;
      src: string;
      origin: string;
      title: string;
      scanned: boolean;
    }>;
    crossOrigin: Array<{
      selector: string;
      src: string;
      origin: string;
      title: string;
      scanned: boolean;
      reason: string;
    }>;
    warnings: string[];
    violationsInIframes: number;
  };
}

// ============================================================================
// Violation Type Definitions
// ============================================================================

/**
 * Standard axe-core violation types
 */
export const AXE_VIOLATION_TYPES: A11yViolationType[] = [
  { id: 'color-contrast', impact: 'serious', description: 'Elements must have sufficient color contrast', help: 'Ensure the contrast ratio between foreground and background colors meets WCAG 2 AA requirements', wcagTags: ['wcag2aa', 'wcag143'] },
  { id: 'image-alt', impact: 'critical', description: 'Images must have alternate text', help: 'Ensures <img> elements have alternate text or a role of none or presentation', wcagTags: ['wcag2a', 'wcag111'] },
  { id: 'button-name', impact: 'critical', description: 'Buttons must have discernible text', help: 'Ensures buttons have discernible text', wcagTags: ['wcag2a', 'wcag412'] },
  { id: 'link-name', impact: 'serious', description: 'Links must have discernible text', help: 'Ensures links have discernible text', wcagTags: ['wcag2a', 'wcag412'] },
  { id: 'label', impact: 'critical', description: 'Form elements must have labels', help: 'Ensures every form element has a label', wcagTags: ['wcag2a', 'wcag412'] },
  { id: 'aria-required-attr', impact: 'critical', description: 'Required ARIA attributes must be provided', help: 'Ensures elements with ARIA roles have required attributes', wcagTags: ['wcag2a', 'wcag412'] },
  { id: 'html-lang-valid', impact: 'serious', description: 'HTML must have a valid lang attribute', help: 'Ensures the lang attribute is valid', wcagTags: ['wcag2a', 'wcag311'] },
  { id: 'heading-order', impact: 'moderate', description: 'Heading levels should only increase by one', help: 'Ensures headings are in logical order', wcagTags: ['best-practice'] },
  { id: 'landmark-one-main', impact: 'moderate', description: 'Page should contain one main landmark', help: 'Document should have one main landmark', wcagTags: ['best-practice'] },
  { id: 'focus-visible', impact: 'serious', description: 'Elements should have visible focus indicators', help: 'Ensures interactive elements have visible focus', wcagTags: ['wcag2aa', 'wcag247'] },
];

/**
 * Pa11y-specific violation types (complementary to axe-core)
 */
export const PA11Y_VIOLATION_TYPES: A11yViolationType[] = [
  { id: 'WCAG2AA.Principle1.Guideline1_3.1_3_1.H48', impact: 'moderate', description: 'Navigation must use proper list markup', help: 'Use <ul> or <ol> for navigation links', wcagTags: ['wcag2aa', 'wcag131'] },
  { id: 'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18', impact: 'serious', description: 'Visual presentation contrast check', help: 'Ensure visual presentation meets contrast requirements', wcagTags: ['wcag2aa', 'wcag143'] },
  { id: 'WCAG2AA.Principle2.Guideline2_4.2_4_1.H64', impact: 'moderate', description: 'Frames must have titles', help: 'Each frame and iframe should have a title attribute', wcagTags: ['wcag2a', 'wcag241'] },
  { id: 'WCAG2AA.Principle3.Guideline3_2.3_2_2.H32', impact: 'serious', description: 'Forms should have submit buttons', help: 'All forms should have an explicit submit button', wcagTags: ['wcag2a', 'wcag322'] },
  { id: 'WCAG2AA.Principle4.Guideline4_1.4_1_2.H91', impact: 'critical', description: 'Input elements must have accessible names', help: 'Ensure all input elements are labelled properly', wcagTags: ['wcag2a', 'wcag412'] },
];

/**
 * Shadow DOM-specific violation types
 */
export const SHADOW_DOM_VIOLATION_TYPES: A11yViolationType[] = [
  { id: 'shadow-dom-color-contrast', impact: 'serious', description: 'Shadow DOM elements must have sufficient color contrast', help: 'Ensure elements within Shadow DOM meet color contrast requirements', wcagTags: ['wcag2aa', 'wcag143'] },
  { id: 'shadow-dom-focus-visible', impact: 'serious', description: 'Shadow DOM interactive elements must have visible focus', help: 'Ensure focus indicators are visible for elements within Shadow DOM', wcagTags: ['wcag2aa', 'wcag247'] },
  { id: 'shadow-dom-aria-hidden', impact: 'serious', description: 'Shadow DOM must not hide focusable elements', help: 'Elements with aria-hidden should not contain focusable elements', wcagTags: ['wcag2a', 'wcag412'] },
];

/**
 * Iframe-specific violation types
 */
export const IFRAME_VIOLATION_TYPES: A11yViolationType[] = [
  { id: 'frame-title-unique', impact: 'serious', description: 'Iframes must have unique title attributes', help: 'Ensure iframe titles are unique and descriptive', wcagTags: ['wcag2a', 'wcag241'] },
  { id: 'frame-focusable-content', impact: 'moderate', description: 'Iframes with focusable content need accessible name', help: 'Iframes containing interactive elements need proper labeling', wcagTags: ['wcag2a', 'wcag412'] },
];

/**
 * Categories of passes for accessibility scans
 */
export const A11Y_PASS_CATEGORIES = [
  'color-contrast',
  'image-alt',
  'button-name',
  'link-name',
  'label',
  'aria-roles',
  'html-lang',
  'heading-order',
  'landmark',
  'focus-visible',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate random accessibility violations for simulation
 */
export function generateSimulatedViolations(
  baseCount: number,
  config: {
    includeBestPractices: boolean;
    includePa11y: boolean;
    shadowDomInfo?: ShadowDomInfo;
    iframeInfo?: IframeInfo;
  }
): A11yViolation[] {
  const violations: A11yViolation[] = [];

  // Add random axe-core violations
  for (let i = 0; i < baseCount; i++) {
    const violationType = AXE_VIOLATION_TYPES[Math.floor(Math.random() * AXE_VIOLATION_TYPES.length)];
    // Skip if violation is best-practice and not included
    if (violationType.wcagTags.includes('best-practice') && !config.includeBestPractices) continue;
    // Skip if already added
    if (violations.find(v => v.id === violationType.id)) continue;

    violations.push({
      ...violationType,
      helpUrl: `https://dequeuniversity.com/rules/axe/4.4/${violationType.id}`,
      nodes: [
        {
          html: `<div class="example-element">Example element</div>`,
          target: ['div.example-element'],
        },
      ],
      source: 'axe-core',
    });
  }

  // Add Pa11y violations if enabled
  if (config.includePa11y) {
    const pa11yViolationCount = Math.floor(Math.random() * 3);
    for (let i = 0; i < pa11yViolationCount; i++) {
      const violationType = PA11Y_VIOLATION_TYPES[Math.floor(Math.random() * PA11Y_VIOLATION_TYPES.length)];
      if (violations.find(v => v.id === violationType.id)) continue;

      violations.push({
        ...violationType,
        helpUrl: `https://squizlabs.github.io/HTML_CodeSniffer/Standards/WCAG2/`,
        nodes: [
          {
            html: `<nav class="example-nav">Navigation content</nav>`,
            target: ['nav.example-nav'],
          },
        ],
        source: 'pa11y',
      });
    }
  }

  // Add Shadow DOM-specific violations if Shadow DOM elements were found
  if (config.shadowDomInfo && config.shadowDomInfo.openShadowRoots.length > 0) {
    for (const shadowRoot of config.shadowDomInfo.openShadowRoots) {
      if (Math.random() > 0.5) {
        const violationType = SHADOW_DOM_VIOLATION_TYPES[Math.floor(Math.random() * SHADOW_DOM_VIOLATION_TYPES.length)];
        const existingViolation = violations.find(v => v.id === violationType.id);

        if (existingViolation) {
          existingViolation.nodes.push({
            html: `<div class="shadow-element">Shadow DOM content</div>`,
            target: [`${shadowRoot.hostSelector} >>> .shadow-element`],
            shadowHost: shadowRoot.hostSelector,
            inShadowDom: true,
          });
        } else {
          violations.push({
            ...violationType,
            helpUrl: `https://dequeuniversity.com/rules/axe/4.4/${violationType.id.replace('shadow-dom-', '')}`,
            nodes: [
              {
                html: `<div class="shadow-element">Shadow DOM content</div>`,
                target: [`${shadowRoot.hostSelector} >>> .shadow-element`],
                shadowHost: shadowRoot.hostSelector,
                inShadowDom: true,
              },
            ],
            source: 'axe-core',
            inShadowDom: true,
          });
        }
      }
    }
  }

  // Add iframe violations if cross-origin iframes found
  if (config.iframeInfo && config.iframeInfo.crossOriginIframes.length > 0) {
    const iframeViolationCount = Math.floor(Math.random() * 2);
    for (let i = 0; i < iframeViolationCount; i++) {
      const violationType = IFRAME_VIOLATION_TYPES[Math.floor(Math.random() * IFRAME_VIOLATION_TYPES.length)];
      if (violations.find(v => v.id === violationType.id)) continue;

      const iframe = config.iframeInfo.crossOriginIframes[Math.floor(Math.random() * config.iframeInfo.crossOriginIframes.length)];
      violations.push({
        ...violationType,
        helpUrl: `https://dequeuniversity.com/rules/axe/4.4/${violationType.id}`,
        nodes: [
          {
            html: `<iframe src="${iframe.src}" title="${iframe.title || 'Untitled'}"></iframe>`,
            target: [iframe.selector],
          },
        ],
        source: 'axe-core',
      });
    }
  }

  return violations;
}

/**
 * Calculate accessibility score based on violations
 */
export function calculateA11yScore(violations: A11yViolation[], passesCount: number): number {
  const criticalCount = violations.filter(v => v.impact === 'critical').length;
  const seriousCount = violations.filter(v => v.impact === 'serious').length;
  const moderateCount = violations.filter(v => v.impact === 'moderate').length;
  const minorCount = violations.filter(v => v.impact === 'minor').length;

  // Score calculation: penalties for each severity level
  const violationPenalty = (criticalCount * 15) + (seriousCount * 10) + (moderateCount * 5) + (minorCount * 2);
  const totalChecks = passesCount + violations.length;

  if (totalChecks === 0) return 100;

  return Math.max(0, Math.min(100, Math.round(100 - (violationPenalty / totalChecks * 100))));
}

/**
 * Count violations by impact level
 */
export function countViolationsByImpact(violations: A11yViolation[]): {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
} {
  return {
    critical: violations.filter(v => v.impact === 'critical').length,
    serious: violations.filter(v => v.impact === 'serious').length,
    moderate: violations.filter(v => v.impact === 'moderate').length,
    minor: violations.filter(v => v.impact === 'minor').length,
  };
}

/**
 * Check if test should fail based on threshold configuration
 */
export function checkA11yThresholds(
  violations: A11yViolation[],
  config: {
    failOnAny?: boolean;
    failOnCritical?: number;
    failOnSerious?: number;
    failOnModerate?: number;
    failOnMinor?: number;
  }
): { shouldFail: boolean; reasons: string[] } {
  const counts = countViolationsByImpact(violations);
  const reasons: string[] = [];

  if (config.failOnAny && violations.length > 0) {
    reasons.push(`Found ${violations.length} accessibility violation(s) (fail-on-any mode)`);
  } else {
    if (config.failOnCritical !== undefined && counts.critical > config.failOnCritical) {
      reasons.push(`Critical violations: ${counts.critical} > threshold ${config.failOnCritical}`);
    }
    if (config.failOnSerious !== undefined && counts.serious > config.failOnSerious) {
      reasons.push(`Serious violations: ${counts.serious} > threshold ${config.failOnSerious}`);
    }
    if (config.failOnModerate !== undefined && counts.moderate > config.failOnModerate) {
      reasons.push(`Moderate violations: ${counts.moderate} > threshold ${config.failOnModerate}`);
    }
    if (config.failOnMinor !== undefined && counts.minor > config.failOnMinor) {
      reasons.push(`Minor violations: ${counts.minor} > threshold ${config.failOnMinor}`);
    }

    // Default behavior: fail on any critical/serious violations if no threshold configured
    if (
      config.failOnCritical === undefined &&
      config.failOnSerious === undefined &&
      config.failOnModerate === undefined &&
      config.failOnMinor === undefined &&
      !config.failOnAny
    ) {
      const criticalOrSerious = counts.critical + counts.serious;
      if (criticalOrSerious > 0) {
        reasons.push(`Found ${criticalOrSerious} critical/serious accessibility violations (default behavior)`);
      }
    }
  }

  return { shouldFail: reasons.length > 0, reasons };
}

/**
 * Build test engine info for results
 */
export function buildTestEngineInfo(includePa11y: boolean): {
  name: string;
  version: string;
  engines?: Array<{ name: string; version: string }>;
} {
  if (includePa11y) {
    return {
      name: 'axe-core + Pa11y',
      version: '4.8.3 / 7.1.0',
      engines: [
        { name: 'axe-core', version: '4.8.3' },
        { name: 'Pa11y', version: '7.1.0' },
      ],
    };
  }
  return {
    name: 'axe-core',
    version: '4.8.3',
  };
}
