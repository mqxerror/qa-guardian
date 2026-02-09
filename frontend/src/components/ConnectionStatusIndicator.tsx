/**
 * Connection Status Indicator Component
 * Feature #167: WebSocket connection health monitoring
 *
 * Displays a visual indicator showing the current WebSocket connection status:
 * - Green dot: Connected (healthy)
 * - Yellow dot: Connecting or reconnecting
 * - Red dot: Disconnected
 *
 * Also shows tooltip with connection details on hover.
 */

import { useState, useRef, useEffect } from 'react';
import { useSocketStore, ConnectionStatus } from '../stores/socketStore';

interface ConnectionStatusIndicatorProps {
  /** Whether the sidebar is collapsed */
  collapsed?: boolean;
  /** Show detailed connection info (expanded view) */
  showDetails?: boolean;
}

/**
 * Get human-readable status text
 */
function getStatusText(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting...';
    case 'disconnected':
      return 'Disconnected';
    case 'reconnecting':
      return 'Reconnecting...';
    default:
      return 'Unknown';
  }
}

/**
 * Get status indicator color classes
 */
function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'bg-success';
    case 'connecting':
    case 'reconnecting':
      return 'bg-warning animate-pulse';
    case 'disconnected':
      return 'bg-destructive';
    default:
      return 'bg-muted-foreground';
  }
}

/**
 * Format milliseconds as human-readable time
 */
function formatTimeAgo(ms: number | null): string {
  if (ms === null) return 'Never';
  if (ms < 1000) return 'Just now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
}

export function ConnectionStatusIndicator({
  collapsed = false,
  showDetails = false,
}: ConnectionStatusIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const {
    connectionStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isConnected, // Reserved for future connection status display
    reconnectAttempt,
    getConnectionHealth,
    reconnectionEvents,
  } = useSocketStore();

  // Get health info
  const health = getConnectionHealth();

  // Close tooltip when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    }
    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTooltip]);

  // Compact indicator (for sidebar)
  if (collapsed && !showDetails) {
    return (
      <div
        className="relative flex items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        ref={tooltipRef}
      >
        <div
          className={`h-2.5 w-2.5 rounded-full ${getStatusColor(connectionStatus)}`}
          title={getStatusText(connectionStatus)}
          role="status"
          aria-label={`WebSocket connection: ${getStatusText(connectionStatus)}`}
        />

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-full ml-2 z-50 w-48 rounded-md border border-border bg-card p-3 shadow-lg">
            <div className="text-xs font-medium text-foreground mb-1">
              WebSocket Status
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${getStatusColor(connectionStatus)}`} />
              <span>{getStatusText(connectionStatus)}</span>
            </div>
            {health.lastHeartbeatAgo !== null && (
              <div className="mt-1 text-xs text-muted-foreground">
                Last heartbeat: {formatTimeAgo(health.lastHeartbeatAgo)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Expanded indicator with more details
  return (
    <div
      className="relative"
      ref={tooltipRef}
    >
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label={`WebSocket connection: ${getStatusText(connectionStatus)}`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${getStatusColor(connectionStatus)}`}
          role="status"
        />
        <span className="truncate">{getStatusText(connectionStatus)}</span>
        {reconnectAttempt > 0 && connectionStatus === 'reconnecting' && (
          <span className="text-[10px] text-muted-foreground">
            (#{reconnectAttempt})
          </span>
        )}
      </button>

      {/* Detailed tooltip */}
      {showTooltip && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-64 rounded-md border border-border bg-card p-3 shadow-lg">
          <div className="text-xs font-medium text-foreground mb-2">
            WebSocket Connection
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-xs mb-2">
            <span className={`h-2.5 w-2.5 rounded-full ${getStatusColor(connectionStatus)}`} />
            <span className="text-foreground font-medium">{getStatusText(connectionStatus)}</span>
          </div>

          {/* Health info */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Healthy:</span>
              <span className={health.healthy ? 'text-success' : 'text-destructive'}>
                {health.healthy ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last heartbeat:</span>
              <span>{formatTimeAgo(health.lastHeartbeatAgo)}</span>
            </div>
            {reconnectAttempt > 0 && (
              <div className="flex justify-between">
                <span>Reconnect attempts:</span>
                <span>{reconnectAttempt}</span>
              </div>
            )}
          </div>

          {/* Recent reconnection events */}
          {reconnectionEvents.length > 0 && (
            <div className="mt-3 pt-2 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Recent Events
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {reconnectionEvents.slice(0, 3).map((event, index) => (
                  <div key={index} className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className={event.success ? 'text-success' : 'text-warning'}>
                      {event.success ? '✓' : '↻'}
                    </span>
                    <span>{event.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConnectionStatusIndicator;
