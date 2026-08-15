/**
 * Torino — 23 quartieri, official Comune di Torino open data.
 *
 * Source: aperTO (Comune di Torino open data portal, CKAN), dataset "Quartieri":
 *   https://aperto.comune.torino.it/dataset/quartieri
 * Direct download (ESRI Shapefile, WGS84 / EPSG:4326):
 *   https://risorse.comune.torino.it/opendata/geodata/quartieri.zip
 * License: Creative Commons Attribution (CC-BY), per the dataset's license_id "cc-by".
 * Dataset last modified: 2019-10-17 (CKAN metadata_modified), verified via the
 * aperTO CKAN API (GET /api/3/action/package_show?id=quartieri).
 *
 * This is the finer of Torino's two official subdivisions (8 circoscrizioni vs.
 * 23 quartieri) and the one whose denominations match neighborhood names in
 * everyday use (San Salvario, Vanchiglia, Crocetta, Barriera di Milano, ...),
 * which is also what the previous hand-drawn demo zones tried to approximate.
 * Attributes verified by inspecting the shapefile directly: ID_QUART (stable
 * per-quartiere id) and DENOM (official name), CRS confirmed WGS84 via the .prj
 * (GCS_WGS_1984) — no reprojection needed, unlike the ISTAT comuni importer.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import AdmZip from 'adm-zip'
import shapefile from 'shapefile'
import { roundGeometry, type ZoneGeometry } from '../../geo.js'
import type { SubMunicipalFeature, SubMunicipalSource } from '../types.js'

const DATA_DIR = process.env.TORINO_QUARTIERI_DATA_DIR ?? path.resolve(import.meta.dirname, '../../../../data/submunicipal/torino-quartieri')
const ZIP_URL = process.env.TORINO_QUARTIERI_ZIP_URL ?? 'https://risorse.comune.torino.it/opendata/geodata/quartieri.zip'
const ZIP_PATH = path.join(DATA_DIR, 'quartieri.zip')
const EXTRACT_DIR = path.join(DATA_DIR, 'extracted')
const SHP_BASENAME = 'ex_neighborhood_boundary' // fixed name inside the official ZIP

async function fetch_(opts: { fresh: boolean }): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true })

  if (existsSync(ZIP_PATH) && !opts.fresh) {
    console.log(`[torino-quartieri] using cached archive: ${ZIP_PATH}`)
  } else {
    console.log(`[torino-quartieri] downloading ${ZIP_URL} ...`)
    const res = await fetch(ZIP_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (SafeRoute importer)' } })
    if (!res.ok) {
      throw new Error(
        `Download failed (${res.status} ${res.statusText}). If aperTO changed the URL, get it manually from ` +
          `https://aperto.comune.torino.it/dataset/quartieri, save it as ${ZIP_PATH}, and re-run.`
      )
    }
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(ZIP_PATH, buf)
    console.log(`[torino-quartieri] downloaded ${(buf.length / 1024).toFixed(0)} KB -> ${ZIP_PATH}`)
  }

  if (!existsSync(EXTRACT_DIR)) {
    console.log('[torino-quartieri] extracting archive...')
    new AdmZip(ZIP_PATH).extractAllTo(EXTRACT_DIR, true)
  }
}

async function parse_(): Promise<SubMunicipalFeature[]> {
  const shp = path.join(EXTRACT_DIR, `${SHP_BASENAME}.shp`)
  const dbf = path.join(EXTRACT_DIR, `${SHP_BASENAME}.dbf`)
  const source = await shapefile.open(shp, dbf, { encoding: 'utf-8' })

  const features: SubMunicipalFeature[] = []
  let result = await source.read()
  while (!result.done) {
    const props = result.value.properties as { ID_QUART: number; DENOM: string }
    const geometry = roundGeometry(result.value.geometry as ZoneGeometry)
    features.push({ sourceId: String(props.ID_QUART), name: props.DENOM, geometry })
    result = await source.read()
  }
  return features
}

export const torinoQuartieriSource: SubMunicipalSource = {
  id: 'comune-torino-quartieri',
  label: 'Torino — 23 quartieri (Comune di Torino / aperTO)',
  cityIstatCode: '001272', // Torino
  sourceType: 'quartiere',
  license: 'CC-BY (Creative Commons Attribution)',
  sourceUpdatedAt: '2019-10-17',
  fetch: fetch_,
  parse: parse_,
}
