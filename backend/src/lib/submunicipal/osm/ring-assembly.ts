/**
 * Turns raw OSM `out geom` elements into ZoneGeometry Polygon/MultiPolygon.
 *
 * OSM administrative boundary *relations* reference way segments as members
 * (role "outer"/"inner"), not pre-joined rings — a relation with N member ways
 * needs those segments chained end-to-end into one or more closed rings before
 * they're usable as GeoJSON. This is the standard OSM multipolygon assembly
 * problem. Segments that can't be chained into a closed ring are dropped, never
 * force-closed or guessed shut — see docs/step-4-4-national-zone-strategy.md,
 * "no invented geometry".
 */
import { booleanPointInPolygon, polygon as turfPolygon } from '@turf/turf'
import { roundGeometry, type ZoneGeometry } from '../../geo.js'
import type { OverpassElement, OverpassGeomPoint, OverpassMember } from './overpass-client.js'

type LonLat = [number, number]

const COORD_EPSILON = 1e-7 // endpoint-equality tolerance when chaining OSM way segments

function toLonLat(pts: OverpassGeomPoint[]): LonLat[] {
  return pts.map((p) => [p.lon, p.lat])
}

function samePoint(a: LonLat, b: LonLat): boolean {
  return Math.abs(a[0] - b[0]) < COORD_EPSILON && Math.abs(a[1] - b[1]) < COORD_EPSILON
}

export interface RingAssemblyResult {
  rings: LonLat[][]
  /** Segments that never joined into a closed ring — reported, never invented shut. */
  unclosedSegments: number
}

/**
 * Chains open/closed line segments sharing endpoints into closed rings. Tries to
 * extend the growing chain from either end (OSM way order/direction inside a
 * relation is arbitrary) each pass, until no segment connects or the chain closes.
 */
export function assembleRings(segments: LonLat[][]): RingAssemblyResult {
  const remaining = segments.filter((s) => s.length >= 2).map((s) => [...s])
  const rings: LonLat[][] = []
  let unclosedSegments = 0

  while (remaining.length > 0) {
    let chain = remaining.shift()!

    let extended = true
    while (!samePoint(chain[0], chain[chain.length - 1]) && extended) {
      extended = false
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i]
        const segStart = seg[0]
        const segEnd = seg[seg.length - 1]
        const chainStart = chain[0]
        const chainEnd = chain[chain.length - 1]

        if (samePoint(chainEnd, segStart)) {
          chain = chain.concat(seg.slice(1))
        } else if (samePoint(chainEnd, segEnd)) {
          chain = chain.concat([...seg].reverse().slice(1))
        } else if (samePoint(chainStart, segEnd)) {
          chain = seg.slice(0, -1).concat(chain)
        } else if (samePoint(chainStart, segStart)) {
          chain = [...seg].reverse().slice(0, -1).concat(chain)
        } else {
          continue
        }
        remaining.splice(i, 1)
        extended = true
        break
      }
    }

    if (samePoint(chain[0], chain[chain.length - 1]) && chain.length >= 4) {
      rings.push(chain)
    } else {
      unclosedSegments++
    }
  }

  return { rings, unclosedSegments }
}

function findContainingRingIndex(point: LonLat, outerRings: LonLat[][]): number {
  for (let i = 0; i < outerRings.length; i++) {
    try {
      if (booleanPointInPolygon(point, turfPolygon([outerRings[i]]))) return i
    } catch {
      // degenerate outer ring — skip, hole stays unassigned (dropped, not invented)
    }
  }
  return -1
}

/** Builds geometry from a relation's members (role "outer"/"inner"). Returns null if no outer ring closes. */
export function buildGeometryFromRelation(members: OverpassMember[]): ZoneGeometry | null {
  const outerSegments: LonLat[][] = []
  const innerSegments: LonLat[][] = []

  for (const m of members) {
    if (!m.geometry || m.geometry.length < 2) continue
    const coords = toLonLat(m.geometry)
    if (m.role === 'inner') innerSegments.push(coords)
    else outerSegments.push(coords) // OSM convention: untagged/other role treated as outer
  }

  const { rings: outerRings } = assembleRings(outerSegments)
  if (outerRings.length === 0) return null

  const { rings: innerRings } = assembleRings(innerSegments)

  const parts: LonLat[][][] = outerRings.map((outer) => [outer])
  for (const hole of innerRings) {
    const idx = findContainingRingIndex(hole[0], outerRings)
    if (idx >= 0) parts[idx].push(hole)
    // hole that matches no outer ring is dropped rather than guessed — rare, and
    // harmless for our use (a missing hole only makes the polygon slightly larger).
  }

  if (parts.length === 1) {
    return roundGeometry({ type: 'Polygon', coordinates: parts[0] })
  }
  return roundGeometry({ type: 'MultiPolygon', coordinates: parts })
}

/** Builds geometry from a standalone closed way (no relation). Returns null if not closed. */
export function buildGeometryFromWay(geometry: OverpassGeomPoint[] | undefined): ZoneGeometry | null {
  if (!geometry || geometry.length < 4) return null
  const coords = toLonLat(geometry)
  if (!samePoint(coords[0], coords[coords.length - 1])) return null
  return roundGeometry({ type: 'Polygon', coordinates: [coords] })
}

export function buildGeometryFromElement(el: OverpassElement): ZoneGeometry | null {
  if (el.type === 'relation') return buildGeometryFromRelation(el.members ?? [])
  return buildGeometryFromWay(el.geometry)
}
