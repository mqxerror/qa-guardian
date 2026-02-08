/**
 * Script to clean up more dead state variables in TestSuitePage.tsx - Version 4
 * Feature #50: Remove AI test generation state that's no longer used
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/pages/TestSuitePage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');
const originalContent = content;

// Count initial lines
const originalLines = originalContent.split('\n').length;

// Remove unused AI test generation wizard state
const removePatterns = [
  // Feature #1162: AI Test Generation Wizard state
  /\/\/ Feature #1162: AI Test Generation Wizard state\n/g,
  /const \[wizardStep, setWizardStep\] = useState<1 \| 2 \| 3>\(1\);\n/g,
  /const \[wizardTestDescription, setWizardTestDescription\] = useState\(''\);\n/g,
  /const \[wizardTargetUrl, setWizardTargetUrl\] = useState\(''\);\n/g,
  /const \[wizardGeneratedCode, setWizardGeneratedCode\] = useState\(''\);\n/g,
  /const \[wizardCustomizedCode, setWizardCustomizedCode\] = useState\(''\);\n/g,
  /const \[wizardTestName, setWizardTestName\] = useState\(''\);\n/g,
  /const \[isWizardGenerating, setIsWizardGenerating\] = useState\(false\);\n/g,
  /const \[wizardError, setWizardError\] = useState\(''\);\n/g,

  // Feature #1149: User Story to Test Suite state
  /\/\/ Feature #1149: User Story to Test Suite state\n/g,
  /const \[userStoryInput, setUserStoryInput\] = useState\(''\);\n/g,
  /const \[isGeneratingTestSuite, setIsGeneratingTestSuite\] = useState\(false\);\n/g,
  /const \[generatedTestSuite, setGeneratedTestSuite\] = useState<\{[\s\S]*?\} \| null>\(null\);\n/g,
  /const \[showTestSuitePreview, setShowTestSuitePreview\] = useState\(false\);\n/g,
  /const \[selectedTestFromSuite, setSelectedTestFromSuite\] = useState<number \| null>\(null\);\n/g,
  /const \[includeEdgeCases, setIncludeEdgeCases\] = useState\(true\);\n/g,

  // Feature #1150: Gherkin to Playwright conversion state
  /\/\/ Feature #1150: Gherkin to Playwright conversion state\n/g,
  /const \[gherkinInput, setGherkinInput\] = useState\(''\);\n/g,
  /const \[isConvertingGherkin, setIsConvertingGherkin\] = useState\(false\);\n/g,
  /const \[convertedGherkinTest, setConvertedGherkinTest\] = useState<\{[\s\S]*?\} \| null>\(null\);\n/g,

  // Feature #1166: OpenAPI/Swagger API test generation state
  /\/\/ Feature #1166: OpenAPI\/Swagger API test generation state\n/g,
  /const \[openApiSpecInput, setOpenApiSpecInput\] = useState\(''\);\n/g,
  /const \[parsedOpenApiEndpoints, setParsedOpenApiEndpoints\] = useState<Array<\{[\s\S]*?\}>>\(\[\]\);\n/g,
  /const \[isParsingOpenApi, setIsParsingOpenApi\] = useState\(false\);\n/g,
  /const \[openApiParseError, setOpenApiParseError\] = useState\(''\);\n/g,
  /const \[isGeneratingApiTests, setIsGeneratingApiTests\] = useState\(false\);\n/g,
  /const \[generatedApiTests, setGeneratedApiTests\] = useState<Array<\{[\s\S]*?\}> \| null>\(null\);\n/g,

  // Feature #1151: Human review workflow for AI tests (only declaration, not used)
  /\/\/ Feature #1151: Human review workflow for AI tests\n/g,
  /const \[requireHumanReview, setRequireHumanReview\] = useState\(false\);\n/g,
  /const \[pendingReviewTests, setPendingReviewTests\] = useState<Array<any>>\(\[\]\);\n/g,
  /const \[reviewStats, setReviewStats\] = useState<\{[\s\S]*?\} \| null>\(null\);\n/g,
  /const \[showReviewPanel, setShowReviewPanel\] = useState\(false\);\n/g,
  /const \[isApproving, setIsApproving\] = useState\(false\);\n/g,
  /\/\/ Feature #1152: Batch review AI-generated tests\n/g,
  /const \[selectedForReview, setSelectedForReview\] = useState<Set<string>>\(new Set\(\)\);\n/g,

  // Screenshot annotation state
  /const \[screenshotFile, setScreenshotFile\] = useState<File \| null>\(null\);\n/g,
  /const \[screenshotPreview, setScreenshotPreview\] = useState<string \| null>\(null\);\n/g,
  /const \[screenshotContext, setScreenshotContext\] = useState\(''\);\n/g,
  /const \[isAnalyzingScreenshot, setIsAnalyzingScreenshot\] = useState\(false\);\n/g,
  /const \[screenshotAnalysis, setScreenshotAnalysis\] = useState<\{[\s\S]*?\} \| null>\(null\);\n/g,
  /const screenshotInputRef = useRef<HTMLInputElement>\(null\);\n/g,

  // Feature #1163: Code diff view for regenerations
  /\/\/ Feature #1163: Code diff view for regenerations\n/g,
  /const \[regenerationFeedback, setRegenerationFeedback\] = useState\(''\);\n/g,
  /const \[isRegenerating, setIsRegenerating\] = useState\(false\);\n/g,
  /const \[previousGeneratedCode, setPreviousGeneratedCode\] = useState<string \| null>\(null\);\n/g,
  /const \[showDiffView, setShowDiffView\] = useState\(false\);\n/g,

  // Feature #1155: Screenshot annotation state
  /\/\/ Feature #1155: Screenshot annotation state\n/g,
  /type AnnotationType = 'click' \| 'type' \| 'expect';\n/g,
  /interface Annotation \{[\s\S]*?\}\n/g,
  /const \[annotations, setAnnotations\] = useState<Annotation\[\]>\(\[\]\);\n/g,
  /const \[currentAnnotationTool, setCurrentAnnotationTool\] = useState<AnnotationType \| null>\(null\);\n/g,
  /const \[isDrawing, setIsDrawing\] = useState\(false\);\n/g,
  /const \[drawStart, setDrawStart\] = useState<\{ x: number; y: number \} \| null>\(null\);\n/g,
  /const \[pendingAnnotation, setPendingAnnotation\] = useState<Partial<Annotation> \| null>\(null\);\n/g,
  /const \[annotationLabelInput, setAnnotationLabelInput\] = useState\(''\);\n/g,
  /const canvasRef = useRef<HTMLCanvasElement>\(null\);\n/g,
  /const imageRef = useRef<HTMLImageElement>\(null\);\n/g,

  // Feature #1343: Screenshot-to-Test Conversion state comment
  /\/\/ Feature #1343: Screenshot-to-Test Conversion state\n/g,
  /const \[aiGenMode, setAIGenMode\] = useState<'text' \| 'screenshot' \| 'user-story' \| 'gherkin' \| 'wizard' \| 'openapi'>\('text'\);\n/g,
];

// Apply each removal pattern
let removedCount = 0;
removePatterns.forEach(pattern => {
  const before = content.length;
  content = content.replace(pattern, '');
  if (content.length < before) {
    removedCount++;
  }
});

// Save the changes
if (content !== originalContent) {
  fs.writeFileSync(filePath, content, 'utf-8');
  const newLines = content.split('\n').length;
  console.log(`Removed ${removedCount} patterns`);
  console.log(`Line count: ${originalLines} -> ${newLines} (${originalLines - newLines} lines removed)`);
} else {
  console.log('No changes made');
}
