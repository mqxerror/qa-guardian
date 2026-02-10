/**
 * AIPromptSection - Natural language prompt input with examples
 * Feature #610: Extracted from AIGenerateStep.tsx
 */
import React from 'react';

/**
 * Props for AIPromptSection
 */
export interface AIPromptSectionProps {
  /** Current input value */
  input: string;
  /** Whether AI is parsing the input */
  isParsing: boolean;
  /** Handler for input changes */
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Handler for setting input directly (e.g., from examples) */
  setInput: (value: string) => void;
  /** Example prompts to show when input is empty */
  examples: string[];
  /** Error message if any */
  error: string | null;
}

/**
 * AIPromptSection component
 * Textarea for natural language input with example prompts and error display
 */
export const AIPromptSection: React.FC<AIPromptSectionProps> = ({
  input,
  isParsing,
  onInputChange,
  setInput,
  examples,
  error,
}) => {
  return (
    <>
      {/* Textarea */}
      <div>
        <textarea
          value={input}
          onChange={onInputChange}
          placeholder="Example: Test the login form on https://myapp.com using mobile viewport..."
          className="w-full h-32 px-4 py-3 border border-border rounded-xl bg-muted/50 text-foreground placeholder-muted-foreground resize-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          autoFocus
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-muted-foreground">
            {input.length} characters
          </span>
          {isParsing && (
            <span className="flex items-center gap-1.5 text-xs text-primary">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {/* Feature #588: Show AI analyzing when using backend service */}
              AI Analyzing...
            </span>
          )}
        </div>
      </div>

      {/* Examples */}
      {!input && (
        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Try one of these examples:
          </p>
          <div className="space-y-0.5">
            {examples.slice(0, 3).map((example, i) => (
              <button
                key={i}
                onClick={() => setInput(example)}
                className="block w-full text-left text-sm text-foreground hover:text-primary py-1.5 px-2 rounded-md hover:bg-muted/80 transition-colors"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feature #588: Error Display */}
      {error && (
        <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Using local parsing as fallback. Your test configuration may have reduced accuracy.
          </p>
        </div>
      )}
    </>
  );
};

AIPromptSection.displayName = 'AIPromptSection';
