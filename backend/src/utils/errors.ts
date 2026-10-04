/**
 * Operational errors carry a stable machine `code` and a message that is SAFE
 * to show to end users. Anything else that is thrown is treated as an
 * internal error and replaced with a generic message by the error handler.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: AppError['details']) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const validationError = (details: AppError['details']) =>
  new AppError(422, 'VALIDATION_FAILED', 'Some information is missing or invalid.', details);
export const unauthorized = (message = 'Please sign in to continue.') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to do this.') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Item') => new AppError(404, 'NOT_FOUND', `${what} was not found.`);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

/** True for Prisma unique-constraint violations (P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}
