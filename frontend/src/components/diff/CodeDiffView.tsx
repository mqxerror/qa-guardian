/**
 * CodeDiffView Component
 * Feature #311: Code diff view for test regenerations
 *
 * Shows unified diff between original and regenerated code with:
 * - Green for additions, red for removals
 * - Per-hunk accept/reject buttons
 * - Accept All / Reject All bulk actions
 * - Apply accepted hunks to produce final merged code
 */

import React, { useState, useMemo, useCallback } from 'react';
import * as Diff from 'diff';

export interface DiffHunk {
 id: number;
 oldStart: number;
 oldLines: number;
 newStart: number;
 newLines: number;
 lines: DiffLine[];
 accepted: boolean | null; // null = pending, true = accepted, false = rejected
}

export interface DiffLine {
 type: 'context' | 'added' | 'removed';
 content: string;
 oldLineNumber?: number;
 newLineNumber?: number;
}

interface CodeDiffViewProps {
 originalCode: string;
 newCode: string;
 onApply: (mergedCode: string) => void;
 onCancel: () => void;
 className?: string;
}

/**
 * Parse diff output into structured hunks
 */
function parseDiffToHunks(originalCode: string, newCode: string): DiffHunk[] {
 const patch = Diff.structuredPatch('original', 'new', originalCode, newCode, '', '', { context: 3 });

 return patch.hunks.map((hunk, index) => {
 const lines: DiffLine[] = [];
 let oldLineNum = hunk.oldStart;
 let newLineNum = hunk.newStart;

 hunk.lines.forEach((line) => {
 const prefix = line[0];
 const content = line.substring(1);

 if (prefix === ' ') {
 lines.push({
 type: 'context',
 content,
 oldLineNumber: oldLineNum++,
 newLineNumber: newLineNum++,
 });
 } else if (prefix === '-') {
 lines.push({
 type: 'removed',
 content,
 oldLineNumber: oldLineNum++,
 });
 } else if (prefix === '+') {
 lines.push({
 type: 'added',
 content,
 newLineNumber: newLineNum++,
 });
 }
 });

 return {
 id: index,
 oldStart: hunk.oldStart,
 oldLines: hunk.oldLines,
 newStart: hunk.newStart,
 newLines: hunk.newLines,
 lines,
 accepted: null, // Start as pending
 };
 });
}

/**
 * Apply accepted hunks to produce the final merged code
 */
function applyHunks(originalCode: string, newCode: string, hunks: DiffHunk[]): string {
 // If all hunks are accepted, return the new code
 if (hunks.every(h => h.accepted === true)) {
 return newCode;
 }

 // If all hunks are rejected, return the original code
 if (hunks.every(h => h.accepted === false)) {
 return originalCode;
 }

 // For partial acceptance, we need to apply changes selectively
 const originalLines = originalCode.split('\n');
 const newLines = newCode.split('\n');
 const result: string[] = [];

 let originalIndex = 0;

 // Sort hunks by their original start position
 const sortedHunks = [...hunks].sort((a, b) => a.oldStart - b.oldStart);

 for (const hunk of sortedHunks) {
 // Copy unchanged lines before this hunk
 while (originalIndex < hunk.oldStart - 1) {
 result.push(originalLines[originalIndex]);
 originalIndex++;
 }

 if (hunk.accepted === true) {
 // Accept: use the new lines
 for (const line of hunk.lines) {
 if (line.type === 'context' || line.type === 'added') {
 result.push(line.content);
 }
 // Skip removed lines (they're being replaced)
 }
 // Move past the old lines that were replaced
 originalIndex = hunk.oldStart - 1 + hunk.oldLines;
 } else {
 // Reject: keep the original lines
 for (const line of hunk.lines) {
 if (line.type === 'context' || line.type === 'removed') {
 result.push(line.content);
 }
 // Skip added lines (they're being rejected)
 }
 originalIndex = hunk.oldStart - 1 + hunk.oldLines;
 }
 }

 // Copy any remaining lines after the last hunk
 while (originalIndex < originalLines.length) {
 result.push(originalLines[originalIndex]);
 originalIndex++;
 }

 return result.join('\n');
}

