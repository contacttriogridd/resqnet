import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Prepares the dedicated E2E database non-destructively: applies pending
 * migrations and runs the idempotent seed. Tests assert only on data they
 * create themselves (unique location text / reference codes), so leftovers
 * from earlier runs do not affect results.
 */
export default function globalSetup() {
  const backend = resolve(import.meta.dirname, '..', '..', 'backend');
  const env = { ...process.env, DATABASE_URL: process.env.TEST_E2E_DATABASE_URL! };
  execSync('npx prisma migrate deploy', { cwd: backend, env, stdio: 'pipe' });
  execSync('npx tsx src/database/seed.ts', { cwd: backend, env, stdio: 'pipe' });
}
