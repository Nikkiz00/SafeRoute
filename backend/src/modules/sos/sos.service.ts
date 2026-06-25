import { prisma } from '@/config/database.js'
import { trackingEmitter } from '../tracking/tracking.events.js'
import { notifyContacts } from './notifications/notification.service.js'
import type { TriggerSOSInput, SOSFollowupInput } from './sos.schemas.js'
import type { SOSResponse, SOSDetail, SOSNotificationStatus } from './sos.types.js'

const TRACKING_DURATION_MS = 24 * 60 * 60 * 1000
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

export async function triggerSOS(userId: string, input: TriggerSOSInput): Promise<SOSResponse> {
  // Fetch user name for notification messages
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  const userName = user?.name ?? 'Utente SafeRoute'

  // Find or create RouteSession for this SOS
  let routeSessionId: string
  let trackingToken: string

  // Check for an existing active or sos session (prefer user-provided routeSessionId)
  let existingSession = input.routeSessionId
    ? await prisma.routeSession.findUnique({ where: { id: input.routeSessionId } })
    : await prisma.routeSession.findFirst({
        where: { userId, status: { in: ['active', 'sos'] } },
        orderBy: { startedAt: 'desc' },
      })

  // GPS fallback: if position is (0, 0) (GPS failed), try to use last known ping from session
  let resolvedInput = { ...input }
  if (resolvedInput.lat === 0 && resolvedInput.lng === 0 && existingSession) {
    const lastPing = await prisma.locationPing.findFirst({
      where: { routeSessionId: existingSession.id },
      orderBy: { createdAt: 'desc' },
    })
    if (lastPing) {
      resolvedInput = { ...resolvedInput, lat: lastPing.lat, lng: lastPing.lng }
      console.info(`[sos] GPS unavailable — using last known position from session ${existingSession.id}`)
    } else {
      // No prior pings; position remains (0,0) — message will indicate unavailability
      console.warn(`[sos] GPS unavailable and no prior pings — position will be (0,0)`)
      if (!resolvedInput.message) {
        resolvedInput = { ...resolvedInput, message: 'posizione non disponibile' }
      }
    }
  }

  if (existingSession) {
    // Update existing session to 'sos' status if it's 'active'
    if (existingSession.status === 'active') {
      existingSession = await prisma.routeSession.update({
        where: { id: existingSession.id },
        data: { status: 'sos' },
      })
      trackingEmitter.emit(`status:${existingSession.trackingToken}`, { status: 'sos' })
    }
    routeSessionId = existingSession.id
    trackingToken = existingSession.trackingToken
  } else {
    // Create emergency-only RouteSession
    const emergencySession = await prisma.routeSession.create({
      data: {
        userId,
        status: 'sos',
        startLat: resolvedInput.lat,
        startLng: resolvedInput.lng,
        trackingTokenExpiresAt: new Date(Date.now() + TRACKING_DURATION_MS),
        shareEnabled: true,
      },
    })
    routeSessionId = emergencySession.id
    trackingToken = emergencySession.trackingToken

    // Add initial location ping
    await prisma.locationPing.create({
      data: { routeSessionId, lat: resolvedInput.lat, lng: resolvedInput.lng, accuracy: resolvedInput.accuracy ?? null },
    })
  }

  const trackingUrl = `${FRONTEND_URL}/track/${trackingToken}`

  // Create SOSAlert
  const sosAlert = await prisma.sOSAlert.create({
    data: {
      userId,
      routeSessionId,
      lat: resolvedInput.lat,
      lng: resolvedInput.lng,
      message: resolvedInput.message ?? null,
      status: 'active',
    },
  })

  // Notify contacts (fire and let Promise.allSettled handle failures)
  const notifiedContacts = await notifyContacts({
    userId,
    sosAlertId: sosAlert.id,
    userName,
    lat: resolvedInput.lat,
    lng: resolvedInput.lng,
    trackingUrl,
    message: resolvedInput.message,
  })

  // Compute overall notification status
  let notificationStatus: SOSNotificationStatus = 'no_contacts'
  if (notifiedContacts.length > 0) {
    const allSent = notifiedContacts.every(c =>
      c.channels.length > 0 && c.channels.every(ch => ch.status === 'sent' || ch.status === 'skipped')
    )
    const anySent = notifiedContacts.some(c => c.channels.some(ch => ch.status === 'sent'))
    notificationStatus = allSent ? 'sent' : anySent ? 'partial' : 'failed'
  }

  return {
    sosId: sosAlert.id,
    trackingUrl,
    trackingToken,
    notifiedContacts,
    notificationStatus,
  }
}

export async function getSOSById(id: string, userId: string): Promise<SOSDetail | null> {
  const alert = await prisma.sOSAlert.findUnique({
    where: { id },
    include: { followup: true, routeSession: { select: { trackingToken: true } } },
  })
  if (!alert || alert.userId !== userId) return null

  return {
    id: alert.id,
    status: alert.status as 'active' | 'resolved',
    lat: alert.lat,
    lng: alert.lng,
    message: alert.message,
    createdAt: alert.createdAt.toISOString(),
    resolvedAt: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
    resolvedFeedback: alert.resolvedFeedback,
    routeSessionId: alert.routeSessionId,
    trackingUrl: alert.routeSession
      ? `${FRONTEND_URL}/track/${alert.routeSession.trackingToken}`
      : null,
    followup: alert.followup
      ? {
          response: alert.followup.response,
          respondedAt: alert.followup.respondedAt.toISOString(),
          notes: alert.followup.notes,
        }
      : null,
  }
}

export async function submitFollowup(
  sosId: string,
  userId: string,
  input: SOSFollowupInput
): Promise<{ success: boolean }> {
  const alert = await prisma.sOSAlert.findUnique({ where: { id: sosId } })
  if (!alert || alert.userId !== userId) return { success: false }

  const isResolved = input.response === 'false_alarm' || input.response === 'resolved'

  await prisma.$transaction([
    prisma.sOSFollowup.upsert({
      where: { sosAlertId: sosId },
      create: {
        sosAlertId: sosId,
        response: input.response,
        notes: input.notes ?? null,
      },
      update: {
        response: input.response,
        notes: input.notes ?? null,
        respondedAt: new Date(),
      },
    }),
    prisma.sOSAlert.update({
      where: { id: sosId },
      data: {
        status: isResolved ? 'resolved' : 'active',
        resolvedAt: isResolved ? new Date() : null,
        resolvedFeedback: input.response,
      },
    }),
  ])

  return { success: true }
}