export function CodeDiffView({
 originalCode,
 newCode,
 onApply,
 onCancel,
 className = '',
}: CodeDiffViewProps) {
 const [hunks, setHunks] = useState<DiffHunk[]>(() =>
 parseDiffToHunks(originalCode, newCode)
 );

 // Check if there are any changes
 const hasChanges = hunks.length > 0;

 // Count pending, accepted, and rejected hunks
 const stats = useMemo(() => ({
 total: hunks.length,
 pending: hunks.filter(h => h.accepted === null).length,
 accepted: hunks.filter(h => h.accepted === true).length,
 rejected: hunks.filter(h => h.accepted === false).length,
 }), [hunks]);

 // Handle accepting a single hunk
 const handleAcceptHunk = useCallback((hunkId: number) => {
 setHunks(prev => prev.map(h =>
 h.id === hunkId ? { ...h, accepted: true } : h
 ));
 }, []);

 // Handle rejecting a single hunk
 const handleRejectHunk = useCallback((hunkId: number) => {
 setHunks(prev => prev.map(h =>
 h.id === hunkId ? { ...h, accepted: false } : h
 ));
 }, []);

 // Handle toggling a hunk (for pending state)
 const handleToggleHunk = useCallback((hunkId: number) => {
 setHunks(prev => prev.map(h => {
 if (h.id !== hunkId) return h;
 // Cycle through: null -> true -> false -> null
 if (h.accepted === null) return { ...h, accepted: true };
 if (h.accepted === true) return { ...h, accepted: false };
 return { ...h, accepted: null };
 }));
 }, []);

 // Accept all hunks
 const handleAcceptAll = useCallback(() => {
 setHunks(prev => prev.map(h => ({ ...h, accepted: true })));
 }, []);

 // Reject all hunks
 const handleRejectAll = useCallback(() => {
 setHunks(prev => prev.map(h => ({ ...h, accepted: false })));
 }, []);

 // Reset all hunks to pending
 const handleResetAll = useCallback(() => {
 setHunks(prev => prev.map(h => ({ ...h, accepted: null })));
 }, []);

 // Apply the changes
 const handleApply = useCallback(() => {
 // Mark any pending hunks as accepted
 const resolvedHunks = hunks.map(h => ({
 ...h,
 accepted: h.accepted === null ? true : h.accepted,
 }));
 const mergedCode = applyHunks(originalCode, newCode, resolvedHunks);
 onApply(mergedCode);
 }, [hunks, originalCode, newCode, onApply]);

 // If no changes, show a message
 if (!hasChanges) {
 return (
 <div className={`rounded-lg bg-muted/30 border border-border p-6 text-center ${className}`}>
 <div className="text-4xl mb-3">✨</div>
 <h3 className="text-lg font-semibold text-foreground mb-2">No Changes Detected</h3>
 <p className="text-sm text-muted-foreground mb-4">
 The regenerated code is identical to the original.
 </p>
 <button
 type="button"
 onClick={onCancel}
 className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted"
 >
 Close
 </button>
 </div>
 );
 }

 return (
 <div className={`rounded-lg bg-card border border-border overflow-hidden ${className}`}>
 {/* Header with stats and bulk actions */}
 <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/30 border-b border-border">
 <div className="flex items-center gap-4">
 <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
 <span>📊</span>
 Code Diff Review
 </h3>
 <div className="flex items-center gap-3 text-xs">
 <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted">
 <span className="w-2 h-2 rounded-full bg-warning"></span>
 {stats.pending} pending
 </span>
 <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 text-success">
 <span className="w-2 h-2 rounded-full bg-success"></span>
 {stats.accepted} accepted
 </span>
 <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/10 text-destructive">
 <span className="w-2 h-2 rounded-full bg-destructive"></span>
 {stats.rejected} rejected
 </span>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={handleAcceptAll}
 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-success text-white hover:bg-success transition-colors"
 >
 <span>✓</span>
 Accept All
 </button>
 <button
 type="button"
 onClick={handleRejectAll}
 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive text-white hover:bg-destructive transition-colors"
 >
 <span>✗</span>
 Reject All
 </button>
 {(stats.accepted > 0 || stats.rejected > 0) && (
 <button
 type="button"
 onClick={handleResetAll}
 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
 >
 <span>↺</span>
 Reset
 </button>
 )}
 </div>
 </div>

 {/* Diff content */}
 <div className="max-h-[60vh] overflow-y-auto">
 {hunks.map((hunk, hunkIndex) => (
 <div
 key={hunk.id}
 className={`border-b border-border last:border-b-0 ${
 hunk.accepted === true
 ? 'bg-success/5'
 : hunk.accepted === false
 ? 'bg-destructive/5 opacity-60'
 : ''
 }`}
 >
 {/* Hunk header with accept/reject buttons */}
 <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
 <div className="flex items-center gap-3">
 <span className="text-xs font-mono text-muted-foreground">
 Hunk {hunkIndex + 1} of {hunks.length}
 </span>
 <span className="text-xs text-muted-foreground">
 @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
 </span>
 {hunk.accepted === true && (
 <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">
 ✓ Accepted
 </span>
 )}
 {hunk.accepted === false && (
 <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">
 ✗ Rejected
 </span>
 )}
 </div>

 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => handleAcceptHunk(hunk.id)}
 className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
 hunk.accepted === true
 ? 'bg-success text-white'
 : 'border border-success/50 text-success hover:bg-success/10'
 }`}
 >
 <span>✓</span>
 Accept
 </button>
 <button
 type="button"
 onClick={() => handleRejectHunk(hunk.id)}
 className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
 hunk.accepted === false
 ? 'bg-destructive text-white'
 : 'border border-destructive/50 text-destructive hover:bg-destructive/10'
 }`}
 >
 <span>✗</span>
 Reject
 </button>
 </div>
 </div>

 {/* Hunk lines */}
 <div className="font-mono text-sm">
 {hunk.lines.map((line, lineIndex) => (
 <div
 key={lineIndex}
 className={`flex ${
 line.type === 'added'
 ? 'bg-success/15 border-l-4 border-success'
 : line.type === 'removed'
 ? 'bg-destructive/15 border-l-4 border-destructive'
 : 'border-l-4 border-transparent'
 }`}
 >
 {/* Line numbers */}
 <div className="flex-shrink-0 w-20 flex text-xs text-muted-foreground select-none border-r border-border/30">
 <span className="w-10 px-2 py-0.5 text-right bg-muted/30">
 {line.oldLineNumber || ''}
 </span>
 <span className="w-10 px-2 py-0.5 text-right bg-muted/30">
 {line.newLineNumber || ''}
 </span>
 </div>

 {/* Diff indicator */}
 <div className={`w-6 flex-shrink-0 text-center py-0.5 font-bold ${
 line.type === 'added'
 ? 'text-success bg-success/10'
 : line.type === 'removed'
 ? 'text-destructive bg-destructive/10'
 : 'text-muted-foreground'
 }`}>
 {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
 </div>

 {/* Line content */}
 <pre className={`flex-1 px-3 py-0.5 whitespace-pre-wrap break-all ${
 line.type === 'added'
 ? 'text-success'
 : line.type === 'removed'
 ? 'text-destructive line-through opacity-80'
 : 'text-foreground/80'
 }`}>
 {line.content || '\u00A0'}
 </pre>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>

 {/* Legend and actions */}
 <div className="flex items-center justify-between p-4 bg-muted/30 border-t border-border">
 <div className="flex items-center gap-4 text-xs text-muted-foreground">
 <span className="flex items-center gap-1.5">
 <span className="w-3 h-3 rounded bg-success/30 border border-success"></span>
 Added lines
 </span>
 <span className="flex items-center gap-1.5">
 <span className="w-3 h-3 rounded bg-destructive/30 border border-destructive"></span>
 Removed lines
 </span>
 <span className="flex items-center gap-1.5">
 <span className="w-3 h-3 rounded bg-muted border border-border"></span>
 Context
 </span>
 </div>

 <div className="flex items-center gap-3">
 <button
 type="button"
 onClick={onCancel}
 className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleApply}
 className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors"
 >
 <span>✓</span>
 Apply {stats.accepted > 0 || stats.pending > 0 ? `(${stats.accepted + stats.pending} hunks)` : 'Changes'}
 </button>
 </div>
 </div>
 </div>
 );
}

export default CodeDiffView;
