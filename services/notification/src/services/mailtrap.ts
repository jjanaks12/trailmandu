import { Address, Attachment, MailtrapClient } from "mailtrap"
import { promises as fs } from "fs"
import fsSync from "fs"
import path from "path"
import Handlebars from "handlebars"

type SendEmailProps = {
    recipients: Address[],
    subject: string
}

export const useMailTrap = () => {
    const mailtrap = new MailtrapClient({
        token: process.env.MAILTRAP_TOKEN || "",
    })

    const sendEmail = async (fileName: string, replacements: Record<string, any>, props: SendEmailProps, senderEmail?: string, attachments?: Attachment[], category?: string) => {
        const possiblePaths = [
            path.resolve(process.cwd(), 'src/resources/views/email', `${fileName}.html`),
            path.resolve(process.cwd(), 'dist/resources/views/email', `${fileName}.html`),
            path.resolve(__dirname, '../resources/views/email', `${fileName}.html`),
            path.resolve(__dirname, '../../src/resources/views/email', `${fileName}.html`)
        ];
        const filePath = possiblePaths.find(p => fsSync.existsSync(p)) || possiblePaths[0];
        const source = await fs.readFile(filePath, 'utf-8')
        const template = Handlebars.compile(source)
        const HTMLToSend = template(replacements)

        try {
            await mailtrap.send({
                from: {
                    email: senderEmail || process.env.MAIL_ADMIN,
                    name: 'Trailmandu',
                },
                to: props.recipients,
                subject: props.subject,
                html: HTMLToSend,
                attachments,
                category
            })
        } catch (error) {
            throw error
        }
    }

    return { sendEmail }
}