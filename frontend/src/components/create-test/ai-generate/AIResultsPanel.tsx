/**
 * AIResultsPanel - Detected configuration preview card
 * Feature #610: Extracted from AIGenerateStep.tsx
 */
import React from 'react';
import {
  TEST_TYPE_CONFIG,
  VIEWPORT_CONFIG,
  getConfidenceLevel,
  type DetectedTestType,
  type ViewportPreset,
} from './types';

/**
 * AI parsing result structure
 */
export interface AIParseResult {
  testType: DetectedTestType;
  testTypeConfidence: number;
  url: string | null;
  urlConfidence: number;
  viewport: { preset: ViewportPreset; width: number; height: number };
  viewportConfidence: number;
  overallConfidence: number;
  suggestions: string[];
}

/**
 * Props for AIResultsPanel
 */
export interface AIResultsPanelProps {
  /** The parsing result to display */
  result: AIParseResult;
  /** Handler to open edit modal */
  onEditClick: () => void;
}

/**
 * AIResultsPanel component
 * Displays the detected test configuration with confidence score
 */
export const AIResultsPanel: React.FC<AIResultsPanelProps> = ({
  result,
  onEditClick,
}) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-foreground">
          Detected Configuration
        </h4>
        <div className="flex items-center gap-2">
          {/* Confidence Score */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            getConfidenceLevel(result.overallConfidence).color === 'green'
              ? 'bg-success/10 text-success'
              : getConfidenceLevel(result.overallConfidence).color === 'yellow'
              ? 'bg-warning/10 text-warning'
              : getConfidenceLevel(result.overallConfidence).color === 'orange'
              ? 'bg-warning/10 text-warning'
              : 'bg-destructive/10 text-destructive'
          }`}>
            <span>{Math.round(result.overallConfidence * 100)}%</span>
            <span>confidence</span>
          </div>
          {/* Edit Button */}
          <button
            onClick={onEditClick}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-muted/80 rounded-md transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Test Type */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
            result.testType
              ? TEST_TYPE_CONFIG[result.testType].iconBg
              : 'bg-muted'
          }`}>
            {result.testType ? TEST_TYPE_CONFIG[result.testType].icon : '?'}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Test Type</p>
            <p className="text-sm font-medium text-foreground">
              {result.testType ? TEST_TYPE_CONFIG[result.testType].label : 'Not detected'}
            </p>
          </div>
        </div>

        {/* URL */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-primary/10">
            🌐
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Target URL</p>
            <p className="text-sm font-medium text-foreground truncate">
              {result.url || 'Not detected'}
            </p>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-muted">
            {VIEWPORT_CONFIG[result.viewport.preset].icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Viewport</p>
            <p className="text-sm font-medium text-foreground">
              {VIEWPORT_CONFIG[result.viewport.preset].label} ({result.viewport.width}×{result.viewport.height})
            </p>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-medium text-warning mb-1.5">
            Suggestions to improve detection:
          </p>
          <ul className="space-y-1">
            {result.suggestions.map((suggestion, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-warning mt-0.5">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

AIResultsPanel.displayName = 'AIResultsPanel';
