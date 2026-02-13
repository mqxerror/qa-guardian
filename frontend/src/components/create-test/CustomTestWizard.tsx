/**
 * CustomTestWizard Component
 * Feature #1807: CustomTestWizard with MethodSelection
 * Feature #691: Migrated to shared Modal component
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

import React, { useState, useCallback, memo } from 'react';
import { Check, Lightbulb, Settings, Video, ChevronLeft, ChevronRight } from 'lucide-react';
// Note: X icon removed - Modal handles close button
import { useAuthStore } from '../../stores/authStore';
import { AIGenerateStep } from './AIGenerateStep';
import { ManualSetupStep, type ManualSetupFormState } from './ManualSetupStep';
import { RecordStep, type RecordConfig } from './RecordStep';
import { ReviewStep, type WizardConfig, type AIGeneratedConfig, type ManualSetupConfig } from './ReviewStep';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../ui/Modal';

/**
 * Configuration method - AI Generate, Manual Setup, or Record
 */
export type ConfigMethod = 'ai-generate' | 'manual-setup' | 'record' | null;

/**
 * Custom wizard step (numeric for 3-step wizard)
 * Note: create-test/types.ts has a string-based WizardStep for different flow
 */
export type CustomWizardStep = 1 | 2 | 3;

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
 /** Project base URL for smart defaults */
 projectBaseUrl?: string;
 /** Initial method selection (optional) */
 initialMethod?: ConfigMethod;
}

/**
 * Step indicator component — animated connecting line with transition-all
 */
const StepIndicator = memo<{ currentStep: CustomWizardStep; totalSteps: number }>(({
 currentStep,
 totalSteps,
}) => {
 return (
 <div className="flex items-center justify-center gap-1.5 mb-4">
 {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
 <React.Fragment key={step}>
 <div
 className={`
 flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all duration-300
 ${
 step === currentStep
 ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-card'
 : step < currentStep
 ? 'bg-success text-success-foreground'
 : 'bg-muted text-muted-foreground'
 }
 `}
 >
 {step < currentStep ? (
 <Check className="w-4 h-4" />
 ) : (
 step
 )}
 </div>
 {step < totalSteps && (
 <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
  <div
   className={`h-full rounded-full transition-all duration-500 ease-in-out ${
   step < currentStep ? 'w-full bg-success' : 'w-0 bg-primary'
   }`}
  />
 </div>
 )}
 </React.Fragment>
 ))}
 </div>
 );
});
StepIndicator.displayName = 'StepIndicator';

/**
 * Feature #613: Semantic color mapping for method cards
 * Feature #692: Added checkmark foreground token for proper contrast
 * Uses CSS variables defined in index.css and tailwind.config.js
 * Replaces hardcoded purple/blue/rose with method-ai/method-manual/method-record
 */
const methodColorMap = {
 ai: {
  selected: 'border-method-ai bg-method-ai-muted shadow-lg',
  badge: 'text-method-ai bg-method-ai/10',
  iconBg: 'bg-method-ai/10 text-method-ai',
  title: 'text-method-ai',
  check: 'text-method-ai',
  indicator: 'border-method-ai bg-method-ai',
  checkmark: 'text-method-ai-foreground',
 },
 manual: {
  selected: 'border-method-manual bg-method-manual-muted shadow-lg',
  badge: 'text-method-manual bg-method-manual/10',
  iconBg: 'bg-method-manual/10 text-method-manual',
  title: 'text-method-manual',
  check: 'text-method-manual',
  indicator: 'border-method-manual bg-method-manual',
  checkmark: 'text-method-manual-foreground',
 },
 record: {
  selected: 'border-method-record bg-method-record-muted shadow-lg',
  badge: 'text-method-record bg-method-record/10',
  iconBg: 'bg-method-record/10 text-method-record',
  title: 'text-method-record',
  check: 'text-method-record',
  indicator: 'border-method-record bg-method-record',
  checkmark: 'text-method-record-foreground',
 },
};

/**
 * Method selection card component
 */
interface MethodCardProps {
 method: 'ai-generate' | 'manual-setup' | 'record';
 isSelected: boolean;
 onSelect: () => void;
}

