<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { SendIcon, Trash2Icon, UploadCloudIcon, CodeIcon, SparklesIcon, FileCodeIcon, CheckIcon } from 'lucide-vue-next'
import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'
import ClearCacheButton from '@/components/pages/dashboard/event/ClearCacheButton.vue'
import EventSidebar from '@/components/pages/dashboard/event/sidebar.vue'
import type { TrailRace } from '~/lib/types'
import { useEventStore } from '~/store/event'
import { useStageStore } from '~/store/stage'
import { useAxios } from '~/services/axios'

definePageMeta({
    layout: 'admin',
    middleware: 'auth',
    authorization: ['event_view']
})

const route = useRoute()
const eventId = route.params.id as string
const { get: getEvent } = useEventStore()
const { fetch: fetchStages, stages } = useStageStore()
const { axios } = useAxios()

const trailRace = ref<TrailRace | null>(null)
const attachStageGpx = ref(false)
const isLoading = ref(false)
const activeTab = ref('preview')
const iframeRef = ref<HTMLIFrameElement | null>(null)
const codeEditorRef = ref<any>(null)

// Form state
const schema = yup.object({
    subject: yup.string().required('Subject is required'),
    htmlContent: yup.string().required('Please upload or write an HTML template')
})

const { handleSubmit } = useForm({
    validationSchema: schema,
    initialValues: {
        subject: '',
        htmlContent: ''
    }
})

const { value: subject, errorMessage: subjectError } = useField<string>('subject')
const { value: htmlContent, errorMessage: htmlContentError } = useField<string>('htmlContent')

// Composables
const {
    localImages,
    variables,
    availableMappings,
    parseTemplate,
    deleteVariable,
    handleTemplateUpload: onUploadTemplate,
    buildVariableMap,
    replaceLocalImages
} = useEmailTemplateParser()

const handleTemplateUpload = (e: Event) => {
    onUploadTemplate(e, (text) => {
        htmlContent.value = text
        rawPastedHtml.value = text
    })
}

const templateSource = ref<'upload' | 'paste'>('upload')
const rawPastedHtml = ref('')

watch(templateSource, (newSource) => {
    if (newSource === 'paste' && !rawPastedHtml.value && htmlContent.value) {
        rawPastedHtml.value = htmlContent.value
    }
})

const applyPastedHtml = () => {
    if (!rawPastedHtml.value.trim()) {
        toast.error('Please paste or write some HTML first')
        return
    }
    htmlContent.value = rawPastedHtml.value
    parseTemplate(rawPastedHtml.value)
    activeTab.value = 'preview'
    toast.success('HTML template applied successfully!')
}

const startBlankTemplate = () => {
    const starter = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{event_name}}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
    <tr>
      <td style="padding: 24px; background-color: #f06723; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px;">{{event_name}}</h1>
        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Runner Confirmation</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <p style="margin-top: 0;">Hi <strong>{{first_name}}</strong>,</p>
        <p>You are officially registered for <strong>{{stage_category_name}}</strong>!</p>
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>BIB Number:</strong> {{bib_number}}</p>
          <p style="margin: 4px 0;"><strong>Distance:</strong> {{stage_distance}}</p>
          <p style="margin: 4px 0;"><strong>Elevation:</strong> {{stage_elevation}}</p>
          <p style="margin: 4px 0;"><strong>Venue / Address:</strong> {{event_address}}</p>
        </div>
        <p>See you at the starting line!</p>
      </td>
    </tr>
  </table>
</body>
</html>`
    rawPastedHtml.value = starter
    htmlContent.value = starter
    parseTemplate(starter)
    activeTab.value = 'code'
    toast.success('Starter template loaded into editor')
}

const startEmptyTemplate = () => {
    const empty = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: sans-serif; padding: 20px;">
  <h2>Hello {{first_name}},</h2>
  <p>Welcome to {{event_name}}!</p>
</body>
</html>`
    rawPastedHtml.value = empty
    htmlContent.value = empty
    parseTemplate(empty)
    activeTab.value = 'code'
    toast.success('Blank HTML template ready in editor')
}

const {
    previewHtml,
    handleCodeEditorVariable,
    handleCodeEditorKeyDown,
    selectFromMediaLibrary,
    locateVariable
} = useEmailTemplatePreview({
    htmlContent,
    activeTab,
    codeEditorRef,
    localImages,
    parseTemplate
})

