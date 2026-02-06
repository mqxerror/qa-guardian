/**
 * Centralized cache key patterns for Redis caching
 * Feature #60: Redis cache service for backend
 *
 * Key naming convention: {domain}:{entity}:{identifier}
 * Pattern examples:
 *   - projects:list:org123        (list of projects for org)
 *   - projects:detail:proj456     (single project details)
 *   - suites:list:proj456         (list of suites for project)
 *   - tests:list:suite789         (list of tests for suite)
 *   - runs:list:test123           (list of runs for test)
 */

export const CacheKeys = {
  // Projects
  projects: {
    list: (orgId: string) => `projects:list:${orgId}`,
    detail: (projectId: string) => `projects:detail:${projectId}`,
    members: (projectId: string) => `projects:members:${projectId}`,
    pattern: 'projects:*',
  },

  // Test Suites
  suites: {
    list: (projectId: string) => `suites:list:${projectId}`,
    detail: (suiteId: string) => `suites:detail:${suiteId}`,
    pattern: 'suites:*',
    byProject: (projectId: string) => `suites:*:${projectId}*`,
  },

  // Tests
  tests: {
    list: (suiteId: string) => `tests:list:${suiteId}`,
    detail: (testId: string) => `tests:detail:${testId}`,
    code: (testId: string, format: string) => `tests:code:${testId}:${format}`,
    pattern: 'tests:*',
    bySuite: (suiteId: string) => `tests:*:${suiteId}*`,
  },

  // Test Runs
  runs: {
    list: (orgId: string) => `runs:list:${orgId}`,
    listPaginated: (orgId: string, page: number, limit: number, filters?: string) =>
      `runs:list:${orgId}:p${page}:l${limit}${filters ? `:${filters}` : ''}`,
    detail: (runId: string) => `runs:detail:${runId}`,
    byTest: (testId: string) => `runs:bytest:${testId}`,
    bySuite: (suiteId: string) => `runs:bysuite:${suiteId}`,
    pattern: 'runs:*',
  },

  // Organizations
  organizations: {
    detail: (orgId: string) => `orgs:detail:${orgId}`,
    members: (orgId: string) => `orgs:members:${orgId}`,
    pattern: 'orgs:*',
  },

  // Users
  users: {
    detail: (userId: string) => `users:detail:${userId}`,
    byEmail: (email: string) => `users:email:${email}`,
    pattern: 'users:*',
  },

  // Sessions (for invalidation)
  sessions: {
    user: (userId: string) => `sessions:user:${userId}`,
    pattern: 'sessions:*',
  },

  // GitHub
  github: {
    status: (userId: string) => `github:status:${userId}`,
    repos: (userId: string) => `github:repos:${userId}`,
    connection: (projectId: string) => `github:connection:${projectId}`,
    pattern: 'github:*',
  },

  // Settings
  settings: {
    healing: (projectId: string) => `settings:healing:${projectId}`,
    alerts: (projectId: string) => `settings:alerts:${projectId}`,
    env: (projectId: string) => `settings:env:${projectId}`,
    pattern: 'settings:*',
  },

  // Analytics
  analytics: {
    dashboard: (orgId: string) => `analytics:dashboard:${orgId}`,
    trends: (orgId: string, period: string) => `analytics:trends:${orgId}:${period}`,
    pattern: 'analytics:*',
  },

  // Security (SAST/DAST)
  security: {
    sastConfig: (projectId: string) => `security:sast:config:${projectId}`,
    sastScans: (projectId: string) => `security:sast:scans:${projectId}`,
    dastConfig: (projectId: string) => `security:dast:config:${projectId}`,
    dastScans: (projectId: string) => `security:dast:scans:${projectId}`,
    // Feature #123: Dashboard cache keys
    dashboard: (orgId: string) => `security:dashboard:${orgId}`,
    sastDashboard: (orgId: string) => `security:sast:dashboard:${orgId}`,
    dastDashboard: (orgId: string) => `security:dast:dashboard:${orgId}`,
    pattern: 'security:*',
  },

  // Feature #123: Audit Logs
  auditLogs: {
    list: (orgId: string, filters?: string) => `auditlogs:list:${orgId}${filters ? `:${filters}` : ''}`,
    actions: (orgId: string) => `auditlogs:actions:${orgId}`,
    resourceTypes: (orgId: string) => `auditlogs:resourcetypes:${orgId}`,
    pattern: 'auditlogs:*',
    byOrg: (orgId: string) => `auditlogs:*:${orgId}*`,
  },

  // Feature #123: Monitoring
  monitoring: {
    summary: (orgId: string) => `monitoring:summary:${orgId}`,
    uptimeChecks: (orgId: string) => `monitoring:uptime:list:${orgId}`,
    uptimeDetail: (checkId: string) => `monitoring:uptime:detail:${checkId}`,
    uptimeResults: (checkId: string) => `monitoring:uptime:results:${checkId}`,
    pattern: 'monitoring:*',
    byOrg: (orgId: string) => `monitoring:*:${orgId}*`,
  },

  // Visual Regression
  visual: {
    pendingCount: (orgId: string, projectId?: string) =>
      `visual:pending:count:${orgId}${projectId ? `:${projectId}` : ''}`,
    pattern: 'visual:*',
  },

  // Review Settings (Feature #89)
  review: {
    settings: (suiteId: string) => `review:settings:${suiteId}`,
    pattern: 'review:*',
  },

  // Feature #145: Schedules
  schedules: {
    list: (orgId: string) => `schedules:list:${orgId}`,
    detail: (scheduleId: string) => `schedules:detail:${scheduleId}`,
    pattern: 'schedules:*',
  },

  // Feature #145: Flaky Tests / Quarantine
  flakyTests: {
    list: (orgId: string) => `flaky:list:${orgId}`,
    quarantine: (testId: string) => `flaky:quarantine:${testId}`,
    // Feature #184: Flakiness trend cache per org+test
    trend: (orgId: string, testId: string) => `flaky:trend:${orgId}:${testId}`,
    pattern: 'flaky:*',
  },
} as const;

// Default TTL values in seconds
export const CacheTTL = {
  // Short-lived cache (1 minute) - for rapidly changing data
  SHORT: 60,

  // Medium cache (5 minutes) - for moderately changing data
  MEDIUM: 5 * 60,

  // Standard cache (15 minutes) - default for most data
  STANDARD: 15 * 60,

  // Long cache (1 hour) - for slowly changing data
  LONG: 60 * 60,

  // Extended cache (6 hours) - for rarely changing data
  EXTENDED: 6 * 60 * 60,

  // Session cache (24 hours) - for user sessions
  SESSION: 24 * 60 * 60,
} as const;
