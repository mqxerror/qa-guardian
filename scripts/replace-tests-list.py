#!/usr/bin/env python3
"""
Replace the inline Tests List section in TestSuitePage.tsx with TestListSection component.
"""

import re

# Read the file
filepath = '/Users/mqxerrormac16/Documents/QA-Dam3oun/frontend/src/pages/TestSuitePage.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# Find the start marker
start_marker = '        {/* Tests List */}\n        <div className="mt-8">'
end_marker_pattern = r'              \}\)\}\n            </div>\n          \)\}\n        </div>\n\n        \{/\* Feature #1800: New two-section Create Test Modal \*/'

# Build the replacement component
replacement = '''        {/* Tests List - Feature #50: Extracted to TestListSection component */}
        <TestListSection
          tests={tests}
          filteredTests={filteredTests}
          sortedTests={sortedTests}
          searchQuery={searchQuery}
          sortField={sortField}
          sortDirection={sortDirection}
          suiteRun={suiteRun}
          openActionsDropdown={openActionsDropdown}
          runningTestId={runningTestId}
          canCreateTest={canCreateTest}
          onSearchChange={setSearchQuery}
          onSort={handleSort}
          onOpenCreateTestModal={() => setShowNewCreateTestModal(true)}
          onSetActionsDropdown={setOpenActionsDropdown}
          onRunSingleTest={handleRunSingleTest}
          onDuplicateTest={handleDuplicateTest}
          onShowTemplateModal={(testId) => {
            setInsertTemplateForTest(testId);
            setShowTemplateModal(true);
          }}
          onShowDeleteTestModal={setShowDeleteTestModal}
          loadStepTemplates={loadStepTemplates}
        />

        {/* Feature #1800: New two-section Create Test Modal */'''

# Find the start position
start_pos = content.find(start_marker)
if start_pos == -1:
    print(f"Could not find start marker")
    exit(1)

# Find the end position (search for the pattern after start_pos)
end_search = content[start_pos:]
end_match = re.search(end_marker_pattern, end_search)
if not end_match:
    print(f"Could not find end marker")
    exit(1)

# Calculate absolute end position
end_pos = start_pos + end_match.start() + len(end_match.group(0)) - len('\n\n        {/* Feature #1800: New two-section Create Test Modal */')

# Perform the replacement
new_content = content[:start_pos] + replacement + content[end_pos:]

# Write back
with open(filepath, 'w') as f:
    f.write(new_content)

print(f"Replaced Tests List section. Original length: {len(content)}, New length: {len(new_content)}")
print(f"Removed approximately {len(content) - len(new_content)} characters")
