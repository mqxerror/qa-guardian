/**
 * Utility functions for Test Suite Detail Page
 * Extracted from TestSuitePage.tsx for modularity (Feature #50)
 */

import type { TestTypeEnum, TestStatus, SortField, SortDirection, TestType } from './types';

/**
 * Extract URL from user description text
 * Matches URLs like: mercan.pa, https://mercan.pa, www.example.org, sub.domain.com/path
 */
export function extractUrlFromText(text: string): string | null {
 if (!text) return null;

 // Match full URLs first (with protocol)
 const fullUrlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
 if (fullUrlMatch) {
 return fullUrlMatch[0].replace(/[.,;:!?)]+$/, '');
 }

 // Match domain-like patterns (domain.tld, www.domain.tld)
 const domainMatch = text.match(
 /(?:^|\s)((?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|org|net|io|co|pa|dev|app|ai|me|us|uk|de|fr|es|it|nl|be|ch|at|au|nz|jp|kr|cn|in|br|mx|ar|cl|ru|pl|se|no|dk|fi|pt|gr|cz|hu|ro|bg|hr|sk|si|lt|lv|ee|is|ie|lu|mt|cy)[^\s<>"']*)(?:\s|$)/i
 );
 if (domainMatch) {
 const domain = domainMatch[1].replace(/[.,;:!?)]+$/, '');
 return `https://${domain}`;
 }

 return null;
}

/**
 * Extract test type from natural language description
 * Detects: visual, e2e, performance, load, accessibility
 */
export function extractTestTypeFromText(text: string): TestTypeEnum | null {
 if (!text) return null;
 const lower = text.toLowerCase();

 // Visual regression patterns
 if (/visual|screenshot|baseline|pixel|appearance|look|design|ui\s*check/i.test(lower)) {
 return 'visual_regression';
 }

 // Performance/Lighthouse patterns
 if (/performance|lighthouse|speed|lcp|cls|fcp|core\s*web\s*vitals|page\s*speed/i.test(lower)) {
 return 'lighthouse';
 }

 // Load test patterns
 if (/load\s*test|stress|k6|concurrent|virtual\s*users|throughput|scalability/i.test(lower)) {
 return 'load';
 }

 // Accessibility patterns
 if (/accessibility|a11y|wcag|screen\s*reader|aria|accessible/i.test(lower)) {
 return 'accessibility';
 }

 // E2E patterns (default for action-based descriptions)
 if (/click|fill|type|login|submit|navigate|form|button|input|test\s+that|verify|check\s+if/i.test(lower)) {
 return 'e2e';
 }

 return null;
}

/**
 * Extract viewport from natural language description
 * Detects: mobile, tablet, desktop
 */
export function extractViewportFromText(text: string): { width: number; height: number; preset: string } | null {
 if (!text) return null;
 const lower = text.toLowerCase();

 // Mobile patterns
 if (/mobile|phone|iphone|android|small\s*screen/i.test(lower)) {
 return { width: 375, height: 812, preset: 'Mobile (375x812)' };
 }

 // Tablet patterns
 if (/tablet|ipad|medium\s*screen/i.test(lower)) {
 return { width: 768, height: 1024, preset: 'Tablet (768x1024)' };
 }

 // Desktop patterns (explicit)
 if (/desktop|large\s*screen|full\s*screen|1920|1080/i.test(lower)) {
 return { width: 1920, height: 1080, preset: 'Desktop (1920x1080)' };
 }

 return null;
}

/**
 * Format date as relative time (e.g., "2m ago", "1h ago")
 */
export function formatRelativeTime(date: Date): string {
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffSec = Math.floor(diffMs / 1000);
 const diffMin = Math.floor(diffSec / 60);
 const diffHour = Math.floor(diffMin / 60);
 const diffDay = Math.floor(diffHour / 24);

 if (diffSec < 60) return 'Just now';
 if (diffMin < 60) return `${diffMin}m ago`;
 if (diffHour < 24) return `${diffHour}h ago`;
 if (diffDay < 7) return `${diffDay}d ago`;
 return date.toLocaleDateString();
}

/**
 * Get icon for test type
 */
