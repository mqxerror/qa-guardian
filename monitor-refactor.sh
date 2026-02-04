#!/bin/bash
# Monitor refactoring progress until all files are under 1500 lines

LOG_FILE="/Users/mqxerrormac16/Documents/QA-Dam3oun/refactor-monitor.log"
TARGET=1500

echo "=== Refactoring Monitor Started: $(date) ===" > "$LOG_FILE"

while true; do
    # Check if agent is still running
    AGENT_PID=$(pgrep -f "autonomous_agent_demo.*QA-Dam3oun")

    # Get current line counts
    TRRESULT=$(wc -l < /Users/mqxerrormac16/Documents/QA-Dam3oun/frontend/src/pages/TestRunResultPage.tsx 2>/dev/null || echo "0")
    MONITOR=$(wc -l < /Users/mqxerrormac16/Documents/QA-Dam3oun/frontend/src/pages/MonitoringPage.tsx 2>/dev/null || echo "0")
    TESTDET=$(wc -l < /Users/mqxerrormac16/Documents/QA-Dam3oun/frontend/src/pages/TestDetailPage.tsx 2>/dev/null || echo "0")
    PROJDET=$(wc -l < /Users/mqxerrormac16/Documents/QA-Dam3oun/frontend/src/pages/ProjectDetailPage.tsx 2>/dev/null || echo "0")
    TESTSUITE=$(wc -l < /Users/mqxerrormac16/Documents/QA-Dam3oun/frontend/src/pages/TestSuitePage.tsx 2>/dev/null || echo "0")

    TOTAL=$((TRRESULT + MONITOR + TESTDET + PROJDET + TESTSUITE))

    # Count how many are under target
    DONE=0
    [ "$TRRESULT" -lt "$TARGET" ] && DONE=$((DONE + 1))
    [ "$MONITOR" -lt "$TARGET" ] && DONE=$((DONE + 1))
    [ "$TESTDET" -lt "$TARGET" ] && DONE=$((DONE + 1))
    [ "$PROJDET" -lt "$TARGET" ] && DONE=$((DONE + 1))
    [ "$TESTSUITE" -lt "$TARGET" ] && DONE=$((DONE + 1))

    # Get feature status
    PASSING=$(sqlite3 /Users/mqxerrormac16/Documents/QA-Dam3oun/features.db "SELECT SUM(passes) FROM features;" 2>/dev/null || echo "?")

    echo "[$(date '+%H:%M:%S')] Features: $PASSING/50 | Files under 1500: $DONE/5 | Lines: TR=$TRRESULT MO=$MONITOR TD=$TESTDET PD=$PROJDET TS=$TESTSUITE | Total=$TOTAL" >> "$LOG_FILE"

    # Check if all done
    if [ "$DONE" -eq 5 ]; then
        echo "=== ALL FILES UNDER 1500 LINES! Refactoring Complete: $(date) ===" >> "$LOG_FILE"
        break
    fi

    # Check if agent stopped
    if [ -z "$AGENT_PID" ]; then
        echo "=== AGENT STOPPED at $(date) - Files under 1500: $DONE/5 ===" >> "$LOG_FILE"
        break
    fi

    sleep 60
done

echo "=== Monitor Finished: $(date) ===" >> "$LOG_FILE"
