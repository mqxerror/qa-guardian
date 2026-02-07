/**
 * Migration: License, SBOM, and Dependency Persistence
 * Feature #333: Persist license policies, SBOM, and dependency data to PostgreSQL
 *
 * Creates tables for:
 * - license_policies: Organization-level license policies
 * - license_scan_results: Historical license scan results
 * - sbom_entries: SBOM (Software Bill of Materials) entries
 * - dependency_analysis: Dependency analysis summaries
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // License Policies Table
  // ============================================================================
  pgm.createTable('license_policies', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    // Array of allowed SPDX license IDs
    allowed_licenses: {
      type: 'text[]',
      notNull: true,
      default: pgm.func("ARRAY['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause']"),
    },
    // Array of blocked SPDX license IDs
    blocked_licenses: {
      type: 'text[]',
      notNull: true,
      default: pgm.func("ARRAY['GPL-3.0-only', 'AGPL-3.0-only']"),
    },
    // Policy enforcement mode: 'strict' (fail on violation), 'warn' (allow but warn), 'disabled'
    policy_mode: {
      type: 'varchar(20)',
      notNull: true,
      default: "'warn'",
    },
    // Whether to fail builds on unknown licenses
    fail_on_unknown: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('license_policies', 'organization_id');
  pgm.createIndex('license_policies', ['organization_id', 'is_active']);

  // ============================================================================
  // License Scan Results Table
  // ============================================================================
  pgm.createTable('license_scan_results', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    project_id: {
      type: 'uuid',
      notNull: true,
      references: 'projects(id)',
      onDelete: 'CASCADE',
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    // Scan metadata
    scanned_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    scan_duration_ms: {
      type: 'integer',
    },
    policy_id: {
      type: 'uuid',
      references: 'license_policies(id)',
      onDelete: 'SET NULL',
    },
    // Summary statistics
    total_packages: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    compliant_packages: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    violation_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    unknown_license_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    compliance_percentage: {
      type: 'decimal(5,2)',
      notNull: true,
      default: 100.00,
    },
    // License distribution as JSONB
    license_summary: {
      type: 'jsonb',
      notNull: true,
      default: "'{}'",
    },
    // Detailed violations as JSONB array
    violations: {
      type: 'jsonb',
      notNull: true,
      default: "'[]'",
    },
    // Full package list (optional, for detailed historical tracking)
    packages: {
      type: 'jsonb',
    },
    // Status: 'completed', 'failed', 'partial'
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: "'completed'",
    },
    error_message: {
      type: 'text',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('license_scan_results', 'project_id');
  pgm.createIndex('license_scan_results', 'organization_id');
  pgm.createIndex('license_scan_results', ['project_id', 'scanned_at']);
  pgm.createIndex('license_scan_results', 'scanned_at');

  // ============================================================================
  // SBOM Entries Table
  // ============================================================================
  pgm.createTable('sbom_entries', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    project_id: {
      type: 'uuid',
      notNull: true,
      references: 'projects(id)',
      onDelete: 'CASCADE',
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    // SBOM format: 'cyclonedx' or 'spdx'
    format: {
      type: 'varchar(20)',
      notNull: true,
    },
    spec_version: {
      type: 'varchar(20)',
      notNull: true,
    },
    // Serial number / document ID
    serial_number: {
      type: 'varchar(255)',
      notNull: true,
    },
    // Generation metadata
    generated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    generated_by: {
      type: 'varchar(255)',
      default: "'QA Guardian'",
    },
    // Summary statistics
    total_components: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    production_components: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    dev_components: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    unique_licenses: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    license_distribution: {
      type: 'jsonb',
      notNull: true,
      default: "'{}'",
    },
    // Storage information
    storage_location: {
      type: 'varchar(20)',
      notNull: true,
      default: "'database'",
    },
    storage_bucket: {
      type: 'varchar(255)',
    },
    storage_key: {
      type: 'varchar(500)',
    },
    storage_path: {
      type: 'varchar(500)',
    },
    // File information
    filename: {
      type: 'varchar(255)',
      notNull: true,
    },
    content_type: {
      type: 'varchar(100)',
      default: "'application/json'",
    },
    size_bytes: {
      type: 'integer',
    },
    // Full SBOM content (stored in DB if not using external storage)
    sbom_content: {
      type: 'jsonb',
    },
    // Compliance flags
    eo_14028_compliant: {
      type: 'boolean',
      default: false,
    },
    ntia_compliant: {
      type: 'boolean',
      default: false,
    },
    missing_elements: {
      type: 'text[]',
      default: pgm.func("ARRAY[]::text[]"),
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('sbom_entries', 'project_id');
  pgm.createIndex('sbom_entries', 'organization_id');
  pgm.createIndex('sbom_entries', ['project_id', 'format']);
  pgm.createIndex('sbom_entries', ['project_id', 'generated_at']);
  pgm.createIndex('sbom_entries', 'serial_number');

  // ============================================================================
  // Dependency Analysis Table
  // ============================================================================
  pgm.createTable('dependency_analysis', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    project_id: {
      type: 'uuid',
      notNull: true,
      references: 'projects(id)',
      onDelete: 'CASCADE',
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    // Analysis metadata
    analyzed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    analysis_duration_ms: {
      type: 'integer',
    },
    // Summary counts
    total_dependencies: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    direct_dependencies: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    transitive_dependencies: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    production_dependencies: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    dev_dependencies: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    // Version status
    outdated_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    major_updates_available: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    minor_updates_available: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    patch_updates_available: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    // Security vulnerabilities
    vulnerable_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    critical_vulnerabilities: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    high_vulnerabilities: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    medium_vulnerabilities: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    low_vulnerabilities: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    // Health score (0-100)
    health_score: {
      type: 'integer',
    },
    // Detailed data as JSONB
    outdated_packages: {
      type: 'jsonb',
      default: "'[]'",
    },
    vulnerable_packages: {
      type: 'jsonb',
      default: "'[]'",
    },
    // Ecosystem (npm, pip, etc.)
    ecosystem: {
      type: 'varchar(20)',
      default: "'npm'",
    },
    // Package manager lock file analyzed
    lockfile_path: {
      type: 'varchar(500)',
    },
    // Status
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: "'completed'",
    },
    error_message: {
      type: 'text',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('dependency_analysis', 'project_id');
  pgm.createIndex('dependency_analysis', 'organization_id');
  pgm.createIndex('dependency_analysis', ['project_id', 'analyzed_at']);
  pgm.createIndex('dependency_analysis', 'analyzed_at');
  pgm.createIndex('dependency_analysis', ['project_id', 'ecosystem']);

  // ============================================================================
  // Add triggers for updated_at on license_policies
  // ============================================================================
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_license_policies_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER license_policies_updated_at_trigger
      BEFORE UPDATE ON license_policies
      FOR EACH ROW
      EXECUTE FUNCTION update_license_policies_updated_at();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop trigger and function
  pgm.sql(`
    DROP TRIGGER IF EXISTS license_policies_updated_at_trigger ON license_policies;
    DROP FUNCTION IF EXISTS update_license_policies_updated_at();
  `);

  // Drop tables in reverse order (due to foreign key constraints)
  pgm.dropTable('dependency_analysis');
  pgm.dropTable('sbom_entries');
  pgm.dropTable('license_scan_results');
  pgm.dropTable('license_policies');
}
