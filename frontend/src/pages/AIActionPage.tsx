// AIActionPage - Extracted from App.tsx for code quality compliance
// Feature #1357: Frontend file size limit enforcement

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';

interface AIActionParams {
  suggestionId: string;
  suggestionTitle: string;
  actionType: string;
  targetEntity?: string;
  targetId?: string;
  prefilledValues?: Record<string, string>;
}

export function AIActionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionComplete, setActionComplete] = useState(false);

  // Parse pre-filled parameters from URL
  const parsePrefilledValues = (): Record<string, string> => {
    const prefillParam = searchParams.get('prefill');
    if (!prefillParam) return {};
    try {
      // The value is URL-encoded JSON (possibly double-encoded)
      let decoded = decodeURIComponent(prefillParam);
      // If it's a string starting with quote, it's double-encoded JSON
      if (decoded.startsWith('"')) {
        decoded = JSON.parse(decoded);
      }
      return typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
    } catch {
      return {};
    }
  };

  const params: AIActionParams = {
    suggestionId: searchParams.get('suggestionId') || '',
    suggestionTitle: searchParams.get('title') || 'AI Action',
    actionType: searchParams.get('actionType') || 'unknown',
    targetEntity: searchParams.get('entity') || undefined,
    targetId: searchParams.get('entityId') || undefined,
    prefilledValues: parsePrefilledValues(),
  };

  const executeAction = async () => {
    setIsExecuting(true);
    // Simulate action execution
    await new Promise(r => setTimeout(r, 1500));
    setIsExecuting(false);
    setActionComplete(true);
  };

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">←</button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Action</h1>
            <p className="text-muted-foreground">Execute action from AI suggestion</p>
          </div>
        </div>

        {/* Action Card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">AI</span>
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">{params.suggestionTitle}</h2>
              <p className="text-sm text-muted-foreground">
                Action Type: <span className="font-medium text-primary">{params.actionType}</span>
              </p>
            </div>
          </div>

          {/* Pre-filled Parameters */}
          {Object.keys(params.prefilledValues || {}).length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Pre-filled Parameters</h3>
              <div className="space-y-3">
                {Object.entries(params.prefilledValues || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-4">
                    <label className="text-sm text-foreground w-32 capitalize">{key.replace(/_/g, ' ')}:</label>
                    <input
                      type="text"
                      defaultValue={value}
                      className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-foreground"
                    />
                    <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                      AI Pre-filled
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Target Entity */}
          {params.targetEntity && (
            <div className="mb-6 p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Target</p>
              <p className="font-medium text-foreground">
                {params.targetEntity}
                {params.targetId && <span className="text-muted-foreground ml-2">(ID: {params.targetId})</span>}
              </p>
            </div>
          )}

          {/* Action Status */}
          {actionComplete ? (
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400 text-xl">✓</span>
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">Action Completed Successfully</p>
                  <p className="text-sm text-green-600 dark:text-green-400/80">The AI-suggested action has been executed.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6">
              <p className="text-sm text-foreground">
                This action was suggested by AI based on analysis of your test data. Review the parameters above before executing.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={executeAction}
              disabled={isExecuting || actionComplete}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isExecuting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {actionComplete ? 'Completed' : isExecuting ? 'Executing...' : 'Execute Action'}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 border border-border rounded-md text-foreground hover:bg-muted"
            >
              {actionComplete ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>

        {/* Suggestion Context */}
        <div className="mt-6 p-4 rounded-lg border border-border bg-card">
          <h3 className="font-medium text-foreground mb-2">About This Suggestion</h3>
          <p className="text-sm text-muted-foreground">
            This action was identified by AI analysis. The parameters have been pre-filled based on the context of the suggestion. You can modify any values before executing.
          </p>
        </div>
      </div>
    </Layout>
  );
}
