import { Router } from 'express'

import userRouter from '@/routes/api/user.router'
import authRouter from '@/routes/api/auth.router'
import miscellanousRouter from '@/routes/api/miscellanous.router'
import roleRouter from '@/routes/api/role.router'
import eventRouter from '@/routes/api/event.router'
import CompanyRouter from '@/routes/api/company.router'
import VolunteerRouter from '@/routes/api/volunteer.router'
import RunnerRouter from '@/routes/api/runner.router'
import CheckpointRouter from '@/routes/api/checkpoint.router'
import MediaRouter from '@/routes/api/media.router'
import trekRouter from '@/routes/api/trek.router'
import trekCategoryRouter from '@/routes/api/trek_category.router'
import bookingRouter from '@/routes/api/booking.router'
import productRouter from '@/routes/api/product.router'
import orderRouter from '@/routes/api/order.router'
import couponRouter from '@/routes/api/coupon.router'
import blogRouter from '@/routes/api/blog.router'
import newsletterRouter from '@/routes/api/newsletter.router'
import enquiryCategoryRouter from '@/routes/api/enquiry_category.router'
import enquiryRouter from '@/routes/api/enquiry.router'
import pageRouter from '@/routes/api/page.router'
import teamRouter from '@/routes/api/team.router'
import reviewRouter from '@/routes/api/review.router'
import queueRouter from '@/routes/api/queues.router'
import raceUpdateRouter from '@/routes/api/race_update.router'

const router = Router()

router.use('/users', userRouter)
router.use('/', authRouter)
router.use('/', miscellanousRouter)
router.use('/roles', roleRouter)
router.use('/events', eventRouter)
router.use('/companies', CompanyRouter)
router.use('/volunteers', VolunteerRouter)
router.use('/runners', RunnerRouter)
router.use('/checkpoints', CheckpointRouter)
router.use('/medias', MediaRouter)
router.use('/treks', trekRouter)
router.use('/trek-categories', trekCategoryRouter)
router.use('/bookings', bookingRouter)
router.use('/products', productRouter)
router.use('/orders', orderRouter)
router.use('/coupons', couponRouter)
router.use('/blogs', blogRouter)
router.use('/newsletters', newsletterRouter)
router.use('/enquiry-categories', enquiryCategoryRouter)
router.use('/enquiries', enquiryRouter)
router.use('/pages', pageRouter)
router.use('/teams', teamRouter)
router.use('/reviews', reviewRouter)
router.use('/queues', queueRouter)
router.use('/race-updates', raceUpdateRouter)

export default router