import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { db } from '../database/db';
import { __resetNetworkForTests } from '../offline/network';

beforeEach(async () => {
  __resetNetworkForTests();
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => {
  __resetNetworkForTests();
});
