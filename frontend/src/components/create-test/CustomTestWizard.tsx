/**
 * CustomTestWizard Component
 * Feature #1807: CustomTestWizard with MethodSelection
 *
 * A 3-step wizard for creating custom tests:
 * - Step 1: Method Selection (AI Generate vs Manual Setup)
 * - Step 2: Configuration (type, URL, settings based on method)
 * - Step 3: Review and Create
 *
 * Features:
 * - Two large cards for method selection
 * - Step indicator (1/3, 2/3, 3/3)
 * - Back/Continue navigation
 * - State tracking for wizardStep and configMethod
 */

import React, { useState, useCallback } from 'react';
import { AIGenerateStep } from './AIGenerateStep';
import { ManualSetupStep, type ManualSetupFormState } from './ManualSetupStep';
import { ReviewStep, type WizardConfig, type AIGeneratedConfig, type ManualSetupConfig } from './ReviewStep';

/**
 * Configuration method - AI Generate or Manual Setup
 */
export type ConfigMethod = 'ai-generate' | 'manual-setup' | null;

/**
 * Wizard step
 */
export type WizardStep = 1 | 2 | 3;

/**
 * Props for CustomTestWizard
 */
export interface CustomTestWizardProps {
  /** Called when wizard is closed/cancelled */
  onClose: () => void;
  /** Called when test is created (runId is passed if Create & Run was used) */
  onTestCreated?: (test: { id: string; name: string; runId?: string }) => void;
  /** Suite ID for test creation */
  suiteId: string;
  /** Auth token */
  token: string;
  /** Project base URL for smart defaults */
  projectBaseUrl?: string;
  /** Initial method selection (optional) */
  initialMethod?: ConfigMethod;
}

/**
 * Step indicator component
 */
