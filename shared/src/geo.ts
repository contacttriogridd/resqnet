/** Small, dependency-free geo helpers usable offline. */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Initial compass bearing from a to b, as an 8-point direction ("NE"). */
export function compassDirection(a: LatLng, b: LatLng): string {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(bearing / 45) % 8]!;
}

/**
 * Coarsens coordinates (default ≈1.1 km) so that precise location is not
 * exposed where it isn't needed, e.g. in public lists or analytics.
 */
export function coarsen(point: LatLng, decimals = 2): LatLng {
  const f = 10 ** decimals;
  return {
    latitude: Math.round(point.latitude * f) / f,
    longitude: Math.round(point.longitude * f) / f,
  };
}

export function formatCoordinates(p: LatLng, decimals = 5): string {
  const lat = `${Math.abs(p.latitude).toFixed(decimals)}° ${p.latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(p.longitude).toFixed(decimals)}° ${p.longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lon}`;
}
