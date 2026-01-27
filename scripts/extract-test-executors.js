// Script to analyze and report on test-runs.ts structure for extraction planning
const fs = require('fs');
const path = require('path');

const testRunsPath = path.join(__dirname, '../backend/src/routes/test-runs.ts');
const content = fs.readFileSync(testRunsPath, 'utf8');
const lines = content.split('\n');

console.log('=== test-runs.ts Structure Analysis ===');
console.log('Total lines:', lines.length);
console.log('');

// Find the main sections
let executeTestStart = -1;
let executeTestEnd = -1;
let runTestsForRunStart = -1;
let runTestsForRunEnd = -1;
let routesStart = -1;

// Track function depth to find function boundaries
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.includes('async function executeTest(')) {
    executeTestStart = i + 1; // 1-indexed
    console.log(`executeTest starts at line: ${executeTestStart}`);
  }

  if (line.includes('export async function runTestsForRun(')) {
    runTestsForRunStart = i + 1;
    console.log(`runTestsForRun starts at line: ${runTestsForRunStart}`);
    // executeTest ends just before this
    executeTestEnd = i; // 0-indexed line before
    console.log(`executeTest ends around line: ${executeTestEnd}`);
  }

  if (line.includes('export async function testRunRoutes(')) {
    routesStart = i + 1;
    console.log(`testRunRoutes starts at line: ${routesStart}`);
    runTestsForRunEnd = i;
  }
}

// Find test type branches
console.log('');
console.log('=== Test Type Branches in executeTest ===');

const testTypeBranches = [];
for (let i = executeTestStart - 1; i < executeTestEnd; i++) {
  const line = lines[i];

  if (line.includes("test.test_type === '")) {
    const match = line.match(/test\.test_type === '([^']+)'/);
    if (match) {
      testTypeBranches.push({
        type: match[1],
        line: i + 1,
        context: line.trim().substring(0, 80)
      });
    }
  }

  if (line.includes("test_type === '") && line.includes('if (')) {
    const match = line.match(/test_type === '([^']+)'/);
    if (match) {
      testTypeBranches.push({
        type: match[1],
        line: i + 1,
        context: line.trim().substring(0, 80)
      });
    }
  }
}

testTypeBranches.forEach(b => {
  console.log(`Line ${b.line}: ${b.type} - ${b.context}`);
});

// Calculate sizes
console.log('');
console.log('=== Section Sizes ===');
const executeTestLines = executeTestEnd - executeTestStart;
const runTestsForRunLines = runTestsForRunEnd - runTestsForRunStart;
const routesLines = lines.length - routesStart;
const importsLines = executeTestStart - 1;

console.log(`Imports/Re-exports: ${importsLines} lines (1-${executeTestStart})`);
console.log(`executeTest function: ~${executeTestLines} lines (${executeTestStart}-${executeTestEnd})`);
console.log(`runTestsForRun function: ~${runTestsForRunLines} lines (${runTestsForRunStart}-${runTestsForRunEnd})`);
console.log(`testRunRoutes registration: ~${routesLines} lines (${routesStart}-${lines.length})`);

// Recommendation
console.log('');
console.log('=== Recommended Extraction Strategy ===');
console.log('1. Extract executeTest function to ./test-runs/test-executor.ts');
console.log('2. Extract runTestsForRun function to ./test-runs/run-orchestrator.ts');
console.log('3. Keep only imports, re-exports, and route registration in test-runs.ts');
console.log('');
console.log('Target: test-runs.ts should be ~500-600 lines (imports + route registration)');
