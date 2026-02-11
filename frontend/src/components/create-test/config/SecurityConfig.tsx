/**
 * SecurityConfig Component
 * Feature #591: Security Test Configuration Form
 *
 * Provides form fields specific to Security tests:
 * - Test name and description
 * - Scan type selector (SAST/dependency/both)
 * - Target path/URL
 * - Severity threshold
 * - Ignore patterns
 */

import React, { useState, useCallback, memo } from 'react';
import { ChevronDown, X } from 'lucide-react';

/**
 * Security scan types matching backend SecurityScanType
 */
export type SecurityScanType = 'sast' | 'dependency' | 'secrets' | 'dast' | 'full';

/**
 * Severity levels for filtering findings
 */
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Security test configuration state
 */
export interface SecurityConfigState {
  name: string;
  description: string;
  targetUrl: string;
  targetPath: string;
  scanType: SecurityScanType;
  severityThreshold: SecuritySeverity;
  ignorePatterns: string[];
  excludePaths: string[];
  failOnSeverity: SecuritySeverity;
  maxFindings: number;
}

/**
 * Props for SecurityConfig
 */
export interface SecurityConfigProps {
  /** Initial configuration values */
  initialValues?: Partial<SecurityConfigState>;
  /** Called when configuration changes */
  onChange?: (config: SecurityConfigState) => void;
  /** Called when form validation state changes */
  onValidationChange?: (isValid: boolean) => void;
  /** Project base URL for smart defaults */
  projectBaseUrl?: string;
  /** CSS class name */
  className?: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: SecurityConfigState = {
  name: '',
  description: '',
  targetUrl: '',
  targetPath: './',
  scanType: 'full',
  severityThreshold: 'low',
  ignorePatterns: [],
  excludePaths: ['node_modules', 'dist', 'build', '.git'],
  failOnSeverity: 'high',
  maxFindings: 100,
};

/**
 * Scan type options
 */
const SCAN_TYPES: { value: SecurityScanType; label: string; description: string; icon: string }[] = [
  {
    value: 'full',
    label: 'Full Scan',
    description: 'Run SAST + dependency + secrets scan',
    icon: '🛡️',
  },
  {
    value: 'sast',
    label: 'SAST Only',
    description: 'Static code analysis for vulnerabilities',
    icon: '🔍',
  },
  {
    value: 'dependency',
    label: 'Dependency Scan',
    description: 'Check packages for known CVEs',
    icon: '📦',
  },
  {
    value: 'secrets',
    label: 'Secret Detection',
    description: 'Find hardcoded secrets and keys',
    icon: '🔑',
  },
  {
    value: 'dast',
    label: 'DAST Scan',
    description: 'Dynamic web application scanning',
    icon: '🌐',
  },
];

/**
 * Severity options - Feature #614: Use semantic tokens
 */
const SEVERITY_OPTIONS: { value: SecuritySeverity; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'text-destructive' },
  { value: 'high', label: 'High', color: 'text-warning' },
  { value: 'medium', label: 'Medium', color: 'text-warning/80' },
  { value: 'low', label: 'Low', color: 'text-info' },
  { value: 'info', label: 'Info', color: 'text-muted-foreground' },
];

/**
 * Form field component
 * Feature #622: React.memo for performance optimization
 */
interface FormFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}

const FormField = memo<FormFieldProps>(function FormField({ label, required, children, hint, error }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
});
FormField.displayName = 'FormField';

/**
 * Collapsible section component
 * Feature #622: React.memo for performance optimization
 */
interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection = memo<CollapsibleSectionProps>(function CollapsibleSection({ title, isOpen, onToggle, children }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted/80 transition-colors"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="p-4 border-t border-border">{children}</div>}
    </div>
  );
});
CollapsibleSection.displayName = 'CollapsibleSection';

/**
 * SecurityConfig - Configuration form for Security tests
 */
