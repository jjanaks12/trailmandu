import { NextFunction, Request, Response } from "express";
import { prisma } from "@/app/lib/services/prisma.service";
import moment from "moment";
import { emailQueue } from "@/queue/email.queue";
import { generateRaceUpdateEmail } from "@/app/lib/templates/email/race_update";

export class RaceUpdateController {
    public static async create(request: Request, response: Response, next: NextFunction) {
        try {
            const { message, stage_id, event_id, parent_id, new_start, new_end } = request.body;

            if (!message) {
                throw new Error("Message is required");
            }

            const raceUpdate = await prisma.raceUpdate.create({
                data: {
                    message,
                    stage_id,
                    event_id,
                    parent_id,
                }
            });

            if (new_start || new_end) {
                if (stage_id) {
                    await prisma.stageCategory.updateMany({
                        where: { stage_id },
                        data: {
                            ...(new_start && { start: new Date(new_start) }),
                            ...(new_end && { end: new Date(new_end) })
                        }
                    });
                } else if (event_id) {
                    await prisma.trailRace.update({
                        where: { id: event_id },
                        data: {
                            ...(new_start && { start: new Date(new_start) }),
                            ...(new_end && { end: new Date(new_end) })
                        }
                    });
                }
            }

            // If this is a stage update, notify registered runners
            if (stage_id) {
                const runners = await prisma.eventRunner.findMany({
                    where: {
                        stage_id,
                        status: null // Assuming status being null means active.
                    },
                    include: {
                        personal: true,
                        stage: {
                            include: {
                                event: true
                            }
                        }
                    }
                });

                for (const runner of runners) {
                    if (runner.personal && runner.personal.email) {
                        const eventName = runner.stage?.event?.name || 'TrailRace Event';
                        const stageName = runner.stage?.name || 'Stage';
                        
                        await emailQueue.add('sendEmail', {
                            to: runner.personal.email,
                            subject: `Important Update for ${eventName} - ${stageName}`,
                            html: generateRaceUpdateEmail({
                                runnerName: runner.personal.first_name || 'Runner',
                                eventName,
                                stageName,
                                message,
                                newStart: new_start,
                                newEnd: new_end
                            })
                        });
                    }
                }
            }

            // Similarly for event_id, if we want to notify all event runners
            if (event_id && !stage_id) {
                const runners = await prisma.eventRunner.findMany({
                    where: {
                        event_id,
                        status: null
                    },
                    include: {
                        personal: true,
                        event: true
                    }
                });

                // to avoid duplicate emails if they registered for multiple stages
                const uniqueEmails = new Set();

                for (const runner of runners) {
                    if (runner.personal && runner.personal.email && !uniqueEmails.has(runner.personal.email)) {
                        uniqueEmails.add(runner.personal.email);
                        const eventName = runner.event?.name || 'TrailRace Event';
                        
                        await emailQueue.add('sendEmail', {
                            to: runner.personal.email,
                            subject: `Important Update for ${eventName}`,
                            html: generateRaceUpdateEmail({
                                runnerName: runner.personal.first_name || 'Runner',
                                eventName,
                                message,
                                newStart: new_start,
                                newEnd: new_end
                            })
                        });
                    }
                }
            }

            response.send(raceUpdate);
        } catch (error) {
            next(error);
        }
    }

    public static async index(request: Request, response: Response, next: NextFunction) {
        try {
            const { stage_id, event_id } = request.query;
            
            const updates = await prisma.raceUpdate.findMany({
                where: {
                    ...(stage_id && { stage_id: String(stage_id) }),
                    ...(event_id && { event_id: String(event_id) }),
                    deleted_at: null
                },
                orderBy: {
                    created_at: 'desc'
                },
                include: {
                    replies: true
                }
            });
            
            response.send(updates);
        } catch (error) {
            next(error);
        }
    }
}
