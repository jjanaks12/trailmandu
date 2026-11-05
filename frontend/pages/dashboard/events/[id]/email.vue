<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { SendIcon } from 'lucide-vue-next'
import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'
import ClearCacheButton from '@/components/pages/dashboard/event/ClearCacheButton.vue'
import EventSidebar from '@/components/pages/dashboard/event/sidebar.vue'
import type { TrailRace, Stage } from '~/lib/types'
import { useEventStore } from '~/store/event'
import { useStageStore } from '~/store/stage'
import { useMediaStore } from '~/store/media'
import { useAuthStore } from '~/store/auth'
import { useAxios } from '~/services/axios'
import { useRuntimeConfig } from '#app'

definePageMeta({
    layout: 'admin',
    middleware: 'auth',
    authorization: ['event_view']
})

const route = useRoute()
const { get: getEvent } = useEventStore()
const { fetch: fetchStages, stages } = useStageStore()
const mediaStore = useMediaStore()
const { media } = storeToRefs(mediaStore)
const { axios } = useAxios()
const config = useRuntimeConfig()
const authStore = useAuthStore()

const testEmailDialogOpen = ref(false)
const testEmailRecipient = ref('')
const testEmailStageId = ref('')
const isSendingTestEmail = ref(false)

const openTestEmailDialog = () => {
    if (!testEmailRecipient.value) {
        testEmailRecipient.value = authStore.user?.personal?.email || ''
    }
    testEmailDialogOpen.value = true
}

const eventId = route.params.id as string
const trailRace = ref<TrailRace | null>(null)

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
const attachStageGpx = ref(false)
const isLoading = ref(false)
const activeTab = ref('preview')
const iframeRef = ref<HTMLIFrameElement | null>(null)
const codeEditorRef = ref<any>(null)

const previewHtml = computed(() => {
    if (!htmlContent.value) return ''
    return htmlContent.value + `
    <style>
        #_var_tooltip {
            position: absolute;
            background: #111827;
            color: white;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            display: none;
            z-index: 99999;
            font-family: system-ui, sans-serif;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            overflow: hidden;
        }
        .tooltip-btn {
            padding: 6px 10px;
        }
        .tooltip-btn:hover {
            background: #374151;
        }
        ._preview_text_editable {
            transition: outline 0.15s ease, background-color 0.15s ease;
            border-radius: 2px;
        }
        ._preview_text_editable:hover {
            outline: 1.5px dashed #3b82f6 !important;
            cursor: text !important;
        }
        ._preview_text_editable:focus {
            outline: 2px solid #2563eb !important;
            background-color: rgba(59, 130, 246, 0.06) !important;
        }
    </style>
    <div id="_var_tooltip"></div>
    <script>
        let currentSelection = '';
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            const tooltip = document.getElementById('_var_tooltip');
            currentSelection = selection ? selection.toString().trim() : '';
            if (currentSelection.length > 0) {
                try {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    tooltip.innerHTML = '<div class="tooltip-btn" onmousedown="createVar(event)">Make Variable</div>';
                    tooltip.style.display = 'block';
                    tooltip.style.flexDirection = 'row';
                    tooltip.style.top = (rect.top + window.scrollY - 30) + 'px';
                    tooltip.style.left = (rect.left + window.scrollX + (rect.width / 2) - (tooltip.offsetWidth / 2)) + 'px';
                } catch(e) {}
            }
        });
        
        document.addEventListener('click', (e) => {
            const tooltip = document.getElementById('_var_tooltip');
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
                window.currentImageSrc = e.target.getAttribute('src');
                const rect = e.target.getBoundingClientRect();
                tooltip.style.display = 'flex';
                tooltip.style.flexDirection = 'column';
                tooltip.innerHTML = '<div class="tooltip-btn" onmousedown="imgAction(event, \\'variable\\')">Make Variable</div><div class="tooltip-btn" onmousedown="imgAction(event, \\'upload\\')">Change Image</div>';
                
                tooltip.style.top = (rect.top + window.scrollY + (rect.height / 2) - (tooltip.offsetHeight / 2)) + 'px';
                tooltip.style.left = (rect.left + window.scrollX + (rect.width / 2) - (tooltip.offsetWidth / 2)) + 'px';
            } else if (!tooltip.contains(e.target)) {
                if (currentSelection.length === 0) {
                    tooltip.style.display = 'none';
                }
            }
        });

        // Prevent links from navigating away inside preview
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
                e.preventDefault();
            }
        });

        // Initialize inline text editing on leaf text elements
        function initEditableElements() {
            const candidates = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, td, th, li, a, span, b, strong, em, i, label, div');
            candidates.forEach(el => {
                if (el.closest('#_var_tooltip')) return;

                const hasBlockChildren = el.querySelector('p, h1, h2, h3, h4, h5, h6, table, ul, ol, div');
                if (!hasBlockChildren && el.innerText && el.innerText.trim().length > 0) {
                    el.setAttribute('contenteditable', 'plaintext-only');
                    el.classList.add('_preview_text_editable');

                    let originalText = '';
                    el.addEventListener('focus', () => {
                        originalText = el.innerText;
                    });

                    el.addEventListener('blur', () => {
                        const currentText = el.innerText;
                        if (currentText !== originalText && originalText.trim().length > 0) {
                            window.parent.postMessage({
                                type: 'TEXT_EDITED',
                                oldText: originalText,
                                newText: currentText
                            }, '*');
                            originalText = currentText;
                        }
                    });

                    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'strong', 'em', 'b', 'i', 'label'].includes(el.tagName.toLowerCase())) {
                        el.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                el.blur();
                            }
                        });
                    }
                }
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initEditableElements);
        } else {
            initEditableElements();
        }

        function createVar(e) {
            e.preventDefault();
            if (currentSelection.length > 0) {
                window.parent.postMessage({ type: 'CREATE_VAR', text: currentSelection }, '*');
            }
            document.getElementById('_var_tooltip').style.display = 'none';
        }

        function imgAction(e, action) {
            e.preventDefault();
            window.parent.postMessage({ type: 'IMAGE_ACTION', action: action, src: window.currentImageSrc }, '*');
            document.getElementById('_var_tooltip').style.display = 'none';
        }
    <` + `/script>
    `
})

