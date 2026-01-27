// AILearningPage - Extracted from App.tsx for code quality compliance
// Feature #1357: Frontend file size limit enforcement
// Feature #1262: AI Learns from Every User Interaction
// Feature #1264: AI Model Personalization per Organization

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';

// Feature #1262: AI Learns from Every User Interaction
interface UserInteraction {
  id: string;
  type: 'page_visit' | 'feature_use' | 'workflow_action' | 'search' | 'click';
  page: string;
  feature?: string;
  action?: string;
  timestamp: Date;
  duration?: number; // seconds
}

interface TrackedWorkflow {
  id: string;
  name: string;
  frequency: number; // times per week
  avgDuration: number; // minutes
  steps: string[];
  lastUsed: Date;
  isCommon: boolean;
}

interface FeatureUsagePattern {
  featureId: string;
  featureName: string;
  category: string;
  usageCount: number;
  lastUsed: Date;
  avgSessionUsage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  percentile: number; // how this compares to other users
}

interface AutomationSuggestion {
  id: string;
  title: string;
  description: string;
  type: 'shortcut' | 'automation' | 'workflow_optimization' | 'batch_action';
  basedOn: string; // what pattern triggered this suggestion
  estimatedTimeSaved: string;
  steps?: string[];
  priority: 'high' | 'medium' | 'low';
  dismissed?: boolean;
  implemented?: boolean;
}

interface UIPersonalization {
  id: string;
  category: 'navigation' | 'dashboard' | 'sidebar' | 'quickactions';
  suggestion: string;
  reason: string;
  applied: boolean;
  impact: string;
}

