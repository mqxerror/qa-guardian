// Feature #1441: Split App.tsx into logical modules
// Message renderer components extracted from QAChatWidget.tsx

import React from 'react';
import type { ChatMessage } from './types';

// Props types for each renderer
type TestResultsData = NonNullable<ChatMessage['data']>['tests'];
type ExplanationData = NonNullable<ChatMessage['data']>['explanation'];
type ActionData = NonNullable<ChatMessage['data']>['action'];
type DebugData = NonNullable<ChatMessage['data']>['debug'];
type SuggestionsData = NonNullable<ChatMessage['data']>['suggestions'];
type AnalysisData = NonNullable<ChatMessage['data']>['analysis'];

interface TestResultsMessageProps {
  tests: TestResultsData;
}

interface ExplanationMessageProps {
  explanation: ExplanationData;
}

interface ActionResultMessageProps {
  action: ActionData;
}

interface DebugAnalysisMessageProps {
  debug: DebugData;
}

interface SuggestionsMessageProps {
  suggestions: SuggestionsData;
}

interface ScreenshotAnalysisMessageProps {
  analysis: AnalysisData;
}

/**
 * Renders test results with status indicators and error messages
 */
export function TestResultsMessage({ tests }: TestResultsMessageProps) {
  if (!tests) return null;

  return (
    <div className="mt-2 space-y-2">
      {tests.map((test) => (
        <div key={test.id} className="rounded-md bg-background/50 p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="font-medium">{test.name}</span>
          </div>
          <div className="mt-1 text-muted-foreground">
            <span className="mr-2">📁 {test.suite}</span>
            <span>⏱️ {test.duration}s</span>
          </div>
          {test.error && (
            <div className="mt-1 text-red-400 text-xs font-mono bg-red-500/10 rounded px-1 py-0.5">
              {test.error}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Renders root cause explanation with evidence and fix suggestions
 */
export function ExplanationMessage({ explanation }: ExplanationMessageProps) {
  if (!explanation) return null;

  return (
    <div className="mt-2 space-y-2 text-xs">
      <div className="rounded-md bg-background/50 p-2">
        <p className="font-medium text-foreground">Summary:</p>
        <p className="text-muted-foreground">{explanation.summary}</p>
      </div>
      <div className="rounded-md bg-background/50 p-2">
        <p className="font-medium text-foreground">Root Cause:</p>
        <p className="text-muted-foreground">{explanation.root_cause}</p>
      </div>
      <div className="rounded-md bg-background/50 p-2">
        <p className="font-medium text-foreground mb-1">Evidence:</p>
        {explanation.evidence.map((e, i) => (
          <p key={i} className="text-muted-foreground">{e}</p>
        ))}
      </div>
      <div className="rounded-md bg-green-500/10 border border-green-500/20 p-2">
        <p className="font-medium text-green-600">💡 Suggested Fix:</p>
        <p className="text-muted-foreground">{explanation.fix_suggestion}</p>
      </div>
    </div>
  );
}

/**
 * Renders action results like fix applied, test running, test completed
 */
export function ActionResultMessage({ action }: ActionResultMessageProps) {
  if (!action) return null;

  return (
    <div className="mt-2">
      <div className={`rounded-md p-2 text-xs ${
        action.type === 'test_completed' && action.success
          ? 'bg-green-500/10 border border-green-500/20'
          : action.type === 'test_running'
          ? 'bg-blue-500/10 border border-blue-500/20'
          : 'bg-amber-500/10 border border-amber-500/20'
      }`}>
        {action.type === 'test_running' && (
          <div className="flex items-center gap-2">
            <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span>{action.details}</span>
          </div>
        )}
        {action.type !== 'test_running' && (
          <span>{action.details}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Renders debug analysis with step-by-step breakdown and failure details
 */
export function DebugAnalysisMessage({ debug }: DebugAnalysisMessageProps) {
  if (!debug) return null;

  return (
    <div className="mt-2 space-y-2">
      {debug.steps.map((step) => (
        <div key={step.number} className={`rounded-md p-2 text-xs ${
          step.status === 'passed' ? 'bg-green-500/10 border border-green-500/20' :
          step.status === 'failed' ? 'bg-red-500/10 border border-red-500/20' :
          'bg-gray-500/10 border border-border/20'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step.status === 'passed' ? 'bg-green-500 text-white' :
              step.status === 'failed' ? 'bg-red-500 text-white' :
              'bg-gray-400 text-white'
            }`}>{step.number}</span>
            <span className="flex-1">{step.action}</span>
            <span className={`text-[10px] ${
              step.status === 'passed' ? 'text-green-600' :
              step.status === 'failed' ? 'text-red-600' :
              'text-muted-foreground'
            }`}>
              {step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '○'} {step.duration > 0 ? `${step.duration}s` : ''}
            </span>
          </div>
          {step.error && (
            <div className="mt-1 text-red-400 text-[10px] font-mono bg-red-500/10 rounded px-1 py-0.5">
              {step.error}
            </div>
          )}
        </div>
      ))}
      {debug.failure_details && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-2 mt-2">
          <p className="text-xs font-medium text-red-600">💥 Step {debug.failure_details.step} failed because:</p>
          <p className="text-xs text-red-500 mt-1">{debug.failure_details.reason}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Renders fix suggestions with priority, confidence, and code snippets
 */
export function SuggestionsMessage({ suggestions }: SuggestionsMessageProps) {
  if (!suggestions) return null;

  return (
    <div className="mt-2 space-y-2">
      {suggestions.map((suggestion, idx) => (
        <div key={idx} className={`rounded-md p-2 text-xs border ${
          suggestion.priority === 'high' ? 'bg-orange-500/10 border-orange-500/20' :
          suggestion.priority === 'medium' ? 'bg-blue-500/10 border-blue-500/20' :
          'bg-gray-500/10 border-border/20'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
              suggestion.priority === 'high' ? 'bg-orange-500 text-white' :
              suggestion.priority === 'medium' ? 'bg-blue-500 text-white' :
              'bg-gray-500 text-white'
            }`}>{suggestion.priority}</span>
            <span className="font-medium text-foreground">{suggestion.title}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{suggestion.confidence}% confidence</span>
          </div>
          <p className="text-muted-foreground mb-1">{suggestion.description}</p>
          {suggestion.code && (
            <pre className="text-[10px] bg-background/50 rounded p-1.5 overflow-x-auto font-mono text-green-400">
              {suggestion.code}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Renders semantic screenshot analysis with page type, elements, errors, and suggestions
 */
export function ScreenshotAnalysisMessage({ analysis }: ScreenshotAnalysisMessageProps) {
  if (!analysis) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Page Type Identification */}
      <div className="rounded-md bg-purple-500/10 border border-purple-500/20 p-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-purple-400">🖼️</span>
          <span className="text-xs font-medium text-foreground">Page Identified</span>
          <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] bg-purple-500 text-white">
            {analysis.page_type.confidence}% confidence
          </span>
        </div>
        <p className="text-sm font-bold text-purple-300">{analysis.page_type.identified}</p>
        <p className="text-[10px] text-muted-foreground">Category: {analysis.page_type.category}</p>
      </div>

      {/* Elements Detected */}
      <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-2">
        <p className="text-xs font-medium text-foreground mb-1">🔍 Elements Detected</p>
        <div className="space-y-1">
          {analysis.elements_detected.slice(0, 6).map((el, idx) => (
            <div key={idx} className="flex items-center gap-2 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${
                el.type === 'input' ? 'bg-cyan-400' :
                el.type === 'button' ? 'bg-green-400' :
                el.type === 'link' ? 'bg-blue-400' :
                el.type === 'form' ? 'bg-amber-400' :
                'bg-gray-400'
              }`}></span>
              <span className="text-muted-foreground capitalize">{el.type}</span>
              <span className="text-foreground flex-1">{el.label || el.role}</span>
              {el.selector && (
                <code className="text-[8px] bg-background/50 px-1 rounded">{el.selector}</code>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Errors Detected */}
      {analysis.errors_detected.length > 0 && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-2">
          <p className="text-xs font-medium text-red-400 mb-1">⚠️ Errors Detected</p>
          <div className="space-y-1">
            {analysis.errors_detected.map((err, idx) => (
              <div key={idx} className="text-[10px]">
                <div className="flex items-center gap-1">
                  <span className={`px-1 py-0.5 rounded text-[8px] uppercase ${
                    err.severity === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                  }`}>{err.severity}</span>
                  <span className="text-red-300">{err.message}</span>
                </div>
                <p className="text-muted-foreground ml-4">Location: {err.location}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual State */}
      <div className="rounded-md bg-background/50 p-2">
        <p className="text-xs font-medium text-foreground mb-1">👁️ Visual State</p>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="px-1.5 py-0.5 rounded bg-background border border-border">
            Theme: {analysis.visual_state.theme}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-background border border-border">
            View: {analysis.visual_state.responsive_view}
          </span>
          {analysis.visual_state.has_loading_spinner && (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">Loading</span>
          )}
          {analysis.visual_state.has_modal && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Modal Open</span>
          )}
        </div>
      </div>

      {/* Semantic Description */}
      <div className="rounded-md bg-green-500/10 border border-green-500/20 p-2">
        <p className="text-xs font-medium text-green-400 mb-1">📝 Semantic Description</p>
        <div className="text-[11px] text-foreground whitespace-pre-wrap">
          {analysis.semantic_description.split('\n').map((line: string, i: number) => (
            <p key={i} className={i > 0 ? 'mt-1' : ''}>
              {line.split('**').map((part, j) =>
                j % 2 === 1 ? <strong key={j}>{part}</strong> : part
              )}
            </p>
          ))}
        </div>
      </div>

      {/* Suggested Test Assertions */}
      {analysis.suggested_test_assertions && (
        <div className="rounded-md bg-cyan-500/10 border border-cyan-500/20 p-2">
          <p className="text-xs font-medium text-cyan-400 mb-1">✅ Suggested Test Assertions</p>
          <ul className="space-y-0.5">
            {analysis.suggested_test_assertions.map((assertion: string, idx: number) => (
              <li key={idx} className="text-[10px] text-muted-foreground flex items-start gap-1">
                <span className="text-cyan-400">•</span>
                {assertion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
