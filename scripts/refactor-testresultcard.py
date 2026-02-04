#!/usr/bin/env python3
"""
Feature #48: Integrate TestResultCard into TestDetailPage.tsx
This script replaces inline test results rendering code with the TestResultCard component.
"""

import re

# Read the file
with open('frontend/src/pages/TestDetailPage.tsx', 'r') as f:
    content = f.read()

# The inline code block to replace
# Starts at: {/* Test Results - remaining inline code */}
# Ends at: the closing of the results.map container

# Find the start marker
start_marker = "{/* Test Results - remaining inline code */}"
start_idx = content.find(start_marker)

if start_idx == -1:
    print("ERROR: Could not find start marker")
    exit(1)

# Find where currentRun.results && starts (after the marker)
results_check_pattern = r'{currentRun\.results && currentRun\.results\.length > 0 && \('
match = re.search(results_check_pattern, content[start_idx:])
if not match:
    print("ERROR: Could not find results check pattern")
    exit(1)

actual_start = start_idx

# Now we need to find the closing of this entire block
# The block structure is:
# {currentRun.results && currentRun.results.length > 0 && (
#   <div className="mt-4 space-y-4">
#     {currentRun.results.map((result) => (
#       ...thousands of lines...
#     ))}
#   </div>
# )}

# We need to find the matching closing bracket
# Start after the marker line and count brackets

lines = content.split('\n')
marker_line_no = None

for i, line in enumerate(lines):
    if start_marker in line:
        marker_line_no = i
        break

if marker_line_no is None:
    print("ERROR: Could not find marker line")
    exit(1)

print(f"Found marker at line {marker_line_no + 1}")

# Find the end of the inline code block
# We're looking for the line that closes the currentRun.results block
# It should be: )}
# And then followed by </div> </div> and {/* Flakiness Trend...

# Start counting from the line after the marker
brace_count = 0
paren_count = 0
jsx_depth = 0
block_start_line = marker_line_no + 1  # Line with {currentRun.results &&
block_end_line = None

# Find the start of the conditional block
for i in range(marker_line_no + 1, len(lines)):
    if 'currentRun.results && currentRun.results.length > 0' in lines[i]:
        block_start_line = i
        # Initial count: { and (
        brace_count = 1
        paren_count = 1
        break

if block_start_line is None:
    print("ERROR: Could not find block start")
    exit(1)

print(f"Block starts at line {block_start_line + 1}")

# Count brackets to find the end
for i in range(block_start_line + 1, len(lines)):
    line = lines[i]

    # Simple bracket counting (ignoring strings for simplicity)
    for char in line:
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
        elif char == '(':
            paren_count += 1
        elif char == ')':
            paren_count -= 1

    # When both counts return to 0, we've found the end
    if brace_count == 0 and paren_count == 0:
        block_end_line = i
        break

if block_end_line is None:
    print("ERROR: Could not find block end")
    print(f"Final brace_count: {brace_count}, paren_count: {paren_count}")
    exit(1)

print(f"Block ends at line {block_end_line + 1}")
print(f"Total lines to replace: {block_end_line - marker_line_no + 1}")

# Build the replacement code
replacement = '''              {/* Test Results - Feature #48: Extracted to TestResultCard component */}
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
              )}'''

# Build the new content
new_lines = lines[:marker_line_no] + replacement.split('\n') + lines[block_end_line + 1:]
new_content = '\n'.join(new_lines)

# Write the file
with open('frontend/src/pages/TestDetailPage.tsx', 'w') as f:
    f.write(new_content)

print(f"SUCCESS: Replaced {block_end_line - marker_line_no + 1} lines with {len(replacement.split(chr(10)))} lines")
print("Running TypeScript check...")

import subprocess
result = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True, cwd='frontend')
if result.returncode == 0:
    print("BUILD PASSED!")
else:
    print("BUILD FAILED!")
    print(result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)
    print(result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr)
