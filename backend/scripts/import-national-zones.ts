/**
 * National zone-source strategy — CLI over source-resolver.ts (Step 4.4).
 *
 * For each requested comune (by ISTAT code): resolves official -> OSM -> municipality
 * per resolveZoneSource(), and — unless --validate-only — writes the result through
 * the exact same importSubMunicipalSource() engine used by Torino/Milano/Roma. The
 * ISTAT municipality zone (from `npm run import:istat`) is left untouched whenever
 * the strategy resolves to 'municipality' — nothing is written for that case.
 *
 * Usage:
 *   npm run zones:national -- --sample                       # 8 sample cities (see SAMPLE_CITIES)
 *   npm run zones:national -- --cities=037006,048017          # explicit ISTAT codes
 *   npm run zones:national -- --city=037006                   # single city
 *   npm run zones:national -- --sample --validate-only        # resolve + validate, write nothing
 *   npm run zones:national -- --sample --fresh                # force re-fetch OSM (ignore disk cache)
 *   npm run zones:national -- --pending --limit=50            # next 50 non-official comuni (Step 4.5 batch primitive)
 *   npm run zones:national -- --pending --limit=50 --offset=50 --validate-only   # dry-run the following 50
 *
 * Requires the parent comuni to already exist (`npm run import:istat`).
 *
 * --pending is the safe batch-expansion primitive for Step 4.5: it walks all comuni
 * that do NOT have a hand-registered official source (i.e. everything except
 * Torino/Milano/Roma), ordered deterministically by istatCode, and requires an
 * explicit --limit so a run can never silently become a full-country import. Combine
 * --limit/--offset to page through the country in monitored batches (e.g. capoluoghi
 * di provincia/regione first, once an authoritative ISTAT "comune capoluogo" list is
 * imported as real data — see docs/step-4-5-controlled-national-rollout.md §7 for why
 * that isn't hardcoded here).
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { importSubMunicipalSource } from '../src/lib/submunicipal/engine.js'
import { OFFICIAL_SOURCES_BY_ISTAT } from '../src/lib/submunicipal/registry.js'
import { resolveZoneSource, type SourceResolution } from '../src/lib/submunicipal/source-resolver.js'
import type { OsmValidationMetrics } from '../src/lib/submunicipal/osm/validate.js'

const prisma = new PrismaClient()

// The Step 4.4 sample: 5 named capoluoghi + 1 medium capoluogo + 2 small comuni,
// picked per the goal's brief. ISTAT codes verified against the live DB (import:istat
// already ran) rather than typed from memory.
const SAMPLE_CITIES: { istatCode: string; label: string }[] = [
  { istatCode: '037006', label: 'Bologna' },
  { istatCode: '048017', label: 'Firenze' },
  { istatCode: '063049', label: 'Napoli' },
  { istatCode: '010025', label: 'Genova' },
  { istatCode: '082053', label: 'Palermo' },
  { istatCode: '022205', label: 'Trento (capoluogo medio)' },
  { istatCode: '001127', label: 'La Loggia (piccolo comune)' },
  { istatCode: '065011', label: 'Atrani (piccolo comune)' },
]

interface CliArgs {
  cities: string[]
  pending: { limit: number; offset: number } | null
  validateOnly: boolean
  fresh: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const validateOnly = args.includes('--validate-only')
  const fresh = args.includes('--fresh')

  if (args.includes('--sample')) {
    return { cities: SAMPLE_CITIES.map((c) => c.istatCode), pending: null, validateOnly, fresh }
  }
  const cityArg = args.find((a) => a.startsWith('--city='))
  if (cityArg) {
    return { cities: [cityArg.split('=')[1]], pending: null, validateOnly, fresh }
  }
  const citiesArg = args.find((a) => a.startsWith('--cities='))
  if (citiesArg) {
    return {
      cities: citiesArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean),
      pending: null,
      validateOnly,
      fresh,
    }
  }
  if (args.includes('--pending')) {
    const limitArg = args.find((a) => a.startsWith('--limit='))
    if (!limitArg) {
      throw new Error('--pending requires an explicit --limit=N — unbounded national batches are not allowed (Step 4.5 safety rule).')
    }
    const offsetArg = args.find((a) => a.startsWith('--offset='))
    return {
      cities: [],
      pending: { limit: Number(limitArg.split('=')[1]), offset: offsetArg ? Number(offsetArg.split('=')[1]) : 0 },
      validateOnly,
      fresh,
    }
  }
  return { cities: [], pending: null, validateOnly, fresh }
}

/**
 * The Step 4.5 batch-expansion primitive: every comune WITHOUT a hand-registered
 * official source (i.e. all of Italy except Torino/Milano/Roma), ordered
 * deterministically by istatCode, paged with limit/offset. Never touches
 * OFFICIAL_SOURCES_BY_ISTAT cities, so Torino/Milano/Roma can never be pulled into
 * an OSM batch by accident.
 */
