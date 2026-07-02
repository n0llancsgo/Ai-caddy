import { GeoPoint } from "./types";

const EARTH_RADIUS_METERS = 6371000;

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const lonDelta = toRad(to.longitude - from.longitude);

  const y = Math.sin(lonDelta) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lonDelta);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
