import { Router } from 'express'
import { requireAuth } from '@/middleware/auth.middleware.js'
import { validate } from '@/middleware/validate.middleware.js'
import { updateProfileSchema, changeEmailSchema, changePasswordSchema } from './profile.schemas.js'
import * as ctrl from './profile.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', ctrl.getProfile)
router.patch('/', validate(updateProfileSchema), ctrl.updateProfile)
router.patch('/onboarding', ctrl.completeOnboarding)
router.patch('/email', validate(changeEmailSchema), ctrl.changeEmail)
router.patch('/password', validate(changePasswordSchema), ctrl.changePassword)
router.delete('/', ctrl.deleteAccount)

export default router
