/**
 * Accessibility Tools Module
 *
 * Tools for running accessibility audits, analyzing WCAG compliance,
 * and tracking accessibility improvements over time.
 */

import { ToolDefinition } from '../types';

export const ACCESSIBILITY_TOOLS: ToolDefinition[] = [
  // Feature #988: Run accessibility scan MCP tool
  {
    name: 'run_accessibility_scan',
    description: 'Trigger an accessibility audit using axe-core. Scans a URL for WCAG compliance issues and returns violations categorized by severity.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to scan for accessibility issues',
        },
        wcag_level: {
          type: 'string',
          enum: ['A', 'AA', 'AAA'],
          description: 'WCAG conformance level to test against (default: AA)',
        },
        include_best_practices: {
          type: 'boolean',
          description: 'Include best practice checks beyond WCAG requirements (default: true)',
        },
        include_experimental: {
          type: 'boolean',
          description: 'Include experimental accessibility rules (default: false)',
        },
        wait_for_selector: {
          type: 'string',
          description: 'CSS selector to wait for before running scan (for dynamic content)',
        },
        project_id: {
          type: 'string',
          description: 'Optional project ID to associate the scan with',
        },
        test_name: {
          type: 'string',
          description: 'Optional name for the accessibility test (auto-generated if not provided)',
        },
      },
      required: ['url'],
    },
  },
  // Feature #989: Get accessibility results MCP tool
  {
    name: 'get_accessibility_results',
    description: 'Get detailed accessibility scan results including violations, severity levels, and remediation guidance. Use after running an accessibility scan.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The run ID from an accessibility scan',
        },
        test_id: {
          type: 'string',
          description: 'The test ID of an accessibility test (alternative to run_id - gets latest run)',
        },
        severity_filter: {
          type: 'string',
          enum: ['critical', 'serious', 'moderate', 'minor', 'all'],
          description: 'Filter violations by severity level (default: all)',
        },
        include_passing: {
          type: 'boolean',
          description: 'Include passing rules in results (default: false)',
        },
        include_remediation: {
          type: 'boolean',
          description: 'Include detailed remediation guidance for violations (default: true)',
        },
      },
    },
  },
  // Feature #990: Get accessibility trends MCP tool
  {
    name: 'get_accessibility_trends',
    description: 'Get accessibility score and violation trends over time for a project or specific test. Useful for tracking accessibility improvements.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get trends for',
        },
        test_id: {
          type: 'string',
          description: 'Optional specific test ID to get trends for',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period for trends (default: 30d)',
        },
        include_violation_breakdown: {
          type: 'boolean',
          description: 'Include breakdown of violations by rule over time (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1435: Removed export_accessibility_report - use export_data with type=accessibility
  // Feature #992: Get Core Web Vitals MCP tool
  {
    name: 'get_core_web_vitals',
    description: 'Get Core Web Vitals (LCP, FID/INP, CLS) for a URL. Can run a new Lighthouse audit or retrieve from existing test results.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to measure Core Web Vitals for',
        },
        test_id: {
          type: 'string',
          description: 'Existing Lighthouse test ID to get CWV from (alternative to url)',
        },
        run_id: {
          type: 'string',
          description: 'Specific run ID to get CWV from (alternative to url)',
        },
        device: {
          type: 'string',
          enum: ['mobile', 'desktop'],
          description: 'Device type to emulate (default: mobile - Google uses mobile-first)',
        },
        run_new_audit: {
          type: 'boolean',
          description: 'Run a new Lighthouse audit even if test_id provided (default: false)',
        },
      },
    },
  },
  // Feature #993: Schedule performance audit MCP tool
  {
    name: 'schedule_performance_audit',
    description: 'Schedule recurring Lighthouse performance audits for a URL. Creates automated monitoring for Core Web Vitals and performance metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to monitor for performance',
        },
        test_id: {
          type: 'string',
          description: 'Existing Lighthouse test ID to schedule (alternative to url)',
        },
        frequency: {
          type: 'string',
          enum: ['hourly', 'daily', 'weekly', 'monthly'],
          description: 'How often to run the audit (default: daily)',
        },
        time_of_day: {
          type: 'string',
          description: 'Time to run daily/weekly/monthly audits in HH:MM format (default: 02:00)',
        },
        day_of_week: {
          type: 'number',
          description: 'Day of week for weekly audits (0=Sunday, 6=Saturday, default: 1=Monday)',
        },
        device: {
          type: 'string',
          enum: ['mobile', 'desktop', 'both'],
          description: 'Device type to test (default: both)',
        },
        alert_on_regression: {
          type: 'boolean',
          description: 'Send alerts when performance regresses (default: true)',
        },
        regression_threshold: {
          type: 'number',
          description: 'Percentage drop that triggers regression alert (default: 10)',
        },
        project_id: {
          type: 'string',
          description: 'Project to create schedule under (uses default if not specified)',
        },
        name: {
          type: 'string',
          description: 'Custom name for the schedule',
        },
      },
    },
  },
];

export const ACCESSIBILITY_TOOL_NAMES = ACCESSIBILITY_TOOLS.map(t => t.name);
