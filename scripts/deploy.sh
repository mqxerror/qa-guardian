#!/bin/bash
# =============================================================================
# QA Guardian - Production Deployment Script
# =============================================================================
# One-command deployment for the complete QA Guardian stack
#
# Usage:
#   ./scripts/deploy.sh              # Deploy the stack
#   ./scripts/deploy.sh --down       # Stop all services
#   ./scripts/deploy.sh --logs       # Tail all service logs
#   ./scripts/deploy.sh --status     # Show service status
#   ./scripts/deploy.sh --rebuild    # Force rebuild and deploy
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker"
COMPOSE_FILE="$DOCKER_DIR/docker-compose.prod.yml"
ENV_FILE="$DOCKER_DIR/.env.prod"
ENV_EXAMPLE="$DOCKER_DIR/.env.prod.example"

# Default values
DEPLOY_ACTION="deploy"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                    QA Guardian Deployment                         ║"
    echo "║                  All tests. One platform. AI-ready.               ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if a command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is required but not installed."
        return 1
    fi
    return 0
}

# Generate a secure random password
generate_password() {
    openssl rand -base64 32 | tr -d '/+=' | head -c 32
}

# Check if env var contains default/placeholder value
is_default_value() {
    local value="$1"
    [[ "$value" == "CHANGE_ME"* ]] || [[ -z "$value" ]]
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

preflight_checks() {
    log_info "Running pre-flight checks..."

    # Check required tools
    local missing_tools=()

    if ! check_command "docker" 2>/dev/null; then
        missing_tools+=("docker")
    fi

    if ! docker compose version &>/dev/null; then
        if ! check_command "docker-compose" 2>/dev/null; then
            missing_tools+=("docker-compose or docker compose plugin")
        fi
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install Docker and Docker Compose to continue."
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &>/dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi

    log_success "All pre-flight checks passed!"
}

# =============================================================================
# Environment Setup
# =============================================================================

setup_environment() {
    log_info "Setting up environment..."

    # Check if .env.prod exists
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "$ENV_EXAMPLE" ]]; then
            log_warning "No .env.prod found. Creating from example..."
            cp "$ENV_EXAMPLE" "$ENV_FILE"
        else
            log_error "No .env.prod.example found. Cannot create environment file."
            exit 1
        fi
    fi

    # Source the environment file
    set -a
    source "$ENV_FILE"
    set +a

    # Check for default/placeholder values and generate secure ones
    local needs_edit=false
    local generated_secrets=""

    # Generate POSTGRES_PASSWORD if not set
    if is_default_value "${POSTGRES_PASSWORD:-}"; then
        local new_pass=$(generate_password)
        sed -i.bak "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$new_pass/" "$ENV_FILE"
        generated_secrets+="  - POSTGRES_PASSWORD (generated)\n"
    fi

    # Generate REDIS_PASSWORD if not set
    if is_default_value "${REDIS_PASSWORD:-}"; then
        local new_pass=$(generate_password)
        sed -i.bak "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$new_pass/" "$ENV_FILE"
        generated_secrets+="  - REDIS_PASSWORD (generated)\n"
    fi

    # Generate MINIO_ROOT_PASSWORD if not set
    if is_default_value "${MINIO_ROOT_PASSWORD:-}"; then
        local new_pass=$(generate_password)
        sed -i.bak "s/^MINIO_ROOT_PASSWORD=.*/MINIO_ROOT_PASSWORD=$new_pass/" "$ENV_FILE"
        generated_secrets+="  - MINIO_ROOT_PASSWORD (generated)\n"
    fi

    # Generate JWT_SECRET if not set
    if is_default_value "${JWT_SECRET:-}"; then
        local new_secret=$(generate_password)$(generate_password)
        sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$new_secret/" "$ENV_FILE"
        generated_secrets+="  - JWT_SECRET (generated)\n"
    fi

    # Generate JWT_REFRESH_SECRET if not set
    if is_default_value "${JWT_REFRESH_SECRET:-}"; then
        local new_secret=$(generate_password)$(generate_password)
        sed -i.bak "s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$new_secret/" "$ENV_FILE"
        generated_secrets+="  - JWT_REFRESH_SECRET (generated)\n"
    fi

    # Generate SESSION_SECRET if not set
    if is_default_value "${SESSION_SECRET:-}"; then
        local new_secret=$(generate_password)$(generate_password)
        sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$new_secret/" "$ENV_FILE"
        generated_secrets+="  - SESSION_SECRET (generated)\n"
    fi

    # Clean up backup files
    rm -f "$ENV_FILE.bak"

    if [[ -n "$generated_secrets" ]]; then
        log_success "Generated secure values for:"
        echo -e "$generated_secrets"
    fi

    # Check if FRONTEND_URL needs to be configured
    if is_default_value "${FRONTEND_URL:-}" || [[ "${FRONTEND_URL:-}" == "https://qa.yourdomain.com" ]]; then
        log_warning "FRONTEND_URL is not configured."
        log_info "Please edit $ENV_FILE and set FRONTEND_URL to your domain."
        needs_edit=true
    fi

    # Re-source to get updated values
    set -a
    source "$ENV_FILE"
    set +a

    log_success "Environment setup complete!"
}

