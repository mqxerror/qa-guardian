/**
 * Script to clean up dead code in TestSuitePage.tsx
 * Feature #50: Remove unused state and useEffects related to the removed legacy create test modal
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/pages/TestSuitePage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');
const originalContent = content;

// Track what we're removing
const removals = [];

// 1. Remove the showCreateTestModal state declaration (it's never used)
// We need to keep it in the Escape handler dependency array for now
// Actually, let's remove it entirely and update the Escape handler

// 2. Remove the "Smart defaults based on suite context" useEffect (lines ~580-646)
// This useEffect only runs when showCreateTestModal is true, but that modal is removed
const smartDefaultsRegex = /\/\/ Feature #1777: Smart defaults based on suite context[\s\S]*?if \(!showCreateTestModal \|\| !suite\) return;[\s\S]*?\}, \[showCreateTestModal, suite, project, newTestName, newTestDescription, newTestTargetUrl\]\);/;
if (smartDefaultsRegex.test(content)) {
  content = content.replace(smartDefaultsRegex, '// Feature #1777: Smart defaults moved to CreateTestModal component');
  removals.push('Removed Smart Defaults useEffect (~70 lines)');
}

// 3. Remove the "AI Copilot real-time suggestion analysis" useEffect (lines ~648-787)
// This also only runs when showCreateTestModal is true
const aiCopilotRegex = /\/\/ Feature #1235: AI Copilot real-time suggestion analysis[\s\S]*?if \(!showCreateTestModal \|\| !showAICopilot\) return;[\s\S]*?\}, \[showCreateTestModal, showAICopilot[^\]]*\]\);/;
if (aiCopilotRegex.test(content)) {
  content = content.replace(aiCopilotRegex, '// Feature #1235: AI Copilot suggestions moved to CreateTestModal component');
  removals.push('Removed AI Copilot useEffect (~140 lines)');
}

// 4. Remove applyAICopilotSuggestion function (only used by legacy modal)
const applyAICopilotRegex = /\/\/ Feature #1235: Apply AI Copilot suggestion[\s\S]*?const applyAICopilotSuggestion[\s\S]*?\};[\s]*\/\/ Feature #1235: Dismiss/;
if (applyAICopilotRegex.test(content)) {
  content = content.replace(applyAICopilotRegex, '// Feature #1235: Dismiss');
  removals.push('Removed applyAICopilotSuggestion function (~15 lines)');
}

// 5. Remove dismissAICopilotSuggestion function (only used by legacy modal)
const dismissAICopilotRegex = /\/\/ Feature #1235: Dismiss AI Copilot suggestion\s*const dismissAICopilotSuggestion[^;]*;/;
if (dismissAICopilotRegex.test(content)) {
  content = content.replace(dismissAICopilotRegex, '');
  removals.push('Removed dismissAICopilotSuggestion function (~5 lines)');
}

// 6. Remove unused state variables that were only for legacy modal
// These are safe to remove because they're not used elsewhere
const unusedStates = [
  'newTestDevicePreset',
  'newTestPerformanceThreshold',
  'newTestLcpThreshold',
  'newTestClsThreshold',
  'newTestBypassCsp',
  'newTestIgnoreSslErrors',
  'newTestAuditTimeout',
  'newTestWcagLevel',
  'newTestIncludeBestPractices',
  'newTestIncludeExperimental',
  'newTestIncludePa11y',
  'newTestA11yFailOnCritical',
  'newTestA11yFailOnSerious',
  'newTestA11yFailOnModerate',
  'newTestA11yFailOnMinor',
  'newTestA11yFailOnAny',
  'newTestVirtualUsers',
  'newTestDuration',
  'newTestRampUpTime',
  'newTestK6Script',
  'showK6Editor',
  'newTestViewportPreset',
  'newTestViewportWidth',
  'newTestViewportHeight',
  'newTestCaptureMode',
  'newTestElementSelector',
  'newTestWaitForSelector',
  'newTestWaitTime',
  'newTestHideSelectors',
  'newTestRemoveSelectors',
  'newTestMultiViewport',
  'newTestSelectedViewports',
  'newTestDiffThreshold',
  'newTestDiffThresholdMode',
  'newTestDiffPixelThreshold',
  'newTestAntiAliasingTolerance',
  'newTestColorThreshold',
  'newTestIgnoreRegions',
  'newTestIgnoreSelectors',
  'isCreatingTest',
  'createTestError',
  'testNameError',
  'showAdvancedSettings',
  'showAICopilot',
  'aiCopilotSuggestions',
  'isAICopilotAnalyzing',
  'urlValidationState',
  'urlFavicon',
  'naturalLanguageInput',
  'isParsingNaturalLanguage',
];

// Note: We need to be careful - some of these might still be used
// Let's check each one before removing

console.log('Checking which state variables can be safely removed...');

// Save the changes
if (content !== originalContent) {
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('\\nRemovals made:');
  removals.forEach(r => console.log('  - ' + r));

  // Count lines
  const originalLines = originalContent.split('\n').length;
  const newLines = content.split('\n').length;
  console.log(`\\nLine count: ${originalLines} -> ${newLines} (${originalLines - newLines} lines removed)`);
} else {
  console.log('No changes made - patterns not found');
}