const MethodCard = memo<MethodCardProps>(({ method, isSelected, onSelect }) => {
 // Feature #613: Updated color keys to use semantic tokens (ai/manual/record)
 const config = {
 'ai-generate': {
 title: 'AI Generate',
 description: 'Describe what you want to test and let AI create the test for you',
 icon: <Lightbulb className="w-10 h-10" strokeWidth={1.5} />,
 benefits: ['Natural language input', 'AI-powered test generation', 'Automatic selector detection'],
 color: 'ai' as const,
 badge: 'Recommended',
 },
 'manual-setup': {
 title: 'Manual Setup',
 description: 'Configure every aspect of your test with full control over settings',
 icon: <Settings className="w-10 h-10" strokeWidth={1.5} />,
 benefits: ['Full control over settings', 'Step-by-step configuration', 'Advanced options'],
 color: 'manual' as const,
 badge: null,
 },
 'record': {
 title: 'Record Actions',
 description: 'Record your interactions in a live browser and convert them into test steps',
 icon: <Video className="w-10 h-10" strokeWidth={1.5} />,
 benefits: ['Visual recording', 'Click-to-create steps', 'Live browser preview'],
 color: 'record' as const,
 badge: 'Interactive',
 },
 };

 const { title, description, icon, benefits, color, badge } = config[method];
 const colors = methodColorMap[color];

 return (
 <button
 type="button"
 onClick={onSelect}
 className={`
 relative flex flex-col p-5 rounded-xl border-2 transition-all duration-200 text-left
 hover:scale-[1.02] hover:shadow-md
 ${
 isSelected
 ? colors.selected
 : 'border-border bg-card hover:border-primary/30'
 }
 `}
 aria-pressed={isSelected}
 >
 {/* Badge */}
 {badge && (
 <span className={`absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-full ${colors.badge}`}>
 {badge}
 </span>
 )}

 {/* Icon */}
 <div
 className={`
 w-14 h-14 rounded-xl flex items-center justify-center mb-3
 ${isSelected ? colors.iconBg : 'bg-muted text-muted-foreground'}
 transition-colors
 `}
 >
 {icon}
 </div>

 {/* Title */}
 <h4 className={`text-lg font-semibold mb-1 ${isSelected ? colors.title : 'text-foreground'}`}>
 {title}
 </h4>

 {/* Description */}
 <p className="text-sm text-muted-foreground mb-3">
 {description}
 </p>

 {/* Benefits */}
 <ul className="space-y-1">
 {benefits.map((benefit, i) => (
 <li key={i} className="flex items-center gap-2 text-sm text-foreground">
 <Check className={`w-4 h-4 flex-shrink-0 ${isSelected ? colors.check : 'text-muted-foreground'} transition-colors`} />
 {benefit}
 </li>
 ))}
 </ul>

 {/* Selection indicator */}
 <div
 className={`
 absolute top-4 left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
 ${isSelected ? colors.indicator : 'border-border'}
 `}
 >
 {isSelected && (
 <Check className={`w-3 h-3 ${colors.checkmark}`} strokeWidth={3} />
 )}
 </div>
 </button>
 );
});
MethodCard.displayName = 'MethodCard';

/**
 * Step 1: Method Selection
 */
