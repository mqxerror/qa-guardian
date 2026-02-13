/**
 * Dependency Lists Routes
 *
 * Routes for managing dependency allowlists/blocklists and health scores.
 *
 * Feature #777: Dependency Allowlist/Blocklist
 * Feature #778: Dependency Health Score
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth.js';
import { createLogger } from '../../services/logger.js';

import { sendError } from '../../utils/errors.js';
const logger = createLogger('dependency-lists');

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
// In-memory stores
// ============================================================

// Feature #777: Dependency allowlist/blocklist stores
const dependencyLists: Map<string, DependencyListEntry[]> = new Map(); // orgId -> entries

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

      logger.info({ orgId, package: package_name, versionPattern: version_pattern || '*', reason, severityOverride: severity_override }, `Package "${package_name}" added to blocklist`);

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

      logger.info({ orgId, package: package_name, versionPattern: version_pattern || '*', reason }, `Package "${package_name}" added to allowlist`);

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
        return sendError(reply, 404, 'NOT_FOUND', 'Entry not found');
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

      logger.info({ orgId, total: dependencies.length, blocked: summary.blocked, allowed: summary.allowed, flagged: summary.flagged, clean: summary.clean }, 'Dependency scan completed');

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

      logger.info({ total: dependencies.length, avgHealth: Math.round(results.reduce((sum, r) => sum + r.health_score, 0) / results.length), lowHealth: lowHealthDeps.length, criticalRisk: criticalRiskDeps.length, highRisk: highRiskDeps.length }, 'Dependency health analysis completed');

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
}
