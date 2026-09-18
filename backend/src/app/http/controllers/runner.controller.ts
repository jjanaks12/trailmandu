import { NextFunction, Request, Response } from "express"

import moment from "moment"
import createHttpError from "http-errors"
import Bcrypt from 'bcrypt'


import { trailRaceRunner } from "@/app/lib/schema/event.schema"
import { FileHandler } from "@/app/lib/services/file.service"
import { emailQueue } from "@/queue/email.queue"
import { prisma } from '@/app/lib/services/prisma.service'
import { PaymentMethod, PaymentStatus } from "@prisma/client/index-browser"
import ical, { ICalCalendarMethod } from "ical-generator"

export class RunnerController {
    public static async index(request: Request, response: Response, next: NextFunction) {
        try {
            let paymentFilter: Record<string, any> | undefined = request.query.payment_status || request.query.payment_method ? { some: {} } : undefined
            // let statusFilter: Record<string, any> | undefined = request.query.show_all ? undefined : { status: RunnerStatus.ACTIVE }

            if (request.query.payment_status)
                paymentFilter.some.status = request.query.payment_status as PaymentStatus

            if (request.query.payment_method)
                paymentFilter.some.method = request.query.payment_method as PaymentMethod

            /* if (!request.query.show_all)
                statusFilter.some.status = RunnerStatus.ACTIVE */

            const runners = await prisma.eventRunner.findMany({
                where: {
                    event_id: request.params.event_id as string,
                    stage_id: request.params.stage_id as string,
                    stage_category_id: request.query.stage_category as string,
                    OR: [
                        {
                            personal: {
                                OR: [{
                                    first_name: {
                                        contains: request.query.s as string
                                    }
                                }, {
                                    middle_name: {
                                        contains: request.query.s as string
                                    }
                                }, {
                                    last_name: {
                                        contains: request.query.s as string
                                    }
                                }]
                            }
                        },
                        {
                            bib: {
                                contains: request.query.s as string
                            }
                        },
                    ],
                    personal: {
                        gender_id: request.query.gender as string
                    },
                    payments: paymentFilter
                },
                include: {
                    tshirt_size: true,
                    runner_attendances: {
                        where: {
                            stage_id: request.params.stage_id as string
                        }
                    },
                    personal: {
                        include: {
                            country: true,
                            gender: true,
                            size: true
                        }
                    },
                    volunteer_on_checkpoints: {
                        include: {
                            checkpoint: true
                        },
                        orderBy: {
                            timer: 'desc'
                        }
                    },
                    payments: {
                        include: {
                            screenshot: true
                        },
                        orderBy: {
                            created_at: 'desc'
                        }
                    },
                    stage: true,
                    stage_category: true,
                    status: true,
                    rank: true
                },
                orderBy: [{
                    bib: 'asc'
                }, {
                    rank: {
                        position: 'asc'
                    }
                }]
            })
            response.send(runners)
        } catch (error) {
            next(error)
        }
    }