const createVariableWithPrompt = (selectedText: string, isCodeEditor = false) => {
    if (!selectedText) {
        toast.error("Please select some text first.");
        return;
    }
    const varName = prompt(`Create variable for "${selectedText}"\n\nEnter variable name (e.g. first_name):`);
    if (!varName) return;

    if (isCodeEditor && codeEditorRef.value) {
        const start = codeEditorRef.value.selectionStart;
        const end = codeEditorRef.value.selectionEnd;
        const before = htmlContent.value.substring(0, start);
        const after = htmlContent.value.substring(end);
        htmlContent.value = before + `{{${varName}}}` + after;
        parseTemplate(htmlContent.value);
        toast.success('Variable created!');
    } else {
        if (htmlContent.value.includes(selectedText)) {
            htmlContent.value = htmlContent.value.replace(selectedText, `{{${varName}}}`);
            parseTemplate(htmlContent.value);
            toast.success('Variable created!');
        } else {
            toast.error("Could not find the exact text in the HTML source. Try selecting simpler text or use the Code Editor.");
        }
    }
}

const handleCodeEditorVariable = () => {
    if (codeEditorRef.value) {
        const start = codeEditorRef.value.selectionStart;
        const end = codeEditorRef.value.selectionEnd;
        if (start !== end) {
            const selectedText = htmlContent.value.substring(start, end);
            createVariableWithPrompt(selectedText, true);
        } else {
            toast.error("Please select some text in the Code Editor first.");
        }
    }
}

const handleCodeEditorKeyDown = (e: KeyboardEvent) => {
    // Allow Tab key to indent with 2 spaces instead of leaving textarea
    if (e.key === 'Tab' && codeEditorRef.value) {
        e.preventDefault()
        const textarea = codeEditorRef.value
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const val = htmlContent.value
        htmlContent.value = val.substring(0, start) + '  ' + val.substring(end)
        nextTick(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 2
        })
    }
}

