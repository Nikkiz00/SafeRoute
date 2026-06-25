import { Router } from 'express'
import { listCities, getCity } from './cities.controller.js'

const router = Router()

router.get('/', listCities)
router.get('/:id', getCity)

export default router
