/**
 * RecordStep Component
 * Feature #592: Recording wizard method — record and replay user actions
 *
 * Provides a recording interface in the CustomTestWizard flow:
 * - URL input with project base URL default
 * - Device emulation toggle
 * - Start/Stop Recording buttons
 * - Live action display during recording
 * - Converts recorded actions to test steps
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Video, Circle, Square, Monitor, Smartphone, Tablet, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { DeviceSelect } from './shared/DeviceSelect';
import { DeviceConfig } from '../test-modals/types';

/**
 * Recording step data
 */
export interface RecordingStep {
  action: string;
  selector?: string;
  value?: string;
  text?: string;
  url?: string;
  timestamp?: number;
}

/**
 * Record step configuration for review
 */
export interface RecordConfig {
  method: 'record';
  testType: 'e2e';
  name: string;
  description: string;
  targetUrl: string;
  steps: RecordingStep[];
  deviceConfig?: DeviceConfig;
}

/**
 * Props for RecordStep
 */
export interface RecordStepProps {
  /** Called when recording is complete and user advances */
  onContinue: (config: RecordConfig) => void;
  /** Called when form state changes */
  onChange?: (config: RecordConfig | null, isValid: boolean) => void;
  /** Project base URL for smart defaults */
  projectBaseUrl?: string;
}

/**
 * Format elapsed time as MM:SS
 */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Get icon for action type
 */
function getActionIcon(action: string): string {
  switch (action) {
    case 'click': return '👆';
    case 'type':
    case 'fill': return '⌨️';
    case 'navigate':
    case 'goto': return '🌐';
    case 'scroll': return '📜';
    case 'hover': return '👉';
    case 'assert_text': return '✅';
    case 'assert_url': return '🔗';
    case 'screenshot': return '📸';
    case 'wait': return '⏱️';
    case 'select': return '📋';
    case 'check':
    case 'uncheck': return '☑️';
    default: return '•';
  }
}

/**
 * RecordStep component
 */
