import moment from "moment"
import createHttpError from "http-errors"
import Bcrypt from "bcrypt"
import ical, { ICalCalendarMethod } from "ical-generator"
import { prisma } from "@/app/lib/services/prisma.service"
import { FileHandler } from "@/app/lib/services/file.service"
import { emailQueue } from "@/queue/email.queue"

export class RunnerRegistrationService {
    /**
     * Handles the entire runner registration workflow:
     * 1. Validates event & stage category existence
     * 2. Upserts personal record & creates user account
     * 3. Resolves matched stage categories (single vs season pass)
     * 4. Allocates a unique BIB number
     * 5. Saves payment screenshot (if provided)
     * 6. Creates EventRunner and Payment records
     * 7. Generates calendar invite (.ics) & queues welcome email
     */
    public static async register(eventId: string, validationData: any) {
        const body: any = {}
        if (validationData.date_of_birth) {
            body.date_of_birth = moment(validationData.date_of_birth, "YYYY-MM-DD").toISOString()
        }

        const baseCategoryId = validationData.is_season_pass
            ? validationData.season_pass_categories[0]
            : validationData.stage_category_id

        const event = await prisma.trailRace.findFirst({
            where: { id: eventId },
            include: {
                runners: {
                    where: { stage_category_id: baseCategoryId }
                }
            }
        })
        if (!event) throw createHttpError(404, "Event not found")

        const stageCategory = await prisma.stageCategory.findFirst({
            where: { id: baseCategoryId },
            include: {
                stage: {
                    include: { event: true }
                }
            }
        })
        if (!stageCategory) throw createHttpError(404, "Stage category not found")

        const personal = await this.upsertPersonal(validationData, body)
        await this.ensureUserAccount(personal.id)

        const matchedCategories = await this.resolveMatchedCategories(eventId, stageCategory, validationData)
        const finalBib = await this.generateBib(stageCategory, event.runners.length, matchedCategories)

        if (validationData.payment_method === "QR" && !validationData.payment_screenshot) {
            throw createHttpError(422, "Payment screenshot is required for QR payment")
        }

        const paymentImageId = await this.savePaymentScreenshot(validationData.payment_screenshot)

        const { runners, payment } = await this.createRunnersAndPayments({
            eventId,
            personalId: personal.id,
            matchedCategories,
            finalBib,
            paymentImageId,
            validationData
        })

        await this.sendConfirmationNotification({
            event,
            stageCategory,
            personal,
            runner: runners[0],
            validationData
        })

        return payment
    }

    /**
     * Upserts Personal profile for the given email
     */
    private static async upsertPersonal(validationData: any, body: any) {
        const personalData = {
            ...body,
            first_name: validationData.first_name,
            middle_name: validationData.middle_name,
            last_name: validationData.last_name,
            email: validationData.email,
            itra_id: validationData.itra_id,
            phone_number: validationData.phone_number,
            country_id: validationData.country_id,
            size_id: validationData.size_id || null,
            gender_id: validationData.gender_id
        }

        return await prisma.personal.upsert({
            where: { email: validationData.email },
            create: personalData,
            update: personalData,
            include: {
                gender: true,
                country: true
            }
        })
    }

    /**
     * Ensures an authentication User record exists for this runner
     */
    private static async ensureUserAccount(personalId: string) {
        const existingUser = await prisma.user.findFirst({ where: { personal_id: personalId } })
        if (existingUser) return existingUser

        const salt = await Bcrypt.genSalt(10)
        const hashPassword = await Bcrypt.hash("password", salt)

        let role = await prisma.role.findFirst({ where: { name: "Runner" } })
        if (!role) {
            role = await prisma.role.create({ data: { name: "Runner" } })
        }

        return await prisma.user.create({
            data: {
                personal_id: personalId,
                password: hashPassword,
                role_id: role.id
            }
        })
    }

