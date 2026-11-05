import { Request, Response, NextFunction } from 'express'
import { emailQueue } from '@/queue/email.queue'
import { prisma } from '@/app/lib/services/prisma.service'

export class QueueController {
    public static async index(req: Request, res: Response, next: NextFunction) {
        try {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')

            const page = parseInt(req.query.page as string) || 1
            const limit = parseInt(req.query.limit as string) || 20
            const statusFilter = (req.query.status as string)?.toLowerCase()
            const searchQuery = ((req.query.search || req.query.s) as string)?.trim()?.toLowerCase()

            const startDateStr = req.query.startDate as string
            const endDateStr = req.query.endDate as string
            let startDate: Date | undefined
            let endDate: Date | undefined
            if (startDateStr) startDate = new Date(startDateStr)
            if (endDateStr) endDate = new Date(endDateStr)

            const skip = (page - 1) * limit

            const counts = await emailQueue.getJobCounts()

            let dbStatusFilter: string | undefined
            if (statusFilter === 'completed') dbStatusFilter = 'SUCCESS'
            else if (statusFilter === 'failed') dbStatusFilter = 'FAILED'

            // Determine which queue statuses to fetch
            let queueStatusesToFetch: any[] = []
            if (statusFilter) {
                if (['waiting', 'active', 'delayed', 'failed', 'completed', 'paused'].includes(statusFilter)) {
                    queueStatusesToFetch = [statusFilter]
                }
            } else {
                queueStatusesToFetch = ['failed']
            }

            let mappedQueueJobs: any[] = []

            if (queueStatusesToFetch.length > 0) {
                const queuedJobs = await emailQueue.getJobs(queueStatusesToFetch)

                mappedQueueJobs = await Promise.all(queuedJobs.map(async (job: any) => {
                    const { replacements, to, subject, props } = job.data || {}
                    let recipientEmail = to
                    if (!recipientEmail && replacements && replacements.user && replacements.user.email) recipientEmail = replacements.user.email
                    if (!recipientEmail && props && props.recipients && props.recipients.length > 0) recipientEmail = props.recipients[0].email

                    let recipientName = ''
                    if (replacements?.user?.name) recipientName = replacements.user.name
                    if (props?.recipients?.[0]?.name) recipientName = props.recipients[0].name

                    let finalSubject = subject || (props && props.subject) || (replacements && replacements.title) || 'No Subject'
                    const state = await job.getState()
                    let mappedStatus = state ? state.toUpperCase() : 'QUEUED'
                    if (mappedStatus === 'COMPLETED') mappedStatus = 'SUCCESS'

                    return {
                        id: `queue-${job.id}`,
                        recipient: recipientEmail || 'unknown',
                        recipient_name: recipientName || null,
                        subject: finalSubject,
                        status: mappedStatus,
                        created_at: new Date(job.timestamp),
                        error: job.failedReason || null,
                        payload: job.data
                    }
                }))
            }

            // Apply date filtering to queue jobs in memory
            if (startDate) mappedQueueJobs = mappedQueueJobs.filter(j => j.created_at >= startDate)
            if (endDate) mappedQueueJobs = mappedQueueJobs.filter(j => j.created_at <= endDate)

            // Apply search query to queue jobs
            if (searchQuery) {
                mappedQueueJobs = mappedQueueJobs.filter(j => {
                    const emailMatch = (j.recipient || '').toLowerCase().includes(searchQuery)
                    const nameMatch = (j.recipient_name || '').toLowerCase().includes(searchQuery)
                    const subjectMatch = (j.subject || '').toLowerCase().includes(searchQuery)
                    return emailMatch || nameMatch || subjectMatch
                })
            }

            // Setup DB query
            const whereClause: any = dbStatusFilter ? { status: dbStatusFilter } : {}
            if (startDate || endDate) {
                whereClause.created_at = {}
                if (startDate) whereClause.created_at.gte = startDate
                if (endDate) whereClause.created_at.lte = endDate
            }

            if (searchQuery) {
                // Find any Personals matching the name search to match their emails
                const matchedPersonals = await prisma.personal.findMany({
                    where: {
                        OR: [
                            { first_name: { contains: searchQuery } },
                            { middle_name: { contains: searchQuery } },
                            { last_name: { contains: searchQuery } },
                            { email: { contains: searchQuery } }
                        ]
                    },
                    select: { email: true }
                })
                const matchedEmails = Array.from(new Set(matchedPersonals.map(p => p.email).filter(Boolean))) as string[]

                whereClause.OR = [
                    { recipient: { contains: searchQuery } },
                    { subject: { contains: searchQuery } },
                    ...(matchedEmails.length > 0 ? [{ recipient: { in: matchedEmails } }] : [])
                ]
            }

            let totalDb = 0
            if (!statusFilter || statusFilter === 'completed' || statusFilter === 'failed') {
                totalDb = await prisma.emailLog.count({ where: whereClause })
            }

            const totalQueue = mappedQueueJobs.length
            const total = totalDb + totalQueue

            let paginatedLogs: any[] = []
            let dbSkip = 0
            let dbTake = limit

            if (skip < totalQueue) {
                const queueItems = mappedQueueJobs.slice(skip, skip + limit)
                paginatedLogs.push(...queueItems)
                dbTake = limit - queueItems.length
                dbSkip = 0
            } else {
                dbTake = limit
                dbSkip = skip - totalQueue
            }

            if (dbTake > 0 && (!statusFilter || statusFilter === 'completed' || statusFilter === 'failed')) {
                const dbLogs = await prisma.emailLog.findMany({
                    where: whereClause,
                    orderBy: { created_at: 'desc' },
                    skip: dbSkip,
                    take: dbTake
                })
                paginatedLogs.push(...dbLogs)
            }

            // Attach recipient_name for all logs
            const allEmails = Array.from(new Set(paginatedLogs.map(l => l.recipient).filter(Boolean))) as string[]
            if (allEmails.length > 0) {
                const personals = await prisma.personal.findMany({
                    where: { email: { in: allEmails } },
                    select: {
                        email: true,
                        first_name: true,
                        middle_name: true,
                        last_name: true
                    }
                })

                const nameByEmail = new Map<string, string>()
                for (const p of personals) {
                    const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')
                    if (fullName && p.email) {
                        nameByEmail.set(p.email.toLowerCase(), fullName)
                    }
                }

                paginatedLogs = paginatedLogs.map(log => {
                    const emailLower = (log.recipient || '').toLowerCase()
                    let name = log.recipient_name || nameByEmail.get(emailLower) || null

                    if (!name && log.payload) {
                        const payload = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload
                        name = payload?.user?.name || payload?.replacements?.user?.name || payload?.props?.recipients?.[0]?.name || null
                    }

                    return {
                        ...log,
                        recipient_name: name
                    }
                })
            }

            res.json({ email: counts, logs: paginatedLogs, total, page, limit })
        } catch (error) {
            console.error('QueueController.index error:', error)
            next(error)
        }
    }

