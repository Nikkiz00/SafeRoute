import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { listZones, getZone, getZoneSummary } from './zones.controller.js'
import { submitFeedback, feedbackSummary } from './feedback.controller.js'
import { submitReport, reportsSummary } from './reports.controller.js'
import { requireAuth } from '@/middleware/auth.middleware.js'
import { requireEmailVerified } from '@/middleware/email-verified.middleware.js'

const router = Router()

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Troppe segnalazioni, riprova tra qualche minuto' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Zone endpoints (public)
router.get('/', listZones)
router.get('/:id/safety-summary', getZoneSummary)
router.get('/:id', getZone)

// Feedback (POST requires auth + verified email; GET is public)
router.post('/:id/feedback', requireAuth, requireEmailVerified, submitFeedback)
router.get('/:id/feedback-summary', feedbackSummary)

// Reports (POST requires auth + email verified + rate limit; GET is public)
router.post('/:id/reports', reportLimiter, requireAuth, requireEmailVerified, submitReport)
router.get('/:id/reports-summary', reportsSummary)

export default router
