import { prisma } from '@/config/database.js'

export interface TrackingData {
  status: 'active' | 'completed' | 'cancelled' | 'sos'
  userName: string
  startedAt: string
  expiresAt: string
  shareEnabled: boolean
  lastPosition: {
    lat: number
    lng: number
    accuracy: number | null
    timestamp: string
  } | null
  sosMessage: string | null
}

export async function getTrackingByToken(token: string): Promise<TrackingData | null> {
  const session = await prisma.routeSession.findUnique({
    where: { trackingToken: token },
    include: {
      user: { select: { name: true } },
      locationPings: { orderBy: { createdAt: 'desc' }, take: 1 },
      sosAlerts: { orderBy: { createdAt: 'desc' }, take: 1, select: { message: true } },
    },
  })

  if (!session || !session.shareEnabled) return null
  // Token expiry only matters for active sessions.
  // Completed/cancelled sessions are still served regardless of expiry
  // so viewers can see the final state.
  if (session.trackingTokenExpiresAt < new Date() && session.status === 'active') {
    console.warn(`[tracking] expired token accessed: token=${token.slice(0, 8)}...`)
    return null
  }

  const latestPing = session.locationPings[0] ?? null
  const latestSos = session.sosAlerts[0] ?? null

  return {
    status: session.status as TrackingData['status'],
    userName: session.user.name,
    startedAt: session.startedAt.toISOString(),
    expiresAt: session.trackingTokenExpiresAt.toISOString(),
    shareEnabled: session.shareEnabled,
    lastPosition: latestPing
      ? {
          lat: latestPing.lat,
          lng: latestPing.lng,
          accuracy: latestPing.accuracy ?? null,
          timestamp: latestPing.createdAt.toISOString(),
        }
      : null,
    sosMessage: latestSos?.message ?? null,
  }
}
