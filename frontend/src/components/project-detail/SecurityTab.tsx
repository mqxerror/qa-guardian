/**
 * SecurityTab - Security scanning tab for ProjectDetailPage
 * Feature #49: Extracted from ProjectDetailPage to reduce line count
 * Feature #102: Split into sub-components (SastConfigPanel, DastConfigPanel, etc.)
 *
 * Contains SAST and DAST security scanning UI:
 * - SAST configuration (Semgrep)
 * - Custom rules management
 * - Secret pattern detection
 * - Pre-commit hook generation
 * - DAST configuration (OWASP ZAP)
 * - Authenticated scanning
 * - Scheduled scans
 * - Scan results display
 */
import {
 SASTConfig,
 SASTScanResult,
 SASTFinding,
 CustomRule,
 SecretPattern,
 DASTConfig,
 DASTScanResult,
 OpenAPISpec,
} from './types';
import {
 SastConfigPanel,
 CustomRulesManager,
 SecretPatternsManager,
 PreCommitHookSection,
 SASTScanResults,
 DastConfigPanel,
 FalsePositiveModal,
} from './security';

export interface SecurityTabProps {
 projectId: string;
 token: string | null;
 // SAST state
 sastConfig: SASTConfig;
 sastScans: SASTScanResult[];
 isLoadingSast: boolean;
 isUpdatingSast: boolean;
 isRunningScan: boolean;
 selectedScan: SASTScanResult | null;
 sastRulesets: Array<{ id: string; name: string; description: string }>;
 customRules: CustomRule[];
 isLoadingCustomRules: boolean;
 showAddCustomRuleModal: boolean;
 newCustomRuleName: string;
 newCustomRuleYaml: string;
 isAddingCustomRule: boolean;
 customRuleError: string | null;
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
 showFalsePositiveModal: boolean;
 selectedFinding: SASTFinding | null;
 fpReason: string;
 isMarkingFP: boolean;
 showFalsePositives: boolean;
 expandedRemediations: Set<string>;
 // DAST state
 dastConfig: DASTConfig;
 dastScans: DASTScanResult[];
 isLoadingDast: boolean;
 isUpdatingDast: boolean;
 isRunningDastScan: boolean;
 selectedDastScan: DASTScanResult | null;
 dastTargetUrl: string;
 openApiSpec: OpenAPISpec | null;
 isUploadingSpec: boolean;
 specUploadError: string | null;
 dastSchedules: any[];
 // SAST handlers
 handleUpdateSastConfig: (updates: Partial<SASTConfig>) => Promise<void>;
 handleTriggerScan: () => Promise<void>;
 setSelectedScan: (scan: SASTScanResult | null) => void;
 setShowAddCustomRuleModal: (show: boolean) => void;
 setNewCustomRuleName: (name: string) => void;
 setNewCustomRuleYaml: (yaml: string) => void;
 setCustomRuleError: (error: string | null) => void;
 handleAddCustomRule: () => Promise<void>;
 handleToggleCustomRule: (id: string, enabled: boolean) => Promise<void>;
 handleDeleteCustomRule: (id: string) => Promise<void>;
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
 setShowFalsePositiveModal: (show: boolean) => void;
 setSelectedFinding: (finding: SASTFinding | null) => void;
 setFpReason: (reason: string) => void;
 handleMarkFalsePositive: () => Promise<void>;
 toggleRemediation: (id: string) => void;
 // DAST handlers
 handleUpdateDastConfig: (updates: Partial<DASTConfig>) => Promise<void>;
 handleTriggerDastScan: () => Promise<void>;
 setDastTargetUrl: (url: string) => void;
 setSelectedDastScan: (scan: DASTScanResult | null) => void;
 handleUploadOpenApiSpec: (content: string) => Promise<void>;
 handleDeleteOpenApiSpec: () => Promise<void>;
 setDastScans: (scans: DASTScanResult[]) => void;
 setDastSchedules: (schedules: any[]) => void;
}

