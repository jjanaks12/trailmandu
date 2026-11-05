import { seasonPassSchema, seasonPassPaymentSchema } from "@/app/lib/schema/event.schema"
import { FileHandler } from "@/app/lib/services/file.service"
import { NextFunction, Request, Response } from "express"
import { prisma } from '@/app/lib/services/prisma.service'
import { PaymentType } from "@prisma/client"
import { Redis } from '@/app/lib/services/redis.service'

export class SeasonPassController {
    public static async index(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.seasonPass.findMany({
                where: {
                    event_id: request.params.event_id as string
                },
                include: {
                    payments: {
                        include: {
                            screenshot: true
                        }
                    },
                    stage_categories: true
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async store(request: Request, response: Response, next: NextFunction) {
        try {
            const validationData = await seasonPassSchema.validate(request.body, { abortEarly: false })
            response.send(await prisma.seasonPass.create({
                data: {
                    name: validationData.name,
                    event_id: validationData.event_id,
                    stage_categories: validationData.category_ids ? {
                        connect: validationData.category_ids.map((id: string) => ({ id }))
                    } : undefined
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async update(request: Request, response: Response, next: NextFunction) {
        try {
            const validationData = await seasonPassSchema.validate(request.body, { abortEarly: false })
            response.send(await prisma.seasonPass.update({
                where: {
                    id: request.params.id as string
                },
                data: {
                    name: validationData.name,
                    event_id: validationData.event_id,
                    stage_categories: validationData.category_ids ? {
                        set: validationData.category_ids.map((id: string) => ({ id }))
                    } : undefined
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async destroy(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.seasonPass.delete({
                where: {
                    id: request.params.id as string
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async storePayment(request: Request, response: Response, next: NextFunction) {
        try {
            let body: any = {}
            const validationData = await seasonPassPaymentSchema.validate(request.body, { abortEarly: false })

            if (request.body.image) {
                const fileUpload = new FileHandler('payments')
                const image = await fileUpload.saveFile(request.body.image)
                body.image_id = image.id
            }

            const payment = await prisma.seasonPassPayment.create({
                data: {
                    ...body,
                    amount: validationData.amount,
                    type: validationData.type as PaymentType,
                    description: validationData.description,
                    season_pass_id: validationData.season_pass_id
                }
            })

            // Invalidate the season passes cache since a payment was added
            for await (const key of Redis.client.scanIterator({
                MATCH: `__cache__/seasonpasses*`
            })) {
                await Redis.client.del(key)
            }

            response.send(payment)
        } catch (error) {
            next(error)
        }
    }

    public static async updatePayment(request: Request, response: Response, next: NextFunction) {
        try {
            const validationData = await seasonPassPaymentSchema.validate(request.body, { abortEarly: false })
            const payment = await prisma.seasonPassPayment.findUnique({
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

            const updatedPayment = await prisma.seasonPassPayment.update({
                where: {
                    id: request.params.payment_id as string
                },
                data: {
                    ...body,
                    amount: validationData.amount,
                    type: validationData.type as PaymentType,
                    description: validationData.description,
                    season_pass_id: validationData.season_pass_id
                }
            })

            // Invalidate the season passes cache since a payment was updated
            for await (const key of Redis.client.scanIterator({
                MATCH: `__cache__/seasonpasses*`
            })) {
                await Redis.client.del(key)
            }

            response.send(updatedPayment)
        } catch (error) {
            next(error)
        }
    }

    public static async destroyPayment(request: Request, response: Response, next: NextFunction) {
        try {
            const deletedPayment = await prisma.seasonPassPayment.delete({
                where: {
                    id: request.params.payment_id as string
                }
            })

            // Invalidate the season passes cache since a payment was deleted
            for await (const key of Redis.client.scanIterator({
                MATCH: `__cache__/seasonpasses*`
            })) {
                await Redis.client.del(key)
            }

            response.send(deletedPayment)
        } catch (error) {
            next(error)
        }
    }
}
