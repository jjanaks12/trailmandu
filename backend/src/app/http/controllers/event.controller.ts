import { NextFunction, Request, Response } from "express"
import { Prisma } from "@prisma/client"
import path from "path"
import fs from "fs"

import { APIQuery } from "@/app/lib/types"
import { eventSchema } from "@/app/lib/schema/event.schema"
import moment from "moment"
import { FileHandler } from "@/app/lib/services/file.service"
import { prisma } from '@/app/lib/services/prisma.service'
import { Redis } from '@/app/lib/services/redis.service'
import { emailQueue } from "@/queue/email.queue"
import { __basedir } from "@/index"

export class EventController {
    public static async clearCache(request: Request, response: Response, next: NextFunction) {
        try {
            const event = await prisma.trailRace.findUnique({ where: { id: request.params.id as string } })
            if (event && event.slug) {
                // Clear all API caches
                for await (const key of Redis.client.scanIterator({
                    MATCH: `__api_cache__*`,
                    COUNT: 100
                })) {
                    await Redis.client.del(key)
                }

                // Clear all database and other general caches
                for await (const key of Redis.client.scanIterator({
                    MATCH: `__cache__/*`,
                    COUNT: 100
                })) {
                    await Redis.client.del(key)
                }
            }
            response.send({ message: 'Cache cleared successfully' })
        } catch (error) {
            next(error)
        }
    }

    public static async index(request: Request<{}, {}, {}, APIQuery>, response: Response, next: NextFunction) {
        try {
            const { per_page = 10, current = 1, s = '', sort, status } = request.query as any
            const skip = (current - 1) * per_page

            const where: Prisma.TrailRaceWhereInput = {
                deleted_at: status === 'deleted' ? { not: null } : null
            }

            if (s) {
                where.OR = [
                    { name: { contains: s } },
                    { excerpt: { contains: s } }
                ]
            }

            if (status && status !== 'all') {
                const now = new Date()
                if (status === 'completed') {
                    where.end = { lt: now }
                } else if (status === 'ongoing') {
                    where.start = { lte: now }
                    where.end = { gte: now }
                } else if (status === 'coming soon') {
                    where.start = { gt: now }
                }
            }

            const events = await prisma.trailRace.findMany({
                skip,
                take: parseInt(per_page.toString()),
                include: {
                    stages: {
                        where: {
                            deleted_at: null
                        },
                        include: {
                            stage_categories: true,
                            thumbnail: true,
                            guide_book_file: true
                        }
                    },
                    thumbnail: true,
                    gallery: {
                        include: {
                            images: true
                        }
                    }
                },
                where,
                orderBy: [{ created_at: 'desc' }],
            })

            const total = await prisma.trailRace.count({ where })

            response.send({
                per_page: Number(per_page),
                current: Number(current),
                sort,
                total,
                total_page: Math.ceil(total / per_page),
                data: events
            })
        } catch (error) {
            next(error)
        }
    }

    public static async publicIndex(request: Request<{}, {}, {}, APIQuery>, response: Response, next: NextFunction) {
        try {
            const { per_page = 10, current = 1, s = '', sort } = request.query
            const skip = (current - 1) * per_page

            const where: Prisma.TrailRaceWhereInput = {
                deleted_at: null,
                published_at: { not: null }
            }

            if (s) {
                where.OR = [
                    { name: { contains: s } },
                    { excerpt: { contains: s } }
                ]
            }

            const events = await prisma.trailRace.findMany({
                skip,
                take: parseInt(per_page.toString()),
                include: {
                    thumbnail: true,
                    _count: {
                        select: { 
                            stages: { where: { deleted_at: null } }, 
                            runners: { where: { deleted_at: null } }
                        }
                    }
                },
                where,
                orderBy: [{ start: 'desc' }],
            })

            const total = await prisma.trailRace.count({ where })

            response.send({
                per_page: Number(per_page),
                current: Number(current),
                sort,
                total,
                total_page: Math.ceil(total / per_page),
                data: events
            })
        } catch (error) {
            next(error)
        }
    }

