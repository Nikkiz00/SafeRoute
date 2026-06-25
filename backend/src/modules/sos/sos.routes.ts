import { Router } from 'express'
import { requireAuth } from '@/middleware/auth.middleware.js'
import { requireEmailVerified } from '@/middleware/email-verified.middleware.js'
import { handleTriggerSOS, handleGetSOS, handleSOSFollowup } from './sos.controller.js'

const router = Router()

// No rate limit on SOS — safety is priority
router.post('/', requireAuth, requireEmailVerified, handleTriggerSOS)
router.get('/:id', requireAuth, handleGetSOS)
router.post('/:id/followup', requireAuth, handleSOSFollowup)

export default router
