/**
 * Dataset-level automatic QA gate for an OSM candidate zone set — see
 * docs/step-4-4-national-zone-strategy.md, "Validazione automatica". Runs entirely
 * offline against already-fetched/parsed features; makes no network calls.
 *
 * Order of operations mirrors the goal's checklist: drop per-feature problems first
 * (invalid geometry, mostly-outside-the-comune, duplicates), then gate the *surviving
 * set* on zone count / coverage / overlap. Any dataset that fails a gate is rejected
 * outright — callers must fall back to the ISTAT municipality zone, never write a
 * partially-bad OSM dataset.
 */
import { area as turfArea, centroid as turfCentroid, distance as turfDistance, feature, featureCollection, intersect as turfIntersect, union as turfUnion } from '@turf/turf'
import { isValidGeometry, type ZoneGeometry } from '../../geo.js'
import type { SubMunicipalFeature } from '../types.js'

export interface OsmValidationMetrics {
  candidateCount: number
  acceptedCount: number
  droppedInvalidGeometry: number
  droppedOutsideComune: number
  droppedDuplicates: number
  coverageRatio: number | null
  overlapRatio: number | null
}

export interface OsmValidationReport {
  status: 'accepted' | 'rejected'
  reasons: string[]
  metrics: OsmValidationMetrics
  /** The validated, deduplicated, in-comune feature set — only meaningful when status === 'accepted'. */
  features: SubMunicipalFeature[]
}

// Thresholds — documented and justified in docs/step-4-4-national-zone-strategy.md
// rather than tuned per-city, so the same bar applies to every comune in Italy.
const MIN_ZONES = 2
const MIN_COVERAGE_RATIO = 0.6
const MAX_OVERLAP_RATIO = 0.15
const MIN_INSIDE_RATIO = 0.5 // a candidate zone must have >=50% of its own area inside the comune
const MAX_OUTSIDE_DROP_SHARE = 0.3 // if >30% of candidates are mostly-outside, the whole dataset is suspect
const DUPLICATE_CENTROID_DIST_KM = 0.05
const DUPLICATE_AREA_RATIO_TOLERANCE = 0.1

function safeArea(geom: ZoneGeometry): number {
  try {
    return turfArea(feature(geom))
  } catch {
    return 0
  }
}

function safeIntersectArea(a: ZoneGeometry, b: ZoneGeometry): number {
  try {
    const inter = turfIntersect(featureCollection([feature(a), feature(b)]))
    return inter ? turfArea(inter) : 0
  } catch {
    return 0
  }
}

function safeUnion(geometries: ZoneGeometry[]): ZoneGeometry | null {
  if (geometries.length === 1) return geometries[0]
  try {
    const result = turfUnion(featureCollection(geometries.map((g) => feature(g))))
    return result && isValidGeometry(result.geometry) ? (result.geometry as ZoneGeometry) : null
  } catch {
    return null
  }
}

export function validateOsmDataset(
  candidates: SubMunicipalFeature[],
  cityBoundary: ZoneGeometry,
  cityName: string
): OsmValidationReport {
  const reasons: string[] = []
  const metrics: OsmValidationMetrics = {
    candidateCount: candidates.length,
    acceptedCount: 0,
    droppedInvalidGeometry: 0,
    droppedOutsideComune: 0,
    droppedDuplicates: 0,
    coverageRatio: null,
    overlapRatio: null,
  }

  let pool = candidates.filter((f) => {
    if (isValidGeometry(f.geometry) && safeArea(f.geometry) > 0) return true
    metrics.droppedInvalidGeometry++
    return false
  })

  const boundaryArea = safeArea(cityBoundary)
  const insideComune: SubMunicipalFeature[] = []
  for (const f of pool) {
    const own = safeArea(f.geometry)
    const insideRatio = safeIntersectArea(f.geometry, cityBoundary) / own
    if (insideRatio < MIN_INSIDE_RATIO) {
      metrics.droppedOutsideComune++
      continue
    }
    insideComune.push(f)
  }
  pool = insideComune

  if (candidates.length > 0 && metrics.droppedOutsideComune / candidates.length > MAX_OUTSIDE_DROP_SHARE) {
    reasons.push(
      `${metrics.droppedOutsideComune}/${candidates.length} candidate zones are mostly outside ${cityName}'s comune boundary — dataset likely mismatched to the wrong area`
    )
    return { status: 'rejected', reasons, metrics, features: [] }
  }

  const deduped: SubMunicipalFeature[] = []
  for (const f of pool) {
    const c = turfCentroid(feature(f.geometry))
    const a = safeArea(f.geometry)
    const isDuplicate = deduped.some((existing) => {
      const dist = turfDistance(c, turfCentroid(feature(existing.geometry)))
      if (dist > DUPLICATE_CENTROID_DIST_KM) return false
      const ea = safeArea(existing.geometry)
      return Math.abs(a - ea) / Math.max(a, ea) < DUPLICATE_AREA_RATIO_TOLERANCE
    })
    if (isDuplicate) metrics.droppedDuplicates++
    else deduped.push(f)
  }
  pool = deduped

  if (pool.length < MIN_ZONES) {
    reasons.push(`only ${pool.length} usable zone(s) survived filtering (minimum ${MIN_ZONES}) — not a real subdivision`)
    return { status: 'rejected', reasons, metrics, features: [] }
  }

  const unioned = safeUnion(pool.map((f) => f.geometry))
  const coverageRatio = unioned && boundaryArea > 0 ? safeIntersectArea(unioned, cityBoundary) / boundaryArea : 0
  metrics.coverageRatio = coverageRatio
  if (coverageRatio < MIN_COVERAGE_RATIO) {
    reasons.push(
      `zone union covers only ${(coverageRatio * 100).toFixed(0)}% of ${cityName}'s comune boundary (minimum ${MIN_COVERAGE_RATIO * 100}%)`
    )
    return { status: 'rejected', reasons, metrics, features: [] }
  }

  let overlapArea = 0
  let totalArea = 0
  for (let i = 0; i < pool.length; i++) {
    totalArea += safeArea(pool[i].geometry)
    for (let j = i + 1; j < pool.length; j++) {
      overlapArea += safeIntersectArea(pool[i].geometry, pool[j].geometry)
    }
  }
  const overlapRatio = totalArea > 0 ? overlapArea / totalArea : 0
  metrics.overlapRatio = overlapRatio
  if (overlapRatio > MAX_OVERLAP_RATIO) {
    reasons.push(
      `zones overlap by ${(overlapRatio * 100).toFixed(1)}% of total zone area (maximum ${MAX_OVERLAP_RATIO * 100}%) — likely duplicate/conflicting boundaries`
    )
    return { status: 'rejected', reasons, metrics, features: [] }
  }

  metrics.acceptedCount = pool.length
  reasons.push(
    `accepted: ${pool.length} zones, coverage ${(coverageRatio * 100).toFixed(0)}%, overlap ${(overlapRatio * 100).toFixed(1)}%` +
      (metrics.droppedOutsideComune ? `, dropped ${metrics.droppedOutsideComune} outside-comune` : '') +
      (metrics.droppedDuplicates ? `, dropped ${metrics.droppedDuplicates} duplicates` : '') +
      (metrics.droppedInvalidGeometry ? `, dropped ${metrics.droppedInvalidGeometry} invalid geometry` : '')
  )
  return { status: 'accepted', reasons, metrics, features: pool }
}