export function SecurityTab(props: SecurityTabProps) {
 const {
 projectId, token,
 // SAST state
 sastConfig, sastScans, isLoadingSast, isUpdatingSast, isRunningScan, selectedScan, sastRulesets,
 customRules, showAddCustomRuleModal, newCustomRuleName, newCustomRuleYaml, isAddingCustomRule, customRuleError,
 secretPatterns, showAddSecretPatternModal, newPatternName, newPatternDescription, newPatternRegex,
 newPatternSeverity, isAddingPattern, patternError, patternTestInput, patternTestResult,
 showFalsePositiveModal, selectedFinding, fpReason, isMarkingFP, expandedRemediations,
 // DAST state
 dastConfig, dastScans, isLoadingDast, isUpdatingDast, isRunningDastScan, selectedDastScan,
 dastTargetUrl, openApiSpec, isUploadingSpec, specUploadError, dastSchedules,
 // SAST handlers
 handleUpdateSastConfig, handleTriggerScan, setSelectedScan, setShowAddCustomRuleModal, setNewCustomRuleName,
 setNewCustomRuleYaml, setCustomRuleError, handleAddCustomRule, handleToggleCustomRule, handleDeleteCustomRule,
 setShowAddSecretPatternModal, setNewPatternName, setNewPatternDescription, setNewPatternRegex,
 setNewPatternSeverity, setPatternError, setPatternTestInput, setPatternTestResult, handleAddSecretPattern,
 handleToggleSecretPattern, handleDeleteSecretPattern, handleTestPattern, setShowFalsePositiveModal,
 setSelectedFinding, setFpReason, handleMarkFalsePositive, toggleRemediation,
 // DAST handlers
 handleUpdateDastConfig, handleTriggerDastScan, setDastTargetUrl, setSelectedDastScan,
 handleUploadOpenApiSpec, handleDeleteOpenApiSpec, setDastScans, setDastSchedules,
 } = props;

 return (
 <div className="mt-8 space-y-6">
 {/* SAST Configuration Section */}
 <div className="rounded-lg border border-border bg-card p-6">
 <SastHeader sastConfig={sastConfig} isUpdatingSast={isUpdatingSast} handleUpdateSastConfig={handleUpdateSastConfig} />
 {isLoadingSast ? <LoadingSpinner message="Loading SAST configuration..." /> : sastConfig.enabled && (
 <SastConfigPanel
 sastConfig={sastConfig} sastRulesets={sastRulesets} isUpdatingSast={isUpdatingSast}
 isRunningScan={isRunningScan} handleUpdateSastConfig={handleUpdateSastConfig} handleTriggerScan={handleTriggerScan}
 />
 )}
 </div>

 {/* Custom Rules Section */}
 {sastConfig.enabled && (
 <CustomRulesManager
 customRules={customRules} showAddCustomRuleModal={showAddCustomRuleModal} newCustomRuleName={newCustomRuleName}
 newCustomRuleYaml={newCustomRuleYaml} isAddingCustomRule={isAddingCustomRule} customRuleError={customRuleError}
 setShowAddCustomRuleModal={setShowAddCustomRuleModal} setNewCustomRuleName={setNewCustomRuleName}
 setNewCustomRuleYaml={setNewCustomRuleYaml} setCustomRuleError={setCustomRuleError}
 handleAddCustomRule={handleAddCustomRule} handleToggleCustomRule={handleToggleCustomRule} handleDeleteCustomRule={handleDeleteCustomRule}
 />
 )}

 {/* Custom Secret Patterns Section */}
 {sastConfig.enabled && (
 <SecretPatternsManager
 projectId={projectId} secretPatterns={secretPatterns} showAddSecretPatternModal={showAddSecretPatternModal}
 newPatternName={newPatternName} newPatternDescription={newPatternDescription} newPatternRegex={newPatternRegex}
 newPatternSeverity={newPatternSeverity} isAddingPattern={isAddingPattern} patternError={patternError}
 patternTestInput={patternTestInput} patternTestResult={patternTestResult}
 setShowAddSecretPatternModal={setShowAddSecretPatternModal} setNewPatternName={setNewPatternName}
 setNewPatternDescription={setNewPatternDescription} setNewPatternRegex={setNewPatternRegex}
 setNewPatternSeverity={setNewPatternSeverity} setPatternError={setPatternError}
 setPatternTestInput={setPatternTestInput} setPatternTestResult={setPatternTestResult}
 handleAddSecretPattern={handleAddSecretPattern} handleToggleSecretPattern={handleToggleSecretPattern}
 handleDeleteSecretPattern={handleDeleteSecretPattern} handleTestPattern={handleTestPattern}
 />
 )}

 {/* Pre-commit Hook Section */}
 {sastConfig.enabled && <PreCommitHookSection projectId={projectId} secretPatterns={secretPatterns} />}

 {/* SAST Scan Results Section */}
 {sastConfig.enabled && sastScans.length > 0 && (
 <SASTScanResults
 sastScans={sastScans} selectedScan={selectedScan} expandedRemediations={expandedRemediations}
 setSelectedScan={setSelectedScan} setShowFalsePositiveModal={setShowFalsePositiveModal}
 setSelectedFinding={setSelectedFinding} toggleRemediation={toggleRemediation}
 />
 )}

 {/* SAST Empty State */}
 {!sastConfig.enabled && !isLoadingSast && <SastEmptyState handleUpdateSastConfig={handleUpdateSastConfig} />}

 {/* DAST Section */}
 <DastConfigPanel
 projectId={projectId} token={token} dastConfig={dastConfig} dastScans={dastScans}
 isLoadingDast={isLoadingDast} isUpdatingDast={isUpdatingDast} isRunningDastScan={isRunningDastScan}
 selectedDastScan={selectedDastScan} dastTargetUrl={dastTargetUrl} openApiSpec={openApiSpec}
 isUploadingSpec={isUploadingSpec} specUploadError={specUploadError} dastSchedules={dastSchedules}
 handleUpdateDastConfig={handleUpdateDastConfig} handleTriggerDastScan={handleTriggerDastScan}
 setDastTargetUrl={setDastTargetUrl} setSelectedDastScan={setSelectedDastScan}
 handleUploadOpenApiSpec={handleUploadOpenApiSpec} handleDeleteOpenApiSpec={handleDeleteOpenApiSpec}
 setDastScans={setDastScans} setDastSchedules={setDastSchedules}
 />

 {/* False Positive Modal */}
 {showFalsePositiveModal && selectedFinding && (
 <FalsePositiveModal
 selectedFinding={selectedFinding} fpReason={fpReason} isMarkingFP={isMarkingFP}
 setFpReason={setFpReason} setShowFalsePositiveModal={setShowFalsePositiveModal} handleMarkFalsePositive={handleMarkFalsePositive}
 />
 )}
 </div>
 );
}

