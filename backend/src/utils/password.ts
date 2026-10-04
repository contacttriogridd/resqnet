import argon2 from 'argon2';

/**
 * Argon2id with OWASP-recommended minimums (m=19 MiB, t=2, p=1).
 * The hash string embeds its parameters, so they can be raised later and
 * old hashes upgraded transparently on next login via `needsRehash`.
 */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, OPTIONS);
}

/**
 * A real hash used to equalise timing when the email doesn't exist, so login
 * response time does not reveal which accounts are registered.
 */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= argon2.hash('resqnet-timing-equaliser', OPTIONS);
  return dummyHash;
}
