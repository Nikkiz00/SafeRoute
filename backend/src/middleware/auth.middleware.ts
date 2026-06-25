import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '@/utils/jwt.utils.js'
import { sendError } from '@/utils/response.utils.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    role: string
    plan: string
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(res, 'Token mancante', 401)
  }
  const token = authHeader.slice(7)
  try {
    const payload = verifyAccessToken(token)
    req.user = { id: payload.sub, role: payload.role, plan: payload.plan }
    next()
  } catch {
    return sendError(res, 'Token non valido o scaduto', 401)
  }
}