const StepIndicator: React.FC<{ currentStep: WizardStep; totalSteps: number }> = ({
  currentStep,
  totalSteps,
}) => {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <React.Fragment key={step}>
          <div
            className={`
              flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors
              ${
                step === currentStep
                  ? 'bg-blue-600 text-white'
                  : step < currentStep
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
              }
            `}
          >
            {step < currentStep ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              step
            )}
          </div>
          {step < totalSteps && (
            <div
              className={`w-12 h-1 rounded ${
                step < currentStep
                  ? 'bg-green-500'
                  : 'bg-gray-200 dark:bg-gray-600'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * Method selection card component
 */
interface MethodCardProps {
  method: 'ai-generate' | 'manual-setup';
  isSelected: boolean;
  onSelect: () => void;
}

const MethodCard: React.FC<MethodCardProps> = ({ method, isSelected, onSelect }) => {
  const config = {
    'ai-generate': {
      title: 'AI Generate',
      description: 'Describe what you want to test and let AI create the test for you',
      icon: (
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
      benefits: ['Natural language input', 'AI-powered test generation', 'Automatic selector detection'],
      color: 'purple',
      badge: 'Recommended',
    },
    'manual-setup': {
      title: 'Manual Setup',
      description: 'Configure every aspect of your test with full control over settings',
      icon: (
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
      benefits: ['Full control over settings', 'Step-by-step configuration', 'Advanced options'],
      color: 'blue',
      badge: null,
    },
  };

  const { title, description, icon, benefits, color, badge } = config[method];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative flex flex-col p-6 rounded-xl border-2 transition-all text-left
        ${
          isSelected
            ? `border-${color}-500 bg-${color}-50 dark:bg-${color}-900/20 shadow-lg`
            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md'
        }
      `}
      aria-pressed={isSelected}
    >
      {/* Badge */}
      {badge && (
        <span className={`absolute top-3 right-3 px-2 py-0.5 text-xs font-medium text-${color}-600 bg-${color}-100 dark:bg-${color}-900/30 dark:text-${color}-400 rounded-full`}>
          {badge}
        </span>
      )}

      {/* Icon */}
      <div
        className={`
          w-16 h-16 rounded-xl flex items-center justify-center mb-4
          ${isSelected ? `bg-${color}-100 dark:bg-${color}-800/30 text-${color}-600 dark:text-${color}-400` : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}
        `}
      >
        {icon}
      </div>

      {/* Title */}
      <h4 className={`text-lg font-semibold mb-2 ${isSelected ? `text-${color}-700 dark:text-${color}-300` : 'text-gray-900 dark:text-white'}`}>
        {title}
      </h4>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {description}
      </p>

      {/* Benefits */}
      <ul className="space-y-1">
        {benefits.map((benefit, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <svg className={`w-4 h-4 ${isSelected ? `text-${color}-500` : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {benefit}
          </li>
        ))}
      </ul>

      {/* Selection indicator */}
      <div
        className={`
          absolute top-4 left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center
          ${isSelected ? `border-${color}-500 bg-${color}-500` : 'border-gray-300 dark:border-gray-500'}
        `}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
};

/**
 * Step 1: Method Selection
 */
const MethodSelection: React.FC<{
  selectedMethod: ConfigMethod;
  onMethodSelect: (method: ConfigMethod) => void;
}> = ({ selectedMethod, onMethodSelect }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        How would you like to create your test?
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Choose your preferred method to get started
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MethodCard
          method="ai-generate"
          isSelected={selectedMethod === 'ai-generate'}
          onSelect={() => onMethodSelect('ai-generate')}
        />
        <MethodCard
          method="manual-setup"
          isSelected={selectedMethod === 'manual-setup'}
          onSelect={() => onMethodSelect('manual-setup')}
        />
      </div>
    </div>
  );
};

/**
 * CustomTestWizard main component
 */
export const CustomTestWizard: React.FC<CustomTestWizardProps> = ({
  onClose,
  onTestCreated,
  suiteId,
  token,
  projectBaseUrl,
  initialMethod = null,
}) => {
  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [configMethod, setConfigMethod] = useState<ConfigMethod>(initialMethod);
  const [wizardConfig, setWizardConfig] = useState<WizardConfig | null>(null);
  const [manualFormState, setManualFormState] = useState<ManualSetupFormState | null>(null);
  const [isStep2Valid, setIsStep2Valid] = useState(false);

  // Navigation handlers
  const handleBack = useCallback(() => {
    if (wizardStep > 1) {
      setWizardStep((prev) => (prev - 1) as WizardStep);
    } else {
      onClose();
    }
  }, [wizardStep, onClose]);

  const handleContinue = useCallback(() => {
    if (wizardStep === 2 && configMethod === 'manual-setup' && manualFormState) {
      // Save manual setup config when advancing to step 3
      const manualConfig: ManualSetupConfig = {
        method: 'manual-setup',
        testType: manualFormState.testType,
        name: manualFormState.name,
        description: manualFormState.description,
        targetUrl: manualFormState.targetUrl,
        steps: manualFormState.steps,
        structuredSteps: manualFormState.structuredSteps,
        viewportWidth: manualFormState.viewportWidth,
        viewportHeight: manualFormState.viewportHeight,
        diffThreshold: manualFormState.diffThreshold,
        // Feature #1983: Pass all enabled viewports for visual tests
        viewports: manualFormState.visualConfig?.viewports,
        captureMode: manualFormState.visualConfig?.captureMode,
        elementSelector: manualFormState.visualConfig?.elementSelector,
        waitTime: manualFormState.visualConfig?.delay,
        hideSelectors: manualFormState.visualConfig?.hideSelectors,
        waitForSelector: manualFormState.visualConfig?.waitForSelector,
        devicePreset: manualFormState.devicePreset,
        performanceThreshold: manualFormState.performanceThreshold,
        wcagLevel: manualFormState.wcagLevel,
        virtualUsers: manualFormState.virtualUsers,
        duration: manualFormState.duration,
        rampUp: manualFormState.rampUp,
      };
      setWizardConfig(manualConfig);
    }
    if (wizardStep < 3) {
      setWizardStep((prev) => (prev + 1) as WizardStep);
    }
  }, [wizardStep, configMethod, manualFormState]);

  // Method selection handler
  const handleMethodSelect = useCallback((method: ConfigMethod) => {
    setConfigMethod(method);
  }, []);

  // Handle manual form state changes
  const handleManualFormChange = useCallback((formState: ManualSetupFormState, isValid: boolean) => {
    setManualFormState(formState);
    setIsStep2Valid(isValid);
  }, []);

  // Handle AI form state changes (Feature #1820 fix + #1821 fix)
  const handleAIFormChange = useCallback((config: {
    testType: 'e2e' | 'visual' | 'accessibility' | 'performance' | 'load' | null;
    url: string | null;
    viewport: { preset: 'desktop' | 'tablet' | 'mobile' | 'custom'; width: number; height: number };
    description: string;
  } | null, isValid: boolean) => {
    setIsStep2Valid(isValid);
    // Store the config for Step 3 when valid
    if (isValid && config && config.testType && config.url) {
      const aiConfig: AIGeneratedConfig = {
        method: 'ai-generate',
        testType: config.testType,
        url: config.url,
        viewport: config.viewport,
        description: config.description,
      };
      setWizardConfig(aiConfig);
    }
  }, []);

  // Can continue check
  const canContinue = wizardStep === 1
    ? configMethod !== null
    : wizardStep === 2
    ? isStep2Valid
    : true;

  // Step titles
  const stepTitles = {
    1: 'Choose Method',
    2: configMethod === 'ai-generate' ? 'AI Configuration' : 'Test Configuration',
    3: 'Review & Create',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="relative z-[61] bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Custom Test Wizard
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Step {wizardStep}: {stepTitles[wizardStep]}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close wizard"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step Indicator */}
          <StepIndicator currentStep={wizardStep} totalSteps={3} />

          {/* Step Content */}
          {wizardStep === 1 && (
            <MethodSelection
              selectedMethod={configMethod}
              onMethodSelect={handleMethodSelect}
            />
          )}

          {wizardStep === 2 && configMethod === 'ai-generate' && (
            <AIGenerateStep
              onContinue={(config) => {
                // Store config for review step
                const aiConfig: AIGeneratedConfig = {
                  method: 'ai-generate',
                  testType: config.testType,
                  url: config.url,
                  viewport: config.viewport,
                  description: config.description,
                };
                setWizardConfig(aiConfig);
                handleContinue();
              }}
              onChange={handleAIFormChange}
              projectBaseUrl={projectBaseUrl}
            />
          )}

          {wizardStep === 2 && configMethod === 'manual-setup' && (
            <ManualSetupStep
              onContinue={() => {
                // Handled by handleContinue
              }}
              onChange={handleManualFormChange}
              projectBaseUrl={projectBaseUrl}
            />
          )}

          {wizardStep === 3 && wizardConfig && (
            <ReviewStep
              config={wizardConfig}
              suiteId={suiteId}
              token={token}
              onEdit={() => setWizardStep(2)}
              onSuccess={(test) => {
                onTestCreated?.(test);
                onClose();
              }}
            />
          )}
        </div>

        {/* Footer - hidden on Step 3 since ReviewStep has its own buttons */}
        {wizardStep !== 3 && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {wizardStep === 1 ? 'Cancel' : 'Back'}
            </button>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {wizardStep} of 3
              </span>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!canContinue}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                Continue
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomTestWizard;
