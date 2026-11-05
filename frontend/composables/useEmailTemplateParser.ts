import { ref } from 'vue'
import { toast } from 'vue-sonner'

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
}

export const availableMappings = [
    'First Name', 'Last Name', 'Full Name', 'Email', 'BIB Number',
    'Country', 'Gender', 'Stage Category Name', 'Stage Distance', 'Stage Elevation',
    'GPX File', 'GPX File URL', 'Event Name', 'Event Address', 'Event Timing',
    'Event Thumbnail URL', 'Stage Image URL'
]

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
                else if (lower.includes('event') && !lower.includes('address') && !lower.includes('venue') && !lower.includes('location')) guessed = 'Event Name'
                else if (lower.includes('address') || lower.includes('venue') || lower.includes('location')) guessed = 'Event Address'
                else if (lower.includes('time') || lower.includes('date')) guessed = 'Event Timing'
                else if (lower.includes('gpx') || lower.includes('map_file')) guessed = 'GPX File'
                else if (lower.includes('category') || (lower.includes('stage') && lower.includes('name'))) guessed = 'Stage Category Name'
                else if (lower.includes('distance') || lower.includes('dist')) guessed = 'Stage Distance'
                else if (lower.includes('elevation') || lower.includes('gain') || lower.includes('ascent') || lower.includes('elev')) guessed = 'Stage Elevation'

                updatedVars.push({
                    name: varName,
                    mappedTo: guessed,
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

    const buildVariableMap = (): Record<string, string> => {
        const variableMap: Record<string, string> = {}
        variables.value.forEach(v => {
            variableMap[`{{${v.name}}}`] = v.mappedTo
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
        parseTemplate,
        deleteVariable,
        handleTemplateUpload,
        buildVariableMap,
        replaceLocalImages
    }
}