export function AILearningPage() {
  const { user, token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'workflows' | 'features' | 'suggestions' | 'personalization' | 'model'>('overview');
  const [trackedWorkflows, setTrackedWorkflows] = useState<TrackedWorkflow[]>([]);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsagePattern[]>([]);
  const [suggestions, setSuggestions] = useState<AutomationSuggestion[]>([]);
  const [personalizations, setPersonalizations] = useState<UIPersonalization[]>([]);
  const [learningStats, setLearningStats] = useState({
    totalInteractions: 0,
    daysTracked: 0,
    workflowsIdentified: 0,
    suggestionsGenerated: 0,
    timeSaved: '0 hrs',
    modelAccuracy: 0
  });


  // Feature #1264: AI Model Personalization per Organization
  const [orgModel, setOrgModel] = useState({
    modelId: 'org-model-default-org-v3.2.1',
    modelName: 'Default Organization Custom Model',
    version: '3.2.1',
    status: 'active' as 'training' | 'active' | 'updating' | 'paused',
    lastTrainedDate: new Date(Date.now() - 86400000 * 3),
    nextTrainingDate: new Date(Date.now() + 86400000 * 4),
    trainingDataPoints: 48256,
    baseModel: 'QA Guardian Global v2.4.1',
    accuracy: 94.2,
    accuracyTrend: [
      { week: 'Week 1', accuracy: 78.5 },
      { week: 'Week 2', accuracy: 82.1 },
      { week: 'Week 3', accuracy: 85.7 },
      { week: 'Week 4', accuracy: 88.3 },
      { week: 'Week 5', accuracy: 91.0 },
      { week: 'Week 6', accuracy: 94.2 }
    ],
    orgSpecificPatterns: [
      { name: 'Auth Flow Priority', confidence: 96, description: 'Your org prioritizes auth tests before checkout' },
      { name: 'Visual Regression Focus', confidence: 92, description: 'Higher visual testing frequency than average' },
      { name: 'API Error Patterns', confidence: 89, description: 'Specific API error correlations identified' },
      { name: 'Peak Testing Hours', confidence: 94, description: 'Most tests run 9-11 AM and 2-4 PM' },
      { name: 'Critical Path Detection', confidence: 91, description: 'Identified 12 critical user journeys' }
    ],
    trainingSettings: {
      autoRetrain: true,
      retrainFrequency: 'weekly',
      minDataPointsForRetrain: 1000,
      includeHistoricalData: true,
      historicalDataMonths: 6
    }
  });

  // Feature #1547: Fetch real AI learning stats from API
  // Falls back to demo data if API is unavailable
  useEffect(() => {
    const loadLearningData = async () => {
      setIsLoading(true);

      try {
        const response = await fetch('/api/v1/ai-insights/learning-stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.learning_stats) {
          setLearningStats(data.learning_stats);
        }
        if (data.tracked_workflows) {
          setTrackedWorkflows(data.tracked_workflows.map((w: any) => ({
            ...w,
            lastUsed: new Date(w.lastUsed),
          })));
        }
        if (data.feature_usage) {
          setFeatureUsage(data.feature_usage.map((f: any) => ({
            ...f,
            lastUsed: new Date(f.lastUsed),
          })));
        }
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
        if (data.personalizations) {
          setPersonalizations(data.personalizations);
        }
        if (data.org_model) {
          setOrgModel({
            ...data.org_model,
            lastTrainedDate: new Date(data.org_model.lastTrainedDate),
            nextTrainingDate: new Date(data.org_model.nextTrainingDate),
          });
        }

        setIsLoading(false);
        return;
      } catch (error) {
        console.error('Failed to fetch AI learning stats:', error);
        // No fallback data - show empty state when API fails
        setLearningStats({
          totalInteractions: 0,
          daysTracked: 0,
          workflowsIdentified: 0,
          suggestionsGenerated: 0,
          timeSaved: '0 hrs',
          modelAccuracy: 0
        });
        setTrackedWorkflows([]);
        setFeatureUsage([]);
        setSuggestions([]);
        setPersonalizations([]);
        setIsLoading(false);
      }
    };

    loadLearningData();
  }, [user]);

  const handleApplyPersonalization = (id: string) => {
    setPersonalizations(prev => prev.map(p =>
      p.id === id ? { ...p, applied: !p.applied } : p
    ));
  };

  const handleDismissSuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s =>
      s.id === id ? { ...s, dismissed: true } : s
    ));
  };

  const handleImplementSuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s =>
      s.id === id ? { ...s, implemented: true } : s
    ));
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'workflows', label: '🔄 Workflows' },
    { id: 'features', label: '⭐ Features' },
    { id: 'suggestions', label: '💡 Suggestions' },
    { id: 'personalization', label: '🎨 Personalization' },
    { id: 'model', label: '🤖 Model' }
  ] as const;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="text-muted-foreground">AI is analyzing your usage patterns...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">🧠 AI Learning Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            The platform learns from your interactions to provide personalized suggestions and optimizations
          </p>
        </div>

        {/* Learning Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-2xl font-bold text-primary">{learningStats.totalInteractions.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Interactions</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-2xl font-bold text-blue-600">{learningStats.daysTracked}</div>
            <div className="text-sm text-muted-foreground">Days Tracked</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-2xl font-bold text-green-600">{learningStats.workflowsIdentified}</div>
            <div className="text-sm text-muted-foreground">Workflows Identified</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-2xl font-bold text-yellow-600">{learningStats.suggestionsGenerated}</div>
            <div className="text-sm text-muted-foreground">Suggestions Generated</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-2xl font-bold text-purple-600">{learningStats.timeSaved}</div>
            <div className="text-sm text-muted-foreground">Time Saved</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-2xl font-bold text-emerald-600">{learningStats.modelAccuracy}%</div>
            <div className="text-sm text-muted-foreground">Model Accuracy</div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <nav className="flex gap-2 border-b border-border" aria-label="AI learning tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* How it works */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">🎯 How AI Learning Works</h2>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div className="text-2xl mb-2">1️⃣</div>
                  <h3 className="font-medium text-foreground">Track</h3>
                  <p className="text-sm text-muted-foreground">AI observes your page visits, feature usage, and workflow patterns</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="text-2xl mb-2">2️⃣</div>
                  <h3 className="font-medium text-foreground">Analyze</h3>
                  <p className="text-sm text-muted-foreground">Patterns are identified using ML to understand your habits</p>
                </div>
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <div className="text-2xl mb-2">3️⃣</div>
                  <h3 className="font-medium text-foreground">Suggest</h3>
                  <p className="text-sm text-muted-foreground">AI generates shortcuts and automations based on your patterns</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <div className="text-2xl mb-2">4️⃣</div>
                  <h3 className="font-medium text-foreground">Personalize</h3>
                  <p className="text-sm text-muted-foreground">UI adapts to your preferences for optimal productivity</p>
                </div>
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Workflows */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">🔄 Your Common Workflows</h2>
                <div className="space-y-3">
                  {trackedWorkflows.filter(w => w.isCommon).slice(0, 3).map(workflow => (
                    <div key={workflow.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">{workflow.name}</p>
                        <p className="text-sm text-muted-foreground">{workflow.frequency}x/week • {workflow.avgDuration} min avg</p>
                      </div>
                      <span className="text-sm text-green-600 dark:text-green-400">✓ Tracked</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Suggestions */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">💡 Top Suggestions</h2>
                <div className="space-y-3">
                  {suggestions.filter(s => !s.dismissed && s.priority === 'high').slice(0, 3).map(suggestion => (
                    <div key={suggestion.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-foreground">{suggestion.title}</p>
                        <p className="text-sm text-green-600">Save {suggestion.estimatedTimeSaved}</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        High Priority
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Learning Progress */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">📈 Learning Progress</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Usage Pattern Recognition</span>
                    <span className="font-medium text-foreground">94%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-green-500" style={{ width: '94%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Workflow Detection</span>
                    <span className="font-medium text-foreground">87%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: '87%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Personalization Accuracy</span>
                    <span className="font-medium text-foreground">91%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-purple-500" style={{ width: '91%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workflows' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">🔄 Identified Workflows</h2>
              <p className="text-muted-foreground mb-6">AI has identified these common workflows based on your usage patterns</p>

              <div className="space-y-4">
                {trackedWorkflows.map(workflow => (
                  <div key={workflow.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">{workflow.name}</h3>
                          {workflow.isCommon && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Common
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {workflow.frequency}x per week • ~{workflow.avgDuration} min average
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        Last used: {new Date(workflow.lastUsed).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {workflow.steps.map((step, idx) => (
                        <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-sm">
                          <span className="mr-2 text-muted-foreground">{idx + 1}</span>
                          {step}
                          {idx < workflow.steps.length - 1 && <span className="ml-2 text-muted-foreground">→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">⭐ Feature Usage Patterns</h2>
              <p className="text-muted-foreground mb-6">AI tracks which features you use most frequently</p>

              <div className="space-y-3">
                {featureUsage.sort((a, b) => b.usageCount - a.usageCount).map((feature, idx) => (
                  <div key={feature.featureId} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-muted-foreground w-8">#{idx + 1}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{feature.featureName}</h3>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                          {feature.category}
                        </span>
                        {feature.trend === 'increasing' && (
                          <span className="text-green-600">↗</span>
                        )}
                        {feature.trend === 'decreasing' && (
                          <span className="text-red-600">↘</span>
                        )}
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{feature.usageCount.toLocaleString()} uses</span>
                        <span>{feature.avgSessionUsage.toFixed(1)}x per session</span>
                        <span>Top {100 - feature.percentile}% of users</span>
                      </div>
                    </div>
                    <div className="w-32">
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${(feature.usageCount / featureUsage[0].usageCount) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">💡 Shortcuts & Automations</h2>
              <p className="text-muted-foreground mb-6">AI suggests ways to optimize your workflows based on your patterns</p>

              <div className="space-y-4">
                {suggestions.filter(s => !s.dismissed).map(suggestion => (
                  <div
                    key={suggestion.id}
                    className={`rounded-lg border p-4 ${
                      suggestion.implemented
                        ? 'border-green-300 bg-green-50 dark:bg-green-900/10 dark:border-green-800'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{suggestion.title}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          suggestion.type === 'shortcut' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          suggestion.type === 'automation' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          suggestion.type === 'batch_action' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {suggestion.type.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          suggestion.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {suggestion.priority}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-green-600">Save {suggestion.estimatedTimeSaved}</span>
                    </div>

                    <p className="text-sm text-foreground mb-2">{suggestion.description}</p>
                    <p className="text-xs text-muted-foreground mb-3 italic">Based on: {suggestion.basedOn}</p>

                    {suggestion.steps && (
                      <div className="mb-3 p-2 rounded bg-muted/50">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Quick steps:</p>
                        <p className="text-sm text-foreground">{suggestion.steps.join(' → ')}</p>
                      </div>
                    )}

                    {!suggestion.implemented ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleImplementSuggestion(suggestion.id)}
                          className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          Implement
                        </button>
                        <button
                          onClick={() => handleDismissSuggestion(suggestion.id)}
                          className="px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-muted"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-green-600 font-medium">✓ Implemented</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'personalization' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">🎨 UI Personalization</h2>
              <p className="text-muted-foreground mb-6">AI adjusts the UI based on your usage patterns to optimize your experience</p>

              <div className="space-y-4">
                {personalizations.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          p.category === 'sidebar' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          p.category === 'dashboard' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          p.category === 'quickactions' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {p.category}
                        </span>
                        <h3 className="font-medium text-foreground">{p.suggestion}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{p.reason}</p>
                      <p className="text-xs text-green-600 mt-1">Impact: {p.impact}</p>
                    </div>
                    <button
                      onClick={() => handleApplyPersonalization(p.id)}
                      className={`px-4 py-2 text-sm font-medium rounded-md ${
                        p.applied
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'border border-border hover:bg-muted'
                      }`}
                    >
                      {p.applied ? '✓ Applied' : 'Apply'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Applied Summary */}
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
              <h3 className="font-medium text-green-700 dark:text-green-400 mb-2">✓ Active Personalizations</h3>
              <p className="text-sm text-green-600 dark:text-green-500">
                {personalizations.filter(p => p.applied).length} of {personalizations.length} personalizations are currently applied to your UI
              </p>
            </div>
          </div>
        )}


        {/* Feature #1264: AI Model Personalization Tab */}
        {activeTab === 'model' && (
          <div className="space-y-6">
            {/* Model Overview Card */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">🤖 Organization AI Model</h2>
                  <p className="text-muted-foreground mt-1">Custom model trained on your organization's data</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    orgModel.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    orgModel.status === 'training' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    orgModel.status === 'updating' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {orgModel.status === 'active' && '✓ Active'}
                    {orgModel.status === 'training' && '⏳ Training'}
                    {orgModel.status === 'updating' && '🔄 Updating'}
                    {orgModel.status === 'paused' && '⏸ Paused'}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Model ID</p>
                  <p className="font-mono text-sm text-foreground mt-1">{orgModel.modelId}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Version</p>
                  <p className="font-medium text-foreground mt-1">v{orgModel.version}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Base Model</p>
                  <p className="font-medium text-foreground mt-1">{orgModel.baseModel}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Training Data Points</p>
                  <p className="font-medium text-foreground mt-1">{orgModel.trainingDataPoints.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Accuracy Over Time Chart */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">📈 Model Accuracy Over Time</h2>
              <p className="text-muted-foreground mb-4">The model improves as it learns from your organization's patterns</p>

              <div className="space-y-3">
                {orgModel.accuracyTrend.map((point, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <span className="w-16 text-sm text-muted-foreground">{point.week}</span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          idx === orgModel.accuracyTrend.length - 1 ? 'bg-green-500' : 'bg-primary/70'
                        }`}
                        style={{ width: `${point.accuracy}%` }}
                      ></div>
                    </div>
                    <span className={`w-16 text-sm font-medium ${
                      idx === orgModel.accuracyTrend.length - 1 ? 'text-green-600' : 'text-foreground'
                    }`}>
                      {point.accuracy}%
                    </span>
                    {idx === orgModel.accuracyTrend.length - 1 && (
                      <span className="text-xs text-green-600">Current</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-400">
                  <span className="font-medium">+15.7% improvement</span> since initial training. Model accuracy improves as it learns from your organization's unique patterns.
                </p>
              </div>
            </div>

            {/* Organization-Specific Patterns */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">🎯 Patterns Specific to Your Organization</h2>
              <p className="text-muted-foreground mb-4">The AI has learned these unique patterns from your organization's data</p>

              <div className="space-y-3">
                {orgModel.orgSpecificPatterns.map((pattern, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{pattern.name}</h3>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                          {pattern.confidence}% confidence
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{pattern.description}</p>
                    </div>
                    <div className="ml-4">
                      <div className="w-20 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${pattern.confidence}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Training Schedule */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">🗓️ Training Schedule</h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-foreground mb-3">Training History</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last trained</span>
                      <span className="font-medium">{orgModel.lastTrainedDate.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Next scheduled training</span>
                      <span className="font-medium text-blue-600">{orgModel.nextTrainingDate.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Training frequency</span>
                      <span className="font-medium capitalize">{orgModel.trainingSettings.retrainFrequency}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-foreground mb-3">Training Settings</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Auto-retrain enabled</span>
                      <button
                        onClick={() => setOrgModel(prev => ({
                          ...prev,
                          trainingSettings: { ...prev.trainingSettings, autoRetrain: !prev.trainingSettings.autoRetrain }
                        }))}
                        className={`w-10 h-5 rounded-full transition-colors ${
                          orgModel.trainingSettings.autoRetrain ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          orgModel.trainingSettings.autoRetrain ? 'translate-x-5' : 'translate-x-0.5'
                        }`}></div>
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Include historical data</span>
                      <button
                        onClick={() => setOrgModel(prev => ({
                          ...prev,
                          trainingSettings: { ...prev.trainingSettings, includeHistoricalData: !prev.trainingSettings.includeHistoricalData }
                        }))}
                        className={`w-10 h-5 rounded-full transition-colors ${
                          orgModel.trainingSettings.includeHistoricalData ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          orgModel.trainingSettings.includeHistoricalData ? 'translate-x-5' : 'translate-x-0.5'
                        }`}></div>
                      </button>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Historical data period</span>
                      <span className="font-medium">{orgModel.trainingSettings.historicalDataMonths} months</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setOrgModel(prev => ({ ...prev, status: 'training' }))}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                >
                  Trigger Manual Training
                </button>
                <button
                  onClick={() => setOrgModel(prev => ({
                    ...prev,
                    status: prev.status === 'paused' ? 'active' : 'paused'
                  }))}
                  className="px-4 py-2 rounded-md border border-border hover:bg-muted"
                >
                  {orgModel.status === 'paused' ? 'Resume Model' : 'Pause Model'}
                </button>
              </div>
            </div>

            {/* Model Benefits */}
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
              <h3 className="font-medium text-blue-700 dark:text-blue-400 mb-2">🎓 Organization-Specific Model Benefits</h3>
              <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-500">
                <li>• Predictions tailored to your team's unique testing patterns</li>
                <li>• Learns from your codebase structure and test organization</li>
                <li>• Improves flaky test detection specific to your environment</li>
                <li>• Better root cause analysis based on your historical failures</li>
                <li>• More accurate time estimates for your test suites</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
