/**
 * ISTAT municipal boundaries importer.
 *
 * Pipeline: ISTAT shapefile (generalized, UTM32N) -> reproject WGS84 -> validate
 * -> map to City/Zone -> upsert into the database.
 *
 * Usage:
 *   npm run import:istat                          # download (if cached) + import ~7896 comuni + reconcile
 *   npm run import:istat -- --limit=50            # import only the first 50 features (smoke test)
 *   npm run import:istat -- --fresh               # force re-download of the ISTAT zip
 *   npm run import:istat -- --skip-reconciliation # base import only, skip administrative-changes.ts rules
 *
 * After the base import (which reflects the ISTAT shapefile as published), this also
 * applies administrative-changes.ts — mergers/incorporations effective after the
 * shapefile's date that ISTAT hasn't republished geometry for yet. See
 * src/lib/administrative-reconciliation.ts and docs/step-4-0-1-*.md.
 *
 * Source: ISTAT "Confini delle unità amministrative a fini statistici", generalized
 * WGS84-folder release (file is internally projected UTM32N despite the folder name --
 * verified against Com*_WGS84.prj, see UTM32N_PROJ4 below).
 * https://www.istat.it/it/archivio/222527
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import AdmZip from 'adm-zip'
import proj4 from 'proj4'
import shapefile from 'shapefile'
import { PrismaClient } from '@prisma/client'
import { computeBBox, isValidGeometry, type ZoneGeometry } from '../src/lib/geo.js'
import { applyAdministrativeChanges } from '../src/lib/administrative-reconciliation.js'

const prisma = new PrismaClient()

const DATA_DIR = process.env.ISTAT_DATA_DIR ?? path.resolve(import.meta.dirname, '../data/istat')
const ZIP_URL =
  process.env.ISTAT_ZIP_URL ??
  'https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2026/Limiti01012026_g.zip'
const RELEASE = path.basename(ZIP_URL, '.zip') // e.g. "Limiti01012026_g"
const ZIP_PATH = path.join(DATA_DIR, `${RELEASE}.zip`)
const EXTRACT_DIR = path.join(DATA_DIR, 'extracted')

// The shapefile's .prj claims WGS84 in the filename but the actual CRS (verified by
// reading the .prj content) is a Transverse Mercator centered on 9°E — this is ISTAT's
// unified national UTM32N grid applied across all of Italy, not a true per-zone UTM.
const UTM32N_PROJ4 = '+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=500000 +y_0=0 +ellps=WGS84 +units=m +no_defs'
const COORD_PRECISION = 6 // ~11cm at Italy's latitude — trims float noise, not shape detail

const CONCURRENCY = 8

interface ImportStats {
  citiesCreated: number
  citiesUpdated: number
  zonesCreated: number
  zonesUpdated: number
  skippedCustomZoneCities: number
  skippedSuppressedCities: number
  invalidGeometry: { comune: string; istatCode: string; reason: string }[]
}

function parseArgs() {
  const args = process.argv.slice(2)
  const limitArg = args.find((a) => a.startsWith('--limit='))
  return {
    limit: limitArg ? Number(limitArg.split('=')[1]) : undefined,
    fresh: args.includes('--fresh'),
    skipReconciliation: args.includes('--skip-reconciliation'),
  }
}

async function ensureZipDownloaded(fresh: boolean): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(ZIP_PATH) && !fresh) {
    console.log(`[istat] using cached archive: ${ZIP_PATH}`)
    return
  }
  console.log(`[istat] downloading ${ZIP_URL} ...`)
  const res = await fetch(ZIP_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (SafeRoute importer)' } })
  if (!res.ok) {
    throw new Error(
      `Download failed (${res.status} ${res.statusText}). If ISTAT changed the URL, download the ` +
        `generalized WGS84-folder shapefile ZIP manually from https://www.istat.it/it/archivio/222527, ` +
        `save it as ${ZIP_PATH}, and re-run this script.`
    )
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(ZIP_PATH, buf)
  console.log(`[istat] downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB -> ${ZIP_PATH}`)
}

function ensureExtracted(): void {
  if (existsSync(EXTRACT_DIR)) {
    console.log(`[istat] using cached extraction: ${EXTRACT_DIR}`)
    return
  }
  console.log('[istat] extracting archive...')
  const zip = new AdmZip(ZIP_PATH)
  zip.extractAllTo(EXTRACT_DIR, true)
}

function findShapefileTriplet(dirNamePattern: RegExp): { shp: string; dbf: string } {
  const dirs = readdirSync(EXTRACT_DIR).filter((d) => dirNamePattern.test(d))
  if (dirs.length === 0) throw new Error(`No extracted directory matching ${dirNamePattern} under ${EXTRACT_DIR}`)
  const dir = path.join(EXTRACT_DIR, dirs[0])
  const files = readdirSync(dir)
  const shp = files.find((f) => f.toLowerCase().endsWith('.shp'))
  const dbf = files.find((f) => f.toLowerCase().endsWith('.dbf'))
  if (!shp || !dbf) throw new Error(`Missing .shp/.dbf in ${dir}`)
  return { shp: path.join(dir, shp), dbf: path.join(dir, dbf) }
}

function reprojectRing(ring: number[][]): number[][] {
  return ring.map(([x, y]) => {
    const [lng, lat] = proj4(UTM32N_PROJ4, 'WGS84', [x, y])
    return [Number(lng.toFixed(COORD_PRECISION)), Number(lat.toFixed(COORD_PRECISION))]
  })
}

function reprojectGeometry(geometry: { type: string; coordinates: unknown }): ZoneGeometry {
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: (geometry.coordinates as number[][][]).map(reprojectRing) }
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: (geometry.coordinates as number[][][][]).map((poly) => poly.map(reprojectRing)),
    }
  }
  throw new Error(`Unsupported geometry type: ${geometry.type}`)
}

async function loadRegionNames(): Promise<Map<number, string>> {
  const { shp, dbf } = findShapefileTriplet(/^Reg\d+.*_g$/)
  const source = await shapefile.open(shp, dbf, { encoding: 'utf-8' })
  const map = new Map<number, string>()
  let result = await source.read()
  while (!result.done) {
    const p = result.value.properties as { COD_REG: number; DEN_REG: string }
    map.set(p.COD_REG, p.DEN_REG)
    result = await source.read()
  }
  return map
}

async function loadProvinceSigle(): Promise<Map<number, { sigla: string; name: string }>> {
  const { shp, dbf } = findShapefileTriplet(/^ProvCM\d+.*_g$/)
  const source = await shapefile.open(shp, dbf, { encoding: 'utf-8' })
  const map = new Map<number, { sigla: string; name: string }>()
  let result = await source.read()
  while (!result.done) {
    const p = result.value.properties as { COD_UTS: number; SIGLA: string; DEN_UTS: string }
    map.set(p.COD_UTS, { sigla: p.SIGLA, name: p.DEN_UTS })
    result = await source.read()
  }
  return map
}

interface ComuneFeature {
  istatCode: string
  name: string
  province: string | null
  region: string | null
  geometry: ZoneGeometry
}

// Simple bounded-concurrency runner so we don't open more DB connections than the pool allows.
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const item = items[cursor++]
      await worker(item)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next))
}

async function upsertComune(feature: ComuneFeature, stats: ImportStats): Promise<void> {
  const bbox = computeBBox(feature.geometry)

  let city = await prisma.city.findUnique({ where: { istatCode: feature.istatCode } })

  if (!city) {
    // Adopt a pre-existing hand-seeded city row (e.g. Milano/Torino/Roma demo data)
    // instead of creating a duplicate, matched by name since istatCode wasn't set yet.
    city = await prisma.city.findFirst({
      where: { istatCode: null, name: feature.name, country: 'IT' },
    })
  }

  if (city?.administrativeStatus === 'SUPPRESSED') {
    // Comune merged/incorporated away by administrative-reconciliation.ts — the ISTAT
    // shapefile predates that change and still lists it, but we must not resurrect it.
    stats.skippedSuppressedCities++
    return
  }

  if (city) {
    await prisma.city.update({
      where: { id: city.id },
      data: {
        name: feature.name,
        province: feature.province,
        region: feature.region,
        country: 'IT',
        istatCode: feature.istatCode,
        boundaryJson: feature.geometry,
      },
    })
    stats.citiesUpdated++
  } else {
    city = await prisma.city.create({
      data: {
        id: `city_istat_${feature.istatCode}`,
        name: feature.name,
        province: feature.province,
        region: feature.region,
        country: 'IT',
        isActive: false, // imported baseline comuni stay out of "active" pickers until curated
        istatCode: feature.istatCode,
        boundaryJson: feature.geometry,
      },
    })
    stats.citiesCreated++
  }

  // Never touch cities that already have hand-curated zones (e.g. Milano/Torino/Roma
  // district-level demo data with real feedback/reports attached to it).
  const hasCustomZones = await prisma.zone.count({ where: { cityId: city.id, type: { not: 'comune' } } })
  if (hasCustomZones > 0) {
    stats.skippedCustomZoneCities++
    return
  }

  const zoneId = `zone_istat_${feature.istatCode}`
  const existingZone = await prisma.zone.findUnique({ where: { id: zoneId } })

  await prisma.zone.upsert({
    where: { id: zoneId },
    update: {
      name: feature.name,
      geometryJson: feature.geometry,
      bboxMinLng: bbox.minLng,
      bboxMinLat: bbox.minLat,
      bboxMaxLng: bbox.maxLng,
      bboxMaxLat: bbox.maxLat,
      sourceStatus: 'municipality_fallback',
    },
    create: {
      id: zoneId,
      cityId: city.id,
      name: feature.name,
      type: 'comune',
      geometryJson: feature.geometry,
      isServiceActive: false,
      safetyScore: null,
      bboxMinLng: bbox.minLng,
      bboxMinLat: bbox.minLat,
      bboxMaxLng: bbox.maxLng,
      bboxMaxLat: bbox.maxLat,
      sourceStatus: 'municipality_fallback',
    },
  })

  if (existingZone) stats.zonesUpdated++
  else stats.zonesCreated++
}

async function main(): Promise<void> {
  const { limit, fresh, skipReconciliation } = parseArgs()

  await ensureZipDownloaded(fresh)
  ensureExtracted()

  console.log('[istat] loading region/province lookup tables...')
  const [regionNames, provinceSigle] = await Promise.all([loadRegionNames(), loadProvinceSigle()])
  console.log(`[istat] ${regionNames.size} regions, ${provinceSigle.size} province/città metropolitane`)

  const { shp, dbf } = findShapefileTriplet(/^Com\d+.*_g$/)
  const source = await shapefile.open(shp, dbf, { encoding: 'utf-8' })

  const features: ComuneFeature[] = []
  const stats: ImportStats = {
    citiesCreated: 0,
    citiesUpdated: 0,
    zonesCreated: 0,
    zonesUpdated: 0,
    skippedCustomZoneCities: 0,
    skippedSuppressedCities: 0,
    invalidGeometry: [],
  }

  console.log('[istat] parsing comuni shapefile...')
  let result = await source.read()
  while (!result.done) {
    const props = result.value.properties as {
      PRO_COM_T: string
      COMUNE: string
      COD_REG: number
      COD_UTS: number
    }

    try {
      const geometry = reprojectGeometry(result.value.geometry as { type: string; coordinates: unknown })
      if (!isValidGeometry(geometry)) {
        stats.invalidGeometry.push({ comune: props.COMUNE, istatCode: props.PRO_COM_T, reason: 'failed validation' })
      } else {
        features.push({
          istatCode: props.PRO_COM_T,
          name: props.COMUNE,
          province: provinceSigle.get(props.COD_UTS)?.sigla ?? null,
          region: regionNames.get(props.COD_REG) ?? null,
          geometry,
        })
      }
    } catch (err) {
      stats.invalidGeometry.push({
        comune: props.COMUNE,
        istatCode: props.PRO_COM_T,
        reason: err instanceof Error ? err.message : String(err),
      })
    }

    result = await source.read()
  }

  const toImport = limit ? features.slice(0, limit) : features
  console.log(`[istat] parsed ${features.length} valid comuni (importing ${toImport.length})`)

  let processed = 0
  await runPool(toImport, CONCURRENCY, async (feature) => {
    await upsertComune(feature, stats)
    processed++
    if (processed % 500 === 0) console.log(`[istat] processed ${processed}/${toImport.length}`)
  })

  console.log('\n[istat] import summary')
  console.log(`  cities created:  ${stats.citiesCreated}`)
  console.log(`  cities updated:  ${stats.citiesUpdated}`)
  console.log(`  zones created:   ${stats.zonesCreated}`)
  console.log(`  zones updated:   ${stats.zonesUpdated}`)
  console.log(`  skipped (custom zones already present): ${stats.skippedCustomZoneCities}`)
  console.log(`  skipped (suppressed by administrative reconciliation): ${stats.skippedSuppressedCities}`)
  console.log(`  invalid geometry: ${stats.invalidGeometry.length}`)
  if (stats.invalidGeometry.length > 0) {
    for (const err of stats.invalidGeometry.slice(0, 20)) {
      console.log(`    - ${err.comune} (${err.istatCode}): ${err.reason}`)
    }
    if (stats.invalidGeometry.length > 20) console.log(`    ... and ${stats.invalidGeometry.length - 20} more`)
  }

  if (skipReconciliation) {
    console.log('\n[istat] --skip-reconciliation passed, not applying administrative-changes.ts rules')
    return
  }

  console.log('\n[istat] applying administrative reconciliation (merges/incorporations/renames)...')
  const reconciliation = await applyAdministrativeChanges(prisma)
  console.log(`  applied: ${reconciliation.applied.length}`)
  reconciliation.applied.forEach((r) => console.log(`    - ${r}`))
  console.log(`  skipped (already applied): ${reconciliation.skipped.length}`)
  console.log(`  errors: ${reconciliation.errors.length}`)
  reconciliation.errors.forEach((e) => console.log(`    - ${e.rule}: ${e.reason}`))
}

main()
  .catch((e) => {
    console.error('[istat] import failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
