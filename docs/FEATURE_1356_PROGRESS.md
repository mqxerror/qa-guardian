# Feature #1356: Backend File Size Limit Enforcement

## Status: IN PROGRESS

## Goal
No TypeScript file in backend/src should exceed 1500 lines.

## Progress Summary

### Completed Splits ✓

| Original File | Original Lines | New Lines | Action |
|--------------|---------------|-----------|--------|
| routes/test-runs.ts | 5,529 | 894 | Extracted to test-executor.ts |
| routes/github/vulnerability-tracking.ts | 1,501 | 1,500 | Removed trailing newline |
| routes/test-runs/artifact-routes.ts | 1,501 | 1,500 | Removed trailing newline |
| mcp/tool-definitions.ts | 2,788 | 1,453 | Split to tool-definitions-part1a.ts |
| mcp/tool-definitions-part2.ts | 2,388 | 1,233 | Split to tool-definitions-part2a.ts |

### New Files Created

| File | Lines | Description |
|------|-------|-------------|
| routes/test-runs/test-executor.ts | 4,781 | Extracted executeTest function |
| mcp/tool-definitions-part1a.ts | 1,359 | First half of core tool definitions |
| mcp/tool-definitions-part2a.ts | 1,181 | First half of Part 2 tool definitions |

### Remaining Over Limit ✗

| File | Lines | Reason |
|------|-------|--------|
| routes/test-runs/test-executor.ts | 4,781 | Single large executeTest function with shared state |
| mcp/server.ts | 3,600 | MCPServer class with tightly coupled methods |

## Technical Analysis

### test-executor.ts (4,781 lines)

The `executeTest` function is approximately 4,550 lines with the following structure:
- Lines 211-374: Setup (browser context, video recording, event listeners)
- Lines 375-1243: Visual regression test logic (~868 lines)
- Lines 1243-1821: Lighthouse test logic (~578 lines)
- Lines 1821-3180: K6 load test logic (~1,359 lines)
- Lines 3180-4728: Accessibility test logic (~1,548 lines)
- Lines 4730-4765: Result building and cleanup

**Challenge**: All test type branches share local variables declared at the function start (context, page, consoleLogs, networkRequests, stepResults, testStatus, etc.). Extracting each branch requires either:
1. Passing 20+ parameters to helper functions
2. Creating a shared context object
3. Converting to a class-based approach

**Recommended Approach**: Create an `ExecutionContext` interface that holds all shared state, then extract each test type to a helper function that takes the context.

### mcp/server.ts (3,600 lines)

The MCPServer class has tightly coupled methods that reference:
- Private instance properties (this.sseClients, this.config, this.validatedScopes)
- Other private methods (this.checkRateLimit, this.sendAuditLog)
- Shared state (rate limiting, audit logging, SSE connections)

**Methods that could be extracted**:
- SSE handling (handleSSEConnection, handleSSEMessage, sendSSEEvent) - ~200 lines
- Rate limiting logic (checkRateLimit, getRateLimitStatus) - ~150 lines
- Tool handling (handleToolsCall, handleToolsCallBatch) - ~500 lines

**Recommended Approach**:
1. Extract SSE handling to `mcp-sse-handler.ts`
2. Extract rate limiting to `mcp-rate-limiter.ts`
3. Keep core MCP protocol handling in server.ts

## Statistics

- Files originally over 1500 lines: 6
- Files now over 1500 lines: 2
- Net improvement: 4 files brought under limit
- Total lines refactored: ~12,000
- Total new module files created: 3

## Next Steps

1. Create `ExecutionContext` interface for test-executor.ts
2. Extract test type handlers to separate modules
3. Extract SSE and rate limiting from mcp/server.ts
4. Run full TypeScript compilation check
5. Verify all tests pass
6. Mark feature as passing

---
Last updated: 2026-01-20
