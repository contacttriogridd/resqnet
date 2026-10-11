/**
 * Vercel build step: apply migrations and the idempotent seed when a database
 * is connected, then build the PWA. The API is compiled during install (see
 * vercel.json) so the function bundler can trace backend/dist.
 */
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

if (process.env.DATABASE_URL) {
  run('npx prisma migrate deploy --schema prisma/schema.prisma');
  if (process.env.SEED_ADMIN_PASSWORD) run('npx tsx backend/src/database/seed.ts');
  else console.warn('SEED_ADMIN_PASSWORD is not set — skipping the seed.');
} else {
  console.warn('DATABASE_URL is not set — skipping migrations. The API needs a database to work.');
}

run('npm run build -w @resqnet/frontend');
