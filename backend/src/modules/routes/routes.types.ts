export interface RouteSessionResponse {
  id: string
  userId: string
  status: 'active' | 'completed' | 'cancelled' | 'sos'
  startedAt: string
  endedAt: string | null
  trackingToken: string
  trackingTokenExpiresAt: string
  shareEnabled: boolean
  shareUrl: string
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number } | null
  destinationName: string | null
  latestPosition: {
    lat: number
    lng: number
    accuracy: number | null
    timestamp: string
  } | null
}
