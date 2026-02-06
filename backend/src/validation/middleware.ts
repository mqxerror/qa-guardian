/**
 * Zod Validation Middleware for Fastify
 * Feature #122: Runtime request validation
 *
 * Provides preHandler hooks that validate request body, params, and query
 * against Zod schemas and return 400 with detailed errors on failure.
 */

import { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { formatZodErrors } from './schemas';

/**
 * Create a validation preHandler for request body
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      reply.status(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(result.error.errors),
        issues: result.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      });
      return;
    }
    // Replace body with validated/transformed data
    (request.body as T) = result.data;
  };
}

/**
 * Create a validation preHandler for URL params
 */
export function validateParams<T>(
  schema: z.ZodSchema<T>
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      reply.status(400).send({
        error: 'Invalid request parameters',
        code: 'INVALID_PARAMS',
        details: formatZodErrors(result.error.errors),
        issues: result.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      });
      return;
    }
    // Replace params with validated/transformed data
    (request.params as T) = result.data;
  };
}

/**
 * Create a validation preHandler for query string
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      reply.status(400).send({
        error: 'Invalid query parameters',
        code: 'INVALID_QUERY',
        details: formatZodErrors(result.error.errors),
        issues: result.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      });
      return;
    }
    // Replace query with validated/transformed data
    (request.query as T) = result.data;
  };
}

/**
 * Combined validation for body, params, and query
 */
export interface ValidationSchemas<B = unknown, P = unknown, Q = unknown> {
  body?: z.ZodSchema<B>;
  params?: z.ZodSchema<P>;
  query?: z.ZodSchema<Q>;
}

/**
 * Create a combined validation preHandler
 */
export function validate<B = unknown, P = unknown, Q = unknown>(
  schemas: ValidationSchemas<B, P, Q>
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const errors: Array<{
      location: 'body' | 'params' | 'query';
      issues: z.ZodError['errors'];
    }> = [];

    // Validate body
    if (schemas.body) {
      const result = schemas.body.safeParse(request.body);
      if (!result.success) {
        errors.push({ location: 'body', issues: result.error.errors });
      } else {
        (request.body as B) = result.data;
      }
    }

    // Validate params
    if (schemas.params) {
      const result = schemas.params.safeParse(request.params);
      if (!result.success) {
        errors.push({ location: 'params', issues: result.error.errors });
      } else {
        (request.params as P) = result.data;
      }
    }

    // Validate query
    if (schemas.query) {
      const result = schemas.query.safeParse(request.query);
      if (!result.success) {
        errors.push({ location: 'query', issues: result.error.errors });
      } else {
        (request.query as Q) = result.data;
      }
    }

    // If any validation failed, return 400
    if (errors.length > 0) {
      reply.status(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: errors.map(e => ({
          location: e.location,
          issues: e.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        })),
      });
      return;
    }
  };
}

/**
 * Helper to create a typed request handler with validation
 * This is useful for IDE autocomplete and type safety
 */
export function createValidatedHandler<
  Body = unknown,
  Params = unknown,
  Query = unknown
>(
  schemas: ValidationSchemas<Body, Params, Query>
): {
  preHandler: preHandlerHookHandler;
  body: Body;
  params: Params;
  query: Query;
} {
  return {
    preHandler: validate(schemas),
    body: {} as Body,
    params: {} as Params,
    query: {} as Query,
  };
}
