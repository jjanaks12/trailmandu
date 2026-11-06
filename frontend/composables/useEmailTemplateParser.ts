import { ref } from 'vue'
import { toast } from 'vue-sonner'
import moment from 'moment'

export interface LocalImageItem {
    src: string
    uploadedUrl: string | null
    file: File | null
}

export interface VariableItem {
    name: string
    mappedTo: string
    isUsed?: boolean
    usesCount?: number
    dateFormat?: string
    timezone?: string
    customFormat?: string
}

export const availableMappings = [
    'First Name', 'Last Name', 'Full Name', 'Email', 'BIB Number',
    'Country', 'Gender',
    'Stage Address', 'Current Stage Address', 'Stage Category Name', 'Stage Distance', 'Stage Elevation',
    'GPX File', 'GPX File URL', 'Stage Image URL',
    'Event Name', 'Event Address', 'Event Timing', 'Event Thumbnail URL'
]

export const availableDateTimeFormats = [
    { label: 'Nov 07, 2026 06:00 AM', value: 'MMM DD, YYYY hh:mm A' },
    { label: 'November 07, 2026 at 06:00 AM', value: 'MMMM DD, YYYY [at] hh:mm A' },
    { label: 'Saturday, Nov 07, 2026 06:00 AM', value: 'ddd, MMM DD, YYYY hh:mm A' },
    { label: 'Saturday, November 07, 2026', value: 'dddd, MMMM DD, YYYY' },
    { label: '07 Nov 2026, 06:00', value: 'DD MMM YYYY, HH:mm' },
    { label: '07-11-2026 06:00 AM', value: 'DD-MM-YYYY hh:mm A' },
    { label: '2026-11-07 06:00', value: 'YYYY-MM-DD HH:mm' },
    { label: 'Nov 07, 2026 (Date only)', value: 'MMM DD, YYYY' },
    { label: '06:00 AM (Time only)', value: 'hh:mm A' },
    { label: 'Custom Format...', value: 'custom' }
]

export const availableTimezones = [
    { label: 'Nepal Time (NPT, UTC+5:45)', value: 'Asia/Kathmandu' },
    { label: 'India Time (IST, UTC+5:30)', value: 'Asia/Kolkata' },
    { label: 'Coordinated Universal Time (UTC)', value: 'UTC' },
    { label: 'Gulf Standard Time (GST, UTC+4)', value: 'Asia/Dubai' },
    { label: 'London Time (GMT/BST)', value: 'Europe/London' },
    { label: 'US Eastern Time (EST/EDT)', value: 'America/New_York' },
    { label: 'Browser Local Time', value: 'LOCAL' }
]

