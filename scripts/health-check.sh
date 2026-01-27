#!/bin/bash
# =============================================================================
# QA Guardian - Health Check Script
# =============================================================================
# Verifies all services are healthy before deployment completes
#
# Usage:
#   ./scripts/health-check.sh                     # Check all services
#   ./scripts/health-check.sh --backend-only      # Check backend only
#   ./scripts/health-check.sh --frontend-only     # Check frontend only
#   ./scripts/health-check.sh --timeout 60        # Custom timeout (seconds)
#
# Exit codes:
#   0 - All services healthy
#   1 - One or more services unhealthy
# =============================================================================

set -euo pipefail

# Configuration
DOMAIN="${DOMAIN:-qa.pixelcraftedmedia.com}"
BACKEND_URL="${BACKEND_URL:-https://${DOMAIN}/api/v1}"
FRONTEND_URL="${FRONTEND_URL:-https://${DOMAIN}}"
MCP_URL="${MCP_URL:-https://${DOMAIN}/api/v1/mcp}"
TIMEOUT="${TIMEOUT:-30}"
CHECK_INTERVAL=5
MAX_RETRIES=$((TIMEOUT / CHECK_INTERVAL))

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging
log_info() { echo -e "[INFO] $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Parse arguments
CHECK_BACKEND=true
CHECK_FRONTEND=true
CHECK_MCP=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --backend-only)
      CHECK_FRONTEND=false
      CHECK_MCP=false
      shift
      ;;
    --frontend-only)
      CHECK_BACKEND=false
      CHECK_MCP=false
      shift
      ;;
    --timeout)
      TIMEOUT=$2
      MAX_RETRIES=$((TIMEOUT / CHECK_INTERVAL))
      shift 2
      ;;
    --help|-h)
      echo "Health Check Script"
      echo ""
      echo "Usage:"
      echo "  ./scripts/health-check.sh              Check all services"
      echo "  ./scripts/health-check.sh --backend-only   Check backend only"
      echo "  ./scripts/health-check.sh --frontend-only  Check frontend only"
      echo "  ./scripts/health-check.sh --timeout 60     Custom timeout"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "==========================================="
echo "    QA Guardian - Health Check"
echo "==========================================="
echo "  Domain:  ${DOMAIN}"
echo "  Timeout: ${TIMEOUT}s"
echo "==========================================="
echo ""

# Track overall status
ALL_HEALTHY=true

# Check Backend Health
check_backend() {
  log_info "Checking backend health..."

  local attempt=1
  while [ $attempt -le $MAX_RETRIES ]; do
    local response=$(curl -sf "${BACKEND_URL}/health" 2>/dev/null || echo "")

    if [ -n "$response" ]; then
      local status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
      local uptime=$(echo "$response" | grep -o '"uptime":[0-9.]*' | cut -d':' -f2 | cut -d'.' -f1)

      if [ "$status" = "ok" ] || [ "$status" = "degraded" ]; then
        log_success "Backend healthy (status: $status, uptime: ${uptime}s)"
        return 0
      fi
    fi

    echo -n "  Attempt $attempt/$MAX_RETRIES..."
    sleep $CHECK_INTERVAL
    ((attempt++))
  done

  log_fail "Backend health check failed after ${TIMEOUT}s"
  ALL_HEALTHY=false
  return 1
}

# Check Frontend Health
check_frontend() {
  log_info "Checking frontend health..."

  local attempt=1
  while [ $attempt -le $MAX_RETRIES ]; do
    local response=$(curl -sf "${FRONTEND_URL}/health" 2>/dev/null || echo "")

    if [ -n "$response" ]; then
      local status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

      if [ "$status" = "ok" ]; then
        log_success "Frontend healthy"
        return 0
      fi
    fi

    echo -n "  Attempt $attempt/$MAX_RETRIES..."
    sleep $CHECK_INTERVAL
    ((attempt++))
  done

  log_fail "Frontend health check failed after ${TIMEOUT}s"
  ALL_HEALTHY=false
  return 1
}

# Check MCP Status
check_mcp() {
  log_info "Checking MCP status..."

  local attempt=1
  while [ $attempt -le $MAX_RETRIES ]; do
    local response=$(curl -sf "${MCP_URL}/status" 2>/dev/null || echo "")

    if [ -n "$response" ]; then
      # MCP is available if we get any JSON response
      log_success "MCP endpoint responding"
      return 0
    fi

    echo -n "  Attempt $attempt/$MAX_RETRIES..."
    sleep $CHECK_INTERVAL
    ((attempt++))
  done

  log_warn "MCP status check timed out (AI features may be unavailable)"
  # MCP is optional, so don't fail the whole check
  return 0
}

# Run health checks
if [ "$CHECK_BACKEND" = true ]; then
  check_backend || true
fi

if [ "$CHECK_FRONTEND" = true ]; then
  check_frontend || true
fi

if [ "$CHECK_MCP" = true ]; then
  check_mcp || true
fi

# Summary
echo ""
echo "==========================================="
if [ "$ALL_HEALTHY" = true ]; then
  log_success "All health checks passed!"
  echo "==========================================="
  exit 0
else
  log_fail "One or more health checks failed"
  echo "==========================================="
  exit 1
fi
