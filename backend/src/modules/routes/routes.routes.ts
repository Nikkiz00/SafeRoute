import { Router } from 'express'
import { requireAuth } from '@/middleware/auth.middleware.js'
import { requireEmailVerified } from '@/middleware/email-verified.middleware.js'
import {
  startRouteHandler,
  getRouteHandler,
  updateLocationHandler,
  completeRouteHandler,
  cancelRouteHandler,
  shareRouteHandler,
} from './routes.controller.js'

const router = Router()

router.post('/', requireAuth, requireEmailVerified, startRouteHandler)
router.get('/:id', requireAuth, getRouteHandler)
router.patch('/:id/location', requireAuth, updateLocationHandler)
router.post('/:id/complete', requireAuth, completeRouteHandler)
router.post('/:id/cancel', requireAuth, cancelRouteHandler)
router.post('/:id/share', requireAuth, shareRouteHandler)

export default router
