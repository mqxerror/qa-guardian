#!/bin/bash
# =============================================================================
# QA Guardian - Dokploy Deployment Script
# =============================================================================
# Deploys QA Guardian to Dokploy with domain and SSL configuration
#
# Prerequisites:
#   - Dokploy CLI installed: npm i -g dokploy
#   - Dokploy server running and configured
#   - DNS pointing qa.pixelcraftedmedia.com to your server
#
# Usage:
#   ./scripts/deploy-dokploy.sh              # Full deployment
#   ./scripts/deploy-dokploy.sh --logs       # Tail logs after deployment
#   ./scripts/deploy-dokploy.sh --restart    # Restart all services
#   ./scripts/deploy-dokploy.sh --status     # Show deployment status
#   ./scripts/deploy-dokploy.sh --migrate    # Run database migrations only
#
# =============================================================================

set -euo pipefail

# Configuration
PROJECT_NAME="qa-guardian"
DOMAIN="qa.pixelcraftedmedia.com"
COMPOSE_FILE="dokploy/docker-compose.yml"
ENV_FILE="dokploy/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print banner
print_banner() {
    echo ""
    echo "==========================================="
    echo "    QA Guardian - Dokploy Deployment"
    echo "==========================================="
    echo "    Domain: ${DOMAIN}"
    echo "    Project: ${PROJECT_NAME}"
    echo "==========================================="
    echo ""
}

# Check if Dokploy CLI is installed
check_dokploy() {
    log_info "Checking Dokploy CLI..."

    if ! command -v dokploy &> /dev/null; then
        log_error "Dokploy CLI is not installed!"
        echo ""
        echo "Install with:"
        echo "  npm install -g dokploy"
        echo ""
        echo "Or use Docker Compose directly:"
        echo "  docker-compose -f dokploy/docker-compose.yml up -d"
        exit 1
    fi

    local version=$(dokploy --version 2>/dev/null || echo "unknown")
    log_success "Dokploy CLI found: $version"
}

# Generate a secure random password
generate_password() {
    openssl rand -base64 32 | tr -d /=+ | head -c 32
}

# Generate a secure JWT secret
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d /=+ | head -c 64
}

