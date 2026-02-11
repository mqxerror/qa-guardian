// AddStepModal.tsx
// Feature #48: Extracted from TestDetailPage.tsx
// Feature #127: Mobile responsive design audit and fixes
// Feature #633: Migrated to Modal/ModalHeader/ModalBody/ModalFooter
import { FormEvent, KeyboardEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../ui/Modal';

interface AddStepModalProps {
 show: boolean;
 newStepAction: string;
 newStepSelector: string;
 newStepValue: string;
 newStepCheckpointName: string;
 newStepCheckpointThreshold: string;
 newStepA11yWcagLevel: 'A' | 'AA' | 'AAA';
 newStepA11yThreshold: string;
 newStepA11yFailOnCritical: boolean;
 newStepA11yFailOnAny: boolean;
 showSelectorAutocomplete: boolean;
 selectorAutocomplete: string | null;
 showValueAutocomplete: boolean;
 valueAutocomplete: string | null;
 addStepError: string;
 isAddingStep: boolean;
 targetUrl?: string;
 onActionChange: (action: string) => void;
 onSelectorChange: (selector: string) => void;
 onValueChange: (value: string) => void;
 onCheckpointNameChange: (name: string) => void;
 onCheckpointThresholdChange: (threshold: string) => void;
 onA11yWcagLevelChange: (level: 'A' | 'AA' | 'AAA') => void;
 onA11yThresholdChange: (threshold: string) => void;
 onA11yFailOnCriticalChange: (fail: boolean) => void;
 onA11yFailOnAnyChange: (fail: boolean) => void;
 onSelectorKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
 onValueKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
 onSubmit: (e: FormEvent) => void;
 onClose: () => void;
}

export function AddStepModal({
 show,
 newStepAction,
 newStepSelector,
 newStepValue,
 newStepCheckpointName,
 newStepCheckpointThreshold,
 newStepA11yWcagLevel,
 newStepA11yThreshold,
 newStepA11yFailOnCritical,
 newStepA11yFailOnAny,
 showSelectorAutocomplete,
 selectorAutocomplete,
 showValueAutocomplete,
 valueAutocomplete,
 addStepError,
 isAddingStep,
 targetUrl,
 onActionChange,
 onSelectorChange,
 onValueChange,
 onCheckpointNameChange,
 onCheckpointThresholdChange,
 onA11yWcagLevelChange,
 onA11yThresholdChange,
 onA11yFailOnCriticalChange,
 onA11yFailOnAnyChange,
 onSelectorKeyDown,
 onValueKeyDown,
 onSubmit,
 onClose,
}: AddStepModalProps) {
 if (!show) {
 return null;
 }

 const needsSelector = newStepAction === 'click' || newStepAction === 'fill' || newStepAction === 'type' ||
 newStepAction === 'clear' || newStepAction === 'hover' || newStepAction === 'select_option' ||
 newStepAction === 'check' || newStepAction === 'uncheck' || newStepAction === 'upload_file' ||
 newStepAction === 'scroll_to_element' || newStepAction === 'wait_for_element' ||
 newStepAction === 'assert_visible' || newStepAction === 'assert_hidden';

 const needsValue = newStepAction === 'navigate' || newStepAction === 'fill' || newStepAction === 'type' ||
 newStepAction === 'wait' || newStepAction === 'assert_text' || newStepAction === 'select_option' ||
 newStepAction === 'upload_file' || newStepAction === 'press_key' || newStepAction === 'scroll_by_pixels' ||
 newStepAction === 'wait_for_url' || newStepAction === 'assert_url' || newStepAction === 'assert_title' ||
 newStepAction === 'screenshot';

 const getValueLabel = () => {
 switch (newStepAction) {
 case 'navigate': return 'URL';
 case 'wait': return 'Milliseconds';
 case 'assert_text': return 'Text to Find';
 case 'select_option': return 'Option Value';
 case 'upload_file': return 'File Path';
 case 'press_key': return 'Key Name';
 case 'scroll_by_pixels': return 'Pixels (negative=up)';
 case 'wait_for_url': return 'URL Pattern';
 case 'assert_url': return 'Expected URL';
 case 'assert_title': return 'Expected Title';
 case 'screenshot': return 'Screenshot Name';
 default: return 'Value';
 }
 };

 const getValuePlaceholder = () => {
 switch (newStepAction) {
 case 'navigate': return targetUrl || '/page';
 case 'wait': return '1000';
 case 'assert_text': return 'Welcome';
 case 'select_option': return 'option-value';
 case 'upload_file': return '/path/to/file.pdf';
 case 'press_key': return 'Enter, Escape, Tab, ArrowDown...';
 case 'scroll_by_pixels': return '500 (down) or -500 (up)';
 case 'wait_for_url': return '**/dashboard';
 case 'assert_url': return targetUrl ? `${targetUrl}/home` : '/home';
 case 'assert_title': return 'My Page Title';
 case 'screenshot': return 'my-screenshot';
 default: return 'Enter value';
 }
 };

 return (
 <Modal isOpen onClose={onClose} title="Add Test Step" size="md">
 <ModalHeader onClose={onClose}>Add Test Step</ModalHeader>
 <ModalBody>
 <form onSubmit={onSubmit} id="add-step-form" className="space-y-4">
 {/* Feature #1965: Expanded action dropdown with categorized sections */}
 <div>
 <label htmlFor="add-step-action" className="block text-sm font-medium text-foreground">Action</label>
 <select
 id="add-step-action"
 value={newStepAction}
 onChange={(e) => onActionChange(e.target.value)}
 className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 >
 {/* Navigation Actions */}
 <optgroup label="🧭 Navigation">
 <option value="navigate">Navigate to URL</option>
 <option value="go_back">Go Back</option>
 <option value="go_forward">Go Forward</option>
 <option value="refresh">Refresh Page</option>
 </optgroup>

 {/* Interaction Actions */}
 <optgroup label="👆 Interaction">
 <option value="click">Click Element</option>
 <option value="fill">Fill Input</option>
 <option value="type">Type Text</option>
 <option value="clear">Clear Input</option>
 <option value="hover">Hover Over Element</option>
 <option value="select_option">Select Dropdown Option</option>
 <option value="check">Check Checkbox</option>
 <option value="uncheck">Uncheck Checkbox</option>
 <option value="upload_file">Upload File</option>
 <option value="press_key">Press Key</option>
 </optgroup>

 {/* Scroll Actions */}
 <optgroup label="📜 Scroll">
 <option value="scroll_to_element">Scroll to Element</option>
 <option value="scroll_to_top">Scroll to Top</option>
 <option value="scroll_to_bottom">Scroll to Bottom</option>
 <option value="scroll_by_pixels">Scroll by Pixels</option>
 </optgroup>

 {/* Wait Actions */}
 <optgroup label="⏳ Wait">
 <option value="wait_for_element">Wait for Element</option>
 <option value="wait_for_url">Wait for URL</option>
 <option value="wait_for_load">Wait for Page Load</option>
 <option value="wait">Wait (Fixed Time)</option>
 </optgroup>

 {/* Assert Actions */}
 <optgroup label="✅ Assert">
 <option value="assert_text">Assert Text Visible</option>
 <option value="assert_visible">Assert Element Visible</option>
 <option value="assert_hidden">Assert Element Hidden</option>
 <option value="assert_url">Assert URL</option>
 <option value="assert_title">Assert Page Title</option>
 </optgroup>

 {/* Capture Actions */}
 <optgroup label="📸 Capture">
 <option value="screenshot">Take Screenshot</option>
 <option value="screenshot_fullpage">Full Page Screenshot</option>
 <option value="visual_checkpoint">Visual Checkpoint</option>
 <option value="accessibility_check">Accessibility Check</option>
 </optgroup>
 </select>
 </div>

 {/* Selector field */}
 {needsSelector && (
 <div>
 <label htmlFor="add-step-selector" className="block text-sm font-medium text-foreground">Selector</label>
 <div className="relative">
 <input
 type="text"
 id="add-step-selector"
 value={newStepSelector}
 onChange={(e) => onSelectorChange(e.target.value)}
 onKeyDown={onSelectorKeyDown}
 className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 placeholder="e.g., button.submit, #email"
 />
 {/* Feature #1236: AI Copilot autocomplete suggestion */}
 {showSelectorAutocomplete && selectorAutocomplete && (
 <div className="absolute inset-0 mt-1 pointer-events-none">
 <div className="w-full rounded-md border border-transparent px-3 py-2">
 <span className="text-transparent">{newStepSelector}</span>
 <span className="text-muted-foreground/50">{selectorAutocomplete.slice(newStepSelector.length)}</span>
 </div>
 </div>
 )}
 {showSelectorAutocomplete && selectorAutocomplete && (
 <div className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
 <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Tab</kbd>
 <span>to accept</span>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Value field */}
 {needsValue && (
 <div>
 <label htmlFor="add-step-value" className="block text-sm font-medium text-foreground">{getValueLabel()}</label>
 <div className="relative">
 <input
 type="text"
 id="add-step-value"
 value={newStepValue}
 onChange={(e) => onValueChange(e.target.value)}
 onKeyDown={onValueKeyDown}
 className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 placeholder={getValuePlaceholder()}
 />
 {/* Feature #1236: AI Copilot autocomplete suggestion */}
 {showValueAutocomplete && valueAutocomplete && (
 <div className="absolute inset-0 mt-1 pointer-events-none">
 <div className="w-full rounded-md border border-transparent px-3 py-2">
 <span className="text-transparent">{newStepValue}</span>
 <span className="text-muted-foreground/50">{valueAutocomplete.slice(newStepValue.length)}</span>
 </div>
 </div>
 )}
 {showValueAutocomplete && valueAutocomplete && (
 <div className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
 <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Tab</kbd>
 <span>to accept</span>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Visual Checkpoint specific fields */}
 {newStepAction === 'visual_checkpoint' && (
 <>
 <div>
 <label htmlFor="checkpoint-name" className="block text-sm font-medium text-foreground">Checkpoint Name</label>
 <input
 type="text"
 id="checkpoint-name"
 aria-describedby="checkpoint-name-desc"
 value={newStepCheckpointName}
 onChange={(e) => onCheckpointNameChange(e.target.value)}
 className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 placeholder="e.g., login-page, dashboard-header"
 />
 <p id="checkpoint-name-desc" className="mt-1 text-xs text-muted-foreground">Unique identifier for this visual checkpoint</p>
 </div>
 <div>
 <label htmlFor="checkpoint-threshold" className="block text-sm font-medium text-foreground">Diff Threshold (%)</label>
 <input
 type="number"
 id="checkpoint-threshold"
 aria-describedby="checkpoint-threshold-desc"
 value={newStepCheckpointThreshold}
 onChange={(e) => onCheckpointThresholdChange(e.target.value)}
 className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 placeholder="0.1"
 min="0"
 max="100"
 step="0.1"
 />
 <p id="checkpoint-threshold-desc" className="mt-1 text-xs text-muted-foreground">Test fails if diff exceeds this percentage (0 = any change fails)</p>
 </div>
 <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
 <div className="flex items-start gap-2">
 <svg className="h-5 w-5 text-primary mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <div className="text-sm text-primary">
 <p className="font-medium">Visual Checkpoint</p>
 <p className="mt-1">Takes a screenshot and compares it against the baseline. The test will fail if visual differences exceed the threshold.</p>
 </div>
 </div>
 </div>
 </>
 )}

 {/* Accessibility Check specific fields */}
 {newStepAction === 'accessibility_check' && (
 <>
 <div>
 <label htmlFor="a11y-wcag-level" className="block text-sm font-medium text-foreground">WCAG Level</label>
 <select
 id="a11y-wcag-level"
 aria-describedby="a11y-wcag-level-desc"
 value={newStepA11yWcagLevel}
 onChange={(e) => onA11yWcagLevelChange(e.target.value as 'A' | 'AA' | 'AAA')}
 className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 >
 <option value="A">Level A (Minimum)</option>
 <option value="AA">Level AA (Recommended)</option>
 <option value="AAA">Level AAA (Enhanced)</option>
 </select>
 <p id="a11y-wcag-level-desc" className="mt-1 text-xs text-muted-foreground">WCAG conformance level to check against</p>
 </div>
 <div>
 <label htmlFor="a11y-threshold" className="block text-sm font-medium text-foreground">Failure Threshold</label>
 <input
 type="number"
 id="a11y-threshold"
 aria-describedby="a11y-threshold-desc"
 value={newStepA11yThreshold}
 onChange={(e) => onA11yThresholdChange(e.target.value)}
 className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 placeholder="0"
 min="0"
 />
 <p id="a11y-threshold-desc" className="mt-1 text-xs text-muted-foreground">Number of violations allowed before step fails (0 = any violation fails)</p>
 </div>
 <div className="space-y-2">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 id="a11y-fail-critical"
 checked={newStepA11yFailOnCritical}
 onChange={(e) => onA11yFailOnCriticalChange(e.target.checked)}
 className="rounded border-border"
 />
 <span className="text-sm text-foreground">Fail on critical/serious violations only</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 id="a11y-fail-any"
 checked={newStepA11yFailOnAny}
 onChange={(e) => onA11yFailOnAnyChange(e.target.checked)}
 className="rounded border-border"
 />
 <span className="text-sm text-foreground">Fail on any violation (ignore threshold)</span>
 </label>
 </div>
 <div className="rounded-md border border-accent/20 bg-accent/5 p-3">
 <div className="flex items-start gap-2">
 <svg className="h-5 w-5 text-accent mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
 </svg>
 <div className="text-sm text-accent">
 <p className="font-medium">Accessibility Check</p>
 <p className="mt-1">Runs an accessibility scan on the current page using axe-core. The E2E test will fail if accessibility violations exceed the configured threshold.</p>
 </div>
 </div>
 </div>
 </>
 )}

 {addStepError && (
 <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
 {addStepError}
 </div>
 )}
 </form>
 </ModalBody>
 <ModalFooter>
 <button
 type="button"
 onClick={onClose}
 className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
 disabled={isAddingStep}
 >
 Cancel
 </button>
 <button
 type="submit"
 form="add-step-form"
 disabled={isAddingStep}
 className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
 >
 {isAddingStep ? 'Adding...' : 'Add Step'}
 </button>
 </ModalFooter>
 </Modal>
 );
}
