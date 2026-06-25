import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth.middleware.js'
import { prisma } from '@/config/database.js'
import { sendError } from '@/utils/response.utils.js'

/**
 * Middleware that blocks unverified users on sensitive routes.
 * Reads emailVerified from DB (not from JWT, which doesn't include it).
 * Requires requireAuth to run first (so req.user is populated).
 */
export async function requireEmailVerified(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    sendError(res, 'Non autenticato', 401)
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { emailVerified: true, deletedAt: true },
    })

    if (!user || user.deletedAt !== null) {
      sendError(res, 'Utente non trovato', 404)
      return
    }

    if (!user.emailVerified) {
      res.status(403).json({
        success: false,
        error: 'Email non verificata',
        code: 'EMAIL_NOT_VERIFIED',
      })
      return
    }

    next()
  } catch (err) {
    console.error('[email-verified] DB check error:', err)
    sendError(res, 'Errore interno', 500)
  }
}
