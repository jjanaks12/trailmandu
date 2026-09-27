import { Router } from 'express'
import { RaceUpdateController } from '@/app/http/controllers/race_update.controller'

const router = Router()

router.post('/', RaceUpdateController.create)
router.get('/', RaceUpdateController.index)

export default router
