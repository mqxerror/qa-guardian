/**
 * GeneratedTestPreviewModal Component
 * Feature #50: Extracted from TestSuitePage.tsx
 * Feature #1342: Generated Test Code Preview Modal
 * Feature #1153: Confidence Score Display
 * Feature #1163: Diff View and Regeneration
 */

import React from 'react';
import { GeneratedTestPreview } from '../useModalState';
import { computeCodeDiff, calculateTestConfidence, extractUrlFromText } from '../utils';

interface GeneratedTestPreviewModalProps {
  // Visibility
  isOpen: boolean;
  onClose: () => void;

  // Data
  preview: GeneratedTestPreview;
  generatedCode: string;
  previousCode: string | null;
  showDiffView: boolean;
  regenerationFeedback: string;
  isRegenerating: boolean;
  aiTestDescription: string;
  newTestTargetUrl: string;
  suiteId: string;
  token: string;

  // Callbacks
  onSetGeneratedCode: (code: string) => void;
  onSetPreview: (preview: GeneratedTestPreview | null) => void;
  onSetPreviousCode: (code: string | null) => void;
  onSetShowDiffView: (show: boolean) => void;
  onSetRegenerationFeedback: (feedback: string) => void;
  onSetIsRegenerating: (isRegenerating: boolean) => void;
  onUseTest: (testName: string, confidenceScore?: number) => void;
}