// Small helper components to keep main component clean
function SastHeader({ sastConfig, isUpdatingSast, handleUpdateSastConfig }: {
 sastConfig: SASTConfig; isUpdatingSast: boolean; handleUpdateSastConfig: (updates: Partial<SASTConfig>) => Promise<void>;
}) {
 return (
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-4">
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
 <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
 </svg>
 </div>
 <div>
 <h2 className="text-lg font-semibold text-foreground">Static Application Security Testing (SAST)</h2>
 <p className="text-sm text-muted-foreground">Scan your source code for security vulnerabilities using Semgrep</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span id="sast-toggle-label" className="text-sm text-muted-foreground">{sastConfig.enabled ? 'Enabled' : 'Disabled'}</span>
 <button
 type="button"
 role="switch"
 aria-checked={sastConfig.enabled}
 aria-labelledby="sast-toggle-label"
 onClick={() => !isUpdatingSast && handleUpdateSastConfig({ enabled: !sastConfig.enabled })}
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${sastConfig.enabled ? 'bg-orange-600' : 'bg-muted'}`}
 >
 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sastConfig.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
 </button>
 </div>
 </div>
 );
}

function LoadingSpinner({ message }: { message: string }) {
 return (
 <div className="py-8 text-center">
 <svg className="mx-auto h-8 w-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 <p className="mt-2 text-muted-foreground">{message}</p>
 </div>
 );
}

function SastEmptyState({ handleUpdateSastConfig }: { handleUpdateSastConfig: (updates: Partial<SASTConfig>) => Promise<void> }) {
 return (
 <div className="rounded-lg border border-dashed border-border p-8 text-center">
 <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
 </svg>
 <h3 className="mt-4 text-lg font-semibold text-foreground">SAST Scanning Disabled</h3>
 <p className="mt-2 text-muted-foreground">Enable SAST scanning to detect security vulnerabilities in your source code using Semgrep.</p>
 <button onClick={() => handleUpdateSastConfig({ enabled: true })} className="mt-4 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
 Enable SAST Scanning
 </button>
 </div>
 );
}
