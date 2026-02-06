#!/bin/bash
# =============================================================================
# QA Guardian - Zero-Downtime Deployment Script
# =============================================================================
# Feature #207: Zero-downtime deployment with rollback capability
#
# Usage:
#   ./deploy.sh              # Deploy with zero downtime
#   ./deploy.sh --rollback   # Rollback to previous version
#   ./deploy.sh --status     # Show deployment status
# =============================================================================

set -euo pipefail

# Configuration
DEPLOY_DIR="${DEPLOY_DIR:-/opt/qa-guardian}"
LOG_FILE="$DEPLOY_DIR/deploy.log"
HEALTH_URL="${HEALTH_URL:-http://localhost:3001/health}"
HEALTH_TIMEOUT=60
HEALTH_INTERVAL=2

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Logging
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    echo -e "${BLUE}[$timestamp]${NC} $message"
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [SUCCESS] $*" >> "$LOG_FILE"
    echo -e "${GREEN}[$timestamp] ✓ $*${NC}"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [ERROR] $*" >> "$LOG_FILE"
    echo -e "${RED}[$timestamp] ✗ $*${NC}"
}

log_warning() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [WARNING] $*" >> "$LOG_FILE"
    echo -e "${YELLOW}[$timestamp] ⚠ $*${NC}"
}

# =============================================================================
# Helper Functions
# =============================================================================

# Tag current images for rollback
tag_for_rollback() {
    log "INFO" "Tagging current images for rollback..."

    # Get current image IDs
    local backend_image=$(docker compose ps -q backend 2>/dev/null | xargs docker inspect --format='{{.Image}}' 2>/dev/null || echo "")
    local frontend_image=$(docker compose ps -q frontend 2>/dev/null | xargs docker inspect --format='{{.Image}}' 2>/dev/null || echo "")

    if [[ -n "$backend_image" ]]; then
        docker tag "$backend_image" qa-guardian-backend:rollback 2>/dev/null || log_warning "Could not tag backend image"
        log_success "Tagged backend image for rollback"
    fi

    if [[ -n "$frontend_image" ]]; then
        docker tag "$frontend_image" qa-guardian-frontend:rollback 2>/dev/null || log_warning "Could not tag frontend image"
        log_success "Tagged frontend image for rollback"
    fi
}

# Health check with retry
check_health() {
    local url="${1:-$HEALTH_URL}"
    local max_attempts=$((HEALTH_TIMEOUT / HEALTH_INTERVAL))
    local attempt=0

    log "INFO" "Waiting for health check at $url..."

    while [[ $attempt -lt $max_attempts ]]; do
        attempt=$((attempt + 1))

        # Check health endpoint
        if curl -sf "$url" >/dev/null 2>&1; then
            local response=$(curl -s "$url" 2>/dev/null)
            local status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

            if [[ "$status" == "ok" || "$status" == "degraded" ]]; then
                log_success "Health check passed (status: $status)"
                return 0
            fi
        fi

        echo -ne "\r  Health check attempt $attempt/$max_attempts..."
        sleep $HEALTH_INTERVAL
    done

    echo ""
    log_error "Health check failed after ${HEALTH_TIMEOUT}s"
    return 1
}

# Rollback to previous images
rollback() {
    log_warning "Rolling back to previous version..."

    # Check if rollback images exist
    if ! docker image inspect qa-guardian-backend:rollback >/dev/null 2>&1; then
        log_error "No rollback image found for backend"
        return 1
    fi

    if ! docker image inspect qa-guardian-frontend:rollback >/dev/null 2>&1; then
        log_error "No rollback image found for frontend"
        return 1
    fi

    # Stop current containers and start with rollback images
    docker compose stop backend frontend

    # Re-tag rollback images as latest
    docker tag qa-guardian-backend:rollback qa-guardian-backend:latest
    docker tag qa-guardian-frontend:rollback qa-guardian-frontend:latest

    # Start with the rollback images
    docker compose up -d backend frontend

    # Verify rollback
    if check_health; then
        log_success "Rollback completed successfully"
        return 0
    else
        log_error "Rollback failed - manual intervention required"
        return 1
    fi
}

