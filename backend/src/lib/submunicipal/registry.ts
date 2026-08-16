/**
 * Registry of available SubMunicipalSource implementations, keyed by the id
 * passed to `--source=` on the CLI. Adding a city means adding a sources/*.ts
 * file and one line here — no changes to the engine or the CLI script.
 */
import { milanoNilSource } from './sources/milano-nil.js'
import { romaZoneUrbanisticheSource } from './sources/roma-zone-urbanistiche.js'
import { torinoQuartieriSource } from './sources/torino-quartieri.js'
import type { SubMunicipalSource } from './types.js'

export const SUBMUNICIPAL_SOURCES: Record<string, SubMunicipalSource> = {
  [torinoQuartieriSource.id]: torinoQuartieriSource,
  [milanoNilSource.id]: milanoNilSource,
  [romaZoneUrbanisticheSource.id]: romaZoneUrbanisticheSource,
}

/**
 * Same sources, keyed by cityIstatCode instead of source id — this is the priority-1
 * lookup used by source-resolver.ts's resolveZoneSource(): "does this comune already
 * have a hand-registered authoritative source?" before ever falling back to OSM.
 */
export const OFFICIAL_SOURCES_BY_ISTAT: Record<string, SubMunicipalSource> = Object.fromEntries(
  Object.values(SUBMUNICIPAL_SOURCES).map((s) => [s.cityIstatCode, s])
)
