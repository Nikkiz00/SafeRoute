import type { Zone, ZoneGeometry } from '@/types'

// Ray-casting point-in-polygon for a single GeoJSON ring: ring[i] = [lng, lat]
function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const lngI = ring[i][0], latI = ring[i][1]
    const lngJ = ring[j][0], latJ = ring[j][1]
    if (
      (latI > lat) !== (latJ > lat) &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI
    ) {
      inside = !inside
    }
  }
  return inside
}

// Point-in-polygon over a Polygon or MultiPolygon geometry (outer ring only, holes ignored).
export function pointInGeometry(lat: number, lng: number, geometry: ZoneGeometry): boolean {
  if (geometry.type === 'Polygon') {
    return pointInRing(lat, lng, geometry.coordinates[0])
  }
  return geometry.coordinates.some((polygon) => pointInRing(lat, lng, polygon[0]))
}

export function findContainingZone(lat: number, lng: number, zones: Zone[]): Zone | null {
  for (const zone of zones) {
    if (pointInGeometry(lat, lng, zone.geometry)) return zone
  }
  return null
}

// Convert GeoJSON [lng, lat] rings to Leaflet's [lat, lng] latlng structure.
// Polygon -> LatLng[][] (rings, first = outer, rest = holes)
// MultiPolygon -> LatLng[][][] (one LatLng[][] per part)
export function toLeafletLatLngs(geometry: ZoneGeometry): [number, number][][] | [number, number][][][] {
  const ringToLatLngs = (ring: number[][]): [number, number][] =>
    ring.map(([lng, lat]) => [lat, lng] as [number, number])

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(ringToLatLngs)
  }
  return geometry.coordinates.map((polygon) => polygon.map(ringToLatLngs))
}
