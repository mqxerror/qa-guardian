#!/usr/bin/env node
/**
 * Script to migrate hardcoded Tailwind color classes to semantic CSS variable tokens.
 *
 * Mapping:
 * - text-blue-N/bg-blue-N -> text-primary/bg-primary
 * - text-green-N/bg-green-N -> text-success/bg-success
 * - text-red-N/bg-red-N -> text-destructive/bg-destructive
 * - text-yellow-N/bg-yellow-N/text-amber-N/bg-amber-N -> text-warning/bg-warning
 *
 * Usage: node scripts/migrate-semantic-colors.js
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
 * Replacement rules for semantic colors
 *
 * Strategy:
 * - Light shades (50, 100, 200) with backgrounds → use /10 opacity variant
 * - Standard shades (400, 500, 600) → use base token
 * - Dark shades (700, 800, 900) → use base token (CSS variables handle darkness)
 * - Preserve opacity modifiers (e.g., /50, /20)
 */
const replacements = [
  // ========== BLUE → PRIMARY ==========
  // Text colors - preserve opacity patterns
  { pattern: /\btext-blue-300\b/g, replacement: 'text-primary/70', name: 'text-blue-300' },
  { pattern: /\btext-blue-400\b/g, replacement: 'text-primary', name: 'text-blue-400' },
  { pattern: /\btext-blue-500\b/g, replacement: 'text-primary', name: 'text-blue-500' },
  { pattern: /\btext-blue-600\b/g, replacement: 'text-primary', name: 'text-blue-600' },
  { pattern: /\btext-blue-700\b/g, replacement: 'text-primary', name: 'text-blue-700' },
  { pattern: /\btext-blue-800\b/g, replacement: 'text-primary', name: 'text-blue-800' },
  { pattern: /\btext-blue-900\b/g, replacement: 'text-primary', name: 'text-blue-900' },

  // Background colors - light shades with opacity
  { pattern: /\bbg-blue-50\b/g, replacement: 'bg-primary/5', name: 'bg-blue-50' },
  { pattern: /\bbg-blue-100\b/g, replacement: 'bg-primary/10', name: 'bg-blue-100' },
  { pattern: /\bbg-blue-200\b/g, replacement: 'bg-primary/20', name: 'bg-blue-200' },
  { pattern: /\bbg-blue-300\b/g, replacement: 'bg-primary/30', name: 'bg-blue-300' },
  { pattern: /\bbg-blue-400\b/g, replacement: 'bg-primary/80', name: 'bg-blue-400' },
  { pattern: /\bbg-blue-500\b/g, replacement: 'bg-primary', name: 'bg-blue-500' },
  { pattern: /\bbg-blue-600\b/g, replacement: 'bg-primary', name: 'bg-blue-600' },
  { pattern: /\bbg-blue-700\b/g, replacement: 'bg-primary', name: 'bg-blue-700' },
  { pattern: /\bbg-blue-800\b/g, replacement: 'bg-primary', name: 'bg-blue-800' },
  { pattern: /\bbg-blue-900\b/g, replacement: 'bg-primary', name: 'bg-blue-900' },

  // Border colors
  { pattern: /\bborder-blue-100\b/g, replacement: 'border-primary/10', name: 'border-blue-100' },
  { pattern: /\bborder-blue-200\b/g, replacement: 'border-primary/20', name: 'border-blue-200' },
  { pattern: /\bborder-blue-300\b/g, replacement: 'border-primary/30', name: 'border-blue-300' },
  { pattern: /\bborder-blue-400\b/g, replacement: 'border-primary/40', name: 'border-blue-400' },
  { pattern: /\bborder-blue-500\b/g, replacement: 'border-primary', name: 'border-blue-500' },
  { pattern: /\bborder-blue-600\b/g, replacement: 'border-primary', name: 'border-blue-600' },
  { pattern: /\bborder-blue-700\b/g, replacement: 'border-primary', name: 'border-blue-700' },

  // Ring colors
  { pattern: /\bring-blue-500\b/g, replacement: 'ring-primary', name: 'ring-blue-500' },
  { pattern: /\bring-blue-600\b/g, replacement: 'ring-primary', name: 'ring-blue-600' },
  { pattern: /\bring-blue-400\b/g, replacement: 'ring-primary', name: 'ring-blue-400' },

  // Gradient colors
  { pattern: /\bfrom-blue-400\b/g, replacement: 'from-primary/80', name: 'from-blue-400' },
  { pattern: /\bfrom-blue-500\b/g, replacement: 'from-primary', name: 'from-blue-500' },
  { pattern: /\bfrom-blue-600\b/g, replacement: 'from-primary', name: 'from-blue-600' },
  { pattern: /\bto-blue-400\b/g, replacement: 'to-primary/80', name: 'to-blue-400' },
  { pattern: /\bto-blue-500\b/g, replacement: 'to-primary', name: 'to-blue-500' },
  { pattern: /\bto-blue-600\b/g, replacement: 'to-primary', name: 'to-blue-600' },
  { pattern: /\bto-blue-700\b/g, replacement: 'to-primary', name: 'to-blue-700' },
  { pattern: /\bvia-blue-500\b/g, replacement: 'via-primary', name: 'via-blue-500' },
  { pattern: /\bfrom-blue-50\b/g, replacement: 'from-primary/5', name: 'from-blue-50' },
  { pattern: /\bto-blue-50\b/g, replacement: 'to-primary/5', name: 'to-blue-50' },

  // Additional ring colors
  { pattern: /\bring-blue-300\b/g, replacement: 'ring-primary/50', name: 'ring-blue-300' },
  { pattern: /\bring-blue-200\b/g, replacement: 'ring-primary/30', name: 'ring-blue-200' },
  { pattern: /\bfocus:ring-blue-300\b/g, replacement: 'focus:ring-primary/50', name: 'focus:ring-blue-300' },

  // Light text colors (for dark backgrounds)
  { pattern: /\btext-blue-200\b/g, replacement: 'text-primary-foreground/80', name: 'text-blue-200' },
  { pattern: /\btext-blue-100\b/g, replacement: 'text-primary-foreground', name: 'text-blue-100' },

  // ========== GREEN → SUCCESS ==========
  // Text colors
  { pattern: /\btext-green-400\b/g, replacement: 'text-success', name: 'text-green-400' },
  { pattern: /\btext-green-500\b/g, replacement: 'text-success', name: 'text-green-500' },
  { pattern: /\btext-green-600\b/g, replacement: 'text-success', name: 'text-green-600' },
  { pattern: /\btext-green-700\b/g, replacement: 'text-success', name: 'text-green-700' },
  { pattern: /\btext-green-800\b/g, replacement: 'text-success', name: 'text-green-800' },
  { pattern: /\btext-green-900\b/g, replacement: 'text-success', name: 'text-green-900' },

  // Background colors
  { pattern: /\bbg-green-50\b/g, replacement: 'bg-success/5', name: 'bg-green-50' },
  { pattern: /\bbg-green-100\b/g, replacement: 'bg-success/10', name: 'bg-green-100' },
  { pattern: /\bbg-green-200\b/g, replacement: 'bg-success/20', name: 'bg-green-200' },
  { pattern: /\bbg-green-500\b/g, replacement: 'bg-success', name: 'bg-green-500' },
  { pattern: /\bbg-green-600\b/g, replacement: 'bg-success', name: 'bg-green-600' },
  { pattern: /\bbg-green-700\b/g, replacement: 'bg-success', name: 'bg-green-700' },

  // Border colors
  { pattern: /\bborder-green-200\b/g, replacement: 'border-success/20', name: 'border-green-200' },
  { pattern: /\bborder-green-300\b/g, replacement: 'border-success/30', name: 'border-green-300' },
  { pattern: /\bborder-green-500\b/g, replacement: 'border-success', name: 'border-green-500' },

  // Gradient colors
  { pattern: /\bfrom-green-50\b/g, replacement: 'from-success/5', name: 'from-green-50' },
  { pattern: /\bfrom-green-500\b/g, replacement: 'from-success', name: 'from-green-500' },
  { pattern: /\bto-green-50\b/g, replacement: 'to-success/5', name: 'to-green-50' },
  { pattern: /\bto-green-500\b/g, replacement: 'to-success', name: 'to-green-500' },
  { pattern: /\bto-green-600\b/g, replacement: 'to-success', name: 'to-green-600' },

  // Ring colors
  { pattern: /\bring-green-500\b/g, replacement: 'ring-success', name: 'ring-green-500' },
  { pattern: /\bfocus:ring-green-500\b/g, replacement: 'focus:ring-success', name: 'focus:ring-green-500' },

  // Additional green shades
  { pattern: /\bbg-green-400\b/g, replacement: 'bg-success/80', name: 'bg-green-400' },
  { pattern: /\bbg-green-800\b/g, replacement: 'bg-success/80', name: 'bg-green-800' },
  { pattern: /\btext-green-200\b/g, replacement: 'text-success-foreground/80', name: 'text-green-200' },
  { pattern: /\bdisabled:bg-green-400\b/g, replacement: 'disabled:bg-success/80', name: 'disabled:bg-green-400' },

  // ========== RED → DESTRUCTIVE ==========
  // Text colors
  { pattern: /\btext-red-400\b/g, replacement: 'text-destructive', name: 'text-red-400' },
  { pattern: /\btext-red-500\b/g, replacement: 'text-destructive', name: 'text-red-500' },
  { pattern: /\btext-red-600\b/g, replacement: 'text-destructive', name: 'text-red-600' },
  { pattern: /\btext-red-700\b/g, replacement: 'text-destructive', name: 'text-red-700' },
  { pattern: /\btext-red-800\b/g, replacement: 'text-destructive', name: 'text-red-800' },
  { pattern: /\btext-red-900\b/g, replacement: 'text-destructive', name: 'text-red-900' },

  // Background colors
  { pattern: /\bbg-red-50\b/g, replacement: 'bg-destructive/5', name: 'bg-red-50' },
  { pattern: /\bbg-red-100\b/g, replacement: 'bg-destructive/10', name: 'bg-red-100' },
  { pattern: /\bbg-red-200\b/g, replacement: 'bg-destructive/20', name: 'bg-red-200' },
  { pattern: /\bbg-red-500\b/g, replacement: 'bg-destructive', name: 'bg-red-500' },
  { pattern: /\bbg-red-600\b/g, replacement: 'bg-destructive', name: 'bg-red-600' },
  { pattern: /\bbg-red-700\b/g, replacement: 'bg-destructive', name: 'bg-red-700' },

  // Border colors
  { pattern: /\bborder-red-200\b/g, replacement: 'border-destructive/20', name: 'border-red-200' },
  { pattern: /\bborder-red-300\b/g, replacement: 'border-destructive/30', name: 'border-red-300' },
  { pattern: /\bborder-red-500\b/g, replacement: 'border-destructive', name: 'border-red-500' },

  // Gradient colors
  { pattern: /\bfrom-red-50\b/g, replacement: 'from-destructive/5', name: 'from-red-50' },
  { pattern: /\bfrom-red-100\b/g, replacement: 'from-destructive/10', name: 'from-red-100' },
  { pattern: /\bfrom-red-500\b/g, replacement: 'from-destructive', name: 'from-red-500' },
  { pattern: /\bto-red-50\b/g, replacement: 'to-destructive/5', name: 'to-red-50' },
  { pattern: /\bto-red-100\b/g, replacement: 'to-destructive/10', name: 'to-red-100' },
  { pattern: /\bto-red-500\b/g, replacement: 'to-destructive', name: 'to-red-500' },
  { pattern: /\bto-red-600\b/g, replacement: 'to-destructive', name: 'to-red-600' },
  { pattern: /\bto-red-700\b/g, replacement: 'to-destructive', name: 'to-red-700' },

  // Ring colors
  { pattern: /\bring-red-500\b/g, replacement: 'ring-destructive', name: 'ring-red-500' },
  { pattern: /\bfocus:ring-red-500\b/g, replacement: 'focus:ring-destructive', name: 'focus:ring-red-500' },

  // Light text/bg colors (for dark backgrounds)
  { pattern: /\btext-red-200\b/g, replacement: 'text-destructive-foreground/80', name: 'text-red-200' },
  { pattern: /\btext-red-300\b/g, replacement: 'text-destructive/70', name: 'text-red-300' },
  { pattern: /\bbg-red-400\b/g, replacement: 'bg-destructive/80', name: 'bg-red-400' },
  { pattern: /\bbg-red-800\b/g, replacement: 'bg-destructive/80', name: 'bg-red-800' },
  { pattern: /\bbg-red-900\b/g, replacement: 'bg-destructive', name: 'bg-red-900' },
  { pattern: /\bhover:bg-red-400\b/g, replacement: 'hover:bg-destructive/80', name: 'hover:bg-red-400' },
  { pattern: /\bhover:bg-red-600\b/g, replacement: 'hover:bg-destructive', name: 'hover:bg-red-600' },
  { pattern: /\bhover:bg-red-700\b/g, replacement: 'hover:bg-destructive', name: 'hover:bg-red-700' },
  { pattern: /\bhover:text-red-300\b/g, replacement: 'hover:text-destructive/70', name: 'hover:text-red-300' },
  { pattern: /\bborder-red-400\b/g, replacement: 'border-destructive/80', name: 'border-red-400' },

  // ========== YELLOW/AMBER → WARNING ==========
  // Text colors - yellow
  { pattern: /\btext-yellow-400\b/g, replacement: 'text-warning', name: 'text-yellow-400' },
  { pattern: /\btext-yellow-500\b/g, replacement: 'text-warning', name: 'text-yellow-500' },
  { pattern: /\btext-yellow-600\b/g, replacement: 'text-warning', name: 'text-yellow-600' },
  { pattern: /\btext-yellow-700\b/g, replacement: 'text-warning', name: 'text-yellow-700' },
  { pattern: /\btext-yellow-800\b/g, replacement: 'text-warning', name: 'text-yellow-800' },
  { pattern: /\btext-yellow-900\b/g, replacement: 'text-warning', name: 'text-yellow-900' },

  // Text colors - amber
  { pattern: /\btext-amber-400\b/g, replacement: 'text-warning', name: 'text-amber-400' },
  { pattern: /\btext-amber-500\b/g, replacement: 'text-warning', name: 'text-amber-500' },
  { pattern: /\btext-amber-600\b/g, replacement: 'text-warning', name: 'text-amber-600' },
  { pattern: /\btext-amber-700\b/g, replacement: 'text-warning', name: 'text-amber-700' },
  { pattern: /\btext-amber-800\b/g, replacement: 'text-warning', name: 'text-amber-800' },
  { pattern: /\btext-amber-900\b/g, replacement: 'text-warning', name: 'text-amber-900' },

  // Background colors - yellow
  { pattern: /\bbg-yellow-50\b/g, replacement: 'bg-warning/5', name: 'bg-yellow-50' },
  { pattern: /\bbg-yellow-100\b/g, replacement: 'bg-warning/10', name: 'bg-yellow-100' },
  { pattern: /\bbg-yellow-200\b/g, replacement: 'bg-warning/20', name: 'bg-yellow-200' },
  { pattern: /\bbg-yellow-500\b/g, replacement: 'bg-warning', name: 'bg-yellow-500' },
  { pattern: /\bbg-yellow-600\b/g, replacement: 'bg-warning', name: 'bg-yellow-600' },

  // Background colors - amber
  { pattern: /\bbg-amber-50\b/g, replacement: 'bg-warning/5', name: 'bg-amber-50' },
  { pattern: /\bbg-amber-100\b/g, replacement: 'bg-warning/10', name: 'bg-amber-100' },
  { pattern: /\bbg-amber-200\b/g, replacement: 'bg-warning/20', name: 'bg-amber-200' },
  { pattern: /\bbg-amber-500\b/g, replacement: 'bg-warning', name: 'bg-amber-500' },
  { pattern: /\bbg-amber-600\b/g, replacement: 'bg-warning', name: 'bg-amber-600' },

  // Border colors - yellow
  { pattern: /\bborder-yellow-200\b/g, replacement: 'border-warning/20', name: 'border-yellow-200' },
  { pattern: /\bborder-yellow-300\b/g, replacement: 'border-warning/30', name: 'border-yellow-300' },
  { pattern: /\bborder-yellow-500\b/g, replacement: 'border-warning', name: 'border-yellow-500' },

  // Border colors - amber
  { pattern: /\bborder-amber-200\b/g, replacement: 'border-warning/20', name: 'border-amber-200' },
  { pattern: /\bborder-amber-300\b/g, replacement: 'border-warning/30', name: 'border-amber-300' },
  { pattern: /\bborder-amber-500\b/g, replacement: 'border-warning', name: 'border-amber-500' },

  // Ring colors - amber
  { pattern: /\bring-amber-500\b/g, replacement: 'ring-warning', name: 'ring-amber-500' },

  // Focus ring variants
  { pattern: /\bfocus:ring-blue-500\b/g, replacement: 'focus:ring-primary', name: 'focus:ring-blue-500' },
  { pattern: /\bfocus:ring-amber-500\b/g, replacement: 'focus:ring-warning', name: 'focus:ring-amber-500' },

  // Gradient colors - amber
  { pattern: /\bfrom-amber-50\b/g, replacement: 'from-warning/5', name: 'from-amber-50' },
  { pattern: /\bfrom-amber-400\b/g, replacement: 'from-warning/80', name: 'from-amber-400' },
  { pattern: /\bfrom-amber-500\b/g, replacement: 'from-warning', name: 'from-amber-500' },
  { pattern: /\bto-amber-50\b/g, replacement: 'to-warning/5', name: 'to-amber-50' },
  { pattern: /\bto-amber-500\b/g, replacement: 'to-warning', name: 'to-amber-500' },
  { pattern: /\bto-amber-600\b/g, replacement: 'to-warning', name: 'to-amber-600' },
  { pattern: /\bvia-amber-500\b/g, replacement: 'via-warning', name: 'via-amber-500' },

  // Gradient colors - yellow
  { pattern: /\bfrom-yellow-50\b/g, replacement: 'from-warning/5', name: 'from-yellow-50' },
  { pattern: /\bfrom-yellow-500\b/g, replacement: 'from-warning', name: 'from-yellow-500' },
  { pattern: /\bto-yellow-50\b/g, replacement: 'to-warning/5', name: 'to-yellow-50' },
  { pattern: /\bto-yellow-500\b/g, replacement: 'to-warning', name: 'to-yellow-500' },

  // Additional amber/yellow shades
  { pattern: /\bbg-amber-400\b/g, replacement: 'bg-warning/80', name: 'bg-amber-400' },
  { pattern: /\bbg-amber-700\b/g, replacement: 'bg-warning', name: 'bg-amber-700' },
  { pattern: /\bbg-yellow-400\b/g, replacement: 'bg-warning/80', name: 'bg-yellow-400' },
  { pattern: /\bbg-yellow-700\b/g, replacement: 'bg-warning', name: 'bg-yellow-700' },
  { pattern: /\bbg-yellow-800\b/g, replacement: 'bg-warning/80', name: 'bg-yellow-800' },
  { pattern: /\bbg-yellow-900\b/g, replacement: 'bg-warning', name: 'bg-yellow-900' },
  { pattern: /\btext-yellow-200\b/g, replacement: 'text-warning-foreground/80', name: 'text-yellow-200' },
  { pattern: /\btext-yellow-300\b/g, replacement: 'text-warning/70', name: 'text-yellow-300' },
  { pattern: /\bhover:bg-amber-700\b/g, replacement: 'hover:bg-warning', name: 'hover:bg-amber-700' },
  { pattern: /\bhover:bg-yellow-400\b/g, replacement: 'hover:bg-warning/80', name: 'hover:bg-yellow-400' },
  { pattern: /\bhover:bg-yellow-700\b/g, replacement: 'hover:bg-warning', name: 'hover:bg-yellow-700' },
  { pattern: /\bhover:to-amber-600\b/g, replacement: 'hover:to-warning', name: 'hover:to-amber-600' },
  { pattern: /\bborder-amber-400\b/g, replacement: 'border-warning/80', name: 'border-amber-400' },
  { pattern: /\bborder-yellow-400\b/g, replacement: 'border-warning/80', name: 'border-yellow-400' },
  { pattern: /\bborder-yellow-600\b/g, replacement: 'border-warning', name: 'border-yellow-600' },

  // Additional hover patterns
  { pattern: /\bhover:from-red-600\b/g, replacement: 'hover:from-destructive', name: 'hover:from-red-600' },
  { pattern: /\bhover:to-red-600\b/g, replacement: 'hover:to-destructive', name: 'hover:to-red-600' },
  { pattern: /\bhover:to-red-700\b/g, replacement: 'hover:to-destructive', name: 'hover:to-red-700' },

  // Additional border patterns
  { pattern: /\bborder-amber-600\b/g, replacement: 'border-warning', name: 'border-amber-600' },
  { pattern: /\btext-amber-600\b/g, replacement: 'text-warning', name: 'text-amber-600' },

  // Missing focus patterns
  { pattern: /\bfocus:ring-red-500\/20\b/g, replacement: 'focus:ring-destructive/20', name: 'focus:ring-red-500/20' },
];