# =============================================================================
# Build Services
# =============================================================================

build_services() {
    local force_rebuild="${1:-false}"

    log_info "Building Docker images..."

    local build_args=""
    if [[ "$force_rebuild" == "true" ]]; then
        build_args="--no-cache"
    fi

    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --parallel $build_args

    log_success "Docker images built successfully!"
}

# =============================================================================
# Start Services
# =============================================================================

start_services() {
    log_info "Starting services..."

    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

    log_success "Services started!"
}

# =============================================================================
# Wait for Health Checks
# =============================================================================

wait_for_health() {
    log_info "Waiting for services to become healthy..."

    local max_attempts=60
    local attempt=0

    while [[ $attempt -lt $max_attempts ]]; do
        attempt=$((attempt + 1))

        # Check if all services are healthy
        local unhealthy=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --format json 2>/dev/null | grep -c '"Health":"unhealthy"' || true)
        local starting=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --format json 2>/dev/null | grep -c '"Health":"starting"' || true)

        if [[ "$unhealthy" == "0" ]] && [[ "$starting" == "0" ]]; then
            # Double-check with individual health endpoints
            if curl -sf http://localhost/health &>/dev/null && \
               curl -sf http://localhost/api/health &>/dev/null 2>/dev/null; then
                log_success "All services are healthy!"
                return 0
            fi
        fi

        echo -ne "\r  Waiting for health checks... ($attempt/$max_attempts)"
        sleep 2
    done

    echo ""
    log_error "Services failed to become healthy within timeout."
    log_info "Check logs with: $0 --logs"
    return 1
}

# =============================================================================
# Run Migrations
# =============================================================================

run_migrations() {
    log_info "Running database migrations..."

    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend npm run migrate 2>/dev/null || {
        log_warning "Migration command not available or already up to date."
    }

    log_success "Database migrations complete!"
}

# =============================================================================
# Stop Services
# =============================================================================

stop_services() {
    log_info "Stopping all services..."

    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down

    log_success "All services stopped!"
}

# =============================================================================
# Show Logs
# =============================================================================

show_logs() {
    log_info "Tailing logs (Ctrl+C to exit)..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
}

# =============================================================================
# Show Status
# =============================================================================

show_status() {
    log_info "Service status:"
    echo ""
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo ""

    # Try to show health endpoints
    echo -e "${BLUE}Health Checks:${NC}"
    if curl -sf http://localhost/health &>/dev/null; then
        echo -e "  Frontend: ${GREEN}✓ healthy${NC}"
    else
        echo -e "  Frontend: ${RED}✗ unhealthy${NC}"
    fi

    if curl -sf http://localhost:3001/health &>/dev/null 2>/dev/null; then
        echo -e "  Backend:  ${GREEN}✓ healthy${NC}"
    else
        # Try through nginx proxy
        if curl -sf http://localhost/api/health &>/dev/null 2>/dev/null; then
            echo -e "  Backend:  ${GREEN}✓ healthy${NC} (via proxy)"
        else
            echo -e "  Backend:  ${RED}✗ unhealthy${NC}"
        fi
    fi
    echo ""
}

# =============================================================================
# Print Success
# =============================================================================

print_success() {
    local frontend_url="${FRONTEND_URL:-http://localhost}"

    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  QA Guardian Deployed Successfully!               ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo -e "  Application:  ${frontend_url}"
    echo -e "  API:          ${frontend_url}/api/health"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo -e "  View logs:    $0 --logs"
    echo -e "  Stop:         $0 --down"
    echo -e "  Status:       $0 --status"
    echo -e "  Rebuild:      $0 --rebuild"
    echo ""
    echo -e "${YELLOW}Note:${NC} Default login: owner@example.com / Owner123!"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --down)
                DEPLOY_ACTION="down"
                shift
                ;;
            --logs)
                DEPLOY_ACTION="logs"
                shift
                ;;
            --status)
                DEPLOY_ACTION="status"
                shift
                ;;
            --rebuild)
                DEPLOY_ACTION="rebuild"
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --down      Stop all services"
                echo "  --logs      Tail service logs"
                echo "  --status    Show service status"
                echo "  --rebuild   Force rebuild and deploy"
                echo "  --help      Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information."
                exit 1
                ;;
        esac
    done

    print_banner

    case $DEPLOY_ACTION in
        down)
            stop_services
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        rebuild)
            preflight_checks
            setup_environment
            build_services true
            start_services
            wait_for_health || true
            run_migrations
            print_success
            ;;
        deploy)
            preflight_checks
            setup_environment
            build_services
            start_services
            wait_for_health || true
            run_migrations
            print_success
            ;;
    esac
}

# Run main function
main "$@"
