import { api } from './client'
import type { SOSActivationResult } from '@/types'

export interface TriggerSOSPayload {
  lat: number
  lng: number
  accuracy?: number
  message?: string
  routeSessionId?: string
}

export interface SOSFollowupPayload {
  response: 'false_alarm' | 'resolved' | 'still_danger' | 'no_response'
  notes?: string
}

export async function triggerSOS(payload: TriggerSOSPayload): Promise<SOSActivationResult> {
  return api.post<SOSActivationResult>('/api/sos', payload)
}

export async function submitSOSFollowup(sosId: string, payload: SOSFollowupPayload): Promise<void> {
  await api.post(`/api/sos/${sosId}/followup`, payload)
}
