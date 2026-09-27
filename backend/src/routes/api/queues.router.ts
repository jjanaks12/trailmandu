import { Router, Request, Response } from 'express'
import { emailQueue } from '@/queue/email.queue'
import { verifyAccessToken } from '@/app/http/middleware/verify_access_token.middleware'
import { prisma } from '@/app/lib/services/prisma.service'

const router = Router()

router.get('/', verifyAccessToken, async (req: Request, res: Response) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const statusFilter = (req.query.status as string)?.toLowerCase();
        
        const startDateStr = req.query.startDate as string;
        const endDateStr = req.query.endDate as string;
        let startDate: Date | undefined;
        let endDate: Date | undefined;
        if (startDateStr) startDate = new Date(startDateStr);
        if (endDateStr) endDate = new Date(endDateStr);

        const skip = (page - 1) * limit;

        const counts = await emailQueue.getJobCounts()
        
        let dbStatusFilter;
        if (statusFilter === 'completed') dbStatusFilter = 'SUCCESS';
        else if (statusFilter === 'failed') dbStatusFilter = 'FAILED';

        // Determine which queue statuses to fetch
        let queueStatusesToFetch: any[] = [];
        if (statusFilter) {
            if (['waiting', 'active', 'delayed', 'failed', 'completed', 'paused'].includes(statusFilter)) {
                queueStatusesToFetch = [statusFilter];
            }
        } else {
            queueStatusesToFetch = ['failed'];
        }

        let mappedQueueJobs: any[] = [];
        
        if (queueStatusesToFetch.length > 0) {
            const queuedJobs = await emailQueue.getJobs(queueStatusesToFetch);
            
            mappedQueueJobs = await Promise.all(queuedJobs.map(async (job: any) => {
                const { replacements, to, subject, props } = job.data || {};
                let recipientEmail = to;
                if (!recipientEmail && replacements && replacements.user && replacements.user.email) recipientEmail = replacements.user.email;
                if (!recipientEmail && props && props.recipients && props.recipients.length > 0) recipientEmail = props.recipients[0].email;
                
                let finalSubject = subject || (props && props.subject) || (replacements && replacements.title) || 'No Subject';
                const state = await job.getState();
                let mappedStatus = state ? state.toUpperCase() : 'QUEUED';
                if (mappedStatus === 'COMPLETED') mappedStatus = 'SUCCESS';
                
                return {
                    id: `queue-${job.id}`,
                    recipient: recipientEmail || 'unknown',
                    subject: finalSubject,
                    status: mappedStatus,
                    created_at: new Date(job.timestamp),
                    error: job.failedReason || null,
                    payload: job.data
                }
            }));
        }

        // Apply date filtering to queue jobs in memory
        if (startDate) mappedQueueJobs = mappedQueueJobs.filter(j => j.created_at >= startDate);
        if (endDate) mappedQueueJobs = mappedQueueJobs.filter(j => j.created_at <= endDate);

        // Sort queue jobs descending
        // mappedQueueJobs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

        // Setup DB query
        const whereClause: any = dbStatusFilter ? { status: dbStatusFilter } : {};
        if (startDate || endDate) {
            whereClause.created_at = {};
            if (startDate) whereClause.created_at.gte = startDate;
            if (endDate) whereClause.created_at.lte = endDate;
        }

        let totalDb = 0;
        if (!statusFilter || statusFilter === 'completed' || statusFilter === 'failed') {
            totalDb = await prisma.emailLog.count({ where: whereClause });
        }

        const totalQueue = mappedQueueJobs.length;
        const total = totalDb + totalQueue;

        let paginatedLogs: any[] = [];
        let dbSkip = 0;
        let dbTake = limit;

        if (skip < totalQueue) {
            // We can take items from the queue array for this page
            const queueItems = mappedQueueJobs.slice(skip, skip + limit);
            paginatedLogs.push(...queueItems);
            
            // If the queue items don't fill the page, we fetch the rest from DB starting at 0
            dbTake = limit - queueItems.length;
            dbSkip = 0;
        } else {
            // We completely skip the queue array and only fetch from DB
            dbTake = limit;
            dbSkip = skip - totalQueue;
        }

        if (dbTake > 0 && (!statusFilter || statusFilter === 'completed' || statusFilter === 'failed')) {
            const dbLogs = await prisma.emailLog.findMany({
                where: whereClause,
                orderBy: { created_at: 'desc' },
                skip: dbSkip,
                take: dbTake
            });
            paginatedLogs.push(...dbLogs);
        }

        res.json({ email: counts, logs: paginatedLogs, total, page, limit })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch queue counts' })
    }
})

router.post('/:id/resend', verifyAccessToken, async (req: Request, res: Response) => {
    try {
        const logId = req.params.id;
        const { newRecipientEmail } = req.body;

        let payload: any = null;

        if (logId.startsWith('queue-')) {
            const bullJobId = logId.replace('queue-', '');
            const job = await emailQueue.getJob(bullJobId);
            
            if (!job) {
                res.status(404).json({ error: 'Queue job not found or has expired' });
                return;
            }
            payload = job.data;
        } else {
            const emailLog = await prisma.emailLog.findUnique({
                where: { id: logId }
            });

            if (!emailLog) {
                res.status(404).json({ error: 'Email log not found' });
                return;
            }

            if (!emailLog.payload) {
                res.status(400).json({ error: 'Cannot resend this email because its payload was not stored' });
                return;
            }

            payload = typeof emailLog.payload === 'string' ? JSON.parse(emailLog.payload) : emailLog.payload;
        }

        if (newRecipientEmail) {
            payload.to = newRecipientEmail;
        }

        if (!logId.startsWith('queue-')) {
            payload.resendParentId = logId;
        } else {
            // It's a queue job resend, so it doesn't have a DB parent record.
            // We ensure it's removed so it doesn't violate foreign key constraint.
            delete payload.resendParentId;
        }

        await emailQueue.add('sendEmail', payload);

        res.json({ message: 'Email queued for resending successfully' });
    } catch (error) {
        console.error('Failed to resend email:', error);
        res.status(500).json({ error: 'Failed to resend email' });
    }
});

export default router
