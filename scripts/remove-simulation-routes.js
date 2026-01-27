const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'src', 'routes', 'test-runs.ts');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// Find start: '  // Simulate network failure for testing (dev only)'
// Find end: the '}' that closes the if block before '  // Feature #604: Get storage usage'

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Simulate network failure for testing (dev only)') && startIndex === -1) {
    startIndex = i;
  }
  if (lines[i].trim() === '}' && startIndex !== -1 && endIndex === -1 &&
      i + 1 < lines.length && lines[i + 1].trim() === '' &&
      i + 2 < lines.length && lines[i + 2].includes('// Feature #604: Get storage usage')) {
    endIndex = i;
    break;
  }
}

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find the block to remove');
  console.log('Start index:', startIndex, 'End index:', endIndex);
  process.exit(1);
}

console.log('Start index:', startIndex, '(line', startIndex + 1, ')');
console.log('End index:', endIndex, '(line', endIndex + 1, ')');
console.log('Lines to remove:', endIndex - startIndex + 1);

// Remove the lines and replace with a comment
const newLines = [
  ...lines.slice(0, startIndex),
  '  // Feature #1356: Test simulation routes moved to ./test-runs/test-simulation.ts',
  '  // Registered via testSimulationRoutes(app) at end of this function.',
  '',
  ...lines.slice(endIndex + 1)
];

fs.writeFileSync(filePath, newLines.join('\n'));
console.log('Successfully removed', endIndex - startIndex + 1, 'lines and added comment');
console.log('New file length:', newLines.length, 'lines');
