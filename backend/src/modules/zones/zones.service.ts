import { prisma } from '@/config/database.js'
import type { ZoneLevel, ZoneResponse, ZoneSafetySummary } from './zones.types.js'

function getSafetyLevel(score: number | null, isServiceActive: boolean): ZoneLevel {
  if (score === null || !isServiceActive) return 'unknown'
  if (score >= 75) return 'safe'
  if (score >= 50) return 'caution'
  if (score >= 25) return 'danger'
  return 'critical'
}

function getLevelColor(level: ZoneLevel): string {
  switch (level) {
    case 'safe':     return '#22C55E'
    case 'caution':  return '#FACC15'
    case 'danger':   return '#EF4444'
    case 'critical': return '#8B5CF6'
    case 'unknown':  return '#CBD5E1'
  }
}

function parseGeometry(json: unknown): ZoneResponse['geometry'] {
  return json as ZoneResponse['geometry']
}

function getGeometryBBox(geometry: ZoneResponse['geometry']): [number, number, number, number] {
  const ring = geometry.coordinates[0]
  let minLng = ring[0][0]
  let maxLng = ring[0][0]
  let minLat = ring[0][1]
  let maxLat = ring[0][1]

  for (const point of ring) {
    if (point[0] < minLng) minLng = point[0]
    if (point[0] > maxLng) maxLng = point[0]
    if (point[1] < minLat) minLat = point[1]
    if (point[1] > maxLat) maxLat = point[1]
  }

  return [minLng, minLat, maxLng, maxLat]
}

function bboxIntersects(
  zoneBBox: [number, number, number, number],
  filterBBox: [number, number, number, number]
): boolean {
  const [zMinLng, zMinLat, zMaxLng, zMaxLat] = zoneBBox
  const [fMinLng, fMinLat, fMaxLng, fMaxLat] = filterBBox
  return !(zMaxLng < fMinLng || zMinLng > fMaxLng || zMaxLat < fMinLat || zMinLat > fMaxLat)
}

export async function getZones(opts: {
  cityId?: string
  bbox?: string
}): Promise<ZoneResponse[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const whereClause = opts.cityId ? { cityId: opts.cityId } : {}

  const [zones, feedbackGroups, reportGroups] = await Promise.all([
    prisma.zone.findMany({
      where: whereClause,
      include: { city: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.zoneFeedback.groupBy({
      by: ['zoneId'],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.report.groupBy({
      by: ['zoneId'],
      _count: { id: true },
      where: { status: 'approved', createdAt: { gte: thirtyDaysAgo } },
    }),
  ])

  const feedbackMap = new Map<string, number>()
  for (const row of feedbackGroups) {
    feedbackMap.set(row.zoneId, row._count.id)
  }

  const reportMap = new Map<string, number>()
  for (const row of reportGroups) {
    reportMap.set(row.zoneId, row._count.id)
  }

  let results: ZoneResponse[] = zones.map((zone) => {
    const feedbackCount = feedbackMap.get(zone.id) ?? 0
    const reportsCount = reportMap.get(zone.id) ?? 0
    const level = getSafetyLevel(zone.safetyScore, zone.isServiceActive)
    const color = getLevelColor(level)
    const geometry = parseGeometry(zone.geometryJson)

    return {
      id: zone.id,
      name: zone.name,
      cityId: zone.city.id,
      cityName: zone.city.name,
      province: zone.city.province,
      region: zone.city.region,
      type: zone.type,
      isServiceActive: zone.isServiceActive,
      safetyScore: zone.safetyScore,
      level,
      color,
      feedbackCount,
      reportsCount,
      sosCount: 0,
      lastUpdated: zone.updatedAt.toISOString(),
      geometry,
    }
  })

  if (opts.bbox) {
    const parts = opts.bbox.split(',').map(Number)
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      const filterBBox: [number, number, number, number] = [parts[0], parts[1], parts[2], parts[3]]
      results = results.filter((zone) => {
        try {
          const zoneBBox = getGeometryBBox(zone.geometry)
          return bboxIntersects(zoneBBox, filterBBox)
        } catch {
          return true
        }
      })
    }
  }

  return results
}

export async function getZoneById(id: string): Promise<ZoneResponse | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [zone, feedbackCount, reportsCount] = await Promise.all([
    prisma.zone.findUnique({
      where: { id },
      include: { city: true },
    }),
    prisma.zoneFeedback.count({
      where: { zoneId: id, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.report.count({
      where: { zoneId: id, status: 'approved', createdAt: { gte: thirtyDaysAgo } },
    }),
  ])

  if (!zone) return null

  const level = getSafetyLevel(zone.safetyScore, zone.isServiceActive)
  const color = getLevelColor(level)
  const geometry = parseGeometry(zone.geometryJson)

  return {
    id: zone.id,
    name: zone.name,
    cityId: zone.city.id,
    cityName: zone.city.name,
    province: zone.city.province,
    region: zone.city.region,
    type: zone.type,
    isServiceActive: zone.isServiceActive,
    safetyScore: zone.safetyScore,
    level,
    color,
    feedbackCount,
    reportsCount,
    sosCount: 0,
    lastUpdated: zone.updatedAt.toISOString(),
    geometry,
  }
}

export async function getZoneSafetySummary(zoneId: string): Promise<ZoneSafetySummary | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    include: { city: true },
  })

  if (!zone) return null

  const [feedback, reportsCount] = await Promise.all([
    prisma.zoneFeedback.findMany({
      where: { zoneId, createdAt: { gte: thirtyDaysAgo } },
      select: { rating: true },
    }),
    prisma.report.count({
      where: { zoneId, status: 'approved', createdAt: { gte: thirtyDaysAgo } },
    }),
  ])

  const feedbackCount = feedback.length
  const averageRating =
    feedbackCount > 0
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedbackCount
      : null

  let safetyScore: number | null = zone.safetyScore

  if (feedbackCount + reportsCount >= 3) {
    const avgRatingNormalized = averageRating !== null ? ((averageRating - 1) / 4) * 100 : 50
    const reportPenalty = Math.min(reportsCount * 5, 25)
    const computed = Math.round(avgRatingNormalized - reportPenalty)
    safetyScore = Math.max(0, Math.min(100, computed))
  }

  const level = getSafetyLevel(safetyScore, zone.isServiceActive)
  const color = getLevelColor(level)

  return {
    zoneId: zone.id,
    zoneName: zone.name,
    cityId: zone.city.id,
    cityName: zone.city.name,
    isServiceActive: zone.isServiceActive,
    safetyScore,
    level,
    color,
    feedbackCount,
    reportsCount,
    sosCount: 0,
    averageRating,
    computedAt: new Date().toISOString(),
  }
}
