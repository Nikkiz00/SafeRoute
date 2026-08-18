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
  // See docs/step-5-0-safety-data-baseline.md. finalSafetyScore is the score every
  // consumer (map color, routing) must use — the others are provenance/debug info.
  finalSafetyScore: number | null
  baselineSafetyScore: number | null
  liveSafetyScore: number | null
  scoreConfidence: number | null
  scoreSource: string | null
  scoreReferenceYear: number | null
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
  finalSafetyScore: number | null
  baselineSafetyScore: number | null
  liveSafetyScore: number | null
  scoreConfidence: number | null
  scoreSource: string | null
  scoreReferenceYear: number | null
  level: ZoneLevel
  color: string
  feedbackCount: number
  reportsCount: number
  sosCount: number
  averageRating: number | null
  computedAt: string
}