export const RecordStep: React.FC<RecordStepProps> = ({
  onChange,
  projectBaseUrl,
}) => {
  // Get token from auth store instead of props
  const { token } = useAuthStore();

  // Form state
  const [targetUrl, setTargetUrl] = useState(projectBaseUrl || '');
  const [testName, setTestName] = useState('');
  const [testDescription, setTestDescription] = useState('');
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [deviceConfig, setDeviceConfig] = useState<DeviceConfig>({ preset: 'desktop-1280' });

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [recordedSteps, setRecordedSteps] = useState<RecordingStep[]>([]);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingConnected, setRecordingConnected] = useState(false);
  const [recordingFrame, setRecordingFrame] = useState<string | null>(null);
  const [recordingCurrentUrl, setRecordingCurrentUrl] = useState('');
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Click ripple
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(null);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const browserViewRef = useRef<HTMLDivElement | null>(null);
  const frameScaleRef = useRef<{ scaleX: number; scaleY: number }>({ scaleX: 1280, scaleY: 720 });

  // Recording timer effect
  useEffect(() => {
    if (!isRecording || !recordingStartTime) return;
    const timer = setInterval(() => {
      setRecordingElapsed(Math.floor((Date.now() - recordingStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecording, recordingStartTime]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Notify parent of changes
  useEffect(() => {
    const isValid = recordedSteps.length > 0 && testName.trim().length > 0 && targetUrl.trim().length > 0;
    onChange?.(
      isValid
        ? {
            method: 'record',
            testType: 'e2e',
            name: testName,
            description: testDescription,
            targetUrl,
            steps: recordedSteps,
            deviceConfig: deviceEnabled ? deviceConfig : undefined,
          }
        : null,
      isValid
    );
  }, [recordedSteps, testName, testDescription, targetUrl, deviceEnabled, deviceConfig, onChange]);

  // Start recording
  const handleStartRecording = useCallback(async () => {
    if (!targetUrl.trim()) {
      setRecordingError('Please enter a target URL');
      return;
    }

    setIsStarting(true);
    setRecordingError(null);

    try {
      // Create recording session
      const response = await fetch(`/api/v1/recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: targetUrl,
          device: deviceEnabled ? deviceConfig : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start recording');
      }

      const data = await response.json();
      const sessionId = data.sessionId;
      setRecordingSessionId(sessionId);

      // Connect to socket for live updates (uses current origin via Traefik)
      const socket = io({
        auth: { token },
        transports: ['websocket'],
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setRecordingConnected(true);
        socket.emit('recording:join', { sessionId });
      });

      socket.on('disconnect', () => {
        setRecordingConnected(false);
      });

      socket.on('recording:frame', (data: { frame: string; width: number; height: number }) => {
        setRecordingFrame(`data:image/jpeg;base64,${data.frame}`);
        frameScaleRef.current = { scaleX: data.width, scaleY: data.height };
      });

      socket.on('recording:url', (data: { url: string }) => {
        setRecordingCurrentUrl(data.url);
      });

      socket.on('recording:action', (step: RecordingStep) => {
        setRecordedSteps((prev) => [...prev, { ...step, timestamp: Date.now() }]);
      });

      socket.on('recording:error', (data: { message: string }) => {
        setRecordingError(data.message);
      });

      setIsRecording(true);
      setRecordingStartTime(Date.now());
      setRecordingElapsed(0);
      setRecordedSteps([]);

      // Auto-generate test name from URL if empty
      if (!testName) {
        try {
          const url = new URL(targetUrl);
          setTestName(`Recording - ${url.hostname}${url.pathname}`);
        } catch {
          setTestName(`Recording - ${new Date().toLocaleString()}`);
        }
      }
    } catch (err) {
      setRecordingError(err instanceof Error ? err.message : 'Failed to start recording');
    } finally {
      setIsStarting(false);
    }
  }, [targetUrl, deviceEnabled, deviceConfig, token, testName]);

  // Stop recording
  const handleStopRecording = useCallback(async () => {
    if (!recordingSessionId) return;

    try {
      await fetch(`/api/v1/recording/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: recordingSessionId }),
      });
    } catch (err) {
      console.error('Error stopping recording:', err);
    }

    // Cleanup
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsRecording(false);
    setRecordingSessionId(null);
    setRecordingFrame(null);
    setRecordingConnected(false);
  }, [recordingSessionId, token]);

  // Handle browser view click
  const handleBrowserViewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!browserViewRef.current || !socketRef.current || !recordingSessionId) return;

      const rect = browserViewRef.current.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;

      // Calculate viewport coordinates
      const vpX = Math.round((cssX / rect.width) * frameScaleRef.current.scaleX);
      const vpY = Math.round((cssY / rect.height) * frameScaleRef.current.scaleY);

      // Show click ripple
      const rippleId = Date.now();
      setClickRipple({ x: cssX, y: cssY, id: rippleId });
      setTimeout(() => setClickRipple(null), 500);

      // Send click to recording session
      socketRef.current.emit('recording:click', {
        sessionId: recordingSessionId,
        x: vpX,
        y: vpY,
      });
    },
    [recordingSessionId]
  );

  // Handle keyboard events
  const handleBrowserViewKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!socketRef.current || !recordingSessionId) return;

      socketRef.current.emit('recording:keypress', {
        sessionId: recordingSessionId,
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });

      if (e.key === 'Tab' || e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
      }
    },
    [recordingSessionId]
  );

  // Handle URL navigation in recording
  const handleUrlNavigate = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && recordingCurrentUrl && socketRef.current && recordingSessionId) {
        socketRef.current.emit('recording:navigate', {
          sessionId: recordingSessionId,
          url: recordingCurrentUrl,
        });
        setRecordedSteps((prev) => [...prev, { action: 'navigate', url: recordingCurrentUrl, timestamp: Date.now() }]);
      }
    },
    [recordingCurrentUrl, recordingSessionId]
  );

  // Remove a step
  const handleRemoveStep = useCallback((index: number) => {
    setRecordedSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Can continue if we have steps and a name
  const canContinue = recordedSteps.length > 0 && testName.trim().length > 0 && !isRecording;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Video className="w-5 h-5 text-method-record" />
          Record Your Test
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isRecording
            ? 'Click on the browser view to interact — actions are recorded automatically'
            : 'Enter a URL and start recording your interactions'}
        </p>
      </div>

      {/* Error message */}
      {recordingError && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-sm text-destructive">{recordingError}</span>
        </div>
      )}

      {/* Pre-recording configuration */}
      {!isRecording && (
        <div className="space-y-4">
          {/* Test name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Test Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g., User Login Flow"
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={testDescription}
              onChange={(e) => setTestDescription(e.target.value)}
              placeholder="Describe what this test verifies..."
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          {/* Target URL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Target URL <span className="text-destructive">*</span>
            </label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder={projectBaseUrl || 'https://example.com'}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Device emulation */}
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {deviceEnabled ? (
                  deviceConfig.preset?.includes('mobile') ? (
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                  ) : deviceConfig.preset?.includes('tablet') ? (
                    <Tablet className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Monitor className="w-4 h-4 text-muted-foreground" />
                  )
                ) : (
                  <Monitor className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">Device Emulation</span>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={deviceEnabled}
                  onChange={(e) => setDeviceEnabled(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="ml-2 text-sm text-muted-foreground">Enable</span>
              </label>
            </div>
            {deviceEnabled ? (
              <DeviceSelect value={deviceConfig} onChange={setDeviceConfig} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Enable to record on mobile/tablet with touch emulation and proper user agents.
              </p>
            )}
          </div>

          {/* Start recording button */}
          <button
            onClick={handleStartRecording}
            disabled={!targetUrl.trim() || isStarting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-method-record hover:bg-method-record/90 disabled:bg-muted text-method-record-foreground font-medium rounded-lg transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting Recording...
              </>
            ) : (
              <>
                <Circle className="w-5 h-5 fill-current" />
                Start Recording
              </>
            )}
          </button>

          {/* Previously recorded steps */}
          {recordedSteps.length > 0 && (
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  Recorded Steps ({recordedSteps.length})
                </h4>
                <button
                  onClick={() => setRecordedSteps([])}
                  className="text-xs text-destructive hover:underline"
                >
                  Clear All
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {recordedSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-md group"
                  >
                    <span className="text-base flex-shrink-0">{getActionIcon(step.action)}</span>
                    <span className="text-xs font-medium uppercase text-primary">{step.action}</span>
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {step.url || step.selector || step.value || step.text || ''}
                    </span>
                    <button
                      onClick={() => handleRemoveStep(idx)}
                      className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recording interface */}
      {isRecording && (
        <div className="space-y-4">
          {/* Recording status bar */}
          <div className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/80 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-destructive"></span>
              </span>
              <span className="font-semibold text-destructive">REC</span>
              <span className="font-mono text-lg font-bold text-destructive tabular-nums">
                {formatElapsed(recordingElapsed)}
              </span>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {recordedSteps.length} step{recordedSteps.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div
              className={`h-2 w-2 rounded-full ${
                recordingConnected ? 'bg-success' : 'bg-warning animate-pulse'
              }`}
              title={recordingConnected ? 'Connected' : 'Connecting...'}
            />
          </div>

          {/* Recording layout */}
          <div className="flex gap-4">
            {/* Live browser view */}
            <div className="flex-1 min-w-0">
              {/* URL bar */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 flex-1">
                  <span className="text-xs">🌐</span>
                  <input
                    type="text"
                    value={recordingCurrentUrl || targetUrl}
                    onChange={(e) => setRecordingCurrentUrl(e.target.value)}
                    onKeyDown={handleUrlNavigate}
                    className="text-xs bg-transparent border-none outline-none w-full text-foreground"
                    placeholder="Enter URL and press Enter to navigate..."
                  />
                </div>
              </div>

              {/* Browser view */}
              <div
                ref={browserViewRef}
                className="relative rounded-lg border-2 border-border overflow-hidden bg-background cursor-crosshair focus:outline-none focus:border-primary/40"
                style={{ aspectRatio: '16/9', maxHeight: '400px' }}
                tabIndex={0}
                onClick={handleBrowserViewClick}
                onKeyDown={handleBrowserViewKeyDown}
              >
                {recordingFrame ? (
                  <img
                    src={recordingFrame}
                    alt="Live browser view"
                    className="w-full h-full"
                    draggable={false}
                    style={{ pointerEvents: 'none', objectFit: 'fill' }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Connecting to browser...</p>
                      <p className="text-xs text-muted-foreground mt-1">Loading {targetUrl}</p>
                    </div>
                  </div>
                )}

                {/* Click ripple effect */}
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
                    <div className="w-full h-full rounded-full border-2 border-primary/40 animate-ping opacity-75" />
                  </div>
                )}
              </div>
            </div>

            {/* Action log */}
            <div className="w-64 flex flex-col">
              <h4 className="text-sm font-semibold text-foreground mb-2">Action Log</h4>
              <div
                className="flex-1 overflow-y-auto rounded-lg border border-border bg-muted/20 divide-y divide-border"
                style={{ maxHeight: '340px' }}
              >
                {recordedSteps.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Waiting for actions...</p>
                    <p className="text-xs text-muted-foreground mt-1">Click on the browser view</p>
                  </div>
                ) : (
                  recordedSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/40 transition-colors group"
                    >
                      <span className="text-base flex-shrink-0">{getActionIcon(step.action)}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                          {step.action}
                        </span>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {step.url || step.selector || step.value || step.text || ''}
                        </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground tabular-nums">#{idx + 1}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Stop button */}
              <button
                onClick={handleStopRecording}
                className="mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-destructive to-destructive hover:from-destructive/90 hover:to-destructive/90 text-destructive-foreground font-medium rounded-lg transition-all shadow-md"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop Recording
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Continue prompt */}
      {canContinue && (
        <div className="p-4 bg-success/5 border border-success/20 rounded-lg">
          <div className="flex items-center gap-2 text-success">
            <Check className="w-5 h-5" />
            <span className="font-medium">Recording complete! {recordedSteps.length} steps captured.</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Click "Continue" to review your test before creating it.
          </p>
        </div>
      )}
    </div>
  );
};

export default RecordStep;