    /**
     * Resolves all stage categories to register into (handles season pass vs single stage)
     */
    private static async resolveMatchedCategories(eventId: string, stageCategory: any, validationData: any) {
        if (!validationData.is_season_pass) {
            return [stageCategory]
        }

        const stages = await prisma.stage.findMany({
            where: { event_id: eventId },
            include: { stage_categories: true }
        })

        const matchedCategories: any[] = []
        for (const stage of stages) {
            const match = stage.stage_categories.find((c: any) =>
                validationData.season_pass_categories?.includes(c.id)
            )
            if (match) matchedCategories.push(match)
        }
        return matchedCategories
    }

    /**
     * Finds next collision-free BIB number in the category range
     */
    private static async generateBib(stageCategory: any, existingRunnersCount: number, matchedCategories: any[]) {
        const [min] = stageCategory.bib_range.split("-")
        const baseBib = Number(min) + (existingRunnersCount + 1)
        const categoryIds = matchedCategories.map((c: any) => c.id)
        const checkedBib = await this.checkBIB(baseBib, categoryIds)
        return checkedBib.toString().padStart(3, "0")
    }

    public static async checkBIB(bib: number, stage_category_ids: string[]) {
        let currentBib = bib
        while (true) {
            const bibExists = await prisma.eventRunner.findFirst({
                where: {
                    bib: currentBib.toString().padStart(3, "0"),
                    stage_category_id: { in: stage_category_ids }
                }
            })
            if (bibExists) {
                currentBib++
            } else {
                return currentBib
            }
        }
    }

    /**
     * Decodes and persists payment screenshot if provided
     */
    private static async savePaymentScreenshot(screenshotBase64?: string) {
        if (!screenshotBase64) return null
        const fileUpload = new FileHandler("payments")
        const image = await fileUpload.saveFile(screenshotBase64)
        return image?.id ?? null
    }

