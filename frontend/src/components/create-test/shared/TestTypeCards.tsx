/**
 * TestTypeCards Component
 * Feature #1803: Card-based test type selector
 *
 * Features:
 * - 5 test types displayed as visual cards
 * - Icons, names, descriptions for each type
 * - Hover lift effect with shadow
 * - Selected state with colored border
 * - Full keyboard navigation (arrow keys, Enter/Space)
 */

import React, { useCallback, useRef, useEffect, memo } from 'react';
import { PlayCircle, Eye, Zap, Users, Accessibility, ShieldCheck, CheckCircle2 } from 'lucide-react';

/**
 * Test types supported by the selector
 * Feature #591: Added 'security' test type
 */
export type TestTypeOption = 'e2e' | 'visual' | 'performance' | 'load' | 'accessibility' | 'security';

/**
 * Configuration for each test type card
 */
interface TestTypeConfig {
 id: TestTypeOption;
 label: string;
 description: string;
 icon: React.ReactNode;
 colorClass: string;
 hoverBorderClass: string;
 selectedBorderClass: string;
 iconBgClass: string;
}

/**
 * Test type configurations with icons and colors
 */
const TEST_TYPES: TestTypeConfig[] = [
 {
 id: 'e2e',
 label: 'E2E Test',
 description: 'End-to-end functional test',
 icon: <PlayCircle className="w-6 h-6" />,
 colorClass: 'text-primary',
 hoverBorderClass: 'hover:border-primary/30',
 selectedBorderClass: 'border-primary ring-2 ring-primary/20',
 iconBgClass: 'bg-primary/10',
 },
 {
 id: 'visual',
 label: 'Visual Regression',
 description: 'Screenshot comparison test',
 icon: <Eye className="w-6 h-6" />,
 colorClass: 'text-accent',
 hoverBorderClass: 'hover:border-accent/30',
 selectedBorderClass: 'border-accent ring-2 ring-accent/20',
 iconBgClass: 'bg-accent/10',
 },
 {
 id: 'performance',
 label: 'Performance',
 description: 'Lighthouse audit',
 icon: <Zap className="w-6 h-6" />,
 colorClass: 'text-warning',
 hoverBorderClass: 'hover:border-warning/30',
 selectedBorderClass: 'border-warning ring-2 ring-warning/20',
 iconBgClass: 'bg-warning/10',
 },
 {
 id: 'load',
 label: 'Load Test',
 description: 'K6 stress testing',
 icon: <Users className="w-6 h-6" />,
 colorClass: 'text-destructive',
 hoverBorderClass: 'hover:border-destructive/30',
 selectedBorderClass: 'border-destructive ring-2 ring-destructive/20',
 iconBgClass: 'bg-destructive/10',
 },
 {
 id: 'accessibility',
 label: 'Accessibility',
 description: 'WCAG compliance check',
 icon: <Accessibility className="w-6 h-6" />,
 colorClass: 'text-success',
 hoverBorderClass: 'hover:border-success/30',
 selectedBorderClass: 'border-success ring-2 ring-success/20',
 iconBgClass: 'bg-success/10',
 },
 // Feature #591: Security test type
 {
 id: 'security',
 label: 'Security',
 description: 'SAST & dependency scan',
 icon: <ShieldCheck className="w-6 h-6" />,
 colorClass: 'text-primary',
 hoverBorderClass: 'hover:border-primary/30',
 selectedBorderClass: 'border-primary ring-2 ring-primary/20',
 iconBgClass: 'bg-primary/10',
 },
];

/**
 * Props for TestTypeCards component
 */
export interface TestTypeCardsProps {
 /** Currently selected test type */
 selectedType: TestTypeOption | null;
 /** Called when a test type is selected */
 onSelect: (type: TestTypeOption) => void;
 /** CSS class name */
 className?: string;
 /** Disable all cards */
 disabled?: boolean;
 /** Accessible label for the group */
 ariaLabel?: string;
}

/**
 * TestTypeCards - Card-based test type selector
 *
 * Displays 5 test types as interactive cards with hover effects
 * and keyboard navigation support.
 */
