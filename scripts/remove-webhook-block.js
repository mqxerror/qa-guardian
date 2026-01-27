const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'src', 'routes', 'test-runs.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Find the start marker
const startMarker = 'PLACEHOLDER_WEBHOOK_START';
const endMarker = '// Feature #1370: Wrapper for checkAndSendAlerts';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('Markers not found:', startIdx, endIdx);
  process.exit(1);
}

const newContent = content.substring(0, startIdx) + content.substring(endIdx);
fs.writeFileSync(filePath, newContent);
console.log('Removed', endIdx - startIdx, 'characters');
console.log('New file size:', newContent.length, 'characters');
