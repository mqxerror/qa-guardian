#!/usr/bin/env node
/**
 * Replace the inline Record and Review modals in TestSuitePage.tsx
 * with the extracted RecordTestModal and ReviewRecordedTestModal components.
 * Feature #50: Modular test suite detail page
 */

const fs = require('fs');

const filepath = '/Users/mqxerrormac16/Documents/QA-Dam3oun/frontend/src/pages/TestSuitePage.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// Find the start of Record modal (line with the duplicate comment)
const recordStartMarker = '        {/* Record New Test Modal - Feature #26: Live Browser View */}\n        {/* Record New Test Modal - Feature #26: Live Browser View */}\n        {showRecordModal && (';
const recordStartPos = content.indexOf(recordStartMarker);

if (recordStartPos === -1) {
  console.log('Could not find Record modal start marker');
  process.exit(1);
}

// Find the end of Review modal
const reviewEndMarker = '        )}\n\n        {/* Feature #31: Insert Template Modal - Feature #50: Extracted to component */}';
const reviewEndPos = content.indexOf(reviewEndMarker, recordStartPos);

if (reviewEndPos === -1) {
  console.log('Could not find Review modal end marker');
  process.exit(1);
}

// Build the replacement with both modals as components
const replacement = `        {/* Record New Test Modal - Feature #26, #50: Extracted to RecordTestModal component */}
        <RecordTestModal
          isOpen={showRecordModal}
          isRecording={isRecording}
          onClose={() => setShowRecordModal(false)}
          recordTargetUrl={recordTargetUrl}
          onRecordTargetUrlChange={setRecordTargetUrl}
          recordedSteps={recordedSteps}
          onRecordedStepsChange={setRecordedSteps}
          recordingDeviceEnabled={recordingDeviceEnabled}
          onRecordingDeviceEnabledChange={setRecordingDeviceEnabled}
          recordingDeviceConfig={recordingDeviceConfig}
          onRecordingDeviceConfigChange={setRecordingDeviceConfig}
          recordingSessionId={recordingSessionId}
          onRecordingSessionIdChange={setRecordingSessionId}
          recordingElapsed={recordingElapsed}
          recordingFrame={recordingFrame}
          onRecordingFrameChange={setRecordingFrame}
          recordingConnected={recordingConnected}
          onRecordingConnectedChange={setRecordingConnected}
          recordingCurrentUrl={recordingCurrentUrl}
          onRecordingCurrentUrlChange={setRecordingCurrentUrl}
          reconnectAttempt={reconnectAttempt}
          onReconnectAttemptChange={setReconnectAttempt}
          reconnectFailed={reconnectFailed}
          onReconnectFailedChange={setReconnectFailed}
          staleFrameWarning={staleFrameWarning}
          onStaleFrameWarningChange={setStaleFrameWarning}
          showDebugOverlay={showDebugOverlay}
          onShowDebugOverlayChange={setShowDebugOverlay}
          clickRipple={clickRipple}
          onClickRippleChange={setClickRipple}
          recordingSocketRef={recordingSocketRef}
          browserViewRef={browserViewRef}
          browserImgRef={browserImgRef}
          frameScaleRef={frameScaleRef}
          lastFrameTimeRef={lastFrameTimeRef}
          staleFrameTimerRef={staleFrameTimerRef}
          frameRequestRef={frameRequestRef}
          pendingFrameRef={pendingFrameRef}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onCancelRecording={handleCancelRecording}
          onRetryConnection={handleRetryConnection}
          onStopAndSave={handleStopAndSave}
          projectBaseUrl={project?.base_url}
          token={token || ''}
          formatElapsed={formatElapsed}
          getActionIcon={getActionIcon}
        />

        {/* Review Recorded Test Modal - Feature #31, #37, #50: Extracted to component */}
        <ReviewRecordedTestModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          recordedSteps={recordedSteps}
          onRecordedStepsChange={setRecordedSteps}
          recordingDuration={recordingDuration}
          recordedTestName={recordedTestName}
          onRecordedTestNameChange={setRecordedTestName}
          recordedTestDescription={recordedTestDescription}
          onRecordedTestDescriptionChange={setRecordedTestDescription}
          isSavingRecordedTest={isSavingRecordedTest}
          onSaveRecordedTest={handleSaveRecordedTest}
          templateName={templateName}
          onTemplateNameChange={setTemplateName}
          isSavingTemplate={isSavingTemplate}
          onSaveAsTemplate={handleSaveAsTemplate}
          formatElapsed={formatElapsed}
          getActionIcon={getActionIcon}
        />

        {/* Feature #31: Insert Template Modal - Feature #50: Extracted to component */}`;

// Perform the replacement - include the full end marker content
const newContent = content.slice(0, recordStartPos) + replacement + content.slice(reviewEndPos + '        )}\n'.length);

// Write back
fs.writeFileSync(filepath, newContent);

const originalLines = content.split('\n').length;
const newLines = newContent.split('\n').length;
console.log(`Replaced Record and Review modals with components.`);
console.log(`Original: ${originalLines} lines, New: ${newLines} lines`);
console.log(`Removed approximately ${originalLines - newLines} lines`);
