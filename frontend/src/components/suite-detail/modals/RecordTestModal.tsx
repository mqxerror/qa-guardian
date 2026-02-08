/**
 * RecordTestModal Component
 * Feature #50: Extracted from TestSuitePage.tsx
 * Feature #26: Live Browser View for recording
 * Feature #28: URL navigation and click ripple
 * Feature #31: Step Templates
 * Feature #33: Reconnection handling
 * Feature #34: Debug overlay
 * Feature #36: Device emulation
 * Feature #37: Optional step support
 * Feature #127: Mobile responsive design audit and fixes
 */

import React, { useRef, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from '../../../stores/toastStore';
import { DeviceConfig } from '../../test-modals/types';
import { DeviceSelect } from '../../create-test/shared/DeviceSelect';
import { RecordingStep } from '../useSuiteState';

interface RecordTestModalProps {
  // Control
  isOpen: boolean;
  isRecording: boolean;
  onClose: () => void;

  // Recording state
  recordTargetUrl: string;
  onRecordTargetUrlChange: (url: string) => void;
  recordedSteps: RecordingStep[];
  onRecordedStepsChange: (steps: RecordingStep[] | ((prev: RecordingStep[]) => RecordingStep[])) => void;

  // Device emulation
  recordingDeviceEnabled: boolean;
  onRecordingDeviceEnabledChange: (enabled: boolean) => void;
  recordingDeviceConfig: DeviceConfig;
  onRecordingDeviceConfigChange: (config: DeviceConfig) => void;

  // Recording session
  recordingSessionId: string | null;
  onRecordingSessionIdChange: (id: string | null) => void;
  recordingElapsed: number;
  recordingFrame: string | null;
  onRecordingFrameChange: (frame: string | null) => void;
  recordingConnected: boolean;
  onRecordingConnectedChange: (connected: boolean) => void;
  recordingCurrentUrl: string;
  onRecordingCurrentUrlChange: (url: string) => void;

  // Reconnection
  reconnectAttempt: number;
  onReconnectAttemptChange: (attempt: number) => void;
  reconnectFailed: boolean;
  onReconnectFailedChange: (failed: boolean) => void;

  // Stale frame
  staleFrameWarning: 'none' | 'waiting' | 'unresponsive';
  onStaleFrameWarningChange: (warning: 'none' | 'waiting' | 'unresponsive') => void;

  // Debug overlay
  showDebugOverlay: boolean;
  onShowDebugOverlayChange: (show: boolean) => void;

  // Click ripple
  clickRipple: { x: number; y: number; id: number } | null;
  onClickRippleChange: (ripple: { x: number; y: number; id: number } | null) => void;

  // Recording socket ref
  recordingSocketRef: React.MutableRefObject<Socket | null>;

  // Refs for frame scaling
  browserViewRef: React.MutableRefObject<HTMLDivElement | null>;
  browserImgRef: React.MutableRefObject<HTMLImageElement | null>;
  frameScaleRef: React.MutableRefObject<{ scaleX: number; scaleY: number }>;
  lastFrameTimeRef: React.MutableRefObject<number>;
  staleFrameTimerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  frameRequestRef: React.MutableRefObject<number | null>;
  pendingFrameRef: React.MutableRefObject<string | null>;

  // Handlers
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onCancelRecording: () => void;
  onRetryConnection: () => void;
  onStopAndSave: () => void;

  // Project data
  projectBaseUrl?: string;
  token: string;

  // Helper functions
  formatElapsed: (seconds: number) => string;
  getActionIcon: (action: string) => string;
}

export function RecordTestModal({
  isOpen,
  isRecording,
  onClose,
  recordTargetUrl,
  onRecordTargetUrlChange,
  recordedSteps,
  onRecordedStepsChange,
  recordingDeviceEnabled,
  onRecordingDeviceEnabledChange,
  recordingDeviceConfig,
  onRecordingDeviceConfigChange,
  recordingSessionId,
  onRecordingSessionIdChange,
  recordingElapsed,
  recordingFrame,
  onRecordingFrameChange,
  recordingConnected,
  onRecordingConnectedChange,
  recordingCurrentUrl,
  onRecordingCurrentUrlChange,
  reconnectAttempt,
  onReconnectAttemptChange,
  reconnectFailed,
  onReconnectFailedChange,
  staleFrameWarning,
  onStaleFrameWarningChange,
  showDebugOverlay,
  onShowDebugOverlayChange,
  clickRipple,
  onClickRippleChange,
  recordingSocketRef,
  browserViewRef,
  browserImgRef,
  frameScaleRef,
  lastFrameTimeRef,
  staleFrameTimerRef,
  frameRequestRef,
  pendingFrameRef,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onRetryConnection,
  onStopAndSave,
  projectBaseUrl,
  token,
  formatElapsed,
  getActionIcon,
}: RecordTestModalProps) {
  // Local state for debug coordinates
  const [debugCoords, setDebugCoords] = useState<{ cssX: number; cssY: number; vpX: number; vpY: number } | null>(null);

  if (!isOpen) {
    return null;
  }

  // Handler for URL bar navigation
  const handleUrlBarNavigate = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && recordingCurrentUrl) {
      // Send navigate command through socket
      if (recordingSocketRef.current && recordingSessionId) {
        recordingSocketRef.current.emit('recording:navigate', {
          sessionId: recordingSessionId,
          url: recordingCurrentUrl,
        });
        onRecordedStepsChange(prev => [...prev, { action: 'navigate', url: recordingCurrentUrl }]);
      }
    }
  };

  // Handler for browser view click
  const handleBrowserViewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!browserViewRef.current || !recordingSocketRef.current || !recordingSessionId) return;

    const rect = browserViewRef.current.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    // Calculate viewport coordinates using frame scale
    const vpX = Math.round((cssX / rect.width) * frameScaleRef.current.scaleX);
    const vpY = Math.round((cssY / rect.height) * frameScaleRef.current.scaleY);

    // Show click ripple effect
    const rippleId = Date.now();
    onClickRippleChange({ x: cssX, y: cssY, id: rippleId });
    setTimeout(() => onClickRippleChange(null), 500);

    // Send click to recording session
    recordingSocketRef.current.emit('recording:click', {
      sessionId: recordingSessionId,
      x: vpX,
      y: vpY,
    });
  };

  // Handler for keyboard events in browser view
  const handleBrowserViewKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!recordingSocketRef.current || !recordingSessionId) return;

    // Send keypress to recording session
    recordingSocketRef.current.emit('recording:keypress', {
      sessionId: recordingSessionId,
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
    });

    // Prevent default for special keys
    if (e.key === 'Tab' || e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
    }
  };

  // Handler for scroll/wheel in browser view
  const handleBrowserViewWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!recordingSocketRef.current || !recordingSessionId) return;

    recordingSocketRef.current.emit('recording:scroll', {
      sessionId: recordingSessionId,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
  };

  // Handler for mouse move (debug overlay)
  const handleBrowserViewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showDebugOverlay || !browserViewRef.current) return;

    const rect = browserViewRef.current.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    const vpX = Math.round((cssX / rect.width) * frameScaleRef.current.scaleX);
    const vpY = Math.round((cssY / rect.height) * frameScaleRef.current.scaleY);

    setDebugCoords({ cssX, cssY, vpX, vpY });
  };

  // Handler for mouse leave (debug overlay)
  const handleBrowserViewMouseLeave = () => {
    setDebugCoords(null);
  };

  // Handler for adding manual recording step
  const handleAddRecordingStep = (action: string, data: Partial<RecordingStep>) => {
    onRecordedStepsChange(prev => [...prev, { action, ...data }]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isRecording) {
          onCancelRecording();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-test-title"
        className={`w-full rounded-xl bg-card shadow-2xl transition-all duration-300 max-h-[90vh] overflow-y-auto ${
          isRecording ? 'max-w-7xl border-2 border-blue-500 shadow-blue-500/20' : 'max-w-xl border border-border'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 pb-0">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            isRecording ? 'bg-red-100' : 'bg-orange-100'
          }`}>
            <span className="text-xl">{isRecording ? '🔴' : '🎬'}</span>
          </div>
          <div className="flex-1">
            <h3 id="record-test-title" className="text-lg font-semibold text-foreground">
              {isRecording ? 'Recording in Progress' : 'Record New Test'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isRecording
                ? 'Click on the live browser view to interact - actions are recorded automatically'
                : 'Enter a URL to start recording user interactions'}
            </p>
          </div>
          {isRecording && (
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
              </span>
              <span className="font-semibold text-red-700">REC</span>
              <span className="font-mono text-lg font-bold text-red-800 tabular-nums">{formatElapsed(recordingElapsed)}</span>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {recordedSteps.length} step{recordedSteps.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {!isRecording ? (
          <div className="p-4 pt-4 space-y-4">
            <div>
              <label htmlFor="record-url" className="block text-sm font-medium text-foreground">
                Target URL
              </label>
              <input
                id="record-url"
                type="url"
                value={recordTargetUrl}
                onChange={(e) => onRecordTargetUrlChange(e.target.value)}
                placeholder={projectBaseUrl || 'https://your-site.com'}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Feature #36: Device emulation for recording */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-foreground">
                  Device Emulation
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordingDeviceEnabled}
                    onChange={(e) => onRecordingDeviceEnabledChange(e.target.checked)}
                    className="rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-muted-foreground">Enable</span>
                </label>
              </div>
              {recordingDeviceEnabled ? (
                <DeviceSelect
                  value={recordingDeviceConfig}
                  onChange={onRecordingDeviceConfigChange}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Enable to record on mobile/tablet with touch emulation and proper user agents.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onCancelRecording}
                className="rounded-lg border border-border px-4 py-2 font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onStartRecording}
                className="rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2 font-medium text-white hover:from-orange-600 hover:to-red-600 transition-all shadow-md hover:shadow-lg"
              >
                ⏺ Start Recording
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 pt-3 flex gap-4" style={{ maxHeight: 'calc(95vh - 80px)' }}>
            {/* Left: Live Browser View */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Feature #28: URL bar with navigation + connection status */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-2 w-2 rounded-full shrink-0 ${recordingConnected ? 'bg-green-500' : reconnectFailed ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} title={recordingConnected ? 'Connected' : reconnectFailed ? 'Connection Lost' : reconnectAttempt > 0 ? `Reconnecting (${reconnectAttempt}/10)` : 'Disconnected'} />
                <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 flex-1 min-w-0">
                  <span className="text-xs shrink-0">🌐</span>
                  <input
                    type="text"
                    value={recordingCurrentUrl || recordTargetUrl}
                    onChange={(e) => onRecordingCurrentUrlChange(e.target.value)}
                    onKeyDown={handleUrlBarNavigate}
                    className="text-xs bg-transparent border-none outline-none w-full text-foreground placeholder:text-muted-foreground"
                    placeholder="Enter URL and press Enter to navigate..."
                  />
                </div>
                <button
                  onClick={() => onShowDebugOverlayChange(!showDebugOverlay)}
                  className={`p-1 rounded text-xs shrink-0 transition-colors ${showDebugOverlay ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  title={showDebugOverlay ? 'Hide coordinate debug overlay' : 'Show coordinate debug overlay'}
                >🎯</button>
                <div className="text-[10px] text-muted-foreground shrink-0">Click | Type | Enter=Navigate</div>
              </div>
              <div
                ref={browserViewRef}
                className="relative rounded-lg border-2 border-border overflow-hidden bg-background cursor-crosshair focus:outline-none focus:border-blue-400"
                style={{ aspectRatio: '16/9', maxHeight: '500px', width: '100%', maxWidth: 'calc(500px * 16 / 9)' }}
                tabIndex={0}
                onClick={handleBrowserViewClick}
                onKeyDown={handleBrowserViewKeyDown}
                onWheel={handleBrowserViewWheel}
                onMouseMove={handleBrowserViewMouseMove}
                onMouseLeave={handleBrowserViewMouseLeave}
              >
                {recordingFrame ? (
                  <img
                    ref={browserImgRef}
                    src={recordingFrame}
                    alt="Live browser view"
                    className="w-full h-full"
                    draggable={false}
                    style={{ pointerEvents: 'none', objectFit: 'fill' }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-3"></div>
                      <p className="text-sm text-muted-foreground">Connecting to browser...</p>
                      <p className="text-xs text-muted-foreground mt-1">Loading {recordTargetUrl}</p>
                    </div>
                  </div>
                )}
                {/* Feature #28: Click ripple feedback */}
                {clickRipple && (
                  <div
                    key={clickRipple.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: clickRipple.x - 15,
                      top: clickRipple.y - 15,
                      width: 30,
                      height: 30,
                    }}
                  >
                    <div className="w-full h-full rounded-full border-2 border-blue-400 animate-ping opacity-75" />
                    <div className="absolute inset-0 rounded-full bg-blue-400/30 animate-pulse" />
                  </div>
                )}
                {/* Feature #33: Enhanced disconnection/reconnection overlay */}
                {!recordingConnected && recordingFrame && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm z-10">
                    <div className="text-center px-4">
                      {reconnectFailed ? (
                        <>
                          <div className="text-3xl mb-2">❌</div>
                          <p className="text-sm text-red-300 font-medium mb-1">Connection Lost</p>
                          <p className="text-xs text-muted-foreground mb-3">All reconnection attempts failed</p>
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={onRetryConnection}
                              className="px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                            >
                              🔄 Retry
                            </button>
                            <button
                              onClick={onStopAndSave}
                              className="px-3 py-1.5 text-xs rounded-md bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                            >
                              💾 Stop & Save
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400 mx-auto mb-2"></div>
                          <p className="text-sm text-yellow-300 font-medium">Reconnecting...</p>
                          {reconnectAttempt > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">Attempt {reconnectAttempt}/10</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {/* Feature #33: Stale frame warning overlay */}
                {recordingConnected && staleFrameWarning !== 'none' && recordingFrame && (
                  <div className="absolute bottom-2 left-2 right-2 z-10">
                    <div className={`rounded-md px-3 py-1.5 text-xs text-center ${
                      staleFrameWarning === 'unresponsive'
                        ? 'bg-red-900/80 text-red-200'
                        : 'bg-yellow-900/80 text-yellow-200'
                    }`}>
                      {staleFrameWarning === 'unresponsive'
                        ? '⚠️ Browser may be unresponsive — try clicking or navigating'
                        : '⏳ Waiting for frame...'}
                    </div>
                  </div>
                )}
                {/* Feature #34: Coordinate debug overlay */}
                {showDebugOverlay && recordingFrame && (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {/* Grid lines */}
                    <svg className="absolute inset-0 w-full h-full opacity-20">
                      {[...Array(8)].map((_, i) => (
                        <line key={`v${i}`} x1={`${(i + 1) * 12.5}%`} y1="0" x2={`${(i + 1) * 12.5}%`} y2="100%" stroke="cyan" strokeWidth="0.5" />
                      ))}
                      {[...Array(4)].map((_, i) => (
                        <line key={`h${i}`} x1="0" y1={`${(i + 1) * 20}%`} x2="100%" y2={`${(i + 1) * 20}%`} stroke="cyan" strokeWidth="0.5" />
                      ))}
                    </svg>
                    {/* Crosshair and coordinate readout */}
                    {debugCoords && (
                      <>
                        <div className="absolute bg-cyan-400" style={{ left: debugCoords.cssX, top: 0, width: 1, height: '100%', opacity: 0.5 }} />
                        <div className="absolute bg-cyan-400" style={{ left: 0, top: debugCoords.cssY, width: '100%', height: 1, opacity: 0.5 }} />
                        <div className="absolute rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-cyan-300 font-mono whitespace-nowrap"
                          style={{ left: Math.min(debugCoords.cssX + 10, (browserViewRef.current?.clientWidth || 300) - 120), top: Math.min(debugCoords.cssY + 10, (browserViewRef.current?.clientHeight || 200) - 30) }}>
                          VP: {debugCoords.vpX},{debugCoords.vpY} | CSS: {Math.round(debugCoords.cssX)},{Math.round(debugCoords.cssY)}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Action Log + Controls */}
            <div className="w-72 flex flex-col shrink-0">
              {/* Action Log */}
              <div className="flex-1 min-h-0 flex flex-col">
                <h4 className="text-sm font-semibold text-foreground mb-2">Action Log</h4>
                <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-muted/20 divide-y divide-border" style={{ maxHeight: '340px' }}>
                  {recordedSteps.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Waiting for actions...</p>
                      <p className="text-xs text-muted-foreground mt-1">Click on the browser view</p>
                    </div>
                  ) : (
                    recordedSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/40 transition-colors group">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-background border border-border text-xs shrink-0">
                          {getActionIcon(step.action)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">{step.action}</span>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {step.url && step.url}
                            {step.selector && step.selector}
                            {step.value && `"${step.value}"`}
                            {step.text && `"${step.text}"`}
                          </div>
                        </div>
                        <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">#{idx + 1}</span>
                        <button
                          onClick={() => onRecordedStepsChange(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0"
                          title="Remove step"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Manual Step Buttons */}
              <div className="mt-3">
                <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Add Manual Step</h4>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => {
                      const text = prompt('Enter text to assert is visible:');
                      if (text) handleAddRecordingStep('assert_text', { text });
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700 hover:bg-green-100 transition-colors"
                  >
                    ✅ Assert
                  </button>
                  <button
                    onClick={() => handleAddRecordingStep('screenshot', {})}
                    className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-medium text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    📸 Screenshot
                  </button>
                  <button
                    onClick={() => {
                      const ms = prompt('Enter wait time in milliseconds:', '1000');
                      if (ms) handleAddRecordingStep('wait', { value: ms });
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    ⏱️ Wait
                  </button>
                  <button
                    onClick={() => {
                      const url = prompt('Enter expected URL pattern:', window.location.href);
                      if (url) handleAddRecordingStep('assert_url', { value: url });
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    🔗 Assert URL
                  </button>
                  <button
                    onClick={() => {
                      handleAddRecordingStep('hover', { selector: 'body', value: 'Hover over element' });
                      toast.info('Hover step added. Edit the selector in the review modal.');
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-medium text-orange-700 hover:bg-orange-100 transition-colors"
                  >
                    👆 Hover
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-3 mt-3 border-t border-border">
                <button
                  onClick={onCancelRecording}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onStopRecording}
                  className="rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg flex items-center gap-1.5"
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-card"></span>
                  Stop Recording
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecordTestModal;
