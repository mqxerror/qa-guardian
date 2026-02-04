#!/usr/bin/env node
/**
 * Feature #48: Integrate TestResultCard into TestDetailPage.tsx
 * This script replaces inline test results rendering code with the TestResultCard component.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'TestDetailPage.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the start marker
const startMarker = "{/* Test Results - remaining inline code */}";
let markerLineNo = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(startMarker)) {
    markerLineNo = i;
    break;
  }
}

if (markerLineNo === -1) {
  console.log("ERROR: Could not find start marker");
  process.exit(1);
}

console.log(`Found marker at line ${markerLineNo + 1}`);

// Find the line with currentRun.results &&
let blockStartLine = -1;
for (let i = markerLineNo + 1; i < lines.length; i++) {
  if (lines[i].includes('currentRun.results && currentRun.results.length > 0')) {
    blockStartLine = i;
    break;
  }
}

if (blockStartLine === -1) {
  console.log("ERROR: Could not find block start");
  process.exit(1);
}

console.log(`Block starts at line ${blockStartLine + 1}`);

// Count brackets to find the end
let braceCount = 1; // Starting with the { in {currentRun.results
let parenCount = 1; // Starting with the ( at the end
let blockEndLine = -1;

for (let i = blockStartLine + 1; i < lines.length; i++) {
  const line = lines[i];

  // Count braces and parens (simplified - ignores strings)
  for (const char of line) {
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '(') parenCount++;
    else if (char === ')') parenCount--;
  }

  // When both counts return to 0, we've found the end
  if (braceCount === 0 && parenCount === 0) {
    blockEndLine = i;
    break;
  }
}

if (blockEndLine === -1) {
  console.log("ERROR: Could not find block end");
  console.log(`Final braceCount: ${braceCount}, parenCount: ${parenCount}`);
  process.exit(1);
}

console.log(`Block ends at line ${blockEndLine + 1}`);
console.log(`Total lines to replace: ${blockEndLine - markerLineNo + 1}`);

// Build the replacement code
const replacement = `              {/* Test Results - Feature #48: Extracted to TestResultCard component */}
              {currentRun.results && currentRun.results.length > 0 && (
                <div className="mt-4 space-y-4">
                  {currentRun.results.map((result) => (
                    <TestResultCard
                      key={result.test_id}
                      result={result}
                      testType={test?.test_type}
                      token={token || ''}
                      comparisonViewMode={comparisonViewMode}
                      setComparisonViewMode={setComparisonViewMode}
                      sliderPosition={sliderPosition}
                      setSliderPosition={setSliderPosition}
                      onionSkinOpacity={onionSkinOpacity}
                      setOnionSkinOpacity={setOnionSkinOpacity}
                      diffOverlayOpacity={diffOverlayOpacity}
                      setDiffOverlayOpacity={setDiffOverlayOpacity}
                      imageZoomLevel={imageZoomLevel}
                      setImageZoomLevel={setImageZoomLevel}
                      baselineContainerRef={baselineContainerRef}
                      currentContainerRef={currentContainerRef}
                      diffContainerRef={diffContainerRef}
                      handleSyncScroll={handleSyncScroll}
                      onOpenLightbox={setLightboxImage}
                      onApproveBaseline={(runId) => handleApproveBaseline(runId)}
                      onRejectChanges={(runId) => handleRejectChanges(runId)}
                      a11ySeverityFilter={a11ySeverityFilter as any}
                      setA11ySeverityFilter={setA11ySeverityFilter as any}
                      a11yCategoryFilter={a11yCategoryFilter as any}
                      setA11yCategoryFilter={setA11yCategoryFilter as any}
                      a11ySearchQuery={a11ySearchQuery as any}
                      setA11ySearchQuery={setA11ySearchQuery as any}
                      formatDateTime={formatDateTime}
                    />
                  ))}
                </div>
              )}`;

// Build the new content
const newLines = [
  ...lines.slice(0, markerLineNo),
  ...replacement.split('\n'),
  ...lines.slice(blockEndLine + 1)
];

const newContent = newLines.join('\n');

// Write the file
fs.writeFileSync(filePath, newContent, 'utf8');

const replacedLines = blockEndLine - markerLineNo + 1;
const newLineCount = replacement.split('\n').length;

console.log(`SUCCESS: Replaced ${replacedLines} lines with ${newLineCount} lines`);
console.log(`Estimated reduction: ${replacedLines - newLineCount} lines`);
