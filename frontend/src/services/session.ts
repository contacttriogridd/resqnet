import type { AuthResponse, PublicUser } from '@resqnet/shared';
import { API_BASE_URL } from '../config';
import { META, deleteMeta, getMeta, setMeta } from '../database/db';
import { isSimulatedOffline } from '../offline/network';
import { createStore } from '../utils/store';

/**
 * Authentication session.
 *
 *  • The access token lives ONLY in memory (never localStorage/IndexedDB), so
 *    an XSS bug cannot exfiltrate a long-lived credential from storage.
 *  • The refresh token is an HttpOnly, SameSite=Strict cookie scoped to
 *    /api/auth — JavaScript can't read it.
 *  • The non-sensitive profile is cached in IndexedDB so the app still knows
 *    who you are (and shows your role's screens) while offline.
 */
export interface SessionState {
  user: PublicUser | null;
  accessToken: string | null;
  expiresAt: number | null;
  restored: boolean;
}

export const sessionStore = createStore<SessionState>({
  user: null,
  accessToken: null,
  expiresAt: null,
  restored: false,
});

export function setSession(auth: AuthResponse) {
  sessionStore.set({
    user: auth.user,
    accessToken: auth.accessToken,
    expiresAt: Date.now() + auth.expiresIn * 1000,
    restored: true,
  });
  void setMeta(META.user, auth.user);
}

export async function clearSession() {
  sessionStore.set({ user: null, accessToken: null, expiresAt: null, restored: true });
  await deleteMeta(META.user);
}

/** Valid (non-expired, with 30 s skew) access token, or null. */
export function getAccessToken(): string | null {
  const s = sessionStore.get();
  if (!s.accessToken || !s.expiresAt || s.expiresAt - 30_000 < Date.now()) return null;
  return s.accessToken;
}

let refreshing: Promise<boolean> | null = null;

/**
 * Single-flight silent refresh. Returns true on success. A network failure
 * keeps the cached profile (the user stays "signed in" offline); only an
 * explicit 401 from the server signs the user out.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    if (isSimulatedOffline()) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'resqnet', Accept: 'application/json' },
      });
      if (res.ok) {
        setSession((await res.json()) as AuthResponse);
        return true;
      }
      if (res.status === 401 || res.status === 403) await clearSession();
      return false;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** On startup: show the cached profile immediately, then try to refresh. */
export async function restoreSession() {
  const user = (await getMeta<PublicUser>(META.user)) ?? null;
  sessionStore.set((s) => ({ ...s, user, restored: true }));
  if (user) void refreshSession();
}
