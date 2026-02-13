/**
 * Dependencies domain type definitions
 *
 * Types for dependency tree, multi-language dependencies, scan caching,
 * SBOM generation, and upgrade recommendations.
 */

// ============================================================================
// Dependency Tree (Feature #271)
// ============================================================================

export interface DependencyVulnerability {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  fixed_version?: string;
}

export interface Dependency {
  id: string;
  project_id: string;
  language: 'javascript' | 'python' | 'java' | 'go' | 'rust';
  name: string;
  current_version: string;
  latest_version: string;
  license?: string;
  is_dev: boolean;
  is_transitive: boolean;
  depth: number;
  parent_package?: string;
  registry: string;
  vulnerabilities: DependencyVulnerability[];
  last_scanned_at: string;
}

/** Tree node structure for visualization */
export interface TreeNode {
  id: string;
  name: string;
  version: string;
  license?: string;
  vulnerabilities: DependencyVulnerability[];
  isVulnerable: boolean;
  isExpanded: boolean;
  depth: number;
  children: TreeNode[];
  language: string;
  isDev: boolean;
}

export interface AllDependenciesResponse {
  project_id: string;
  dependencies_by_language: Record<string, Dependency[]>;
  summary: Record<string, {
    total: number;
    direct: number;
    transitive: number;
    vulnerabilities: number;
  }>;
  totals: {
    total_dependencies: number;
    total_vulnerabilities: number;
    languages_scanned: number;
  };
}

// ============================================================================
// Multi-Language Dependencies (Feature #773)
// ============================================================================

export interface LanguageScanConfig {
  language: 'javascript' | 'python' | 'java' | 'go' | 'rust';
  enabled: boolean;
  manifest_files: string[];
  lock_files: string[];
  registries: string[];
}

export interface MultiLanguageScanConfig {
  organization_id: string;
  enabled_languages: LanguageScanConfig[];
  scan_dev_dependencies: boolean;
  scan_transitive: boolean;
  auto_detect_languages: boolean;
  parallel_scanning: boolean;
  cache_duration_hours: number;
}

export interface LanguageDependency {
  id: string;
  project_id: string;
  language: 'javascript' | 'python' | 'java' | 'go' | 'rust';
  name: string;
  current_version: string;
  latest_version: string;
  license?: string;
  is_dev: boolean;
  is_transitive: boolean;
  depth: number;
  parent_package?: string;
  registry: string;
  vulnerabilities: Array<{
    id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    fixed_version?: string;
  }>;
  last_scanned_at: string;
}

export interface LanguageScanResult {
  project_id: string;
  language: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  total_dependencies: number;
  direct_dependencies: number;
  transitive_dependencies: number;
  vulnerabilities_found: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

// ============================================================================
// Scan Caching (Feature #776)
// ============================================================================

export interface ScanDependency {
  name: string;
  version: string;
  type?: 'production' | 'development' | 'optional' | 'peer';
  license?: string;
}

export interface ScanVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  package_name: string;
  affected_versions?: string;
}

export interface ScanCacheEntry {
  id: string;
  scan_type: string;
  cache_key: string;
  status: 'valid' | 'stale' | 'invalidated';
  hit_count: number;
  scan_duration_ms: number;
  dependencies: number;
  vulnerabilities: number;
  created_at: string;
  expires_at: string;
  last_accessed: string;
}

export interface CacheConfig {
  enabled: boolean;
  ttl_hours: number;
  max_entries: number;
  invalidation_triggers: string[];
  compression_enabled: boolean;
}

export interface CacheStats {
  project_id: string;
  total_entries: number;
  valid_entries: number;
  stale_entries: number;
  invalidated_entries: number;
  total_cache_hits: number;
  total_time_saved_ms: number;
  cache_hit_rate: number;
  storage_used_bytes: number;
  oldest_entry: string | null;
  newest_entry: string | null;
}

export interface ScanResult {
  scan_id: string;
  project_id: string;
  cache_hit: boolean;
  cache_entry_id?: string;
  scan_duration_ms: number;
  saved_time_ms?: number;
  results: {
    dependencies: ScanDependency[];
    vulnerabilities: ScanVulnerability[];
    total_dependencies: number;
    total_vulnerabilities: number;
  };
  cache_info: {
    key: string;
    created_at?: string;
    expires_at?: string;
    hit_count?: number;
  };
}

// ============================================================================
// SBOM Generation (Feature #268)
// ============================================================================

export interface SbomSummary {
  total_components: number;
  production_components: number;
  dev_components: number;
  unique_licenses: number;
  license_distribution: Record<string, number>;
}

export interface SbomDownload {
  url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface SbomCompliance {
  executive_order_14028: boolean;
  ntia_minimum_elements: boolean;
  missing_elements: string[];
}

export interface SbomStorage {
  location: 'minio' | 'local' | 'memory';
  bucket?: string;
  key?: string;
  path?: string;
}

export interface GeneratedSbom {
  sbom_id: string;
  project_id: string;
  project_name: string;
  format: 'cyclonedx' | 'spdx';
  spec_version: string;
  generated_at: string;
  generated_by: string;
  summary: SbomSummary;
  download: SbomDownload;
  sbom: Record<string, unknown>;
  storage: SbomStorage;
  compliance: SbomCompliance;
}

export interface StoredSbom {
  id: string;
  format: 'cyclonedx' | 'spdx';
  spec_version: string;
  generated_at: string;
  generated_by: string;
  filename: string;
  size_bytes: number;
  component_count: number;
  download_url: string;
}

export interface SbomListResponse {
  project_id: string;
  project_name: string;
  sboms: StoredSbom[];
  total: number;
}

// ============================================================================
// Upgrade Recommendations (Feature #270)
// ============================================================================

export interface Recommendation {
  package: string;
  current_version: string;
  recommended_version: string;
  latest_version: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  vulnerabilities: string[];
  upgrade_type: 'patch' | 'minor' | 'major';
  risk_level: 'safe' | 'caution' | 'breaking';
  breaking_changes: boolean;
  changelog_url: string;
  description: string;
  migration_notes?: string[];
  alternative?: {
    package: string;
    reason: string;
  };
}

export interface UpgradeData {
  project_id: string;
  project_name: string;
  recommendations: Recommendation[];
  summary: {
    total_recommendations: number;
    by_risk_level: {
      safe: number;
      caution: number;
      breaking: number;
    };
    by_severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    total_vulnerabilities: number;
    actionable_now: number;
  };
  metadata: {
    generated_at: string;
    npm_registry_checked: boolean;
    include_dev: boolean;
    min_severity: string;
  };
}
