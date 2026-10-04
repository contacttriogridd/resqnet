import type { ApiErrorBody } from '@resqnet/shared';
import { API_BASE_URL, FROM_CACHE_HEADER } from '../config';
import { getDeviceId } from '../database/db';
import { isSimulatedOffline, reportRequestFailure, reportRequestSuccess } from '../offline/network';
import { clearSession, getAccessToken, refreshSession, sessionStore } from './session';

/**
 * Error with a message that is always safe and understandable to show to
 * users. Technical details stay in `code`/`status` for logic, never in the UI.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly isNetworkError = false,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const NETWORK_MESSAGE = "We couldn't connect to the server. Check your connection and try again.";
const SERVER_MESSAGE = 'The server is having a problem. Please try again in a moment.';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Abort after this many ms (slow networks are common in disasters). */
  timeoutMs?: number;
  /** If the session cannot be refreshed, retry the request without credentials. */
  anonymousFallback?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getAccessToken() ?? (await tokenAfterRefresh());
  const res = await send(path, opts, token);
  if (res.status === 401 && token) {
    // Token rejected (expired/revoked): refresh once and retry.
    const body = await safeJson(res);
    if (body?.error?.code === 'TOKEN_EXPIRED' || body?.error?.code === 'INVALID_TOKEN') {
      const ok = await refreshSession();
      if (ok) return handle<T>(await send(path, opts, getAccessToken()));
      if (opts.anonymousFallback) return handle<T>(await send(path, opts, null));
      await clearSession();
    }
    throw toApiError(res.status, body);
  }
  return handle<T>(res);
}

/** If a profile is cached but the in-memory token expired, refresh before calling. */
async function tokenAfterRefresh(): Promise<string | null> {
  if (!sessionStore.get().user) return null;
  const ok = await refreshSession();
  return ok ? getAccessToken() : null;
}

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  if (isSimulatedOffline()) {
    throw new ApiError(NETWORK_MESSAGE, 0, 'OFFLINE', true);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  opts.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Device-Id': await getDeviceId(),
    'X-Requested-With': 'resqnet',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const started = performance.now();
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      signal: controller.signal,
    });
    // A cached answer from the service worker proves nothing about connectivity.
    if (res.headers.get(FROM_CACHE_HEADER)) reportRequestFailure();
    else reportRequestSuccess(Math.round(performance.now() - started));
    return res;
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    reportRequestFailure();
    throw new ApiError(NETWORK_MESSAGE, 0, 'NETWORK_ERROR', true);
  } finally {
    clearTimeout(timeout);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await safeJson(res);
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

async function safeJson(res: Response): Promise<(ApiErrorBody & Record<string, unknown>) | null> {
  try {
    return (await res.clone().json()) as ApiErrorBody & Record<string, unknown>;
  } catch {
    return null;
  }
}

function toApiError(status: number, body: ApiErrorBody | null): ApiError {
  if (status >= 500 || !body?.error) {
    return new ApiError(SERVER_MESSAGE, status, body?.error?.code ?? 'SERVER_ERROR');
  }
  return new ApiError(body.error.message, status, body.error.code, false, body.error.details);
}

/** Friendly message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}