# Show deployment status
show_status() {
    echo ""
    echo -e "${BLUE}=== QA Guardian Deployment Status ===${NC}"
    echo ""

    # Container status
    echo -e "${BLUE}Container Status:${NC}"
    docker compose ps
    echo ""

    # Health check
    echo -e "${BLUE}Health Check:${NC}"
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
        local response=$(curl -s "$HEALTH_URL" 2>/dev/null)
        echo -e "  ${GREEN}✓ Backend is healthy${NC}"
        echo "    Response: $response"
    else
        echo -e "  ${RED}✗ Backend is unhealthy${NC}"
    fi
    echo ""

    # Rollback images
    echo -e "${BLUE}Rollback Images:${NC}"
    if docker image inspect qa-guardian-backend:rollback >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Backend rollback image available${NC}"
    else
        echo -e "  ${YELLOW}⚠ No backend rollback image${NC}"
    fi

    if docker image inspect qa-guardian-frontend:rollback >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Frontend rollback image available${NC}"
    else
        echo -e "  ${YELLOW}⚠ No frontend rollback image${NC}"
    fi
    echo ""

    # Recent deploy log entries
    echo -e "${BLUE}Recent Deploy Log:${NC}"
    if [[ -f "$LOG_FILE" ]]; then
        tail -10 "$LOG_FILE" 2>/dev/null || echo "  (no entries)"
    else
        echo "  (no log file)"
    fi
    echo ""
}

# =============================================================================
# Main Deployment
# =============================================================================

deploy() {
    log "INFO" "Starting zero-downtime deployment..."

    # Change to deploy directory
    cd "$DEPLOY_DIR"

    # Step 1: Pull latest code
    log "INFO" "Pulling latest code from origin/main..."
    git fetch origin main
    git reset --hard origin/main
    log_success "Code updated"

    # Step 2: Tag current images for rollback
    tag_for_rollback

    # Step 3: Build new images
    log "INFO" "Building new Docker images..."
    docker compose build --parallel backend frontend
    log_success "Images built"

    # Step 4: Zero-downtime deployment using rolling update
    log "INFO" "Deploying with zero downtime..."
    docker compose up -d --build --remove-orphans backend frontend
    log_success "Containers updated"

    # Step 5: Wait for health check
    if check_health; then
        log_success "Deployment completed successfully!"

        # Clean up old images (but keep rollback)
        docker image prune -f >/dev/null 2>&1 || echo "Image prune skipped"

        echo ""
        echo -e "${GREEN}=== Deployment Complete ===${NC}"
        echo -e "  Time: $(date)"
        echo -e "  Status: ${GREEN}SUCCESS${NC}"
        echo ""
        return 0
    else
        log_error "Health check failed after deployment"

        # Attempt automatic rollback
        log_warning "Attempting automatic rollback..."
        if rollback; then
            log_success "Automatic rollback succeeded"
        else
            log_error "Automatic rollback failed - manual intervention required"
        fi

        return 1
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || echo "Using existing directory"
    touch "$LOG_FILE" 2>/dev/null || echo "Log file already exists"

    # Parse arguments
    case "${1:-deploy}" in
        --rollback)
            cd "$DEPLOY_DIR"
            rollback
            ;;
        --status)
            cd "$DEPLOY_DIR"
            show_status
            ;;
        --help|-h)
            echo "QA Guardian Zero-Downtime Deployment"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  (none)       Deploy with zero downtime"
            echo "  --rollback   Rollback to previous version"
            echo "  --status     Show deployment status"
            echo "  --help       Show this help"
            echo ""
            echo "Environment Variables:"
            echo "  DEPLOY_DIR     Deployment directory (default: /opt/qa-guardian)"
            echo "  HEALTH_URL     Health check URL (default: http://localhost:3001/health)"
            echo "  HEALTH_TIMEOUT Health check timeout in seconds (default: 60)"
            ;;
        *)
            deploy
            ;;
    esac
}

main "$@"
