/**
 * SecretPatternsManager - Custom secret pattern detection UI
 * Feature #102: Extracted from SecurityTab.tsx
 * Feature #637: Migrated modal to use Modal component from ui/Modal
 */
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../ui/Modal';
import { SecretPattern } from '../types';

export interface SecretPatternsManagerProps {
 projectId: string;
 secretPatterns: SecretPattern[];
 showAddSecretPatternModal: boolean;
 newPatternName: string;
 newPatternDescription: string;
 newPatternRegex: string;
 newPatternSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
 isAddingPattern: boolean;
 patternError: string | null;
 patternTestInput: string;
 patternTestResult: { matches: boolean; matched?: string } | null;
 setShowAddSecretPatternModal: (show: boolean) => void;
 setNewPatternName: (name: string) => void;
 setNewPatternDescription: (desc: string) => void;
 setNewPatternRegex: (regex: string) => void;
 setNewPatternSeverity: (sev: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') => void;
 setPatternError: (error: string | null) => void;
 setPatternTestInput: (input: string) => void;
 setPatternTestResult: (result: { matches: boolean; matched?: string } | null) => void;
 handleAddSecretPattern: () => Promise<void>;
 handleToggleSecretPattern: (id: string, enabled: boolean) => Promise<void>;
 handleDeleteSecretPattern: (id: string) => Promise<void>;
 handleTestPattern: () => void;
}

export function SecretPatternsManager(props: SecretPatternsManagerProps) {
 const {
 secretPatterns,
 showAddSecretPatternModal,
 newPatternName,
 newPatternDescription,
 newPatternRegex,
 newPatternSeverity,
 isAddingPattern,
 patternError,
 patternTestInput,
 patternTestResult,
 setShowAddSecretPatternModal,
 setNewPatternName,
 setNewPatternDescription,
 setNewPatternRegex,
 setNewPatternSeverity,
 setPatternError,
 setPatternTestInput,
 setPatternTestResult,
 handleAddSecretPattern,
 handleToggleSecretPattern,
 handleDeleteSecretPattern,
 handleTestPattern,
 } = props;

 return (
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-4">
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
 <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
 </svg>
 </div>
 <div>
 <h3 className="text-lg font-semibold text-foreground">Custom Secret Patterns</h3>
 <p className="text-sm text-muted-foreground">
 Define custom regex patterns to detect organization-specific secrets
 </p>
 </div>
 </div>
 <button
 onClick={() => setShowAddSecretPatternModal(true)}
 className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
 >
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Add Pattern
 </button>
 </div>

 {secretPatterns.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <svg className="mx-auto h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
 </svg>
 <p>No custom secret patterns configured</p>
 <p className="text-sm mt-1">Add regex patterns to detect organization-specific secrets like internal API keys or tokens</p>
 </div>
 ) : (
 <div className="space-y-3">
 {secretPatterns.map((pattern) => (
 <div
 key={pattern.id}
 className="flex items-center justify-between p-4 rounded-lg border border-border bg-background"
 >
 <div className="flex items-center gap-4">
 <button
 type="button"
 role="switch"
 aria-checked={pattern.enabled}
 aria-label={`Toggle ${pattern.name} pattern`}
 onClick={() => handleToggleSecretPattern(pattern.id, !pattern.enabled)}
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 ${
 pattern.enabled ? 'bg-accent' : 'bg-muted'
 }`}
 >
 <span
 className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
 pattern.enabled ? 'translate-x-6' : 'translate-x-1'
 }`}
 />
 </button>
 <div>
 <div className="flex items-center gap-2">
 <p className="font-medium text-foreground">{pattern.name}</p>
 <span className={`text-xs px-2 py-0.5 rounded-full ${
 pattern.severity === 'CRITICAL' ? 'bg-destructive/10 text-destructive' :
 pattern.severity === 'HIGH' ? 'bg-warning/10 text-warning' :
 pattern.severity === 'MEDIUM' ? 'bg-warning/10 text-warning' :
 'bg-primary/10 text-primary'
 }`}>
 {pattern.severity}
 </span>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 Pattern: <code className="bg-muted px-1 rounded">{pattern.pattern}</code>
 </p>
 {pattern.description && (
 <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
 )}
 </div>
 </div>
 <button
 onClick={() => handleDeleteSecretPattern(pattern.id)}
 className="p-2 text-muted-foreground hover:text-destructive transition-colors"
 title="Delete pattern"
 >
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 </div>
 ))}
 </div>
 )}