export function getTestTypeIcon(type: TestTypeEnum): string {
 switch (type) {
 case 'e2e':
 return '🎭';
 case 'visual_regression':
 return '📸';
 case 'lighthouse':
 return '⚡';
 case 'load':
 return '📊';
 case 'accessibility':
 return '♿';
 case 'api':
 return '🔌';
 default:
 return '🧪';
 }
}

/**
 * Get human-readable label for test type
 */
export function getTestTypeLabel(type: TestTypeEnum): string {
 switch (type) {
 case 'e2e':
 return 'E2E Test';
 case 'visual_regression':
 return 'Visual';
 case 'lighthouse':
 return 'Performance';
 case 'load':
 return 'Load Test';
 case 'accessibility':
 return 'A11y';
 case 'api':
 return 'API';
 default:
 return type;
 }
}

/**
 * Get CSS class for test status badge
 */
export function getTestStatusClass(status: TestStatus | string | null): string {
 switch (status) {
 case 'passed':
 return 'bg-success/10 text-success';
 case 'failed':
 case 'error':
 return 'bg-destructive/10 text-destructive';
 case 'running':
 return 'bg-primary/10 text-primary';
 case 'pending':
 case 'active':
 case 'draft':
 return 'bg-warning/10 text-warning';
 default:
 return 'bg-muted text-foreground';
 }
}

/**
 * Get icon for test status
 */
export function getTestStatusIcon(status: TestStatus | string | null): string {
 switch (status) {
 case 'passed':
 return '✓';
 case 'failed':
 case 'error':
 return '✗';
 case 'running':
 return '⟳';
 case 'pending':
 case 'active':
 case 'draft':
 return '○';
 default:
 return '—';
 }
}

/**
 * Get CSS class for action type badge
 */
export function getActionTypeClass(action: string): string {
 switch (action) {
 case 'click':
 return 'bg-primary/10 text-primary';
 case 'type':
 case 'fill':
 return 'bg-purple-100 text-purple-800';
 case 'navigate':
 case 'goto':
 return 'bg-success/10 text-success';
 case 'expect':
 case 'assert':
 return 'bg-orange-100 text-orange-800';
 case 'wait':
 case 'screenshot':
 return 'bg-warning/10 text-warning';
 default:
 return 'bg-muted text-foreground';
 }
}

/**
 * Get icon for action type
 */
export function getActionTypeIcon(action: string): string {
 switch (action) {
 case 'click':
 return '👆';
 case 'type':
 case 'fill':
 return '⌨️';
 case 'navigate':
 case 'goto':
 return '🔗';
 case 'expect':
 case 'assert':
 return '✓';
 case 'wait':
 return '⏱️';
 case 'screenshot':
 return '📷';
 default:
 return '📝';
 }
}

/**
 * Sort tests by the specified field and direction
 */
export function sortTests(tests: TestType[], field: SortField, direction: SortDirection): TestType[] {
 return [...tests].sort((a, b) => {
 let comparison = 0;

 switch (field) {
 case 'name':
 comparison = a.name.localeCompare(b.name);
 break;
 case 'type':
 comparison = (a.type || '').localeCompare(b.type || '');
 break;
 case 'status':
 comparison = (a.last_result || '').localeCompare(b.last_result || '');
 break;
 case 'last_run_at': {
 const dateA = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
 const dateB = b.last_run_at ? new Date(b.last_run_at).getTime() : 0;
 comparison = dateA - dateB;
 break;
 }
 case 'run_count':
 comparison = (a.run_count || 0) - (b.run_count || 0);
 break;
 case 'avg_duration_ms':
 comparison = (a.avg_duration_ms || 0) - (b.avg_duration_ms || 0);
 break;
 default:
 comparison = 0;
 }

 return direction === 'asc' ? comparison : -comparison;
 });
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number | null | undefined): string {
 if (ms === null || ms === undefined) return '—';
 if (ms < 1000) return `${ms}ms`;
 if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
 const minutes = Math.floor(ms / 60000);
 const seconds = Math.floor((ms % 60000) / 1000);
 return `${minutes}m ${seconds}s`;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
 try {
 const parsed = new URL(url);
 return parsed.protocol === 'http:' || parsed.protocol === 'https:';
 } catch {
 return false;
 }
}

