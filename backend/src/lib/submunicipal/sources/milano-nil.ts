/**
 * Milano — 88 NIL (Nuclei d'Identità Locale), official Comune di Milano open data.
 *
 * Source: dati.comune.milano.it (CKAN), dataset "Nuclei d'Identità Locale (NIL)
 * VIGENTI - PGT 2030":
 *   https://dati.comune.milano.it/dataset/ds964-nil-vigenti-pgt-2030
 * Direct download (GeoJSON, WGS84 / EPSG:4326 — confirmed by the file's own
 * `crs` member, "EPSG:4326", and by sample coordinates falling inside Milano's
 * real WGS84 bounding box):
 *   https://dati.comune.milano.it/dataset/e8e765fc-d882-40b8-95d8-16ff3d39eb7c/resource/9c4e0776-56fc-4f3d-8a90-f4992a3be426/download/ds964_nil_wm.geojson
 * License: Creative Commons Attribution (CC-BY), per the dataset's license_id
 * "cc-by" (verified via the CKAN API, GET /api/3/action/package_show?id=ds964-nil-vigenti-pgt-2030).
 *
 * This is the *current* NIL dataset (properties include `Valido_al: "Vigente"`,
 * source "Milano 2030 - PGT Approvato"). Milano also publishes an explicitly
 * superseded dataset ("Nuclei d'Identità Locale (NIL) - OBSOLETI") which is
 * intentionally NOT used here.
 *
 * No shapefile/reprojection step needed here (unlike Torino, which ships a
 * shapefile with an ISTAT-style .prj): this is plain GeoJSON already in WGS84,
 * so fetch+parse only download and re-shape it — no coordinate transform.
 * Attributes verified by inspecting the file directly: ID_NIL (stable id) and
 * NIL (official denomination). All 88 features are type "Polygon" in this
 * dataset; MultiPolygon support comes from the shared engine/geo.ts (already
 * exercised by Torino's Regio Parco / Mirafiori Sud) and needs no Milano-
 * specific code.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { roundGeometry, type ZoneGeometry } from '../../geo.js'
import type { SubMunicipalFeature, SubMunicipalSource } from '../types.js'

const DATA_DIR = process.env.MILANO_NIL_DATA_DIR ?? path.resolve(import.meta.dirname, '../../../../data/submunicipal/milano-nil')
const GEOJSON_URL =
  process.env.MILANO_NIL_URL ??
  'https://dati.comune.milano.it/dataset/e8e765fc-d882-40b8-95d8-16ff3d39eb7c/resource/9c4e0776-56fc-4f3d-8a90-f4992a3be426/download/ds964_nil_wm.geojson'
const FILE_PATH = path.join(DATA_DIR, 'nil.geojson')

interface NilFeatureRaw {
  properties: { ID_NIL: number; NIL: string }
  geometry: { type: string; coordinates: unknown }
}

async function fetch_(opts: { fresh: boolean }): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true })

  if (existsSync(FILE_PATH) && !opts.fresh) {
    console.log(`[milano-nil] using cached file: ${FILE_PATH}`)
    return
  }
  console.log(`[milano-nil] downloading ${GEOJSON_URL} ...`)
  const res = await fetch(GEOJSON_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (SafeRoute importer)' } })
  if (!res.ok) {
    throw new Error(
      `Download failed (${res.status} ${res.statusText}). If dati.comune.milano.it changed the URL, get it ` +
        `manually from https://dati.comune.milano.it/dataset/ds964-nil-vigenti-pgt-2030, save it as ${FILE_PATH}, and re-run.`
    )
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(FILE_PATH, buf)
  console.log(`[milano-nil] downloaded ${(buf.length / 1024).toFixed(0)} KB -> ${FILE_PATH}`)
}

async function parse_(): Promise<SubMunicipalFeature[]> {
  const raw = JSON.parse(await readFile(FILE_PATH, 'utf-8')) as {
    crs?: { properties?: { name?: string } }
    features: NilFeatureRaw[]
  }

  const crsName = raw.crs?.properties?.name ?? ''
  if (!crsName.includes('4326')) {
    throw new Error(`[milano-nil] unexpected CRS "${crsName}" — expected EPSG:4326, refusing to import unreprojected geometry`)
  }

  // Geometry validity (isValidGeometry) is checked by the engine, which also
  // reports and skips anything invalid — no filtering needed here.
  return raw.features.map((f) => {
    const geometry = roundGeometry(f.geometry as ZoneGeometry)
    return { sourceId: String(f.properties.ID_NIL), name: f.properties.NIL, geometry }
  })
}

export const milanoNilSource: SubMunicipalSource = {
  id: 'comune-milano-nil',
  label: "Milano — 88 NIL (Comune di Milano / dati.comune.milano.it)",
  cityIstatCode: '015146', // Milano
  sourceType: 'nil',
  license: 'CC-BY (Creative Commons Attribution)',
  sourceUpdatedAt: '2026-05-08',
  qualityStatus: 'official',
  fetch: fetch_,
  parse: parse_,
}
