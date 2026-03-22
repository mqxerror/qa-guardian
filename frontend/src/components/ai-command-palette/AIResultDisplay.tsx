/**
 * AIResultDisplay - Renders the AI analysis result panel inside the command palette.
 * Extracted from AICommandPalette.tsx for component decomposition (Agent 7).
 */

import type { AICommandResult } from './types';

interface AIResultDisplayProps {
  result: AICommandResult;
  /** Reset AI result to return to the command list */
  onNewCommand: () => void;
  /** Close the entire palette */
  onClose: () => void;
}

export function AIResultDisplay({ result, onNewCommand, onClose }: AIResultDisplayProps) {
  return (
    <div className="p-4 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-foreground">{result.title}</h3>
        {result.confidence && (
          <span className="px-2 py-1 bg-primary/10 text-primary text-sm rounded">
            {result.confidence}% confidence
          </span>
        )}
      </div>
      <p className="text-foreground mb-4">{result.content}</p>
      {result.details && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Details:</p>
          <ul className="space-y-1">
            {result.details.map((detail, idx) => (
              <li key={idx} className="text-sm text-foreground flex items-start gap-2 p-2 rounded bg-muted/50">
                <span className="text-primary">•</span>
                {detail}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onNewCommand}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          New Command
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted"
        >
          Close
        </button>
      </div>
    </div>
  );
}
