#!/bin/bash
# =============================================================================
# QA Guardian - Promote Staging to Production
# =============================================================================
# Promotes the current staging deployment to production by:
# 1. Tagging staging images as production images
# 2. Deploying production with the tagged images
# 3. Running health checks
#
# Prerequisites:
#   - Staging deployment is healthy
#   - Docker registry access (ghcr.io)
#   - SSH access to server
#
# Usage:
#   ./scripts/promote-to-production.sh              # Promote staging → production
#   ./scripts/promote-to-production.sh --version    # Create versioned release
#   ./scripts/promote-to-production.sh --dry-run    # Show what would happen
# =============================================================================

set -euo pipefail

# Configuration
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_NAME="${IMAGE_NAME:-your-org/qa-guardian}"  # Update with your repo
STAGING_DOMAIN="staging.qa.pixelcraftedmedia.com"
PRODUCTION_DOMAIN="qa.pixelcraftedmedia.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
DRY_RUN=false
CREATE_VERSION=false
VERSION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --version)
      CREATE_VERSION=true
      shift
      ;;
    --help|-h)
      echo "Promote Staging to Production"
      echo ""
      echo "Usage:"
      echo "  ./scripts/promote-to-production.sh              Promote staging → production"
      echo "  ./scripts/promote-to-production.sh --version    Create versioned release"
      echo "  ./scripts/promote-to-production.sh --dry-run    Show what would happen"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Print banner
echo ""
echo "==========================================="
echo "    Promote Staging → Production"
echo "==========================================="
echo "  Staging:    ${STAGING_DOMAIN}"
echo "  Production: ${PRODUCTION_DOMAIN}"
echo "  Dry Run:    ${DRY_RUN}"
echo "==========================================="
echo ""

# Step 1: Verify staging is healthy
log_info "Checking staging health..."

if ! curl -sf "https://${STAGING_DOMAIN}/health" > /dev/null 2>&1; then
  log_error "Staging is not healthy! Cannot promote."
  log_error "Check https://${STAGING_DOMAIN}/health"
  exit 1
fi

log_success "Staging is healthy"

# Step 2: Get current staging image SHA
log_info "Getting current staging image tags..."

BACKEND_SHA=$(docker image inspect "${REGISTRY}/${IMAGE_NAME}-backend:staging-latest" --format '{{.Id}}' 2>/dev/null | cut -d':' -f2 | head -c12 || echo "unknown")
FRONTEND_SHA=$(docker image inspect "${REGISTRY}/${IMAGE_NAME}-frontend:staging-latest" --format '{{.Id}}' 2>/dev/null | cut -d':' -f2 | head -c12 || echo "unknown")

log_info "Backend SHA: ${BACKEND_SHA}"
log_info "Frontend SHA: ${FRONTEND_SHA}"

# Step 3: Optionally create version tag
if [ "$CREATE_VERSION" = true ]; then
  log_info "Enter version number (e.g., 1.2.3):"
  read -r VERSION

  if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    log_error "Invalid version format. Use semantic versioning (e.g., 1.2.3)"
    exit 1
  fi

  log_info "Creating git tag v${VERSION}..."

  if [ "$DRY_RUN" = false ]; then
    git tag -a "v${VERSION}" -m "Release v${VERSION}"
    git push origin "v${VERSION}"
    log_success "Created and pushed tag v${VERSION}"
  else
    log_info "[DRY RUN] Would create tag v${VERSION}"
  fi
fi

# Step 4: Tag staging images as production
log_info "Tagging staging images as production..."

if [ "$DRY_RUN" = false ]; then
  # Pull staging images
  docker pull "${REGISTRY}/${IMAGE_NAME}-backend:staging-latest"
  docker pull "${REGISTRY}/${IMAGE_NAME}-frontend:staging-latest"

  # Tag as production
  docker tag "${REGISTRY}/${IMAGE_NAME}-backend:staging-latest" "${REGISTRY}/${IMAGE_NAME}-backend:production-latest"
  docker tag "${REGISTRY}/${IMAGE_NAME}-frontend:staging-latest" "${REGISTRY}/${IMAGE_NAME}-frontend:production-latest"

  # Push production tags
  docker push "${REGISTRY}/${IMAGE_NAME}-backend:production-latest"
  docker push "${REGISTRY}/${IMAGE_NAME}-frontend:production-latest"

  log_success "Tagged and pushed production images"
else
  log_info "[DRY RUN] Would tag staging images as production"
fi

# Step 5: Deploy production
log_info "Deploying to production..."

if [ "$DRY_RUN" = false ]; then
  cd dokploy
  docker-compose pull
  docker-compose up -d --force-recreate
  cd ..

  log_success "Production containers updated"
else
  log_info "[DRY RUN] Would deploy production containers"
fi

# Step 6: Run migrations
log_info "Running database migrations..."

if [ "$DRY_RUN" = false ]; then
  sleep 10
  docker exec qa-guardian-backend npm run migrate || log_warn "Migrations may have already run"
  log_success "Migrations complete"
else
  log_info "[DRY RUN] Would run migrations"
fi

# Step 7: Health check
log_info "Running production health check..."

if [ "$DRY_RUN" = false ]; then
  sleep 20

  if curl -sf "https://${PRODUCTION_DOMAIN}/health" > /dev/null 2>&1; then
    log_success "Production frontend is healthy"
  else
    log_error "Production frontend health check failed!"
    exit 1
  fi

  if curl -sf "https://${PRODUCTION_DOMAIN}/api/v1/health" > /dev/null 2>&1; then
    log_success "Production API is healthy"
  else
    log_error "Production API health check failed!"
    exit 1
  fi
else
  log_info "[DRY RUN] Would run health checks"
fi

# Summary
echo ""
echo "==========================================="
log_success "Promotion Complete!"
echo "==========================================="
echo ""
echo "Production is now live at:"
echo "  Frontend: https://${PRODUCTION_DOMAIN}"
echo "  API:      https://${PRODUCTION_DOMAIN}/api"
echo "  Health:   https://${PRODUCTION_DOMAIN}/health"
if [ -n "$VERSION" ]; then
  echo "  Version:  v${VERSION}"
fi
echo ""