async function resolvePendingCities(limit: number, offset: number): Promise<string[]> {
  const officialCodes = Object.keys(OFFICIAL_SOURCES_BY_ISTAT)
  const cities = await prisma.city.findMany({
    where: { istatCode: { not: null, notIn: officialCodes } },
    select: { istatCode: true },
    orderBy: { istatCode: 'asc' },
    skip: offset,
    take: limit,
  })
  return cities.map((c) => c.istatCode as string)
}

interface CityRunResult {
  cityIstatCode: string
  cityName: string
  strategy: SourceResolution['strategy'] | 'error'
  status: SourceResolution['status'] | 'error'
  osmTier: SourceResolution['osmTier']
  reasons: string[]
  metrics: OsmValidationMetrics | null
  written: boolean
  zonesCreated?: number
  zonesUpdated?: number
  zonesRetired?: number
  error?: string
}

/**
 * One city's Overpass fetch or DB write failing (e.g. a transient 504 that exhausts
 * the retry budget in overpass-client.ts) must never abort the rest of the batch —
 * a national-scale run has to survive individual comuni failing. Every await in here
 * is wrapped so runCity() always resolves, never rejects.
 */
async function runCity(istatCode: string, opts: { validateOnly: boolean; fresh: boolean }): Promise<CityRunResult> {
  let resolution: SourceResolution
  try {
    resolution = await resolveZoneSource(prisma, istatCode, { fresh: opts.fresh })
  } catch (err) {
    return {
      cityIstatCode: istatCode,
      cityName: istatCode,
      strategy: 'error',
      status: 'error',
      osmTier: null,
      reasons: [],
      metrics: null,
      written: false,
      error: err instanceof Error ? err.message.split('\n')[0] : String(err),
    }
  }

  const base: CityRunResult = {
    cityIstatCode: resolution.cityIstatCode,
    cityName: resolution.cityName,
    strategy: resolution.strategy,
    status: resolution.status,
    osmTier: resolution.osmTier,
    reasons: resolution.reasons,
    metrics: resolution.osmReport?.metrics ?? null,
    written: false,
  }

  if (opts.validateOnly || !resolution.source) {
    return base
  }

  try {
    const stats = await importSubMunicipalSource(prisma, resolution.source, { fresh: opts.fresh })
    return { ...base, written: true, zonesCreated: stats.zonesCreated, zonesUpdated: stats.zonesUpdated, zonesRetired: stats.zonesRetired }
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) }
  }
}

function printRow(r: CityRunResult): void {
  const icon = { official: '✓ official', osm: '✓ osm', municipality: '· municipality', error: '✗ error' }[r.strategy]
  console.log(`\n[${r.cityIstatCode}] ${r.cityName} — ${icon} (status=${r.status})`)
  for (const reason of r.reasons) console.log(`    ${reason}`)
  if (r.written) console.log(`    written: +${r.zonesCreated} created, ~${r.zonesUpdated} updated, -${r.zonesRetired} retired`)
  if (r.error) console.log(`    ERROR: ${r.error}`)
}

async function main(): Promise<void> {
  const { cities: explicitCities, pending, validateOnly, fresh } = parseArgs()

  const cities = pending ? await resolvePendingCities(pending.limit, pending.offset) : explicitCities

  if (cities.length === 0) {
    console.log(
      'Usage: npm run zones:national -- --sample | --city=<istatCode> | --cities=<istat1,istat2,...> | ' +
        '--pending --limit=<N> [--offset=<N>] [--validate-only] [--fresh]'
    )
    process.exitCode = pending ? 0 : 1 // --pending with limit=N legitimately exhausting the list isn't an error
    return
  }

  if (pending) {
    console.log(`[national-zones] --pending batch: offset=${pending.offset} limit=${pending.limit} -> ${cities.length} comune(s) (${cities[0]}..${cities[cities.length - 1]})`)
  }
  console.log(`[national-zones] resolving ${cities.length} comune(s)${validateOnly ? ' (validate-only, no writes)' : ''}...`)

  const results: CityRunResult[] = []
  for (const istatCode of cities) {
    const result = await runCity(istatCode, { validateOnly, fresh })
    printRow(result)
    results.push(result)
  }

  const summary = {
    official: results.filter((r) => r.strategy === 'official').length,
    osm: results.filter((r) => r.strategy === 'osm').length,
    municipality: results.filter((r) => r.strategy === 'municipality').length,
    errors: results.filter((r) => r.error).length,
  }
  console.log('\n[national-zones] summary')
  console.log(`  official:     ${summary.official}`)
  console.log(`  osm_validated: ${summary.osm}`)
  console.log(`  municipality_fallback: ${summary.municipality}`)
  console.log(`  errors:       ${summary.errors}`)

  const reportDir = path.resolve(import.meta.dirname, '../data/reports')
  await mkdir(reportDir, { recursive: true })
  const reportPath = path.join(reportDir, `national-zones-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), validateOnly, fresh, summary, results }, null, 2))
  console.log(`\n[national-zones] full report written to ${reportPath}`)
}

main()
  .catch((e) => {
    console.error('[national-zones] failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
