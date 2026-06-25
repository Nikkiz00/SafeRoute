import { api } from './client'

export const REPORT_CATEGORIES = [
  'aggression',
  'harassment',
  'theft',
  'dark_area',
  'suspicious_groups',
  'degradation',
  'other',
] as const

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  aggression: 'Aggressione',
  harassment: 'Molestia',
  theft: 'Furto',
  dark_area: 'Zona buia',
  suspicious_groups: 'Gruppi sospetti',
  degradation: 'Degrado',
  other: 'Altro',
}

export interface ReportResult {
  reportId: string
  message: string
}

export interface ReportsSummary {
  pendingCount: number
  approvedCount: number
  categories: Record<string, number>
}

export async function submitReport(
  zoneId: string,
  payload: { category: ReportCategory; description?: string }
): Promise<ReportResult> {
  return api.post<ReportResult>(`/api/zones/${zoneId}/reports`, payload)
}

export async function fetchReportsSummary(zoneId: string): Promise<ReportsSummary> {
  return api.get<ReportsSummary>(`/api/zones/${zoneId}/reports-summary`, { skipAuth: true })
}