/**
 * Auto-complete URL with https:// if missing
 */
export function autoCompleteUrl(url: string): string {
 if (!url) return url;
 const trimmed = url.trim();
 if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
 return `https://${trimmed}`;
 }
 return trimmed;
}

/**
 * Get CSS class for AI confidence score
 */
export function getConfidenceClass(score: number): string {
 if (score >= 0.8) {
 return 'bg-success/10 text-success';
 }
 if (score >= 0.5) {
 return 'bg-warning/10 text-warning';
 }
 return 'bg-destructive/10 text-destructive';
}

/**
 * Format confidence score as percentage
 */
export function formatConfidence(score: number | undefined): string {
 if (score === undefined) return '—';
 return `${Math.round(score * 100)}%`;
}

/**
 * Get browser icon
 */
export function getBrowserIcon(browser?: string): string {
 switch (browser) {
 case 'chromium':
 return '🌐';
 case 'firefox':
 return '🦊';
 case 'webkit':
 return '🧭';
 default:
 return '🌐';
 }
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
 if (!text || text.length <= maxLength) return text;
 return text.slice(0, maxLength - 3) + '...';
}

/**
 * Code diff line type
 */
export type DiffLineType = 'unchanged' | 'added' | 'removed';

export interface DiffLine {
 type: DiffLineType;
 line: string;
}

/**
 * Compute diff between two code strings (Feature #1163)
 * Simple line-by-line diff algorithm for code comparison
 */
export function computeCodeDiff(oldCode: string, newCode: string): DiffLine[] {
 const oldLines = oldCode.split('\n');
 const newLines = newCode.split('\n');
 const diff: DiffLine[] = [];

 let oldIdx = 0;
 let newIdx = 0;

 while (oldIdx < oldLines.length || newIdx < newLines.length) {
 if (oldIdx >= oldLines.length) {
 // All remaining new lines are additions
 diff.push({ type: 'added', line: newLines[newIdx] });
 newIdx++;
 } else if (newIdx >= newLines.length) {
 // All remaining old lines are removals
 diff.push({ type: 'removed', line: oldLines[oldIdx] });
 oldIdx++;
 } else if (oldLines[oldIdx] === newLines[newIdx]) {
 // Lines match
 diff.push({ type: 'unchanged', line: oldLines[oldIdx] });
 oldIdx++;
 newIdx++;
 } else {
 // Lines differ - look ahead to find if old line appears later in new
 const oldLineInNew = newLines.slice(newIdx + 1).indexOf(oldLines[oldIdx]);
 const newLineInOld = oldLines.slice(oldIdx + 1).indexOf(newLines[newIdx]);

 if (oldLineInNew === -1 && newLineInOld === -1) {
 // Neither line appears later - treat as removal then addition
 diff.push({ type: 'removed', line: oldLines[oldIdx] });
 diff.push({ type: 'added', line: newLines[newIdx] });
 oldIdx++;
 newIdx++;
 } else if (oldLineInNew !== -1 && (newLineInOld === -1 || oldLineInNew <= newLineInOld)) {
 // Old line appears later in new - this new line is an addition
 diff.push({ type: 'added', line: newLines[newIdx] });
 newIdx++;
 } else {
 // New line appears later in old - this old line is a removal
 diff.push({ type: 'removed', line: oldLines[oldIdx] });
 oldIdx++;
 }
 }
 }

 return diff;
}

/**
 * Confidence factor for test generation
 */
export interface ConfidenceFactor {
 factor: string;
 score: number;
 max_score: number;
 description: string;
}

/**
 * Confidence result for test generation
 */
export interface ConfidenceResult {
 score: number;
 factors: ConfidenceFactor[];
}

/**
 * Test input for confidence calculation
 */
export interface TestConfidenceInput {
 syntax_valid: boolean;
 syntax_errors?: string[];
 assertions: string[];
 selectors: string[];
 steps: string[];
 complexity: 'simple' | 'medium' | 'complex';
 warnings?: string[];
}

/**
 * Calculate confidence score for generated test (Feature #1153)
 * Returns a score from 0-100 with breakdown by factor
 */
