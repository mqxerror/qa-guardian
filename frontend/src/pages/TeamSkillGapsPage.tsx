// TeamSkillGapsPage - Extracted from App.tsx for code quality compliance
// Feature #1357: Frontend file size limit enforcement
// Feature #1260: Skill Gap Identification for Team
// Feature #1261: Workload Balancing

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';

// Feature #1260: Skill Gap Identification interfaces
interface TeamMemberSkills {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  testTypes: {
    type: string;
    testsWritten: number;
    passRate: number;
    expertise: 'expert' | 'proficient' | 'learning' | 'none';
  }[];
  totalTests: number;
  strongAreas: string[];
  gapAreas: string[];
}

interface SkillGap {
  id: string;
  skillArea: string;
  category: 'testing_type' | 'framework' | 'domain' | 'tooling';
  severity: 'critical' | 'moderate' | 'minor';
  teamCoverage: number; // percentage of team with this skill
  impactDescription: string;
  affectedAreas: string[];
}

interface TrainingResource {
  id: string;
  title: string;
  type: 'course' | 'documentation' | 'video' | 'workshop' | 'certification';
  provider: string;
  url: string;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  relevantSkills: string[];
  rating?: number;
}

// Feature #1261: Workload Balancing interfaces
interface WorkloadAnalysis {
  memberId: string;
  memberName: string;
  role: string;
  ownedTests: number;
  ownershipPercentage: number;
  suites: { name: string; testCount: number }[];
  recentActivity: 'high' | 'medium' | 'low';
  busFactor: 'critical' | 'warning' | 'healthy';
}

interface ReassignmentSuggestion {
  id: string;
  testName: string;
  suiteName: string;
  currentOwner: string;
  suggestedOwner: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  complexity: 'simple' | 'moderate' | 'complex';
}

