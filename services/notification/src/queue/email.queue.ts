import { Queue, Worker } from 'bullmq';
import { useMailTrap } from '../services/mailtrap';
import IORedis from 'ioredis';
import prisma from '../services/db';
// Reuse the redis connection from environment
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', { maxRetriesPerRequest: null });

export const emailQueue = new Queue('emailQueue', {
    connection: redisConnection
});

const worker = new Worker('emailQueue', async (job) => {
    console.log(`Processing email job ${job.id}`);
    const { fileName, replacements, props, senderEmail, attachments, category } = job.data;
    
    const { sendEmail } = useMailTrap();
    const recipientsList = (props?.recipients && props.recipients.length > 0)
        ? props.recipients.map((r: any) => r.email).join(', ')
        : (job.data.to || replacements?.user?.email || 'unknown');
    const finalSubject = props?.subject || job.data.subject || replacements?.title || 'No Subject';
    
    // Create PENDING log
    const log = await prisma.notificationLog.create({
        data: {
            recipient: recipientsList,
            subject: finalSubject,
            status: 'PENDING',
            jobId: job.id?.toString(),
        }
    });

    try {
        await sendEmail(fileName, replacements, props, senderEmail, attachments, category);
        console.log(`Successfully processed email job ${job.id}`);
        
        // Update to SENT
        await prisma.notificationLog.update({
            where: { id: log.id },
            data: { status: 'SENT' }
        });
    } catch (error: any) {
        console.error(`Failed to process email job ${job.id}:`, error);
        
        // Update to FAILED
        await prisma.notificationLog.update({
            where: { id: log.id },
            data: { 
                status: 'FAILED',
                error: error.message || String(error)
            }
        });
        throw error;
    }
}, {
    connection: redisConnection
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error ${err.message}`);
});
