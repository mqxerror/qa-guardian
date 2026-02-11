/**
 * CustomRulesManager - Custom Semgrep rules UI
 * Feature #102: Extracted from SecurityTab.tsx
 * Feature #637: Migrated modal to use Modal component from ui/Modal
 */
import { Plus, ClipboardList, Trash2 } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../ui/Modal';
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
 className="flex items-center gap-2 rounded-md bg-warning px-3 py-2 text-sm font-medium text-warning-foreground hover:bg-warning/90"
 >
 <Plus className="h-4 w-4" />
 Add Custom Rule
 </button>
 </div>

 {customRules.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <ClipboardList className="mx-auto h-12 w-12 mb-4 opacity-50" />
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
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-warning/20 ${
 rule.enabled ? 'bg-warning' : 'bg-muted'
 }`}
 >
 <span
 className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
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
 className="p-2 text-muted-foreground hover:text-destructive transition-colors"
 title="Delete rule"
 >
 <Trash2 className="h-4 w-4" />
 </button>
 </div>
 ))}
 </div>
 )}

 {/* Add Custom Rule Modal */}
 <Modal
 isOpen={showAddCustomRuleModal}
 onClose={() => {
 setShowAddCustomRuleModal(false);
 setNewCustomRuleName('');
 setNewCustomRuleYaml('');
 setCustomRuleError(null);
 }}
 title="Add Custom Semgrep Rule"
 size="full"
 >
 <ModalHeader onClose={() => {
 setShowAddCustomRuleModal(false);
 setNewCustomRuleName('');
 setNewCustomRuleYaml('');
 setCustomRuleError(null);
 }}>Add Custom Semgrep Rule</ModalHeader>

 <ModalBody>
 {customRuleError && (
 <div className="mb-4 p-3 rounded-md bg-destructive/5 text-destructive text-sm">
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
 className="text-warning hover:underline"
 >
 Learn more about Semgrep rules
 </a>
 </p>
 </div>
 </div>
 </ModalBody>

 <ModalFooter>
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
 className="px-4 py-2 rounded-md bg-warning text-warning-foreground hover:bg-warning/90 disabled:opacity-50"
 >
 {isAddingCustomRule ? 'Adding...' : 'Add Rule'}
 </button>
 </ModalFooter>
 </Modal>
 </div>
 );
}