export const SecurityConfig: React.FC<SecurityConfigProps> = ({
  initialValues,
  onChange,
  onValidationChange,
  projectBaseUrl,
  className = '',
}) => {
  const [config, setConfig] = useState<SecurityConfigState>({
    ...DEFAULT_CONFIG,
    targetUrl: projectBaseUrl || '',
    ...initialValues,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof SecurityConfigState, string>>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newIgnorePattern, setNewIgnorePattern] = useState('');
  const [newExcludePath, setNewExcludePath] = useState('');

  // Validate required fields
  const validate = useCallback((values: SecurityConfigState): boolean => {
    const newErrors: Partial<Record<keyof SecurityConfigState, string>> = {};

    if (!values.name.trim()) {
      newErrors.name = 'Test name is required';
    }

    // DAST requires URL, other scans require path
    if (values.scanType === 'dast') {
      if (!values.targetUrl.trim()) {
        newErrors.targetUrl = 'Target URL is required for DAST scans';
      } else if (!/^https?:\/\/.+/.test(values.targetUrl)) {
        newErrors.targetUrl = 'Please enter a valid URL';
      }
    } else if (!values.targetPath.trim()) {
      newErrors.targetPath = 'Target path is required';
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    onValidationChange?.(isValid);
    return isValid;
  }, [onValidationChange]);

  // Update field
  const updateField = useCallback(<K extends keyof SecurityConfigState>(
    field: K,
    value: SecurityConfigState[K]
  ) => {
    setConfig(prev => {
      const newConfig = { ...prev, [field]: value };
      validate(newConfig);
      onChange?.(newConfig);
      return newConfig;
    });
  }, [onChange, validate]);

  // Add ignore pattern
  const addIgnorePattern = useCallback(() => {
    if (newIgnorePattern.trim() && !config.ignorePatterns.includes(newIgnorePattern.trim())) {
      updateField('ignorePatterns', [...config.ignorePatterns, newIgnorePattern.trim()]);
      setNewIgnorePattern('');
    }
  }, [newIgnorePattern, config.ignorePatterns, updateField]);

  // Remove ignore pattern
  const removeIgnorePattern = useCallback((pattern: string) => {
    updateField('ignorePatterns', config.ignorePatterns.filter(p => p !== pattern));
  }, [config.ignorePatterns, updateField]);

  // Add exclude path
  const addExcludePath = useCallback(() => {
    if (newExcludePath.trim() && !config.excludePaths.includes(newExcludePath.trim())) {
      updateField('excludePaths', [...config.excludePaths, newExcludePath.trim()]);
      setNewExcludePath('');
    }
  }, [newExcludePath, config.excludePaths, updateField]);

  // Remove exclude path
  const removeExcludePath = useCallback((path: string) => {
    updateField('excludePaths', config.excludePaths.filter(p => p !== path));
  }, [config.excludePaths, updateField]);

  return (
    <div className={`security-config space-y-4 ${className}`}>
      {/* Test Name */}
      <FormField label="Test Name" required error={errors.name}>
        <input
          type="text"
          value={config.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Security Scan - Main App"
          className={`w-full px-3 py-2 border rounded-lg bg-input text-foreground ${
            errors.name
              ? 'border-destructive focus:ring-destructive'
              : 'border-border focus:ring-primary'
          }`}
        />
      </FormField>

      {/* Description */}
      <FormField label="Description">
        <textarea
          value={config.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Describe what this security scan covers..."
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground resize-none"
        />
      </FormField>

      {/* Scan Type Selection */}
      <FormField label="Scan Type" required>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {SCAN_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => updateField('scanType', type.value)}
              className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                config.scanType === type.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <span className="text-xl">{type.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm text-foreground block">
                  {type.label}
                </span>
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {type.description}
                </span>
              </div>
            </button>
          ))}
        </div>
      </FormField>

      {/* Target URL (for DAST) */}
      {config.scanType === 'dast' && (
        <FormField label="Target URL" required error={errors.targetUrl}>
          <input
            type="url"
            value={config.targetUrl}
            onChange={(e) => updateField('targetUrl', e.target.value)}
            placeholder={projectBaseUrl || 'https://your-app.com'}
            className={`w-full px-3 py-2 border rounded-lg bg-input text-foreground ${
              errors.targetUrl
                ? 'border-destructive focus:ring-destructive'
                : 'border-border focus:ring-primary'
            }`}
          />
        </FormField>
      )}

      {/* Target Path (for SAST/dependency/secrets/full) */}
      {config.scanType !== 'dast' && (
        <FormField
          label="Target Path"
          required
          error={errors.targetPath}
          hint="Relative path to scan from project root"
        >
          <input
            type="text"
            value={config.targetPath}
            onChange={(e) => updateField('targetPath', e.target.value)}
            placeholder="./"
            className={`w-full px-3 py-2 border rounded-lg bg-input text-foreground font-mono text-sm ${
              errors.targetPath
                ? 'border-destructive focus:ring-destructive'
                : 'border-border focus:ring-primary'
            }`}
          />
        </FormField>
      )}

      {/* Fail Threshold */}
      <FormField
        label="Fail on Severity"
        hint="Test fails if findings at or above this severity are found"
      >
        <div className="flex flex-wrap gap-2">
          {SEVERITY_OPTIONS.map((sev) => (
            <button
              key={sev.value}
              type="button"
              onClick={() => updateField('failOnSeverity', sev.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                config.failOnSeverity === sev.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {sev.label}
            </button>
          ))}
        </div>
      </FormField>

      {/* Advanced Settings */}
      <CollapsibleSection
        title="Advanced Settings"
        isOpen={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        <div className="space-y-4">
          {/* Severity Threshold */}
          <FormField
            label="Report Severity Threshold"
            hint="Only report findings at or above this severity"
          >
            <select
              value={config.severityThreshold}
              onChange={(e) => updateField('severityThreshold', e.target.value as SecuritySeverity)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
            >
              {SEVERITY_OPTIONS.map((sev) => (
                <option key={sev.value} value={sev.value}>
                  {sev.label}
                </option>
              ))}
            </select>
          </FormField>

          {/* Max Findings */}
          <FormField
            label="Max Findings"
            hint="Limit the number of findings to report (0 = unlimited)"
          >
            <input
              type="number"
              value={config.maxFindings}
              onChange={(e) => updateField('maxFindings', parseInt(e.target.value) || 0)}
              min={0}
              max={1000}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground"
            />
          </FormField>

          {/* Exclude Paths */}
          <FormField
            label="Exclude Paths"
            hint="Directories to skip during scanning"
          >
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newExcludePath}
                  onChange={(e) => setNewExcludePath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludePath())}
                  placeholder="node_modules"
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={addExcludePath}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
                >
                  Add
                </button>
              </div>
              {config.excludePaths.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {config.excludePaths.map((path) => (
                    <span
                      key={path}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs font-mono"
                    >
                      {path}
                      <button
                        type="button"
                        onClick={() => removeExcludePath(path)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </FormField>

          {/* Ignore Patterns */}
          <FormField
            label="Ignore Patterns"
            hint="Rule IDs or patterns to ignore (e.g., 'CWE-798', 'js.security.*')"
          >
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newIgnorePattern}
                  onChange={(e) => setNewIgnorePattern(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIgnorePattern())}
                  placeholder="CWE-798"
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-input text-foreground font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={addIgnorePattern}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
                >
                  Add
                </button>
              </div>
              {config.ignorePatterns.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {config.ignorePatterns.map((pattern) => (
                    <span
                      key={pattern}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs font-mono"
                    >
                      {pattern}
                      <button
                        type="button"
                        onClick={() => removeIgnorePattern(pattern)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </FormField>
        </div>
      </CollapsibleSection>

      {/* Validation Summary */}
      {Object.keys(errors).length > 0 && (
        <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">
            Please fix the errors above to continue.
          </p>
        </div>
      )}
    </div>
  );
};

export default SecurityConfig;
