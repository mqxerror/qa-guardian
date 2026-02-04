#!/usr/bin/env node
/**
 * Replace the inline Generated Test Code Preview Modal in TestSuitePage.tsx
 * with the GeneratedTestPreviewModal component.
 * Feature #50: Modular test suite detail page
 */

const fs = require('fs');

const filepath = '/Users/mqxerrormac16/Documents/QA-Dam3oun/frontend/src/pages/TestSuitePage.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// Find the start marker - the comment for Feature #1342
const startMarker = '        {/* Feature #1342: Generated Test Code Preview Modal */}\n        {showGeneratedCodeModal && generatedTestPreview && (';
const startPos = content.indexOf(startMarker);

if (startPos === -1) {
  console.log('Could not find start marker');
  process.exit(1);
}

// Find the end marker - the closing of the modal and start of the next modal
const endMarker = '        )}\n\n        {/* Record New Test Modal - Feature #26: Live Browser View */}';
const endPos = content.indexOf(endMarker, startPos);

if (endPos === -1) {
  console.log('Could not find end marker');
  process.exit(1);
}

// Build the replacement component
const replacement = `        {/* Feature #1342: Generated Test Code Preview Modal - Extracted to component */}
        <GeneratedTestPreviewModal
          isOpen={showGeneratedCodeModal}
          onClose={() => setShowGeneratedCodeModal(false)}
          preview={generatedTestPreview!}
          generatedCode={generatedTestCode}
          previousCode={previousGeneratedCode}
          showDiffView={showDiffView}
          regenerationFeedback={regenerationFeedback}
          isRegenerating={isRegenerating}
          aiTestDescription={aiTestDescription}
          newTestTargetUrl={newTestTargetUrl}
          suiteId={suiteId || ''}
          token={token || ''}
          onSetGeneratedCode={setGeneratedTestCode}
          onSetPreview={setGeneratedTestPreview}
          onSetPreviousCode={setPreviousGeneratedCode}
          onSetShowDiffView={setShowDiffView}
          onSetRegenerationFeedback={setRegenerationFeedback}
          onSetIsRegenerating={setIsRegenerating}
          onUseTest={(testName, confidenceScore) => {
            if (testName) {
              setNewTestName(testName);
            }
            if (aiTestDescription) {
              setNewTestDescription(aiTestDescription);
            }
            setIsTestFromAI(true);
            if (confidenceScore !== undefined) {
              setAiConfidenceScore(confidenceScore);
            }
            setShowGeneratedCodeModal(false);
            setShowAITestGenerator(false);
            setGeneratedTestCode('');
            setGeneratedTestPreview(null);
            setAITestDescription('');
            setPreviousGeneratedCode(null);
            setShowDiffView(false);
            setRegenerationFeedback('');
          }}
        />

        {/* Record New Test Modal - Feature #26: Live Browser View */}`;

// Perform the replacement - include the closing )}
const actualEndPos = endPos + '        )}';
const newContent = content.slice(0, startPos) + replacement + content.slice(endPos + '        )}\n'.length);

// Write back
fs.writeFileSync(filepath, newContent);

const originalLines = content.split('\n').length;
const newLines = newContent.split('\n').length;
console.log(`Replaced Generated Test Code Preview Modal.`);
console.log(`Original: ${originalLines} lines, New: ${newLines} lines`);
console.log(`Removed approximately ${originalLines - newLines} lines`);
