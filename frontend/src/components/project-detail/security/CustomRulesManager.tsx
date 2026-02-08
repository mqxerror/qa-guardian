/**
 * CustomRulesManager - Custom Semgrep rules UI
 * Feature #102: Extracted from SecurityTab.tsx
 */
import { CustomRule } from '../types';

export interface CustomRulesManagerProps {
 customRules: CustomRule[];
 showAddCustomRuleModal: boolean;
 newCustomRuleName: string;
 newCustomRuleYaml: string;
 isAddingCustomRule: boolean;
 customRuleError: string | null;
 setShowAddCustomRuleModal: (show: boolean) => void;
 setNewCustomRuleName: (name: string) => void;
 setNewCustomRuleYaml: (yaml: string) => void;
 setCustomRuleError: (error: string | null) => void;
 handleAddCustomRule: () => Promise<void>;
 handleToggleCustomRule: (id: string, enabled: boolean) => Promise<void>;
 handleDeleteCustomRule: (id: string) => Promise<void>;
}

export function CustomRulesManager(props: CustomRulesManagerProps) {
 const {
 customRules,
 showAddCustomRuleModal,
 newCustomRuleName,
 newCustomRuleYaml,
 isAddingCustomRule,
 customRuleError,
 setShowAddCustomRuleModal,
 setNewCustomRuleName,
 setNewCustomRuleYaml,
 setCustomRuleError,
 handleAddCustomRule,
 handleToggleCustomRule,
 handleDeleteCustomRule,
 } = props;

 return (
 <div className="rounded-lg border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-lg font-semibold text-foreground">Custom Rules</h3>
 <p className="text-sm text-muted-foreground">
 Add organization-specific Semgrep rules for custom vulnerability detection
 </p>
 </div>
 <button
 onClick={() => setShowAddCustomRuleModal(true)}
 className="flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
 >
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Add Custom Rule
 </button>
 </div>

 {customRules.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <svg className="mx-auto h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
 </svg>
 <p>No custom rules configured yet</p>
 <p className="text-sm mt-1">Add custom Semgrep rules to detect organization-specific patterns</p>
 </div>
 ) : (
 <div className="space-y-3">
 {customRules.map((rule) => (
 <div
 key={rule.id}
 className="flex items-center justify-between p-4 rounded-lg border border-border bg-background"
 >
 <div className="flex items-center gap-4">
 <button
 type="button"
 role="switch"
 aria-checked={rule.enabled}
 aria-label={`Toggle ${rule.name} rule`}
 onClick={() => handleToggleCustomRule(rule.id, !rule.enabled)}
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
 rule.enabled ? 'bg-orange-600' : 'bg-muted'
 }`}
 >
 <span
 className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
 rule.enabled ? 'translate-x-6' : 'translate-x-1'
 }`}
 />
 </button>
 <div>
 <p className="font-medium text-foreground">{rule.name}</p>
 <p className="text-xs text-muted-foreground">
 Added {new Date(rule.createdAt).toLocaleDateString()}
 {rule.enabled ? ' • Active' : ' • Disabled'}
 </p>
 </div>
 </div>
 <button
 onClick={() => handleDeleteCustomRule(rule.id)}
 className="p-2 text-muted-foreground hover:text-red-600 transition-colors"
 title="Delete rule"
 >
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 </div>
 ))}
 </div>
 )}

 {/* Add Custom Rule Modal */}
 {showAddCustomRuleModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
 <div className="bg-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border shadow-lg">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold text-foreground">Add Custom Semgrep Rule</h3>
 <button
 onClick={() => {
 setShowAddCustomRuleModal(false);
 setNewCustomRuleName('');
 setNewCustomRuleYaml('');
 setCustomRuleError(null);
 }}
 className="text-muted-foreground hover:text-foreground"
 >
 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {customRuleError && (
 <div className="mb-4 p-3 rounded-md bg-red-50 text-red-600 text-sm">
 {customRuleError}
 </div>
 )}

 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Rule Name
 </label>
 <input
 type="text"
 value={newCustomRuleName}
 onChange={(e) => setNewCustomRuleName(e.target.value)}
 placeholder="e.g., Detect hardcoded API keys"
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Semgrep Rule YAML
 </label>
 <textarea
 value={newCustomRuleYaml}
 onChange={(e) => setNewCustomRuleYaml(e.target.value)}
 placeholder={`rules:
 - id: my-custom-rule
 pattern: $X = "HARDCODED_SECRET"
 message: "Hardcoded secret detected"
 severity: ERROR
 languages: [javascript, typescript]`}
 rows={12}
 className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
 />
 <p className="mt-2 text-xs text-muted-foreground">
 Write a valid Semgrep rule in YAML format.{' '}
 <a
 href="https://semgrep.dev/docs/writing-rules/overview/"
 target="_blank"
 rel="noopener noreferrer"
 className="text-orange-600 hover:underline"
 >
 Learn more about Semgrep rules
 </a>
 </p>
 </div>
 </div>

 <div className="flex justify-end gap-3 mt-6">
 <button
 onClick={() => {
 setShowAddCustomRuleModal(false);
 setNewCustomRuleName('');
 setNewCustomRuleYaml('');
 setCustomRuleError(null);
 }}
 className="px-4 py-2 rounded-md border border-input bg-background text-foreground hover:bg-muted"
 >
 Cancel
 </button>
 <button
 onClick={handleAddCustomRule}
 disabled={isAddingCustomRule || !newCustomRuleName.trim() || !newCustomRuleYaml.trim()}
 className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
 >
 {isAddingCustomRule ? 'Adding...' : 'Add Rule'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
