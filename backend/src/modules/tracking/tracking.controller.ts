import type { Request, Response } from 'express'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import { getTrackingByToken } from './tracking.service.js'
import { trackingEmitter } from './tracking.events.js'

// GET /api/tracking/:token — JSON snapshot
export async function getTracking(req: Request, res: Response): Promise<void> {
  try {
    const data = await getTrackingByToken(req.params.token)
    if (!data) { sendError(res, 'Link di tracking non valido o scaduto', 404); return }
    sendSuccess(res, data)
  } catch (err) {
    console.error('[tracking] getTracking error:', err)
    sendError(res, 'Errore nel recupero della posizione', 500)
  }
}

// GET /api/tracking/:token/stream — SSE
export async function streamTracking(req: Request, res: Response): Promise<void> {
  const { token } = req.params

  try {
    const data = await getTrackingByToken(token)
    const tokenPrefix = token.slice(0, 8) + '...'
    if (!data) {
      console.warn('[tracking-sse] token invalid or expired:', tokenPrefix)
      res.status(404).json({ success: false, error: 'Link non valido o scaduto' })
      return
    }

    console.info('[tracking-sse] client connected:', tokenPrefix)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    // CORS gestito globalmente da server.ts
    res.flushHeaders()

    // Send initial state immediately
    res.write(`data: ${JSON.stringify({ type: 'init', ...data })}\n\n`)

    // Listen for new pings
    const pingHandler = (pingData: unknown) => {
      res.write(`data: ${JSON.stringify({ type: 'ping', position: pingData })}\n\n`)
    }

    // Listen for status changes
    const statusHandler = (statusData: unknown) => {
      const payload = statusData as { status?: string }
      res.write(`data: ${JSON.stringify({ type: 'status', ...(statusData as object) })}\n\n`)
      // Close stream only when session fully ends — NOT for 'sos' (tracking stays live during emergency)
      if (payload.status === 'completed' || payload.status === 'cancelled') {
        console.info(`[tracking-sse] session ended (status=${payload.status}), closing stream: ${tokenPrefix}`)
        res.end()
      }
    }

    trackingEmitter.on(`ping:${token}`, pingHandler)
    trackingEmitter.on(`status:${token}`, statusHandler)

    // Keepalive comment every 25 seconds to prevent proxy timeout
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n')
    }, 25_000)

    req.on('close', () => {
      clearInterval(keepalive)
      trackingEmitter.off(`ping:${token}`, pingHandler)
      trackingEmitter.off(`status:${token}`, statusHandler)
      console.info('[tracking-sse] client disconnected:', tokenPrefix)
    })
  } catch (err) {
    console.error('[tracking] streamTracking error:', err)
    if (!res.headersSent) {
      sendError(res, 'Errore nel flusso di tracking', 500)
    }
  }
}
