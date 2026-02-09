/**
 * WaveCard Component
 * Feature #514: Extracted from QuickTestPage.tsx
 * Feature #523: Now uses WaveProgressCard as base component
 *
 * Quick Test specific wave card that adds:
 * - Screenshot thumbnails for Wave 2
 * - AI Analysis details for Wave 4
 * - Accessibility details for Wave 5
 * - API Discovery details for Wave 6
 */

import {
  Monitor,
  Smartphone,
  Maximize2,
  AlertTriangle,
} from 'lucide-react';
import { WaveProgressCard, type StepStatus } from '../ui/wave-progress-card';
import {
  AIAnalysisDetails,
  AccessibilityDetails,
  APIDiscoveryDetails,
} from './WaveDetails';
import type { WaveData, AIAnalysisData, AccessibilityData, APIDiscoveryData } from './types';

// ============================================================
// Props
// ============================================================

export interface WaveCardProps {
  wave: WaveData;
  onToggleExpand: () => void;
  /** Feature #466: Screenshot click handler */
  onScreenshotClick?: (url: string, type: 'desktop' | 'mobile') => void;
  /** Feature #475: Create test suite handler for Wave 4 */
  onCreateTestSuite?: (testSuggestions: AIAnalysisData['testSuggestions']) => void;
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * Screenshot thumbnails shown for Wave 2 (Visual + Performance)
 */
function ScreenshotThumbnails({
  data,
  onScreenshotClick,
}: {
  data: Record<string, unknown>;
  onScreenshotClick?: (url: string, type: 'desktop' | 'mobile') => void;
}) {
  const desktopUrl = data.desktopScreenshotUrl as string | undefined;
  const mobileUrl = data.mobileScreenshotUrl as string | undefined;

  if (!desktopUrl && !mobileUrl) {
    return (
      <div className="text-xs text-muted-foreground italic">
        No screenshots captured
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {/* Desktop Screenshot */}
      {desktopUrl && (
        <button
          onClick={() => onScreenshotClick?.(desktopUrl, 'desktop')}
          className="group relative rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
        >
          <img
            src={desktopUrl}
            alt="Desktop Screenshot"
            className="w-32 h-20 object-cover object-top"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 className="w-5 h-5 text-white" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
            <div className="flex items-center gap-1 text-white text-xs">
              <Monitor className="w-3 h-3" />
              <span>Desktop</span>
            </div>
          </div>
        </button>
      )}
      {/* Mobile Screenshot */}
      {mobileUrl && (
        <button
          onClick={() => onScreenshotClick?.(mobileUrl, 'mobile')}
          className="group relative rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
        >
          <img
            src={mobileUrl}
            alt="Mobile Screenshot"
            className="w-16 h-20 object-cover object-top"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 className="w-5 h-5 text-white" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
            <div className="flex items-center gap-1 text-white text-xs">
              <Smartphone className="w-3 h-3" />
              <span>Mobile</span>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

/**
 * AI Analysis skip message for Wave 4 when AI provider is not configured
 */
function AISkipMessage({ summary }: { summary?: string }) {
  return (
    <div className="mt-2 p-4 rounded-lg bg-warning/5 border border-warning/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">AI Analysis Not Available</p>
          <p className="text-xs text-muted-foreground mt-1">
            {summary || 'AI provider not configured. Add an AI API key in Settings → AI Configuration to enable AI-powered analysis.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get subtitle text based on wave status
 */
function getWaveSubtitle(status: WaveData['status'], duration?: number): string {
  switch (status) {
    case 'waiting':
      return 'Waiting...';
    case 'running':
      return 'In progress...';
    case 'completed':
      return `Completed in ${duration || 0}ms`;
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped - not configured';
    default:
      return '';
  }
}

// ============================================================
// Component
// ============================================================

export function WaveCard({
  wave,
  onToggleExpand,
  onScreenshotClick,
  onCreateTestSuite,
}: WaveCardProps) {
  // Convert wave steps to WaveProgressStep format
  const progressSteps = wave.steps?.map(step => ({
    name: step.name,
    status: step.status as StepStatus,
    duration: step.duration,
  }));

  return (
    <WaveProgressCard
      status={wave.status}
      icon={wave.icon}
      title={wave.name}
      subtitle={getWaveSubtitle(wave.status, wave.duration)}
      duration={wave.duration}
      expanded={wave.expanded || false}
      onToggle={onToggleExpand}
      steps={progressSteps}
      animate={true}
    >
      {/* Feature #466: Screenshot thumbnails for Wave 2 (Visual + Performance) */}
      {wave.wave === 2 && wave.status === 'completed' && wave.data && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs font-medium text-muted-foreground mb-2">Screenshots</div>
          <ScreenshotThumbnails
            data={wave.data as Record<string, unknown>}
            onScreenshotClick={onScreenshotClick}
          />
        </div>
      )}

      {/* Feature #467: AI Analysis details for Wave 4 */}
      {wave.wave === 4 && wave.status === 'completed' && wave.data && (
        <AIAnalysisDetails
          data={wave.data as AIAnalysisData}
          onCreateTestSuite={
            onCreateTestSuite && (wave.data as AIAnalysisData).testSuggestions?.length
              ? () => onCreateTestSuite((wave.data as AIAnalysisData).testSuggestions)
              : undefined
          }
        />
      )}

      {/* Feature #520: Friendly skip message for AI Analysis when not configured */}
      {wave.wave === 4 && wave.status === 'skipped' && (
        <AISkipMessage
          summary={(wave.data as Record<string, unknown>)?.summary as string}
        />
      )}

      {/* Feature #471: Accessibility details for Wave 5 */}
      {wave.wave === 5 && wave.status === 'completed' && wave.data && (
        <AccessibilityDetails data={wave.data as unknown as AccessibilityData} />
      )}

      {/* Feature #472: API Discovery details for Wave 6 */}
      {wave.wave === 6 && wave.status === 'completed' && wave.data && (
        <APIDiscoveryDetails data={wave.data as unknown as APIDiscoveryData} />
      )}

      {/* Error Message */}
      {wave.error && wave.status !== 'skipped' && (
        <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
          {wave.error}
        </div>
      )}
    </WaveProgressCard>
  );
}

export default WaveCard;
