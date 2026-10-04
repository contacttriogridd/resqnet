import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorBody } from '@resqnet/shared';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/** 404 for unknown API routes. */
export function notFoundHandler(_req: Request, res: Response) {
  const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'This page or resource does not exist.' } };
  res.status(404).json(body);
}

/**
 * Converts every error into a safe JSON response. Internal details (stack
 * traces, SQL, Prisma messages) are logged server-side but never returned.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' },
  };

  if (err instanceof AppError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } };
  } else if (isBodyParserError(err)) {
    status = err.status;
    body = {
      error: {
        code: err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        message: err.type === 'entity.too.large' ? 'The request is too large.' : 'The request could not be read.',
      },
    };
  } else if (isPrismaNotFound(err)) {
    status = 404;
    body = { error: { code: 'NOT_FOUND', message: 'Item was not found.' } };
  }

  if (status >= 500) {
    (req.log ?? logger).error({ err }, 'Unhandled error');
  } else {
    (req.log ?? logger).debug({ code: body.error.code, status }, 'Request rejected');
  }

  if (res.headersSent) return;
  res.status(status).json(body);
}

function isBodyParserError(err: unknown): err is { status: number; type: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { type?: unknown }).type === 'string' &&
    typeof (err as { status?: unknown }).status === 'number' &&
    (err as { status: number }).status < 500
  );
}

function isPrismaNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2025';
}
