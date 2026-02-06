#!/bin/bash
# =============================================================================
# QA Guardian - Database Backup Script
# =============================================================================
# Feature #151: Automated database backup with retention policy
#
# This script:
# - Creates compressed PostgreSQL backups
# - Deletes backups older than 30 days (retention policy)
# - Can be run manually or via cron
# - Supports both Docker and local PostgreSQL connections
#
# Usage:
#   ./backup-db.sh                    # Use defaults from environment
#   ./backup-db.sh --verify           # Verify the latest backup integrity
#   ./backup-db.sh --restore <file>   # Restore from a backup file
#   ./backup-db.sh --list             # List all available backups
#
# Environment variables (optional - falls back to defaults):
#   POSTGRES_HOST      - Database host (default: localhost)
#   POSTGRES_PORT      - Database port (default: 5432)
#   POSTGRES_USER      - Database user (default: qa_guardian)
#   POSTGRES_PASSWORD  - Database password (default: QaGuardian2024Secure)
#   POSTGRES_DB        - Database name (default: qa_guardian)
#   BACKUP_DIR         - Backup directory (default: /opt/backups)
#   RETENTION_DAYS     - Days to keep backups (default: 30)
# =============================================================================

set -e

# Configuration (with defaults)
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-qa_guardian}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-QaGuardian2024Secure}"
POSTGRES_DB="${POSTGRES_DB:-qa_guardian}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Timestamp format for backup files
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/qa_guardian_${TIMESTAMP}.sql.gz"
STATUS_FILE="${BACKUP_DIR}/.backup_status.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check if pg_dump is available (try Docker if not local)
get_pg_dump_cmd() {
    if command -v pg_dump &> /dev/null; then
        echo "pg_dump"
    elif docker ps --format '{{.Names}}' | grep -q 'qa-guardian-postgres'; then
        echo "docker exec qa-guardian-postgres pg_dump"
    else
        log_error "pg_dump not found locally and no PostgreSQL container running"
        exit 1
    fi
}

# Check if psql is available (try Docker if not local)
get_psql_cmd() {
    if command -v psql &> /dev/null; then
        echo "psql"
    elif docker ps --format '{{.Names}}' | grep -q 'qa-guardian-postgres'; then
        echo "docker exec qa-guardian-postgres psql"
    else
        log_error "psql not found locally and no PostgreSQL container running"
        exit 1
    fi
}

# Create backup directory if it doesn't exist
ensure_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
        chmod 700 "$BACKUP_DIR"
    fi
}

# Update status file with backup information
update_status() {
    local status="$1"
    local backup_file="$2"
    local size="$3"
    local error_msg="$4"

    cat > "$STATUS_FILE" << EOF
{
  "last_backup": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "$status",
  "backup_file": "$backup_file",
  "size_bytes": $size,
  "retention_days": $RETENTION_DAYS,
  "backups_count": $(find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" 2>/dev/null | wc -l | tr -d ' '),
  "oldest_backup": "$(find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" -printf '%T+ %p\n' 2>/dev/null | sort | head -1 | cut -d' ' -f2 | xargs basename 2>/dev/null || echo 'none')",
  "newest_backup": "$(find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" -printf '%T+ %p\n' 2>/dev/null | sort -r | head -1 | cut -d' ' -f2 | xargs basename 2>/dev/null || echo 'none')",
  "error": "$error_msg"
}
EOF
}

# =============================================================================
# Backup Function
# =============================================================================

do_backup() {
    log_info "Starting database backup..."
    log_info "Database: ${POSTGRES_DB}@${POSTGRES_HOST}:${POSTGRES_PORT}"
    log_info "Backup file: $BACKUP_FILE"

    ensure_backup_dir

    # Get the appropriate pg_dump command
    PG_DUMP_CMD=$(get_pg_dump_cmd)

    # Set PGPASSWORD for authentication
    export PGPASSWORD="$POSTGRES_PASSWORD"

    # Perform the backup
    log_info "Dumping database..."

    if [[ "$PG_DUMP_CMD" == docker* ]]; then
        # Docker-based backup
        docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" qa-guardian-postgres \
            pg_dump -h localhost -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
            --format=plain --no-owner --no-acl \
            | gzip > "$BACKUP_FILE"
    else
        # Local pg_dump
        $PG_DUMP_CMD -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
            --format=plain --no-owner --no-acl \
            | gzip > "$BACKUP_FILE"
    fi

    # Verify backup was created
    if [ -f "$BACKUP_FILE" ]; then
        BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)

        if [ "$BACKUP_SIZE" -gt 1000 ]; then
            log_success "Backup created successfully: $BACKUP_FILE ($BACKUP_SIZE bytes)"
            update_status "success" "$BACKUP_FILE" "$BACKUP_SIZE" ""
        else
            log_error "Backup file is suspiciously small ($BACKUP_SIZE bytes)"
            rm -f "$BACKUP_FILE"
            update_status "failed" "" 0 "Backup file too small"
            exit 1
        fi
    else
        log_error "Backup file was not created"
        update_status "failed" "" 0 "Backup file not created"
        exit 1
    fi

    unset PGPASSWORD
}

