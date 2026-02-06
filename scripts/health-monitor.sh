#!/bin/ash
# =============================================================================
# QA Guardian - Health Monitor Watchdog
# =============================================================================
# Feature #170: External uptime monitoring
#
# Polls the backend health endpoint at regular intervals and sends
# Discord/Slack webhook alerts on outage detection and recovery.
#
# Environment Variables:
#   HEALTH_CHECK_URL      - URL to poll (default: http://backend:3001/health)
#   HEALTH_CHECK_INTERVAL - Seconds between checks (default: 300 = 5 minutes)
#   ALERT_WEBHOOK_URL     - Discord/Slack webhook URL for alerts (optional)
#   ALERT_THRESHOLD       - Consecutive failures before alerting (default: 2)
#   SERVICE_NAME          - Name to show in alerts (default: QA Guardian)
#
# Usage:
#   ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/xxx ./health-monitor.sh
#
# Docker:
#   Designed to run in an alpine/curl container alongside the backend.
# =============================================================================

# NOTE: No "set -e" here. A monitoring script must survive transient failures
# (e.g. curl returning non-zero when the target is down). Exiting on the first
# failure would defeat the purpose of a watchdog.

# Configuration with defaults
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://backend:3001/health}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-300}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-2}"
SERVICE_NAME="${SERVICE_NAME:-QA Guardian}"
CURL_TIMEOUT="${CURL_TIMEOUT:-10}"

# State tracking
CONSECUTIVE_FAILURES=0
IS_DOWN=false
LAST_CHECK_TIME=""
LAST_ERROR=""
DOWN_SINCE=""

log_info() {
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "${TIMESTAMP} [INFO] $1"
}

log_warn() {
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "${TIMESTAMP} [WARN] $1" >&2
}

log_error() {
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "${TIMESTAMP} [ERROR] $1" >&2
}

# Escape special characters for safe JSON embedding.
# Handles backslashes, double quotes, tabs, and collapses newlines to spaces.
json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr '\n' ' '
}

# Validate configuration and log startup banner
validate_config() {
    if [ -z "$ALERT_WEBHOOK_URL" ]; then
        log_warn "ALERT_WEBHOOK_URL not set - running in log-only mode (no alerts will be sent)"
        ALERT_WEBHOOK_URL=""
    fi

    log_info "====================================="
    log_info "Health Monitor Watchdog Starting"
    log_info "====================================="
    log_info "Target URL: $HEALTH_CHECK_URL"
    log_info "Check interval: ${HEALTH_CHECK_INTERVAL}s"
    log_info "Alert threshold: $ALERT_THRESHOLD consecutive failures"
    log_info "Service name: $SERVICE_NAME"
    if [ -z "$ALERT_WEBHOOK_URL" ]; then
        log_info "Alert mode: LOG ONLY (no webhook configured)"
    else
        log_info "Alert mode: WEBHOOK"
    fi
    log_info "====================================="
}

# Send Discord/Slack webhook notification
# Args: $1=status  $2=message  $3=color (hex string, e.g. "FF0000")
send_alert() {
    local status="$1"
    local message="$2"
    local color="$3"
    local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    # In log-only mode (no webhook URL), just log the alert and return
    if [ -z "$ALERT_WEBHOOK_URL" ]; then
        log_info "Alert (log-only): $status - $message"
        return
    fi

    # Escape values that will be interpolated into the JSON payload
    message=$(json_escape "$message")
    local safe_service=$(json_escape "$SERVICE_NAME")
    local safe_url=$(json_escape "$HEALTH_CHECK_URL")

    # Determine if Discord or Slack based on URL
    if echo "$ALERT_WEBHOOK_URL" | grep -q "discord"; then
        # Discord expects color as a decimal integer
        local decimal_color=$(printf '%d' "0x${color}")

        # Discord embed format
        local payload=$(cat <<EOF
{
    "embeds": [{
        "title": "${safe_service} ${status}",
        "description": "${message}",
        "color": ${decimal_color},
        "timestamp": "${timestamp}",
        "footer": {
            "text": "Health Monitor Watchdog"
        },
        "fields": [
            {
                "name": "Service",
                "value": "${safe_service}",
                "inline": true
            },
            {
                "name": "Endpoint",
                "value": "${safe_url}",
                "inline": true
            }
        ]
    }]
}
EOF
)
    else
        # Slack format -- color is a hex string with "#" prefix
        local emoji="🚨"
        if [ "$status" = "RECOVERED" ]; then
            emoji="✅"
        fi
        local payload=$(cat <<EOF
{
    "text": "${emoji} *${safe_service} ${status}*",
    "attachments": [{
        "color": "#${color}",
        "text": "${message}",
        "fields": [
            {
                "title": "Endpoint",
                "value": "${safe_url}",
                "short": true
            },
            {
                "title": "Time",
                "value": "${timestamp}",
                "short": true
            }
        ]
    }]
}
EOF
)
    fi

    # Send the webhook (suppress output, log errors)
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$ALERT_WEBHOOK_URL" 2>&1)

    if [ "$RESPONSE" = "204" ] || [ "$RESPONSE" = "200" ]; then
        log_info "Alert sent successfully: $status"
    else
        log_warn "Failed to send alert (HTTP $RESPONSE)"
    fi
}

