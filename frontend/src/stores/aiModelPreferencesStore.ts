/**
 * AI Model Preferences Store
 * Feature #2074: AI Model Selection for Different Tasks
 *
 * Stores user preferences for which AI model/provider to use for different
 * task types within the platform.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Available AI providers
export type AIProvider = 'kie' | 'anthropic' | 'auto';

// Available models per provider
export type AIModel =
  // Claude models (available via both Kie.ai and Anthropic)
  | 'claude-sonnet-4-20250514'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-haiku-20240307'
  | 'claude-3-opus-20240229'
  // DeepSeek models (Kie.ai only)
  | 'deepseek-chat'
  | 'deepseek-coder'
  | 'deepseek-reasoner'
  | 'auto';

// Task types that can have different AI model preferences
export type AITaskType =
  | 'chat'              // MCP Chat conversations
  | 'test_generation'   // AI test generation
  | 'root_cause_analysis' // Root cause analysis for failures
  | 'test_healing'      // Self-healing test suggestions
  | 'code_explanation'  // Explain test code
  | 'visual_analysis'   // Visual regression AI analysis
  | 'flaky_analysis'    // Flaky test pattern analysis
  | 'documentation';    // Auto-generate documentation

// Model preference for a specific task
export interface TaskModelPreference {
  provider: AIProvider;
  model: AIModel;
}

// All task preferences
export type AIModelPreferences = Record<AITaskType, TaskModelPreference>;

// Provider info for display
export interface ProviderInfo {
  id: AIProvider;
  name: string;
  description: string;
  costIndicator: 'low' | 'medium' | 'high';
  speedIndicator: 'fast' | 'medium' | 'slow';
}

// Model info for display
export interface ModelInfo {
  id: AIModel;
  name: string;
  description: string;
  capabilities: string[];
  providers: AIProvider[];
  costIndicator: 'low' | 'medium' | 'high';
  speedIndicator: 'fast' | 'medium' | 'slow';
}

// Provider metadata
export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'auto',
    name: 'Auto (Recommended)',
    description: 'Automatically choose the best provider based on availability and cost',
    costIndicator: 'low',
    speedIndicator: 'fast',
  },
  {
    id: 'kie',
    name: 'Kie.ai',
    description: 'Primary provider with 70% cost savings. Uses Claude models.',
    costIndicator: 'low',
    speedIndicator: 'fast',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Direct)',
    description: 'Direct Anthropic API. Higher cost but direct access.',
    costIndicator: 'high',
    speedIndicator: 'medium',
  },
];

// Model metadata
export const MODELS: ModelInfo[] = [
  {
    id: 'auto',
    name: 'Auto',
    description: 'Let the system choose the best model for the task',
    capabilities: ['Automatic selection based on task type'],
    providers: ['auto', 'kie', 'anthropic'],
    costIndicator: 'low',
    speedIndicator: 'fast',
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    description: 'Best balance of intelligence and speed. Recommended for most tasks.',
    capabilities: ['Code generation', 'Analysis', 'Reasoning', 'Vision'],
    providers: ['kie', 'anthropic'],
    costIndicator: 'medium',
    speedIndicator: 'fast',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Previous generation Sonnet. Still excellent for most tasks.',
    capabilities: ['Code generation', 'Analysis', 'Vision'],
    providers: ['kie', 'anthropic'],
    costIndicator: 'medium',
    speedIndicator: 'fast',
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    description: 'Fastest and most affordable. Great for simple tasks.',
    capabilities: ['Quick responses', 'Simple analysis'],
    providers: ['kie', 'anthropic'],
    costIndicator: 'low',
    speedIndicator: 'fast',
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Most capable model. Best for complex reasoning tasks.',
    capabilities: ['Advanced reasoning', 'Complex analysis', 'Code generation'],
    providers: ['kie', 'anthropic'],
    costIndicator: 'high',
    speedIndicator: 'slow',
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    description: 'Excellent for conversational tasks. Very cost-effective.',
    capabilities: ['Chat', 'General assistance'],
    providers: ['kie'],
    costIndicator: 'low',
    speedIndicator: 'fast',
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    description: 'Specialized for code generation and analysis.',
    capabilities: ['Code generation', 'Code analysis', 'Debugging'],
    providers: ['kie'],
    costIndicator: 'low',
    speedIndicator: 'fast',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    description: 'Specialized for complex reasoning tasks.',
    capabilities: ['Complex reasoning', 'Step-by-step analysis'],
    providers: ['kie'],
    costIndicator: 'medium',
    speedIndicator: 'medium',
  },
];

// Task type metadata
export interface TaskTypeInfo {
  id: AITaskType;
  name: string;
  description: string;
  recommendedModel: AIModel;
  recommendedProvider: AIProvider;
}

export const TASK_TYPES: TaskTypeInfo[] = [
  {
    id: 'chat',
    name: 'MCP Chat',
    description: 'General AI chat and MCP tool execution',
    recommendedModel: 'claude-sonnet-4-20250514',
    recommendedProvider: 'auto',
  },
  {
    id: 'test_generation',
    name: 'Test Generation',
    description: 'Generate Playwright tests from descriptions',
    recommendedModel: 'claude-sonnet-4-20250514',
    recommendedProvider: 'auto',
  },
  {
    id: 'root_cause_analysis',
    name: 'Root Cause Analysis',
    description: 'Analyze test failures and identify root causes',
    recommendedModel: 'claude-sonnet-4-20250514',
    recommendedProvider: 'auto',
  },
  {
    id: 'test_healing',
    name: 'Test Healing',
    description: 'Suggest fixes for broken tests',
    recommendedModel: 'deepseek-coder',
    recommendedProvider: 'kie',
  },
  {
    id: 'code_explanation',
    name: 'Code Explanation',
    description: 'Explain test code in plain language',
    recommendedModel: 'claude-3-haiku-20240307',
    recommendedProvider: 'auto',
  },
  {
    id: 'visual_analysis',
    name: 'Visual Analysis',
    description: 'Analyze visual regression differences',
    recommendedModel: 'claude-sonnet-4-20250514',
    recommendedProvider: 'auto',
  },
  {
    id: 'flaky_analysis',
    name: 'Flaky Test Analysis',
    description: 'Detect patterns in flaky tests',
    recommendedModel: 'claude-sonnet-4-20250514',
    recommendedProvider: 'auto',
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Auto-generate test documentation',
    recommendedModel: 'claude-3-haiku-20240307',
    recommendedProvider: 'auto',
  },
];

// Default preferences - use auto for everything
const defaultPreferences: AIModelPreferences = {
  chat: { provider: 'auto', model: 'auto' },
  test_generation: { provider: 'auto', model: 'auto' },
  root_cause_analysis: { provider: 'auto', model: 'auto' },
  test_healing: { provider: 'auto', model: 'auto' },
  code_explanation: { provider: 'auto', model: 'auto' },
  visual_analysis: { provider: 'auto', model: 'auto' },
  flaky_analysis: { provider: 'auto', model: 'auto' },
  documentation: { provider: 'auto', model: 'auto' },
};

interface AIModelPreferencesState {
  // User preferences
  preferences: AIModelPreferences;

  // Default provider/model (used when 'auto' is selected)
  defaultProvider: AIProvider;
  defaultModel: AIModel;

  // Actions
  setTaskPreference: (taskType: AITaskType, preference: TaskModelPreference) => void;
  setAllPreferences: (preferences: Partial<AIModelPreferences>) => void;
  setDefaultProvider: (provider: AIProvider) => void;
  setDefaultModel: (model: AIModel) => void;
  resetToDefaults: () => void;

  // Helpers
  getEffectivePreference: (taskType: AITaskType) => TaskModelPreference;
}

export const useAIModelPreferencesStore = create<AIModelPreferencesState>()(
  persist(
    (set, get) => ({
      preferences: defaultPreferences,
      defaultProvider: 'kie',
      defaultModel: 'claude-sonnet-4-20250514',

      setTaskPreference: (taskType, preference) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            [taskType]: preference,
          },
        }));
      },

      setAllPreferences: (newPreferences) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...newPreferences,
          },
        }));
      },

      setDefaultProvider: (provider) => {
        set({ defaultProvider: provider });
      },

      setDefaultModel: (model) => {
        set({ defaultModel: model });
      },

      resetToDefaults: () => {
        set({
          preferences: defaultPreferences,
          defaultProvider: 'kie',
          defaultModel: 'claude-sonnet-4-20250514',
        });
      },

      getEffectivePreference: (taskType) => {
        const state = get();
        const pref = state.preferences[taskType];

        // If provider is 'auto', use the default provider
        const effectiveProvider = pref.provider === 'auto' ? state.defaultProvider : pref.provider;

        // If model is 'auto', use the default model
        const effectiveModel = pref.model === 'auto' ? state.defaultModel : pref.model;

        return {
          provider: effectiveProvider,
          model: effectiveModel,
        };
      },
    }),
    {
      name: 'qa-guardian-ai-model-preferences',
      version: 1,
    }
  )
);

// Helper function to get model info
export function getModelInfo(modelId: AIModel): ModelInfo | undefined {
  return MODELS.find(m => m.id === modelId);
}

// Helper function to get provider info
export function getProviderInfo(providerId: AIProvider): ProviderInfo | undefined {
  return PROVIDERS.find(p => p.id === providerId);
}

// Helper function to get task type info
export function getTaskTypeInfo(taskType: AITaskType): TaskTypeInfo | undefined {
  return TASK_TYPES.find(t => t.id === taskType);
}

// Helper function to get models available for a provider
export function getModelsForProvider(providerId: AIProvider): ModelInfo[] {
  if (providerId === 'auto') {
    return MODELS;
  }
  return MODELS.filter(m => m.providers.includes(providerId));
}
