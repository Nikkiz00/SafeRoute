// Shared GeoJSON helpers for Polygon/MultiPolygon zone geometry (WGS84 lng/lat).

export type ZoneGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }

export interface BBox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

// Every ring (outer + holes) across both Polygon and MultiPolygon shapes.
function allRings(geometry: ZoneGeometry): number[][][] {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat()
}

export function computeBBox(geometry: ZoneGeometry): BBox {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const ring of allRings(geometry)) {
    for (const point of ring) {
      const [lng, lat] = point
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }

  return { minLng, minLat, maxLng, maxLat }
}

export function isValidGeometry(geometry: unknown): geometry is ZoneGeometry {
  if (!geometry || typeof geometry !== 'object') return false
  const g = geometry as { type?: unknown; coordinates?: unknown }
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return false
  if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) return false

  const rings = allRings(geometry as ZoneGeometry)
  if (rings.length === 0) return false

  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) return false
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2) return false
      const [lng, lat] = point
      if (typeof lng !== 'number' || typeof lat !== 'number') return false
      if (Number.isNaN(lng) || Number.isNaN(lat)) return false
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false
    }
  }

  return true
}
