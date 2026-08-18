/**
 * Applies the declarative rules from administrative-changes.ts against the database:
 * unions geometries, migrates feedback/report/tracking references, and marks
 * superseded comuni as SUPPRESSED instead of deleting them.
 *
 * Geometry unions are always recomputed from `City.boundaryJson` (never from
 * `Zone.geometryJson`): the source's boundaryJson is frozen the moment it's marked
 * SUPPRESSED (the base importer skips suppressed cities entirely), but the target/
 * result's Zone can still be legitimately rewritten by re-running the base ISTAT
 * importer against the (still pre-change) shapefile. Recomputing the union from
 * boundaryJson every time makes reconciliation self-healing against that instead of
 * relying on a one-shot "already applied" flag that a later base-import re-run could
 * silently invalidate.
 */
import { feature, featureCollection, union as turfUnion } from '@turf/turf'
import type { City, Prisma, PrismaClient } from '@prisma/client'
import { computeBBox, isValidGeometry, type ZoneGeometry } from './geo.js'
import { ADMINISTRATIVE_CHANGES, type IncorporationRule, type MergeRule, type RenameRule } from './administrative-changes.js'

type Tx = Prisma.TransactionClient

export interface ReconciliationStats {
  applied: string[]
  skipped: string[]
  errors: { rule: string; reason: string }[]
}

function unionGeometries(geometries: ZoneGeometry[]): ZoneGeometry {
  if (geometries.length === 1) return geometries[0]

  const fc = featureCollection(geometries.map((g) => feature(g)))
  const result = turfUnion(fc)

  if (!result || !isValidGeometry(result.geometry)) {
    throw new Error('turf.union produced an invalid or empty geometry')
  }
  return result.geometry
}

async function migrateZoneReferences(tx: Tx, fromZoneId: string, toZoneId: string): Promise<void> {
  await tx.zoneFeedback.updateMany({ where: { zoneId: fromZoneId }, data: { zoneId: toZoneId } })
  await tx.report.updateMany({ where: { zoneId: fromZoneId }, data: { zoneId: toZoneId } })
  await tx.routeZoneCrossing.updateMany({ where: { zoneId: fromZoneId }, data: { zoneId: toZoneId } })
}

async function applyIncorporation(prisma: PrismaClient, rule: IncorporationRule, stats: ReconciliationStats): Promise<void> {
  const label = `incorporation: ${rule.source.name} -> ${rule.target.name}`

  const source = await prisma.city.findUnique({ where: { istatCode: rule.source.istatCode } })
  const target = await prisma.city.findUnique({ where: { istatCode: rule.target.istatCode } })

  if (!source) {
    // Once suppressed the source row is kept forever (historical/succession record), so
    // "not found at all" only happens if it was never imported in the first place.
    stats.errors.push({ rule: label, reason: `source city istatCode=${rule.source.istatCode} not found` })
    return
  }
  if (!target) {
    stats.errors.push({ rule: label, reason: `target city istatCode=${rule.target.istatCode} not found` })
    return
  }
  if (!isValidGeometry(source.boundaryJson)) {
    stats.errors.push({ rule: label, reason: 'source city has no valid boundaryJson to union' })
    return
  }
  if (!isValidGeometry(target.boundaryJson)) {
    stats.errors.push({ rule: label, reason: 'target city has no valid boundaryJson to union against' })
    return
  }

  await prisma.$transaction(async (tx) => {
    const unioned = unionGeometries([source.boundaryJson as ZoneGeometry, target.boundaryJson as ZoneGeometry])
    const bbox = computeBBox(unioned)

    const targetZone = await tx.zone.findFirst({ where: { cityId: target.id, type: 'comune' } })
    const finalTargetZone = targetZone
      ? await tx.zone.update({
          where: { id: targetZone.id },
          data: {
            geometryJson: unioned,
            bboxMinLng: bbox.minLng,
            bboxMinLat: bbox.minLat,
            bboxMaxLng: bbox.maxLng,
            bboxMaxLat: bbox.maxLat,
            sourceStatus: 'municipality_fallback',
          },
        })
      : await tx.zone.create({
          data: {
            id: `zone_istat_${rule.target.istatCode}`,
            cityId: target.id,
            name: rule.target.name,
            type: 'comune',
            geometryJson: unioned,
            isServiceActive: false,
            finalSafetyScore: null,
            bboxMinLng: bbox.minLng,
            bboxMinLat: bbox.minLat,
            bboxMaxLng: bbox.maxLng,
            bboxMaxLat: bbox.maxLat,
            sourceStatus: 'municipality_fallback',
          },
        })

    const sourceZone = await tx.zone.findFirst({ where: { cityId: source.id, type: 'comune' } })
    if (sourceZone) {
      await migrateZoneReferences(tx, sourceZone.id, finalTargetZone.id)
      await tx.zone.delete({ where: { id: sourceZone.id } })
    }

    if (source.administrativeStatus !== 'SUPPRESSED') {
      await tx.city.update({
        where: { id: source.id },
        data: { administrativeStatus: 'SUPPRESSED', succeededByCityId: target.id, isActive: false },
      })
    }
  })

  stats.applied.push(label)
}

