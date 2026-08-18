/**
 * Decides which CrimeBaseline territory a City should use: its own comune-level
 * baseline if ISTAT publishes one (the 12 "grandi comuni" — GRANDI_COMUNI_ISTAT_CODES),
 * otherwise its province's baseline (goal: "Se esiste solo dato [provinciale] ->
 * tutte le sub-zone di quel comune ricevono inizialmente lo stesso baseline
 * [provinciale]"). Never invents a finer-grained baseline than the data supports.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { GRANDI_COMUNI_ISTAT_CODES } from './istat-crime-source.js'

export interface ProvinceCode {
  nuts3: string
  name: string
}
interface ProvinceSigla {
  sigla: string
  name: string
}

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data')
const NUTS3_JSON = path.join(DATA_DIR, 'istat-nuts3-provinces.json')
const SIGLA_JSON = path.join(DATA_DIR, 'istat-province-sigla.json')

let provinceListCache: ProvinceCode[] | null = null
function loadProvinceList(): ProvinceCode[] {
  if (!provinceListCache) provinceListCache = JSON.parse(readFileSync(NUTS3_JSON, 'utf-8'))
  return provinceListCache as ProvinceCode[]
}

let siglaListCache: ProvinceSigla[] | null = null
function loadSiglaList(): ProvinceSigla[] {
  if (!siglaListCache) siglaListCache = JSON.parse(readFileSync(SIGLA_JSON, 'utf-8'))
  return siglaListCache as ProvinceSigla[]
}

export type TerritoryResolution =
  | { territoryType: 'comune'; territoryCode: string }
  | { territoryType: 'provincia'; territoryCode: string; territoryName: string }
  | { territoryType: 'unresolved'; reason: string }

/**
 * `province` is City.province — the 2-letter sigla (e.g. "TO", "SA"), sourced by
 * import-istat-comuni.ts from the ISTAT ProvCM shapefile's SIGLA field, NOT a full
 * name. Two-hop resolution: sigla -> full province name (istat-province-sigla.json,
 * extracted from that same cached shapefile, 110 entries) -> NUTS3 code
 * (istat-nuts3-provinces.json, from the ISTAT SDMX CL_ITTER107 codelist, 101
 * entries). Known gap (documented in docs/step-5-0-safety-data-baseline.md §9): a
 * handful of provinces reorganized since the NUTS3 codelist was last regenerated
 * (observed for Sardinia, which uses a different numeric code scheme there) don't
 * resolve at the second hop — such comuni are left with no baseline rather than a
 * guessed one.
 */
export function resolveTerritory(city: { istatCode: string | null; province: string | null }): TerritoryResolution {
  if (city.istatCode && GRANDI_COMUNI_ISTAT_CODES.includes(city.istatCode)) {
    return { territoryType: 'comune', territoryCode: city.istatCode }
  }
  if (!city.province) {
    return { territoryType: 'unresolved', reason: 'City has no province sigla to resolve' }
  }
  const siglaMatch = loadSiglaList().find((p) => p.sigla.trim().toUpperCase() === city.province!.trim().toUpperCase())
  if (!siglaMatch) {
    return { territoryType: 'unresolved', reason: `no province name found for sigla "${city.province}"` }
  }
  const nuts3Match = loadProvinceList().find((p) => p.name.trim().toLowerCase() === siglaMatch.name.trim().toLowerCase())
  if (!nuts3Match) {
    return { territoryType: 'unresolved', reason: `no NUTS3 code found for province name "${siglaMatch.name}" (sigla "${city.province}")` }
  }
  return { territoryType: 'provincia', territoryCode: nuts3Match.nuts3, territoryName: nuts3Match.name }
}