const {
    testEmailDialogOpen,
    testEmailRecipient,
    testEmailStageId,
    isSendingTestEmail,
    openTestEmailDialog,
    sendTestEmail
} = useEmailTemplateTest({
    eventId,
    subject,
    htmlContent,
    variables,
    localImages,
    attachStageGpx
})

onMounted(async () => {
    trailRace.value = await getEvent(eventId)
    await fetchStages(eventId)

    // Fetch existing template
    try {
        const { data } = await axios.get(`/events/${eventId}/email-template`)
        if (data) {
            subject.value = data.subject
            htmlContent.value = data.htmlContent || ''
            rawPastedHtml.value = data.htmlContent || ''
            attachStageGpx.value = data.attachStageGpx || false
            parseTemplate(data.htmlContent || '')

            // Restore variable mappings
            if (data.variableMap) {
                Object.entries(data.variableMap).forEach(([key, mappedField]) => {
                    const cleanName = key.replace(/^\{\{|\}\}$/g, '').trim()
                    const existing = variables.value.find(v => v.name === cleanName)
                    if (existing) {
                        existing.mappedTo = mappedField as string
                    } else {
                        // Previously saved variable not found in current template HTML
                        variables.value.push({
                            name: cleanName,
                            mappedTo: mappedField as string,
                            isUsed: false,
                            usesCount: 0
                        })
                    }
                })
            }
        }
    } catch (e) {
        console.error('Failed to load existing template', e)
    }
})

const saveTemplate = handleSubmit(async (values) => {
    // Check if any active variables are unmapped
    if (variables.value.some(v => v.isUsed !== false && !v.mappedTo)) {
        return toast.error('Please map all active variables before saving')
    }

    // Check if any local images are not uploaded
    if (localImages.value.some(i => !i.uploadedUrl)) {
        return toast.error('Please upload all local images before saving')
    }

    try {
        isLoading.value = true

        const processedHtml = replaceLocalImages(values.htmlContent)
        const variableMap = buildVariableMap()

        const payload = {
            subject: values.subject,
            htmlTemplate: processedHtml,
            variableMap,
            attachStageGpx: attachStageGpx.value
        }

        await axios.post(`/events/${eventId}/email-template`, payload)
        toast.success('Template saved successfully!')

        // Update htmlContent to the processed one so uploaded images stay
        htmlContent.value = processedHtml
        parseTemplate(processedHtml)
    } catch (e: any) {
        toast.error(e.response?.data?.message || 'Failed to save template')
    } finally {
        isLoading.value = false
    }
})
</script>

