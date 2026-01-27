#!/usr/bin/env node
/**
 * Script to remove duplicate run control routes from test-runs.ts
 * These routes are already implemented in run-control-routes.ts
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

// Routes to remove (from run-control-routes.ts)
const duplicateRoutes = [
  // POST /api/v1/runs/:runId/cancel
  { pattern: "'/api/v1/runs/:runId/cancel',", method: 'post', description: 'POST /runs/:runId/cancel' },
  // POST /api/v1/runs/:runId/pause
  { pattern: "'/api/v1/runs/:runId/pause',", method: 'post', description: 'POST /runs/:runId/pause' },
  // POST /api/v1/runs/:runId/resume
  { pattern: "'/api/v1/runs/:runId/resume',", method: 'post', description: 'POST /runs/:runId/resume' },
  // GET /api/v1/runs/queue-status
  { pattern: "'/api/v1/runs/queue-status',", method: 'get', description: 'GET /runs/queue-status' },
  // POST /api/v1/runs/:runId/prioritize
  { pattern: "'/api/v1/runs/:runId/prioritize',", method: 'post', description: 'POST /runs/:runId/prioritize' },
  // GET /api/v1/runs/:runId/priority
  { pattern: "'/api/v1/runs/:runId/priority',", method: 'get', description: 'GET /runs/:runId/priority' },
];

const linesToRemove = new Set();

for (const route of duplicateRoutes) {
  // Search for the pattern
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(route.pattern)) {
      // Check if this is the right method
      const methodCheck = route.method === 'post' ? 'app.post' : 'app.get';
      if (!lines[i].includes(methodCheck)) continue;

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