# Send outage alert
send_outage_alert() {
    local error_msg="$1"
    local duration=""

    if [ -n "$DOWN_SINCE" ]; then
        # DOWN_SINCE is already epoch seconds -- no date -d needed
        local now=$(date +%s)
        local diff=$((now - DOWN_SINCE))
        local minutes=$((diff / 60))
        duration=" (down for ${minutes} minutes)"
    fi

    send_alert "DOWN" "Health check failed after $CONSECUTIVE_FAILURES consecutive attempts.${duration}\\n\\nError: ${error_msg}" "FF0000"
}

# Send recovery alert
send_recovery_alert() {
    local downtime=""

    if [ -n "$DOWN_SINCE" ]; then
        # DOWN_SINCE is already epoch seconds -- no date -d needed
        local now=$(date +%s)
        local diff=$((now - DOWN_SINCE))
        local minutes=$((diff / 60))
        downtime="\\n\\nTotal downtime: ${minutes} minutes"
    fi

    send_alert "RECOVERED" "Service is back online and responding to health checks.${downtime}" "00FF00"
}

# Perform health check
check_health() {
    local start_time=$(date +%s)

    # Perform the health check with timeout
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout "$CURL_TIMEOUT" \
        --max-time "$CURL_TIMEOUT" \
        "$HEALTH_CHECK_URL" 2>&1)

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    LAST_CHECK_TIME=$(date '+%Y-%m-%d %H:%M:%S')

    if [ "$RESPONSE" = "200" ]; then
        # Success!
        if [ "$IS_DOWN" = true ]; then
            # We were down, now recovered
            log_info "Health check PASSED (recovered after $CONSECUTIVE_FAILURES failures)"
            send_recovery_alert
            IS_DOWN=false
            DOWN_SINCE=""
        else
            log_info "Health check PASSED (${duration}s)"
        fi
        CONSECUTIVE_FAILURES=0
        LAST_ERROR=""
    else
        # Failure
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        LAST_ERROR="HTTP $RESPONSE (or connection failed)"

        log_warn "Health check FAILED (attempt $CONSECUTIVE_FAILURES): $LAST_ERROR"

        # Check if we should alert
        if [ "$CONSECUTIVE_FAILURES" -ge "$ALERT_THRESHOLD" ] && [ "$IS_DOWN" = false ]; then
            IS_DOWN=true
            DOWN_SINCE=$(date +%s)
            log_error "ALERT: Service is DOWN after $CONSECUTIVE_FAILURES consecutive failures"
            send_outage_alert "$LAST_ERROR"
        fi
    fi
}

# Main loop
main() {
    validate_config

    log_info "Starting health check loop..."

    # Initial check immediately
    check_health

    # Continuous monitoring
    while true; do
        sleep "$HEALTH_CHECK_INTERVAL"
        check_health
    done
}

# Handle graceful shutdown
cleanup() {
    log_info "Shutting down health monitor..."
    exit 0
}

trap cleanup SIGTERM SIGINT

# Run main
main
