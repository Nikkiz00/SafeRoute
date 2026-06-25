import type { Response } from 'express'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import type { AuthenticatedRequest } from '@/middleware/auth.middleware.js'
import { startRouteSchema, updateLocationSchema } from './routes.schemas.js'
import { startRoute, getRoute, updateLocation, completeRoute, cancelRoute, getShareInfo } from './routes.service.js'

export async function startRouteHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) { sendError(res, 'Non autenticato', 401); return }
    const parsed = startRouteSchema.safeParse(req.body)
    if (!parsed.success) { sendError(res, 'Dati non validi', 400); return }
    const session = await startRoute(userId, parsed.data)
    sendSuccess(res, session, 201)
  } catch (err) {
    console.error('[routes] startRouteHandler error:', err)
    sendError(res, 'Errore nella creazione del percorso', 500)
  }
}

export async function getRouteHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) { sendError(res, 'Non autenticato', 401); return }
    const session = await getRoute(req.params.id, userId)
    if (!session) { sendError(res, 'Percorso non trovato', 404); return }
    sendSuccess(res, session)
  } catch (err) {
    console.error('[routes] getRouteHandler error:', err)
    sendError(res, 'Errore nel recupero del percorso', 500)
  }
}

export async function updateLocationHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) { sendError(res, 'Non autenticato', 401); return }
    const parsed = updateLocationSchema.safeParse(req.body)
    if (!parsed.success) { sendError(res, 'Dati non validi', 400); return }
    const result = await updateLocation(req.params.id, userId, parsed.data)
    if (!result) { sendError(res, 'Percorso non trovato o non attivo', 404); return }
    sendSuccess(res, result)
  } catch (err) {
    console.error('[routes] updateLocationHandler error:', err)
    sendError(res, 'Errore nell\'aggiornamento della posizione', 500)
  }
}

export async function completeRouteHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) { sendError(res, 'Non autenticato', 401); return }
    const session = await completeRoute(req.params.id, userId)
    if (!session) { sendError(res, 'Percorso non trovato o non attivo', 404); return }
    sendSuccess(res, session)
  } catch (err) {
    console.error('[routes] completeRouteHandler error:', err)
    sendError(res, 'Errore nel completamento del percorso', 500)
  }
}

export async function cancelRouteHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) { sendError(res, 'Non autenticato', 401); return }
    const session = await cancelRoute(req.params.id, userId)
    if (!session) { sendError(res, 'Percorso non trovato o non attivo', 404); return }
    sendSuccess(res, session)
  } catch (err) {
    console.error('[routes] cancelRouteHandler error:', err)
    sendError(res, 'Errore nella cancellazione del percorso', 500)
  }
}

export async function shareRouteHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id
    if (!userId) { sendError(res, 'Non autenticato', 401); return }
    const info = await getShareInfo(req.params.id, userId)
    if (!info) { sendError(res, 'Percorso non trovato', 404); return }
    sendSuccess(res, info)
  } catch (err) {
    console.error('[routes] shareRouteHandler error:', err)
    sendError(res, 'Errore nel recupero del link di condivisione', 500)
  }
}