export const TestTypeCards = memo<TestTypeCardsProps>(({
 selectedType,
 onSelect,
 className = '',
 disabled = false,
 ariaLabel = 'Select test type',
}) => {
 const containerRef = useRef<HTMLDivElement>(null);
 const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

 // Focus the selected card on mount if one is selected
 useEffect(() => {
 if (selectedType) {
 const index = TEST_TYPES.findIndex((t) => t.id === selectedType);
 if (index !== -1 && cardRefs.current[index]) {
 // Don't steal focus automatically, but ensure it's in the tab order
 }
 }
 }, [selectedType]);

 // Handle keyboard navigation
 const handleKeyDown = useCallback(
 (e: React.KeyboardEvent, currentIndex: number) => {
 if (disabled) return;

 let nextIndex: number | null = null;

 switch (e.key) {
 case 'ArrowRight':
 case 'ArrowDown':
 e.preventDefault();
 nextIndex = currentIndex < TEST_TYPES.length - 1 ? currentIndex + 1 : 0;
 break;
 case 'ArrowLeft':
 case 'ArrowUp':
 e.preventDefault();
 nextIndex = currentIndex > 0 ? currentIndex - 1 : TEST_TYPES.length - 1;
 break;
 case 'Home':
 e.preventDefault();
 nextIndex = 0;
 break;
 case 'End':
 e.preventDefault();
 nextIndex = TEST_TYPES.length - 1;
 break;
 case 'Enter':
 case ' ':
 e.preventDefault();
 onSelect(TEST_TYPES[currentIndex].id);
 return;
 }

 if (nextIndex !== null && cardRefs.current[nextIndex]) {
 cardRefs.current[nextIndex]?.focus();
 }
 },
 [disabled, onSelect]
 );

 // Handle card click
 const handleCardClick = useCallback(
 (type: TestTypeOption) => {
 if (!disabled) {
 onSelect(type);
 }
 },
 [disabled, onSelect]
 );

 return (
 <div
 ref={containerRef}
 role="radiogroup"
 aria-label={ariaLabel}
 className={`test-type-cards grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 ${className}`}
 >
 {TEST_TYPES.map((type, index) => {
 const isSelected = selectedType === type.id;

 return (
 <button
 key={type.id}
 ref={(el) => {
 cardRefs.current[index] = el;
 }}
 type="button"
 role="radio"
 aria-checked={isSelected}
 disabled={disabled}
 onClick={() => handleCardClick(type.id)}
 onKeyDown={(e) => handleKeyDown(e, index)}
 tabIndex={isSelected || (selectedType === null && index === 0) ? 0 : -1}
 className={`
 relative flex flex-col items-center p-4 rounded-xl border-2
 bg-card
 transition-all duration-200 ease-out
 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary
 disabled:opacity-50 disabled:cursor-not-allowed
 ${
 isSelected
 ? type.selectedBorderClass
 : `border-border ${type.hoverBorderClass}`
 }
 ${!disabled && !isSelected ? 'hover:shadow-lg hover:-translate-y-1' : ''}
 ${isSelected ? 'shadow-md' : 'shadow-sm'}
 `}
 >
 {/* Selection indicator */}
 {isSelected && (
 <div className="absolute top-2 right-2">
 <CheckCircle2 className={`w-5 h-5 ${type.colorClass}`} />
 </div>
 )}

 {/* Icon */}
 <div
 className={`
 w-12 h-12 rounded-full flex items-center justify-center mb-3
 ${type.iconBgClass}
 transition-transform duration-200
 ${!disabled && !isSelected ? 'group-hover:scale-110' : ''}
 `}
 >
 <span className={type.colorClass}>{type.icon}</span>
 </div>

 {/* Label */}
 <h3
 className={`
 text-sm font-semibold mb-1
 text-foreground
 `}
 >
 {type.label}
 </h3>

 {/* Description */}
 <p
 className={`
 text-xs text-center
 text-muted-foreground
 `}
 >
 {type.description}
 </p>
 </button>
 );
 })}
 </div>
 );
});
TestTypeCards.displayName = 'TestTypeCards';

export default TestTypeCards;
