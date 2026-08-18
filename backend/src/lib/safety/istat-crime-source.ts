/**
 * Reads the ISTAT crime-rate data cached to disk by the research phase of Step 5.0
 * (backend/data/istat-crime-*-national-raw.csv — SDMX-CSV exports of dataset
 * "Delitti denunciati dalle forze di polizia all'autorità giudiziaria", flows
 * 73_67_DF_DCCV_DELITTIPS_9 "prov" and _8 "grandi comuni", indicator CRIMET =
 * count per 100,000 residents, already population-normalized by ISTAT).
 *
 * Never fetched at runtime by the app — see docs/step-5-0-safety-data-baseline.md
 * §2 "Importer" for the offline refresh procedure (re-run the SDMX curl queries
 * documented there, respecting ISTAT's 5-req/min rate limit, then re-run the
 * importer script).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { FETCH_CATEGORY_CODES, weightFor } from './crime-categories.js'

export interface TerritoryCrimeSeries {
  territoryCode: string
  // category -> year -> CRIMET value (rate per 100,000 residents)
  ratesByCategoryYear: Map<string, Map<number, number>>
}

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data')
const PROVINCE_CSV = path.join(DATA_DIR, 'istat-crime-province-national-raw.csv')
const COMUNI_CSV = path.join(DATA_DIR, 'istat-crime-comuni-national-raw.csv')

// The 12 comuni ISTAT publishes comune-level CRIMET for ("grandi comuni" flow _8) —
// extracted directly from a live query of that dataflow (2026-08-17), not invented.
// Everything else nationally falls back to its province's rate.
export const GRANDI_COMUNI_ISTAT_CODES = [
  '001272', // Torino
  '010025', // Genova
  '015146', // Milano
  '023091', // Trieste
  '027042', // Venezia
  '037006', // Bologna
  '048017', // Firenze
  '058091', // Roma
  '063049', // Napoli
  '072006', // Bari
  '082053', // Palermo
  '087015', // Cagliari
]

// True province-level NUTS3 codes only: "IT" + one region letter + 2 digits (e.g.
// "ITC11" = Torino). The province SDMX query used a REF_AREA wildcard (ISTAT
// doesn't support filtering by territorial level in the key), which also returns
// nation ("IT"), macro-region ("ITC") and region ("ITC1") aggregate rows — these
// are NOT independent samples (a region's rate is not a peer of its own
// provinces') and must never enter the percentile distribution below. Excludes a
// handful of provinces using a different numeric scheme after the 2016 Sardinia
// reorganization (IT108/109/110) — documented gap, see territory-resolver.ts.
const PROVINCE_CODE_PATTERN = /^IT[A-Z]\d{2}$/

function parseCsv(filePath: string, filterProvinceCodes: boolean): Map<string, TerritoryCrimeSeries> {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')
  const header = lines[0].split(',')
  const col = (name: string) => header.indexOf(name)
  const REF_AREA = col('REF_AREA')
  const DATA_TYPE = col('DATA_TYPE')
  const TYPE_CRIME = col('TYPE_CRIME')
  const TIME_PERIOD = col('TIME_PERIOD')
  const OBS_VALUE = col('OBS_VALUE')

  const result = new Map<string, TerritoryCrimeSeries>()
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols[DATA_TYPE] !== 'CRIMET') continue
    const territoryCode = cols[REF_AREA]
    if (filterProvinceCodes && !PROVINCE_CODE_PATTERN.test(territoryCode)) continue
    const category = cols[TYPE_CRIME]
    const year = Number(cols[TIME_PERIOD])
    const value = Number(cols[OBS_VALUE])
    if (!territoryCode || !Number.isFinite(year) || !Number.isFinite(value)) continue

    let series = result.get(territoryCode)
    if (!series) {
      series = { territoryCode, ratesByCategoryYear: new Map() }
      result.set(territoryCode, series)
    }
    let byYear = series.ratesByCategoryYear.get(category)
    if (!byYear) {
      byYear = new Map()
      series.ratesByCategoryYear.set(category, byYear)
    }
    byYear.set(year, value)
  }
  return result
}

let provinceCache: Map<string, TerritoryCrimeSeries> | null = null
let comuniCache: Map<string, TerritoryCrimeSeries> | null = null

export function loadProvinceCrimeSeries(): Map<string, TerritoryCrimeSeries> {
  if (!provinceCache) provinceCache = parseCsv(PROVINCE_CSV, true)
  return provinceCache
}

export function loadComuniCrimeSeries(): Map<string, TerritoryCrimeSeries> {
  if (!comuniCache) comuniCache = parseCsv(COMUNI_CSV, false)
  return comuniCache
}

// Smoothing over the last 3 complete years cached (goal: "smoothing su più anni") —
// reduces single-year noise without diluting recency too much. See docs §5.
const SMOOTHING_YEARS = [2022, 2023, 2024]

export interface WeightedRateResult {
  weightedRatePer100k: number
  /** Smoothed (mean over SMOOTHING_YEARS) per-category CRIMET, kept for debuggability. */
  rawCategoryRates: Record<string, number>
  referenceYear: number
}

/** Category-weighted, multi-year-smoothed composite crime rate for one territory. */
export function computeWeightedRate(series: TerritoryCrimeSeries): WeightedRateResult | null {
  const rawCategoryRates: Record<string, number> = {}
  let weightedSum = 0
  let anyWeightedData = false
  let latestYear = 0

  for (const cat of FETCH_CATEGORY_CODES) {
    const byYear = series.ratesByCategoryYear.get(cat)
    if (!byYear) continue
    const values: number[] = []
    for (const y of SMOOTHING_YEARS) {
      const v = byYear.get(y)
      if (v !== undefined) {
        values.push(v)
        latestYear = Math.max(latestYear, y)
      }
    }
    if (values.length === 0) continue
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    rawCategoryRates[cat] = Math.round(mean * 100) / 100
    if (cat !== 'TOT') {
      weightedSum += mean * weightFor(cat)
      anyWeightedData = true
    }
  }

  if (!anyWeightedData) return null
  return {
    weightedRatePer100k: Math.round(weightedSum * 100) / 100,
    rawCategoryRates,
    referenceYear: latestYear,
  }
}
