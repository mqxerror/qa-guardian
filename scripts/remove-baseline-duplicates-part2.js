#!/usr/bin/env node
/**
 * Script to remove more duplicate baseline routes from test-runs.ts
 * Part 2: DELETE baseline, GET branches, and failed-uploads routes
 *
 * Feature #1356: Backend file size limit enforcement
 */

const fs = require('fs');
const path = require('path');

const testRunsPath = path.join(__dirname, '../backend/src/routes/test-runs.ts');

// Read the file
let content = fs.readFileSync(testRunsPath, 'utf-8');
const lines = content.split('\n');
const originalLength = lines.length;
console.log(`Original file: ${originalLength} lines`);

// Find route blocks
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
            line.includes('app.head<') || line.includes('app.patch<') ||
            line.includes("app.get('") || line.includes("app.post('")) {
          inRoute = true;
        }
        if (inRoute) {
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

// Routes to remove
const duplicateRoutes = [
  // DELETE baseline - this was at line 10195 before first removal
  { marker: "'/api/v1/tests/:testId/baseline',", method: 'delete', description: 'DELETE baseline' },
  // GET branches
  { marker: "'/api/v1/tests/:testId/baseline/branches',", description: 'GET baseline/branches' },
  // Failed uploads routes
  { marker: "'/api/v1/visual/failed-uploads',", method: 'get', description: 'GET failed-uploads' },
  { marker: "'/api/v1/visual/failed-uploads/:uploadId/retry',", description: 'POST failed-uploads retry' },
  { marker: "'/api/v1/visual/failed-uploads/:uploadId',", method: 'delete', description: 'DELETE failed-uploads' },
];

const linesToRemove = new Set();

for (const route of duplicateRoutes) {
  let startSearch = 0;
  let found = null;

  // Search through the file
  for (let i = startSearch; i < lines.length; i++) {
    if (lines[i].includes(route.marker)) {
      // Check if it matches the method if specified
      if (route.method) {
        if (route.method === 'delete' && !lines[i].includes('app.delete')) continue;
        if (route.method === 'get' && !lines[i].includes('app.get')) continue;
      }

      // Found it, now find the end
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
            found = { start: i, end: j };
            break;
          }
        }
      }
      if (found) break;
    }
  }

  if (found) {
    // Look for comment above
    let commentStart = found.start;
    for (let k = found.start - 1; k >= Math.max(0, found.start - 5); k--) {
      const trimmed = lines[k].trim();
      if (trimmed.startsWith('//') || trimmed === '') {
        commentStart = k;
      } else {
        break;
      }
    }
    console.log(`Marking for removal: lines ${commentStart + 1}-${found.end + 1} (${route.description})`);
    for (let i = commentStart; i <= found.end; i++) {
      linesToRemove.add(i);
    }
  } else {
    console.log(`Warning: Could not find route: ${route.description}`);
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
