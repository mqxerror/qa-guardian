#!/bin/bash
# Test script for Feature #312: Auth middleware on AI test generator routes
# This script verifies that unauthenticated requests return 401

echo "Testing Feature #312: Auth middleware on AI test generator routes"
echo "================================================================="
echo ""

BASE_URL="${BASE_URL:-http://localhost:3001}"

# Test endpoints that should require authentication
ENDPOINTS=(
  "GET /api/v1/ai/generation-history"
  "GET /api/v1/ai/review-queue"
  "GET /api/v1/ai/approval-stats"
  "GET /api/v1/ai/generation-history/versions?description=test"
)

ALL_PASSED=true

for endpoint in "${ENDPOINTS[@]}"; do
  METHOD=$(echo "$endpoint" | cut -d' ' -f1)
  PATH=$(echo "$endpoint" | cut -d' ' -f2)

  echo "Testing: $endpoint"

  # Make unauthenticated request
  RESPONSE=$(curl -s -w "\n%{http_code}" -X "$METHOD" "$BASE_URL$PATH" -H "Content-Type: application/json" 2>/dev/null)
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [ "$HTTP_CODE" = "401" ]; then
    echo "  ✓ PASS: Returns 401 Unauthorized as expected"
  else
    echo "  ✗ FAIL: Expected 401, got $HTTP_CODE"
    echo "  Response: $BODY"
    ALL_PASSED=false
  fi
  echo ""
done

# Test POST endpoints
echo "Testing: POST /api/v1/ai/generation-history"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/ai/generation-history" \
  -H "Content-Type: application/json" \
  -d '{"description":"test","generated_code":"test","test_name":"test","language":"typescript","confidence_score":0.9}' 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "  ✓ PASS: Returns 401 Unauthorized as expected"
else
  echo "  ✗ FAIL: Expected 401, got $HTTP_CODE"
  ALL_PASSED=false
fi
echo ""

echo "Testing: POST /api/v1/ai/parse-intent"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/ai/parse-intent" \
  -H "Content-Type: application/json" \
  -d '{"text":"create a login test"}' 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "  ✓ PASS: Returns 401 Unauthorized as expected"
else
  echo "  ✗ FAIL: Expected 401, got $HTTP_CODE"
  ALL_PASSED=false
fi
echo ""

echo "================================================================="
if [ "$ALL_PASSED" = true ]; then
  echo "All tests PASSED! Feature #312 is working correctly."
  exit 0
else
  echo "Some tests FAILED. Please review the output above."
  exit 1
fi
