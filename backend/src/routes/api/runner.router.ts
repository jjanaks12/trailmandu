import { Router } from 'express'

import { verifyAccessToken } from '@/app/http/middleware/verify_access_token.middleware'
import { ghostRateLimit } from '@/app/http/middleware/ghost_rate_limit.middleware'
import { RunnerController } from '@/app/http/controllers/runner.controller'

const router = Router()

router.get('/', [verifyAccessToken], RunnerController.stageCategoryList)
router.get('/recent', [verifyAccessToken], RunnerController.recent)
router.get('/:runner_id', [verifyAccessToken], RunnerController.get)
router.get('/get_by_email/:email', [ghostRateLimit], RunnerController.getByEmail)
router.put('/:runner_id', [verifyAccessToken], RunnerController.update)
router.delete('/:runner_id', [verifyAccessToken], RunnerController.delete)
router.put('/:runner_id/disqualify', [verifyAccessToken], RunnerController.disqualify)
router.put('/:runner_id/did-not-finish', [verifyAccessToken], RunnerController.didNotFinished)
router.post('/:runner_id/send-confirmation', [verifyAccessToken], RunnerController.sendConfirmationEmail)
router.post('/:runner_id/send-briefing', [verifyAccessToken], RunnerController.sendRunnerBriefing)

router.put('/:runner_id/:stage_id/attendance', [verifyAccessToken], RunnerController.attendance)
router.post('/import', [verifyAccessToken], RunnerController.bulkImport)

export default router