import { api } from './client'
import type { Zone, ZoneSafetySummary } from '@/types'

// Fetch zones with optional filters
export async function fetchZones(opts?: {
  cityId?: string
  bbox?: string  // "minLng,minLat,maxLng,maxLat"
}): Promise<Zone[]> {
  const params = new URLSearchParams()
  if (opts?.cityId) params.set('cityId', opts.cityId)
  if (opts?.bbox) params.set('bbox', opts.bbox)
  const qs = params.toString()
  return api.get<Zone[]>(`/api/zones${qs ? `?${qs}` : ''}`, { skipAuth: true })
}

export async function fetchZoneById(id: string): Promise<Zone> {
  return api.get<Zone>(`/api/zones/${id}`, { skipAuth: true })
}

export async function fetchZoneSafetySummary(zoneId: string): Promise<ZoneSafetySummary> {
  return api.get<ZoneSafetySummary>(`/api/zones/${zoneId}/safety-summary`, { skipAuth: true })
}
