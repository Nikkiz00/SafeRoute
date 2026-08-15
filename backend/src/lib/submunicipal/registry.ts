/**
 * Registry of available SubMunicipalSource implementations, keyed by the id
 * passed to `--source=` on the CLI. Adding a city means adding a sources/*.ts
 * file and one line here — no changes to the engine or the CLI script.
 */
import { milanoNilSource } from './sources/milano-nil.js'
import { torinoQuartieriSource } from './sources/torino-quartieri.js'
import type { SubMunicipalSource } from './types.js'

export const SUBMUNICIPAL_SOURCES: Record<string, SubMunicipalSource> = {
  [torinoQuartieriSource.id]: torinoQuartieriSource,
  [milanoNilSource.id]: milanoNilSource,
}
