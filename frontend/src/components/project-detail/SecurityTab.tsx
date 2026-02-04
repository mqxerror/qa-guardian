/**
 * SecurityTab - Security scanning tab for ProjectDetailPage
 * Feature #49: Extracted from ProjectDetailPage to reduce line count
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
import { toast } from '../../stores/toastStore';
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
    projectId,
    token,
    // SAST state
    sastConfig,
    sastScans,
    isLoadingSast,
    isUpdatingSast,
    isRunningScan,
    selectedScan,
    sastRulesets,
    customRules,
    showAddCustomRuleModal,
    newCustomRuleName,
    newCustomRuleYaml,
    isAddingCustomRule,
    customRuleError,
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
    showFalsePositiveModal,
    selectedFinding,
    fpReason,
    isMarkingFP,
    expandedRemediations,
    // DAST state
    dastConfig,
    dastScans,
    isLoadingDast,
    isUpdatingDast,
    isRunningDastScan,
    selectedDastScan,
    dastTargetUrl,
    openApiSpec,
    isUploadingSpec,
    specUploadError,
    dastSchedules,
    // SAST handlers
    handleUpdateSastConfig,
    handleTriggerScan,
    setSelectedScan,
    setShowAddCustomRuleModal,
    setNewCustomRuleName,
    setNewCustomRuleYaml,
    setCustomRuleError,
    handleAddCustomRule,
    handleToggleCustomRule,
    handleDeleteCustomRule,
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
    setShowFalsePositiveModal,
    setSelectedFinding,
    setFpReason,
    handleMarkFalsePositive,
    toggleRemediation,
    // DAST handlers
    handleUpdateDastConfig,
    handleTriggerDastScan,
    setDastTargetUrl,
    setSelectedDastScan,
    handleUploadOpenApiSpec,
    handleDeleteOpenApiSpec,
    setDastScans,
    setDastSchedules,
  } = props;

  return (
    <div className="mt-8 space-y-6">
      {/* SAST Configuration Section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
              <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Static Application Security Testing (SAST)</h2>
              <p className="text-sm text-muted-foreground">
                Scan your source code for security vulnerabilities using Semgrep
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-muted-foreground">
              {sastConfig.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <div
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                sastConfig.enabled ? 'bg-orange-600' : 'bg-muted'
              }`}
              onClick={() => !isUpdatingSast && handleUpdateSastConfig({ enabled: !sastConfig.enabled })}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  sastConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </div>
          </label>
        </div>

        {isLoadingSast ? (
          <div className="py-8 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-2 text-muted-foreground">Loading SAST configuration...</p>
          </div>
        ) : sastConfig.enabled && (
          <SASTConfigSection
            sastConfig={sastConfig}
            sastRulesets={sastRulesets}
            isUpdatingSast={isUpdatingSast}
            isRunningScan={isRunningScan}
            handleUpdateSastConfig={handleUpdateSastConfig}
            handleTriggerScan={handleTriggerScan}
          />
        )}
      </div>

      {/* Custom Rules Section */}
      {sastConfig.enabled && (
        <CustomRulesSection
          customRules={customRules}
          showAddCustomRuleModal={showAddCustomRuleModal}
          newCustomRuleName={newCustomRuleName}
          newCustomRuleYaml={newCustomRuleYaml}
          isAddingCustomRule={isAddingCustomRule}
          customRuleError={customRuleError}
          setShowAddCustomRuleModal={setShowAddCustomRuleModal}
          setNewCustomRuleName={setNewCustomRuleName}
          setNewCustomRuleYaml={setNewCustomRuleYaml}
          setCustomRuleError={setCustomRuleError}
          handleAddCustomRule={handleAddCustomRule}
          handleToggleCustomRule={handleToggleCustomRule}
          handleDeleteCustomRule={handleDeleteCustomRule}
        />
      )}

      {/* Custom Secret Patterns Section */}
      {sastConfig.enabled && (
        <SecretPatternsSection
          projectId={projectId}
          secretPatterns={secretPatterns}
          showAddSecretPatternModal={showAddSecretPatternModal}
          newPatternName={newPatternName}
          newPatternDescription={newPatternDescription}
          newPatternRegex={newPatternRegex}
          newPatternSeverity={newPatternSeverity}
          isAddingPattern={isAddingPattern}
          patternError={patternError}
          patternTestInput={patternTestInput}
          patternTestResult={patternTestResult}
          setShowAddSecretPatternModal={setShowAddSecretPatternModal}
          setNewPatternName={setNewPatternName}
          setNewPatternDescription={setNewPatternDescription}
          setNewPatternRegex={setNewPatternRegex}
          setNewPatternSeverity={setNewPatternSeverity}
          setPatternError={setPatternError}
          setPatternTestInput={setPatternTestInput}
          setPatternTestResult={setPatternTestResult}
          handleAddSecretPattern={handleAddSecretPattern}
          handleToggleSecretPattern={handleToggleSecretPattern}
          handleDeleteSecretPattern={handleDeleteSecretPattern}
          handleTestPattern={handleTestPattern}
        />
      )}

      {/* Pre-commit Hook Section */}
      {sastConfig.enabled && (
        <PreCommitHookSection projectId={projectId} secretPatterns={secretPatterns} />
      )}

      {/* SAST Scan Results Section */}
      {sastConfig.enabled && sastScans.length > 0 && (
        <SASTScanResultsSection
          sastScans={sastScans}
          selectedScan={selectedScan}
          expandedRemediations={expandedRemediations}
          setSelectedScan={setSelectedScan}
          setShowFalsePositiveModal={setShowFalsePositiveModal}
          setSelectedFinding={setSelectedFinding}
          toggleRemediation={toggleRemediation}
        />
      )}

      {/* SAST Empty State */}
      {!sastConfig.enabled && !isLoadingSast && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-foreground">SAST Scanning Disabled</h3>
          <p className="mt-2 text-muted-foreground">
            Enable SAST scanning to detect security vulnerabilities in your source code using Semgrep.
          </p>
          <button
            onClick={() => handleUpdateSastConfig({ enabled: true })}
            className="mt-4 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Enable SAST Scanning
          </button>
        </div>
      )}

      {/* DAST Section */}
      <DASTSection
        projectId={projectId}
        token={token}
        dastConfig={dastConfig}
        dastScans={dastScans}
        isLoadingDast={isLoadingDast}
        isUpdatingDast={isUpdatingDast}
        isRunningDastScan={isRunningDastScan}
        selectedDastScan={selectedDastScan}
        dastTargetUrl={dastTargetUrl}
        openApiSpec={openApiSpec}
        isUploadingSpec={isUploadingSpec}
        specUploadError={specUploadError}
        dastSchedules={dastSchedules}
        handleUpdateDastConfig={handleUpdateDastConfig}
        handleTriggerDastScan={handleTriggerDastScan}
        setDastTargetUrl={setDastTargetUrl}
        setSelectedDastScan={setSelectedDastScan}
        handleUploadOpenApiSpec={handleUploadOpenApiSpec}
        handleDeleteOpenApiSpec={handleDeleteOpenApiSpec}
        setDastScans={setDastScans}
        setDastSchedules={setDastSchedules}
      />

      {/* False Positive Modal */}
      {showFalsePositiveModal && selectedFinding && (
        <FalsePositiveModal
          selectedFinding={selectedFinding}
          fpReason={fpReason}
          isMarkingFP={isMarkingFP}
          setFpReason={setFpReason}
          setShowFalsePositiveModal={setShowFalsePositiveModal}
          handleMarkFalsePositive={handleMarkFalsePositive}
        />
      )}
    </div>
  );
}

