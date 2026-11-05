import { NextFunction, Request, Response } from "express"

import { prisma } from '@/app/lib/services/prisma.service'
export class HomeController {
    public static async gallery(request: Request, response: Response, next: NextFunction) {
        try {
            const rawTake = request.query.take ? parseInt(request.query.take as string, 10) : 10
            const take = isNaN(rawTake) ? 10 : rawTake
            const tags = request.query.tags

            const where: any = {}
            if (tags) {
                const tagList = Array.isArray(tags) ? (tags as string[]) : [tags as string]
                where.galleries = {
                    some: {
                        tags: {
                            some: {
                                name: {
                                    in: tagList
                                }
                            }
                        }
                    }
                }
            }

            const data = await prisma.image.findMany({
                where,
                orderBy: {
                    created_at: 'desc'
                },
                take
            })
            response.json(data)
        } catch (error) {
            next(error)
        }
    }

    public static async heroSlider(request: Request, response: Response, next: NextFunction) {
        try {
            const galleryName = (request.query.name as string) || 'Home gallery'

            const gallery = await prisma.gallery.findFirst({
                where: {
                    name: galleryName,
                    deleted_at: null
                },
                include: {
                    images: {
                        select: {
                            id: true,
                            file_name: true
                        },
                        orderBy: {
                            created_at: 'desc'
                        }
                    }
                }
            })

            response.json(gallery?.images ?? [])
        } catch (error) {
            next(error)
        }
    }

    public static async sponsors(request: Request, response: Response, next: NextFunction) {
        try {
            const data = await prisma.sponsorType.findMany({
                where: {
                    deleted_at: null,
                    sponsors: {
                        some: {
                            deleted_at: null
                        }
                    }
                },
                include: {
                    sponsors: {
                        where: { deleted_at: null },
                        include: { thumbnail: true }
                    }
                },
                orderBy: {
                    priority: 'asc'
                }
            })

            const sanitizeDates = (obj: any): any => {
                if (obj === null || obj === undefined) return obj;
                if (obj instanceof Date) {
                    return isNaN(obj.getTime()) ? null : obj;
                }
                if (Array.isArray(obj)) {
                    return obj.map(sanitizeDates);
                }
                if (typeof obj === 'object') {
                    const sanitized: any = {};
                    for (const key in obj) {
                        sanitized[key] = sanitizeDates(obj[key]);
                    }
                    return sanitized;
                }
                return obj;
            }

            response.json(sanitizeDates(data))
        } catch (error) {
            next(error)
        }
    }
}