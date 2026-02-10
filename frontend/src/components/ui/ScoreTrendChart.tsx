/**
 * Feature #556: ScoreTrendChart - Reusable score/rate trend line chart
 * Extracted from QuickTestPage inline chart and TestSuitePage pass rate trend.
 * Uses Recharts LineChart with color zones, average reference line, and legend.
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export interface ScoreTrendDataPoint {
  /** X-axis label (e.g. formatted date) */
  label: string;
  /** Score/rate value (0-100) */
  value: number;
}

export interface ScoreTrendThreshold {
  /** Score at or above this is "good" (green) */
  good: number;
  /** Score at or above this is "fair/warning" (yellow); below is "poor" (red) */
  warning: number;
}

export interface ScoreTrendLegendItem {
  label: string;
  colorClass: string;
}

export interface ScoreTrendChartProps {
  /** Chart data points. At least 2 points recommended. */
  data: ScoreTrendDataPoint[];
  /** Chart title, rendered above the chart */
  title?: string;
  /** Height of the chart area in pixels. Default 128 (h-32) */
  height?: number;
  /** Thresholds for color zones. Default: { good: 80, warning: 60 } */
  thresholds?: ScoreTrendThreshold;
  /** Label shown in tooltip for the value. Default: "Score" */
  valueLabel?: string;
  /** Whether to append "%" to axis ticks and tooltip values. Default: false */
  showPercent?: boolean;
  /** Custom legend items. If not provided, auto-generated from thresholds */
  legend?: ScoreTrendLegendItem[];
  /** Show the average reference line. Default: true */
  showAverage?: boolean;
  /** Additional className for the wrapper */
  className?: string;
  /** Y-axis domain min. Default: 0 */
  yMin?: number;
  /** Y-axis domain max. Default: 100 */
  yMax?: number;
}

/**
 * Determines line color based on the latest data point value and thresholds.
 */
function getLineColor(value: number, thresholds: ScoreTrendThreshold): string {
  if (value >= thresholds.good) return '#22c55e';
  if (value >= thresholds.warning) return '#f59e0b';
  return '#ef4444';
}

export function ScoreTrendChart({
  data,
  title,
  height = 128,
  thresholds = { good: 80, warning: 60 },
  valueLabel = 'Score',
  showPercent = false,
  legend,
  showAverage = true,
  className = '',
  yMin = 0,
  yMax = 100,
}: ScoreTrendChartProps) {
  if (data.length < 2) return null;

  // Calculate average
  const avgValue = Math.round(
    data.reduce((sum, d) => sum + d.value, 0) / data.length,
  );

  // Latest value determines line color
  const latestValue = data[data.length - 1].value;
  const lineColor = getLineColor(latestValue, thresholds);
  const suffix = showPercent ? '%' : '';

  // Default legend based on thresholds
  const legendItems: ScoreTrendLegendItem[] = legend || [
    { label: `≥${thresholds.good}${suffix} Good`, colorClass: 'bg-success' },
    {
      label: `${thresholds.warning}-${thresholds.good - 1}${suffix} Fair`,
      colorClass: 'bg-warning',
    },
    {
      label: `<${thresholds.warning}${suffix} Poor`,
      colorClass: 'bg-destructive',
    },
  ];

  return (
    <div className={className}>
      {title && (
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          {title}
        </h4>
      )}
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tickFormatter={(value: number) =>
                `${value}${showPercent ? '%' : ''}`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                padding: '0.5rem',
              }}
              labelStyle={{ color: 'var(--foreground)', fontWeight: 500 }}
              itemStyle={{ color: 'var(--foreground)' }}
              formatter={(value: number) => [
                `${value}${suffix}`,
                valueLabel,
              ]}
            />
            {showAverage && (
              <ReferenceLine
                y={avgValue}
                stroke="var(--muted-foreground)"
                strokeDasharray="3 3"
                label={{
                  value: `Avg: ${avgValue}${suffix}`,
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: 'var(--muted-foreground)',
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ fill: lineColor, strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, fill: lineColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="mt-1 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        {legendItems.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={`w-3 h-0.5 ${item.colorClass} rounded`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default ScoreTrendChart;
