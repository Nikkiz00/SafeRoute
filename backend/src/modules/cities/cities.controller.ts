import type { Request, Response } from 'express'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import { getCities, getCityById } from './cities.service.js'

// GET /api/cities
export async function listCities(_req: Request, res: Response): Promise<void> {
  try {
    res.set('Cache-Control', 'public, max-age=3600')
    const cities = await getCities()
    sendSuccess(res, cities)
  } catch (err) {
    console.error('[cities] listCities error:', err)
    sendError(res, 'Errore nel recupero delle città', 500)
  }
}

// GET /api/cities/:id
export async function getCity(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    res.set('Cache-Control', 'public, max-age=3600')
    const city = await getCityById(id)

    if (!city) {
      sendError(res, 'Città non trovata', 404)
      return
    }

    sendSuccess(res, city)
  } catch (err) {
    console.error('[cities] getCity error:', err)
    sendError(res, 'Errore nel recupero della città', 500)
  }
}
