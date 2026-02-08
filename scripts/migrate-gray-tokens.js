#!/usr/bin/env node
/**
 * Script to migrate hardcoded gray color Tailwind classes to CSS variable tokens.
 *
 * Mapping:
 * - text-gray-300/400/500 → text-muted-foreground
 * - text-gray-600/700/800/900 → text-foreground
 * - bg-gray-50/100 → bg-muted
 * - bg-gray-200 → bg-secondary
 * - bg-gray-800/900 → bg-card or bg-background
 * - bg-white → bg-card (except toggle switch knobs)
 * - border-gray-* → border-border
 *
 * Usage: node scripts/migrate-gray-tokens.js
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '..', 'frontend', 'src');

// Stats
let filesProcessed = 0;
let filesModified = 0;
let totalReplacements = 0;
const replacementCounts = {};

/**
 * Replacement rules - order matters for specificity
 */
const replacements = [
  // Text colors - muted (lighter grays)
  { pattern: /\btext-gray-300\b/g, replacement: 'text-muted-foreground', name: 'text-gray-300' },
  { pattern: /\btext-gray-400\b/g, replacement: 'text-muted-foreground', name: 'text-gray-400' },
  { pattern: /\btext-gray-500\b/g, replacement: 'text-muted-foreground', name: 'text-gray-500' },

  // Text colors - foreground (darker grays)
  { pattern: /\btext-gray-600\b/g, replacement: 'text-foreground', name: 'text-gray-600' },
  { pattern: /\btext-gray-700\b/g, replacement: 'text-foreground', name: 'text-gray-700' },
  { pattern: /\btext-gray-800\b/g, replacement: 'text-foreground', name: 'text-gray-800' },
  { pattern: /\btext-gray-900\b/g, replacement: 'text-foreground', name: 'text-gray-900' },

  // Background colors - muted (light grays)
  { pattern: /\bbg-gray-50\b/g, replacement: 'bg-muted', name: 'bg-gray-50' },
  { pattern: /\bbg-gray-100\b/g, replacement: 'bg-muted', name: 'bg-gray-100' },

  // Background colors - secondary
  { pattern: /\bbg-gray-200\b/g, replacement: 'bg-secondary', name: 'bg-gray-200' },

  // Background colors - card/background (dark grays)
  // Note: bg-gray-800/900 in a dark-first theme means card/surface colors
  { pattern: /\bbg-gray-700\b/g, replacement: 'bg-card', name: 'bg-gray-700' },
  { pattern: /\bbg-gray-800\b/g, replacement: 'bg-card', name: 'bg-gray-800' },
  { pattern: /\bbg-gray-900\b/g, replacement: 'bg-background', name: 'bg-gray-900' },

  // Border colors
  { pattern: /\bborder-gray-100\b/g, replacement: 'border-border', name: 'border-gray-100' },
  { pattern: /\bborder-gray-200\b/g, replacement: 'border-border', name: 'border-gray-200' },
  { pattern: /\bborder-gray-300\b/g, replacement: 'border-border', name: 'border-gray-300' },
  { pattern: /\bborder-gray-400\b/g, replacement: 'border-border', name: 'border-gray-400' },
  { pattern: /\bborder-gray-500\b/g, replacement: 'border-border', name: 'border-gray-500' },
  { pattern: /\bborder-gray-600\b/g, replacement: 'border-border', name: 'border-gray-600' },
  { pattern: /\bborder-gray-700\b/g, replacement: 'border-border', name: 'border-gray-700' },
  { pattern: /\bborder-gray-800\b/g, replacement: 'border-border', name: 'border-gray-800' },

  // Divide colors (same pattern as border)
  { pattern: /\bdivide-gray-100\b/g, replacement: 'divide-border', name: 'divide-gray-100' },
  { pattern: /\bdivide-gray-200\b/g, replacement: 'divide-border', name: 'divide-gray-200' },
  { pattern: /\bdivide-gray-300\b/g, replacement: 'divide-border', name: 'divide-gray-300' },

  // Ring colors
  { pattern: /\bring-gray-200\b/g, replacement: 'ring-border', name: 'ring-gray-200' },
  { pattern: /\bring-gray-300\b/g, replacement: 'ring-border', name: 'ring-gray-300' },

  // Placeholder colors
  { pattern: /\bplaceholder-gray-400\b/g, replacement: 'placeholder-muted-foreground', name: 'placeholder-gray-400' },
  { pattern: /\bplaceholder-gray-500\b/g, replacement: 'placeholder-muted-foreground', name: 'placeholder-gray-500' },
];

/**
 * Special handling for bg-white:
 * - Keep bg-white in toggle switch knobs (usually small rounded elements)
 * - Replace with bg-card for cards, modals, panels
 *
 * We'll be conservative and only replace obvious cases
 */
const bgWhiteReplacements = [
  // bg-white on its own or followed by common modifiers
  { pattern: /\bbg-white(?=\s|"|'|`|\$|$)/g, replacement: 'bg-card', name: 'bg-white' },
];

/**
 * Process a single file
 */
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  let fileReplacements = 0;

  // Apply standard replacements
  for (const { pattern, replacement, name } of replacements) {
    const matches = modified.match(pattern);
    if (matches) {
      const count = matches.length;
      modified = modified.replace(pattern, replacement);
      fileReplacements += count;
      replacementCounts[name] = (replacementCounts[name] || 0) + count;
    }
  }

  // Apply bg-white replacements (skip if contains "toggle" or "switch" nearby)
  // This is a heuristic - we check if the line contains toggle/switch context
  const lines = modified.split('\n');
  const processedLines = lines.map(line => {
    // Skip bg-white replacement if line appears to be a toggle/switch component
    if (/toggle|switch|knob|thumb/i.test(line)) {
      return line;
    }

    for (const { pattern, replacement, name } of bgWhiteReplacements) {
      const matches = line.match(pattern);
      if (matches) {
        const count = matches.length;
        line = line.replace(pattern, replacement);
        fileReplacements += count;
        replacementCounts[name] = (replacementCounts[name] || 0) + count;
      }
    }
    return line;
  });
  modified = processedLines.join('\n');

  filesProcessed++;

  if (fileReplacements > 0) {
    fs.writeFileSync(filePath, modified, 'utf8');
    filesModified++;
    totalReplacements += fileReplacements;
    console.log(`✓ ${path.relative(FRONTEND_SRC, filePath)}: ${fileReplacements} replacements`);
  }
}

/**
 * Recursively find all .tsx and .ts files
 */
function findFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      files.push(fullPath);
    }
  }

  return files;
}

// Main execution
console.log('Migrating gray color tokens to CSS variable system...\n');

const files = findFiles(FRONTEND_SRC);
console.log(`Found ${files.length} TypeScript files to process.\n`);

for (const file of files) {
  processFile(file);
}

console.log('\n========================================');
console.log(`Files processed: ${filesProcessed}`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log('\nReplacement breakdown:');
for (const [name, count] of Object.entries(replacementCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name}: ${count}`);
}
console.log('========================================');