const MethodSelection: React.FC<{
 selectedMethod: ConfigMethod;
 onMethodSelect: (method: ConfigMethod) => void;
}> = ({ selectedMethod, onMethodSelect }) => {
 return (
 <div>
 <h3 className="text-xl font-semibold text-foreground mb-1">
 How would you like to create your test?
 </h3>
 <p className="text-sm text-muted-foreground mb-4">
 Choose your preferred method to get started
 </p>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <MethodCard
 method="ai-generate"
 isSelected={selectedMethod === 'ai-generate'}
 onSelect={() => onMethodSelect('ai-generate')}
 />
 <MethodCard
 method="record"
 isSelected={selectedMethod === 'record'}
 onSelect={() => onMethodSelect('record')}
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
 projectBaseUrl,
 initialMethod = null,
}) => {
 // Get token from auth store instead of props
 useAuthStore();

 // Wizard state
 const [wizardStep, setWizardStep] = useState<CustomWizardStep>(1);
 const [configMethod, setConfigMethod] = useState<ConfigMethod>(initialMethod);
 const [wizardConfig, setWizardConfig] = useState<WizardConfig | null>(null);
 const [manualFormState, setManualFormState] = useState<ManualSetupFormState | null>(null);
 const [isStep2Valid, setIsStep2Valid] = useState(false);

 // Navigation handlers
 const handleBack = useCallback(() => {
 if (wizardStep > 1) {
 setWizardStep((prev) => (prev - 1) as CustomWizardStep);
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
 // Feature #584: E2E config fields
 timeout: manualFormState.timeout,
 retries: manualFormState.retries,
 tags: manualFormState.tags,
 deviceEmulationEnabled: manualFormState.deviceEmulationEnabled,
 deviceConfig: manualFormState.deviceConfig,
 // Feature #594: Cross-browser testing
 browsers: manualFormState.browsers,
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
 // Feature #590: Additional visual regression options
 antiAliasingTolerance: manualFormState.visualConfig?.antiAliasingTolerance,
 ignoreRegions: manualFormState.visualConfig?.ignoreRegions,
 ignoreSelectors: manualFormState.visualConfig?.ignoreSelectors,
 customCSS: manualFormState.visualConfig?.customCSS,
 clipSelector: manualFormState.visualConfig?.clipSelector,
 colorThreshold: manualFormState.visualConfig?.colorThreshold,
 devicePreset: manualFormState.devicePreset,
 performanceThreshold: manualFormState.performanceThreshold,
 // Feature #586: Performance config fields
 lcpThreshold: manualFormState.lcpThreshold,
 clsThreshold: manualFormState.clsThreshold,
 fidThreshold: manualFormState.fidThreshold,
 ttiThreshold: manualFormState.ttiThreshold,
 lighthouseCategories: manualFormState.lighthouseCategories,
 wcagLevel: manualFormState.wcagLevel,
 // Feature #587: Accessibility config fields
 a11yThresholds: manualFormState.a11yThresholds,
 includeIframes: manualFormState.includeIframes,
 waitForA11ySelector: manualFormState.waitForA11ySelector,
 excludeRules: manualFormState.excludeRules,
 virtualUsers: manualFormState.virtualUsers,
 duration: manualFormState.duration,
 rampUp: manualFormState.rampUp,
 // Feature #585: Load config fields
 loadScenario: manualFormState.loadScenario,
 k6Script: manualFormState.k6Script,
 loadThresholds: manualFormState.loadThresholds,
 // Feature #591: Security config fields
 scanType: manualFormState.scanType,
 targetPath: manualFormState.targetPath,
 failOnSeverity: manualFormState.failOnSeverity,
 severityThreshold: manualFormState.severityThreshold,
 ignorePatterns: manualFormState.ignorePatterns,
 excludePaths: manualFormState.excludePaths,
 maxFindings: manualFormState.maxFindings,
 };
 setWizardConfig(manualConfig);
 }
 if (wizardStep < 3) {
 setWizardStep((prev) => (prev + 1) as CustomWizardStep);
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

 // Feature #592: Handle record form state changes
 const handleRecordFormChange = useCallback((config: RecordConfig | null, isValid: boolean) => {
 setIsStep2Valid(isValid);
 if (isValid && config) {
 setWizardConfig(config);
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
 2: configMethod === 'ai-generate' ? 'AI Configuration' : configMethod === 'record' ? 'Record Actions' : 'Test Configuration',
 3: 'Review & Create',
 };

 return (
 <Modal isOpen={true} onClose={onClose} title="Custom Test Wizard" size="lg">
 <ModalHeader onClose={onClose}>
 <div>
 <span className="font-semibold text-foreground">Custom Test Wizard</span>
 <p className="text-sm text-muted-foreground font-normal">
 Step {wizardStep}: {stepTitles[wizardStep]}
 </p>
 </div>
 </ModalHeader>

 <ModalBody>
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

 {/* Feature #592: Recording wizard method */}
 {wizardStep === 2 && configMethod === 'record' && (
 <RecordStep
 onContinue={(config) => {
 setWizardConfig(config);
 handleContinue();
 }}
 onChange={handleRecordFormChange}
 projectBaseUrl={projectBaseUrl}
 />
 )}

 {wizardStep === 3 && wizardConfig && (
 <ReviewStep
 config={wizardConfig}
 suiteId={suiteId}
 onEdit={() => setWizardStep(2)}
 onSuccess={(test) => {
 onTestCreated?.(test);
 onClose();
 }}
 />
 )}
 </ModalBody>

 {/* Footer - hidden on Step 3 since ReviewStep has its own buttons */}
 {wizardStep !== 3 && (
 <ModalFooter>
 <div className="flex items-center justify-between w-full">
 <button
 type="button"
 onClick={handleBack}
 className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 rounded-lg hover:bg-muted/80"
 >
 <ChevronLeft className="w-4 h-4" />
 {wizardStep === 1 ? 'Cancel' : 'Back'}
 </button>

 <div className="flex items-center gap-3">
 <span className="text-xs text-muted-foreground">
 {wizardStep} of 3
 </span>
 <button
 type="button"
 onClick={handleContinue}
 disabled={!canContinue}
 className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
 >
 Continue
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 </ModalFooter>
 )}
 </Modal>
 );
};

export default CustomTestWizard;
