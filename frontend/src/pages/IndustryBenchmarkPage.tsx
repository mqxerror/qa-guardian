// Feature #1246: Industry Benchmark Page - Compare testing maturity to industry benchmarks
// Extracted from App.tsx for code quality compliance
// Feature #1543: Replace dummy data with real API calls

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Layout } from '../components/Layout';

// Types for industry benchmarking
interface IndustryBenchmark {
 metric: string;
 your_value: number;
 industry_avg: number;
 industry_top10: number;
 unit: string;
 higher_is_better: boolean;
 category: 'coverage' | 'quality' | 'speed' | 'reliability' | 'automation';
}

interface IndustryPercentile {
 metric: string;
 percentile: number;
 rank: 'top_10' | 'top_25' | 'top_50' | 'bottom_50' | 'bottom_25';
}

interface GapAnalysis {
 area: string;
 current_state: string;
 target_state: string;
 gap_severity: 'critical' | 'high' | 'medium' | 'low';
 improvement_actions: string[];
 estimated_effort: 'low' | 'medium' | 'high';
 expected_impact: string;
 priority: number;
}

export function IndustryBenchmarkPage() {
 const { token } = useAuthStore();
 const [isLoading, setIsLoading] = useState(true);
 const [benchmarks, setBenchmarks] = useState<IndustryBenchmark[]>([]);
 const [percentiles, setPercentiles] = useState<IndustryPercentile[]>([]);
 const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis[]>([]);
 const [overallMaturityScore, setOverallMaturityScore] = useState<number>(0);
 const [industryName, setIndustryName] = useState<string>('Software/SaaS');
 const [companySize, setCompanySize] = useState<string>('mid-market');

 // Feature #1543: Fetch real data from API with fallback
 useEffect(() => {
 const fetchData = async () => {
 setIsLoading(true);
 try {
 const response = await fetch(`/api/v1/ai-insights/industry-benchmarks?industry=${encodeURIComponent(industryName)}&company_size=${encodeURIComponent(companySize)}`, {
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json',
 },
 });

 if (!response.ok) {
 throw new Error(`API error: ${response.status}`);
 }

 const data = await response.json();

 if (data.benchmarks) {
 setBenchmarks(data.benchmarks);
 }
 if (data.percentiles) {
 setPercentiles(data.percentiles);
 }
 if (data.overall_maturity_score) {
 setOverallMaturityScore(data.overall_maturity_score);
 }
 if (data.gap_analysis) {
 setGapAnalysis(data.gap_analysis);
 }
 } catch (error) {
 console.error('Failed to fetch industry benchmark data:', error);
 // No fallback data - show empty state when API fails
 setBenchmarks([]);
 setPercentiles([]);
 setOverallMaturityScore(0);
 setGapAnalysis([]);
 } finally {
 setIsLoading(false);
 }
 };
 fetchData();
 }, [token, industryName, companySize]);

 const getComparisonColor = (yourValue: number, industryAvg: number, industryTop10: number, higherIsBetter: boolean) => {
 if (higherIsBetter) {
 if (yourValue >= industryTop10) return 'text-success';
 if (yourValue >= industryAvg) return 'text-primary';
 return 'text-warning';
 } else {
 if (yourValue <= industryTop10) return 'text-success';
 if (yourValue <= industryAvg) return 'text-primary';
 return 'text-warning';
 }
 };

 const getComparisonBadge = (yourValue: number, industryAvg: number, industryTop10: number, higherIsBetter: boolean) => {
 if (higherIsBetter) {
 if (yourValue >= industryTop10) return { text: 'Top 10%', color: 'bg-success/20 text-success' };
 if (yourValue >= industryAvg) return { text: 'Above Avg', color: 'bg-primary/20 text-primary' };
 return { text: 'Below Avg', color: 'bg-warning/20 text-warning' };
 } else {
 if (yourValue <= industryTop10) return { text: 'Top 10%', color: 'bg-success/20 text-success' };
 if (yourValue <= industryAvg) return { text: 'Above Avg', color: 'bg-primary/20 text-primary' };
 return { text: 'Below Avg', color: 'bg-warning/20 text-warning' };
 }
 };

 const getPercentileColor = (percentile: number) => {
 if (percentile >= 90) return 'bg-success';
 if (percentile >= 75) return 'bg-primary';
 if (percentile >= 50) return 'bg-warning';
 return 'bg-destructive';
 };

 const getRankBadge = (rank: string) => {
 switch (rank) {
 case 'top_10': return 'bg-success/20 text-success';
 case 'top_25': return 'bg-primary/20 text-primary';
 case 'top_50': return 'bg-warning/20 text-warning';
 default: return 'bg-destructive/20 text-destructive';
 }
 };

 const getRankLabel = (rank: string) => {
 switch (rank) {
 case 'top_10': return 'Top 10%';
 case 'top_25': return 'Top 25%';
 case 'top_50': return 'Top 50%';
 case 'bottom_50': return 'Bottom 50%';
 case 'bottom_25': return 'Bottom 25%';
 default: return rank;
 }
 };

 const getSeverityBadge = (severity: string) => {
 switch (severity) {
 case 'critical': return 'bg-destructive/20 text-destructive';
 case 'high': return 'bg-orange-500/20 text-orange-400';
 case 'medium': return 'bg-warning/20 text-warning';
 default: return 'bg-success/20 text-success';
 }
 };

 const getEffortBadge = (effort: string) => {
 switch (effort) {
 case 'high': return 'bg-purple-500/20 text-purple-400';
 case 'medium': return 'bg-primary/20 text-primary';
 default: return 'bg-cyan-500/20 text-cyan-400';
 }
 };

 const getCategoryIcon = (category: string) => {
 switch (category) {
 case 'coverage': return '📊';
 case 'quality': return '✅';
 case 'speed': return '⚡';
 case 'reliability': return '🔒';
 case 'automation': return '🤖';
 default: return '📈';
 }
 };

 const getMaturityLevel = (score: number) => {
 if (score >= 90) return { level: 'Elite', color: 'text-success', bg: 'bg-success/20' };
 if (score >= 75) return { level: 'Advanced', color: 'text-primary', bg: 'bg-primary/20' };
 if (score >= 60) return { level: 'Intermediate', color: 'text-warning', bg: 'bg-warning/20' };
 if (score >= 40) return { level: 'Developing', color: 'text-orange-400', bg: 'bg-orange-500/20' };
 return { level: 'Initial', color: 'text-destructive', bg: 'bg-destructive/20' };
 };

 const maturityLevel = getMaturityLevel(overallMaturityScore);

 if (isLoading) {
 return (
 <div className="flex h-full items-center justify-center">
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
 <p className="mt-4 text-muted-foreground">Analyzing industry benchmarks...</p>
 </div>
 </div>
 );
 }

 return (
 <Layout>
 <div className="space-y-6 p-6">
 {/* Step 1: View Industry Benchmark */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
 <span>📊</span> Industry Benchmark
 </h1>
 <p className="text-muted-foreground mt-1">Compare your testing maturity to industry standards</p>
 </div>
 <div className="flex items-center gap-2">
 <select
 value={industryName}
 onChange={(e) => setIndustryName(e.target.value)}
 className="rounded-md border border-input bg-background px-3 py-2 text-sm"
 >
 <option value="Software/SaaS">Software/SaaS</option>
 <option value="Fintech">Fintech</option>
 <option value="E-commerce">E-commerce</option>
 <option value="Healthcare">Healthcare</option>
 <option value="Enterprise">Enterprise</option>
 </select>
 <select
 value={companySize}
 onChange={(e) => setCompanySize(e.target.value)}
 className="rounded-md border border-input bg-background px-3 py-2 text-sm"
 >
 <option value="startup">Startup (&lt;50)</option>
 <option value="small">Small (50-200)</option>
 <option value="mid-market">Mid-Market (200-1000)</option>
 <option value="enterprise">Enterprise (1000+)</option>
 </select>
 </div>
 </div>

 {/* Overall Maturity Score */}
 <div className="rounded-lg border bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-6">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold mb-2">Overall Testing Maturity Score</h2>
 <p className="text-sm text-muted-foreground">Based on {benchmarks.length} metrics compared to {industryName} industry</p>
 </div>
 <div className="text-right">
 <div className="flex items-center gap-3">
 <div className="relative w-32 h-32">
 <svg className="w-32 h-32 transform -rotate-90">
 <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
 <circle
 cx="64" cy="64" r="56" fill="none" strokeWidth="8"
 className={maturityLevel.color}
 stroke="currentColor"
 strokeDasharray={`${(overallMaturityScore / 100) * 352} 352`}
 strokeLinecap="round"
 />
 </svg>
 <div className="absolute inset-0 flex flex-col items-center justify-center">
 <span className={`text-3xl font-bold ${maturityLevel.color}`}>{overallMaturityScore}</span>
 <span className="text-xs text-muted-foreground">/100</span>
 </div>
 </div>
 <div>
 <span className={`px-3 py-1 rounded-full text-sm font-medium ${maturityLevel.bg} ${maturityLevel.color}`}>
 {maturityLevel.level}
 </span>
 <p className="text-xs text-muted-foreground mt-2">Percentile: Top {100 - overallMaturityScore + 24}%</p>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Step 2: Your Metrics vs Industry */}
 <div className="rounded-lg border bg-card p-6">
 <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
 <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-sm">2</span>
 <span>📈</span> Your Metrics vs Industry
 </h2>
 <p className="text-sm text-muted-foreground mb-4">Compare your testing metrics against industry averages and top performers</p>

 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b">
 <th className="text-left py-3 px-2 font-medium text-muted-foreground">Metric</th>
 <th className="text-center py-3 px-2 font-medium text-muted-foreground">Category</th>
 <th className="text-center py-3 px-2 font-medium text-muted-foreground">Your Value</th>
 <th className="text-center py-3 px-2 font-medium text-muted-foreground">Industry Avg</th>
 <th className="text-center py-3 px-2 font-medium text-muted-foreground">Top 10%</th>
 <th className="text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
 <th className="text-center py-3 px-2 font-medium text-muted-foreground">Gap to Top</th>
 </tr>
 </thead>
 <tbody>
 {benchmarks.map((benchmark, index) => {
 const comparison = getComparisonBadge(benchmark.your_value, benchmark.industry_avg, benchmark.industry_top10, benchmark.higher_is_better);
 const gapToTop = benchmark.higher_is_better
 ? benchmark.industry_top10 - benchmark.your_value
 : benchmark.your_value - benchmark.industry_top10;
 return (
 <tr key={index} className="border-b hover:bg-muted/50">
 <td className="py-3 px-2">
 <span className="font-medium text-foreground">{benchmark.metric}</span>
 </td>
 <td className="text-center py-3 px-2">
 <span className="text-lg" title={benchmark.category}>{getCategoryIcon(benchmark.category)}</span>
 </td>
 <td className={`text-center py-3 px-2 font-bold ${getComparisonColor(benchmark.your_value, benchmark.industry_avg, benchmark.industry_top10, benchmark.higher_is_better)}`}>
 {benchmark.your_value}{benchmark.unit}
 </td>
 <td className="text-center py-3 px-2 text-muted-foreground">
 {benchmark.industry_avg}{benchmark.unit}
 </td>
 <td className="text-center py-3 px-2 text-success font-medium">
 {benchmark.industry_top10}{benchmark.unit}
 </td>
 <td className="text-center py-3 px-2">
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${comparison.color}`}>
 {comparison.text}
 </span>
 </td>
 <td className="text-center py-3 px-2">
 {gapToTop > 0 ? (
 <span className="text-warning">
 {benchmark.higher_is_better ? '+' : '-'}{Math.abs(gapToTop).toFixed(1)}{benchmark.unit}
 </span>
 ) : (
 <span className="text-success">✓ Achieved</span>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>

 {/* Step 3: Percentile Ranking */}
 <div className="rounded-lg border bg-gradient-to-r from-cyan-500/10 to-primary/10 p-6">
 <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
 <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-sm">3</span>
 <span>🏅</span> Percentile Ranking
 </h2>
 <p className="text-sm text-muted-foreground mb-4">See where you rank compared to all {industryName} companies</p>

 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {percentiles.map((item, index) => (
 <div key={index} className="rounded-lg border bg-card p-4">
 <div className="flex items-center justify-between mb-2">
 <span className="font-medium text-foreground text-sm">{item.metric}</span>
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRankBadge(item.rank)}`}>
 {getRankLabel(item.rank)}
 </span>
 </div>
 <div className="flex items-center gap-3">
 <div className="flex-1">
 <div className="h-3 rounded-full bg-muted overflow-hidden">
 <div
 className={`h-full transition-all ${getPercentileColor(item.percentile)}`}
 style={{ width: `${item.percentile}%` }}
 />
 </div>
 </div>
 <span className="text-lg font-bold text-foreground">{item.percentile}%</span>
 </div>
 <p className="text-xs text-muted-foreground mt-2">
 Better than {item.percentile}% of companies in your industry
 </p>
 </div>
 ))}
 </div>
 </div>

 {/* Step 4: Gap Analysis and Improvement Plan */}
 <div className="rounded-lg border bg-card p-6">
 <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
 <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-sm">4</span>
 <span>🎯</span> Gap Analysis & Improvement Plan
 </h2>
 <p className="text-sm text-muted-foreground mb-4">Prioritized action plan to reach industry-leading testing maturity</p>

 <div className="p-4 rounded-lg bg-violet-50 border border-violet-200 mb-4">
 <div className="flex items-start gap-3">
 <span className="text-2xl">🧠</span>
 <div>
 <p className="font-semibold text-violet-800">AI Analysis Summary</p>
 <p className="text-sm text-violet-700 mt-1">
 You have <strong>{gapAnalysis.filter(g => g.gap_severity === 'high' || g.gap_severity === 'critical').length} high-priority gaps</strong> to address.
 Focusing on the top 3 areas could improve your maturity score by <strong>+15-20 points</strong> and move you into the <strong>top 10%</strong> of your industry.
 </p>
 </div>
 </div>
 </div>

 <div className="space-y-4">
 {gapAnalysis.map((gap, index) => (
 <div key={index} className={`rounded-lg border p-4 ${gap.priority <= 2 ? 'bg-warning/5/50 border-warning/20' : 'bg-card'}`}>
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-3">
 <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
 {gap.priority}
 </span>
 <div>
 <h3 className="font-semibold text-foreground">{gap.area}</h3>
 <div className="flex items-center gap-2 mt-1">
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(gap.gap_severity)}`}>
 {gap.gap_severity.toUpperCase()}
 </span>
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getEffortBadge(gap.estimated_effort)}`}>
 {gap.estimated_effort} effort
 </span>
 </div>
 </div>
 </div>
 <div className="text-right">
 <p className="text-sm font-medium text-success">{gap.expected_impact}</p>
 </div>
 </div>

 <div className="grid gap-4 md:grid-cols-2 mb-3">
 <div className="rounded-lg bg-destructive/5 p-3">
 <p className="text-xs font-medium text-destructive mb-1">Current State</p>
 <p className="text-sm text-destructive">{gap.current_state}</p>
 </div>
 <div className="rounded-lg bg-success/5 p-3">
 <p className="text-xs font-medium text-success mb-1">Target State</p>
 <p className="text-sm text-success">{gap.target_state}</p>
 </div>
 </div>

 <details className="group">
 <summary className="cursor-pointer text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
 <span>View {gap.improvement_actions.length} improvement actions</span>
 <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </summary>
 <ol className="mt-3 ml-4 space-y-2 text-sm text-muted-foreground list-decimal">
 {gap.improvement_actions.map((action, actionIndex) => (
 <li key={actionIndex} className="pl-2">{action}</li>
 ))}
 </ol>
 </details>
 </div>
 ))}
 </div>
 </div>

 {/* Summary Stats */}
 <div className="grid gap-4 md:grid-cols-4">
 <div className="rounded-lg border bg-card p-4">
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Above Average</span>
 <span className="text-2xl">📈</span>
 </div>
 <p className="text-3xl font-bold text-success mt-2">
 {benchmarks.filter(b => {
 if (b.higher_is_better) return b.your_value >= b.industry_avg;
 return b.your_value <= b.industry_avg;
 }).length}
 </p>
 <p className="text-sm text-muted-foreground">of {benchmarks.length} metrics</p>
 </div>
 <div className="rounded-lg border bg-card p-4">
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Top 10% Metrics</span>
 <span className="text-2xl">🏆</span>
 </div>
 <p className="text-3xl font-bold text-primary mt-2">
 {benchmarks.filter(b => {
 if (b.higher_is_better) return b.your_value >= b.industry_top10;
 return b.your_value <= b.industry_top10;
 }).length}
 </p>
 <p className="text-sm text-muted-foreground">of {benchmarks.length} metrics</p>
 </div>
 <div className="rounded-lg border bg-card p-4">
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Priority Gaps</span>
 <span className="text-2xl">🎯</span>
 </div>
 <p className="text-3xl font-bold text-amber-600 mt-2">{gapAnalysis.filter(g => g.gap_severity === 'high' || g.gap_severity === 'critical').length}</p>
 <p className="text-sm text-muted-foreground">high-priority areas</p>
 </div>
 <div className="rounded-lg border bg-card p-4">
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Avg Percentile</span>
 <span className="text-2xl">📊</span>
 </div>
 <p className="text-3xl font-bold text-foreground mt-2">
 {Math.round(percentiles.reduce((acc, p) => acc + p.percentile, 0) / percentiles.length)}%
 </p>
 <p className="text-sm text-muted-foreground">across all metrics</p>
 </div>
 </div>
 </div>
 </Layout>
 );
}
