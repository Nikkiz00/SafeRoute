import type { Response } from 'express'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import { createReportSchema } from './reports.schemas.js'
import { createReport, getReportsSummary } from './reports.service.js'
import type { AuthenticatedRequest } from '@/middleware/auth.middleware.js'

// POST /api/zones/:id/reports  — auth required
export async function submitReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id ?? null
    const { id: zoneId } = req.params
    const parsed = createReportSchema.safeParse(req.body)
    if (!parsed.success) { sendError(res, 'Dati non validi', 400); return }

    const result = await createReport(userId, zoneId, parsed.data)
    sendSuccess(res, { ...result, message: 'Segnalazione ricevuta, sarà verificata dal team.' }, 201)
  } catch (err) {
    if (err instanceof Error && err.message === 'ZONE_NOT_FOUND') {
      sendError(res, 'Zona non trovata', 404); return
    }
    console.error('[reports] submitReport error:', err)
    sendError(res, 'Errore nel salvataggio della segnalazione', 500)
  }
}

// GET /api/zones/:id/reports-summary  — public
export async function reportsSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id: zoneId } = req.params
    const summary = await getReportsSummary(zoneId)
    sendSuccess(res, summary)
  } catch (err) {
    console.error('[reports] reportsSummary error:', err)
    sendError(res, 'Errore nel recupero delle segnalazioni', 500)
  }
}
