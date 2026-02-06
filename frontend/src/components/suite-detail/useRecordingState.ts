/**
 * useRecordingState Hook
 * Feature #50: Extract recording state and handlers from TestSuitePage.tsx
 * Feature #26: Live Browser View for recording
 * Feature #28: URL navigation and click ripple
 * Feature #31: Step Templates
 * Feature #33: Reconnection handling
 * Feature #34: Debug overlay
 * Feature #36: Device emulation
 * Feature #37: Optional step support
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from '../../stores/toastStore';
import { DeviceConfig } from '../test-modals/types';
import { RecordingStep } from './useSuiteState';

export interface RecordingState {
  // Modal state
  showRecordModal: boolean;
  showReviewModal: boolean;

  // Recording config
  recordTargetUrl: string;
  recordingDeviceEnabled: boolean;
  recordingDeviceConfig: DeviceConfig;

  // Recording session
  isRecording: boolean;
  recordingSessionId: string | null;
  recordedSteps: RecordingStep[];
  recordingStatus: string;
  recordingElapsed: number;
  recordingDuration: number;
  recordingStartTime: number | null;

  // Live browser view
  recordingFrame: string | null;
  recordingCurrentUrl: string;
  recordingConnected: boolean;

  // Click feedback
  clickRipple: { x: number; y: number; id: number } | null;

  // Reconnection
  reconnectAttempt: number;
  reconnectFailed: boolean;

  // Stale frame
  staleFrameWarning: 'none' | 'waiting' | 'unresponsive';

  // Debug
  showDebugOverlay: boolean;
  debugCoords: { cssX: number; cssY: number; vpX: number; vpY: number } | null;

  // Review modal state
  recordedTestName: string;
  recordedTestDescription: string;
  isSavingRecordedTest: boolean;

  // Template state
  templateName: string;
  isSavingTemplate: boolean;
}

export interface UseRecordingStateReturn extends RecordingState {
  // Setters
  setShowRecordModal: (show: boolean) => void;
  setShowReviewModal: (show: boolean) => void;
  setRecordTargetUrl: (url: string) => void;
  setRecordingDeviceEnabled: (enabled: boolean) => void;
  setRecordingDeviceConfig: (config: DeviceConfig) => void;
  setRecordedSteps: (steps: RecordingStep[] | ((prev: RecordingStep[]) => RecordingStep[])) => void;
  setRecordingCurrentUrl: (url: string) => void;
  setRecordedTestName: (name: string) => void;
  setRecordedTestDescription: (description: string) => void;
  setTemplateName: (name: string) => void;
  setShowDebugOverlay: (show: boolean) => void;
  setClickRipple: (ripple: { x: number; y: number; id: number } | null) => void;

  // Refs
  recordingSocketRef: React.MutableRefObject<Socket | null>;
  browserViewRef: React.MutableRefObject<HTMLDivElement | null>;
  browserImgRef: React.MutableRefObject<HTMLImageElement | null>;
  frameScaleRef: React.MutableRefObject<{ scaleX: number; scaleY: number }>;
  lastFrameTimeRef: React.MutableRefObject<number>;
  staleFrameTimerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  frameRequestRef: React.MutableRefObject<number | null>;
  pendingFrameRef: React.MutableRefObject<string | null>;

  // Handlers
  handleStartRecording: () => Promise<void>;
  handleStopRecording: () => Promise<void>;
  handleCancelRecording: () => void;
  handleSaveRecordedTest: () => Promise<void>;
  handleSaveAsTemplate: () => Promise<void>;
  handleRetryConnection: () => void;
  handleStopAndSave: () => void;
  handleBrowserViewClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBrowserViewKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  handleBrowserViewWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  handleBrowserViewMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBrowserViewMouseLeave: () => void;
  handleUrlBarNavigate: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleAddRecordingStep: (action: string, details: { selector?: string; value?: string; text?: string }) => void;

  // Utility
  formatElapsed: (seconds: number) => string;
  getActionIcon: (action: string) => string;
}

interface UseRecordingStateProps {
  suiteId: string | undefined;
  token: string | null;
  projectBaseUrl?: string;
  onTestCreated?: (testId: string) => void;
}

export function useRecordingState({
  suiteId,
  token,
  projectBaseUrl,
  onTestCreated,
}: UseRecordingStateProps): UseRecordingStateReturn {
  // Modal state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Recording config
  const [recordTargetUrl, setRecordTargetUrl] = useState('');
  const [recordingDeviceEnabled, setRecordingDeviceEnabled] = useState(false);
  const [recordingDeviceConfig, setRecordingDeviceConfig] = useState<DeviceConfig>({ preset: 'desktop-1280' });

  // Recording session
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [recordedSteps, setRecordedSteps] = useState<RecordingStep[]>([]);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Live browser view
  const [recordingFrame, setRecordingFrame] = useState<string | null>(null);
  const [recordingCurrentUrl, setRecordingCurrentUrl] = useState('');
  const [recordingConnected, setRecordingConnected] = useState(false);

  // Click feedback
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(null);

  // Reconnection
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [reconnectFailed, setReconnectFailed] = useState(false);

  // Stale frame
  const [staleFrameWarning, setStaleFrameWarning] = useState<'none' | 'waiting' | 'unresponsive'>('none');

  // Debug
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [debugCoords, setDebugCoords] = useState<{ cssX: number; cssY: number; vpX: number; vpY: number } | null>(null);

  // Review modal state
  const [recordedTestName, setRecordedTestName] = useState('');
  const [recordedTestDescription, setRecordedTestDescription] = useState('');
  const [isSavingRecordedTest, setIsSavingRecordedTest] = useState(false);

  // Template state
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Refs
  const recordingSocketRef = useRef<Socket | null>(null);
  const browserViewRef = useRef<HTMLDivElement | null>(null);
  const browserImgRef = useRef<HTMLImageElement | null>(null);
  const frameScaleRef = useRef<{ scaleX: number; scaleY: number }>({ scaleX: 1280, scaleY: 720 });
  const lastFrameTimeRef = useRef<number>(0);
  const staleFrameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRequestRef = useRef<number | null>(null);
  const pendingFrameRef = useRef<string | null>(null);

  // Recording timer effect
  useEffect(() => {
    if (!isRecording || !recordingStartTime) return;
    const timer = setInterval(() => {
      setRecordingElapsed(Math.floor((Date.now() - recordingStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecording, recordingStartTime]);

  // Format elapsed time
  const formatElapsed = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Get action icon
  const getActionIcon = useCallback((action: string): string => {
    switch (action) {
      case 'navigate': return '🌐';
      case 'click': return '👆';
      case 'fill': case 'type': return '⌨️';
      case 'select': return '📋';
      case 'check': case 'uncheck': return '☑️';
      case 'screenshot': return '📸';
      case 'assert_text': return '✅';
      case 'assert_url': return '🔗';
      case 'wait': return '⏱️';
      case 'hover': return '👆';
      case 'scroll': return '📜';
      default: return '🔹';
    }
  }, []);

  // Handle start recording
  const handleStartRecording = useCallback(async () => {
    if (!recordTargetUrl) {
      toast.error('Please enter a target URL');
      return;
    }

    try {
      new URL(recordTargetUrl);
    } catch {
      toast.error('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setIsRecording(true);
    setRecordingStatus('Starting recording session...');
    setRecordedSteps([]);
    setRecordingStartTime(Date.now());
    setRecordingElapsed(0);
    setRecordingFrame(null);

    try {
      const response = await fetch('/api/v1/recording/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_url: recordTargetUrl,
          suite_id: suiteId,
          device_config: recordingDeviceEnabled ? recordingDeviceConfig : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start recording');
      }

      const data = await response.json();
      setRecordingSessionId(data.session_id);
      setRecordingStatus('Recording... Click on the browser view to interact');
      setRecordingCurrentUrl(recordTargetUrl);
      setRecordedSteps([{ action: 'navigate', url: recordTargetUrl }]);

      // Connect Socket.IO
      const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `http://${window.location.hostname}:3001`
        : window.location.origin;

      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
      recordingSocketRef.current = socket;

      setReconnectAttempt(0);
      setReconnectFailed(false);
      setStaleFrameWarning('none');

      socket.on('connect', () => {
        setRecordingConnected(true);
        setReconnectAttempt(0);
        setReconnectFailed(false);
        setStaleFrameWarning('none');
        socket.emit('recording:join', { sessionId: data.session_id });
      });

      socket.on('disconnect', () => {
        setRecordingConnected(false);
      });

      // Socket.IO Manager reconnection events
      socket.io.on('reconnect_attempt', (attempt: number) => {
        setReconnectAttempt(attempt);
      });

      socket.io.on('reconnect', () => {
        setRecordingConnected(true);
        setReconnectAttempt(0);
        setReconnectFailed(false);
        socket.emit('recording:join', { sessionId: data.session_id });
      });

      socket.io.on('reconnect_failed', () => {
        setReconnectFailed(true);
      });

      // Handle frames
      socket.on('recording:frame', (frameData: { frame: string; url?: string; viewport?: { width: number; height: number } }) => {
        lastFrameTimeRef.current = Date.now();
        setStaleFrameWarning('none');

        if (frameData.url) {
          setRecordingCurrentUrl(frameData.url);
        }
        if (frameData.viewport) {
          frameScaleRef.current = { scaleX: frameData.viewport.width, scaleY: frameData.viewport.height };
        }

        pendingFrameRef.current = `data:image/jpeg;base64,${frameData.frame}`;
        if (!frameRequestRef.current) {
          frameRequestRef.current = requestAnimationFrame(() => {
            if (pendingFrameRef.current) {
              setRecordingFrame(pendingFrameRef.current);
              pendingFrameRef.current = null;
            }
            frameRequestRef.current = null;
          });
        }
      });

      socket.on('recording:action', (actionData: RecordingStep) => {
        setRecordedSteps(prev => [...prev, actionData]);
      });

      // Stale frame detection
      staleFrameTimerRef.current = setInterval(() => {
        const timeSinceLastFrame = Date.now() - lastFrameTimeRef.current;
        if (timeSinceLastFrame > 5000) {
          setStaleFrameWarning('unresponsive');
        } else if (timeSinceLastFrame > 2000) {
          setStaleFrameWarning('waiting');
        }
      }, 1000);

    } catch (err) {
      setIsRecording(false);
      setRecordingStatus('');
      toast.error(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [recordTargetUrl, recordingDeviceEnabled, recordingDeviceConfig, token, suiteId]);

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    if (staleFrameTimerRef.current) {
      clearInterval(staleFrameTimerRef.current);
      staleFrameTimerRef.current = null;
    }

    const duration = recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
    setRecordingDuration(duration);
    setIsRecording(false);
    setRecordingStatus('Recording stopped');

    if (recordingSocketRef.current) {
      recordingSocketRef.current.disconnect();
      recordingSocketRef.current = null;
    }

    if (recordingSessionId) {
      try {
        await fetch('/api/v1/recording/stop', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ session_id: recordingSessionId }),
        });
      } catch (err) {
        console.error('Failed to stop recording session:', err);
      }
    }

    setShowRecordModal(false);
    setShowReviewModal(true);
  }, [recordingStartTime, recordingSessionId, token]);

  // Handle cancel recording
  const handleCancelRecording = useCallback(() => {
    if (staleFrameTimerRef.current) {
      clearInterval(staleFrameTimerRef.current);
      staleFrameTimerRef.current = null;
    }

    setIsRecording(false);
    setShowRecordModal(false);
    setRecordingStatus('');
    setRecordedSteps([]);
    setRecordingFrame(null);
    setRecordingSessionId(null);
    setRecordingCurrentUrl('');
    setRecordingConnected(false);

    if (recordingSocketRef.current) {
      recordingSocketRef.current.disconnect();
      recordingSocketRef.current = null;
    }
  }, []);

  // Handle save recorded test
  const handleSaveRecordedTest = useCallback(async () => {
    if (recordedSteps.length === 0) {
      toast.error('No steps recorded');
      return;
    }

    if (!recordedTestName.trim()) {
      toast.error('Please enter a test name');
      return;
    }

    setIsSavingRecordedTest(true);

    try {
      const steps = recordedSteps.map((step, i) => ({
        order: i + 1,
        action: step.action,
        selector: step.selector,
        selector_strategies: step.selectorStrategies,
        value: step.value || step.url || step.text,
        optional: step.optional,
        optional_reason: step.optionalReason,
      }));

      const response = await fetch(`/api/v1/suites/${suiteId}/tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: recordedTestName.trim(),
          description: recordedTestDescription.trim() || `Recorded test with ${recordedSteps.length} steps`,
          test_type: 'e2e',
          steps,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save test');
      }

      const data = await response.json();
      toast.success(`Test "${recordedTestName}" created with ${recordedSteps.length} steps!`);

      setShowReviewModal(false);
      setRecordedSteps([]);
      setRecordedTestName('');
      setRecordedTestDescription('');
      setRecordTargetUrl('');

      if (onTestCreated && data.test?.id) {
        onTestCreated(data.test.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save test');
    } finally {
      setIsSavingRecordedTest(false);
    }
  }, [recordedSteps, recordedTestName, recordedTestDescription, suiteId, token, onTestCreated]);

  // Handle save as template
  const handleSaveAsTemplate = useCallback(async () => {
    if (!templateName.trim() || recordedSteps.length === 0) {
      toast.error('Please enter a template name');
      return;
    }

    setIsSavingTemplate(true);

    try {
      const response = await fetch(`/api/v1/suites/${suiteId}/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: templateName.trim(),
          description: `Recorded template with ${recordedSteps.length} steps`,
          steps: recordedSteps.map((step, i) => ({
            order: i + 1,
            action: step.action,
            selector: step.selector,
            value: step.value || step.url || step.text,
          })),
          tags: ['recorded'],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save template');
      }

      toast.success(`Template "${templateName}" saved!`);
      setTemplateName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  }, [templateName, recordedSteps, suiteId, token]);

  // Handle retry connection
  const handleRetryConnection = useCallback(() => {
    setReconnectAttempt(0);
    setReconnectFailed(false);
    if (recordingSocketRef.current) {
      recordingSocketRef.current.connect();
    }
  }, []);

  // Handle stop and save
  const handleStopAndSave = useCallback(async () => {
    await handleStopRecording();
  }, [handleStopRecording]);

  // Handle browser view click
  const handleBrowserViewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!browserViewRef.current || !recordingSocketRef.current || !recordingSessionId) return;

    const rect = browserViewRef.current.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const vpX = Math.round((cssX / rect.width) * frameScaleRef.current.scaleX);
    const vpY = Math.round((cssY / rect.height) * frameScaleRef.current.scaleY);

    const rippleId = Date.now();
    setClickRipple({ x: cssX, y: cssY, id: rippleId });
    setTimeout(() => setClickRipple(null), 500);

    recordingSocketRef.current.emit('recording:click', {
      sessionId: recordingSessionId,
      x: vpX,
      y: vpY,
    });
  }, [recordingSessionId]);

  // Handle browser view key down
  const handleBrowserViewKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!recordingSocketRef.current || !recordingSessionId) return;

    recordingSocketRef.current.emit('recording:keypress', {
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
  }, [recordingSessionId]);

  // Handle browser view wheel
  const handleBrowserViewWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!recordingSocketRef.current || !recordingSessionId) return;

    recordingSocketRef.current.emit('recording:scroll', {
      sessionId: recordingSessionId,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
  }, [recordingSessionId]);

  // Handle browser view mouse move
  const handleBrowserViewMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!showDebugOverlay || !browserViewRef.current) return;

    const rect = browserViewRef.current.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const vpX = Math.round((cssX / rect.width) * frameScaleRef.current.scaleX);
    const vpY = Math.round((cssY / rect.height) * frameScaleRef.current.scaleY);

    setDebugCoords({ cssX, cssY, vpX, vpY });
  }, [showDebugOverlay]);

  // Handle browser view mouse leave
  const handleBrowserViewMouseLeave = useCallback(() => {
    setDebugCoords(null);
  }, []);

  // Handle URL bar navigate
  const handleUrlBarNavigate = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && recordingCurrentUrl) {
      if (recordingSocketRef.current && recordingSessionId) {
        recordingSocketRef.current.emit('recording:navigate', {
          sessionId: recordingSessionId,
          url: recordingCurrentUrl,
        });
        setRecordedSteps(prev => [...prev, { action: 'navigate', url: recordingCurrentUrl }]);
      }
    }
  }, [recordingCurrentUrl, recordingSessionId]);

  // Handle add recording step
  const handleAddRecordingStep = useCallback((action: string, details: { selector?: string; value?: string; text?: string }) => {
    setRecordedSteps(prev => [...prev, { action, ...details }]);
  }, []);

  return {
    // State
    showRecordModal,
    showReviewModal,
    recordTargetUrl,
    recordingDeviceEnabled,
    recordingDeviceConfig,
    isRecording,
    recordingSessionId,
    recordedSteps,
    recordingStatus,
    recordingElapsed,
    recordingDuration,
    recordingStartTime,
    recordingFrame,
    recordingCurrentUrl,
    recordingConnected,
    clickRipple,
    reconnectAttempt,
    reconnectFailed,
    staleFrameWarning,
    showDebugOverlay,
    debugCoords,
    recordedTestName,
    recordedTestDescription,
    isSavingRecordedTest,
    templateName,
    isSavingTemplate,

    // Setters
    setShowRecordModal,
    setShowReviewModal,
    setRecordTargetUrl,
    setRecordingDeviceEnabled,
    setRecordingDeviceConfig,
    setRecordedSteps,
    setRecordingCurrentUrl,
    setRecordedTestName,
    setRecordedTestDescription,
    setTemplateName,
    setShowDebugOverlay,
    setClickRipple,

    // Refs
    recordingSocketRef,
    browserViewRef,
    browserImgRef,
    frameScaleRef,
    lastFrameTimeRef,
    staleFrameTimerRef,
    frameRequestRef,
    pendingFrameRef,

    // Handlers
    handleStartRecording,
    handleStopRecording,
    handleCancelRecording,
    handleSaveRecordedTest,
    handleSaveAsTemplate,
    handleRetryConnection,
    handleStopAndSave,
    handleBrowserViewClick,
    handleBrowserViewKeyDown,
    handleBrowserViewWheel,
    handleBrowserViewMouseMove,
    handleBrowserViewMouseLeave,
    handleUrlBarNavigate,
    handleAddRecordingStep,

    // Utility
    formatElapsed,
    getActionIcon,
  };
}
