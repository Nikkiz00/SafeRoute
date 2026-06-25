import type { Response } from 'express'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import type { AuthenticatedRequest } from '@/middleware/auth.middleware.js'
import { triggerSOSSchema, sosFollowupSchema } from './sos.schemas.js'
import { triggerSOS, getSOSById, submitFollowup } from './sos.service.js'

export async function handleTriggerSOS(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) { sendError(res, 'Non autenticato', 401); return }
    const parsed = triggerSOSSchema.safeParse(req.body)
    if (!parsed.success) { sendError(res, 'Dati non validi', 400); return }
    const result = await triggerSOS(userId, parsed.data)
    sendSuccess(res, result, 201)
  } catch (err) {
    console.error('[sos] triggerSOS error:', err)
    sendError(res, 'Errore durante attivazione SOS', 500)
  }
}

export async function handleGetSOS(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) { sendError(res, 'Non autenticato', 401); return }
    const alert = await getSOSById(req.params.id, userId)
    if (!alert) { sendError(res, 'Evento SOS non trovato', 404); return }
    sendSuccess(res, alert)
  } catch (err) {
    console.error('[sos] getSOSById error:', err)
    sendError(res, 'Errore nel recupero SOS', 500)
  }
}

export async function handleSOSFollowup(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) { sendError(res, 'Non autenticato', 401); return }
    const parsed = sosFollowupSchema.safeParse(req.body)
    if (!parsed.success) { sendError(res, 'Dati non validi', 400); return }
    const result = await submitFollowup(req.params.id, userId, parsed.data)
    if (!result.success) { sendError(res, 'Evento SOS non trovato', 404); return }
    sendSuccess(res, { message: 'Follow-up registrato' })
  } catch (err) {
    console.error('[sos] handleSOSFollowup error:', err)
    sendError(res, 'Errore nel follow-up SOS', 500)
  }
}
