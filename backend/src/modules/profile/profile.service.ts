import { prisma } from '@/config/database.js'
import type { UpdateProfileInput } from './profile.schemas.js'
import { hashPassword, comparePassword } from '@/utils/hash.utils.js'
import { createVerificationToken } from '@/modules/auth/email-verification.service.js'
import { sendVerificationEmail, sendSecurityEmail } from '@/modules/sos/notifications/email.provider.js'
import { env } from '@/config/env.js'

function stripUser(user: {
  id: string
  name: string
  email: string
  role: string
  plan: string
  onboardingCompleted: boolean
  createdAt: Date
  emailVerified: boolean
  emailVerifiedAt: Date | null
  pendingEmail?: string | null
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan: user.plan,
    onboardingCompleted: user.onboardingCompleted,
    createdAt: user.createdAt,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    pendingEmail: user.pendingEmail ?? null,
  }
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })
  if (!user || user.deletedAt !== null) throw new Error('Utente non trovato')
  return stripUser(user)
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { ...input },
  })
  return stripUser(user)
}

export async function completeOnboarding(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  })
  return { message: 'Onboarding completato' }
}

export async function changeEmail(userId: string, input: { newEmail: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.deletedAt) throw new Error('Utente non trovato')
  if (!user.passwordHash) throw new Error('Impossibile cambiare email per questo tipo di account')

  const valid = await comparePassword(input.password, user.passwordHash)
  if (!valid) throw new Error('Password non corretta')

  // Check new email not already taken by another user (or pending by another user)
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.newEmail }, { pendingEmail: input.newEmail }], NOT: { id: userId } },
  })
  if (existing) throw new Error('Email già in uso')

  if (input.newEmail === user.email) throw new Error('La nuova email è uguale a quella attuale')

  // Save pending email — do NOT change active email yet
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { pendingEmail: input.newEmail },
  })

  // Notify current email address about the pending change
  sendSecurityEmail({
    to: user.email,
    userName: user.name,
    subject: 'Richiesta cambio email SafeRoute',
    body: `È stata richiesta la modifica della tua email SafeRoute a ${input.newEmail}. Se non sei stato tu, ignora questa email. Il cambio diventerà definitivo solo dopo la verifica della nuova email.`,
  }).catch(e => console.error('[profile] security email (old address) error:', e))

  // Send verification link to the NEW email
  try {
    const verToken = await createVerificationToken(userId)
    const verUrl = `${env.FRONTEND_URL}/verify-email?token=${verToken}`
    if (env.NODE_ENV === 'development') {
      console.info(`[email-verify] DEV — verifica cambio email: ${verUrl}`)
    }
    sendVerificationEmail({ to: input.newEmail, userName: user.name, verificationUrl: verUrl })
      .catch(e => console.error('[profile] new email verification error:', e))
  } catch {}

  return stripUser(updated)
}

export async function changePassword(userId: string, input: { currentPassword: string; newPassword: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.deletedAt) throw new Error('Utente non trovato')
  if (!user.passwordHash) throw new Error('Impossibile cambiare password per questo tipo di account')

  const valid = await comparePassword(input.currentPassword, user.passwordHash)
  if (!valid) throw new Error('Password attuale non corretta')

  const newHash = await hashPassword(input.newPassword)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } })

  // Invalida TUTTI i refresh token attivi dell'utente
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  // Email sicurezza non-blocking
  sendSecurityEmail({
    to: user.email,
    userName: user.name,
    subject: 'La tua password è stata modificata',
    body: 'La tua password SafeRoute è stata modificata. Se non sei stato tu, contatta immediatamente il supporto.',
  }).catch(e => console.error('[profile] security email (password change) error:', e))

  return { message: 'Password aggiornata. Le altre sessioni sono state disconnesse.' }
}

export async function softDeleteAccount(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.deletedAt) throw new Error('Utente non trovato')
  if (!user.passwordHash) throw new Error('Impossibile eliminare account per questo tipo di account')

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) throw new Error('Password non corretta')

  // Soft delete + revoca tutti i refresh token
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    }),
  ])

  return { message: 'Account eliminato' }
}