// Sub-components to organize the massive JSX

interface SASTConfigSectionProps {
  sastConfig: SASTConfig;
  sastRulesets: Array<{ id: string; name: string; description: string }>;
  isUpdatingSast: boolean;
  isRunningScan: boolean;
  handleUpdateSastConfig: (updates: Partial<SASTConfig>) => Promise<void>;
  handleTriggerScan: () => Promise<void>;
}

function SASTConfigSection({
  sastConfig,
  sastRulesets,
  isUpdatingSast,
  isRunningScan,
  handleUpdateSastConfig,
  handleTriggerScan,
}: SASTConfigSectionProps) {
  return (
    <div className="space-y-4">
      {/* Ruleset Selection */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Semgrep Ruleset
        </label>
        <select
          value={sastConfig.ruleset}
          onChange={(e) => handleUpdateSastConfig({ ruleset: e.target.value as 'default' | 'security' | 'custom' })}
          disabled={isUpdatingSast}
          className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
        >
          {sastRulesets.map((ruleset) => (
            <option key={ruleset.id} value={ruleset.id}>
              {ruleset.name} - {ruleset.description}
            </option>
          ))}
        </select>
      </div>

      {/* Severity Threshold */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Minimum Severity to Report
        </label>
        <select
          value={sastConfig.severityThreshold}
          onChange={(e) => handleUpdateSastConfig({ severityThreshold: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' })}
          disabled={isUpdatingSast}
          className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
        >
          <option value="CRITICAL">Critical only</option>
          <option value="HIGH">High and above</option>
          <option value="MEDIUM">Medium and above</option>
          <option value="LOW">All findings (including low)</option>
        </select>
      </div>

      {/* Auto-scan toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="auto-scan"
          checked={sastConfig.autoScan}
          onChange={(e) => handleUpdateSastConfig({ autoScan: e.target.checked })}
          disabled={isUpdatingSast}
          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
        />
        <label htmlFor="auto-scan" className="text-sm text-foreground">
          Automatically scan on repository changes
        </label>
      </div>

      {/* Trigger Scan Button */}
      <div className="pt-4 border-t border-border">
        <button
          onClick={handleTriggerScan}
          disabled={isRunningScan || isUpdatingSast}
          className="flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {isRunningScan ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Scanning...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Run SAST Scan
            </>
          )}
        </button>
        {sastConfig.lastScanAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            Last scan: {new Date(sastConfig.lastScanAt).toLocaleString()}
            {sastConfig.lastScanStatus && (
              <span className={`ml-2 ${
                sastConfig.lastScanStatus === 'completed' ? 'text-green-600' :
                sastConfig.lastScanStatus === 'failed' ? 'text-red-600' :
                'text-amber-600'
              }`}>
                ({sastConfig.lastScanStatus})
              </span>
            )}
          </p>
        )}
      </div>

      {/* GitHub PR Integration Settings */}
      <div className="pt-4 mt-4 border-t border-border">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
          GitHub PR Integration
        </h4>
        <p className="text-xs text-muted-foreground mb-4">
          Configure how SAST scans integrate with GitHub pull requests
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="sast-pr-checks"
              checked={sastConfig.prChecksEnabled || false}
              onChange={(e) => handleUpdateSastConfig({ prChecksEnabled: e.target.checked })}
              disabled={isUpdatingSast}
              className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <label htmlFor="sast-pr-checks" className="text-sm text-foreground">
              Enable SAST checks on pull requests
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="sast-pr-comments"
              checked={sastConfig.prCommentsEnabled || false}
              onChange={(e) => handleUpdateSastConfig({ prCommentsEnabled: e.target.checked })}
              disabled={isUpdatingSast || !sastConfig.prChecksEnabled}
              className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
            />
            <label htmlFor="sast-pr-comments" className={`text-sm ${sastConfig.prChecksEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
              Post SAST findings as PR comments
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="sast-block-critical"
              checked={sastConfig.blockPrOnCritical || false}
              onChange={(e) => handleUpdateSastConfig({ blockPrOnCritical: e.target.checked })}
              disabled={isUpdatingSast || !sastConfig.prChecksEnabled}
              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 disabled:opacity-50"
            />
            <label htmlFor="sast-block-critical" className={`text-sm ${sastConfig.prChecksEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
              <span className="text-red-600 font-medium">Block PR</span> if critical vulnerabilities found
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="sast-block-high"
              checked={sastConfig.blockPrOnHigh || false}
              onChange={(e) => handleUpdateSastConfig({ blockPrOnHigh: e.target.checked })}
              disabled={isUpdatingSast || !sastConfig.prChecksEnabled}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
            />
            <label htmlFor="sast-block-high" className={`text-sm ${sastConfig.prChecksEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
              <span className="text-amber-600 font-medium">Block PR</span> if high or critical vulnerabilities found
            </label>
          </div>
        </div>

        {sastConfig.prChecksEnabled && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> SAST checks will automatically run when a PR is created or updated.
              {sastConfig.blockPrOnCritical && ' PRs with critical vulnerabilities will be blocked from merging.'}
              {sastConfig.blockPrOnHigh && !sastConfig.blockPrOnCritical && ' PRs with high or critical vulnerabilities will be blocked from merging.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Custom Rules Section
// ============================================================================

interface CustomRulesSectionProps {
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

function CustomRulesSection(props: CustomRulesSectionProps) {
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
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    rule.enabled ? 'bg-orange-600' : 'bg-muted'
                  }`}
                  onClick={() => handleToggleCustomRule(rule.id, !rule.enabled)}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      rule.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
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
              <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
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

// ============================================================================
// Secret Patterns Section
// ============================================================================

interface SecretPatternsSectionProps {
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

function SecretPatternsSection(props: SecretPatternsSectionProps) {
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
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
            <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          className="flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
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
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    pattern.enabled ? 'bg-purple-600' : 'bg-muted'
                  }`}
                  onClick={() => handleToggleSecretPattern(pattern.id, !pattern.enabled)}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      pattern.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{pattern.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      pattern.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      pattern.severity === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      pattern.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
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
                className="p-2 text-muted-foreground hover:text-red-600 transition-colors"
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
      {showAddSecretPatternModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Add Custom Secret Pattern</h3>
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
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {patternError && (
              <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                {patternError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Pattern Name <span className="text-red-500">*</span>
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
                  Regex Pattern <span className="text-red-500">*</span>
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
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                  }`}>
                    {patternTestResult.matches ? (
                      <>✓ Pattern matches! Found: <code className="bg-green-100 dark:bg-green-900/30 px-1 rounded">{patternTestResult.matched}</code></>
                    ) : (
                      <>✗ Pattern does not match the test string</>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
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
                className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {isAddingPattern ? 'Adding...' : 'Add Pattern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Pre-commit Hook Section
// ============================================================================

interface PreCommitHookSectionProps {
  projectId: string;
  secretPatterns: SecretPattern[];
}

function PreCommitHookSection({ projectId, secretPatterns }: PreCommitHookSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Pre-commit Hook</h3>
            <p className="text-sm text-muted-foreground">
              Generate a pre-commit hook to prevent secrets from being committed
            </p>
          </div>
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Why use a pre-commit hook?</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Catches secrets before they enter your git history</li>
          <li>Prevents accidental credential exposure</li>
          <li>Enforces security at the developer level</li>
          <li>Works offline, no server required</li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Pre-commit Framework Option */}
        <div className="border border-border rounded-lg p-4 hover:border-green-500 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="font-medium text-foreground">.pre-commit-config.yaml</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            For the pre-commit framework. Easiest setup with automatic updates.
          </p>
          <div className="flex gap-2">
            <a
              href={`/api/v1/projects/${projectId}/sast/gitleaks/pre-commit/download?format=pre-commit&mode=fail`}
              download=".pre-commit-config.yaml"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Block Mode
            </a>
            <a
              href={`/api/v1/projects/${projectId}/sast/gitleaks/pre-commit/download?format=pre-commit&mode=warn`}
              download=".pre-commit-config.yaml"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Warn Mode
            </a>
          </div>
        </div>

        {/* Git Hook Option */}
        <div className="border border-border rounded-lg p-4 hover:border-green-500 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="font-medium text-foreground">Git Hook Script</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Native bash script for .git/hooks/pre-commit. No dependencies required.
          </p>
          <div className="flex gap-2">
            <a
              href={`/api/v1/projects/${projectId}/sast/gitleaks/pre-commit/download?format=git-hook&mode=fail`}
              download="pre-commit"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Block Mode
            </a>
            <a
              href={`/api/v1/projects/${projectId}/sast/gitleaks/pre-commit/download?format=git-hook&mode=warn`}
              download="pre-commit"
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Warn Mode
            </a>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Block Mode:</strong> Prevents commits when secrets are detected.{' '}
          <strong>Warn Mode:</strong> Shows warnings but allows the commit.
          {secretPatterns.filter(p => p.enabled).length > 0 && (
            <> Your {secretPatterns.filter(p => p.enabled).length} custom pattern(s) will be included.</>
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// SAST Scan Results Section - Placeholder (will be implemented separately due to size)
// ============================================================================

interface SASTScanResultsSectionProps {
  sastScans: SASTScanResult[];
  selectedScan: SASTScanResult | null;
  expandedRemediations: Set<string>;
  setSelectedScan: (scan: SASTScanResult | null) => void;
  setShowFalsePositiveModal: (show: boolean) => void;
  setSelectedFinding: (finding: SASTFinding | null) => void;
  toggleRemediation: (id: string) => void;
}

function SASTScanResultsSection(props: SASTScanResultsSectionProps) {
  const {
    sastScans,
    selectedScan,
    expandedRemediations,
    setSelectedScan,
    setShowFalsePositiveModal,
    setSelectedFinding,
    toggleRemediation,
  } = props;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Recent Scan Results</h3>
      <div className="space-y-4">
        {sastScans.map((scan) => (
          <div
            key={scan.id}
            className={`rounded-lg border p-4 cursor-pointer transition-colors ${
              selectedScan?.id === scan.id
                ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10'
                : 'border-border hover:border-orange-300'
            }`}
            onClick={() => setSelectedScan(selectedScan?.id === scan.id ? null : scan)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  scan.status === 'completed' && scan.summary.bySeverity.critical > 0
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : scan.status === 'completed' && scan.summary.bySeverity.high > 0
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                    : scan.status === 'completed' && scan.summary.bySeverity.medium > 0
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                    : scan.status === 'completed'
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : scan.status === 'failed'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {scan.status === 'running' ? (
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : scan.status === 'completed' ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {scan.status === 'completed' ? `${scan.summary.total} findings` :
                     scan.status === 'running' ? 'Scan in progress...' : 'Scan failed'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(scan.startedAt).toLocaleString()}
                    {scan.branch && ` • Branch: ${scan.branch}`}
                  </p>
                </div>
              </div>
              {scan.status === 'completed' && (
                <div className="flex items-center gap-4 text-sm">
                  {scan.summary.bySeverity.critical > 0 && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {scan.summary.bySeverity.critical} critical
                    </span>
                  )}
                  {scan.summary.bySeverity.high > 0 && (
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {scan.summary.bySeverity.high} high
                    </span>
                  )}
                  {scan.summary.bySeverity.medium > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      {scan.summary.bySeverity.medium} medium
                    </span>
                  )}
                  {scan.summary.bySeverity.low > 0 && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      {scan.summary.bySeverity.low} low
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Expanded findings view */}
            {selectedScan?.id === scan.id && scan.findings.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <h4 className="text-sm font-medium text-foreground mb-3">Findings</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {scan.findings.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      expandedRemediations={expandedRemediations}
                      toggleRemediation={toggleRemediation}
                      setShowFalsePositiveModal={setShowFalsePositiveModal}
                      setSelectedFinding={setSelectedFinding}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Finding Card Component
interface FindingCardProps {
  finding: SASTFinding;
  expandedRemediations: Set<string>;
  toggleRemediation: (id: string) => void;
  setShowFalsePositiveModal: (show: boolean) => void;
  setSelectedFinding: (finding: SASTFinding | null) => void;
}

function FindingCard({
  finding,
  expandedRemediations,
  toggleRemediation,
  setShowFalsePositiveModal,
  setSelectedFinding,
}: FindingCardProps) {
  return (
    <div
      className={`rounded-md border p-3 ${
        finding.isFalsePositive
          ? 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30 opacity-60'
          : finding.severity === 'CRITICAL'
          ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10'
          : finding.severity === 'HIGH'
          ? 'border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-900/10'
          : finding.severity === 'MEDIUM'
          ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/10'
          : 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-900/10'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            finding.isFalsePositive
              ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              : finding.severity === 'CRITICAL'
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              : finding.severity === 'HIGH'
              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
              : finding.severity === 'MEDIUM'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          }`}>
            {finding.severity}
          </span>
          {finding.isFalsePositive && (
            <span className="inline-flex items-center rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
              False Positive
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`font-medium text-foreground ${finding.isFalsePositive ? 'line-through' : ''}`}>
              {finding.ruleName}
            </p>
            {!finding.isFalsePositive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFinding(finding);
                  setShowFalsePositiveModal(true);
                }}
                className="shrink-0 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Mark False Positive
              </button>
            )}
          </div>
          <p className={`text-sm text-muted-foreground mt-1 ${finding.isFalsePositive ? 'line-through' : ''}`}>
            {finding.message}
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            {finding.filePath}:{finding.line}
            {finding.column && `:${finding.column}`}
          </p>
          {finding.snippet && (
            <pre className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto">
              {finding.snippet}
            </pre>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {finding.cweId && (
              <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300">
                {finding.cweId}
              </span>
            )}
            {finding.owaspCategory && (
              <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
                {finding.owaspCategory}
              </span>
            )}
          </div>
          {finding.suggestion && !finding.isFalsePositive && (
            <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-800 dark:text-green-200">
                <strong>Suggestion:</strong> {finding.suggestion}
              </p>
            </div>
          )}

          {/* Remediation Guidance (expandable) */}
          {finding.remediation && !finding.isFalsePositive && (
            <div className="mt-3 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRemediation(finding.id);
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Remediation Guidance
                </span>
                <svg
                  className={`h-4 w-4 transition-transform ${expandedRemediations.has(finding.id) ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedRemediations.has(finding.id) && (
                <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
                  <p className="text-sm text-foreground font-medium">{finding.remediation.summary}</p>

                  <div>
                    <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Fix Steps</h5>
                    <ol className="list-decimal list-inside space-y-1">
                      {finding.remediation.steps.map((step, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground">{step}</li>
                      ))}
                    </ol>
                  </div>

                  {finding.remediation.secureCodeExample && (
                    <div>
                      <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Secure Code Pattern</h5>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">❌ Before (Vulnerable)</p>
                          <pre className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-red-200 dark:border-red-800">
                            {finding.remediation.secureCodeExample.before}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">✅ After (Secure)</p>
                          <pre className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-green-200 dark:border-green-800">
                            {finding.remediation.secureCodeExample.after}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {finding.remediation.references.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Documentation & References</h5>
                      <ul className="space-y-1">
                        {finding.remediation.references.map((ref, idx) => (
                          <li key={idx}>
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              {ref.title}
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DAST Section - Placeholder component for the massive DAST UI
// ============================================================================

interface DASTSectionProps {
  projectId: string;
  token: string | null;
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
  handleUpdateDastConfig: (updates: Partial<DASTConfig>) => Promise<void>;
  handleTriggerDastScan: () => Promise<void>;
  setDastTargetUrl: (url: string) => void;
  setSelectedDastScan: (scan: DASTScanResult | null) => void;
  handleUploadOpenApiSpec: (content: string) => Promise<void>;
  handleDeleteOpenApiSpec: () => Promise<void>;
  setDastScans: (scans: DASTScanResult[]) => void;
  setDastSchedules: (schedules: any[]) => void;
}

function DASTSection(props: DASTSectionProps) {
  const {
    projectId,
    token,
    dastConfig,
    dastScans,
    isLoadingDast,
    isUpdatingDast,
    isRunningDastScan,
    selectedDastScan,
    dastTargetUrl,
    openApiSpec,
    isUploadingSpec,
    specUploadError,
    dastSchedules,
    handleUpdateDastConfig,
    handleTriggerDastScan,
    setDastTargetUrl,
    setSelectedDastScan,
    handleUploadOpenApiSpec,
    handleDeleteOpenApiSpec,
    setDastScans,
    setDastSchedules,
  } = props;

  return (
    <div className="mt-8 pt-8 border-t border-border">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Dynamic Application Security Testing (DAST)</h2>
              <p className="text-sm text-muted-foreground">
                Scan running web applications for security vulnerabilities using OWASP ZAP
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-muted-foreground">
              {dastConfig.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <div
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                dastConfig.enabled ? 'bg-purple-600' : 'bg-muted'
              }`}
              onClick={() => !isUpdatingDast && handleUpdateDastConfig({ enabled: !dastConfig.enabled })}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  dastConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </div>
          </label>
        </div>

        {isLoadingDast ? (
          <div className="py-8 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-2 text-muted-foreground">Loading DAST configuration...</p>
          </div>
        ) : dastConfig.enabled ? (
          <DASTConfigSection
            projectId={projectId}
            token={token}
            dastConfig={dastConfig}
            dastTargetUrl={dastTargetUrl}
            openApiSpec={openApiSpec}
            isUpdatingDast={isUpdatingDast}
            isRunningDastScan={isRunningDastScan}
            isUploadingSpec={isUploadingSpec}
            specUploadError={specUploadError}
            dastSchedules={dastSchedules}
            handleUpdateDastConfig={handleUpdateDastConfig}
            handleTriggerDastScan={handleTriggerDastScan}
            setDastTargetUrl={setDastTargetUrl}
            handleUploadOpenApiSpec={handleUploadOpenApiSpec}
            handleDeleteOpenApiSpec={handleDeleteOpenApiSpec}
            setDastSchedules={setDastSchedules}
          />
        ) : null}
      </div>

      {/* DAST Scan Results */}
      {dastConfig.enabled && dastScans.length > 0 && (
        <DASTScanResults
          projectId={projectId}
          token={token}
          dastScans={dastScans}
          selectedDastScan={selectedDastScan}
          setSelectedDastScan={setSelectedDastScan}
          setDastScans={setDastScans}
        />
      )}
    </div>
  );
}

// DAST Configuration Section (simplified - full implementation needed)
interface DASTConfigSectionProps {
  projectId: string;
  token: string | null;
  dastConfig: DASTConfig;
  dastTargetUrl: string;
  openApiSpec: OpenAPISpec | null;
  isUpdatingDast: boolean;
  isRunningDastScan: boolean;
  isUploadingSpec: boolean;
  specUploadError: string | null;
  dastSchedules: any[];
  handleUpdateDastConfig: (updates: Partial<DASTConfig>) => Promise<void>;
  handleTriggerDastScan: () => Promise<void>;
  setDastTargetUrl: (url: string) => void;
  handleUploadOpenApiSpec: (content: string) => Promise<void>;
  handleDeleteOpenApiSpec: () => Promise<void>;
  setDastSchedules: (schedules: any[]) => void;
}

function DASTConfigSection(props: DASTConfigSectionProps) {
  const {
    projectId,
    token,
    dastConfig,
    dastTargetUrl,
    openApiSpec,
    isUpdatingDast,
    isRunningDastScan,
    isUploadingSpec,
    specUploadError,
    dastSchedules,
    handleUpdateDastConfig,
    handleTriggerDastScan,
    setDastTargetUrl,
    handleUploadOpenApiSpec,
    handleDeleteOpenApiSpec,
    setDastSchedules,
  } = props;

  return (
    <div className="space-y-4">
      {/* Target URL */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Target URL</label>
        <input
          type="url"
          value={dastTargetUrl}
          onChange={(e) => setDastTargetUrl(e.target.value)}
          onBlur={() => {
            if (dastTargetUrl !== dastConfig.targetUrl) {
              handleUpdateDastConfig({ targetUrl: dastTargetUrl });
            }
          }}
          placeholder="https://your-app.example.com"
          className="w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          The URL of the running application to scan (e.g., staging environment)
        </p>
      </div>

      {/* Scan Profile */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Scan Profile</label>
        <select
          value={dastConfig.scanProfile}
          onChange={(e) => handleUpdateDastConfig({ scanProfile: e.target.value as 'baseline' | 'full' | 'api' })}
          disabled={isUpdatingDast}
          className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
        >
          <option value="baseline">Baseline Scan - Quick passive scan (~2 min)</option>
          <option value="full">Full Scan - Comprehensive active scan (~30+ min)</option>
          <option value="api">API Scan - For REST/GraphQL APIs (~5-10 min)</option>
        </select>
      </div>

      {/* Alert Threshold */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Minimum Alert Level</label>
        <select
          value={dastConfig.alertThreshold}
          onChange={(e) => handleUpdateDastConfig({ alertThreshold: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })}
          disabled={isUpdatingDast}
          className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-foreground"
        >
          <option value="HIGH">High risk only</option>
          <option value="MEDIUM">Medium and above</option>
          <option value="LOW">All alerts (including low)</option>
        </select>
      </div>

      {/* Trigger Scan Button */}
      <div className="pt-4 border-t border-border">
        <button
          onClick={handleTriggerDastScan}
          disabled={isRunningDastScan || isUpdatingDast || !dastTargetUrl}
          className="flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {isRunningDastScan ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Scanning...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              Start DAST Scan
            </>
          )}
        </button>
        {dastConfig.lastScanAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            Last scan: {new Date(dastConfig.lastScanAt).toLocaleString()}
            {dastConfig.lastScanStatus && (
              <span className={`ml-2 ${
                dastConfig.lastScanStatus === 'completed' ? 'text-green-600' :
                dastConfig.lastScanStatus === 'failed' ? 'text-red-600' :
                'text-amber-600'
              }`}>
                ({dastConfig.lastScanStatus})
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// DAST Scan Results - simplified placeholder
interface DASTScanResultsProps {
  projectId: string;
  token: string | null;
  dastScans: DASTScanResult[];
  selectedDastScan: DASTScanResult | null;
  setSelectedDastScan: (scan: DASTScanResult | null) => void;
  setDastScans: (scans: DASTScanResult[]) => void;
}

function DASTScanResults(props: DASTScanResultsProps) {
  const { dastScans, selectedDastScan, setSelectedDastScan } = props;

  return (
    <div className="rounded-lg border border-border bg-card p-6 mt-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Recent DAST Scans</h3>
      <div className="space-y-4">
        {dastScans.map((scan) => (
          <div key={scan.id} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setSelectedDastScan(selectedDastScan?.id === scan.id ? null : scan)}
              className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`h-3 w-3 rounded-full ${
                  scan.status === 'completed' ? 'bg-green-500' :
                  scan.status === 'failed' ? 'bg-red-500' :
                  scan.status === 'running' ? 'bg-amber-500 animate-pulse' :
                  'bg-gray-400'
                }`} />
                <div className="text-left">
                  <p className="font-medium text-foreground text-sm truncate max-w-xs">
                    {scan.targetUrl}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {scan.scanProfile} scan • {new Date(scan.startedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {scan.status === 'completed' && (
                  <div className="flex items-center gap-2 text-sm">
                    {scan.summary.byRisk.high > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 font-medium">
                        {scan.summary.byRisk.high} High
                      </span>
                    )}
                    {scan.summary.byRisk.medium > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                        {scan.summary.byRisk.medium} Medium
                      </span>
                    )}
                    {scan.summary.byRisk.low > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                        {scan.summary.byRisk.low} Low
                      </span>
                    )}
                    {scan.summary.total === 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-medium">
                        No issues
                      </span>
                    )}
                  </div>
                )}
                <svg
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    selectedDastScan?.id === scan.id ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Expanded alerts view */}
            {selectedDastScan?.id === scan.id && scan.alerts && scan.alerts.length > 0 && (
              <div className="p-4 border-t border-border">
                <h4 className="font-medium text-foreground text-sm mb-3">Alerts ({scan.alerts.filter(a => !a.isFalsePositive).length})</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {scan.alerts.filter(a => !a.isFalsePositive).map((alert) => (
                    <div key={alert.id} className="p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-start gap-3">
                        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          alert.risk === 'High'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : alert.risk === 'Medium'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                            : alert.risk === 'Low'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {alert.risk}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{alert.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                          <p className="mt-2 text-xs font-mono text-muted-foreground">
                            <span className="font-semibold">{alert.method}</span> {alert.url}
                          </p>
                          {alert.solution && (
                            <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                              <p className="text-xs text-green-800 dark:text-green-200">
                                <strong>Solution:</strong> {alert.solution}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// False Positive Modal
// ============================================================================

interface FalsePositiveModalProps {
  selectedFinding: SASTFinding;
  fpReason: string;
  isMarkingFP: boolean;
  setFpReason: (reason: string) => void;
  setShowFalsePositiveModal: (show: boolean) => void;
  handleMarkFalsePositive: () => Promise<void>;
}

function FalsePositiveModal({
  selectedFinding,
  fpReason,
  isMarkingFP,
  setFpReason,
  setShowFalsePositiveModal,
  handleMarkFalsePositive,
}: FalsePositiveModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && !isMarkingFP && setShowFalsePositiveModal(false)}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Mark as False Positive</h3>
            <p className="text-sm text-muted-foreground">This finding will be excluded from future scans</p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-md p-3 mb-4">
          <p className="text-sm font-medium text-foreground">{selectedFinding.ruleName}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {selectedFinding.filePath}:{selectedFinding.line}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Reason for marking as false positive
          </label>
          <textarea
            value={fpReason}
            onChange={(e) => setFpReason(e.target.value)}
            placeholder="e.g., This is a test file, the secret is not real..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowFalsePositiveModal(false)}
            disabled={isMarkingFP}
            className="px-4 py-2 rounded-md border border-input bg-background text-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMarkFalsePositive}
            disabled={isMarkingFP || !fpReason.trim()}
            className="px-4 py-2 rounded-md bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50"
          >
            {isMarkingFP ? 'Marking...' : 'Mark as False Positive'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SecurityTab;
