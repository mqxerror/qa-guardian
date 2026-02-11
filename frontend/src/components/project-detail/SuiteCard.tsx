/**
 * SuiteCard Component
 * Feature #49: Extracted from ProjectDetailPage.tsx
 * Displays a test suite card in the project detail view
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { TestSuite } from './types';

interface SuiteCardProps {
 suite: TestSuite;
 projectId: string;
 formatDate: (date: string) => string;
}

const SuiteCard: React.FC<SuiteCardProps> = React.memo(({
 suite,
 projectId,
 formatDate,
}) => {
 const getBrowserIcon = (browser?: string) => {
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
 };

 return (
 <Link
 key={suite.id}
 to={`/suites/${suite.id}`}
 className="block p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow"
 >
 <div className="flex items-start justify-between">
 <div className="flex-1 min-w-0">
 <h3 className="text-lg font-semibold text-foreground truncate">
 {suite.name}
 </h3>
 {suite.description && (
 <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
 {suite.description}
 </p>
 )}
 </div>
 <div className="ml-4 flex items-center gap-2">
 {suite.browser && (
 <span
 className="text-lg"
 title={suite.browser}
 >
 {getBrowserIcon(suite.browser)}
 </span>
 )}
 {suite.test_count !== undefined && (
 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
 {suite.test_count} test{suite.test_count !== 1 ? 's' : ''}
 </span>
 )}
 </div>
 </div>

 <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
 {suite.viewport_width && suite.viewport_height && (
 <span className="flex items-center gap-1">
 <span>📐</span>
 {suite.viewport_width}x{suite.viewport_height}
 </span>
 )}
 {suite.timeout && (
 <span className="flex items-center gap-1">
 <span>⏱️</span>
 {suite.timeout / 1000}s timeout
 </span>
 )}
 {suite.retry_count !== undefined && suite.retry_count > 0 && (
 <span className="flex items-center gap-1">
 <span>🔄</span>
 {suite.retry_count} retries
 </span>
 )}
 </div>

 {suite.created_at && (
 <div className="mt-2 text-xs text-muted-foreground">
 Created {formatDate(suite.created_at)}
 </div>
 )}
 </Link>
 );
});

SuiteCard.displayName = 'SuiteCard';

export default SuiteCard;
