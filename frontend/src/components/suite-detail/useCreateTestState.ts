/**
 * useCreateTestState Hook
 * Feature #50: Extract test creation state management from TestSuitePage.tsx
 *
 * This hook manages all state related to creating new tests,
 * including form fields, validation, and test-type-specific settings.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { DeviceConfig } from '../test-modals/types';

// Test type options
export type NewTestType = 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';

// URL validation state
export type UrlValidationState = 'idle' | 'valid' | 'invalid';

// Anti-aliasing tolerance options
export type AntiAliasingTolerance = 'off' | 'low' | 'medium' | 'high';

// Capture mode options
export type CaptureMode = 'full_page' | 'viewport' | 'element';

// Diff threshold mode
export type DiffThresholdMode = 'percentage' | 'pixel_count';

// WCAG Level options
export type WcagLevel = 'A' | 'AA' | 'AAA';

// Ignore region type
export interface IgnoreRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
}

export interface UseCreateTestStateReturn {
  // Modal visibility
  showCreateTestModal: boolean;
  setShowCreateTestModal: (show: boolean) => void;
  showNewCreateTestModal: boolean;
  setShowNewCreateTestModal: (show: boolean) => void;

  // Basic test info
  newTestName: string;
  setNewTestName: (name: string) => void;
  newTestDescription: string;
  setNewTestDescription: (desc: string) => void;
  newTestType: NewTestType;
  setNewTestType: (type: NewTestType) => void;
  newTestDevicePreset: 'mobile' | 'desktop';
  setNewTestDevicePreset: (preset: 'mobile' | 'desktop') => void;

  // Lighthouse/Performance settings
  newTestPerformanceThreshold: number;
  setNewTestPerformanceThreshold: (threshold: number) => void;
  newTestLcpThreshold: number;
  setNewTestLcpThreshold: (threshold: number) => void;
  newTestClsThreshold: number;
  setNewTestClsThreshold: (threshold: number) => void;
  newTestBypassCsp: boolean;
  setNewTestBypassCsp: (bypass: boolean) => void;
  newTestIgnoreSslErrors: boolean;
  setNewTestIgnoreSslErrors: (ignore: boolean) => void;
  newTestAuditTimeout: number;
  setNewTestAuditTimeout: (timeout: number) => void;

  // Accessibility settings
  newTestWcagLevel: WcagLevel;
  setNewTestWcagLevel: (level: WcagLevel) => void;
  newTestIncludeBestPractices: boolean;
  setNewTestIncludeBestPractices: (include: boolean) => void;
  newTestIncludeExperimental: boolean;
  setNewTestIncludeExperimental: (include: boolean) => void;
  newTestIncludePa11y: boolean;
  setNewTestIncludePa11y: (include: boolean) => void;
  newTestA11yFailOnCritical: number | undefined;
  setNewTestA11yFailOnCritical: (count: number | undefined) => void;
  newTestA11yFailOnSerious: number | undefined;
  setNewTestA11yFailOnSerious: (count: number | undefined) => void;
  newTestA11yFailOnModerate: number | undefined;
  setNewTestA11yFailOnModerate: (count: number | undefined) => void;
  newTestA11yFailOnMinor: number | undefined;
  setNewTestA11yFailOnMinor: (count: number | undefined) => void;
  newTestA11yFailOnAny: boolean;
  setNewTestA11yFailOnAny: (fail: boolean) => void;

  // K6/Load test settings
  newTestVirtualUsers: number;
  setNewTestVirtualUsers: (count: number) => void;
  newTestDuration: number;
  setNewTestDuration: (duration: number) => void;
  newTestRampUpTime: number;
  setNewTestRampUpTime: (time: number) => void;
  newTestTargetUrl: string;
  setNewTestTargetUrl: (url: string) => void;
  newTestK6Script: string;
  setNewTestK6Script: (script: string) => void;
  showK6Editor: boolean;
  setShowK6Editor: (show: boolean) => void;

  // URL validation
  urlValidationState: UrlValidationState;
  setUrlValidationState: (state: UrlValidationState) => void;
  urlFavicon: string | null;
  setUrlFavicon: (favicon: string | null) => void;

  // Natural language parsing
  naturalLanguageInput: string;
  setNaturalLanguageInput: (input: string) => void;
  isParsingNaturalLanguage: boolean;
  setIsParsingNaturalLanguage: (parsing: boolean) => void;

  // Visual regression settings
  newTestViewportPreset: string;
  setNewTestViewportPreset: (preset: string) => void;
  newTestViewportWidth: number;
  setNewTestViewportWidth: (width: number) => void;
  newTestViewportHeight: number;
  setNewTestViewportHeight: (height: number) => void;
  newTestCaptureMode: CaptureMode;
  setNewTestCaptureMode: (mode: CaptureMode) => void;
  newTestElementSelector: string;
  setNewTestElementSelector: (selector: string) => void;
  newTestWaitForSelector: string;
  setNewTestWaitForSelector: (selector: string) => void;
  newTestWaitTime: number | undefined;
  setNewTestWaitTime: (time: number | undefined) => void;
  newTestHideSelectors: string;
  setNewTestHideSelectors: (selectors: string) => void;
  newTestRemoveSelectors: string;
  setNewTestRemoveSelectors: (selectors: string) => void;
  newTestMultiViewport: boolean;
  setNewTestMultiViewport: (multi: boolean) => void;
  newTestSelectedViewports: string[];
  setNewTestSelectedViewports: (viewports: string[]) => void;
  newTestDiffThreshold: number;
  setNewTestDiffThreshold: (threshold: number) => void;
  newTestDiffThresholdMode: DiffThresholdMode;
  setNewTestDiffThresholdMode: (mode: DiffThresholdMode) => void;
  newTestDiffPixelThreshold: number;
  setNewTestDiffPixelThreshold: (threshold: number) => void;
  newTestAntiAliasingTolerance: AntiAliasingTolerance;
  setNewTestAntiAliasingTolerance: (tolerance: AntiAliasingTolerance) => void;
  newTestColorThreshold: number | undefined;
  setNewTestColorThreshold: (threshold: number | undefined) => void;
  newTestIgnoreRegions: IgnoreRegion[];
  setNewTestIgnoreRegions: (regions: IgnoreRegion[]) => void;
  newTestIgnoreSelectors: string[];
  setNewTestIgnoreSelectors: (selectors: string[]) => void;

  // Creation state
  isCreatingTest: boolean;
  setIsCreatingTest: (creating: boolean) => void;
  createTestError: string;
  setCreateTestError: (error: string) => void;
  testNameError: string;
  setTestNameError: (error: string) => void;

  // UI state
  showAdvancedSettings: boolean;
  setShowAdvancedSettings: (show: boolean) => void;

  // Reset function
  resetCreateTestState: () => void;
}

/**
 * Hook that provides test creation state management
 */
