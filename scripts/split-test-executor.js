// Script to split test-executor.ts by test type
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backend/src/routes/test-runs/test-executor.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('test-executor.ts has', lines.length, 'lines');

// Find the test type branch locations
const branches = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes("test.test_type === 'visual_regression'")) {
    branches.push({ type: 'visual_regression', start: i });
  }
  if (line.includes("} else if (test.test_type === 'lighthouse'")) {
    branches.push({ type: 'lighthouse', start: i });
  }
  if (line.includes("} else if (test.test_type === 'load'")) {
    branches.push({ type: 'load', start: i });
  }
  if (line.includes("} else if (test.test_type === 'accessibility'")) {
    branches.push({ type: 'accessibility', start: i });
  }
}

console.log('Found test type branches:');
branches.forEach(b => console.log('  -', b.type, 'at line', b.start + 1));

// Calculate sizes
for (let i = 0; i < branches.length - 1; i++) {
  const size = branches[i + 1].start - branches[i].start;
  console.log('  ', branches[i].type, ':', size, 'lines');
}
console.log('  ', branches[branches.length - 1].type, ':', lines.length - branches[branches.length - 1].start, 'lines (to end)');

// Recommendation
console.log('\nRecommended split:');
console.log('- Keep executeTest function header and e2e logic in test-executor.ts');
console.log('- Extract visual regression logic to executor-visual.ts');
console.log('- Extract lighthouse logic to executor-lighthouse.ts');
console.log('- Extract load testing logic to executor-load.ts');
console.log('- Extract accessibility logic to executor-accessibility.ts');
