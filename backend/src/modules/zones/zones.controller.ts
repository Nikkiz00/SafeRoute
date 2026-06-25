import type { Request, Response } from 'express'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import { zonesQuerySchema } from './zones.schemas.js'
import { getZones, getZoneById, getZoneSafetySummary } from './zones.service.js'

// GET /api/zones?cityId=...&bbox=...
export async function listZones(req: Request, res: Response): Promise<void> {
  try {
    const parsed = zonesQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, 'Parametri non validi', 400)
      return
    }

    res.set('Cache-Control', 'public, max-age=300')
    const zones = await getZones(parsed.data)
    sendSuccess(res, zones)
  } catch (err) {
    console.error('[zones] listZones error:', err)
    sendError(res, 'Errore nel recupero delle zone', 500)
  }
}

// GET /api/zones/:id
export async function getZone(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    res.set('Cache-Control', 'public, max-age=300')
    const zone = await getZoneById(id)

    if (!zone) {
      sendError(res, 'Zona non trovata', 404)
      return
    }

    sendSuccess(res, zone)
  } catch (err) {
    console.error('[zones] getZone error:', err)
    sendError(res, 'Errore nel recupero della zona', 500)
  }
}

// GET /api/zones/:id/safety-summary
export async function getZoneSummary(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const summary = await getZoneSafetySummary(id)

    if (!summary) {
      sendError(res, 'Zona non trovata', 404)
      return
    }

    sendSuccess(res, summary)
  } catch (err) {
    console.error('[zones] getZoneSummary error:', err)
    sendError(res, 'Errore nel recupero del sommario sicurezza', 500)
  }
}
