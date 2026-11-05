import path from 'node:path'
import fs from 'node:fs'
import createHttpError from "http-errors"
import { prisma } from '@/app/lib/services/prisma.service'

import { generateUUID } from "@/app/lib/plugins"
import { __basedir } from "@/index"
import moment from "moment"
import { Image } from '@prisma/client'

type AvailableFolders = 'images' | 'vidoes' | 'gpx' | 'payments' | 'files'

export class FileHandler {
    uploadPath = path.join(__basedir, '/uploads/')

    constructor(folderName: AvailableFolders) {
        if (folderName)
            this.uploadPath = path.join(this.uploadPath, folderName)
    }

    async saveFile(base64STR: any, image_id?: string, ext: string = null): Promise<Image> {
        let image: Image
        const match = base64STR.match(/^data:(.*?)base64,/)
        if (!match && !match[1])
            createHttpError.InternalServerError('Something went bad')

        const decodedBase64 = base64STR.split('base64,')[1]
        const buffer = Buffer.from(decodedBase64, 'base64')
        const type = base64STR.split(';')[0].split('/')[1]
        let fileName = generateUUID() + Date.now().toString() + '.' + (ext ?? type)
        const filePath = path.join(this.uploadPath, fileName)

        if (!fs.existsSync(this.uploadPath)) {
            fs.mkdirSync(this.uploadPath)
        }
        fs.writeFile(filePath, buffer, (err: NodeJS.ErrnoException) => {
            if (err)
                createHttpError.InternalServerError(err.message)
        })

        if (image_id) {
            const previousImage = await prisma.image.findFirst({ where: { id: image_id } })
            const deleteFilePath = path.join(this.uploadPath, previousImage.file_name)

            if (fs.existsSync(deleteFilePath))
                fs.unlinkSync(deleteFilePath)

            image = await prisma.image.update({
                where: {
                    id: image_id
                },
                data: {
                    file_name: fileName,
                    updated_at: moment.utc().toISOString()
                }
            })
        } else
            image = await prisma.image.create({
                data: {
                    file_name: fileName,
                    description: ''
                }
            })

        return image
    }

    async deleteFile(imageID: string) {
        const previousImage = await prisma.image.findFirst({ where: { id: imageID } })
        const deleteFilePath = path.join(this.uploadPath, previousImage.file_name)
        if (fs.existsSync(deleteFilePath))
            fs.unlinkSync(deleteFilePath)
        await prisma.image.delete({
            where: {
                id: imageID
            }
        })

        return true
    }
}