# Validate and generate environment variables
setup_environment() {
    log_info "Setting up environment variables..."

    # Create env file if it doesn't exist
    if [ ! -f "$ENV_FILE" ]; then
        log_info "Creating environment file from template..."
        cp dokploy/.env.example "$ENV_FILE"
    fi

    # Load existing env file
    source "$ENV_FILE" 2>/dev/null || true

    # Generate missing secrets
    local changes_made=false

    if [ -z "${POSTGRES_PASSWORD:-}" ] || [[ "${POSTGRES_PASSWORD}" == *"CHANGE_ME"* ]] || [[ "${POSTGRES_PASSWORD}" == *"generate"* ]]; then
        export POSTGRES_PASSWORD=$(generate_password)
        log_info "Generated POSTGRES_PASSWORD"
        changes_made=true
    fi

    if [ -z "${REDIS_PASSWORD:-}" ] || [[ "${REDIS_PASSWORD}" == *"CHANGE_ME"* ]] || [[ "${REDIS_PASSWORD}" == *"generate"* ]]; then
        export REDIS_PASSWORD=$(generate_password)
        log_info "Generated REDIS_PASSWORD"
        changes_made=true
    fi

    if [ -z "${MINIO_ROOT_PASSWORD:-}" ] || [[ "${MINIO_ROOT_PASSWORD}" == *"CHANGE_ME"* ]] || [[ "${MINIO_ROOT_PASSWORD}" == *"generate"* ]]; then
        export MINIO_ROOT_PASSWORD=$(generate_password)
        log_info "Generated MINIO_ROOT_PASSWORD"
        changes_made=true
    fi

    if [ -z "${JWT_SECRET:-}" ] || [[ "${JWT_SECRET}" == *"CHANGE_ME"* ]] || [[ "${JWT_SECRET}" == *"generate"* ]]; then
        export JWT_SECRET=$(generate_jwt_secret)
        log_info "Generated JWT_SECRET"
        changes_made=true
    fi

    if [ -z "${JWT_REFRESH_SECRET:-}" ] || [[ "${JWT_REFRESH_SECRET}" == *"CHANGE_ME"* ]] || [[ "${JWT_REFRESH_SECRET}" == *"generate"* ]]; then
        export JWT_REFRESH_SECRET=$(generate_jwt_secret)
        log_info "Generated JWT_REFRESH_SECRET"
        changes_made=true
    fi

    if [ -z "${SESSION_SECRET:-}" ] || [[ "${SESSION_SECRET}" == *"CHANGE_ME"* ]] || [[ "${SESSION_SECRET}" == *"generate"* ]]; then
        export SESSION_SECRET=$(generate_jwt_secret)
        log_info "Generated SESSION_SECRET"
        changes_made=true
    fi

    # Update env file with generated values
    if [ "$changes_made" = true ]; then
        cat > "$ENV_FILE" << EOF
# QA Guardian - Dokploy Environment (Auto-generated)
# Generated: $(date)

# Application
NODE_ENV=production
VERSION=latest

# Database
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# MinIO
MINIO_ROOT_USER=${MINIO_ROOT_USER:-qa-guardian-admin}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
STORAGE_BUCKET=${STORAGE_BUCKET:-qa-guardian-artifacts}

# Authentication
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
SESSION_SECRET=${SESSION_SECRET}

# URLs
FRONTEND_URL=https://${DOMAIN}
VITE_API_URL=https://${DOMAIN}
VITE_API_BASE_URL=https://${DOMAIN}
VITE_SOCKET_URL=https://${DOMAIN}
VITE_MCP_URL=https://${DOMAIN}/mcp

# AI Providers (optional)
AI_PROVIDER_PRIMARY=${AI_PROVIDER_PRIMARY:-kie}
AI_PROVIDER_FALLBACK=${AI_PROVIDER_FALLBACK:-anthropic}
KIE_API_KEY=${KIE_API_KEY:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}

# Google OAuth (optional)
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}

# GitHub Integration (optional)
GITHUB_APP_ID=${GITHUB_APP_ID:-}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID:-}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET:-}
EOF
        log_success "Updated $ENV_FILE with generated secrets"
        log_warn "Keep this file secure! Contains sensitive credentials."
    fi

    log_success "Environment configured"
}

# Create or update Dokploy project
create_project() {
    log_info "Setting up Dokploy project: ${PROJECT_NAME}..."

    # Check if project exists
    if dokploy project list 2>/dev/null | grep -q "$PROJECT_NAME"; then
        log_info "Project '$PROJECT_NAME' already exists"
    else
        dokploy project create "$PROJECT_NAME" || {
            log_warn "Could not create project via CLI. Create it manually in Dokploy dashboard."
        }
    fi
}

# Configure domain
configure_domain() {
    log_info "Configuring domain: ${DOMAIN}..."

    dokploy domain add "$DOMAIN" --project "$PROJECT_NAME" 2>/dev/null || {
        log_info "Domain may already be configured or CLI command not available."
        log_info "Configure in Dokploy dashboard: Settings > Domains > Add '${DOMAIN}'"
    }
}

# Enable SSL
enable_ssl() {
    log_info "Enabling SSL for ${DOMAIN}..."

    dokploy ssl enable --domain "$DOMAIN" 2>/dev/null || {
        log_info "SSL may already be enabled or CLI command not available."
        log_info "Enable in Dokploy dashboard: Settings > SSL > Enable Let's Encrypt"
    }

    log_success "SSL configuration requested"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."

    # Try Dokploy CLI first
    if dokploy deploy --compose "$COMPOSE_FILE" --env-file "$ENV_FILE" --project "$PROJECT_NAME" 2>/dev/null; then
        log_success "Deployed via Dokploy CLI"
    else
        # Fallback to docker-compose
        log_info "Falling back to docker-compose..."
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
        log_success "Deployed via docker-compose"
    fi
}

