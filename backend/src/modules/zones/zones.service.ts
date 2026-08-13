import { Prisma } from '@prisma/client'
import { prisma } from '@/config/database.js'
import type { ZoneLevel, ZoneResponse, ZoneSafetySummary } from './zones.types.js'

// Above this count without a cityId/bbox filter, cap results instead of loading
// the full national dataset (thousands of comuni) into memory on every request.
const UNSCOPED_QUERY_LIMIT = 500

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

function parseBBoxParam(bbox: string): [number, number, number, number] | null {
  const parts = bbox.split(',').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null
  return [parts[0], parts[1], parts[2], parts[3]]
}

export async function getZones(opts: {
  cityId?: string
  bbox?: string
}): Promise<ZoneResponse[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const whereClause: Prisma.ZoneWhereInput = {}
  if (opts.cityId) whereClause.cityId = opts.cityId

  const filterBBox = opts.bbox ? parseBBoxParam(opts.bbox) : null
  if (filterBBox) {
    const [minLng, minLat, maxLng, maxLat] = filterBBox
    // Bounding-box overlap test, pushed to SQL via precomputed columns so we
    // never have to load geometryJson for every zone in the country.
    whereClause.bboxMinLng = { lte: maxLng }
    whereClause.bboxMaxLng = { gte: minLng }
    whereClause.bboxMinLat = { lte: maxLat }
    whereClause.bboxMaxLat = { gte: minLat }
  }

  const [zones, feedbackGroups, reportGroups] = await Promise.all([
    prisma.zone.findMany({
      where: whereClause,
      include: { city: true },
      orderBy: { updatedAt: 'desc' },
      ...(opts.cityId || filterBBox ? {} : { take: UNSCOPED_QUERY_LIMIT }),
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

  const results: ZoneResponse[] = zones.map((zone) => {
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
