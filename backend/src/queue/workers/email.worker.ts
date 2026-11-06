import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { prisma } from '@/app/lib/services/prisma.service';

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

async function sendEmailViaMailtrap(payload: {
    fromEmail: string;
    fromName: string;
    to: Array<{ email: string; name?: string }>;
    subject: string;
    html: string;
    text?: string;
    category?: string;
    attachments?: Array<any>;
}) {
    const token = process.env.MAILTRAP_TOKEN || 'a06a97429342ce7a3f9e7fcceb83fb8b';
    const isProd = process.env.MAILTRAP_MODE === 'production';

    // 1. Try Mailtrap Official Sending API
    const response = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: {
                email: payload.fromEmail || 'info@trailmandu.com',
                name: payload.fromName || 'Trailmandu'
            },
            to: payload.to,
            subject: payload.subject,
            html: payload.html,
            text: payload.text || 'Please view this email in an HTML-compatible client.',
            category: payload.category || 'general',
            attachments: payload.attachments && payload.attachments.length > 0 ? payload.attachments : undefined
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Mailtrap API returned ${response.status}: ${errorBody}`);
    }

    return await response.json();
}

function isBase64String(val: any): boolean {
    if (typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (trimmed.length === 0 || trimmed.length % 4 !== 0) return false;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) return false;
    try {
        return Buffer.from(trimmed, 'base64').toString('base64') === trimmed;
    } catch {
        return false;
    }
}

function ensureBase64(content: any): string {
    if (!content) return '';
    if (Buffer.isBuffer(content)) {
        return content.toString('base64');
    }
    if (typeof content !== 'string') {
        return Buffer.from(String(content)).toString('base64');
    }
    if (isBase64String(content)) {
        return content.trim();
    }
    return Buffer.from(content).toString('base64');
}

export const emailWorker = new Worker('emailQueue', async (job: Job) => {
    let recipientEmail = 'unknown';
    let finalSubject = 'No Subject';

    try {
        const { fileName, replacements, to, subject, html, text, props, attachments, senderEmail, category, icalEvent } = job.data || {};

        // 1. Extract recipient(s)
        const recipients: Array<{ email: string; name?: string }> = [];
        if (props?.recipients && Array.isArray(props.recipients) && props.recipients.length > 0) {
            recipients.push(...props.recipients);
        } else if (typeof to === 'string') {
            recipients.push({ email: to });
        } else if (Array.isArray(to)) {
            for (const item of to) {
                if (typeof item === 'string') recipients.push({ email: item });
                else if (item?.email) recipients.push(item);
            }
        } else if (replacements?.user?.email) {
            recipients.push({
                email: replacements.user.email,
                name: replacements.user.name || undefined
            });
        }

        if (recipients.length === 0) {
            throw new Error('Recipient email is missing in job data');
        }

        recipientEmail = recipients.map(r => r.email).join(', ');
        finalSubject = subject || props?.subject || replacements?.title || 'No Subject';

        // 2. Resolve HTML content
        let finalHtml = html;
        if (!finalHtml && fileName) {
            const possiblePaths = [
                path.resolve(process.cwd(), 'src/resources/views/email', `${fileName}.html`),
                path.resolve(process.cwd(), 'dist/resources/views/email', `${fileName}.html`),
                path.resolve(__dirname, '../../resources/views/email', `${fileName}.html`),
                path.resolve(__dirname, '../../../resources/views/email', `${fileName}.html`),
                path.resolve(process.cwd(), '../services/notification/src/resources/views/email', `${fileName}.html`),
                path.resolve(__dirname, '../../../../services/notification/src/resources/views/email', `${fileName}.html`)
            ];

            const templatePath = possiblePaths.find(p => fs.existsSync(p));
            if (templatePath) {
                try {
                    const source = fs.readFileSync(templatePath, 'utf-8');
                    const template = Handlebars.compile(source);
                    finalHtml = template(replacements || {});
                } catch (templateErr) {
                    console.error(`[emailWorker] Error compiling template ${fileName}:`, templateErr);
                }
            } else {
                console.warn(`[emailWorker] Template file "${fileName}.html" not found in search paths`);
            }
        }

        if (!finalHtml && replacements?.user) {
            finalHtml = `
                <h2>${finalSubject}</h2>
                <p>Here are the details for your registration:</p>
                <ul>
                    ${Object.entries(replacements.user || {}).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
                </ul>
            `;
        }

        if (!finalHtml) {
            finalHtml = text || 'Please view this email in an HTML-compatible client.';
        }

        // 3. Normalize attachments
        const normalizedAttachments: Array<any> = [];
        if (attachments && Array.isArray(attachments)) {
            for (const att of attachments) {
                if (att.content) {
                    normalizedAttachments.push({
                        filename: att.filename,
                        content: ensureBase64(att.content),
                        type: att.type || att.contentType || 'application/octet-stream',
                        disposition: att.disposition || 'attachment',
                        content_id: att.content_id
                    });
                } else if (att.path && fs.existsSync(att.path)) {
                    normalizedAttachments.push({
                        filename: att.filename || path.basename(att.path),
                        content: fs.readFileSync(att.path).toString('base64'),
                        type: att.type || att.contentType || 'application/octet-stream',
                        disposition: att.disposition || 'attachment'
                    });
                }
            }
        }

        if (icalEvent?.content) {
            const icsFilename = icalEvent.filename || 'invite.ics';
            const alreadyAttached = normalizedAttachments.some(a => a.filename === icsFilename);
            if (!alreadyAttached) {
                normalizedAttachments.push({
                    filename: icsFilename,
                    content: ensureBase64(icalEvent.content),
                    type: 'text/calendar',
                    disposition: 'attachment'
                });
            }
        }

        const fromEmail = senderEmail || process.env.MAIL_ADMIN || 'info@trailmandu.com';

        // 4. Send via Mailtrap
        const result = await sendEmailViaMailtrap({
            fromEmail,
            fromName: 'Trailmandu',
            to: recipients,
            subject: finalSubject,
            html: finalHtml,
            text,
            category,
            attachments: normalizedAttachments
        });

        // 5. Update DB log to SUCCESS
        const isPriority = (job.opts?.priority === 1) || job.data?.priority === 1 || job.data?.is_priority === true || job.data?.category === 'manual_direct_email' || job.data?.category === 'event_test_email';

        try {
            await prisma.emailLog.create({
                data: {
                    recipient: recipientEmail,
                    subject: finalSubject,
                    status: 'SUCCESS',
                    payload: {
                        ...job.data,
                        priority: isPriority ? 1 : 0,
                        is_priority: isPriority
                    },
                    parentId: job.data?.resendParentId || null
                }
            });

            const todayStr = new Date().toISOString().split('T')[0];
            await redisConnection.del(`__cache__/mailtrap:quota:${todayStr}`).catch(() => {});
        } catch (dbErr) {
            console.error('[emailWorker] Failed to save SUCCESS emailLog:', dbErr);
        }

        console.log(`[emailWorker] Successfully sent email to ${recipientEmail} (Job ${job.id})`);
        return result;
    } catch (error: any) {
        console.error(`[emailWorker] Failed to send email (Job ${job?.id}):`, error.message);

        // Save FAILED log to DB
        try {
            await prisma.emailLog.create({
                data: {
                    recipient: recipientEmail,
                    subject: finalSubject,
                    status: 'FAILED',
                    error: error.message || String(error),
                    payload: job.data,
                    parentId: job.data?.resendParentId || null
                }
            });
        } catch (dbError) {
            console.error('[emailWorker] Failed to save FAILED emailLog:', dbError);
        }

        throw error;
    }
}, {
    connection: redisConnection,
    limiter: {
        max: 1,
        duration: 3000 // 1 email every 3 seconds to protect provider rate limits and avoid spam flags
    }
});

emailWorker.on('failed', (job, err) => {
    console.error(`[emailWorker] Job ${job?.id} failed with error: ${err.message}`);
});