async function applyMerge(prisma: PrismaClient, rule: MergeRule, stats: ReconciliationStats): Promise<void> {
  const label = `merge: [${rule.sources.map((s) => s.name).join(' + ')}] -> ${rule.result.name}`

  const sourceCities = await Promise.all(
    rule.sources.map((s) => prisma.city.findUnique({ where: { istatCode: s.istatCode } }))
  )
  const missing = sourceCities.filter((c) => c === null)
  if (missing.length > 0) {
    stats.errors.push({ rule: label, reason: `${missing.length} source cities not found by istatCode` })
    return
  }
  const sources = sourceCities as City[]

  const invalidBoundary = sources.filter((c) => !isValidGeometry(c.boundaryJson))
  if (invalidBoundary.length > 0) {
    stats.errors.push({
      rule: label,
      reason: `source cities without valid boundaryJson: ${invalidBoundary.map((c) => c.name).join(', ')}`,
    })
    return
  }

  await prisma.$transaction(async (tx) => {
    const unioned = unionGeometries(sources.map((c) => c.boundaryJson as ZoneGeometry))
    const bbox = computeBBox(unioned)

    let result = await tx.city.findUnique({ where: { istatCode: rule.result.istatCode } })
    if (!result) {
      result = await tx.city.create({
        data: {
          id: `city_istat_${rule.result.istatCode}`,
          name: rule.result.name,
          province: rule.result.province,
          region: rule.result.region,
          country: 'IT',
          isActive: false,
          istatCode: rule.result.istatCode,
          administrativeStatus: 'ACTIVE',
          boundaryJson: unioned,
        },
      })
    } else {
      await tx.city.update({ where: { id: result.id }, data: { boundaryJson: unioned } })
    }

    const resultZone = await tx.zone.findFirst({ where: { cityId: result.id, type: 'comune' } })
    const finalResultZone = resultZone
      ? await tx.zone.update({
          where: { id: resultZone.id },
          data: {
            geometryJson: unioned,
            bboxMinLng: bbox.minLng,
            bboxMinLat: bbox.minLat,
            bboxMaxLng: bbox.maxLng,
            bboxMaxLat: bbox.maxLat,
            sourceStatus: 'municipality_fallback',
          },
        })
      : await tx.zone.create({
          data: {
            id: `zone_istat_${rule.result.istatCode}`,
            cityId: result.id,
            name: rule.result.name,
            type: 'comune',
            geometryJson: unioned,
            isServiceActive: false,
            finalSafetyScore: null,
            bboxMinLng: bbox.minLng,
            bboxMinLat: bbox.minLat,
            bboxMaxLng: bbox.maxLng,
            bboxMaxLat: bbox.maxLat,
            sourceStatus: 'municipality_fallback',
          },
        })

    for (const c of sources) {
      const sZone = await tx.zone.findFirst({ where: { cityId: c.id, type: 'comune' } })
      if (sZone) {
        await migrateZoneReferences(tx, sZone.id, finalResultZone.id)
        await tx.zone.delete({ where: { id: sZone.id } })
      }
      if (c.administrativeStatus !== 'SUPPRESSED') {
        await tx.city.update({
          where: { id: c.id },
          data: { administrativeStatus: 'SUPPRESSED', succeededByCityId: result.id, isActive: false },
        })
      }
    }
  })

  stats.applied.push(label)
}

async function applyRename(prisma: PrismaClient, rule: RenameRule, stats: ReconciliationStats): Promise<void> {
  const label = `rename: ${rule.istatCode} -> ${rule.newName}`
  const city = await prisma.city.findUnique({ where: { istatCode: rule.istatCode } })
  if (!city) {
    stats.errors.push({ rule: label, reason: 'city not found by istatCode' })
    return
  }
  if (city.name === rule.newName) {
    stats.skipped.push(label)
    return
  }
  await prisma.city.update({ where: { id: city.id }, data: { name: rule.newName } })
  stats.applied.push(label)
}

export async function applyAdministrativeChanges(prisma: PrismaClient): Promise<ReconciliationStats> {
  const stats: ReconciliationStats = { applied: [], skipped: [], errors: [] }

  for (const rule of ADMINISTRATIVE_CHANGES) {
    try {
      if (rule.type === 'incorporation') await applyIncorporation(prisma, rule, stats)
      else if (rule.type === 'merge') await applyMerge(prisma, rule, stats)
      else await applyRename(prisma, rule, stats)
    } catch (err) {
      stats.errors.push({
        rule: `${rule.type}: ${JSON.stringify(rule)}`,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return stats
}
