/**
 * Fetches + parses OSM candidate zones for one comune, trying the two tiers in
 * order (see query-builder.ts): real administrative sub-municipal boundaries first,
 * place=suburb/quarter/neighbourhood polygons only if that tier is empty/too thin.
 * Does NOT validate the dataset — that's osm/validate.ts, called by source-resolver.ts
 * with the city's boundary. Kept separate so validate.ts stays a pure, network-free
 * function that's easy to unit-test/reason about.
 */
import { runOverpassQuery } from './overpass-client.js'
import { buildAdminBoundaryQuery, buildPlaceBoundaryQuery } from './query-builder.js'
import { parseOsmElements, type OsmParseStats } from './parse.js'
import type { SubMunicipalFeature } from '../types.js'

export type OsmTier = 'admin' | 'place' | 'none'

export interface OsmFetchResult {
  tierUsed: OsmTier
  rawFeatures: SubMunicipalFeature[]
  /** Real OSM data timestamp (osm3s.timestamp_osm_base) — null only when tierUsed is 'none'. */
  sourceUpdatedAt: string | null
  parseStats: OsmParseStats
}

const MIN_CANDIDATES_TO_ACCEPT_TIER = 2

export async function fetchOsmCandidates(
  city: { istatCode: string; name: string },
  opts: { fresh: boolean }
): Promise<OsmFetchResult> {
  const adminResult = await runOverpassQuery({
    cityIstatCode: city.istatCode,
    cacheTag: 'admin-boundaries',
    query: buildAdminBoundaryQuery(city.name),
    fresh: opts.fresh,
  })
  const adminParsed = parseOsmElements(adminResult.json)

  if (adminParsed.features.length >= MIN_CANDIDATES_TO_ACCEPT_TIER) {
    return {
      tierUsed: 'admin',
      rawFeatures: adminParsed.features,
      sourceUpdatedAt: adminResult.json.osm3s.timestamp_osm_base,
      parseStats: adminParsed.stats,
    }
  }

  const placeResult = await runOverpassQuery({
    cityIstatCode: city.istatCode,
    cacheTag: 'place-boundaries',
    query: buildPlaceBoundaryQuery(city.name),
    fresh: opts.fresh,
  })
  const placeParsed = parseOsmElements(placeResult.json)

  if (placeParsed.features.length >= MIN_CANDIDATES_TO_ACCEPT_TIER) {
    return {
      tierUsed: 'place',
      rawFeatures: placeParsed.features,
      sourceUpdatedAt: placeResult.json.osm3s.timestamp_osm_base,
      parseStats: placeParsed.stats,
    }
  }

  return {
    tierUsed: 'none',
    rawFeatures: [...adminParsed.features, ...placeParsed.features],
    sourceUpdatedAt: null,
    parseStats: adminParsed.stats,
  }
}