    public static async save(request: Request, response: Response, next: NextFunction) {
        try {
            const validationData = await trailRaceRunner.validate(request.body, { abortEarly: false })
            const eventId = request.params.event_id as string
            const body: any = {}


            if (validationData.date_of_birth)
                body.date_of_birth = moment(validationData.date_of_birth, "YYYY-MM-DD").toISOString()

            const baseCategoryId = validationData.is_season_pass ? validationData.season_pass_categories[0] : validationData.stage_category_id

            const event = await prisma.trailRace.findFirst({
                where: { id: eventId },
                include: {
                    runners: {
                        where: {
                            stage_category_id: baseCategoryId
                        }
                    }
                }
            })

            const stageCategory = await prisma.stageCategory.findFirst({
                where: { id: baseCategoryId },
                include: {
                    stage: {
                        include: {
                            event: true
                        }
                    }
                }
            })

            let personal = await prisma.personal.findFirst({
                where: { email: validationData.email },
                include: {
                    gender: true,
                    country: true
                }
            })
            if (!personal)
                personal = await prisma.personal.create({
                    data: {
                        ...body,
                        first_name: validationData.first_name,
                        middle_name: validationData.middle_name,
                        last_name: validationData.last_name,
                        email: validationData.email,
                        itra_id: validationData.itra_id,
                        phone_number: validationData.phone_number,
                        // age_category_id: validationData.age_category_id,
                        country_id: validationData.country_id,
                        size_id: validationData.size_id,
                        gender_id: validationData.gender_id
                    },
                    include: {
                        gender: true,
                        country: true
                    }
                })
            else
                personal = await prisma.personal.update({
                    where: { id: personal.id },
                    data: {
                        ...body,
                        first_name: validationData.first_name,
                        middle_name: validationData.middle_name,
                        last_name: validationData.last_name,
                        email: validationData.email,
                        itra_id: validationData.itra_id,
                        phone_number: validationData.phone_number,
                        // age_category_id: validationData.age_category_id,
                        country_id: validationData.country_id,
                        size_id: validationData.size_id,
                        gender_id: validationData.gender_id
                    },
                    include: {
                        gender: true,
                        country: true
                    }
                })

            let user = await prisma.user.findFirst({ where: { personal_id: personal.id } })
            if (!user) {
                const salt = await Bcrypt.genSalt(10)
                const hashPassword = await Bcrypt.hash('password', salt)

                let role = await prisma.role.findFirst({ where: { name: 'Runner' } })

                if (role == null)
                    role = await prisma.role.create({ data: { name: 'Runner' } })

                user = await prisma.user.create({
                    data: {
                        personal_id: personal.id,
                        password: hashPassword,
                        role_id: role.id
                    }
                })
            }

            let matchedCategories = [stageCategory]
            if (validationData.is_season_pass) {
                const stages = await prisma.stage.findMany({
                    where: { event_id: eventId },
                    include: { stage_categories: true }
                })

                matchedCategories = []
                for (const stage of stages) {
                    const match = stage.stage_categories.find(c => validationData.season_pass_categories.includes(c.id))
                    if (match) matchedCategories.push(match as any)
                }
            }

            const [min] = stageCategory.bib_range.split('-')
            const baseBib = (Number(min) + (event.runners.length + 1))
            const runnerCon = new RunnerController()
            const categoryIds = matchedCategories.map((c: any) => c.id)
            const checkedBib = await runnerCon.checkBIB(baseBib, categoryIds)
            const finalBib = checkedBib.toString().padStart(3, '0')

            let paymentBody: any = {}
            if (validationData.payment_screenshot) {
                const fileUpload = new FileHandler('payments')
                const image = await fileUpload.saveFile(validationData.payment_screenshot)
                paymentBody.image_id = image.id
            }

            const createdRunners = []
            let runner: any = null
            let payment: any = null

            for (const category of matchedCategories) {
                const existingRunner = await prisma.eventRunner.findFirst({
                    where: {
                        event_id: eventId,
                        stage_id: category.stage_id,
                        personal_id: personal.id
                    }
                })

                if (existingRunner) {
                    if (!validationData.is_season_pass) {
                        throw createHttpError(409, `You have already registered for this event`)
                    } else {
                        continue
                    }
                }

                runner = await prisma.eventRunner.create({
                    data: {
                        bib: finalBib,
                        event_id: eventId,
                        personal_id: personal.id,
                        stage_id: category.stage_id,
                        stage_category_id: category.id,
                        want_lunch: validationData.description.want_lunch ?? false,
                        club_name: validationData.description.club_name,
                        emergency_contact_name: validationData.description.emergency_contact_name,
                        emergency_contact_no: validationData.description.emergency_contact_phone,
                        shirt_id: validationData.size_id,
                        season_pass_id: validationData.is_season_pass ? validationData.season_pass_id : null
                    }
                })
                createdRunners.push(runner)

                let paymentAmount = 0;
                let shouldCreatePayment = false;

                if (validationData.is_season_pass && validationData.season_pass_id) {
                    if (createdRunners.length === 1) {
                        const seasonPassPayment = await prisma.seasonPassPayment.findFirst({
                            where: {
                                season_pass_id: validationData.season_pass_id,
                                type: validationData.payment_type
                            }
                        })
                        if (seasonPassPayment) {
                            paymentAmount = Number(seasonPassPayment.amount);
                            shouldCreatePayment = true;
                        }
                    } else {
                        paymentAmount = 0;
                        shouldCreatePayment = true;
                    }
                } else {
                    const stageCategoryPayment = await prisma.stageCategoryPayment.findFirst({
                        where: {
                            stage_category_id: category.id,
                            type: validationData.payment_type
                        }
                    })
                    if (stageCategoryPayment) {
                        paymentAmount = Number(stageCategoryPayment.amount);
                        shouldCreatePayment = true;
                    }
                }

                if (shouldCreatePayment) {
                    payment = await prisma.payment.create({
                        data: {
                            ...paymentBody,
                            amount: paymentAmount,
                            stage_category_id: category.id,
                            runner_id: runner.id,
                            method: validationData.payment_method
                        }
                    })
                }
            }

            if (createdRunners.length === 0) {
                throw createHttpError(409, `You have already registered for all stages of this event`)
            }
            const start = moment.utc(stageCategory.start).local().format('DD-MM-YYYY hh:mm a')
            const end = moment.utc(stageCategory.end).local().format('DD-MM-YYYY hh:mm a')

            const calendar = ical({ name: `${stageCategory.stage.name} - ${stageCategory.name}` })
            calendar.method(ICalCalendarMethod.REQUEST)
            calendar.createEvent({
                start: new Date(stageCategory.start),
                end: new Date(stageCategory.end),
                summary: stageCategory.excerpt,
                description: stageCategory.description,
                location: stageCategory.location,
                url: `https://trailmandu.com/races/${event.slug}/stage/${stageCategory.stage.id}`
            })

            await emailQueue.add('sendEmail', {
                fileName: 'welcome',
                replacements: {
                    title: 'Thank you for signing up for race',
                    user: {
                        name: [validationData.first_name, validationData.middle_name, validationData.last_name].join(' '),
                        email: validationData.email,
                        bib: runner.bib,
                        country: personal.country.name,
                        gender: personal.gender.name,
                        contact_no: personal.phone_number,
                        dob: moment(personal.date_of_birth).format('DD-MM-YYYY'),
                        emergency_contact: validationData.description.emergency_contact_name,
                        emergency_contact_no: validationData.description.emergency_contact_phone,
                    },
                    stage: stageCategory.stage,
                    stageCategory: { ...stageCategory, start, end },
                    links: {
                        "Trailmandu": 'https://trailmandu.com',
                        event: 'https://trailmandu.com'
                    }
                },
                props: {
                    recipients: [{
                        email: validationData.email,
                        name: validationData.first_name,
                    }],
                    subject: 'Welcome to Trailmandu'
                },
                senderEmail: 'info@trailmandu.com',
                attachments: [{
                    content: Buffer.from(calendar.toString()).toString('base64'),
                    filename: `${stageCategory.stage.name} - ${stageCategory.name}.ics`,
                    type: "text/calendar; charset=UTF-8; method=REQUEST",
                    disposition: 'attachment'
                }],
                category: 'event'
            })

            response.send(payment)
        } catch (error) {
            next(error)
        }
    }

