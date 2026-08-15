// Shared GeoJSON helpers for Polygon/MultiPolygon zone geometry (WGS84 lng/lat).
import proj4 from 'proj4'

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

// Trims float noise from a geometry already in WGS84 (no reprojection). ~11cm
// precision at Italy's latitude, matching the ISTAT importer's rounding.
const COORD_PRECISION = 6

export function roundGeometry(geometry: ZoneGeometry): ZoneGeometry {
  const round = (ring: number[][]) =>
    ring.map(([lng, lat]) => [Number(lng.toFixed(COORD_PRECISION)), Number(lat.toFixed(COORD_PRECISION))])

  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map(round) }
  }
  return { type: 'MultiPolygon', coordinates: geometry.coordinates.map((poly) => poly.map(round)) }
}

// Reprojects a geometry from an arbitrary source CRS (any proj4 definition
// string, e.g. a national UTM grid) to WGS84, rounding to the same precision
// as roundGeometry(). Shared by any SubMunicipalSource/importer whose source
// data isn't already in WGS84 — see the ISTAT comuni importer (UTM32N) and
// the Roma zone urbanistiche source (EPSG:6708 / UTM33N) for two different
// proj4 strings using this same function.
export function reprojectGeometry(
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown },
  fromProj4: string
): ZoneGeometry {
  const reprojectRing = (ring: number[][]): number[][] =>
    ring.map(([x, y]) => {
      const [lng, lat] = proj4(fromProj4, 'WGS84', [x, y])
      return [Number(lng.toFixed(COORD_PRECISION)), Number(lat.toFixed(COORD_PRECISION))]
    })

  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: (geometry.coordinates as number[][][]).map(reprojectRing) }
  }
  return {
    type: 'MultiPolygon',
    coordinates: (geometry.coordinates as number[][][][]).map((poly) => poly.map(reprojectRing)),
  }
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
