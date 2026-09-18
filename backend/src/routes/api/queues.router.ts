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

        const counts = await emailQueue.getJobCounts()
        const logs = await prisma.emailLog.findMany({
            orderBy: { created_at: 'desc' },
            take: 100
        })

        const queuedJobs = await emailQueue.getJobs(['waiting', 'active', 'delayed'])
        const mappedQueueJobs = await Promise.all(queuedJobs.map(async (job: any) => {
            const { replacements, to, subject, props } = job.data;
            let recipientEmail = to;
            if (!recipientEmail && replacements?.user?.email) recipientEmail = replacements.user.email;
            if (!recipientEmail && props?.recipients?.length > 0) recipientEmail = props.recipients[0].email;
            
            let finalSubject = subject || props?.subject || replacements?.title || 'No Subject';
            const state = await job.getState();
            
            return {
                id: `queue-${job.id}`,
                recipient: recipientEmail || 'unknown',
                subject: finalSubject,
                status: state ? state.toUpperCase() : 'QUEUED',
                created_at: new Date(job.timestamp),
                error: null
            }
        }));

        const mergedLogs = [...mappedQueueJobs, ...logs].sort((a, b) => {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }).slice(0, 100);

        res.json({ email: counts, logs: mergedLogs })
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch queue counts' })
    }
})

router.post('/:id/resend', verifyAccessToken, async (req: Request, res: Response) => {
    try {
        const logId = req.params.id;
        const { newRecipientEmail } = req.body;

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

        const payload: any = typeof emailLog.payload === 'string' ? JSON.parse(emailLog.payload) : emailLog.payload;

        if (newRecipientEmail) {
            payload.to = newRecipientEmail;
        }

        payload.resendParentId = logId;

        await emailQueue.add('sendEmail', payload);

        res.json({ message: 'Email queued for resending successfully' });
    } catch (error) {
        console.error('Failed to resend email:', error);
        res.status(500).json({ error: 'Failed to resend email' });
    }
});

export default router
