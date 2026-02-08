/**
 * Script to clean up dead state variables in TestSuitePage.tsx - Version 3
 * Feature #50: Remove legacy create test modal state variables
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/pages/TestSuitePage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');
const originalContent = content;
let linesRemoved = 0;

// List of state variable patterns to remove (these are only declared but never used)
const stateToRemove = [
  // Legacy create test modal state - no longer used since CreateTestModal is self-contained
  /const \[showCreateTestModal, setShowCreateTestModal\] = useState\(false\);\n/g,
  /const \[newTestName, setNewTestName\] = useState\(''\);\n/g,
  /const \[newTestDescription, setNewTestDescription\] = useState\(''\);\n/g,
  /const \[newTestType, setNewTestType\] = useState<'e2e'[^;]+;\n/g,
  /const \[newTestDevicePreset, setNewTestDevicePreset\] = useState<'mobile' \| 'desktop'>\('desktop'\);\n/g,
  /const \[newTestPerformanceThreshold, setNewTestPerformanceThreshold\] = useState\(50\);[^\n]+\n/g,
  /const \[newTestLcpThreshold, setNewTestLcpThreshold\] = useState\(2500\);[^\n]+\n/g,
  /const \[newTestClsThreshold, setNewTestClsThreshold\] = useState\(0\.1\);[^\n]+\n/g,
  /const \[newTestBypassCsp, setNewTestBypassCsp\] = useState\(false\);[^\n]+\n/g,
  /const \[newTestIgnoreSslErrors, setNewTestIgnoreSslErrors\] = useState\(false\);[^\n]+\n/g,
  /const \[newTestAuditTimeout, setNewTestAuditTimeout\] = useState\(60\);[^\n]+\n/g,
  /\/\/ Accessibility test specific states\n/g,
  /const \[newTestWcagLevel, setNewTestWcagLevel\] = useState<'A'[^;]+;\n/g,
  /const \[newTestIncludeBestPractices, setNewTestIncludeBestPractices\] = useState\(true\);\n/g,
  /const \[newTestIncludeExperimental, setNewTestIncludeExperimental\] = useState\(false\);\n/g,
  /const \[newTestIncludePa11y, setNewTestIncludePa11y\] = useState\(false\);[^\n]+\n/g,
  /\/\/ Accessibility threshold states[^\n]+\n/g,
  /const \[newTestA11yFailOnCritical, setNewTestA11yFailOnCritical\] = useState<number \| undefined>\(0\);[^\n]+\n/g,
  /const \[newTestA11yFailOnSerious, setNewTestA11yFailOnSerious\] = useState<number \| undefined>\(undefined\);[^\n]+\n/g,
  /const \[newTestA11yFailOnModerate, setNewTestA11yFailOnModerate\] = useState<number \| undefined>\(undefined\);[^\n]+\n/g,
  /const \[newTestA11yFailOnMinor, setNewTestA11yFailOnMinor\] = useState<number \| undefined>\(undefined\);[^\n]+\n/g,
  /const \[newTestA11yFailOnAny, setNewTestA11yFailOnAny\] = useState\(false\);[^\n]+\n/g,
  /\/\/ K6 Load test specific states\n/g,
  /const \[newTestVirtualUsers, setNewTestVirtualUsers\] = useState\(10\);[^\n]+\n/g,
  /const \[newTestDuration, setNewTestDuration\] = useState\(60\);[^\n]+\n/g,
  /const \[newTestRampUpTime, setNewTestRampUpTime\] = useState\(10\);[^\n]+\n/g,
  /const \[newTestTargetUrl, setNewTestTargetUrl\] = useState\(''\);\n/g,
  /\/\/ Feature #1771: Smart URL input with validation\n/g,
  /const \[urlValidationState, setUrlValidationState\] = useState<'idle'[^;]+;\n/g,
  /const \[urlFavicon, setUrlFavicon\] = useState<string \| null>\(null\);\n/g,
  /\/\/ Feature #1772: Natural language input bar\n/g,
  /const \[naturalLanguageInput, setNaturalLanguageInput\] = useState\(''\);\n/g,
  /const \[isParsingNaturalLanguage, setIsParsingNaturalLanguage\] = useState\(false\);\n/g,
  /const \[newTestK6Script, setNewTestK6Script\] = useState\(''\);[^\n]+\n/g,
  /const \[showK6Editor, setShowK6Editor\] = useState\(false\);[^\n]+\n/g,
  /const \[newTestViewportPreset, setNewTestViewportPreset\] = useState\('desktop'\);\n/g,
  /const \[newTestViewportWidth, setNewTestViewportWidth\] = useState\(1920\);\n/g,
  /const \[newTestViewportHeight, setNewTestViewportHeight\] = useState\(1080\);\n/g,
  /const \[newTestCaptureMode, setNewTestCaptureMode\] = useState<'full_page'[^;]+;\n/g,
  /const \[newTestElementSelector, setNewTestElementSelector\] = useState\(''\);\n/g,
  /const \[newTestWaitForSelector, setNewTestWaitForSelector\] = useState\(''\);\n/g,
  /const \[newTestWaitTime, setNewTestWaitTime\] = useState<number \| undefined>\(undefined\);\n/g,
  /const \[newTestHideSelectors, setNewTestHideSelectors\] = useState\(''\);\n/g,
  /const \[newTestRemoveSelectors, setNewTestRemoveSelectors\] = useState\(''\);\n/g,
  /const \[newTestMultiViewport, setNewTestMultiViewport\] = useState\(false\);\n/g,
  /const \[newTestSelectedViewports, setNewTestSelectedViewports\] = useState<string\[\]>[^;]+;\n/g,
  /const \[newTestDiffThreshold, setNewTestDiffThreshold\] = useState\(0\);[^\n]+\n/g,
  /const \[newTestDiffThresholdMode, setNewTestDiffThresholdMode\] = useState<'percentage'[^;]+;\n/g,
  /const \[newTestDiffPixelThreshold, setNewTestDiffPixelThreshold\] = useState\(0\);[^\n]+\n/g,
  /\/\/ Feature #647: Anti-aliasing tolerance for cross-browser comparisons\n/g,
  /const \[newTestAntiAliasingTolerance, setNewTestAntiAliasingTolerance\] = useState<'off'[^;]+;\n/g,
  /const \[newTestColorThreshold, setNewTestColorThreshold\] = useState<number \| undefined>\(undefined\);[^\n]+\n/g,
  /const \[newTestIgnoreRegions, setNewTestIgnoreRegions\] = useState<Array<[^>]+>>\(\[\]\);\n/g,
  /const \[newTestIgnoreSelectors, setNewTestIgnoreSelectors\] = useState<string\[\]>\(\[\]\);\n/g,
  /const \[isCreatingTest, setIsCreatingTest\] = useState\(false\);\n/g,
  /const \[createTestError, setCreateTestError\] = useState\(''\);\n/g,
  /const \[testNameError, setTestNameError\] = useState\(''\);\n/g,
  /\/\/ Feature #1770: Progressive disclosure[^\n]+\n/g,
  /\/\/ Persists across modal opens via localStorage\n/g,
  /const \[showAdvancedSettings, setShowAdvancedSettings\] = useState\(\(\) => \{[\s\S]*?\}\);\n/g,
  /\/\/ Feature #1235: AI Test Copilot state\n/g,
  /const \[showAICopilot, setShowAICopilot\] = useState\(true\);\n/g,
  /const \[aiCopilotSuggestions, setAICopilotSuggestions\] = useState<Array<\{[\s\S]*?\}\>>\(\[\]\);\n/g,
  /const \[isAICopilotAnalyzing, setIsAICopilotAnalyzing\] = useState\(false\);\n/g,
  /const \[isTestFromAI, setIsTestFromAI\] = useState\(false\);[^\n]+\n/g,
  /const \[aiConfidenceScore, setAiConfidenceScore\] = useState<number \| undefined>\(undefined\);[^\n]+\n/g,
];

// Apply each removal pattern
let removedCount = 0;
stateToRemove.forEach((pattern, index) => {
  const before = content.length;
  content = content.replace(pattern, '');
  if (content.length < before) {
    removedCount++;
  }
});

// Save the changes
if (content !== originalContent) {
  fs.writeFileSync(filePath, content, 'utf-8');

  // Count lines
  const originalLines = originalContent.split('\n').length;
  const newLines = content.split('\n').length;
  console.log(`Removed ${removedCount} state declarations/comments`);
  console.log(`Line count: ${originalLines} -> ${newLines} (${originalLines - newLines} lines removed)`);
} else {
  console.log('No changes made');
}
