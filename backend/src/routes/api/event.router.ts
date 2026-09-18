import { Router } from 'express'

import { verifyAccessToken } from '@/app/http/middleware/verify_access_token.middleware'
import { EventController } from '@/app/http/controllers/event.controller'
import { StageController } from '@/app/http/controllers/stage.controller'
import { CheckpointController } from '@/app/http/controllers/checkpoint.controller'
import { GalleryController } from '@/app/http/controllers/event_gallery.controller'
import { VolunteerController } from '@/app/http/controllers/volunteer.controller'
import { RunnerController } from '@/app/http/controllers/runner.controller'
import { StageCategoryController } from '@/app/http/controllers/stage_category.controller'
import { SponsorController } from '@/app/http/controllers/sponsor.controller'
import { PaymentController } from '@/app/http/controllers/payment.controller'
import { ResultController } from '@/app/http/controllers/result.controller'
import { SeasonPassController } from '@/app/http/controllers/season_pass.controller'
import { PricingController } from '@/app/http/controllers/pricing.controller'

const router = Router()

router.get('/', [verifyAccessToken], EventController.index)
router.get('/public', [], EventController.publicIndex)
router.get('/current', [], EventController.currentRace)
router.get('/list', [], EventController.eventList)
router.post('/', [verifyAccessToken], EventController.create)
router.get('/stats', [], EventController.stats)
router.get('/:event_id', [], EventController.get)
router.get('/by_slug/:slug', [], EventController.getBySlug)
router.post('/:event_id/publish', [verifyAccessToken], EventController.publish)
router.post('/:event_id/unpublish', [verifyAccessToken], EventController.unpublish)
router.post('/:id/clear_cache', [verifyAccessToken], EventController.clearCache)
router.put('/:event_id', [verifyAccessToken], EventController.update)
router.put('/:event_id/update_description', [verifyAccessToken], EventController.updateDescription)
router.put('/:event_id/update_details', [verifyAccessToken], EventController.updateDetails)
router.put('/:event_id/update_legal', [verifyAccessToken], EventController.updateLegal)
router.put('/:event_id/upload_thumbnail', [verifyAccessToken], EventController.updateThumbnail)
router.put('/:event_id/update_image_id', [verifyAccessToken], EventController.updateImageId)
router.put('/:event_id/update_gallery_id', [verifyAccessToken], EventController.updateGalleryId)
router.put('/:event_id/upload_map_file', [verifyAccessToken], EventController.updateGPXFile)
router.delete('/:event_id', [verifyAccessToken], EventController.destory)
router.get('/:event_id/email-template', [verifyAccessToken], EventController.getEmailTemplate)
router.post('/:event_id/email-template', [verifyAccessToken], EventController.saveEmailTemplate)

// STAGES
router.get('/:event_id/stages', [verifyAccessToken], StageController.index)
router.post('/:event_id/stages', [verifyAccessToken], StageController.create)
router.put('/stages/:stage_id', [verifyAccessToken], StageController.update)
router.delete('/stages/:stage_id', [verifyAccessToken], StageController.destory)
router.patch('/stages/:stage_id/restore', [verifyAccessToken], StageController.restore)
router.get('/stages/:stage_id', [], StageController.view)
router.get('/stages/:stage_id/runners', [verifyAccessToken], StageController.listRunners)

// CHECKPOINTS
router.get('/:stage_category_id/checkpoints', [verifyAccessToken], CheckpointController.index)
router.post('/:stage_category_id/checkpoints', [verifyAccessToken], CheckpointController.create)
router.put('/checkpoints/:checkpoint_id', [verifyAccessToken], CheckpointController.update)
router.delete('/checkpoints/:checkpoint_id', [verifyAccessToken], CheckpointController.destory)

// GALLERIES
router.get('/:event_id/galleries', [verifyAccessToken], GalleryController.index)
// router.post('/:event_id/galleries', [verifyAccessToken], GalleryController.store)
// router.delete('/:event_id/galleries/:image_id', [verifyAccessToken], GalleryController.destory)

// VOLUNTEERS
router.post('/:event_id/volunteer/register', [], VolunteerController.save)
router.patch('/checkpoints/assign_volunteer/:volunteer_id', [], VolunteerController.assignVolunteer)

// RUNNERS
router.post('/:event_id/runner/register', [], RunnerController.save)
router.get('/:event_id/:stage_id/runners', [], RunnerController.index)
router.post('/:event_id/runners/mass-email', [verifyAccessToken], RunnerController.sendMassEmail)

// STAGE_CATEGORIES
router.get('/:stage_id/stage_categories', [], StageCategoryController.index)
router.post('/:stage_id/stage_categories', [], StageCategoryController.create)
router.put('/:stage_id/stage_categories/:stage_category_id', [], StageCategoryController.update)
router.patch('/stage_categories/:stage_category_id/start', [], StageCategoryController.start)
router.patch('/stage_categories/:stage_category_id/end', [], StageCategoryController.end)
router.delete('/stage_categories/:stage_category_id', [], StageCategoryController.destory)

// SPONSORS
router.get('/:event_id/sponsors', [verifyAccessToken], SponsorController.index)
router.post('/:event_id/sponsors', [verifyAccessToken], SponsorController.create)
router.put('/sponsors/:sponsor_id', [verifyAccessToken], SponsorController.update)
router.delete('/sponsors/:sponsor_id', [verifyAccessToken], SponsorController.destroy)

// SEASON PASS
router.get('/:event_id/season-passes', [verifyAccessToken], SeasonPassController.index)
router.post('/season-passes', [verifyAccessToken], SeasonPassController.store)
router.put('/season-passes/:id', [verifyAccessToken], SeasonPassController.update)
router.delete('/season-passes/:id', [verifyAccessToken], SeasonPassController.destroy)
router.post('/season-passes/payments', [verifyAccessToken], SeasonPassController.storePayment)
router.put('/season-passes/payments/:payment_id', [verifyAccessToken], SeasonPassController.updatePayment)
router.delete('/season-passes/payments/:payment_id', [verifyAccessToken], SeasonPassController.destroyPayment)

// PAYMENTS
router.get('/:event_id/payments', [verifyAccessToken], PaymentController.index)
router.put('/:event_id/payments/:payment_id', [verifyAccessToken], PaymentController.updatePaymentStatus)

// RESULTS
router.get('/:event_id/:stage_id/results', [], ResultController.index)

// PRICING
router.get('/:event_id/pricing', [verifyAccessToken], PricingController.index)
router.post('/:event_id/pricing', [verifyAccessToken], PricingController.update)

export default router