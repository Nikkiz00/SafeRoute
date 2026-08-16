/**
 * Overpass API client — IMPORT-TIME ONLY. Nothing in the running app calls this;
 * it's used exclusively by scripts/import-national-zones.ts (via source-resolver.ts)
 * to build a one-off cache of OSM data on disk. The app always reads from the
 * database (backend/data/osm/<istatCode>/*.json is a build artifact, gitignored,
 * never read at request time) — see docs/step-4-4-national-zone-strategy.md, goal 6.
 *
 * Overpass' public instance rate-limits aggressively. This client is deliberately
 * polite: one request at a time (the caller in source-resolver.ts/import-national-
 * zones.ts never runs cities concurrently), a courtesy delay after every live
 * request, and exponential backoff + retry specifically on "rate_limited" errors
 * (Overpass returns HTTP 200 with an HTML error body for these, not a 429 — verified
 * against the real API while building this pipeline).
 */
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DATA_DIR = process.env.OSM_SUBMUNICIPAL_DATA_DIR ?? path.resolve(import.meta.dirname, '../../../../data/osm')
const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'SafeRoute-importer/1.0 (educational project; contact via repository)'
const MAX_ATTEMPTS = 4
const RETRY_BASE_DELAY_MS = 30_000
export const COURTESY_DELAY_MS = Number(process.env.OVERPASS_COURTESY_DELAY_MS ?? 3000)

export interface OverpassGeomPoint {
  lat: number
  lon: number
}

export interface OverpassMember {
  type: 'way' | 'node' | 'relation'
  ref: number
  role: string
  geometry?: OverpassGeomPoint[]
}

export interface OverpassElement {
  type: 'way' | 'relation' | 'node'
  id: number
  tags?: Record<string, string>
  geometry?: OverpassGeomPoint[]
  members?: OverpassMember[]
}

export interface OverpassJson {
  version: number
  generator: string
  osm3s: { timestamp_osm_base: string; copyright: string }
  elements: OverpassElement[]
}

export interface OverpassQueryResult {
  json: OverpassJson
  fromCache: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cachePathFor(cityIstatCode: string, cacheTag: string): string {
  return path.join(DATA_DIR, cityIstatCode, `${cacheTag}.json`)
}

/**
 * Runs one Overpass QL query, using a per-(city, cacheTag) disk cache. Returns the
 * parsed JSON plus whether it came from cache (so callers can skip the courtesy
 * delay when no live request happened).
 */
export async function runOverpassQuery(opts: {
  cityIstatCode: string
  cacheTag: string
  query: string
  fresh: boolean
}): Promise<OverpassQueryResult> {
  const cachePath = cachePathFor(opts.cityIstatCode, opts.cacheTag)

  if (existsSync(cachePath) && !opts.fresh) {
    const raw = await readFile(cachePath, 'utf-8')
    return { json: JSON.parse(raw) as OverpassJson, fromCache: true }
  }

  mkdirSync(path.dirname(cachePath), { recursive: true })

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(opts.query)}`,
      })
      const text = await res.text()
      const looksLikeErrorPage = text.trimStart().startsWith('<')

      if (!res.ok || looksLikeErrorPage) {
        const rateLimited = res.status === 429 || /rate_limited/i.test(text)
        if (rateLimited && attempt < MAX_ATTEMPTS) {
          const wait = RETRY_BASE_DELAY_MS * attempt
          console.log(`[osm] overpass rate-limited (attempt ${attempt}/${MAX_ATTEMPTS}), waiting ${wait}ms...`)
          await sleep(wait)
          continue
        }
        throw new Error(`Overpass query failed (status=${res.status}): ${text.slice(0, 300)}`)
      }

      const json = JSON.parse(text) as OverpassJson
      await writeFile(cachePath, JSON.stringify(json))
      await sleep(COURTESY_DELAY_MS)
      return { json, fromCache: false }
    } catch (err) {
      lastError = err
      if (attempt < MAX_ATTEMPTS) {
        console.log(
          `[osm] overpass request error (attempt ${attempt}/${MAX_ATTEMPTS}): ${err instanceof Error ? err.message : String(err)}`
        )
        await sleep(RETRY_BASE_DELAY_MS)
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
