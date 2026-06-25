import { Router } from 'express'
import * as ctrl from './auth.controller.js'
import { validate } from '@/middleware/validate.middleware.js'
import { requireAuth } from '@/middleware/auth.middleware.js'
import { registerSchema, loginSchema } from './auth.schemas.js'

const router = Router()

router.post('/register', validate(registerSchema), ctrl.register)
router.post('/login', validate(loginSchema), ctrl.login)
router.post('/refresh', ctrl.refresh)
router.post('/logout', ctrl.logout)
router.get('/me', requireAuth, ctrl.me)

// Email verification (public)
router.get('/verify-email', ctrl.verifyEmail)

// Resend verification (requires auth)
router.post('/resend-verification', requireAuth, ctrl.resendVerification)

// OAuth placeholders (non implementati)
router.get('/google', (_req, res) => res.status(501).json({ success: false, error: 'Google OAuth non ancora implementato' }))
router.get('/apple', (_req, res) => res.status(501).json({ success: false, error: 'Apple OAuth non ancora implementato' }))

export default router
