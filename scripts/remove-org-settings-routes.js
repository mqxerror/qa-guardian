#!/usr/bin/env node
/**
 * Script to remove duplicate organization settings routes from test-runs.ts
 * These routes are now in test-runs/organization-settings.ts
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backend/src/routes/test-runs.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`Original file has ${lines.length} lines`);

// Find the start and end of the organization settings routes section
// Start: "// Get artifact retention policy for organization"
// End: "// ========== ALERT CHANNEL, WEBHOOK, AND SLACK ROUTES =========="

let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Get artifact retention policy for organization')) {
    startLine = i;
    console.log(`Found start at line ${i + 1}: ${lines[i].substring(0, 60)}...`);
  }
  if (lines[i].includes('// ========== ALERT CHANNEL, WEBHOOK, AND SLACK ROUTES ==========')) {
    endLine = i;
    console.log(`Found end at line ${i + 1}: ${lines[i].substring(0, 60)}...`);
    break;
  }
}

if (startLine === -1 || endLine === -1) {
  console.error('Could not find start or end markers');
  console.error(`startLine: ${startLine}, endLine: ${endLine}`);
  process.exit(1);
}

// Calculate lines to remove
const linesToRemove = endLine - startLine;
console.log(`Will remove ${linesToRemove} lines (${startLine + 1} to ${endLine})`);

// Remove the lines
const newLines = [
  ...lines.slice(0, startLine),
  '',
  '  // Feature #1356: Organization settings routes moved to ./test-runs/organization-settings.ts',
  '  // Routes: /api/v1/organizations/:orgId/artifact-retention, diff-colors, artifact-cleanup, storage',
  '  // Registered via organizationSettingsRoutes(app) at end of this function.',
  '',
  ...lines.slice(endLine)
];

// Write the file
fs.writeFileSync(filePath, newLines.join('\n'));

console.log(`New file has ${newLines.length} lines`);
console.log(`Removed ${lines.length - newLines.length} lines`);