    public static async eventList(request: Request, response: Response, next: NextFunction) {
        try {
            const events = await prisma.trailRace.findMany({
                where: {
                    deleted_at: null,
                    published_at: { not: null }
                },
                orderBy: [{ created_at: 'desc' }],
            })

            response.send(events)
        } catch (error) {
            next(error)
        }
    }

    public static async currentRace(request: Request, response: Response, next: NextFunction) {
        try {
            const allRaces = await prisma.trailRace.findMany({
                where: {
                    deleted_at: null,
                    published_at: { not: null }
                },
                select: {
                    id: true,
                    start: true,
                    end: true,
                    created_at: true
                }
            })

            if (!allRaces.length) {
                response.send(null)
                return
            }

            const now = moment()
            
            const futureRaces = allRaces.filter(r => moment(r.end).isAfter(now)).sort((a, b) => moment(a.start).diff(moment(b.start)))
            const pastRaces = allRaces.filter(r => moment(r.end).isSameOrBefore(now)).sort((a, b) => moment(b.end).diff(moment(a.end)))

            const nextRace = futureRaces[0]
            const lastRace = pastRaces[0]

            let selectedRaceId: string

            if (lastRace && now.diff(moment(lastRace.end), 'weeks', true) < 1) {
                // lastRace finished less than 1 week ago
                if (nextRace && moment(nextRace.start).diff(now, 'weeks', true) < 1) {
                    selectedRaceId = nextRace.id
                } else {
                    selectedRaceId = lastRace.id
                }
            } else {
                // lastRace finished more than 1 week ago, or no lastRace
                if (nextRace && moment(nextRace.start).diff(now, 'months', true) < 1.5) {
                    selectedRaceId = nextRace.id
                } else {
                    selectedRaceId = lastRace ? lastRace.id : nextRace?.id || allRaces[0].id
                }
            }

            const event = await prisma.trailRace.findUnique({
                where: { id: selectedRaceId },
                include: {
                    stages: {
                        where: {
                            deleted_at: null
                        },
                        include: {
                            stage_categories: true,
                            thumbnail: true,
                            guide_book_file: true
                        }
                    },
                    thumbnail: true,
                    pricing_tiers: true,
                    addons: {
                        include: {
                            stages: true
                        }
                    }
                }
            })

            response.send(event)
        } catch (error) {
            next(error)
        }
    }

