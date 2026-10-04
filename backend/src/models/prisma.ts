import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env.js';

/**
 * Single PrismaClient per process. All queries are parameterised by Prisma,
 * which is the primary defence against SQL injection; raw SQL in this codebase
 * only ever uses tagged-template `$queryRaw` (also parameterised).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
  });

if (!isProduction) globalForPrisma.prisma = prisma;

export type { Prisma } from '@prisma/client';
