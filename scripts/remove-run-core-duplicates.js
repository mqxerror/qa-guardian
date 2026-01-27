#!/usr/bin/env node
/**
 * Script to remove duplicate run core routes from test-runs.ts
 * These routes are already implemented in run-core-routes.ts
 *
 * Feature #1356: Backend file size limit enforcement
 */

const fs = require('fs');
const path = require('path');

const testRunsPath = path.join(__dirname, '../backend/src/routes/test-runs.ts');

// Read the file
const lines = fs.readFileSync(testRunsPath, 'utf-8').split('\n');
const originalLength = lines.length;
console.log(`Original file: ${originalLength} lines`);

// Find route blocks
function findRouteBlock(lines, routePattern, startLine = 0) {
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes(routePattern)) {
      // Found the start, now find the closing });
      let braceCount = 0;
      let routeStarted = false;
      for (let j = i; j < lines.length; j++) {
        const line = lines[j];
        if (!routeStarted && (
            line.includes('app.get') || line.includes('app.post') ||
            line.includes('app.put') || line.includes('app.delete'))) {
          routeStarted = true;
        }
        if (routeStarted) {
          for (const char of line) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
          }
          if (braceCount === 0 && line.trim() === '});') {
            return { start: i, end: j };
          }
        }
      }
    }
  }
  return null;
}

// Routes to remove (from run-core-routes.ts)
const duplicateRoutes = [
  // GET /api/v1/runs/:runId
  { pattern: "app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId',", description: 'GET /runs/:runId' },
  // GET /api/v1/runs/:runId/results (simple)
  { pattern: "app.get<{ Params: TestRunParams; Querystring: GetResultsQuery }>('/api/v1/runs/:runId/results',", description: 'GET /runs/:runId/results' },
  // GET /api/v1/runs/:runId/results/:resultIndex
  { pattern: "app.get<{ Params: ResultDetailsParams }>('/api/v1/runs/:runId/results/:resultIndex',", description: 'GET /runs/:runId/results/:resultIndex' },
  // GET /api/v1/runs/:runId/status
  { pattern: "app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId/status',", description: 'GET /runs/:runId/status' },
  // GET /api/v1/runs/:runId/progress
  { pattern: "app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId/progress',", description: 'GET /runs/:runId/progress' },
  // GET /api/v1/suites/:suiteId/runs
  { pattern: "app.get<{ Params: RunParams }>('/api/v1/suites/:suiteId/runs',", description: 'GET /suites/:suiteId/runs' },
  // GET /api/v1/tests/:testId/runs
  { pattern: "app.get<{ Params: TestIdParams }>('/api/v1/tests/:testId/runs',", description: 'GET /tests/:testId/runs' },
];

const linesToRemove = new Set();

for (const route of duplicateRoutes) {
  // Search for the pattern
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(route.pattern)) {
      // Find the end of this route
      let braceCount = 0;
      let routeStarted = false;
      let endLine = i;

      for (let j = i; j < lines.length; j++) {
        const line = lines[j];
        if (line.includes('app.get') || line.includes('app.post')) {
          routeStarted = true;
        }
        if (routeStarted) {
          for (const char of line) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
          }
          if (braceCount === 0 && line.trim() === '});') {
            endLine = j;
            break;
          }
        }
      }

      // Look for comment above
      let commentStart = i;
      for (let k = i - 1; k >= Math.max(0, i - 10); k--) {
        const trimmed = lines[k].trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('interface') || trimmed === '') {
          commentStart = k;
        } else {
          break;
        }
      }

      console.log(`Marking for removal: lines ${commentStart + 1}-${endLine + 1} (${route.description})`);
      for (let m = commentStart; m <= endLine; m++) {
        linesToRemove.add(m);
      }
      break; // Found this route, move to next
    }
  }
}

// Create new content
const newLines = lines.filter((_, index) => !linesToRemove.has(index));

console.log(`\nLines marked for removal: ${linesToRemove.size}`);
console.log(`New file size: ${newLines.length} lines`);
console.log(`Reduction: ${originalLength - newLines.length} lines`);

// Write the result
fs.writeFileSync(testRunsPath, newLines.join('\n'));
console.log('\nFile updated successfully!');