# =============================================================================
# Retention Policy - Delete Old Backups
# =============================================================================

cleanup_old_backups() {
    log_info "Applying retention policy: keeping backups from last $RETENTION_DAYS days"

    # Find and delete backups older than RETENTION_DAYS
    OLD_BACKUPS=$(find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" -type f -mtime +$RETENTION_DAYS 2>/dev/null || true)

    if [ -n "$OLD_BACKUPS" ]; then
        COUNT=$(echo "$OLD_BACKUPS" | wc -l | tr -d ' ')
        log_info "Found $COUNT backup(s) older than $RETENTION_DAYS days"

        echo "$OLD_BACKUPS" | while read -r old_backup; do
            if [ -f "$old_backup" ]; then
                log_info "Deleting: $(basename "$old_backup")"
                rm -f "$old_backup"
            fi
        done

        log_success "Cleanup complete: removed $COUNT old backup(s)"
    else
        log_info "No old backups to delete"
    fi
}

# =============================================================================
# Verify Backup Integrity
# =============================================================================

verify_backup() {
    local backup_file="$1"

    # If no file specified, use the latest backup
    if [ -z "$backup_file" ]; then
        backup_file=$(find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" -type f -printf '%T+ %p\n' 2>/dev/null | sort -r | head -1 | cut -d' ' -f2)
    fi

    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        log_error "No backup file found to verify"
        exit 1
    fi

    log_info "Verifying backup integrity: $(basename "$backup_file")"

    # Check if file is a valid gzip
    if gzip -t "$backup_file" 2>/dev/null; then
        log_success "Gzip integrity: OK"
    else
        log_error "Gzip integrity: FAILED - file is corrupted"
        exit 1
    fi

    # Check if it contains SQL content
    SQL_CHECK=$(zcat "$backup_file" | head -20 | grep -c "PostgreSQL\|CREATE\|INSERT\|TABLE" || true)
    if [ "$SQL_CHECK" -gt 0 ]; then
        log_success "SQL content: OK"
    else
        log_warning "SQL content: Could not verify SQL structure"
    fi

    # Get file stats
    BACKUP_SIZE=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    BACKUP_DATE=$(stat -f"%Sm" -t"%Y-%m-%d %H:%M:%S" "$backup_file" 2>/dev/null || stat -c"%y" "$backup_file" 2>/dev/null | cut -d'.' -f1)
    UNCOMPRESSED_SIZE=$(zcat "$backup_file" | wc -c | tr -d ' ')
    TABLE_COUNT=$(zcat "$backup_file" | grep -c "CREATE TABLE" || echo "0")

    log_info "Backup details:"
    echo "  - File: $(basename "$backup_file")"
    echo "  - Compressed size: $BACKUP_SIZE bytes"
    echo "  - Uncompressed size: $UNCOMPRESSED_SIZE bytes"
    echo "  - Tables found: $TABLE_COUNT"
    echo "  - Created: $BACKUP_DATE"

    log_success "Backup verification complete"
}

# =============================================================================
# Restore Function
# =============================================================================

restore_backup() {
    local backup_file="$1"

    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi

    log_warning "======================================================"
    log_warning "  WARNING: This will OVERWRITE the current database!"
    log_warning "======================================================"
    log_info "Restore from: $(basename "$backup_file")"
    log_info "Target database: ${POSTGRES_DB}@${POSTGRES_HOST}:${POSTGRES_PORT}"

    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi

    # First verify the backup
    verify_backup "$backup_file"

    log_info "Starting restore..."

    # Get the appropriate psql command
    PSQL_CMD=$(get_psql_cmd)

    export PGPASSWORD="$POSTGRES_PASSWORD"

    if [[ "$PSQL_CMD" == docker* ]]; then
        # Docker-based restore
        zcat "$backup_file" | docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" qa-guardian-postgres \
            psql -h localhost -U "$POSTGRES_USER" -d "$POSTGRES_DB" --quiet
    else
        # Local psql restore
        zcat "$backup_file" | $PSQL_CMD -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" --quiet
    fi

    unset PGPASSWORD

    log_success "Database restored successfully from: $(basename "$backup_file")"
}

# =============================================================================
# List Backups
# =============================================================================

list_backups() {
    log_info "Available backups in $BACKUP_DIR:"
    echo ""

    if [ ! -d "$BACKUP_DIR" ]; then
        log_warning "Backup directory does not exist"
        exit 0
    fi

    # List backups with details
    find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" -type f -printf '%T+ %s %p\n' 2>/dev/null | \
        sort -r | \
        while read -r line; do
            timestamp=$(echo "$line" | cut -d' ' -f1)
            size=$(echo "$line" | awk '{print $2}')
            file=$(echo "$line" | awk '{print $3}')

            # Format size
            if [ "$size" -gt 1048576 ]; then
                size_formatted="$(echo "scale=2; $size/1048576" | bc)MB"
            elif [ "$size" -gt 1024 ]; then
                size_formatted="$(echo "scale=2; $size/1024" | bc)KB"
            else
                size_formatted="${size}B"
            fi

            echo "  $(basename "$file") - $size_formatted"
        done

    echo ""
    TOTAL_COUNT=$(find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" -type f 2>/dev/null | wc -l | tr -d ' ')
    TOTAL_SIZE=$(find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" -type f -exec stat -f%z {} \; 2>/dev/null | awk '{s+=$1} END {print s}' || \
                 find "$BACKUP_DIR" -name "qa_guardian_*.sql.gz" -type f -exec stat -c%s {} \; 2>/dev/null | awk '{s+=$1} END {print s}')

    if [ -n "$TOTAL_SIZE" ] && [ "$TOTAL_SIZE" -gt 1048576 ]; then
        TOTAL_SIZE_FORMATTED="$(echo "scale=2; $TOTAL_SIZE/1048576" | bc)MB"
    elif [ -n "$TOTAL_SIZE" ] && [ "$TOTAL_SIZE" -gt 1024 ]; then
        TOTAL_SIZE_FORMATTED="$(echo "scale=2; $TOTAL_SIZE/1024" | bc)KB"
    else
        TOTAL_SIZE_FORMATTED="${TOTAL_SIZE:-0}B"
    fi

    log_info "Total: $TOTAL_COUNT backup(s), $TOTAL_SIZE_FORMATTED"
}

# =============================================================================
# Main
# =============================================================================

case "${1:-backup}" in
    --verify)
        verify_backup "$2"
        ;;
    --restore)
        restore_backup "$2"
        ;;
    --list)
        list_backups
        ;;
    --cleanup)
        cleanup_old_backups
        ;;
    --status)
        if [ -f "$STATUS_FILE" ]; then
            cat "$STATUS_FILE"
        else
            echo '{"status": "no_backups", "message": "No backup status available"}'
        fi
        ;;
    backup|--backup)
        do_backup
        cleanup_old_backups
        ;;
    --help|-h)
        echo "QA Guardian Database Backup Script"
        echo ""
        echo "Usage:"
        echo "  $0                    Create a backup and apply retention policy"
        echo "  $0 --verify [file]    Verify backup integrity (latest if no file specified)"
        echo "  $0 --restore <file>   Restore database from backup file"
        echo "  $0 --list             List all available backups"
        echo "  $0 --cleanup          Only run retention cleanup (no new backup)"
        echo "  $0 --status           Show backup status as JSON"
        echo "  $0 --help             Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  POSTGRES_HOST      Database host (default: localhost)"
        echo "  POSTGRES_PORT      Database port (default: 5432)"
        echo "  POSTGRES_USER      Database user (default: qa_guardian)"
        echo "  POSTGRES_PASSWORD  Database password"
        echo "  POSTGRES_DB        Database name (default: qa_guardian)"
        echo "  BACKUP_DIR         Backup directory (default: /opt/backups)"
        echo "  RETENTION_DAYS     Days to keep backups (default: 30)"
        ;;
    *)
        log_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
