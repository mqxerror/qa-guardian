// Feature #48: K6ScriptTab - Extracted from TestDetailPage.tsx
// Feature #571: Replace emoji with Lucide icons for cross-browser consistency
// Displays K6 load test script with edit capability

import { useState } from 'react';
import { Rocket, Copy, Download, FileText, ChevronDown, FileEdit, Loader2, Save } from 'lucide-react';
import { toast } from '../../stores/toastStore';

interface K6Template {
  name: string;
  description: string;
  script: string;
}

interface K6ScriptTabProps {
  test: {
    id?: string;
    name?: string;
    k6_script?: string;
  } | null;
  canEdit: boolean;
  isEditingK6Script: boolean;
  k6Script: string;
  isSavingK6Script: boolean;
  token: string;
  k6Templates: Record<string, K6Template>;
  showK6Templates: boolean;
  onSetK6Script: (script: string) => void;
  onSetIsEditingK6Script: (editing: boolean) => void;
  onSetShowK6Templates: (show: boolean) => void;
  generateK6Script: () => string;
}

export function K6ScriptTab({
  test,
  canEdit,
  isEditingK6Script,
  k6Script,
  isSavingK6Script,
  token,
  k6Templates,
  showK6Templates,
  onSetK6Script,
  onSetIsEditingK6Script,
  onSetShowK6Templates,
  generateK6Script,
}: K6ScriptTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const handleCopy = () => {
    const script = k6Script || generateK6Script();
    navigator.clipboard.writeText(script);
    toast.success('K6 script copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([k6Script || generateK6Script()], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${test?.name?.replace(/\s+/g, '-').toLowerCase() || 'load-test'}.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('K6 script downloaded!');
  };

  const handleStartEdit = () => {
    if (!k6Script) {
      onSetK6Script(generateK6Script());
    }
    onSetIsEditingK6Script(true);
  };

  const handleCancelEdit = () => {
    onSetIsEditingK6Script(false);
    onSetK6Script(test?.k6_script || generateK6Script());
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/tests/${test?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ k6_script: k6Script }),
      });
      if (!response.ok) throw new Error('Failed to save script');
      toast.success('K6 script saved successfully!');
      onSetIsEditingK6Script(false);
    } catch (err) {
      toast.error('Failed to save K6 script');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyTemplate = (template: K6Template) => {
    onSetK6Script(template.script);
    onSetShowK6Templates(false);
    toast.success(`${template.name} template applied!`);
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(`k6 run ${test?.name?.replace(/\s+/g, '-').toLowerCase() || 'load-test'}.js`);
    toast.success('Command copied!');
  };

  const toggleSection = (index: number) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Identify foldable sections in the script
  const getFoldableSections = (script: string) => {
    const lines = script.split('\n');
    const sections: Array<{ start: number; end: number; label: string }> = [];
    const braceStack: number[] = [];

    lines.forEach((line, index) => {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;

      for (let i = 0; i < openBraces; i++) {
        braceStack.push(index);
      }

      for (let i = 0; i < closeBraces; i++) {
        const start = braceStack.pop();
        if (start !== undefined && index - start > 2) {
          const label = lines[start].trim().split('{')[0].trim();
          if (label && !label.startsWith('//')) {
            sections.push({ start, end: index, label });
          }
        }
      }
    });

    return sections;
  };

  const displayScript = k6Script || generateK6Script();
  const foldableSections = getFoldableSections(displayScript);

  return (
    <div className="mt-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {isEditingK6Script ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Editing K6 load test script...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-success"></span>
                K6 Load Test Script (JavaScript)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditingK6Script && (
            <>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Copy size={14} />
                Copy
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Download size={14} />
                Download
              </button>
              {canEdit && (
                <div className="relative">
                  <button
                    onClick={() => onSetShowK6Templates(!showK6Templates)}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <FileText size={14} />
                    Templates
                    <ChevronDown size={12} />
                  </button>
                  {showK6Templates && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[280px]">
                      {Object.entries(k6Templates).map(([key, template]) => (
                        <button
                          key={key}
                          onClick={() => handleApplyTemplate(template)}
                          className="w-full px-4 py-2 text-left hover:bg-muted transition-colors"
                        >
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-muted-foreground">{template.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {canEdit && (
                <button
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <FileEdit size={14} />
                  Edit Script
                </button>
              )}
            </>
          )}
          {isEditingK6Script && (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving || isSavingK6Script}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isSavingK6Script || !k6Script.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-success/90 disabled:opacity-50"
              >
                {(isSaving || isSavingK6Script) ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save Script
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* K6 script display or editor */}
      {isEditingK6Script ? (
        <div className="relative rounded-lg bg-background overflow-hidden">
          <div className="flex h-[500px]">
            {/* Line numbers gutter */}
            <div className="select-none text-muted-foreground text-sm font-mono py-4 pr-2 text-right bg-card/50 overflow-hidden" style={{ minWidth: '3rem' }}>
              {k6Script.split('\n').map((_, i) => (
                <div key={i} className="leading-6 px-2">{i + 1}</div>
              ))}
            </div>
            {/* Code editor */}
            <textarea
              value={k6Script}
              onChange={(e) => onSetK6Script(e.target.value)}
              className="flex-1 bg-transparent p-4 text-sm text-foreground font-mono resize-none focus:outline-none leading-6"
              placeholder="Enter your K6 load test script here..."
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        <div className="relative rounded-lg bg-background overflow-hidden">
          <div className="flex max-h-[500px] overflow-auto">
            {/* Line numbers and fold icons gutter */}
            <div className="select-none text-muted-foreground text-sm font-mono py-4 pr-2 text-right bg-card/50 sticky left-0" style={{ minWidth: '3rem' }}>
              {displayScript.split('\n').map((_, i) => {
                const foldable = foldableSections.find(s => s.start === i);
                const isCollapsed = collapsedSections.has(i);
                return (
                  <div key={i} className="leading-6 px-2 flex items-center justify-end gap-1">
                    {foldable && (
                      <button
                        onClick={() => toggleSection(i)}
                        className="text-muted-foreground hover:text-foreground text-xs"
                        title={isCollapsed ? 'Expand' : 'Collapse'}
                      >
                        {isCollapsed ? '▶' : '▼'}
                      </button>
                    )}
                    <span>{i + 1}</span>
                  </div>
                );
              })}
            </div>
            {/* Code content with folding */}
            <pre className="flex-1 p-4 overflow-x-auto">
              <code className="text-foreground font-mono text-sm whitespace-pre leading-6">
                {displayScript.split('\n').map((line, i) => {
                  const collapsedSection = Array.from(collapsedSections).find(start => {
                    const section = foldableSections.find(s => s.start === start);
                    return section && i > section.start && i <= section.end;
                  });
                  if (collapsedSection !== undefined) return null;

                  const foldable = foldableSections.find(s => s.start === i);
                  const isCollapsed = collapsedSections.has(i);

                  return (
                    <div key={i}>
                      {line}
                      {foldable && isCollapsed && (
                        <span className="text-muted-foreground ml-2">
                          {`... ${foldable.end - foldable.start} lines hidden ...`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </code>
            </pre>
          </div>
        </div>
      )}

      {/* Footer with K6 tips */}
      <div className="mt-3 space-y-2">
        <div className="text-xs text-muted-foreground">
          {isEditingK6Script ? (
            <span>✏️ Edit the K6 script above and click "Save Script" to save your changes.</span>
          ) : (
            <span>💡 Click "Edit Script" to customize your K6 load test script.</span>
          )}
        </div>
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1"><Rocket className="h-4 w-4" /> Run this script with K6:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded bg-background text-foreground text-sm font-mono">
              k6 run {test?.name?.replace(/\s+/g, '-').toLowerCase() || 'load-test'}.js
            </code>
            <button
              onClick={handleCopyCommand}
              className="px-2 py-2 rounded bg-card hover:bg-secondary text-muted-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