export function useCreateTestState(): UseCreateTestStateReturn {
  // Modal visibility
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [showNewCreateTestModal, setShowNewCreateTestModal] = useState(false);

  // Basic test info
  const [newTestName, setNewTestName] = useState('');
  const [newTestDescription, setNewTestDescription] = useState('');
  const [newTestType, setNewTestType] = useState<NewTestType>('e2e');
  const [newTestDevicePreset, setNewTestDevicePreset] = useState<'mobile' | 'desktop'>('desktop');

  // Lighthouse/Performance settings
  const [newTestPerformanceThreshold, setNewTestPerformanceThreshold] = useState(50);
  const [newTestLcpThreshold, setNewTestLcpThreshold] = useState(2500);
  const [newTestClsThreshold, setNewTestClsThreshold] = useState(0.1);
  const [newTestBypassCsp, setNewTestBypassCsp] = useState(false);
  const [newTestIgnoreSslErrors, setNewTestIgnoreSslErrors] = useState(false);
  const [newTestAuditTimeout, setNewTestAuditTimeout] = useState(60);

  // Accessibility settings
  const [newTestWcagLevel, setNewTestWcagLevel] = useState<WcagLevel>('AA');
  const [newTestIncludeBestPractices, setNewTestIncludeBestPractices] = useState(true);
  const [newTestIncludeExperimental, setNewTestIncludeExperimental] = useState(false);
  const [newTestIncludePa11y, setNewTestIncludePa11y] = useState(false);
  const [newTestA11yFailOnCritical, setNewTestA11yFailOnCritical] = useState<number | undefined>(0);
  const [newTestA11yFailOnSerious, setNewTestA11yFailOnSerious] = useState<number | undefined>(undefined);
  const [newTestA11yFailOnModerate, setNewTestA11yFailOnModerate] = useState<number | undefined>(undefined);
  const [newTestA11yFailOnMinor, setNewTestA11yFailOnMinor] = useState<number | undefined>(undefined);
  const [newTestA11yFailOnAny, setNewTestA11yFailOnAny] = useState(false);

  // K6/Load test settings
  const [newTestVirtualUsers, setNewTestVirtualUsers] = useState(10);
  const [newTestDuration, setNewTestDuration] = useState(60);
  const [newTestRampUpTime, setNewTestRampUpTime] = useState(10);
  const [newTestTargetUrl, setNewTestTargetUrl] = useState('');
  const [newTestK6Script, setNewTestK6Script] = useState('');
  const [showK6Editor, setShowK6Editor] = useState(false);

  // URL validation
  const [urlValidationState, setUrlValidationState] = useState<UrlValidationState>('idle');
  const [urlFavicon, setUrlFavicon] = useState<string | null>(null);

  // Natural language parsing
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [isParsingNaturalLanguage, setIsParsingNaturalLanguage] = useState(false);

  // Visual regression settings
  const [newTestViewportPreset, setNewTestViewportPreset] = useState('desktop');
  const [newTestViewportWidth, setNewTestViewportWidth] = useState(1920);
  const [newTestViewportHeight, setNewTestViewportHeight] = useState(1080);
  const [newTestCaptureMode, setNewTestCaptureMode] = useState<CaptureMode>('full_page');
  const [newTestElementSelector, setNewTestElementSelector] = useState('');
  const [newTestWaitForSelector, setNewTestWaitForSelector] = useState('');
  const [newTestWaitTime, setNewTestWaitTime] = useState<number | undefined>(undefined);
  const [newTestHideSelectors, setNewTestHideSelectors] = useState('');
  const [newTestRemoveSelectors, setNewTestRemoveSelectors] = useState('');
  const [newTestMultiViewport, setNewTestMultiViewport] = useState(false);
  const [newTestSelectedViewports, setNewTestSelectedViewports] = useState<string[]>(['desktop', 'tablet', 'mobile']);
  const [newTestDiffThreshold, setNewTestDiffThreshold] = useState(0);
  const [newTestDiffThresholdMode, setNewTestDiffThresholdMode] = useState<DiffThresholdMode>('percentage');
  const [newTestDiffPixelThreshold, setNewTestDiffPixelThreshold] = useState(0);
  const [newTestAntiAliasingTolerance, setNewTestAntiAliasingTolerance] = useState<AntiAliasingTolerance>('off');
  const [newTestColorThreshold, setNewTestColorThreshold] = useState<number | undefined>(undefined);
  const [newTestIgnoreRegions, setNewTestIgnoreRegions] = useState<IgnoreRegion[]>([]);
  const [newTestIgnoreSelectors, setNewTestIgnoreSelectors] = useState<string[]>([]);

  // Creation state
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [createTestError, setCreateTestError] = useState('');
  const [testNameError, setTestNameError] = useState('');

  // UI state - persisted to localStorage
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(() => {
    try {
      return localStorage.getItem('create-test-advanced-expanded') === 'true';
    } catch {
      return false;
    }
  });

  // Persist advanced settings toggle
  useEffect(() => {
    try {
      localStorage.setItem('create-test-advanced-expanded', showAdvancedSettings.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [showAdvancedSettings]);

  // Reset function to clear all test creation state
  const resetCreateTestState = useCallback(() => {
    setNewTestName('');
    setNewTestDescription('');
    setNewTestType('e2e');
    setNewTestDevicePreset('desktop');
    setNewTestPerformanceThreshold(50);
    setNewTestLcpThreshold(2500);
    setNewTestClsThreshold(0.1);
    setNewTestBypassCsp(false);
    setNewTestIgnoreSslErrors(false);
    setNewTestAuditTimeout(60);
    setNewTestWcagLevel('AA');
    setNewTestIncludeBestPractices(true);
    setNewTestIncludeExperimental(false);
    setNewTestIncludePa11y(false);
    setNewTestA11yFailOnCritical(0);
    setNewTestA11yFailOnSerious(undefined);
    setNewTestA11yFailOnModerate(undefined);
    setNewTestA11yFailOnMinor(undefined);
    setNewTestA11yFailOnAny(false);
    setNewTestVirtualUsers(10);
    setNewTestDuration(60);
    setNewTestRampUpTime(10);
    setNewTestTargetUrl('');
    setNewTestK6Script('');
    setShowK6Editor(false);
    setUrlValidationState('idle');
    setUrlFavicon(null);
    setNaturalLanguageInput('');
    setIsParsingNaturalLanguage(false);
    setNewTestViewportPreset('desktop');
    setNewTestViewportWidth(1920);
    setNewTestViewportHeight(1080);
    setNewTestCaptureMode('full_page');
    setNewTestElementSelector('');
    setNewTestWaitForSelector('');
    setNewTestWaitTime(undefined);
    setNewTestHideSelectors('');
    setNewTestRemoveSelectors('');
    setNewTestMultiViewport(false);
    setNewTestSelectedViewports(['desktop', 'tablet', 'mobile']);
    setNewTestDiffThreshold(0);
    setNewTestDiffThresholdMode('percentage');
    setNewTestDiffPixelThreshold(0);
    setNewTestAntiAliasingTolerance('off');
    setNewTestColorThreshold(undefined);
    setNewTestIgnoreRegions([]);
    setNewTestIgnoreSelectors([]);
    setIsCreatingTest(false);
    setCreateTestError('');
    setTestNameError('');
  }, []);

  return {
    // Modal visibility
    showCreateTestModal,
    setShowCreateTestModal,
    showNewCreateTestModal,
    setShowNewCreateTestModal,

    // Basic test info
    newTestName,
    setNewTestName,
    newTestDescription,
    setNewTestDescription,
    newTestType,
    setNewTestType,
    newTestDevicePreset,
    setNewTestDevicePreset,

    // Lighthouse/Performance settings
    newTestPerformanceThreshold,
    setNewTestPerformanceThreshold,
    newTestLcpThreshold,
    setNewTestLcpThreshold,
    newTestClsThreshold,
    setNewTestClsThreshold,
    newTestBypassCsp,
    setNewTestBypassCsp,
    newTestIgnoreSslErrors,
    setNewTestIgnoreSslErrors,
    newTestAuditTimeout,
    setNewTestAuditTimeout,

    // Accessibility settings
    newTestWcagLevel,
    setNewTestWcagLevel,
    newTestIncludeBestPractices,
    setNewTestIncludeBestPractices,
    newTestIncludeExperimental,
    setNewTestIncludeExperimental,
    newTestIncludePa11y,
    setNewTestIncludePa11y,
    newTestA11yFailOnCritical,
    setNewTestA11yFailOnCritical,
    newTestA11yFailOnSerious,
    setNewTestA11yFailOnSerious,
    newTestA11yFailOnModerate,
    setNewTestA11yFailOnModerate,
    newTestA11yFailOnMinor,
    setNewTestA11yFailOnMinor,
    newTestA11yFailOnAny,
    setNewTestA11yFailOnAny,

    // K6/Load test settings
    newTestVirtualUsers,
    setNewTestVirtualUsers,
    newTestDuration,
    setNewTestDuration,
    newTestRampUpTime,
    setNewTestRampUpTime,
    newTestTargetUrl,
    setNewTestTargetUrl,
    newTestK6Script,
    setNewTestK6Script,
    showK6Editor,
    setShowK6Editor,

    // URL validation
    urlValidationState,
    setUrlValidationState,
    urlFavicon,
    setUrlFavicon,

    // Natural language parsing
    naturalLanguageInput,
    setNaturalLanguageInput,
    isParsingNaturalLanguage,
    setIsParsingNaturalLanguage,

    // Visual regression settings
    newTestViewportPreset,
    setNewTestViewportPreset,
    newTestViewportWidth,
    setNewTestViewportWidth,
    newTestViewportHeight,
    setNewTestViewportHeight,
    newTestCaptureMode,
    setNewTestCaptureMode,
    newTestElementSelector,
    setNewTestElementSelector,
    newTestWaitForSelector,
    setNewTestWaitForSelector,
    newTestWaitTime,
    setNewTestWaitTime,
    newTestHideSelectors,
    setNewTestHideSelectors,
    newTestRemoveSelectors,
    setNewTestRemoveSelectors,
    newTestMultiViewport,
    setNewTestMultiViewport,
    newTestSelectedViewports,
    setNewTestSelectedViewports,
    newTestDiffThreshold,
    setNewTestDiffThreshold,
    newTestDiffThresholdMode,
    setNewTestDiffThresholdMode,
    newTestDiffPixelThreshold,
    setNewTestDiffPixelThreshold,
    newTestAntiAliasingTolerance,
    setNewTestAntiAliasingTolerance,
    newTestColorThreshold,
    setNewTestColorThreshold,
    newTestIgnoreRegions,
    setNewTestIgnoreRegions,
    newTestIgnoreSelectors,
    setNewTestIgnoreSelectors,

    // Creation state
    isCreatingTest,
    setIsCreatingTest,
    createTestError,
    setCreateTestError,
    testNameError,
    setTestNameError,

    // UI state
    showAdvancedSettings,
    setShowAdvancedSettings,

    // Reset function
    resetCreateTestState,
  };
}
