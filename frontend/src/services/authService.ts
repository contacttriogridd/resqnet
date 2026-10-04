import type { AuthResponse, LoginInput, RegisterInput } from '@resqnet/shared';
import { API_BASE_URL } from '../config';
import { api } from './apiClient';
import { clearSession, setSession } from './session';

export async function login(input: LoginInput) {
  const res = await api<AuthResponse>('/auth/login', { method: 'POST', body: input });
  setSession(res);
  return res.user;
}

export async function register(input: RegisterInput) {
  const res = await api<AuthResponse>('/auth/register', { method: 'POST', body: input });
  setSession(res);
  return res.user;
}

/** Signs out locally even if the server can't be reached. */
export async function logout() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'resqnet' },
    });
  } catch {
    /* offline: the refresh cookie expires on its own */
  }
  await clearSession();
}
