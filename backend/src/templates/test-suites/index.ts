/**
 * Test Suite Templates - Main Export
 * Feature #1731: Unified export for all test suite template generators
 *
 * Provides generateAllSuites() function that creates comprehensive
 * test suites based on site analysis from Crawl4AI.
 */

import { SiteAnalysis } from '../../services/crawl4ai';
import { TestSuiteTemplate, TemplateGeneratorOptions } from './types';
import { generateE2ETemplate } from './e2e-template';
import { generateVisualTemplate } from './visual-template';
import { generateAccessibilityTemplate } from './accessibility-template';
import { generatePerformanceTemplate } from './performance-template';
import { generateLoadTemplate } from './load-template';
import { generateSecurityTemplate } from './security-template';

export * from './types';
export { generateE2ETemplate } from './e2e-template';
export { generateVisualTemplate } from './visual-template';
export { generateAccessibilityTemplate } from './accessibility-template';
export { generatePerformanceTemplate } from './performance-template';
export { generateLoadTemplate } from './load-template';
export { generateSecurityTemplate } from './security-template';

/**
 * Suite type identifiers
 */
export type SuiteType = 'e2e' | 'visual' | 'accessibility' | 'performance' | 'load' | 'security';

/**
 * All available suite types
 */
export const SUITE_TYPES: SuiteType[] = [
  'e2e',
  'visual',
  'accessibility',
  'performance',
  'load',
  'security',
];

/**
 * Options for generating all test suites
 */
export interface GenerateAllSuitesOptions {
  /** Project name for naming suites */
  projectName?: string;
  /** Base URL of the site to test */
  baseUrl: string;
  /** Site analysis from Crawl4AI */
  siteAnalysis: SiteAnalysis;
  /** Which suite types to generate (defaults to all) */
  suiteTypes?: SuiteType[];
}

/**
 * Result of generating all test suites
 */
export interface GeneratedSuites {
  /** Generated test suites keyed by type */
  suites: Record<SuiteType, TestSuiteTemplate | null>;
  /** Summary of generated suites */
  summary: {
    totalSuites: number;
    totalTests: number;
    suiteBreakdown: Array<{
      type: SuiteType;
      testCount: number;
    }>;
  };
}

/**
 * Generate all test suites based on site analysis
 *
 * @param options - Generation options including site analysis
 * @returns Object containing all generated suites and summary
 *
 * @example
 * ```typescript
 * const siteAnalysis = await crawlSite('https://example.com');
 * const { suites, summary } = generateAllSuites({
 *   projectName: 'Example Site',
 *   baseUrl: 'https://example.com',
 *   siteAnalysis,
 * });
 *
 * console.log(`Generated ${summary.totalSuites} suites with ${summary.totalTests} tests`);
 * ```
 */
export function generateAllSuites(options: GenerateAllSuitesOptions): GeneratedSuites {
  const { projectName, baseUrl, siteAnalysis, suiteTypes = SUITE_TYPES } = options;

  const templateOptions: TemplateGeneratorOptions = {
    projectName,
    baseUrl,
    siteAnalysis,
  };

  const suites: Record<SuiteType, TestSuiteTemplate | null> = {
    e2e: null,
    visual: null,
    accessibility: null,
    performance: null,
    load: null,
    security: null,
  };

  const suiteBreakdown: Array<{ type: SuiteType; testCount: number }> = [];
  let totalTests = 0;

  // Generate requested suite types
  for (const suiteType of suiteTypes) {
    try {
      let suite: TestSuiteTemplate | null = null;

      switch (suiteType) {
        case 'e2e':
          suite = generateE2ETemplate(templateOptions);
          break;
        case 'visual':
          suite = generateVisualTemplate(templateOptions);
          break;
        case 'accessibility':
          suite = generateAccessibilityTemplate(templateOptions);
          break;
        case 'performance':
          suite = generatePerformanceTemplate(templateOptions);
          break;
        case 'load':
          suite = generateLoadTemplate(templateOptions);
          break;
        case 'security':
          suite = generateSecurityTemplate(templateOptions);
          break;
      }

      if (suite) {
        suites[suiteType] = suite;
        const testCount = suite.tests.length;
        suiteBreakdown.push({ type: suiteType, testCount });
        totalTests += testCount;
      }
    } catch (error) {
      console.error(`Error generating ${suiteType} suite:`, error);
      suites[suiteType] = null;
    }
  }

  return {
    suites,
    summary: {
      totalSuites: suiteBreakdown.length,
      totalTests,
      suiteBreakdown,
    },
  };
}

/**
 * Generate a single test suite of the specified type
 *
 * @param suiteType - Type of suite to generate
 * @param options - Generation options
 * @returns Generated test suite or null if generation fails
 */
export function generateSuite(
  suiteType: SuiteType,
  options: TemplateGeneratorOptions
): TestSuiteTemplate | null {
  switch (suiteType) {
    case 'e2e':
      return generateE2ETemplate(options);
    case 'visual':
      return generateVisualTemplate(options);
    case 'accessibility':
      return generateAccessibilityTemplate(options);
    case 'performance':
      return generatePerformanceTemplate(options);
    case 'load':
      return generateLoadTemplate(options);
    case 'security':
      return generateSecurityTemplate(options);
    default:
      return null;
  }
}

/**
 * Get metadata about available suite types
 */
export function getSuiteTypeInfo(): Array<{
  type: SuiteType;
  name: string;
  description: string;
}> {
  return [
    {
      type: 'e2e',
      name: 'End-to-End Tests',
      description: 'User journey and functional flow testing with Playwright',
    },
    {
      type: 'visual',
      name: 'Visual Regression Tests',
      description: 'Screenshot comparison testing across viewports',
    },
    {
      type: 'accessibility',
      name: 'Accessibility Tests',
      description: 'WCAG 2.1 AA compliance testing with axe-core',
    },
    {
      type: 'performance',
      name: 'Performance Tests',
      description: 'Lighthouse audits for Core Web Vitals and performance metrics',
    },
    {
      type: 'load',
      name: 'Load Tests',
      description: 'K6-based load, stress, and endurance testing',
    },
    {
      type: 'security',
      name: 'Security Tests',
      description: 'DAST scanning for vulnerabilities and security misconfigurations',
    },
  ];
}

export default generateAllSuites;
