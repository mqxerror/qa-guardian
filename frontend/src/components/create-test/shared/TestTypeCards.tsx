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

import React, { useCallback, useRef, useEffect } from 'react';

/**
 * Test types supported by the selector
 */
export type TestTypeOption = 'e2e' | 'visual' | 'performance' | 'load' | 'accessibility';

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
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    colorClass: 'text-blue-600 dark:text-blue-400',
    hoverBorderClass: 'hover:border-blue-300 dark:hover:border-blue-500',
    selectedBorderClass: 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20',
    iconBgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  {
    id: 'visual',
    label: 'Visual Regression',
    description: 'Screenshot comparison test',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    colorClass: 'text-purple-600 dark:text-purple-400',
    hoverBorderClass: 'hover:border-purple-300 dark:hover:border-purple-500',
    selectedBorderClass: 'border-purple-500 dark:border-purple-400 ring-2 ring-purple-500/20',
    iconBgClass: 'bg-purple-100 dark:bg-purple-900/30',
  },
  {
    id: 'performance',
    label: 'Performance',
    description: 'Lighthouse audit',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    colorClass: 'text-amber-600 dark:text-amber-400',
    hoverBorderClass: 'hover:border-amber-300 dark:hover:border-amber-500',
    selectedBorderClass: 'border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/20',
    iconBgClass: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    id: 'load',
    label: 'Load Test',
    description: 'K6 stress testing',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    colorClass: 'text-red-600 dark:text-red-400',
    hoverBorderClass: 'hover:border-red-300 dark:hover:border-red-500',
    selectedBorderClass: 'border-red-500 dark:border-red-400 ring-2 ring-red-500/20',
    iconBgClass: 'bg-red-100 dark:bg-red-900/30',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    description: 'WCAG compliance check',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    colorClass: 'text-green-600 dark:text-green-400',
    hoverBorderClass: 'hover:border-green-300 dark:hover:border-green-500',
    selectedBorderClass: 'border-green-500 dark:border-green-400 ring-2 ring-green-500/20',
    iconBgClass: 'bg-green-100 dark:bg-green-900/30',
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
export const TestTypeCards: React.FC<TestTypeCardsProps> = ({
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
      className={`test-type-cards grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 ${className}`}
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
              bg-white dark:bg-gray-800
              transition-all duration-200 ease-out
              cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isSelected
                  ? type.selectedBorderClass
                  : `border-gray-200 dark:border-gray-700 ${type.hoverBorderClass}`
              }
              ${!disabled && !isSelected ? 'hover:shadow-lg hover:-translate-y-1' : ''}
              ${isSelected ? 'shadow-md' : 'shadow-sm'}
            `}
          >
            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute top-2 right-2">
                <svg
                  className={`w-5 h-5 ${type.colorClass}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
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
                text-gray-900 dark:text-white
              `}
            >
              {type.label}
            </h3>

            {/* Description */}
            <p
              className={`
                text-xs text-center
                text-gray-500 dark:text-gray-400
              `}
            >
              {type.description}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export default TestTypeCards;
