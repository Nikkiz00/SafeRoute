import crypto from 'crypto'
import { prisma } from '@/config/database.js'

const VERIFICATION_EXPIRES_HOURS = 24

export function generateVerificationToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

export async function createVerificationToken(userId: string): Promise<string> {
  // Invalida eventuali token precedenti
  await prisma.emailVerificationToken.deleteMany({ where: { userId } })

  const { raw, hash } = generateVerificationToken()
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRES_HOURS * 60 * 60 * 1000)

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hash, expiresAt },
  })

  return raw
}

export async function verifyTokenAndMarkVerified(rawToken: string): Promise<{ success: boolean; message: string }> {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex')

  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hash } })

  if (!record || record.usedAt) {
    return { success: false, message: 'Token non valido o già utilizzato' }
  }
  if (record.expiresAt < new Date()) {
    return { success: false, message: 'Token scaduto. Richiedi un nuovo invio.' }
  }

  // If user has a pendingEmail, apply it now (email change confirmation flow)
  const userRecord = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { pendingEmail: true },
  })

  const userUpdateData: Record<string, unknown> = {
    emailVerified: true,
    emailVerifiedAt: new Date(),
  }
  if (userRecord?.pendingEmail) {
    userUpdateData.email = userRecord.pendingEmail
    userUpdateData.pendingEmail = null
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: userUpdateData }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])

  return {
    success: true,
    message: userRecord?.pendingEmail
      ? 'Email aggiornata e verificata con successo'
      : 'Email verificata con successo',
  }
}
