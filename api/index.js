/**
 * Vercel Function entry: serves the Express API at /api/* on the same origin as
 * the PWA (vercel.json rewrites every /api/* request here; Express still sees
 * the original path). The backend is compiled to backend/dist during install.
 */

// Set before the backend's config loads; NODE_ENV=production cannot go in the
// project's env vars because npm would then skip the devDependencies the build needs.
process.env.NODE_ENV ??= 'production';

const { createApp } = await import('../backend/dist/app.js');

export default createApp();
