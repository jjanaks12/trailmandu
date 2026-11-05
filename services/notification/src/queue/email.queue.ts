import { Queue, Worker } from 'bullmq';
import { useMailTrap } from '../services/mailtrap';
import IORedis from 'ioredis';
import prisma from '../services/db';

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', { maxRetriesPerRequest: null });

export const emailQueue = new Queue('emailQueue', {
    connection: redisConnection
});

const { sendEmail } = useMailTrap();

const worker = new Worker('emailQueue', async (job) => {
    console.log(`[Notification Service] Processing email job ${job.id}`);

    const recipientsList = (job.data.props?.recipients && job.data.props.recipients.length > 0)
        ? job.data.props.recipients.map((r: any) => r.email).join(', ')
        : (job.data.to || job.data.replacements?.user?.email || 'unknown');
    const finalSubject = job.data.props?.subject || job.data.subject || job.data.replacements?.title || 'No Subject';

    let log: any = null;
    try {
        log = await prisma.notificationLog.create({
            data: {
                recipient: String(recipientsList),
                subject: String(finalSubject),
                status: 'PENDING',
                jobId: job.id?.toString(),
            }
        });
    } catch (dbErr) {
        console.error('[Notification Service] Failed to create PENDING notificationLog:', dbErr);
    }

    try {
        const result = await sendEmail(job.data);
        console.log(`[Notification Service] Successfully processed email job ${job.id} for ${recipientsList}`);

        if (log) {
            await prisma.notificationLog.update({
                where: { id: log.id },
                data: { status: 'SENT' }
            });
        }
        return result;
    } catch (error: any) {
        console.error(`[Notification Service] Failed to process email job ${job.id}:`, error);

        if (log) {
            await prisma.notificationLog.update({
                where: { id: log.id },
                data: {
                    status: 'FAILED',
                    error: error.message || String(error)
                }
            });
        }
        throw error;
    }
}, {
    connection: redisConnection
});

worker.on('failed', (job, err) => {
    console.error(`[Notification Service] Job ${job?.id} failed with error: ${err.message}`);
});