    public static async resend(req: Request, res: Response, next: NextFunction) {
        try {
            const logId = req.params.id as string
            const { newRecipientEmail } = req.body

            let payload: any = null

            if (logId.startsWith('queue-')) {
                const bullJobId = logId.replace('queue-', '')
                const job = await emailQueue.getJob(bullJobId)

                if (!job) {
                    res.status(404).json({ error: 'Queue job not found or has expired' })
                    return
                }
                payload = job.data
            } else {
                const emailLog = await prisma.emailLog.findUnique({
                    where: { id: logId }
                })

                if (!emailLog) {
                    res.status(404).json({ error: 'Email log not found' })
                    return
                }

                if (!emailLog.payload) {
                    res.status(400).json({ error: 'Cannot resend this email because its payload was not stored' })
                    return
                }

                payload = typeof emailLog.payload === 'string' ? JSON.parse(emailLog.payload) : emailLog.payload
            }

            if (newRecipientEmail) {
                payload.to = newRecipientEmail
            }

            if (!logId.startsWith('queue-')) {
                payload.resendParentId = logId
            } else {
                // It's a queue job resend, so it doesn't have a DB parent record.
                delete payload.resendParentId
            }

            await emailQueue.add('sendEmail', payload)

            res.json({ message: 'Email queued for resending successfully' })
        } catch (error) {
            console.error('QueueController.resend error:', error)
            next(error)
        }
    }
}