    /**
     * Creates EventRunner records and corresponding Payment entries
     */
    private static async createRunnersAndPayments(params: {
        eventId: string
        personalId: string
        matchedCategories: any[]
        finalBib: string
        paymentImageId: string | null
        validationData: any
    }) {
        const { eventId, personalId, matchedCategories, finalBib, paymentImageId, validationData } = params
        const paymentBody: any = paymentImageId ? { image_id: paymentImageId } : {}
        const createdRunners: any[] = []
        let lastPayment: any = null

        for (const category of matchedCategories) {
            const existingRunner = await prisma.eventRunner.findFirst({
                where: {
                    event_id: eventId,
                    stage_id: category.stage_id,
                    personal_id: personalId
                }
            })

            if (existingRunner) {
                if (!validationData.is_season_pass) {
                    throw createHttpError(409, "You have already registered for this event")
                }
                continue
            }

            const runner = await prisma.eventRunner.create({
                data: {
                    bib: finalBib,
                    event_id: eventId,
                    personal_id: personalId,
                    stage_id: category.stage_id,
                    stage_category_id: category.id,
                    want_lunch: validationData.description?.want_lunch ?? false,
                    club_name: validationData.description?.club_name ?? "",
                    emergency_contact_name: validationData.description?.emergency_contact_name ?? "",
                    emergency_contact_no: validationData.description?.emergency_contact_phone ?? "",
                    shirt_id: validationData.size_id || null,
                    season_pass_id: validationData.is_season_pass ? validationData.season_pass_id : null
                }
            })
            createdRunners.push(runner)

            let paymentAmount = 0
            let shouldCreatePayment = false

            if (validationData.is_season_pass && validationData.season_pass_id) {
                if (createdRunners.length === 1) {
                    const seasonPassPayment = await prisma.seasonPassPayment.findFirst({
                        where: {
                            season_pass_id: validationData.season_pass_id,
                            type: validationData.payment_type
                        }
                    })
                    if (seasonPassPayment) {
                        paymentAmount = Number(seasonPassPayment.amount)
                        shouldCreatePayment = true
                    }
                } else {
                    paymentAmount = 0
                    shouldCreatePayment = true
                }
            } else {
                const stageCategoryPayment = await prisma.stageCategoryPayment.findFirst({
                    where: {
                        stage_category_id: category.id,
                        type: validationData.payment_type
                    }
                })
                if (stageCategoryPayment) {
                    paymentAmount = Number(stageCategoryPayment.amount)
                    shouldCreatePayment = true
                }
            }

            if (shouldCreatePayment) {
                lastPayment = await prisma.payment.create({
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
            throw createHttpError(409, "You have already registered for all stages of this event")
        }

        return { runners: createdRunners, payment: lastPayment }
    }

    /**
     * Builds calendar file and pushes confirmation email job to queue
     */
    private static async sendConfirmationNotification(params: {
        event: any
        stageCategory: any
        personal: any
        runner: any
        validationData: any
    }) {
        const { event, stageCategory, personal, runner, validationData } = params

        const start = moment.utc(stageCategory.start).local().format("DD-MM-YYYY hh:mm a")
        const end = moment.utc(stageCategory.end).local().format("DD-MM-YYYY hh:mm a")

        const fullName = [validationData.first_name, validationData.middle_name, validationData.last_name]
            .filter(Boolean)
            .join(" ")

        const startDate = new Date(stageCategory.start)
        const endDate = stageCategory.end
            ? new Date(stageCategory.end)
            : new Date(startDate.getTime() + 4 * 60 * 60 * 1000)

        const calendar = ical({
            name: `${event.name || "Trail Race"} - ${stageCategory.stage.name} (${stageCategory.name})`,
            prodId: "//Trailmandu//Trail Race Calendar//EN"
        })
        calendar.method(ICalCalendarMethod.REQUEST)

        const cleanDescription = [
            stageCategory.excerpt,
            runner?.bib ? `Bib: ${runner.bib}` : "",
            stageCategory.distance ? `Distance: ${Number(stageCategory.distance) / 1000} km` : "",
            stageCategory.elevation ? `Elevation Gain: ${stageCategory.elevation} m` : "",
            stageCategory.location ? `Location: ${stageCategory.location}` : "",
            `Race Page: https://trailmandu.com/races/${event.slug}/stage/${stageCategory.stage.id}`
        ].filter(Boolean).join("\n")

        calendar.createEvent({
            id: `runner-${runner?.id || "reg"}-${stageCategory.id}@trailmandu.com`,
            start: startDate,
            end: endDate,
            summary: `${event.name || "Trail Race"} - ${stageCategory.stage.name} (${stageCategory.name})`,
            description: cleanDescription,
            location: stageCategory.location || stageCategory.stage?.location || "Kathmandu, Nepal",
            url: `https://trailmandu.com/races/${event.slug}/stage/${stageCategory.stage.id}`,
            organizer: {
                name: "Trailmandu",
                email: "info@trailmandu.com"
            },
            attendees: [
                {
                    name: fullName,
                    email: validationData.email,
                    rsvp: true
                }
            ]
        })

        const calendarContent = calendar.toString()
        const icsFilename = `${stageCategory.stage.name} - ${stageCategory.name}.ics`

        await emailQueue.add("sendEmail", {
            fileName: "welcome",
            replacements: {
                title: "Thank you for signing up for race",
                user: {
                    name: fullName,
                    email: validationData.email,
                    bib: runner.bib,
                    country: personal.country?.name,
                    gender: personal.gender?.name,
                    contact_no: personal.phone_number,
                    dob: moment(personal.date_of_birth).format("DD-MM-YYYY"),
                    emergency_contact: validationData.description?.emergency_contact_name,
                    emergency_contact_no: validationData.description?.emergency_contact_phone
                },
                stage: stageCategory.stage,
                stageCategory: { ...stageCategory, start, end },
                links: {
                    Trailmandu: "https://trailmandu.com",
                    event: "https://trailmandu.com"
                }
            },
            props: {
                recipients: [
                    {
                        email: validationData.email,
                        name: validationData.first_name
                    }
                ],
                subject: "Welcome to Trailmandu"
            },
            senderEmail: "info@trailmandu.com",
            attachments: [
                {
                    content: calendarContent,
                    filename: icsFilename,
                    contentType: "text/calendar; charset=UTF-8; method=REQUEST"
                }
            ],
            icalEvent: {
                filename: icsFilename,
                method: "REQUEST",
                content: calendarContent
            },
            category: "event"
        })
    }
}
