import { checkpointSchema } from "@/app/lib/schema/event.schema"
import { NextFunction, Request, Response } from "express"
import moment from "moment"

import { prisma } from '@/app/lib/services/prisma.service'
export class CheckpointController {
    public static async index(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.checkpoint.findMany({
                where: {
                    stage_category_id: request.params.stage_category_id as string,
                    deleted_at: null
                },
                include: {
                    runners: true,
                    volunteers: true
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async create(request: Request, response: Response, next: NextFunction) {
        try {
            const validationData = await checkpointSchema.validate(request.body, { abortEarly: false })

            response.send(await prisma.checkpoint.create({
                data: {
                    name: validationData.name,
                    stage_category_id: validationData.stage_category_id,
                    is_start: validationData.is_start,
                    is_end: validationData.is_end
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async update(request: Request, response: Response, next: NextFunction) {
        try {
            const validationData = await checkpointSchema.validate(request.body, { abortEarly: false })
            const stage = await prisma.checkpoint.findFirst({ where: { id: request.params.checkpoint_id as string } })

            response.send(await prisma.checkpoint.update({
                where: {
                    id: request.params.checkpoint_id as string
                },
                data: {
                    name: validationData.name ?? stage.name,
                    is_start: validationData.is_start ?? stage.is_start,
                    is_end: validationData.is_end ?? stage.is_end,
                    updated_at: moment.utc().toISOString()
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async destory(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.checkpoint.update({
                where: {
                    id: request.params.checkpoint_id as string
                },
                data: {
                    deleted_at: moment.utc().toISOString()
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async deleteCheckpointEntryData(request: Request, response: Response, next: NextFunction) {
        try {
            await prisma.$transaction(async (prisma) => {
                const volunteerCheckpoint = await prisma.volunteerCheckpoint.findUnique({
                    where: {
                        id: request.params.delete_checkpoint_data_id as string
                    },
                    include: {
                        checkpoint: true
                    }
                })

                if (!volunteerCheckpoint) return

                await prisma.volunteerCheckpoint.update({
                    where: {
                        id: volunteerCheckpoint.id
                    },
                    data: {
                        deleted_at: moment.utc().toISOString()
                    }
                })

                if (volunteerCheckpoint.checkpoint?.is_end) {
                    await prisma.rank.deleteMany({
                        where: {
                            runner_id: volunteerCheckpoint.runner_id
                        }
                    })
                }
            })
            response.send('ok')
        } catch (error) {
            next(error)
        }
    }

    public static async updateCheckpointEntryData(request: Request, response: Response, next: NextFunction) {
        try {
            const timer = moment(request.body.timer)

            response.send(await prisma.volunteerCheckpoint.update({
                where: {
                    id: request.params.checkpoint_id as string
                },
                data: {
                    timer: timer.toISOString()
                }
            }))
        } catch (error) {
            next(error)
        }
    }
}