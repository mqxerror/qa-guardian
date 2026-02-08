/**
 * CircularGauge - Circular progress indicator for Lighthouse scores
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 */

import React from 'react';

interface CircularGaugeProps {
  score: number;
  label: string;
  size?: number;
}

export default function CircularGauge({ score, label, size = 120 }: CircularGaugeProps) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  const getColor = (value: number) => {
    if (value >= 90) return { stroke: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', text: 'text-green-600' };
    if (value >= 50) return { stroke: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', text: 'text-yellow-600' };
    return { stroke: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'text-destructive' };
  };

  const colors = getColor(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          style={{ overflow: 'visible' }}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted/30"
          />
          {/* Progress circle with animation */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1s ease-out',
            }}
          />
        </svg>
        {/* Score text */}
        <div
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className={`text-2xl font-bold ${colors.text}`}>{score}</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground mt-2 font-medium">{label}</span>
    </div>
  );
}
