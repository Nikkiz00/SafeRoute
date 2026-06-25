import type { Request, Response } from 'express'
import * as authService from './auth.service.js'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import type { AuthenticatedRequest } from '@/middleware/auth.middleware.js'

export async function register(req: Request, res: Response) {
  try {
    const result = await authService.registerUser(req.body)
    return sendSuccess(res, result, 201)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore registrazione')
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = await authService.loginUser(req.body)
    return sendSuccess(res, result)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore login', 401)
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string }
    if (!refreshToken) return sendError(res, 'Refresh token mancante', 400)
    const result = await authService.refreshTokens(refreshToken)
    return sendSuccess(res, result)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore refresh', 401)
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string }
    if (refreshToken) await authService.logoutUser(refreshToken)
    return sendSuccess(res, { message: 'Logout effettuato' })
  } catch {
    return sendSuccess(res, { message: 'Logout effettuato' })
  }
}

export async function me(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await authService.getMe(req.user!.id)
    return sendSuccess(res, { user })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore', 404)
  }
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.query
  if (typeof token !== 'string') return sendError(res, 'Token mancante', 400)

  const result = await authService.verifyEmail(token)
  if (!result.success) return sendError(res, result.message, 400)
  return sendSuccess(res, { message: result.message })
}

export async function resendVerification(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await authService.resendVerificationEmail(req.user!.id)
    return sendSuccess(res, { message: 'Email di verifica inviata', ...result })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore', 400)
  }
}

// Placeholder per OAuth futuro
export async function googleCallback(_req: Request, res: Response) {
  // TODO Day N: Implementare OAuth Google con passport.js o @auth/core
  // Flow previsto: code → exchange → profile → upsert user → JWT
  return sendError(res, 'Google login non ancora implementato', 501)
}

export async function appleCallback(_req: Request, res: Response) {
  // TODO Day N: Implementare OAuth Apple
  return sendError(res, 'Apple login non ancora implementato', 501)
}