const replaceImageSrc = (oldSrc: string, newSrc: string) => {
    if (!oldSrc) return;
    if (htmlContent.value.includes(`src="${oldSrc}"`)) {
        htmlContent.value = htmlContent.value.replace(`src="${oldSrc}"`, `src="${newSrc}"`);
    } else if (htmlContent.value.includes(`src='${oldSrc}'`)) {
        htmlContent.value = htmlContent.value.replace(`src='${oldSrc}'`, `src='${newSrc}'`);
    } else {
        htmlContent.value = htmlContent.value.replace(oldSrc, newSrc);
    }
    parseTemplate(htmlContent.value);
}

const selectImageForSrc = (src: string) => {
    media.value.show = true
    media.value.mode = 'image'
    media.value.isMultiple = false
    media.value.action = async (state: any) => {
        if (media.value.selectedImages && media.value.selectedImages.length > 0) {
            const selectedImageId = media.value.selectedImages[0]
            try {
                const image = await mediaStore.fetchImage(selectedImageId)
                const newUrl = `${config.public.serverUrl}resources/images/${image.file_name}`
                replaceImageSrc(src, newUrl);
                toast.success('Image replaced successfully!')
            } catch (error) {
                toast.error('Failed to fetch image details')
            }
        }
        media.value.show = false
    }
}

const handleIframeMessage = (e: MessageEvent) => {
    if (!e.data) return;
    if (e.data.type === 'CREATE_VAR') {
        createVariableWithPrompt(e.data.text.trim())
    } else if (e.data.type === 'IMAGE_ACTION') {
        const src = e.data.src;
        if (e.data.action === 'variable') {
            const varName = prompt(`Create variable for image source\n\nEnter variable name (e.g. hero_image):`);
            if (varName) {
                replaceImageSrc(src, `{{${varName}}}`);
                toast.success('Image variable created!');
            }
        } else if (e.data.action === 'upload') {
            selectImageForSrc(src);
        }
    } else if (e.data.type === 'TEXT_EDITED') {
        const { oldText, newText } = e.data
        if (oldText && newText !== undefined && oldText !== newText) {
            if (htmlContent.value.includes(oldText)) {
                htmlContent.value = htmlContent.value.replace(oldText, newText)
                parseTemplate(htmlContent.value)
                toast.success('Text updated in template!')
            } else {
                const trimmedOld = oldText.trim()
                if (htmlContent.value.includes(trimmedOld)) {
                    htmlContent.value = htmlContent.value.replace(trimmedOld, newText.trim())
                    parseTemplate(htmlContent.value)
                    toast.success('Text updated in template!')
                } else {
                    toast.error('Could not find the exact text in template HTML. Use the Code Editor to edit.')
                }
            }
        }
    }
}

// Parsed template state
const localImages = ref<{ src: string, uploadedUrl: string | null, file: File | null }[]>([])
const variables = ref<{ name: string, mappedTo: string }[]>([])

const availableMappings = [
    'First Name', 'Last Name', 'Full Name', 'Email', 'BIB Number',
    'Country', 'Gender', 'Stage Category Name', 'Stage Distance',
    'GPX File', 'GPX File URL', 'Event Name', 'Event Timing',
    'Event Thumbnail URL', 'Stage Image URL'
]

onMounted(async () => {
    window.addEventListener('message', handleIframeMessage)
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

onUnmounted(() => {
    window.removeEventListener('message', handleIframeMessage)
})

const handleTemplateUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
        const text = e.target?.result as string
        htmlContent.value = text
        parseTemplate(text)
        toast.success('Template loaded successfully!')
    }
    reader.readAsText(file)
}

