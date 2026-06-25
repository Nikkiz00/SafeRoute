import { api } from './client'
import type { RouteSession } from '@/types'

export interface StartRoutePayload {
  startLat: number
  startLng: number
  endLat?: number
  endLng?: number
  destinationName?: string
}

export async function startRoute(payload: StartRoutePayload): Promise<RouteSession> {
  return api.post<RouteSession>('/api/routes', payload)
}

export async function getRoute(id: string): Promise<RouteSession> {
  return api.get<RouteSession>(`/api/routes/${id}`)
}

export async function updateLocation(
  id: string,
  payload: { lat: number; lng: number; accuracy?: number },
): Promise<{ lat: number; lng: number; accuracy: number | null; timestamp: string }> {
  return api.patch(`/api/routes/${id}/location`, payload)
}

export async function completeRoute(id: string): Promise<RouteSession> {
  return api.post<RouteSession>(`/api/routes/${id}/complete`, {})
}

export async function cancelRoute(id: string): Promise<RouteSession> {
  return api.post<RouteSession>(`/api/routes/${id}/cancel`, {})
}

export async function shareRoute(id: string): Promise<{ url: string; token: string }> {
  return api.post(`/api/routes/${id}/share`, {})
}

export async function fetchTracking(token: string): Promise<import('@/types').TrackingData> {
  return api.get(`/api/tracking/${token}`, { skipAuth: true })
}