# Wait for health checks
wait_for_health() {
    log_info "Waiting for services to be healthy..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -sf "https://${DOMAIN}/health" > /dev/null 2>&1; then
            log_success "Frontend is healthy"
            break
        fi
        echo -n "."
        sleep 5
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_warn "Health check timed out. Services may still be starting."
        log_info "Check logs with: ./scripts/deploy-dokploy.sh --logs"
    fi

    # Check backend health
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "https://${DOMAIN}/api/v1/health" > /dev/null 2>&1; then
            log_success "Backend API is healthy"
            break
        fi
        echo -n "."
        sleep 5
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_warn "Backend health check timed out."
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    # Try Dokploy exec first
    if dokploy exec backend --project "$PROJECT_NAME" -- npm run migrate 2>/dev/null; then
        log_success "Migrations completed via Dokploy"
    else
        # Fallback to docker exec
        docker exec qa-guardian-backend npm run migrate || {
            log_warn "Could not run migrations. Run manually:"
            echo "  docker exec qa-guardian-backend npm run migrate"
        }
    fi
}

# Print deployment summary
print_summary() {
    echo ""
    echo "==========================================="
    echo "         Deployment Summary"
    echo "==========================================="
    echo ""
    log_success "QA Guardian deployed to Dokploy!"
    echo ""
    echo "URLs:"
    echo "  Frontend:    https://${DOMAIN}"
    echo "  API:         https://${DOMAIN}/api"
    echo "  Health:      https://${DOMAIN}/health"
    echo "  MCP Chat:    https://${DOMAIN}/mcp"
    echo ""
    echo "Default Login:"
    echo "  Email:    owner@example.com"
    echo "  Password: Owner123!"
    echo ""
    log_warn "IMPORTANT: Change the default password after first login!"
    echo ""
    echo "Commands:"
    echo "  View logs:     ./scripts/deploy-dokploy.sh --logs"
    echo "  Check status:  ./scripts/deploy-dokploy.sh --status"
    echo "  Restart:       ./scripts/deploy-dokploy.sh --restart"
    echo "  Migrations:    ./scripts/deploy-dokploy.sh --migrate"
    echo ""
}

# Show logs
show_logs() {
    log_info "Tailing logs..."
    docker-compose -f "$COMPOSE_FILE" logs -f
}

# Show status
show_status() {
    log_info "Deployment Status"
    echo ""

    # Container status
    docker-compose -f "$COMPOSE_FILE" ps

    echo ""

    # Health checks
    log_info "Health Checks:"

    if curl -sf "https://${DOMAIN}/health" > /dev/null 2>&1; then
        log_success "Frontend: OK"
    else
        log_error "Frontend: FAILED"
    fi

    if curl -sf "https://${DOMAIN}/api/v1/health" > /dev/null 2>&1; then
        log_success "Backend: OK"
    else
        log_error "Backend: FAILED"
    fi

    if curl -sf "https://${DOMAIN}/api/v1/mcp/status" > /dev/null 2>&1; then
        log_success "MCP: OK"
    else
        log_warn "MCP: UNAVAILABLE (AI features may be disabled)"
    fi
}

# Restart services
restart_services() {
    log_info "Restarting services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart
    log_success "Services restarted"
}

# Main deployment function
deploy() {
    print_banner
    check_dokploy
    setup_environment
    create_project
    configure_domain
    enable_ssl
    deploy_services
    wait_for_health
    run_migrations
    print_summary
}

# Parse command line arguments
case "${1:-}" in
    --logs|-l)
        show_logs
        ;;
    --status|-s)
        show_status
        ;;
    --restart|-r)
        restart_services
        ;;
    --migrate|-m)
        run_migrations
        ;;
    --help|-h)
        echo "QA Guardian - Dokploy Deployment Script"
        echo ""
        echo "Usage:"
        echo "  ./scripts/deploy-dokploy.sh              Full deployment"
        echo "  ./scripts/deploy-dokploy.sh --logs       Tail logs"
        echo "  ./scripts/deploy-dokploy.sh --status     Show status"
        echo "  ./scripts/deploy-dokploy.sh --restart    Restart services"
        echo "  ./scripts/deploy-dokploy.sh --migrate    Run migrations"
        echo "  ./scripts/deploy-dokploy.sh --help       Show this help"
        ;;
    *)
        deploy
        ;;
esac
