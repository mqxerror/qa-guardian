/**
 * WaveCard Component
 * Feature #514: Extracted from QuickTestPage.tsx
 *
 * Displays a single wave card with expandable details.
 * Shows wave status (waiting/running/completed/failed/skipped),
 * step progress, screenshots, and wave-specific detail components.
 */

import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Monitor,
  Smartphone,
  Maximize2,
  AlertTriangle,
} from 'lucide-react';
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
// Component
// ============================================================

export function WaveCard({ wave, onToggleExpand, onScreenshotClick, onCreateTestSuite }: WaveCardProps) {
  const Icon = wave.icon;

  const getStatusStyles = () => {
    switch (wave.status) {
      case 'waiting':
        return 'border-muted bg-muted/10';
      case 'running':
        return 'border-primary bg-primary/10 animate-pulse';
      case 'completed':
        return 'border-success bg-success/10';
      case 'failed':
        return 'border-destructive bg-destructive/10';
      case 'skipped':
        return 'border-warning bg-warning/10';
      default:
        return 'border-muted bg-muted/10';
    }
  };

  const getStatusIcon = () => {
    switch (wave.status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'skipped':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`rounded-lg border-2 transition-all duration-300 ${getStatusStyles()}`}
    >
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${wave.status === 'running' ? 'bg-primary/20' : 'bg-muted'}`}>
            <Icon className={`w-5 h-5 ${wave.status === 'running' ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{wave.name}</h3>
            <p className="text-xs text-muted-foreground">
              {wave.status === 'waiting' && 'Waiting...'}
              {wave.status === 'running' && 'In progress...'}
              {wave.status === 'completed' && `Completed in ${wave.duration || 0}ms`}
              {wave.status === 'failed' && 'Failed'}
              {wave.status === 'skipped' && 'Skipped - not configured'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {wave.expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {wave.expanded && (
        <div className="px-4 pb-4 space-y-2">
          {wave.steps?.map((step, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 px-2 rounded bg-background/50"
            >
              <span className="text-sm text-foreground">{step.name}</span>
              <div className="flex items-center gap-2">
                {step.duration && (
                  <span className="text-xs text-muted-foreground">{step.duration}ms</span>
                )}
                {step.status === 'pending' && (
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                {step.status === 'running' && (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                )}
                {step.status === 'completed' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                )}
                {step.status === 'failed' && (
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                )}
              </div>
            </div>
          ))}
          {/* Feature #466: Screenshot thumbnails for Wave 2 (Visual + Performance) */}
          {wave.wave === 2 && wave.status === 'completed' && wave.data && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground mb-2">Screenshots</div>
              <div className="flex gap-3">
                {/* Desktop Screenshot */}
                {(wave.data as { desktopScreenshotUrl?: string }).desktopScreenshotUrl && (
                  <button
                    onClick={() => onScreenshotClick?.(
                      (wave.data as { desktopScreenshotUrl: string }).desktopScreenshotUrl,
                      'desktop'
                    )}
                    className="group relative rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                  >
                    <img
                      src={(wave.data as { desktopScreenshotUrl: string }).desktopScreenshotUrl}
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
                {(wave.data as { mobileScreenshotUrl?: string }).mobileScreenshotUrl && (
                  <button
                    onClick={() => onScreenshotClick?.(
                      (wave.data as { mobileScreenshotUrl: string }).mobileScreenshotUrl,
                      'mobile'
                    )}
                    className="group relative rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                  >
                    <img
                      src={(wave.data as { mobileScreenshotUrl: string }).mobileScreenshotUrl}
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
                {/* No screenshots message */}
                {!(wave.data as { desktopScreenshotUrl?: string }).desktopScreenshotUrl &&
                 !(wave.data as { mobileScreenshotUrl?: string }).mobileScreenshotUrl && (
                  <div className="text-xs text-muted-foreground italic">
                    No screenshots captured
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Feature #467: AI Analysis details for Wave 4 */}
          {/* Feature #475: Pass onCreateTestSuite callback to create tests from AI suggestions */}
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
            <div className="mt-2 p-4 rounded-lg bg-warning/5 border border-warning/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">AI Analysis Not Available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(wave.data as Record<string, unknown>)?.summary as string || 'AI provider not configured. Add an AI API key in Settings → AI Configuration to enable AI-powered analysis.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Feature #471: Accessibility details for Wave 5 */}
          {wave.wave === 5 && wave.status === 'completed' && wave.data && (
            <AccessibilityDetails data={wave.data as unknown as AccessibilityData} />
          )}

          {/* Feature #472: API Discovery details for Wave 6 */}
          {wave.wave === 6 && wave.status === 'completed' && wave.data && (
            <APIDiscoveryDetails data={wave.data as unknown as APIDiscoveryData} />
          )}

          {wave.error && wave.status !== 'skipped' && (
            <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
              {wave.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WaveCard;
