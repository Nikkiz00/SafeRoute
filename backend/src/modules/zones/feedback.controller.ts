import type { Response } from 'express'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import { createFeedbackSchema } from './feedback.schemas.js'
import { createFeedback, getFeedbackSummary } from './feedback.service.js'
import type { AuthenticatedRequest } from '@/middleware/auth.middleware.js'

// POST /api/zones/:id/feedback   — auth required
export async function submitFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) { sendError(res, 'Non autenticato', 401); return }

    const { id: zoneId } = req.params
    const parsed = createFeedbackSchema.safeParse(req.body)
    if (!parsed.success) { sendError(res, 'Dati non validi', 400); return }

    const result = await createFeedback(userId, zoneId, parsed.data)
    sendSuccess(res, result, 201)
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'ZONE_NOT_FOUND') { sendError(res, 'Zona non trovata', 404); return }
      if (err.message === 'DUPLICATE_FEEDBACK') {
        sendError(res, 'Hai già valutato questa zona negli ultimi 30 giorni', 409)
        return
      }
    }
    console.error('[feedback] submitFeedback error:', err)
    sendError(res, 'Errore nel salvataggio del feedback', 500)
  }
}

// GET /api/zones/:id/feedback-summary  — public
export async function feedbackSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id: zoneId } = req.params
    const summary = await getFeedbackSummary(zoneId)
    sendSuccess(res, summary)
  } catch (err) {
    console.error('[feedback] feedbackSummary error:', err)
    sendError(res, 'Errore nel recupero del feedback', 500)
  }
}
