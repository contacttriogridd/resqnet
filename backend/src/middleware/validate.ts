import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { validationError } from '../utils/errors.js';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates and normalises request input. Parsed values are exposed on
 * `req.validated` — controllers never read raw `req.body` / `req.query`.
 * Unknown keys are stripped by the Zod object schemas.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.validated ??= {};
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return next(
          validationError(
            result.error.issues.map((i) => ({
              path: i.path.map(String).join('.') || part,
              message: i.message,
            })),
          ),
        );
      }
      req.validated[part] = result.data;
    }
    next();
  };
}
