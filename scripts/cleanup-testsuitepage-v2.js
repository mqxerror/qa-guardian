/**
 * Script to clean up dead code in TestSuitePage.tsx - Version 2
 * Feature #50: Remove legacy create test modal code
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/pages/TestSuitePage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');
const originalContent = content;

// Track what we're removing
const removals = [];

// 1. Remove validateAndNormalizeUrl function (lines 837-862)
const validateUrlRegex = /\/\/ Feature #50: computeCodeDiff, calculateTestConfidence, validateTestName moved to utils\.ts\s+const validateAndNormalizeUrl = useCallback\(\(url: string\)[^}]+?}\s*;\s*}\s*return \{ isValid: true, normalizedUrl, favicon \};\s*\}\s+catch\s*\{[^}]+}\s+\}, \[\]\);/s;
if (validateUrlRegex.test(content)) {
  content = content.replace(validateUrlRegex, '// Feature #50: URL validation moved to CreateTestModal component');
  removals.push('Removed validateAndNormalizeUrl function (~30 lines)');
}

// 2. Remove handleUrlChange function
const handleUrlChangeRegex = /\/\/ Feature #1771: Handle URL input change with validation\s+const handleUrlChange = useCallback\(\(inputValue: string\)[\s\S]*?\}, \[validateAndNormalizeUrl\]\);/;
if (handleUrlChangeRegex.test(content)) {
  content = content.replace(handleUrlChangeRegex, '');
  removals.push('Removed handleUrlChange function (~25 lines)');
}

// 3. Remove handleUrlBlur function
const handleUrlBlurRegex = /\/\/ Feature #1771: Auto-complete URL on blur\s+const handleUrlBlur = useCallback\(\(\)[\s\S]*?\}, \[newTestTargetUrl, urlValidationState, validateAndNormalizeUrl\]\);/;
if (handleUrlBlurRegex.test(content)) {
  content = content.replace(handleUrlBlurRegex, '');
  removals.push('Removed handleUrlBlur function (~10 lines)');
}

// 4. Remove parseNaturalLanguageInput function
const parseNaturalLanguageRegex = /\/\/ Feature #1772: Parse natural language input and fill form fields\s+const parseNaturalLanguageInput = useCallback\(async \(input: string\)[\s\S]*?\}, \[handleUrlChange\]\);/;
if (parseNaturalLanguageRegex.test(content)) {
  content = content.replace(parseNaturalLanguageRegex, '');
  removals.push('Removed parseNaturalLanguageInput function (~70 lines)');
}

// 5. Remove generateNewTestK6Script function
const generateK6Regex = /\/\/ Generate K6 script template for new test creation\s+const generateNewTestK6Script = \(\): string => \{[\s\S]*?};[\s]*?const handleCreateTest/;
if (generateK6Regex.test(content)) {
  content = content.replace(generateK6Regex, 'const handleCreateTest');
  removals.push('Removed generateNewTestK6Script function (~65 lines)');
}

// 6. Remove handleCreateTest function
const handleCreateTestRegex = /const handleCreateTest = async \(e: React\.FormEvent\) => \{[\s\S]*?finally \{[\s\S]*?setIsCreatingTest\(false\);[\s\S]*?\}[\s\S]*?\};[\s]*?const handleRunSuite/;
if (handleCreateTestRegex.test(content)) {
  content = content.replace(handleCreateTestRegex, 'const handleRunSuite');
  removals.push('Removed handleCreateTest function (~220 lines)');
}

// Save the changes
if (content !== originalContent) {
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('\\nRemovals made:');
  removals.forEach(r => console.log('  - ' + r));

  // Count lines
  const originalLines = originalContent.split('\\n').length;
  const newLines = content.split('\\n').length;
  console.log(`\\nLine count: ${originalLines} -> ${newLines} (${originalLines - newLines} lines removed)`);
} else {
  console.log('No changes made - patterns not found');
  console.log('Attempting individual pattern matches...');

  // Debug: Check each pattern individually
  console.log('validateUrlRegex match:', validateUrlRegex.test(originalContent));
  console.log('handleUrlChangeRegex match:', handleUrlChangeRegex.test(originalContent));
  console.log('handleUrlBlurRegex match:', handleUrlBlurRegex.test(originalContent));
  console.log('parseNaturalLanguageRegex match:', parseNaturalLanguageRegex.test(originalContent));
  console.log('generateK6Regex match:', generateK6Regex.test(originalContent));
  console.log('handleCreateTestRegex match:', handleCreateTestRegex.test(originalContent));
}
