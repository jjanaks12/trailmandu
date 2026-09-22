import moment from "moment"

export const humanize = (str: string) => str
    .replace(/^[\s_]+|[\s_]+$/g, '')
    .replace(/[_\s]+/g, ' ')
    .replace(/^[a-z]/, (m) => m.toUpperCase())

export const formatDate = (str?: string | null, format?: string) => {
    if (!str) return '-'
    const date = moment.utc(str)
    const hours = date.diff(moment(), 'hours')

    if (format)
        return date.format(format)

    if (hours <= 24)
        return date.fromNow()

    return date.format(format ?? 'YYYY-MM-DD')
}

export const slugify = (text: string) => text.toLowerCase().trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ').trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const fixDateTime = (date: string, time: string) => {
    return moment
        .tz(`${date} ${time}`, "YYYY-M-D HH:mm:ss", moment.tz.guess())
        .utc()
        .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]")
}

/**
 * function to convert distance to km like 10k, 21k, 100m
 * @param distance distance in m
 * @returns distance in km
 */
export const distanceToKm = (distance: number | string) => {
    let distanceInKm = 0
    if (typeof distance === 'string')
        distanceInKm = parseInt(distance) / 1000
    else
        distanceInKm = distance / 1000
    return distanceInKm + 'k'
}