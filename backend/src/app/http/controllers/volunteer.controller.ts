import { NextFunction, Request, Response } from "express"
import Bcrypt from 'bcrypt'

import { trailRaceVolunteer } from "@/app/lib/schema/event.schema"
import moment from "moment"
import createHttpError from "http-errors"

import { prisma } from '@/app/lib/services/prisma.service'
import { Personal, User } from "@prisma/client/index-browser"
export class VolunteerController {
    public static async save(request: Request, response: Response, next: NextFunction) {
        try {
            const validationData = await trailRaceVolunteer.validate(request.body, { abortEarly: false })
            const body: any = {}
            let personal: Personal,
                user: User

            if (validationData.date_of_birth)
                body.date_of_birth = moment(validationData.date_of_birth, "YYYY-MM-DD").toISOString()

            personal = await prisma.personal.findFirst({
                where: { email: validationData.email }
            })
            if (!personal) {
                personal = await prisma.personal.create({
                    data: {
                        ...body,
                        first_name: validationData.first_name,
                        middle_name: validationData.middle_name,
                        last_name: validationData.last_name,
                        email: validationData.email,
                        phone_number: validationData.phone_number,
                        // age_category_id: validationData.age_category_id,
                        country_id: validationData.country_id,
                        // size_id: validationData.size_id,
                        gender_id: validationData.gender_id
                    }
                })
            }

            user = await prisma.user.findFirst({
                where: {
                    personal_id: personal.id
                }
            })

            if (!user) {
                const salt = await Bcrypt.genSalt(10)
                const hashPassword = await Bcrypt.hash('password', salt)

                user = await prisma.user.create({
                    data: {
                        personal_id: personal.id,
                        password: hashPassword
                    }
                })
            }

            const volunteer = await prisma.volunteer.findFirst({
                where: {
                    personal_id: personal.id,
                    stages: {
                        some: {
                            id: validationData.stage_id
                        }
                    }
                }
            })

            if (volunteer)
                throw createHttpError(409, `Volunteer with email: ${personal.email} already exists`)

            response.send(await prisma.volunteer.create({
                data: {
                    description: 'null',
                    personal_id: personal.id,
                    stages: {
                        connect: { id: validationData.stage_id }
                    }
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async assignVolunteer(request: Request, response: Response, next: NextFunction) {
        try {
            let role = await prisma.role.findFirst({
                where: {
                    name: 'Checkpoint Manager'
                }
            })

            if (role == null)
                role = await prisma.role.create({
                    data: { name: 'Checkpoint Manager' }
                })

            const volunteer = await prisma.volunteer.findFirst({
                where: { id: request.params.volunteer_id as string },
                include: {
                    checkpoints: true
                }
            })
            await prisma.user.update({
                where: {
                    personal_id: volunteer.personal_id
                },
                data: {
                    role_id: role.id
                }
            })

            // difference between old and new checkpoints
            const oldCheckpoints = volunteer.checkpoints.map((checkpoint: any) => checkpoint.id)
            let newCheckpoints = request.body.checkpoints || []
            if (!Array.isArray(newCheckpoints)) {
                newCheckpoints = [newCheckpoints]
            }
            const newCheckpointsIds = newCheckpoints.filter((id: string) => !oldCheckpoints.includes(id))
            const oldCheckpointsIds = oldCheckpoints.filter((id: string) => !newCheckpoints.includes(id))

            response.send(await prisma.volunteer.update({
                where: {
                    id: request.params.volunteer_id as string
                },
                data: {
                    checkpoints: {
                        connect: newCheckpointsIds.map((id: string) => ({ id: id })),
                        disconnect: oldCheckpointsIds.map((id: string) => ({ id: id }))
                    }
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async eventList(request: Request, response: Response, next: NextFunction) {
        try {
            const volunteer = await prisma.volunteer.findMany({
                where: {
                    personal_id: request.body.auth_user.personal_id
                },
                include: {
                    stages: {
                        include: {
                            event: true,
                            thumbnail: true
                        }
                    }
                }
            })
            response.send(volunteer.flatMap((v) => v.stages))
        } catch (error) {
            next(error)
        }
    }

    public static async checkpoints(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.volunteer.findMany({
                where: {
                    personal_id: request.body.auth_user.personal_id,
                    stages: {
                        some: {
                            id: request.params.stage_id as string
                        }
                    }
                },
                include: {
                    checkpoints: {
                        include: {
                            stage_category: true
                        }
                    }
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async checkpointEntry(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.volunteerCheckpoint.findMany({
                where: {
                    checkpoint_id: request.params.checkpoint_id as string
                },
                include: {
                    runner: true,
                    checkpoint: true
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async delete(request: Request, response: Response, next: NextFunction) {
        try {
            await prisma.$transaction(async (prisma) => {
                await prisma.volunteerCheckpoint.deleteMany({
                    where: {
                        volunteer_id: request.params.volunteer_id as string
                    }
                })
                await prisma.volunteer.delete({
                    where: {
                        id: request.params.volunteer_id as string
                    }
                })
            })
            response.send('ok')
        } catch (error) {
            next(error)
        }
    }
}