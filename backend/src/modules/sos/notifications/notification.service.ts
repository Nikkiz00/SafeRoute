import { prisma } from '@/config/database.js'
import { sendSOSEmail } from './email.provider.js'
import { sendSOSSMS } from './sms.provider.js'
import type { NotificationResult } from '../sos.types.js'

export async function notifyContacts(params: {
  userId: string
  sosAlertId: string
  userName: string
  lat: number
  lng: number
  trackingUrl: string
  message?: string
}): Promise<NotificationResult[]> {
  const { userId, sosAlertId, userName, lat, lng, trackingUrl, message } = params

  const contacts = await prisma.emergencyContact.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })

  if (contacts.length === 0) return []

  const results: NotificationResult[] = []

  await Promise.allSettled(
    contacts.map(async (contact) => {
      const channels: NotificationResult['channels'] = []

      try {
        // Email
        if (contact.email) {
          const emailResult = await sendSOSEmail({
            to: contact.email,
            contactName: contact.name,
            userName,
            lat,
            lng,
            trackingUrl,
            message,
          })
          channels.push({ channel: 'email', ...emailResult, recipient: contact.email })
          try {
            await prisma.notificationLog.create({
              data: {
                userId,
                sosAlertId,
                channel: 'email',
                recipient: contact.email,
                status: emailResult.status,
                provider: emailResult.provider,
                errorMessage: emailResult.error ?? null,
              },
            })
          } catch (logErr) {
            console.error('[notification] failed to log email result:', logErr)
          }
        }

        // SMS
        if (contact.phone) {
          const smsResult = await sendSOSSMS({
            to: contact.phone,
            userName,
            lat,
            lng,
            trackingUrl,
          })
          channels.push({ channel: 'sms', ...smsResult, recipient: contact.phone })
          try {
            await prisma.notificationLog.create({
              data: {
                userId,
                sosAlertId,
                channel: 'sms',
                recipient: contact.phone,
                status: smsResult.status,
                provider: smsResult.provider,
                errorMessage: smsResult.error ?? null,
              },
            })
          } catch (logErr) {
            console.error('[notification] failed to log sms result:', logErr)
          }
        }
      } catch (contactErr) {
        console.error(`[notification] error processing contact ${contact.id}:`, contactErr)
        // Even if notification sending fails entirely, push a failed channel record
        // so the contact appears in results with a failed status
        if (channels.length === 0) {
          if (contact.email) channels.push({ channel: 'email', status: 'failed', provider: 'unknown', recipient: contact.email })
          if (contact.phone) channels.push({ channel: 'sms', status: 'failed', provider: 'unknown', recipient: contact.phone })
        }
      }

      // Always push result so every contact appears in the response
      results.push({ contactId: contact.id, name: contact.name, channels })
    })
  )

  return results
}
