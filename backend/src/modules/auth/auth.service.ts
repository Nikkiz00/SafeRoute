import { prisma } from '@/config/database.js'
import { hashPassword, comparePassword } from '@/utils/hash.utils.js'
import { signAccessToken, generateRefreshToken, hashToken } from '@/utils/jwt.utils.js'
import type { RegisterInput, LoginInput } from './auth.schemas.js'
import { createVerificationToken, verifyTokenAndMarkVerified } from './email-verification.service.js'
import { sendVerificationEmail } from '@/modules/sos/notifications/email.provider.js'
import { env } from '@/config/env.js'

const REFRESH_EXPIRES_DAYS = 30

function getRefreshExpiry(): Date {
  const d = new Date()
  d.setDate(d.getDate() + REFRESH_EXPIRES_DAYS)
  return d
}

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
  }
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) throw new Error('Email già registrata')

  const passwordHash = await hashPassword(input.password)
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      provider: 'email',
    },
  })

  const { raw, hash } = generateRefreshToken()
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: getRefreshExpiry(),
    },
  })

  const accessToken = signAccessToken({ sub: user.id, role: user.role, plan: user.plan })

  // Send verification email (non-blocking)
  try {
    const verToken = await createVerificationToken(user.id)
    const verUrl = `${env.FRONTEND_URL}/verify-email?token=${verToken}`
    if (env.NODE_ENV === 'development') {
      console.info(`[email-verify] DEV — verifica email: ${verUrl}`)
    }
    sendVerificationEmail({ to: user.email, userName: user.name, verificationUrl: verUrl })
      .catch(e => console.error('[auth] verification email error:', e))
  } catch (e) {
    console.error('[auth] failed to create verification token:', e)
  }

  return { user: stripUser(user), accessToken, refreshToken: raw, emailVerified: false }
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user || user.deletedAt !== null || !user.passwordHash) throw new Error('Credenziali non valide')

  const valid = await comparePassword(input.password, user.passwordHash)
  if (!valid) throw new Error('Credenziali non valide')

  const { raw, hash } = generateRefreshToken()
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: getRefreshExpiry(),
    },
  })

  const accessToken = signAccessToken({ sub: user.id, role: user.role, plan: user.plan })
  return { user: stripUser(user), accessToken, refreshToken: raw }
}

export async function refreshTokens(rawRefreshToken: string) {
  const hash = hashToken(rawRefreshToken)

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } })
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new Error('Refresh token non valido o scaduto')
  }

  // Revoca il vecchio token (token rotation)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  })

  const user = await prisma.user.findUnique({ where: { id: stored.userId } })
  if (!user) throw new Error('Utente non trovato')

  const { raw, hash: newHash } = generateRefreshToken()
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: newHash,
      expiresAt: getRefreshExpiry(),
    },
  })

  const accessToken = signAccessToken({ sub: user.id, role: user.role, plan: user.plan })
  return { accessToken, refreshToken: raw }
}

export async function logoutUser(rawRefreshToken: string) {
  const hash = hashToken(rawRefreshToken)
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash },
    data: { revokedAt: new Date() },
  })
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })
  if (!user || user.deletedAt !== null) throw new Error('Utente non trovato')
  return stripUser(user)
}

export async function verifyEmail(rawToken: string) {
  return verifyTokenAndMarkVerified(rawToken)
}

export async function resendVerificationEmail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('Utente non trovato')
  if (user.emailVerified) throw new Error('Email già verificata')

  const verToken = await createVerificationToken(userId)
  const verUrl = `${env.FRONTEND_URL}/verify-email?token=${verToken}`

  if (env.NODE_ENV === 'development') {
    console.info(`[email-verify] DEV — resend verifica email: ${verUrl}`)
  }

  const result = await sendVerificationEmail({ to: user.email, userName: user.name, verificationUrl: verUrl })
  return {
    sent: result.status === 'sent',
    skipped: result.status === 'skipped',
    url: env.NODE_ENV === 'development' ? verUrl : undefined,
  }
}