 {/* Add Secret Pattern Modal */}
 <Modal
 isOpen={showAddSecretPatternModal}
 onClose={() => {
 setShowAddSecretPatternModal(false);
 setNewPatternName('');
 setNewPatternDescription('');
 setNewPatternRegex('');
 setNewPatternSeverity('HIGH');
 setPatternError(null);
 setPatternTestInput('');
 setPatternTestResult(null);
 }}
 title="Add Custom Secret Pattern"
 size="full"
 >
 <ModalHeader onClose={() => {
 setShowAddSecretPatternModal(false);
 setNewPatternName('');
 setNewPatternDescription('');
 setNewPatternRegex('');
 setNewPatternSeverity('HIGH');
 setPatternError(null);
 setPatternTestInput('');
 setPatternTestResult(null);
 }}>Add Custom Secret Pattern</ModalHeader>

 <ModalBody>
 {patternError && (
 <div className="mb-4 p-3 rounded-md bg-destructive/5 text-destructive text-sm">
 {patternError}
 </div>
 )}

 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Pattern Name <span className="text-destructive">*</span>
 </label>
 <input
 type="text"
 value={newPatternName}
 onChange={(e) => setNewPatternName(e.target.value)}
 placeholder="e.g., Internal API Key"
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Description
 </label>
 <input
 type="text"
 value={newPatternDescription}
 onChange={(e) => setNewPatternDescription(e.target.value)}
 placeholder="e.g., Detects our internal API keys starting with IAK_"
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Regex Pattern <span className="text-destructive">*</span>
 </label>
 <input
 type="text"
 value={newPatternRegex}
 onChange={(e) => {
 setNewPatternRegex(e.target.value);
 setPatternTestResult(null);
 }}
 placeholder="e.g., IAK_[A-Za-z0-9]{32}"
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
 />
 <p className="mt-1 text-xs text-muted-foreground">
 Enter a valid JavaScript regex pattern (without slashes)
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Severity
 </label>
 <select
 value={newPatternSeverity}
 onChange={(e) => setNewPatternSeverity(e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
 >
 <option value="CRITICAL">Critical</option>
 <option value="HIGH">High</option>
 <option value="MEDIUM">Medium</option>
 <option value="LOW">Low</option>
 </select>
 </div>

 {/* Pattern Tester */}
 <div className="pt-4 border-t border-border">
 <label className="block text-sm font-medium text-foreground mb-2">
 Test Your Pattern
 </label>
 <div className="flex gap-2">
 <input
 type="text"
 value={patternTestInput}
 onChange={(e) => {
 setPatternTestInput(e.target.value);
 setPatternTestResult(null);
 }}
 placeholder="Enter test string..."
 className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
 />
 <button
 onClick={handleTestPattern}
 disabled={!newPatternRegex || !patternTestInput}
 className="px-4 py-2 rounded-md bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50"
 >
 Test
 </button>
 </div>
 {patternTestResult && (
 <div className={`mt-2 p-2 rounded text-sm ${
 patternTestResult.matches
 ? 'bg-success/5 text-success'
 : 'bg-warning/5 text-warning'
 }`}>
 {patternTestResult.matches ? (
 <>✓ Pattern matches! Found: <code className="bg-success/10 px-1 rounded">{patternTestResult.matched}</code></>
 ) : (
 <>✗ Pattern does not match the test string</>
 )}
 </div>
 )}
 </div>
 </div>
 </ModalBody>

 <ModalFooter>
 <button
 onClick={() => {
 setShowAddSecretPatternModal(false);
 setNewPatternName('');
 setNewPatternDescription('');
 setNewPatternRegex('');
 setNewPatternSeverity('HIGH');
 setPatternError(null);
 setPatternTestInput('');
 setPatternTestResult(null);
 }}
 className="px-4 py-2 rounded-md border border-input bg-background text-foreground hover:bg-muted"
 >
 Cancel
 </button>
 <button
 onClick={handleAddSecretPattern}
 disabled={isAddingPattern || !newPatternName.trim() || !newPatternRegex.trim()}
 className="px-4 py-2 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
 >
 {isAddingPattern ? 'Adding...' : 'Add Pattern'}
 </button>
 </ModalFooter>
 </Modal>
 </div>
 );
}