    public static async create(request: Request, response: Response, next: NextFunction) {
        try {
            const validationData = await eventSchema.validate(request.body, { abortEarly: false })

            const start = moment(validationData.start_date, 'YYYY-MM-DD').toISOString()
            const end = moment(validationData.end_date, 'YYYY-MM-DD').toISOString()

            response.send(await prisma.trailRace.create({
                data: {
                    name: validationData.name,
                    slug: validationData.slug,
                    description: '',
                    start,
                    end,
                    excerpt: validationData.excerpt,
                    details: {}
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async update(request: Request, response: Response, next: NextFunction) {
        try {
            const id = request.params.event_id as string
            const validationData = await eventSchema.validate(request.body, { abortEarly: false })

            const event = await prisma.trailRace.findFirstOrThrow({ where: { id } })

            const start = moment(validationData.start_date, 'YYYY-MM-DD').toISOString() ?? event.start
            const end = moment(validationData.end_date, 'YYYY-MM-DD').toISOString() ?? event.end

            response.send(await prisma.trailRace.update({
                where: { id },
                data: {
                    name: validationData.name,
                    slug: validationData.slug,
                    updated_at: moment.utc().toISOString(),
                    start,
                    end,
                    excerpt: validationData.excerpt
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async destory(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.update({
                where: {
                    id: request.params.event_id as string
                },
                data: {
                    deleted_at: moment.utc().toISOString()
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async get(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.findFirst({
                where: { id: request.params.event_id as string },
                include: {
                    season_passes: {
                        include: {
                            payments: {
                                include: {
                                    screenshot: true
                                }
                            },
                            stage_categories: true
                        }
                    },
                    thumbnail: true,
                    map_file: true,
                    gallery: {
                        include: {
                            images: true
                        }
                    },
                    sponsors: {
                        where: {
                            deleted_at: null
                        },
                        include: {
                            thumbnail: true,
                            sponsorType: true
                        }
                    },
                    stages: {
                        include: {
                            stage_categories: true
                        },
                        where: {
                            deleted_at: null
                        }
                    }
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async getBySlug(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.findFirst({
                where: { 
                    slug: request.params.slug as string,
                    published_at: { not: null }
                },
                include: {
                    gallery: {
                        include: {
                            images: true
                        }
                    },
                    season_passes: {
                        include: {
                            payments: {
                                include: {
                                    screenshot: true
                                }
                            },
                            stage_categories: true
                        }
                    },
                    sponsors: {
                        where: {
                            deleted_at: null
                        },
                        include: {
                            thumbnail: true,
                            sponsorType: true
                        }
                    },
                    stages: {
                        include: {
                            thumbnail: true,
                            guide_book_file: true,
                            stage_categories: {
                                include: {
                                    map_file: true,
                                    checkpoints: {
                                        where: {
                                            deleted_at: null
                                        }
                                    },
                                    payment: {
                                        include: {
                                            screenshot: true
                                        }
                                    }
                                }
                            }
                        },
                        where: {
                            deleted_at: null
                        }
                    },
                    thumbnail: true,
                    map_file: true,
                    pricing_tiers: true,
                    addons: {
                        include: {
                            stages: true
                        }
                    }
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async updateDescription(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.update({
                where: {
                    id: request.params.event_id as string
                },
                data: {
                    description: request.body.description
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async updateDetails(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.update({
                where: {
                    id: request.params.event_id as string
                },
                data: {
                    details: request.body.details
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async updateLegal(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.update({
                where: {
                    id: request.params.event_id as string
                },
                data: {
                    liability_waiver: request.body.liability_waiver,
                    policies: request.body.policies
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async publish(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.update({
                where: {
                    id: request.params.event_id as string
                },
                data: {
                    published_at: moment.utc().toISOString()
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async saveEmailTemplate(request: Request, response: Response, next: NextFunction) {
        try {
            const { subject, htmlTemplate, variableMap, attachStageGpx } = request.body
            const eventId = request.params.event_id as string

            const template = await prisma.eventEmailTemplate.upsert({
                where: { event_id: eventId },
                update: {
                    subject,
                    htmlContent: htmlTemplate,
                    variableMap: variableMap || {},
                    attachStageGpx: attachStageGpx || false
                },
                create: {
                    event_id: eventId,
                    subject,
                    htmlContent: htmlTemplate,
                    variableMap: variableMap || {},
                    attachStageGpx: attachStageGpx || false
                }
            })
            response.send(template)
        } catch (error) {
            next(error)
        }
    }

    public static async getEmailTemplate(request: Request, response: Response, next: NextFunction) {
        try {
            const eventId = request.params.event_id as string
            const template = await prisma.eventEmailTemplate.findUnique({
                where: { event_id: eventId }
            })
            response.send(template)
        } catch (error) {
            next(error)
        }
    }

    public static async sendTestEmail(request: Request, response: Response, next: NextFunction) {
        try {
            const eventId = request.params.event_id as string
            const { testEmail, subject, htmlTemplate, variableMap, attachStageGpx, stageId } = request.body

            if (!testEmail || typeof testEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
                response.status(400).json({ error: 'Valid test email address is required' })
                return
            }

            const targetEmail = testEmail.trim()

            const event = await prisma.trailRace.findUnique({
                where: { id: eventId },
                include: { thumbnail: true }
            })

            if (!event) {
                response.status(404).json({ error: 'Event not found' })
                return
            }

            let finalSubject = subject
            let finalHtmlTemplate = htmlTemplate
            let finalVariableMap = variableMap
            let finalAttachStageGpx = attachStageGpx

            if (!finalSubject || !finalHtmlTemplate) {
                const savedTemplate = await prisma.eventEmailTemplate.findUnique({
                    where: { event_id: eventId }
                })
                if (savedTemplate) {
                    finalSubject = finalSubject || savedTemplate.subject
                    finalHtmlTemplate = finalHtmlTemplate || savedTemplate.htmlContent
                    finalVariableMap = finalVariableMap || (savedTemplate.variableMap as Record<string, string>)
                    if (finalAttachStageGpx === undefined) {
                        finalAttachStageGpx = savedTemplate.attachStageGpx
                    }
                }
            }

            if (!finalSubject || !finalHtmlTemplate) {
                response.status(400).json({ error: 'Subject and HTML template are required' })
                return
            }

            // Find sample stage category (either for specified stage or first available in event)
            let sampleStageCategory = null
            if (stageId) {
                sampleStageCategory = await prisma.stageCategory.findFirst({
                    where: { stage_id: stageId, deleted_at: null },
                    include: { stage: { include: { event: true } }, map_file: true }
                })
            }
            if (!sampleStageCategory) {
                sampleStageCategory = await prisma.stageCategory.findFirst({
                    where: { stage: { event_id: eventId }, deleted_at: null },
                    include: { stage: { include: { event: true } }, map_file: true }
                })
            }

            // Try to find an actual runner in this event to use realistic test data
            const sampleRunner = await prisma.eventRunner.findFirst({
                where: { stage_category: { stage: { event_id: eventId } }, deleted_at: null },
                include: {
                    personal: { include: { country: true, gender: true } },
                    stage_category: { include: { stage: { include: { event: true } }, map_file: true } }
                }
            })

            const runnerStageCat = sampleRunner?.stage_category || sampleStageCategory
            const baseUrl = process.env.APP_URL || `${request.protocol}://${request.get('host')}`
            const gpxFileUrl = runnerStageCat?.map_file?.file_name
                ? `${baseUrl}/resources/gpx/${runnerStageCat.map_file.file_name}`
                : `${baseUrl}/resources/gpx/sample.gpx`

            const values: Record<string, string> = {
                'First Name': sampleRunner?.personal?.first_name || 'John',
                'Last Name': sampleRunner?.personal?.last_name || 'Doe',
                'Full Name': [sampleRunner?.personal?.first_name, sampleRunner?.personal?.middle_name, sampleRunner?.personal?.last_name].filter(Boolean).join(' ') || 'John Doe',
                'Email': targetEmail,
                'BIB Number': sampleRunner?.bib || '101',
                'Country': sampleRunner?.personal?.country?.name || 'Nepal',
                'Gender': sampleRunner?.personal?.gender?.name || 'Male',
                'Stage Distance': runnerStageCat?.distance || runnerStageCat?.name || '50 km',
                'Stage Elevation': runnerStageCat?.elevation || '2500m',
                'Elevation': runnerStageCat?.elevation || '2500m',
                'Stage Category Name': runnerStageCat?.name || '50K Challenge',
                'GPX File': gpxFileUrl,
                'GPX File URL': gpxFileUrl,
                'Event Name': event.name || 'Trailmandu Event',
                'Event Address': runnerStageCat?.location || runnerStageCat?.stage?.location || 'Kathmandu, Nepal',
                'Event Timing': runnerStageCat?.start ? moment.utc(runnerStageCat.start).local().format('DD-MM-YYYY hh:mm a') : '25-12-2026 06:00 am',
                'Event Thumbnail URL': finalVariableMap?.['Event Thumbnail URL'] || '',
                'Stage Image URL': finalVariableMap?.['Stage Image URL'] || ''
            }

            let renderedHtml = finalHtmlTemplate
            const mapKeys = Object.keys(finalVariableMap || {})
            for (const placeholder of mapKeys) {
                const mappedField = finalVariableMap[placeholder]
                const val = values[mappedField] !== undefined ? values[mappedField] : mappedField
                const regex = new RegExp(placeholder.replace(/[.*+?^$()|[\]\\]/g, '\\$&'), 'g')
                renderedHtml = renderedHtml.replace(regex, val)
            }

            const attachments: any[] = []
            if (finalAttachStageGpx && runnerStageCat?.map_file?.file_name) {
                const fileName = runnerStageCat.map_file.file_name
                const possiblePaths = [
                    path.join(__basedir, 'uploads', 'gpx', fileName),
                    path.join(__basedir, 'uploads', 'images', fileName),
                    path.join(__basedir, 'uploads', 'files', fileName)
                ]
                let foundPath = null
                for (const p of possiblePaths) {
                    if (fs.existsSync(p)) {
                        foundPath = p
                        break
                    }
                }
                if (foundPath) {
                    attachments.push({ filename: fileName, path: foundPath })
                }
            }

            const testSubject = `[TEST] ${finalSubject}`

            await emailQueue.add('sendEmail', {
                to: targetEmail,
                subject: testSubject,
                html: renderedHtml,
                senderEmail: 'info@trailmandu.com',
                category: 'event_test_email',
                attachments
            })

            await prisma.emailLog.create({
                data: {
                    recipient: targetEmail,
                    subject: testSubject,
                    status: 'QUEUED',
                    payload: {
                        type: 'event_test_email',
                        event_id: eventId,
                        to: targetEmail,
                        subject: testSubject,
                        html: renderedHtml,
                        senderEmail: 'info@trailmandu.com',
                        attachments
                    }
                }
            }).catch(err => console.error('Failed to log test email:', err))

            response.json({ message: `Test email queued successfully to ${targetEmail}` })
        } catch (error) {
            next(error)
        }
    }

    public static async unpublish(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.update({
                where: {
                    id: request.params.event_id as string
                },
                data: {
                    published_at: null
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async updateThumbnail(request: Request, response: Response, next: NextFunction) {
        try {
            const fileUpload = new FileHandler('images')
            const event = await prisma.trailRace.findFirstOrThrow({ where: { id: request.params.event_id as string } })
            const image = await fileUpload.saveFile(request.body.image, event.image_id)

            response.send(await prisma.trailRace.update({
                where: { id: event.id },
                data: {
                    image_id: image.id
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async updateImageId(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.update({
                where: {
                    id: request.params.event_id as string
                },
                data: {
                    image_id: request.body.image_id
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async updateGalleryId(request: Request, response: Response, next: NextFunction) {
        try {
            response.send(await prisma.trailRace.update({
                where: {
                    id: request.params.event_id as string
                },
                data: {
                    gallery_id: request.body.gallery_id
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async updateGPXFile(request: Request, response: Response, next: NextFunction) {
        try {
            const fileUpload = new FileHandler('gpx')
            const event = await prisma.trailRace.findFirstOrThrow({ where: { id: request.params.event_id as string } })
            const file = await fileUpload.saveFile(request.body.file, event.map_file_id, 'gpx')

            response.send(await prisma.trailRace.update({
                where: { id: event.id },
                data: {
                    map_file_id: file.id
                }
            }))
        } catch (error) {
            next(error)
        }
    }

    public static async stats(request: Request, response: Response, next: NextFunction) {
        try {
            const runnersStats = moment.months().reduce((acc, month) => ({
                ...acc,
                [month]: {}
            }), {})

            const where = {
                deleted_at: null
            }

            if (request.query.event_id)
                where['event_id'] = request.query.event_id as string

            const runners = await prisma.eventRunner.findMany({ where })
            const total_volunteers = await prisma.volunteer.count({ where: { deleted_at: null } })
            const total_checkpoints = await prisma.checkpoint.count({ where: { deleted_at: null } })
            const total_stages = await prisma.stage.count({ where: { deleted_at: null } })

            for (const runner of runners) {
                const created_at = moment(runner.created_at)
                const month = created_at.format('MMMM')

                const week = created_at.get('week')
                if (!runnersStats[month][week])
                    runnersStats[month][week] = 0
                runnersStats[month][week]++
            }

            response.send({
                runners: runnersStats,
                total_volunteers,
                total_checkpoints,
                total_stages
            })
        } catch (error) {
            next(error)
        }
    }
}