import { Request, Response, NextFunction } from 'express'
import { emailQueue } from '@/queue/email.queue'
import { prisma } from '@/app/lib/services/prisma.service'
import { Redis } from '@/app/lib/services/redis.service'

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

            const quota = await QueueController.getEmailQuota()

            res.json({ email: counts, logs: paginatedLogs, total, page, limit, quota })
        } catch (error) {
            console.error('QueueController.index error:', error)
            next(error)
        }
    }

    public static async getEmailQuota() {
        const token = process.env.MAILTRAP_TOKEN || 'a06a97429342ce7a3f9e7fcceb83fb8b'
        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        const firstDayOfMonth = todayStr.substring(0, 7) + '-01'
        const dailyLimit = parseInt(process.env.MAIL_DAILY_LIMIT || '150')
        const monthlyLimit = parseInt(process.env.MAIL_MONTHLY_LIMIT || '4000')
        const hourlyLimit = parseInt(process.env.MAIL_HOURLY_LIMIT || '150')

        const cacheKey = `__cache__/mailtrap:quota:${todayStr}`
        try {
            const cached = await Redis.get(cacheKey)
            if (cached) return JSON.parse(cached)
        } catch (e) {
            // cache miss or redis error
        }

        let todayUsed = 0
        let monthUsed = 0
        let domainName = 'trailmandu.com'
        let domainStatus = 'compliant'
        let isDomainVerified = true
        let statsSource = 'database'

        if (token) {
            try {
                const accountsRes = await fetch('https://mailtrap.io/api/accounts', {
                    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(3500)
                })
                if (accountsRes.ok) {
                    const accounts = (await accountsRes.json()) as any[]
                    const accountId = accounts?.[0]?.id
                    if (accountId) {
                        const [monthRes, todayRes, domainRes] = await Promise.all([
                            fetch(`https://mailtrap.io/api/accounts/${accountId}/stats?start_date=${firstDayOfMonth}&end_date=${todayStr}`, {
                                headers: { 'Authorization': `Bearer ${token}` },
                                signal: AbortSignal.timeout(3500)
                            }),
                            fetch(`https://mailtrap.io/api/accounts/${accountId}/stats?start_date=${todayStr}&end_date=${todayStr}`, {
                                headers: { 'Authorization': `Bearer ${token}` },
                                signal: AbortSignal.timeout(3500)
                            }),
                            fetch(`https://mailtrap.io/api/accounts/${accountId}/sending_domains`, {
                                headers: { 'Authorization': `Bearer ${token}` },
                                signal: AbortSignal.timeout(3500)
                            })
                        ])

                        if (monthRes.ok) {
                            const mData = (await monthRes.json()) as any
                            monthUsed = mData.delivery_count || 0
                        }
                        if (todayRes.ok) {
                            const tData = (await todayRes.json()) as any
                            todayUsed = tData.delivery_count || 0
                        }
                        if (domainRes.ok) {
                            const dData = (await domainRes.json()) as any
                            const d = dData?.data?.[0] || dData?.[0]
                            if (d) {
                                domainName = d.domain_name || domainName
                                domainStatus = d.compliance_status || domainStatus
                                isDomainVerified = !!d.dns_verified
                            }
                        }
                        statsSource = 'mailtrap'
                    }
                }
            } catch (apiErr: any) {
                console.warn('[QueueController] Mailtrap stats API call failed, falling back to database counts:', apiErr?.message)
            }
        }

        if (statsSource === 'database') {
            const todayStart = new Date()
            todayStart.setHours(0, 0, 0, 0)

            const monthStart = new Date()
            monthStart.setDate(1)
            monthStart.setHours(0, 0, 0, 0)

            const [dbTodayCount, dbMonthCount] = await Promise.all([
                prisma.emailLog.count({
                    where: {
                        status: 'SUCCESS',
                        created_at: { gte: todayStart }
                    }
                }),
                prisma.emailLog.count({
                    where: {
                        status: 'SUCCESS',
                        created_at: { gte: monthStart }
                    }
                })
            ])
            todayUsed = dbTodayCount
            monthUsed = dbMonthCount
        }

        const quotaData = {
            source: statsSource,
            today: {
                used: todayUsed,
                limit: dailyLimit,
                remaining: Math.max(0, dailyLimit - todayUsed),
                percentage: Math.min(100, Math.round((todayUsed / dailyLimit) * 100))
            },
            month: {
                used: monthUsed,
                limit: monthlyLimit,
                remaining: Math.max(0, monthlyLimit - monthUsed),
                percentage: Math.min(100, Math.round((monthUsed / monthlyLimit) * 100))
            },
            hour: {
                limit: hourlyLimit,
                note: `${hourlyLimit} emails/hr max throughput`
            },
            domain: {
                name: domainName,
                status: domainStatus,
                verified: isDomainVerified
            },
            provider: 'Mailtrap'
        }

        try {
            await Redis.set(cacheKey, JSON.stringify(quotaData), 60)
        } catch (e) {
            // ignore cache set error
        }

        return quotaData
    }

    public static async quota(req: Request, res: Response, next: NextFunction) {
        try {
            const quota = await QueueController.getEmailQuota()
            res.json(quota)
        } catch (error) {
            next(error)
        }
    }

    public static async sendImmediate(req: Request, res: Response, next: NextFunction) {
        try {
            const { to, subject, html, text, senderEmail } = req.body

            if (!to || !to.trim()) {
                res.status(400).json({ error: 'Recipient email is required' })
                return
            }
            if (!subject || !subject.trim()) {
                res.status(400).json({ error: 'Subject is required' })
                return
            }
            if (!html && !text) {
                res.status(400).json({ error: 'Email content is required' })
                return
            }

            const payload = {
                to: to.trim(),
                subject: subject.trim(),
                html: html || undefined,
                text: text || undefined,
                senderEmail: senderEmail || 'info@trailmandu.com',
                category: 'manual_direct_email'
            }

            const job = await emailQueue.add('sendEmail', payload, {
                priority: 1,
                lifo: true
            })

            const emailLog = await prisma.emailLog.create({
                data: {
                    recipient: to.trim(),
                    subject: subject.trim(),
                    status: 'QUEUED',
                    payload
                }
            }).catch(err => {
                console.error('Failed to log immediate email to db:', err)
                return null
            })

            res.json({
                message: 'Email scheduled for immediate delivery',
                jobId: job.id,
                logId: emailLog?.id
            })
        } catch (error) {
            console.error('QueueController.sendImmediate error:', error)
            next(error)
        }
    }

    public static async promote(req: Request, res: Response, next: NextFunction) {
        try {
            const logId = req.params.id as string
            if (logId.startsWith('queue-')) {
                const bullJobId = logId.replace('queue-', '')
                const job = await emailQueue.getJob(bullJobId)
                if (job) {
                    await job.promote()
                    res.json({ message: 'Email promoted to send immediately' })
                    return
                }
            }
            res.status(404).json({ error: 'Queue job not found or cannot be promoted' })
        } catch (error) {
            console.error('QueueController.promote error:', error)
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

