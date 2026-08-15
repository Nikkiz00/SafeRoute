/**
 * Contract for an authoritative sub-municipal geographic source (quartieri,
 * circoscrizioni, NIL, ...). Everything city-specific — download URL, file
 * format, field names, reprojection — lives inside a SubMunicipalSource
 * implementation under sources/. The engine (engine.ts) and the CLI script
 * never know about any particular city, so adding Milano/Roma later means
 * writing a new sources/*.ts file, not touching shared code.
 */
import type { ZoneGeometry } from '../geo.js'

export interface SubMunicipalFeature {
  /** Stable id inside the source dataset (e.g. shapefile attribute "18"). */
  sourceId: string
  /** Official denomination, taken verbatim from the source — never rewritten. */
  name: string
  /** Geometry already normalized to WGS84 Polygon/MultiPolygon. */
  geometry: ZoneGeometry
}

export interface SubMunicipalSource {
  /** Stable slug, used as Zone.source, the CLI --source value, and the cache dir name. */
  id: string
  /** Human label for logs/docs. */
  label: string
  /** ISTAT code of the parent comune (must already exist as a City, e.g. via import:istat). */
  cityIstatCode: string
  /** Classification written to Zone.type / Zone.sourceType (e.g. "quartiere", "circoscrizione", "nil"). */
  sourceType: string
  /** License exactly as published by the source — never invented. */
  license: string
  /** ISO date the *source dataset* itself was last updated (not the import run date). */
  sourceUpdatedAt: string

  /** Downloads (or reuses a local cache of) the raw source data. Must be idempotent. */
  fetch(opts: { fresh: boolean }): Promise<void>
  /** Parses the cached raw data into features with geometry already in WGS84. */
  parse(): Promise<SubMunicipalFeature[]>
}
