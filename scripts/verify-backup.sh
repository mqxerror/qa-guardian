#!/bin/bash
# =============================================================================
# QA Guardian - Backup Verification Script
# =============================================================================
# Feature #151: Verify backup integrity and generate report
#
# This script performs thorough verification of database backups:
# - Validates gzip compression
# - Checks SQL structure
# - Counts tables and rows
# - Optionally tests restore to a temp database
#
# Usage:
#   ./verify-backup.sh                       # Verify latest backup
#   ./verify-backup.sh <backup-file>         # Verify specific backup
#   ./verify-backup.sh --full                # Full verification with test restore
#   ./verify-backup.sh --all                 # Verify all backups
# =============================================================================

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-qa_guardian}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-QaGuardian2024Secure}"
POSTGRES_DB="${POSTGRES_DB:-qa_guardian}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }

# Find latest backup if no file specified
get_latest_backup() {
    find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" -type f -printf '%T+ %p\n' 2>/dev/null | \
        sort -r | head -1 | cut -d' ' -f2
}

# Verify a single backup file
verify_backup() {
    local backup_file="$1"
    local full_check="${2:-false}"
    local errors=0

    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi

    echo ""
    echo "=============================================="
    echo "Verifying: $(basename "$backup_file")"
    echo "=============================================="

    # 1. Check file exists and has content
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    if [ "$file_size" -lt 1000 ]; then
        log_error "File size too small: $file_size bytes"
        ((errors++))
    else
        log_success "File size: $file_size bytes"
    fi

    # 2. Verify gzip integrity
    if gzip -t "$backup_file" 2>/dev/null; then
        log_success "Gzip integrity: Valid"
    else
        log_error "Gzip integrity: CORRUPTED"
        ((errors++))
        return $errors
    fi

    # 3. Check SQL header
    local header=$(zcat "$backup_file" | head -5)
    if echo "$header" | grep -q "PostgreSQL database dump"; then
        log_success "SQL header: Valid PostgreSQL dump"
    else
        log_warning "SQL header: Could not verify PostgreSQL header"
    fi

    # 4. Count tables
    local table_count=$(zcat "$backup_file" | grep -c "^CREATE TABLE" || echo "0")
    if [ "$table_count" -gt 0 ]; then
        log_success "Tables found: $table_count"
    else
        log_warning "Tables found: $table_count (might be empty database)"
    fi

    # 5. Count INSERT statements (data)
    local insert_count=$(zcat "$backup_file" | grep -c "^INSERT INTO\|^COPY " || echo "0")
    log_info "Data statements: $insert_count"

    # 6. Check for expected QA Guardian tables
    local expected_tables=("users" "organizations" "projects" "test_suites" "tests" "test_runs")
    local found_tables=0

    for table in "${expected_tables[@]}"; do
        if zcat "$backup_file" | grep -q "CREATE TABLE.*$table\|COPY.*$table"; then
            ((found_tables++))
        fi
    done

    if [ "$found_tables" -ge 4 ]; then
        log_success "QA Guardian tables: $found_tables/${#expected_tables[@]} found"
    else
        log_warning "QA Guardian tables: Only $found_tables/${#expected_tables[@]} found"
    fi

    # 7. Full verification - test restore (optional)
    if [ "$full_check" = "true" ]; then
        log_info "Running full verification with test restore..."

        local temp_db="qa_guardian_verify_$(date +%s)"

        export PGPASSWORD="$POSTGRES_PASSWORD"

        # Create temp database
        if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres \
            -c "CREATE DATABASE $temp_db" 2>/dev/null; then

            # Attempt restore
            if zcat "$backup_file" | psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
                -U "$POSTGRES_USER" -d "$temp_db" --quiet 2>/dev/null; then
                log_success "Test restore: Successful"
            else
                log_error "Test restore: FAILED"
                ((errors++))
            fi

            # Cleanup temp database
            psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres \
                -c "DROP DATABASE IF EXISTS $temp_db" 2>/dev/null
        else
            log_warning "Could not create temp database for full verification"
        fi

        unset PGPASSWORD
    fi

    # Summary
    echo ""
    if [ "$errors" -eq 0 ]; then
        log_success "Verification PASSED"
        return 0
    else
        log_error "Verification FAILED with $errors error(s)"
        return 1
    fi
}

# Verify all backups
verify_all() {
    local total=0
    local passed=0
    local failed=0

    echo "=============================================="
    echo "Verifying all backups in $BACKUP_DIR"
    echo "=============================================="

    find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" -type f | sort -r | while read -r backup; do
        ((total++))
        if verify_backup "$backup" "false"; then
            ((passed++))
        else
            ((failed++))
        fi
    done

    echo ""
    echo "=============================================="
    echo "Summary: $passed passed, $failed failed (total: $total)"
    echo "=============================================="
}

# Generate JSON report
generate_report() {
    local backup_file="$1"
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    local table_count=$(zcat "$backup_file" | grep -c "^CREATE TABLE" 2>/dev/null || echo "0")
    local gzip_valid="false"

    gzip -t "$backup_file" 2>/dev/null && gzip_valid="true"

    cat << EOF
{
  "file": "$(basename "$backup_file")",
  "path": "$backup_file",
  "size_bytes": $file_size,
  "gzip_valid": $gzip_valid,
  "table_count": $table_count,
  "verified_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

# Main
case "${1:-}" in
    --full)
        backup_file="${2:-$(get_latest_backup)}"
        verify_backup "$backup_file" "true"
        ;;
    --all)
        verify_all
        ;;
    --report)
        backup_file="${2:-$(get_latest_backup)}"
        generate_report "$backup_file"
        ;;
    --help|-h)
        echo "QA Guardian Backup Verification Script"
        echo ""
        echo "Usage:"
        echo "  $0                    Verify latest backup"
        echo "  $0 <file>             Verify specific backup file"
        echo "  $0 --full [file]      Full verification with test restore"
        echo "  $0 --all              Verify all backups"
        echo "  $0 --report [file]    Generate JSON report"
        echo "  $0 --help             Show this help"
        ;;
    "")
        backup_file="$(get_latest_backup)"
        if [ -n "$backup_file" ]; then
            verify_backup "$backup_file" "false"
        else
            log_error "No backup files found in $BACKUP_DIR"
            exit 1
        fi
        ;;
    *)
        if [ -f "$1" ]; then
            verify_backup "$1" "false"
        else
            log_error "Unknown option or file not found: $1"
            exit 1
        fi
        ;;
esac
