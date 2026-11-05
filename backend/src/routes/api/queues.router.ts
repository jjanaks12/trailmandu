import { Router } from 'express'
import { verifyAccessToken } from '@/app/http/middleware/verify_access_token.middleware'
import { QueueController } from '@/app/http/controllers/queue.controller'

const router = Router()

router.get('/', [verifyAccessToken], QueueController.index)
router.post('/:id/resend', [verifyAccessToken], QueueController.resend)

export default router
