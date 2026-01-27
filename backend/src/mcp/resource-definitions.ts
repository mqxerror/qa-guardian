/**
 * MCP Resource Definitions
 *
 * This file defines the resources available through the MCP server.
 * Resources represent data sources that AI agents can read and query.
 */

/**
 * Represents an MCP resource definition
 */
export interface Resource {
  /** Unique URI identifying the resource (e.g., 'qa-guardian://projects') */
  uri: string;
  /** Human-readable name for the resource */
  name: string;
  /** Description of what the resource provides */
  description: string;
  /** MIME type of the resource content */
  mimeType: string;
}

/**
 * All available MCP resources in the QA Guardian platform.
 *
 * Resources follow the URI scheme: qa-guardian://<resource-path>
 * Parameterized resources use {param} syntax (e.g., qa-guardian://projects/{id})
 */
export const RESOURCES: Resource[] = [
  {
    uri: 'qa-guardian://projects',
    name: 'Projects',
    description: 'All projects in the organization',
    mimeType: 'application/json',
  },
  {
    uri: 'qa-guardian://recent-runs',
    name: 'Recent Test Runs',
    description: 'Recent test execution results',
    mimeType: 'application/json',
  },
  {
    uri: 'qa-guardian://dashboard-stats',
    name: 'Dashboard Statistics',
    description: 'Overall test statistics and metrics',
    mimeType: 'application/json',
  },
  {
    uri: 'qa-guardian://test-runs/{id}',
    name: 'Test Run Details',
    description: 'Details for a specific test run by ID',
    mimeType: 'application/json',
  },
  {
    uri: 'qa-guardian://test-runs/{id}/results',
    name: 'Test Run Results',
    description: 'Results for all tests in a specific test run',
    mimeType: 'application/json',
  },
  {
    uri: 'qa-guardian://projects/{id}',
    name: 'Project Details',
    description: 'Details for a specific project by ID',
    mimeType: 'application/json',
  },
  // Feature #1026: Project test suites resource
  {
    uri: 'qa-guardian://projects/{id}/suites',
    name: 'Project Test Suites',
    description: 'List of test suites for a specific project',
    mimeType: 'application/json',
  },
  {
    uri: 'qa-guardian://test-runs/{id}/artifacts',
    name: 'Test Run Artifacts',
    description: 'Artifacts (screenshots, videos, traces) from a test run',
    mimeType: 'application/json',
  },
  // ===== MCP v2.0 Resources =====
  {
    uri: 'qa-guardian://security/vulnerabilities',
    name: 'Security Vulnerabilities',
    description: 'List of detected security vulnerabilities across all projects',
    mimeType: 'application/json',
  },
  {
    uri: 'qa-guardian://checks/{id}/status',
    name: 'Monitoring Check Status',
    description: 'Current status and metrics for a monitoring check',
    mimeType: 'application/json',
  },
  {
    uri: 'qa-guardian://alerts/active',
    name: 'Active Alerts',
    description: 'List of currently active monitoring alerts',
    mimeType: 'application/json',
  },
  {
    uri: 'qa-guardian://incidents',
    name: 'Incidents',
    description: 'List of active and recent incidents',
    mimeType: 'application/json',
  },
  {
    uri: 'qa-guardian://security/trends',
    name: 'Security Trends',
    description: 'Security metrics and trends over time',
    mimeType: 'application/json',
  },
  // Feature #1033: Analytics dashboard resource
  {
    uri: 'qa-guardian://analytics/dashboard',
    name: 'Analytics Dashboard',
    description: 'Dashboard summary data with test metrics and trends',
    mimeType: 'application/json',
  },
];
