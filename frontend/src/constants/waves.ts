/**
 * Wave Definitions for Quick Test
 * Feature #612: Centralized wave configuration
 *
 * Consolidates wave definitions from:
 * - QuickTestPage.tsx WAVE_DEFINITIONS
 * - useQuickTestSocket.ts INITIAL_WAVES
 * - CompareQuickTestPage.tsx INITIAL_WAVES
 * - DetailedReport.tsx WAVE_CONFIG
 */

import type { LucideIcon } from 'lucide-react';
import { Globe, Gauge, Shield, Brain, Accessibility, Network, Search } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface WaveStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
}

export interface WaveDefinition {
  wave: number;
  name: string;
  icon: LucideIcon;
  description?: string;
  steps: readonly { readonly name: string }[];
}

export interface WaveState {
  wave: number;
  name: string;
  status: 'waiting' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  steps: WaveStep[];
  data?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date | null;
}

// ============================================================
// Wave Definitions (canonical source)
// ============================================================

export const WAVE_DEFINITIONS: readonly WaveDefinition[] = [
  {
    wave: 1,
    name: 'Health Check',
    icon: Globe,
    description: 'DNS, HTTP, SSL, and response time checks',
    steps: [
      { name: 'DNS Resolution' },
      { name: 'HTTP Request' },
      { name: 'SSL Certificate' },
      { name: 'Response Time' },
    ],
  },
  {
    wave: 2,
    name: 'Visual + Performance',
    icon: Gauge,
    description: 'Screenshots and Core Web Vitals',
    steps: [
      { name: 'Desktop Screenshot' },
      { name: 'Mobile Screenshot' },
      { name: 'Core Web Vitals' },
      { name: 'Performance Score' },
    ],
  },
  {
    wave: 3,
    name: 'Security Scan',
    icon: Shield,
    description: 'Security headers, cookies, and exposure analysis',
    steps: [
      { name: 'Security Headers' },
      { name: 'Cookie Audit' },
      { name: 'Mixed Content' },
      { name: 'Exposed Paths' },
    ],
  },
  {
    wave: 4,
    name: 'AI Analysis',
    icon: Brain,
    description: 'AI-powered test suggestions and UX analysis',
    steps: [
      { name: 'Test Suggestions' },
      { name: 'UX Issues' },
      { name: 'Accessibility' },
      { name: 'Summary' },
    ],
  },
  {
    wave: 5,
    name: 'Accessibility',
    icon: Accessibility,
    description: 'WCAG 2.1 AA compliance scan',
    steps: [
      { name: 'WCAG 2.1 AA Scan' },
      { name: 'Critical Violations' },
      { name: 'Serious Violations' },
      { name: 'Minor Violations' },
    ],
  },
  {
    wave: 6,
    name: 'API Discovery',
    icon: Network,
    description: 'OpenAPI detection and endpoint analysis',
    steps: [
      { name: 'OpenAPI Spec Detection' },
      { name: 'Common API Paths' },
      { name: 'Endpoint Health' },
      { name: 'Auth Protection' },
    ],
  },
  {
    wave: 7,
    name: 'SEO Analysis',
    icon: Search,
    description: 'Meta tags, headings, schema markup, and crawlability',
    steps: [
      { name: 'Meta Tags' },
      { name: 'Heading Structure' },
      { name: 'Schema Markup' },
      { name: 'Navigation' },
      { name: 'Tracking Scripts' },
      { name: 'Crawlability' },
    ],
  },
] as const;

// ============================================================
// Factory Functions
// ============================================================

/**
 * Create fresh initial wave states for socket hooks
 * Returns a new array each time to avoid mutations
 */
export function getInitialWaveStates(): WaveState[] {
  return WAVE_DEFINITIONS.map((def) => ({
    wave: def.wave,
    name: def.name,
    status: 'waiting' as const,
    steps: def.steps.map((step) => ({
      name: step.name,
      status: 'pending' as const,
    })),
  }));
}

/**
 * Get wave definitions with status for QuickTestPage display
 */
export function getWaveDefinitionsWithStatus(): Array<{
  wave: number;
  name: string;
  icon: LucideIcon;
  steps: Array<{ name: string; status: 'pending' }>;
}> {
  return WAVE_DEFINITIONS.map((def) => ({
    wave: def.wave,
    name: def.name,
    icon: def.icon,
    steps: def.steps.map((step) => ({
      name: step.name,
      status: 'pending' as const,
    })),
  }));
}

/**
 * Get wave config for DetailedReport display
 */
export function getWaveConfig(): Array<{
  wave: number;
  title: string;
  icon: LucideIcon;
}> {
  return WAVE_DEFINITIONS.map((def) => ({
    wave: def.wave,
    title: def.name,
    icon: def.icon,
  }));
}

/**
 * Get wave definition by wave number
 */
export function getWaveDefinition(waveNumber: number): WaveDefinition | undefined {
  return WAVE_DEFINITIONS.find((def) => def.wave === waveNumber);
}
