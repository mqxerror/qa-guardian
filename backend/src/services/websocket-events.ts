/**
 * WebSocket Event Emitter Service
 * Feature #108: Emit CRUD events for real-time cache invalidation
 *
 * This service provides a centralized way to emit WebSocket events
 * for project, suite, and test CRUD operations. Events are emitted
 * to the organization room so all clients in that org receive updates.
 */

import { Server as SocketIOServer } from 'socket.io';

// Socket.IO server instance (set by index.ts after server starts)
let io: SocketIOServer | null = null;

/**
 * Set the Socket.IO server instance
 * Called from index.ts after the server starts
 */
export function setWebSocketIO(socketIO: SocketIOServer) {
  io = socketIO;
}

/**
 * Get the Socket.IO server instance
 */
export function getWebSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Emit an event to an organization room
 */
function emitToOrg(orgId: string, event: string, payload: Record<string, unknown>) {
  if (io) {
    io.to(`org:${orgId}`).emit(event, { orgId, ...payload });
    console.log(`[Socket.IO] Emitted ${event} to org:${orgId}`);
  }
}

// ========== Project Events ==========

/**
 * Emit project-created event
 */
export function emitProjectCreated(orgId: string, projectId: string) {
  emitToOrg(orgId, 'project-created', { projectId });
}

/**
 * Emit project-updated event
 */
export function emitProjectUpdated(orgId: string, projectId: string) {
  emitToOrg(orgId, 'project-updated', { projectId });
}

/**
 * Emit project-deleted event
 */
export function emitProjectDeleted(orgId: string, projectId: string) {
  emitToOrg(orgId, 'project-deleted', { projectId });
}

// ========== Suite Events ==========

/**
 * Emit suite-created event
 */
export function emitSuiteCreated(orgId: string, suiteId: string, projectId?: string) {
  emitToOrg(orgId, 'suite-created', { suiteId, projectId });
}

/**
 * Emit suite-updated event
 */
export function emitSuiteUpdated(orgId: string, suiteId: string, projectId?: string) {
  emitToOrg(orgId, 'suite-updated', { suiteId, projectId });
}

/**
 * Emit suite-deleted event
 */
export function emitSuiteDeleted(orgId: string, suiteId: string, projectId?: string) {
  emitToOrg(orgId, 'suite-deleted', { suiteId, projectId });
}

// ========== Test Events ==========

/**
 * Emit test-created event
 */
export function emitTestCreated(orgId: string, testId: string, suiteId?: string) {
  emitToOrg(orgId, 'test-created', { testId, suiteId });
}

/**
 * Emit test-updated event
 */
export function emitTestUpdated(orgId: string, testId: string, suiteId?: string) {
  emitToOrg(orgId, 'test-updated', { testId, suiteId });
}

/**
 * Emit test-deleted event
 */
export function emitTestDeleted(orgId: string, testId: string, suiteId?: string) {
  emitToOrg(orgId, 'test-deleted', { testId, suiteId });
}

// ========== Run Events ==========

/**
 * Emit run-progress event for live status updates
 */
export function emitRunProgress(orgId: string, runId: string, progress: number) {
  if (io) {
    const payload = { orgId, runId, progress };
    // Emit to run-specific room
    io.to(`run:${runId}`).emit('run-progress', payload);
    // Also emit to organization room
    io.to(`org:${orgId}`).emit('run-progress', payload);
    // Don't log progress events (too noisy)
  }
}
