// Feature #48: ViewCodeTab - Extracted from TestDetailPage.tsx
// Displays Playwright code for test cases with edit capability

import { useState } from 'react';
import { Copy, Loader2, HelpCircle, FileEdit, Save, Info, RotateCcw } from 'lucide-react';
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
                <Copy size={14} />
                Copy
              </button>
              <button
                onClick={onExplainTest}
                disabled={isExplainingTest}
                className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent/80 hover:underline disabled:opacity-50"
              >
                {isExplainingTest ? (
                  <Loader2 className="animate-spin w-3.5 h-3.5" />
                ) : (
                  <HelpCircle size={14} />
                )}
                Explain
              </button>
              {canEdit && (
                <button
                  onClick={onStartEditCode}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <FileEdit size={14} />
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
                className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-success/90 disabled:opacity-50"
              >
                {isSavingCode ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} />
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
              <Info size={12} />
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
            <RotateCcw size={14} />
            Revert to Steps
          </button>
        )}
      </div>
    </div>
  );
}
