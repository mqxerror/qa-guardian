#!/usr/bin/env node
/**
 * Replace the inline Tests List section in TestSuitePage.tsx with TestListSection component.
 */

const fs = require('fs');

const filepath = '/Users/mqxerrormac16/Documents/QA-Dam3oun/frontend/src/pages/TestSuitePage.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// Find the start marker
const startMarker = '        {/* Tests List */}\n        <div className="mt-8">';
const startPos = content.indexOf(startMarker);

if (startPos === -1) {
  console.log('Could not find start marker');
  process.exit(1);
}

// Find the end marker - the CreateTestModal comment
const endMarker = '        {/* Feature #1800: New two-section Create Test Modal */}';
const endPos = content.indexOf(endMarker, startPos);

if (endPos === -1) {
  console.log('Could not find end marker');
  process.exit(1);
}

// Build the replacement component
const replacement = `        {/* Tests List - Feature #50: Extracted to TestListSection component */}
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

        `;

// Perform the replacement
const newContent = content.slice(0, startPos) + replacement + content.slice(endPos);

// Write back
fs.writeFileSync(filepath, newContent);

const originalLines = content.split('\n').length;
const newLines = newContent.split('\n').length;
console.log(`Replaced Tests List section.`);
console.log(`Original: ${originalLines} lines, New: ${newLines} lines`);
console.log(`Removed approximately ${originalLines - newLines} lines`);