    private async checkBIB(bib: number, stage_category_ids: string[]) {
        let currentBib = bib;
        while (true) {
            const bibExists = await prisma.eventRunner.findFirst({
                where: {
                    bib: currentBib.toString().padStart(3, '0'),
                    stage_category_id: { in: stage_category_ids }
                }
            });
            if (bibExists) {
                currentBib++;
            } else {
                return currentBib;
            }
        }
    }

    public static async update(request: Request, response: Response, next: NextFunction) {
        try {
            const personalData: any = {}
            const runnerData: any = {}
            const bibExists = await prisma.eventRunner.findFirst({
                where: {
                    bib: request.body.bib,
                    stage_category_id: request.body.stage_category_id
                }
            })

            if (bibExists && bibExists.id !== request.params.runner_id)
                throw createHttpError(409, `Bib: ${request.body.bib} already exists`)
            else
                runnerData.bib = request.body.bib

            const runner = await prisma.eventRunner.update({
                where: {
                    id: request.params.runner_id as string
                },
                data: {
                    ...runnerData,
                    stage_category_id: String(request.body.stage_category_id),
                    want_lunch: request.body.description.want_lunch ?? false,
                    club_name: request.body.description.club_name,
                    emergency_contact_name: request.body.description.emergency_contact_name,
                    emergency_contact_no: request.body.description.emergency_contact_phone,
                }
            })

            if (request.body.date_of_birth)
                personalData.date_of_birth = moment(request.body.date_of_birth, "YYYY-MM-DD").toISOString()

            await prisma.personal.update({
                where: {
                    id: runner.personal_id
                },
                data: {
                    ...personalData,
                    first_name: request.body.first_name,
                    middle_name: request.body.middle_name,
                    last_name: request.body.last_name,
                    phone_number: request.body.phone_number,
                    gender_id: request.body.gender_id,
                    country_id: request.body.country_id,
                    email: request.body.email,
                    size_id: request.body.size_id
                }
            })
            response.send(runner)
        } catch (error) {
            next(error)
        }
    }

