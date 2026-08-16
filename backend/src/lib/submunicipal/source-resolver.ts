/**
 * National source-resolution strategy (Step 4.4). For any comune, decides which
 * geographic source SafeRoute should use, in priority order:
 *
 *   1. official     — a hand-registered SubMunicipalSource (registry.ts) exists.
 *   2. osm          — no official source, but a validated OSM sub-municipal dataset exists.
 *   3. municipality — neither of the above: the ISTAT comune boundary stays the
 *                     single zone for this city (already the case after import:istat —
 *                     resolveZoneSource never needs to write anything for this case).
 *
 * This function never invents geometry and never writes to the database — see
 * scripts/import-national-zones.ts for the CLI that acts on its result by calling
 * importSubMunicipalSource() (the same generic engine used by Torino/Milano/Roma).
 */
import type { PrismaClient } from '@prisma/client'
import type { ZoneGeometry } from '../geo.js'
import { OFFICIAL_SOURCES_BY_ISTAT } from './registry.js'
import type { SubMunicipalSource } from './types.js'
import { fetchOsmCandidates, type OsmTier } from './osm/osm-source.js'
import { validateOsmDataset, type OsmValidationReport } from './osm/validate.js'

export type SourceStrategy = 'official' | 'osm' | 'municipality'
export type SourceStatus = 'official' | 'osm_validated' | 'municipality_fallback'

export interface SourceResolution {
  cityIstatCode: string
  cityName: string
  strategy: SourceStrategy
  status: SourceStatus
  /** Present for 'official' and 'osm' (validated) — hand to importSubMunicipalSource() to write zones. */
  source: SubMunicipalSource | null
  osmTier: OsmTier | null
  osmReport: OsmValidationReport | null
  reasons: string[]
}

function licenseForOsm(): string {
  return '© OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright)'
}

function sourceTypeForTier(tier: OsmTier): string {
  return tier === 'place' ? 'osm_place' : 'osm_quartiere'
}

export async function resolveZoneSource(
  prisma: PrismaClient,
  cityIstatCode: string,
  opts: { fresh?: boolean } = {}
): Promise<SourceResolution> {
  const official = OFFICIAL_SOURCES_BY_ISTAT[cityIstatCode]
  if (official) {
    return {
      cityIstatCode,
      cityName: official.label,
      strategy: 'official',
      status: 'official',
      source: official,
      osmTier: null,
      osmReport: null,
      reasons: [`official source registered: ${official.id}`],
    }
  }

  const city = await prisma.city.findUnique({ where: { istatCode: cityIstatCode } })
  if (!city) {
    throw new Error(`[source-resolver] no City found for istatCode=${cityIstatCode}. Run "npm run import:istat" first.`)
  }
  if (!city.boundaryJson) {
    throw new Error(
      `[source-resolver] City ${city.name} (${cityIstatCode}) has no boundaryJson — cannot validate OSM coverage against it. Re-run import:istat.`
    )
  }

  const fetchResult = await fetchOsmCandidates({ istatCode: cityIstatCode, name: city.name }, { fresh: opts.fresh ?? false })

  if (fetchResult.tierUsed === 'none') {
    return {
      cityIstatCode,
      cityName: city.name,
      strategy: 'municipality',
      status: 'municipality_fallback',
      source: null,
      osmTier: null,
      osmReport: null,
      reasons: [
        `no OSM admin-boundary or place-boundary candidates found for ${city.name} (checked admin_level 9-11 and place=suburb/quarter/neighbourhood with real closed geometry)`,
      ],
    }
  }

  const report = validateOsmDataset(fetchResult.rawFeatures, city.boundaryJson as ZoneGeometry, city.name)

  if (report.status === 'rejected') {
    return {
      cityIstatCode,
      cityName: city.name,
      strategy: 'municipality',
      status: 'municipality_fallback',
      source: null,
      osmTier: fetchResult.tierUsed,
      osmReport: report,
      reasons: report.reasons,
    }
  }

  const tier = fetchResult.tierUsed
  const source: SubMunicipalSource = {
    id: `osm-${tier}-${cityIstatCode}`,
    label: `${city.name} — OSM ${tier === 'admin' ? 'administrative boundaries' : 'place boundaries'} (validated, ${report.features.length} zone)`,
    cityIstatCode,
    sourceType: sourceTypeForTier(tier),
    license: licenseForOsm(),
    sourceUpdatedAt: fetchResult.sourceUpdatedAt ?? new Date().toISOString(),
    qualityStatus: 'osm_validated',
    // Data is already fetched (and disk-cached by osm/overpass-client.ts) and validated
    // above — nothing left to do here. fetch()/parse() only exist to satisfy the shared
    // SubMunicipalSource contract so this flows through the exact same generic
    // importSubMunicipalSource() engine as Torino/Milano/Roma.
    fetch: async () => {},
    parse: async () => report.features,
  }

  return {
    cityIstatCode,
    cityName: city.name,
    strategy: 'osm',
    status: 'osm_validated',
    source,
    osmTier: tier,
    osmReport: report,
    reasons: report.reasons,
  }
}
