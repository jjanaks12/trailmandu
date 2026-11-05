import { stageCategoryPaymentSchema } from "@/app/lib/schema/event.schema"
import { FileHandler } from "@/app/lib/services/file.service"
import { NextFunction, Request, Response } from "express"

import { prisma } from '@/app/lib/services/prisma.service'
import { PaymentStatus, PaymentType } from "@prisma/client"
export class PaymentController {
    public static async index(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.findUnique({
                where: {
                    id: request.params.event_id as string
                },
                include: {
                    stages: {
                        include: {
                            stage_categories: {
                                include: {
                                    payments: {
                                        include: {
                                            runner: {
                                                include: {
                                                    personal: true
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async store(request: Request, response: Response, next: NextFunction) {
        try {
            let body: any = {}
            const validationData = await stageCategoryPaymentSchema.validate(request.body, { abortEarly: false })

            if (request.body.image) {
                const fileUpload = new FileHandler('payments')
                const image = await fileUpload.saveFile(request.body.image)
                body.image_id = image.id
            }

            response.send(await prisma.stageCategoryPayment.create({
                data: {
                    ...body,
                    amount: validationData.amount,
                    type: validationData.type as PaymentType,
                    description: validationData.description,
                    stage_category_id: validationData.stage_category_id
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async update(request: Request, response: Response, next: NextFunction) {
        try {
            const validationData = await stageCategoryPaymentSchema.validate(request.body, { abortEarly: false })
            const payment = await prisma.stageCategoryPayment.findUnique({
                where: {
                    id: request.params.payment_id as string
                }
            })
            const body: any = {}

            if (request.body.image) {
                const fileUpload = new FileHandler('payments')
                const image = await fileUpload.saveFile(request.body.image, payment?.image_id)
                body.image_id = image.id
            }

            response.send(await prisma.stageCategoryPayment.update({
                where: {
                    id: request.params.payment_id as string
                },
                data: {
                    ...body,
                    amount: validationData.amount,
                    type: validationData.type as PaymentType,
                    description: validationData.description,
                    stage_category_id: validationData.stage_category_id
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async updatePaymentStatus(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.payment.update({
                where: {
                    id: request.params.payment_id as string
                },
                data: {
                    status: request.body.status as PaymentStatus
                }
            }))
        } catch (error) {
            next(error)
        }
    }
}