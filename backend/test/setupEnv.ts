/**
 * Runs before any test module is imported, so `config/env.ts` sees the test
 * database. Tests must NEVER run against the development database because
 * they truncate every table.
 */
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be set to run the backend tests.');
}
if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL — tests wipe the database.');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.DEMO_MODE_ENABLED = 'true';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-test-refresh-secret-0123456789';
