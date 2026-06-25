import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth.middleware.js'
import { sendError } from '@/utils/response.utils.js'

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 'Accesso non autorizzato', 403)
    }
    next()
  }
}