/**
 * Skip patterns - files or lines that should not be modified
 */
const skipPatterns = [
  // Skip chart/graph color definitions (often need specific colors)
  /chartColors|graphColors/i,
  // Skip color palette definitions
  /colors\s*=\s*{/,
  // Skip Tailwind config
  /tailwind\.config/,
];

/**
 * Context-aware skip: lines that should keep original colors
 */
function shouldSkipLine(line) {
  const skipLinePatterns = [
    // Chart data colors
    /fill:\s*['"]#/,
    /stroke:\s*['"]#/,
    // Color definitions as data
    /\[\s*['"]#/,
    // Status indicators that need exact colors for accessibility
    /severity.*critical|severity.*high/i,
  ];

  return skipLinePatterns.some(pattern => pattern.test(line));
}

/**
 * Process a single file
 */
function processFile(filePath) {
  // Skip tailwind config
  if (filePath.includes('tailwind.config')) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Skip files that match skip patterns
  if (skipPatterns.some(pattern => pattern.test(content))) {
    // Still process, but log that we're being careful
  }

  let modified = content;
  let fileReplacements = 0;

  // Process line by line for context-aware replacements
  const lines = modified.split('\n');
  const processedLines = lines.map(line => {
    // Skip lines that should keep original colors
    if (shouldSkipLine(line)) {
      return line;
    }

    let processedLine = line;
    for (const { pattern, replacement, name } of replacements) {
      const matches = processedLine.match(pattern);
      if (matches) {
        const count = matches.length;
        processedLine = processedLine.replace(pattern, replacement);
        fileReplacements += count;
        replacementCounts[name] = (replacementCounts[name] || 0) + count;
      }
    }
    return processedLine;
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
console.log('Migrating semantic color tokens to CSS variable system...\n');
console.log('Mapping:');
console.log('  blue-* → primary');
console.log('  green-* → success');
console.log('  red-* → destructive');
console.log('  yellow-*/amber-* → warning');
console.log('');

const files = findFiles(FRONTEND_SRC);
console.log(`Found ${files.length} TypeScript files to process.\n`);

for (const file of files) {
  processFile(file);
}

console.log('\n========================================');
console.log(`Files processed: ${filesProcessed}`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log('\nReplacement breakdown by color family:');

// Group by color family
const blueCount = Object.entries(replacementCounts)
  .filter(([name]) => name.includes('blue'))
  .reduce((sum, [, count]) => sum + count, 0);
const greenCount = Object.entries(replacementCounts)
  .filter(([name]) => name.includes('green'))
  .reduce((sum, [, count]) => sum + count, 0);
const redCount = Object.entries(replacementCounts)
  .filter(([name]) => name.includes('red'))
  .reduce((sum, [, count]) => sum + count, 0);
const yellowAmberCount = Object.entries(replacementCounts)
  .filter(([name]) => name.includes('yellow') || name.includes('amber'))
  .reduce((sum, [, count]) => sum + count, 0);

console.log(`  blue → primary: ${blueCount}`);
console.log(`  green → success: ${greenCount}`);
console.log(`  red → destructive: ${redCount}`);
console.log(`  yellow/amber → warning: ${yellowAmberCount}`);

console.log('\nDetailed breakdown:');
for (const [name, count] of Object.entries(replacementCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name}: ${count}`);
}
console.log('========================================');