const parseTemplate = (html: string) => {
    // 1. Find local images
    localImages.value = []
    const imgRegex = /<img[^>]+src="([^">]+)"/g
    let match
    while ((match = imgRegex.exec(html)) !== null) {
        const src = match[1]
        // If not absolute and not data URI
        if (!src.startsWith('http') && !src.startsWith('data:')) {
            if (!localImages.value.find(i => i.src === src)) {
                localImages.value.push({ src, uploadedUrl: null, file: null })
            }
        }
    }

    // 2. Find variables {{something}}
    const existingVars = [...variables.value]
    variables.value = []
    const varRegex = /\{\{([^}]+)\}\}/g
    while ((match = varRegex.exec(html)) !== null) {
        const varName = match[1].trim()
        if (!variables.value.find(v => v.name === varName)) {
            const existing = existingVars.find(v => v.name === varName)
            if (existing) {
                variables.value.push(existing)
            } else {
                // Auto-guess mapping if possible, otherwise empty
                let guessed = ''
                const lower = varName.toLowerCase()
                if (lower.includes('first')) guessed = 'First Name'
                else if (lower.includes('last')) guessed = 'Last Name'
                else if (lower.includes('name')) guessed = 'Full Name'
                else if (lower.includes('bib')) guessed = 'BIB Number'
                else if (lower.includes('country')) guessed = 'Country'
                else if (lower.includes('gender')) guessed = 'Gender'
                else if (lower.includes('event')) guessed = 'Event Name'
                else if (lower.includes('time') || lower.includes('date')) guessed = 'Event Timing'
                else if (lower.includes('gpx') || lower.includes('map_file')) guessed = 'GPX File'
                else if (lower.includes('category') || (lower.includes('stage') && lower.includes('name'))) guessed = 'Stage Category Name'
                else if (lower.includes('distance') || lower.includes('dist')) guessed = 'Stage Distance'

                variables.value.push({ name: varName, mappedTo: guessed })
            }
        }
    }
}

const selectFromMediaLibrary = (index: number) => {
    if (localImages.value[index]) {
        selectImageForSrc(localImages.value[index].src);
    }
}

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

        // Replace image srcs in HTML
        let processedHtml = values.htmlContent
        localImages.value.forEach(img => {
            if (img.uploadedUrl) {
                // simple string replace for the exact src
                processedHtml = processedHtml.replace(new RegExp(`src="${img.src}"`, 'g'), `src="${img.uploadedUrl}"`)
            }
        })

        // Build variable map
        const variableMap: Record<string, string> = {}
        variables.value.forEach(v => {
            variableMap[`{{${v.name}}}`] = v.mappedTo
        })

        const payload = {
            subject: values.subject,
            htmlTemplate: processedHtml,
            variableMap,
            attachStageGpx: attachStageGpx.value
        }

        const { data } = await axios.post(`/events/${eventId}/email-template`, payload)
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

const sendTestEmail = async () => {
    if (!testEmailRecipient.value || !testEmailRecipient.value.trim()) {
        toast.error('Please enter a recipient email address')
        return
    }

    if (!subject.value) {
        toast.error('Please enter a subject first')
        return
    }

    if (!htmlContent.value) {
        toast.error('Please provide HTML template content')
        return
    }

    // Check if any variables are unmapped
    if (variables.value.some(v => !v.mappedTo)) {
        return toast.error('Please map all variables before sending a test email')
    }

    // Check if any local images are not uploaded
    if (localImages.value.some(i => !i.uploadedUrl)) {
        return toast.error('Please upload or replace all local images before sending a test email')
    }

    try {
        isSendingTestEmail.value = true

        const variableMap: Record<string, string> = {}
        variables.value.forEach(v => {
            variableMap[`{{${v.name}}}`] = v.mappedTo
        })

        let processedHtml = htmlContent.value
        localImages.value.forEach(img => {
            if (img.uploadedUrl) {
                processedHtml = processedHtml.replace(img.src, img.uploadedUrl)
            }
        })

        await axios.post(`/events/${eventId}/email-template/test`, {
            testEmail: testEmailRecipient.value.trim(),
            subject: subject.value,
            htmlTemplate: processedHtml,
            variableMap,
            attachStageGpx: attachStageGpx.value,
            stageId: testEmailStageId.value || undefined
        })

        toast.success(`Test email sent to ${testEmailRecipient.value.trim()}`)
        testEmailDialogOpen.value = false
    } catch (err: any) {
        toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to send test email')
    } finally {
        isSendingTestEmail.value = false
    }
}
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
                                    <span class="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-xs font-medium border border-blue-200">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
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
