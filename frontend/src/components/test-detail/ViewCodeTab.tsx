// Feature #48: ViewCodeTab - Extracted from TestDetailPage.tsx
// Displays Playwright code for test cases with edit capability

import { useState } from 'react';
import { toast } from '../../stores/toastStore';

interface ViewCodeTabProps {
  test: {
    use_custom_code?: boolean;
    playwright_code?: string;
    steps?: Array<{ action: string; value?: string; selector?: string }>;
    test_type?: string;
  } | null;
  canEdit: boolean;
  isEditingCode: boolean;
  editedCode: string;
  codeError: string;
  isSavingCode: boolean;
  isExplainingTest: boolean;
  onSetEditedCode: (code: string) => void;
  onStartEditCode: () => void;
  onCancelEditCode: () => void;
  onSaveCode: () => void;
  onRevertToSteps: () => void;
  onExplainTest: () => void;
  generatePlaywrightCode: (steps: Array<{ action: string; value?: string; selector?: string }>) => string;
}

export function ViewCodeTab({
  test,
  canEdit,
  isEditingCode,
  editedCode,
  codeError,
  isSavingCode,
  isExplainingTest,
  onSetEditedCode,
  onStartEditCode,
  onCancelEditCode,
  onSaveCode,
  onRevertToSteps,
  onExplainTest,
  generatePlaywrightCode,
}: ViewCodeTabProps) {
  const handleCopyCode = () => {
    const code = test?.use_custom_code && test?.playwright_code
      ? test.playwright_code
      : generatePlaywrightCode(test?.steps || []);
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  return (
    <div className="mt-4">
      {/* Header with mode indicator and actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {test?.use_custom_code ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-warning"></span>
                Custom Playwright code (advanced mode)
              </span>
            ) : isEditingCode ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Editing Playwright code...
              </span>
            ) : (
              'Generated Playwright test code (TypeScript)'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditingCode && (
            <>
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                Copy
              </button>
              <button
                onClick={onExplainTest}
                disabled={isExplainingTest}
                className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent/80 hover:underline disabled:opacity-50"
              >
                {isExplainingTest ? (
                  <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                )}
                Explain
              </button>
              {canEdit && (
                <button
                  onClick={onStartEditCode}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit Code
                </button>
              )}
            </>
          )}
          {isEditingCode && (
            <>
              <button
                onClick={onCancelEditCode}
                disabled={isSavingCode}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onSaveCode}
                disabled={isSavingCode || !editedCode.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white hover:bg-success/90 disabled:opacity-50"
              >
                {isSavingCode ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/>
                      <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Save Code
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Code error display */}
      {codeError && (
        <div role="alert" className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {codeError}
        </div>
      )}

      {/* Code display or editor */}
      {isEditingCode ? (
        <div className="relative">
          <textarea
            value={editedCode}
            onChange={(e) => onSetEditedCode(e.target.value)}
            className="w-full h-96 rounded-lg bg-background p-4 text-sm text-foreground font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Enter your Playwright test code here..."
            spellCheck={false}
          />
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {editedCode.split('\n').length} lines
          </div>
        </div>
      ) : (
        <pre className="rounded-lg bg-background p-4 overflow-x-auto text-sm max-h-96 overflow-y-auto">
          <code className="text-foreground font-mono whitespace-pre">
            {test?.use_custom_code && test?.playwright_code
              ? test.playwright_code
              : generatePlaywrightCode(test?.steps || [])}
          </code>
        </pre>
      )}

      {/* Footer tips and actions */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {test?.use_custom_code ? (
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Using custom code. Test steps are ignored when running this test.
            </span>
          ) : isEditingCode ? (
            <span>✏️ Edit the code above and click "Save Code" to use custom Playwright code instead of generated steps.</span>
          ) : (
            <span>💡 Click "Edit Code" to write custom Playwright code for advanced testing scenarios.</span>
          )}
        </div>
        {test?.use_custom_code && !isEditingCode && canEdit && (
          <button
            onClick={onRevertToSteps}
            disabled={isSavingCode}
            className="inline-flex items-center gap-1 text-sm text-warning hover:text-warning hover:underline disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Revert to Steps
          </button>
        )}
      </div>
    </div>
  );
}
