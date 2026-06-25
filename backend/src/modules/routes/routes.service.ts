import { prisma } from '@/config/database.js'
import { trackingEmitter } from '../tracking/tracking.events.js'
import type { StartRouteInput, UpdateLocationInput } from './routes.schemas.js'
import type { RouteSessionResponse } from './routes.types.js'
import { env } from '@/config/env.js'

const TRACKING_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
const FRONTEND_URL = env.FRONTEND_URL

function buildResponse(session: any, latestPing: any | null): RouteSessionResponse {
  return {
    id: session.id,
    userId: session.userId,
    status: session.status as RouteSessionResponse['status'],
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    trackingToken: session.trackingToken,
    trackingTokenExpiresAt: session.trackingTokenExpiresAt.toISOString(),
    shareEnabled: session.shareEnabled,
    shareUrl: `${FRONTEND_URL}/track/${session.trackingToken}`,
    origin: { lat: session.startLat, lng: session.startLng },
    destination: session.endLat != null && session.endLng != null
      ? { lat: session.endLat, lng: session.endLng }
      : null,
    destinationName: session.destinationName ?? null,
    latestPosition: latestPing
      ? { lat: latestPing.lat, lng: latestPing.lng, accuracy: latestPing.accuracy ?? null, timestamp: latestPing.createdAt.toISOString() }
      : null,
  }
}

export async function startRoute(userId: string, input: StartRouteInput): Promise<RouteSessionResponse> {
  const session = await prisma.routeSession.create({
    data: {
      userId,
      status: 'active',
      startLat: input.startLat,
      startLng: input.startLng,
      endLat: input.endLat ?? null,
      endLng: input.endLng ?? null,
      trackingTokenExpiresAt: new Date(Date.now() + TRACKING_DURATION_MS),
      shareEnabled: true,
      destinationName: input.destinationName ?? null,
    },
  })
  console.info(`[route] session started: id=${session.id.slice(0, 8)}... userId=${userId.slice(0, 8)}...`)
  return buildResponse(session, null)
}

export async function getRoute(id: string, userId: string): Promise<RouteSessionResponse | null> {
  const session = await prisma.routeSession.findUnique({ where: { id } })
  if (!session || session.userId !== userId) return null

  const latestPing = await prisma.locationPing.findFirst({
    where: { routeSessionId: id },
    orderBy: { createdAt: 'desc' },
  })
  return buildResponse(session, latestPing)
}

export async function updateLocation(
  id: string,
  userId: string,
  input: UpdateLocationInput
): Promise<{ lat: number; lng: number; accuracy: number | null; timestamp: string } | null> {
  const session = await prisma.routeSession.findUnique({ where: { id } })
  if (!session || session.userId !== userId) {
    console.warn(`[route] updateLocation: session not found or ownership mismatch id=${id.slice(0, 8)}...`)
    return null
  }
  if (session.status !== 'active' && session.status !== 'sos') {
    console.warn(`[route] updateLocation: session status=${session.status} — location update ignored`)
    return null
  }

  const ping = await prisma.locationPing.create({
    data: { routeSessionId: id, lat: input.lat, lng: input.lng, accuracy: input.accuracy ?? null },
  })

  const pingData = { lat: ping.lat, lng: ping.lng, accuracy: ping.accuracy ?? null, timestamp: ping.createdAt.toISOString() }
  // Notify SSE subscribers
  console.debug(`[tracking-sse] ping emitted for session=${id.slice(0, 8)}... token=${session.trackingToken.slice(0, 8)}...`)
  trackingEmitter.emit(`ping:${session.trackingToken}`, pingData)

  return pingData
}

export async function completeRoute(id: string, userId: string): Promise<RouteSessionResponse | null> {
  const session = await prisma.routeSession.findUnique({ where: { id } })
  if (!session || session.userId !== userId) return null
  if (session.status !== 'active') return null

  const updated = await prisma.routeSession.update({
    where: { id },
    data: { status: 'completed', endedAt: new Date() },
  })
  console.info(`[route] session completed: id=${session.id.slice(0, 8)}... token=${session.trackingToken.slice(0, 8)}...`)
  trackingEmitter.emit(`status:${session.trackingToken}`, { status: 'completed' })
  return buildResponse(updated, null)
}

export async function cancelRoute(id: string, userId: string): Promise<RouteSessionResponse | null> {
  const session = await prisma.routeSession.findUnique({ where: { id } })
  if (!session || session.userId !== userId) return null
  if (session.status !== 'active') return null

  const updated = await prisma.routeSession.update({
    where: { id },
    data: { status: 'cancelled', endedAt: new Date() },
  })
  console.info(`[route] session cancelled: id=${session.id.slice(0, 8)}... token=${session.trackingToken.slice(0, 8)}...`)
  trackingEmitter.emit(`status:${session.trackingToken}`, { status: 'cancelled' })
  return buildResponse(updated, null)
}

export async function getShareInfo(id: string, userId: string): Promise<{ url: string; token: string } | null> {
  const session = await prisma.routeSession.findUnique({ where: { id } })
  if (!session || session.userId !== userId) return null

  return {
    url: `${FRONTEND_URL}/track/${session.trackingToken}`,
    token: session.trackingToken,
  }
}
