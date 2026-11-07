import { NextFunction, Request, Response } from "express"
import { prisma } from '@/app/lib/services/prisma.service'

export class ResultController {
    static async index(req: Request, res: Response, next: NextFunction) {
        try {
            const { event_id, stage_id } = req.params
            const { gender, stage_category } = req.query
            const runners = await prisma.eventRunner.findMany({
                where: {
                    event_id: event_id as string,
                    stage_id: stage_id as string,
                    personal: {
                        gender_id: gender as string
                    },
                    stage_category_id: stage_category as string
                },
                include: {
                    status: true,
                    volunteer_on_checkpoints: {
                        where: {
                            deleted_at: null
                        },
                        include: {
                            checkpoint: true
                        }
                    },
                    runner_attendances: true,
                    personal: {
                        select: {
                            first_name: true,
                            last_name: true,
                            gender: true,
                            country: true,
                            itra_id: true,
                            date_of_birth: true
                        }
                    }
                }
            })
            res.json(runners)
        } catch (error) {
            next(error)
        }
    }
}