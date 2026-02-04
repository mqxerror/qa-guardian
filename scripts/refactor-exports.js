#!/usr/bin/env node
/**
 * Feature #48: Remove inline export functions from TestDetailPage.tsx
 * Replace with imports from exportUtils.ts
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'TestDetailPage.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the line with "const exportAccessibilityPDF"
let pdfStartLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const exportAccessibilityPDF = (a11yData: any, testName: string, runDate: string) => {')) {
    pdfStartLine = i;
    break;
  }
}

if (pdfStartLine === -1) {
  console.log("ERROR: Could not find exportAccessibilityPDF start");
  process.exit(1);
}

console.log(`Found exportAccessibilityPDF at line ${pdfStartLine + 1}`);

// Find the line with "const exportAccessibilityCSV"
let csvStartLine = -1;
for (let i = pdfStartLine; i < lines.length; i++) {
  if (lines[i].includes('const exportAccessibilityCSV = (a11yData: any, testName: string, runDate: string) => {')) {
    csvStartLine = i;
    break;
  }
}

if (csvStartLine === -1) {
  console.log("ERROR: Could not find exportAccessibilityCSV start");
  process.exit(1);
}

console.log(`Found exportAccessibilityCSV at line ${csvStartLine + 1}`);

// Find the end of exportAccessibilityCSV (ends with "toast.success('Accessibility report CSV downloaded');" followed by "};"
let csvEndLine = -1;
for (let i = csvStartLine; i < lines.length; i++) {
  if (lines[i].includes("toast.success('Accessibility report CSV downloaded');")) {
    // The closing }; should be on the next line
    csvEndLine = i + 1;
    break;
  }
}

if (csvEndLine === -1) {
  console.log("ERROR: Could not find exportAccessibilityCSV end");
  process.exit(1);
}

console.log(`Found CSV end at line ${csvEndLine + 1}`);

// Calculate lines to remove
const linesToRemove = csvEndLine - pdfStartLine + 1;
console.log(`Total lines to remove: ${linesToRemove}`);

// Find the import statement to add exportAccessibilityPDF and exportAccessibilityCSV
// Look for the existing import from '../components/test-detail'
let importLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("} from '../components/test-detail';")) {
    importLine = i;
    break;
  }
}

if (importLine === -1) {
  console.log("ERROR: Could not find test-detail import");
  process.exit(1);
}

console.log(`Found test-detail import at line ${importLine + 1}`);

// Add the export functions to the import
// Find the line before the closing } to add our imports
let importStartLine = -1;
for (let i = importLine - 1; i >= 0; i--) {
  if (lines[i].includes("import {")) {
    importStartLine = i;
    break;
  }
}

if (importStartLine === -1) {
  // Try single-line import
  console.log("Looking for single-line import pattern...");
}

// Build the new content by removing the inline functions
const newLines = [
  ...lines.slice(0, pdfStartLine),
  ...lines.slice(csvEndLine + 1)
];

// Now add the imports - find where to add them
let newContent = newLines.join('\n');

// Add exportAccessibilityPDF and exportAccessibilityCSV to the import
// Look for the last import item before the closing
const importPattern = /from '\.\.\/components\/test-detail';/;
const importMatch = newContent.match(importPattern);

if (importMatch) {
  // Find the full import statement
  const importStatementPattern = /import \{[\s\S]*?\} from '\.\.\/components\/test-detail';/;
  const fullImportMatch = newContent.match(importStatementPattern);

  if (fullImportMatch) {
    const originalImport = fullImportMatch[0];
    // Add our new imports before the closing brace
    const newImport = originalImport.replace(
      "} from '../components/test-detail';",
      "  exportAccessibilityPDF,\n  exportAccessibilityCSV,\n} from '../components/test-detail';"
    );
    newContent = newContent.replace(originalImport, newImport);
  }
}

// Also remove the jsPDF import if it's only used for these functions
// Check if jsPDF is used elsewhere
const jsPDFUsages = (newContent.match(/jsPDF/g) || []).length;
if (jsPDFUsages === 1) {
  // Only the import statement, can remove it
  newContent = newContent.replace(/import jsPDF from 'jspdf';\n/, '');
  console.log('Removed jsPDF import (no longer needed in page)');
}

// Write the file
fs.writeFileSync(filePath, newContent, 'utf8');

const newLineCount = newContent.split('\n').length;
console.log(`SUCCESS: Removed ${linesToRemove} lines`);
console.log(`New file line count: ${newLineCount}`);
