/**
 * Dependency Lists Routes
 *
 * Routes for managing dependency allowlists/blocklists, health scores,
 * and dependency age tracking.
 *
 * Feature #777: Dependency Allowlist/Blocklist
 * Feature #778: Dependency Health Score
 * Feature #772: Dependency Age Tracking
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth.js';

// ============================================================
// Feature #777: Dependency Allowlist/Blocklist Types
// ============================================================

interface DependencyListEntry {
  id: string;
  organization_id: string;
  package_name: string;        // Package name (supports wildcards like @company/*)
  version_pattern?: string;    // Optional version pattern (e.g., ">=1.0.0", "*")
  list_type: 'allowlist' | 'blocklist';
  reason: string;              // Reason for adding to list
  severity_override?: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // For blocklist: treat as this severity
  expires_at?: Date;           // Optional expiration
  created_at: Date;
  created_by: string;
  updated_at: Date;
}

// ============================================================
// Feature #778: Dependency Health Score Types
// ============================================================

interface DependencyHealthScore {
  name: string;
  version: string;
  health_score: number; // 0-100
  factors: {
    maintenance: {
      score: number;
      last_release_days_ago: number;
      is_maintained: boolean;
      release_frequency: 'frequent' | 'moderate' | 'infrequent' | 'abandoned';
    };
    security: {
      score: number;
      known_vulnerabilities: number;
      critical_vulns: number;
      high_vulns: number;
      has_security_policy: boolean;
    };
    community: {
      score: number;
      github_stars: number;
      weekly_downloads: number;
      contributors: number;
      open_issues: number;
      popularity: 'very_high' | 'high' | 'moderate' | 'low';
    };
  };
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

// ============================================================
// Feature #772: Dependency Age Tracking Types
// ============================================================

interface DependencyAgeConfig {
  outdated_threshold_days: number; // Days before a dependency is considered outdated
  critical_age_days: number; // Days before dependency is critically outdated
  track_direct_only: boolean; // Only track direct dependencies
  notify_on_outdated: boolean;
  auto_flag_outdated: boolean;
}

interface ProjectDependency {
  id: string;
  project_id: string;
  name: string;
  current_version: string;
  latest_version: string;
  current_release_date: Date;
  latest_release_date: Date;
  age_days: number; // How many days since current version was released
  versions_behind: number;
  is_direct: boolean;
  license: string;
  status: 'current' | 'outdated' | 'critical' | 'up_to_date';
  has_vulnerability: boolean;
  vulnerability_count: number;
  last_checked: Date;
}

// ============================================================
// In-memory stores
// ============================================================

// Feature #777: Dependency allowlist/blocklist stores
const dependencyLists: Map<string, DependencyListEntry[]> = new Map(); // orgId -> entries

// Feature #772: Dependency age tracking stores
const dependencyAgeConfigs: Map<string, DependencyAgeConfig> = new Map(); // orgId -> config
const projectDependencies: Map<string, ProjectDependency[]> = new Map(); // projectId -> dependencies

// ============================================================
// Routes
// ============================================================

export async function dependencyListsRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // Feature #777: Dependency Allowlist/Blocklist Routes
  // ============================================================

  // Get all dependency list entries (allowlist and blocklist)
  app.get<{
    Querystring: { includeExpired?: boolean; listType?: 'allowlist' | 'blocklist' };
  }>('/api/v1/organization/dependency-lists', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;

    const entries = dependencyLists.get(orgId) || [];
    const now = new Date();

    // Filter out expired entries unless requested
    const { includeExpired = false, listType } = request.query || {};
    let filteredEntries = entries;

    if (!includeExpired) {
      filteredEntries = entries.filter(e => !e.expires_at || new Date(e.expires_at) > now);
    }

    if (listType === 'allowlist' || listType === 'blocklist') {
      filteredEntries = filteredEntries.filter(e => e.list_type === listType);
    }

    return {
      entries: filteredEntries,
      total: filteredEntries.length,
      summary: {
        allowlist_count: filteredEntries.filter(e => e.list_type === 'allowlist').length,
        blocklist_count: filteredEntries.filter(e => e.list_type === 'blocklist').length,
      },
    };
  });

  // Add package to blocklist
  app.post<{ Body: { package_name: string; version_pattern?: string; reason: string; severity_override?: string; expires_at?: string } }>(
    '/api/v1/organization/dependency-lists/blocklist',
    { preHandler: [authenticate] },
    async (request) => {
      const user = request.user as JwtPayload;
      const orgId = user.organization_id;
      const { package_name, version_pattern, reason, severity_override, expires_at } = request.body;

      const entry: DependencyListEntry = {
        id: `dep_block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organization_id: orgId,
        package_name,
        version_pattern: version_pattern || '*',
        list_type: 'blocklist',
        reason,
        severity_override: severity_override as DependencyListEntry['severity_override'],
        expires_at: expires_at ? new Date(expires_at) : undefined,
        created_at: new Date(),
        created_by: user.email || user.id,
        updated_at: new Date(),
      };

      const orgEntries = dependencyLists.get(orgId) || [];
      orgEntries.push(entry);
      dependencyLists.set(orgId, orgEntries);

      console.log(`
====================================
  Package Added to Blocklist
====================================
  Organization: ${orgId}
  Package: ${package_name}
  Version Pattern: ${version_pattern || '*'}
  Reason: ${reason}
  Severity Override: ${severity_override || 'None'}
====================================
      `);

      return {
        success: true,
        message: `Package "${package_name}" added to blocklist`,
        entry,
      };
    }
  );

  // Add package to allowlist (suppress findings)
  app.post<{ Body: { package_name: string; version_pattern?: string; reason: string; expires_at?: string } }>(
    '/api/v1/organization/dependency-lists/allowlist',
    { preHandler: [authenticate] },
    async (request) => {
      const user = request.user as JwtPayload;
      const orgId = user.organization_id;
      const { package_name, version_pattern, reason, expires_at } = request.body;

      const entry: DependencyListEntry = {
        id: `dep_allow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organization_id: orgId,
        package_name,
        version_pattern: version_pattern || '*',
        list_type: 'allowlist',
        reason,
        expires_at: expires_at ? new Date(expires_at) : undefined,
        created_at: new Date(),
        created_by: user.email || user.id,
        updated_at: new Date(),
      };

      const orgEntries = dependencyLists.get(orgId) || [];
      orgEntries.push(entry);
      dependencyLists.set(orgId, orgEntries);

      console.log(`
====================================
  Package Added to Allowlist
====================================
  Organization: ${orgId}
  Package: ${package_name}
  Version Pattern: ${version_pattern || '*'}
  Reason: ${reason}
====================================
      `);

      return {
        success: true,
        message: `Package "${package_name}" added to allowlist`,
        entry,
      };
    }
  );

  // Delete an entry from allowlist or blocklist
  app.delete<{ Params: { entryId: string } }>(
    '/api/v1/organization/dependency-lists/:entryId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const orgId = user.organization_id;
      const { entryId } = request.params;

      const orgEntries = dependencyLists.get(orgId) || [];
      const entryIndex = orgEntries.findIndex(e => e.id === entryId);

      if (entryIndex === -1) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Entry not found',
        });
      }

      const removedEntry = orgEntries.splice(entryIndex, 1)[0];
      dependencyLists.set(orgId, orgEntries);

      return {
        success: true,
        message: `Entry for "${removedEntry.package_name}" removed from ${removedEntry.list_type}`,
        removed_entry: removedEntry,
      };
    }
  );

  // Run dependency scan with allowlist/blocklist filtering
  app.post<{ Body: { dependencies: Array<{ name: string; version: string; vulnerabilities?: Array<{ cve_id: string; severity: string; title: string; fixed_version?: string }> }> } }>(
    '/api/v1/organization/dependency-lists/scan',
    { preHandler: [authenticate] },
    async (request) => {
      const user = request.user as JwtPayload;
      const orgId = user.organization_id;
      const { dependencies } = request.body;

      const entries = dependencyLists.get(orgId) || [];
      const now = new Date();
      const activeEntries = entries.filter(e => !e.expires_at || new Date(e.expires_at) > now);

      const allowlist = activeEntries.filter(e => e.list_type === 'allowlist');
      const blocklist = activeEntries.filter(e => e.list_type === 'blocklist');

      // Helper function to compare semantic versions
      const compareVersions = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
        const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const p1 = parts1[i] || 0;
          const p2 = parts2[i] || 0;
          if (p1 < p2) return -1;
          if (p1 > p2) return 1;
        }
        return 0;
      };

      // Helper function to check if package matches an entry
      const matchesEntry = (pkgName: string, pkgVersion: string, entry: DependencyListEntry): boolean => {
        // Check package name (supports wildcards)
        const namePattern = entry.package_name.replace(/\*/g, '.*');
        const nameRegex = new RegExp(`^${namePattern}$`);
        if (!nameRegex.test(pkgName)) return false;

        // Check version pattern if specified
        if (entry.version_pattern && entry.version_pattern !== '*') {
          // Semantic version matching
          if (entry.version_pattern.startsWith('>=')) {
            const minVersion = entry.version_pattern.slice(2);
            return compareVersions(pkgVersion, minVersion) >= 0;
          } else if (entry.version_pattern.startsWith('<=')) {
            const maxVersion = entry.version_pattern.slice(2);
            return compareVersions(pkgVersion, maxVersion) <= 0;
          } else if (entry.version_pattern.startsWith('>')) {
            const minVersion = entry.version_pattern.slice(1);
            return compareVersions(pkgVersion, minVersion) > 0;
          } else if (entry.version_pattern.startsWith('<')) {
            const maxVersion = entry.version_pattern.slice(1);
            return compareVersions(pkgVersion, maxVersion) < 0;
          } else if (entry.version_pattern.startsWith('=')) {
            return pkgVersion === entry.version_pattern.slice(1);
          }
          // Default: exact match
          return pkgVersion === entry.version_pattern;
        }

        return true;
      };

      const results: Array<{
        name: string;
        version: string;
        status: 'allowed' | 'blocked' | 'flagged' | 'clean';
        blocklist_match?: DependencyListEntry;
        allowlist_match?: DependencyListEntry;
        vulnerabilities?: Array<{ cve_id: string; severity: string; title: string; suppressed: boolean }>;
      }> = [];

      for (const dep of dependencies) {
        // Check if blocked
        const blockMatch = blocklist.find(e => matchesEntry(dep.name, dep.version, e));
        if (blockMatch) {
          results.push({
            name: dep.name,
            version: dep.version,
            status: 'blocked',
            blocklist_match: blockMatch,
            vulnerabilities: dep.vulnerabilities?.map(v => ({ ...v, suppressed: false })),
          });
          continue;
        }

        // Check if allowlisted (suppresses vulnerabilities)
        const allowMatch = allowlist.find(e => matchesEntry(dep.name, dep.version, e));
        if (allowMatch) {
          results.push({
            name: dep.name,
            version: dep.version,
            status: 'allowed',
            allowlist_match: allowMatch,
            vulnerabilities: dep.vulnerabilities?.map(v => ({ ...v, suppressed: true })),
          });
          continue;
        }

        // Normal processing - check vulnerabilities
        if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
          results.push({
            name: dep.name,
            version: dep.version,
            status: 'flagged',
            vulnerabilities: dep.vulnerabilities.map(v => ({ ...v, suppressed: false })),
          });
        } else {
          results.push({
            name: dep.name,
            version: dep.version,
            status: 'clean',
          });
        }
      }

      const summary = {
        total_scanned: dependencies.length,
        blocked: results.filter(r => r.status === 'blocked').length,
        allowed: results.filter(r => r.status === 'allowed').length,
        flagged: results.filter(r => r.status === 'flagged').length,
        clean: results.filter(r => r.status === 'clean').length,
      };

      console.log(`
====================================
  Dependency Scan with Lists
====================================
  Organization: ${orgId}
  Dependencies: ${dependencies.length}
  Blocked: ${summary.blocked}
  Allowlisted: ${summary.allowed}
  Flagged: ${summary.flagged}
  Clean: ${summary.clean}
====================================
      `);

      return {
        success: true,
        results,
        summary,
      };
    }
  );

  // ============================================================
  // Feature #778: Dependency Health Score Routes
  // ============================================================

  // Simulated health data for common packages
  const packageHealth: Record<string, Partial<DependencyHealthScore>> = {
    'lodash': {
      factors: {
        maintenance: { score: 75, last_release_days_ago: 180, is_maintained: true, release_frequency: 'moderate' },
        security: { score: 70, known_vulnerabilities: 3, critical_vulns: 0, high_vulns: 1, has_security_policy: true },
        community: { score: 95, github_stars: 58000, weekly_downloads: 45000000, contributors: 300, open_issues: 50, popularity: 'very_high' },
      },
    },
    'axios': {
      factors: {
        maintenance: { score: 90, last_release_days_ago: 30, is_maintained: true, release_frequency: 'frequent' },
        security: { score: 85, known_vulnerabilities: 1, critical_vulns: 0, high_vulns: 0, has_security_policy: true },
        community: { score: 92, github_stars: 103000, weekly_downloads: 35000000, contributors: 400, open_issues: 200, popularity: 'very_high' },
      },
    },
    'express': {
      factors: {
        maintenance: { score: 85, last_release_days_ago: 60, is_maintained: true, release_frequency: 'moderate' },
        security: { score: 80, known_vulnerabilities: 2, critical_vulns: 0, high_vulns: 1, has_security_policy: true },
        community: { score: 98, github_stars: 62000, weekly_downloads: 30000000, contributors: 250, open_issues: 100, popularity: 'very_high' },
      },
    },
    'moment': {
      factors: {
        maintenance: { score: 30, last_release_days_ago: 1200, is_maintained: false, release_frequency: 'abandoned' },
        security: { score: 60, known_vulnerabilities: 5, critical_vulns: 0, high_vulns: 2, has_security_policy: false },
        community: { score: 85, github_stars: 47000, weekly_downloads: 15000000, contributors: 500, open_issues: 300, popularity: 'high' },
      },
    },
    'left-pad': {
      factors: {
        maintenance: { score: 20, last_release_days_ago: 2500, is_maintained: false, release_frequency: 'abandoned' },
        security: { score: 50, known_vulnerabilities: 0, critical_vulns: 0, high_vulns: 0, has_security_policy: false },
        community: { score: 30, github_stars: 500, weekly_downloads: 50000, contributors: 5, open_issues: 10, popularity: 'low' },
      },
    },
  };

  // Get dependency health scores for a list of packages
  app.post<{ Body: { dependencies: Array<{ name: string; version: string }> } }>(
    '/api/v1/organization/dependency-health',
    { preHandler: [authenticate] },
    async (request) => {
      const { dependencies } = request.body;

      const results: DependencyHealthScore[] = [];

      for (const dep of dependencies) {
        const healthData = packageHealth[dep.name];

        // Calculate factors (use simulated data or defaults)
        const maintenance = healthData?.factors?.maintenance || {
          score: 50 + Math.floor(Math.random() * 30),
          last_release_days_ago: 30 + Math.floor(Math.random() * 300),
          is_maintained: Math.random() > 0.3,
          release_frequency: ['frequent', 'moderate', 'infrequent'][Math.floor(Math.random() * 3)] as 'frequent' | 'moderate' | 'infrequent',
        };

        const security = healthData?.factors?.security || {
          score: 60 + Math.floor(Math.random() * 30),
          known_vulnerabilities: Math.floor(Math.random() * 3),
          critical_vulns: 0,
          high_vulns: Math.floor(Math.random() * 2),
          has_security_policy: Math.random() > 0.5,
        };

        const community = healthData?.factors?.community || {
          score: 40 + Math.floor(Math.random() * 40),
          github_stars: 100 + Math.floor(Math.random() * 10000),
          weekly_downloads: 1000 + Math.floor(Math.random() * 1000000),
          contributors: 5 + Math.floor(Math.random() * 50),
          open_issues: Math.floor(Math.random() * 100),
          popularity: ['moderate', 'low'][Math.floor(Math.random() * 2)] as 'moderate' | 'low',
        };

        // Calculate overall health score (weighted average)
        const health_score = Math.round(
          maintenance.score * 0.35 +
          security.score * 0.40 +
          community.score * 0.25
        );

        // Determine risk level
        let risk_level: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (health_score < 40) risk_level = 'critical';
        else if (health_score < 55) risk_level = 'high';
        else if (health_score < 70) risk_level = 'medium';

        // Generate recommendations
        const recommendations: string[] = [];
        if (!maintenance.is_maintained) {
          recommendations.push(`Consider migrating away from ${dep.name} - it appears to be abandoned`);
        }
        if (maintenance.last_release_days_ago > 365) {
          recommendations.push('Package has not been updated in over a year');
        }
        if (security.critical_vulns > 0) {
          recommendations.push(`URGENT: ${security.critical_vulns} critical vulnerability(ies) - update immediately`);
        }
        if (security.high_vulns > 0) {
          recommendations.push(`${security.high_vulns} high severity vulnerability(ies) found - consider updating`);
        }
        if (!security.has_security_policy) {
          recommendations.push('Package lacks a security policy - may have slower vulnerability response');
        }
        if (community.popularity === 'low') {
          recommendations.push('Low community adoption - consider alternatives with more community support');
        }

        results.push({
          name: dep.name,
          version: dep.version,
          health_score,
          factors: { maintenance, security, community },
          risk_level,
          recommendations,
        });
      }

      // Sort by health score (ascending - lowest/worst first)
      const sortedResults = [...results].sort((a, b) => a.health_score - b.health_score);

      // Identify low-health dependencies
      const lowHealthDeps = results.filter(r => r.health_score < 60);
      const criticalRiskDeps = results.filter(r => r.risk_level === 'critical');
      const highRiskDeps = results.filter(r => r.risk_level === 'high');

      console.log(`
====================================
  Dependency Health Analysis
====================================
  Dependencies Analyzed: ${dependencies.length}
  Average Health Score: ${Math.round(results.reduce((sum, r) => sum + r.health_score, 0) / results.length)}
  Low Health (<60): ${lowHealthDeps.length}
  Critical Risk: ${criticalRiskDeps.length}
  High Risk: ${highRiskDeps.length}
====================================
      `);

      return {
        success: true,
        results,
        sorted_by_health: sortedResults,
        summary: {
          total_analyzed: results.length,
          average_health_score: Math.round(results.reduce((sum, r) => sum + r.health_score, 0) / results.length),
          low_health_count: lowHealthDeps.length,
          risk_distribution: {
            critical: criticalRiskDeps.length,
            high: highRiskDeps.length,
            medium: results.filter(r => r.risk_level === 'medium').length,
            low: results.filter(r => r.risk_level === 'low').length,
          },
          requires_attention: lowHealthDeps.map(d => d.name),
        },
      };
    }
  );

  // Get health score for a single dependency (with detailed analysis)
  app.get<{ Params: { packageName: string }; Querystring: { version?: string } }>(
    '/api/v1/organization/dependency-health/:packageName',
    { preHandler: [authenticate] },
    async (request) => {
      const { packageName } = request.params;
      const { version = 'latest' } = request.query;

      // Simulated detailed health analysis for the package
      const detailedHealth: DependencyHealthScore = {
        name: packageName,
        version,
        health_score: 72,
        factors: {
          maintenance: {
            score: 70,
            last_release_days_ago: 45,
            is_maintained: true,
            release_frequency: 'moderate',
          },
          security: {
            score: 75,
            known_vulnerabilities: 1,
            critical_vulns: 0,
            high_vulns: 0,
            has_security_policy: true,
          },
          community: {
            score: 70,
            github_stars: 5000,
            weekly_downloads: 500000,
            contributors: 25,
            open_issues: 30,
            popularity: 'moderate',
          },
        },
        risk_level: 'medium',
        recommendations: [
          'Consider reviewing open issues for potential breaking changes',
          'Monitor for security advisories',
        ],
      };

      return {
        success: true,
        health: detailedHealth,
      };
    }
  );

  // ============================================================
  // Feature #772: Dependency Age Tracking Routes
  // ============================================================

  // Default Dependency Age config
  const defaultDependencyAgeConfig: DependencyAgeConfig = {
    outdated_threshold_days: 180, // 6 months
    critical_age_days: 365, // 1 year
    track_direct_only: false,
    notify_on_outdated: true,
    auto_flag_outdated: true,
  };

  // Get dependency age configuration
  app.get('/api/v1/organization/dependency-age/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;

    const config = dependencyAgeConfigs.get(orgId) || { ...defaultDependencyAgeConfig };
    return { config };
  });

  // Update dependency age configuration
  app.patch<{ Body: Partial<DependencyAgeConfig> }>('/api/v1/organization/dependency-age/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const updates = request.body;

    const existingConfig = dependencyAgeConfigs.get(orgId) || { ...defaultDependencyAgeConfig };
    const config = { ...existingConfig, ...updates };
    dependencyAgeConfigs.set(orgId, config);

    console.log(`
====================================
  Dependency Age Config Updated
====================================
  Organization: ${orgId}
  Outdated Threshold: ${config.outdated_threshold_days} days
  Critical Age: ${config.critical_age_days} days
====================================
    `);

    return {
      success: true,
      message: 'Dependency age configuration updated',
      config,
    };
  });

  // Get dependencies for a project with age information
  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/dependencies', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const { projectId } = request.params;
    const query = request.query as { status?: string; is_direct?: string };

    const config = dependencyAgeConfigs.get(orgId) || { ...defaultDependencyAgeConfig };

    // Get or generate dependencies for this project
    let deps = projectDependencies.get(projectId);

    if (!deps) {
      // Generate simulated dependencies
      const now = new Date();
      deps = [
        {
          id: `dep_1_${projectId}`,
          project_id: projectId,
          name: 'react',
          current_version: '18.2.0',
          latest_version: '18.3.1',
          current_release_date: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000), // 120 days ago
          latest_release_date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          age_days: 120,
          versions_behind: 1,
          is_direct: true,
          license: 'MIT',
          status: 'outdated',
          has_vulnerability: false,
          vulnerability_count: 0,
          last_checked: now,
        },
        {
          id: `dep_2_${projectId}`,
          project_id: projectId,
          name: 'lodash',
          current_version: '4.17.15',
          latest_version: '4.17.21',
          current_release_date: new Date(now.getTime() - 540 * 24 * 60 * 60 * 1000), // 540 days ago (1.5 years)
          latest_release_date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
          age_days: 540,
          versions_behind: 6,
          is_direct: true,
          license: 'MIT',
          status: 'critical',
          has_vulnerability: true,
          vulnerability_count: 2,
          last_checked: now,
        },
        {
          id: `dep_3_${projectId}`,
          project_id: projectId,
          name: 'typescript',
          current_version: '5.3.3',
          latest_version: '5.3.3',
          current_release_date: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
          latest_release_date: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
          age_days: 45,
          versions_behind: 0,
          is_direct: true,
          license: 'Apache-2.0',
          status: 'up_to_date',
          has_vulnerability: false,
          vulnerability_count: 0,
          last_checked: now,
        },
        {
          id: `dep_4_${projectId}`,
          project_id: projectId,
          name: 'axios',
          current_version: '0.21.0',
          latest_version: '1.6.5',
          current_release_date: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000), // 730 days ago (2 years)
          latest_release_date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
          age_days: 730,
          versions_behind: 28,
          is_direct: true,
          license: 'MIT',
          status: 'critical',
          has_vulnerability: true,
          vulnerability_count: 3,
          last_checked: now,
        },
        {
          id: `dep_5_${projectId}`,
          project_id: projectId,
          name: 'express',
          current_version: '4.18.2',
          latest_version: '4.18.2',
          current_release_date: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000), // 200 days ago
          latest_release_date: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000),
          age_days: 200,
          versions_behind: 0,
          is_direct: true,
          license: 'MIT',
          status: 'outdated', // Flagged as outdated due to age even though up to date
          has_vulnerability: false,
          vulnerability_count: 0,
          last_checked: now,
        },
        {
          id: `dep_6_${projectId}`,
          project_id: projectId,
          name: 'glob',
          current_version: '10.3.10',
          latest_version: '10.3.10',
          current_release_date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
          latest_release_date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          age_days: 60,
          versions_behind: 0,
          is_direct: false,
          license: 'ISC',
          status: 'current',
          has_vulnerability: false,
          vulnerability_count: 0,
          last_checked: now,
        },
        {
          id: `dep_7_${projectId}`,
          project_id: projectId,
          name: 'minimist',
          current_version: '1.2.5',
          latest_version: '1.2.8',
          current_release_date: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
          latest_release_date: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
          age_days: 400,
          versions_behind: 3,
          is_direct: false,
          license: 'MIT',
          status: 'critical',
          has_vulnerability: true,
          vulnerability_count: 1,
          last_checked: now,
        },
      ];

      // Update status based on config
      deps = deps.map(dep => {
        let status: ProjectDependency['status'] = 'current';
        if (dep.versions_behind === 0 && dep.age_days < config.outdated_threshold_days) {
          status = 'up_to_date';
        } else if (dep.age_days >= config.critical_age_days || dep.has_vulnerability) {
          status = 'critical';
        } else if (dep.age_days >= config.outdated_threshold_days || dep.versions_behind > 0) {
          status = 'outdated';
        }
        return { ...dep, status };
      });

      projectDependencies.set(projectId, deps);
    }

    // Apply filters
    let filteredDeps = deps;

    if (query.status) {
      filteredDeps = filteredDeps.filter(d => d.status === query.status);
    }
    if (query.is_direct === 'true') {
      filteredDeps = filteredDeps.filter(d => d.is_direct);
    }

    // Sort by age (oldest first)
    filteredDeps.sort((a, b) => b.age_days - a.age_days);

    // Calculate summary
    const summary = {
      total: deps.length,
      up_to_date: deps.filter(d => d.status === 'up_to_date').length,
      current: deps.filter(d => d.status === 'current').length,
      outdated: deps.filter(d => d.status === 'outdated').length,
      critical: deps.filter(d => d.status === 'critical').length,
      with_vulnerabilities: deps.filter(d => d.has_vulnerability).length,
      direct: deps.filter(d => d.is_direct).length,
      transitive: deps.filter(d => !d.is_direct).length,
      average_age_days: Math.round(deps.reduce((sum, d) => sum + d.age_days, 0) / deps.length),
      oldest_days: Math.max(...deps.map(d => d.age_days)),
    };

    return {
      dependencies: filteredDeps,
      summary,
      config: {
        outdated_threshold_days: config.outdated_threshold_days,
        critical_age_days: config.critical_age_days,
      },
    };
  });

  // Refresh dependency age data for a project
  app.post<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/dependencies/refresh', {
    preHandler: [authenticate],
  }, async (request) => {
    const { projectId } = request.params;

    // Simulate refreshing dependencies (would call npm registry in production)
    const now = new Date();
    const deps = projectDependencies.get(projectId) || [];

    // Update last_checked timestamp and simulate some changes
    const refreshedDeps = deps.map(dep => ({
      ...dep,
      last_checked: now,
      // Randomly add a day to age to simulate time passing
      age_days: dep.age_days + 1,
    }));

    projectDependencies.set(projectId, refreshedDeps);

    console.log(`
====================================
  Dependencies Refreshed
====================================
  Project: ${projectId}
  Dependencies: ${refreshedDeps.length}
  Last Checked: ${now.toISOString()}
====================================
    `);

    return {
      success: true,
      message: `Refreshed ${refreshedDeps.length} dependencies`,
      last_checked: now,
    };
  });

  // Get organization-wide dependency age statistics
  app.get('/api/v1/organization/dependency-age/stats', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;

    const config = dependencyAgeConfigs.get(orgId) || { ...defaultDependencyAgeConfig };

    // Aggregate dependencies across all projects
    const allDeps: ProjectDependency[] = [];
    projectDependencies.forEach((deps) => {
      allDeps.push(...deps);
    });

    // Unique packages
    const uniquePackages = new Map<string, ProjectDependency>();
    allDeps.forEach(dep => {
      const existing = uniquePackages.get(dep.name);
      if (!existing || dep.age_days > existing.age_days) {
        uniquePackages.set(dep.name, dep);
      }
    });

    const uniqueDeps = Array.from(uniquePackages.values());

    // Find most outdated packages
    const mostOutdated = [...uniqueDeps]
      .sort((a, b) => b.age_days - a.age_days)
      .slice(0, 10);

    // Age distribution
    const ageDistribution = {
      under_30_days: uniqueDeps.filter(d => d.age_days < 30).length,
      '30_90_days': uniqueDeps.filter(d => d.age_days >= 30 && d.age_days < 90).length,
      '90_180_days': uniqueDeps.filter(d => d.age_days >= 90 && d.age_days < 180).length,
      '180_365_days': uniqueDeps.filter(d => d.age_days >= 180 && d.age_days < 365).length,
      over_365_days: uniqueDeps.filter(d => d.age_days >= 365).length,
    };

    return {
      config,
      summary: {
        total_packages: uniqueDeps.length,
        up_to_date: uniqueDeps.filter(d => d.status === 'up_to_date').length,
        outdated: uniqueDeps.filter(d => d.status === 'outdated').length,
        critical: uniqueDeps.filter(d => d.status === 'critical').length,
        with_vulnerabilities: uniqueDeps.filter(d => d.has_vulnerability).length,
        average_age_days: uniqueDeps.length > 0
          ? Math.round(uniqueDeps.reduce((sum, d) => sum + d.age_days, 0) / uniqueDeps.length)
          : 0,
      },
      age_distribution: ageDistribution,
      most_outdated: mostOutdated.map(d => ({
        name: d.name,
        current_version: d.current_version,
        latest_version: d.latest_version,
        age_days: d.age_days,
        status: d.status,
        has_vulnerability: d.has_vulnerability,
      })),
    };
  });
}
