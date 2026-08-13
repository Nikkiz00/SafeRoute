import type { ZoneGeometry } from '@/lib/geo.js'

export type ZoneLevel = 'safe' | 'caution' | 'danger' | 'critical' | 'unknown'

export interface ZoneResponse {
  id: string
  name: string
  cityId: string
  cityName: string
  province: string | null
  region: string | null
  type: string
  isServiceActive: boolean
  safetyScore: number | null
  level: ZoneLevel
  color: string
  feedbackCount: number
  reportsCount: number
  sosCount: number
  lastUpdated: string
  geometry: ZoneGeometry
}

export interface ZoneSafetySummary {
  zoneId: string
  zoneName: string
  cityId: string
  cityName: string
  isServiceActive: boolean
  safetyScore: number | null
  level: ZoneLevel
  color: string
  feedbackCount: number
  reportsCount: number
  sosCount: number
  averageRating: number | null
  computedAt: string
}
