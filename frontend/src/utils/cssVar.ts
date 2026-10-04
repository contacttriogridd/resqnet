/** Reads a design token (CSS custom property) for non-CSS consumers like map markers. */
export function cssVar(name: string, fallback = '#1849a9'): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