export function formatEventTiming(
    rawDate: string | Date | null | undefined,
    formatStr = 'MMM DD, YYYY hh:mm A',
    timezone = 'Asia/Kathmandu'
): string {
    if (!rawDate) return ''
    try {
        const d = new Date(rawDate)
        if (isNaN(d.getTime())) return String(rawDate)

        const tz = timezone === 'LOCAL' || !timezone
            ? (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kathmandu')
            : timezone

        const localized = new Date(d.toLocaleString('en-US', { timeZone: tz }))
        const fmt = formatStr === 'custom' ? 'MMM DD, YYYY hh:mm A' : (formatStr || 'MMM DD, YYYY hh:mm A')
        return moment(localized).format(fmt)
    } catch {
        return moment(rawDate).format(formatStr || 'MMM DD, YYYY hh:mm A')
    }
}

export function useEmailTemplateParser() {
    const localImages = ref<LocalImageItem[]>([])
    const variables = ref<VariableItem[]>([])

    const parseTemplate = (html: string) => {
        // 1. Find local images
        localImages.value = []
        const imgRegex = /<img[^>]+src="([^">]+)"/g
        let match: RegExpExecArray | null
        while ((match = imgRegex.exec(html)) !== null) {
            const src = match[1]
            // If not absolute and not data URI
            if (!src.startsWith('http') && !src.startsWith('data:')) {
                if (!localImages.value.find(i => i.src === src)) {
                    localImages.value.push({ src, uploadedUrl: null, file: null })
                }
            }
        }

        // 2. Count occurrences of variables {{something}}
        const varCounts: Record<string, number> = {}
        const varRegex = /\{\{([^}]+)\}\}/g
        while ((match = varRegex.exec(html)) !== null) {
            const varName = match[1].trim()
            varCounts[varName] = (varCounts[varName] || 0) + 1
        }

        // Update existing variables and preserve them even if unused
        const updatedVars: VariableItem[] = []
        const seenNames = new Set<string>()

        for (const v of variables.value) {
            const count = varCounts[v.name] || 0
            updatedVars.push({
                ...v,
                isUsed: count > 0,
                usesCount: count
            })
            seenNames.add(v.name)
        }

        // Add newly discovered placeholders
        for (const [varName, count] of Object.entries(varCounts)) {
            if (!seenNames.has(varName)) {
                let guessed = ''
                const lower = varName.toLowerCase()
                if (lower.includes('first')) guessed = 'First Name'
                else if (lower.includes('last')) guessed = 'Last Name'
                else if (lower.includes('name')) guessed = 'Full Name'
                else if (lower.includes('bib')) guessed = 'BIB Number'
                else if (lower.includes('country')) guessed = 'Country'
                else if (lower.includes('gender')) guessed = 'Gender'
                else if (lower.includes('current_stage') || lower.includes('current-stage')) guessed = 'Current Stage Address'
                else if (lower.includes('address') || lower.includes('venue') || lower.includes('location')) guessed = 'Stage Address'
                else if (lower.includes('event') && !lower.includes('address') && !lower.includes('venue') && !lower.includes('location')) guessed = 'Event Name'
                else if (lower.includes('time') || lower.includes('date')) guessed = 'Event Timing'
                else if (lower.includes('gpx') || lower.includes('map_file')) guessed = 'GPX File'
                else if (lower.includes('category') || (lower.includes('stage') && lower.includes('name'))) guessed = 'Stage Category Name'
                else if (lower.includes('distance') || lower.includes('dist')) guessed = 'Stage Distance'
                else if (lower.includes('elevation') || lower.includes('gain') || lower.includes('ascent') || lower.includes('elev')) guessed = 'Stage Elevation'

                updatedVars.push({
                    name: varName,
                    mappedTo: guessed,
                    dateFormat: guessed === 'Event Timing' ? 'MMM DD, YYYY hh:mm A' : undefined,
                    timezone: guessed === 'Event Timing' ? 'Asia/Kathmandu' : undefined,
                    isUsed: true,
                    usesCount: count
                })
                seenNames.add(varName)
            }
        }

        variables.value = updatedVars
    }

    const deleteVariable = (name: string) => {
        const item = variables.value.find(v => v.name === name)
        if (!item) return
        if (item.isUsed) {
            toast.error(`Cannot delete "{{${name}}}" because it is currently used in the template`)
            return
        }
        variables.value = variables.value.filter(v => v.name !== name)
        toast.success(`Removed unused variable "{{${name}}}"`)
    }

    const handleTemplateUpload = (e: Event, onLoaded: (text: string) => void) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (loadEvt) => {
            const text = loadEvt.target?.result as string
            onLoaded(text)
            parseTemplate(text)
            toast.success('Template loaded successfully!')
        }
        reader.readAsText(file)
    }

    const buildVariableMap = (): Record<string, any> => {
        const variableMap: Record<string, any> = {}
        variables.value.forEach(v => {
            if (v.mappedTo === 'Event Timing') {
                variableMap[`{{${v.name}}}`] = {
                    mappedTo: 'Event Timing',
                    dateFormat: (v.dateFormat === 'custom' ? v.customFormat : v.dateFormat) || 'MMM DD, YYYY hh:mm A',
                    timezone: v.timezone || 'Asia/Kathmandu'
                }
            } else {
                variableMap[`{{${v.name}}}`] = v.mappedTo
            }
        })
        return variableMap
    }

    const replaceLocalImages = (html: string): string => {
        let processedHtml = html
        localImages.value.forEach(img => {
            if (img.uploadedUrl) {
                processedHtml = processedHtml.replace(new RegExp(`src="${img.src}"`, 'g'), `src="${img.uploadedUrl}"`)
            }
        })
        return processedHtml
    }

    return {
        localImages,
        variables,
        availableMappings,
        availableDateTimeFormats,
        availableTimezones,
        formatEventTiming,
        parseTemplate,
        deleteVariable,
        handleTemplateUpload,
        buildVariableMap,
        replaceLocalImages
    }
}

