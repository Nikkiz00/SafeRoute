/**
 * Generic sub-municipal import engine: fetch -> parse -> validate -> associate
 * city (by cityIstatCode) -> upsert Zone -> retire superseded zones for that city.
 *
 * "Superseded" means any pre-existing zone for the same city whose type differs
 * from this source's sourceType — that covers both the comune-wide baseline zone
 * from the ISTAT importer (type="comune", see docs/step-4-0-*.md) and any legacy
 * hand-drawn zone (e.g. old type="district" demo data). Real feedback/report/
 * routeZoneCrossing rows are migrated to the new zone with the largest geometric
 * overlap before the old zone is deleted, so a city never loses data by gaining
 * real sub-municipal geometry.
 */
import { area as turfArea, centroid as turfCentroid, distance as turfDistance, feature, featureCollection, intersect as turfIntersect } from '@turf/turf'
import type { Prisma, PrismaClient } from '@prisma/client'
import { computeBBox, isValidGeometry, type ZoneGeometry } from '../geo.js'
import type { SubMunicipalFeature, SubMunicipalSource } from './types.js'

type Tx = Prisma.TransactionClient

export interface SubMunicipalImportStats {
  source: string
  cityIstatCode: string
  cityName: string
  featuresParsed: number
  zonesCreated: number
  zonesUpdated: number
  zonesRetired: number
  invalidGeometry: { sourceId: string; name: string; reason: string }[]
}

function zoneIdFor(source: SubMunicipalSource, sourceId: string): string {
  return `zone_${source.cityIstatCode}_${source.id}_${sourceId}`
}

async function migrateZoneReferences(tx: Tx, fromZoneId: string, toZoneId: string): Promise<void> {
  await tx.zoneFeedback.updateMany({ where: { zoneId: fromZoneId }, data: { zoneId: toZoneId } })
  await tx.report.updateMany({ where: { zoneId: fromZoneId }, data: { zoneId: toZoneId } })
  await tx.routeZoneCrossing.updateMany({ where: { zoneId: fromZoneId }, data: { zoneId: toZoneId } })
}

/**
 * Among the newly imported zones, picks the one that best replaces `oldGeometry`
 * for the purpose of carrying over feedback/report/tracking references: largest
 * intersection area, falling back to nearest centroid if nothing actually
 * overlaps (shouldn't happen for a real replacement, but we never want to drop
 * references silently).
 */
function pickReplacementZone(
  oldGeometry: ZoneGeometry,
  candidates: { id: string; geometry: ZoneGeometry }[]
): string | null {
  if (candidates.length === 0) return null

  const oldFeature = feature(oldGeometry)
  let best: { id: string; overlapArea: number } | null = null

  for (const c of candidates) {
    try {
      const intersection = turfIntersect(featureCollection([oldFeature, feature(c.geometry)]))
      if (!intersection) continue
      const overlapArea = turfArea(intersection)
      if (!best || overlapArea > best.overlapArea) best = { id: c.id, overlapArea }
    } catch {
      // Non-intersecting or degenerate pair — skip, fall back to centroid distance below.
    }
  }
  if (best && best.overlapArea > 0) return best.id

  const oldCentroid = turfCentroid(oldFeature)
  let nearest: { id: string; dist: number } | null = null
  for (const c of candidates) {
    const dist = turfDistance(oldCentroid, turfCentroid(feature(c.geometry)))
    if (!nearest || dist < nearest.dist) nearest = { id: c.id, dist }
  }
  return nearest?.id ?? null
}

export async function importSubMunicipalSource(
  prisma: PrismaClient,
  source: SubMunicipalSource,
  opts: { fresh?: boolean } = {}
): Promise<SubMunicipalImportStats> {
  await source.fetch({ fresh: opts.fresh ?? false })
  const rawFeatures = await source.parse()

  const city = await prisma.city.findUnique({ where: { istatCode: source.cityIstatCode } })
  if (!city) {
    throw new Error(
      `[submunicipal] no City found for istatCode=${source.cityIstatCode} (source=${source.id}). ` +
        `Run "npm run import:istat" first so the parent comune exists.`
    )
  }

  const stats: SubMunicipalImportStats = {
    source: source.id,
    cityIstatCode: source.cityIstatCode,
    cityName: city.name,
    featuresParsed: rawFeatures.length,
    zonesCreated: 0,
    zonesUpdated: 0,
    zonesRetired: 0,
    invalidGeometry: [],
  }

  const validFeatures: SubMunicipalFeature[] = []
  for (const f of rawFeatures) {
    if (!isValidGeometry(f.geometry)) {
      stats.invalidGeometry.push({ sourceId: f.sourceId, name: f.name, reason: 'failed geometry validation' })
      continue
    }
    validFeatures.push(f)
  }

  const sourceUpdatedAt = new Date(source.sourceUpdatedAt)
  const writtenIds: string[] = []

  for (const f of validFeatures) {
    const zoneId = zoneIdFor(source, f.sourceId)
    const bbox = computeBBox(f.geometry)
    const existing = await prisma.zone.findUnique({ where: { id: zoneId } })

    await prisma.zone.upsert({
      where: { id: zoneId },
      update: {
        name: f.name,
        type: source.sourceType,
        geometryJson: f.geometry,
        bboxMinLng: bbox.minLng,
        bboxMinLat: bbox.minLat,
        bboxMaxLng: bbox.maxLng,
        bboxMaxLat: bbox.maxLat,
        source: source.id,
        sourceId: f.sourceId,
        sourceType: source.sourceType,
        sourceStatus: source.qualityStatus,
        sourceUpdatedAt,
        cityIstatCode: source.cityIstatCode,
      },
      create: {
        id: zoneId,
        cityId: city.id,
        name: f.name,
        type: source.sourceType,
        geometryJson: f.geometry,
        // No invented safety score: honest "unknown" until real feedback/reports
        // accumulate, or an admin explicitly activates the zone (same policy as
        // the comune-level baseline zones from Step 4.0).
        isServiceActive: false,
        safetyScore: null,
        bboxMinLng: bbox.minLng,
        bboxMinLat: bbox.minLat,
        bboxMaxLng: bbox.maxLng,
        bboxMaxLat: bbox.maxLat,
        source: source.id,
        sourceId: f.sourceId,
        sourceType: source.sourceType,
        sourceStatus: source.qualityStatus,
        sourceUpdatedAt,
        cityIstatCode: source.cityIstatCode,
      },
    })

    writtenIds.push(zoneId)
    if (existing) stats.zonesUpdated++
    else stats.zonesCreated++
  }

  const toRetire = await prisma.zone.findMany({
    where: { cityId: city.id, type: { not: source.sourceType } },
  })

  for (const oldZone of toRetire) {
    await prisma.$transaction(async (tx) => {
      const candidates = await tx.zone.findMany({
        where: { id: { in: writtenIds } },
        select: { id: true, geometryJson: true },
      })
      const replacementId = pickReplacementZone(
        oldZone.geometryJson as ZoneGeometry,
        candidates.map((c) => ({ id: c.id, geometry: c.geometryJson as ZoneGeometry }))
      )
      if (replacementId) {
        await migrateZoneReferences(tx, oldZone.id, replacementId)
      }
      await tx.zone.delete({ where: { id: oldZone.id } })
    })
    stats.zonesRetired++
  }

  return stats
}
