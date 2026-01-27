// Script to extract QAChatWidget from App.tsx
const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '../frontend/src/App.tsx');
const outputPath = path.join(__dirname, '../frontend/src/components/QAChatWidget.tsx');

// Read App.tsx
const content = fs.readFileSync(appTsxPath, 'utf8');
const lines = content.split('\n');

// QAChatWidget function is from line 659 to 1565 (1-indexed)
// In 0-indexed: 658 to 1564
const chatWidgetLines = lines.slice(658, 1565);

// Get the ChatMessage interface (lines 629-657)
const chatMessageInterface = lines.slice(628, 657);

// Create imports header
const imports = `// QAChatWidget - Extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

`;

// Combine imports with extracted code and add export
const outputContent = imports + chatMessageInterface.join('\n') + '\n\n' + chatWidgetLines.join('\n') + '\n\nexport { QAChatWidget };\n';

// Write the file
fs.writeFileSync(outputPath, outputContent);

console.log('Successfully extracted QAChatWidget to:', outputPath);
console.log('Lines extracted:', chatWidgetLines.length + chatMessageInterface.length);
