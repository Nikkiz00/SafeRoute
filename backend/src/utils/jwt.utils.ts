import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { env } from '@/config/env.js'

export interface AccessTokenPayload {
  sub: string
  role: string
  plan: string
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload
}

export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
