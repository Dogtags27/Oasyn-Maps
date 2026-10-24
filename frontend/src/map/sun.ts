/**
 * map/sun.ts — sun azimuth/elevation for DISPLAY ONLY.
 *
 * The sun badge needs an azimuth to rotate to and an elevation to print; the
 * Sun-mode auto-suggest compares elevation against a config threshold. This is a
 * standard astronomical position formula, not a domain model — it drives no
 * routing or exposure value. (The backend owns all exposure/radiation math.)
 */
export interface SunPosition {
  /** degrees, 0 = north, clockwise. */
  azimuth: number;
  /** degrees above the horizon. */
  elevation: number;
}

const RAD = Math.PI / 180;

/** Sun position for a time and location (NOAA-style approximation). */
export function sunPosition(date: Date, lat: number, lon: number): SunPosition {
  const dayMs = 86400000;
  const j1970 = 2440588;
  const j2000 = 2451545;
  const toJulian = (d: Date) => d.valueOf() / dayMs - 0.5 + j1970;
  const d = toJulian(date) - j2000;

  const meanAnomaly = (357.5291 + 0.98560028 * d) * RAD;
  const eqCenter =
    (1.9148 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly) +
      0.0003 * Math.sin(3 * meanAnomaly)) *
    RAD;
  const eclipticLon = meanAnomaly + eqCenter + 102.9372 * RAD + Math.PI;
  const obliquity = 23.4397 * RAD;

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLon));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLon),
    Math.cos(eclipticLon),
  );

  const siderealTime = (280.16 + 360.9856235 * d) * RAD + lon * RAD;
  const hourAngle = siderealTime - rightAscension;

  const latRad = lat * RAD;
  const elevation = Math.asin(
    Math.sin(latRad) * Math.sin(declination) +
      Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle),
  );
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latRad) - Math.tan(declination) * Math.cos(latRad),
  );

  // Convert azimuth from "south, clockwise" to "north, clockwise".
  const azDeg = (azimuth / RAD + 180) % 360;
  return { azimuth: azDeg, elevation: elevation / RAD };
}
