/** Public runtime configuration. Never put secrets here — this ships to browsers. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api';
export const DEFAULT_REGION = (import.meta.env.VITE_DEFAULT_REGION as string | undefined) || 'Coimbatore';

/** Primary national emergency number, used in fallback messages. */
export const EMERGENCY_NUMBER = '112';

/** Data older than this is flagged as possibly outdated in the UI. */
export const STALE_AFTER_MS = 30 * 60_000;
