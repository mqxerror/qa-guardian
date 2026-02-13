/**
 * Standardized API Error Response Utility
 * Feature #722: Standardize API error response format
 *
 * All API error responses MUST use this helper to ensure a single, consistent
 * error shape across every route:
 *
 *   { error: { code: string, message: string, details?: Record<string, unknown> } }
 *
 * Usage:
 *   import { sendError } from '../utils/errors.js';
 *   return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
 *   return sendError(reply, 400, 'VALIDATION_ERROR', 'Invalid input', { field: 'email' });
 */

import { FastifyReply } from 'fastify';

/**
 * The standardized error response envelope.
 * Every error response from the API conforms to this shape.
 */
export interface StandardErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Sends a standardized error response.
 *
 * @param reply - Fastify reply object
 * @param statusCode - HTTP status code (e.g. 400, 401, 403, 404, 500)
 * @param code - Machine-readable error code (e.g. 'NOT_FOUND', 'UNAUTHORIZED')
 * @param message - Human-readable error message
 * @param details - Optional additional context for the error
 * @returns The reply object (for chaining or returning from route handlers)
 */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): FastifyReply {
  const body: StandardErrorResponse = {
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    body.error.details = details;
  }

  return reply.status(statusCode).send(body);
}
