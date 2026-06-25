import { Router } from 'express'
import { getTracking, streamTracking } from './tracking.controller.js'

const router = Router()

// IMPORTANT: /stream must come before /:token or Express will treat "stream" as a token value
router.get('/:token/stream', streamTracking)
router.get('/:token', getTracking)

export default router
