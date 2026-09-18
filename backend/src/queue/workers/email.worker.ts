import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import nodemailer from 'nodemailer';
import { prisma } from '@/app/lib/services/prisma.service';


const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

const isProd = process.env.MAILTRAP_MODE === 'production';

// Initialize Mailtrap or default SMTP
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || (isProd ? 'send.smtp.mailtrap.io' : 'sandbox.smtp.mailtrap.io'),
    port: Number(process.env.MAIL_PORT) || 587,
    auth: {
        user: process.env.MAIL_USER || (isProd ? 'api' : (process.env.MAILTRAP_SANDBOX_USER || '')),
        pass: process.env.MAIL_PASS || (isProd ? process.env.MAILTRAP_TOKEN : (process.env.MAILTRAP_SANDBOX_PASS || ''))
    }
});

export const emailWorker = new Worker('emailQueue', async (job: Job) => {
    let recipientEmail = 'unknown';
    let finalSubject = 'No Subject';

    try {
        const { fileName, replacements, to, subject, html, text, props, attachments } = job.data;

        // Attempt to extract the recipient email
        recipientEmail = to;
        if (!recipientEmail && replacements && replacements.user && replacements.user.email) {
            recipientEmail = replacements.user.email;
        }
        if (!recipientEmail && props && props.recipients && props.recipients.length > 0) {
            recipientEmail = props.recipients[0].email;
        }

        if (!recipientEmail) {
            throw new Error('Recipient email is missing in job data');
        }

        finalSubject = subject || (props && props.subject) || (replacements && replacements.title) || 'No Subject';
        let finalHtml = html;

        // If there's no HTML but there are replacements, generate a basic HTML dump
        if (!finalHtml && replacements) {
            finalHtml = `
                <h2>${finalSubject}</h2>
                <p>Here are the details for your registration:</p>
                <ul>
                    ${Object.entries(replacements.user || {}).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
                </ul>
            `;
        }

        const info = await transporter.sendMail({
            from: process.env.MAIL_ADMIN || job.data.senderEmail || 'admin@trailmandu.com',
            to: recipientEmail,
            subject: finalSubject,
            text: text || 'Please view this email in an HTML compatible client.',
            html: finalHtml,
            attachments: attachments || []
        });

        // Save log to DB
        await prisma.emailLog.create({
            data: {
                recipient: recipientEmail,
                subject: finalSubject,
                status: 'SUCCESS',
                payload: job.data,
                parentId: job.data.resendParentId || null
            }
        });

        console.log(`Email sent successfully to ${recipientEmail}`);
        return info;
    } catch (error: any) {
        // Save failed log to DB
        try {
            await prisma.emailLog.create({
                data: {
                    recipient: recipientEmail,
                    subject: finalSubject,
                    status: 'FAILED',
                    error: error.message || 'Unknown error',
                    payload: job.data,
                    parentId: job.data.resendParentId || null
                }
            });
        } catch (dbError) {
            console.error('Failed to save emailLog to DB:', dbError);
        }
        console.error(`Failed to send email to ${recipientEmail}:`, error);
        throw error;
    }
}, {
    connection: redisConnection,
    limiter: {
        max: 1,
        duration: 60000
    }
});

emailWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error ${err.message}`);
});