export function GeneratedTestPreviewModal({
  isOpen,
  onClose,
  preview,
  generatedCode,
  previousCode,
  showDiffView,
  regenerationFeedback,
  isRegenerating,
  aiTestDescription,
  newTestTargetUrl,
  suiteId,
  token,
  onSetGeneratedCode,
  onSetPreview,
  onSetPreviousCode,
  onSetShowDiffView,
  onSetRegenerationFeedback,
  onSetIsRegenerating,
  onUseTest,
}: GeneratedTestPreviewModalProps) {
  if (!isOpen || !preview) {
    return null;
  }

  const handleCancel = () => {
    onClose();
    onSetGeneratedCode('');
    onSetPreview(null);
    onSetPreviousCode(null);
    onSetShowDiffView(false);
    onSetRegenerationFeedback('');
  };

  const handleUseTest = () => {
    // Extract readable test name
    let readableName = '';
    if (preview.test_name) {
      readableName = preview.test_name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    }

    onUseTest(readableName, preview.confidence_score);
    handleCancel();
  };

  const handleRegenerate = async () => {
    onSetIsRegenerating(true);
    try {
      // Save current code as previous for diff view
      onSetPreviousCode(generatedCode);

      const response = await fetch('/api/v1/ai/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: `${aiTestDescription}\n\nFeedback for improvement: ${regenerationFeedback}`,
          suite_id: suiteId,
          base_url: extractUrlFromText(aiTestDescription) || newTestTargetUrl || undefined,
          test_type: 'e2e',
          include_assertions: true,
          include_screenshot: false,
          previous_code: generatedCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to regenerate test');
      }

      if (data.success && data.test) {
        onSetGeneratedCode(data.test.code);
        // Update preview with new data
        const confidence = calculateTestConfidence({
          syntax_valid: data.test.syntax_valid,
          syntax_errors: data.test.syntax_errors,
          assertions: data.test.assertions,
          selectors: data.test.selectors,
          steps: data.test.steps,
          complexity: data.test.complexity,
          warnings: data.test.warnings,
        });
        onSetPreview({
          test_name: data.test.test_name,
          steps: data.test.steps,
          selectors: data.test.selectors,
          assertions: data.test.assertions,
          syntax_valid: data.test.syntax_valid,
          syntax_errors: data.test.syntax_errors,
          complexity: data.test.complexity,
          warnings: data.test.warnings,
          confidence_score: confidence.score,
          confidence_factors: confidence.factors,
        });
        // Show diff view automatically after regeneration
        onSetShowDiffView(true);
        // Clear feedback after successful regeneration
        onSetRegenerationFeedback('');
      }
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      onSetIsRegenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-4xl rounded-lg bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Generated Playwright Test</h3>
              <p className="text-sm text-muted-foreground">Review the generated code before saving</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full font-medium ${
            preview.syntax_valid
              ? 'bg-green-500/10 text-green-600 border border-green-500/30'
              : 'bg-red-500/10 text-red-600 border border-red-500/30'
          }`}>
            {preview.syntax_valid ? '✓' : '✗'} Syntax {preview.syntax_valid ? 'Valid' : 'Invalid'}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full font-medium ${
            preview.complexity === 'simple' ? 'bg-green-500/10 text-green-600 border border-green-500/30' :
            preview.complexity === 'medium' ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/30' :
            'bg-orange-500/10 text-orange-600 border border-orange-500/30'
          }`}>
            {preview.complexity === 'simple' ? '📗' : preview.complexity === 'medium' ? '📙' : '📕'} {preview.complexity.charAt(0).toUpperCase() + preview.complexity.slice(1)} Complexity
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full font-medium bg-purple-500/10 text-purple-600 border border-purple-500/30">
            🎯 {preview.selectors.length} Selectors
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-full font-medium bg-blue-500/10 text-blue-600 border border-blue-500/30">
            ✓ {preview.assertions.length} Assertions
          </span>
        </div>

        {/* Feature #1153: Confidence Score Display */}
        {preview.confidence_score !== undefined && (
          <div className={`mb-4 p-4 rounded-lg border ${
            preview.confidence_score >= 80 ? 'bg-green-500/5 border-green-500/30' :
            preview.confidence_score >= 60 ? 'bg-yellow-500/5 border-yellow-500/30' :
            'bg-orange-500/5 border-orange-500/30'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-14 h-14 rounded-full border-4 ${
                  preview.confidence_score >= 80 ? 'border-green-500 text-green-600' :
                  preview.confidence_score >= 60 ? 'border-yellow-500 text-yellow-600' :
                  'border-orange-500 text-orange-600'
                }`}>
                  <span className="text-lg font-bold">{preview.confidence_score}%</span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">AI Confidence Score</h4>
                  <p className="text-sm text-muted-foreground">
                    {preview.confidence_score >= 80 ? 'High confidence - Ready for use' :
                     preview.confidence_score >= 60 ? 'Medium confidence - Review recommended' :
                     'Low confidence - Human review required'}
                  </p>
                </div>
              </div>
              {preview.confidence_score < 70 && (
                <span className="flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  ⚠️ Flagged for Review
                </span>
              )}
            </div>

            {/* Confidence Factors Breakdown */}
            {preview.confidence_factors && preview.confidence_factors.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-foreground mb-2">Score Breakdown</h5>
                {preview.confidence_factors.map((factor, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">{factor.factor}</span>
                        <span className={`font-medium ${
                          factor.score < 0 ? 'text-red-600' :
                          factor.max_score > 0 && factor.score >= factor.max_score * 0.7 ? 'text-green-600' :
                          factor.max_score > 0 && factor.score >= factor.max_score * 0.4 ? 'text-yellow-600' :
                          'text-orange-600'
                        }`}>
                          {factor.score < 0 ? factor.score : `${factor.score}/${factor.max_score}`}
                        </span>
                      </div>
                      {factor.max_score > 0 && (
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              factor.score >= factor.max_score * 0.7 ? 'bg-green-500' :
                              factor.score >= factor.max_score * 0.4 ? 'bg-yellow-500' :
                              'bg-orange-500'
                            }`}
                            style={{ width: `${Math.min(100, (factor.score / factor.max_score) * 100)}%` }}
                          />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{factor.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {preview.warnings && preview.warnings.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span>⚠️</span>
              <span className="font-medium text-yellow-700 dark:text-yellow-400">Warnings</span>
            </div>
            <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
              {preview.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Syntax Errors */}
        {preview.syntax_errors && preview.syntax_errors.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span>❌</span>
              <span className="font-medium text-red-700 dark:text-red-400">Syntax Errors</span>
            </div>
            <ul className="text-sm text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
              {preview.syntax_errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Test Details Grid */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Steps */}
          <div className="col-span-1">
            <h4 className="text-sm font-semibold text-foreground mb-2">📋 Test Steps</h4>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              {preview.steps.map((step, idx) => (
                <li key={idx} className="pl-1">{step}</li>
              ))}
            </ol>
          </div>

          {/* Selectors */}
          <div className="col-span-1">
            <h4 className="text-sm font-semibold text-foreground mb-2">🎯 Selectors Used</h4>
            {preview.selectors.length > 0 ? (
              <ul className="text-xs text-muted-foreground space-y-1.5">
                {preview.selectors.map((selector, idx) => (
                  <li key={idx} className="px-2 py-1 rounded bg-muted font-mono truncate" title={selector}>
                    {selector}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground italic">No specific selectors detected</p>
            )}
          </div>

          {/* Assertions */}
          <div className="col-span-1">
            <h4 className="text-sm font-semibold text-foreground mb-2">✓ Assertions</h4>
            {preview.assertions.length > 0 ? (
              <ul className="text-xs text-muted-foreground space-y-1.5">
                {preview.assertions.slice(0, 5).map((assertion, idx) => (
                  <li key={idx} className="px-2 py-1 rounded bg-muted font-mono truncate" title={assertion}>
                    {assertion.length > 40 ? assertion.substring(0, 40) + '...' : assertion}
                  </li>
                ))}
                {preview.assertions.length > 5 && (
                  <li className="text-muted-foreground text-xs">+{preview.assertions.length - 5} more...</li>
                )}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground italic">No assertions detected</p>
            )}
          </div>
        </div>

        {/* Code Preview */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">📝 Generated Code</h4>
              {/* Feature #1163: Diff view toggle */}
              {previousCode && (
                <button
                  type="button"
                  onClick={() => onSetShowDiffView(!showDiffView)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                    showDiffView
                      ? 'bg-purple-500/20 text-purple-600 border-purple-500/50'
                      : 'border-border hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {showDiffView ? '📊 Diff View' : '📊 Show Diff'}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generatedCode);
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted text-muted-foreground"
            >
              📋 Copy Code
            </button>
          </div>

          {/* Feature #1163: Diff View */}
          {showDiffView && previousCode ? (
            <div className="rounded-lg bg-[#1e1e1e] p-4 overflow-x-auto max-h-80 overflow-y-auto">
              <div className="font-mono text-sm space-y-0">
                {computeCodeDiff(previousCode, generatedCode).map((line, idx) => (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 ${
                      line.type === 'added'
                        ? 'bg-green-500/20 text-green-400 border-l-2 border-green-500'
                        : line.type === 'removed'
                        ? 'bg-red-500/20 text-red-400 border-l-2 border-red-500 line-through opacity-70'
                        : 'text-gray-400'
                    }`}
                  >
                    <span className="inline-block w-6 text-xs opacity-50 mr-2">
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    {line.line || '\u00A0'}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-green-500/30 border border-green-500"></span>
                  <span className="text-green-400">Added lines</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-500/30 border border-red-500"></span>
                  <span className="text-red-400">Removed lines</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-[#1e1e1e] p-4 overflow-x-auto max-h-80 overflow-y-auto">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap break-words">
                {generatedCode}
              </pre>
            </div>
          )}
        </div>

        {/* Feature #1163: Regenerate with Feedback */}
        <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <span>🔄</span>
            <span className="text-sm font-medium text-foreground">Refine This Test</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Provide feedback to regenerate the test with improvements
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={regenerationFeedback}
              onChange={(e) => onSetRegenerationFeedback(e.target.value)}
              placeholder="e.g., Add more assertions, use better selectors, include error handling..."
              className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <button
              type="button"
              disabled={isRegenerating || regenerationFeedback.trim().length < 5}
              onClick={handleRegenerate}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRegenerating ? (
                <>
                  <svg aria-hidden="true" className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Regenerating...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  Regenerate
                </>
              )}
            </button>
          </div>
          {previousCode && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <span>✓</span>
              Regenerated - click "Show Diff" to see changes
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUseTest}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-purple-600 text-white hover:bg-purple-700"
          >
            <span>✨</span>
            Use This Test
          </button>
        </div>
      </div>
    </div>
  );
}

export default GeneratedTestPreviewModal;
