import { Address, Attachment, MailtrapClient } from "mailtrap"
import { promises as fs } from "fs"
import fsSync from "fs"
import path from "path"
import Handlebars from "handlebars"

export type SendEmailProps = {
    recipients: Address[],
    subject: string
}

export type SendEmailOptions = {
    fileName?: string;
    replacements?: Record<string, any>;
    props?: {
        recipients?: Address[];
        subject?: string;
    };
    to?: string | string[] | Address[];
    subject?: string;
    html?: string;
    text?: string;
    senderEmail?: string;
    attachments?: Array<any>;
    category?: string;
    icalEvent?: {
        filename?: string;
        content?: string | Buffer;
    };
};

export const useMailTrap = () => {
    const mailtrap = new MailtrapClient({
        token: process.env.MAILTRAP_TOKEN || "",
    })

    const sendEmail = async (
        fileNameOrOptions?: string | SendEmailOptions,
        replacementsOrUndefined?: Record<string, any>,
        propsOrUndefined?: SendEmailProps,
        senderEmailOrUndefined?: string,
        attachmentsOrUndefined?: any[],
        categoryOrUndefined?: string
    ) => {
        let options: SendEmailOptions;
        if (typeof fileNameOrOptions === 'object' && fileNameOrOptions !== null) {
            options = fileNameOrOptions;
        } else {
            options = {
                fileName: fileNameOrOptions as string | undefined,
                replacements: replacementsOrUndefined,
                props: propsOrUndefined,
                senderEmail: senderEmailOrUndefined,
                attachments: attachmentsOrUndefined,
                category: categoryOrUndefined
            };
        }

        // 1. Normalize recipients
        const recipients: Address[] = [];
        if (options.props?.recipients && Array.isArray(options.props.recipients) && options.props.recipients.length > 0) {
            recipients.push(...options.props.recipients);
        } else if (typeof options.to === 'string') {
            recipients.push({ email: options.to });
        } else if (Array.isArray(options.to)) {
            for (const item of options.to) {
                if (typeof item === 'string') {
                    recipients.push({ email: item });
                } else if (item && typeof item === 'object' && item.email) {
                    recipients.push(item);
                }
            }
        } else if (options.replacements?.user?.email) {
            recipients.push({
                email: options.replacements.user.email,
                name: options.replacements.user.name || undefined
            });
        }

        if (recipients.length === 0) {
            throw new Error('No recipient email specified for email delivery');
        }

        // 2. Resolve subject
        const subject = options.props?.subject || options.subject || options.replacements?.title || 'No Subject';

        // 3. Resolve HTML content
        let htmlContent = options.html;
        if (!htmlContent && options.fileName) {
            const possiblePaths = [
                path.resolve(process.cwd(), 'src/resources/views/email', `${options.fileName}.html`),
                path.resolve(process.cwd(), 'dist/resources/views/email', `${options.fileName}.html`),
                path.resolve(__dirname, '../resources/views/email', `${options.fileName}.html`),
                path.resolve(__dirname, '../../src/resources/views/email', `${options.fileName}.html`),
                path.resolve(process.cwd(), '../../backend/src/resources/views/email', `${options.fileName}.html`)
            ];
            const filePath = possiblePaths.find(p => fsSync.existsSync(p));
            if (filePath) {
                const source = await fs.readFile(filePath, 'utf-8');
                const template = Handlebars.compile(source);
                htmlContent = template(options.replacements || {});
            } else {
                console.warn(`[Mailtrap] Template file "${options.fileName}.html" not found in search paths`);
            }
        }

        if (!htmlContent && options.replacements?.user) {
            htmlContent = `
                <h2>${subject}</h2>
                <p>Here are your registration details:</p>
                <ul>
                    ${Object.entries(options.replacements.user).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
                </ul>
            `;
        }

        if (!htmlContent) {
            htmlContent = options.text || 'Please view this email in an HTML-compatible client.';
        }

        // 4. Normalize attachments
        const normalizedAttachments: Attachment[] = [];
        if (options.attachments && Array.isArray(options.attachments)) {
            for (const att of options.attachments) {
                if (att.content) {
                    normalizedAttachments.push({
                        filename: att.filename,
                        content: att.content,
                        type: att.type,
                        disposition: att.disposition || 'attachment',
                        content_id: att.content_id
                    });
                } else if (att.path && fsSync.existsSync(att.path)) {
                    normalizedAttachments.push({
                        filename: att.filename || path.basename(att.path),
                        content: fsSync.readFileSync(att.path).toString('base64'),
                        disposition: att.disposition || 'attachment'
                    });
                }
            }
        }

        if (options.icalEvent && options.icalEvent.content) {
            normalizedAttachments.push({
                filename: options.icalEvent.filename || 'invite.ics',
                content: Buffer.isBuffer(options.icalEvent.content)
                    ? options.icalEvent.content
                    : Buffer.from(options.icalEvent.content).toString('base64'),
                type: 'text/calendar',
                disposition: 'attachment'
            });
        }

        return await mailtrap.send({
            from: {
                email: options.senderEmail || process.env.MAIL_ADMIN || 'admin@trailmandu.com',
                name: 'Trailmandu',
            },
            to: recipients,
            subject: subject,
            html: htmlContent,
            text: options.text,
            attachments: normalizedAttachments.length > 0 ? normalizedAttachments : undefined,
            category: options.category
        });
    }

    return { sendEmail }
}