    public static async logTimer(request: Request, response: Response, next: NextFunction) {
        try {
            const checkpoint = await prisma.checkpoint.findFirst({
                where: {
                    id: request.params.checkpoint_id as string
                }
            })
            const volunteer = await prisma.volunteer.findFirst({
                where: {
                    personal_id: request.body.auth_user.personal_id
                }
            })
            if (!volunteer)
                throw createHttpError.NotFound('Volunteer not found')

            const hasAlreadyBeenAdded = await prisma.volunteerCheckpoint.findFirst({
                where: {
                    runner_id: request.params.runner_id as string,
                    checkpoint_id: request.params.checkpoint_id as string,
                    volunteer_id: volunteer.id
                }
            })

            if (hasAlreadyBeenAdded)
                throw createHttpError.BadRequest('Runner has already been added to this checkpoint')

            const runner = await prisma.eventRunner.findFirst({
                where: {
                    id: request.params.runner_id as string
                },
                include: {
                    personal: true
                }
            })

            const rank = await prisma.rank.count({
                where: {
                    stage_category_id: request.body.stage_category_id as string,
                    gender_id: runner.personal.gender_id as string
                }
            })

            if (checkpoint.is_end)
                await prisma.rank.create({
                    data: {
                        runner_id: request.params.runner_id as string,
                        position: rank + 1,
                        gender_id: runner.personal.gender_id as string,
                        stage_category_id: request.body.stage_category_id as string
                    }
                })

            const ifAlreadyAdded = await prisma.volunteerCheckpoint.findFirst({
                where: {
                    runner_id: request.params.runner_id as string,
                    checkpoint_id: request.params.checkpoint_id as string,
                    volunteer_id: volunteer.id
                }
            })

            if (ifAlreadyAdded)
                throw createHttpError.BadRequest('Runner has already been added to this checkpoint')

            response.send(await prisma.volunteerCheckpoint.create({
                data: {
                    volunteer_id: volunteer.id,
                    runner_id: request.params.runner_id as string,
                    checkpoint_id: request.params.checkpoint_id as string
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async recent(request: Request, response: Response, next: NextFunction) {
        try {
            const runners = await prisma.eventRunner.findMany({
                where: {
                    deleted_at: null
                },
                include: {
                    personal: true,
                    stage: {
                        include: {
                            event: true
                        }
                    },
                    status: true,
                    season_pass: true
                },
                orderBy: {
                    created_at: 'desc'
                },
                take: request.query.per_page ? parseInt(request.query.per_page as string) : 5
            })
            response.send(runners)
        } catch (error) {
            next(error)
        }
    }

    public static async stageCategoryList(request: Request, response: Response, next: NextFunction) {
        try {
            const personal = await prisma.personal.findFirst({
                where: {
                    id: request.body.auth_user.personal_id
                },
                include: {
                    runners: {
                        include: {
                            stage_category: true,
                            stage: true
                        }
                    }
                }
            })
            response.send(personal.runners)
        } catch (error) {
            next(error)
        }
    }

    public static async get(request: Request, response: Response, next: NextFunction) {
        try {
            const runner = await prisma.eventRunner.findFirst({
                where: {
                    id: request.params.runner_id as string
                },
                include: {
                    personal: true,
                    stage_category: true,
                    stage: true,
                    payments: {
                        include: {
                            screenshot: true
                        }
                    }
                }
            })
            response.send(runner)
        } catch (error) {
            next(error)
        }
    }

    public static async getByEmail(request: Request, response: Response, next: NextFunction) {
        try {
            const personal = await prisma.personal.findFirst({
                where: {
                    email: request.params.email as string
                },
                include: {
                    runners: true
                }
            })

            response.send(personal)
        } catch (error) {
            next(error)
        }
    }

    public static async delete(request: Request, response: Response, next: NextFunction) {
        try {
            await prisma.$transaction(async (prisma) => {
                const runner = await prisma.eventRunner.findUnique({
                    where: {
                        id: request.params.runner_id as string
                    },
                    include: {
                        payments: true
                    }
                })

                if (!runner)
                    throw createHttpError.NotFound('Runner not found')

                if (runner.payments)
                    for (const payment of runner.payments) {
                        await prisma.payment.delete({
                            where: {
                                id: payment.id
                            }
                        })

                        if (payment.image_id) {
                            const fileHandler = new FileHandler('images')
                            fileHandler.deleteFile(payment.image_id)
                        }
                    }

                await prisma.volunteerCheckpoint.deleteMany({
                    where: {
                        runner_id: runner.id
                    }
                })

                await prisma.eventRunner.delete({
                    where: {
                        id: request.params.runner_id as string
                    }
                })
            })
            response.send('ok')
        } catch (error) {
            next(error)
        }
    }

    public static async disqualify(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.eventRunnerStatus.create({
                data: {
                    runner_id: request.params.runner_id as string,
                    status: 'DISQUALIFIED'
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async didNotFinished(request: Request, response: Response, next: NextFunction) {
        try {
            await prisma.$transaction(async (prisma) => {
                await prisma.eventRunnerStatus.create({
                    data: {
                        runner_id: request.params.runner_id as string,
                        status: 'DID_NOT_FINISH'
                    }
                })

                const stage = await prisma.stageCategory.findFirst({
                    where: {
                        checkpoints: {
                            some: {
                                id: request.body.checkpoint_id
                            }
                        }
                    },
                    include: {
                        checkpoints: true
                    }
                })

                for (const checkpoint of stage.checkpoints) {
                    await prisma.volunteerCheckpoint.deleteMany({
                        where: {
                            runner_id: request.params.runner_id as string,
                            checkpoint_id: checkpoint.id
                        }
                    })
                }

                await prisma.rank.deleteMany({
                    where: {
                        runner_id: request.params.runner_id as string,
                        stage_category_id: stage.id
                    }
                })
            })
            response.send('success')
        } catch (error) {
            next(error)
        }
    }

    public static async attendance(request: Request, response: Response, next: NextFunction) {
        try {
            const ifAlreadyPresent = await prisma.runnerAttendance.findFirst({
                where: {
                    runner_id: request.params.runner_id as string,
                    stage_id: request.body.stage_id as string
                }
            })

            if (ifAlreadyPresent) throw createHttpError.Conflict('Runner is already present')

            response.send(await prisma.runnerAttendance.create({
                data: {
                    runner_id: request.params.runner_id as string,
                    stage_id: request.params.stage_id as string
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async bulkImport(request: Request, response: Response, next: NextFunction) {
        try {
            const event_id = request.body.event_id
            const stage_id = request.body.stage_id
            const stageCategoryMap = request.body.stage_categories
            /*  const event_id = 'cmn7ffez5001sw8s1evt3kput'
             const stage_id = 'cmn7fg8ol001uw8s14zvcbn01'
             const stageCategoryMap = {
                 '100_mile': 'cmn7fhnye001ww8s1lenw2eud',
                 '80_km': 'cmnzfh9x1000104vdudv9um79'
             } */
            const runnersIDS = []

            for (const requestRunner of request.body.runners ?? []) {
                const nameSplits = requestRunner.name.split(' ')
                const first_name = nameSplits[0];
                const last_name = nameSplits.length > 1 ? nameSplits.pop() : "";
                const middle_name = nameSplits.slice(1).join(" ");
                await prisma.$transaction(async (tx) => {

                    const tshirt_size = await tx.size.findFirst({
                        where: {
                            name: {
                                contains: requestRunner.tshirt_size
                            }
                        }
                    })

                    const country = await tx.country.findFirst({
                        where: {
                            name: {
                                contains: requestRunner.country
                            }
                        }
                    })

                    const gender = await tx.gender.findFirst({
                        where: {
                            name: {
                                contains: requestRunner.gender
                            }
                        }
                    })

                    let personal = await tx.personal.findFirst({ where: { email: requestRunner.email } })
                    if (!personal)
                        personal = await tx.personal.create({
                            data: {
                                first_name,
                                middle_name,
                                last_name,
                                email: requestRunner.email,
                                gender_id: gender.id,
                                country_id: country?.id as string,
                            }
                        })

                    const runner = await tx.eventRunner.create({
                        data: {
                            bib: requestRunner.bib_number.toString(),
                            personal_id: personal.id,
                            event_id: event_id,
                            stage_id: stage_id,
                            stage_category_id: stageCategoryMap[requestRunner.race_category],
                            shirt_id: tshirt_size?.id,
                            club_name: requestRunner.club,
                        }
                    })

                    runnersIDS.push(runner.id)
                })
            }

            response.send(runnersIDS)
        } catch (error) {
            next(error)
        }
    }

    public static async sendConfirmationEmail(request: Request, response: Response, next: NextFunction) {
        try {
            const runner = await prisma.eventRunner.findFirst({
                where: { id: request.params.runner_id as string },
                include: {
                    personal: {
                        include: { country: true, gender: true }
                    },
                    stage_category: {
                        include: {
                            stage: {
                                include: { event: true }
                            }
                        }
                    }
                }
            })

            if (!runner) throw createHttpError.NotFound('Runner not found')

            const personal = runner.personal
            const stageCategory = runner.stage_category
            const event = stageCategory.stage.event

            const start = moment.utc(stageCategory.start).local().format('DD-MM-YYYY hh:mm a')
            const end = moment.utc(stageCategory.end).local().format('DD-MM-YYYY hh:mm a')

            const calendar = ical({ name: `${stageCategory.stage.name} - ${stageCategory.name}` })
            calendar.method(ICalCalendarMethod.REQUEST)
            calendar.createEvent({
                start: new Date(stageCategory.start),
                end: new Date(stageCategory.end),
                summary: stageCategory.excerpt,
                description: stageCategory.description,
                location: stageCategory.location,
                url: `https://trailmandu.com/races/${event.slug}/stage/${stageCategory.stage.id}`
            })

            await emailQueue.add('sendEmail', {
                fileName: 'welcome',
                replacements: {
                    title: 'Thank you for signing up for race',
                    user: {
                        name: [personal.first_name, personal.middle_name, personal.last_name].join(' '),
                        email: personal.email,
                        bib: runner.bib,
                        country: personal.country.name,
                        gender: personal.gender.name,
                        contact_no: personal.phone_number,
                        dob: moment(personal.date_of_birth).format('DD-MM-YYYY'),
                        emergency_contact: runner.emergency_contact_name,
                        emergency_contact_no: runner.emergency_contact_no,
                    },
                    stage: stageCategory.stage,
                    stageCategory: { ...stageCategory, start, end },
                    links: {
                        "Trailmandu": 'https://trailmandu.com',
                        event: 'https://trailmandu.com'
                    }
                },
                props: {
                    recipients: [{
                        email: personal.email,
                        name: personal.first_name,
                    }],
                    subject: 'Welcome to Trailmandu'
                },
                senderEmail: 'info@trailmandu.com',
                attachments: [{
                    content: Buffer.from(calendar.toString()).toString('base64'),
                    filename: `${stageCategory.stage.name} - ${stageCategory.name}.ics`,
                    type: "text/calendar; charset=UTF-8; method=REQUEST",
                    disposition: 'attachment'
                }],
                category: 'event'
            })

            response.send('Confirmation email queued')
        } catch (error) {
            next(error)
        }
    }

    public static async sendMassEmail(request: Request, response: Response, next: NextFunction) {
        try {
            const { runnerIds, stageId, subject, htmlTemplate, variableMap } = request.body
            const eventId = request.params.event_id

            let finalSubject = subject
            let finalHtmlTemplate = htmlTemplate
            let finalVariableMap = variableMap

            if (!finalSubject || !finalHtmlTemplate) {
                const template = await prisma.eventEmailTemplate.findUnique({
                    where: { event_id: eventId as string }
                })
                
                if (!template) {
                    response.status(400).send('Subject and HTML template are required, and no saved template was found')
                    return
                }
                
                finalSubject = template.subject
                finalHtmlTemplate = template.htmlContent
                finalVariableMap = template.variableMap as Record<string, string>
            }

            let whereClause: any = {}
            if (runnerIds && Array.isArray(runnerIds) && runnerIds.length > 0) {
                whereClause = { id: { in: runnerIds } }
            } else if (stageId) {
                whereClause = { stage_category: { stage_id: stageId } }
            } else if (eventId) {
                whereClause = { stage_category: { stage: { event_id: eventId } } }
            } else {
                response.status(400).send('Must provide runnerIds, stageId, or eventId')
                return
            }

            const runners = await prisma.eventRunner.findMany({
                where: whereClause,
                include: {
                    personal: {
                        include: { country: true, gender: true }
                    },
                    stage_category: {
                        include: {
                            stage: {
                                include: { event: true }
                            }
                        }
                    }
                }
            })

            let queuedCount = 0;
            const mapKeys = Object.keys(finalVariableMap || {})

            for (const runner of runners) {
                const personal = runner.personal
                const stageCategory = runner.stage_category
                const event = stageCategory?.stage?.event

                if (!personal?.email) continue;

                // Build values map based on what is available
                const values: Record<string, string> = {
                    'First Name': personal.first_name || '',
                    'Last Name': personal.last_name || '',
                    'Full Name': [personal.first_name, personal.middle_name, personal.last_name].filter(Boolean).join(' '),
                    'Email': personal.email,
                    'BIB Number': runner.bib || '',
                    'Country': personal.country?.name || '',
                    'Gender': personal.gender?.name || '',
                    'Stage Distance': stageCategory?.name || '',
                    'Event Name': event?.name || '',
                    'Event Timing': stageCategory?.start ? moment.utc(stageCategory.start).local().format('DD-MM-YYYY hh:mm a') : '',
                    'Event Thumbnail URL': finalVariableMap?.['Event Thumbnail URL'] || '', 
                    'Stage Image URL': finalVariableMap?.['Stage Image URL'] || ''
                }

                // Replace placeholders in the HTML
                let runnerHtml = finalHtmlTemplate
                for (const placeholder of mapKeys) {
                    const mappedField = finalVariableMap[placeholder]
                    const val = values[mappedField] !== undefined ? values[mappedField] : mappedField // fallback to the literal mapping value for images if it was a direct URL
                    
                    // Global replace
                    const regex = new RegExp(placeholder.replace(/[.*+?^$()|[\]\\]/g, '\\$&'), 'g');
                    runnerHtml = runnerHtml.replace(regex, val)
                }

                await emailQueue.add('sendEmail', {
                    to: personal.email,
                    subject: finalSubject,
                    html: runnerHtml,
                    senderEmail: 'info@trailmandu.com',
                    category: 'event_mass_email'
                })

                queuedCount++;
            }

            response.send({ message: `Mass email queued for ${queuedCount} runners` })
        } catch (error) {
            next(error)
        }
    }
}