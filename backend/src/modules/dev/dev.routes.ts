import { Router } from 'express'
import { z } from 'zod'
import { sendSOSEmail } from '@/modules/sos/notifications/email.provider.js'

const router = Router()

const testEmailSchema = z.object({
  to: z.string().email('Indirizzo email non valido'),
})

router.post('/test-email', async (req, res) => {
  const parsed = testEmailSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.errors[0]?.message ?? 'Dati non validi',
    })
    return
  }

  const { to } = parsed.data

  const result = await sendSOSEmail({
    to,
    contactName: 'Contatto Test',
    userName: 'Utente Test',
    lat: 45.46,
    lng: 9.19,
    trackingUrl: 'http://localhost:5173/track/test',
    message: 'Questo è un messaggio SOS di test da SafeRoute.',
  })

  res.json({
    success: true,
    result,
  })
})

export default router
