import { Router } from 'express'
import { verifyAccessToken } from '@/app/http/middleware/verify_access_token.middleware'
import { QueueController } from '@/app/http/controllers/queue.controller'

const router = Router()

router.get('/', [verifyAccessToken], QueueController.index)
router.get('/quota', [verifyAccessToken], QueueController.quota)
router.post('/send-immediate', [verifyAccessToken], QueueController.sendImmediate)
router.post('/:id/resend', [verifyAccessToken], QueueController.resend)
router.post('/:id/promote', [verifyAccessToken], QueueController.promote)

export default router
