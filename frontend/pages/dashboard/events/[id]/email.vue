<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { SendIcon } from 'lucide-vue-next'
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
    handleTemplateUpload: onUploadTemplate,
    buildVariableMap,
    replaceLocalImages
} = useEmailTemplateParser()

const handleTemplateUpload = (e: Event) => {
    onUploadTemplate(e, (text) => {
        htmlContent.value = text
    })
}

const {
    previewHtml,
    handleCodeEditorVariable,
    handleCodeEditorKeyDown,
    selectFromMediaLibrary
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
            attachStageGpx.value = data.attachStageGpx || false
            parseTemplate(data.htmlContent || '')

            // Restore variable mappings
            if (data.variableMap) {
                variables.value.forEach(v => {
                    const key = `{{${v.name}}}`
                    if (data.variableMap[key]) {
                        v.mappedTo = data.variableMap[key]
                    }
                })
            }
        }
    } catch (e) {
        console.error('Failed to load existing template', e)
    }
})

const saveTemplate = handleSubmit(async (values) => {
    // Check if any variables are unmapped
    if (variables.value.some(v => !v.mappedTo)) {
        return toast.error('Please map all variables before saving')
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
                                the correct runner data fields.</p>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div v-for="v in variables" :key="v.name"
                                    class="flex items-center gap-3 bg-white p-3 rounded border border-amber-100">
                                    <span class="text-sm font-mono text-gray-600 w-1/3 truncate">\{{ v.name }}</span>
                                    <select v-model="v.mappedTo" class="w-2/3 px-2 py-1 text-sm border rounded">
                                        <option value="">Select Field...</option>
                                        <option v-for="opt in availableMappings" :key="opt" :value="opt">{{ opt }}
                                        </option>
                                    </select>
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
