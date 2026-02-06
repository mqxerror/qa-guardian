/**
 * Test Suite Templates - Shared Types
 * Feature #1731: Type definitions for test suite template generation
 */

import { SiteAnalysis } from '../../services/crawl4ai';

export interface TestSuiteTemplate {
  name: string;
  description: string;
  type: 'e2e' | 'visual' | 'accessibility' | 'performance' | 'load' | 'security';
  tests: GeneratedTest[];
}

export interface GeneratedTest {
  name: string;
  description?: string;
  type: string;
  steps?: TestStep[];
  target_url?: string;
  config?: Record<string, unknown>;
}

export interface TestStep {
  action: string;
  selector?: string;
  value?: string;
  description?: string;
}

export interface TemplateGeneratorOptions {
  projectName?: string;
  baseUrl: string;
  siteAnalysis: SiteAnalysis;
}

export type TemplateGenerator = (options: TemplateGeneratorOptions) => TestSuiteTemplate;