<template>
    <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-2 text-sm text-gray-500">
            <NuxtLink to="/dashboard/events" class="hover:text-primary transition-colors">Events</NuxtLink>
            <span>/</span>
            <NuxtLink :to="`/dashboard/events/${eventId}`" class="hover:text-primary transition-colors">{{
                trailRace?.name || 'Loading...' }}</NuxtLink>
            <span>/</span>
            <span class="text-gray-900 font-medium">Email template</span>
        </div>
        <ClearCacheButton :event-id="eventId" />
    </div>

    <div class="flex flex-col md:flex-row gap-6">
        <div class="flex-grow space-y-6">
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div class="mb-6 border-b pb-4">
                    <h2 class="text-xl font-bold text-gray-900">Email Template</h2>
                    <p class="text-gray-500 text-sm mt-1">Send customized HTML emails to runners in this event.</p>
                </div>

                <div class="space-y-6">
                    <!-- Basic Info -->
                    <div class="grid grid-cols-1 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                            <input v-model="subject" type="text"
                                :class="{ 'border-red-500 focus:ring-red-500': subjectError, 'border-gray-300 focus:ring-primary focus:border-primary': !subjectError }"
                                class="w-full px-3 py-2 border rounded-md" placeholder="Email Subject">
                            <span v-if="subjectError" class="text-xs text-red-500 mt-1 block">{{ subjectError }}</span>
                        </div>
                    </div>

                    <!-- Options -->
                    <div class="flex items-center gap-2">
                        <input type="checkbox" id="attachGpx" v-model="attachStageGpx"
                            class="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4">
                        <label for="attachGpx" class="text-sm text-gray-700">Automatically attach the GPX file for the
                            stage the runner is registered for</label>
                    </div>

                    <!-- Template Upload -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">HTML Template File</label>
                        <input type="file" accept=".html,.htm" @change="handleTemplateUpload"
                            class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer">
                        <span v-if="htmlContentError" class="text-xs text-red-500 mt-1 block">{{ htmlContentError
                            }}</span>
                    </div>

                    <div v-if="htmlContent" class="space-y-6 pt-4 border-t">
                        <!-- Preview and Code Tabs -->
                        <div>
                            <div class="flex border-b mb-4 justify-between items-center">
                                <div>
                                    <button type="button" @click="activeTab = 'preview'"
                                        :class="{ 'border-b-2 border-primary text-primary font-medium': activeTab === 'preview', 'text-gray-500': activeTab !== 'preview' }"
                                        class="px-4 py-2 hover:text-primary">Preview</button>
                                    <button type="button" @click="activeTab = 'code'"
                                        :class="{ 'border-b-2 border-primary text-primary font-medium': activeTab === 'code', 'text-gray-500': activeTab !== 'code' }"
                                        class="px-4 py-2 hover:text-primary">Code Editor</button>
                                </div>
                                <div v-if="activeTab === 'code'" class="flex items-center gap-2">
                                    <button type="button" @click="handleCodeEditorVariable"
                                        class="text-sm px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md font-medium transition-colors flex items-center gap-1.5">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                                        </svg>
                                        Make Variable from Selection
                                    </button>
                                </div>
                                <div v-else class="text-sm text-gray-500 flex items-center gap-2 px-2">
                                    <span
                                        class="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-xs font-medium border border-blue-200">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z">
                                            </path>
                                        </svg>
                                        Click any text to edit directly
                                    </span>
                                    <span class="text-xs text-gray-400">·</span>
                                    <span class="text-xs text-gray-500">Select text to make variable</span>
                                </div>
                            </div>

                            <div id="template-editor-container">
                                <div v-if="activeTab === 'preview'"
                                    class="border rounded-lg bg-white overflow-hidden shadow-sm">
                                    <iframe ref="iframeRef" :srcdoc="previewHtml" class="w-full h-[600px] border-0 bg-white"
                                        title="Email Preview"></iframe>
                                </div>

                                <div v-if="activeTab === 'code'">
                                    <HtmlCodeEditor ref="codeEditorRef" v-model="htmlContent"
                                        @input="parseTemplate(htmlContent)" @keydown="handleCodeEditorKeyDown"
                                        placeholder="Enter HTML template here..." />
                                </div>
                            </div>
                        </div>
                        <!-- Local Images -->
                        <div v-if="localImages.length > 0" class="bg-blue-50 border border-blue-100 rounded-lg p-4">
                            <h3 class="font-medium text-blue-900 mb-3 flex items-center gap-2">
                                <span
                                    class="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                                Upload Local Images
                            </h3>
                            <p class="text-sm text-blue-700 mb-4">We found local images in your template. Upload them to
                                our server so they display correctly in the email.</p>

                            <div class="space-y-3">
                                <div v-for="(img, idx) in localImages" :key="img.src"
                                    class="flex items-center gap-4 bg-white p-3 rounded border border-blue-100">
                                    <div class="flex-grow truncate">
                                        <span class="text-sm font-mono text-gray-600 block truncate">
                                            {{ img.src }}</span>
                                    </div>
                                    <div v-if="!img.uploadedUrl" class="flex items-center gap-2 flex-shrink-0">
                                        <button @click="selectFromMediaLibrary(idx)"
                                            class="px-3 py-1 bg-primary text-white text-xs rounded shadow-sm hover:bg-primary/90">Select
                                            from Media Library</button>
                                    </div>
                                    <div v-else
                                        class="text-green-600 text-sm font-medium flex items-center gap-1 flex-shrink-0">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M5 13l4 4L19 7"></path>
                                        </svg>
                                        Uploaded
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Variables -->
                        <div v-if="variables.length > 0" class="bg-amber-50 border border-amber-100 rounded-lg p-4">
                            <h3 class="font-medium text-amber-900 mb-3 flex items-center gap-2">
                                <span
                                    class="bg-amber-200 text-amber-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                                Map Variables
                            </h3>
                            <p class="text-sm text-amber-700 mb-4">We found placeholders in your template. Map them to
                                the correct runner data fields. Click any active variable name to locate its first occurrence in the editor.</p>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div v-for="v in variables" :key="v.name"
                                    class="flex items-center gap-2.5 p-3 rounded border transition-colors"
                                    :class="v.isUsed !== false ? 'bg-white border-amber-100 hover:border-amber-300' : 'bg-gray-50 border-gray-200'">
                                    
                                    <!-- Variable name (interactive if used) -->
                                    <button
                                        type="button"
                                        @click="v.isUsed !== false ? locateVariable(v.name) : null"
                                        :class="v.isUsed !== false ? 'cursor-pointer hover:text-amber-800 hover:bg-amber-100/60' : 'cursor-default text-gray-500'"
                                        class="text-sm font-mono flex-1 min-w-0 truncate text-left px-2 py-1 rounded transition-all flex items-center justify-between group"
                                        :title="v.isUsed !== false ? 'Click to locate first occurrence in editor or preview' : 'Variable is not used in the template'"
                                    >
                                        <span class="truncate">\{{ v.name }}</span>
                                        <svg v-if="v.isUsed !== false" class="w-3.5 h-3.5 opacity-0 group-hover:opacity-75 text-amber-700 shrink-0 ml-1 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                        </svg>
                                    </button>

                                    <!-- Status / Usage badges -->
                                    <span v-if="v.isUsed === false" class="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 border border-gray-300 shrink-0">
                                        Unused
                                    </span>
                                    <span v-else-if="v.usesCount && v.usesCount > 1" class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0" :title="`${v.usesCount} occurrences in template`">
                                        {{ v.usesCount }}x
                                    </span>

                                    <!-- Field mapping dropdown -->
                                    <select v-model="v.mappedTo" class="w-40 sm:w-44 shrink-0 px-2 py-1 text-sm border rounded bg-white">
                                        <option value="">Select Field...</option>
                                        <option v-for="opt in availableMappings" :key="opt" :value="opt">{{ opt }}
                                        </option>
                                    </select>

                                    <!-- Delete button (only when unused) -->
                                    <button
                                        v-if="v.isUsed === false"
                                        type="button"
                                        @click="deleteVariable(v.name)"
                                        class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0 cursor-pointer"
                                        title="Delete unused variable"
                                    >
                                        <Trash2Icon class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="flex justify-between items-center pt-4 border-t">
                            <button type="button" @click="openTestEmailDialog"
                                :disabled="isLoading || isSendingTestEmail"
                                class="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-colors cursor-pointer">
                                <SendIcon class="w-4 h-4 text-primary" />
                                <span>Send Test Email</span>
                            </button>

                            <button @click="saveTemplate" :disabled="isLoading"
                                class="px-6 py-2 bg-primary text-white font-medium rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2 hover:bg-primary/90 transition-colors">
                                <svg v-if="isLoading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                        stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                                    </path>
                                </svg>
                                <span>{{ isLoading ? 'Saving...' : 'Save Template' }}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <EventSidebar />
    </div>

    <!-- Test Email Dialog -->
    <Dialog :open="testEmailDialogOpen" @update:open="testEmailDialogOpen = false">
        <DialogContent class="sm:max-w-[480px]">
            <DialogHeader>
                <DialogTitle class="flex items-center gap-2 text-lg">
                    <SendIcon class="w-5 h-5 text-primary" />
                    Send Test Email
                </DialogTitle>
                <DialogDescription>
                    Send a test email rendered with sample runner and event data to verify your template layout and
                    variable replacements.
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-4 py-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Recipient Email Address <span class="text-red-500">*</span>
                    </label>
                    <input v-model="testEmailRecipient" type="email" placeholder="e.g. your-email@example.com"
                        class="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-primary focus:border-primary" />
                </div>

                <div v-if="stages && stages.length > 0">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Sample Stage Data (Optional)</label>
                    <select v-model="testEmailStageId"
                        class="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:ring-primary focus:border-primary">
                        <option value="">Default (First available stage)</option>
                        <option v-for="stg in stages" :key="stg.id" :value="stg.id">
                            {{ stg.name }}
                        </option>
                    </select>
                    <p class="text-xs text-muted-foreground mt-1">
                        Used to populate distance, stage category name, and GPX sample data.
                    </p>
                </div>
            </div>

            <DialogFooter>
                <Button modifier="outline" type="button" @click="testEmailDialogOpen = false">Cancel</Button>
                <Button type="button" @click="sendTestEmail" :disabled="isSendingTestEmail || !testEmailRecipient"
                    class="gap-2">
                    <svg v-if="isSendingTestEmail" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4">
                        </circle>
                        <path class="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                        </path>
                    </svg>
                    <span>{{ isSendingTestEmail ? 'Sending...' : 'Send Test' }}</span>
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
