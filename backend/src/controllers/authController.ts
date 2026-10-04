import type { CookieOptions, Request, Response } from 'express';
import type { AuthResponse, LoginInput } from '@resqnet/shared';
import { isProduction } from '../config/env.js';
import * as authService from '../services/authService.js';
import { clientContext } from '../utils/request.js';

export const REFRESH_COOKIE = 'resqnet_rt';

function cookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/auth',
    ...(expires ? { expires } : {}),
  };
}

function sendSession(res: Response, status: number, session: authService.SessionResult) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions(session.refreshExpiresAt));
  const body: AuthResponse = { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  res.status(status).json(body);
}

export async function register(req: Request, res: Response) {
  const session = await authService.register(req.validated.body as never, clientContext(req));
  sendSession(res, 201, session);
}

export async function login(req: Request, res: Response) {
  const session = await authService.login(req.validated.body as LoginInput, clientContext(req));
  sendSession(res, 200, session);
}

export async function refresh(req: Request, res: Response) {
  try {
    const session = await authService.refresh(req.cookies?.[REFRESH_COOKIE], clientContext(req));
    sendSession(res, 200, session);
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json({ user: await authService.getCurrentUser(req.auth!.userId) });
}
