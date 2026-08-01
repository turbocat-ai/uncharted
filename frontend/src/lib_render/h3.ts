import { latLngToCell, cellToBoundary } from 'h3-js';

/**
 * H3 Resolution 10 corresponds to hexagonal cells ~15–20 meters across,
 * which is the optimal spatial resolution for human walking exploration.
 */
export const H3_RESOLUTION = 10;

export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Converts raw GPS coordinates into a unique H3 Hexagon Index string.
 *
 * @param latitude - GPS latitude
 * @param longitude - GPS longitude
 * @returns H3 cell index string (e.g., '8a2a1072b59ffff')
 */
export function getH3Index(latitude: number, longitude: number): string {
  return latLngToCell(latitude, longitude, H3_RESOLUTION);
}

export function getFogOverlayPolygon(unlockedHexes: Map<string, LatLng[]>): {
  coordinates: LatLng[];
  holes: LatLng[][];
} {
  // A huge polygon covering the vast area around the user (effectively the whole viewable map)
  const outerWorldBounds: LatLng[] = [
    { latitude: 85, longitude: -180 },
    { latitude: 85, longitude: 180 },
    { latitude: -85, longitude: 180 },
    { latitude: -85, longitude: -180 },
  ];

  // Extract all boundary arrays to act as holes in the outer polygon
  const hexHoles: LatLng[][] = Array.from(unlockedHexes.values());

  return {
    coordinates: outerWorldBounds,
    holes: hexHoles,
  };
}

/**
 * Returns an array of LatLng objects representing the 6 boundary vertices 
 * of an H3 hex. Formatted specifically for react-native-maps <Polygon /> coordinates.
 *
 * @param h3Index - H3 cell index string
 * @returns Array of 6 boundary coordinate points [{ latitude, longitude }, ...]
 */
export function getHexBoundary(h3Index: string): LatLng[] {
  // cellToBoundary returns array of [latitude, longitude] pairs
  const boundary = cellToBoundary(h3Index);

  return boundary.map(([latitude, longitude]) => ({
    latitude,
    longitude,
  }));
}

/**
 * Returns ordered lat/lng pairs of hex centers to form continuous walking path lines.
 */
export function getHexCenterPoints(unlockedHexes: Map<string, LatLng[]>): LatLng[] {
  const centers: LatLng[] = [];

  unlockedHexes.forEach((_, h3Index) => {
    centers.push(getHexCenter(h3Index));
  });

  return centers;
}

/**
 * Calculates the center point (latitude/longitude) of an H3 hex.
 * Useful for centering maps or placing markers inside a hex.
 *
 * @param h3Index - H3 cell index string
 */
export function getHexCenter(h3Index: string): LatLng {
  const boundary = getHexBoundary(h3Index);
  
  const totalLat = boundary.reduce((sum, point) => sum + point.latitude, 0);
  const totalLng = boundary.reduce((sum, point) => sum + point.longitude, 0);

  return {
    latitude: totalLat / boundary.length,
    longitude: totalLng / boundary.length,
  };
}