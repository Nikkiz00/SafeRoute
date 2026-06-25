import { Router } from 'express'
import { requireAuth } from '@/middleware/auth.middleware.js'
import { validate } from '@/middleware/validate.middleware.js'
import { createContactSchema, updateContactSchema } from './contacts.schemas.js'
import * as ctrl from './contacts.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', ctrl.list)
router.post('/', validate(createContactSchema), ctrl.create)
router.patch('/:id', validate(updateContactSchema), ctrl.update)
router.delete('/:id', ctrl.remove)

export default router