export function TeamSkillGapsPage() {
  const { user, token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMemberSkills[]>([]);
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
  const [trainingResources, setTrainingResources] = useState<TrainingResource[]>([]);
  const [selectedGap, setSelectedGap] = useState<SkillGap | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'gaps' | 'training' | 'workload'>('overview');

  // Feature #1261: Workload balancing state
  const [workloadAnalysis, setWorkloadAnalysis] = useState<WorkloadAnalysis[]>([]);
  const [reassignmentSuggestions, setReassignmentSuggestions] = useState<ReassignmentSuggestion[]>([]);

  // Feature #1546: Fetch real team skills from API
  // Falls back to demo data if API is unavailable
  useEffect(() => {
    const loadTeamData = async () => {
      setIsLoading(true);

      try {
        const response = await fetch('/api/v1/ai-insights/team-skills', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.team_members && data.team_members.length > 0) {
          setTeamMembers(data.team_members);
          setSkillGaps(data.skill_gaps || []);
          setTrainingResources(data.training_resources || []);
          setWorkloadAnalysis(data.workload_analysis || []);
          setReassignmentSuggestions(data.reassignment_suggestions || []);
          setIsLoading(false);
          return;
        }
        throw new Error('No team data in response');
      } catch (error) {
        console.error('Failed to fetch team skills:', error);
        // No fallback data - show empty state when API fails
        setTeamMembers([]);
        setSkillGaps([]);
        setTrainingResources([]);
        setWorkloadAnalysis([]);
        setReassignmentSuggestions([]);
        setIsLoading(false);
      }
    };

    loadTeamData();
  }, [token]);

  const getExpertiseColor = (expertise: string) => {
    switch (expertise) {
      case 'expert':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'proficient':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'learning':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'none':
        return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'minor':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case 'course':
        return '📚';
      case 'documentation':
        return '📄';
      case 'video':
        return '🎬';
      case 'workshop':
        return '🛠️';
      case 'certification':
        return '🏆';
      default:
        return '📌';
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg aria-hidden="true" className="animate-spin h-8 w-8 text-primary mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-muted-foreground">Analyzing team skills and identifying gaps...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              🎓 Team Skill Gap Analysis
            </h1>
            <p className="mt-2 text-muted-foreground">
              AI-powered identification of testing skill gaps and training recommendations
            </p>
          </div>
        </div>

        {/* Tabs */}
        <nav className="mb-6 flex border-b border-border" aria-label="Skill gap tabs">
          {['overview', 'members', 'gaps', 'training', 'workload'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'overview' ? '📊 Overview' :
               tab === 'members' ? '👥 Team Members' :
               tab === 'gaps' ? '⚠️ Skill Gaps' :
               tab === 'training' ? '📚 Training' :
               '⚖️ Workload'}
            </button>
          ))}
        </nav>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-foreground">{teamMembers.length}</div>
                <div className="text-sm text-muted-foreground">Team Members</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {skillGaps.filter(g => g.severity === 'critical').length}
                </div>
                <div className="text-sm text-muted-foreground">Critical Gaps</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {skillGaps.filter(g => g.severity === 'moderate').length}
                </div>
                <div className="text-sm text-muted-foreground">Moderate Gaps</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {trainingResources.length}
                </div>
                <div className="text-sm text-muted-foreground">Training Resources</div>
              </div>
            </div>

            {/* Top Critical Gaps */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">🚨 Critical Skill Gaps</h2>
              <div className="space-y-3">
                {skillGaps.filter(g => g.severity === 'critical').map((gap) => (
                  <div key={gap.id} className="flex items-center justify-between p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{gap.skillArea}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(gap.severity)}`}>
                          {gap.severity}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{gap.impactDescription}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{gap.teamCoverage}%</div>
                      <div className="text-xs text-muted-foreground">Team Coverage</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skill Distribution Chart */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">📈 Team Skill Distribution</h2>
              <div className="space-y-4">
                {['E2E Tests', 'Visual Tests', 'API Tests', 'Performance Tests', 'Security Tests'].map((skillType) => {
                  const membersWithSkill = teamMembers.filter(m =>
                    m.testTypes.find(t => t.type === skillType && t.expertise !== 'none')
                  ).length;
                  const percentage = Math.round((membersWithSkill / teamMembers.length) * 100);

                  return (
                    <div key={skillType}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-foreground">{skillType}</span>
                        <span className="text-muted-foreground">{membersWithSkill}/{teamMembers.length} members ({percentage}%)</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            percentage >= 75 ? 'bg-green-500' :
                            percentage >= 50 ? 'bg-yellow-500' :
                            percentage >= 25 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Team Members Tab - Step 2: Who writes which tests */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{member.name}</h3>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-foreground">{member.totalTests}</div>
                    <div className="text-xs text-muted-foreground">Total Tests Written</div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-3 mb-4">
                  {member.testTypes.map((testType) => (
                    <div key={testType.type} className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold text-foreground">{testType.testsWritten}</div>
                      <div className="text-xs text-muted-foreground mb-2">{testType.type}</div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getExpertiseColor(testType.expertise)}`}>
                        {testType.expertise}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">Strong Areas:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {member.strongAreas.map((area) => (
                        <span key={area} className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">Gap Areas:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {member.gapAreas.map((area) => (
                        <span key={area} className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skill Gaps Tab - Step 3: AI identifies gaps */}
        {activeTab === 'gaps' && (
          <div className="space-y-4">
            {skillGaps.map((gap) => (
              <div key={gap.id} className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{gap.skillArea}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(gap.severity)}`}>
                        {gap.severity}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                        {gap.category.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{gap.impactDescription}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${
                      gap.teamCoverage >= 50 ? 'text-green-600 dark:text-green-400' :
                      gap.teamCoverage >= 25 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {gap.teamCoverage}%
                    </div>
                    <div className="text-xs text-muted-foreground">Team Coverage</div>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-xs text-muted-foreground">Affected Areas:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {gap.affectedAreas.map((area) => (
                      <span key={area} className="px-2 py-0.5 rounded bg-muted text-foreground text-xs">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <span className="text-sm font-medium text-foreground">Recommended Training:</span>
                  <div className="mt-2 space-y-2">
                    {trainingResources
                      .filter(r => r.relevantSkills.includes(gap.skillArea))
                      .slice(0, 2)
                      .map((resource) => (
                        <div key={resource.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span>{getResourceTypeIcon(resource.type)}</span>
                            <span className="text-sm text-foreground">{resource.title}</span>
                          </div>
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            View →
                          </a>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Training Tab - Step 4: AI suggests training */}
        {activeTab === 'training' && (
          <div className="space-y-4">
            {trainingResources.map((resource) => (
              <div key={resource.id} className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl">
                      {getResourceTypeIcon(resource.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{resource.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{resource.provider}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="px-2 py-0.5 rounded text-xs bg-muted text-foreground capitalize">
                          {resource.type}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-muted text-foreground capitalize">
                          {resource.level}
                        </span>
                        <span className="text-xs text-muted-foreground">⏱️ {resource.duration}</span>
                        {resource.rating && (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">⭐ {resource.rating}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {resource.relevantSkills.map((skill) => (
                          <span key={skill} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Start Learning
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feature #1261: Workload Tab */}
        {activeTab === 'workload' && (
          <div className="space-y-6">
            {/* Workload Overview */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">⚖️ Test Ownership Distribution</h2>
              <div className="space-y-4">
                {workloadAnalysis.map((member) => (
                  <div key={member.memberId} className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                          {member.memberName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{member.memberName}</h3>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-foreground">{member.ownershipPercentage}%</div>
                          <div className="text-xs text-muted-foreground">{member.ownedTests} tests</div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          member.busFactor === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          member.busFactor === 'warning' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {member.busFactor === 'critical' ? '🚨 High Bus Factor' :
                           member.busFactor === 'warning' ? '⚠️ Watch' :
                           '✓ Healthy'}
                        </span>
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          member.ownershipPercentage > 40 ? 'bg-red-500' :
                          member.ownershipPercentage > 25 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${member.ownershipPercentage}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {member.suites.map((suite) => (
                        <span key={suite.name} className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                          {suite.name}: {suite.testCount}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bus Factor Warning */}
            {workloadAnalysis.some(m => m.busFactor === 'critical') && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🚨</span>
                  <div>
                    <h3 className="font-semibold text-red-700 dark:text-red-400">High Bus Factor Risk Detected</h3>
                    <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">
                      {workloadAnalysis.filter(m => m.busFactor === 'critical').map(m => m.memberName).join(', ')} own{workloadAnalysis.filter(m => m.busFactor === 'critical').length > 1 ? '' : 's'} more than 40% of the team's tests.
                      If they leave or are unavailable, the team would face significant knowledge gaps.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Reassignment Suggestions */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">💡 Recommended Test Reassignments</h2>
              <p className="text-sm text-muted-foreground mb-4">
                AI-suggested test ownership changes to reduce bus factor and balance workload
              </p>
              <div className="space-y-3">
                {reassignmentSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            suggestion.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {suggestion.priority} priority
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                            {suggestion.complexity}
                          </span>
                        </div>
                        <h4 className="font-medium text-foreground">{suggestion.testName}</h4>
                        <p className="text-xs text-muted-foreground mb-2">{suggestion.suiteName}</p>
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <span className="text-muted-foreground">{suggestion.currentOwner}</span>
                          <span className="text-primary">→</span>
                          <span className="font-medium text-foreground">{suggestion.suggestedOwner}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                      </div>
                      <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                        Reassign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-foreground">
                  {workloadAnalysis.reduce((sum, m) => sum + m.ownedTests, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Tests</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {workloadAnalysis.filter(m => m.ownershipPercentage > 40).length}
                </div>
                <div className="text-sm text-muted-foreground">Members &gt;40% Ownership</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-3xl font-bold text-primary">
                  {reassignmentSuggestions.length}
                </div>
                <div className="text-sm text-muted-foreground">Suggested Reassignments</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
