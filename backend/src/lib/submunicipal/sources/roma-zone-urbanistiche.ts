/**
 * Roma — 155 zone urbanistiche, official Roma Capitale open geodata.
 *
 * Source: Geoportale di Roma Capitale, WFS layer `DIPDIT:ZoneUrbanistiche`
 * (department: Dipartimento Programmazione e Attuazione Urbanistica):
 *   https://geoportale.comune.roma.it/catalogo/  (catalog entry: "Zone Urbanistiche",
 *   TEMATISMO "LIMITI AMMINISTRATIVI", PUBBLICO "SI")
 * Direct GetFeature (GeoJSON):
 *   https://geoportale.comune.roma.it/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=DIPDIT:ZoneUrbanistiche&outputFormat=application/json
 * License/reuse: no formal license badge (no IODL/CC-BY label found on the
 * portal), but Roma Capitale's own open-data page states data are "liberamente
 * accessibili ... il cui riutilizzo è soggetto alla sola indicazione della
 * fonte" (https://www.comune.roma.it/web/it/open-data.page) — free reuse,
 * attribution-only, functionally equivalent to CC-BY. Quoted verbatim in
 * docs/step-4-3-roma-submunicipal.md rather than assuming a formal license name.
 *
 * CRS: EPSG:6708 (RDN2008 / UTM zone 33N — Italy's current national geodetic
 * datum), confirmed by the `crs` member of the GetFeature response itself.
 * Reprojected to WGS84 via reprojectGeometry() (geo.ts) using the standard
 * UTM33N/GRS80 proj4 definition (RDN2008 and WGS84/GRS80 coincide to sub-
 * meter accuracy — the same "+towgs84=0,0,0,..." identity shift used by
 * epsg.io for this EPSG code). Verified against known landmarks during
 * validation (see the Step 4.3 report) before trusting the dataset.
 *
 * ## Why "zone urbanistiche" and not another Roma subdivision
 * Compared before choosing (see docs/step-4-3-roma-submunicipal.md §1 for
 * the full comparison):
 *   - Municipi (15, WFS `DIPPC:210_RomaCapitale_Municipi`): official but far
 *     too coarse for a comune of ~1,285 km² — same problem Torino's 8
 *     circoscrizioni had vs. its 23 quartieri (see Step 4.1).
 *   - "327 quartieri / 22 rioni / 104 zone funzionali" (new map presented
 *     2025, public comments open until 2026-01-15): NOT used — as of this
 *     import, no matching layer exists in the geoportale's WFS
 *     GetCapabilities. Fails the "geometrie complete/fonte con geometrie
 *     utilizzabili" and "stabilità" criteria today; a real future upgrade
 *     path once Roma Capitale actually publishes it as geodata (see report §9).
 *   - Zone urbanistiche (155, `DIPDIT:ZoneUrbanistiche`): established 1977,
 *     stable at 155 since Fiumicino's 1992 secession, live and downloadable
 *     right now, fine-grained enough to separate Trastevere/Centro
 *     Storico/EUR/Parioli/Ostia (verified — Ostia alone is split into 3
 *     zones: "Ostia Nord/Sud/Antica"). Chosen.
 *
 * Attributes verified by inspecting the GetFeature response directly:
 * ZONA_URBANISTICA (alphanumeric code, e.g. "10a" — stable id, all 155
 * verified unique) and DENOMINAZIONE (official name). All 155 features are
 * MultiPolygon in this dataset — the first source so far where MultiPolygon
 * is the norm rather than the exception (Torino: 2/23, Milano: 0/88).
 */
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { reprojectGeometry } from '../../geo.js'
import type { SubMunicipalFeature, SubMunicipalSource } from '../types.js'

const DATA_DIR = process.env.ROMA_ZONE_URBANISTICHE_DATA_DIR ?? path.resolve(import.meta.dirname, '../../../../data/submunicipal/roma-zone-urbanistiche')
const WFS_URL =
  process.env.ROMA_ZONE_URBANISTICHE_URL ??
  'https://geoportale.comune.roma.it/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=DIPDIT:ZoneUrbanistiche&outputFormat=application/json'
const FILE_PATH = path.join(DATA_DIR, 'zone-urbanistiche.json')

// RDN2008 / UTM zone 33N (EPSG:6708). RDN2008 and WGS84/GRS80 are treated as
// coincident (identity datum shift) for this precision, matching epsg.io's
// published proj4 definition for this EPSG code.
const RDN2008_UTM33N_PROJ4 = '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'

interface ZonaUrbanisticaFeatureRaw {
  properties: { ZONA_URBANISTICA: string; DENOMINAZIONE: string }
  geometry: { type: string; coordinates: unknown }
}

async function fetch_(opts: { fresh: boolean }): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true })

  if (existsSync(FILE_PATH) && !opts.fresh) {
    console.log(`[roma-zone-urbanistiche] using cached file: ${FILE_PATH}`)
    return
  }
  console.log(`[roma-zone-urbanistiche] downloading ${WFS_URL} ...`)
  const res = await fetch(WFS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (SafeRoute importer)' } })
  if (!res.ok) {
    throw new Error(
      `Download failed (${res.status} ${res.statusText}). If the geoportale changed the endpoint, get it manually ` +
        `from https://geoportale.comune.roma.it/catalogo/ (layer "Zone Urbanistiche"), save it as ${FILE_PATH}, and re-run.`
    )
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(FILE_PATH, buf)
  console.log(`[roma-zone-urbanistiche] downloaded ${(buf.length / 1024).toFixed(0)} KB -> ${FILE_PATH}`)
}

async function parse_(): Promise<SubMunicipalFeature[]> {
  const raw = JSON.parse(await readFile(FILE_PATH, 'utf-8')) as {
    crs?: { properties?: { name?: string } }
    features: ZonaUrbanisticaFeatureRaw[]
  }

  const crsName = raw.crs?.properties?.name ?? ''
  if (!crsName.includes('6708')) {
    throw new Error(
      `[roma-zone-urbanistiche] unexpected CRS "${crsName}" — expected EPSG:6708, refusing to reproject with the wrong parameters`
    )
  }

  return raw.features.map((f) => {
    const geometry = reprojectGeometry(
      f.geometry as { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown },
      RDN2008_UTM33N_PROJ4
    )
    return { sourceId: f.properties.ZONA_URBANISTICA, name: f.properties.DENOMINAZIONE, geometry }
  })
}

export const romaZoneUrbanisticheSource: SubMunicipalSource = {
  id: 'comune-roma-zone-urbanistiche',
  label: 'Roma — 155 zone urbanistiche (Roma Capitale / geoportale.comune.roma.it)',
  cityIstatCode: '058091', // Roma
  sourceType: 'zona_urbanistica',
  license: 'Riuso libero con sola indicazione della fonte (comune.roma.it/web/it/open-data.page) — nessuna licenza formale pubblicata',
  sourceUpdatedAt: '1992-01-01', // 155 zones stable since Fiumicino's 1992 secession; no machine-readable revision date published (see report §8)
  fetch: fetch_,
  parse: parse_,
}
