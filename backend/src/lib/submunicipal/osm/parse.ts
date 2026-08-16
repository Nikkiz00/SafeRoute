/** Maps raw Overpass elements to candidate SubMunicipalFeature — one element, one feature. */
import { isValidGeometry } from '../../geo.js'
import type { SubMunicipalFeature } from '../types.js'
import type { OverpassJson } from './overpass-client.js'
import { buildGeometryFromElement } from './ring-assembly.js'

export interface OsmParseStats {
  totalElements: number
  skippedUnnamed: number
  skippedUnclosedGeometry: number
  skippedInvalidGeometry: number
}

export function parseOsmElements(json: OverpassJson): { features: SubMunicipalFeature[]; stats: OsmParseStats } {
  const stats: OsmParseStats = {
    totalElements: json.elements.length,
    skippedUnnamed: 0,
    skippedUnclosedGeometry: 0,
    skippedInvalidGeometry: 0,
  }
  const features: SubMunicipalFeature[] = []

  for (const el of json.elements) {
    const name = el.tags?.name
    if (!name) {
      stats.skippedUnnamed++
      continue
    }

    const geometry = buildGeometryFromElement(el)
    if (!geometry) {
      stats.skippedUnclosedGeometry++
      continue
    }
    if (!isValidGeometry(geometry)) {
      stats.skippedInvalidGeometry++
      continue
    }

    features.push({ sourceId: `osm-${el.type}-${el.id}`, name, geometry })
  }

  return { features, stats }
}