export function calculateTestConfidence(test: TestConfidenceInput): ConfidenceResult {
 const factors: ConfidenceFactor[] = [];

 // Factor 1: Syntax validity (25 points max)
 const syntaxScore = test.syntax_valid ? 25 : 0;
 factors.push({
 factor: 'Syntax Validity',
 score: syntaxScore,
 max_score: 25,
 description: test.syntax_valid
 ? 'Code syntax is valid and parseable'
 : `Syntax errors detected: ${test.syntax_errors?.length || 0} issues`
 });

 // Factor 2: Assertions presence (25 points max)
 const assertionCount = test.assertions.length;
 const assertionScore = Math.min(25, assertionCount * 8);
 factors.push({
 factor: 'Test Assertions',
 score: assertionScore,
 max_score: 25,
 description: assertionCount > 0
 ? `${assertionCount} assertion${assertionCount > 1 ? 's' : ''} to verify expected outcomes`
 : 'No assertions - test may not verify expected behavior'
 });

 // Factor 3: Selector quality (20 points max)
 const selectorCount = test.selectors.length;
 const hasGoodSelectors = test.selectors.some(s =>
 s.includes('getByRole') || s.includes('getByLabel') || s.includes('getByText') || s.includes('data-testid')
 );
 const selectorScore = Math.min(20, selectorCount * 4 + (hasGoodSelectors ? 8 : 0));
 factors.push({
 factor: 'Selector Quality',
 score: Math.min(20, selectorScore),
 max_score: 20,
 description: hasGoodSelectors
 ? `Uses ${selectorCount} accessible selectors (role, label, text, testid)`
 : selectorCount > 0
 ? `${selectorCount} selector${selectorCount > 1 ? 's' : ''} - consider using more accessible selectors`
 : 'No specific selectors detected'
 });

 // Factor 4: Test steps completeness (15 points max)
 const stepCount = test.steps.length;
 const stepScore = Math.min(15, stepCount * 3);
 factors.push({
 factor: 'Test Steps',
 score: stepScore,
 max_score: 15,
 description: stepCount >= 3
 ? `${stepCount} clear test steps covering the workflow`
 : `Only ${stepCount} step${stepCount !== 1 ? 's' : ''} - consider more comprehensive coverage`
 });

 // Factor 5: Complexity appropriateness (15 points max)
 const complexityScore = test.complexity === 'simple' ? 15 : test.complexity === 'medium' ? 12 : 8;
 factors.push({
 factor: 'Complexity',
 score: complexityScore,
 max_score: 15,
 description: test.complexity === 'simple'
 ? 'Simple test - easy to maintain and debug'
 : test.complexity === 'medium'
 ? 'Medium complexity - balanced coverage and maintainability'
 : 'Complex test - may be harder to maintain'
 });

 // Deduct points for warnings
 const warningDeduction = Math.min(10, (test.warnings?.length || 0) * 3);
 const totalScore = Math.max(0, Math.min(100,
 syntaxScore + assertionScore + Math.min(20, selectorScore) + stepScore + complexityScore - warningDeduction
 ));

 if (warningDeduction > 0) {
 factors.push({
 factor: 'Warnings',
 score: -warningDeduction,
 max_score: 0,
 description: `${test.warnings?.length} warning${(test.warnings?.length || 0) > 1 ? 's' : ''} detected that may affect test reliability`
 });
 }

 return { score: Math.round(totalScore), factors };
}

/**
 * Validate test name and return error message if invalid
 * Returns empty string if valid
 */
export function validateTestName(name: string): string {
 const trimmedName = name.trim();

 if (!trimmedName) {
 return 'Test name is required';
 }

 if (trimmedName.length < 3) {
 return 'Test name must be at least 3 characters';
 }

 if (trimmedName.length > 255) {
 return 'Test name must be 255 characters or less';
 }

 // Allow letters, numbers, spaces, hyphens, underscores, and common punctuation
 const validNamePattern = /^[a-zA-Z0-9\s\-_.,():'"!?]+$/;
 if (!validNamePattern.test(trimmedName)) {
 return 'Test name can only contain letters, numbers, spaces, hyphens, underscores, and basic punctuation';
 }

 return '';
}
