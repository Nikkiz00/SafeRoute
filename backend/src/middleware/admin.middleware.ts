import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth.middleware.js'
import { sendError } from '@/utils/response.utils.js'

// Only ADMIN can perform write operations
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) { sendError(res, 'Non autenticato', 401); return }
  if (req.user.role !== 'ADMIN') { sendError(res, 'Accesso riservato agli amministratori', 403); return }
  next()
}

// ADMIN or STAFF can view (read-only)
export function requireAdminOrStaff(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) { sendError(res, 'Non autenticato', 401); return }
  if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
    sendError(res, 'Accesso riservato agli amministratori', 403)
    return
  }
  next()
}
