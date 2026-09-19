import { NextFunction, Request, Response } from "express"
import moment from "moment"

import { stageSchema } from "@/app/lib/schema/event.schema"
import { FileHandler } from "@/app/lib/services/file.service"
import { isBase64 } from "@/app/lib/plugins"

import { prisma } from '@/app/lib/services/prisma.service'
export class StageController {
    public static async index(request: Request, response: Response, next: NextFunction) {
        try {
            const data = await prisma.stage.findMany({
                where: {
                    event_id: request.params.event_id as string,
                    ...(String(request.query.with_deleted) !== 'true' && { deleted_at: null })
                },
                include: {
                    runners: true,
                    thumbnail: true,
                    guide_book_file: true,
                    volunteers: {
                        include: {
                            personal: true,
                            checkpoints: true
                        }
                    }
                }
            });
            response.send(data);
        } catch (error) {
            next(error)
        }
    }

    public static async create(request: Request, response: Response, next: NextFunction) {
        try {
            const body: any = {}
            const validationData = await stageSchema.validate(request.body, { abortEarly: false })

            if (validationData.thumbnail) {
                const file = new FileHandler('images')
                const image = await file.saveFile(validationData.thumbnail)
                body.image_id = image.id
            }

            if (validationData.guide_book_file) {
                const file = new FileHandler('files')
                const image = await file.saveFile(validationData.guide_book_file)
                body.guide_book_file_id = image.id
            }

            if (request.body.start)
                body.start = moment(request.body.start, 'YYYY-MM-DD').toISOString()

            if (request.body.end)
                body.end = moment(request.body.end, 'YYYY-MM-DD').toISOString()

            response.send(await prisma.stage.create({
                data: {
                    name: validationData.name,
                    excerpt: validationData.excerpt,
                    description: validationData.description,
                    location: validationData.location,
                    event_id: validationData.event_id,
                    ...body
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async update(request: Request, response: Response, next: NextFunction) {
        try {
            const body: any = {}
            const validationData = await stageSchema.validate(request.body, { abortEarly: false })
            const stage = await prisma.stage.findFirst({ where: { id: request.params.stage_id as string } })

            if (validationData.thumbnail && isBase64(validationData.thumbnail)) {
                const file = new FileHandler('images')
                const image = await file.saveFile(validationData.thumbnail, stage.image_id)
                body.image_id = image.id
            }

            if (validationData.guide_book_file && isBase64(validationData.guide_book_file)) {
                const file = new FileHandler('files')
                const image = await file.saveFile(validationData.guide_book_file, stage.guide_book_file_id)
                body.guide_book_file_id = image.id
            }

            response.send(await prisma.stage.update({
                where: {
                    id: request.params.stage_id as string
                },
                data: {
                    ...body,
                    name: validationData.name,
                    excerpt: validationData.excerpt,
                    description: validationData.description,
                    location: validationData.location,
                    event_id: validationData.event_id,
                    updated_at: moment.utc().toISOString()
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async view(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.stage.findFirst({
                where: {
                    id: request.params.stage_id as string
                },
                include: {
                    thumbnail: true,
                    guide_book_file: true,
                    stage_categories: {
                        include: {
                            map_file: true
                        }
                    },
                    event: true
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async destory(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.stage.update({
                where: {
                    id: request.params.stage_id as string
                },
                data: {
                    deleted_at: moment.utc().toISOString()
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async restore(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.stage.update({
                where: {
                    id: request.params.stage_id as string
                },
                data: {
                    deleted_at: null
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async listRunners(request: Request, response: Response, next: NextFunction) {
        try {
            const stage = await prisma.stage.findFirst({
                where: {
                    id: request.params.stage_id as string
                },
                include: {
                    stage_categories: {
                        include: {
                            runners: {
                                where: {
                                    bib: {
                                        contains: request.query.bib as string
                                    },
                                    status: null
                                },
                                include: {
                                    tshirt_size: true,
                                    runner_attendances: true,
                                    personal: {
                                        include: {
                                            avatar: true,
                                            country: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            })
            response.send(stage.stage_categories)
        } catch (error) {
            next(error)
        }
    }
}