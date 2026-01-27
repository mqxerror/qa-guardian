#!/usr/bin/env node
/**
 * Script to remove duplicate baseline routes from test-runs.ts
 * These routes are already implemented in baseline-routes.ts
 *
 * Feature #1356: Backend file size limit enforcement
 */

const fs = require('fs');
const path = require('path');

const testRunsPath = path.join(__dirname, '../backend/src/routes/test-runs.ts');

// Read the file
let content = fs.readFileSync(testRunsPath, 'utf-8');
const originalLength = content.split('\n').length;
console.log(`Original file: ${originalLength} lines`);

// Define route patterns to remove (these are duplicates of baseline-routes.ts)
// Each pattern includes a start marker and end marker

const routesToRemove = [
  {
    name: 'GET /api/v1/tests/:testId/baseline',
    startPattern: "  // Get baseline image for a test\n  app.get<{ Params: { testId: string }; Querystring: { viewport?: string; branch?: string } }>('/api/v1/tests/:testId/baseline', {",
    // This route ends with the HEAD route that follows
    endMarker: "  });",
    // We need to find the route that ends before the HEAD route or before history
  },
];

// Strategy: Remove specific blocks identified by line numbers
// Based on analysis:
// - Lines 9420-9601: GET and HEAD for /api/v1/tests/:testId/baseline
// - Lines 9603-9895: All history routes (4 routes)

// Read content as lines
const lines = content.split('\n');

// Find the routes by searching for unique markers
function findRouteBlock(lines, routePattern, startLine = 0) {
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes(routePattern)) {
      // Found the start, now find the closing });
      let braceCount = 0;
      let inRoute = false;
      for (let j = i; j < lines.length; j++) {
        const line = lines[j];
        if (line.includes('app.get<') || line.includes('app.post<') ||
            line.includes('app.put<') || line.includes('app.delete<') ||
            line.includes('app.head<') || line.includes('app.patch<')) {
          inRoute = true;
        }
        if (inRoute) {
          // Count braces to find route end
          for (const char of line) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
          }
          // Route ends when braces balance and we see });
          if (braceCount === 0 && line.trim() === '});') {
            return { start: i, end: j };
          }
        }
      }
    }
  }
  return null;
}

// Routes to remove with their markers
const duplicateRoutes = [
  { marker: "'/api/v1/tests/:testId/baseline',", skip: 0 }, // GET
  { marker: "'/api/v1/tests/:testId/baseline',", skip: 1 }, // HEAD (second occurrence)
  { marker: "'/api/v1/tests/:testId/baseline/history',", skip: 0 },
  { marker: "'/api/v1/tests/:testId/baseline/history/:historyId',", skip: 0 },
  { marker: "'/api/v1/tests/:testId/baseline/history/:historyId/compare',", skip: 0 },
  { marker: "'/api/v1/tests/:testId/baseline/history/:historyId/restore',", skip: 0 },
];

// Track lines to remove
const linesToRemove = new Set();

// For each route, find and mark for removal
for (const route of duplicateRoutes) {
  let skipCount = route.skip;
  let startSearch = 0;

  while (skipCount >= 0) {
    const found = findRouteBlock(lines, route.marker, startSearch);
    if (found) {
      if (skipCount === 0) {
        // Mark these lines for removal (including any comment before)
        let commentStart = found.start;
        // Look for comment above the route
        for (let k = found.start - 1; k >= Math.max(0, found.start - 5); k--) {
          const trimmed = lines[k].trim();
          if (trimmed.startsWith('//') || trimmed === '') {
            commentStart = k;
          } else {
            break;
          }
        }
        console.log(`Marking for removal: lines ${commentStart + 1}-${found.end + 1} (${route.marker})`);
        for (let i = commentStart; i <= found.end; i++) {
          linesToRemove.add(i);
        }
        break;
      }
      skipCount--;
      startSearch = found.end + 1;
    } else {
      console.log(`Warning: Could not find route: ${route.marker} (skip=${route.skip})`);
      break;
    }
  }
}

// Create new content without removed lines
const newLines = lines.filter((_, index) => !linesToRemove.has(index));

console.log(`\nLines marked for removal: ${linesToRemove.size}`);
console.log(`New file size: ${newLines.length} lines`);
console.log(`Reduction: ${originalLength - newLines.length} lines`);

// Write the result
fs.writeFileSync(testRunsPath, newLines.join('\n'));
console.log('\nFile updated successfully!');
